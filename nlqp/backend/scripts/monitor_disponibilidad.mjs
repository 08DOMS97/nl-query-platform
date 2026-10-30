/**
 * Disponibilidad del servicio (sección 3.3.1.4 de la tesis, meta ≥ 99 %). Cada minuto
 * consulta /health del backend; cada 5 minutos, además, ejecuta `SELECT 1` en las 4
 * conexiones por /executeQuery (pasa por la autenticación y el Query Safety Engine,
 * como una consulta real). Agrega una línea por chequeo a
 * docs/evaluacion_gemini/disponibilidad.jsonl. Sin costo de Gemini; ~1 150 escrituras
 * de Firestore por día (registro de uso), dentro de la cuota gratuita.
 *
 *   node --env-file=.env scripts/monitor_disponibilidad.mjs            (corre hasta que se lo detenga)
 *   node --env-file=.env scripts/monitor_disponibilidad.mjs --resumen  (calcula la disponibilidad)
 *
 * Si la PC se suspende no hay chequeos: esos huecos se reportan como «sin medición», no
 * como caída, y se informa la cobertura del período.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARCHIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evaluacion_gemini/disponibilidad.jsonl');
const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
const MOTORES = ['postgres', 'mysql', 'mariadb', 'mssql'];
const PERIODO_MS = 60_000;
const CADA_COMPLETO = 5;

if (process.argv.includes('--resumen')) {
  resumen();
  process.exit(0);
}

let token = null;
let tokenEn = 0;
async function renovarToken() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.NLQP_TEST_USER_EMAIL ?? 'nlqp-ci-tecnico@example.com', password: process.env.NLQP_TEST_USER_PASSWORD, returnSecureToken: true }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`login: ${JSON.stringify(d.error ?? d)}`);
  token = d.idToken;
  tokenEn = Date.now();
}

async function chequeo(url, opciones = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(30_000) });
    await r.text();
    return { ok: r.ok, status: r.status, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err.cause?.code ?? err.name ?? String(err), ms: Date.now() - t0 };
  }
}

async function ciclo(n) {
  const linea = { t: new Date().toISOString(), health: await chequeo(`${BASE}/health`) };
  if (n % CADA_COMPLETO === 0) {
    linea.motores = {};
    try {
      if (!token || Date.now() - tokenEn > 50 * 60_000) await renovarToken();
      for (const engine of MOTORES) {
        linea.motores[engine] = await chequeo(`${BASE}/executeQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-NLQP-Origin': 'evaluacion' },
          body: JSON.stringify({ engine, sql: 'SELECT 1 AS ok' }),
        });
      }
    } catch (err) {
      linea.motores.error = String(err.message ?? err);
    }
  }
  appendFileSync(ARCHIVO, JSON.stringify(linea) + '\n');
}

let n = 0;
for (;;) {
  const t0 = Date.now();
  await ciclo(n++);
  await new Promise((r) => setTimeout(r, Math.max(1_000, PERIODO_MS - (Date.now() - t0))));
}

function resumen() {
  if (!existsSync(ARCHIVO)) return console.log('Sin datos todavía.');
  const ls = readFileSync(ARCHIVO, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const ini = new Date(ls[0].t), fin = new Date(ls.at(-1).t);
  const horas = (fin - ini) / 3_600_000;
  const esperados = Math.floor((fin - ini) / PERIODO_MS) + 1;
  const huecos = [];
  for (let i = 1; i < ls.length; i++) {
    const d = new Date(ls[i].t) - new Date(ls[i - 1].t);
    if (d > 3 * PERIODO_MS) huecos.push({ desde: ls[i - 1].t, hasta: ls[i].t, min: Math.round(d / 60_000) });
  }
  const okH = ls.filter((l) => l.health.ok).length;
  const comp = ls.filter((l) => l.motores);
  const okC = comp.filter((l) => !l.motores.error && MOTORES.every((m) => l.motores[m]?.ok)).length;
  const caidas = ls.filter((l) => !l.health.ok).map((l) => l.t);
  const fallosMotor = comp.filter((l) => l.motores.error || !MOTORES.every((m) => l.motores[m]?.ok)).map((l) => ({ t: l.t, detalle: l.motores }));
  const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(JSON.stringify({
    periodo: { desde: ls[0].t, hasta: ls.at(-1).t, horas: +horas.toFixed(1) },
    cobertura: `${ls.length} de ${esperados} chequeos esperados (${((100 * ls.length) / esperados).toFixed(1)} %)`,
    huecosSinMedicion: huecos,
    backend: `${okH}/${ls.length} = ${((100 * okH) / ls.length).toFixed(2)} %`,
    consultaCompleta4Motores: comp.length ? `${okC}/${comp.length} = ${((100 * okC) / comp.length).toFixed(2)} %` : 'sin datos',
    medianaHealthMs: med(ls.map((l) => l.health.ms)),
    medianaSelect1Ms: Object.fromEntries(MOTORES.map((m) => [m, med(comp.map((l) => l.motores[m]?.ms).filter(Number.isFinite))])),
    caidasBackend: caidas.slice(0, 20),
    fallosConsulta: fallosMotor.slice(0, 20),
  }, null, 1));
}
