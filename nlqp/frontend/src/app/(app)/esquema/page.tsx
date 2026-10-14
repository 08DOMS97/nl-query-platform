'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import type { ColumnInfo, SchemaInfo, TableInfo } from '@/lib/types';
import { useConnections } from '@/hooks/useConnections';
import { Badge, ConnectionSelector, EmptyState, Notice, PageHeader, Panel } from '@/components/ui';

const TH = 'border-b border-line px-4 py-2 text-left text-[12px] font-medium text-ink-3';
const TD = 'border-b border-line px-4 py-2 align-top';

function KeyCell({ column }: { column: ColumnInfo }) {
  if (!column.isPrimaryKey && !column.isForeignKey) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {column.isPrimaryKey && <Badge tone="accent">PK</Badge>}
      {column.isForeignKey && (
        <span className="inline-flex items-center gap-1.5">
          <Badge>FK</Badge>
          <span className="font-mono text-[12px] text-ink-2">
            {column.referencesTable}.{column.referencesColumn}
          </span>
        </span>
      )}
    </div>
  );
}

function TableDetail({ table }: { table: TableInfo }) {
  return (
    <div className="space-y-4">
      <Panel title={<span className="font-mono">{table.name}</span>} meta={`${table.columns.length} columnas`}>
        <table className="w-full text-[13px]">
          <thead className="bg-surface">
            <tr>
              <th className={TH}>Columna</th>
              <th className={TH}>Tipo</th>
              <th className={TH}>Nulos</th>
              <th className={TH}>Clave</th>
              <th className={TH}>Valores permitidos</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => (
              <tr key={column.name} className="last:[&>td]:border-b-0">
                <td className={`${TD} font-mono text-[12.5px]`}>
                  {column.name}
                  {column.indexed && (
                    <span className="ml-2 font-sans text-[11.5px] text-ink-3" title="Primera columna de un índice">
                      indexada
                    </span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap font-mono text-[12px] text-ink-2`}>{column.dataType}</td>
                <td className={`${TD} text-ink-2`}>{column.nullable ? 'Sí' : 'No'}</td>
                <td className={TD}>
                  <KeyCell column={column} />
                </td>
                <td className={`${TD} font-mono text-[12px] text-ink-2`}>
                  {column.allowedValues?.length ? column.allowedValues.join(', ') : <span className="font-sans text-ink-3">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Índices" meta={table.indexes?.length ? `${table.indexes.length}` : undefined}>
        {table.indexes?.length ? (
          <table className="w-full text-[13px]">
            <tbody>
              {table.indexes.map((index) => (
                <tr key={index.name} className="last:[&>td]:border-b-0">
                  <td className={`${TD} w-[45%] font-mono text-[12.5px]`}>{index.name}</td>
                  <td className={`${TD} font-mono text-[12px] text-ink-2`}>{index.columns.join(', ')}</td>
                  <td className={`${TD} text-right`}>{index.unique && <Badge>Único</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-[13px] text-ink-3">Sin índices secundarios (la clave primaria no se lista).</p>
        )}
      </Panel>
    </div>
  );
}

export default function EsquemaPage() {
  const { user } = useAuth();
  const { connections, error: connectionsError } = useConnections();
  const [connectionId, setConnectionId] = useState('postgres');
  const [schemas, setSchemas] = useState<Record<string, SchemaInfo>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // Si la conexión elegida ya no existe, se usa la primera.
  const connection = connections?.find((c) => c.id === connectionId) ?? connections?.[0] ?? null;
  const selectedId = connection?.id;
  const schema = selectedId ? schemas[selectedId] : undefined;
  const error = (selectedId ? errors[selectedId] : undefined) ?? connectionsError;

  // Cada esquema se pide una vez por visita; cambiar de conexión no lo vuelve a pedir.
  useEffect(() => {
    if (!user || !selectedId || schema || error) return;
    let cancelled = false;
    apiFetch<SchemaInfo>(`/getSchema?connectionId=${encodeURIComponent(selectedId)}`, user)
      .then((s) => {
        if (!cancelled) setSchemas((prev) => ({ ...prev, [selectedId]: s }));
      })
      .catch((err) => {
        if (!cancelled) setErrors((prev) => ({ ...prev, [selectedId]: err instanceof Error ? err.message : String(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [user, selectedId, schema, error]);

  const tables = (schema?.tables ?? []).filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const current = schema?.tables.find((t) => t.name === selected) ?? tables[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Esquema"
        description="Tablas, columnas, claves e índices de cada base de datos, tal como los recibe el modelo al generar SQL."
        actions={
          connections &&
          connection && (
            <ConnectionSelector
              connections={connections}
              value={connection.id}
              onChange={(c) => {
                setConnectionId(c.id);
                setSelected(null);
              }}
            />
          )
        }
      />

      {error && <Notice tone="bad">{error}</Notice>}

      {!schema && !error && (
        <p className="text-[13px] text-ink-3">
          {connections && !connection ? 'No hay conexiones registradas.' : `Leyendo el esquema${connection ? ` de ${connection.name}` : ''}…`}
        </p>
      )}

      {schema && (
        <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-6">
          <Panel title="Tablas" meta={`${schema.tables.length} · ${schema.database}`}>
            <div className="border-b border-line p-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar"
                aria-label="Filtrar tablas"
                className="h-7 w-full rounded-sm border border-line-strong bg-canvas px-2 text-[13px] placeholder:text-ink-3 focus:border-accent-500 focus:outline-none"
              />
            </div>
            <ul className="max-h-[65vh] overflow-auto py-1">
              {tables.map((table) => {
                const active = table.name === current?.name;
                return (
                  <li key={table.name}>
                    <button
                      onClick={() => setSelected(table.name)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[12.5px] ${
                        active ? 'bg-accent-50 text-accent-800' : 'text-ink hover:bg-surface'
                      }`}
                    >
                      <span className="truncate">{table.name}</span>
                      <span className="tabular font-sans text-[11.5px] text-ink-3">{table.columns.length}</span>
                    </button>
                  </li>
                );
              })}
              {tables.length === 0 && <li className="px-3 py-2 text-[12px] text-ink-3">Ninguna tabla coincide.</li>}
            </ul>
          </Panel>

          {current ? <TableDetail table={current} /> : <EmptyState title="Seleccione una tabla." />}
        </div>
      )}
    </div>
  );
}
