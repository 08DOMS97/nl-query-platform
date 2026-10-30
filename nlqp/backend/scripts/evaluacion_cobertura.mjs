/**
 * Cobertura de dos métricas de la tesis que la evaluación principal no midió tal como
 * están escritas (29/10/2026):
 *  - Consistencia por repetición (3.3.1.4): diez consultas del conjunto en tres
 *    ejecuciones independientes. La primera es la de la evaluación (resultados.jsonl);
 *    aquí se generan la segunda y la tercera.
 *  - Robustez lingüística (3.3.1.2): las mismas diez consultas en tres variantes. La
 *    primera es la paráfrasis ya evaluada; aquí se generan la segunda (otro orden y
 *    formalidad) y la tercera (más específica).
 * Las diez consultas se eligieron de forma sistemática: una de cada cinco del conjunto
 * (posiciones 1, 6, 11, …, 46). En los 4 motores: 160 llamadas a Gemini.
 *
 *   npm run build; node --env-file=.env scripts/evaluacion_cobertura.mjs [--max-costo 1]
 *
 * Guarda cada caso en docs/evaluacion_gemini/cobertura.jsonl apenas lo obtiene y nunca
 * repite una generación pagada. Compara cada resultado con la referencia escrita a mano
 * (misma comparación que evaluacion_gemini.mjs: exacto / columnas_extra / distinto).
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const OUT = path.join(DOCS, 'evaluacion_gemini/cobertura.jsonl');
const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const MOTORES = ['postgres', 'mysql', 'mariadb', 'mssql'];
const args = process.argv.slice(2);
const MAX_COSTO = Number(args[args.indexOf('--max-costo') + 1] || 1);

const VARIANTES = {
  S01: ['Necesito saber el total de clientes registrados en el sistema', 'Número total de clientes en la base de datos'],
  S06: ['En el catálogo, ¿cuántas categorías de productos están registradas?', 'Cantidad total de categorías de producto'],
  S11: ['¿Cuáles fueron los cinco últimos pedidos realizados?', 'Lista los 5 pedidos con la fecha de pedido más reciente'],
  M01: ['Por cada categoría, ¿cuántos productos tiene registrados?', 'Número de productos en cada una de las categorías, incluidas las que no tengan productos'],
  M06: ['Necesito la lista de productos que no se han vendido nunca', '¿Qué productos no tienen ninguna venta registrada?'],
  M11: ['Por país, ¿cuántos clientes tenemos?', 'Número de clientes agrupados por país'],
  M16: ['Por categoría, ¿cuál es el valor total del inventario?', 'Valor del inventario de cada categoría, calculado como precio por existencias'],
  C01: ['¿Cuál es el cliente con el gasto total más alto y a cuánto asciende?', 'Muestra el nombre del cliente que más dinero ha gastado en sus compras y el monto total'],
  C06: ['Muestra los pedidos en los que el total no coincide con subtotal más impuestos más envío', 'Lista los pedidos cuyo total sea diferente de la suma de subtotal, impuesto y costo de envío'],
  C11: ['Dentro de la categoría con más ventas, ¿cuáles son los tres productos más vendidos?', 'Top 3 de productos por unidades vendidas en la categoría que más dinero ha vendido'],
};

const refs = JSON.parse(readFileSync(path.join(DOCS, 'consultas_prueba_50.json'), 'utf8'));
const elegidas = refs.filter((_, i) => i % 5 === 0);
if (elegidas.map((q) => q.id).join() !== Object.keys(VARIANTES).join()) throw new Error('La selección sistemática no coincide con las variantes escritas.');

const casos = [];
for (const q of elegidas) {
  for (const motor of MOTORES) {
    const base = { id: q.id, categoria: q.category, motor, sqlReferencia: q.overrides?.[motor] ?? q.sql };
    casos.push({ ...base, tipo: 'repeticion', n: 2, nl: q.nl });
    casos.push({ ...base, tipo: 'repeticion', n: 3, nl: q.nl });
    casos.push({ ...base, tipo: 'variante', n: 2, nl: VARIANTES[q.id][0] });
    casos.push({ ...base, tipo: 'variante', n: 3, nl: VARIANTES[q.id][1] });
  }
}
const clave = (c) => `${c.id}|${c.tipo}|${c.n}|${c.motor}`;

let token, tokenEn = 0;
async function login() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com', password: process.env.NLQP_TEST_USER_PASSWORD, returnSecureToken: true }),
  });
  token = (await r.json()).idToken; tokenEn = Date.now();
}
async function api(m, ruta, body) {
  if (!token || Date.now() - tokenEn > 50 * 60_000) await login();
  const r = await fetch(BASE + ruta, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-NLQP-Origin': 'evaluacion' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(300_000) });
  return { status: r.status, data: await r.json() };
}
async function ejecutar(motor, sql) {
  const t0 = Date.now();
  const e = await api('POST', '/executeQuery', { engine: motor, sql });
  if (e.status !== 200) return { ok: false, status: e.status, error: e.data.reason ?? e.data.error, latenciaMs: Date.now() - t0 };
  const filas = [...e.data.rows];
  for (let p = 2; p <= e.data.totalPages; p++) filas.push(...(await api('GET', `/getResultPage?resultId=${encodeURIComponent(e.data.resultId)}&page=${p}`)).data.rows);
  return { ok: true, columnas: e.data.columns, filas, latenciaMs: Date.now() - t0 };
}

function norm(v) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v.trim()))) { const n = Math.round(Number(v) * 100) / 100; return String(Object.is(n, -0) ? 0 : n); }
  const s = String(v).trim(); const f = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z$/); return f ? f[1] : s;
}
const multi = (r, cols) => r.filas.map((f) => cols.map((c) => norm(f[c])).sort().join('\u0001')).sort();
const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const vec = (r, c) => r.filas.map((f) => norm(f[c])).sort();
const huella = (r) => createHash('sha1').update(multi(r, r.columnas).join('\n')).digest('hex').slice(0, 12);
function comparar(ref, gen) {
  if (iguales(multi(ref, ref.columnas), multi(gen, gen.columnas))) return { veredicto: 'exacto' };
  if (ref.filas.length !== gen.filas.length) return { veredicto: 'distinto', motivo: `filas ${gen.filas.length} vs ${ref.filas.length}` };
  const usadas = new Set(); const corr = []; const faltan = [];
  for (const cr of ref.columnas) {
    const cg = gen.columnas.find((c) => !usadas.has(c) && iguales(vec(ref, cr), vec(gen, c)));
    if (cg) { usadas.add(cg); corr.push([cr, cg]); } else faltan.push(cr);
  }
  const extra = gen.columnas.filter((c) => !usadas.has(c));
  if (!faltan.length && iguales(multi(ref, ref.columnas), multi(gen, corr.map(([, g]) => g)))) return { veredicto: 'columnas_extra', extra };
  // Mismos registros en las columnas comunes, pero falta alguna de la referencia: revisión manual.
  if (corr.length && iguales(multi(ref, corr.map(([r]) => r)), multi(gen, corr.map(([, g]) => g)))) return { veredicto: 'distinto', faltan, extra, mismasFilasEnComunes: true };
  return { veredicto: 'distinto', faltan, extra };
}

const hechos = new Map();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); hechos.set(clave(r), r); }
let gasto = [...hechos.values()].reduce((s, r) => s + (r.generacion?.metrics?.costUsd ?? 0), 0);
const pendientes = casos.filter((c) => !hechos.get(clave(c))?.generacion?.ok).length;
console.log(`${casos.length} casos, ${pendientes} generaciones pendientes, gasto previo $${gasto.toFixed(4)}, tope $${MAX_COSTO}`);

const refCache = new Map();
for (const c of casos) {
  const k = clave(c);
  if (hechos.get(k)?.comparacion) continue;
  const r = hechos.get(k) ?? { ...c, sqlReferencia: undefined, fecha: new Date().toISOString() };
  if (!r.generacion?.ok) {
    if (gasto >= MAX_COSTO) { console.log(`Tope de $${MAX_COSTO} alcanzado.`); process.exit(2); }
    const t0 = Date.now();
    let g;
    try { g = await api('POST', '/generateSQL', { engine: c.motor, naturalLanguageQuery: c.nl }); } catch (err) { g = { status: 0, data: { error: String(err) } }; }
    r.generacion = g.status === 200 ? { ok: true, sql: g.data.sql, metrics: g.data.metrics, ms: Date.now() - t0 } : { ok: false, status: g.status, error: g.data.error, metrics: g.data.metrics, ms: Date.now() - t0 };
    gasto += r.generacion.metrics?.costUsd ?? 0;
    appendFileSync(OUT, JSON.stringify(r) + '\n');
    if (!r.generacion.ok) { console.log(`${k}: falló la generación (${r.generacion.status}) ${String(r.generacion.error).slice(0, 120)}`); continue; }
  }
  const kr = `${c.motor}|${c.sqlReferencia}`;
  if (!refCache.has(kr)) refCache.set(kr, await ejecutar(c.motor, c.sqlReferencia));
  const ref = refCache.get(kr);
  const gen = await ejecutar(c.motor, r.generacion.sql);
  r.ejecucion = gen.ok ? { ok: true, filas: gen.filas.length, latenciaMs: gen.latenciaMs, huella: huella(gen), columnas: gen.columnas } : gen;
  r.comparacion = gen.ok ? comparar(ref, gen) : { veredicto: gen.status === 403 ? 'bloqueada' : 'error_ejecucion' };
  appendFileSync(OUT, JSON.stringify(r) + '\n');
  console.log(`${k}: ${r.comparacion.veredicto} · ${r.generacion.ms} ms · $${(r.generacion.metrics?.costUsd ?? 0).toFixed(4)}`);
}
console.log(`Gasto total de la cobertura: $${gasto.toFixed(4)}`);
