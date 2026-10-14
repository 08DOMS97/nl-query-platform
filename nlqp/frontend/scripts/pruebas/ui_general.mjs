// Interfaz general (M4, M5): SQL editable, bloqueo, guardar/reutilizar/eliminar,
// rutas técnicas. NUNCA aprieta "Generar SQL". Se corre con `npm run test:ui`.
// Requiere que el técnico tenga en su historial al menos una ejecución con filas.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const OUT = process.env.NLQP_CAPTURAS ?? path.join(os.tmpdir(), 'nlqp-capturas');
const exe = process.env.NLQP_CHROMIUM ?? path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe');
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
// Contraseñas de los usuarios de prueba: en el .env del backend (no se commitean).
const TEC_PASSWORD = process.env.NLQP_TEST_USER_PASSWORD;
const USR_PASSWORD = process.env.NLQP_USUARIO_PASSWORD;
if (!TEC_PASSWORD || !USR_PASSWORD) {
  console.error('Faltan NLQP_TEST_USER_PASSWORD y NLQP_USUARIO_PASSWORD en nlqp/backend/.env.');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: exe });

async function login(email, password) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('dialog', (d) => d.accept());
  page.on('request', (r) => { if (r.url().includes('/generateSQL')) { console.log('ABORTO: /generateSQL'); process.exit(2); } });
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('http://localhost:3000/');
  return page;
}
const savedCount = async (page) => Number((await page.getByRole('tab', { name: /Guardadas/ }).textContent()).match(/\d+/)[0]);

// --- Técnico: reutilizar, editar SQL, ejecutar ---
let page = await login('nlqp-test@example.com', TEC_PASSWORD);
await page.click('nav >> text=Conexiones');
await page.waitForSelector('text=Conectado', { timeout: 30000 }).catch(() => undefined);
check('técnico: Conexiones muestra las 4 conectadas', (await page.getByText('Conectado', { exact: true }).count()) === 4, String(await page.getByText('Conectado', { exact: true }).count()));
await page.screenshot({ path: path.join(OUT, '0_conexiones.png'), fullPage: true });
await page.click('nav >> text=Historial');
await page.waitForSelector('table');
await page.locator('tr', { hasText: /[0-9] fila/ }).first().getByRole('button', { name: 'Reutilizar' }).click();
await page.waitForURL('http://localhost:3000/');
const sqlBox = page.locator('textarea[aria-label="Sentencia SQL"]');
const SQL_EDITADO = `SELECT 40 + 2 AS r${Date.now() % 100000}`;
check('técnico: SQL editable', (await sqlBox.count()) === 1);
await sqlBox.fill(SQL_EDITADO);
check('técnico: insignia de editada', await page.waitForSelector('text=Editada · se valida al ejecutar', { timeout: 5000 }).then(() => true, () => false));
await page.getByRole('button', { name: 'Ejecutar' }).click();
await page.waitForSelector('text=Descargar CSV completo');
check('técnico: ejecuta SQL editado', (await page.locator('table td', { hasText: '42' }).count()) === 1);

// SQL editado peligroso: lo frena el backend
await sqlBox.fill('DELETE FROM customers');
await page.getByRole('button', { name: 'Ejecutar' }).click();
await page.waitForSelector('text=/El Query Safety Engine bloqueó la sentencia: .+/');
check('técnico: insignia Bloqueada y Ejecutar deshabilitado', (await page.locator('text=Bloqueada').count()) === 1 && await page.getByRole('button', { name: 'Ejecutar' }).isDisabled());
check('técnico: DELETE editado bloqueado por el backend', true);
await page.screenshot({ path: `${OUT}/09_tec_sql_editado_bloqueado.png` });

// Guardar desde Consultar y eliminar desde Historial
await sqlBox.fill(SQL_EDITADO);
const nombre = `Prueba rediseño ${Date.now()}`;
await page.getByRole('button', { name: 'Guardar' }).click();
await page.fill('input[aria-label="Nombre de la consulta"]', nombre);
await page.locator('form').getByRole('button', { name: 'Guardar' }).click();
await page.waitForSelector('text=Guardada');
await page.click('nav >> text=Historial');
await page.waitForSelector('table');
const antes = await savedCount(page);
await page.getByRole('tab', { name: /Guardadas/ }).click();
const fila = page.locator('tr', { hasText: nombre });
check('guardada aparece con su nombre', (await fila.count()) === 1);
await page.screenshot({ path: `${OUT}/10_tec_guardadas.png` });
await fila.getByRole('button', { name: 'Reutilizar' }).click();
await page.waitForURL('http://localhost:3000/');
check('reutilizar guardada carga el SQL', (await sqlBox.inputValue()) === SQL_EDITADO);
await page.click('nav >> text=Historial');
await page.getByRole('tab', { name: /Guardadas/ }).click();
await page.locator('tr', { hasText: nombre }).getByRole('button', { name: 'Eliminar' }).click();
await page.waitForFunction((n) => !document.body.innerText.includes(n), nombre);
check('eliminar guardada', (await savedCount(page)) === antes - 1);

// --- Usuario: sin SQL editable, sin menú técnico, sin acceso directo ---
page = await login('nlqp-usuario@example.com', USR_PASSWORD);
check('usuario: sin menú técnico', (await page.locator('nav >> text=Conexiones').count()) === 0);
for (const ruta of ['/conexiones', '/esquema', '/uso']) {
  await page.goto(`http://localhost:3000${ruta}`);
  await page.waitForSelector('text=Acceso restringido');
  check(`usuario: ${ruta} restringido`, true);
}

await browser.close();
console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);

