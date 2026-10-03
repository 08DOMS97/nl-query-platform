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

export interface TestConnectionResult {
  engine: DbEngine;
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
}

/** Tabla normalizada, independiente del motor de origen. */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
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
  engine: DbEngine;
  naturalLanguageQuery: string;
}

/** Consumo de una llamada a `/generateSQL` (el mismo que se registra en `usageEvents`). */
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
}

export interface GenerateSqlResponse {
  sql: string;
  engine: DbEngine;
  safety: QuerySafetyResult;
  metrics: GenerateSqlMetrics;
}

export interface ExecuteQueryRequest {
  engine: DbEngine;
  sql: string;
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
  totalCalls: number;
  totalCostUsd: number;
  callsByType: { generateSQL: number; executeQuery: number };
  callsByEngine: Record<DbEngine, number>;
  errorCount: number;
}
