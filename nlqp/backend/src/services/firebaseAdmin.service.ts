import admin from 'firebase-admin';

/**
 * Inicialización única y compartida del SDK de Firebase Admin. La usan
 * `auth.middleware.ts` (verificación de JWT) y `usageTracking.service.ts`
 * (Firestore) — antes cada uno la duplicaba por su cuenta.
 */

let initialized = false;

function ensureFirebaseAdminInitialized(): void {
  if (initialized) return;
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  initialized = true;
}

export function getFirebaseAdmin(): typeof admin {
  ensureFirebaseAdminInitialized();
  return admin;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}
