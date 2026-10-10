# NLQP — NL-Query-Platform

Tesis de David Monterroso (UMG, PG2): plataforma que convierte preguntas en español a
SQL con **Gemini 2.5 Pro (Vertex AI)** sobre **4 motores** (PostgreSQL, MySQL, MariaDB,
SQL Server). Solo permite `SELECT`: el **Query Safety Engine** es la garantía central
(RF-07). Backend Node 22 + TS (Cloud Functions 2nd gen, se presenta **en local**),
Firebase Auth + Firestore, frontend Next.js. Módulos de la tesis: M1 conexiones, M2
esquema, M3 NL→SQL + Query Safety Engine, M4 herramientas técnicas, M5 historial.

Este archivo es el **tablero**: alcanza para saber de qué va el proyecto, cómo está y
qué sigue. No hace falta leer nada más para responder "¿cómo vamos?".

## Calendario

| Fecha | Qué |
|---|---|
| 12–13/10/2026 | Integración de módulos y pruebas |
| **14/10/2026** | **Presentación del prototipo funcional** |
| 15–16/10/2026 | Conclusiones y revisión final del documento |
| **17/10/2026** | **Entrega PG2** |
| ~20/10/2026 | Retiro más temprano de `gemini-2.5-pro` (provisorio, verificado 08/10) |

## Estado por área (actualizado 2026-10-10)

| Área | Estado |
|---|---|
| Backend M1–M3 | ✅ Completo y verificado en los 4 motores |
| Query Safety Engine | ✅ Endurecido 08/10; `npm run test:seguridad` → 57/57 + 200/200 |
| Referencias (50 consultas) | ✅ Contenido idéntico en los 4 motores (10/10). SQL escrito a mano, **no** de Gemini |
| Evaluación con Gemini | 🟡 Runner listo y probado gratis (400/400), paráfrasis aprobadas. **Falta: piloto y corrida completa** |
| Frontend v1 | ✅ Login, flujo pregunta → SQL → resultados paginados + CSV. Falta probar "Generar SQL" con Gemini real desde la UI y el dashboard de costos |
| M4 herramientas técnicas | ❌ Sin empezar (atrasado desde 07/10) |
| M5 historial | ❌ Sin empezar (atrasado desde 09/10) |
| Texto de tesis | 🟡 25 pendientes + 4 por verificar → `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md` |
| Gasto en Gemini | ≈ **$0.022** (3 llamadas sueltas). Cada llamada ~$0.012, sin crédito de prueba |
| Encuesta (35 participantes) | ❌ Sin coordinar (no depende de código) |

## Próximo paso (actualizado 2026-10-10)

1. **Piloto con paráfrasis** ← **SIGUIENTE**. 40 llamadas, ~$0.50, tope automático
   $0.60. **Pedir confirmación a David antes.** Requiere Docker y el backend con
   `npm run build` + **`npm start`** (no `dev`: `node --watch` se reinicia solo en
   Windows y puede cortar una llamada ya cobrada). Comando:
   `PREPARACION_EVALUACION_GEMINI.md` §8 punto 7.
2. **Corrida completa con paráfrasis** (~$4.25 más; lo del piloto no se repite).
   **Confirmación aparte.** Después: revisar a mano "Para revisión manual" de
   `nlqp/docs/evaluacion_gemini/resumen.md` y cargar las cifras en el resumen para la
   tesis (6.3.5).
3. **M5 historial, versión mínima.**
4. Si no da el tiempo: M4 y el banco de volumen alto → alcance reducido / trabajo
   futuro (se documenta, no se improvisa).

Lo terminado **no se tacha acá**: se borra de esta lista y queda en `BITACORA.md`.

## Cómo se trabaja en cada sesión

**Al iniciar.** Si David saluda o pregunta "¿cómo vamos?" / "¿qué sigue?", responder en
5–8 líneas, sin revisar el repo:
> Faltan N días para [próxima fecha]. Hecho: [1 línea]. Siguiente: [ítem 1 de Próximo
> paso, con costo si tiene]. Tesis: N pendientes en el documento.

Si algo de este archivo contradice al código, decirlo.

**Durante.** Para no desviarse:
- Trabajar **solo en el próximo paso o en lo que David pida**. Si aparece algo más
  (un bug, una mejora, una idea), **anotarlo en "Abierto" y preguntar**; no hacerlo.
- Antes de algo grande (cambio de diseño, nueva dependencia, mover archivos, más de
  ~30 min de trabajo), **proponer en 3–5 líneas y esperar el "dale"**.
- **Todo gasto en Vertex AI se confirma antes**, con número de llamadas y costo.
- No refactorizar lo que funciona ni agregar funciones no pedidas.
- Lo que se verifica se dice con el número ("57/57", "200/200"). Si algo no se pudo
  verificar, se dice.
- David decide; Claude recomienda una opción, no presenta un menú.

**Al cerrar** (o al terminar un bloque de trabajo, antes del commit), siempre los 4:
1. `nlqp/docs/BITACORA.md`: entrada con la fecha (qué se hizo, qué se verificó con
   qué número, qué decidió David, qué sigue).
2. Este archivo: tabla "Estado por área", "Próximo paso" y "Abierto", con la fecha.
3. El doc del tema que se tocó (ver mapa).
4. `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md`: si algo cambia lo que la tesis afirma,
   mide o describe, agregar la entrada en su capítulo y sección, con la fecha, y
   actualizar el contador.

Commits: en español, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
commitear y hacer push cuando David lo pida o lo apruebe.

## Mapa de documentos

| Si vas a… | Leé |
|---|---|
| Correr o analizar la evaluación con Gemini | `nlqp/docs/PREPARACION_EVALUACION_GEMINI.md` (§8 = pasos y comandos) |
| Tocar el validador o algo de seguridad | `nlqp/docs/SEGURIDAD.md` (hallazgos ya corregidos: no repetirlos) |
| Tocar la ejecución, paginación, CSV o fechas | `nlqp/docs/RENDIMIENTO_E_INTEGRIDAD.md` |
| Tocar el registro de uso y costos | `nlqp/docs/USO_Y_COSTOS.md` |
| Trabajar el texto de la tesis | `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md` (qué hacer) + `CAPITULO_6.md` (texto) |
| Replanificar o ver riesgos | `nlqp/docs/PLAN_DE_TRABAJO.md` |
| Saber qué pasó y cuándo | `nlqp/docs/BITACORA.md` |
| Probar la API a mano | `nlqp/docs/MANUAL_POSTMAN.md` |
| Credenciales y datos del banco de pruebas | `Bases de datos/README.md` |
| Acceso remoto (no implementado) | `nlqp/docs/ACCESO_REMOTO.md` |

Históricos (no citar como vigentes): `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` (arranque
del 17/09) y `nlqp/docs/historico/`. Plan con fechas en Excel:
`Claude outputs/Plan_de_Trabajo_PG2 02-10-2026.xlsx` (sin commitear, a pedido de David).

## Levantar todo

```powershell
cd "Bases de datos"; docker compose up -d; cd ..   # 4 motores
cd nlqp/backend; npm run dev                          # http://localhost:8080
cd nlqp/frontend; npm run dev                         # http://localhost:3000
```

Docker Desktop en esta máquina: `C:\Users\david\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
Token de prueba (dura 1 h): `npm run test:token` en `nlqp/backend`.

## Abierto (no es el próximo paso; no hacerlo sin que David lo pida)

- Dashboard de uso y costos en el frontend.
- Probar "Generar SQL" con Gemini real desde la UI (cuesta ~$0.012 por intento).
- Banco de volumen alto para medir eficiencia con `EXPLAIN`.
- Confirmar si `../db/` (fuera del repo, no existe en disco) es relevante.
- Hallazgos de seguridad 4–6 (`SEGURIDAD.md`): documentados, no corregidos a propósito.

## Reglas que no hay que romper

- **Nunca** ejecutar SQL contra las bases sin pasar antes por `querySafety.service.ts`,
  ni "solo para probar": la cuenta `testuser` tiene permisos amplios a propósito.
- Cualquier cambio a `querySafety.service.ts` (o a la ejecución) requiere
  `npm run test:seguridad` en verde (Docker levantado). SQL Server no exige `;` entre
  sentencias y ya causó un bypass real (`SEGURIDAD.md` §1).
- **Nunca truncar resultados en silencio** ni pedirle al modelo `LIMIT`/`TOP` que el
  usuario no pidió. Los límites son todo o nada (timeout → 504, > 1 GB → 413).
- Las consultas generadas deben ser correctas **y eficientes** con mucho volumen
  (requisito de David, 02/10).
- No commitear `.env`. No levantar `../db/docker-compose.yml` junto con
  `Bases de datos/docker-compose.yml` (mismos puertos).
