import type { UserRecord } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './firebaseAdmin.service.js';
import { roleFromClaims, superadminFromClaims } from '../middleware/auth.middleware.js';
import type { ManagedUser, UserRole } from '../types/index.js';

/**
 * Gestión de usuarios (solo superadministrador). Las cuentas viven en Firebase
 * Authentication y el rol en su custom claim `role`; no hay registro público, así que
 * toda cuenta la crea el superadministrador con un rol asignado.
 *
 * Los usuarios no se borran, se desactivan: su historial y su auditoría siguen
 * apuntando a la cuenta. Cambiar el rol o desactivar rige en la solicitud siguiente,
 * porque el backend lee el rol y el estado de la cuenta en cada una (auth.middleware.ts).
 * El permiso de superadministrador no se asigna desde aquí: solo con
 * `npm run set:superadmin`.
 */

export class UserValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'UserValidationError';
  }
}

const ROLES: UserRole[] = ['tecnico', 'no_tecnico'];
const MIN_PASSWORD = 8;

function toManaged(u: UserRecord): ManagedUser {
  const claims = u.customClaims ?? {};
  return {
    uid: u.uid,
    email: u.email ?? '',
    role: roleFromClaims(claims),
    superadmin: superadminFromClaims(claims),
    disabled: u.disabled,
    createdAt: new Date(u.metadata.creationTime).toISOString(),
    lastSignInAt: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
  };
}

function parseRole(value: unknown): UserRole {
  if (typeof value !== 'string' || !(ROLES as string[]).includes(value)) {
    throw new UserValidationError('Rol inválido. Válidos: tecnico, no_tecnico.');
  }
  return value as UserRole;
}

function parsePassword(value: unknown): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < MIN_PASSWORD || password.length > 128) {
    throw new UserValidationError(`La contraseña debe tener entre ${MIN_PASSWORD} y 128 caracteres.`);
  }
  return password;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const auth = getFirebaseAdmin().auth();
  const users: ManagedUser[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map(toManaged));
    pageToken = page.pageToken;
  } while (pageToken);
  return users.sort((a, b) => a.email.localeCompare(b.email, 'es'));
}

export async function createUser(body: unknown): Promise<ManagedUser> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new UserValidationError('Correo inválido.');
  }
  const password = parsePassword(b.password);
  const role = parseRole(b.role);
  const auth = getFirebaseAdmin().auth();
  let user: UserRecord;
  try {
    user = await auth.createUser({ email, password });
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/email-already-exists') {
      throw new UserValidationError(`Ya existe una cuenta con el correo ${email}.`, 409);
    }
    throw err;
  }
  await auth.setCustomUserClaims(user.uid, { role });
  return toManaged(await auth.getUser(user.uid));
}

/**
 * Cambia el rol, activa/desactiva una cuenta o le pone una contraseña nueva. `actingUid`:
 * el superadministrador que lo pide. La contraseña solo pasa a Firebase Auth (no se guarda
 * ni se registra); Firebase invalida entonces las sesiones de la cuenta, aunque el token
 * que cada una ya tiene sigue valiendo hasta que vence (una hora como mucho).
 */
export async function updateUser(uid: string, body: unknown, actingUid: string): Promise<ManagedUser> {
  const b = (body ?? {}) as Record<string, unknown>;
  const role = b.role === undefined ? undefined : parseRole(b.role);
  if (b.disabled !== undefined && typeof b.disabled !== 'boolean') {
    throw new UserValidationError('El campo "disabled" debe ser true o false.');
  }
  const disabled = b.disabled as boolean | undefined;
  const password = b.password === undefined ? undefined : parsePassword(b.password);
  if (role === undefined && disabled === undefined && password === undefined) {
    throw new UserValidationError('Indique "role", "disabled" o "password".');
  }

  const auth = getFirebaseAdmin().auth();
  let current: UserRecord;
  try {
    current = await auth.getUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/user-not-found') throw new UserValidationError('El usuario no existe.', 404);
    throw err;
  }
  const claims = current.customClaims ?? {};
  const isSuperadmin = superadminFromClaims(claims);
  if (uid === actingUid && (disabled === true || (role !== undefined && role !== 'tecnico'))) {
    throw new UserValidationError('No puede desactivar su propia cuenta ni quitarse el rol técnico.');
  }
  if (isSuperadmin && role === 'no_tecnico') {
    throw new UserValidationError('Un superadministrador debe tener rol técnico.');
  }

  if (role !== undefined && role !== claims.role) {
    await auth.setCustomUserClaims(uid, { ...claims, role });
  }
  if (disabled !== undefined && disabled !== current.disabled) {
    await auth.updateUser(uid, { disabled });
  }
  if (password !== undefined) {
    await auth.updateUser(uid, { password });
  }
  return toManaged(await auth.getUser(uid));
}
