# NLQP — NL-Query-Platform

Tesis de David Monterroso (UMG, PG2): plataforma que convierte preguntas en español a
SQL con **Gemini 3.8 Flash (Vertex AI)** sobre **4 motores** (PostgreSQL, MySQL, MariaDB,
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
| 15–30/10/2026 | Conclusiones y revisión final del documento |
| **31/10/2026** | **Entrega PG2** (la universidad la corrió del 17/10; en el plan se movieron solo las tareas 37 y 38) |
| 20/10/2026 | Retiro de `gemini-2.5-pro`: ya no afecta, se cambió a `gemini-3.8-flash` el 18/10 (vigente hasta el 02/09/2027 o más) |

## Estado por área (actualizado 2026-10-18, cambio a Gemini 3.8 Flash)

| Área | Estado |
|---|---|
| Backend M1–M3 | ✅ Completo y verificado en los 4 motores. Modelo (18/10): `gemini-3.8-flash` en `global`, razonamiento `LOW` (S10 real: correcto, $0.0012, 2,9 s). M1 (13/10): registro de conexiones en Firestore + contraseñas en Secret Manager (4 iniciales, `npm run seed:connections`), alta/edición/baja del técnico desde la pantalla Conexiones. API 38/38, UI 27/27. `engine` sigue como alias de `connectionId` |
| Query Safety Engine | ✅ Endurecido 08/10; `npm run test:seguridad` → 57/57 + 200/200 |
| Referencias (50 consultas) | ✅ Contenido idéntico en los 4 motores (10/10). SQL escrito a mano, **no** de Gemini |
| Evaluación con Gemini | 🟡 Runner listo y probado gratis (400/400), paráfrasis aprobadas, ajustado a 3.8 Flash (18/10). **Falta: piloto y corrida completa** |
| Frontend | ✅ Rediseñado 10/10: pantallas por módulo, menú según el rol, blanco + naranja claro, IBM Plex. Consultar y Esquema eligen entre las conexiones registradas (13/10). `npm run test:ui` 23/23 + 27/27. Falta probar "Generar SQL" con Gemini real desde la UI |
| M4 herramientas técnicas | ✅ 10/10: rol técnico (custom claim, 403 en el backend) con SQL editable, conexiones + pool, esquema y uso y costos. API 23/23. 13/10: edita la generada y las guardadas (no las del historial: se guardan antes), «Guardar cambios» y auditoría de cambios (pestaña Cambios). API 25/25, UI 23/23. Falta pasarlo al Word |
| M5 historial | ✅ Versión mínima 10/10: historial automático + consultas guardadas (manual), reusar sin Gemini. API 32/32, UI 10/10. Falta captura (Figura 11) y pasar 6.6 al Word |
| Texto de tesis | 🟡 20 pendientes + 1 por verificar + 63 aplicados (18/10: +3 por el cambio de modelo, incl. reemplazar "Gemini 2.5 Pro" en caps. 1–5). Word del 17/10 (`PG2-2026 capítulo 6 revisado 17-10-2026.docx`): Cap. 6 completo con M1, M4, M5 e integración = 6.7. Faltan: evaluación con Gemini (6.3.6), capturas de las Figuras 9–11, presentación (6.8), conclusiones → `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md` |
| Gasto en Gemini | ≈ **$0.023** (4 llamadas sueltas). Con 3.8 Flash ~$0.001–0.004 por llamada (con 2.5 Pro era ~$0.012), sin crédito de prueba |
| Encuesta (35 participantes) | ❌ Sin coordinar (no depende de código) |
| **Plan vs. real** (corte 18/10) | Plan 92 % · real 93 % · **+0,9 puntos** (entrega movida al 31/10; pruebas de generación siguen en 70 %). Detalle: `nlqp/docs/PLAN_DE_TRABAJO.md` |

## Próximo paso (actualizado 2026-10-18)

David decidió (10/10): **lo que cuesta dinero va al final**, pero con fecha límite.

1. **Limpiar el historial de prueba** ← **SIGUIENTE** (pedido de David, 13/10; sin
   costo): el historial de los usuarios de prueba está lleno de consultas de las pruebas
   automáticas (`SELECT 40 + 2 AS ui166705`, `SELECT 1 AS x`, etc.), que se ven en la
   pantalla y no se entienden. Proponer en 3–5 líneas cómo resolverlo (p. ej., usuarios
   exclusivos para las pruebas o que las pruebas borren lo que dejan en el historial) y,
   con el "dale", limpiar también lo que ya quedó.
2. **Piloto con paráfrasis** (Gemini 3.8 Flash): propuesto **a más tardar el 21/10**.
   40 llamadas, ~$0.10–0.16, tope automático $0.25. **Pedir confirmación a David antes.** Requiere Docker y el
   backend con `npm run build` + **`npm start`** (no `dev`: `node --watch` se
   reinicia solo en Windows y puede cortar una llamada ya cobrada). Comando:
   `PREPARACION_EVALUACION_GEMINI.md` §8 punto 7.
3. **Corrida completa con paráfrasis**: propuesto **a más tardar el 22/10** (~$0.80–1.60
   en total, tope $2.50; lo del piloto no se repite). **Confirmación aparte.** Después:
   revisar a mano "Para revisión manual" de `nlqp/docs/evaluacion_gemini/resumen.md` y
   cargar las cifras en la tesis (6.3.6, 1.6.3 y conclusiones) con margen antes del 30/10.
4. Después del piloto: retomar las capturas de las figuras 9–11 con preguntas reales
   (las de `Claude outputs/capturas 10-10-2026/` tienen datos de prueba, y las de las
   figuras 9 y 10 ya no muestran la interfaz actual: selector de conexiones y
   formulario de Conexiones, 13/10).

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

**Al cerrar** (o al terminar un bloque de trabajo, antes del commit), siempre estos pasos:
1. `nlqp/docs/BITACORA.md`: entrada con la fecha (qué se hizo, qué se verificó con
   qué número, qué decidió David, qué sigue).
2. Este archivo: tabla "Estado por área", "Próximo paso" y "Abierto", con la fecha.
3. El doc del tema que se tocó (ver mapa).
4. `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md`: si algo cambia lo que la tesis afirma,
   mide o describe, agregar la entrada en su capítulo y sección, con la fecha, y
   actualizar el contador.
5. Plan de trabajo: si avanzó alguna tarea del plan (o se implementó algo nuevo),
   actualizar `real` y `comentario` en `nlqp/docs/plan/plan.json` (lo nuevo, como
   tarea nueva con `"nueva"`) y generar el corte del día:
   `python nlqp/docs/plan/generar_corte.py AAAA-MM-DD`. **Nunca cambiar las fechas
   del plan base**: la comparación contra ellas es lo que muestra el atraso.

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
| Avance contra el plan, cortes por fecha, riesgos | `nlqp/docs/PLAN_DE_TRABAJO.md` (+ `nlqp/docs/plan/`) |
| Saber qué pasó y cuándo | `nlqp/docs/BITACORA.md` |
| Probar la API a mano | `nlqp/docs/MANUAL_POSTMAN.md` |
| Credenciales y datos del banco de pruebas | `Bases de datos/README.md` |
| Acceso remoto (no implementado) | `nlqp/docs/ACCESO_REMOTO.md` |

Históricos (no citar como vigentes): `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` (arranque
del 17/09) y `nlqp/docs/historico/`. Plan con fechas en Excel:
`Claude outputs/Plan_de_Trabajo_PG2 DD-MM-AAAA.xlsx`, uno por corte (la carpeta no se
commitea, a pedido de David; los datos de cada corte sí, en `nlqp/docs/plan/cortes/`).

## Levantar todo

```powershell
cd "Bases de datos"; docker compose up -d; cd ..   # 4 motores
cd nlqp/backend; npm run dev                          # http://localhost:8080
cd nlqp/frontend; npm run dev                         # http://localhost:3000
```

Docker Desktop en esta máquina: `C:\Users\david\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
Token de prueba (dura 1 h): `npm run test:token` en `nlqp/backend`.
Pruebas sin costo (con todo levantado): `npm run test:seguridad` y `npm run test:api` en
`nlqp/backend`; `npm run test:ui` en `nlqp/frontend` (la primera vez, `npm install
--no-save playwright-core@1.64.0`). Leen las contraseñas de los usuarios de prueba de
`nlqp/backend/.env` (`NLQP_TEST_USER_PASSWORD`, `NLQP_USUARIO_PASSWORD`).
Roles: `npm run set:role -- <correo> <tecnico|no_tecnico>`. Usuarios de prueba:
`nlqp-test@example.com` (técnico) y `nlqp-usuario@example.com` (no técnico); las
contraseñas, en `scripts/get_test_token.mjs` y en la bitácora del 10/10.

## Abierto (no es el próximo paso; no hacerlo sin que David lo pida)

- Las contraseñas de los usuarios de prueba de Firebase están escritas en archivos ya
  commiteados (`get_test_token.mjs`, `evaluacion_gemini.mjs`, bitácora del 10/10). Son
  cuentas de prueba, pero si el repo es público convendría cambiarlas y leerlas solo
  del `.env`, como las pruebas nuevas (detectado 13/10).

- Probar "Generar SQL" con Gemini real desde la UI (cuesta ~$0.001–0.004 por intento con 3.8 Flash).
- Banco de volumen alto para medir eficiencia con `EXPLAIN`.
- Confirmar si `../db/` (fuera del repo, no existe en disco) es relevante.
- Hallazgos de seguridad 4–6 (`SEGURIDAD.md`): documentados, no corregidos a propósito.
- Firmar en el backend el SQL generado para que un no técnico no pueda mandar SQL
  propio a `/executeQuery` (`SEGURIDAD.md` §12; hoy es riesgo aceptado).

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
