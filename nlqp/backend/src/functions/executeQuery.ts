import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { QueryTimeoutError } from '../services/connectionManager.service.js';
import { createResult, readPage, ResultTooLargeError } from '../services/resultStore.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { recordHistoryEntry } from '../services/queryHistory.service.js';
import { recordUsageEvent, USAGE_ORIGIN_HEADER, usageOriginFrom } from '../services/usageTracking.service.js';
import { DB_ENGINES, type DbEngine, type ExecuteQueryRequest } from '../types/index.js';

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

/**
 * POST /executeQuery  { engine, sql, question? }
 *   -> { resultId, columns, rows, rowCount, totalRows, page, pageSize, totalPages }
 *
 * Ejecuta la consulta UNA vez, guarda el resultado completo como snapshot (ver
 * `resultStore.service.ts`) y devuelve la primera página con el total de filas.
 * El resto se pide con `/getResultPage` o se descarga completo como CSV con
 * `/createResultExport`: ninguna fila se pierde ni se trunca. `rowCount` es el
 * total del resultado (igual que `totalRows`), no el de la página.
 *
 * Único punto de ejecución real de SQL contra las bases de datos. NUNCA debe
 * ejecutarse SQL aquí sin pasar antes por el Query Safety Engine (RF-07),
 * incluso si `sql` ya vino de `generateSQL` — la cuenta de BD de pruebas tiene
 * permisos amplios a propósito (ver INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §2).
 *
 * Cada ejecución (con éxito o con error) queda en el historial del usuario (M5,
 * `queryHistory.service.ts`), salvo las corridas de evaluación. Lo bloqueado por
 * el Query Safety Engine no llega a ejecutarse y no entra al historial.
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

  const uid = (req as Request & { uid?: string }).uid ?? null;
  const origin = usageOriginFrom(req.headers[USAGE_ORIGIN_HEADER]);
  const startedAt = Date.now();
  const question =
    typeof body.question === 'string' && body.question.trim() ? body.question.trim() : null;
  const engine = body.engine;
  const sql = body.sql;
  const recordHistory = async (outcome: { success: boolean; totalRows?: number; errorReason?: string }) => {
    if (!uid || origin === 'evaluacion') return;
    await recordHistoryEntry(uid, {
      question,
      engine,
      sql,
      success: outcome.success,
      totalRows: outcome.totalRows ?? null,
      errorReason: outcome.errorReason ?? null,
    });
  };

  try {
    const stored = await createResult(body.engine, body.sql, uid);
    const firstPage = await readPage(stored.id, uid, 1);
    await recordUsageEvent({
      type: 'executeQuery',
      engine: body.engine,
      uid,
      origin,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    await recordHistory({ success: true, totalRows: firstPage.totalRows });
    res.status(200).json({ ...firstPage, rowCount: firstPage.totalRows });
  } catch (err) {
    await recordUsageEvent({
      type: 'executeQuery',
      engine: body.engine,
      uid,
      origin,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorReason: err instanceof Error ? err.message : String(err),
    });
    await recordHistory({ success: false, errorReason: err instanceof Error ? err.message : String(err) });
    const status =
      err instanceof QueryTimeoutError ? 504 : err instanceof ResultTooLargeError ? 413 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('executeQuery', executeQueryHandler);
