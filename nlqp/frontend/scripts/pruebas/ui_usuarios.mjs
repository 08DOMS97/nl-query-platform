// Interfaz de Usuarios (superadministrador): menú y acceso según el rol, alta, cambio de
// rol, desactivar y reactivar; inicio de sesión sin registro público y cuenta
// desactivada. NUNCA aprieta "Generar SQL" (aborta si se pide). Crea una cuenta
// temporal nlqp-ci-tmp-*@example.com; la borra `limpiar_pruebas.mjs` al terminar.
// Se corre con `npm run test:ui` (scripts/pruebas_ui.mjs).
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const OUT = process.env.NLQP_CAPTURAS ?? path.join(os.tmpdir(), 'nlqp-capturas');
const exe = process.env.NLQP_CHROMIUM ?? path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe');
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const SUP_EMAIL = process.env.NLQP_SUPERADMIN_EMAIL;
const SUP_PASSWORD = process.env.NLQP_SUPERADMIN_PASSWORD;
const TEC_EMAIL = process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com';
const TEC_PASSWORD = process.env.NLQP_TEST_USER_PASSWORD;
if (!SUP_EMAIL || !SUP_PASSWORD || !TEC_PASSWORD) {
  console.error('Faltan NLQP_SUPERADMIN_EMAIL, NLQP_SUPERADMIN_PASSWORD y NLQP_TEST_USER_PASSWORD en nlqp/backend/.env.');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: exe });
const consoleErrors = [];

async function newPage() {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('dialog', (d) => d.accept());
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('request', (r) => { if (r.url().includes('/generateSQL')) { console.log('ABORTO: /generateSQL'); process.exit(2); } });
  return page;
}
async function login(email, password) {
  const page = await newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('http://localhost:3000/');
  return page;
}
const fila = (page, email) => page.locator('tbody tr', { hasText: email });

const stamp = Date.now() % 1000000;
const nuevoEmail = `nlqp-ci-tmp-ui-${stamp}@example.com`;
const nuevoPassword = `Tmp-ui-${stamp}-clave`;

// --- Sin registro público
let page = await newPage();
await page.goto('http://localhost:3000/login');
check('Login: sin enlace para crear cuenta', (await page.getByText('Crear una cuenta').count()) === 0 && (await page.getByText('Pídala al administrador').count()) === 1);
const signup = await page.goto('http://localhost:3000/signup');
check('/signup ya no existe (404)', signup?.status() === 404);

// --- Superadministrador
page = await login(SUP_EMAIL, SUP_PASSWORD);
await page.waitForSelector('nav >> text=Usuarios', { timeout: 15000 }).catch(() => undefined);
check('Superadmin: menú Usuarios', (await page.locator('nav >> text=Usuarios').count()) === 1);
check('Superadmin: se identifica como superadministrador', (await page.getByText('Superadministrador', { exact: true }).count()) >= 1);
await page.click('nav >> text=Usuarios');
// El correo del superadmin ya está en el pie del menú: se espera la fila de la tabla.
await page.waitForSelector(`tbody tr:has-text("${TEC_EMAIL}")`, { timeout: 15000 }).catch(() => undefined);
check('Lista: aparecen las cuentas de prueba', (await fila(page, TEC_EMAIL).count()) === 1);
check('Su cuenta: sin botón Desactivar y rol bloqueado', (await fila(page, SUP_EMAIL).getByRole('button', { name: 'Desactivar' }).count()) === 0 && (await fila(page, SUP_EMAIL).getByRole('radio', { name: 'Usuario' }).isDisabled()));

// Alta
await page.getByRole('button', { name: 'Nuevo usuario' }).click();
await page.fill('#user-email', nuevoEmail);
await page.fill('#user-password', 'corta');
check('Contraseña corta: Crear deshabilitado', await page.getByRole('button', { name: 'Crear usuario' }).isDisabled());
await page.fill('#user-password', nuevoPassword);
await page.getByRole('radiogroup', { name: 'Rol del usuario nuevo' }).getByRole('radio', { name: 'Técnico' }).click();
await page.getByRole('button', { name: 'Crear usuario' }).click();
check('Crear: avisa', await page.waitForSelector(`text=Usuario ${nuevoEmail} creado.`, { timeout: 15000 }).then(() => true, () => false));
await page.waitForSelector(`tbody tr:has-text("${nuevoEmail}")`, { timeout: 15000 }).catch(() => undefined);
check('Crear: aparece como técnico y activo', (await fila(page, nuevoEmail).getByRole('radio', { name: 'Técnico' }).getAttribute('aria-checked')) === 'true' && (await fila(page, nuevoEmail).getByText('Activo').count()) === 1);
await page.screenshot({ path: path.join(OUT, 'usuarios_lista.png'), fullPage: true });
await page.getByRole('button', { name: 'Nuevo usuario' }).click();
await page.fill('#user-email', nuevoEmail);
await page.fill('#user-password', nuevoPassword);
await page.getByRole('button', { name: 'Crear usuario' }).click();
check('Correo repetido: avisa', await page.waitForSelector('text=Ya existe una cuenta con el correo', { timeout: 15000 }).then(() => true, () => false));
await page.getByRole('button', { name: 'Cancelar' }).click();

// Cambio de rol
await fila(page, nuevoEmail).getByRole('radio', { name: 'Usuario' }).click();
check('Cambiar a usuario: avisa', await page.waitForSelector(`text=${nuevoEmail}: rol usuario.`, { timeout: 15000 }).then(() => true, () => false));
check('Cambiar a usuario: queda marcado', (await fila(page, nuevoEmail).getByRole('radio', { name: 'Usuario' }).getAttribute('aria-checked')) === 'true');

// La cuenta nueva entra con el rol nuevo (sin menú técnico)
const nueva = await login(nuevoEmail, nuevoPassword);
check('Cuenta nueva: entra sin menú técnico ni Usuarios', (await nueva.locator('nav >> text=Conexiones').count()) === 0 && (await nueva.locator('nav >> text=Usuarios').count()) === 0);

// Desactivar y reactivar
await fila(page, nuevoEmail).getByRole('button', { name: 'Desactivar' }).click();
check('Desactivar: avisa', await page.waitForSelector(`text=${nuevoEmail}: cuenta desactivada.`, { timeout: 15000 }).then(() => true, () => false));
check('Desactivar: estado Desactivado', (await fila(page, nuevoEmail).getByText('Desactivado').count()) === 1);
const bloqueada = await newPage();
await bloqueada.goto('http://localhost:3000/login');
await bloqueada.fill('#email', nuevoEmail);
await bloqueada.fill('#password', nuevoPassword);
await bloqueada.click('button[type=submit]');
check('Cuenta desactivada: no entra y se avisa', await bloqueada.waitForSelector('text=Esta cuenta está desactivada', { timeout: 15000 }).then(() => true, () => false));
await fila(page, nuevoEmail).getByRole('button', { name: 'Reactivar' }).click();
check('Reactivar: avisa', await page.waitForSelector(`text=${nuevoEmail}: cuenta reactivada.`, { timeout: 15000 }).then(() => true, () => false));

// --- Técnico: sin gestión de usuarios
page = await login(TEC_EMAIL, TEC_PASSWORD);
check('Técnico: sin menú Usuarios', (await page.locator('nav >> text=Usuarios').count()) === 0);
await page.goto('http://localhost:3000/usuarios');
check('Técnico: /usuarios restringido', await page.waitForSelector('text=solo para el superadministrador').then(() => true, () => false));

// 404 (/signup ya no existe), 409 (correo repetido) y
// el 400 de Firebase al iniciar sesión con la cuenta desactivada son esperados.
const inesperados = consoleErrors.filter((e) => !/status of (400|404|409)/.test(e));
check('Sin errores de consola (salvo los esperados)', inesperados.length === 0, inesperados.join(' | '));
console.log(`\n${ok}/${ok + fail} OK`);
await browser.close();
process.exit(fail ? 1 : 0);
