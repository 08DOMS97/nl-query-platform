import * as functions from '@google-cloud/functions-framework';
import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.middleware.js';
import { UserValidationError, createUser, listUsers, updateUser } from '../services/userAdmin.service.js';

/**
 * Gestión de usuarios (solo superadministrador; lo exige `requireSuperadmin`):
 *
 *   GET  /users              -> { users }
 *   POST /users              -> crea; body: { email, password, role }
 *   PUT  /users?uid=...      -> body: { role?, disabled?, password? }
 *
 * No hay DELETE: las cuentas se desactivan para conservar su historial.
 */
export const usersHandler = async (req: Request, res: Response): Promise<void> => {
  const { uid } = req as AuthedRequest;
  try {
    if (req.method === 'GET') {
      res.status(200).json({ users: await listUsers() });
      return;
    }
    if (req.method === 'POST') {
      res.status(201).json(await createUser(req.body));
      return;
    }
    if (req.method === 'PUT') {
      const target = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
      if (!target) {
        res.status(400).json({ error: 'Parámetro "uid" es requerido.' });
        return;
      }
      res.status(200).json(await updateUser(target, req.body, uid ?? ''));
      return;
    }
    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    if (err instanceof UserValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * GET /me -> { email, role, superadmin } del usuario de la sesión, leídos de la cuenta
 * (no del token, que puede tener hasta una hora). La interfaz arma el menú con esto.
 */
export const meHandler = (req: Request, res: Response): void => {
  const { email, role, superadmin } = req as AuthedRequest;
  res.status(200).json({ email, role, superadmin: !!superadmin });
};

functions.http('users', usersHandler);
functions.http('me', meHandler);
