import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { extractSchema } from '../services/schemaExtractor.service.js';
import { pruneSchema } from '../services/schemaPruning.service.js';
import { generateSql } from '../services/vertexAI.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { estimateCostUsd } from '../services/vertexAiPricing.service.js';
import { recordUsageEvent, USAGE_ORIGIN_HEADER, usageOriginFrom } from '../services/usageTracking.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import type { ConnectionDetail, GenerateSqlMetrics, GenerateSqlRequest } from '../types/index.js';
import { handleConnectionError } from './connectionErrors.js';

/**
 * POST /generateSQL  { connectionId, naturalLanguageQuery } -> { sql, engine, connectionId, safety, metrics }
 * (`engine` se acepta como alias de `connectionId`: el runner de evaluación lo usa).
 *
 * Solo genera y hace una validación informativa de seguridad para la respuesta.
 * El Query Safety Engine se vuelve a aplicar de forma obligatoria en `executeQuery`
 * antes de ejecutar nada — este endpoint nunca ejecuta SQL.
 */
export const generateSQLHandler = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<GenerateSqlRequest>;

  let connection: ConnectionDetail;
  try {
    connection = await connectionFromRequest(body);
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  if (!body.naturalLanguageQuery || !body.naturalLanguageQuery.trim()) {
    res.status(400).json({ error: 'Campo "naturalLanguageQuery" es requerido.' });
    return;
  }

  const uid = (req as Request & { uid?: string }).uid ?? null;
  const origin = usageOriginFrom(req.headers[USAGE_ORIGIN_HEADER]);
  const startedAt = Date.now();

  try {
    const schema = await extractSchema(connection.id);
    const prunedSchema = pruneSchema(schema, body.naturalLanguageQuery);
    const { sql, tokensInput, tokensOutput, tokensThinking, tokensTotal } = await generateSql(
      connection.engine,
      prunedSchema,
      body.naturalLanguageQuery,
    );
    const safety = validateQuerySafety(sql);
    // El razonamiento interno se factura como salida, aunque no sea visible.
    const costUsd = estimateCostUsd(tokensInput, tokensOutput + tokensThinking);
    const latencyMs = Date.now() - startedAt;

    await recordUsageEvent({
      type: 'generateSQL',
      engine: connection.engine,
      connectionId: connection.id,
      uid,
      origin,
      success: true,
      latencyMs,
      tokensInput,
      tokensOutput,
      tokensThinking,
      tokensTotal,
      costUsd,
      safe: safety.safe,
    });

    const metrics: GenerateSqlMetrics = {
      tokensInput,
      tokensOutput,
      tokensThinking,
      tokensTotal,
      costUsd,
      latencyMs,
      tablesSent: prunedSchema.tables.length,
      tablesTotal: schema.tables.length,
    };
    res.status(200).json({ sql, engine: connection.engine, connectionId: connection.id, safety, metrics });
  } catch (err) {
    await recordUsageEvent({
      type: 'generateSQL',
      engine: connection.engine,
      connectionId: connection.id,
      uid,
      origin,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorReason: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('generateSQL', generateSQLHandler);
