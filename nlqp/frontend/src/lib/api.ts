import type { User } from 'firebase/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

/**
 * Llama al backend adjuntando el ID token de Firebase del usuario logueado.
 * Lanza un Error con el mismo mensaje que devuelve el backend en `{ error }`
 * cuando la respuesta no es 2xx (mismo contrato que ya se probó por curl).
 */
export async function apiFetch<T>(
  path: string,
  user: User,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
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

  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status} llamando a ${path}.`);
  }

  return data as T;
}
