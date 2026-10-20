'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { QueryDraftProvider } from '@/hooks/useQueryDraft';
import { ConnectionsProvider } from '@/hooks/useConnections';
import { AppShell, SUPERADMIN_PATHS, TECHNICAL_PATHS } from '@/components/AppShell';
import { Button, Notice, PageHeader } from '@/components/ui';

/** Pantallas con sesión: exige usuario y arma la navegación según el rol. */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  const { user, role, superadmin, accessError, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] text-ink-3">Cargando sesión…</p>
      </div>
    );
  }

  // Cuenta sin rol o desactivada: no se muestra la aplicación.
  if (accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-[420px] space-y-4">
          <PageHeader title="Sin acceso" description={user.email ?? undefined} />
          <Notice tone="warn">{accessError}</Notice>
          <Button onClick={() => signOut(auth)}>Cerrar sesión</Button>
        </div>
      </div>
    );
  }

  const technicalOnly = TECHNICAL_PATHS.some((path) => pathname.startsWith(path));
  const superadminOnly = SUPERADMIN_PATHS.some((path) => pathname.startsWith(path));

  return (
    <ConnectionsProvider user={user}>
      <QueryDraftProvider>
        <AppShell user={user} role={role} superadmin={superadmin}>
          {technicalOnly && role !== 'tecnico' ? (
            <div className="space-y-6">
              <PageHeader title="Acceso restringido" />
              <Notice tone="warn">Esta sección es solo para usuarios con rol técnico.</Notice>
            </div>
          ) : superadminOnly && !superadmin ? (
            <div className="space-y-6">
              <PageHeader title="Acceso restringido" />
              <Notice tone="warn">Esta sección es solo para el superadministrador.</Notice>
            </div>
          ) : (
            children
          )}
        </AppShell>
      </QueryDraftProvider>
    </ConnectionsProvider>
  );
}
