import type { Response } from 'express';
import { ConnectionNotFoundError, ConnectionValidationError } from '../services/connectionStore.service.js';

/**
 * Responde 400 / 404 si `err` es un error de conexión inválida o inexistente y
 * devuelve `true`; si no, devuelve `false` para que el handler siga con su manejo.
 */
export function handleConnectionError(err: unknown, res: Response): boolean {
  if (err instanceof ConnectionValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  if (err instanceof ConnectionNotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}
