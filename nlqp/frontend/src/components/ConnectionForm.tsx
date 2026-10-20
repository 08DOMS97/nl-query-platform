'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch, apiRequest } from '@/lib/api';
import {
  DB_ENGINES,
  DEFAULT_PORTS,
  DEFAULT_QUERY_TIMEOUT_SEC,
  ENGINE_LABELS,
  MAX_QUERY_TIMEOUT_SEC,
  MIN_QUERY_TIMEOUT_SEC,
  type Connection,
  type ConnectionInput,
  type DbEngine,
  type TestConnectionResult,
} from '@/lib/types';
import { Button, FieldLabel, Notice, Panel, formatDuration, formatNumber } from './ui';

const INPUT_BASE =
  'block h-8 rounded border border-line-strong bg-canvas px-2.5 text-[13px] placeholder:text-ink-3 focus:border-accent-500 focus:outline-none disabled:bg-sunken disabled:text-ink-3';
const INPUT = `${INPUT_BASE} w-full`;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

/**
 * Alta y edición de una conexión (M1, solo rol técnico). "Probar" verifica los datos
 * sin guardarlos; "Guardar" los vuelve a probar en el backend y no registra una
 * conexión que no responde. En una edición el motor no cambia y la contraseña vacía
 * conserva la guardada.
 */
export function ConnectionForm({
  user,
  editing,
  onSaved,
  onCancel,
}: {
  user: User;
  /** Conexión a editar; sin ella, el formulario crea una nueva. */
  editing?: Connection;
  onSaved: (connection: Connection) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [engine, setEngine] = useState<DbEngine>(editing?.engine ?? 'postgres');
  const [host, setHost] = useState(editing?.host ?? 'localhost');
  const [port, setPort] = useState(String(editing?.port ?? DEFAULT_PORTS.postgres));
  const [database, setDatabase] = useState(editing?.database ?? '');
  const [dbUser, setDbUser] = useState(editing?.user ?? '');
  const [password, setPassword] = useState('');
  const initialTimeout = editing?.queryTimeoutSec ?? DEFAULT_QUERY_TIMEOUT_SEC;
  const [timeoutMin, setTimeoutMin] = useState(String(Math.floor(initialTimeout / 60)));
  const [timeoutSec, setTimeoutSec] = useState(String(initialTimeout % 60));
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [test, setTest] = useState<TestConnectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input: ConnectionInput = {
    name: name.trim(),
    engine,
    host: host.trim(),
    port: Number(port),
    database: database.trim(),
    user: dbUser.trim(),
    ...(password ? { password } : {}),
    queryTimeoutSec: Number(timeoutMin || 0) * 60 + Number(timeoutSec || 0),
  };
  const timeoutValid =
    input.queryTimeoutSec >= MIN_QUERY_TIMEOUT_SEC && input.queryTimeoutSec <= MAX_QUERY_TIMEOUT_SEC;
  const complete = !!(input.host && port && input.database && input.user && (editing || password));

  function changeEngine(next: DbEngine) {
    // El puerto sigue al motor mientras sea el de defecto del motor anterior.
    if (port === String(DEFAULT_PORTS[engine]) || !port) setPort(String(DEFAULT_PORTS[next]));
    setEngine(next);
    setTest(null);
  }

  /** Cualquier cambio en los datos invalida la prueba anterior. */
  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setTest(null);
    };
  }

  async function handleTest() {
    setError(null);
    setTest(null);
    setBusy('test');
    try {
      const result = await apiFetch<TestConnectionResult>('/testConnectionConfig', user, {
        method: 'POST',
        body: { ...input, ...(editing ? { id: editing.id } : {}) },
      });
      setTest(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.name || !complete || !timeoutValid || busy) return;
    setError(null);
    setBusy('save');
    try {
      const path = editing ? `/connections?id=${encodeURIComponent(editing.id)}` : '/connections';
      const { ok, status, data } = await apiRequest<Connection>(path, user, {
        method: editing ? 'PUT' : 'POST',
        body: input,
      });
      if (!ok) throw new Error(data.error ?? `Error ${status} al guardar la conexión.`);
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title={editing ? `Editar «${editing.name}»` : 'Nueva conexión'}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
          <div className="col-span-2">
            <Field id="conn-name" label="Nombre" hint="Visible para todos los usuarios">
              <input
                id="conn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Por ejemplo: Ventas · producción"
                className={INPUT}
                autoFocus
              />
            </Field>
          </div>

          <div className="col-span-2">
            <FieldLabel hint={editing ? 'No se puede cambiar' : undefined}>Motor</FieldLabel>
            <div role="radiogroup" aria-label="Motor" className="inline-flex rounded border border-line-strong bg-canvas p-0.5">
              {DB_ENGINES.map((e) => {
                const active = e === engine;
                return (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!!editing}
                    onClick={() => changeEngine(e)}
                    className={`h-7 rounded-sm px-3 text-[13px] transition-colors disabled:cursor-not-allowed ${
                      active ? 'bg-accent-100 font-medium text-accent-800' : 'text-ink-2 hover:text-ink disabled:opacity-55'
                    }`}
                  >
                    {ENGINE_LABELS[e]}
                  </button>
                );
              })}
            </div>
          </div>

          <Field id="conn-host" label="Servidor">
            <input id="conn-host" value={host} onChange={(e) => edit(setHost)(e.target.value)} maxLength={255} className={INPUT} />
          </Field>
          <Field id="conn-port" label="Puerto">
            <input
              id="conn-port"
              inputMode="numeric"
              value={port}
              onChange={(e) => edit(setPort)(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className={`${INPUT} font-mono`}
            />
          </Field>
          <Field id="conn-db" label="Base de datos">
            <input id="conn-db" value={database} onChange={(e) => edit(setDatabase)(e.target.value)} maxLength={128} className={INPUT} />
          </Field>
          <Field id="conn-user" label="Usuario">
            <input
              id="conn-user"
              value={dbUser}
              onChange={(e) => edit(setDbUser)(e.target.value)}
              maxLength={128}
              autoComplete="off"
              className={INPUT}
            />
          </Field>
          <Field
            id="conn-password"
            label="Contraseña"
            hint={editing ? 'Déjela vacía para conservar la actual' : 'No se volverá a mostrar'}
          >
            <input
              id="conn-password"
              type="password"
              value={password}
              onChange={(e) => edit(setPassword)(e.target.value)}
              maxLength={256}
              autoComplete="new-password"
              className={INPUT}
            />
          </Field>

          <div className="col-span-2">
            <FieldLabel
              htmlFor="conn-timeout-min"
              hint={
                <span className={timeoutValid ? undefined : 'text-bad'}>
                  Entre {formatDuration(MIN_QUERY_TIMEOUT_SEC)} y {formatDuration(MAX_QUERY_TIMEOUT_SEC)}
                </span>
              }
            >
              Tiempo máximo de ejecución
            </FieldLabel>
            <div className="flex items-center gap-2">
              <input
                id="conn-timeout-min"
                inputMode="numeric"
                aria-label="Minutos"
                value={timeoutMin}
                onChange={(e) => setTimeoutMin(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={`${INPUT_BASE} w-16 text-right font-mono`}
              />
              <span className="text-[13px] text-ink-2">min</span>
              <input
                id="conn-timeout-sec"
                inputMode="numeric"
                aria-label="Segundos"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={`${INPUT_BASE} w-16 text-right font-mono`}
              />
              <span className="text-[13px] text-ink-2">s</span>
              <p className="ml-2 text-[12px] text-ink-3">
                Si una consulta lo supera, la base de datos la cancela y no se entrega un resultado parcial.
              </p>
            </div>
          </div>
        </div>

        {(test || error) && (
          <div className="px-4 pb-4">
            {error ? (
              <Notice tone="bad">{error}</Notice>
            ) : test?.ok ? (
              <Notice tone="ok">
                Conexión correcta{test.latencyMs !== undefined ? ` · ${formatNumber(test.latencyMs)} ms` : ''}.
              </Notice>
            ) : (
              <Notice tone="bad">No se pudo conectar: {test?.error}</Notice>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface px-4 py-2.5">
          <p className="text-[12px] text-ink-3">La conexión se verifica antes de guardarla.</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={busy === 'save'}>
              Cancelar
            </Button>
            <Button onClick={handleTest} disabled={!complete || !!busy}>
              {busy === 'test' ? 'Probando…' : 'Probar'}
            </Button>
            <Button type="submit" variant="primary" disabled={!input.name || !complete || !timeoutValid || !!busy}>
              {busy === 'save' ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
