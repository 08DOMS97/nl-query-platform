'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { useConnections } from '@/hooks/useConnections';
import { apiFetch, apiRequest } from '@/lib/api';
import { ENGINE_LABELS, type Connection, type PoolStatus, type TestConnectionResult } from '@/lib/types';
import { Badge, Button, EmptyState, Notice, PageHeader, Panel, formatNumber } from '@/components/ui';
import { ConnectionForm } from '@/components/ConnectionForm';

/**
 * Prueba todas las conexiones y después lee el pool, para que el estado del pool ya
 * refleje las conexiones abiertas por la prueba. `/testConnection` responde 502
 * si alguna falla, pero igual trae el detalle de cada una.
 */
async function fetchStatus(user: User) {
  const test = await apiRequest<{ results?: TestConnectionResult[] }>('/testConnection', user);
  if (!test.data.results) throw new Error(test.data.error ?? `Error ${test.status} al probar las conexiones.`);
  const pool = await apiFetch<{ pools: PoolStatus[] }>('/poolStatus', user);
  return { results: test.data.results, pools: pool.pools, checkedAt: new Date() };
}

/** Ocupación del pool: en uso (acento), libres (acento claro), capacidad sin abrir (gris). */
function PoolBar({ pool }: { pool: PoolStatus }) {
  const pct = (n: number) => `${(n / pool.max) * 100}%`;
  return (
    <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-sunken" aria-hidden>
      <div className="bg-accent-500" style={{ width: pct(pool.inUse) }} />
      <div className="bg-accent-200" style={{ width: pct(pool.idle) }} />
    </div>
  );
}

const TH = 'border-b border-line px-4 py-2 text-left text-[12px] font-medium text-ink-3';
const TD = 'border-b border-line px-4 py-3';

/** Formulario abierto: `null` cerrado, `'new'` alta, o la conexión que se edita. */
type FormState = null | 'new' | Connection;

export default function ConexionesPage() {
  const { user } = useAuth();
  const { connections, error: connectionsError, reload } = useConnections();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchStatus>> | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [form, setForm] = useState<FormState>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchStatus(user)
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, runCount]);

  if (!user) return null;

  function recheck() {
    setChecking(true);
    setRunCount((n) => n + 1);
  }

  async function handleSaved(saved: Connection) {
    setNotice(form === 'new' ? `Conexión «${saved.name}» registrada.` : `Conexión «${saved.name}» actualizada.`);
    setForm(null);
    await reload();
    recheck();
  }

  async function handleDelete(c: Connection) {
    if (
      !user ||
      !window.confirm(
        `¿Eliminar la conexión «${c.name}»? Se borra también su contraseña. El historial la sigue mostrando, pero sus consultas ya no se podrán reutilizar.`,
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/connections?id=${encodeURIComponent(c.id)}`, user, { method: 'DELETE' });
      if (form !== null && form !== 'new' && form.id === c.id) setForm(null);
      setNotice(`Conexión «${c.name}» eliminada.`);
      await reload();
      recheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const list = connections ?? [];
  const okCount = status?.results.filter((r) => r.ok).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conexiones"
        description="Bases de datos registradas, estado de la conexión y uso del pool."
        actions={
          <>
            <Button onClick={recheck} disabled={checking}>
              {checking ? 'Probando…' : 'Probar de nuevo'}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setNotice(null);
                setForm('new');
              }}
              disabled={form === 'new'}
            >
              Nueva conexión
            </Button>
          </>
        }
      />

      {(error || connectionsError) && <Notice tone="bad">{error ?? connectionsError}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {form !== null && (
        <ConnectionForm
          key={form === 'new' ? 'new' : form.id}
          user={user}
          editing={form === 'new' ? undefined : form}
          onSaved={handleSaved}
          onCancel={() => setForm(null)}
        />
      )}

      <Panel
        title="Bases de datos"
        meta={
          status &&
          `${okCount} de ${status.results.length} conectadas · revisado a las ${status.checkedAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}`
        }
      >
        {connections && list.length === 0 ? (
          <EmptyState title="No hay conexiones registradas">Use «Nueva conexión» para agregar la primera.</EmptyState>
        ) : (
          <table className="tabular w-full text-[13px]">
            <thead className="bg-surface">
              <tr>
                <th className={TH}>Conexión</th>
                <th className={TH}>Estado</th>
                <th className={`${TH} text-right`}>Latencia</th>
                <th className={TH}>Pool</th>
                <th className={`${TH} text-right`}>En uso</th>
                <th className={`${TH} text-right`}>Libres</th>
                <th className={`${TH} text-right`}>En espera</th>
                <th className={TH}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className={checking ? 'opacity-50' : undefined}>
              {list.map((c) => {
                const result = status?.results.find((r) => r.connectionId === c.id);
                const pool = status?.pools.find((p) => p.connectionId === c.id);
                return (
                  <tr key={c.id} className="last:[&>td]:border-b-0">
                    <td className={TD}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {ENGINE_LABELS[c.engine]}
                        {c.host && (
                          <>
                            {' · '}
                            <span className="font-mono">
                              {c.host}:{c.port}/{c.database}
                            </span>
                          </>
                        )}
                      </p>
                    </td>
                    <td className={TD}>
                      {!result ? (
                        <span className="text-ink-3">—</span>
                      ) : result.ok ? (
                        <Badge tone="ok">Conectado</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge tone="bad">Sin conexión</Badge>
                          <p className="max-w-[36ch] text-[12px] text-ink-2">{result.error}</p>
                        </div>
                      )}
                    </td>
                    <td className={`${TD} text-right font-mono text-[12px]`}>
                      {result?.ok && result.latencyMs !== undefined ? `${formatNumber(result.latencyMs)} ms` : '—'}
                    </td>
                    <td className={TD}>
                      {pool?.initialized ? <PoolBar pool={pool} /> : <span className="text-[12px] text-ink-3">Sin iniciar</span>}
                    </td>
                    <td className={`${TD} text-right font-mono text-[12px]`}>{pool ? pool.inUse : '—'}</td>
                    <td className={`${TD} text-right font-mono text-[12px]`}>{pool ? pool.idle : '—'}</td>
                    <td className={`${TD} text-right font-mono text-[12px]`}>
                      {pool ? <span className={pool.waiting > 0 ? 'text-warn' : undefined}>{pool.waiting}</span> : '—'}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNotice(null);
                            setForm(c);
                          }}
                        >
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(c)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

    </div>
  );
}
