import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { QueryTimeoutError, ResultShapeError } from '../services/connectionManager.service.js';
import { createResult, readPage, ResultTooLargeError } from '../services/resultStore.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { recordHistoryEntry } from '../services/queryHistory.service.js';
import { recordUsageEvent, USAGE_ORIGIN_HEADER, usageOriginFrom } from '../services/usageTracking.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import { recordSqlEdit, resolveEdit, SqlEditError, type ResolvedEdit } from '../services/sqlEditAudit.service.js';
import type { AuthedRequest } from '../middleware/auth.middleware.js';
import type { ConnectionDetail, ExecuteQueryRequest } from '../types/index.js';
import { handleConnectionError } from './connectionErrors.js';

/**
 * POST /executeQuery  { connectionId, sql, question? }   (`engine` como alias de `connectionId`)
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
 * Si el técnico editó la sentencia, `edit` dice de dónde venía y la edición queda en
 * la auditoría (`sqlEditAudit.service.ts`) antes de ejecutarla. Una consulta del
 * historial no se puede editar (409): primero se guarda.
 *
 * Cada ejecución (con éxito o con error) queda en el historial del usuario (M5,
 * `queryHistory.service.ts`), salvo las corridas de evaluación. Lo bloqueado por
 * el Query Safety Engine no llega a ejecutarse y no entra al historial.
 */
export const executeQueryHandler = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<ExecuteQueryRequest>;

  let connection: ConnectionDetail;
  try {
    connection = await connectionFromRequest(body);
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  if (typeof body.sql !== 'string' || !body.sql.trim()) {
    res.status(400).json({ error: 'Campo "sql" es requerido.' });
    return;
  }

  const safety = validateQuerySafety(body.sql);
  if (!safety.safe) {
    res.status(403).json({ error: 'Query Safety Engine bloqueó la consulta.', reason: safety.reason });
    return;
  }

  const { uid: authUid, email, role } = req as AuthedRequest;
  const uid = authUid ?? null;
  let edit: ResolvedEdit | null = null;
  if (body.edit !== undefined) {
    try {
      if (!uid) throw new SqlEditError(403, 'Editar la sentencia requiere un usuario autenticado.');
      edit = await resolveEdit(uid, role, body.edit, body.sql);
    } catch (err) {
      const status = err instanceof SqlEditError ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
  }
  if (edit && uid) {
    await recordSqlEdit({
      uid,
      email: email ?? null,
      connectionId: connection.id,
      connectionName: connection.name,
      engine: connection.engine,
      ...edit,
      editedSql: body.sql,
      action: 'ejecutada',
    });
  }

  const origin = usageOriginFrom(req.headers[USAGE_ORIGIN_HEADER]);
  const startedAt = Date.now();
  const question =
    typeof body.question === 'string' && body.question.trim() ? body.question.trim() : null;
  const sql = body.sql;
  const recordHistory = async (outcome: { success: boolean; totalRows?: number; errorReason?: string }) => {
    if (!uid || origin === 'evaluacion') return;
    await recordHistoryEntry(uid, {
      question,
      connectionId: connection.id,
      connectionName: connection.name,
      engine: connection.engine,
      sql,
      success: outcome.success,
      totalRows: outcome.totalRows ?? null,
      errorReason: outcome.errorReason ?? null,
    });
  };

  try {
    const stored = await createResult(connection.id, sql, uid);
    const firstPage = await readPage(stored.id, uid, 1);
    await recordUsageEvent({
      type: 'executeQuery',
      engine: connection.engine,
      connectionId: connection.id,
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
      engine: connection.engine,
      connectionId: connection.id,
      uid,
      origin,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorReason: err instanceof Error ? err.message : String(err),
    });
    await recordHistory({ success: false, errorReason: err instanceof Error ? err.message : String(err) });
    const status =
      err instanceof QueryTimeoutError ? 504 : err instanceof ResultTooLargeError ? 413 : err instanceof ResultShapeError ? 422 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('executeQuery', executeQueryHandler);
