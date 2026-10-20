import admin from 'firebase-admin';

/**
 * Borra de Firestore lo que dejan las pruebas automáticas (`test:api`, `test:ui`), para
 * que no aparezca en Historial, Cambios ni Uso y costos:
 *
 *   npm run limpiar:pruebas                       usuarios de las pruebas (los del .env)
 *   npm run limpiar:pruebas -- --emails a@example.com,b@example.com
 *
 * De cada usuario borra su historial y sus guardadas (`users/{uid}/history`, `saved`),
 * sus registros de auditoría (`sqlEdits`) y sus eventos de ejecución (`executeQuery`) en
 * `usageEvents`. Nunca borra eventos de `generateSQL`: son llamadas reales a Gemini, con
 * costo (las corridas de evaluación también se registran así). Solo acepta correos
 * `@example.com`, para no tocar usuarios reales por error. También borra las cuentas
 * temporales nlqp-ci-tmp-*@example.com de las pruebas de usuarios. `test:api` y `test:ui` lo
 * corren solos al terminar.
 */

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const emails = (
  opt('emails') ??
  [
    process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com',
    process.env.NLQP_USUARIO_EMAIL ?? 'nlqp-ci-usuario@example.com',
    process.env.NLQP_SUPERADMIN_EMAIL ?? 'nlqp-ci-superadmin@example.com',
  ].join(',')
).split(',');

const ajenos = emails.filter((e) => !e.endsWith('@example.com'));
if (ajenos.length) {
  console.error(`Solo se limpian usuarios de prueba (@example.com): ${ajenos.join(', ')}`);
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}
const db = admin.firestore();

/** Borra en lotes de 400 (el máximo de Firestore por lote es 500). */
async function borrar(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

for (const email of emails) {
  let uid;
  try {
    uid = (await admin.auth().getUserByEmail(email)).uid;
  } catch {
    console.log(`${email}: no existe, nada que limpiar`);
    continue;
  }
  const usuario = db.collection('users').doc(uid);
  const historial = await borrar((await usuario.collection('history').get()).docs);
  const guardadas = await borrar((await usuario.collection('saved').get()).docs);
  const auditoria = await borrar((await db.collection('sqlEdits').where('uid', '==', uid).get()).docs);
  const eventos = (await db.collection('usageEvents').where('uid', '==', uid).get()).docs.filter(
    (d) => d.data().type === 'executeQuery',
  );
  const uso = await borrar(eventos);
  console.log(`${email}: historial ${historial}, guardadas ${guardadas}, auditoría ${auditoria}, uso ${uso}`);
}

// Cuentas temporales que crean las pruebas de gestión de usuarios (api_usuarios.mjs,
// ui_usuarios.mjs). Cada prueba borra las suyas; esto cubre las que quedaron si una
// prueba se cortó a la mitad. Solo el patrón nlqp-ci-tmp-*@example.com.
const temporales = [];
let pageToken;
do {
  const page = await admin.auth().listUsers(1000, pageToken);
  temporales.push(...page.users.filter((u) => /^nlqp-ci-tmp-.*@example\.com$/.test(u.email ?? '')));
  pageToken = page.pageToken;
} while (pageToken);
for (const u of temporales) await admin.auth().deleteUser(u.uid);
console.log(`cuentas temporales borradas: ${temporales.length}`);
