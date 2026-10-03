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
4. Si se trabaja en la evaluación con Gemini: `nlqp/docs/PREPARACION_EVALUACION_GEMINI.md`;
   si se toca la ejecución de consultas: `nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md`.

## Estructura

```
Bases de datos/     banco de pruebas Docker (NO es código de NLQP, ver su propio README.md)
nlqp/backend/        backend real (Node 22, TS, ESM, Cloud Functions 2nd gen)
nlqp/frontend/        frontend Next.js (v1: login + flujo principal, resultados paginados)
nlqp/docs/            consultas de prueba, resultados, manual de Postman, SEGURIDAD.md,
                      USO_Y_COSTOS.md, RENDIMIENTO_E_INTEGRIDAD.md, PREPARACION_EVALUACION_GEMINI.md
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

## Estado (última actualización: 2026-10-02)

Completado y validado end-to-end contra los 4 motores reales:
- **Módulo 1 — ConnectionManager**: pools pg/mysql2/mssql, `testConnection` OK en los 4.
- **Módulo 2 — SchemaExtractor**: introspección normalizada, 8 tablas + 8 FKs en los 4 motores.
- **Módulo 3 — SchemaPruning**: incluye sinónimos ES→EN (las consultas NL son en español, el esquema en inglés).
- **Módulo 4 — VertexAIService/generateSQL**: proyecto GCP+Firebase unificado `proyectog-340d3` creado, Vertex AI habilitada, `GCP_PROJECT_ID`/`FIREBASE_PROJECT_ID` configurados en `nlqp/backend/.env`. Probado en vivo: pregunta en español → Gemini genera SQL correcto → Query Safety Engine lo aprueba → se ejecuta contra Postgres real. Ya no es un bloqueo.
- **Módulo 5 — Query Safety Engine**: 17/17 en batería de seguridad, 100% bloqueo. Revisado por seguridad (ver `nlqp/docs/SEGURIDAD.md`) y corregido un bypass real en SQL Server.
- **Módulo 6 — executeQuery**: probado end-to-end en los 4 motores.
- **50 consultas de prueba** (`nlqp/docs/consultas_prueba_50.json`): 200/200 ejecuciones OK, 50/50 consistentes entre motores. **Nota:** esa corrida usó el SQL de referencia, no generación real vía Vertex AI — repetirla generando con Gemini es el siguiente hito de métricas pendiente. El 02/10 se corrigieron 5 referencias (M03, M07, M12, M13, C11) que eran inconsistentes respecto de los pedidos cancelados, así que el 200/200 corresponde a las referencias anteriores. `run_consultas_prueba.mjs` ya no funciona tal cual (no manda token de Firebase y espera la respuesta vieja de `/executeQuery`); lo reemplazará el runner nuevo.
- **Firebase Authentication + Firestore**: proyecto `proyectog-340d3`, Authentication (proveedor email/contraseña) y Firestore (`(default)`) habilitados. Al haber `FIREBASE_PROJECT_ID` configurado, el bypass de auth de `auth.middleware.ts` ya no aplica — todas las pruebas (Postman/curl) requieren un ID token real. Usar `npm run test:token` (`nlqp/backend/scripts/get_test_token.mjs`) para conseguir uno de un usuario de prueba (expira a la hora).
- **Repo en GitHub**: `https://github.com/08DOMS97/nl-query-platform`, branch `main`, primer commit hecho y pusheado.
- **Módulo de uso y costos** (nuevo, ver `nlqp/docs/USO_Y_COSTOS.md`): registra en Firestore (`usageEvents`) cada llamada a `/generateSQL` y `/executeQuery` — tokens, costo estimado, motor, éxito/error, latencia. Endpoint `GET /getUsageStats`. Verificado en vivo (incluida una llamada real a Vertex AI: `$0.00063375`). Backend únicamente; el dashboard en tiempo real depende del Módulo 8 (frontend).
- **Módulo 8 — Frontend Next.js (v1)**: arrancado en `nlqp/frontend/` (App Router + TypeScript + Tailwind + SDK de Firebase). Cubre login/registro (email+contraseña) y la pantalla principal del flujo: elegir motor → preguntar en lenguaje natural → ver SQL generado y resultado del Query Safety Engine → ejecutar → ver resultados. Verificado con navegador real (Playwright): redirección a `/login` sin sesión, login contra Firebase Auth real, pantalla principal renderiza sin errores de consola. El 02/10 se verificó en navegador "Ejecutar" + paginación + descarga CSV contra el backend real, interceptando `/generateSQL` para no llamar a Vertex AI; el click de "Generar SQL" con Gemini real en la UI todavía no se probó (el endpoint sí, por curl). Pendiente: historial y dashboard de uso/costos (el deploy ya no hace falta, ver Despliegue).
- **Rendimiento e integridad de resultados** (02/10, ver `nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md`): timeout de 60 s aplicado dentro del motor en los 4 (`NLQP_QUERY_TIMEOUT_MS`); `/executeQuery` ejecuta UNA vez, guarda el resultado completo como snapshot y devuelve la página 1 con el total; `/getResultPage` y descarga CSV completa (`/createResultExport` → `/exportResultCsv`). Verificado en los 4 motores y en navegador.
- **Preparación de la corrida con Gemini** (02/10, en curso, ver `nlqp/docs/PREPARACION_EVALUACION_GEMINI.md` §8): valores de los `CHECK` y reglas de dominio ya en el prompt; `/generateSQL` devuelve `metrics`. Falta: índices + reglas de rendimiento en el prompt, banco de volumen alto en los 4 motores, auditoría de eficiencia de las referencias, paráfrasis, runner nuevo, piloto y corrida.

Bloqueado o pendiente, pero ya sin depender de cuentas de nube:
- **Módulo 7 — Historial/Firestore**: infraestructura lista (Firestore habilitado), código no empezado.
- Vertex AI **no tiene crédito de prueba disponible** en esta cuenta de Google — cualquier llamada real se factura (hasta ~$0.011 por llamada contando el razonamiento de Gemini 2.5 Pro, ver `PREPARACION_EVALUACION_GEMINI.md` §6). Avisar antes de disparar llamadas que generen SQL con Gemini.
- Confirmar si `../db/` (fuera de este repo, no existe en disco por ahora) es relevante.
- **Despliegue:** la tesis se presenta **en local** (decisión 01/10/2026), no hace
  falta desplegar. Si más adelante se necesita acceso remoto a las bases de Docker,
  la solución ya está analizada en `nlqp/docs/ACCESO_REMOTO.md` (túnel HTTPS al
  backend local; nunca exponer las bases directamente).
- Coordinar los 35 participantes de la encuesta (ver `nlqp/docs/PLAN_DE_TRABAJO.md` §6) — no depende de código, conviene arrancarlo en paralelo.

## Reglas que no hay que romper

- **Nunca** ejecutar SQL contra las bases de datos sin pasar por
  `querySafety.service.ts` primero (ni siquiera "solo para probar" — la cuenta
  `testuser` tiene permisos amplios a propósito, ver instrucciones §2).
- Cualquier cambio a `querySafety.service.ts` requiere volver a correr la batería de
  17 casos de seguridad Y las 50 consultas de prueba en los 4 motores antes de darlo
  por bueno — SQL Server tiene reglas de sintaxis distintas a los otros 3 (no exige
  `;` entre sentencias) y ya causó un bypass real, ver `nlqp/docs/SEGURIDAD.md` §1.
- **Nunca truncar resultados en silencio** ni pedirle al modelo `LIMIT`/`TOP` que el
  usuario no pidió: un resultado incompleto que parece completo es peor que un error.
  Los límites son todo o nada (timeout → 504, resultado > 1 GB → 413); los resultados
  grandes se entregan por páginas y CSV completo. Ver `nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md`.
- Las consultas generadas deben ser correctas **y eficientes** para un entorno con
  muchos datos (requisito de David del 02/10/2026).
- No commitear `.env` (ya está en `.gitignore`).
- No levantar `../db/docker-compose.yml` a la vez que `Bases de datos/docker-compose.yml` (mismos puertos).
