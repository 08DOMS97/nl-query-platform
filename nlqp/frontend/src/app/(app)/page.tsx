'use client';

import { useState, type KeyboardEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canEdit, editInfo, isEdited, useQueryDraft } from '@/hooks/useQueryDraft';
import { connectionLabel, useConnections } from '@/hooks/useConnections';
import { apiFetch, apiRequest } from '@/lib/api';
import { ENGINE_LABELS, type ExecuteQueryResponse, type GenerateSqlMetrics, type GenerateSqlResponse, type SavedQuery } from '@/lib/types';
import { Badge, Button, ConnectionSelector, FieldLabel, Notice, PageHeader, Panel, formatNumber, formatUsd } from '@/components/ui';
import { QueryResult } from '@/components/QueryResult';
import { SaveQueryButton } from '@/components/SaveQueryButton';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const seconds = (ms: number) => `${(ms / 1000).toLocaleString('es-GT', { maximumFractionDigits: 1 })} s`;

/** Consumo de la generación: solo lo ve el rol técnico. */
function MetricsStrip({ metrics }: { metrics: GenerateSqlMetrics }) {
  const items: [string, string][] = [
    ['Tablas enviadas', `${metrics.tablesSent} de ${metrics.tablesTotal}`],
    ['Tokens', formatNumber(metrics.tokensTotal)],
    ['Entrada / salida / razonamiento', `${formatNumber(metrics.tokensInput)} / ${formatNumber(metrics.tokensOutput)} / ${formatNumber(metrics.tokensThinking)}`],
    ['Costo', formatUsd(metrics.costUsd)],
    ['Tiempo', seconds(metrics.latencyMs)],
    ...(metrics.stages ? ([['Modelo / resto', `${seconds(metrics.stages.modelMs)} / ${seconds(metrics.latencyMs - metrics.stages.modelMs)}`]] as [string, string][]) : []),
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
  const { draft, setDraft, begin, isCurrent, selectConnection } = useQueryDraft();
  const { connections, error: connectionsError } = useConnections();
  const [savingChanges, setSavingChanges] = useState(false);
  const [changesSaved, setChangesSaved] = useState(false);

  if (!user) return null;
  const isTechnical = role === 'tecnico';
  const { question, pending, result, busy, error } = draft;
  const generating = busy === 'generando';
  const executing = busy === 'ejecutando';
  const setError = (e: string | null) => setDraft((d) => ({ ...d, error: e }));
  // Si la conexión elegida ya no existe (se eliminó), se usa la primera.
  const selected = connections?.find((c) => c.id === draft.connectionId) ?? connections?.[0] ?? null;
  const blocked = pending?.safety?.safe === false;
  const edited = !!pending && isEdited(pending);
  const editable = isTechnical && !!pending && canEdit(pending);

  async function handleGenerate() {
    // `busy` vive en el provider: volver a Consultar mientras se genera no permite pagar otra.
    if (!user || !selected || !question.trim() || busy) return;
    const n = begin();
    setDraft((d) => ({ ...d, pending: null, result: null, error: null, busy: 'generando' }));
    try {
      const data = await apiFetch<GenerateSqlResponse>('/generateSQL', user, {
        method: 'POST',
        body: { connectionId: selected.id, naturalLanguageQuery: question },
      });
      if (!isCurrent(n)) return;
      setDraft((d) => ({
        ...d,
        busy: null,
        pending: {
          connectionId: selected.id,
          connectionName: selected.name,
          engine: data.engine,
          sql: data.sql,
          question: question.trim(),
          safety: data.safety,
          metrics: data.metrics ?? null,
          origin: 'generada',
          originalSql: data.sql,
          savedQueryId: null,
          savedQueryName: null,
        },
      }));
    } catch (err) {
      if (isCurrent(n)) setDraft((d) => ({ ...d, busy: null, error: errorMessage(err) }));
    }
  }

  async function handleExecute() {
    if (!user || !pending || busy) return;
    const n = begin();
    const sent = pending;
    // El resultado anterior se quita al empezar: si esta ejecución falla, no queda a la vista como si fuera de ella.
    setDraft((d) => ({ ...d, result: null, error: null, busy: 'ejecutando' }));
    try {
      const { ok, status, data } = await apiRequest<ExecuteQueryResponse & { reason?: string }>('/executeQuery', user, {
        method: 'POST',
        body: {
          connectionId: sent.connectionId,
          sql: sent.sql,
          question: sent.question ?? undefined,
          // Si el técnico la editó: de dónde venía, para la auditoría.
          edit: isTechnical ? editInfo(sent) : undefined,
        },
      });
      if (!isCurrent(n)) return;
      if (status === 403 && data.reason) {
        // El backend la rechazó al validarla (SQL editado o reutilizado): queda marcada en su panel.
        setDraft((d) => (d.pending ? { ...d, busy: null, result: null, pending: { ...d.pending, safety: { safe: false, reason: data.reason } } } : { ...d, busy: null }));
        return;
      }
      if (!ok) throw new Error(data.error ?? `Error ${status} al ejecutar la consulta.`);
      setDraft((d) => ({ ...d, busy: null, result: data }));
    } catch (err) {
      if (isCurrent(n)) setDraft((d) => ({ ...d, busy: null, error: errorMessage(err) }));
    }
  }

  /** Reemplaza la sentencia de la consulta guardada de la que viene (solo técnico). */
  async function handleSaveChanges() {
    if (!user || !pending?.savedQueryId) return;
    setError(null);
    setSavingChanges(true);
    try {
      const { ok, status, data } = await apiRequest<SavedQuery & { reason?: string }>(
        `/savedQueries?id=${encodeURIComponent(pending.savedQueryId)}`,
        user,
        { method: 'PUT', body: { sql: pending.sql } },
      );
      if (status === 403 && data.reason) {
        setDraft((d) => (d.pending ? { ...d, pending: { ...d.pending, safety: { safe: false, reason: data.reason } } } : d));
        return;
      }
      if (!ok) throw new Error(data.error ?? `Error ${status} al guardar los cambios.`);
      // La versión guardada pasa a ser la original: los próximos cambios se comparan con ella.
      setDraft((d) => (d.pending ? { ...d, pending: { ...d.pending, originalSql: data.sql } } : d));
      setChangesSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingChanges(false);
    }
  }

  /** Al guardar con nombre, la sentencia pasa a ser esa guardada: desde ahí se puede editar. */
  function handleSaved(saved: SavedQuery) {
    setDraft((d) =>
      d.pending
        ? {
            ...d,
            pending: { ...d.pending, origin: 'guardada', originalSql: saved.sql, savedQueryId: saved.id, savedQueryName: saved.name },
          }
        : d,
    );
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
    else if (edited) status = <Badge tone="warn">Editada · se valida al ejecutar</Badge>;
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
            <FieldLabel>Base de datos</FieldLabel>
            {connections && selected ? (
              <ConnectionSelector
                connections={connections}
                value={selected.id}
                onChange={(c) => selectConnection(c.id)}
                disabled={!!busy}
              />
            ) : connectionsError ? (
              <Notice tone="bad">{connectionsError}</Notice>
            ) : (
              <p className="text-[13px] text-ink-3">{connections ? 'No hay conexiones registradas.' : 'Cargando conexiones…'}</p>
            )}
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
          <p className="text-[12px] text-ink-3">{isTechnical ? 'Cada generación tiene un costo de procesamiento.' : ''}</p>
          <Button variant="primary" onClick={handleGenerate} disabled={!!busy || !selected || !question.trim()}>
            {generating ? 'Generando…' : 'Generar SQL'}
          </Button>
        </div>
      </Panel>

      {error && <Notice tone="bad">{error}</Notice>}

      {pending && (
        <Panel
          title={pending.savedQueryName ? `Sentencia SQL · «${pending.savedQueryName}»` : 'Sentencia SQL'}
          meta={`${connectionLabel(pending)} · ${ENGINE_LABELS[pending.engine]}`}
          actions={status}
        >
          {editable ? (
            <textarea
              aria-label="Sentencia SQL"
              spellCheck={false}
              value={pending.sql}
              rows={Math.min(Math.max(pending.sql.split('\n').length, 3), 16)}
              onChange={(e) => {
                setChangesSaved(false);
                if (executing) begin(); // la ejecución en curso es de la sentencia anterior: su resultado se descarta
                setDraft((d) => (d.pending ? { ...d, result: null, busy: executing ? null : d.busy, pending: { ...d.pending, sql: e.target.value, safety: null } } : d));
              }}
              className="block w-full resize-y bg-canvas px-4 py-3 font-mono text-[13px] leading-relaxed focus:bg-accent-50/40 focus:outline-none"
            />
          ) : isTechnical ? (
            <>
              <pre className="overflow-x-auto bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed">{pending.sql}</pre>
              <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">
                Para modificar esta consulta, guárdela primero.
              </p>
            </>
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

          {isTechnical && pending.metrics && !edited && <MetricsStrip metrics={pending.metrics} />}

          {blocked && (
            <div className="border-t border-line px-4 py-3">
              <Notice tone="bad">
                {isTechnical ? 'El Query Safety Engine bloqueó la sentencia' : 'Por seguridad, la sentencia no se ejecuta'}
                {pending.safety?.reason ? `: ${pending.safety.reason}` : '.'}
              </Notice>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
            <Button variant="primary" onClick={handleExecute} disabled={blocked || !!busy || !pending.sql.trim()}>
              {executing ? 'Ejecutando…' : 'Ejecutar'}
            </Button>
            {!blocked && pending.origin === 'guardada' && edited && isTechnical && (
              <Button onClick={handleSaveChanges} disabled={savingChanges || !pending.sql.trim()}>
                {savingChanges ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            )}
            {!blocked && (
              <SaveQueryButton
                key={pending.sql}
                query={pending}
                user={user}
                edit={isTechnical ? editInfo(pending) : undefined}
                label={pending.origin === 'guardada' ? 'Guardar como nueva' : 'Guardar'}
                onSaved={handleSaved}
              />
            )}
            {changesSaved && !edited && <span className="text-[12px] text-ok">Cambios guardados</span>}
          </div>
        </Panel>
      )}

      {result && <QueryResult key={result.resultId} initial={result} user={user} />}
    </div>
  );
}
