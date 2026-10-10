# Frontend NLQP (Next.js)

Interfaz web de NLQP. Estado y próximo paso del proyecto: `CLAUDE.md` en la raíz.

## Qué hace (v1)

- Registro e inicio de sesión con Firebase Authentication (`src/app/login`, `src/app/signup`,
  `src/hooks/useAuth.tsx`).
- Pantalla principal (`src/app/page.tsx`): elegir motor → escribir la pregunta →
  "Generar SQL" (Gemini, **cuesta ~$0.012 por intento**) → revisar el SQL generado →
  "Ejecutar" → resultados paginados (`QueryResult.tsx`) y descarga del CSV completo.
- Todas las llamadas al backend van con el ID token de Firebase (`src/lib/api.ts`).

Falta: historial (M5), herramientas técnicas (M4) y dashboard de uso y costos.

## Levantarlo

Requiere el banco de pruebas (Docker) y el backend corriendo (`npm run dev` en
`nlqp/backend`, puerto 8080).

```powershell
cd nlqp/frontend
copy .env.local.example .env.local   # solo la primera vez; completar con el firebaseConfig
npm install                          # solo la primera vez
npm run dev                          # http://localhost:3000
```

`.env.local` tiene el `firebaseConfig` del proyecto `proyectog-340d3` (Firebase Console →
Configuración del proyecto → Tus apps → app web) y `NEXT_PUBLIC_BACKEND_URL`. No se
commitea.

## Nota para Claude Code

Esta versión de Next.js tiene cambios respecto de lo conocido: leer `AGENTS.md` (lo
genera `next dev`) antes de escribir código acá.
