# NLQP — NL-Query-Platform

Tesis de David Monterroso (UMG): plataforma que convierte lenguaje natural a SQL
usando Vertex AI Gemini Pro, sobre Cloud Functions 2nd gen + Firestore + Firebase
Auth. Soporta 4 motores (PostgreSQL, MySQL, MariaDB, SQL Server). Solo permite
`SELECT` — el Query Safety Engine es la garantía central del sistema (RF-07).

**Leer primero, en este orden:**
1. `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` (raíz) — contexto original, credenciales
   del banco de pruebas, orden de construcción de los 8 módulos.
2. `nlqp/docs/SEGURIDAD.md` — hallazgos de seguridad ya corregidos, no repetirlos.
3. Este archivo, para el estado actual, el próximo paso y cómo levantar todo.
   Historial fechado: `nlqp/docs/BITACORA.md`.
4. Si se trabaja en la evaluación con Gemini: `nlqp/docs/PREPARACION_EVALUACION_GEMINI.md`;
   si se toca la ejecución de consultas: `nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md`.

## Estructura

```
Bases de datos/     banco de pruebas Docker (NO es código de NLQP, ver su propio README.md)
nlqp/backend/        backend real (Node 22, TS, ESM, Cloud Functions 2nd gen)
nlqp/frontend/        frontend Next.js (v1: login + flujo principal, resultados paginados)
nlqp/docs/            BITACORA.md (historial fechado), consultas de prueba, resultados, manual de Postman, SEGURIDAD.md,
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

## Al iniciar una sesión

Si David saluda o pregunta "cómo vamos" / "qué sigue", responder **muy resumido**
(5–8 líneas): días que faltan para la próxima fecha del calendario, qué está hecho
en una línea, y **el próximo paso** de la sección de abajo. Sin re-revisar el repo
salvo que lo pida — este archivo es la fuente. Si algo de acá contradice al código,
decirlo.

**Al cerrar cada sesión de trabajo:** agregar una entrada fechada en
`nlqp/docs/BITACORA.md`, actualizar "Estado" y "Próximo paso" de este archivo
(con la fecha) y el doc del tema que se tocó.

## Calendario (fechas duras)

| Fecha | Qué |
|---|---|
| 12–13/10/2026 | Integración de módulos y pruebas (plan) |
| **14/10/2026** | **Presentación del prototipo funcional** |
| 15–16/10/2026 | Conclusiones y revisión final del documento |
| **17/10/2026** | **Entrega PG2** |
| ~20/10/2026 | Retiro más temprano de `gemini-2.5-pro` en Vertex AI (provisorio, verificado 08/10) |

Plan con fechas: `Claude outputs/Plan_de_Trabajo_PG2 02-10-2026.xlsx`.

## Próximo paso (actualizado 2026-10-08)

Orden acordado; marcar con ~~tachado~~ y fecha al terminar cada uno:

1. **Endurecer el Query Safety Engine** (gratis): bloquear funciones de archivo
   (`SEGURIDAD.md` §10), decidir qué hacer con literales (§9), guardar la batería de
   seguridad en el repo como script, regresión completa (batería + 50 × 4) y
   ajustar el texto de 6.3.3.
2. **Corrida con Gemini** (crítico, antes del 14/10): migrar a `@google/genai`,
   corregir S10/M13 (rango de fechas en vez de `EXTRACT`), runner nuevo, piloto y
   corrida completa (~$2–3, **pedir confirmación antes**). Ver
   `PREPARACION_EVALUACION_GEMINI.md` §8.
3. **Módulo 5 — historial, versión mínima** (atrasado según el plan).
4. Si no da el tiempo: Módulo 4 (herramientas técnicas, atrasado desde 07/10),
   banco de volumen alto y paráfrasis → alcance reducido / trabajo futuro.

## Estado (actualizado 2026-10-08)

Historial fechado completo en `nlqp/docs/BITACORA.md`.

**Hecho y verificado:**
- Módulos 1–3, 5 y 6 del backend (conexiones, esquema, poda con sinónimos ES→EN,
  Gemini vía Vertex AI en `proyectog-340d3`, Query Safety Engine, ejecución) en los
  4 motores.
- 50 consultas de referencia (con las 5 corregidas el 02/10): **200/200, 0
  inconsistencias** (re-verificado 08/10). Es SQL de referencia, **no** generado
  por Gemini. `run_consultas_prueba.mjs` ya no sirve (no manda token ni entiende la
  respuesta paginada); el runner nuevo es parte del paso 2.
- Firebase Auth + Firestore: todas las llamadas exigen ID token real
  (`npm run test:token`, expira a la hora).
- Uso y costos (`USO_Y_COSTOS.md`): backend, `GET /getUsageStats`. Sin dashboard.
- Frontend v1 (Módulo 8): login, flujo motor → pregunta → SQL → ejecutar →
  resultados paginados + CSV. Falta probar "Generar SQL" con Gemini real desde la UI.
- Rendimiento e integridad (`RENDIMIENTO_E_INTEGRIDAD.md`): timeout 60 s en el
  motor, snapshot, paginación, CSV completo.
- Prompt preparado para la corrida (CHECKs, reglas de dominio, índices, reglas de
  rendimiento); `/generateSQL` devuelve `metrics`.

**Abierto:**
- Query Safety Engine: hallazgos §9 y §10 de `SEGURIDAD.md` (08/10). La batería de
  17 casos no está en el repo.
- Texto de tesis: 6.3.3 de `CAPITULO_6_Y_PLAN.md` afirma cosas que no son ciertas
  (ver avisos dentro del archivo); Cap. 5 cita 42 tablas / 71 % (el banco tiene 8);
  correcciones de figuras del Cap. 5 en 0 %; cambios pendientes en Cap. 1–4.
- Módulo 4 (herramientas técnicas) y Módulo 5 (historial): sin empezar.
- Dashboard de uso/costos en el frontend: sin empezar.
- Riesgos: SDK `@google-cloud/vertexai` deprecado (sigue funcionando); retiro de
  `gemini-2.5-pro` (~20/10); Vertex AI **sin crédito de prueba** — cada llamada se
  factura (hasta ~$0.011), avisar antes.
- Coordinar los 35 participantes de la encuesta (no depende de código).
- Despliegue: no hace falta, se presenta **en local** (decisión 01/10). Acceso
  remoto analizado en `ACCESO_REMOTO.md`, no implementado.
- Confirmar si `../db/` (fuera del repo, no existe en disco) es relevante.

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
