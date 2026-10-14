import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { getPoolStatus, testAllConnections, testConnection } from '../services/connectionManager.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import { handleConnectionError } from './connectionErrors.js';

/** GET /testConnection                  -> prueba todas las conexiones registradas en paralelo. */
/** GET /testConnection?connectionId=X   -> prueba solo la conexión X (`engine=` como alias). */
export const testConnectionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.query.connectionId !== undefined || req.query.engine !== undefined) {
      const connection = await connectionFromRequest(req.query);
      const result = await testConnection(connection.id);
      res.status(result.ok ? 200 : 502).json(result);
      return;
    }
    const results = await testAllConnections();
    const allOk = results.every((r) => r.ok);
    res.status(allOk ? 200 : 502).json({ results });
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * GET /poolStatus -> { pools: PoolStatus[] }: conexiones abiertas, libres, en uso y en
 * espera del pool de cada conexión. Solo lectura; no abre conexiones. Solo rol técnico.
 */
export const poolStatusHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ pools: await getPoolStatus() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('testConnection', testConnectionHandler);
functions.http('poolStatus', poolStatusHandler);
