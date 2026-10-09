import { FinishReason, GoogleGenAI, type GenerateContentConfig } from '@google/genai';
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

function formatSchemaForPrompt(schema: SchemaInfo): string {
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
${PERFORMANCE_RULES.map((r) => `- ${r}`).join('\n')}

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
 * Límites de generación. Gemini 2.5 Pro razona internamente ("thinking") antes
 * de responder, ese razonamiento no se puede desactivar en este modelo (solo
 * acotar), se factura como salida y cuenta dentro de `maxOutputTokens`. Con un
 * único tope (antes 1024) el razonamiento podía agotarlo y dejar el SQL
 * truncado o vacío — un fallo de configuración que se contaría como error de
 * precisión del modelo. Por eso son dos límites separados:
 * - THINKING_BUDGET_TOKENS acota el razonamiento, y con él el costo por llamada.
 * - MAX_OUTPUT_TOKENS lo supera con holgura para que siempre quede espacio para
 *   el SQL (las consultas más complejas de la batería rondan 100–200 tokens).
 */
const THINKING_BUDGET_TOKENS = 1024;
const MAX_OUTPUT_TOKENS = 4096;

/**
 * Cliente de Vertex AI con el SDK `@google/genai` (modo Vertex AI). Reemplaza a
 * `@google-cloud/vertexai`, deprecado con eliminación anunciada para el
 * 24/06/2026 (migrado el 08/10/2026). Autenticación: Application Default
 * Credentials, igual que antes (`gcloud auth application-default login`).
 * `@google/genai` tipa de forma nativa `thinkingConfig` y `thoughtsTokenCount`.
 */
let client: GoogleGenAI | null = null;

function getClient(): { ai: GoogleGenAI; model: string } {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION ?? 'us-central1';
  const model = process.env.VERTEX_AI_MODEL ?? 'gemini-2.5-pro';

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

export interface GenerateSqlResult {
  sql: string;
  tokensInput: number;
  /** Tokens de la respuesta visible (el SQL). */
  tokensOutput: number;
  /** Tokens de razonamiento interno — no visibles, pero se facturan como salida. */
  tokensThinking: number;
  tokensTotal: number;
}

/**
 * Genera SQL a partir de lenguaje natural usando Vertex AI Gemini Pro.
 * El resultado NUNCA debe ejecutarse sin pasar antes por
 * `querySafety.service.ts` — este servicio no valida seguridad, solo genera.
 * Devuelve además los tokens consumidos (`usageMetadata` de la respuesta),
 * que usa el módulo de uso y costos para estimar el gasto de cada llamada.
 */
export async function generateSql(
  engine: DbEngine,
  schema: SchemaInfo,
  naturalLanguageQuery: string,
): Promise<GenerateSqlResult> {
  const config: GenerateContentConfig = {
    temperature: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    thinkingConfig: { thinkingBudget: THINKING_BUDGET_TOKENS },
  };
  const { ai, model } = getClient();

  const prompt = buildPrompt(engine, schema, naturalLanguageQuery);
  const response = await ai.models.generateContent({ model, contents: prompt, config });
  const candidate = response.candidates?.[0];
  // `response.text` concatena las partes de texto de la respuesta, sin el
  // razonamiento interno (no se pide `includeThoughts`).
  const text = response.text;

  // Un SQL cortado por el tope de salida no debe llegar al Query Safety Engine
  // como si fuera una respuesta completa: se reporta como error explícito.
  if (candidate?.finishReason === FinishReason.MAX_TOKENS) {
    throw new Error(
      `Vertex AI cortó la respuesta al alcanzar el tope de ${MAX_OUTPUT_TOKENS} tokens de salida.`,
    );
  }
  if (!text) {
    throw new Error('Vertex AI no devolvió texto en la respuesta.');
  }

  const usage = response.usageMetadata;

  return {
    sql: stripMarkdownFences(text),
    tokensInput: usage?.promptTokenCount ?? 0,
    tokensOutput: usage?.candidatesTokenCount ?? 0,
    tokensThinking: usage?.thoughtsTokenCount ?? 0,
    tokensTotal: usage?.totalTokenCount ?? 0,
  };
}
