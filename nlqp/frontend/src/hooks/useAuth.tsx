'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { apiRequest } from '@/lib/api';
import type { UserRole } from '@/lib/types';

interface AuthState {
  user: User | null;
  /**
   * Rol y permiso de superadministrador de la cuenta, leídos del backend (`/me`) y no
   * del token, que puede tener hasta una hora: así un cambio hecho por el
   * superadministrador se ve al recargar. Solo deciden qué se muestra; los permisos
   * los aplica el backend.
   */
  role: UserRole;
  superadmin: boolean;
  /** La cuenta no puede usar el sistema (sin rol asignado, desactivada) o el backend no responde. */
  accessError: string | null;
  loading: boolean;
}

const SIN_SESION: AuthState = { user: null, role: 'no_tecnico', superadmin: false, accessError: null, loading: false };

const AuthContext = createContext<AuthState>({ ...SIN_SESION, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...SIN_SESION, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState(SIN_SESION);
        return;
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const { ok, status, data } = await apiRequest<{ role: UserRole; superadmin: boolean }>('/me', user);
        // Si se cerró la sesión (o entró otra cuenta) mientras se leía, la respuesta ya no vale.
        if (auth.currentUser !== user) return;
        if (ok) {
          setState({ user, role: data.role, superadmin: data.superadmin, accessError: null, loading: false });
        } else {
          setState({ ...SIN_SESION, user, accessError: data.error ?? `Error ${status} al leer la cuenta.` });
        }
      } catch {
        if (auth.currentUser !== user) return;
        setState({ ...SIN_SESION, user, accessError: 'No hay conexión con el servidor de NLQP.' });
      }
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
