import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import {
  createExportToken,
  readPage,
  redeemExportToken,
  ResultNotFoundError,
  writeCsv,
} from '../services/resultStore.service.js';

type AuthedRequest = Request & { uid?: string };

/**
 * GET /getResultPage?resultId=...&page=N -> una página del snapshot creado por
 * `/executeQuery`. No vuelve a ejecutar la consulta.
 */
export const getResultPageHandler = async (req: Request, res: Response): Promise<void> => {
  const resultId = typeof req.query.resultId === 'string' ? req.query.resultId : '';
  const page = Number(req.query.page ?? 1);
  if (!resultId) {
    res.status(400).json({ error: 'Parámetro "resultId" es requerido.' });
    return;
  }

  try {
    res.status(200).json(await readPage(resultId, (req as AuthedRequest).uid ?? null, page));
  } catch (err) {
    const status = err instanceof ResultNotFoundError ? 404 : err instanceof RangeError ? 400 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * POST /createResultExport { resultId } -> { path }
 * Devuelve la ruta de descarga del CSV completo, con un token de un solo uso.
 */
export const createResultExportHandler = async (req: Request, res: Response): Promise<void> => {
  const resultId = (req.body as { resultId?: unknown }).resultId;
  if (typeof resultId !== 'string' || !resultId) {
    res.status(400).json({ error: 'Campo "resultId" es requerido.' });
    return;
  }

  try {
    const token = createExportToken(resultId, (req as AuthedRequest).uid ?? null);
    res.status(200).json({ path: `/exportResultCsv?token=${encodeURIComponent(token)}` });
  } catch (err) {
    const status = err instanceof ResultNotFoundError ? 404 : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * GET /exportResultCsv?token=... -> CSV completo del snapshot, por streaming.
 * No pasa por el middleware de auth (es una navegación del navegador, sin
 * encabezados): la autorización es el token de un solo uso de `/createResultExport`.
 */
export const exportResultCsvHandler = async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  let stored;
  try {
    stored = redeemExportToken(token);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nlqp-resultado-${stored.engine}.csv"`);
  try {
    await writeCsv(stored, res);
    res.end();
  } catch {
    // Ya se enviaron encabezados: cortar la conexión hace que la descarga falle de
    // forma visible en lugar de dejar un CSV incompleto que parezca completo.
    res.destroy();
  }
};

functions.http('getResultPage', getResultPageHandler);
functions.http('createResultExport', createResultExportHandler);
functions.http('exportResultCsv', exportResultCsvHandler);
