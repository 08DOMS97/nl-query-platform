// Interfaz general (M4, M5): edición del SQL (no desde el historial: se guarda y se
// edita como guardada), Guardar cambios, auditoría, bloqueo, guardadas y rutas técnicas. NUNCA aprieta "Generar SQL". Se corre con `npm run test:ui`.
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
// Usuarios exclusivos de las pruebas (no los de la demo): lo que dejan se borra al terminar.
const TEC_EMAIL = process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com';
const USR_EMAIL = process.env.NLQP_USUARIO_EMAIL ?? 'nlqp-ci-usuario@example.com';
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
let page = await login(TEC_EMAIL, TEC_PASSWORD);
await page.click('nav >> text=Conexiones');
await page.waitForSelector('text=Conectado', { timeout: 30000 }).catch(() => undefined);
check('técnico: Conexiones muestra las 4 conectadas', (await page.getByText('Conectado', { exact: true }).count()) === 4, String(await page.getByText('Conectado', { exact: true }).count()));
await page.screenshot({ path: path.join(OUT, '0_conexiones.png'), fullPage: true });
// Del historial: se reutiliza tal cual, sin editar. El usuario de las pruebas empieza con
// el historial vacío (se limpia al terminar), así que primero se ejecuta una por la API.
{
  const auth = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEC_EMAIL, password: TEC_PASSWORD, returnSecureToken: true }),
  })).json();
  const r = await fetch('http://localhost:8080/executeQuery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.idToken}` },
    body: JSON.stringify({ connectionId: 'postgres', sql: 'SELECT 1 AS x', question: 'prueba de interfaz' }),
  });
  check('historial: consulta previa por la API', r.status === 200, String(r.status));
}
await page.click('nav >> text=Historial');
await page.waitForSelector('table');
await page.locator('tr', { hasText: /[0-9] fila/ }).first().getByRole('button', { name: 'Reutilizar' }).click();
await page.waitForURL('http://localhost:3000/');
const sqlBox = page.locator('textarea[aria-label="Sentencia SQL"]');
check('historial: no editable', (await sqlBox.count()) === 0 && (await page.getByText('Para modificar esta consulta, guárdela primero').count()) === 1);
await page.getByRole('button', { name: 'Ejecutar' }).click();
check('historial: se ejecuta tal cual', await page.waitForSelector('text=Descargar CSV completo', { timeout: 30000 }).then(() => true, () => false));

// Para editarla, se guarda: queda editable como guardada
const marca = `ui${Date.now() % 1000000}`;
const nombre = `Prueba edición ${marca}`;
await page.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.fill('input[aria-label="Nombre de la consulta"]', nombre);
await page.locator('form').getByRole('button', { name: 'Guardar', exact: true }).click();
await page.waitForSelector(`text=«${nombre}»`);
check('al guardarla queda editable', (await sqlBox.count()) === 1);
const original = await sqlBox.inputValue();

// Editar y ejecutar
const SQL_EDITADO = `SELECT 40 + 2 AS ${marca}`;
await sqlBox.fill(SQL_EDITADO);
check('técnico: insignia de editada', await page.waitForSelector('text=Editada · se valida al ejecutar', { timeout: 5000 }).then(() => true, () => false));
check('guardada editada: botón Guardar cambios', (await page.getByRole('button', { name: 'Guardar cambios' }).count()) === 1);
await page.getByRole('button', { name: 'Ejecutar' }).click();
await page.waitForSelector('text=Descargar CSV completo');
check('técnico: ejecuta SQL editado', (await page.locator('table td', { hasText: '42' }).count()) === 1);

// SQL editado peligroso: lo frena el backend
await sqlBox.fill('DELETE FROM customers');
await page.getByRole('button', { name: 'Ejecutar' }).click();
await page.waitForSelector('text=/El Query Safety Engine bloqueó la sentencia: .+/');
check('técnico: insignia Bloqueada y Ejecutar deshabilitado', (await page.locator('text=Bloqueada').count()) === 1 && await page.getByRole('button', { name: 'Ejecutar' }).isDisabled());
await page.screenshot({ path: `${OUT}/09_tec_sql_editado_bloqueado.png` });

// Guardar cambios en la guardada
await sqlBox.fill(SQL_EDITADO);
await page.getByRole('button', { name: 'Guardar cambios' }).click();
check('guardar cambios: confirmado', await page.waitForSelector('text=Cambios guardados', { timeout: 15000 }).then(() => true, () => false));
check('guardar cambios: ya no figura editada', (await page.getByText('Editada · se valida al ejecutar').count()) === 0);

// Guardadas y auditoría
await page.click('nav >> text=Historial');
await page.waitForSelector('table');
const antes = await savedCount(page);
await page.getByRole('tab', { name: /Guardadas/ }).click();
const fila = page.locator('tr', { hasText: nombre });
check('guardada aparece con su nombre y la sentencia nueva', (await fila.count()) === 1 && (await fila.textContent()).includes(SQL_EDITADO));
await page.getByRole('tab', { name: /Cambios/ }).click();
const cambio = page.locator('li', { hasText: `«${nombre}»` }).filter({ hasText: 'Reemplazó' }).first();
check('cambios: registro con lo reemplazado', (await cambio.count()) === 1);
check('cambios: quién y acciones', (await cambio.textContent()).includes(TEC_EMAIL) && (await cambio.getByText('Ejecutada', { exact: true }).count()) === 1 && (await cambio.getByText('Guardada', { exact: true }).count()) === 1);
check('cambios: fecha y hora', /\d{1,2} \w+ \d{4}, \d{2}:\d{2}/.test(await cambio.textContent()));
await cambio.getByText('Ver la sentencia completa con los cambios').click();
check('cambios: sentencia con lo agregado', (await cambio.locator('pre').textContent()).includes(marca));
await page.screenshot({ path: `${OUT}/11_tec_cambios.png`, fullPage: true });
check('cambios: el original era el del historial', original !== SQL_EDITADO);

// Reutilizar la guardada: editable y con la sentencia nueva
await page.getByRole('tab', { name: /Guardadas/ }).click();
await fila.getByRole('button', { name: 'Reutilizar o editar' }).click();
await page.waitForURL('http://localhost:3000/');
check('reutilizar guardada: editable con el SQL guardado', (await sqlBox.inputValue()) === SQL_EDITADO);
await page.click('nav >> text=Historial');
await page.getByRole('tab', { name: /Guardadas/ }).click();
await page.locator('tr', { hasText: nombre }).getByRole('button', { name: 'Eliminar' }).click();
await page.waitForFunction((n) => !document.body.innerText.includes(n), nombre);
check('eliminar guardada', (await savedCount(page)) === antes - 1);

// Limpieza de la auditoría de esta corrida (no hay endpoint para borrarla)
const { getFirestore } = await import('../../../backend/lib/services/firebaseAdmin.service.js');
const snap = await getFirestore().collection('sqlEdits').get();
await Promise.all(snap.docs.filter((d) => String(d.data().editedSql).includes(marca)).map((d) => d.ref.delete()));

// --- Usuario: sin SQL editable, sin menú técnico, sin acceso directo ---
page = await login(USR_EMAIL, USR_PASSWORD);
await page.click('nav >> text=Historial');
await page.waitForSelector('[role=tab]');
check('usuario: sin pestaña Cambios', (await page.getByRole('tab', { name: /Cambios/ }).count()) === 0);
check('usuario: sin menú técnico', (await page.locator('nav >> text=Conexiones').count()) === 0);
for (const ruta of ['/conexiones', '/esquema', '/uso']) {
  await page.goto(`http://localhost:3000${ruta}`);
  check(`usuario: ${ruta} restringido`, await page.waitForSelector('text=Acceso restringido').then(() => true, () => false));
}

await browser.close();
console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);

