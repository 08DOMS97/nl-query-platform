'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch } from '@/lib/api';
import type { ReusedQuery, SavedQuery } from '@/lib/types';
import { Button } from './ui';

/**
 * Guarda una consulta con un nombre (M5). Guardar es siempre una acción del
 * usuario: el historial se llena solo, las guardadas no.
 */
export function SaveQueryButton({
  query,
  user,
  onSaved,
  size = 'md',
}: {
  query: ReusedQuery;
  user: User;
  onSaved?: () => void;
  size?: 'sm' | 'md';
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
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button size={size} onClick={() => { setOpen(true); setSaved(false); }}>
          Guardar
        </Button>
        {saved && <span className="text-[12px] text-ok">Guardada</span>}
      </span>
    );
  }

  return (
    <form
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !saving) handleSave();
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        maxLength={100}
        placeholder="Nombre de la consulta"
        aria-label="Nombre de la consulta"
        className={`${size === 'sm' ? 'h-7' : 'h-8'} w-64 rounded border border-line-strong bg-canvas px-2.5 text-[13px] focus:border-accent-500 focus:outline-none`}
        autoFocus
      />
      <Button type="submit" size={size} variant="primary" disabled={saving || !name.trim()}>
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
      <Button size={size} variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </form>
  );
}
