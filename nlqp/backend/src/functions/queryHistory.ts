import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import {
  deleteSavedQuery,
  listHistory,
  listSavedQueries,
  saveQuery,
} from '../services/queryHistory.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { DB_ENGINES, type DbEngine } from '../types/index.js';

type AuthedRequest = Request & { uid?: string };

const NAME_MAX_LENGTH = 100;

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

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
 * POST   /savedQueries { name, engine, sql, question? } -> SavedQuery
 * DELETE /savedQueries?id=...        -> 204
 *
 * Guardar es siempre una acción del usuario (no automática). Se valida el SQL con
 * el Query Safety Engine también al guardar, para no guardar algo que después no
 * se va a poder ejecutar; igual se vuelve a validar al ejecutarlo.
 */
export const savedQueriesHandler = async (req: Request, res: Response): Promise<void> => {
  const uid = requireUid(req, res);
  if (!uid) return;

  try {
    if (req.method === 'GET') {
      res.status(200).json({ queries: await listSavedQueries(uid) });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body as { name?: unknown; engine?: unknown; sql?: unknown; question?: unknown };
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > NAME_MAX_LENGTH) {
        res.status(400).json({ error: `Campo "name" es requerido (máximo ${NAME_MAX_LENGTH} caracteres).` });
        return;
      }
      if (!isDbEngine(body.engine)) {
        res.status(400).json({ error: `Campo "engine" inválido. Válidos: ${DB_ENGINES.join(', ')}.` });
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
      const question =
        typeof body.question === 'string' && body.question.trim() ? body.question.trim() : null;
      res.status(201).json(await saveQuery(uid, { name, engine: body.engine, sql: body.sql, question }));
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
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('history', getHistoryHandler);
functions.http('savedQueries', savedQueriesHandler);
