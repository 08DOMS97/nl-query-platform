'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { useQueryDraft } from '@/hooks/useQueryDraft';
import { connectionLabel } from '@/hooks/useConnections';
import { apiFetch } from '@/lib/api';
import type { HistoryEntry, ReusedQuery, SavedQuery, SqlEdit } from '@/lib/types';
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, formatDateTime, formatNumber } from '@/components/ui';
import { SaveQueryButton } from '@/components/SaveQueryButton';
import { SqlEditList } from '@/components/SqlEditList';

type Tab = 'history' | 'saved' | 'changes';

/** La auditoría de ediciones (`/sqlEdits`) solo la pide el rol técnico. */
async function fetchLists(user: User, technical: boolean) {
  const [h, s, e] = await Promise.all([
    apiFetch<{ entries: HistoryEntry[] }>('/history', user),
    apiFetch<{ queries: SavedQuery[] }>('/savedQueries', user),
    technical ? apiFetch<{ edits: SqlEdit[] }>('/sqlEdits', user) : Promise.resolve({ edits: [] as SqlEdit[] }),
  ]);
  return { history: h.entries, saved: s.queries, edits: e.edits };
}

/** Pregunta (o aviso si no hubo) y la sentencia, recortada a dos líneas. */
function QueryCell({ title, question, sql }: { title?: string; question: string | null; sql: string }) {
  return (
    <div className="min-w-0">
      {title && <p className="font-medium text-ink">{title}</p>}
      {question && question !== title ? (
        <p className={title ? 'text-ink-2' : 'text-ink'}>{question}</p>
      ) : (
        !title && <p className="text-ink-3">Sentencia sin pregunta</p>
      )}
      <p className="mt-1 line-clamp-2 break-all font-mono text-[12px] leading-relaxed text-ink-2" title={sql}>
        {sql}
      </p>
    </div>
  );
}

const TH = 'border-b border-line px-4 py-2 text-left text-[12px] font-medium text-ink-3';
const TD = 'border-b border-line px-4 py-3 align-top';

export default function HistorialPage() {
  const { user, role } = useAuth();
  const isTechnical = role === 'tecnico';
  const { reuse } = useQueryDraft();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('history');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [edits, setEdits] = useState<SqlEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((n) => n + 1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchLists(user, isTechnical)
      .then((lists) => {
        if (cancelled) return;
        setHistory(lists.history);
        setSaved(lists.saved);
        setEdits(lists.edits);
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
  }, [user, isTechnical, reloadCount]);

  if (!user) return null;

  /** Del historial se reutiliza tal cual; de las guardadas, el técnico además puede editarla. */
  function handleReuse(query: ReusedQuery, from: Parameters<typeof reuse>[1]) {
    reuse(
      { connectionId: query.connectionId, connectionName: query.connectionName, engine: query.engine, question: query.question, sql: query.sql },
      from,
    );
    router.push('/');
  }

  async function handleDelete(query: SavedQuery) {
    if (!user || !window.confirm(`¿Eliminar la consulta guardada «${query.name}»?`)) return;
    setError(null);
    try {
      await apiFetch(`/savedQueries?id=${encodeURIComponent(query.id)}`, user, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'history', label: 'Historial', count: history.length },
    { id: 'saved', label: 'Guardadas', count: saved.length },
    ...(isTechnical ? [{ id: 'changes' as const, label: 'Cambios', count: edits.length }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial"
        description="Las consultas ejecutadas quedan registradas automáticamente. Las guardadas son las que usted decide conservar con un nombre."
      />

      <div className="flex gap-6 border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 pb-2 text-[13px] transition-colors ${
              tab === t.id ? 'border-accent-500 font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
            <span className="tabular ml-1.5 text-ink-3">{t.count}</span>
          </button>
        ))}
      </div>

      {error && <Notice tone="bad">{error}</Notice>}

      {tab === 'history' && (
        <Panel>
          {history.length === 0 ? (
            <EmptyState title={loading ? 'Cargando…' : 'Todavía no hay consultas ejecutadas.'}>
              {!loading && 'Se registran al ejecutar una consulta desde Consultar.'}
            </EmptyState>
          ) : (
            <table className="w-full table-fixed text-[13px]">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>Fecha</th>
                  <th className={TH}>Base de datos</th>
                  <th className={TH}>Consulta</th>
                  <th className={TH}>Resultado</th>
                  <th className={TH}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="last:[&>td]:border-b-0">
                    <td className={`${TD} tabular text-ink-2`}>{formatDateTime(entry.executedAt)}</td>
                    <td className={`${TD} text-ink-2`}>{connectionLabel(entry)}</td>
                    <td className={TD}>
                      <QueryCell question={entry.question} sql={entry.sql} />
                    </td>
                    <td className={TD}>
                      {entry.success ? (
                        <span className="tabular text-ink-2">
                          {formatNumber(entry.totalRows ?? 0)} {entry.totalRows === 1 ? 'fila' : 'filas'}
                        </span>
                      ) : (
                        <span title={entry.errorReason ?? undefined}>
                          <Badge tone="bad">Error</Badge>
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" onClick={() => handleReuse(entry, { origin: 'historial' })}>
                          Reutilizar
                        </Button>
                        <SaveQueryButton size="sm" query={entry} user={user} onSaved={reload} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === 'saved' && (
        <Panel>
          {saved.length === 0 ? (
            <EmptyState title={loading ? 'Cargando…' : 'No hay consultas guardadas.'}>
              {!loading && 'Use «Guardar» en Consultar o en el historial.'}
            </EmptyState>
          ) : (
            <table className="w-full table-fixed text-[13px]">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[190px]" />
              </colgroup>
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>Guardada</th>
                  <th className={TH}>Base de datos</th>
                  <th className={TH}>Consulta</th>
                  <th className={TH}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {saved.map((query) => (
                  <tr key={query.id} className="last:[&>td]:border-b-0">
                    <td className={`${TD} tabular text-ink-2`}>{formatDateTime(query.savedAt)}</td>
                    <td className={`${TD} text-ink-2`}>{connectionLabel(query)}</td>
                    <td className={TD}>
                      <QueryCell title={query.name} question={query.question} sql={query.sql} />
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => handleReuse(query, { origin: 'guardada', id: query.id, name: query.name })}>
                          {isTechnical ? 'Reutilizar o editar' : 'Reutilizar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(query)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === 'changes' && isTechnical && (
        <Panel
          title="Sentencias editadas"
          meta="Cada edición que se ejecutó o se guardó: qué se reemplazó, quién, cuándo y en qué base."
        >
          {edits.length === 0 ? (
            <EmptyState title={loading ? 'Cargando…' : 'Todavía no hay sentencias editadas.'}>
              {!loading && 'Se registran al ejecutar o guardar una sentencia generada o guardada que se modificó.'}
            </EmptyState>
          ) : (
            <SqlEditList edits={edits} />
          )}
        </Panel>
      )}
    </div>
  );
}
