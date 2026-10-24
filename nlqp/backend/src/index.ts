import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { poolStatusHandler, testConnectionHandler } from './functions/testConnection.js';
import { getSchemaHandler } from './functions/getSchema.js';
import { generateSQLHandler } from './functions/generateSQL.js';
import { executeQueryHandler } from './functions/executeQuery.js';
import { getUsageStatsHandler } from './functions/getUsageStats.js';
import { getHistoryHandler, savedQueriesHandler, sqlEditsHandler } from './functions/queryHistory.js';
import { connectionsHandler, testConnectionConfigHandler } from './functions/connections.js';
import {
  createResultExportHandler,
  exportResultCsvHandler,
  getResultPageHandler,
} from './functions/resultPages.js';
import { meHandler, usersHandler } from './functions/users.js';
import { requireSuperadmin, requireTechnicalRole, verifyFirebaseAuth } from './middleware/auth.middleware.js';

/**
 * Servidor local de desarrollo: monta todas las funciones en un único proceso Express
 * para poder probarlas con `npm run dev`. En producción cada función se despliega
 * por separado como Cloud Function 2nd gen (ver `functions.http(...)` en cada
 * archivo de `src/functions/`) — este archivo no se usa en producción.
 */

/**
 * Express 4 no captura el rechazo de un handler async: sin esto, un error no previsto
 * (p. ej. un campo con un tipo inesperado) termina el proceso y deja el servicio caído
 * para todos (auditoría del 24/10). Con `wrap`, el error llega al manejador de abajo.
 */
const wrap =
  (handler: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res)).catch(next);
  };

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Módulo 1: lista de conexiones para todos; crear, editar y eliminar, solo técnico
// (el handler lo verifica por método).
app.all('/connections', verifyFirebaseAuth, wrap(connectionsHandler));
app.post('/testConnectionConfig', verifyFirebaseAuth, requireTechnicalRole, wrap(testConnectionConfigHandler));
// Módulo 4 (rol técnico): conexiones y pool, esquema, uso y costos.
app.get('/testConnection', verifyFirebaseAuth, requireTechnicalRole, wrap(testConnectionHandler));
app.get('/poolStatus', verifyFirebaseAuth, requireTechnicalRole, wrap(poolStatusHandler));
app.get('/getSchema', verifyFirebaseAuth, requireTechnicalRole, wrap(getSchemaHandler));
app.post('/generateSQL', verifyFirebaseAuth, wrap(generateSQLHandler));
app.post('/executeQuery', verifyFirebaseAuth, wrap(executeQueryHandler));
app.get('/getUsageStats', verifyFirebaseAuth, requireTechnicalRole, wrap(getUsageStatsHandler));
app.get('/history', verifyFirebaseAuth, wrap(getHistoryHandler));
app.all('/savedQueries', verifyFirebaseAuth, wrap(savedQueriesHandler));
app.get('/sqlEdits', verifyFirebaseAuth, requireTechnicalRole, wrap(sqlEditsHandler));
app.get('/getResultPage', verifyFirebaseAuth, wrap(getResultPageHandler));
app.post('/createResultExport', verifyFirebaseAuth, wrap(createResultExportHandler));
// Rol del usuario de la sesión (la interfaz arma el menú con esto).
app.get('/me', verifyFirebaseAuth, wrap(meHandler));
// Gestión de usuarios: solo el superadministrador.
app.all('/users', verifyFirebaseAuth, requireSuperadmin, wrap(usersHandler));
// Sin verifyFirebaseAuth a propósito: lo autoriza el token de un solo uso (ver handler).
app.get('/exportResultCsv', wrap(exportResultCsvHandler));

// Errores sin manejar: respuesta JSON sin stack trace ni rutas del servidor.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) return next(err);
  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'La solicitud es demasiado grande.' });
    return;
  }
  console.error('[backend] error sin manejar:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`NLQP backend escuchando en http://localhost:${port}`);
});
