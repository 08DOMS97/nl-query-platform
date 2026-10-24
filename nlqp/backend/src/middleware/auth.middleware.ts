import type { NextFunction, Request, Response } from 'express';
import { getFirebaseAdmin } from '../services/firebaseAdmin.service.js';
import type { UserRole } from '../types/index.js';

export type AuthedRequest = Request & { uid?: string; email?: string; role?: UserRole; superadmin?: boolean };

/**
 * Rol del claim `role`. Desde el 19/10/2026 las cuentas las crea el superadministrador
 * con un rol asignado (no hay registro público): una cuenta sin rol (`null`) no tiene
 * acceso, por ejemplo una creada llamando directamente a la API de Firebase.
 */
export function roleFromClaims(claims: Record<string, unknown>): UserRole | null {
  return claims.role === 'tecnico' || claims.role === 'no_tecnico' ? claims.role : null;
}

/** El superadministrador gestiona los usuarios; siempre es también técnico. */
export function superadminFromClaims(claims: Record<string, unknown>): boolean {
  return claims.superadmin === true && claims.role === 'tecnico';
}

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
    (req as AuthedRequest).role = 'no_tecnico';
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta el encabezado Authorization: Bearer <idToken>.' });
    return;
  }

  const idToken = header.slice('Bearer '.length);

  let uid: string;
  let email: string | undefined;
  let claims: Record<string, unknown>;
  try {
    const auth = getFirebaseAdmin().auth();
    const decoded = await auth.verifyIdToken(idToken);
    // El rol y el estado se leen de la cuenta, no del token: el token conserva hasta una
    // hora los claims con que se emitió, y así un cambio de rol o una desactivación del
    // superadministrador rige en la solicitud siguiente. (Revocar la sesión no sirve: el
    // SDK marca la revocación con el reloj local, y con el reloj del servidor adelantado
    // rechaza también los inicios de sesión de los segundos siguientes.)
    const account = await auth.getUser(decoded.uid);
    if (account.disabled) {
      res.status(401).json({ error: 'Esta cuenta está desactivada.', code: 'auth/user-disabled' });
      return;
    }
    uid = account.uid;
    email = account.email;
    claims = account.customClaims ?? {};
  } catch (err) {
    // El detalle del SDK (proyecto esperado, motivo) queda en el servidor, no en la respuesta.
    console.warn('[auth] token rechazado:', err instanceof Error ? err.message : String(err));
    res.status(401).json({ error: 'Token inválido o expirado.' });
    return;
  }
  const role = roleFromClaims(claims);
  if (!role) {
    res.status(403).json({ error: 'Esta cuenta no tiene un rol asignado. Pida acceso al administrador.', code: 'nlqp/no-role' });
    return;
  }
  (req as AuthedRequest).uid = uid;
  (req as AuthedRequest).email = email;
  (req as AuthedRequest).role = role;
  (req as AuthedRequest).superadmin = superadminFromClaims(claims);
  next();
}

/** Restringe una ruta al superadministrador (gestión de usuarios). Va después de `verifyFirebaseAuth`. */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (!(req as AuthedRequest).superadmin) {
    res.status(403).json({ error: 'Esta función es solo para el superadministrador.' });
    return;
  }
  next();
}

/**
 * Restringe una ruta al rol técnico (Módulo 4: conexiones y pool, esquema, uso y
 * costos). Va después de `verifyFirebaseAuth`. Se aplica en el backend: ocultar la
 * pantalla en el frontend no alcanza.
 */
export function requireTechnicalRole(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthedRequest).role !== 'tecnico') {
    res.status(403).json({ error: 'Esta función es solo para el rol técnico.' });
    return;
  }
  next();
}
