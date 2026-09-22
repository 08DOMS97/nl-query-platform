import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { runQuery } from '../services/connectionManager.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { DB_ENGINES, type DbEngine, type ExecuteQueryRequest } from '../types/index.js';

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

/**
 * POST /executeQuery  { engine, sql } -> { columns, rows, rowCount }
 *
 * Único punto de ejecución real de SQL contra las bases de datos. NUNCA debe
 * ejecutarse SQL aquí sin pasar antes por el Query Safety Engine (RF-07),
 * incluso si `sql` ya vino de `generateSQL` — la cuenta de BD de pruebas tiene
 * permisos amplios a propósito (ver INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §2).
 */
export const executeQueryHandler = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ExecuteQueryRequest>;

  if (!isDbEngine(body.engine)) {
    res.status(400).json({ error: `Campo "engine" inválido. Válidos: ${DB_ENGINES.join(', ')}.` });
    return;
  }
  if (!body.sql || !body.sql.trim()) {
    res.status(400).json({ error: 'Campo "sql" es requerido.' });
    return;
  }

  const safety = validateQuerySafety(body.sql);
  if (!safety.safe) {
    res.status(403).json({ error: 'Query Safety Engine bloqueó la consulta.', reason: safety.reason });
    return;
  }

  try {
    const result = await runQuery(body.engine, body.sql);
    res.status(200).json({ columns: result.columns, rows: result.rows, rowCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('executeQuery', executeQueryHandler);
