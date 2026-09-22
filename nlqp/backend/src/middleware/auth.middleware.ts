import type { NextFunction, Request, Response } from 'express';
import admin from 'firebase-admin';

/**
 * Verifica el JWT de Firebase Auth enviado como `Authorization: Bearer <idToken>`.
 *
 * Modo desarrollo: la verificación se omite SOLO si se cumplen DOS condiciones a la
 * vez: `FIREBASE_PROJECT_ID` vacío (pendiente de David, ver
 * INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §8) Y `NLQP_ALLOW_DEV_AUTH_BYPASS=true`
 * puesto explícitamente en `.env`. Se exige el flag aparte a propósito: si solo se
 * mirara `FIREBASE_PROJECT_ID`, un despliegue a producción con esa variable vacía
 * por error (typo, secreto no montado, etc.) dejaría TODA la API sin autenticación
 * de forma silenciosa — incluyendo `/executeQuery`, que puede leer toda la base de
 * datos. Con el flag aparte, esa misma falta de configuración falla cerrado: sin
 * `FIREBASE_PROJECT_ID` la inicialización de firebase-admin falla y todo intento de
 * verificar el token da 401, en vez de saltarse la verificación.
 */

let initialized = false;

function ensureFirebaseInitialized(): void {
  if (initialized) return;
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  initialized = true;
}

export async function verifyFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const devBypassEnabled = process.env.NLQP_ALLOW_DEV_AUTH_BYPASS === 'true';

  if (!process.env.FIREBASE_PROJECT_ID && devBypassEnabled) {
    console.warn(
      '[auth.middleware] FIREBASE_PROJECT_ID no configurado y NLQP_ALLOW_DEV_AUTH_BYPASS=true — ' +
        'verificación de JWT omitida (solo desarrollo local, NUNCA debe estar así en producción).',
    );
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta el encabezado Authorization: Bearer <idToken>.' });
    return;
  }

  const idToken = header.slice('Bearer '.length);

  try {
    ensureFirebaseInitialized();
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as Request & { uid?: string }).uid = decoded.uid;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado.', detail: err instanceof Error ? err.message : String(err) });
  }
}
