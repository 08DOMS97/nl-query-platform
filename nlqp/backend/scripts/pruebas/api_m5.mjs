// Historial y consultas guardadas (M5) en los 4 motores. Se corre con `npm run test:api`.
import { readFileSync } from 'node:fs';

const token = readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'http://localhost:8080';
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name} ${extra}`); }
};
const call = async (method, path, body, headers = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const history = async () => (await call('GET', '/history')).json.entries;

const marca = `prueba M5 ${Date.now()}`;

// Historial automático, en los 4 motores
for (const engine of ['postgres', 'mysql', 'mariadb', 'mssql']) {
  const r = await call('POST', '/executeQuery', { engine, sql: 'SELECT 1 AS x', question: `${marca} ${engine}` });
  check(`executeQuery ${engine} 200`, r.status === 200, r.status);
  const h = (await history())[0];
  check(`historial ${engine}: registrado`, h?.question === `${marca} ${engine}` && h.engine === engine && h.success === true && h.totalRows === 1, JSON.stringify(h));
}

// Sin pregunta -> question null
await call('POST', '/executeQuery', { engine: 'postgres', sql: 'SELECT 2 AS y' });
let h = (await history())[0];
check('historial sin pregunta: question null', h.sql === 'SELECT 2 AS y' && h.question === null, JSON.stringify(h));

// Error de ejecución -> se registra con success false
const errRes = await call('POST', '/executeQuery', { engine: 'postgres', sql: 'SELECT * FROM tabla_que_no_existe_m5', question: `${marca} error` });
check('executeQuery tabla inexistente 500', errRes.status === 500, errRes.status);
h = (await history())[0];
check('historial error: success false + motivo', h.question === `${marca} error` && h.success === false && h.totalRows === null && !!h.errorReason, JSON.stringify(h));

// Bloqueada por el Query Safety Engine -> no se ejecuta ni se registra
const antes = (await history())[0].id;
const blk = await call('POST', '/executeQuery', { engine: 'postgres', sql: 'DELETE FROM clientes', question: `${marca} bloqueada` });
check('executeQuery DELETE 403', blk.status === 403, blk.status);
check('bloqueada: no entra al historial', (await history())[0].id === antes);

// Corrida de evaluación -> no se registra
await call('POST', '/executeQuery', { engine: 'postgres', sql: 'SELECT 3 AS z', question: `${marca} eval` }, { 'X-NLQP-Origin': 'evaluacion' });
check('evaluación: no entra al historial', (await history())[0].id === antes);

// Orden y límite
const all = await history();
check('historial ordenado desc', all.every((e, i) => i === 0 || all[i - 1].executedAt >= e.executedAt));
check('historial <= 50', all.length <= 50, all.length);

// Consultas guardadas: manuales
const savedAntes = (await call('GET', '/savedQueries')).json.queries.length;
const s = await call('POST', '/savedQueries', { name: `  ${marca} guardada  `, engine: 'mysql', sql: 'SELECT 1 AS x', question: '¿uno?' });
check('guardar 201', s.status === 201, JSON.stringify(s));
check('guardar: nombre recortado', s.json?.name === `${marca} guardada`);
const lista = (await call('GET', '/savedQueries')).json.queries;
check('listar: aparece primero', lista.length === savedAntes + 1 && lista[0].id === s.json.id && lista[0].engine === 'mysql' && lista[0].question === '¿uno?');
check('guardar no toca el historial', (await history())[0].id === antes);

check('guardar sin nombre 400', (await call('POST', '/savedQueries', { name: ' ', engine: 'mysql', sql: 'SELECT 1' })).status === 400);
check('guardar nombre > 100 400', (await call('POST', '/savedQueries', { name: 'a'.repeat(101), engine: 'mysql', sql: 'SELECT 1' })).status === 400);
check('guardar en conexión inexistente 404', (await call('POST', '/savedQueries', { name: 'x', engine: 'oracle', sql: 'SELECT 1' })).status === 404);
check('guardar sin sql 400', (await call('POST', '/savedQueries', { name: 'x', engine: 'mysql' })).status === 400);
check('guardar SQL inseguro 403', (await call('POST', '/savedQueries', { name: 'x', engine: 'mssql', sql: 'SELECT 1 DROP TABLE clientes' })).status === 403);
check('método no permitido 405', (await call('PUT', '/savedQueries', {})).status === 405);

check('borrar 204', (await call('DELETE', `/savedQueries?id=${s.json.id}`)).status === 204);
check('borrar de nuevo 404', (await call('DELETE', `/savedQueries?id=${s.json.id}`)).status === 404);
check('borrar sin id 400', (await call('DELETE', '/savedQueries')).status === 400);
check('listar tras borrar', (await call('GET', '/savedQueries')).json.queries.length === savedAntes);

// Sin token
const sinToken = await fetch(BASE + '/history');
check('history sin token 401', sinToken.status === 401);
const sinToken2 = await fetch(BASE + '/savedQueries');
check('savedQueries sin token 401', sinToken2.status === 401);

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
