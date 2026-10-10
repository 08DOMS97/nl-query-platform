import admin from 'firebase-admin';

/**
 * Asigna el rol de un usuario existente como custom claim de Firebase (sección 4.2):
 *
 *   npm run set:role -- correo@ejemplo.com tecnico
 *   npm run set:role -- correo@ejemplo.com no_tecnico
 *
 * Solo el backend (Admin SDK) puede escribir el claim; el usuario no puede cambiárselo.
 * El cambio se ve cuando el usuario renueva su token (cerrar sesión y volver a entrar,
 * o a la hora como mucho).
 */

const [email, role] = process.argv.slice(2);
if (!email || (role !== 'tecnico' && role !== 'no_tecnico')) {
  console.error('Uso: npm run set:role -- <correo> <tecnico|no_tecnico>');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role });
console.log(`${email}: rol ${role}`);
