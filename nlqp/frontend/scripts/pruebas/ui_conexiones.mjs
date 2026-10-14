// Interfaz de Conexiones (M1): alta, prueba, edición y baja; selector en Consultar y
// Esquema; restricciones del no técnico. NUNCA aprieta "Generar SQL" (aborta si se pide).
// Se corre con `npm run test:ui` (scripts/pruebas_ui.mjs).
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
const consoleErrors = [];

async function login(email, password) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('dialog', (d) => d.accept());
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('request', (r) => { if (r.url().includes('/generateSQL')) { console.log('ABORTO: /generateSQL'); process.exit(2); } });
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('http://localhost:3000/');
  return page;
}

const pg = {
  host: process.env.DB_POSTGRES_HOST,
  port: process.env.DB_POSTGRES_PORT,
  db: process.env.DB_POSTGRES_DATABASE,
  user: process.env.DB_POSTGRES_USER,
  password: process.env.DB_POSTGRES_PASSWORD,
};
const nombre = `Prueba UI ${Date.now() % 100000}`;
const conectados = (page) => page.getByText('Conectado', { exact: true }).count();
const fila = (page, n) => page.locator('tbody tr', { hasText: n });

// --- Técnico ---
let page = await login('nlqp-test@example.com', TEC_PASSWORD);
await page.waitForSelector('[role=radio]', { timeout: 15000 }).catch(() => undefined);
check('Consultar: 4 conexiones en el selector', (await page.getByRole('radio').count()) === 4, String(await page.getByRole('radio').count()));
await page.click('nav >> text=Conexiones');
await page.waitForSelector('text=Conectado');
check('Conexiones: 4 conectadas', (await conectados(page)) === 4);

// Alta con contraseña incorrecta
await page.getByRole('button', { name: 'Nueva conexión' }).click();
await page.fill('#conn-name', nombre);
await page.fill('#conn-host', pg.host);
await page.fill('#conn-port', pg.port);
await page.fill('#conn-db', pg.db);
await page.fill('#conn-user', pg.user);
await page.fill('#conn-password', 'incorrecta');
await page.getByRole('button', { name: 'Probar', exact: true }).click();
check('Probar con contraseña incorrecta: avisa', await page.waitForSelector('text=No se pudo conectar', { timeout: 15000 }).then(() => true, () => false));
await page.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.waitForSelector('text=No se pudo conectar', { timeout: 15000 });
await page.waitForTimeout(500);
check('Guardar con contraseña incorrecta: no se registra', (await fila(page, nombre).count()) === 0);

// Alta correcta
await page.fill('#conn-password', pg.password);
await page.getByRole('button', { name: 'Probar', exact: true }).click();
check('Probar con datos correctos: correcta', await page.waitForSelector('text=Conexión correcta', { timeout: 15000 }).then(() => true, () => false));
await page.screenshot({ path: path.join(OUT, '1_formulario.png'), fullPage: true });
await page.getByRole('button', { name: 'Guardar', exact: true }).click();
check('Guardar: registrada', await page.waitForSelector(`text=Conexión «${nombre}» registrada.`, { timeout: 15000 }).then(() => true, () => false));
await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 5 && !document.querySelector('tbody.opacity-50'), null, { timeout: 30000 });
check('Lista: 5 conexiones, todas conectadas', (await conectados(page)) === 5);
check('Lista: muestra servidor y base', (await fila(page, nombre).textContent()).includes(`${pg.host}:${pg.port}/${pg.db}`));
check('Nunca se muestra la contraseña', !(await page.content()).includes(pg.password));
await page.screenshot({ path: path.join(OUT, '2_conexiones_5.png'), fullPage: true });

// Uso de la conexión nueva en Esquema y Consultar
await page.click('nav >> text=Esquema');
await page.getByRole('radio', { name: new RegExp(nombre) }).click();
check('Esquema de la conexión nueva: 8 tablas', await page.waitForFunction(() => document.body.innerText.includes('order_items'), null, { timeout: 15000 }).then(() => true, () => false));
await page.click('nav >> text=Consultar');
await page.getByRole('radio', { name: new RegExp(nombre) }).click();
check('Consultar: la conexión nueva se puede elegir', (await page.getByRole('radio', { name: new RegExp(nombre) }).getAttribute('aria-checked')) === 'true');

// Edición sin contraseña
const editado = `${nombre} (editada)`;
await page.click('nav >> text=Conexiones');
await page.waitForSelector(`text=${nombre}`);
await fila(page, nombre).getByRole('button', { name: 'Editar' }).click();
check('Editar: motor bloqueado', await page.getByRole('radio', { name: 'PostgreSQL' }).isDisabled());
check('Editar: contraseña vacía', (await page.inputValue('#conn-password')) === '');
await page.fill('#conn-name', editado);
await page.getByRole('button', { name: 'Guardar', exact: true }).click();
check('Editar: actualizada', await page.waitForSelector(`text=Conexión «${editado}» actualizada.`, { timeout: 15000 }).then(() => true, () => false));
await page.waitForFunction(() => !document.querySelector('tbody.opacity-50'), null, { timeout: 30000 });
check('Editar: nombre nuevo en la lista y sigue conectada', (await fila(page, editado).getByText('Conectado', { exact: true }).count()) === 1);

// Baja
await fila(page, editado).getByRole('button', { name: 'Eliminar' }).click();
check('Eliminar: avisa', await page.waitForSelector(`text=Conexión «${editado}» eliminada.`, { timeout: 15000 }).then(() => true, () => false));
await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 4, null, { timeout: 30000 });
check('Eliminar: vuelve a 4', (await fila(page, editado).count()) === 0);
await page.click('nav >> text=Consultar');
await page.waitForSelector('[role=radio]', { timeout: 15000 }).catch(() => undefined);
check('Consultar: la eliminada ya no aparece y queda elegida otra', (await page.getByRole('radio').count()) === 4 && (await page.locator('[role=radio][aria-checked=true]').count()) === 1);

// --- No técnico ---
page = await login('nlqp-usuario@example.com', USR_PASSWORD);
await page.waitForSelector('[role=radio]', { timeout: 15000 }).catch(() => undefined);
check('Usuario: ve las 4 conexiones por nombre', (await page.getByRole('radio').count()) === 4 && (await page.getByRole('radio', { name: /Tienda · Servidor A/ }).count()) === 1);
check('Usuario: sin menú Conexiones', (await page.locator('nav >> text=Conexiones').count()) === 0);
await page.goto('http://localhost:3000/conexiones');
check('Usuario: /conexiones restringido', await page.waitForSelector('text=Acceso restringido').then(() => true, () => false));
check('Usuario: no ve formulario', (await page.getByRole('button', { name: 'Nueva conexión' }).count()) === 0);

// El 422 es el guardado con contraseña incorrecta, provocado a propósito.
const inesperados = consoleErrors.filter((e) => !e.includes('422'));
check('Sin errores de consola (salvo el 422 esperado)', inesperados.length === 0, inesperados.join(' | '));
console.log(`\n${ok}/${ok + fail} OK`);
await browser.close();
process.exit(fail ? 1 : 0);
