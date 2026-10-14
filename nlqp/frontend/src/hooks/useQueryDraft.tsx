'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ExecuteQueryResponse, GenerateSqlMetrics, QuerySafetyResult, ReusedQuery } from '@/lib/types';

/**
 * SQL listo para ejecutar. `safety` es el veredicto del backend al generarlo; es
 * `null` si la sentencia viene del historial, de las guardadas o la editó el
 * usuario técnico: en ese caso el backend la valida al ejecutarla (como a todo).
 */
export interface PendingQuery extends ReusedQuery {
  safety: QuerySafetyResult | null;
  metrics: GenerateSqlMetrics | null;
  /** El usuario técnico modificó la sentencia generada. */
  edited: boolean;
}

export interface QueryDraft {
  /** Conexión elegida. Las iniciales tienen como id el nombre del motor. */
  connectionId: string;
  question: string;
  pending: PendingQuery | null;
  result: ExecuteQueryResponse | null;
}

const EMPTY: QueryDraft = { connectionId: 'postgres', question: '', pending: null, result: null };

interface QueryDraftState {
  draft: QueryDraft;
  setDraft: (update: (d: QueryDraft) => QueryDraft) => void;
  /** Carga una consulta del historial o de las guardadas en la pantalla Consultar. */
  reuse: (query: ReusedQuery) => void;
}

const QueryDraftContext = createContext<QueryDraftState | null>(null);

/**
 * La consulta en curso vive por encima de las pantallas: pasar a Esquema o a
 * Historial y volver no borra la pregunta, el SQL ni el resultado.
 */
export function QueryDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<QueryDraft>(EMPTY);

  const value: QueryDraftState = {
    draft,
    setDraft: (update) => setDraftState(update),
    reuse: (query) =>
      setDraftState({
        connectionId: query.connectionId,
        question: query.question ?? '',
        pending: { ...query, safety: null, metrics: null, edited: false },
        result: null,
      }),
  };

  return <QueryDraftContext.Provider value={value}>{children}</QueryDraftContext.Provider>;
}

export function useQueryDraft(): QueryDraftState {
  const ctx = useContext(QueryDraftContext);
  if (!ctx) throw new Error('useQueryDraft fuera de QueryDraftProvider');
  return ctx;
}
