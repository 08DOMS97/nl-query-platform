import {
  FinishReason,
  VertexAI,
  type GenerationConfig,
  type UsageMetadata,
} from '@google-cloud/vertexai';
import type { DbEngine, SchemaInfo } from '../types/index.js';
import { DOMAIN_RULES } from './domainRules.service.js';

/**
 * Notas de dialecto por motor que se inyectan en el prompt (ver tabla de
 * diferencias en INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §3). El modelo debe
 * generar SQL válido para el motor exacto que se le indique, no SQL genérico.
 */
const DIALECT_NOTES: Record<DbEngine, string> = {
  postgres:
    'PostgreSQL: usa LIMIT n para limitar filas. Usa EXTRACT(YEAR FROM col) / ' +
    'EXTRACT(MONTH FROM col) para fechas. Concatena con || o CONCAT(). Booleanos TRUE/FALSE.',
  mysql:
    'MySQL: usa LIMIT n para limitar filas. Usa YEAR(col) / MONTH(col) o EXTRACT(...) para ' +
    'fechas. Concatena con CONCAT() (no existe ||). Booleanos son TINYINT(1) (1/0).',
  mariadb:
    'MariaDB: mismo dialecto que MySQL. Usa LIMIT n. Usa YEAR(col) / MONTH(col). Concatena ' +
    'con CONCAT(). Booleanos son TINYINT(1) (1/0).',
  mssql:
    'SQL Server (T-SQL): usa SELECT TOP n en vez de LIMIT (LIMIT no existe). Usa YEAR(col) / ' +
    'MONTH(col) / DATEPART(...) para fechas. Concatena con + o CONCAT(). Booleanos son BIT (0/1).',
};

function formatSchemaForPrompt(schema: SchemaInfo): string {
  const lines: string[] = [];
  for (const table of schema.tables) {
    const cols = table.columns
      .map((c) => {
        const flags: string[] = [];
        if (c.isPrimaryKey) flags.push('PK');
        if (c.isForeignKey) flags.push(`FK -> ${c.referencesTable}.${c.referencesColumn}`);
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
 * `@google-cloud/vertexai` 1.12 no tipa `thinkingConfig` ni `thoughtsTokenCount`,
 * pero reenvía `generationConfig` tal cual a la API REST y devuelve
 * `usageMetadata` tal como llega — solo hace falta extender los tipos.
 */
type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig?: { thinkingBudget: number };
};
type UsageMetadataWithThinking = UsageMetadata & { thoughtsTokenCount?: number };

function getModel(generationConfig?: GenerationConfigWithThinking) {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION ?? 'us-central1';
  const model = process.env.VERTEX_AI_MODEL ?? 'gemini-2.5-pro';

  if (!projectId) {
    throw new Error(
      'GCP_PROJECT_ID no está configurado. Generación NL2SQL requiere un proyecto de Google ' +
        'Cloud con Vertex AI habilitado (ver pendientes en INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §8).',
    );
  }

  const vertexAI = new VertexAI({ project: projectId, location });
  return vertexAI.getGenerativeModel({ model, generationConfig });
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
  const result = await getModel().countTokens({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  return result.totalTokens;
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
  const generationConfig: GenerationConfigWithThinking = {
    temperature: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    thinkingConfig: { thinkingBudget: THINKING_BUDGET_TOKENS },
  };
  const generativeModel = getModel(generationConfig);

  const prompt = buildPrompt(engine, schema, naturalLanguageQuery);
  const result = await generativeModel.generateContent(prompt);
  const candidate = result.response.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

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

  const usage = result.response.usageMetadata as UsageMetadataWithThinking | undefined;

  return {
    sql: stripMarkdownFences(text),
    tokensInput: usage?.promptTokenCount ?? 0,
    tokensOutput: usage?.candidatesTokenCount ?? 0,
    tokensThinking: usage?.thoughtsTokenCount ?? 0,
    tokensTotal: usage?.totalTokenCount ?? 0,
  };
}
