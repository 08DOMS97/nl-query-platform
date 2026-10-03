import express from 'express';
import cors from 'cors';
import { testConnectionHandler } from './functions/testConnection.js';
import { getSchemaHandler } from './functions/getSchema.js';
import { generateSQLHandler } from './functions/generateSQL.js';
import { executeQueryHandler } from './functions/executeQuery.js';
import { getUsageStatsHandler } from './functions/getUsageStats.js';
import {
  createResultExportHandler,
  exportResultCsvHandler,
  getResultPageHandler,
} from './functions/resultPages.js';
import { verifyFirebaseAuth } from './middleware/auth.middleware.js';

/**
 * Servidor local de desarrollo: monta todas las funciones en un único proceso Express
 * para poder probarlas con `npm run dev`. En producción cada función se despliega
 * por separado como Cloud Function 2nd gen (ver `functions.http(...)` en cada
 * archivo de `src/functions/`) — este archivo no se usa en producción.
 */

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/testConnection', verifyFirebaseAuth, testConnectionHandler);
app.get('/getSchema', verifyFirebaseAuth, getSchemaHandler);
app.post('/generateSQL', verifyFirebaseAuth, generateSQLHandler);
app.post('/executeQuery', verifyFirebaseAuth, executeQueryHandler);
app.get('/getUsageStats', verifyFirebaseAuth, getUsageStatsHandler);
app.get('/getResultPage', verifyFirebaseAuth, getResultPageHandler);
app.post('/createResultExport', verifyFirebaseAuth, createResultExportHandler);
// Sin verifyFirebaseAuth a propósito: lo autoriza el token de un solo uso (ver handler).
app.get('/exportResultCsv', exportResultCsvHandler);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`NLQP backend escuchando en http://localhost:${port}`);
});
