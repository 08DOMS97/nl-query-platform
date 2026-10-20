'use client';

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
      footer="¿No tiene cuenta? Pídala al administrador del sistema."
    />
  );
}
