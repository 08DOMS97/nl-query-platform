'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import type { ReusedQuery, SavedQuery } from '@/lib/types';

/**
 * Guarda una consulta con un nombre (M5). Guardar es siempre una acción del
 * usuario: el historial se llena solo, las guardadas no.
 */
export function SaveQueryButton({
  query,
  user,
  onSaved,
}: {
  query: ReusedQuery;
  user: User;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(query.question ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch<SavedQuery>('/savedQueries', user, {
        method: 'POST',
        body: { name, engine: query.engine, sql: query.sql, question: query.question },
      });
      setOpen(false);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={() => { setOpen(true); setSaved(false); }} className="rounded border px-2 py-1 text-sm">
          Guardar
        </button>
        {saved && <span className="text-sm text-green-700">Guardada.</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        placeholder="Nombre de la consulta"
        className="rounded border px-2 py-1 text-sm"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="rounded bg-black px-2 py-1 text-sm text-white disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Confirmar'}
      </button>
      <button onClick={() => setOpen(false)} className="text-sm underline">
        Cancelar
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
