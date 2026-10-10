'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Iniciar sesión"
      description="Ingrese con su cuenta para consultar las bases de datos."
      submitLabel="Ingresar"
      submittingLabel="Ingresando…"
      onSubmit={async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/');
      }}
      footer={
        <>
          ¿No tiene cuenta?{' '}
          <Link href="/signup" className="text-accent-700 underline underline-offset-2">
            Crear una cuenta
          </Link>
        </>
      }
    />
  );
}
