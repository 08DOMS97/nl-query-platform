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

/**
 * Tiempo máximo de ejecución de cada conexión, en segundos. Lo fija el técnico al
 * registrarla o editarla; las conexiones sin valor propio usan el de defecto
 * (`NLQP_QUERY_TIMEOUT_MS`, 8 minutos: el tiempo que la tesis acepta para reportes
 * complejos, RNF-01). Siempre hay un tope: sin él, una consulta descontrolada
 * ocuparía la base indefinidamente.
 */
export const DEFAULT_QUERY_TIMEOUT_SEC = Math.round(Number(process.env.NLQP_QUERY_TIMEOUT_MS ?? 480_000) / 1000);
export const MIN_QUERY_TIMEOUT_SEC = 10;
export const MAX_QUERY_TIMEOUT_SEC = 3600;

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
  /** Ausente en las conexiones registradas antes del 19/10/2026: usan el de defecto. */
  queryTimeoutSec?: number;
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
    queryTimeoutSec: data.queryTimeoutSec ?? DEFAULT_QUERY_TIMEOUT_SEC,
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
): Promise<{ engine: DbEngine; config: EngineConnectionConfig; timeoutMs: number }> {
  const c = await getStored(id);
  const password = await getSecret(c.secretName);
  return {
    engine: c.engine,
    config: { host: c.host, port: c.port, database: c.database, user: c.user, password },
    timeoutMs: c.queryTimeoutSec * 1000,
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
  let queryTimeoutSec: number | undefined;
  if (b.queryTimeoutSec !== undefined && b.queryTimeoutSec !== null && b.queryTimeoutSec !== '') {
    queryTimeoutSec = Number(b.queryTimeoutSec);
    if (
      !Number.isInteger(queryTimeoutSec) ||
      queryTimeoutSec < MIN_QUERY_TIMEOUT_SEC ||
      queryTimeoutSec > MAX_QUERY_TIMEOUT_SEC
    ) {
      throw new ConnectionValidationError(
        `El tiempo máximo de ejecución debe ser un número entero de segundos entre ${MIN_QUERY_TIMEOUT_SEC} y ${MAX_QUERY_TIMEOUT_SEC} (1 hora).`,
      );
    }
  }
  return {
    // Espacios repetidos dentro del nombre se reducen a uno («Ventas  A» = «Ventas A»).
    name: text(b.name, 'name', 80).replace(/\s+/g, ' '),
    engine: engine as DbEngine,
    host: text(b.host, 'host', 255),
    port,
    database: text(b.database, 'database', 128),
    user: text(b.user, 'user', 128),
    password,
    queryTimeoutSec,
  };
}

/**
 * Las conexiones son compartidas por todos los usuarios, así que el nombre es único en
 * todo el sistema, sin distinguir mayúsculas ni espacios repetidos. `exceptId`: la
 * conexión que se edita (puede conservar su propio nombre).
 */
export async function assertUniqueName(name: string, exceptId?: string): Promise<void> {
  const key = (n: string) => n.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  const all = await listConnections();
  if (all.some((c) => c.id !== exceptId && key(c.name) === key(name))) {
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
    queryTimeoutSec: input.queryTimeoutSec ?? DEFAULT_QUERY_TIMEOUT_SEC,
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
    ...(input.queryTimeoutSec !== undefined ? { queryTimeoutSec: input.queryTimeoutSec } : {}),
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

/**
 * Datos de la conexión para probarla en una edición: los nuevos, con la contraseña nueva o
 * la guardada. La guardada solo se reutiliza con el mismo servidor, puerto y usuario: si no,
 * se podría mandar a un servidor cualquiera y leerla ahí (auditoría del 24/10).
 */
export async function configForEdit(
  id: string,
  input: ConnectionInput,
): Promise<{ engine: DbEngine; config: EngineConnectionConfig }> {
  const current = await getStored(id);
  const sameServer = input.host === current.host && input.port === current.port && input.user === current.user;
  if (!input.password && !sameServer) {
    throw new ConnectionValidationError('Para cambiar el servidor, el puerto o el usuario, escriba la contraseña de nuevo.');
  }
  const password = input.password ?? (await getSecret(current.secretName));
  return {
    engine: current.engine,
    config: { host: input.host, port: input.port, database: input.database, user: input.user, password },
  };
}
