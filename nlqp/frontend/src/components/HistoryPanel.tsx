'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import type { HistoryEntry, ReusedQuery, SavedQuery } from '@/lib/types';
import { SaveQueryButton } from './SaveQueryButton';

type Tab = 'history' | 'saved';

async function fetchLists(user: User) {
  const [h, s] = await Promise.all([
    apiFetch<{ entries: HistoryEntry[] }>('/history', user),
    apiFetch<{ queries: SavedQuery[] }>('/savedQueries', user),
  ]);
  return { history: h.entries, saved: s.queries };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Módulo 5: historial (automático, últimas 50 ejecuciones) y consultas guardadas
 * (manuales). "Reusar" devuelve la consulta al formulario; se vuelve a validar
 * con el Query Safety Engine al ejecutarla y no llama a Gemini.
 */
export function HistoryPanel({
  user,
  refreshKey,
  onReuse,
}: {
  user: User;
  refreshKey: number;
  onReuse: (query: ReusedQuery) => void;
}) {
  const [tab, setTab] = useState<Tab>('history');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Recarga local (después de guardar o borrar); `refreshKey` es la del formulario. */
  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    fetchLists(user)
      .then((lists) => {
        if (cancelled) return;
        setHistory(lists.history);
        setSaved(lists.saved);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey, reloadCount]);

  async function handleDelete(query: SavedQuery) {
    if (!window.confirm(`¿Borrar la consulta guardada "${query.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/savedQueries?id=${encodeURIComponent(query.id)}`, user, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tabClass = (t: Tab) =>
    `px-3 py-1 text-sm ${tab === t ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`;

  return (
    <section className="w-full max-w-2xl space-y-3">
      <div className="flex items-center gap-2 border-b">
        <button onClick={() => setTab('history')} className={tabClass('history')}>
          Historial ({history.length})
        </button>
        <button onClick={() => setTab('saved')} className={tabClass('saved')}>
          Guardadas ({saved.length})
        </button>
        {loading && <span className="text-sm text-gray-500">Cargando…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === 'history' && (
        <ul className="space-y-2">
          {history.length === 0 && !loading && (
            <li className="text-sm text-gray-500">Todavía no ejecutaste consultas.</li>
          )}
          {history.map((entry) => (
            <li key={entry.id} className="space-y-1 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{formatDate(entry.executedAt)}</span>
                <span className="rounded bg-gray-100 px-1">{entry.engine}</span>
                {entry.success ? (
                  <span className="text-green-700">
                    {entry.totalRows} {entry.totalRows === 1 ? 'fila' : 'filas'}
                  </span>
                ) : (
                  <span className="text-red-600" title={entry.errorReason ?? undefined}>
                    Error
                  </span>
                )}
              </div>
              <p className="text-sm">{entry.question ?? <em className="text-gray-500">(SQL sin pregunta)</em>}</p>
              <pre className="max-h-24 overflow-auto rounded bg-gray-100 p-2 text-xs">{entry.sql}</pre>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onReuse(entry)} className="rounded border px-2 py-1 text-sm">
                  Reusar
                </button>
                <SaveQueryButton query={entry} user={user} onSaved={reload} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'saved' && (
        <ul className="space-y-2">
          {saved.length === 0 && !loading && (
            <li className="text-sm text-gray-500">No hay consultas guardadas.</li>
          )}
          {saved.map((query) => (
            <li key={query.id} className="space-y-1 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{formatDate(query.savedAt)}</span>
                <span className="rounded bg-gray-100 px-1">{query.engine}</span>
              </div>
              <p className="text-sm font-medium">{query.name}</p>
              {query.question && query.question !== query.name && (
                <p className="text-sm text-gray-600">{query.question}</p>
              )}
              <pre className="max-h-24 overflow-auto rounded bg-gray-100 p-2 text-xs">{query.sql}</pre>
              <div className="flex gap-2">
                <button onClick={() => onReuse(query)} className="rounded border px-2 py-1 text-sm">
                  Reusar
                </button>
                <button onClick={() => handleDelete(query)} className="rounded border px-2 py-1 text-sm text-red-600">
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
