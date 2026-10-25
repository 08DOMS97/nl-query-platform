/** Motores de base de datos soportados por NLQP. */
export type DbEngine = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

export const DB_ENGINES: DbEngine[] = ['postgres', 'mysql', 'mariadb', 'mssql'];

export interface EngineConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** Conexión tal como la ve cualquier usuario: nombre, motor y base, sin datos de acceso. */
export interface ConnectionSummary {
  id: string;
  name: string;
  engine: DbEngine;
  database: string;
}

/** Conexión completa para el rol técnico. La contraseña nunca sale del backend. */
export interface ConnectionDetail extends ConnectionSummary {
  host: string;
  port: number;
  user: string;
  /** Tiempo máximo de ejecución de una consulta en esta conexión, en segundos. */
  queryTimeoutSec: number;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string;
}

/**
 * Datos para crear o editar una conexión; en una edición `password` puede omitirse.
 * Sin `queryTimeoutSec`, una conexión nueva usa el tope por defecto y una edición
 * conserva el actual.
 */
export interface ConnectionInput {
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  queryTimeoutSec?: number;
}

export interface TestConnectionResult {
  connectionId: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Columna normalizada, independiente del motor de origen. */
export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
  defaultValue?: string | null;
  /**
   * Valores permitidos, si la columna tiene un CHECK de tipo enumeración
   * (`status IN ('ACTIVE', 'INACTIVE')`). Se pasan al modelo para que no tenga
   * que adivinar los literales exactos de las columnas categóricas.
   */
  allowedValues?: string[];
  /**
   * Es la primera columna de algún índice (sin contar la PK, que ya va marcada).
   * Un filtro o JOIN sobre ella puede usar el índice si no se le aplica una función.
   */
  indexed?: boolean;
}

/** Índice de una tabla, con sus columnas en orden. */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

/** Tabla normalizada, independiente del motor de origen. */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  /** Índices secundarios (sin la PK). */
  indexes?: IndexInfo[];
}

export interface ForeignKeyInfo {
  table: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

/** Esquema completo normalizado de una base de datos, ya sin diferencias de dialecto. */
export interface SchemaInfo {
  engine: DbEngine;
  database: string;
  tables: TableInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface QuerySafetyResult {
  safe: boolean;
  reason?: string;
}

export interface GenerateSqlRequest {
  /** Conexión en la que se va a consultar. */
  connectionId?: string;
  /** Alias anterior: el id de las conexiones iniciales es el nombre del motor. */
  engine?: string;
  naturalLanguageQuery: string;
}

/** Consumo de una llamada a `/generateSQL` (el mismo que se registra en `usageEvents`). */
/**
 * Tiempo de cada etapa de una generación, en ms (24/10). `schemaMs` incluye abrir la
 * conexión si es la primera; `modelMs` es la llamada al modelo (servicio externo);
 * `checkMs`, la validación y los controles del SQL generado.
 */
export interface GenerationStages {
  schemaMs: number;
  pruneMs: number;
  modelMs: number;
  checkMs: number;
}

/** Mediana, percentil 95 y máximo de una serie de tiempos, en ms. */
export interface LatencySummary {
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface GenerateSqlMetrics {
  tokensInput: number;
  tokensOutput: number;
  tokensThinking: number;
  tokensTotal: number;
  costUsd: number;
  latencyMs: number;
  /** Tablas enviadas al modelo tras el pruning, frente al total del esquema. */
  tablesSent: number;
  tablesTotal: number;
  stages?: GenerationStages;
}

export interface GenerateSqlResponse {
  sql: string;
  engine: DbEngine;
  safety: QuerySafetyResult;
  metrics: GenerateSqlMetrics;
}

/* --- Auditoría de ediciones del SQL (rol técnico) --- */

/** De dónde venía la sentencia que el técnico editó. */
export type SqlEditOrigin = 'generada' | 'guardada';
export type SqlEditAction = 'ejecutada' | 'guardada';

export interface SqlDiffSegment {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

/** Un cambio legible: `removed` reemplazado por `added` (uno de los dos puede ser vacío). */
export interface SqlChange {
  removed: string;
  added: string;
}

/**
 * Datos de una edición que acompañan a `/executeQuery` o `/savedQueries`. En una
 * guardada, la sentencia original la toma el backend de la consulta guardada.
 */
export interface SqlEditInfo {
  /** `historial`: la interfaz no deja editarla; si llega editada, se rechaza (409). */
  origin: SqlEditOrigin | 'historial';
  /** Sentencia antes de editarla (`generada`; en `historial`, para comprobar que no cambió). */
  originalSql?: string;
  /** Consulta guardada que se editó (solo `origin: 'guardada'`). */
  savedQueryId?: string;
}

/** Un registro de la auditoría (`GET /sqlEdits`, solo rol técnico). */
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
  /** ISO 8601: primera vez que se ejecutó o guardó la edición. */
  createdAt: string;
  /** ISO 8601: última vez. */
  lastAt: string;
}

export interface ExecuteQueryRequest {
  connectionId?: string;
  /** Alias anterior (ver `GenerateSqlRequest.engine`). */
  engine?: string;
  sql: string;
  /** Pregunta en español que originó el SQL; opcional, solo para el historial (M5). */
  question?: string;
  /** Solo si el técnico editó la sentencia: para la auditoría. */
  edit?: SqlEditInfo;
}

/** Una ejecución del historial automático (`GET /history`, M5). */
export interface HistoryEntry {
  id: string;
  question: string | null;
  connectionId: string;
  /** Nombre de la conexión al momento de ejecutar (por si después se renombra o elimina). */
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

/** Una página del resultado de una consulta (`/executeQuery` devuelve la primera). */
export interface ExecuteQueryResponse {
  resultId: string;
  columns: string[];
  /** Filas de esta página. */
  rows: Record<string, unknown>[];
  /** Total de filas del resultado completo (igual a `totalRows`). */
  rowCount: number;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Respuesta agregada del módulo de uso y costos (`GET /getUsageStats`). */
export interface GetUsageStatsResponse {
  periodDays: number;
  /** Qué eventos se contaron: uso normal, corridas de evaluación o todos. */
  origin: 'usuario' | 'evaluacion' | 'todos';
  totalCalls: number;
  totalCostUsd: number;
  callsByType: { generateSQL: number; executeQuery: number };
  callsByEngine: Record<DbEngine, number>;
  errorCount: number;
  /**
   * Tiempos de las generaciones exitosas del período (24/10). `model` y `schema` cuentan
   * solo las que registraron etapas (desde el 24/10). `null` si no hubo ninguna.
   */
  generationTimes: {
    count: number;
    total: LatencySummary;
    stagesCount: number;
    model: LatencySummary | null;
    schema: LatencySummary | null;
  } | null;
}

/** Estado del pool de conexiones de un motor (`GET /poolStatus`, solo rol técnico). */
export interface PoolStatus {
  connectionId: string;
  engine: DbEngine;
  /** `false` si el motor todavía no se usó y su pool no existe. */
  initialized: boolean;
  /** Máximo de conexiones del pool. */
  max: number;
  /** Conexiones abiertas (libres + en uso). */
  total: number;
  idle: number;
  inUse: number;
  /** Pedidos esperando una conexión libre. */
  waiting: number;
}

/**
 * Rol del usuario (sección 4.2). Lo asigna solo el backend como custom claim de
 * Firebase (`scripts/set_role.mjs`); sin claim, el usuario es no técnico.
 */
export type UserRole = 'tecnico' | 'no_tecnico';

/** Usuario tal como lo ve el superadministrador (gestión de usuarios). */
export interface ManagedUser {
  uid: string;
  email: string;
  /** `null`: cuenta sin rol asignado, sin acceso. */
  role: UserRole | null;
  superadmin: boolean;
  disabled: boolean;
  /** ISO 8601. */
  createdAt: string;
  lastSignInAt: string | null;
}
