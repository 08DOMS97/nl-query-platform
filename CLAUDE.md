# NLQP — NL-Query-Platform

Tesis de David Monterroso (UMG): plataforma que convierte lenguaje natural a SQL
usando Vertex AI Gemini Pro, sobre Cloud Functions 2nd gen + Firestore + Firebase
Auth. Soporta 4 motores (PostgreSQL, MySQL, MariaDB, SQL Server). Solo permite
`SELECT` — el Query Safety Engine es la garantía central del sistema (RF-07).

**Leer primero, en este orden:**
1. `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` (raíz) — contexto original, credenciales
   del banco de pruebas, orden de construcción de los 8 módulos.
2. `nlqp/docs/SEGURIDAD.md` — hallazgos de seguridad ya corregidos, no repetirlos.
3. Este archivo, para el estado actual y cómo levantar todo.

## Estructura

```
Bases de datos/     banco de pruebas Docker (NO es código de NLQP, ver su propio README.md)
nlqp/backend/        backend real (Node 22, TS, ESM, Cloud Functions 2nd gen)
nlqp/frontend/        aún no existe (pendiente de proyecto Firebase)
nlqp/docs/            consultas de prueba, resultados, manual de Postman, SEGURIDAD.md
```

## Levantar todo

```powershell
# 1. Banco de pruebas (4 motores en Docker)
cd "Bases de datos"
docker compose up -d
cd ..

# 2. Backend
cd nlqp/backend
npm run dev   # http://localhost:8080
```

Si Docker Desktop no responde: en esta máquina está instalado en
`C:\Users\david\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` (no en
`Program Files`).

## Estado (última actualización: 2026-09-21)

Completado y validado end-to-end contra los 4 motores reales:
- **Módulo 1 — ConnectionManager**: pools pg/mysql2/mssql, `testConnection` OK en los 4.
- **Módulo 2 — SchemaExtractor**: introspección normalizada, 8 tablas + 8 FKs en los 4 motores.
- **Módulo 3 — SchemaPruning**: incluye sinónimos ES→EN (las consultas NL son en español, el esquema en inglés).
- **Módulo 4 — VertexAIService/generateSQL**: proyecto GCP+Firebase unificado `proyectog-340d3` creado, Vertex AI habilitada, `GCP_PROJECT_ID`/`FIREBASE_PROJECT_ID` configurados en `nlqp/backend/.env`. Probado en vivo: pregunta en español → Gemini genera SQL correcto → Query Safety Engine lo aprueba → se ejecuta contra Postgres real. Ya no es un bloqueo.
- **Módulo 5 — Query Safety Engine**: 17/17 en batería de seguridad, 100% bloqueo. Revisado por seguridad (ver `nlqp/docs/SEGURIDAD.md`) y corregido un bypass real en SQL Server.
- **Módulo 6 — executeQuery**: probado end-to-end en los 4 motores.
- **50 consultas de prueba** (`nlqp/docs/consultas_prueba_50.json`): 200/200 ejecuciones OK, 50/50 consistentes entre motores. Re-ejecutar con `node nlqp/docs/run_consultas_prueba.mjs` (requiere Docker + backend arriba). **Nota:** esa corrida usó el SQL de referencia, no generación real vía Vertex AI — repetirla generando con Gemini es el siguiente hito de métricas pendiente.
- **Firebase Authentication + Firestore**: proyecto `proyectog-340d3`, Authentication (proveedor email/contraseña) y Firestore (`(default)`) habilitados. Al haber `FIREBASE_PROJECT_ID` configurado, el bypass de auth de `auth.middleware.ts` ya no aplica — todas las pruebas (Postman/curl) requieren un ID token real. Usar `npm run test:token` (`nlqp/backend/scripts/get_test_token.mjs`) para conseguir uno de un usuario de prueba (expira a la hora).
- **Repo en GitHub**: `https://github.com/08DOMS97/nl-query-platform`, branch `main`, primer commit hecho y pusheado.
- **Módulo de uso y costos** (nuevo, ver `nlqp/docs/USO_Y_COSTOS.md`): registra en Firestore (`usageEvents`) cada llamada a `/generateSQL` y `/executeQuery` — tokens, costo estimado, motor, éxito/error, latencia. Endpoint `GET /getUsageStats`. Verificado en vivo (incluida una llamada real a Vertex AI: `$0.00063375`). Backend únicamente; el dashboard en tiempo real depende del Módulo 8 (frontend).

Bloqueado o pendiente, pero ya sin depender de cuentas de nube:
- **Módulo 7 — Historial/Firestore**: infraestructura lista (Firestore habilitado), código no empezado.
- **Módulo 8 — Frontend Next.js**: infraestructura lista (Firebase Auth habilitado), código no empezado.
- Vertex AI **no tiene crédito de prueba disponible** en esta cuenta de Google — cualquier llamada real se factura (mínima, fracciones de centavo por consulta con el esquema podado, pero real). Avisar antes de disparar llamadas que generen SQL con Gemini.
- Confirmar si `../db/` (fuera de este repo, no existe en disco por ahora) es relevante.
- Coordinar los 35 participantes de la encuesta (ver `nlqp/docs/PLAN_DE_TRABAJO.md` §6) — no depende de código, conviene arrancarlo en paralelo.

## Reglas que no hay que romper

- **Nunca** ejecutar SQL contra las bases de datos sin pasar por
  `querySafety.service.ts` primero (ni siquiera "solo para probar" — la cuenta
  `testuser` tiene permisos amplios a propósito, ver instrucciones §2).
- Cualquier cambio a `querySafety.service.ts` requiere volver a correr la batería de
  17 casos de seguridad Y las 50 consultas de prueba en los 4 motores antes de darlo
  por bueno — SQL Server tiene reglas de sintaxis distintas a los otros 3 (no exige
  `;` entre sentencias) y ya causó un bypass real, ver `nlqp/docs/SEGURIDAD.md` §1.
- No commitear `.env` (ya está en `.gitignore`).
- No levantar `../db/docker-compose.yml` a la vez que `Bases de datos/docker-compose.yml` (mismos puertos).
