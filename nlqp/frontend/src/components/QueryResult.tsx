'use client';

import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { apiFetch, BACKEND_URL } from '@/lib/api';
import type { ExecuteQueryResponse } from '@/lib/types';

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
    return <p className="text-sm text-gray-600">La consulta no devolvió filas.</p>;
  }

  const firstRow = (current.page - 1) * current.pageSize + 1;
  const lastRow = firstRow + current.rows.length - 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">
          Filas {firstRow.toLocaleString('es')}–{lastRow.toLocaleString('es')} de{' '}
          <strong>{current.totalRows.toLocaleString('es')}</strong>
        </span>
        {current.totalPages > 1 && (
          <span className="flex items-center gap-1">
            <button
              onClick={() => goToPage(current.page - 1)}
              disabled={loading || current.page <= 1}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-1 text-gray-600">
              Página {current.page} de {current.totalPages}
            </span>
            <button
              onClick={() => goToPage(current.page + 1)}
              disabled={loading || current.page >= current.totalPages}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              Siguiente
            </button>
          </span>
        )}
        <button onClick={downloadCsv} className="ml-auto rounded border px-2 py-1">
          Descargar CSV completo
        </button>
      </div>

      {/* Scroll propio con encabezado fijo: 1000 filas no estiran la página. */}
      <div ref={scrollRef} className="max-h-[60vh] overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {current.columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : undefined}>
            {current.rows.map((row, i) => (
              <tr key={i} className="border-t">
                {current.columns.map((col) => (
                  <td key={col} className="px-3 py-2">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
