/**
 * Controles de `/generateSQL` alrededor de la llamada al modelo (24/10/2026, pedido
 * de David). No reemplazan al Query Safety Engine, que sigue siendo la única
 * garantía de que solo se ejecuta SELECT: estos controles evitan gastar en una
 * llamada que no corresponde y que el resultado recorte datos sin que se pida.
 *
 * Antes de llamar al modelo (sin costo):
 *   - la pregunta tiene un largo máximo;
 *   - si la "pregunta" ya es SQL, se rechaza: la función traduce lenguaje natural.
 *
 * Después de llamar al modelo:
 *   - si el SQL limita las filas (LIMIT, TOP, FETCH FIRST/NEXT) y la pregunta no pide
 *     una cantidad ni un máximo o mínimo, no se entrega: el resultado sería parcial y
 *     se vería como completo (regla de CLAUDE.md: nunca truncar en silencio).
 */

export const MAX_QUESTION_CHARS = 1000;

/** Sentencias con las que empieza un texto que ya es SQL. */
const SQL_STATEMENT_START =
  /^\s*\(*\s*(select|with\s+\w+\s+as\s*\(|insert\s+into|update\s+\w+|delete\s+from|merge\s+into|drop\s+(table|view|database|index)|create\s+(table|view|database|index)|alter\s+table|truncate\s+table|exec(ute)?\s|declare\s+@|grant\s|revoke\s|call\s+\w+\s*\()/i;

/** Cláusulas de SQL que no aparecen juntas en una pregunta en español. */
const SQL_CLAUSES: RegExp[] = [
  /\bselect\b/i,
  /\bfrom\s+[\w.[\]`"]+/i,
  /\bwhere\b/i,
  /\b(inner|left|right|full|cross)?\s*join\b/i,
  /\bgroup\s+by\b/i,
  /\border\s+by\b/i,
  /\bhaving\b/i,
  /\blimit\s+\d/i,
  /\btop\s*\(?\s*\d/i,
  /\bunion\b/i,
  /\b(count|sum|avg|min|max)\s*\(/i,
];

/**
 * ¿El texto es SQL y no una pregunta? Se rechaza si empieza como una sentencia o si
 * junta tres o más cláusulas de SQL. Ninguna de las 50 preguntas de referencia ni de
 * sus paráfrasis lo cumple (lo prueba `scripts/pruebas/api_generacion.mjs`).
 */
export function looksLikeSql(text: string): boolean {
  if (SQL_STATEMENT_START.test(text)) return true;
  return SQL_CLAUSES.filter((re) => re.test(text)).length >= 3;
}

/** Quita literales de texto y comentarios para no confundir "LIMIT" dentro de una cadena. */
function withoutLiteralsAndComments(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const ROW_LIMIT_PATTERNS: RegExp[] = [
  /\blimit\s+\d+/i,
  /\btop\s*(\(\s*\d+\s*\)|\d+)(\s+percent)?/i,
  /\bfetch\s+(first|next)\s+\d*\s*rows?\s+only\b/i,
];

/** El límite de filas que tiene el SQL (p. ej. "LIMIT 10"), o null si no tiene. */
export function findRowLimit(sql: string): string | null {
  const code = withoutLiteralsAndComments(sql);
  for (const re of ROW_LIMIT_PATTERNS) {
    const m = code.match(re);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }
  return null;
}

const NUMBER_WORDS =
  'dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinticinco|treinta|cuarenta|cincuenta|cien|docena';

/**
 * Palabras con las que una pregunta pide una cantidad o un extremo: "los 5…", "diez…",
 * "top", "el que más…", "el de mayor…", "los últimos…". Es deliberadamente amplio:
 * dejar pasar un límite pedido con otras palabras es peor que dejar pasar uno no
 * pedido, porque la regla del prompt ya prohíbe agregarlos.
 */
const REQUESTS_LIMIT = new RegExp(
  `\\d|\\b(${NUMBER_WORDS})\\b|\\b(top|ranking|primer[oa]?s?|[uú]ltim[oa]s?|mayor(es)?|menor(es)?|mejor(es)?|peor(es)?|m[aá]xim[oa]s?|m[ií]nim[oa]s?|m[aá]s|menos|reciente(s)?|antigu[oa]s?|nuev[oa]s?|viej[oa]s?)\\b`,
  'i',
);

export function questionRequestsRowLimit(question: string): boolean {
  return REQUESTS_LIMIT.test(question);
}
