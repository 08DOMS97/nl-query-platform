'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import { DB_ENGINES, type DbEngine, type ExecuteQueryResponse, type GenerateSqlResponse } from '@/lib/types';
import { QueryResult } from './QueryResult';

export function QueryForm({ user }: { user: User }) {
  const [engine, setEngine] = useState<DbEngine>('postgres');
  const [question, setQuestion] = useState('');
  const [generated, setGenerated] = useState<GenerateSqlResponse | null>(null);
  const [result, setResult] = useState<ExecuteQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setGenerated(null);
    setGenerating(true);
    try {
      const data = await apiFetch<GenerateSqlResponse>('/generateSQL', user, {
        method: 'POST',
        body: { engine, naturalLanguageQuery: question },
      });
      setGenerated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleExecute() {
    if (!generated) return;
    setError(null);
    setExecuting(true);
    try {
      const data = await apiFetch<ExecuteQueryResponse>('/executeQuery', user, {
        method: 'POST',
        body: { engine: generated.engine, sql: generated.sql },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="space-y-1">
        <label htmlFor="engine" className="text-sm font-medium">
          Motor
        </label>
        <select
          id="engine"
          value={engine}
          onChange={(e) => setEngine(e.target.value as DbEngine)}
          className="w-full rounded border px-3 py-2"
        >
          {DB_ENGINES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="question" className="text-sm font-medium">
          Preguntá en lenguaje natural
        </label>
        <textarea
          id="question"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="¿Cuántos clientes hay registrados?"
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !question.trim()}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {generating ? 'Generando…' : 'Generar SQL'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {generated && (
        <div className="space-y-2 rounded border p-3">
          <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-sm">{generated.sql}</pre>
          {generated.safety.safe ? (
            <p className="text-sm text-green-700">Query Safety Engine: aprobado.</p>
          ) : (
            <p className="text-sm text-red-600">
              Query Safety Engine bloqueó esta consulta{generated.safety.reason ? `: ${generated.safety.reason}` : '.'}
            </p>
          )}
          <button
            onClick={handleExecute}
            disabled={!generated.safety.safe || executing}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {executing ? 'Ejecutando…' : 'Ejecutar'}
          </button>
        </div>
      )}

      {result && <QueryResult result={result} />}
    </div>
  );
}
