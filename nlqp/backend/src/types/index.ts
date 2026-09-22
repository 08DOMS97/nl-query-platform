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

export interface GenerateSqlResponse {
  sql: string;
  engine: DbEngine;
}

export interface ExecuteQueryRequest {
  engine: DbEngine;
  sql: string;
}

export interface ExecuteQueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}
