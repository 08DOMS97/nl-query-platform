/**
 * EXPLAIN sin ANALYZE de los SQL generados en la evaluación con Gemini y de sus
 * referencias, contra el banco de volumen (29/10/2026). No ejecuta las consultas: pide
 * el plan estimado (Postgres EXPLAIN (FORMAT JSON), MySQL/MariaDB EXPLAIN FORMAT=JSON,
 * SQL Server SHOWPLAN_XML). Cada SQL pasa antes por validateQuerySafety().
 *
 *   npm run build; node --env-file=.env scripts/evaluacion_explain.mjs
 *
 * Lee docs/evaluacion_gemini/resultados.jsonl y escribe docs/evaluacion_gemini/explain.json.
 * Sin costo: no llama a Gemini. Usa los datos de conexión del .env (DB_*).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NLQP = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BACK = path.join(NLQP, 'backend');
const require = createRequire(path.join(BACK, 'package.json'));
const pg = require('pg');
const mysql = require('mysql2/promise');
const mssql = require('mssql');
const { validateQuerySafety } = await import(pathToFileURL(path.join(BACK, 'lib/services/querySafety.service.js')).href);

const env = (p, k) => process.env[`DB_${p}_${k}`];
const cfg = (p) => ({ host: env(p, 'HOST'), port: Number(env(p, 'PORT')), database: env(p, 'DATABASE'), user: env(p, 'USER'), password: env(p, 'PASSWORD') });

const pgc = new pg.Client({ ...cfg('POSTGRES'), statement_timeout: 60_000 });
await pgc.connect();
const my = await mysql.createConnection({ ...cfg('MYSQL') });
await my.query('SET SESSION max_execution_time = 60000');
const ma = await mysql.createConnection({ ...cfg('MARIADB') });
await ma.query('SET SESSION max_statement_time = 60');
const c = cfg('MSSQL');
const ms = await new mssql.ConnectionPool({ server: c.host, port: c.port, database: c.database, user: c.user, password: c.password, pool: { max: 1, min: 1 }, options: { encrypt: true, trustServerCertificate: process.env.DB_MSSQL_TRUST_SERVER_CERTIFICATE === 'true' }, requestTimeout: 60_000 }).connect();

const limpio = (sql) => sql.trim().replace(/;\s*$/, '');

function recorrer(o, f) {
  if (Array.isArray(o)) o.forEach((x) => recorrer(x, f));
  else if (o && typeof o === 'object') { f(o); Object.values(o).forEach((x) => recorrer(x, f)); }
}

async function plan(motor, sql) {
  const s = limpio(sql);
  if (motor === 'postgres') {
    const r = await pgc.query(`EXPLAIN (FORMAT JSON) ${s}`);
    const p = r.rows[0]['QUERY PLAN'][0].Plan;
    const barridos = [];
    recorrer(p, (n) => { if (n['Node Type'] === 'Seq Scan') barridos.push(n['Relation Name']); });
    return { costo: p['Total Cost'], barridos };
  }
  if (motor === 'mysql' || motor === 'mariadb') {
    const conn = motor === 'mysql' ? my : ma;
    const [rows] = await conn.query(`EXPLAIN FORMAT=JSON ${s}`);
    const j = JSON.parse(Object.values(rows[0])[0]);
    // El costo del bloque principal no incluye las CTE ni las subconsultas materializadas
    // (cada una trae su propio query_block): se suman todos los bloques.
    let costo = 0;
    recorrer(j, (n) => { if (n.query_block) costo += Number(n.query_block.cost_info?.query_cost ?? n.query_block.cost ?? 0); });
    const barridos = [];
    recorrer(j, (n) => { if (n.table_name && n.access_type === 'ALL' && !/^<|^derived|^\(/.test(n.table_name)) barridos.push(n.table_name); });
    return { costo, barridos };
  }
  // SQL Server: SHOWPLAN_XML devuelve el plan estimado sin ejecutar.
  await ms.request().batch('SET SHOWPLAN_XML ON');
  try {
    const r = await ms.request().batch(s);
    const xml = Object.values(r.recordset[0])[0];
    const costo = Math.max(...[...xml.matchAll(/StatementSubTreeCost="([\d.E+-]+)"/g)].map((m) => Number(m[1])));
    const barridos = [];
    for (const m of xml.matchAll(/<RelOp [^>]*PhysicalOp="(Table Scan|Clustered Index Scan)"[\s\S]*?<Object [^>]*Table="\[([^\]]+)\]"/g)) barridos.push(m[2]);
    return { costo, barridos };
  } finally {
    await ms.request().batch('SET SHOWPLAN_XML OFF');
  }
}

const refs = Object.fromEntries(JSON.parse(readFileSync(path.join(NLQP, 'docs/consultas_prueba_50.json'), 'utf8')).map((q) => [q.id, q]));
const last = new Map();
for (const l of readFileSync(path.join(NLQP, 'docs/evaluacion_gemini/resultados.jsonl'), 'utf8').split('\n')) {
  if (!l.trim()) continue;
  const r = JSON.parse(l);
  if (r.comparacion) last.set(`${r.id}|${r.variante}|${r.motor}`, r);
}

const planRef = new Map();
const salida = [];
let n = 0;
for (const [k, r] of last) {
  n++;
  const sqlRef = refs[r.id].overrides?.[r.motor] ?? refs[r.id].sql;
  const fila = { clave: k, id: r.id, variante: r.variante, motor: r.motor, categoria: r.categoria };
  try {
    for (const [nombre, sql] of [['ref', sqlRef], ['gen', r.generacion.sql]]) {
      const v = validateQuerySafety(sql);
      if (!v.safe) throw new Error(`${nombre} rechazado por el Query Safety Engine: ${v.reason}`);
    }
    const kr = `${r.motor}|${sqlRef}`;
    if (!planRef.has(kr)) planRef.set(kr, await plan(r.motor, sqlRef));
    fila.ref = planRef.get(kr);
    fila.gen = await plan(r.motor, r.generacion.sql);
    fila.razon = fila.gen.costo / fila.ref.costo;
  } catch (e) {
    fila.error = e.message;
  }
  salida.push(fila);
  if (n % 50 === 0 || fila.error) console.log(n, k, fila.error ?? fila.razon?.toFixed(2));
}
writeFileSync(path.join(NLQP, 'docs/evaluacion_gemini/explain.json'), JSON.stringify(salida, null, 1));
await pgc.end(); await my.end(); await ma.end(); await ms.close();
console.log('listo', salida.length, 'errores', salida.filter((x) => x.error).length);
