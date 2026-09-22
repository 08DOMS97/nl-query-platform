import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { testAllConnections, testConnection } from '../services/connectionManager.service.js';
import { DB_ENGINES, type DbEngine } from '../types/index.js';

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

/** GET /testConnection            -> prueba los 4 motores en paralelo. */
/** GET /testConnection?engine=X   -> prueba solo el motor X. */
export const testConnectionHandler = async (req: Request, res: Response): Promise<void> => {
  const engineParam = req.query.engine;

  if (engineParam !== undefined) {
    if (!isDbEngine(engineParam)) {
      res.status(400).json({ error: `Motor inválido: "${engineParam}". Válidos: ${DB_ENGINES.join(', ')}.` });
      return;
    }
    const result = await testConnection(engineParam);
    res.status(result.ok ? 200 : 502).json(result);
    return;
  }

  const results = await testAllConnections();
  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 502).json({ results });
};

functions.http('testConnection', testConnectionHandler);
