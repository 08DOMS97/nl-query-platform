// Ejecuta las 50 consultas de prueba (docs/consultas_prueba_50.json) contra los 4
// motores usando el endpoint real /executeQuery del backend NLQP (que a su vez pasa
// cada SQL por el Query Safety Engine antes de ejecutar). Requiere:
//   - el banco de pruebas Docker arriba (docker compose up -d)
//   - el backend corriendo (npm run dev) en BASE_URL (por defecto http://localhost:8080)
//
// Uso:  node run_consultas_prueba.mjs
// Salida: resultados_consultas_prueba.md + resultados_consultas_prueba.json

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.NLQP_BASE_URL ?? 'http://localhost:8080';
const ENGINES = ['postgres', 'mysql', 'mariadb', 'mssql'];

const queries = JSON.parse(readFileSync(path.join(dir, 'consultas_prueba_50.json'), 'utf8'));

function sqlFor(query, engine) {
  return query.overrides?.[engine] ?? query.sql;
}

async function runOne(query, engine) {
  const sql = sqlFor(query, engine);
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/executeQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine, sql }),
    });
    const body = await res.json();
    const latencyMs = Date.now() - start;
    if (res.status !== 200) {
      return { engine, ok: false, status: res.status, error: body.error ?? body.reason, latencyMs };
    }
    return { engine, ok: true, status: 200, rowCount: body.rowCount, sample: body.rows?.[0], latencyMs };
  } catch (err) {
    return { engine, ok: false, status: 0, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

async function main() {
  const results = [];
  for (const query of queries) {
    const perEngine = {};
    for (const engine of ENGINES) {
      perEngine[engine] = await runOne(query, engine);
    }
    const rowCounts = ENGINES.map((e) => perEngine[e].rowCount).filter((n) => n !== undefined);
    const consistent = new Set(rowCounts).size <= 1;
    results.push({ id: query.id, category: query.category, nl: query.nl, perEngine, consistent });
    const statusLine = ENGINES.map((e) => `${e}:${perEngine[e].ok ? 'OK' : 'FAIL'}`).join(' ');
    console.log(`${query.id.padEnd(4)} ${statusLine}  ${consistent ? '' : '<- FILAS INCONSISTENTES ENTRE MOTORES'}`);
  }

  writeFileSync(path.join(dir, 'resultados_consultas_prueba.json'), JSON.stringify(results, null, 2));

  const totalQueries = results.length;
  const totalRuns = totalQueries * ENGINES.length;
  const okRuns = results.reduce((acc, r) => acc + ENGINES.filter((e) => r.perEngine[e].ok).length, 0);
  const inconsistent = results.filter((r) => !r.consistent);
  const failed = results.filter((r) => ENGINES.some((e) => !r.perEngine[e].ok));

  const byCategory = ['simple', 'intermedio', 'complejo'].map((cat) => {
    const inCat = results.filter((r) => r.category === cat);
    const okInCat = inCat.reduce((acc, r) => acc + ENGINES.filter((e) => r.perEngine[e].ok).length, 0);
    return `| ${cat} | ${inCat.length} | ${okInCat}/${inCat.length * ENGINES.length} |`;
  }).join('\n');

  const rows = results.map((r) => {
    const cells = ENGINES.map((e) => {
      const pe = r.perEngine[e];
      return pe.ok ? `OK (${pe.rowCount} filas, ${pe.latencyMs}ms)` : `FALLO: ${pe.error}`;
    });
    return `| ${r.id} | ${r.category} | ${r.nl.replace(/\|/g, '\\|')} | ${cells.join(' | ')} | ${r.consistent ? 'sí' : '**NO**'} |`;
  }).join('\n');

  const md = `# Resultados — 50 consultas de prueba NL2SQL

Ejecutadas contra el backend real (\`${BASE_URL}\`) usando \`/executeQuery\`, que aplica
el Query Safety Engine antes de ejecutar cada SQL contra los 4 motores del banco de
pruebas. El SQL de cada consulta es de referencia (escrito a mano, adaptado por
dialecto) — no proviene de Vertex AI todavía (pendiente de proyecto GCP).

## Resumen

- Consultas: ${totalQueries} (15 simples, 20 intermedias, 15 complejas)
- Ejecuciones totales: ${totalRuns} (${totalQueries} consultas × 4 motores)
- Ejecuciones exitosas: ${okRuns}/${totalRuns}
- Consultas con conteo de filas consistente entre los 4 motores: ${totalQueries - inconsistent.length}/${totalQueries}
- Consultas con al menos un fallo: ${failed.length}

| Categoría | Consultas | Ejecuciones OK |
|---|---|---|
${byCategory}

${inconsistent.length > 0 ? `## Inconsistencias entre motores\n\n${inconsistent.map((r) => `- **${r.id}**: ${r.nl}`).join('\n')}\n` : ''}
${failed.length > 0 ? `## Fallos\n\n${failed.map((r) => `- **${r.id}**: ${r.nl}`).join('\n')}\n` : ''}

## Detalle completo

| ID | Categoría | Consulta (lenguaje natural) | PostgreSQL | MySQL | MariaDB | SQL Server | Consistente |
|---|---|---|---|---|---|---|---|
${rows}
`;

  writeFileSync(path.join(dir, 'resultados_consultas_prueba.md'), md);

  console.log('\n---');
  console.log(`Ejecuciones OK: ${okRuns}/${totalRuns}`);
  console.log(`Consultas consistentes entre motores: ${totalQueries - inconsistent.length}/${totalQueries}`);
  console.log('Reporte: docs/resultados_consultas_prueba.md');
}

main();
