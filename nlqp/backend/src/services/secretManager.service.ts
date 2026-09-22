import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * Solo se usa en producción. En desarrollo local las credenciales vienen de
 * `.env` (ver INSTRUCCIONES_INICIALES_CLAUDE_CODE.md §2) — las credenciales
 * reales de cada cliente se guardan en Secret Manager (RNF-05) y nunca en
 * código ni en variables de entorno del proceso.
 */

let client: SecretManagerServiceClient | undefined;

function getClient(): SecretManagerServiceClient {
  if (!client) client = new SecretManagerServiceClient();
  return client;
}

/**
 * Lee la versión más reciente de un secreto.
 * `secretName` es solo el nombre corto (p. ej. "cliente-acme-db-password");
 * el proyecto GCP se resuelve de `GCP_PROJECT_ID`.
 */
export async function getSecret(secretName: string): Promise<string> {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID no está configurado — requerido para leer Secret Manager.');
  }

  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await getClient().accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`El secreto "${secretName}" no tiene contenido.`);
  }
  return payload;
}
