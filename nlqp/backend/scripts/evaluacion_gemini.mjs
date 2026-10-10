/**
 * Runner de la evaluación con Gemini (PREPARACION_EVALUACION_GEMINI.md §8, punto 6).
 *
 * Usa el sistema completo por HTTP, igual que el frontend: Firebase Auth →
 * `/generateSQL` (poda + Gemini) → `/executeQuery` (Query Safety Engine + motor) →
 * `/getResultPage`. Las llamadas van marcadas con `X-NLQP-Origin: evaluacion` para
 * que no se mezclen con el uso normal en `/getUsageStats`.
 *
 *   npm run eval:gemini -- --modo prueba                gratis: usa el SQL de referencia en vez de Gemini
 *   npm run eval:gemini -- --modo piloto --confirmar    5 consultas × 4 motores (PAGA, ~$0,25)
 *   npm run eval:gemini -- --modo completa --confirmar  50 consultas × 4 motores (PAGA, ~$2,40)
 *   npm run eval:gemini -- --resumen                    solo regenera resumen.md, sin llamadas
 *
 * Opciones: --parafrasis (agrega las de parafrasis_50.json; exige "estado": "revisada"),
 * --ids S10,M03, --motores postgres,mssql, --max-costo 6, --reintentar-fallidas,
 * --url http://localhost:8080.
 *
 * Nunca repite una llamada pagada: cada resultado se agrega a
 * `nlqp/docs/evaluacion_gemini/resultados.jsonl` apenas se obtiene, y al volver a
 * correr se saltan las generaciones ya hechas (el piloto cuenta para la corrida
 * completa). Si solo falló la ejecución o la comparación, se rehacen con el SQL ya
 * guardado, sin llamar a Gemini. Una generación fallida no se reintenta salvo con
 * --reintentar-fallidas (puede haberse facturado).
 *
 * Requiere el backend corriendo (`npm run dev`, recompilado) y Docker levantado.
 * Precisión = el resultado del SQL generado coincide con el del SQL de referencia
 * (execution accuracy, como Spider/BIRD), no el texto.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(dir, '../../docs');
const OUT_DIR = path.join(DOCS, 'evaluacion_gemini');

const MOTORES = ['postgres', 'mysql', 'mariadb', 'mssql'];
const PILOTO = ['S10', 'S13', 'M03', 'M05', 'C02'];
const COSTO_ESTIMADO_POR_LLAMADA = 0.012;
const TOKEN_VIDA_MS = 50 * 60 * 1000; // el ID token de Firebase dura 1 h
const ESPERAS_REINTENTO_MS = [5_000, 15_000, 45_000, 90_000];

// ---------------------------------------------------------------- argumentos

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, def) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};

const soloResumen = flag('resumen');
const modo = opt('modo', soloResumen ? null : undefined);
if (!soloResumen && !['prueba', 'piloto', 'completa'].includes(modo)) {
  console.error('Uso: --modo prueba|piloto|completa  (o --resumen). Ver el encabezado del script.');
  process.exit(2);
}
const pagado = modo === 'piloto' || modo === 'completa';
const conParafrasis = flag('parafrasis');
const BASE_URL = opt('url', `http://localhost:${process.env.PORT ?? 8080}`);
const maxCosto = Number(opt('max-costo', modo === 'piloto' ? 0.6 : 6));
const motores = opt('motores', MOTORES.join(',')).split(',');
const archivo = path.join(OUT_DIR, modo === 'prueba' ? 'resultados_prueba.jsonl' : 'resultados.jsonl');

// ---------------------------------------------------------------- conjunto

const referencias = JSON.parse(readFileSync(path.join(DOCS, 'consultas_prueba_50.json'), 'utf8'));
const parafrasisDoc = JSON.parse(readFileSync(path.join(DOCS, 'parafrasis_50.json'), 'utf8'));

function construirCasos() {
  const ids = opt('ids', modo === 'piloto' ? PILOTO.join(',') : null)?.split(',');
  const refs = ids ? referencias.filter((q) => ids.includes(q.id)) : referencias;
  if (ids && refs.length !== ids.length) throw new Error(`IDs desconocidos en --ids: ${ids.join(',')}`);

  if (conParafrasis && pagado && parafrasisDoc.estado !== 'revisada') {
    throw new Error('parafrasis_50.json todavía no está revisada (campo "estado"). No se gasta en paráfrasis sin revisar.');
  }
  const casos = [];
  for (const q of refs) {
    for (const motor of motores) {
      const base = { id: q.id, categoria: q.category, motor, sqlReferencia: q.overrides?.[motor] ?? q.sql };
      casos.push({ ...base, variante: 'original', nl: q.nl });
      if (conParafrasis) {
        const p = parafrasisDoc.parafrasis.find((x) => x.id === q.id);
        if (!p || p.original !== q.nl) throw new Error(`Paráfrasis de ${q.id} ausente o desactualizada.`);
        casos.push({ ...base, variante: 'parafrasis', nl: p.nl });
      }
    }
  }
  return casos;
}

const clave = (c) => `${c.id}|${c.variante}|${c.motor}`;

function leerRegistros() {
  if (!existsSync(archivo)) return new Map();
  const porClave = new Map();
  for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
    if (!linea.trim()) continue;
    const r = JSON.parse(linea);
    porClave.set(clave(r), r); // la última línea de cada caso es la vigente
  }
  return porClave;
}

// ---------------------------------------------------------------- HTTP + auth

let token = null;
let tokenObtenidoEn = 0;

async function renovarToken() {
  const email = process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-test@example.com';
  const password = process.env.NLQP_TEST_USER_PASSWORD ?? 'NlqpTest_2026!';
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`No se pudo iniciar sesión (correr antes "npm run test:token"): ${JSON.stringify(data)}`);
  token = data.idToken;
  tokenObtenidoEn = Date.now();
}

async function api(metodo, ruta, cuerpo) {
  if (!token || Date.now() - tokenObtenidoEn > TOKEN_VIDA_MS) await renovarToken();
  for (let intento = 0; ; intento++) {
    const res = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-NLQP-Origin': 'evaluacion',
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (res.status === 401 && intento === 0) {
      await renovarToken();
      continue;
    }
    return { status: res.status, data: await res.json() };
  }
}

/** Errores pasajeros de Vertex AI (cuota, sobrecarga) que no se facturan: se reintentan. */
const esPasajero = (msg) => /\b429\b|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|overloaded|ECONNRESET|fetch failed/i.test(msg ?? '');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function generar(caso) {
  for (let intento = 0; ; intento++) {
    const { status, data } = await api('POST', '/generateSQL', { engine: caso.motor, naturalLanguageQuery: caso.nl });
    if (status === 200) return { ok: true, sql: data.sql, safety: data.safety, metrics: data.metrics, intentos: intento + 1 };
    if (esPasajero(data.error) && intento < ESPERAS_REINTENTO_MS.length) {
      console.log(`    ${caso.motor}: error pasajero, reintento en ${ESPERAS_REINTENTO_MS[intento] / 1000} s`);
      await esperar(ESPERAS_REINTENTO_MS[intento]);
      continue;
    }
    return { ok: false, status, error: data.error ?? JSON.stringify(data), intentos: intento + 1 };
  }
}

/** Ejecuta por `/executeQuery` y trae todas las páginas (nunca se compara un resultado parcial). */
async function ejecutar(motor, sql) {
  const t0 = Date.now();
  const { status, data } = await api('POST', '/executeQuery', { engine: motor, sql });
  if (status !== 200) return { ok: false, status, error: data.reason ?? data.error, latenciaMs: Date.now() - t0 };
  const filas = [...data.rows];
  for (let p = 2; p <= data.totalPages; p++) {
    const pagina = await api('GET', `/getResultPage?resultId=${encodeURIComponent(data.resultId)}&page=${p}`);
    if (pagina.status !== 200) return { ok: false, status: pagina.status, error: pagina.data.error, latenciaMs: Date.now() - t0 };
    filas.push(...pagina.data.rows);
  }
  if (filas.length !== data.totalRows) throw new Error(`Paginación incompleta: ${filas.length} de ${data.totalRows}`);
  return { ok: true, status, columnas: data.columns, filas, latenciaMs: Date.now() - t0 };
}

// ---------------------------------------------------------------- comparación

/**
 * Normaliza un valor para comparar entre SQL distintos del mismo motor: números (o
 * texto numérico, como devuelve `pg` los NUMERIC) redondeados a 2 decimales,
 * booleanos como 1/0, fechas a medianoche como solo fecha.
 */
function normalizar(v) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v.trim()))) {
    const n = Math.round(Number(v) * 100) / 100;
    return String(Object.is(n, -0) ? 0 : n);
  }
  const s = String(v).trim();
  const fecha = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z$/);
  return fecha ? fecha[1] : s;
}

const claveFila = (valores) => [...valores].sort().join('\u0001');
const multiconjunto = (filas, cols) => filas.map((f) => claveFila(cols.map((c) => normalizar(f[c])))).sort();
const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const huella = (filas, cols) => createHash('sha1').update(multiconjunto(filas, cols).join('\n')).digest('hex').slice(0, 12);

/**
 * - exacto: mismas filas (sin importar orden de filas ni de columnas ni alias).
 * - columnas_extra: mismas filas en las columnas de la referencia, más columnas
 *   adicionales (p. ej. el nombre además del id). Se reporta aparte.
 * - empate_posible: la referencia es un "top N" (LIMIT/TOP o ROW_NUMBER/RANK), hay
 *   las mismas filas y alguna columna numérica (el puntaje del ranking) tiene
 *   exactamente los mismos valores: probablemente eligió otros registros empatados
 *   en el corte. No se cuenta como correcto; va a revisión manual.
 * - distinto: cualquier otra cosa (revisión manual: error del modelo o
 *   interpretación válida distinta, ver PREPARACION §2).
 * El orden de las filas no se compara: los empates hacen que "top N" ordenados
 * igual de bien difieran en orden.
 */
function comparar(ref, gen, sqlReferencia) {
  if (iguales(multiconjunto(ref.filas, ref.columnas), multiconjunto(gen.filas, gen.columnas))) return 'exacto';
  if (ref.filas.length !== gen.filas.length) return 'distinto';

  const vector = (res, c) => res.filas.map((f) => normalizar(f[c])).sort();
  const esTopN = /\blimit\s+\d+|\btop\s*\(?\s*\d+|\b(row_number|rank|dense_rank)\s*\(/i.test(sqlReferencia);
  const numerica = (res, c) => res.filas.every((f) => f[c] === null || !Number.isNaN(Number(f[c])));
  const puntajeIgual = ref.columnas.some(
    (cr) => numerica(ref, cr) && gen.columnas.some((cg) => iguales(vector(ref, cr), vector(gen, cg))),
  );
  if (gen.columnas.length <= ref.columnas.length) return esTopN && puntajeIgual ? 'empate_posible' : 'distinto';

  const usadas = new Set();
  const correspondencia = [];
  for (const cr of ref.columnas) {
    const vr = vector(ref, cr);
    const cg = gen.columnas.find((c) => !usadas.has(c) && iguales(vr, vector(gen, c)));
    if (!cg) return esTopN && puntajeIgual ? 'empate_posible' : 'distinto';
    usadas.add(cg);
    correspondencia.push(cg);
  }
  if (iguales(multiconjunto(ref.filas, ref.columnas), multiconjunto(gen.filas, correspondencia))) return 'columnas_extra';
  return esTopN && puntajeIgual ? 'empate_posible' : 'distinto';
}

/** Detección estática de antipatrones de rendimiento (PREPARACION §4). Aproximada: se revisa a mano. */
function antipatrones(sql, sqlReferencia) {
  const s = sql.replace(/'(?:[^']|'')*'/g, "''");
  const encontrados = [];
  if (/\bselect\s+(distinct\s+)?(top\s*\(?\d+\)?\s+)?\*/i.test(s) || /,\s*\w+\.\*/.test(s)) encontrados.push('SELECT *');
  if (/\bnot\s+in\s*\(\s*select\b/i.test(s)) encontrados.push('NOT IN con subconsulta');
  for (const where of s.match(/\bwhere\b[\s\S]*?(?=\bgroup\s+by\b|\border\s+by\b|\bhaving\b|\blimit\b|\)\s*select\b|$)/gi) ?? []) {
    if (/\b(year|month|day|extract|date|datepart|date_format|date_trunc|cast|convert|lower|upper|trunc)\s*\(/i.test(where)) {
      encontrados.push('función sobre columna en WHERE');
      break;
    }
  }
  const limita = (x) => /\blimit\s+\d+|\btop\s*\(?\s*\d+|\bfetch\s+(first|next)\b/i.test(x);
  if (limita(s) && !limita(sqlReferencia)) encontrados.push('LIMIT/TOP no pedido');
  if (/\bselect\s+distinct\b/i.test(s) && !/\bdistinct\b/i.test(sqlReferencia)) encontrados.push('DISTINCT que la referencia no usa');
  return encontrados;
}

// ---------------------------------------------------------------- corrida

async function correr() {
  const casos = construirCasos();
  mkdirSync(OUT_DIR, { recursive: true });
  if (modo === 'prueba') writeFileSync(archivo, '');
  const previos = leerRegistros();

  const necesitaGenerar = (c) => {
    const r = previos.get(clave(c));
    return !r || (!r.generacion?.ok && flag('reintentar-fallidas'));
  };
  const pendientesPagados = modo === 'prueba' ? 0 : casos.filter(necesitaGenerar).length;
  console.log(`Modo ${modo}: ${casos.length} casos, ${pendientesPagados} llamadas a Gemini pendientes` +
    (pagado ? ` (~$${(pendientesPagados * COSTO_ESTIMADO_POR_LLAMADA).toFixed(2)}, tope --max-costo $${maxCosto})` : ' (gratis)'));
  if (pagado && pendientesPagados > 0 && !flag('confirmar')) {
    console.log('Corrida pagada: agregar --confirmar para ejecutarla.');
    return;
  }

  const salud = await fetch(`${BASE_URL}/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`El backend no responde en ${BASE_URL} (npm run dev).`);

  const resultadosReferencia = new Map();
  let costoCorrida = 0;
  let hechos = 0;

  for (const caso of casos) {
    hechos++;
    const previo = previos.get(clave(caso));
    if (previo?.comparacion && !necesitaGenerar(caso)) continue;

    let generacion;
    if (modo === 'prueba') {
      generacion = { ok: true, sql: caso.sqlReferencia, prueba: true };
    } else if (!necesitaGenerar(caso)) {
      generacion = previo.generacion; // ya pagada: se reutiliza el SQL guardado
    } else {
      if (costoCorrida + COSTO_ESTIMADO_POR_LLAMADA > maxCosto) {
        console.log(`Tope de costo alcanzado ($${costoCorrida.toFixed(4)}). Lo hecho quedó guardado; volver a correr para seguir.`);
        break;
      }
      generacion = await generar(caso);
      costoCorrida += generacion.metrics?.costUsd ?? 0;
    }

    const registro = {
      id: caso.id,
      categoria: caso.categoria,
      variante: caso.variante,
      motor: caso.motor,
      nl: caso.nl,
      modelo: modo === 'prueba' ? null : process.env.VERTEX_AI_MODEL ?? null,
      fecha: new Date().toISOString(),
      generacion,
    };

    if (generacion.ok) {
      const claveRef = `${caso.id}|${caso.motor}`;
      if (!resultadosReferencia.has(claveRef)) resultadosReferencia.set(claveRef, await ejecutar(caso.motor, caso.sqlReferencia));
      const ref = resultadosReferencia.get(claveRef);
      if (!ref.ok) throw new Error(`La referencia ${claveRef} falló (${ref.error}): corregir antes de evaluar.`);

      const gen = await ejecutar(caso.motor, generacion.sql);
      registro.ejecucion = gen.ok
        ? { ok: true, filas: gen.filas.length, latenciaMs: gen.latenciaMs, huella: huella(gen.filas, gen.columnas) }
        : { ok: false, status: gen.status, error: gen.error, latenciaMs: gen.latenciaMs };
      registro.comparacion = {
        veredicto: gen.ok ? comparar(ref, gen, caso.sqlReferencia) : gen.status === 403 ? 'bloqueada' : 'error_ejecucion',
        filasReferencia: ref.filas.length,
      };
      registro.antipatrones = antipatrones(generacion.sql, caso.sqlReferencia);
    } else {
      registro.comparacion = { veredicto: 'error_generacion' };
    }

    appendFileSync(archivo, JSON.stringify(registro) + '\n');
    const m = generacion.metrics;
    console.log(`[${hechos}/${casos.length}] ${caso.id} ${caso.variante} ${caso.motor}: ${registro.comparacion.veredicto}` +
      (m ? ` · $${m.costUsd.toFixed(4)} · ${m.latencyMs} ms · ${m.tablesSent}/${m.tablesTotal} tablas` : '') +
      (registro.antipatrones?.length ? ` · ⚠ ${registro.antipatrones.join(', ')}` : ''));
  }

  if (pagado) console.log(`Costo de esta corrida: $${costoCorrida.toFixed(4)}`);
}

// ---------------------------------------------------------------- resumen

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—');
const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const correcto = (r) => ['exacto', 'columnas_extra'].includes(r.comparacion?.veredicto);

function tablaPrecision(titulo, registros, agrupar) {
  const grupos = new Map();
  for (const r of registros) {
    const g = agrupar(r);
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(r);
  }
  const filas = [...grupos].map(([g, rs]) => {
    const exactos = rs.filter((r) => r.comparacion.veredicto === 'exacto').length;
    return `| ${g} | ${rs.length} | ${pct(exactos, rs.length)} | ${pct(rs.filter(correcto).length, rs.length)} |`;
  });
  return [`### ${titulo}`, '', '| Grupo | Casos | Exacto | Exacto + columnas extra |', '|---|---|---|---|', ...filas, ''];
}

function resumen() {
  const ruta = path.join(OUT_DIR, 'resultados.jsonl');
  if (!existsSync(ruta)) {
    console.log('Todavía no hay resultados pagados (resultados.jsonl).');
    return;
  }
  const porClave = new Map();
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    if (linea.trim()) {
      const r = JSON.parse(linea);
      porClave.set(clave(r), r);
    }
  }
  const rs = [...porClave.values()];
  const gen = rs.filter((r) => r.generacion?.ok);
  const metr = gen.map((r) => r.generacion.metrics).filter(Boolean);
  const modelos = [...new Set(rs.map((r) => r.modelo).filter(Boolean))].join(', ');
  const fechas = rs.map((r) => r.fecha).sort();

  // Consistencia entre motores: mismo resultado normalizado en los 4.
  const porPregunta = new Map();
  for (const r of rs) {
    const k = `${r.id}|${r.variante}`;
    if (!porPregunta.has(k)) porPregunta.set(k, []);
    porPregunta.get(k).push(r);
  }
  const completas = [...porPregunta.values()].filter((g) => g.length === MOTORES.length);
  const consistentes = completas.filter((g) => g.every((r) => r.ejecucion?.ok) && new Set(g.map((r) => r.ejecucion.huella)).size === 1);

  // Robustez: paráfrasis vs. original del mismo motor.
  const pares = rs
    .filter((r) => r.variante === 'parafrasis')
    .map((p) => [porClave.get(`${p.id}|original|${p.motor}`), p])
    .filter(([o]) => o);

  const conteo = (f) => rs.filter(f).length;
  const anti = new Map();
  for (const r of gen) for (const a of r.antipatrones ?? []) anti.set(a, (anti.get(a) ?? 0) + 1);

  const lineas = [
    '# Resultados de la evaluación con Gemini',
    '',
    `Generado por \`scripts/evaluacion_gemini.mjs --resumen\` a partir de \`resultados.jsonl\`. No editar a mano.`,
    '',
    `- Modelo: ${modelos || '—'}`,
    `- Período de la corrida: ${fechas[0]?.slice(0, 10) ?? '—'} a ${fechas.at(-1)?.slice(0, 10) ?? '—'}`,
    `- Casos: ${rs.length} (${conteo((r) => r.variante === 'original')} originales, ${conteo((r) => r.variante === 'parafrasis')} paráfrasis)`,
    `- Costo total: $${metr.reduce((a, m) => a + m.costUsd, 0).toFixed(4)} · promedio por llamada $${prom(metr.map((m) => m.costUsd)).toFixed(4)}`,
    '',
    '## Precisión (execution accuracy)',
    '',
    '"Exacto": mismas filas que la referencia. "Columnas extra": mismas filas en las columnas de la referencia, con columnas adicionales. "Empate posible" (top N con el mismo puntaje pero otros registros empatados) y el resto se revisan a mano (abajo); no se cuentan como correctos.',
    '',
    ...tablaPrecision('Por variante', rs, (r) => r.variante),
    ...tablaPrecision('Por categoría (solo originales)', rs.filter((r) => r.variante === 'original'), (r) => r.categoria),
    ...tablaPrecision('Por motor', rs, (r) => r.motor),
    '## Consistencia entre motores',
    '',
    `${consistentes.length} de ${completas.length} preguntas (${pct(consistentes.length, completas.length)}) dan el mismo resultado en los 4 motores.`,
    '',
    '## Robustez lingüística',
    '',
    `Paráfrasis correctas: ${pct(pares.filter(([, p]) => correcto(p)).length, pares.length)} (originales del mismo subconjunto: ${pct(pares.filter(([o]) => correcto(o)).length, pares.length)}). ` +
      `Casos donde la original acierta y la paráfrasis no: ${pares.filter(([o, p]) => correcto(o) && !correcto(p)).length}.`,
    '',
    '## Seguridad',
    '',
    `Consultas generadas bloqueadas por el Query Safety Engine: ${conteo((r) => r.comparacion?.veredicto === 'bloqueada')}. Errores de generación: ${conteo((r) => r.comparacion?.veredicto === 'error_generacion')}. Errores de ejecución: ${conteo((r) => r.comparacion?.veredicto === 'error_ejecucion')}.`,
    '',
    '## Tokens, latencia y poda',
    '',
    '| Métrica | Promedio |',
    '|---|---|',
    `| Tokens de entrada | ${prom(metr.map((m) => m.tokensInput)).toFixed(0)} |`,
    `| Tokens de salida | ${prom(metr.map((m) => m.tokensOutput)).toFixed(0)} |`,
    `| Tokens de razonamiento | ${prom(metr.map((m) => m.tokensThinking)).toFixed(0)} |`,
    `| Latencia de generación | ${(prom(metr.map((m) => m.latencyMs)) / 1000).toFixed(1)} s |`,
    `| Latencia de ejecución (HTTP, banco chico) | ${prom(gen.filter((r) => r.ejecucion?.ok).map((r) => r.ejecucion.latenciaMs)).toFixed(0)} ms |`,
    `| Tablas enviadas al modelo | ${prom(metr.map((m) => m.tablesSent)).toFixed(2)} de ${metr[0]?.tablesTotal ?? '—'} |`,
    '',
    '## Posibles antipatrones (detección estática, revisar a mano)',
    '',
    ...(anti.size ? [...anti].map(([a, n]) => `- ${a}: ${n}`) : ['- Ninguno detectado.']),
    '',
    '## Para revisión manual',
    '',
    '| ID | Variante | Motor | Veredicto | Detalle |',
    '|---|---|---|---|---|',
    ...rs
      .filter((r) => !correcto(r))
      .map((r) => `| ${r.id} | ${r.variante} | ${r.motor} | ${r.comparacion?.veredicto} | ${(r.generacion?.sql ?? r.generacion?.error ?? r.ejecucion?.error ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|')} |`),
    '',
  ];
  writeFileSync(path.join(OUT_DIR, 'resumen.md'), lineas.join('\n'));
  console.log(`Resumen escrito en ${path.relative(process.cwd(), path.join(OUT_DIR, 'resumen.md'))}`);
}

// ---------------------------------------------------------------- main

if (!soloResumen) await correr();
if (soloResumen || pagado) resumen();
if (modo === 'prueba') {
  const rs = [...leerRegistros().values()];
  const malos = rs.filter((r) => r.comparacion?.veredicto !== 'exacto' || r.antipatrones?.length);
  console.log(`Prueba: ${rs.length - malos.length}/${rs.length} exactos sin antipatrones (debe ser el total: la referencia contra sí misma).`);
  if (malos.length) process.exitCode = 1;
}
