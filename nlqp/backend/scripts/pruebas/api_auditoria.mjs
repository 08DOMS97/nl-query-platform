// Edición del SQL y su auditoría (rol técnico): quién puede editar, de dónde, qué se
// registra y que la misma edición no se duplica. No llama a /generateSQL.
// Borra al final sus registros de auditoría y su consulta guardada. Se corre con
// `npm run test:api`.
import { readFileSync } from 'node:fs';

const tec = readFileSync(process.argv[2], 'utf8').trim();
const usr = readFileSync(process.argv[3], 'utf8').trim();
const BASE = 'http://localhost:8080';
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const call = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
};

// Marca única en los alias, para encontrar (y borrar) solo lo de esta corrida.
const m = `aud${Date.now() % 1000000}`;
const edits = async () => (await call(tec, 'GET', '/sqlEdits')).json.edits.filter((e) => e.editedSql.includes(m));
const exec = (token, sql, edit) => call(token, 'POST', '/executeQuery', { connectionId: 'postgres', sql, edit });

// Sentencia generada y editada, ejecutada
const g1 = `SELECT 1 AS ${m}`;
const g2 = `SELECT 2 AS ${m}`;
check('técnico: ejecutar generada editada 200', (await exec(tec, g2, { origin: 'generada', originalSql: g1 })).status === 200);
let lista = await edits();
let e = lista[0];
check('auditoría: un registro', lista.length === 1, JSON.stringify(lista.length));
check('auditoría: reemplazó 1 por 2', JSON.stringify(e?.changes) === JSON.stringify([{ removed: '1', added: '2' }]), JSON.stringify(e?.changes));
check('auditoría: quién, origen, base y acción', e?.email === 'nlqp-test@example.com' && e.origin === 'generada' && e.connectionId === 'postgres' && JSON.stringify(e.actions) === '["ejecutada"]');
check('auditoría: fecha y hora', !Number.isNaN(Date.parse(e?.createdAt)) && Date.now() - Date.parse(e.createdAt) < 120000);
check('auditoría: sentencias original y editada', e?.originalSql === g1 && e.editedSql === g2);
await exec(tec, g2, { origin: 'generada', originalSql: g1 });
lista = await edits();
check('la misma edición otra vez no duplica el registro', lista.length === 1 && Date.parse(lista[0].lastAt) >= Date.parse(lista[0].createdAt));
check('solo espacios no se audita', (await exec(tec, `SELECT 1   AS ${m}`, { origin: 'generada', originalSql: g1 })).status === 200 && (await edits()).length === 1);

// Historial: no se edita
check('historial editado 409', (await exec(tec, `SELECT 7 AS ${m}`, { origin: 'historial', originalSql: `SELECT 6 AS ${m}` })).status === 409);
check('historial sin editar 200', (await exec(tec, `SELECT 6 AS ${m}`, { origin: 'historial', originalSql: `SELECT 6 AS ${m}` })).status === 200);

// No técnico
check('no técnico: ejecutar editada 403', (await exec(usr, `SELECT 9 AS ${m}`, { origin: 'generada', originalSql: `SELECT 8 AS ${m}` })).status === 403);
check('no técnico: ver auditoría 403', (await call(usr, 'GET', '/sqlEdits')).status === 403);

// Guardar una generada editada
const s1 = `SELECT 3 AS ${m}`;
const s2 = `SELECT 4 AS ${m}`;
const sv = await call(tec, 'POST', '/savedQueries', { name: `Auditoría ${m}`, connectionId: 'postgres', sql: s2, edit: { origin: 'generada', originalSql: s1 } });
check('guardar generada editada 201', sv.status === 201 && sv.json.sql === s2, JSON.stringify(sv.json));
const id = sv.json.id;
e = (await edits()).find((x) => x.editedSql === s2);
check('auditoría de lo guardado: acción y consulta', JSON.stringify(e?.actions) === '["guardada"]' && e.savedQueryId === id && e.savedQueryName === `Auditoría ${m}`);

// Editar la guardada (PUT)
const s3 = `SELECT 5 AS ${m}`;
const put = await call(tec, 'PUT', `/savedQueries?id=${id}`, { sql: s3 });
check('editar guardada 200', put.status === 200 && put.json.sql === s3, JSON.stringify(put.json));
e = (await edits()).find((x) => x.editedSql === s3);
check('auditoría de la guardada: original = la guardada', e?.origin === 'guardada' && e.originalSql === s2 && JSON.stringify(e.changes) === JSON.stringify([{ removed: '4', added: '5' }]));
check('no técnico: editar guardada 403', (await call(usr, 'PUT', `/savedQueries?id=${id}`, { sql: s1 })).status === 403);
check('editar guardada con SQL inseguro 403', (await call(tec, 'PUT', `/savedQueries?id=${id}`, { sql: 'DELETE FROM customers' })).status === 403);
check('la guardada no cambió', (await call(tec, 'GET', '/savedQueries')).json.queries.find((q) => q.id === id)?.sql === s3);
check('editar guardada inexistente 404', (await call(tec, 'PUT', '/savedQueries?id=no-existe', { sql: s1 })).status === 404);

// Ejecutar una guardada editada: el original lo toma el backend de la guardada
const s4 = `SELECT 6 AS ${m}, 1 AS extra`;
check('ejecutar guardada editada 200', (await exec(tec, s4, { origin: 'guardada', savedQueryId: id, originalSql: 'ignorado' })).status === 200);
e = (await edits()).find((x) => x.editedSql === s4);
check('auditoría: original de la guardada, no del cliente', e?.originalSql === s3 && JSON.stringify(e.actions) === '["ejecutada"]', JSON.stringify(e));
check('guardada inexistente 404', (await exec(tec, s4, { origin: 'guardada', savedQueryId: 'no-existe' })).status === 404);
check('origen inválido 400', (await exec(tec, s4, { origin: 'otro' })).status === 400);

// Limpieza: la guardada por API y la auditoría con Admin SDK (no hay endpoint para borrarla).
await call(tec, 'DELETE', `/savedQueries?id=${id}`);
const { getFirestore } = await import('../../lib/services/firebaseAdmin.service.js');
const snap = await getFirestore().collection('sqlEdits').get();
await Promise.all(snap.docs.filter((d) => String(d.data().editedSql).includes(m)).map((d) => d.ref.delete()));
check('limpieza: sin registros de esta corrida', (await edits()).length === 0);

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
