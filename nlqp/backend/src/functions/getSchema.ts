import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { extractSchema } from '../services/schemaExtractor.service.js';
import { pruneSchema } from '../services/schemaPruning.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import { handleConnectionError } from './connectionErrors.js';

/**
 * GET /getSchema?connectionId=...                         -> esquema completo normalizado.
 * GET /getSchema?connectionId=...&naturalLanguageQuery=... -> esquema podado (schema pruning).
 * `engine=` se acepta como alias de `connectionId` (conexiones iniciales). Solo rol técnico.
 */
export const getSchemaHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const connection = await connectionFromRequest(req.query);
    const schema = await extractSchema(connection.id, { fresh: true });
    const nlQuery = req.query.naturalLanguageQuery;
    const result = typeof nlQuery === 'string' && nlQuery.trim() ? pruneSchema(schema, nlQuery) : schema;
    res.status(200).json(result);
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('getSchema', getSchemaHandler);
