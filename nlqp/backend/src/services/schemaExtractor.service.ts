import { runQuery, readEngineConfig } from './connectionManager.service.js';
import type { ColumnInfo, DbEngine, ForeignKeyInfo, SchemaInfo, TableInfo } from '../types/index.js';

interface RawColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface RawKeyRow {
  table_name: string;
  column_name: string;
}

interface RawFkRow {
  table_name: string;
  column_name: string;
  references_table: string;
  references_column: string;
}

/**
 * Sentencias de introspección por motor. Cada una lee las vistas de sistema propias
 * del dialecto (información normalizada en §3 de INSTRUCCIONES_INICIALES_CLAUDE_CODE.md)
 * y se traduce después a la representación única `SchemaInfo`.
 */
const QUERIES: Record<DbEngine, { columns: string; primaryKeys: string; foreignKeys: string }> = {
  postgres: {
    columns: `
      SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position`,
    primaryKeys: `
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'`,
    // Nota: NO se usa information_schema.constraint_column_usage — esa vista solo
    // muestra columnas cuyo dueño sea el rol actual, y en el banco de pruebas las
    // tablas las crea el rol admin (postgres), no testuser (ver §2 de
    // INSTRUCCIONES_INICIALES_CLAUDE_CODE.md). pg_constraint es un catálogo de
    // sistema sin esa restricción de propiedad y funciona con cualquier rol con
    // acceso de lectura al esquema.
    foreignKeys: `
      SELECT
        conrelid::regclass::text AS table_name,
        a.attname AS column_name,
        confrelid::regclass::text AS references_table,
        af.attname AS references_column
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
      JOIN unnest(c.confkey) WITH ORDINALITY AS cfk(attnum, ord) ON cfk.ord = ck.ord
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
      JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = cfk.attnum
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`,
  },
  mysql: {
    columns: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    primaryKeys: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'`,
    foreignKeys: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
             REFERENCED_TABLE_NAME AS references_table, REFERENCED_COLUMN_NAME AS references_column
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  },
  // Mismo dialecto de information_schema que MySQL.
  mariadb: {
    columns: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    primaryKeys: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'`,
    foreignKeys: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
             REFERENCED_TABLE_NAME AS references_table, REFERENCED_COLUMN_NAME AS references_column
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  },
  mssql: {
    columns: `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    primaryKeys: `
      SELECT tc.TABLE_NAME AS table_name, kcu.COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_SCHEMA = 'dbo'`,
    foreignKeys: `
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.COLUMN_NAME AS column_name,
        ccu.TABLE_NAME AS references_table,
        ccu.COLUMN_NAME AS references_column
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
        ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
       AND rc.UNIQUE_CONSTRAINT_SCHEMA = ccu.CONSTRAINT_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY' AND tc.TABLE_SCHEMA = 'dbo'`,
  },
};

function toBool(isNullable: string): boolean {
  return String(isNullable).toUpperCase() === 'YES';
}

/** Extrae e introspecciona el esquema completo de `engine` y lo normaliza. */
export async function extractSchema(engine: DbEngine): Promise<SchemaInfo> {
  const q = QUERIES[engine];

  const [columnsResult, pkResult, fkResult] = await Promise.all([
    runQuery(engine, q.columns),
    runQuery(engine, q.primaryKeys),
    runQuery(engine, q.foreignKeys),
  ]);

  const columnRows = columnsResult.rows as unknown as RawColumnRow[];
  const pkRows = pkResult.rows as unknown as RawKeyRow[];
  const fkRows = fkResult.rows as unknown as RawFkRow[];

  const pkSet = new Set(pkRows.map((r) => `${r.table_name}.${r.column_name}`));
  const fkByColumn = new Map<string, RawFkRow>(
    fkRows.map((r) => [`${r.table_name}.${r.column_name}`, r]),
  );

  const tablesByName = new Map<string, TableInfo>();
  for (const row of columnRows) {
    if (!tablesByName.has(row.table_name)) {
      tablesByName.set(row.table_name, { name: row.table_name, columns: [] });
    }
    const key = `${row.table_name}.${row.column_name}`;
    const fk = fkByColumn.get(key);
    const column: ColumnInfo = {
      name: row.column_name,
      dataType: row.data_type,
      nullable: toBool(row.is_nullable),
      isPrimaryKey: pkSet.has(key),
      isForeignKey: Boolean(fk),
      referencesTable: fk?.references_table,
      referencesColumn: fk?.references_column,
      defaultValue: row.column_default ?? null,
    };
    tablesByName.get(row.table_name)!.columns.push(column);
  }

  const foreignKeys: ForeignKeyInfo[] = fkRows.map((r) => ({
    table: r.table_name,
    column: r.column_name,
    referencesTable: r.references_table,
    referencesColumn: r.references_column,
  }));

  return {
    engine,
    database: readEngineConfig(engine).database,
    tables: Array.from(tablesByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys,
  };
}
