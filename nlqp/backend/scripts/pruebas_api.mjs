/**
 * Pruebas de la API sin costo (solo llaman a /generateSQL con entradas que el backend
 * rechaza antes del modelo, y lo comprueban antes de cada llamada):
 *
 *   npm run test:api
 *
 * Requiere Docker con los 4 motores y el backend corriendo en http://localhost:8080.
 * Pide un token para cada usuario de las pruebas (superadmin, técnico y no técnico, exclusivos de las
 * pruebas: NLQP_SUPERADMIN_*, NLQP_TEST_USER_* y NLQP_USUARIO_* del .env) y corre, en
 * orden, las pruebas de `scripts/pruebas/`: conexiones (M1), roles (M4), historial
 * y guardadas (M5), edición del SQL con su auditoría, gestión de usuarios, controles de la generación, robustez del servidor e integridad de los valores. La de conexiones crea conexiones temporales y la de usuarios cuentas temporales; las dos las eliminan.
 * Al terminar borra lo que las pruebas dejaron en Firestore (`limpiar_pruebas.mjs`).
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
const USUARIO_EMAIL = process.env.NLQP_USUARIO_EMAIL ?? 'nlqp-ci-usuario@example.com';
if (!process.env.NLQP_USUARIO_PASSWORD) {
  console.error(`Falta NLQP_USUARIO_PASSWORD en .env (contraseña de ${USUARIO_EMAIL}).`);
  process.exit(1);
}
writeFileSync(usr, token(USUARIO_EMAIL, process.env.NLQP_USUARIO_PASSWORD));
const sup = path.join(tmp, 'superadmin.txt');
if (!process.env.NLQP_SUPERADMIN_EMAIL || !process.env.NLQP_SUPERADMIN_PASSWORD) {
  console.error('Faltan NLQP_SUPERADMIN_EMAIL y NLQP_SUPERADMIN_PASSWORD en .env (superadministrador de las pruebas).');
  process.exit(1);
}
writeFileSync(sup, token(process.env.NLQP_SUPERADMIN_EMAIL, process.env.NLQP_SUPERADMIN_PASSWORD));

const PRUEBAS = [
  ['Conexiones (M1)', 'api_conexiones.mjs', [tec, usr]],
  ['Roles (M4)', 'api_roles.mjs', [tec, usr]],
  ['Historial y guardadas (M5)', 'api_m5.mjs', [usr, tec]],
  ['Edición del SQL y auditoría', 'api_auditoria.mjs', [tec, usr]],
  ['Gestión de usuarios (superadmin)', 'api_usuarios.mjs', [sup, tec, usr]],
  ['Controles de la generación (sin llamar al modelo)', 'api_generacion.mjs', [tec, usr]],
  ['Robustez del servidor', 'api_robustez.mjs', [usr]],
  ['Integridad de los valores (4 motores)', 'api_integridad.mjs', [usr]],
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

const limpieza = spawnSync(process.execPath, [path.join(DIR, 'limpiar_pruebas.mjs')], { env: process.env, encoding: 'utf8' });
console.log(`\n=== Limpieza\n${limpieza.stdout.trim()}`);
process.stderr.write(limpieza.stderr);

console.log('\n=== Resumen');
for (const [nombre, total, ok] of resumen) console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}: ${total}`);
process.exit(resumen.every(([, , ok]) => ok) ? 0 : 1);
