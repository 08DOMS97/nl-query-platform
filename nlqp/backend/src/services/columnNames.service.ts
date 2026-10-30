/**
 * Nombres legibles para las columnas que el motor nombra solo (26/10, pedido de David).
 *
 * Una expresión sin alias recibe un nombre distinto en cada motor: SQL Server la deja
 * sin nombre, Postgres usa el de la función (`count`, `sum`) o `?column?`, y
 * MySQL/MariaDB el texto de la expresión (`COUNT(shipment_id)`). Ninguno sirve al
 * usuario final, así que se reemplaza por uno derivado de la expresión: `COUNT(*)` →
 * `cantidad`, `SUM(o.total)` → `suma_total`, etc. Los nombres que escribió quien hizo
 * la consulta (alias o columna) no se tocan.
 *
 * Se lee solo la lista del SELECT exterior. Si no se puede alinear con las columnas del
 * resultado (un `*`, otra cantidad de elementos), solo se nombran las que llegaron sin
 * nombre. Las columnas se reciben por posición, así que dos expresiones sin alias no se
 * mezclan aunque el motor les diera el mismo nombre.
 */

const UNNAMED = new Set(['', '?column?']);

type Token = { text: string; upper: string; kind: 'word' | 'quoted' | 'string' | 'number' | 'symbol' };

function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (ch === '/' && sql[i + 1] === '*') { const end = sql.indexOf('*/', i + 2); i = end < 0 ? sql.length : end + 2; continue; }
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) { if (sql[j] === "'" && sql[j + 1] === "'") j += 2; else if (sql[j] === "'") break; else j++; }
      out.push({ text: sql.slice(i, j + 1), upper: '', kind: 'string' });
      i = j + 1;
      continue;
    }
    if (ch === '"' || ch === '`' || ch === '[') {
      const close = ch === '[' ? ']' : ch;
      const end = sql.indexOf(close, i + 1);
      const j = end < 0 ? sql.length : end;
      const name = sql.slice(i + 1, j);
      out.push({ text: name, upper: name.toUpperCase(), kind: 'quoted' });
      i = j + 1;
      continue;
    }
    const word = /^[A-Za-z_À-ɏ@#][\wÀ-ɏ@#$]*/.exec(sql.slice(i));
    if (word) { out.push({ text: word[0], upper: word[0].toUpperCase(), kind: 'word' }); i += word[0].length; continue; }
    const num = /^\d+(\.\d+)?/.exec(sql.slice(i));
    if (num) { out.push({ text: num[0], upper: num[0], kind: 'number' }); i += num[0].length; continue; }
    out.push({ text: ch, upper: ch, kind: 'symbol' });
    i++;
  }
  return out;
}

const SELECT_LIST_END = new Set(['FROM', 'INTO', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'UNION', 'EXCEPT', 'INTERSECT', 'LIMIT', 'FETCH', 'OFFSET', 'FOR', 'WINDOW']);

/** Elementos de la lista del SELECT exterior (el primero a nivel 0, después de los CTE). */
function outerSelectItems(sql: string): Token[][] | null {
  const tokens = tokenize(sql);
  let depth = 0;
  let start = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.text === '(') depth++;
    else if (t.text === ')') depth--;
    else if (depth === 0 && t.kind === 'word' && t.upper === 'SELECT') { start = i + 1; break; }
  }
  if (start < 0) return null;

  // DISTINCT / ALL / TOP n [PERCENT] [WITH TIES] no son parte de las columnas.
  let i = start;
  for (;;) {
    const u = tokens[i]?.kind === 'word' ? tokens[i].upper : '';
    if (u === 'DISTINCT' || u === 'ALL') { i++; continue; }
    if (u === 'TOP') {
      i++;
      if (tokens[i]?.text === '(') { let d = 0; do { if (tokens[i].text === '(') d++; else if (tokens[i].text === ')') d--; i++; } while (i < tokens.length && d > 0); }
      else i++;
      if (tokens[i]?.upper === 'PERCENT') i++;
      if (tokens[i]?.upper === 'WITH' && tokens[i + 1]?.upper === 'TIES') i += 2;
      continue;
    }
    break;
  }

  const items: Token[][] = [];
  let current: Token[] = [];
  depth = 0;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.text === '(') depth++;
    else if (t.text === ')') { if (depth === 0) break; depth--; }
    else if (depth === 0 && t.text === ';') break;
    else if (depth === 0 && t.kind === 'word' && SELECT_LIST_END.has(t.upper)) break;
    else if (depth === 0 && t.text === ',') { items.push(current); current = []; continue; }
    current.push(t);
  }
  items.push(current);
  return items.some((it) => it.length === 0) ? null : items;
}

const isIdent = (t: Token | undefined) => !!t && (t.kind === 'word' || t.kind === 'quoted');

/** El elemento ya trae nombre propio: un alias o una columna (`c.name`). */
function hasOwnName(item: Token[]): boolean {
  const last = item[item.length - 1];
  // `alias = expresión` (SQL Server)
  if (isIdent(item[0]) && item[1]?.text === '=' && item.length > 2) return true;
  // columna sola, con o sin calificador: a.b.c
  if (item.every((t, k) => (k % 2 === 0 ? isIdent(t) : t.text === '.'))) return item.length % 2 === 1;
  if (!isIdent(last)) return false;
  const prev = item[item.length - 2];
  if (prev?.kind === 'word' && prev.upper === 'AS') return true;
  // alias implícito: `COUNT(*) total`, `o.total monto` (pero no `CASE ... END`)
  if (last.kind === 'word' && last.upper === 'END') return false;
  return !!prev && (prev.text === ')' || isIdent(prev) || prev.kind === 'string' || prev.kind === 'number');
}

const AGGREGATE_NAMES: Record<string, string> = {
  COUNT: 'cantidad',
  COUNT_BIG: 'cantidad',
  SUM: 'suma',
  AVG: 'promedio',
  MAX: 'maximo',
  MIN: 'minimo',
};
/** Funciones que envuelven el valor sin cambiar de qué se trata: se mira su primer argumento. */
const WRAPPERS = new Set(['ROUND', 'COALESCE', 'ISNULL', 'IFNULL', 'NVL', 'CAST', 'CONVERT', 'TRY_CAST', 'ABS', 'FLOOR', 'CEILING', 'CEIL', 'TRUNC', 'TRUNCATE']);

/** Primer argumento de la función que abre en `tokens[open]` (el `(`). */
function firstArgument(tokens: Token[], open: number): Token[] {
  const arg: Token[] = [];
  let depth = 0;
  for (let i = open + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.text === '(') depth++;
    else if (t.text === ')') { if (depth === 0) break; depth--; }
    else if (depth === 0 && (t.text === ',' || (t.kind === 'word' && t.upper === 'AS'))) break;
    arg.push(t);
  }
  return arg;
}

function simplify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Nombre para una expresión sin alias; `null` si no se reconoce. */
function nameFromExpression(item: Token[]): string | null {
  let expr = item;
  // CONVERT(tipo, valor) lleva el valor en el segundo argumento: se resuelve como genérico.
  while (expr.length > 2 && expr[0].kind === 'word' && WRAPPERS.has(expr[0].upper) && expr[1].text === '(' && expr[0].upper !== 'CONVERT') {
    expr = firstArgument(expr, 1);
  }
  if (expr.length > 2 && expr[0].kind === 'word' && AGGREGATE_NAMES[expr[0].upper] && expr[1].text === '(') {
    const base = AGGREGATE_NAMES[expr[0].upper];
    if (base === 'cantidad') return base;
    let arg = firstArgument(expr, 1);
    if (arg[0]?.kind === 'word' && arg[0].upper === 'DISTINCT') arg = arg.slice(1);
    const simple = arg.every((t, k) => (k % 2 === 0 ? isIdent(t) : t.text === '.')) && arg.length % 2 === 1;
    const column = simple ? simplify(arg[arg.length - 1].text) : '';
    return column ? `${base}_${column}` : base;
  }
  return null;
}

const squash = (s: string) => s.replace(/[\s`"[\]]/g, '').toUpperCase();

/**
 * El motor inventó el nombre (no se pisa uno que tenga sentido, como el `total` que
 * Postgres da a `total::numeric`): vacío o `?column?`, el texto de la expresión
 * (MySQL/MariaDB) o el nombre de la función o del CASE de afuera (Postgres).
 */
function isInventedName(reported: string, item: Token[]): boolean {
  if (UNNAMED.has(reported.trim())) return true;
  if (squash(reported) === squash(item.map((t) => t.text).join(''))) return true;
  const head = item[0];
  return head.kind === 'word' && reported.toLowerCase() === head.text.toLowerCase() &&
    (item[1]?.text === '(' || head.upper === 'CASE');
}

/**
 * Nombres finales de las columnas de un resultado. `reported` son los que dio el motor,
 * en orden. Los repetidos que provienen de nombres propios se dejan como están (los
 * rechaza el control de columnas duplicadas); los generados aquí nunca se repiten.
 */
export function readableColumnNames(sql: string, reported: string[]): string[] {
  const items = outerSelectItems(sql);
  const aligned = items !== null && items.length === reported.length && !items.some((it) => it.length === 1 && it[0].text === '*') &&
    !items.some((it) => it.length >= 3 && it[it.length - 1].text === '*' && it[it.length - 2].text === '.');

  const generated: (string | null)[] = reported.map((name, k) => {
    if (aligned) {
      const item = items![k];
      if (hasOwnName(item) || !isInventedName(name, item)) return null;
      return nameFromExpression(item) ?? 'valor';
    }
    return UNNAMED.has(name.trim()) ? 'valor' : null;
  });

  const taken = new Set(reported.filter((_, k) => generated[k] === null));
  const counts = new Map<string, number>();
  return reported.map((name, k) => {
    const base = generated[k];
    if (base === null) return name;
    let candidate = base;
    let n = counts.get(base) ?? 1;
    while (taken.has(candidate)) candidate = `${base}_${++n}`;
    counts.set(base, n);
    taken.add(candidate);
    return candidate;
  });
}
