import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { Writable } from 'node:stream';
import { streamQuery } from './connectionManager.service.js';
import type { DbEngine } from '../types/index.js';

/**
 * Snapshot del resultado de una consulta, para entregarlo por páginas y como CSV
 * SIN perder filas y sin volver a ejecutar la consulta.
 *
 * Por qué un snapshot y no re-ejecutar por página: sin un ORDER BY estable, dos
 * ejecuciones de la misma consulta pueden devolver las filas en distinto orden,
 * y paginar re-ejecutando podría repetir o saltarse filas entre páginas. Además
 * cada página volvería a cargar la base. Aquí la consulta corre UNA vez, el
 * resultado completo se vuelca por streaming a un archivo NDJSON temporal y
 * tanto las páginas como el CSV se leen de ese mismo archivo: lo que el usuario
 * ve en pantalla y lo que descarga son exactamente los mismos datos.
 *
 * Integridad: nunca se trunca. Si el resultado supera RESULT_MAX_BYTES, o la
 * consulta supera el timeout, se descarta el snapshot entero y se devuelve error
 * (todo o nada), igual que el timeout de ejecución.
 *
 * Alcance: el almacén vive en el disco y la memoria de este proceso, lo que
 * encaja con la presentación en local (un solo backend). En Cloud Functions con
 * varias instancias habría que mover el snapshot a almacenamiento compartido.
 */

export const RESULT_PAGE_SIZE = 1000;
const RESULT_MAX_BYTES = Number(process.env.NLQP_RESULT_MAX_BYTES ?? 1024 * 1024 * 1024);
const RESULT_TTL_MS = 30 * 60 * 1000;
const WRITE_BLOCK_BYTES = 256 * 1024;
const EXPORT_TOKEN_TTL_MS = 2 * 60 * 1000;
const STORE_DIR = path.join(os.tmpdir(), 'nlqp-results');

interface StoredResult {
  id: string;
  uid: string | null;
  engine: DbEngine;
  columns: string[];
  totalRows: number;
  filePath: string;
  /** Byte de inicio de cada página dentro del archivo, para leerla sin recorrer las anteriores. */
  pageOffsets: number[];
  bytes: number;
  expiresAt: number;
}

const results = new Map<string, StoredResult>();

// Snapshots de una ejecución anterior del proceso: ya no hay metadatos que los
// referencien, así que se borran al arrancar (antes de crear el primero nuevo).
const startupCleanup = rm(STORE_DIR, { recursive: true, force: true });
const exportTokens = new Map<string, { resultId: string; expiresAt: number }>();

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export class ResultTooLargeError extends Error {
  constructor() {
    super(
      `El resultado supera el tamaño máximo de ${formatBytes(RESULT_MAX_BYTES)} y ` +
        'se descartó completo (no se entregan resultados parciales). Acota la consulta.',
    );
    this.name = 'ResultTooLargeError';
  }
}

export class ResultNotFoundError extends Error {
  constructor() {
    super('El resultado no existe o expiró. Vuelve a ejecutar la consulta.');
    this.name = 'ResultNotFoundError';
  }
}

/** BigInt no es serializable en JSON: se envía como texto para no perder precisión. */
function serializeRow(row: Record<string, unknown>): string {
  return JSON.stringify(row, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

function writeChunk(stream: WriteStream, chunk: string): Promise<void> | void {
  if (stream.destroyed) throw new Error('El archivo del resultado se cerró inesperadamente.');
  if (!stream.write(chunk)) {
    // También se libera ante 'close' (p. ej. error de disco): si no, la consulta
    // quedaría esperando un 'drain' que nunca llega.
    return new Promise((resolve, reject) => {
      const onDrain = () => {
        stream.off('close', onClose);
        resolve();
      };
      const onClose = () => {
        stream.off('drain', onDrain);
        reject(new Error('El archivo del resultado se cerró inesperadamente.'));
      };
      stream.once('drain', onDrain);
      stream.once('close', onClose);
    });
  }
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.end(() => resolve());
  });
}

/** Ejecuta la consulta una vez y guarda el resultado completo como snapshot. */
export async function createResult(
  engine: DbEngine,
  sql: string,
  uid: string | null,
): Promise<StoredResult> {
  await startupCleanup;
  await mkdir(STORE_DIR, { recursive: true });
  const id = randomUUID();
  const filePath = path.join(STORE_DIR, `${id}.ndjson`);
  const out = createWriteStream(filePath, { encoding: 'utf8' });
  // Sin este manejador, un error del stream (o una escritura pendiente al
  // descartarlo con destroy()) se emite sin escucha y tumba el proceso entero.
  let writeError: unknown;
  out.on('error', (err) => {
    writeError ??= err;
  });

  let columns: string[] = [];
  const pageOffsets: number[] = [];
  let bytes = 0;
  let totalRows = 0;
  let buffer: string[] = [];
  let bufferedBytes = 0;
  const flush = () => {
    if (buffer.length === 0) return;
    const chunk = buffer.join('');
    buffer = [];
    bufferedBytes = 0;
    return writeChunk(out, chunk);
  };

  try {
    await streamQuery(engine, sql, {
      onColumns: (c) => {
        columns = c;
      },
      onRow: (row) => {
        if (totalRows % RESULT_PAGE_SIZE === 0) pageOffsets.push(bytes);
        const line = serializeRow(row) + '\n';
        const lineBytes = Buffer.byteLength(line);
        bytes += lineBytes;
        if (bytes > RESULT_MAX_BYTES) throw new ResultTooLargeError();
        totalRows++;
        // Se escribe por bloques: una escritura por fila es mucho más lenta.
        buffer.push(line);
        bufferedBytes += lineBytes;
        if (bufferedBytes >= WRITE_BLOCK_BYTES) return flush();
      },
    });
    await flush();
    await closeStream(out);
    if (writeError) throw writeError;
  } catch (err) {
    // En Windows no se puede borrar un archivo que sigue abierto: esperar el cierre.
    // No usar events.once: rechaza si llega un 'error' (las escrituras pendientes al
    // descartar el stream lo emiten) y el archivo quedaría sin borrar.
    const closed = out.closed ? Promise.resolve() : new Promise<void>((resolve) => out.once('close', () => resolve()));
    out.destroy();
    await closed;
    await rm(filePath, { force: true });
    throw err;
  }

  const stored: StoredResult = {
    id,
    uid,
    engine,
    columns,
    totalRows,
    filePath,
    pageOffsets,
    bytes,
    expiresAt: Date.now() + RESULT_TTL_MS,
  };
  results.set(id, stored);
  return stored;
}

/** Solo el usuario que ejecutó la consulta puede leer su resultado. */
function getOwned(resultId: string, uid: string | null): StoredResult {
  const stored = results.get(resultId);
  if (!stored || stored.expiresAt < Date.now() || stored.uid !== uid) {
    throw new ResultNotFoundError();
  }
  return stored;
}

export function totalPages(stored: StoredResult): number {
  return Math.max(1, Math.ceil(stored.totalRows / RESULT_PAGE_SIZE));
}

export interface ResultPage {
  resultId: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Lee la página `page` (desde 1) del snapshot. */
export async function readPage(
  resultId: string,
  uid: string | null,
  page: number,
): Promise<ResultPage> {
  const stored = getOwned(resultId, uid);
  const pages = totalPages(stored);
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    throw new RangeError(`Página inválida: debe estar entre 1 y ${pages}.`);
  }

  const rows: Record<string, unknown>[] = [];
  if (stored.totalRows > 0) {
    const start = stored.pageOffsets[page - 1];
    const end = page < stored.pageOffsets.length ? stored.pageOffsets[page] - 1 : undefined;
    const lines = readline.createInterface({
      input: createReadStream(stored.filePath, { encoding: 'utf8', start, end }),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (line) rows.push(JSON.parse(line) as Record<string, unknown>);
    }
  }

  return {
    resultId: stored.id,
    columns: stored.columns,
    rows,
    totalRows: stored.totalRows,
    page,
    pageSize: RESULT_PAGE_SIZE,
    totalPages: pages,
  };
}

/**
 * Crea un token de descarga de un solo uso y corta duración. La descarga se hace
 * navegando a una URL (para que el navegador la guarde directo a disco por
 * streaming), y una navegación no puede llevar el encabezado Authorization: el
 * token, emitido a un usuario ya autenticado y dueño del resultado, cumple ese
 * papel sin exponer el ID token de Firebase en la URL.
 */
export function createExportToken(resultId: string, uid: string | null): string {
  getOwned(resultId, uid);
  const token = randomUUID();
  exportTokens.set(token, { resultId, expiresAt: Date.now() + EXPORT_TOKEN_TTL_MS });
  return token;
}

/** Consume el token (un solo uso) y devuelve el resultado al que da acceso. */
export function redeemExportToken(token: string): StoredResult {
  const entry = exportTokens.get(token);
  exportTokens.delete(token);
  const stored = entry && entry.expiresAt >= Date.now() ? results.get(entry.resultId) : undefined;
  if (!stored || stored.expiresAt < Date.now()) throw new ResultNotFoundError();
  return stored;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Escribe el snapshot completo como CSV en `out`, respetando la contrapresión. */
const UTF8_BOM = String.fromCharCode(0xfeff);

export async function writeCsv(stored: StoredResult, out: Writable): Promise<void> {
  // Si el cliente cancela la descarga, `out` se cierra y no habrá más 'drain':
  // se corta la lectura en vez de quedar esperando para siempre.
  const write = (chunk: string): Promise<void> | void => {
    if (out.destroyed) throw new Error('La descarga se interrumpió.');
    if (out.write(chunk)) return;
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
  };

  // BOM para que Excel reconozca UTF-8 (acentos y ñ).
  await write(UTF8_BOM + stored.columns.map(csvCell).join(',') + '\r\n');
  const input = createReadStream(stored.filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line) continue;
      const row = JSON.parse(line) as Record<string, unknown>;
      await write(stored.columns.map((c) => csvCell(row[c])).join(',') + '\r\n');
    }
  } finally {
    input.destroy();
  }
}

/** Borra snapshots y tokens vencidos. */
async function sweepExpired(): Promise<void> {
  const now = Date.now();
  for (const [token, entry] of exportTokens) {
    if (entry.expiresAt < now) exportTokens.delete(token);
  }
  for (const [id, stored] of results) {
    if (stored.expiresAt < now) {
      results.delete(id);
      await rm(stored.filePath, { force: true });
    }
  }
}

setInterval(() => void sweepExpired(), 60_000).unref();

