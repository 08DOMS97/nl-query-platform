import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { extractSchema } from '../services/schemaExtractor.service.js';
import { pruneSchema } from '../services/schemaPruning.service.js';
import { DB_ENGINES, type DbEngine } from '../types/index.js';

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

/**
 * GET /getSchema?engine=postgres                         -> esquema completo normalizado.
 * GET /getSchema?engine=postgres&naturalLanguageQuery=... -> esquema podado (schema pruning).
 */
export const getSchemaHandler = async (req: Request, res: Response): Promise<void> => {
  const engineParam = req.query.engine;
  if (!isDbEngine(engineParam)) {
    res.status(400).json({ error: `Parámetro "engine" inválido. Válidos: ${DB_ENGINES.join(', ')}.` });
    return;
  }

  try {
    const schema = await extractSchema(engineParam);
    const nlQuery = req.query.naturalLanguageQuery;
    const result = typeof nlQuery === 'string' && nlQuery.trim() ? pruneSchema(schema, nlQuery) : schema;
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('getSchema', getSchemaHandler);
