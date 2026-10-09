import type { QuerySafetyResult } from '../types/index.js';

/**
 * RF-07 — Query Safety Engine.
 *
 * Única barrera que decide si un SQL generado por el modelo se ejecuta. Nunca debe
 * asumirse que el modelo "solo genera SELECT": esta validación es obligatoria antes
 * de cualquier ejecución, incluso contra la cuenta de BD de pruebas (que tiene
 * permisos amplios a propósito — ver INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §2).
 *
 * Estrategia: whitelist estricta (debe ser un único SELECT/WITH) + blacklist de
 * palabras clave de escritura/administración como defensa en profundidad.
 */

const WRITE_OR_ADMIN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'MERGE',
  'CALL',
  'INTO',
  'REPLACE',
  'RENAME',
  'LOCK',
  'UNLOCK',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'BACKUP',
  'RESTORE',
  'DBCC',
  'SHUTDOWN',
  'KILL',
  'BULK',
  'OPENROWSET',
  'OPENQUERY',
  'OUTFILE',
  'DUMPFILE',
  'OPENDATASOURCE',
  'WAITFOR',
];

/**
 * Funciones que, aun dentro de un SELECT, leen archivos del servidor, ejecutan SQL
 * recibido como texto, modifican estado o bloquean recursos. Ninguna tiene uso
 * legítimo en una consulta de negocio. Hoy los permisos de `testuser` ya frenan la
 * lectura de archivos (ver SEGURIDAD.md §10), pero el validador no puede depender
 * de los permisos de la cuenta.
 *
 * Las que ejecutan SQL recibido como texto (`query_to_xml`, `ts_stat`, `dblink`, …)
 * son críticas desde que las palabras clave se buscan fuera de los literales: el
 * SQL escondido en el literal no se ve.
 */
const FORBIDDEN_FUNCTIONS = [
  // PostgreSQL — archivos del servidor y large objects
  'pg_read_file',
  'pg_read_binary_file',
  'pg_stat_file',
  'pg_ls_\\w+',
  'pg_file_\\w+',
  'lo_\\w+',
  // PostgreSQL — ejecutan SQL recibido como texto
  'query_to_xml\\w*',
  'cursor_to_xml\\w*',
  'ts_stat',
  'ts_rewrite',
  'dblink\\w*',
  // PostgreSQL — administración, estado, bloqueos
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'pg_switch_wal',
  'pg_create_restore_point',
  'pg_logical_emit_message',
  'pg_advisory\\w*',
  'pg_try_advisory\\w*',
  'pg_notify',
  'set_config',
  'pg_sleep\\w*',
  'nextval',
  'setval',
  // MySQL / MariaDB
  'load_file',
  'sleep',
  'benchmark',
  'get_lock',
  'release_lock',
  'release_all_locks',
  'master_pos_wait',
  'source_pos_wait',
  // SQL Server — lectura de archivos del servidor
  'fn_xe_file_target_read_file',
  'fn_get_audit_file',
  'fn_trace_gettable',
  'fn_dblog',
  'fn_dump_dblog',
];

const KEYWORD_PATTERN = new RegExp(`\\b(${WRITE_OR_ADMIN_KEYWORDS.join('|')})\\b`, 'i');
const FORBIDDEN_FUNCTION_PATTERN = new RegExp(`\\b(${FORBIDDEN_FUNCTIONS.join('|')})\\s*\\(`, 'i');
const STORED_PROC_PATTERN = /\b(sp_|xp_)\w*/i;
const COMMENT_PATTERN = /(--|\/\*|\*\/|#)/;
const LEADING_ALLOWED_PATTERN = /^\s*\(*\s*(SELECT|WITH)\b/i;
const SET_COMBINATOR_BEFORE = /(UNION\s+ALL|UNION|INTERSECT|EXCEPT|MINUS)\s*$/i;

function stripTrailingSemicolon(sql: string): string {
  const trimmed = sql.trim();
  return trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
}

/**
 * Reemplaza por espacios el contenido de los literales entre comillas simples, para
 * que `WHERE name = 'Update Corp'` o `'a;b'` no se bloqueen por palabras o
 * caracteres que, dentro de un literal, son solo texto (SEGURIDAD.md §9).
 *
 * Solo es seguro si el validador y el motor coinciden exactamente en dónde empieza
 * y termina cada literal: si no, el validador "ve" como texto algo que el motor
 * ejecuta como código (p. ej. `"it's", load_file('x'), "x'y"` en MySQL esconde la
 * función si no se siguen las comillas dobles). Por eso:
 *   - Las comillas dobles y los backticks se siguen (una `'` adentro no abre
 *     literal) pero NO se enmascaran: se validan completos. Los 4 motores coinciden
 *     en dónde terminan (`""` como escape); fuera de MySQL, un backtick es error de
 *     sintaxis, así que no hay desacuerdo explotable.
 *   - Se devuelve `null` (validar el texto completo, modo estricto) ante los casos
 *     en que los motores NO coinciden:
 *       `\` — MySQL/MariaDB lo tratan como escape (`'a\'b'` es UN literal);
 *             PostgreSQL/SQL Server no.
 *       `$` — PostgreSQL admite literales `$$...$$` / `$tag$...$tag$`, dentro de
 *             los cuales una `'` no abre nada.
 *       `[` — identificador en SQL Server (`[it's]`), subíndice de arreglo en
 *             PostgreSQL (`arr[']']` contiene un literal).
 * Los comentarios no hace falta modelarlos: validador y motor coinciden hasta el
 * primer `--`, `/*` o `#`, que queda fuera de todo literal y lo bloquea
 * `COMMENT_PATTERN` sobre el texto enmascarado.
 */
function maskStringLiterals(body: string): string | null {
  if (/[\\$[]/.test(body)) return null;

  let out = '';
  let quote: "'" | '"' | '`' | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote === null) {
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      out += ch;
      continue;
    }
    if (ch === quote) {
      if (body[i + 1] === quote) { // comilla duplicada = escapada, sigue adentro
        out += quote === "'" ? '  ' : ch + ch;
        i++;
        continue;
      }
      quote = null;
      out += ch;
      continue;
    }
    out += quote === "'" ? ' ' : ch;
  }
  // Literal sin cerrar: el motor lo rechazará, pero ante la duda, modo estricto.
  return quote === null ? out : null;
}

/**
 * Detecta sentencias "apiladas" sin ";" — un caso real que el chequeo de ";" no
 * cubre. T-SQL (SQL Server), a diferencia de PostgreSQL/MySQL/MariaDB, no exige
 * ";" entre sentencias de un mismo batch: "SELECT ... \n SELECT ..." se ejecuta
 * como dos sentencias válidas. El driver `mssql` solo devuelve el primer
 * recordset, así que basta con poner la consulta sensible PRIMERO para
 * exfiltrarla igual — se comprobó en vivo contra el banco de pruebas (filtró
 * email/teléfono de los 200 clientes vía /executeQuery sin usar ";").
 *
 * Se recorre el SQL sin usar un parser completo, solo lo necesario para ubicar
 * ocurrencias de SELECT/WITH a nivel superior (fuera de paréntesis y de cadenas
 * de texto) y exigir que cualquier ocurrencia además de la primera venga
 * precedida por un operador de conjunto (UNION/INTERSECT/EXCEPT), que es la
 * única forma legítima de tener más de un SELECT de nivel superior en una sola
 * sentencia.
 */
function hasUnauthorizedStackedStatement(body: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBracket = false; // identificador [entre corchetes] de SQL Server
  let inBacktick = false; // identificador `entre backticks` de MySQL/MariaDB
  let seenTopLevelSelect = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (inSingleQuote) {
      if (ch === "'") {
        if (body[i + 1] === "'") { i++; continue; } // '' escapado dentro del literal
        inSingleQuote = false;
      }
      continue;
    }
    if (inDoubleQuote) {
      if (ch === '"') inDoubleQuote = false;
      continue;
    }
    if (inBracket) {
      if (ch === ']') inBracket = false;
      continue;
    }
    if (inBacktick) {
      if (ch === '`') inBacktick = false;
      continue;
    }

    if (ch === "'") { inSingleQuote = true; continue; }
    if (ch === '"') { inDoubleQuote = true; continue; }
    if (ch === '[') { inBracket = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth--; continue; }

    if (depth === 0 && /^SELECT\b/i.test(body.slice(i))) {
      if (!seenTopLevelSelect) {
        seenTopLevelSelect = true;
      } else if (!SET_COMBINATOR_BEFORE.test(body.slice(0, i))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Valida que `sql` sea una única sentencia SELECT (o CTE `WITH ... SELECT`) de
 * solo lectura. Devuelve `{ safe: false, reason }` ante cualquier duda — nunca
 * se ejecuta SQL cuando el resultado es ambiguo.
 */
export function validateQuerySafety(sql: string): QuerySafetyResult {
  if (!sql || !sql.trim()) {
    return { safe: false, reason: 'La consulta SQL está vacía.' };
  }

  const body = stripTrailingSemicolon(sql);
  // Texto sobre el que se buscan ";", comentarios, palabras y funciones prohibidas:
  // sin el contenido de los literales cuando es seguro, el texto completo si no.
  const code = maskStringLiterals(body) ?? body;

  // Sentencias apiladas: un ";" en medio de la consulta indica más de una sentencia.
  if (code.includes(';')) {
    return { safe: false, reason: 'Solo se permite una única sentencia SQL (sin ";" intermedios).' };
  }

  if (COMMENT_PATTERN.test(code)) {
    return { safe: false, reason: 'No se permiten comentarios SQL en la consulta.' };
  }

  if (!LEADING_ALLOWED_PATTERN.test(body)) {
    return { safe: false, reason: 'La consulta debe iniciar con SELECT o WITH (CTE).' };
  }

  if (hasUnauthorizedStackedStatement(body)) {
    return {
      safe: false,
      reason:
        'Se detectó más de una sentencia SELECT de nivel superior sin un operador de ' +
        'conjunto (UNION/INTERSECT/EXCEPT) — posible batch apilado sin ";" (válido en T-SQL).',
    };
  }

  const keywordMatch = code.match(KEYWORD_PATTERN);
  if (keywordMatch) {
    return { safe: false, reason: `Palabra clave no permitida detectada: "${keywordMatch[0]}".` };
  }

  const functionMatch = code.match(FORBIDDEN_FUNCTION_PATTERN);
  if (functionMatch) {
    return { safe: false, reason: `Función no permitida detectada: "${functionMatch[1]}".` };
  }

  const spMatch = code.match(STORED_PROC_PATTERN);
  if (spMatch) {
    return { safe: false, reason: `Llamada a procedimiento/función del sistema no permitida: "${spMatch[0]}".` };
  }

  return { safe: true };
}

/** Lanza si la consulta no es segura. Punto único de aplicación antes de ejecutar. */
export function assertQuerySafety(sql: string): void {
  const result = validateQuerySafety(sql);
  if (!result.safe) {
    throw new Error(`Query Safety Engine bloqueó la consulta: ${result.reason}`);
  }
}
