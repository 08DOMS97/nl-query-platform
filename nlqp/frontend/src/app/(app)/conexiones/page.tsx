'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, apiRequest } from '@/lib/api';
import { DB_ENGINES, ENGINE_LABELS, type PoolStatus, type TestConnectionResult } from '@/lib/types';
import { Badge, Button, Notice, PageHeader, Panel, formatNumber } from '@/components/ui';

/**
 * Prueba los 4 motores y después lee el pool, para que el estado del pool ya
 * refleje las conexiones abiertas por la prueba. `/testConnection` responde 502
 * si algún motor falla, pero igual trae el detalle de cada uno.
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

export default function ConexionesPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchStatus>> | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

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

  function recheck() {
    setChecking(true);
    setRunCount((n) => n + 1);
  }

  const okCount = status?.results.filter((r) => r.ok).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conexiones"
        description="Estado de la conexión con cada motor del banco de pruebas y ocupación de su pool de conexiones."
        actions={
          <Button onClick={recheck} disabled={checking}>
            {checking ? 'Probando…' : 'Probar de nuevo'}
          </Button>
        }
      />

      {error && <Notice tone="bad">{error}</Notice>}

      <Panel
        title="Motores"
        meta={
          status &&
          `${okCount} de ${status.results.length} conectados · revisado a las ${status.checkedAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}`
        }
      >
        <table className="tabular w-full text-[13px]">
          <thead className="bg-surface">
            <tr>
              <th className={TH}>Motor</th>
              <th className={TH}>Estado</th>
              <th className={`${TH} text-right`}>Latencia</th>
              <th className={TH}>Pool</th>
              <th className={`${TH} text-right`}>En uso</th>
              <th className={`${TH} text-right`}>Libres</th>
              <th className={`${TH} text-right`}>En espera</th>
              <th className={`${TH} text-right`}>Máximo</th>
            </tr>
          </thead>
          <tbody className={checking ? 'opacity-50' : undefined}>
            {DB_ENGINES.map((engine) => {
              const result = status?.results.find((r) => r.connectionId === engine);
              const pool = status?.pools.find((p) => p.engine === engine);
              return (
                <tr key={engine} className="last:[&>td]:border-b-0">
                  <td className={`${TD} font-medium`}>{ENGINE_LABELS[engine]}</td>
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
                  <td className={`${TD} text-right font-mono text-[12px]`}>{pool ? pool.max : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <p className="max-w-[80ch] text-[12px] leading-relaxed text-ink-3">
        Cada motor mantiene un pool de hasta {status?.pools[0]?.max ?? 5} conexiones reutilizables. «En uso» son conexiones
        ejecutando una consulta en este momento; «Libres», conexiones abiertas a la espera; «En espera», pedidos que
        aguardan una conexión porque el pool está completo. Un pool sin iniciar se abre con la primera consulta a ese motor.
      </p>
    </div>
  );
}
