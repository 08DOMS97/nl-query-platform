'use client';

import { useState, type KeyboardEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryDraft } from '@/hooks/useQueryDraft';
import { apiFetch, apiRequest } from '@/lib/api';
import { ENGINE_LABELS, type ExecuteQueryResponse, type GenerateSqlMetrics, type GenerateSqlResponse } from '@/lib/types';
import { Badge, Button, EngineSelector, FieldLabel, Notice, PageHeader, Panel, formatNumber, formatUsd } from '@/components/ui';
import { QueryResult } from '@/components/QueryResult';
import { SaveQueryButton } from '@/components/SaveQueryButton';

/** Consumo de la generación: solo lo ve el rol técnico. */
function MetricsStrip({ metrics }: { metrics: GenerateSqlMetrics }) {
  const items: [string, string][] = [
    ['Tablas enviadas', `${metrics.tablesSent} de ${metrics.tablesTotal}`],
    ['Tokens', formatNumber(metrics.tokensTotal)],
    ['Entrada / salida / razonamiento', `${formatNumber(metrics.tokensInput)} / ${formatNumber(metrics.tokensOutput)} / ${formatNumber(metrics.tokensThinking)}`],
    ['Costo', formatUsd(metrics.costUsd)],
    ['Tiempo', `${(metrics.latencyMs / 1000).toLocaleString('es-GT', { maximumFractionDigits: 1 })} s`],
  ];
  return (
    <dl className="tabular flex flex-wrap border-t border-line bg-surface text-[12px]">
      {items.map(([label, value]) => (
        <div key={label} className="border-r border-line px-4 py-2 last:border-r-0">
          <dt className="text-ink-3">{label}</dt>
          <dd className="font-mono text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ConsultarPage() {
  const { user, role } = useAuth();
  const { draft, setDraft } = useQueryDraft();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);

  if (!user) return null;
  const isTechnical = role === 'tecnico';
  const { engine, question, pending, result } = draft;
  const blocked = pending?.safety?.safe === false;

  async function handleGenerate() {
    if (!user || !question.trim() || generating) return;
    setError(null);
    setGenerating(true);
    setDraft((d) => ({ ...d, pending: null, result: null }));
    try {
      const data = await apiFetch<GenerateSqlResponse>('/generateSQL', user, {
        method: 'POST',
        body: { engine, naturalLanguageQuery: question },
      });
      setDraft((d) => ({
        ...d,
        pending: {
          engine: data.engine,
          sql: data.sql,
          question: question.trim(),
          safety: data.safety,
          metrics: data.metrics ?? null,
          edited: false,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleExecute() {
    if (!user || !pending) return;
    setError(null);
    setExecuting(true);
    try {
      const { ok, status, data } = await apiRequest<ExecuteQueryResponse & { reason?: string }>('/executeQuery', user, {
        method: 'POST',
        body: { engine: pending.engine, sql: pending.sql, question: pending.question ?? undefined },
      });
      if (status === 403 && data.reason) {
        // El backend la rechazó al validarla (SQL editado o reutilizado): queda marcada en su panel.
        setDraft((d) => (d.pending ? { ...d, result: null, pending: { ...d.pending, safety: { safe: false, reason: data.reason } } } : d));
        return;
      }
      if (!ok) throw new Error(data.error ?? `Error ${status} al ejecutar la consulta.`);
      setDraft((d) => ({ ...d, result: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  }

  function handleQuestionKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  let status = null;
  if (pending) {
    if (blocked) status = <Badge tone="bad">Bloqueada</Badge>;
    else if (pending.edited) status = <Badge tone="warn">Editada · se valida al ejecutar</Badge>;
    else if (pending.safety === null) status = <Badge tone="neutral">Reutilizada · se valida al ejecutar</Badge>;
    else status = <Badge tone="ok">Validada: solo lectura</Badge>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultar"
        description="Escriba una pregunta en español. El sistema genera la sentencia SQL, la valida y solo ejecuta consultas de lectura."
      />

      <Panel>
        <div className="space-y-5 p-4">
          <div>
            <FieldLabel>Motor</FieldLabel>
            <EngineSelector
              value={engine}
              onChange={(value) => setDraft((d) => ({ ...d, engine: value }))}
              disabled={generating}
            />
          </div>
          <div>
            <FieldLabel htmlFor="question" hint="Ctrl + Enter para generar">
              Pregunta
            </FieldLabel>
            <textarea
              id="question"
              rows={3}
              value={question}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              onKeyDown={handleQuestionKey}
              placeholder="Por ejemplo: ¿cuántos pedidos se entregaron por mes en 2024?"
              className="block w-full resize-y rounded border border-line-strong bg-canvas px-3 py-2 text-[14px] placeholder:text-ink-3 focus:border-accent-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface px-4 py-2.5">
          <p className="text-[12px] text-ink-3">Cada generación consulta al modelo Gemini y tiene costo.</p>
          <Button variant="primary" onClick={handleGenerate} disabled={generating || !question.trim()}>
            {generating ? 'Generando…' : 'Generar SQL'}
          </Button>
        </div>
      </Panel>

      {error && <Notice tone="bad">{error}</Notice>}

      {pending && (
        <Panel title="Sentencia SQL" meta={ENGINE_LABELS[pending.engine]} actions={status}>
          {isTechnical ? (
            <textarea
              aria-label="Sentencia SQL"
              spellCheck={false}
              value={pending.sql}
              rows={Math.min(Math.max(pending.sql.split('\n').length, 3), 16)}
              onChange={(e) =>
                setDraft((d) =>
                  d.pending ? { ...d, result: null, pending: { ...d.pending, sql: e.target.value, safety: null, edited: true } } : d,
                )
              }
              className="block w-full resize-y bg-canvas px-4 py-3 font-mono text-[13px] leading-relaxed focus:bg-accent-50/40 focus:outline-none"
            />
          ) : (
            <details className="group">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-[13px] text-ink-2 hover:text-ink">
                Ver la sentencia generada
              </summary>
              <pre className="overflow-x-auto border-t border-line bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed">
                {pending.sql}
              </pre>
            </details>
          )}

          {isTechnical && pending.metrics && !pending.edited && <MetricsStrip metrics={pending.metrics} />}

          {blocked && (
            <div className="border-t border-line px-4 py-3">
              <Notice tone="bad">
                El Query Safety Engine bloqueó la sentencia{pending.safety?.reason ? `: ${pending.safety.reason}` : '.'}
              </Notice>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            <Button variant="primary" onClick={handleExecute} disabled={blocked || executing || !pending.sql.trim()}>
              {executing ? 'Ejecutando…' : 'Ejecutar'}
            </Button>
            {!blocked && <SaveQueryButton key={pending.sql} query={pending} user={user} />}
          </div>
        </Panel>
      )}

      {result && <QueryResult key={result.resultId} initial={result} user={user} />}
    </div>
  );
}
