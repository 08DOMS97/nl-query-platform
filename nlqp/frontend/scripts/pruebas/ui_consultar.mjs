// Pantalla Consultar (auditoría del 24/10): una respuesta vieja no aparece bajo una sentencia
// nueva, salir y volver mientras se genera no permite pagar otra generación, un error al
// ejecutar no deja a la vista el resultado anterior y cambiar de conexión descarta la
// sentencia. Sin costo: TODA llamada al backend pasa por `route`, y /generateSQL se
// responde acá con una sentencia fija (nunca llega al backend ni al modelo).
// Se corre con `npm run test:ui`.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const OUT = process.env.NLQP_CAPTURAS ?? path.join(os.tmpdir(), 'nlqp-capturas');
const exe = process.env.NLQP_CHROMIUM ?? path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe');
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const TEC_PASSWORD = process.env.NLQP_TEST_USER_PASSWORD;
const USR_PASSWORD = process.env.NLQP_USUARIO_PASSWORD;
const TEC_EMAIL = process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com';
const USR_EMAIL = process.env.NLQP_USUARIO_EMAIL ?? 'nlqp-ci-usuario@example.com';
if (!TEC_PASSWORD || !USR_PASSWORD) {
  console.error('Faltan NLQP_TEST_USER_PASSWORD y NLQP_USUARIO_PASSWORD en nlqp/backend/.env.');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: exe });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GENERADA = "SELECT 'a  b' AS texto, json_build_object('k', 1) AS objeto";

/**
 * Inicia sesión con todas las llamadas al backend interceptadas. `ctl` decide qué hacer con
 * /executeQuery (demora, error simulado o falta de red); /generateSQL se responde siempre acá.
 */
async function login(email, password) {
  const ctl = { generaciones: 0, generarDemora: 0, ejecutar: 'normal', ejecutarDemora: 0 };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // El backend puede estar en :8080 (npm run dev) o detrás de /api del frontend (Docker).
  const alBackend = (u) => u.port === '8080' || u.pathname.startsWith('/api/');
  await context.route(alBackend, async (route) => {
    const url = route.request().url();
    if (url.includes('/generateSQL')) {
      ctl.generaciones++;
      await wait(ctl.generarDemora);
      const { connectionId } = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'x-nlqp-prueba': '1' },
        body: JSON.stringify({
          sql: GENERADA, engine: 'postgres', connectionId, safety: { safe: true },
          metrics: { tokensInput: 1, tokensOutput: 1, tokensThinking: 0, tokensTotal: 2, costUsd: 0, latencyMs: 1, tablesSent: 1, tablesTotal: 1 },
        }),
      });
    }
    if (url.includes('/executeQuery') && route.request().method() === 'POST') {
      await wait(ctl.ejecutarDemora);
      if (ctl.ejecutar === 'error') {
        return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Falla simulada al ejecutar.' }) });
      }
      if (ctl.ejecutar === 'sin-red') return route.abort('connectionrefused');
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  // Red de seguridad: si /generateSQL llegara a salir del navegador, se aborta la prueba.
  page.on('requestfinished', async (r) => {
    if (r.url().includes('/generateSQL') && !(await r.response())?.headers()['x-nlqp-prueba']) { console.log('ABORTO: /generateSQL llegó al backend'); process.exit(2); }
  });
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('http://localhost:3000/');
  await page.waitForSelector('[role=radiogroup][aria-label="Conexión"]');
  return { page, ctl, context };
}
const generar = (page) => page.getByRole('button', { name: /Generar SQL|Generando…/ });
const tabla = (page) => page.locator('table');
async function pedir(page, pregunta) {
  await page.getByRole('radio', { name: /PostgreSQL/ }).first().click();
  await page.fill('#question', pregunta);
  await page.getByRole('button', { name: 'Generar SQL' }).click();
}

// --- Usuario no técnico: generar, salir y volver, ejecutar, error, sin red
{
  const { page, ctl, context } = await login(USR_EMAIL, USR_PASSWORD);
  ctl.generarDemora = 3000;
  await pedir(page, '¿Cuántos clientes hay?');
  check('mientras genera, el botón dice Generando… y está deshabilitado', await generar(page).isDisabled() && /Generando/.test(await generar(page).textContent()));
  await page.click('nav >> text=Historial');
  await page.waitForURL('**/historial');
  await page.click('nav >> text=Consultar');
  await page.waitForSelector('#question');
  check('al volver a Consultar sigue generando y no se puede generar otra', await generar(page).isDisabled() && /Generando/.test(await generar(page).textContent()));
  await page.keyboard.press('Control+Enter');
  await page.waitForSelector('text=Ver la sentencia generada', { timeout: 10000 });
  check('se pidió una sola generación', ctl.generaciones === 1, String(ctl.generaciones));
  check('la sentencia llegó aunque se cambió de pantalla', (await page.locator('pre', { hasText: 'json_build_object' }).count()) === 1);

  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.waitForSelector('table');
  const celdas = await tabla(page).locator('tbody td').allTextContents();
  check('un objeto se muestra como JSON, no como [object Object]', celdas.includes('{"k":1}'), JSON.stringify(celdas));
  check('los espacios repetidos de un texto se conservan', (await tabla(page).locator('tbody td').first().evaluate((td) => getComputedStyle(td).whiteSpace)) === 'pre' && celdas[0] === 'a  b', JSON.stringify(celdas));

  ctl.ejecutar = 'error';
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.waitForSelector('text=Falla simulada al ejecutar.');
  check('un error al ejecutar quita el resultado anterior', (await tabla(page).count()) === 0);
  check('el error se anuncia (role=alert)', (await page.getByRole('alert').filter({ hasText: 'Falla simulada' }).count()) === 1);

  ctl.ejecutar = 'sin-red';
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.waitForSelector('text=No hay conexión con el servidor', { timeout: 10000 }).catch(() => undefined);
  check('sin red: «No hay conexión con el servidor», no «Failed to fetch»', (await page.getByText('No hay conexión con el servidor').count()) === 1 && (await page.getByText('Failed to fetch').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'consultar_sin_red.png') });

  ctl.ejecutar = 'normal';
  await page.getByRole('radio', { name: /MySQL/ }).first().click();
  check('cambiar de conexión descarta la sentencia de la anterior', (await page.getByText('Ver la sentencia generada').count()) === 0);
  await context.close();
}

// --- Técnico: una ejecución vieja no aparece bajo la sentencia editada; «Guardada» se ve
{
  const { page, ctl, context } = await login(TEC_EMAIL, TEC_PASSWORD);
  await pedir(page, '¿Cuántos clientes hay?');
  const sqlBox = page.locator('textarea[aria-label="Sentencia SQL"]');
  await sqlBox.waitFor();
  check('técnico: la generada llega editable', (await sqlBox.inputValue()) === GENERADA);
  check('técnico: Generar SQL habilitado si no hay nada en curso', !(await generar(page).isDisabled()));

  ctl.ejecutarDemora = 2500;
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.waitForSelector('text=Ejecutando…');
  check('mientras ejecuta, Generar SQL está deshabilitado', await generar(page).isDisabled());
  await sqlBox.fill('SELECT 2 AS dos');
  await wait(4000);
  check('la ejecución de la sentencia anterior no aparece bajo la editada', (await tabla(page).count()) === 0);
  check('después de editar se puede ejecutar de nuevo', !(await page.getByRole('button', { name: 'Ejecutar' }).isDisabled()));
  ctl.ejecutarDemora = 0;
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.waitForSelector('table');
  check('la editada se ejecuta', (await tabla(page).locator('th').allTextContents()).includes('dos'));

  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.fill('input[aria-label="Nombre de la consulta"]', `ui_consultar ${Date.now()}`);
  await page.locator('form').getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.waitForSelector('text=Guardar como nueva');
  check('al guardar se ve «Guardada»', (await page.getByText('Guardada', { exact: true }).count()) === 1);
  check('ninguna llamada llegó a /generateSQL del backend (se respondieron acá)', ctl.generaciones === 1, String(ctl.generaciones));
  await context.close();
}

await browser.close();
console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
