// Exportación a Excel en los 4 motores: cada dato en su columna, encabezados legibles,
// fechas y números con su tipo, texto que no se vuelve fórmula, números largos exactos
// (como texto), hoja «Detalles» y todas las filas. Solo SELECT, por /executeQuery
// (Query Safety Engine). Se corre con `npm run test:api`.
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';

const BASE = 'http://localhost:8080';
const usr = readFileSync(process.argv[2], 'utf8').trim();
let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`OK   ${n}`); } else { fail++; console.log(`FAIL ${n} ${x}`); } };
const headers = { Authorization: `Bearer ${usr}`, 'Content-Type': 'application/json' };
const run = async (connectionId, sql, question) => {
  const res = await fetch(`${BASE}/executeQuery`, { method: 'POST', headers, body: JSON.stringify({ connectionId, sql, question }) });
  return { status: res.status, json: await res.json() };
};
const exportar = async (resultId) => {
  const r = await fetch(`${BASE}/createResultExport`, { method: 'POST', headers, body: JSON.stringify({ resultId }) });
  const { path } = await r.json();
  const res = await fetch(`${BASE}${path}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const book = new ExcelJS.Workbook();
  if (res.status === 200) await book.xlsx.load(buffer);
  return { res, book, path };
};
const valores = (sheet, n) => sheet.getRow(n).values.slice(1);
const MOTORES = ['postgres', 'mysql', 'mariadb', 'mssql'];
const LITERALES = {
  postgres: "SELECT '=1+1' AS texto_formula, CAST(NULL AS VARCHAR(10)) AS vacio, CAST(9007199254740993 AS BIGINT) AS numero_grande, '00123' AS codigo",
  mysql: "SELECT '=1+1' AS texto_formula, NULL AS vacio, CAST(9007199254740993 AS SIGNED) AS numero_grande, '00123' AS codigo",
  mariadb: "SELECT '=1+1' AS texto_formula, NULL AS vacio, CAST(9007199254740993 AS SIGNED) AS numero_grande, '00123' AS codigo",
  mssql: "SELECT '=1+1' AS texto_formula, CAST(NULL AS VARCHAR(10)) AS vacio, CAST(9007199254740993 AS BIGINT) AS numero_grande, '00123' AS codigo",
};

for (const m of MOTORES) {
  const pregunta = '¿Cuáles son los primeros 5 pedidos con su cliente?';
  const q = await run(
    m,
    'SELECT o.order_id, c.first_name AS nombre_cliente, c.registration_date AS fecha_registro, o.order_date, o.total AS total_pedido FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.order_id <= 5 ORDER BY o.order_id',
    pregunta,
  );
  if (q.status !== 200) { check(`${m}: consulta de pedidos`, false, JSON.stringify(q.json).slice(0, 160)); continue; }
  const { res, book, path } = await exportar(q.json.resultId);
  check(`${m}: descarga .xlsx`, res.status === 200 && res.headers.get('content-type')?.includes('spreadsheetml') && /filename="resultado-.+\.xlsx"/.test(res.headers.get('content-disposition') ?? ''), `${res.status} ${res.headers.get('content-disposition')}`);
  check(`${m}: hojas Resultado y Detalles`, book.worksheets.map((s) => s.name).join() === 'Resultado,Detalles', book.worksheets.map((s) => s.name).join());
  const hoja = book.getWorksheet('Resultado');
  if (!hoja) continue;
  check(`${m}: encabezados legibles`, valores(hoja, 1).join('|') === 'Order id|Nombre cliente|Fecha registro|Order date|Total pedido', valores(hoja, 1).join('|'));
  check(`${m}: encabezado fijo y con filtro`, hoja.views[0]?.state === 'frozen' && hoja.views[0]?.ySplit === 1 && !!hoja.autoFilter, JSON.stringify(hoja.views));
  check(`${m}: todas las filas`, hoja.actualRowCount === 1 + q.json.totalRows, `${hoja.actualRowCount}`);
  const api = q.json.rows[0];
  const fila = hoja.getRow(2);
  check(`${m}: número como número`, fila.getCell(1).value === api.order_id, `${fila.getCell(1).value}`);
  check(`${m}: texto igual`, fila.getCell(2).value === api.nombre_cliente);
  const fecha = fila.getCell(3);
  check(`${m}: fecha como fecha (dd/mm/yyyy), mismo día`, fecha.value instanceof Date && fecha.value.toISOString() === api.fecha_registro && fecha.numFmt === 'dd/mm/yyyy', `${fecha.value?.toISOString?.()} ${api.fecha_registro} ${fecha.numFmt}`);
  const hora = fila.getCell(4);
  check(`${m}: fecha y hora, misma hora`, hora.value instanceof Date && hora.value.toISOString() === api.order_date && hora.numFmt === 'dd/mm/yyyy hh:mm:ss', `${hora.value?.toISOString?.()} ${api.order_date} ${hora.numFmt}`);
  const total = fila.getCell(5);
  check(`${m}: decimal como número exacto`, total.value === Number(api.total_pedido) && /^#,##0\.0+$/.test(total.numFmt ?? ''), `${total.value} ${api.total_pedido} ${total.numFmt}`);
  const detalles = book.getWorksheet('Detalles');
  const info = Object.fromEntries((detalles?.getSheetValues() ?? []).filter(Boolean).map((r) => [r[1], r[2]]));
  check(`${m}: Detalles con pregunta, conexión y total`, info['Pregunta'] === pregunta && typeof info['Conexión'] === 'string' && info['Total de filas'] === q.json.totalRows, JSON.stringify(info));
  const otra = await fetch(`${BASE}${path}`);
  check(`${m}: el enlace de descarga es de un solo uso`, otra.status === 404, `${otra.status}`);

  const lit = await run(m, LITERALES[m]);
  if (lit.status !== 200) { check(`${m}: consulta de valores especiales`, false, JSON.stringify(lit.json).slice(0, 160)); continue; }
  const { book: book2 } = await exportar(lit.json.resultId);
  const f = book2.getWorksheet('Resultado').getRow(2);
  check(`${m}: texto con «=» no es fórmula`, f.getCell(1).value === '=1+1' && f.getCell(1).type === ExcelJS.ValueType.String, `${JSON.stringify(f.getCell(1).value)} ${f.getCell(1).type}`);
  check(`${m}: NULL queda vacío`, f.getCell(2).value === null, JSON.stringify(f.getCell(2).value));
  check(`${m}: número de más de 15 dígitos exacto (texto)`, f.getCell(3).value === '9007199254740993', JSON.stringify(f.getCell(3).value));
  check(`${m}: código con ceros a la izquierda`, f.getCell(4).value === '00123', JSON.stringify(f.getCell(4).value));

  // 40 000 filas: el Excel trae todas, en el mismo orden que la pantalla.
  const big = await run(m, 'SELECT c1.customer_id AS a, c2.customer_id AS b FROM customers c1 CROSS JOIN customers c2 ORDER BY c1.customer_id, c2.customer_id');
  if (big.status !== 200) { check(`${m}: consulta grande`, false, JSON.stringify(big.json).slice(0, 160)); continue; }
  const { book: book3 } = await exportar(big.json.resultId);
  const h3 = book3.getWorksheet('Resultado');
  const ultima = valores(h3, h3.actualRowCount);
  check(`${m}: ${big.json.totalRows} filas completas`, h3.actualRowCount === big.json.totalRows + 1 && ultima.join() === '200,200' && valores(h3, 2).join() === '1,1', `${h3.actualRowCount} ${ultima}`);
}

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
