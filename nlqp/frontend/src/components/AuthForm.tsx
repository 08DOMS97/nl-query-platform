'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Notice } from './ui';

const ERRORES_FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  'auth/network-request-failed': 'No hay conexión con el servicio de autenticación.',
};

/** Traduce el error de Firebase Auth; si no se conoce, muestra el original. */
function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && ERRORES_FIREBASE[code]) return ERRORES_FIREBASE[code];
  return err instanceof Error ? err.message : String(err);
}

/** Formulario de correo y contraseña compartido por inicio de sesión y registro. */
export function AuthForm({
  title,
  description,
  submitLabel,
  submittingLabel,
  passwordHint,
  onSubmit,
  footer,
}: {
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  passwordHint?: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  footer: ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const input =
    'block h-9 w-full rounded border border-line-strong bg-canvas px-3 text-[14px] focus:border-accent-500 focus:outline-none';

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="m-auto w-full max-w-[380px] px-6 py-12">
        <p className="font-mono text-[15px] font-medium tracking-tight">NLQP</p>
        <p className="mt-0.5 text-[12px] text-ink-3">Consultas en lenguaje natural</p>

        <form onSubmit={handleSubmit} className="mt-8 rounded border border-line bg-canvas">
          <div className="space-y-4 p-6">
            <div>
              <h1 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h1>
              <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium">
                Correo
              </label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="text-[13px] font-medium">
                  Contraseña
                </label>
                {passwordHint && <span className="text-[12px] text-ink-3">{passwordHint}</span>}
              </div>
              <input
                id="password"
                type="password"
                required
                minLength={passwordHint ? 6 : undefined}
                autoComplete={passwordHint ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </div>
            {error && <Notice tone="bad">{error}</Notice>}
          </div>
          <div className="border-t border-line bg-surface px-6 py-3">
            <Button type="submit" variant="primary" disabled={loading} className="h-9 w-full">
              {loading ? submittingLabel : submitLabel}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-[13px] text-ink-2">{footer}</p>
      </div>
    </div>
  );
}
