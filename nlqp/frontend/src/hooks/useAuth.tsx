'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { UserRole } from '@/lib/types';

interface AuthState {
  user: User | null;
  /**
   * Rol leído del token (claim `role`). Solo decide qué se muestra: los permisos
   * los aplica el backend con el mismo claim.
   */
  role: UserRole;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, role: 'no_tecnico', loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: 'no_tecnico', loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, role: 'no_tecnico', loading: false });
        return;
      }
      const { claims } = await user.getIdTokenResult();
      setState({ user, role: claims.role === 'tecnico' ? 'tecnico' : 'no_tecnico', loading: false });
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
