import { getFirestore } from './firebaseAdmin.service.js';
import { addSecretVersion, deleteSecret, getSecret } from './secretManager.service.js';
import {
  DB_ENGINES,
  type ConnectionDetail,
  type ConnectionInput,
  type DbEngine,
  type EngineConnectionConfig,
} from '../types/index.js';

/**
 * Módulo 1: registro de conexiones.
 *
 * Los datos de cada conexión (nombre, motor, servidor, puerto, base, usuario) viven
 * en Firestore (`connections/{id}`); la contraseña, en Google Cloud Secret Manager
 * (`nlqp-conn-{id}`), y el registro solo guarda el nombre del secreto. La contraseña
 * se lee al abrir el pool de la conexión y nunca sale del backend.
 *
 * Las conexiones iniciales (`scripts/seed_connections.mjs`) usan como id el nombre
 * del motor (`postgres`, `mysql`, `mariadb`, `mssql`), para que el runner de
 * evaluación y el historial anterior —que identifican la base por motor— sigan
 * funcionando.
 */

const COLLECTION = 'connections';

export function secretNameFor(connectionId: string): string {
  return `nlqp-conn-${connectionId}`;
}

interface StoredConnection {
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  secretName: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export class ConnectionNotFoundError extends Error {
  constructor(id: string) {
    super(`La conexión "${id}" no existe.`);
    this.name = 'ConnectionNotFoundError';
  }
}

// Caché de los datos (sin contraseña). Un único proceso escribe el registro, así que
// basta con invalidar al crear, editar o eliminar.
const cache = new Map<string, ConnectionDetail & { secretName: string }>();
let listed = false;

function toDetail(id: string, data: StoredConnection): ConnectionDetail & { secretName: string } {
  return {
    id,
    name: data.name,
    engine: data.engine,
    host: data.host,
    port: data.port,
    database: data.database,
    user: data.user,
    secretName: data.secretName,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function toIso(value: unknown): string {
  const v = value as { toDate?: () => Date };
  return (v.toDate ? v.toDate() : (value as Date)).toISOString();
}

function strip(c: ConnectionDetail & { secretName: string }): ConnectionDetail {
  const { secretName: _secretName, ...rest } = c;
  return rest;
}

export async function listConnections(): Promise<ConnectionDetail[]> {
  if (!listed) {
    const snapshot = await getFirestore().collection(COLLECTION).get();
    cache.clear();
    for (const doc of snapshot.docs) cache.set(doc.id, toDetail(doc.id, doc.data() as StoredConnection));
    listed = true;
  }
  return [...cache.values()].map(strip).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

async function getStored(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;
  const doc = await getFirestore().collection(COLLECTION).doc(id).get();
  if (!doc.exists) throw new ConnectionNotFoundError(id);
  const detail = toDetail(doc.id, doc.data() as StoredConnection);
  cache.set(id, detail);
  return detail;
}

export async function getConnection(id: string): Promise<ConnectionDetail> {
  return strip(await getStored(id));
}

/** Datos completos para abrir el pool, con la contraseña leída de Secret Manager. */
export async function resolveConnectionConfig(
  id: string,
): Promise<{ engine: DbEngine; config: EngineConnectionConfig }> {
  const c = await getStored(id);
  const password = await getSecret(c.secretName);
  return {
    engine: c.engine,
    config: { host: c.host, port: c.port, database: c.database, user: c.user, password },
  };
}

/**
 * Conexión indicada en una solicitud: `connectionId`, o `engine` como alias (el id de
 * las conexiones iniciales es el nombre del motor). Lanza `ConnectionValidationError`
 * si falta y `ConnectionNotFoundError` si no existe.
 */
export async function connectionFromRequest(source: { connectionId?: unknown; engine?: unknown }): Promise<ConnectionDetail> {
  const id = source.connectionId ?? source.engine;
  if (typeof id !== 'string' || !id.trim()) {
    throw new ConnectionValidationError('Campo "connectionId" es requerido.');
  }
  return getConnection(id.trim());
}

/* --- Validación --- */

export class ConnectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionValidationError';
  }
}

function text(value: unknown, field: string, max: number, required = true): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (required && !v) throw new ConnectionValidationError(`El campo "${field}" es requerido.`);
  if (v.length > max) throw new ConnectionValidationError(`El campo "${field}" admite hasta ${max} caracteres.`);
  return v;
}

/**
 * Valida los datos de una conexión. En una edición (`partial`) la contraseña puede
 * omitirse para conservar la actual, y el motor no se puede cambiar (el historial y
 * las consultas guardadas dependen del dialecto).
 */
export function parseConnectionInput(body: unknown, partial = false): ConnectionInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const engine = b.engine;
  if (!partial && (typeof engine !== 'string' || !(DB_ENGINES as string[]).includes(engine))) {
    throw new ConnectionValidationError(`Campo "engine" inválido. Válidos: ${DB_ENGINES.join(', ')}.`);
  }
  const port = Number(b.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConnectionValidationError('El puerto debe ser un número entre 1 y 65535.');
  }
  const password = typeof b.password === 'string' ? b.password : undefined;
  if (!partial && !password) throw new ConnectionValidationError('El campo "password" es requerido.');
  if (password && password.length > 256) throw new ConnectionValidationError('La contraseña admite hasta 256 caracteres.');
  return {
    name: text(b.name, 'name', 80),
    engine: engine as DbEngine,
    host: text(b.host, 'host', 255),
    port,
    database: text(b.database, 'database', 128),
    user: text(b.user, 'user', 128),
    password,
  };
}

async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const all = await listConnections();
  if (all.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase())) {
    throw new ConnectionValidationError(`Ya existe una conexión llamada "${name}".`);
  }
}

/* --- Escritura (solo rol técnico; el handler prueba la conexión antes de llamar) --- */

/** `id` explícito solo para las conexiones iniciales; si no, Firestore genera uno. */
export async function createConnection(
  input: ConnectionInput & { password: string },
  uid: string | null,
  id?: string,
): Promise<ConnectionDetail> {
  await assertUniqueName(input.name);
  const ref = id ? getFirestore().collection(COLLECTION).doc(id) : getFirestore().collection(COLLECTION).doc();
  const secretName = secretNameFor(ref.id);
  await addSecretVersion(secretName, input.password);
  const now = new Date();
  const stored: StoredConnection = {
    name: input.name,
    engine: input.engine,
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    secretName,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  };
  try {
    await ref.create(stored);
  } catch (err) {
    // Sin registro, el secreto quedaría huérfano (y ocupando cuota): se borra.
    await deleteSecret(secretName).catch(() => undefined);
    throw err;
  }
  const detail = toDetail(ref.id, stored);
  cache.set(ref.id, detail);
  return strip(detail);
}

export async function updateConnection(id: string, input: ConnectionInput): Promise<ConnectionDetail> {
  const current = await getStored(id);
  await assertUniqueName(input.name, id);
  if (input.password) await addSecretVersion(current.secretName, input.password);
  const patch = {
    name: input.name,
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    updatedAt: new Date(),
  };
  await getFirestore().collection(COLLECTION).doc(id).update(patch);
  cache.delete(id);
  return getConnection(id);
}

export async function deleteConnection(id: string): Promise<void> {
  const current = await getStored(id);
  await getFirestore().collection(COLLECTION).doc(id).delete();
  cache.delete(id);
  await deleteSecret(current.secretName);
}

/** Datos de la conexión para probarla en una edición: los nuevos, con la contraseña nueva o la guardada. */
export async function configForEdit(
  id: string,
  input: ConnectionInput,
): Promise<{ engine: DbEngine; config: EngineConnectionConfig }> {
  const current = await getStored(id);
  const password = input.password ?? (await getSecret(current.secretName));
  return {
    engine: current.engine,
    config: { host: input.host, port: input.port, database: input.database, user: input.user, password },
  };
}
