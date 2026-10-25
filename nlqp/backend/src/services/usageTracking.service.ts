import { getFirestore } from './firebaseAdmin.service.js';
import type { DbEngine, GenerationStages, GetUsageStatsResponse, LatencySummary } from '../types/index.js';

const COLLECTION = 'usageEvents';

export type UsageEventType = 'generateSQL' | 'executeQuery';

/**
 * De dónde vino la llamada. Las corridas de evaluación (runner de la tesis) se
 * marcan aparte para que no inflen el consumo de uso normal; los eventos
 * anteriores a este campo cuentan como 'usuario'.
 */
export type UsageOrigin = 'usuario' | 'evaluacion';
export const USAGE_ORIGIN_HEADER = 'x-nlqp-origin';

/**
 * Lee el origen del encabezado `X-NLQP-Origin`; cualquier otro valor es 'usuario'.
 * Solo el rol técnico (el runner usa la cuenta técnica de las pruebas) puede marcar
 * una llamada como evaluación: si no, cualquier usuario podría sacar su consumo de
 * «Uso y costos» y del historial (auditoría del 24/10).
 */
export function usageOriginFrom(headerValue: unknown, role: string | undefined): UsageOrigin {
  return headerValue === 'evaluacion' && role === 'tecnico' ? 'evaluacion' : 'usuario';
}

export interface UsageEvent {
  type: UsageEventType;
  engine: DbEngine;
  /** Conexión usada (los eventos anteriores al 10/10 solo tienen el motor). */
  connectionId?: string;
  uid: string | null;
  origin: UsageOrigin;
  success: boolean;
  latencyMs: number;
  errorReason?: string;
  tokensInput?: number;
  tokensOutput?: number;
  tokensThinking?: number;
  tokensTotal?: number;
  costUsd?: number;
  safe?: boolean;
  /** Tiempo por etapa de las generaciones (desde el 24/10). */
  stages?: GenerationStages;
}

/** Mediana, p95 y máximo (percentil por rango más cercano). */
function summarize(values: number[]): LatencySummary | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return { p50Ms: at(0.5), p95Ms: at(0.95), maxMs: sorted[sorted.length - 1] };
}

/**
 * Registra un evento de uso/costo en Firestore. Un fallo acá nunca debe
 * romper la respuesta real al usuario — se traga el error y solo lo loguea.
 * Se espera (`await`) desde los callers porque en Cloud Functions una
 * promesa sin esperar puede perderse si la instancia se recicla antes de
 * completarse.
 */
export async function recordUsageEvent(event: UsageEvent): Promise<void> {
  try {
    await getFirestore()
      .collection(COLLECTION)
      .add({ ...event, timestamp: new Date() });
  } catch (err) {
    console.error('[usageTracking] no se pudo registrar el evento de uso:', err);
  }
}

/** `origin`: qué eventos contar; por defecto solo el uso normal, sin las evaluaciones. */
export async function getUsageStats(
  periodDays = 30,
  origin: UsageOrigin | 'todos' = 'usuario',
): Promise<GetUsageStatsResponse> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const snapshot = await getFirestore()
    .collection(COLLECTION)
    .where('timestamp', '>=', since)
    .get();

  const stats: GetUsageStatsResponse = {
    periodDays,
    origin,
    totalCalls: 0,
    totalCostUsd: 0,
    callsByType: { generateSQL: 0, executeQuery: 0 },
    callsByEngine: { postgres: 0, mysql: 0, mariadb: 0, mssql: 0 },
    errorCount: 0,
    generationTimes: null,
  };
  const totals: number[] = [];
  const models: number[] = [];
  const schemas: number[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as UsageEvent;
    if (origin !== 'todos' && (data.origin ?? 'usuario') !== origin) continue;
    stats.totalCalls += 1;
    stats.totalCostUsd += data.costUsd ?? 0;
    stats.callsByType[data.type] += 1;
    stats.callsByEngine[data.engine] += 1;
    if (!data.success) stats.errorCount += 1;
    if (data.type === 'generateSQL' && data.success && typeof data.latencyMs === 'number') {
      totals.push(data.latencyMs);
      if (data.stages) {
        models.push(data.stages.modelMs);
        schemas.push(data.stages.schemaMs);
      }
    }
  }
  const total = summarize(totals);
  if (total) {
    stats.generationTimes = {
      count: totals.length,
      total,
      stagesCount: models.length,
      model: summarize(models),
      schema: summarize(schemas),
    };
  }

  return stats;
}
