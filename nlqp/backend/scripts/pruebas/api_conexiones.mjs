// Registro de conexiones (M1): permisos, validaciones, alta, uso, edición y baja.
// Crea una conexión temporal (y su secreto) y la elimina al final. No llama a /generateSQL.
// Se corre con `npm run test:api` (scripts/pruebas_api.mjs), que pasa los tokens.
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

const pg = {
  engine: 'postgres',
  host: process.env.DB_POSTGRES_HOST,
  port: Number(process.env.DB_POSTGRES_PORT),
  database: process.env.DB_POSTGRES_DATABASE,
  user: process.env.DB_POSTGRES_USER,
  password: process.env.DB_POSTGRES_PASSWORD,
};

// Lista
const lu = await call(usr, 'GET', '/connections');
check('usuario: lista 200', lu.status === 200 && lu.json.connections.length >= 4);
check('usuario: sin servidor ni usuario', lu.json.connections.every((c) => !('host' in c) && !('user' in c) && c.name && c.engine));
const lt = await call(tec, 'GET', '/connections');
check('técnico: con servidor, puerto y usuario', lt.json.connections.every((c) => c.host && c.port && c.user));
check('nadie recibe contraseña ni secreto', JSON.stringify([lu.json, lt.json]).match(/password|secret/i) === null);

// Permisos
check('usuario: crear 403', (await call(usr, 'POST', '/connections', { ...pg, name: 'x' })).status === 403);
check('usuario: probar config 403', (await call(usr, 'POST', '/testConnectionConfig', pg)).status === 403);

// Validaciones
check('puerto inválido 400', (await call(tec, 'POST', '/connections', { ...pg, name: 'x', port: 0 })).status === 400);
check('motor inválido 400', (await call(tec, 'POST', '/connections', { ...pg, name: 'x', engine: 'oracle' })).status === 400);
check('sin contraseña 400', (await call(tec, 'POST', '/connections', { ...pg, name: 'x', password: '' })).status === 400);
check('nombre repetido 400', (await call(tec, 'POST', '/connections', { ...pg, name: 'Tienda · Servidor A' })).status === 400);

// Probar sin guardar
const t1 = await call(tec, 'POST', '/testConnectionConfig', pg);
check('probar datos correctos: ok', t1.status === 200 && t1.json.ok === true && t1.json.latencyMs >= 0, JSON.stringify(t1.json));
const t2 = await call(tec, 'POST', '/testConnectionConfig', { ...pg, password: 'incorrecta' });
check('probar contraseña incorrecta: ok=false con motivo', t2.json.ok === false && !!t2.json.error);

// Contraseña incorrecta: no se guarda (y no crea secreto)
const bad = await call(tec, 'POST', '/connections', { ...pg, name: 'Prueba mala', password: 'incorrecta' });
check('crear con contraseña incorrecta: 422', bad.status === 422, JSON.stringify(bad.json));

// Alta
const nombre = `Prueba alta ${Date.now() % 100000}`;
const c = await call(tec, 'POST', '/connections', { ...pg, name: nombre });
check('crear 201', c.status === 201 && c.json.id && c.json.name === nombre && !('password' in c.json), JSON.stringify(c.json));
const id = c.json.id;
check('aparece en la lista del usuario', (await call(usr, 'GET', '/connections')).json.connections.some((x) => x.id === id));

// Uso
const e = await call(usr, 'POST', '/executeQuery', { connectionId: id, sql: 'SELECT 7 AS n', question: `uso ${nombre}` });
check('ejecutar en la conexión nueva 200', e.status === 200 && e.json.rows[0].n === 7, JSON.stringify(e.json));
const h = (await call(usr, 'GET', '/history')).json.entries[0];
check('historial guarda conexión y nombre', h.connectionId === id && h.connectionName === nombre && h.engine === 'postgres');
const sch = await call(tec, 'GET', `/getSchema?connectionId=${id}`);
check('esquema de la conexión nueva', sch.status === 200 && sch.json.tables.length === 8 && sch.json.database === pg.database);
check('probar conexión registrada', (await call(tec, 'GET', `/testConnection?connectionId=${id}`)).json.ok === true);
let pool = (await call(tec, 'GET', '/poolStatus')).json.pools.find((p) => p.connectionId === id);
check('pool de la conexión nueva iniciado', pool?.initialized === true && pool.total >= 1);
const sv = await call(usr, 'POST', '/savedQueries', { name: `g ${nombre}`, connectionId: id, sql: 'SELECT 7 AS n' });
check('guardar consulta en la conexión nueva', sv.status === 201 && sv.json.connectionName === nombre);
await call(usr, 'DELETE', `/savedQueries?id=${sv.json.id}`);

// Edición sin contraseña: renombra y cierra el pool
const nuevoNombre = `${nombre} (editada)`;
const ed = await call(tec, 'PUT', `/connections?id=${id}`, { ...pg, name: nuevoNombre, password: undefined });
check('editar sin contraseña 200', ed.status === 200 && ed.json.name === nuevoNombre, JSON.stringify(ed.json));
pool = (await call(tec, 'GET', '/poolStatus')).json.pools.find((p) => p.connectionId === id);
check('editar cierra el pool', pool?.initialized === false);
check('sigue funcionando tras editar', (await call(usr, 'POST', '/executeQuery', { connectionId: id, sql: 'SELECT 1 AS x' })).status === 200);
check('editar con contraseña incorrecta 422', (await call(tec, 'PUT', `/connections?id=${id}`, { ...pg, name: nuevoNombre, password: 'incorrecta' })).status === 422);
check('editar con contraseña correcta 200', (await call(tec, 'PUT', `/connections?id=${id}`, { ...pg, name: nuevoNombre })).status === 200);
check('usuario: editar 403', (await call(usr, 'PUT', `/connections?id=${id}`, { ...pg, name: 'x' })).status === 403);

// Baja
check('usuario: eliminar 403', (await call(usr, 'DELETE', `/connections?id=${id}`)).status === 403);
check('eliminar 204', (await call(tec, 'DELETE', `/connections?id=${id}`)).status === 204);
check('ya no aparece', !(await call(tec, 'GET', '/connections')).json.connections.some((x) => x.id === id));
check('ejecutar en conexión eliminada 404', (await call(usr, 'POST', '/executeQuery', { connectionId: id, sql: 'SELECT 1' })).status === 404);
check('eliminar de nuevo 404', (await call(tec, 'DELETE', `/connections?id=${id}`)).status === 404);
check('sin conexión 400', (await call(usr, 'POST', '/executeQuery', { sql: 'SELECT 1' })).status === 400);

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
