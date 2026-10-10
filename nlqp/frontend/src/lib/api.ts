import type { User } from 'firebase/auth';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

interface RequestOptions {
  method?: string;
  body?: unknown;
}

/**
 * Llama al backend con el ID token de Firebase del usuario y devuelve la respuesta
 * sin interpretar el código HTTP. Sirve para los endpoints que traen datos útiles
 * también en un error (p. ej. `/testConnection` responde 502 con el detalle por motor).
 */
export async function apiRequest<T>(
  path: string,
  user: User,
  options: RequestOptions = {},
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const idToken = await user.getIdToken();

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Igual que `apiRequest`, pero lanza un Error con el mensaje que devuelve el
 * backend en `{ error }` cuando la respuesta no es 2xx.
 */
export async function apiFetch<T>(path: string, user: User, options: RequestOptions = {}): Promise<T> {
  const { ok, status, data } = await apiRequest<T>(path, user, options);
  if (!ok) {
    throw new Error(data.error ?? `Error ${status} llamando a ${path}.`);
  }
  return data;
}
