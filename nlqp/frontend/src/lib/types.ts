/** Mirror manual de los tipos HTTP del backend (nlqp/backend/src/types/index.ts). */

export type DbEngine = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

export const DB_ENGINES: DbEngine[] = ['postgres', 'mysql', 'mariadb', 'mssql'];

export interface QuerySafetyResult {
  safe: boolean;
  reason?: string;
}

export interface GenerateSqlResponse {
  sql: string;
  engine: DbEngine;
  safety: QuerySafetyResult;
}

export interface ExecuteQueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}
