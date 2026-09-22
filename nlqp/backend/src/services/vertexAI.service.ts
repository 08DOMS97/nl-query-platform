import { VertexAI } from '@google-cloud/vertexai';
import type { DbEngine, SchemaInfo } from '../types/index.js';

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
        const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
        return `${c.name} (${c.dataType}${c.nullable ? ', nullable' : ''})${flagStr}`;
      })
      .join(', ');
    lines.push(`- ${table.name}: ${cols}`);
  }
  return lines.join('\n');
}

function buildPrompt(engine: DbEngine, schema: SchemaInfo, naturalLanguageQuery: string): string {
  return `Eres un generador experto de SQL. Tu única tarea es traducir la solicitud del \
usuario a UNA sola sentencia SQL de solo lectura (SELECT), válida para ${engine}.

Reglas estrictas:
- Responde ÚNICAMENTE con la sentencia SQL, sin explicaciones, sin markdown, sin \`\`\`.
- Debe ser una única sentencia SELECT (o WITH ... SELECT). Nunca INSERT/UPDATE/DELETE/DDL.
- Usa solo las tablas y columnas listadas a continuación; no inventes nombres.
- ${DIALECT_NOTES[engine]}

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
 * Genera SQL a partir de lenguaje natural usando Vertex AI Gemini Pro.
 * El resultado NUNCA debe ejecutarse sin pasar antes por
 * `querySafety.service.ts` — este servicio no valida seguridad, solo genera.
 */
export async function generateSql(
  engine: DbEngine,
  schema: SchemaInfo,
  naturalLanguageQuery: string,
): Promise<string> {
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
  const generativeModel = vertexAI.getGenerativeModel({
    model,
    generationConfig: { temperature: 0, maxOutputTokens: 1024 },
  });

  const prompt = buildPrompt(engine, schema, naturalLanguageQuery);
  const result = await generativeModel.generateContent(prompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Vertex AI no devolvió texto en la respuesta.');
  }

  return stripMarkdownFences(text);
}
