import admin from 'firebase-admin';

/**
 * Utilidad de desarrollo: crea (si no existe) un usuario de prueba en Firebase
 * Authentication y devuelve un ID token real, para probar los endpoints
 * protegidos por `auth.middleware.ts` (Postman, curl) mientras no exista el
 * frontend (Módulo 8). El token expira a la hora — volver a correr el script
 * para renovarlo.
 */

const TEST_EMAIL = process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-test@example.com';
const TEST_PASSWORD = process.env.NLQP_TEST_USER_PASSWORD ?? 'NlqpTest_2026!';
const apiKey = process.env.FIREBASE_WEB_API_KEY;

if (!apiKey) {
  throw new Error(
    'Falta FIREBASE_WEB_API_KEY en .env (Firebase Console → Configuración del proyecto → ' +
      'General → tus apps → Web API Key).',
  );
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

async function ensureTestUser() {
  try {
    return await admin.auth().getUserByEmail(TEST_EMAIL);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'auth/user-not-found') {
      return admin.auth().createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        emailVerified: true,
      });
    }
    throw err;
  }
}

async function getIdToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`signInWithPassword falló: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

await ensureTestUser();
const idToken = await getIdToken();
console.log(idToken);
