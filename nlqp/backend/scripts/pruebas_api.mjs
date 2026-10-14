/**
 * Pruebas de la API sin costo (no llaman a /generateSQL):
 *
 *   npm run test:api
 *
 * Requiere Docker con los 4 motores y el backend corriendo en http://localhost:8080.
 * Pide un token para cada usuario de prueba (técnico y no técnico; la contraseña del no
 * técnico va en NLQP_USUARIO_PASSWORD del .env) y corre, en
 * orden, las pruebas de `scripts/pruebas/`: conexiones (M1), roles (M4), historial
 * y guardadas (M5) y edición del SQL con su auditoría. La de conexiones crea una conexión temporal y la elimina.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';

try {
  await fetch(`${BASE}/health`);
} catch {
  console.error(`El backend no responde en ${BASE}: levantarlo antes (npm run build && npm start).`);
  process.exit(1);
}

function token(email, password) {
  const env = { ...process.env, ...(email ? { NLQP_TEST_USER_EMAIL: email, NLQP_TEST_USER_PASSWORD: password } : {}) };
  const r = spawnSync(process.execPath, [path.join(DIR, 'get_test_token.mjs')], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`No se pudo obtener el token${email ? ` de ${email}` : ''}: ${r.stderr}`);
  return r.stdout.trim().split('\n').pop();
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nlqp-tokens-'));
const tec = path.join(tmp, 'tecnico.txt');
const usr = path.join(tmp, 'usuario.txt');
writeFileSync(tec, token());
if (!process.env.NLQP_USUARIO_PASSWORD) {
  console.error('Falta NLQP_USUARIO_PASSWORD en .env (contraseña de nlqp-usuario@example.com).');
  process.exit(1);
}
writeFileSync(usr, token('nlqp-usuario@example.com', process.env.NLQP_USUARIO_PASSWORD));

const PRUEBAS = [
  ['Conexiones (M1)', 'api_conexiones.mjs', [tec, usr]],
  ['Roles (M4)', 'api_roles.mjs', [tec, usr]],
  ['Historial y guardadas (M5)', 'api_m5.mjs', [usr]],
  ['Edición del SQL y auditoría', 'api_auditoria.mjs', [tec, usr]],
];

const resumen = [];
for (const [nombre, archivo, args] of PRUEBAS) {
  console.log(`\n=== ${nombre}`);
  const r = spawnSync(process.execPath, [path.join(DIR, 'pruebas', archivo), ...args], { env: process.env, encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter((l) => !l.startsWith('OK ')).join('\n'));
  process.stderr.write(r.stderr);
  const total = r.stdout.match(/(\d+)\/(\d+) OK/);
  resumen.push([nombre, total ? `${total[1]}/${total[2]}` : 'sin resultado', r.status === 0]);
}
rmSync(tmp, { recursive: true, force: true });

console.log('\n=== Resumen');
for (const [nombre, total, ok] of resumen) console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}: ${total}`);
process.exit(resumen.every(([, , ok]) => ok) ? 0 : 1);
