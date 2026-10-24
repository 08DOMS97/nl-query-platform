// Robustez del servidor (auditoría del 24/10): un campo con un tipo inesperado, un JSON
// malformado o un cuerpo demasiado grande se responden con un error JSON, sin stack trace,
// y el backend sigue en pie. Ninguna llamada llega al modelo ni ejecuta SQL.
// Se corre con `npm run test:api` (scripts/pruebas_api.mjs).
import { readFileSync } from 'node:fs';

const usr = readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'http://localhost:8080';
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const post = async (path, body, token = usr) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
};
const vivo = async () => (await fetch(`${BASE}/health`).then((r) => r.status, () => 0)) === 200;
const sinRastro = (r) => !/node_modules|at \w+ \(|[A-Z]:\\\\|SyntaxError/.test(r.text);

for (const sql of [1, [], { a: 1 }, true]) {
  const r = await post('/executeQuery', { connectionId: 'postgres', sql });
  check(`executeQuery con sql=${JSON.stringify(sql)} → 400`, r.status === 400, `${r.status} ${r.text.slice(0, 120)}`);
}
check('el backend sigue en pie tras los tipos inesperados', await vivo());
for (const q of [1, [], { a: 1 }]) {
  const r = await post('/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: q });
  check(`generateSQL con pregunta=${JSON.stringify(q)} → 400`, r.status === 400, `${r.status} ${r.text.slice(0, 120)}`);
}
check('savedQueries con sql=1 → 400', (await post('/savedQueries', { name: 'x', connectionId: 'postgres', sql: 1 })).status === 400);

const malformado = await post('/executeQuery', '{malo');
check('JSON malformado → 400 en JSON', malformado.status === 400 && malformado.json?.error === 'El cuerpo de la solicitud no es JSON válido.', malformado.text.slice(0, 160));
check('JSON malformado: sin stack trace ni rutas del servidor', sinRastro(malformado));
const grande = await post('/generateSQL', { connectionId: 'postgres', naturalLanguageQuery: 'x'.repeat(200 * 1024) });
check('cuerpo de más de 100 kB → 413 en JSON', grande.status === 413 && !!grande.json?.error && sinRastro(grande), grande.text.slice(0, 160));

const tokenMalo = await post('/executeQuery', { connectionId: 'postgres', sql: 'SELECT 1' }, 'no-es-un-token');
check('token inválido → 401 sin el detalle interno', tokenMalo.status === 401 && tokenMalo.json && !('detail' in tokenMalo.json), tokenMalo.text);
check('el backend sigue en pie al terminar', await vivo());

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
