# NLQP — NL-Query-Platform

Tesis de David Monterroso (UMG, PG2): plataforma que convierte preguntas en español a
SQL con **Gemini 3.8 Flash (Vertex AI)** sobre **4 motores** (PostgreSQL, MySQL, MariaDB,
SQL Server). Solo permite `SELECT`: el **Query Safety Engine** es la garantía central
(RF-07). Backend Node 22 + TS (servidor Express; las funciones también están
registradas para Cloud Functions 2nd gen), Firebase Auth + Firestore, frontend Next.js. **Despliegue (decisión de David, 19/10):
on-premises.** Frontend y backend se instalan en un servidor de la organización, junto a
sus bases, y se accede por red local o VPN. Vertex AI, Firebase Auth, Firestore y Secret
Manager siguen en GCP (despliegue híbrido). Cloud Functions + Firebase Hosting quedan
como la arquitectura a la que el sistema **puede escalar**, no como el despliegue
actual. No se despliega en Firebase. Módulos de la tesis: M1 conexiones, M2
esquema, M3 NL→SQL + Query Safety Engine, M4 herramientas técnicas, M5 historial.
Roles: usuario (no técnico), técnico y **superadministrador** (permiso del técnico que
gestiona los usuarios; desde el 19/10). No hay registro público.

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

## Estado por área (actualizado 2026-10-25: cotejo del Word del 22/10; antes, 24/10: auditoría, Docker, tiempo de generación, descarga en Excel y banco con volumen)

| Área | Estado |
|---|---|
| Backend M1–M3 | ✅ Completo y verificado en los 4 motores. Modelo (18/10): `gemini-3.8-flash` en `global`, razonamiento `LOW` (S10 real: correcto, $0.0012, 2,9 s). M1 (13/10): registro de conexiones en Firestore + contraseñas en Secret Manager (4 iniciales, `npm run seed:connections`), alta/edición/baja del técnico desde la pantalla Conexiones. `engine` sigue como alias de `connectionId`. **19/10: tope de ejecución por conexión** (`queryTimeoutSec`, de 10 s a 60 min, 8 min por defecto; lo fija el técnico en el formulario): con 10 s, el motor cancela en los 4 (10,4–10,8 s); una consulta de 186 s completa. API 59/59, UI 33/33 |
| Query Safety Engine | ✅ Endurecido 08/10; `npm run test:seguridad` → 57/57 + 200/200 (repetido el 24/10, también contra Docker). La revisión nueva del validador en la auditoría del 24/10 quedó cortada: **pendiente** |
| Referencias (50 consultas) | ✅ Contenido idéntico en los 4 motores (10/10; repetido el 24/10 con el volumen: 50/50). SQL escrito a mano, **no** de Gemini |
| Banco de pruebas (24/10) | ✅ A pedido de David, de 2 233 a **1 485 641 filas** en los 4 motores (250 000 pedidos, 631 630 líneas, 50 000 clientes, 2 000 productos), con datos con formato real. Las 2 233 base no cambiaron. 5 índices compuestos nuevos para medir con `EXPLAIN`. El volumen (`init/*/NN-volumen.sql.gz`) **no se versiona**: lo genera `python generar_seed.py`. `Bases de datos/README.md` («Volumen») |
| Evaluación con Gemini | 🟡 Runner listo y probado gratis (400/400), paráfrasis aprobadas, ajustado a 3.8 Flash (18/10). **Falta: piloto y corrida completa** |
| Frontend | ✅ Rediseñado 10/10: pantallas por módulo, menú según el rol, blanco + naranja claro, IBM Plex. Consultar y Esquema eligen entre las conexiones registradas (13/10). 19/10: sin `/signup`; el rol sale de `/me`; pantalla Usuarios (solo superadmin); tiempo máximo en el formulario de Conexiones. 24/10: «Cambiar contraseña» en Usuarios; auditoría de Consultar (resultados viejos, pago doble al cambiar de pantalla, error que dejaba el resultado anterior). `npm run test:ui` 24/24 + 33/33 + 27/27 + 18/18 (24/10). Falta probar "Generar SQL" con Gemini real desde la UI |
| M4 herramientas técnicas | ✅ 10/10: rol técnico (custom claim, 403 en el backend) con SQL editable, conexiones + pool, esquema y uso y costos. API 23/23. 13/10: edita la generada y las guardadas (no las del historial: se guardan antes), «Guardar cambios» y auditoría de cambios (pestaña Cambios). API 25/25, UI 23/23. En el Word (6.5) |
| M5 historial | ✅ Versión mínima 10/10: historial automático + consultas guardadas (manual), reusar sin Gemini. API 32/32, UI 10/10. En el Word (6.6); falta la captura (Figura 11) |
| Usuarios y superadmin | ✅ 19/10 (pedido de David): `GET/POST/PUT /users` y `/me`; alta con rol, cambio de rol y desactivar/reactivar (sin borrar). El permiso solo se asigna con `npm run set:superadmin -- <correo> [--crear]`. El rol y el estado se leen de la cuenta en cada solicitud (~150 ms; rigen al instante). Una cuenta sin rol recibe 403. **24/10:** cuenta de David (`davidmonterroso0897@gmail.com`) ya es superadmin; el superadmin pone una contraseña nueva a cualquier cuenta (`PUT /users` con `password`; la sesión en uso sigue hasta 1 h, desactivar corta al instante). API 50/50, UI 27/27. `SEGURIDAD.md` §14 |
| Auditoría y Docker (24/10) | ✅ Auditoría a pedido de David: rechazo de SQL como pregunta y de límites no pedidos (422), el backend no se cae ante tipos inesperados, integridad de valores en los 4 motores, Consultar, origen de uso solo para el técnico, contraseña guardada solo con el mismo servidor. **Docker:** `cd nlqp; docker compose up -d --build`. Solo el frontend se publica en la red y la credencial de GCP va como secreto. Pendientes de David y estado de cada hallazgo: `nlqp/docs/AUDITORIA_2026-10-24.md`; guía: `nlqp/docs/DOCKER.md` |
| Descarga en Excel (24/10) | ✅ A pedido de David: el CSV se veía desordenado porque Windows en es-GT separa con `;`. Ahora la descarga es un .xlsx (`exceljs@4.4.0`, `resultExcel.service.ts`, ruta `/exportResult`, botón «Descargar Excel»). Trae encabezados legibles y fijos, fechas y números con su tipo, `=` como texto (resuelve E8) y la hoja «Detalles» con la pregunta. Nunca se trunca: pasado el máximo de una hoja sigue en «Resultado 2». Memoria plana (~143 MB con 800 000 filas). Exportación 68/68 en los 4 motores. `RENDIMIENTO_E_INTEGRIDAD.md` §4.1 |
| Texto de tesis | 🟡 **24 pendientes + 1 por verificar + 71 aplicados** (25/10). **Word vigente: `Claude outputs/PG2-2026 revisado 22-10-2026.docx`** (revisión de David del 22–23/10, registrada recién el 25/10). Ya tiene el on-premises, el tope por conexión, los usuarios (US-01…US-08), el cambio de modelo (6.3.2 y precios de 6.7.1 incluidos), 5.3.1/5.3.2, las Figuras 1, 2, 3, 4 y 8 nuevas y el dato de 6.1.4 corregido: 49 de 52 instrucciones de `nlqp/docs/CAMBIO_ON_PREMISES.md`, cotejadas frase por frase. **Quedan:** OP-13 (Tabla 4 y sus dos «Gemini Pro», con el recálculo de 1.6.3), OP-36 (6.7.4, después de verificar en red), US-09 (contraseña nueva) y lo del 24/10: Docker en 5.3, controles de la generación en 6.3.2, integridad y Excel en 6.3.5, hallazgos en 6.7.2 y limitaciones (texto en `CAPITULO_6.md`). Faltan además: evaluación con Gemini (6.3.6), capturas de las Figuras 9 y 11, presentación (6.8), conclusiones → `nlqp/docs/RESUMEN_PARA_DOC_TEORICO.md` |
| Tiempo de generación (24/10) | 🟡 Una consulta simple tardó 24,2 s: ~20 s fueron espera al modelo (servicio de Google), ~2,7 s la preparación del cliente y ~0,5 s NLQP. Desde el 24/10: Vertex se prepara al arrancar, el esquema se guarda en caché 60 s, el tiempo se registra por etapa (Uso y costos: mediana, p95, máximo) y «hola» se rechaza sin llamar al modelo. Para la tesis (decisión de David): el tiempo depende de la consulta y del servicio, más la conexión y el proceso. `nlqp/docs/USO_Y_COSTOS.md` |
| Gasto en Gemini | ≈ **$0.024** (5 llamadas sueltas). Con 3.8 Flash ~$0.001–0.004 por llamada (con 2.5 Pro era ~$0.012), sin crédito de prueba |
| Encuesta (35 participantes) | ❌ Sin coordinar (no depende de código) |
| **Plan vs. real** (corte 24/10) | Plan 93 % · real 93 % · **+0,3 puntos**. Tareas nuevas: 47 (tope por conexión), 48 (usuarios, 100 % desde el 24/10), 49 (ajuste del documento por el on-premises, 80 %), 50 (auditoría, 100 %), 51 (Docker, 100 %) 52 (descarga en Excel, 100 %) y 53 (banco con volumen, 100 %). Detalle: `nlqp/docs/PLAN_DE_TRABAJO.md` |

## Próximo paso (actualizado 2026-10-25)

David decidió (10/10): **lo que cuesta dinero va al final**, pero con fecha límite.

1. **Piloto con paráfrasis** ← **SIGUIENTE** (Gemini 3.8 Flash): propuesto **a más tardar el 21/10**.
   40 llamadas, ~$0.10–0.16, tope automático $0.25. **Pedir confirmación a David antes.**
   Incluye la primera verificación real del 422 de límite no pedido (24/10). Requiere Docker y el
   backend con `npm run build` + **`npm start`** (no `dev`: `node --watch` se
   reinicia solo en Windows y puede cortar una llamada ya cobrada). Comando:
   `PREPARACION_EVALUACION_GEMINI.md` §8 punto 7.
2. **Corrida completa con paráfrasis**: propuesto **a más tardar el 22/10** (~$0.80–1.60
   en total, tope $2.50; lo del piloto no se repite). **Confirmación aparte.** Después:
   revisar a mano "Para revisión manual" de `nlqp/docs/evaluacion_gemini/resumen.md` y
   cargar las cifras en la tesis (6.3.6, 1.6.3 y conclusiones) con margen antes del 30/10.
3. Después del piloto: capturas de las figuras 9 (Consultar con una pregunta real; la
   generación cuesta ~$0.002) y 11 con los usuarios de la demo, que ya tienen el
   historial limpio (18/10). La Figura 10 (Conexiones) ya está en el Word (17/10).
4. **Sin costo, en paralelo:**
   - **Pasar al Word (el del 22/10) lo que quedó:** US-09 (`CAMBIO_ON_PREMISES.md`) y
     las entradas del 24/10 de `RESUMEN_PARA_DOC_TEORICO.md` (Docker, controles de la
     generación, integridad, Excel, hallazgos y limitaciones). OP-13 va con el
     recálculo de 1.6.3, después de la corrida.
   - Para OP-36 (6.7.4) hace falta **verificar** antes de escribir, sin costo:
     1. Backend: `npm run build` + `npm start`.
     2. Frontend: `NEXT_PUBLIC_BACKEND_URL=http://<IP-LAN>:8080`, `npm run build` +
        `npm start`.
     3. Entrar desde otro equipo o teléfono de la misma red.
   - Otros textos para el Word: 3.3.1.2 y limitaciones.
   - Respuestas de David:
     - ¿Se hizo la presentación del 14/10 (plan en 0 %)?
     - ¿El equipo de 3.8 es el suyo?
     - ¿La referencia de Spider 2.0 es de 2025?
     - ¿Qué versión de VS Code usa (para 3.8)?
   - La encuesta de 35 participantes sigue sin coordinar.
   - **Decisiones pendientes de la auditoría del 24/10** (`AUDITORIA_2026-10-24.md`). La
     más urgente antes de instalar en red es **H2**: cambiar las contraseñas del banco de
     pruebas commiteadas en `Bases de datos/README.md` y publicar sus puertos en
     127.0.0.1.

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
| Cambios del Word del 19/10 (on-premises, tope por conexión, usuarios; aplicados el 22/10 salvo OP-13, OP-36 y US-09) | `nlqp/docs/CAMBIO_ON_PREMISES.md` |
| Acceso remoto (no implementado) | `nlqp/docs/ACCESO_REMOTO.md` |
| Instalar con Docker o llevarlo a otro equipo | `nlqp/docs/DOCKER.md` |
| Hallazgos de la auditoría del 24/10 y su estado | `nlqp/docs/AUDITORIA_2026-10-24.md` |

Históricos (no citar como vigentes): `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` (arranque
del 17/09) y `nlqp/docs/historico/`. Plan con fechas en Excel:
`Claude outputs/Plan_de_Trabajo_PG2 DD-MM-AAAA.xlsx`, uno por corte (la carpeta no se
commitea, a pedido de David, y está en el `.gitignore` de la raíz desde el 25/10; los
datos de cada corte sí, en `nlqp/docs/plan/cortes/`).

## Levantar todo

```powershell
cd "Bases de datos"; docker compose up -d; cd ..   # 4 motores
cd nlqp/backend; npm run build; npm start             # http://localhost:8080 (dev usa --watch, que reinicia solo)
cd nlqp/frontend; npm run dev                         # http://localhost:3000
```

**Con Docker (desde el 24/10)**, en lugar del backend y el frontend:
`cd nlqp; docker compose up -d --build`. Es la misma dirección, y desde la red es
`http://<IP>:3000`. Usa `nlqp/.env` (no se commitea; plantilla en `nlqp/.env.example`).
No se puede correr a la vez que `npm start` / `npm run dev`, porque usan los mismos
puertos. Las pruebas funcionan igual. Detalle en `nlqp/docs/DOCKER.md`.

Docker Desktop en esta máquina: `C:\Users\david\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
Token de prueba (dura 1 h): `npm run test:token` en `nlqp/backend`.
Pruebas sin costo (con todo levantado): `npm run test:seguridad` y `npm run test:api` en
`nlqp/backend`; `npm run test:ui` en `nlqp/frontend` (la primera vez, `npm install
--no-save playwright-core@1.64.0`). Usan usuarios **exclusivos de las pruebas**
(`nlqp-ci-tecnico@example.com`, `nlqp-ci-usuario@example.com`,
`nlqp-ci-superadmin@example.com`). Al terminar borran lo que dejaron en Firestore y las
cuentas temporales `nlqp-ci-tmp-*@example.com` (`npm run limpiar:pruebas`).
Resultados del 24/10, ya con el banco de 1,5 M de filas: API 358/358 (incluye la exportación a Excel, 68/68), UI 102/102, seguridad 57/57 + 200/200, eval modo prueba 200/200 (50/50 consistentes).
En un equipo nuevo, antes del primer `docker compose up` del banco: `python generar_seed.py` en `Bases de datos/` (~2 min). La primera carga tarda ~8 min por SQL Server.
Si las pruebas dan resultados raros, revisar que no haya un `node` viejo en :8080
(`Get-NetTCPConnection -LocalPort 8080`): `TaskStop` cierra la terminal pero no el
proceso.
Roles: las cuentas se crean desde la pantalla Usuarios (superadmin) o con
`npm run set:role -- <correo> <tecnico|no_tecnico>`; superadmin:
`npm run set:superadmin -- <correo> [--crear]`. Usuarios de la demo (para
entrar desde la interfaz; ninguna prueba los usa): `nlqp-test@example.com` (técnico) y
`nlqp-usuario@example.com` (no técnico). Las contraseñas de los usuarios
de la app están **solo** en `nlqp/backend/.env` (`NLQP_TEST_USER_*`, `NLQP_USUARIO_*`,
`NLQP_SUPERADMIN_*`, `NLQP_DEMO_*`); las que estaban commiteadas se cambiaron el 18/10.
**Las de las bases del banco de pruebas (`testuser`, admin de Postgres) siguen
commiteadas en `Bases de datos/README.md` y vigentes** (auditoría del 24/10, H2:
pendiente de David).

## Abierto (no es el próximo paso; no hacerlo sin que David lo pida)

- Probar "Generar SQL" con Gemini real desde la UI (cuesta ~$0.001–0.004 por intento con 3.8 Flash).
- (24/10) `EXPLAIN` sobre el SQL generado, con el banco de volumen (ya existe). Se hace después de la corrida, sin volver a pagar.
- Confirmar si `../db/` (fuera del repo, no existe en disco) es relevante.
- Hallazgos de seguridad 4–6 (`SEGURIDAD.md`): documentados, no corregidos a propósito.
- Firmar en el backend el SQL generado para que un no técnico no pueda mandar SQL
  propio a `/executeQuery` (`SEGURIDAD.md` §12; hoy es riesgo aceptado).
- (19/10, por el despliegue on-premises) El servidor Express de `backend/src/index.ts`
  pasa a ser el servidor real:
  - tiene `cors()` abierto: conviene restringirlo al origen del frontend en la red (con Docker no importa: el backend no se publica en la red, 24/10);
  - su comentario dice "no se usa en producción".
- (19/10) Los handlers con `functions.http(...)` no verifican el token. Solo importa si
  algún día se despliega en Cloud Functions (`CAMBIO_ON_PREMISES.md` OP-03).
- (19/10) No hay cuenta de BD de solo lectura en el banco de pruebas: `testuser` tiene
  permisos amplios a propósito y `../db/` no existe.
- (19/10) El reloj de esta PC está unos 3 s adelantado respecto de Google. Hoy no
  afecta, porque no se revocan sesiones, pero conviene sincronizarlo (Windows: Hora →
  Sincronizar ahora). Es una configuración de la máquina de David: pedírselo, no hacerlo.
- (19/10) Leer la cuenta en cada solicitud suma unos 150 ms. Si molesta, se puede
  cachear unos segundos, a cambio de que los cambios de rol tarden eso en regir.
- (19/10) La prueba `ui_usuarios` dio una corrida sin resultado entre 9; no se repitió
  en 6 más.
- (24/10) Pendientes de la auditoría (`AUDITORIA_2026-10-24.md`):
  - H2: contraseñas del banco de pruebas y puertos en 0.0.0.0;
  - H4: `NLQP_ALLOW_DEV_AUTH_BYPASS=true` en `backend/.env`;
  - prompt: empates con LIMIT 1, reglas de dominio para toda conexión, «nunca SELECT *»,
    delimitar la pregunta;
  - poda que pierde tablas con verbos conjugados (no ajustar el diccionario sin decidirlo,
    por la medición de robustez);
  - límite de llamadas por usuario;
  - auditoría de la gestión de usuarios;
  - DECIMAL de SQL Server;
  - reglas de Firestore sin versionar;
  - cuenta de servicio para Docker;
  - revisión nueva del Query Safety Engine.
- (24/10) En Docker, `/tmp` del backend es tmpfs: los snapshots de resultados ocupan RAM
  del contenedor (~230 MB con tres de 800 000 filas, vencen a los 30 min). No se cambió.

## Reglas que no hay que romper

- **Nunca** ejecutar SQL contra las bases sin pasar antes por `querySafety.service.ts`,
  ni "solo para probar": la cuenta `testuser` tiene permisos amplios a propósito.
- Cualquier cambio a `querySafety.service.ts` (o a la ejecución) requiere
  `npm run test:seguridad` en verde (Docker levantado). SQL Server no exige `;` entre
  sentencias y ya causó un bypass real (`SEGURIDAD.md` §1).
- **Nunca truncar resultados en silencio** ni pedirle al modelo `LIMIT`/`TOP` que el
  usuario no pidió. Los límites son todo o nada (timeout de la conexión → 504, > 1 GB → 413).
  Siempre hay un tope de tiempo (de 10 s a 60 min por conexión): nunca "sin límite".
- Las consultas generadas deben ser correctas **y eficientes** con mucho volumen
  (requisito de David, 02/10).
- No commitear `.env`. No levantar `../db/docker-compose.yml` junto con
  `Bases de datos/docker-compose.yml` (mismos puertos).
