import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { extractSchema } from '../services/schemaExtractor.service.js';
import { pruneSchema, questionHasContent } from '../services/schemaPruning.service.js';
import { GenerationFailedError, generateSql } from '../services/vertexAI.service.js';
import { validateQuerySafety } from '../services/querySafety.service.js';
import { estimateCostUsd } from '../services/vertexAiPricing.service.js';
import { recordUsageEvent, USAGE_ORIGIN_HEADER, usageOriginFrom } from '../services/usageTracking.service.js';
import { connectionFromRequest } from '../services/connectionStore.service.js';
import type { ConnectionDetail, GenerateSqlMetrics, GenerateSqlRequest, GenerationStages } from '../types/index.js';
import { handleConnectionError } from './connectionErrors.js';
import type { AuthedRequest } from '../middleware/auth.middleware.js';
import { MAX_QUESTION_CHARS, findRowLimit, looksLikeSql, questionRequestsRowLimit } from '../services/questionGuard.service.js';

/**
 * POST /generateSQL  { connectionId, naturalLanguageQuery } -> { sql, engine, connectionId, safety, metrics }
 * (`engine` se acepta como alias de `connectionId`: el runner de evaluación lo usa).
 *
 * Antes de llamar al modelo, sin costo: largo máximo de la pregunta (400) y rechazo de
 * un texto que ya es SQL (422, `nlqp/sql-input`). Después: si el SQL limita filas y la
 * pregunta no lo pide, no se entrega (422, `nlqp/unrequested-row-limit`; la llamada sí
 * se cobró y se registra). Ver `questionGuard.service.ts`.
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
  if (typeof body.naturalLanguageQuery !== 'string' || !body.naturalLanguageQuery.trim()) {
    res.status(400).json({ error: 'Campo "naturalLanguageQuery" es requerido.' });
    return;
  }
  if (body.naturalLanguageQuery.length > MAX_QUESTION_CHARS) {
    res.status(400).json({ error: `La pregunta es demasiado larga (máximo ${MAX_QUESTION_CHARS.toLocaleString('es-GT')} caracteres).` });
    return;
  }
  if (looksLikeSql(body.naturalLanguageQuery)) {
    res.status(422).json({
      code: 'nlqp/sql-input',
      error: 'Escriba su consulta como una pregunta, por ejemplo «¿Cuántos clientes hay por país?». Esta función no recibe sentencias SQL.',
    });
    return;
  }

  const uid = (req as Request & { uid?: string }).uid ?? null;
  const origin = usageOriginFrom(req.headers[USAGE_ORIGIN_HEADER], (req as AuthedRequest).role);
  const startedAt = Date.now();
  // Tiempo de cada etapa (24/10), para separar lo que depende de NLQP de lo que tarda el
  // servicio del modelo, que es lo que más varía.
  const stages: Partial<GenerationStages> = {};
  let mark = startedAt;
  const lap = (stage: keyof GenerationStages) => {
    const now = Date.now();
    stages[stage] = now - mark;
    mark = now;
  };

  try {
    // Las corridas de evaluación leen siempre el esquema actual: la caché no altera la medición.
    const schema = await extractSchema(connection.id, { fresh: origin === 'evaluacion' });
    lap('schemaMs');
    if (!questionHasContent(schema, body.naturalLanguageQuery)) {
      res.status(422).json({
        code: 'nlqp/no-content',
        error: 'No se encontró en la pregunta qué consultar. Escriba qué datos quiere ver, por ejemplo «¿Cuántos pedidos hubo por mes?».',
      });
      return;
    }
    const prunedSchema = pruneSchema(schema, body.naturalLanguageQuery);
    lap('pruneMs');
    const { sql, tokensInput, tokensOutput, tokensThinking, tokensTotal } = await generateSql(
      connection.engine,
      prunedSchema,
      body.naturalLanguageQuery,
    );
    lap('modelMs');
    const safety = validateQuerySafety(sql);
    // El razonamiento interno se factura como salida, aunque no sea visible.
    const costUsd = estimateCostUsd(tokensInput, tokensOutput + tokensThinking);
    const rowLimit = findRowLimit(sql);
    const unrequestedLimit = rowLimit !== null && !questionRequestsRowLimit(body.naturalLanguageQuery);
    lap('checkMs');
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
      stages: stages as GenerationStages,
      ...(unrequestedLimit ? { errorReason: `límite de filas no pedido: ${rowLimit}` } : {}),
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
      stages: stages as GenerationStages,
    };
    if (unrequestedLimit) {
      res.status(422).json({
        code: 'nlqp/unrequested-row-limit',
        error:
          `La consulta generada devolvía solo una parte de los resultados (${rowLimit}), aunque la pregunta no pide ` +
          'una cantidad. No se muestra para no presentar datos incompletos. Reformule la pregunta o indique ' +
          'cuántos registros quiere.',
        sql,
        metrics,
      });
      return;
    }
    res.status(200).json({ sql, engine: connection.engine, connectionId: connection.id, safety, metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Si el modelo respondió (se factura) sin un SQL usable, se registra lo que costó.
    const billed = err instanceof GenerationFailedError
      ? { ...err.usage, costUsd: estimateCostUsd(err.usage.tokensInput, err.usage.tokensOutput + err.usage.tokensThinking) }
      : {};
    await recordUsageEvent({
      type: 'generateSQL',
      engine: connection.engine,
      connectionId: connection.id,
      uid,
      origin,
      success: false,
      latencyMs: Date.now() - startedAt,
      ...billed,
      errorReason: message,
    });
    // El detalle (errores de Vertex AI, del motor o de Secret Manager) es para el técnico.
    res.status(500).json({
      error: (req as AuthedRequest).role === 'tecnico'
        ? message
        : 'No se pudo generar la consulta. Inténtelo de nuevo en unos minutos; si se repite, avise al administrador.',
    });
  }
};

functions.http('generateSQL', generateSQLHandler);
