'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { QueryForm } from '@/components/QueryForm';
import { HistoryPanel } from '@/components/HistoryPanel';
import type { ReusedQuery } from '@/lib/types';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reused, setReused] = useState<ReusedQuery | null>(null);
  const [reuseCount, setReuseCount] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-semibold">NLQP</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{user.email}</span>
          <button onClick={() => signOut(auth)} className="underline">
            Salir
          </button>
        </div>
      </div>
      <QueryForm key={reuseCount} user={user} reused={reused} onExecuted={() => setHistoryKey((k) => k + 1)} />
      <HistoryPanel
        user={user}
        refreshKey={historyKey}
        onReuse={(q) => {
          // Remonta el formulario con la consulta elegida (aunque sea la misma de antes).
          setReused({ engine: q.engine, question: q.question, sql: q.sql });
          setReuseCount((n) => n + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </main>
  );
}
