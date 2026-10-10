/**
 * Regresión del Query Safety Engine (SEGURIDAD.md §11). Obligatoria ante cualquier
 * cambio a `querySafety.service.ts` (ver CLAUDE.md, "Reglas que no hay que romper").
 *
 *   npm run test:seguridad            batería + 50 consultas × 4 motores
 *   npm run test:seguridad -- --solo-bateria   sin tocar las bases (no requiere Docker)
 *
 * 1. Batería: casos que DEBEN bloquearse y consultas legítimas que NO deben
 *    bloquearse (falsos positivos). Solo valida, no ejecuta nada.
 * 2. Las 50 consultas de referencia (`nlqp/docs/consultas_prueba_50.json`, con sus
 *    `overrides` por motor): cada una pasa por `validateQuerySafety()` y recién
 *    entonces se ejecuta con `runQuery()`. Se compara el contenido entre motores
 *    (filas y valores normalizados, sin importar orden ni alias; antes del 10/10
 *    solo se comparaba el número de filas y eso ocultó 6 diferencias reales).
 *    motores. No llama a Vertex AI ni a Firebase.
 *
 * Usa el código compilado (`lib/`): el script de npm corre `tsc` antes.
 * Termina con código 1 si algo falla.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuerySafety } from '../lib/services/querySafety.service.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const soloBateria = process.argv.includes('--solo-bateria');

// [descripción, sql]
const DEBEN_BLOQUEARSE = [
  // Modificación de datos (DML)
  ['INSERT', "INSERT INTO customers (first_name) VALUES ('x')"],
  ['UPDATE', "UPDATE customers SET email = 'x'"],
  ['DELETE', 'DELETE FROM orders'],
  ['MERGE', 'MERGE INTO orders USING customers ON 1 = 1 WHEN MATCHED THEN DELETE'],
  // Definición de estructura (DDL) y permisos
  ['DROP', 'DROP TABLE customers'],
  ['CREATE', 'CREATE TABLE t (id int)'],
  ['ALTER', 'ALTER TABLE customers ADD c int'],
  ['TRUNCATE', 'TRUNCATE TABLE orders'],
  ['GRANT', 'GRANT ALL ON customers TO public'],
  // Sentencias encadenadas
  ['encadenada con ;', 'SELECT * FROM customers; DROP TABLE customers'],
  ['encadenada con ; (DELETE)', 'SELECT 1; DELETE FROM orders'],
  ['apilada sin ; (T-SQL, SEGURIDAD §1)', 'SELECT email, phone FROM customers\nSELECT * FROM orders'],
  ['DML dentro de CTE', 'WITH x AS (DELETE FROM orders RETURNING *) SELECT * FROM x'],
  ['SELECT INTO', 'SELECT * INTO copia FROM customers'],
  // Sistema de archivos del servidor
  ['INTO OUTFILE (MySQL)', "SELECT * FROM customers INTO OUTFILE '/tmp/x'"],
  ['OPENROWSET BULK (SQL Server)', "SELECT * FROM OPENROWSET(BULK 'C:/x', SINGLE_CLOB) AS t"],
  ['pg_read_file (SEGURIDAD §10)', "SELECT pg_read_file('/etc/passwd')"],
  ['pg_ls_dir', "SELECT pg_ls_dir('.')"],
  ['lo_import', "SELECT lo_import('/etc/passwd')"],
  ['LOAD_FILE (SEGURIDAD §10)', "SELECT LOAD_FILE('/etc/passwd')"],
  ['fn_xe_file_target_read_file (SQL Server)', "SELECT * FROM sys.fn_xe_file_target_read_file('C:/x*.xel', NULL, NULL, NULL)"],
  // Procedimientos del sistema
  ['xp_cmdshell', "EXEC xp_cmdshell 'dir'"],
  ['sp_executesql dentro de SELECT', "SELECT 1 FROM customers WHERE 1 = sp_executesql('x')"],
  // Funciones que ejecutan SQL recibido como texto: el SQL escondido en el literal
  // no se ve, así que la función misma tiene que bloquearse
  ['query_to_xml', "SELECT query_to_xml('DELETE FROM orders RETURNING *', true, false, '')"],
  ['ts_stat', "SELECT * FROM ts_stat('SELECT 1')"],
  ['dblink', "SELECT * FROM dblink('dbname=x', 'DELETE FROM orders') AS t(a int)"],
  // Estado, bloqueos, demoras
  ['pg_sleep', 'SELECT pg_sleep(100)'],
  ['SLEEP (MySQL)', 'SELECT SLEEP(100)'],
  ['WAITFOR (SQL Server)', "SELECT 1 WAITFOR DELAY '00:01:00'"],
  ['set_config', "SELECT set_config('search_path', 'x', false)"],
  ['nextval', "SELECT nextval('orders_order_id_seq')"],
  ['pg_terminate_backend', 'SELECT pg_terminate_backend(1)'],
  // Mayúsculas/minúsculas mezcladas
  ['dElEtE', 'dElEtE fRoM orders'],
  ['DrOp', 'DrOp TaBlE customers'],
  ['Pg_Read_File', "SELECT Pg_Read_File('x')"],
  // Comentarios
  ['comentario --', 'SELECT * FROM customers -- x'],
  ['comentario /* */', 'SELECT * FROM customers /* x */'],
  // Intentos de desincronizar el enmascarado de literales (SEGURIDAD §9): en cada
  // uno, el validador vería como texto algo que el motor ejecuta como código
  ['comilla dentro de "..." (MySQL)', `SELECT "it's", LOAD_FILE('/etc/passwd'), "x'y"`],
  ['comilla dentro de `...` (MySQL)', "SELECT `it's`, LOAD_FILE('/etc/passwd'), `x'y` FROM customers"],
  ['escape \\\' (MySQL)', "SELECT 'a\\', LOAD_FILE('/etc/passwd'), '' FROM customers"],
  ['literal $$ (PostgreSQL)', "SELECT $$'$$, pg_read_file('/etc/passwd'), $$'$$"],
  ['subíndice [\'] (PostgreSQL)', "SELECT (ARRAY[']'])[1], pg_read_file('/etc/passwd'), ']'"],
  ['; escondido tras comilla en comentario', "SELECT 1 /* ' */ ; DELETE FROM orders /* ' */"],
  ['literal sin cerrar', "SELECT 'abc FROM customers; DROP TABLE customers"],
];

const NO_DEBEN_BLOQUEARSE = [
  ['UNION', 'SELECT customer_id FROM customers UNION SELECT customer_id FROM orders'],
  ['CTE', 'WITH t AS (SELECT 1 AS a) SELECT a FROM t'],
  ['palabra clave en literal (SEGURIDAD §9)', "SELECT * FROM customers WHERE first_name = 'Update Corp'"],
  ['LIKE con palabra clave', "SELECT * FROM products WHERE name LIKE '%Replace%'"],
  ['varias palabras clave en literal', "SELECT * FROM customers WHERE email = 'drop table; delete'"],
  ['; dentro de literal', "SELECT 'a;b' AS x"],
  ['-- y # dentro de literal', "SELECT * FROM products WHERE name = 'Modelo #1 -- edición'"],
  ["comilla escapada ''", "SELECT * FROM customers WHERE last_name = 'O''Brien'"],
  ['función en literal', "SELECT * FROM products WHERE name = 'sleep(5)'"],
  ['identificador con comillas dobles', 'SELECT "first_name" FROM customers'],
  ['TOP (SQL Server)', 'SELECT TOP 5 * FROM customers ORDER BY customer_id'],
  ['columnas tipo created_at', 'SELECT created_at, updated_at FROM customers'],
  ['punto y coma final', 'SELECT 1;'],
];

let fallos = 0;
for (const [desc, sql] of DEBEN_BLOQUEARSE) {
  const r = validateQuerySafety(sql);
  if (r.safe) { fallos++; console.log(`  ✗ NO BLOQUEADA — ${desc}: ${JSON.stringify(sql)}`); }
}
for (const [desc, sql] of NO_DEBEN_BLOQUEARSE) {
  const r = validateQuerySafety(sql);
  if (!r.safe) { fallos++; console.log(`  ✗ FALSO POSITIVO — ${desc}: ${JSON.stringify(sql)} (${r.reason})`); }
}
const total = DEBEN_BLOQUEARSE.length + NO_DEBEN_BLOQUEARSE.length;
console.log(
  `Batería: ${total - fallos}/${total} ` +
    `(${DEBEN_BLOQUEARSE.length} deben bloquearse, ${NO_DEBEN_BLOQUEARSE.length} legítimas)`,
);

if (!soloBateria) {
  const { runQuery, closeAllPools } = await import('../lib/services/connectionManager.service.js');
  const consultas = JSON.parse(
    readFileSync(path.join(dir, '../../docs/consultas_prueba_50.json'), 'utf8'),
  );
  const motores = ['postgres', 'mysql', 'mariadb', 'mssql'];
  // Misma normalización que el runner de evaluación (evaluacion_gemini.mjs).
  const normalizar = (v) => {
    if (v === null || v === undefined) return '∅';
    if (v instanceof Date) v = v.toISOString();
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v.trim()))) {
      const n = Math.round(Number(v) * 100) / 100;
      return String(Object.is(n, -0) ? 0 : n);
    }
    return String(v).trim();
  };
  const contenido = (rows) =>
    rows.map((f) => Object.values(f).map(normalizar).sort().join('\u0001')).sort().join('\n');
  let ok = 0;
  const inconsistentes = [];
  for (const q of consultas) {
    const filas = {};
    for (const motor of motores) {
      const sql = q.overrides?.[motor] ?? q.sql;
      const v = validateQuerySafety(sql);
      if (!v.safe) {
        filas[motor] = 'BLOQUEADA';
        console.log(`  ✗ ${q.id} ${motor}: bloqueada (${v.reason})`);
        continue;
      }
      try {
        const { rows } = await runQuery(motor, sql);
        filas[motor] = `${rows.length} filas #${createHash('sha1').update(contenido(rows)).digest('hex').slice(0, 8)}`;
        ok++;
      } catch (err) {
        filas[motor] = 'ERROR';
        console.log(`  ✗ ${q.id} ${motor}: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (new Set(Object.values(filas)).size > 1) inconsistentes.push(`${q.id} ${JSON.stringify(filas)}`);
  }
  await closeAllPools();
  const totalEj = consultas.length * motores.length;
  console.log(`Consultas de prueba: ${ok}/${totalEj} ejecuciones OK, ${inconsistentes.length} inconsistentes entre motores`);
  for (const linea of inconsistentes) console.log(`  ✗ ${linea}`);
  fallos += totalEj - ok + inconsistentes.length;
}

process.exit(fallos === 0 ? 0 : 1);
