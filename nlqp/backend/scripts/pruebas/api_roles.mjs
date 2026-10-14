// Roles técnico / no técnico (M4): 401/403/200, aislamiento del historial y pool.
// Supone solo las 4 conexiones iniciales. Se corre con `npm run test:api`.
import { readFileSync } from 'node:fs';

const tec = readFileSync(process.argv[2], 'utf8').trim();
const usr = readFileSync(process.argv[3], 'utf8').trim();
const BASE = 'http://localhost:8080';
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const call = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
};

// Rutas solo técnicas
const tecnicas = ['/testConnection', '/poolStatus', '/getSchema?engine=postgres', '/getUsageStats'];
for (const path of tecnicas) {
  const u = await call(usr, 'GET', path);
  check(`no técnico ${path} -> 403`, u.status === 403 && u.json?.error === 'Esta función es solo para el rol técnico.', u.status);
  const t = await call(tec, 'GET', path);
  check(`técnico ${path} -> 200`, t.status === 200, t.status);
  const s = await call(null, 'GET', path);
  check(`sin token ${path} -> 401`, s.status === 401, s.status);
}

// Rutas de ambos roles
for (const [token, quien] of [[usr, 'no técnico'], [tec, 'técnico']]) {
  check(`${quien} /history -> 200`, (await call(token, 'GET', '/history')).status === 200);
  check(`${quien} /savedQueries -> 200`, (await call(token, 'GET', '/savedQueries')).status === 200);
  const e = await call(token, 'POST', '/executeQuery', { engine: 'mariadb', sql: 'SELECT 1 AS x', question: `roles ${quien}` });
  check(`${quien} /executeQuery -> 200`, e.status === 200, e.status);
}

// Aislamiento del historial entre usuarios
const hu = (await call(usr, 'GET', '/history')).json.entries;
const ht = (await call(tec, 'GET', '/history')).json.entries;
check('historial no técnico: solo lo suyo', hu.every((e) => e.question !== 'roles técnico') && hu[0]?.question === 'roles no técnico');
check('historial técnico: solo lo suyo', ht.every((e) => e.question !== 'roles no técnico') && ht[0]?.question === 'roles técnico');

// Estado del pool: los 4 motores, con números coherentes
const pools = (await call(tec, 'GET', '/poolStatus')).json.pools;
check('poolStatus: 4 motores', pools.length === 4 && ['postgres', 'mysql', 'mariadb', 'mssql'].every((m) => pools.some((p) => p.engine === m)));
check('poolStatus: coherente', pools.every((p) => p.max === 5 && p.total === p.idle + p.inUse && p.total <= p.max && p.waiting >= 0), JSON.stringify(pools));
check('poolStatus: mariadb iniciado tras ejecutar', pools.find((p) => p.engine === 'mariadb').initialized && pools.find((p) => p.engine === 'mariadb').total >= 1);

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
