import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import {
  deleteSavedQuery,
  getSavedQuery,
  listHistory,
  listSavedQueries,
  saveQuery,
  updateSavedQuerySql,
} from '../services/queryHistory.service.js';
import { listSqlEdits, recordSqlEdit, resolveEdit, SqlEditError } from '../services/sqlEditAudit.service.js';
import type { AuthedRequest } from '../middleware/auth.middleware.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import { handleConnectionError } from './connectionErrors.js';

const NAME_MAX_LENGTH = 100;

/** El historial es por usuario: sin uid (bypass de desarrollo) no hay a quién asociarlo. */
function requireUid(req: Request, res: Response): string | null {
  const uid = (req as AuthedRequest).uid;
  if (!uid) {
    res.status(401).json({ error: 'El historial requiere un usuario autenticado.' });
    return null;
  }
  return uid;
}

/** GET /history -> { entries: HistoryEntry[] }: las últimas 50 ejecuciones del usuario. */
export const getHistoryHandler = async (req: Request, res: Response): Promise<void> => {
  const uid = requireUid(req, res);
  if (!uid) return;
  try {
    res.status(200).json({ entries: await listHistory(uid) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * GET    /savedQueries               -> { queries: SavedQuery[] }
 * POST   /savedQueries { name, connectionId, sql, question?, edit? } -> SavedQuery
 * PUT    /savedQueries?id=... { sql } -> SavedQuery   (solo técnico: editar la guardada)
 * DELETE /savedQueries?id=...        -> 204
 *
 * Guardar es siempre una acción del usuario (no automática). Se valida el SQL con
 * el Query Safety Engine también al guardar, para no guardar algo que después no
 * se va a poder ejecutar; igual se vuelve a validar al ejecutarlo. Si el técnico
 * guarda una sentencia generada que editó (`edit`) o edita una guardada (PUT), la
 * edición queda en la auditoría (`sqlEditAudit.service.ts`).
 */
export const savedQueriesHandler = async (req: Request, res: Response): Promise<void> => {
  const uid = requireUid(req, res);
  if (!uid) return;
  const { email, role } = req as AuthedRequest;

  try {
    if (req.method === 'GET') {
      res.status(200).json({ queries: await listSavedQueries(uid) });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body as { name?: unknown; connectionId?: unknown; engine?: unknown; sql?: unknown; question?: unknown };
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > NAME_MAX_LENGTH) {
        res.status(400).json({ error: `Campo "name" es requerido (máximo ${NAME_MAX_LENGTH} caracteres).` });
        return;
      }
      const connection = await connectionFromRequest(body);
      if (typeof body.sql !== 'string' || !body.sql.trim()) {
        res.status(400).json({ error: 'Campo "sql" es requerido.' });
        return;
      }
      const safety = validateQuerySafety(body.sql);
      if (!safety.safe) {
        res.status(403).json({ error: 'Query Safety Engine bloqueó la consulta.', reason: safety.reason });
        return;
      }
      const edit = await resolveEdit(uid, role, (req.body as { edit?: unknown }).edit, body.sql);
      const question =
        typeof body.question === 'string' && body.question.trim() ? body.question.trim() : null;
      const saved = await saveQuery(uid, {
        name,
        connectionId: connection.id,
        connectionName: connection.name,
        engine: connection.engine,
        sql: body.sql,
        question,
      });
      if (edit) {
        await recordSqlEdit({
          uid,
          email: email ?? null,
          connectionId: connection.id,
          connectionName: connection.name,
          engine: connection.engine,
          ...edit,
          // Guardar una sentencia editada crea la guardada: el registro apunta a ella.
          savedQueryId: edit.savedQueryId ?? saved.id,
          savedQueryName: edit.savedQueryName ?? saved.name,
          editedSql: body.sql,
          action: 'guardada',
        });
      }
      res.status(201).json(saved);
      return;
    }

    if (req.method === 'PUT') {
      if (role !== 'tecnico') {
        res.status(403).json({ error: 'Solo el rol técnico puede editar una consulta guardada.' });
        return;
      }
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const sql = (req.body as { sql?: unknown }).sql;
      if (!id) {
        res.status(400).json({ error: 'Parámetro "id" es requerido.' });
        return;
      }
      if (typeof sql !== 'string' || !sql.trim()) {
        res.status(400).json({ error: 'Campo "sql" es requerido.' });
        return;
      }
      const current = await getSavedQuery(uid, id);
      if (!current) {
        res.status(404).json({ error: 'La consulta guardada no existe.' });
        return;
      }
      const safety = validateQuerySafety(sql);
      if (!safety.safe) {
        res.status(403).json({ error: 'Query Safety Engine bloqueó la consulta.', reason: safety.reason });
        return;
      }
      const updated = await updateSavedQuerySql(uid, id, sql);
      await recordSqlEdit({
        uid,
        email: email ?? null,
        connectionId: current.connectionId,
        connectionName: current.connectionName,
        engine: current.engine,
        origin: 'guardada',
        savedQueryId: current.id,
        savedQueryName: current.name,
        originalSql: current.sql,
        editedSql: sql,
        action: 'guardada',
      });
      res.status(200).json(updated);
      return;
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!id) {
        res.status(400).json({ error: 'Parámetro "id" es requerido.' });
        return;
      }
      if (!(await deleteSavedQuery(uid, id))) {
        res.status(404).json({ error: 'La consulta guardada no existe.' });
        return;
      }
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    if (err instanceof SqlEditError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/** GET /sqlEdits -> { edits: SqlEdit[] }: auditoría de las sentencias editadas (solo técnico). */
export const sqlEditsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ edits: await listSqlEdits() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('history', getHistoryHandler);
functions.http('sqlEdits', sqlEditsHandler);
functions.http('savedQueries', savedQueriesHandler);
