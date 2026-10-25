/** Mirror manual de los tipos HTTP del backend (nlqp/backend/src/types/index.ts). */

export type DbEngine = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

export const DB_ENGINES: DbEngine[] = ['postgres', 'mysql', 'mariadb', 'mssql'];

/** Nombre de cada motor tal como se muestra en la interfaz. */
export const ENGINE_LABELS: Record<DbEngine, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  mssql: 'SQL Server',
};

/**
 * Conexión registrada (`GET /connections`, M1). El usuario no técnico recibe solo
 * id, nombre, motor y base; el técnico, además servidor, puerto, usuario y fechas.
 * La contraseña nunca sale del backend.
 */
export interface Connection {
  id: string;
  name: string;
  engine: DbEngine;
  database: string;
  host?: string;
  port?: number;
  user?: string;
  /** Tiempo máximo de ejecución, en segundos (solo lo recibe el rol técnico). */
  queryTimeoutSec?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Datos del formulario de conexión; en una edición `password` vacía conserva la actual. */
export interface ConnectionInput {
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  queryTimeoutSec: number;
}

/** Tiempo máximo de ejecución de una conexión: por defecto y límites (en segundos). */
export const DEFAULT_QUERY_TIMEOUT_SEC = 480;
export const MIN_QUERY_TIMEOUT_SEC = 10;
export const MAX_QUERY_TIMEOUT_SEC = 3600;

/** Puerto por defecto de cada motor, para precargar el formulario. */
export const DEFAULT_PORTS: Record<DbEngine, number> = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  mssql: 1433,
};

/** Rol del usuario (custom claim de Firebase que asigna el backend). */
export type UserRole = 'tecnico' | 'no_tecnico';

/** Usuario en la pantalla Usuarios (solo superadministrador). */
export interface ManagedUser {
  uid: string;
  email: string;
  /** `null`: cuenta sin rol asignado, sin acceso. */
  role: UserRole | null;
  superadmin: boolean;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface QuerySafetyResult {
  safe: boolean;
  reason?: string;
}

export interface GenerateSqlMetrics {
  tokensInput: number;
  tokensOutput: number;
  tokensThinking: number;
  tokensTotal: number;
  costUsd: number;
  latencyMs: number;
  tablesSent: number;
  tablesTotal: number;
  /** Tiempo por etapa en ms; `modelMs` es la espera al servicio del modelo. */
  stages?: { schemaMs: number; pruneMs: number; modelMs: number; checkMs: number };
}

export interface GenerateSqlResponse {
  sql: string;
  engine: DbEngine;
  connectionId: string;
  safety: QuerySafetyResult;
  metrics: GenerateSqlMetrics;
}

/**
 * Una página del resultado. El backend ejecuta la consulta una sola vez y guarda
 * el resultado completo; las demás páginas se piden con `/getResultPage` y el
 * total se descarga como CSV con `/createResultExport`.
 */
export interface ExecuteQueryResponse {
  resultId: string;
  columns: string[];
  /** Filas de esta página. */
  rows: Record<string, unknown>[];
  /** Total del resultado completo (igual a `totalRows`). */
  rowCount: number;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Una ejecución del historial automático (`GET /history`, M5). */
export interface HistoryEntry {
  id: string;
  question: string | null;
  connectionId: string;
  /** Nombre de la conexión al ejecutar (en entradas anteriores al 13/10, el motor). */
  connectionName: string;
  engine: DbEngine;
  sql: string;
  success: boolean;
  totalRows: number | null;
  errorReason: string | null;
  /** ISO 8601. */
  executedAt: string;
}

/** Una consulta que el usuario guardó con un nombre (`/savedQueries`, M5). */
export interface SavedQuery {
  id: string;
  name: string;
  question: string | null;
  connectionId: string;
  connectionName: string;
  engine: DbEngine;
  sql: string;
  /** ISO 8601. */
  savedAt: string;
}

/** Consulta que se reusa desde el historial o las guardadas: vuelve al formulario. */
export interface ReusedQuery {
  connectionId: string;
  connectionName: string;
  engine: DbEngine;
  question: string | null;
  sql: string;
}

/* --- Auditoría de ediciones del SQL (rol técnico) --- */

export type SqlEditOrigin = 'generada' | 'guardada';
export type SqlEditAction = 'ejecutada' | 'guardada';

export interface SqlDiffSegment {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

/** `removed` reemplazado por `added` (uno de los dos puede ser vacío). */
export interface SqlChange {
  removed: string;
  added: string;
}

/** Lo que se manda junto con el SQL cuando el técnico lo editó. */
export interface SqlEditInfo {
  origin: SqlEditOrigin | 'historial';
  originalSql?: string;
  savedQueryId?: string;
}

/** Un registro de la auditoría (`GET /sqlEdits`). */
export interface SqlEdit {
  id: string;
  email: string | null;
  connectionId: string;
  connectionName: string;
  engine: DbEngine;
  origin: SqlEditOrigin;
  savedQueryId: string | null;
  savedQueryName: string | null;
  originalSql: string;
  editedSql: string;
  segments: SqlDiffSegment[];
  changes: SqlChange[];
  actions: SqlEditAction[];
  createdAt: string;
  lastAt: string;
}

/* --- Módulo 4 (rol técnico) --- */

/** `connectionId`: las conexiones iniciales usan como id el nombre del motor. */
export interface TestConnectionResult {
  connectionId: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface PoolStatus {
  connectionId: string;
  engine: DbEngine;
  initialized: boolean;
  max: number;
  total: number;
  idle: number;
  inUse: number;
  waiting: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
  defaultValue?: string | null;
  allowedValues?: string[];
  indexed?: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes?: IndexInfo[];
}

export interface SchemaInfo {
  engine: DbEngine;
  database: string;
  tables: TableInfo[];
}

export type UsageOrigin = 'usuario' | 'evaluacion' | 'todos';

export interface UsageStats {
  periodDays: number;
  origin: UsageOrigin;
  totalCalls: number;
  totalCostUsd: number;
  callsByType: { generateSQL: number; executeQuery: number };
  callsByEngine: Record<DbEngine, number>;
  errorCount: number;
  generationTimes: {
    count: number;
    total: LatencySummary;
    stagesCount: number;
    model: LatencySummary | null;
    schema: LatencySummary | null;
  } | null;
}

export interface LatencySummary {
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}
