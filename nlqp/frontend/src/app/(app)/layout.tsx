'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { QueryDraftProvider } from '@/hooks/useQueryDraft';
import { AppShell, TECHNICAL_PATHS } from '@/components/AppShell';
import { Notice, PageHeader } from '@/components/ui';

/** Pantallas con sesión: exige usuario y arma la navegación según el rol. */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  const { user, role, loading } = useAuth();
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

  const technicalOnly = TECHNICAL_PATHS.some((path) => pathname.startsWith(path));

  return (
    <QueryDraftProvider>
      <AppShell user={user} role={role}>
        {technicalOnly && role !== 'tecnico' ? (
          <div className="space-y-6">
            <PageHeader title="Acceso restringido" />
            <Notice tone="warn">Esta sección es solo para usuarios con rol técnico.</Notice>
          </div>
        ) : (
          children
        )}
      </AppShell>
    </QueryDraftProvider>
  );
}
