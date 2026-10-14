import pg from 'pg';
import Cursor from 'pg-cursor';
import mysql from 'mysql2/promise';
import type { Connection as MysqlCoreConnection } from 'mysql2';
import mssql from 'mssql';
import type { DbEngine, EngineConnectionConfig, PoolStatus, TestConnectionResult } from '../types/index.js';
import { listConnections, resolveConnectionConfig } from './connectionStore.service.js';

const { Pool: PgPool } = pg;

// DATE no tiene hora ni zona: `pg` lo convierte a medianoche en la hora local del
// servidor de NLQP (en Guatemala, 06:00 UTC), distinto de los otros 3 motores.
// Se lee como medianoche UTC, igual que mysql2 (timezone 'Z') y mssql.
const PG_DATE_OID = 1082;
pg.types.setTypeParser(PG_DATE_OID, (value: string) => new Date(`${value}T00:00:00Z`));

/** Resultado uniforme de una consulta, sin importar el driver de origen. */
export interface RawQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Datos de conexión del `.env` (`DB_POSTGRES_*`, etc.). Solo los usa
 * `scripts/seed_connections.mjs` para cargar las conexiones iniciales: en ejecución,
 * las conexiones salen del registro (`connectionStore.service.ts`).
 */
export function readEngineConfig(engine: DbEngine): EngineConnectionConfig {
  const prefix: Record<DbEngine, string> = {
    postgres: 'DB_POSTGRES',
    mysql: 'DB_MYSQL',
    mariadb: 'DB_MARIADB',
    mssql: 'DB_MSSQL',
  };
  const p = prefix[engine];
  const host = process.env[`${p}_HOST`];
  const port = process.env[`${p}_PORT`];
  const database = process.env[`${p}_DATABASE`];
  const user = process.env[`${p}_USER`];
  const password = process.env[`${p}_PASSWORD`];

  if (!host || !port || !database || !user || password === undefined) {
    throw new Error(
      `Configuración incompleta para el motor "${engine}". Revisar variables ${p}_* en .env`,
    );
  }

  return { host, port: Number(port), database, user, password };
}

/**
 * Tiempo máximo de ejecución de una consulta. Se aplica DEL LADO DEL SERVIDOR en
 * los 4 motores: al vencer, el propio motor cancela la sentencia y libera sus
 * recursos (no basta con que el cliente deje de esperar mientras la consulta
 * sigue consumiendo la base). Es todo o nada: una consulta cancelada devuelve
 * error, nunca un resultado parcial.
 */
export const QUERY_TIMEOUT_MS = Number(process.env.NLQP_QUERY_TIMEOUT_MS ?? 60_000);

/** La consulta superó `QUERY_TIMEOUT_MS` y el motor la canceló. */
export class QueryTimeoutError extends Error {
  constructor(engine: DbEngine) {
    super(
      `La consulta superó el tiempo máximo de ${QUERY_TIMEOUT_MS / 1000} s y ${engine} la canceló. ` +
        'Intenta acotarla (por ejemplo, a un rango de fechas).',
    );
    this.name = 'QueryTimeoutError';
  }
}

/** Reconoce el error de cancelación por tiempo de cada driver. */
function isTimeoutError(err: unknown): boolean {
  const e = err as { code?: unknown; errno?: unknown };
  return (
    e?.code === '57014' || // postgres: query_canceled (statement_timeout)
    e?.errno === 3024 || // mysql: ER_QUERY_TIMEOUT (max_execution_time)
    e?.errno === 1969 || // mariadb: ER_STATEMENT_TIMEOUT (max_statement_time)
    e?.code === 'ETIMEOUT' // mssql: requestTimeout (el driver envía ATTENTION al servidor)
  );
}

// Un pool por conexión: se abre la primera vez que se usa la conexión (y recién ahí
// se lee su contraseña de Secret Manager) y se reutiliza después. Editar o eliminar
// la conexión lo cierra.
const POOL_MAX = 5;

type PoolHandle =
  | { engine: 'postgres'; pool: pg.Pool }
  | { engine: 'mysql' | 'mariadb'; pool: mysql.Pool }
  | { engine: 'mssql'; pool: mssql.ConnectionPool };

const pools = new Map<string, Promise<PoolHandle>>();
/** Pools ya abiertos, para `getPoolStatus` (que no espera ni abre ninguno). */
const readyPools = new Map<string, PoolHandle>();

function createPgPool(cfg: EngineConnectionConfig): pg.Pool {
  return new PgPool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: QUERY_TIMEOUT_MS,
  });
}

function createMysqlFamilyPool(engine: 'mysql' | 'mariadb', cfg: EngineConnectionConfig): mysql.Pool {
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectionLimit: POOL_MAX,
    connectTimeout: 5_000,
    // DATETIME no guarda zona: sin esto mysql2 lo interpreta en la hora local del
    // servidor de NLQP y lo corre (en Guatemala, +6 h), así que el mismo pedido
    // salía con otra hora que en Postgres y SQL Server. Se lee como UTC, igual que
    // los otros motores.
    timezone: 'Z',
  });
  pool.pool.on('connection', (conn) => {
    // MySQL: max_execution_time (ms), solo aplica a SELECT de solo lectura, que es lo
    // único que deja pasar el Query Safety Engine. MariaDB no lo tiene: su
    // equivalente es max_statement_time, en segundos.
    conn.query(
      engine === 'mysql'
        ? `SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`
        : `SET SESSION max_statement_time = ${QUERY_TIMEOUT_MS / 1000}`,
    );
  });
  return pool;
}

function createMssqlPool(cfg: EngineConnectionConfig): Promise<mssql.ConnectionPool> {
  return new mssql.ConnectionPool({
    server: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    pool: { max: POOL_MAX, idleTimeoutMillis: 30_000 },
    // trustServerCertificate=true desactiva la validación del certificado TLS (acepta
    // cualquier certificado, incluido uno falsificado — riesgo de MITM). Necesario en
    // local porque el contenedor de pruebas usa un certificado autofirmado (ver README
    // de "Bases de datos"), pero NUNCA debe quedar así contra un SQL Server real en
    // producción. Se controla por env var (default seguro: false) para que no se
    // arrastre por accidente al desplegar.
    options: {
      encrypt: true,
      trustServerCertificate: process.env.DB_MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
    },
    connectionTimeout: 5_000,
    requestTimeout: QUERY_TIMEOUT_MS,
  }).connect();
}

async function openPool(engine: DbEngine, cfg: EngineConnectionConfig): Promise<PoolHandle> {
  switch (engine) {
    case 'postgres':
      return { engine, pool: createPgPool(cfg) };
    case 'mysql':
    case 'mariadb':
      return { engine, pool: createMysqlFamilyPool(engine, cfg) };
    case 'mssql':
      return { engine, pool: await createMssqlPool(cfg) };
    default: {
      const exhaustive: never = engine;
      throw new Error(`Motor no soportado: ${exhaustive}`);
    }
  }
}

async function closeHandle(h: PoolHandle): Promise<void> {
  if (h.engine === 'mssql') await h.pool.close();
  else await h.pool.end();
}

function getPool(connectionId: string): Promise<PoolHandle> {
  let pending = pools.get(connectionId);
  if (!pending) {
    pending = resolveConnectionConfig(connectionId).then(({ engine, config }) => openPool(engine, config));
    pools.set(connectionId, pending);
    pending.then(
      (h) => readyPools.set(connectionId, h),
      // Si no se pudo abrir (p. ej. SQL Server caído), el próximo uso lo reintenta.
      () => pools.delete(connectionId),
    );
  }
  return pending;
}

/** Cierra el pool de una conexión (al editarla o eliminarla). */
export async function closePool(connectionId: string): Promise<void> {
  const pending = pools.get(connectionId);
  pools.delete(connectionId);
  readyPools.delete(connectionId);
  const h = await pending?.catch(() => undefined);
  if (h) await closeHandle(h).catch(() => undefined);
}

/** Ejecuta una consulta en la conexión indicada y normaliza el resultado. */
export async function runQuery(connectionId: string, sql: string): Promise<RawQueryResult> {
  return runQueryOnPool(await getPool(connectionId), sql);
}

async function runQueryOnPool(h: PoolHandle, sql: string): Promise<RawQueryResult> {
  try {
    return await runQueryOnDriver(h, sql);
  } catch (err) {
    if (isTimeoutError(err)) throw new QueryTimeoutError(h.engine);
    throw err;
  }
}

async function runQueryOnDriver(h: PoolHandle, sql: string): Promise<RawQueryResult> {
  switch (h.engine) {
    case 'postgres': {
      const result = await h.pool.query(sql);
      const columns = result.fields?.map((f) => f.name) ?? [];
      return { columns, rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    }
    case 'mysql':
    case 'mariadb': {
      const [rows, fields] = await h.pool.query(sql);
      const rowsArray = rows as Record<string, unknown>[];
      const columns = (fields ?? []).map((f) => f.name);
      return { columns, rows: rowsArray, rowCount: rowsArray.length };
    }
    case 'mssql': {
      const result = await h.pool.request().query(sql);
      const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : [];
      return { columns, rows: result.recordset ?? [], rowCount: result.recordset?.length ?? 0 };
    }
  }
}

export interface StreamHandlers {
  onColumns(columns: string[]): void;
  /**
   * Recibe cada fila. Si devuelve una promesa, la lectura se pausa hasta que se
   * resuelva (contrapresión: un consumidor lento, como una descarga, no obliga
   * a acumular el resultado en memoria). Si lanza, la consulta se cancela.
   */
  onRow(row: Record<string, unknown>): void | Promise<void>;
}

/** Filas por lote al leer con cursor en Postgres (menos lotes = menos idas y vueltas). */
const PG_CURSOR_BATCH = 2000;

/**
 * Ejecuta una consulta entregando las filas una a una, sin cargar el resultado
 * completo en memoria. Además del timeout del motor (que en un cursor aplica a
 * cada lote), se exige un plazo total de QUERY_TIMEOUT_MS desde el inicio: si
 * se vence, o si `onRow` lanza, la consulta se cancela en el motor y la promesa
 * se rechaza — nunca se resuelve con un resultado a medias.
 */
export async function streamQuery(
  connectionId: string,
  sql: string,
  handlers: StreamHandlers,
): Promise<{ rowCount: number }> {
  const h = await getPool(connectionId);
  const engine = h.engine;
  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  let rowCount = 0;
  // Solo devuelve promesa si el consumidor pidió pausa: esperar en cada fila
  // (cientos de miles) cuesta más que leerlas.
  const onRow: RowFn = (row) => {
    if (Date.now() > deadline) throw new QueryTimeoutError(engine);
    rowCount++;
    return handlers.onRow(row);
  };

  try {
    switch (h.engine) {
      case 'postgres':
        await streamPostgres(h.pool, sql, handlers.onColumns, onRow);
        break;
      case 'mysql':
      case 'mariadb':
        await streamMysqlFamily(h.pool, sql, handlers.onColumns, onRow);
        break;
      case 'mssql':
        await streamMssql(h.pool, sql, handlers.onColumns, onRow);
        break;
    }
  } catch (err) {
    if (isTimeoutError(err)) throw new QueryTimeoutError(engine);
    throw err;
  }
  return { rowCount };
}

type RowFn = (row: Record<string, unknown>) => void | Promise<void>;

/** Llama a `onRow` convirtiendo una excepción síncrona en promesa rechazada. */
function callRow(onRow: RowFn, row: Record<string, unknown>): Promise<void> | void {
  try {
    return onRow(row);
  } catch (err) {
    return Promise.reject(err);
  }
}

async function streamPostgres(pool: pg.Pool, sql: string, onColumns: (c: string[]) => void, onRow: RowFn) {
  const client = await pool.connect();
  const cursor = client.query(new Cursor(sql));
  let failed = false;
  try {
    let first = true;
    for (;;) {
      const rows = await cursor.read(PG_CURSOR_BATCH);
      if (first) {
        // `_result.fields` es la descripción de columnas que pg-cursor guarda al
        // recibir RowDescription; está disponible incluso si no hay filas.
        const fields = (cursor as unknown as { _result?: { fields?: { name: string }[] } })._result
          ?.fields;
        onColumns((fields ?? []).map((f) => f.name));
        first = false;
      }
      if (rows.length === 0) break;
      for (const row of rows) {
        const wait = onRow(row);
        if (wait) await wait;
      }
    }
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    await cursor.close().catch(() => undefined);
    // Tras un error la conexión puede quedar en un estado inconsistente: se descarta.
    client.release(failed);
  }
}

async function streamMysqlFamily(
  pool: mysql.Pool,
  sql: string,
  onColumns: (c: string[]) => void,
  onRow: RowFn,
) {
  const conn = await pool.getConnection();
  // API de eventos del driver base (con pause()/resume()); los tipos de
  // mysql2/promise la declaran como la conexión con promesas.
  const raw = (conn as unknown as { connection: MysqlCoreConnection }).connection;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let pending: Promise<void> = Promise.resolve();
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        // Destruir el socket corta la consulta en el servidor: al no poder enviar
        // más filas, el motor la aborta. La conexión no vuelve al pool.
        raw.destroy();
        reject(err);
      };
      raw
        .query(sql)
        .on('fields', (fields: { name: string }[]) => onColumns((fields ?? []).map((f) => f.name)))
        .on('result', (row: Record<string, unknown>) => {
          const wait = callRow(onRow, row);
          if (!wait) return;
          raw.pause();
          pending = wait.then(() => {
            if (!settled) raw.resume();
          }, fail);
        })
        .on('error', fail)
        .on('end', () => {
          pending.then(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          }, fail);
        });
    });
  } finally {
    // Si se destruyó, release() simplemente la descarta del pool.
    conn.release();
  }
}

async function streamMssql(pool: mssql.ConnectionPool, sql: string, onColumns: (c: string[]) => void, onRow: RowFn) {
  const request = pool.request();
  request.stream = true;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let pending: Promise<void> = Promise.resolve();
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      request.cancel(); // envía ATTENTION: el servidor aborta la sentencia.
      reject(err);
    };
    request.on('recordset', (columns: Record<string, unknown>) => onColumns(Object.keys(columns)));
    request.on('row', (row: Record<string, unknown>) => {
      const wait = callRow(onRow, row);
      if (!wait) return;
      request.pause();
      pending = wait.then(() => {
        if (!settled) request.resume();
      }, fail);
    });
    request.on('error', fail);
    request.on('done', () => {
      pending.then(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, fail);
    });
    request.query(sql);
  });
}

/** Verifica una conexión registrada con una consulta trivial y mide la latencia. */
export async function testConnection(connectionId: string): Promise<TestConnectionResult> {
  const start = Date.now();
  try {
    await runQuery(connectionId, 'SELECT 1 AS ok');
    return { connectionId, ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connectionId, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verifica todas las conexiones registradas en paralelo. */
export async function testAllConnections(): Promise<TestConnectionResult[]> {
  const connections = await listConnections();
  return Promise.all(connections.map((c) => testConnection(c.id)));
}

/**
 * Prueba datos de conexión que todavía no se guardaron (alta o edición): abre un
 * pool temporal, ejecuta `SELECT 1` y lo cierra. No toca el registro ni Secret Manager.
 */
export async function testConnectionConfig(
  engine: DbEngine,
  config: EngineConnectionConfig,
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  let h: PoolHandle | undefined;
  try {
    h = await openPool(engine, config);
    await runQueryOnPool(h, 'SELECT 1 AS ok');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (h) await closeHandle(h).catch(() => undefined);
  }
}

/** Cierra todos los pools abiertos. Uso: tests y apagado ordenado del proceso. */
export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.keys()].map((id) => closePool(id)));
}

/**
 * Estado del pool de cada conexión registrada (pantalla de Conexiones, solo rol
 * técnico). No abre pools: una conexión que todavía no se usó aparece sin iniciar.
 */
export async function getPoolStatus(): Promise<PoolStatus[]> {
  const connections = await listConnections();
  return connections.map((c) => {
    const h = readyPools.get(c.id);
    const base = { connectionId: c.id, engine: c.engine, max: POOL_MAX };
    if (!h) return { ...base, initialized: false, total: 0, idle: 0, inUse: 0, waiting: 0 };
    if (h.engine === 'postgres') {
      const p = h.pool;
      return { ...base, initialized: true, total: p.totalCount, idle: p.idleCount, inUse: p.totalCount - p.idleCount, waiting: p.waitingCount };
    }
    if (h.engine === 'mssql') {
      const p = h.pool;
      return { ...base, initialized: true, total: p.size, idle: p.available, inUse: p.borrowed, waiting: p.pending };
    }
    // mysql2 no expone contadores públicos: se leen las colas internas del pool.
    const core = h.pool.pool as unknown as {
      _allConnections: { length: number };
      _freeConnections: { length: number };
      _connectionQueue: { length: number };
    };
    const total = core._allConnections.length;
    const idle = core._freeConnections.length;
    return { ...base, initialized: true, total, idle, inUse: total - idle, waiting: core._connectionQueue.length };
  });
}
