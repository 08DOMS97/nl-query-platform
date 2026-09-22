import type { ExecuteQueryResponse } from '@/lib/types';

export function QueryResult({ result }: { result: ExecuteQueryResponse }) {
  if (result.rowCount === 0) {
    return <p className="text-sm text-gray-600">La consulta no devolvió filas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {result.columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-t">
              {result.columns.map((col) => (
                <td key={col} className="px-3 py-2">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t bg-gray-50 px-3 py-1 text-xs text-gray-500">
        {result.rowCount} fila(s)
      </p>
    </div>
  );
}
