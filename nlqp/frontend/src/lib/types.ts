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
  engine: DbEngine;
  sql: string;
  /** ISO 8601. */
  savedAt: string;
}

/** Consulta que se reusa desde el historial o las guardadas: vuelve al formulario. */
export interface ReusedQuery {
  engine: DbEngine;
  question: string | null;
  sql: string;
}
