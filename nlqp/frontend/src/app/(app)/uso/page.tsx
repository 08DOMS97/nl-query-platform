'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { DB_ENGINES, ENGINE_LABELS, type UsageOrigin, type UsageStats } from '@/lib/types';
import { Notice, PageHeader, Panel, formatNumber, formatUsd } from '@/components/ui';

const PERIODS = [7, 30, 90] as const;
const ORIGINS: { id: UsageOrigin; label: string }[] = [
  { id: 'usuario', label: 'Uso normal' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'todos', label: 'Todo' },
];

/** Grupo de opciones compacto para los filtros de la página. */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-line-strong bg-canvas p-0.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-7 rounded-sm px-2.5 text-[13px] ${
            o.id === value ? 'bg-accent-100 font-medium text-accent-800' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-r border-line px-5 py-4 last:border-r-0">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="tabular mt-1 font-mono text-[20px] leading-none text-ink">{value}</p>
      {detail && <p className="tabular mt-1.5 text-[12px] text-ink-3">{detail}</p>}
    </div>
  );
}

export default function UsoPage() {
  const { user } = useAuth();
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [origin, setOrigin] = useState<UsageOrigin>('usuario');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<UsageStats>(`/getUsageStats?periodDays=${periodDays}&origin=${origin}`, user)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [user, periodDays, origin]);

  // Mientras llega la respuesta de un filtro nuevo se atenúan las cifras anteriores.
  const stale = stats !== null && (stats.periodDays !== periodDays || stats.origin !== origin);
  const generations = stats?.callsByType.generateSQL ?? 0;
  const maxByEngine = Math.max(1, ...DB_ENGINES.map((e) => stats?.callsByEngine[e] ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uso y costos"
        description="Llamadas registradas por el backend y costo estimado de las generaciones con Gemini en Vertex AI."
        actions={
          <>
            <Segmented label="Origen" options={ORIGINS} value={origin} onChange={setOrigin} />
            <Segmented
              label="Período"
              options={PERIODS.map((p) => ({ id: p, label: `${p} días` }))}
              value={periodDays}
              onChange={setPeriodDays}
            />
          </>
        }
      />

      {error && <Notice tone="bad">{error}</Notice>}

      {!stats && !error && <p className="text-[13px] text-ink-3">Cargando…</p>}

      {stats && (
        <div className={`space-y-6 transition-opacity ${stale ? 'opacity-50' : ''}`}>
          <section className="grid grid-cols-4 rounded border border-line">
            <Figure
              label="Llamadas"
              value={formatNumber(stats.totalCalls)}
              detail={`${formatNumber(generations)} generaciones · ${formatNumber(stats.callsByType.executeQuery)} ejecuciones`}
            />
            <Figure label="Costo total" value={formatUsd(stats.totalCostUsd)} detail="Solo las generaciones tienen costo" />
            <Figure
              label="Costo por generación"
              value={generations ? formatUsd(stats.totalCostUsd / generations) : '—'}
              detail="Promedio del período"
            />
            <Figure
              label="Errores"
              value={formatNumber(stats.errorCount)}
              detail={stats.totalCalls ? `${((stats.errorCount / stats.totalCalls) * 100).toLocaleString('es-GT', { maximumFractionDigits: 1 })} % de las llamadas` : undefined}
            />
          </section>

          <Panel title="Llamadas por motor">
            <table className="tabular w-full text-[13px]">
              <tbody>
                {DB_ENGINES.map((engine) => {
                  const n = stats.callsByEngine[engine];
                  return (
                    <tr key={engine} className="border-b border-line last:border-b-0">
                      <td className="w-40 px-4 py-2.5">{ENGINE_LABELS[engine]}</td>
                      <td className="px-4 py-2.5">
                        <div className="h-1.5 rounded-full bg-sunken">
                          <div className="h-full rounded-full bg-accent-500/70" style={{ width: `${(n / maxByEngine) * 100}%` }} />
                        </div>
                      </td>
                      <td className="w-24 px-4 py-2.5 text-right font-mono text-[12px]">{formatNumber(n)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <p className="text-[12px] text-ink-3">
            Costo estimado a precio de lista de Gemini 2.5 Pro con los tokens que informa Vertex AI; no es el monto facturado.
            «Evaluación» son las corridas de la evaluación de la tesis, que se registran aparte del uso normal.
          </p>
        </div>
      )}
    </div>
  );
}
