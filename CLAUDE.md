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

## Estado por área (actualizado 2026-10-13, con el registro de conexiones de M1)

| Área | Estado |
|---|---|
| Backend M1–M3 | ✅ Completo y verificado en los 4 motores. M1 (13/10): registro de conexiones en Firestore + contraseñas en Secret Manager (4 iniciales, `npm run seed:connections`), alta/edición/baja del técnico por API, 33/33. `engine` sigue como alias de `connectionId`. Falta el formulario en la UI |
| Query Safety Engine | ✅ Endurecido 08/10; `npm run test:seguridad` → 57/57 + 200/200 |
| Referencias (50 consultas) | ✅ Contenido idéntico en los 4 motores (10/10). SQL escrito a mano, **no** de Gemini |
| Evaluación con Gemini | 🟡 Runner listo y probado gratis (400/400), paráfrasis aprobadas. **Falta: piloto y corrida completa** |
| Frontend | ✅ Rediseñado 10/10: pantallas por módulo, menú según el rol, blanco + naranja claro, IBM Plex. UI 13/13 (13/10). Falta probar "Generar SQL" con Gemini real desde la UI |
| M4 herramientas técnicas | ✅ 10/10: rol técnico (custom claim, 403 en el backend) con SQL editable, conexiones + pool, esquema y uso y costos. API 23/23. Falta pasarlo al Word |
| M5 historial | ✅ Versión mínima 10/10: historial automático + consultas guardadas (manual), reusar sin Gemini. API 32/32, UI 10/10. Falta captura (Figura 10) y pasar 6.6 al Word |
| Texto de tesis | 🟡 23 pendientes + 1 por verificar + 54 aplicados (13/10: 6.1 actualizada por el registro de conexiones. M4 y M5: 6.4 reescrita, 6.5 y 6.6 nuevas, integración → 6.7; capturas en `Claude outputs/capturas 10-10-2026/`). Word revisado entregado el 10/10 (segunda versión: sin marcadores, referencias enlazadas, 6.3.2 y 6.3.4 al día; integración = 6.5) → `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md` |
| Gasto en Gemini | ≈ **$0.022** (3 llamadas sueltas). Cada llamada ~$0.012, sin crédito de prueba |
| Encuesta (35 participantes) | ❌ Sin coordinar (no depende de código) |
| **Plan vs. real** (corte 13/10) | Plan 97 % · real 95 % · **−2,1 puntos: atrasados** (pruebas de generación 70 %). Detalle: `nlqp/docs/PLAN_DE_TRABAJO.md` |

## Próximo paso (actualizado 2026-10-13)

David decidió (10/10): **lo que cuesta dinero va al final**, pero con fecha límite.

1. **Piloto con paráfrasis** ← **SIGUIENTE**: **a más tardar el 14/10**. 40 llamadas, ~$0.50, tope
   automático $0.60. **Pedir confirmación a David antes.** Requiere Docker y el
   backend con `npm run build` + **`npm start`** (no `dev`: `node --watch` se
   reinicia solo en Windows y puede cortar una llamada ya cobrada). Comando:
   `PREPARACION_EVALUACION_GEMINI.md` §8 punto 7.
2. **Corrida completa con paráfrasis**: **a más tardar el 15/10** (~$4.25 más; lo
   del piloto no se repite). **Confirmación aparte.** Después: revisar a mano "Para
   revisión manual" de `nlqp/docs/evaluacion_gemini/resumen.md` y cargar las cifras
   en el resumen para la tesis (6.3.5) el 16/10.
3. Después del piloto: retomar las capturas de las figuras 9–11 con preguntas reales
   (las de `Claude outputs/capturas 10-10-2026/` tienen datos de prueba).

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
Roles: `npm run set:role -- <correo> <tecnico|no_tecnico>`. Usuarios de prueba:
`nlqp-test@example.com` (técnico) y `nlqp-usuario@example.com` (no técnico); las
contraseñas, en `scripts/get_test_token.mjs` y en la bitácora del 10/10.

## Abierto (no es el próximo paso; no hacerlo sin que David lo pida)

- Formulario de la pantalla Conexiones para crear, editar y eliminar conexiones (el
  backend ya lo tiene, 13/10; hoy se cargan con `npm run seed:connections`).
- 6.1 "Verificación" dice que se usaron "cuentas con permisos exclusivamente de
  lectura", pero `testuser` tiene permisos amplios a propósito: corregir el texto o
  crear una cuenta de solo lectura (detectado 13/10).
- Versionar las pruebas de API e interfaz (hoy solo en el scratchpad de cada sesión).
- Probar "Generar SQL" con Gemini real desde la UI (cuesta ~$0.012 por intento).
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
