import admin from 'firebase-admin';

/**
 * Da el permiso de superadministrador (gestión de usuarios) a una cuenta. Es la única
 * forma de asignarlo: la interfaz no puede.
 *
 *   npm run set:superadmin -- correo@ejemplo.com
 *   npm run set:superadmin -- correo@ejemplo.com --crear
 *
 * El superadministrador siempre tiene también el rol técnico. Con `--crear`, si la
 * cuenta no existe se crea con una contraseña aleatoria que nadie ve, y el script
 * imprime un enlace de un solo uso para que el dueño elija la suya.
 * Rige al instante: el backend lee el permiso de la cuenta en cada solicitud.
 */

const [email, flag] = process.argv.slice(2);
if (!email || (flag !== undefined && flag !== '--crear')) {
  console.error('Uso: npm run set:superadmin -- <correo> [--crear]');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}
const auth = admin.auth();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (err) {
  if (err.code !== 'auth/user-not-found' || flag !== '--crear') {
    console.error(err.code === 'auth/user-not-found' ? `${email} no existe (agregue --crear para crearla).` : err.message);
    process.exit(1);
  }
  const { randomBytes } = await import('node:crypto');
  user = await auth.createUser({ email, password: randomBytes(24).toString('base64url') });
  const link = await auth.generatePasswordResetLink(email);
  console.log(`Cuenta creada. Para elegir la contraseña, abra este enlace (un solo uso):\n${link}`);
}

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: 'tecnico', superadmin: true });
console.log(`${email}: superadministrador (rol técnico).`);
