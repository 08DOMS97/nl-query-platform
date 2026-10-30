/**
 * Manejo de errores (sección 3.3.1.4 de la tesis): ante entradas inválidas, esquemas
 * vacíos, credenciales incorrectas e interrupciones del servicio de Vertex AI, el
 * sistema debe responder con un mensaje de error informativo y seguro, sin exponer
 * información sensible (rastros de pila, rutas del servidor, contraseñas, detalles
 * internos para un usuario no técnico). Cada caso cuenta como manejado correctamente
 * si se cumplen las tres cosas: código HTTP esperado, mensaje informativo y nada sensible.
 *
 *   node --env-file=.env scripts/pruebas/api_errores.mjs
 *
 * Requiere el backend en :8080 y Docker con los 4 motores. Crea una conexión temporal a
 * una base vacía y la elimina. Para simular la caída de Vertex AI levanta una segunda
 * instancia del backend en :8090 con un modelo inexistente (la llamada falla en Google
 * sin generar nada; no se factura) y la cierra al terminar. Sin costo.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BACK = path.join(DIR, '../..');
const BASE = 'http://localhost:8080';
const CAIDO = 'http://localhost:8090';
const MOTORES = { postgres: 'POSTGRES', mysql: 'MYSQL', mariadb: 'MARIADB', mssql: 'MSSQL' };

function token(email, password) {
  const r = spawnSync(process.execPath, [path.join(DIR, '../get_test_token.mjs')], {
    env: { ...process.env, ...(email ? { NLQP_TEST_USER_EMAIL: email, NLQP_TEST_USER_PASSWORD: password } : {}) },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`token: ${r.stderr}`);
  return r.stdout.trim().split('\n').pop();
}
const tec = token();
const usr = token(process.env.NLQP_USUARIO_EMAIL ?? 'nlqp-ci-usuario@example.com', process.env.NLQP_USUARIO_PASSWORD);

const secretos = Object.values(MOTORES).map((p) => process.env[`DB_${p}_PASSWORD`]).filter((s) => s && s.length >= 4);
const sensible = (t) =>
  /node_modules|\bat \w[\w.<>]* \(|[A-Z]:\\\\|\/home\/|\/usr\/|\.ts:\d+|\.js:\d+|BEGIN PRIVATE KEY|private_key/i.test(t) ||
  secretos.some((s) => t.includes(s));

const casos = [];
function caso(categoria, nombre, r, statusOk, opciones = {}) {
  const msg = r.json?.error ?? r.json?.reason ?? '';
  const informativo = opciones.sinMensaje ? true : typeof msg === 'string' && msg.trim().length >= 10;
  const seguro = !sensible(r.text) && (!opciones.generico || !/vertex|google|model|publishers|projects\//i.test(msg));
  const ok = statusOk(r.status) && informativo && seguro;
  casos.push({ categoria, nombre, ok, status: r.status, informativo, seguro, msg: String(msg).slice(0, 160) });
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${categoria}] ${nombre} → ${r.status}${ok ? '' : ` informativo=${informativo} seguro=${seguro}`} · ${String(msg).slice(0, 110)}`);
}
async function call(base, tk, method, ruta, body, crudo) {
  const headers = { 'Content-Type': 'application/json' };
  if (tk) headers.Authorization = `Bearer ${tk}`;
  try {
    const res = await fetch(base + ruta, { method, headers, body: crudo ?? (body ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(120_000) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, text, json };
  } catch (err) {
    return { status: 0, text: String(err), json: null };
  }
}
const api = (tk, m, r, b, crudo) => call(BASE, tk, m, r, b, crudo);
const vivo = async (base = BASE) => (await call(base, null, 'GET', '/health')).status === 200;
const es = (...xs) => (s) => xs.includes(s);
const de4xx = (s) => s >= 400 && s < 500;

// ---------------------------------------------------------------- entradas inválidas
const E = 'entradas inválidas';
caso(E, 'consulta sin SQL', await api(usr, 'POST', '/executeQuery', { connectionId: 'postgres' }), es(400));
caso(E, 'SQL de tipo numérico', await api(usr, 'POST', '/executeQuery', { connectionId: 'postgres', sql: 1 }), es(400));
caso(E, 'JSON malformado', await api(usr, 'POST', '/executeQuery', null, '{malo'), es(400));
caso(E, 'cuerpo de más de 100 kB', await api(usr, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: 'x'.repeat(200 * 1024) }), es(413));
caso(E, 'pregunta vacía', await api(usr, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: '   ' }), es(400));
caso(E, 'pregunta sin contenido («hola»)', await api(usr, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: 'hola' }), es(422));
caso(E, 'SQL escrito como pregunta', await api(usr, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: 'DELETE FROM orders WHERE 1=1' }), es(422));
caso(E, 'sentencia de modificación (DELETE)', await api(usr, 'POST', '/executeQuery', { connectionId: 'postgres', sql: 'DELETE FROM orders' }), es(403));
caso(E, 'sentencias encadenadas (SELECT; DROP)', await api(usr, 'POST', '/executeQuery', { connectionId: 'mssql', sql: 'SELECT 1 DROP TABLE orders' }), es(403));
caso(E, 'conexión inexistente', await api(usr, 'POST', '/executeQuery', { connectionId: 'no-existe-nlqp', sql: 'SELECT 1' }), de4xx);
caso(E, 'SQL con error de sintaxis', await api(usr, 'POST', '/executeQuery', { connectionId: 'postgres', sql: 'SELECT FROM WHERE' }), (s) => s >= 400);
caso(E, 'tabla inexistente', await api(usr, 'POST', '/executeQuery', { connectionId: 'mysql', sql: 'SELECT * FROM tabla_que_no_existe' }), (s) => s >= 400);
caso(E, 'resultado inexistente', await api(usr, 'GET', '/getResultPage?resultId=no-existe&page=1'), es(404));
caso(E, 'página fuera de rango', await api(usr, 'GET', '/getResultPage?resultId=no-existe&page=0'), de4xx);
caso(E, 'descarga con enlace inválido', await api(null, 'GET', '/exportResult?token=invalido'), es(404));

// ---------------------------------------------------------------- credenciales incorrectas
const C = 'credenciales incorrectas';
caso(C, 'token inválido', await api('no-es-un-token', 'POST', '/executeQuery', { connectionId: 'postgres', sql: 'SELECT 1' }), es(401));
caso(C, 'sin token', await api(null, 'POST', '/executeQuery', { connectionId: 'postgres', sql: 'SELECT 1' }), es(401));
caso(C, 'usuario no técnico en una función técnica', await api(usr, 'GET', '/getSchema?connectionId=postgres'), es(403));
for (const [engine, p] of Object.entries(MOTORES)) {
  const cfg = { engine, host: process.env[`DB_${p}_HOST`], port: Number(process.env[`DB_${p}_PORT`]), database: process.env[`DB_${p}_DATABASE`], user: process.env[`DB_${p}_USER`] };
  const r = await api(tec, 'POST', '/testConnectionConfig', { ...cfg, password: 'contraseña-incorrecta' });
  // Responde ok=false con el motivo (no es un error HTTP de la API).
  caso(C, `contraseña de la base incorrecta (${engine})`, { ...r, json: { error: r.json?.ok === false ? r.json.error : '' } }, (s) => s === 200 || s === 422 || s === 502);
}
{
  const r = await api(tec, 'POST', '/testConnectionConfig', { engine: 'postgres', host: process.env.DB_POSTGRES_HOST, port: 5499, database: 'x', user: 'x', password: 'x' });
  caso(C, 'servidor de base de datos que no responde', { ...r, json: { error: r.json?.ok === false ? r.json.error : '' } }, (s) => s === 200 || s === 422 || s === 502);
}
caso(C, 'registrar una conexión con contraseña incorrecta', await api(tec, 'POST', '/connections', {
  engine: 'postgres', host: process.env.DB_POSTGRES_HOST, port: Number(process.env.DB_POSTGRES_PORT), database: process.env.DB_POSTGRES_DATABASE,
  user: process.env.DB_POSTGRES_USER, password: 'contraseña-incorrecta', name: `Prueba errores ${Date.now() % 100000}`,
}), es(422));

// ---------------------------------------------------------------- esquema vacío
const V = 'esquema vacío';
const vacia = await api(tec, 'POST', '/connections', {
  engine: 'postgres', host: process.env.DB_POSTGRES_HOST, port: Number(process.env.DB_POSTGRES_PORT), database: 'postgres',
  user: process.env.DB_POSTGRES_USER, password: process.env.DB_POSTGRES_PASSWORD, name: `Base vacía errores ${Date.now() % 100000}`,
});
if (vacia.status === 201) {
  const id = vacia.json.id;
  const esq = await api(tec, 'GET', `/getSchema?connectionId=${id}`);
  casos.push({ categoria: V, nombre: 'la base vacía se registra y su esquema es vacío', ok: esq.status === 200 && (esq.json?.tables?.length ?? -1) === 0, status: esq.status, msg: `${esq.json?.tables?.length} tablas` });
  console.log(`${casos.at(-1).ok ? 'OK  ' : 'FAIL'} [${V}] esquema de la base vacía → ${esq.status} · ${esq.json?.tables?.length} tablas`);
  caso(V, 'pregunta sobre una base sin tablas (no técnico)', await api(usr, 'POST', '/generateSQL', { connectionId: id, naturalLanguageQuery: '¿Cuántos clientes hay en total?' }), de4xx);
  caso(V, 'pregunta sobre una base sin tablas (técnico)', await api(tec, 'POST', '/generateSQL', { connectionId: id, naturalLanguageQuery: '¿Cuántos clientes hay en total?' }), de4xx);
  await api(tec, 'DELETE', `/connections?id=${id}`);
} else {
  casos.push({ categoria: V, nombre: 'registrar la base vacía', ok: false, status: vacia.status, msg: vacia.text.slice(0, 160) });
  console.log(`FAIL [${V}] no se pudo registrar la base vacía: ${vacia.status} ${vacia.text.slice(0, 160)}`);
}

// ---------------------------------------------------------------- interrupción de Vertex AI
const I = 'interrupción de Vertex AI';
const caido = spawn(process.execPath, ['--env-file=.env', 'lib/index.js'], {
  cwd: BACK,
  env: { ...process.env, PORT: '8090', VERTEX_AI_MODEL: 'modelo-inexistente-nlqp' },
  stdio: 'ignore',
});
for (let i = 0; i < 40 && !(await vivo(CAIDO)); i++) await new Promise((r) => setTimeout(r, 500));
caso(I, 'el modelo no responde (usuario no técnico: mensaje genérico)', await call(CAIDO, usr, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: '¿Cuántos clientes hay en total?' }), (s) => s >= 500, { generico: true });
caso(I, 'el modelo no responde (técnico: con el detalle)', await call(CAIDO, tec, 'POST', '/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: '¿Cuántos clientes hay en total?' }), (s) => s >= 500);
casos.push({ categoria: I, nombre: 'el backend sigue en pie tras la falla del modelo', ok: await vivo(CAIDO), status: 200, msg: '' });
console.log(`${casos.at(-1).ok ? 'OK  ' : 'FAIL'} [${I}] el backend sigue en pie tras la falla del modelo`);
caido.kill();

casos.push({ categoria: E, nombre: 'el backend principal sigue en pie al terminar', ok: await vivo(), status: 200, msg: '' });

// ---------------------------------------------------------------- resumen
const porCat = {};
for (const c of casos) { porCat[c.categoria] ??= [0, 0]; porCat[c.categoria][1]++; if (c.ok) porCat[c.categoria][0]++; }
console.log('\nPor categoría:');
for (const [k, [a, n]] of Object.entries(porCat)) console.log(`  ${k}: ${a}/${n}`);
const okT = casos.filter((c) => c.ok).length;
console.log(`\n${okT}/${casos.length} OK`);
process.exit(okT === casos.length ? 0 : 1);
