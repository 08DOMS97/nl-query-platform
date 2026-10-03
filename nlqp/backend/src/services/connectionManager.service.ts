import pg from 'pg';
import Cursor from 'pg-cursor';
import mysql from 'mysql2/promise';
import type { Connection as MysqlCoreConnection } from 'mysql2';
import mssql from 'mssql';
import type { DbEngine, EngineConnectionConfig, TestConnectionResult } from '../types/index.js';
import { DB_ENGINES } from '../types/index.js';

const { Pool: PgPool } = pg;

/** Resultado uniforme de una consulta, sin importar el driver de origen. */
export interface RawQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

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

// Pools cacheados por motor — se crean una sola vez y se reutilizan (lazy singleton).
let pgPool: pg.Pool | undefined;
let mysqlPool: mysql.Pool | undefined;
let mariadbPool: mysql.Pool | undefined;
let mssqlPoolPromise: Promise<mssql.ConnectionPool> | undefined;

function getPgPool(): pg.Pool {
  if (!pgPool) {
    const cfg = readEngineConfig('postgres');
    pgPool = new PgPool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: QUERY_TIMEOUT_MS,
    });
  }
  return pgPool;
}

function getMysqlPool(): mysql.Pool {
  if (!mysqlPool) {
    const cfg = readEngineConfig('mysql');
    mysqlPool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      connectionLimit: 5,
      connectTimeout: 5_000,
    });
    // max_execution_time (ms) solo aplica a SELECT de solo lectura, que es lo único
    // que deja pasar el Query Safety Engine.
    mysqlPool.pool.on('connection', (conn) => {
      conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
    });
  }
  return mysqlPool;
}

function getMariadbPool(): mysql.Pool {
  if (!mariadbPool) {
    const cfg = readEngineConfig('mariadb');
    mariadbPool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      connectionLimit: 5,
      connectTimeout: 5_000,
    });
    // MariaDB no tiene max_execution_time: su equivalente es max_statement_time, en segundos.
    mariadbPool.pool.on('connection', (conn) => {
      conn.query(`SET SESSION max_statement_time = ${QUERY_TIMEOUT_MS / 1000}`);
    });
  }
  return mariadbPool;
}

async function getMssqlPool(): Promise<mssql.ConnectionPool> {
  if (!mssqlPoolPromise) {
    const cfg = readEngineConfig('mssql');
    mssqlPoolPromise = new mssql.ConnectionPool({
      server: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      pool: { max: 5, idleTimeoutMillis: 30_000 },
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
  return mssqlPoolPromise;
}

/** Ejecuta una consulta contra el motor indicado y normaliza el resultado. */
export async function runQuery(engine: DbEngine, sql: string): Promise<RawQueryResult> {
  try {
    return await runQueryOnDriver(engine, sql);
  } catch (err) {
    if (isTimeoutError(err)) throw new QueryTimeoutError(engine);
    throw err;
  }
}

async function runQueryOnDriver(engine: DbEngine, sql: string): Promise<RawQueryResult> {
  switch (engine) {
    case 'postgres': {
      const result = await getPgPool().query(sql);
      const columns = result.fields?.map((f) => f.name) ?? [];
      return { columns, rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    }
    case 'mysql': {
      const [rows, fields] = await getMysqlPool().query(sql);
      const rowsArray = rows as Record<string, unknown>[];
      const columns = (fields ?? []).map((f) => f.name);
      return { columns, rows: rowsArray, rowCount: rowsArray.length };
    }
    case 'mariadb': {
      const [rows, fields] = await getMariadbPool().query(sql);
      const rowsArray = rows as Record<string, unknown>[];
      const columns = (fields ?? []).map((f) => f.name);
      return { columns, rows: rowsArray, rowCount: rowsArray.length };
    }
    case 'mssql': {
      const pool = await getMssqlPool();
      const result = await pool.request().query(sql);
      const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : [];
      return { columns, rows: result.recordset ?? [], rowCount: result.recordset?.length ?? 0 };
    }
    default: {
      const exhaustive: never = engine;
      throw new Error(`Motor no soportado: ${exhaustive}`);
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
  engine: DbEngine,
  sql: string,
  handlers: StreamHandlers,
): Promise<{ rowCount: number }> {
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
    switch (engine) {
      case 'postgres':
        await streamPostgres(sql, handlers.onColumns, onRow);
        break;
      case 'mysql':
        await streamMysqlFamily(getMysqlPool(), sql, handlers.onColumns, onRow);
        break;
      case 'mariadb':
        await streamMysqlFamily(getMariadbPool(), sql, handlers.onColumns, onRow);
        break;
      case 'mssql':
        await streamMssql(sql, handlers.onColumns, onRow);
        break;
      default: {
        const exhaustive: never = engine;
        throw new Error(`Motor no soportado: ${exhaustive}`);
      }
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

async function streamPostgres(sql: string, onColumns: (c: string[]) => void, onRow: RowFn) {
  const client = await getPgPool().connect();
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

async function streamMssql(sql: string, onColumns: (c: string[]) => void, onRow: RowFn) {
  const pool = await getMssqlPool();
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

/** Verifica conectividad de un motor con una consulta trivial y mide latencia. */
export async function testConnection(engine: DbEngine): Promise<TestConnectionResult> {
  const start = Date.now();
  try {
    await runQuery(engine, 'SELECT 1 AS ok');
    return { engine, ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { engine, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verifica conectividad de los 4 motores en paralelo. */
export async function testAllConnections(): Promise<TestConnectionResult[]> {
  return Promise.all(DB_ENGINES.map((engine) => testConnection(engine)));
}

/** Cierra todos los pools abiertos. Uso: tests y apagado ordenado del proceso. */
export async function closeAllPools(): Promise<void> {
  await Promise.all([
    pgPool?.end(),
    mysqlPool?.end(),
    mariadbPool?.end(),
    mssqlPoolPromise?.then((p) => p.close()),
  ]);
  pgPool = undefined;
  mysqlPool = undefined;
  mariadbPool = undefined;
  mssqlPoolPromise = undefined;
}
