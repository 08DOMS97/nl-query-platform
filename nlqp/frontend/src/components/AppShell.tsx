'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, type User } from 'firebase/auth';
import type { ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import type { UserRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
}

const NAV_CONSULTAS: NavItem[] = [
  { href: '/', label: 'Consultar' },
  { href: '/historial', label: 'Historial' },
];

/** Módulo 4: solo el rol técnico ve (y el backend solo le permite) estas pantallas. */
const NAV_TECNICO: NavItem[] = [
  { href: '/conexiones', label: 'Conexiones' },
  { href: '/esquema', label: 'Esquema' },
  { href: '/uso', label: 'Uso y costos' },
];

export const TECHNICAL_PATHS = NAV_TECNICO.map((item) => item.href);

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <p className="px-3 pb-1.5 text-[11.5px] font-medium text-ink-3">{title}</p>
      <ul className="space-y-px">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-8 items-center rounded-sm px-3 text-[13px] transition-colors ${
                  active
                    ? 'bg-accent-50 font-medium text-accent-800 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-500'
                    : 'text-ink-2 hover:bg-sunken hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppShell({ user, role, children }: { user: User; role: UserRole; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 pb-6 pt-5">
          <p className="font-mono text-[15px] font-medium tracking-tight">NLQP</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-3">Consultas en lenguaje natural</p>
        </div>

        <nav className="flex-1 space-y-6 px-2">
          <NavGroup title="Consultas" items={NAV_CONSULTAS} pathname={pathname} />
          {role === 'tecnico' && <NavGroup title="Herramientas técnicas" items={NAV_TECNICO} pathname={pathname} />}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-[13px] text-ink" title={user.email ?? undefined}>
            {user.email}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] text-ink-3">{role === 'tecnico' ? 'Rol técnico' : 'Rol usuario'}</span>
            <button onClick={() => signOut(auth)} className="text-[12px] text-ink-2 underline-offset-2 hover:text-ink hover:underline">
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1120px] px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
