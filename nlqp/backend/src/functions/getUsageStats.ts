import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import { getUsageStats } from '../services/usageTracking.service.js';

/**
 * GET /getUsageStats?periodDays=30&origin=usuario -> estadísticas agregadas de uso y costo
 * `origin`: 'usuario' (por defecto, sin las corridas de evaluación), 'evaluacion' o 'todos'.
 * (módulo de uso y costos, ver nlqp/docs/USO_Y_COSTOS.md).
 */
export const getUsageStatsHandler = async (req: Request, res: Response): Promise<void> => {
  const periodDaysRaw = req.query.periodDays;
  const periodDays = periodDaysRaw !== undefined ? Number(periodDaysRaw) : 30;

  if (!Number.isFinite(periodDays) || periodDays <= 0 || periodDays > 365) {
    res.status(400).json({ error: 'Parámetro "periodDays" debe ser un número entre 1 y 365.' });
    return;
  }

  const origin = req.query.origin ?? 'usuario';
  if (origin !== 'usuario' && origin !== 'evaluacion' && origin !== 'todos') {
    res.status(400).json({ error: 'Parámetro "origin" debe ser usuario, evaluacion o todos.' });
    return;
  }

  try {
    const stats = await getUsageStats(periodDays, origin);
    res.status(200).json(stats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('getUsageStats', getUsageStatsHandler);
