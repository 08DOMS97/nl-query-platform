// Controles de /generateSQL que no llaman al modelo (24/10): largo máximo, rechazo de un
// texto que ya es SQL y detección de límites de filas no pedidos. Sin costo: antes de cada
// llamada HTTP se comprueba con la función compilada que el backend la va a rechazar sin
// llamar a Gemini, y al final se verifica que no quedó ningún evento de generación nuevo.
// Requiere `npm run build` (usa lib/). Se corre con `npm run test:api` (scripts/pruebas_api.mjs).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { MAX_QUESTION_CHARS, findRowLimit, looksLikeSql, questionRequestsRowLimit } from '../../lib/services/questionGuard.service.js';

const tec = readFileSync(process.argv[2], 'utf8').trim();
const usr = readFileSync(process.argv[3], 'utf8').trim();
const BASE = 'http://localhost:8080';
const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../docs');
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };

if (admin.apps.length === 0) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const inicio = new Date();
const uidDe = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).user_id;

/** POST /generateSQL solo si el control lo va a rechazar antes del modelo; si no, falla sin llamar. */
async function generarSinCosto(token, connectionId, naturalLanguageQuery) {
  const rechazable = typeof naturalLanguageQuery !== 'string' || !naturalLanguageQuery.trim() ||
    naturalLanguageQuery.length > MAX_QUESTION_CHARS || looksLikeSql(naturalLanguageQuery);
  if (!rechazable) return { status: 'no-enviada (llamaría al modelo)' };
  const res = await fetch(`${BASE}/generateSQL`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId, naturalLanguageQuery }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// --- Corpus real: las 50 preguntas de referencia y sus 50 paráfrasis
const refs = JSON.parse(readFileSync(path.join(DOCS, 'consultas_prueba_50.json'), 'utf8'));
const consultas = Array.isArray(refs) ? refs : refs.consultas;
const parafrasis = JSON.parse(readFileSync(path.join(DOCS, 'parafrasis_50.json'), 'utf8')).parafrasis;
const preguntas = consultas.flatMap((q) => [q.nl, parafrasis.find((p) => p.id === q.id).nl]);
const tomadasPorSql = preguntas.filter(looksLikeSql);
check(`ninguna de las ${preguntas.length} preguntas reales se toma por SQL`, tomadasPorSql.length === 0, tomadasPorSql.join(' | '));
check('los 50 SQL de referencia se reconocen como SQL', consultas.every((q) => looksLikeSql(q.sql)));
const conLimite = consultas.filter((q) => findRowLimit(q.sql));
check(`las referencias con límite (${conLimite.length}) se detectan`, conLimite.length === 11);
const sinPedir = conLimite.flatMap((q) => [q.nl, parafrasis.find((p) => p.id === q.id).nl]).filter((t) => !questionRequestsRowLimit(t));
check('toda pregunta de referencia con límite lo pide (original y paráfrasis)', sinPedir.length === 0, sinPedir.join(' | '));

// --- Reconocer SQL
const SQL_DAVID = 'Select TOP 10 c.first_name, c.last_name, count(o.order_id) As pedidos  \nfrom customers c \nleft join orders o on c.customer_id = o.customer_id\ngroup by c.customer_id, c.first_name, c.last_name;';
for (const t of [SQL_DAVID, 'SELECT * FROM customers', 'select count(*) from orders', '  (SELECT 1)', 'WITH t AS (SELECT 1) SELECT * FROM t',
  'DELETE FROM customers', 'drop table orders', 'EXEC sp_who', "clientes where country = 'GT' group by city order by 1"]) {
  check(`es SQL: ${JSON.stringify(t.slice(0, 40))}`, looksLikeSql(t));
}
for (const t of ['Selecciona los clientes de Guatemala', '¿Qué clientes tienen más de 3 pedidos?', 'Muéstrame las ventas por mes ordenadas de mayor a menor',
  '¿Cuál es el máximo de ventas de un mes?', 'Lista los productos donde el precio es mayor a 100', 'Clientes de la ciudad de Guatemala ordenados por apellido']) {
  check(`no es SQL: ${JSON.stringify(t.slice(0, 40))}`, !looksLikeSql(t));
}

// --- Límite de filas en el SQL
const LIMITES = [
  ['SELECT a FROM t LIMIT 10', 'LIMIT 10'],
  ['SELECT TOP 10 a FROM t', 'TOP 10'],
  ['SELECT TOP (5) a FROM t', 'TOP (5)'],
  ['SELECT TOP 10 PERCENT a FROM t', 'TOP 10 PERCENT'],
  ['SELECT a FROM t ORDER BY a OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY', 'FETCH NEXT 10 ROWS ONLY'],
  ['SELECT a FROM t FETCH FIRST 3 ROWS ONLY', 'FETCH FIRST 3 ROWS ONLY'],
  ["SELECT a FROM t WHERE x = 'LIMIT 5'", null],
  ['SELECT a FROM t', null],
  ['SELECT top_seller FROM t', null],
];
for (const [sql, esperado] of LIMITES) check(`límite en ${JSON.stringify(sql.slice(0, 45))}: ${esperado}`, findRowLimit(sql) === esperado, String(findRowLimit(sql)));

// --- ¿La pregunta pide un límite?
for (const t of ['Lista los 10 productos más caros', 'Dame las últimas cinco órdenes', 'Top 10 de productos', '¿Quién es el cliente que más ha gastado?', '¿Cuál es el producto de mayor precio?']) {
  check(`pide límite: ${JSON.stringify(t)}`, questionRequestsRowLimit(t));
}
for (const t of ['¿Cuántos clientes hay por país?', 'Lista todos los productos', 'Muestra los pedidos de clientes de Guatemala', 'Lista los clientes con su ciudad', 'Clientes que tienen una dirección registrada']) {
  check(`no pide límite: ${JSON.stringify(t)}`, !questionRequestsRowLimit(t));
}

// --- HTTP: rechazos antes del modelo
for (const [rol, token] of [['técnico', tec], ['usuario', usr]]) {
  const r = await generarSinCosto(token, 'mysql', SQL_DAVID);
  check(`${rol}: SQL como pregunta → 422 nlqp/sql-input`, r.status === 422 && r.json?.code === 'nlqp/sql-input', JSON.stringify(r));
  check(`${rol}: el aviso pide escribir una pregunta`, /como una pregunta/.test(r.json?.error ?? ''));
}
const mssql = await generarSinCosto(usr, 'mssql', 'SELECT TOP 5 * FROM customers');
check('SQL Server: SQL como pregunta → 422', mssql.status === 422, JSON.stringify(mssql));
const largo = await generarSinCosto(usr, 'postgres', `¿Cuántos clientes hay? ${'x'.repeat(MAX_QUESTION_CHARS)}`);
check(`pregunta de más de ${MAX_QUESTION_CHARS} caracteres → 400`, largo.status === 400 && /demasiado larga/.test(largo.json?.error ?? ''), JSON.stringify(largo));
check('pregunta que no es texto → 400', (await generarSinCosto(usr, 'postgres', 12345)).status === 400);
check('pregunta vacía → 400', (await generarSinCosto(usr, 'postgres', '   ')).status === 400);

// --- Ninguna llamada llegó al modelo
await new Promise((r) => setTimeout(r, 1500));
const eventos = (await admin.firestore().collection('usageEvents').where('timestamp', '>=', inicio).get())
  .docs.map((d) => d.data()).filter((e) => e.type === 'generateSQL' && [uidDe(tec), uidDe(usr)].includes(e.uid));
check('sin eventos de generación nuevos (no se llamó al modelo)', eventos.length === 0, JSON.stringify(eventos));

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
