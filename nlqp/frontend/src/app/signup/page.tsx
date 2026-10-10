'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthForm } from '@/components/AuthForm';

export default function SignupPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Crear cuenta"
      description="Las cuentas nuevas tienen el rol de usuario. El rol técnico lo asigna el administrador."
      submitLabel="Crear cuenta"
      submittingLabel="Creando…"
      passwordHint="Mínimo 6 caracteres"
      onSubmit={async (email, password) => {
        await createUserWithEmailAndPassword(auth, email, password);
        router.push('/');
      }}
      footer={
        <>
          ¿Ya tiene cuenta?{' '}
          <Link href="/login" className="text-accent-700 underline underline-offset-2">
            Iniciar sesión
          </Link>
        </>
      }
    />
  );
}
