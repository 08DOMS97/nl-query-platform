import { getFirestore } from './firebaseAdmin.service.js';
import type { DbEngine, GetUsageStatsResponse } from '../types/index.js';

const COLLECTION = 'usageEvents';

export type UsageEventType = 'generateSQL' | 'executeQuery';

export interface UsageEvent {
  type: UsageEventType;
  engine: DbEngine;
  uid: string | null;
  success: boolean;
  latencyMs: number;
  errorReason?: string;
  tokensInput?: number;
  tokensOutput?: number;
  tokensTotal?: number;
  costUsd?: number;
  safe?: boolean;
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

export async function getUsageStats(periodDays = 30): Promise<GetUsageStatsResponse> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const snapshot = await getFirestore()
    .collection(COLLECTION)
    .where('timestamp', '>=', since)
    .get();

  const stats: GetUsageStatsResponse = {
    periodDays,
    totalCalls: 0,
    totalCostUsd: 0,
    callsByType: { generateSQL: 0, executeQuery: 0 },
    callsByEngine: { postgres: 0, mysql: 0, mariadb: 0, mssql: 0 },
    errorCount: 0,
  };

  for (const doc of snapshot.docs) {
    const data = doc.data() as UsageEvent;
    stats.totalCalls += 1;
    stats.totalCostUsd += data.costUsd ?? 0;
    stats.callsByType[data.type] += 1;
    stats.callsByEngine[data.engine] += 1;
    if (!data.success) stats.errorCount += 1;
  }

  return stats;
}
