'use client';

import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch, BACKEND_URL } from '@/lib/api';
import type { ExecuteQueryResponse } from '@/lib/types';
import { Button, EmptyState, Notice, Panel, formatNumber } from './ui';

/**
 * Muestra el resultado por páginas sin perder filas: cada página se lee del
 * resultado completo que guardó el backend (no se re-ejecuta la consulta), y el
 * total siempre está a la vista junto con la descarga del CSV completo.
 */
export function QueryResult({ initial, user }: { initial: ExecuteQueryResponse; user: User }) {
  const [current, setCurrent] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function goToPage(page: number) {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<ExecuteQueryResponse>(
        `/getResultPage?resultId=${encodeURIComponent(current.resultId)}&page=${page}`,
        user,
      );
      setCurrent(data);
      scrollRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    setError(null);
    try {
      const { path } = await apiFetch<{ path: string }>('/createResultExport', user, {
        method: 'POST',
        body: { resultId: current.resultId },
      });
      // Un enlace de descarga deja que el navegador guarde el archivo directo a
      // disco por streaming, sin cargar el resultado completo en memoria.
      const link = document.createElement('a');
      link.href = `${BACKEND_URL}${path}`;
      link.download = '';
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (current.totalRows === 0) {
    return (
      <Panel title="Resultado">
        <EmptyState title="La consulta no devolvió filas." />
      </Panel>
    );
  }

  const firstRow = (current.page - 1) * current.pageSize + 1;
  const lastRow = firstRow + current.rows.length - 1;
  // Columna numérica: su primer valor no nulo es un número. Se alinea a la derecha entera.
  const numeric = new Set(
    current.columns.filter((col) => typeof current.rows.find((r) => r[col] != null)?.[col] === 'number'),
  );

  return (
    <div className="space-y-2">
      <Panel
        title="Resultado"
        meta={
          <span className="tabular">
            Filas {formatNumber(firstRow)}–{formatNumber(lastRow)} de {formatNumber(current.totalRows)}
          </span>
        }
        actions={
          <>
            {current.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => goToPage(current.page - 1)} disabled={loading || current.page <= 1}>
                  Anterior
                </Button>
                <span className="tabular px-1 text-[12px] text-ink-3">
                  {current.page} / {current.totalPages}
                </span>
                <Button size="sm" variant="ghost" onClick={() => goToPage(current.page + 1)} disabled={loading || current.page >= current.totalPages}>
                  Siguiente
                </Button>
              </div>
            )}
            <Button size="sm" onClick={downloadCsv}>
              Descargar CSV completo
            </Button>
          </>
        }
      >
        {/* Scroll propio con encabezado fijo: 1000 filas no estiran la página. */}
        <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
          <table className="tabular min-w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                {current.columns.map((col) => (
                  <th
                    key={col}
                    className={`whitespace-nowrap border-b border-line px-4 py-2 font-mono text-[12px] font-medium text-ink-2 ${numeric.has(col) ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-50' : undefined}>
              {current.rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 hover:bg-surface">
                  {current.columns.map((col) => {
                    const value = row[col];
                    if (value === null || value === undefined) {
                      return (
                        <td key={col} className={`px-4 py-1.5 font-mono text-[12px] text-ink-3 ${numeric.has(col) ? 'text-right' : ''}`}>
                          NULL
                        </td>
                      );
                    }
                    return (
                      <td key={col} className={`whitespace-pre px-4 py-1.5 ${numeric.has(col) ? 'text-right' : ''}`}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
