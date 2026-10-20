// Gestión de usuarios (superadministrador): permisos, validaciones, alta, cambio de rol
// (rige en la solicitud siguiente, con la misma sesión), desactivación, protecciones sobre la propia
// cuenta y rechazo de cuentas sin rol. Crea cuentas temporales nlqp-ci-tmp-*@example.com
// y las borra al final. Se corre con `npm run test:api` (scripts/pruebas_api.mjs).
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const sup = readFileSync(process.argv[2], 'utf8').trim();
const tec = readFileSync(process.argv[3], 'utf8').trim();
const usr = readFileSync(process.argv[4], 'utf8').trim();
const BASE = 'http://localhost:8080';
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const call = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
};
/** Inicia sesión con correo y contraseña (API REST de Firebase Auth) y devuelve el ID token o el código de error. */
const signIn = async (email, password) => {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  return res.ok ? { token: json.idToken } : { error: json.error?.message };
};

if (admin.apps.length === 0) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const SUP_EMAIL = process.env.NLQP_SUPERADMIN_EMAIL;
const stamp = Date.now() % 1000000;
const tmpEmail = `nlqp-ci-tmp-${stamp}@example.com`;
const tmpPassword = `Tmp-${stamp}-clave`;
const sinRolEmail = `nlqp-ci-tmp-sinrol-${stamp}@example.com`;

try {
  // Permisos
  const lista = await call(sup, 'GET', '/users');
  check('superadmin: lista 200', lista.status === 200 && Array.isArray(lista.json.users), JSON.stringify(lista.json));
  const yo = lista.json.users.find((u) => u.email === SUP_EMAIL);
  check('superadmin: se ve como superadmin técnico', yo?.superadmin === true && yo.role === 'tecnico');
  check('lista sin contraseñas', JSON.stringify(lista.json).match(/password/i) === null);
  check('técnico: lista 403', (await call(tec, 'GET', '/users')).status === 403);
  check('técnico: crear 403', (await call(tec, 'POST', '/users', { email: tmpEmail, password: tmpPassword, role: 'tecnico' })).status === 403);
  check('usuario: lista 403', (await call(usr, 'GET', '/users')).status === 403);
  check('sin sesión 401', (await call(null, 'GET', '/users')).status === 401);

  // Validaciones
  check('correo inválido 400', (await call(sup, 'POST', '/users', { email: 'no-es-correo', password: tmpPassword, role: 'tecnico' })).status === 400);
  check('contraseña corta 400', (await call(sup, 'POST', '/users', { email: tmpEmail, password: 'corta', role: 'tecnico' })).status === 400);
  check('rol inválido 400', (await call(sup, 'POST', '/users', { email: tmpEmail, password: tmpPassword, role: 'admin' })).status === 400);
  check('correo ya registrado 409', (await call(sup, 'POST', '/users', { email: SUP_EMAIL, password: tmpPassword, role: 'tecnico' })).status === 409);

  // Alta como no técnico
  const nuevo = await call(sup, 'POST', '/users', { email: tmpEmail, password: tmpPassword, role: 'no_tecnico' });
  check('crear 201 con rol no técnico', nuevo.status === 201 && nuevo.json.role === 'no_tecnico' && nuevo.json.superadmin === false, JSON.stringify(nuevo.json));
  const uid = nuevo.json?.uid;
  const s = await signIn(tmpEmail, tmpPassword);
  check('la cuenta nueva inicia sesión', !!s.token, s.error);
  const me = await call(s.token, 'GET', '/me');
  check('/me: rol no técnico, sin superadmin', me.status === 200 && me.json.role === 'no_tecnico' && me.json.superadmin === false, JSON.stringify(me.json));
  check('cuenta nueva: consulta conexiones 200', (await call(s.token, 'GET', '/connections')).status === 200);
  check('cuenta nueva: herramientas técnicas 403', (await call(s.token, 'GET', '/poolStatus')).status === 403);
  check('/me del superadmin: superadmin', (await call(sup, 'GET', '/me')).json?.superadmin === true);

  // Cambio de rol: rige en la solicitud siguiente, con la misma sesión
  const ascenso = await call(sup, 'PUT', `/users?uid=${uid}`, { role: 'tecnico' });
  check('cambiar a técnico 200', ascenso.status === 200 && ascenso.json.role === 'tecnico', JSON.stringify(ascenso.json));
  const ps = await call(s.token, 'GET', '/poolStatus');
  check('misma sesión: herramientas técnicas 200 al instante', ps.status === 200, JSON.stringify(ps.json));
  check('/me: ahora técnico', (await call(s.token, 'GET', '/me')).json?.role === 'tecnico');
  check('volver a no técnico: 403 al instante', (await call(sup, 'PUT', `/users?uid=${uid}`, { role: 'no_tecnico' })).status === 200 && (await call(s.token, 'GET', '/poolStatus')).status === 403);

  // Desactivar y reactivar
  const off = await call(sup, 'PUT', `/users?uid=${uid}`, { disabled: true });
  check('desactivar 200', off.status === 200 && off.json.disabled === true);
  const dis = await call(s.token, 'GET', '/connections');
  check('cuenta desactivada: su sesión se rechaza al instante (401)', dis.status === 401 && dis.json?.code === 'auth/user-disabled', JSON.stringify(dis.json));
  check('cuenta desactivada: no puede iniciar sesión', (await signIn(tmpEmail, tmpPassword)).error === 'USER_DISABLED');
  check('reactivar 200', (await call(sup, 'PUT', `/users?uid=${uid}`, { disabled: false })).json?.disabled === false);
  check('reactivada: vuelve a iniciar sesión', !!(await signIn(tmpEmail, tmpPassword)).token);

  // Validaciones del cambio
  check('PUT sin datos 400', (await call(sup, 'PUT', `/users?uid=${uid}`, {})).status === 400);
  check('PUT con rol inválido 400', (await call(sup, 'PUT', `/users?uid=${uid}`, { role: 'admin' })).status === 400);
  check('PUT a un usuario inexistente 404', (await call(sup, 'PUT', '/users?uid=no-existe-123', { disabled: true })).status === 404);
  check('técnico: cambiar rol 403', (await call(tec, 'PUT', `/users?uid=${uid}`, { role: 'no_tecnico' })).status === 403);

  // La propia cuenta del superadmin
  check('no puede desactivarse a sí mismo (400)', (await call(sup, 'PUT', `/users?uid=${yo.uid}`, { disabled: true })).status === 400);
  check('no puede quitarse el rol técnico (400)', (await call(sup, 'PUT', `/users?uid=${yo.uid}`, { role: 'no_tecnico' })).status === 400);
  check('sigue siendo superadmin', (await call(sup, 'GET', '/users')).status === 200);

  // Cuenta sin rol (p. ej. creada llamando directo a la API de Firebase): sin acceso
  await admin.auth().createUser({ email: sinRolEmail, password: tmpPassword });
  const sr = await signIn(sinRolEmail, tmpPassword);
  const srCall = await call(sr.token, 'GET', '/connections');
  check('cuenta sin rol: 403 en la API', srCall.status === 403 && srCall.json?.code === 'nlqp/no-role', JSON.stringify(srCall.json));
  check('cuenta sin rol: aparece en la lista sin rol', (await call(sup, 'GET', '/users')).json.users.some((u) => u.email === sinRolEmail && u.role === null));
} finally {
  // Las cuentas temporales se borran (desde la interfaz no se puede: solo se desactivan).
  for (const email of [tmpEmail, sinRolEmail]) {
    try {
      await admin.auth().deleteUser((await admin.auth().getUserByEmail(email)).uid);
    } catch {}
  }
}

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
