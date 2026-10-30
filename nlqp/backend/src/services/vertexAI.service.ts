import {
  FinishReason,
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentResponseUsageMetadata,
} from '@google/genai';
import type { DbEngine, SchemaInfo } from '../types/index.js';
import { DOMAIN_RULES } from './domainRules.service.js';

/**
 * Notas de dialecto por motor que se inyectan en el prompt (ver tabla de
 * diferencias en INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §3). El modelo debe
 * generar SQL válido para el motor exacto que se le indique, no SQL genérico.
 */
const DIALECT_NOTES: Record<DbEngine, string> = {
  postgres:
    'PostgreSQL: para limitar filas usa LIMIT n. Para agrupar o mostrar por año/mes usa ' +
    'EXTRACT(YEAR FROM col) / EXTRACT(MONTH FROM col). Concatena con || o CONCAT(). ' +
    'Booleanos TRUE/FALSE.',
  mysql:
    'MySQL: para limitar filas usa LIMIT n. Para agrupar o mostrar por año/mes usa ' +
    'YEAR(col) / MONTH(col). Concatena con CONCAT() (no existe ||). Booleanos son TINYINT(1) (1/0).',
  mariadb:
    'MariaDB: mismo dialecto que MySQL. Para limitar filas usa LIMIT n. Para agrupar o mostrar ' +
    'por año/mes usa YEAR(col) / MONTH(col). Concatena con CONCAT(). Booleanos son TINYINT(1) (1/0).',
  mssql:
    'SQL Server (T-SQL): para limitar filas usa SELECT TOP n (LIMIT no existe). Para agrupar o ' +
    'mostrar por año/mes usa YEAR(col) / MONTH(col). Concatena con + o CONCAT(). ' +
    'Booleanos son BIT (0/1).',
};

/**
 * Reglas para que el SQL sea eficiente en una base con muchos datos (requisito
 * del 02/10/2026, ver nlqp/docs/PREPARACION_EVALUACION_GEMINI.md). Ninguna
 * cambia QUÉ filas devuelve la consulta, solo CÓMO las obtiene: la eficiencia no
 * puede costar integridad (ver nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md), por eso
 * la regla de LIMIT prohíbe agregar límites que el usuario no pidió.
 */
const PERFORMANCE_RULES: string[] = [
  'Selecciona solo las columnas necesarias para responder; nunca SELECT *.',
  'Las columnas marcadas IDX tienen índice. Al filtrar o unir por ellas no les apliques ' +
    "funciones: para fechas usa rangos (col >= '2025-01-01' AND col < '2026-01-01') en vez " +
    'de YEAR(col) = 2025 o EXTRACT(...) = 2025.',
  'Para "los que no tienen / nunca han" usa NOT EXISTS (o LEFT JOIN ... IS NULL), no NOT IN ' +
    'con subconsulta.',
  'Evita subconsultas correlacionadas en el SELECT; usa JOIN con GROUP BY o funciones de ventana.',
  'No uses DISTINCT para tapar filas duplicadas por un JOIN: agrega antes de unir.',
  'Limita filas (LIMIT/TOP) solo si la pregunta pide una cantidad o un máximo/mínimo ' +
    '("los 5...", "el que más..."); nunca recortes un listado completo.',
];

/**
 * Índices compuestos en el prompt: apagado por defecto. El `EXPLAIN` de la evaluación
 * (29/10/2026) no mostró consultas ineficientes sin ellos, y con la variable apagada el
 * prompt es idéntico al evaluado. Se activa con NLQP_PROMPT_INDICES_COMPUESTOS=true si
 * una base real lo requiere (ver PREPARACION_EVALUACION_GEMINI.md §9).
 */
const COMPOSITE_INDEX_RULE =
  'Los índices compuestos se listan por tabla con sus columnas en orden: filtra por la ' +
  'primera columna (y las siguientes) sin funciones para que el motor pueda usarlos.';

function compositeIndexesEnabled(): boolean {
  return process.env.NLQP_PROMPT_INDICES_COMPUESTOS === 'true';
}

function formatSchemaForPrompt(schema: SchemaInfo): string {
  const withComposite = compositeIndexesEnabled();
  const lines: string[] = [];
  for (const table of schema.tables) {
    const cols = table.columns
      .map((c) => {
        const flags: string[] = [];
        if (c.isPrimaryKey) flags.push('PK');
        if (c.isForeignKey) flags.push(`FK -> ${c.referencesTable}.${c.referencesColumn}`);
        if (c.indexed) flags.push('IDX');
        if (c.allowedValues) flags.push(`valores: ${c.allowedValues.map((v) => `'${v}'`).join('|')}`);
        const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
        return `${c.name} (${c.dataType}${c.nullable ? ', nullable' : ''})${flagStr}`;
      })
      .join(', ');
    lines.push(`- ${table.name}: ${cols}`);
    const composite = withComposite ? (table.indexes ?? []).filter((ix) => ix.columns.length > 1) : [];
    if (composite.length) {
      lines.push(`  índices compuestos: ${composite.map((ix) => `(${ix.columns.join(', ')})`).join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function buildPrompt(engine: DbEngine, schema: SchemaInfo, naturalLanguageQuery: string): string {
  return `Eres un generador experto de SQL. Tu única tarea es traducir la solicitud del \
usuario a UNA sola sentencia SQL de solo lectura (SELECT), válida para ${engine}.

Reglas estrictas:
- Responde ÚNICAMENTE con la sentencia SQL, sin explicaciones, sin markdown, sin \`\`\`.
- Debe ser una única sentencia SELECT (o WITH ... SELECT). Nunca INSERT/UPDATE/DELETE/DDL.
- Usa solo las tablas y columnas listadas a continuación; no inventes nombres.
- Para columnas con "valores" listados, usa exactamente esos literales.
- ${DIALECT_NOTES[engine]}

Reglas del dominio:
${DOMAIN_RULES.map((r) => `- ${r}`).join('\n')}

Reglas de rendimiento (la base puede tener millones de filas):
${[...PERFORMANCE_RULES, ...(compositeIndexesEnabled() ? [COMPOSITE_INDEX_RULE] : [])].map((r) => `- ${r}`).join('\n')}

Esquema disponible (base de datos "${schema.database}"):
${formatSchemaForPrompt(schema)}

Solicitud del usuario: "${naturalLanguageQuery}"

SQL:`;
}

/** Quita cercas de código markdown por si el modelo las incluye a pesar de la instrucción. */
function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:sql)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Límites de generación. Gemini 3.8 Flash razona internamente ("thinking")
 * antes de responder; ese razonamiento no se puede desactivar (el nivel
 * MINIMAL no existe en este modelo), se factura como salida y cuenta dentro de
 * `maxOutputTokens`. Por eso son dos controles separados:
 * - THINKING_LEVEL acota el razonamiento, y con él el costo por llamada. Este
 *   modelo ya no acepta un presupuesto en tokens (`thinkingBudget`, que se usaba
 *   con Gemini 2.5 Pro hasta el 18/10/2026), solo LOW, MEDIUM (por defecto) o
 *   HIGH. LOW alcanza para traducir una pregunta a una sola sentencia.
 * - MAX_OUTPUT_TOKENS lo supera con holgura para que siempre quede espacio para
 *   el SQL (las consultas más complejas de la batería rondan 100–200 tokens).
 *   Si el razonamiento lo agotara, el SQL saldría truncado o vacío — un fallo
 *   de configuración que se contaría como error de precisión del modelo.
 * La temperatura no se envía: Gemini 3.8 Flash la ignora (el determinismo se
 * controla con el nivel de razonamiento).
 */
const THINKING_LEVEL = ThinkingLevel.LOW;
const MAX_OUTPUT_TOKENS = 4096;

/**
 * Cliente de Vertex AI con el SDK `@google/genai` (modo Vertex AI). Reemplaza a
 * `@google-cloud/vertexai`, deprecado con eliminación anunciada para el
 * 24/06/2026 (migrado el 08/10/2026). Autenticación: Application Default
 * Credentials, igual que antes (`gcloud auth application-default login`).
 * `@google/genai` tipa de forma nativa `thinkingConfig` y `thoughtsTokenCount`.
 * Modelo y ubicación por defecto desde el 18/10/2026: `gemini-3.8-flash` en
 * `global` (Gemini 2.5 Pro se retiró de Vertex AI el 20/10/2026, y 3.8 Flash no
 * se ofrece en regiones como `us-central1`, solo en `global`, `us` y `eu`).
 */
let client: GoogleGenAI | null = null;

function getClient(): { ai: GoogleGenAI; model: string } {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION ?? 'global';
  const model = process.env.VERTEX_AI_MODEL ?? 'gemini-3.8-flash';

  if (!projectId) {
    throw new Error(
      'GCP_PROJECT_ID no está configurado. Generación NL2SQL requiere un proyecto de Google ' +
        'Cloud con Vertex AI habilitado (ver pendientes en INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §8).',
    );
  }

  client ??= new GoogleGenAI({ vertexai: true, project: projectId, location });
  return { ai: client, model };
}

/**
 * Prepara el cliente, el token de Google y la conexión TLS al arrancar el servidor, con
 * un `countTokens` (no se factura). Sin esto, la primera generación de cada proceso
 * tardaba ~2,7 s más (medido el 24/10: 2,8 s el primer countTokens, 0,14 s los
 * siguientes). Un fallo acá no impide arrancar: solo se registra.
 */
export async function warmUpVertex(): Promise<void> {
  const t0 = Date.now();
  try {
    const { ai, model } = getClient();
    await ai.models.countTokens({ model, contents: 'SELECT 1' });
    console.log(`[vertexAI] cliente listo en ${Date.now() - t0} ms`);
  } catch (err) {
    console.warn('[vertexAI] no se pudo preparar el cliente al arrancar:', err instanceof Error ? err.message : err);
  }
}

/**
 * Cuenta los tokens de entrada que tendría el prompt, sin generar nada. La API
 * countTokens de Vertex AI no se factura: sirve para medir cuánto ahorra el
 * pruning comparando el prompt podado contra el del esquema completo.
 */
export async function countPromptTokens(
  engine: DbEngine,
  schema: SchemaInfo,
  naturalLanguageQuery: string,
): Promise<number> {
  const prompt = buildPrompt(engine, schema, naturalLanguageQuery);
  const { ai, model } = getClient();
  const result = await ai.models.countTokens({ model, contents: prompt });
  return result.totalTokens ?? 0;
}

type GenerationUsage = Omit<GenerateSqlResult, 'sql'>;

/**
 * La llamada al modelo se hizo (y se factura) pero no dejó un SQL usable: lleva los
 * tokens para que el registro de uso no la cuente como gratis (auditoría del 24/10).
 */
export class GenerationFailedError extends Error {
  constructor(message: string, readonly usage: GenerationUsage) {
    super(message);
    this.name = 'GenerationFailedError';
  }
}

export interface GenerateSqlResult {
  sql: string;
  tokensInput: number;
  /** Tokens de la respuesta visible (el SQL). */
  tokensOutput: number;
  /** Tokens de razonamiento interno — no visibles, pero se facturan como salida. */
  tokensThinking: number;
  tokensTotal: number;
  /** Intentos hasta obtener respuesta (1 = sin reintentos; ver FIRST_CHUNK_TIMEOUTS_MS). */
  attempts: number;
  /** Cuánto tardó en llegar la primera parte de la respuesta en el intento que funcionó. */
  firstChunkMs: number | null;
}

/**
 * Espera a Vertex AI (26/10, pedido de David). Con pago por uso la capacidad es
 * compartida: cuando Google está saturado encola la solicitud (minutos) o responde 429.
 * En la corrida del 26/10 una consulta de una tabla tardó hasta 4,5 min, y la misma
 * solicitud reenviada respondió en 2–4 s. Por eso la respuesta se pide por partes
 * (streaming) y se distingue:
 * - **Encolada** (no llegó nada, ni siquiera el razonamiento): se corta y se reintenta.
 *   El plazo crece en cada intento para no cortar dos veces una consulta compleja que
 *   razona mucho antes de escribir.
 * - **Respondiendo** (ya llegó algo): se espera a que termine, con un máximo por intento.
 * El volumen de datos no influye acá: el modelo ve el esquema, no las filas. La
 * ejecución tiene su propio tope por conexión.
 */
const FIRST_CHUNK_TIMEOUTS_MS = [20_000, 40_000, 80_000];
const ATTEMPT_TIMEOUT_MS = 120_000;
/** Espera antes de reintentar un 429/503 de Vertex AI (no se facturan). */
const BUSY_RETRY_WAIT_MS = 2_000;

class AttemptTimeoutError extends Error {
  constructor(readonly stage: 'cola' | 'respuesta', ms: number) {
    super(
      stage === 'cola'
        ? `Vertex AI no empezó a responder en ${ms / 1000} s.`
        : `Vertex AI no terminó de responder en ${ms / 1000} s.`,
    );
    this.name = 'AttemptTimeoutError';
  }
}

const isBusyError = (err: unknown) =>
  /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(err instanceof Error ? err.message : String(err));

/** Un intento por streaming. El razonamiento se pide resumido solo como señal de vida. */
async function generateOnce(ai: GoogleGenAI, model: string, prompt: string, firstChunkTimeoutMs: number) {
  const controller = new AbortController();
  let timedOut: AttemptTimeoutError | null = null;
  const abortWith = (err: AttemptTimeoutError) => {
    timedOut = err;
    controller.abort();
  };
  const firstTimer = setTimeout(() => abortWith(new AttemptTimeoutError('cola', firstChunkTimeoutMs)), firstChunkTimeoutMs);
  const totalTimer = setTimeout(() => abortWith(new AttemptTimeoutError('respuesta', ATTEMPT_TIMEOUT_MS)), ATTEMPT_TIMEOUT_MS);
  const config: GenerateContentConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    thinkingConfig: { thinkingLevel: THINKING_LEVEL, includeThoughts: true },
    abortSignal: controller.signal,
  };
  let text = '';
  let usageMetadata: GenerateContentResponseUsageMetadata | undefined;
  let finishReason: FinishReason | undefined;
  let firstChunkMs: number | null = null;
  const t0 = Date.now();
  try {
    const stream = await ai.models.generateContentStream({ model, contents: prompt, config });
    for await (const chunk of stream) {
      if (firstChunkMs === null) {
        firstChunkMs = Date.now() - t0;
        clearTimeout(firstTimer);
      }
      const candidate = chunk.candidates?.[0];
      // El razonamiento (`thought`) no es parte del SQL.
      for (const part of candidate?.content?.parts ?? []) if (part.text && !part.thought) text += part.text;
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
    }
  } catch (err) {
    throw timedOut ?? err;
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
  }
  if (timedOut) throw timedOut;
  return { text, usageMetadata, finishReason, firstChunkMs };
}

/**
 * Genera SQL a partir de lenguaje natural usando Gemini en Vertex AI.
 * El resultado NUNCA debe ejecutarse sin pasar antes por
 * `querySafety.service.ts` — este servicio no valida seguridad, solo genera.
 * Devuelve además los tokens consumidos (`usageMetadata` de la respuesta),
 * que usa el módulo de uso y costos para estimar el gasto de cada llamada, y los
 * intentos que hicieron falta (los cortados pueden haberse facturado igual).
 */
export async function generateSql(
  engine: DbEngine,
  schema: SchemaInfo,
  naturalLanguageQuery: string,
): Promise<GenerateSqlResult> {
  const { ai, model } = getClient();
  const prompt = buildPrompt(engine, schema, naturalLanguageQuery);

  const retries: string[] = [];
  let result: Awaited<ReturnType<typeof generateOnce>> | null = null;
  for (let attempt = 0; attempt < FIRST_CHUNK_TIMEOUTS_MS.length; attempt++) {
    try {
      result = await generateOnce(ai, model, prompt, FIRST_CHUNK_TIMEOUTS_MS[attempt]);
      break;
    } catch (err) {
      const retriable = err instanceof AttemptTimeoutError || isBusyError(err);
      if (!retriable || attempt === FIRST_CHUNK_TIMEOUTS_MS.length - 1) {
        throw retries.length && err instanceof Error
          ? new Error(`${err.message} (después de ${retries.length + 1} intentos: ${retries.join('; ')})`)
          : err;
      }
      retries.push(err instanceof AttemptTimeoutError ? err.message : 'Vertex AI ocupado (429/503)');
      if (!(err instanceof AttemptTimeoutError)) await new Promise((r) => setTimeout(r, BUSY_RETRY_WAIT_MS));
    }
  }
  const { text, usageMetadata, finishReason, firstChunkMs } = result!;
  const usage: GenerationUsage = {
    tokensInput: usageMetadata?.promptTokenCount ?? 0,
    tokensOutput: usageMetadata?.candidatesTokenCount ?? 0,
    tokensThinking: usageMetadata?.thoughtsTokenCount ?? 0,
    tokensTotal: usageMetadata?.totalTokenCount ?? 0,
    attempts: retries.length + 1,
    firstChunkMs,
  };

  // Un SQL cortado por el tope de salida no debe llegar al Query Safety Engine
  // como si fuera una respuesta completa: se reporta como error explícito.
  if (finishReason === FinishReason.MAX_TOKENS) {
    throw new GenerationFailedError(
      `Vertex AI cortó la respuesta al alcanzar el tope de ${MAX_OUTPUT_TOKENS} tokens de salida.`,
      usage,
    );
  }
  if (!text) {
    throw new GenerationFailedError('Vertex AI no devolvió texto en la respuesta.', usage);
  }

  return { sql: stripMarkdownFences(text), ...usage };
}
