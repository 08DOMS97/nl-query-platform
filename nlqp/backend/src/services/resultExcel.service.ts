import ExcelJS from 'exceljs';
import type { Writable } from 'node:stream';
import { readRows, type ColumnProfile, type StoredResult } from './resultStore.service.js';

/**
 * Exporta el snapshot completo como Excel (.xlsx), pensado para un usuario no
 * técnico: cada dato en su columna (un CSV depende del separador de listas de
 * Windows, que en es-GT es «;»), encabezados legibles y fijos, fechas como
 * fechas, números como números y una hoja «Detalles» con la pregunta.
 *
 * Integridad: se escriben todas las filas. Excel admite 1 048 576 filas por hoja;
 * si el resultado tiene más, continúa en «Resultado 2», «Resultado 3»… Los
 * números que Excel no guarda exactos (más de 15 dígitos) quedan como texto, y
 * el texto se guarda como texto: un valor que empieza con «=» no se vuelve fórmula.
 *
 * Se escribe por streaming (sin cargar el resultado en memoria) y respetando la
 * contrapresión de la descarga.
 */

const MAX_DATA_ROWS_PER_SHEET = 1_048_575;
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
const HEADER_FILL = 'FFFDEBDC';
const HEADER_BORDER = 'FFE3843F';
const TIME_ZONE = 'America/Guatemala';

/** `total_ventas` → «Total ventas», `fechaPedido` → «Fecha pedido»; las siglas (ID, NIT) se respetan. */
export function columnTitle(name: string): string {
  const words = name
    .replace(/_+/g, ' ')
    .replace(/([a-záéíóúñ0-9])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()));
  if (words.length === 0) return name;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
}

function numberFormat(p: ColumnProfile): string | undefined {
  if (!p.seen) return undefined;
  if (p.date) return p.time ? 'dd/mm/yyyy hh:mm:ss' : 'dd/mm/yyyy';
  if (p.number && p.decimals > 0) return '#,##0.' + '0'.repeat(Math.min(p.decimals, 10));
  return undefined;
}

function columnWidth(title: string, p: ColumnProfile): number {
  const content = !p.seen ? 0 : p.date ? (p.time ? 19 : 10) : p.number ? p.width + Math.ceil(p.width / 3) : p.width;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, title.length, content) + 2);
}

function cellValue(value: unknown, p: ColumnProfile): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  // En el snapshot las fechas ya son texto ISO (en UTC, la hora tal como está en la base).
  if (p.date) return new Date(value as string);
  if (p.number) return Number(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// exceljs no aplica contrapresión entre la hoja y el zip: pasa cada bloque al stream
// de la entrada del zip sin mirar si pidió pausa, y si las filas se escriben más
// rápido de lo que se comprimen, el XML sin comprimir se acumula en memoria (con
// 800 000 filas, unos 130 MB). Se espera a que el zip alcance. Usa campos internos
// de exceljs y de readable-stream; si no existen, no espera (y no falla).
const MAX_PENDING_BYTES = 1024 * 1024;

function pendingZipBytes(sheet: ExcelJS.Worksheet): number {
  type Entry = { _writableState?: { length?: number } };
  const entry = (sheet as unknown as { stream?: { pipes?: Entry[] } }).stream?.pipes?.[0];
  return entry?._writableState?.length ?? 0;
}

async function zipCaughtUp(sheet: ExcelJS.Worksheet): Promise<void> {
  while (pendingZipBytes(sheet) > MAX_PENDING_BYTES) await new Promise((resolve) => setTimeout(resolve, 2));
}

/** Espera si la descarga pidió pausa; falla si el cliente la canceló. */
function drained(out: Writable): Promise<void> | void {
  if (out.destroyed) throw new Error('La descarga se interrumpió.');
  if (!out.writableNeedDrain) return;
  return new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      out.off('close', onClose);
      resolve();
    };
    const onClose = () => {
      out.off('drain', onDrain);
      reject(new Error('La descarga se interrumpió.'));
    };
    out.once('drain', onDrain);
    out.once('close', onClose);
  });
}

export function excelFileName(stored: StoredResult): string {
  const day = stored.createdAt.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  const name = stored.connectionId.replace(/[^\w-]+/g, '-');
  return `resultado-${name}-${day}.xlsx`;
}

export async function writeXlsx(stored: StoredResult, out: Writable): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true, useSharedStrings: false });
  workbook.creator = 'NLQP';
  workbook.created = stored.createdAt;

  const titles = stored.columns.map(columnTitle);
  const sheetCount = Math.max(1, Math.ceil(stored.totalRows / MAX_DATA_ROWS_PER_SHEET));
  const newSheet = (n: number) => {
    const sheet = workbook.addWorksheet(n === 1 ? 'Resultado' : `Resultado ${n}`, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = stored.columns.map((_, i) => {
      const numFmt = numberFormat(stored.profiles[i]);
      return { header: titles[i], width: columnWidth(titles[i], stored.profiles[i]), style: numFmt ? { numFmt } : {} };
    });
    const header = sheet.getRow(1);
    header.eachCell((cell) => {
      cell.style = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } },
        border: { bottom: { style: 'thin', color: { argb: HEADER_BORDER } } },
        alignment: { vertical: 'middle' },
      };
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: stored.columns.length } };
    return sheet;
  };

  // Si el cliente cancela, el zip nunca termina: sin esto, commit() quedaría esperando para siempre.
  const aborted = new Promise<never>((_, reject) => {
    out.once('close', () => {
      if (!out.writableFinished) reject(new Error('La descarga se interrumpió.'));
    });
  });
  aborted.catch(() => {});

  let sheetNumber = 1;
  let sheet = newSheet(sheetNumber);
  let rowsInSheet = 0;
  for await (const row of readRows(stored)) {
    if (rowsInSheet === MAX_DATA_ROWS_PER_SHEET) {
      sheet.commit();
      sheet = newSheet(++sheetNumber);
      rowsInSheet = 0;
    }
    sheet.addRow(stored.columns.map((c, i) => cellValue(row[c], stored.profiles[i]))).commit();
    rowsInSheet++;
    const wait = drained(out);
    if (wait) await wait;
    if (rowsInSheet % 500 === 0) await zipCaughtUp(sheet);
  }
  sheet.commit();

  const details = workbook.addWorksheet('Detalles');
  details.columns = [{ width: 24 }, { width: 80, style: { alignment: { wrapText: true, vertical: 'top' } } }];
  const generated = stored.createdAt
    .toLocaleString('es-GT', {
      timeZone: TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    .replace(',', '');
  const lines: [string, ExcelJS.CellValue][] = [
    ...(stored.question ? [['Pregunta', stored.question] as [string, ExcelJS.CellValue]] : []),
    ['Conexión', stored.connectionName],
    ['Fecha de la consulta', generated],
    ['Total de filas', stored.totalRows],
  ];
  if (sheetCount > 1) {
    lines.push(['Hojas con el resultado', `${sheetCount} (Excel admite hasta 1 048 575 filas por hoja)`]);
  }
  for (const [label, value] of lines) {
    const r = details.addRow([label, value]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { horizontal: 'left', wrapText: true, vertical: 'top' };
    if (typeof value === 'number') r.getCell(2).numFmt = '#,##0';
    r.commit();
  }
  details.commit();

  await Promise.race([workbook.commit(), aborted]);
}
