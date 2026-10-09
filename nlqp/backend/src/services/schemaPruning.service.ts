import type { ForeignKeyInfo, SchemaInfo, TableInfo } from '../types/index.js';

/**
 * Selecciona el subconjunto de tablas relevante para una consulta en lenguaje
 * natural, para no enviar el esquema completo como contexto al modelo. Con 8
 * tablas (el dataset de pruebas) el ahorro de tokens es modesto, pero el
 * mecanismo debe quedar listo para esquemas grandes (cientos de tablas), donde
 * enviar el esquema completo es inviable en costo y en precisión del modelo.
 *
 * Estrategia (rediseñada el 09/10/2026, ver PREPARACION_EVALUACION_GEMINI.md §8, 2f):
 *  1. Núcleo: las tablas que la consulta nombra (sustantivo principal del nombre de
 *     la tabla: `orders` → "order", `order_items` → "item"), más las tablas que
 *     tienen una columna *distintiva* nombrada en la consulta: un término que
 *     aparece en una o dos tablas ("transportista" → `shipments.carrier`; "país"
 *     → `customers.country` y `addresses.country`, se envían ambas). Términos que
 *     están en tres o más tablas ("estado", "fecha", "nombre") no deciden nada
 *     por sí solos. Ante la duda se envía una tabla de más: una tabla de menos
 *     hace que el modelo no pueda escribir la consulta correcta.
 *  2. Conexión: si el núcleo tiene varias tablas, se agregan solo las tablas que
 *     están en el camino más corto de FKs entre ellas ("clientes" + "productos"
 *     → `orders` y `order_items` para poder unirlas).
 *  3. Si ninguna tabla coincide (consulta muy genérica o vocabulario no
 *     reconocido), se devuelve el esquema completo — fail-open, nunca se oculta
 *     esquema por error.
 *
 * La versión anterior expandía un salto por FK alrededor de toda tabla con
 * alguna coincidencia. En este banco `orders` está conectada con casi todo, así
 * que se enviaban 5–8 tablas para preguntas de 1–2; además, "clientes" nunca
 * coincidía (se singularizaba a "client" antes de buscar el sinónimo).
 */

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'a', 'al', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'que', 'en', 'por', 'para', 'con', 'sin', 'su', 'sus', 'es', 'son',
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'is', 'are',
  'to', 'by',
]);

/** Columnas genéricas que nunca identifican una tabla por sí mismas. */
const GENERIC_COLUMN_TOKENS = new Set(['id']);

/** Un término de columna es distintivo si aparece en a lo sumo esta cantidad de tablas. */
const MAX_TABLES_PER_DISTINCTIVE_TOKEN = 2;

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return normalizeToken(text)
    // "en total" es una muletilla ("¿cuántos clientes hay en total?"), no la
    // columna `orders.total`.
    .replace(/\ben total\b/g, ' ')
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Quita plural simple en/es (naive, suficiente para coincidencia léxica en es/en). */
function singularize(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return token.slice(0, -3) + 'y'; // categories
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * El esquema (nombres de tabla/columna) está en inglés, pero las consultas en
 * lenguaje natural del usuario son en español (ver ejemplos en el README del
 * banco de pruebas). Sin esta traducción, la coincidencia léxica nunca encuentra
 * nada y el pruning siempre cae en fail-open (esquema completo). El mapa cubre el
 * vocabulario de dominio del dataset de e-commerce; se amplía según el dominio de
 * cada cliente en producción.
 *
 * Se busca tanto la palabra tal cual como su forma singularizada, porque la
 * singularización ingenua rompe algunas palabras ("clientes" → "client").
 *
 * Vocabulario de negocio → tablas: una venta, un gasto, un ingreso o una compra
 * son pedidos (`order`), y por la regla de dominio de `domainRules.service.ts`
 * siempre hace falta `orders` para excluir los cancelados. "Vendido", "comprado"
 * o "unidades" hablan además de las líneas del pedido (`item`).
 */
const ES_EN_SYNONYMS: Record<string, string | string[]> = {
  cliente: 'customer', clientes: 'customer', comprador: 'customer', compradores: 'customer',
  pedido: 'order', pedidos: 'order', orden: 'order', ordenes: 'order',
  venta: 'order', ventas: 'order', vendio: 'order', vender: 'order',
  gasto: 'order', gastos: 'order', gastado: 'order', gastan: 'order',
  ingreso: 'order', ingresos: 'order', facturado: 'order', facturacion: 'order',
  compra: 'order', compras: 'order', ticket: 'order',
  vendido: ['order', 'item'], vendidos: ['order', 'item'], vendida: ['order', 'item'],
  vendidas: ['order', 'item'], comprado: ['order', 'item'], comprados: ['order', 'item'],
  comprada: ['order', 'item'], compradas: ['order', 'item'], unidades: ['order', 'item'],
  producto: 'product', productos: 'product',
  categoria: 'category', categorias: 'category',
  pago: 'payment', pagos: 'payment', pagado: 'payment', pagados: 'payment',
  envio: 'shipment', envios: 'shipment', enviado: 'shipment', enviados: 'shipment',
  entregado: 'shipment', entregados: 'shipment',
  direccion: 'address', direcciones: 'address',
  articulo: 'item', articulos: 'item', linea: 'item', lineas: 'item',
  precio: 'price', precios: 'price',
  cantidad: 'quantity', existencia: 'stock', existencias: 'stock', inventario: 'stock',
  agotado: 'stock', agotados: 'stock',
  correo: 'email', nombre: 'name', apellido: 'name',
  ciudad: 'city', pais: 'country', estado: 'status',
  fecha: 'date', descuento: 'discount', impuesto: 'tax', metodo: 'method',
  telefono: 'phone', nacimiento: 'birth', registro: 'registration',
  transportista: 'carrier', rastreo: 'tracking', entrega: 'delivery',
  subtotal: 'subtotal',
};

function queryTokens(naturalLanguageQuery: string): Set<string> {
  const out = new Set<string>();
  for (const raw of tokenize(naturalLanguageQuery)) {
    for (const t of new Set([raw, singularize(raw)])) {
      out.add(t);
      const en = ES_EN_SYNONYMS[t];
      if (en) for (const e of Array.isArray(en) ? en : [en]) out.add(e);
    }
  }
  return out;
}

/** Sustantivo principal de la tabla: `orders` → "order", `order_items` → "item". */
function tableNoun(table: TableInfo): string {
  const parts = table.name.split('_');
  return singularize(normalizeToken(parts[parts.length - 1]));
}

function columnTokens(name: string): string[] {
  return name
    .split('_')
    .map((p) => singularize(normalizeToken(p)))
    .filter((t) => t.length > 2 && !GENERIC_COLUMN_TOKENS.has(t));
}

/** Término de columna → tablas que lo tienen (sin PK ni FK: no describen la tabla). */
function columnTokenIndex(schema: SchemaInfo): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (col.isPrimaryKey || col.isForeignKey) continue;
      for (const t of columnTokens(col.name)) {
        if (!index.has(t)) index.set(t, new Set());
        index.get(t)!.add(table.name);
      }
    }
  }
  return index;
}

function adjacency(foreignKeys: ForeignKeyInfo[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const fk of foreignKeys) {
    link(fk.table, fk.referencesTable);
    link(fk.referencesTable, fk.table);
  }
  return adj;
}

/** Camino más corto (BFS) desde `from` hasta cualquier tabla de `targets`, sin incluir `from`. */
function shortestPathTo(from: string, targets: Set<string>, adj: Map<string, Set<string>>): string[] {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current !== from && targets.has(current)) {
      const path: string[] = [];
      for (let n: string | null = current; n !== null && n !== from; n = prev.get(n) ?? null) path.push(n);
      return path;
    }
    for (const next of adj.get(current) ?? []) {
      if (!prev.has(next)) {
        prev.set(next, current);
        queue.push(next);
      }
    }
  }
  return [];
}

/** Agrega las tablas intermedias mínimas para que el núcleo quede conectado por FKs. */
function connect(core: string[], foreignKeys: ForeignKeyInfo[]): Set<string> {
  const adj = adjacency(foreignKeys);
  const connected = new Set([core[0]]);
  for (const table of core.slice(1)) {
    if (connected.has(table)) continue;
    // Si no hay camino (tablas sin relación), la tabla igual se envía.
    for (const t of shortestPathTo(table, connected, adj)) connected.add(t);
    connected.add(table);
  }
  return connected;
}

export interface PruneOptions {
  /** Número máximo de tablas a conservar tras la conexión. */
  maxTables?: number;
}

export function pruneSchema(
  schema: SchemaInfo,
  naturalLanguageQuery: string,
  options: PruneOptions = {},
): SchemaInfo {
  const { maxTables = 20 } = options;
  const tokens = queryTokens(naturalLanguageQuery);

  if (tokens.size === 0) {
    return schema;
  }

  const core = new Set<string>();
  for (const table of schema.tables) {
    if (tokens.has(tableNoun(table))) core.add(table.name);
  }
  for (const [token, tables] of columnTokenIndex(schema)) {
    if (tables.size <= MAX_TABLES_PER_DISTINCTIVE_TOKEN && tokens.has(token)) {
      for (const name of tables) core.add(name);
    }
  }

  if (core.size === 0) {
    // No hubo coincidencias léxicas: mejor enviar el esquema completo que arriesgar
    // omitir una tabla que el modelo sí necesita.
    return schema;
  }

  // Orden estable (el del esquema) para que el resultado no dependa del recorrido.
  const coreOrdered = schema.tables.map((t) => t.name).filter((n) => core.has(n));
  const connected = connect(coreOrdered, schema.foreignKeys);
  const finalNames = new Set(
    schema.tables.map((t) => t.name).filter((n) => connected.has(n)).slice(0, maxTables),
  );

  const tables = schema.tables.filter((t) => finalNames.has(t.name));
  const foreignKeys = schema.foreignKeys.filter(
    (fk) => finalNames.has(fk.table) && finalNames.has(fk.referencesTable),
  );

  return { ...schema, tables, foreignKeys };
}
