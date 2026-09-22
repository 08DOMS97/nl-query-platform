import type { ForeignKeyInfo, SchemaInfo, TableInfo } from '../types/index.js';

/**
 * Selecciona el subconjunto de tablas relevante para una consulta en lenguaje
 * natural, para no enviar el esquema completo como contexto al modelo. Con 8
 * tablas (el dataset de pruebas) el ahorro de tokens es modesto, pero el
 * mecanismo debe quedar listo para esquemas grandes (cientos de tablas), donde
 * enviar el esquema completo es inviable en costo y en precisión del modelo.
 *
 * Estrategia:
 *  1. Puntuar cada tabla por coincidencia léxica de su nombre/columnas contra la
 *     consulta en lenguaje natural.
 *  2. Tomar las tablas con puntuación > 0 como núcleo.
 *  3. Expandir un salto a través de las FK para preservar rutas de JOIN entre
 *     tablas relacionadas que el usuario no nombró explícitamente
 *     (p. ej. "ventas por cliente" solo menciona "cliente" pero necesita `orders`).
 *  4. Si ninguna tabla puntúa (consulta muy genérica o vocabulario no reconocido),
 *     se devuelve el esquema completo — fail-open, nunca se oculta esquema por error.
 */

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'a', 'al', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'que', 'en', 'por', 'para', 'con', 'sin', 'su', 'sus', 'es', 'son',
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'is', 'are',
  'to', 'by',
]);

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/)
    .map(normalizeToken)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Quita plural simple en/es/es (naive, suficiente para coincidencia léxica en es/en). */
function singularize(token: string): string {
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * El esquema (nombres de tabla/columna) está en inglés, pero las consultas en
 * lenguaje natural del usuario son en español (ver ejemplos en el README del
 * banco de pruebas). Sin esta traducción, la coincidencia léxica nunca encuentra
 * nada y el pruning siempre cae en fail-open (esquema completo) — inofensivo con
 * 8 tablas, pero inútil como mecanismo en un esquema grande. El mapa cubre el
 * vocabulario de dominio del dataset de e-commerce; se amplía según el dominio
 * de cada cliente en producción.
 */
const ES_EN_SYNONYMS: Record<string, string> = {
  cliente: 'customer', clientes: 'customer',
  pedido: 'order', pedidos: 'order', orden: 'order', ordenes: 'order',
  producto: 'product', productos: 'product',
  categoria: 'category', categorias: 'category',
  pago: 'payment', pagos: 'payment',
  envio: 'shipment', envios: 'shipment',
  direccion: 'address', direcciones: 'address',
  articulo: 'item', articulos: 'item', linea: 'item', lineas: 'item',
  gastado: 'total', gasto: 'total', gastos: 'total', venta: 'total', ventas: 'total',
  precio: 'price', precios: 'price',
  cantidad: 'quantity', existencia: 'stock', existencias: 'stock', inventario: 'stock',
  correo: 'email', nombre: 'name', apellido: 'name',
  ciudad: 'city', pais: 'country', estado: 'status',
  fecha: 'date', descuento: 'discount', impuesto: 'tax', metodo: 'method',
  telefono: 'phone', nacimiento: 'birth', registro: 'registration',
  transportista: 'carrier', rastreo: 'tracking', entrega: 'delivery',
  subtotal: 'subtotal',
};

function expandWithSynonyms(tokens: string[]): string[] {
  const expanded = [...tokens];
  for (const t of tokens) {
    const en = ES_EN_SYNONYMS[t];
    if (en) expanded.push(en);
  }
  return expanded;
}

function scoreTable(table: TableInfo, queryTokens: Set<string>): number {
  let score = 0;
  const tableTokens = new Set([
    singularize(normalizeToken(table.name)),
    ...table.name.split('_').map((p) => singularize(normalizeToken(p))),
  ]);
  for (const t of tableTokens) {
    if (queryTokens.has(t)) score += 3;
  }
  for (const col of table.columns) {
    const colTokens = col.name.split('_').map((p) => singularize(normalizeToken(p)));
    for (const t of colTokens) {
      if (t.length > 2 && queryTokens.has(t)) score += 1;
    }
  }
  return score;
}

function expandOneHop(coreTableNames: Set<string>, foreignKeys: ForeignKeyInfo[]): Set<string> {
  const expanded = new Set(coreTableNames);
  for (const fk of foreignKeys) {
    if (coreTableNames.has(fk.table)) expanded.add(fk.referencesTable);
    if (coreTableNames.has(fk.referencesTable)) expanded.add(fk.table);
  }
  return expanded;
}

export interface PruneOptions {
  /** Número máximo de tablas a conservar tras la expansión. */
  maxTables?: number;
}

export function pruneSchema(
  schema: SchemaInfo,
  naturalLanguageQuery: string,
  options: PruneOptions = {},
): SchemaInfo {
  const { maxTables = 20 } = options;
  const baseTokens = tokenize(naturalLanguageQuery).map(singularize);
  const queryTokens = new Set(expandWithSynonyms(baseTokens));

  if (queryTokens.size === 0) {
    return schema;
  }

  const scored = schema.tables
    .map((table) => ({ table, score: scoreTable(table, queryTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // No hubo coincidencias léxicas: mejor enviar el esquema completo que arriesgar
    // omitir una tabla que el modelo sí necesita.
    return schema;
  }

  const coreNames = new Set(scored.map((s) => s.table.name));
  const expandedNames = expandOneHop(coreNames, schema.foreignKeys);
  const finalNames = new Set(Array.from(expandedNames).slice(0, maxTables));

  const tables = schema.tables.filter((t) => finalNames.has(t.name));
  const foreignKeys = schema.foreignKeys.filter(
    (fk) => finalNames.has(fk.table) && finalNames.has(fk.referencesTable),
  );

  return { ...schema, tables, foreignKeys };
}
