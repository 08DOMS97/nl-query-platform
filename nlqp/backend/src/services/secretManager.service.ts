import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Contraseñas de las conexiones en Google Cloud Secret Manager (RNF-05): nunca en
 * Firestore, en el código ni en el cliente. Las usa `connectionStore.service.ts`.
 *
 * Costo: Secret Manager cobra por versión activa y por lectura, con cuota gratuita
 * (6 versiones activas y 10 000 lecturas al mes). Para no salir de ella:
 * - al cambiar una contraseña se destruyen las versiones anteriores (una sola activa
 *   por conexión);
 * - el secreto se lee al abrir el pool de la conexión, no en cada consulta.
 */

let client: SecretManagerServiceClient | undefined;

function getClient(): SecretManagerServiceClient {
  if (!client) client = new SecretManagerServiceClient();
  return client;
}

function projectPath(): string {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID no está configurado — requerido para Secret Manager.');
  }
  return `projects/${projectId}`;
}

/** gRPC NOT_FOUND / ALREADY_EXISTS */
const NOT_FOUND = 5;
const ALREADY_EXISTS = 6;

/**
 * Lee la versión más reciente de un secreto.
 * `secretName` es solo el nombre corto (p. ej. "nlqp-conn-postgres").
 */
export async function getSecret(secretName: string): Promise<string> {
  const name = `${projectPath()}/secrets/${secretName}/versions/latest`;
  const [version] = await getClient().accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`El secreto "${secretName}" no tiene contenido.`);
  }
  return payload;
}

/**
 * Guarda `value` como nueva versión del secreto (creándolo si no existe) y destruye
 * las versiones anteriores, para que quede una sola activa.
 */
export async function addSecretVersion(secretName: string, value: string): Promise<void> {
  const parent = projectPath();
  const secretPath = `${parent}/secrets/${secretName}`;
  try {
    await getClient().createSecret({
      parent,
      secretId: secretName,
      secret: { replication: { automatic: {} }, labels: { app: 'nlqp' } },
    });
  } catch (err) {
    if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
  }
  const [added] = await getClient().addSecretVersion({
    parent: secretPath,
    payload: { data: Buffer.from(value, 'utf8') },
  });
  const [versions] = await getClient().listSecretVersions({ parent: secretPath, filter: 'state:ENABLED' });
  for (const v of versions) {
    if (v.name && v.name !== added.name) await getClient().destroySecretVersion({ name: v.name });
  }
}

/** Elimina el secreto con todas sus versiones. Si no existe, no hace nada. */
export async function deleteSecret(secretName: string): Promise<void> {
  try {
    await getClient().deleteSecret({ name: `${projectPath()}/secrets/${secretName}` });
  } catch (err) {
    if ((err as { code?: number }).code !== NOT_FOUND) throw err;
  }
}
