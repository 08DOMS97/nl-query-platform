import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.middleware.js';
import { closePool, testConnectionConfig } from '../services/connectionManager.service.js';
import {
  assertUniqueName,
  configForEdit,
  createConnection,
  deleteConnection,
  getConnection,
  listConnections,
  parseConnectionInput,
  updateConnection,
} from '../services/connectionStore.service.js';
import type { ConnectionSummary } from '../types/index.js';
import { handleConnectionError } from './connectionErrors.js';

function requireId(req: Request, res: Response): string | null {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!id) {
    res.status(400).json({ error: 'Parámetro "id" es requerido.' });
    return null;
  }
  return id;
}

/**
 * Módulo 1: gestión de conexiones.
 *
 *   GET    /connections            -> { connections } (todo usuario; el técnico recibe
 *                                     además servidor, puerto y usuario)
 *   POST   /connections            -> crea (solo técnico); body: ConnectionInput
 *   PUT    /connections?id=...     -> edita (solo técnico); `password` opcional
 *   DELETE /connections?id=...     -> elimina (solo técnico)
 *
 * Crear o editar prueba la conexión antes de guardar: una conexión que no responde
 * no se registra. La contraseña va a Secret Manager y nunca se devuelve.
 */
export const connectionsHandler = async (req: Request, res: Response): Promise<void> => {
  const { uid, role } = req as AuthedRequest;
  try {
    if (req.method === 'GET') {
      const all = await listConnections();
      const connections: ConnectionSummary[] | typeof all =
        role === 'tecnico' ? all : all.map(({ id, name, engine, database }) => ({ id, name, engine, database }));
      res.status(200).json({ connections });
      return;
    }

    if (role !== 'tecnico') {
      res.status(403).json({ error: 'Esta función es solo para el rol técnico.' });
      return;
    }

    if (req.method === 'POST') {
      const input = parseConnectionInput(req.body);
      // El nombre se revisa antes de probar la conexión: es más rápido y el error es más claro.
      await assertUniqueName(input.name);
      const test = await testConnectionConfig(input.engine, { ...input, password: input.password! });
      if (!test.ok) {
        res.status(422).json({ error: `No se pudo conectar: ${test.error}` });
        return;
      }
      const created = await createConnection({ ...input, password: input.password! }, uid ?? null);
      res.status(201).json(created);
      return;
    }

    if (req.method === 'PUT') {
      const id = requireId(req, res);
      if (!id) return;
      const current = await getConnection(id);
      const input = parseConnectionInput({ ...req.body, engine: current.engine }, true);
      await assertUniqueName(input.name, id);
      const { engine, config } = await configForEdit(id, input);
      const test = await testConnectionConfig(engine, config);
      if (!test.ok) {
        res.status(422).json({ error: `No se pudo conectar: ${test.error}` });
        return;
      }
      const updated = await updateConnection(id, input);
      // El pool abierto usa los datos anteriores: se cierra y el próximo uso abre uno nuevo.
      await closePool(id);
      res.status(200).json(updated);
      return;
    }

    if (req.method === 'DELETE') {
      const id = requireId(req, res);
      if (!id) return;
      await closePool(id);
      await deleteConnection(id);
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * POST /testConnectionConfig { id?, engine, host, port, database, user, password? }
 *   -> { ok, latencyMs?, error? }
 * Prueba datos de conexión sin guardarlos (botón "Probar" del formulario). Con `id`
 * (edición), la contraseña vacía usa la guardada. Solo rol técnico.
 */
export const testConnectionConfigHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // El nombre no hace falta para probar (el formulario puede no tenerlo todavía).
    const body: Record<string, unknown> = { ...((req.body ?? {}) as Record<string, unknown>), name: 'prueba' };
    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    let result;
    if (id) {
      const current = await getConnection(id);
      const input = parseConnectionInput({ ...body, engine: current.engine }, true);
      const { engine, config } = await configForEdit(id, input);
      result = await testConnectionConfig(engine, config);
    } else {
      const input = parseConnectionInput(body);
      result = await testConnectionConfig(input.engine, { ...input, password: input.password! });
    }
    res.status(200).json(result);
  } catch (err) {
    if (handleConnectionError(err, res)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

functions.http('connections', connectionsHandler);
functions.http('testConnectionConfig', testConnectionConfigHandler);
