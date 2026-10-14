/**
 * Pruebas de la interfaz en Chromium, sin costo (abortan si se pide /generateSQL):
 *
 *   npm run test:ui
 *
 * Requiere Docker, el backend en http://localhost:8080 y el frontend en
 * http://localhost:3000. Usa `playwright-core`, que no es dependencia del proyecto:
 * la primera vez, `npm install --no-save playwright-core@1.64.0` y
 * `npx playwright-core install chromium` (o indicar otro Chromium en NLQP_CHROMIUM).
 * Las capturas quedan en NLQP_CAPTURAS (por defecto, <temp>/nlqp-capturas).
 * Lee de `../backend/.env` los datos de la conexión de prueba y las contraseñas de los
 * usuarios de prueba (NLQP_TEST_USER_PASSWORD, NLQP_USUARIO_PASSWORD).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(DIR, '..', '..', 'backend', '.env');

try {
  await import('playwright-core');
} catch {
  console.error('Falta playwright-core: npm install --no-save playwright-core@1.64.0');
  process.exit(1);
}
for (const [url, quien] of [
  ['http://localhost:8080/health', 'el backend'],
  ['http://localhost:3000/login', 'el frontend'],
]) {
  try {
    await fetch(url);
  } catch {
    console.error(`${quien} no responde (${url}).`);
    process.exit(1);
  }
}
mkdirSync(process.env.NLQP_CAPTURAS ?? path.join(os.tmpdir(), 'nlqp-capturas'), { recursive: true });

const PRUEBAS = [
  ['Interfaz general (M4, M5)', 'ui_general.mjs'],
  ['Conexiones (M1)', 'ui_conexiones.mjs'],
];

const resumen = [];
for (const [nombre, archivo] of PRUEBAS) {
  console.log(`\n=== ${nombre}`);
  const r = spawnSync(process.execPath, [`--env-file=${ENV_FILE}`, path.join(DIR, 'pruebas', archivo)], {
    env: process.env,
    encoding: 'utf8',
  });
  process.stdout.write(r.stdout.split('\n').filter((l) => !l.startsWith('OK ')).join('\n'));
  process.stderr.write(r.stderr);
  const total = r.stdout.match(/(\d+)\/(\d+) OK/);
  resumen.push([nombre, total ? `${total[1]}/${total[2]}` : 'sin resultado', r.status === 0]);
}

console.log('\n=== Resumen');
for (const [nombre, total, ok] of resumen) console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}: ${total}`);
process.exit(resumen.every(([, , ok]) => ok) ? 0 : 1);
