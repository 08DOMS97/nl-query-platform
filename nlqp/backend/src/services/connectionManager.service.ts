import pg from 'pg';
import mysql from 'mysql2/promise';
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
      requestTimeout: 15_000,
    }).connect();
  }
  return mssqlPoolPromise;
}

/** Ejecuta una consulta contra el motor indicado y normaliza el resultado. */
export async function runQuery(engine: DbEngine, sql: string): Promise<RawQueryResult> {
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
