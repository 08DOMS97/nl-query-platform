'use client';

import { ENGINE_LABELS, type SqlChange, type SqlDiffSegment, type SqlEdit } from '@/lib/types';
import { Badge, formatDateTime } from './ui';

const REMOVED = 'rounded-sm bg-bad-bg px-0.5 text-bad line-through decoration-bad/60';
const ADDED = 'rounded-sm bg-ok-bg px-0.5 text-ok';

/** «Reemplazó X por Y», «Quitó X» o «Agregó Y». */
function ChangeLine({ change }: { change: SqlChange }) {
  const removed = <code className={`${REMOVED} break-all font-mono text-[12px]`}>{change.removed}</code>;
  const added = <code className={`${ADDED} break-all font-mono text-[12px]`}>{change.added}</code>;
  if (change.removed && change.added) {
    return (
      <li>
        Reemplazó {removed} por {added}
      </li>
    );
  }
  if (change.removed) return <li>Quitó {removed}</li>;
  return <li>Agregó {added}</li>;
}

/** La sentencia editada completa, con lo quitado tachado en rojo y lo agregado en verde. */
function InlineDiff({ segments }: { segments: SqlDiffSegment[] }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-all border-t border-line bg-surface px-4 py-3 font-mono text-[12.5px] leading-relaxed">
      {segments.map((s, i) =>
        s.type === 'equal' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span key={i} className={s.type === 'removed' ? REMOVED : ADDED}>
            {s.text}
          </span>
        ),
      )}
    </pre>
  );
}

/**
 * Auditoría de las sentencias editadas por el rol técnico: qué se reemplazó y por
 * qué, quién, cuándo, en qué base y si la edición se ejecutó, se guardó o ambas.
 */
export function SqlEditList({ edits }: { edits: SqlEdit[] }) {
  return (
    <ul className="divide-y divide-line">
      {edits.map((e) => (
        <li key={e.id} className="text-[13px]">
          <div className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="tabular font-medium">{formatDateTime(e.createdAt)}</span>
              <span className="text-ink-2">{e.email ?? 'Usuario sin correo'}</span>
              <span className="text-ink-3">
                {e.connectionName} · {ENGINE_LABELS[e.engine]}
              </span>
              <span className="text-ink-3">
                {e.origin === 'generada' ? 'Sentencia generada' : 'Consulta guardada'}
                {e.savedQueryName ? ` «${e.savedQueryName}»` : ''}
              </span>
              <span className="ml-auto flex gap-1.5">
                {e.actions.includes('ejecutada') && <Badge tone="neutral">Ejecutada</Badge>}
                {e.actions.includes('guardada') && <Badge tone="accent">Guardada</Badge>}
              </span>
            </div>
            {e.changes.length > 0 ? (
              <ul className="space-y-1 text-ink-2">
                {e.changes.map((c, i) => (
                  <ChangeLine key={i} change={c} />
                ))}
              </ul>
            ) : (
              <p className="text-ink-3">Solo cambiaron espacios o saltos de línea.</p>
            )}
            {e.lastAt !== e.createdAt && (
              <p className="tabular text-[12px] text-ink-3">Última vez: {formatDateTime(e.lastAt)}</p>
            )}
          </div>
          <details>
            <summary className="cursor-pointer select-none px-4 pb-3 text-[12px] text-ink-2 hover:text-ink">
              Ver la sentencia completa con los cambios
            </summary>
            <InlineDiff segments={e.segments} />
          </details>
        </li>
      ))}
    </ul>
  );
}
