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
];

const KEYWORD_PATTERN = new RegExp(`\\b(${WRITE_OR_ADMIN_KEYWORDS.join('|')})\\b`, 'i');
const STORED_PROC_PATTERN = /\b(sp_|xp_)\w*/i;
const COMMENT_PATTERN = /(--|\/\*|\*\/|#)/;
const LEADING_ALLOWED_PATTERN = /^\s*\(*\s*(SELECT|WITH)\b/i;
const SET_COMBINATOR_BEFORE = /(UNION\s+ALL|UNION|INTERSECT|EXCEPT|MINUS)\s*$/i;

function stripTrailingSemicolon(sql: string): string {
  const trimmed = sql.trim();
  return trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
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

  // Sentencias apiladas: un ";" en medio de la consulta indica más de una sentencia.
  if (body.includes(';')) {
    return { safe: false, reason: 'Solo se permite una única sentencia SQL (sin ";" intermedios).' };
  }

  if (COMMENT_PATTERN.test(body)) {
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

  const keywordMatch = body.match(KEYWORD_PATTERN);
  if (keywordMatch) {
    return { safe: false, reason: `Palabra clave no permitida detectada: "${keywordMatch[0]}".` };
  }

  const spMatch = body.match(STORED_PROC_PATTERN);
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
