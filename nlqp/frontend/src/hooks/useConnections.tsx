'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import { ENGINE_LABELS, type Connection, type DbEngine } from '@/lib/types';

interface ConnectionsState {
  /** Conexiones registradas, por nombre. `null` mientras se cargan. */
  connections: Connection[] | null;
  error: string | null;
  /** Vuelve a pedir la lista (después de crear, editar o eliminar). */
  reload: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsState | null>(null);

/** Lista de conexiones (M1), compartida por Consultar, Esquema y Conexiones. */
export function ConnectionsProvider({ user, children }: { user: User; children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(
    () => apiFetch<{ connections: Connection[] }>('/connections', user).then((data) => data.connections),
    [user],
  );

  useEffect(() => {
    let cancelled = false;
    fetchList()
      .then((list) => {
        if (cancelled) return;
        setConnections(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchList]);

  async function reload() {
    try {
      setConnections(await fetchList());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return <ConnectionsContext.Provider value={{ connections, error, reload }}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): ConnectionsState {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error('useConnections fuera de ConnectionsProvider');
  return ctx;
}

/**
 * Nombre para mostrar de la conexión de una consulta del historial o de las
 * guardadas. Las entradas anteriores al registro de conexiones solo tienen el
 * motor (y el backend lo devuelve como nombre).
 */
export function connectionLabel(q: { connectionName: string; engine: DbEngine }): string {
  return q.connectionName === q.engine ? ENGINE_LABELS[q.engine] : q.connectionName;
}
