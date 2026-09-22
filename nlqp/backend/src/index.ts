import express from 'express';
import cors from 'cors';
import { testConnectionHandler } from './functions/testConnection.js';
import { getSchemaHandler } from './functions/getSchema.js';
import { generateSQLHandler } from './functions/generateSQL.js';
import { executeQueryHandler } from './functions/executeQuery.js';
import { verifyFirebaseAuth } from './middleware/auth.middleware.js';

/**
 * Servidor local de desarrollo: monta las 4 funciones en un único proceso Express
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

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`NLQP backend escuchando en http://localhost:${port}`);
});
