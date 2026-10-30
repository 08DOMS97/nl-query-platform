// Integridad de los valores en los 4 motores (auditoría del 24/10): columnas con el mismo
// nombre se rechazan (422) en vez de mostrar un valor en lugar de otro, las expresiones
// sin alias reciben un nombre legible (26/10), el
// TIMESTAMP de Postgres no se corre de hora y un BIGINT grande de MySQL llega exacto.
// Solo SELECT, por /executeQuery (Query Safety Engine). Se corre con `npm run test:api`.
import { readFileSync } from 'node:fs';

const usr = readFileSync(process.argv[2], 'utf8').trim();
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const run = async (connectionId, sql) => {
  const res = await fetch('http://localhost:8080/executeQuery', {
    method: 'POST',
    headers: { Authorization: `Bearer ${usr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId, sql }),
  });
  return { status: res.status, json: await res.json() };
};
const MOTORES = ['postgres', 'mysql', 'mariadb', 'mssql'];

for (const m of MOTORES) {
  const dup = await run(m, 'SELECT c.customer_id, o.order_id AS customer_id FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE c.customer_id = 1');
  check(`${m}: dos columnas con el mismo nombre → 422`, dup.status === 422 && /más de una columna llamada «customer_id»/.test(dup.json.error), JSON.stringify(dup.json).slice(0, 160));
  const bien = await run(m, 'SELECT c.customer_id, o.order_id FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE c.customer_id = 1');
  check(`${m}: con nombres distintos se ejecuta`, bien.status === 200 && bien.json.columns.join() === 'customer_id,order_id', JSON.stringify(bien.json).slice(0, 160));
}
// Expresiones sin alias (26/10): nombre legible en los 4 motores, y dos sin alias no se pisan.
for (const m of MOTORES) {
  const sinNombre = await run(m, 'SELECT COUNT(*), COUNT(DISTINCT customer_id), SUM(total), MAX(order_date) FROM orders');
  const cols = sinNombre.json.columns?.join();
  const fila = sinNombre.json.rows?.[0] ?? {};
  check(`${m}: expresiones sin alias con nombre legible`, sinNombre.status === 200 && cols === 'cantidad,cantidad_2,suma_total,maximo_order_date', JSON.stringify(sinNombre.json).slice(0, 200));
  check(`${m}: dos conteos sin alias no se mezclan`, Number(fila.cantidad) > Number(fila.cantidad_2) && Number(fila.cantidad_2) > 0, JSON.stringify(fila));
  const propio = await run(m, 'SELECT customer_id, COUNT(*) AS pedidos FROM orders WHERE customer_id = 1 GROUP BY customer_id');
  check(`${m}: los nombres propios no se tocan`, propio.status === 200 && propio.json.columns.join() === 'customer_id,pedidos', JSON.stringify(propio.json).slice(0, 160));
}
const conAlias = await run('mssql', 'SELECT COUNT(*) AS n FROM customers');
check('mssql: con alias se ejecuta', conAlias.status === 200 && Number.isInteger(conAlias.json.rows[0].n) && conAlias.json.rows[0].n > 0, JSON.stringify(conAlias.json).slice(0, 160));

const TS = {
  postgres: "SELECT TIMESTAMP '2025-03-01 16:45:00' AS ts",
  mysql: "SELECT CAST('2025-03-01 16:45:00' AS DATETIME) AS ts",
  mariadb: "SELECT CAST('2025-03-01 16:45:00' AS DATETIME) AS ts",
  mssql: "SELECT CAST('2025-03-01 16:45:00' AS DATETIME2) AS ts",
};
for (const m of MOTORES) {
  const r = await run(m, TS[m]);
  check(`${m}: fecha y hora sin zona sin correrse`, r.status === 200 && r.json.rows[0].ts === '2025-03-01T16:45:00.000Z', JSON.stringify(r.json).slice(0, 160));
}
const inf = await run('postgres', "SELECT TIMESTAMP 'infinity' AS ts, DATE '-infinity' AS d");
check("postgres: 'infinity' queda como texto, no como NULL", inf.status === 200 && inf.json.rows[0].ts === 'infinity' && inf.json.rows[0].d === '-infinity', JSON.stringify(inf.json).slice(0, 160));

for (const m of ['mysql', 'mariadb']) {
  const big = await run(m, 'SELECT CAST(9007199254740993 AS SIGNED) AS big, COUNT(*) AS n FROM customers');
  check(`${m}: BIGINT de más de 2^53 llega exacto`, big.status === 200 && big.json.rows[0].big === '9007199254740993', JSON.stringify(big.json).slice(0, 160));
  check(`${m}: un conteo sigue siendo número`, Number.isInteger(big.json.rows?.[0]?.n) && big.json.rows[0].n > 0);
}

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
