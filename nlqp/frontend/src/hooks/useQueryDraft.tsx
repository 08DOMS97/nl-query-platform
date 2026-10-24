'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { ExecuteQueryResponse, GenerateSqlMetrics, QuerySafetyResult, ReusedQuery, SqlEditInfo } from '@/lib/types';

/** De dónde salió la sentencia en curso. Define si el técnico puede editarla. */
export type PendingOrigin = 'generada' | 'historial' | 'guardada';

/**
 * SQL listo para ejecutar. `safety` es el veredicto del backend al generarlo; es
 * `null` si la sentencia viene del historial, de las guardadas o la editó el
 * usuario técnico: en ese caso el backend la valida al ejecutarla (como a todo).
 */
export interface PendingQuery extends ReusedQuery {
  safety: QuerySafetyResult | null;
  metrics: GenerateSqlMetrics | null;
  origin: PendingOrigin;
  /** Sentencia antes de editarla: la generada o la guardada (después de «Guardar cambios», la nueva). */
  originalSql: string;
  /** Consulta guardada de la que viene (o en la que se guardó), si la hay. */
  savedQueryId: string | null;
  savedQueryName: string | null;
}

/** El técnico edita la sentencia generada y las guardadas; las del historial, no (primero se guardan). */
export function canEdit(p: PendingQuery): boolean {
  return p.origin !== 'historial';
}

/** La sentencia cambió en algo más que espacios. */
export function isEdited(p: PendingQuery): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  return norm(p.sql) !== norm(p.originalSql);
}

/** Datos de la edición para `/executeQuery` y `/savedQueries` (auditoría), o `undefined` si no cambió. */
export function editInfo(p: PendingQuery): SqlEditInfo | undefined {
  if (!isEdited(p)) return undefined;
  return p.origin === 'guardada' && p.savedQueryId
    ? { origin: 'guardada', savedQueryId: p.savedQueryId }
    : { origin: p.origin === 'historial' ? 'historial' : 'generada', originalSql: p.originalSql };
}

export interface QueryDraft {
  /** Conexión elegida. Las iniciales tienen como id el nombre del motor. */
  connectionId: string;
  question: string;
  pending: PendingQuery | null;
  result: ExecuteQueryResponse | null;
  /** Lo que se está haciendo con el backend. Vive acá para que salir de Consultar y volver no permita pagar otra generación. */
  busy: 'generando' | 'ejecutando' | null;
  error: string | null;
}

const EMPTY: QueryDraft = { connectionId: 'postgres', question: '', pending: null, result: null, busy: null, error: null };

interface QueryDraftState {
  draft: QueryDraft;
  setDraft: (update: (d: QueryDraft) => QueryDraft) => void;
  /** Carga una consulta del historial o de las guardadas en la pantalla Consultar. */
  reuse: (query: ReusedQuery, from: { origin: 'historial' } | { origin: 'guardada'; id: string; name: string }) => void;
  /**
   * Empieza una generación o ejecución y devuelve su número. Solo la última vale:
   * `isCurrent(n)` es falso si después se empezó otra, se cambió de conexión o se
   * reusó otra consulta, y su respuesta se descarta (no aparece un resultado viejo
   * bajo una sentencia nueva).
   */
  begin: () => number;
  isCurrent: (n: number) => boolean;
  /** Cambia de conexión: la sentencia y el resultado de la anterior dejan de valer. */
  selectConnection: (connectionId: string) => void;
}

const QueryDraftContext = createContext<QueryDraftState | null>(null);

/**
 * La consulta en curso vive por encima de las pantallas: pasar a Esquema o a
 * Historial y volver no borra la pregunta, el SQL ni el resultado.
 */
export function QueryDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<QueryDraft>(EMPTY);
  const run = useRef(0);

  const value: QueryDraftState = {
    draft,
    setDraft: (update) => setDraftState(update),
    begin: () => ++run.current,
    isCurrent: (n) => n === run.current,
    selectConnection: (connectionId) => {
      run.current++;
      setDraftState((d) =>
        d.connectionId === connectionId ? d : { ...d, connectionId, pending: null, result: null, busy: null, error: null },
      );
    },
    reuse: (query, from) => {
      run.current++;
      setDraftState({
        connectionId: query.connectionId,
        question: query.question ?? '',
        pending: {
          ...query,
          safety: null,
          metrics: null,
          origin: from.origin,
          originalSql: query.sql,
          savedQueryId: from.origin === 'guardada' ? from.id : null,
          savedQueryName: from.origin === 'guardada' ? from.name : null,
        },
        result: null,
        busy: null,
        error: null,
      });
    },
  };

  return <QueryDraftContext.Provider value={value}>{children}</QueryDraftContext.Provider>;
}

export function useQueryDraft(): QueryDraftState {
  const ctx = useContext(QueryDraftContext);
  if (!ctx) throw new Error('useQueryDraft fuera de QueryDraftProvider');
  return ctx;
}
