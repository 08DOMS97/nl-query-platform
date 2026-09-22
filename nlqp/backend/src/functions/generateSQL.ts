import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { extractSchema } from '../services/schemaExtractor.service.js';
import { pruneSchema } from '../services/schemaPruning.service.js';
import { generateSql } from '../services/vertexAI.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { DB_ENGINES, type DbEngine, type GenerateSqlRequest } from '../types/index.js';

function isDbEngine(value: unknown): value is DbEngine {
  return typeof value === 'string' && (DB_ENGINES as string[]).includes(value);
}

/**
 * POST /generateSQL  { engine, naturalLanguageQuery } -> { sql, engine }
 *
 * Solo genera y hace una validación informativa de seguridad para la respuesta.
 * El Query Safety Engine se vuelve a aplicar de forma obligatoria en `executeQuery`
 * antes de ejecutar nada — este endpoint nunca ejecuta SQL.
 */
export const generateSQLHandler = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<GenerateSqlRequest>;

  if (!isDbEngine(body.engine)) {
    res.status(400).json({ error: `Campo "engine" inválido. Válidos: ${DB_ENGINES.join(', ')}.` });
    return;
  }
  if (!body.naturalLanguageQuery || !body.naturalLanguageQuery.trim()) {
    res.status(400).json({ error: 'Campo "naturalLanguageQuery" es requerido.' });
    return;
  }

  try {
    const schema = await extractSchema(body.engine);
    const prunedSchema = pruneSchema(schema, body.naturalLanguageQuery);
    const sql = await generateSql(body.engine, prunedSchema, body.naturalLanguageQuery);
    const safety = validateQuerySafety(sql);

    res.status(200).json({ sql, engine: body.engine, safety });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('generateSQL', generateSQLHandler);
