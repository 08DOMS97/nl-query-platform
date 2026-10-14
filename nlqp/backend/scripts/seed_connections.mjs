/**
 * Carga las conexiones iniciales del banco de pruebas en el registro de conexiones
 * (Firestore + Secret Manager), a partir de las variables `DB_*` del `.env`:
 *
 *   npm run seed:connections
 *
 * Cada una usa como id el nombre de su motor (`postgres`, `mysql`, `mariadb`,
 * `mssql`): así el runner de evaluación y el historial anterior, que identifican la
 * base por motor, siguen funcionando. Si una conexión ya existe, no se toca (los
 * cambios se hacen desde la pantalla Conexiones). Crea un secreto por conexión: 4 de
 * las 6 versiones activas gratuitas de Secret Manager.
 */
import { readEngineConfig } from '../lib/services/connectionManager.service.js';
import { createConnection, getConnection } from '../lib/services/connectionStore.service.js';

const INICIALES = [
  { id: 'postgres', name: 'Tienda · Servidor A' },
  { id: 'mysql', name: 'Tienda · Servidor B' },
  { id: 'mariadb', name: 'Tienda · Servidor C' },
  { id: 'mssql', name: 'Tienda · Servidor D' },
];

for (const { id, name } of INICIALES) {
  try {
    const existing = await getConnection(id);
    console.log(`${id}: ya existe ("${existing.name}"), sin cambios`);
    continue;
  } catch (err) {
    if (err?.name !== 'ConnectionNotFoundError') throw err;
  }
  const cfg = readEngineConfig(id);
  const created = await createConnection(
    { name, engine: id, host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password },
    null,
    id,
  );
  console.log(`${id}: creada ("${created.name}", ${created.host}:${created.port}/${created.database})`);
}
process.exit(0);
