# Bitácora — NLQP

Registro fechado de lo que se hizo, se verificó o se decidió. Lo más reciente
arriba. El detalle de cada tema está en el documento enlazado; acá solo va el qué y
el cuándo. **Al cerrar cada sesión de trabajo, agregar una entrada.**

---

## 2026-10-24 (3) — Por qué una generación simple tardó 24 s, y mejoras de tiempo

Sin gasto en GCP. David probó «Muéstrame las categorías que hay» (MariaDB, en Docker) y
tardó **24,2 s**.

### Diagnóstico, medido sin costo
- El evento de uso registró 533 tokens de entrada, 12 de salida y 0 de razonamiento.
- `/me` tardó ~0,1 s; `/getSchema`, 0,12–0,45 s en los 4 motores.
- `countTokens` desde el contenedor tardó 2,8 s la primera vez y 0,14 s después.
- El SDK no reintenta (no tiene `retryOptions`).
- Conclusión: **~20 s fueron espera al modelo** (servicio de Google). Con prompts
  parecidos, otras llamadas tardaron 2,9 y 5,5 s.

### Revisión con agentes (pedido de David; 3 agentes, solo lectura)
Revisaron la latencia de Gemini, el ahorro de costo y el resto del camino de la
solicitud. Conclusiones:
- No hay ahorro grande que no comprometa la evaluación.
- La corrida completa costaría ~$0.60 si el razonamiento sigue en 0.
- Lo útil es sacar el arranque del camino y medir por etapa.

El detalle de lo descartado está en `USO_Y_COSTOS.md`.

### Decisiones de David
- Sí a los 5 cambios gratuitos.
- No al timeout con reintento, al tope de gasto por usuario ni a la caché del rol.
- **Documentar en la tesis** que el tiempo de generación depende de la consulta y del
  servicio del modelo, y que se suman la conexión y el proceso desde que se aprieta
  «Generar SQL».

### Hecho (15589cb)
- Vertex se prepara al arrancar: `[vertexAI] cliente listo en 2785 ms`.
- Caché del esquema de 60 s.
- Tiempo por etapa en las métricas, en el evento de uso y en Uso y costos («Tiempos de
  generación»: mediana, p95, máximo).
- 422 `nlqp/no-content` para «hola», «gracias», «asdf» (las 100 preguntas del corpus
  pasan en los 4 motores; «buenos días» pasa, es conservador a propósito).
- Uso e historial en paralelo en `/executeQuery`.

### Verificado
- **API 358/358**: 290 propias (`api_generacion` 62/62) + 68 de `api_exportacion`, que
  no es de esta sesión.
- **UI 102/102**.
- **Seguridad 57/57 + 200/200**.
- `getUsageStats`: 5 generaciones, mediana 9,8 s, máximo 24,2 s. El detalle por etapa
  aparece desde la próxima generación real.

### Trabajo ajeno en el repositorio
Durante la sesión aparecieron cambios sin commitear que no son de esta sesión:
- una exportación a Excel: `resultExcel.service.ts`, `api_exportacion.mjs`, y cambios en
  `package.json`, `resultPages.ts`, `resultStore.service.ts`, `QueryResult.tsx` y
  `ui_general.mjs`;
- `Bases de datos/generar_seed.py`.

No se tocaron ni se commitearon. El commit se armó solo con los bloques propios y se
verificó que compila sin ellos.

### Docs
- `USO_Y_COSTOS.md` (tiempo por etapa).
- `RESUMEN_PARA_DOC_TEORICO.md`: 3.3.1.3 con la decisión de David y 6.3.6 con mediana/p95
  por etapa. Siguen 30 pendientes: las dos entraron en entradas que ya estaban
  pendientes.

---

## 2026-10-24 (2) — Auditoría, correcciones e instalación con Docker

Sin gasto en GCP. Pedidos de David: auditar a fondo, corregir y documentar («trabajá
esta noche sin mí… versionando cada cambio exitoso», «no hagas acciones que generen
costo») y, después, «que el proyecto esté en docker para… pasarlo a otro equipo».
Detalle de cada hallazgo y su estado: **`AUDITORIA_2026-10-24.md`**.

### Decisiones de David (24/10)
- Commit y push de cada cambio verificado; los cambios del 22–23/10 en un commit aparte.
- SQL como pregunta: rechazarlo para todos los roles.
- LIMIT/TOP que la pregunta no pide: bloquear con aviso, sin modificar el SQL en
  silencio.

### Qué se corrigió (un commit por bloque)
- **Generar SQL** (ec7948c):
  - rechaza SQL de entrada y preguntas de más de 1000 caracteres antes del modelo;
  - bloquea los límites de filas no pedidos (422);
  - el servidor ya no se cae con un campo de tipo inesperado (`sql: 1` lo apagaba) y
    no muestra stack traces.
- La consulta de David del 24/10 (`SELECT TOP 10…` en MySQL, $0.0017) no tenía un
  límite inventado: el `LIMIT 10` venía de su `TOP 10`.
- **Integridad** (639614c): columnas repetidas, `TIMESTAMP` de Postgres +6 h, BIGINT de
  MySQL y conexiones de MySQL/MariaDB sin tope.
- **Consultar** (a46e398): resultados viejos bajo una sentencia nueva, pago doble al
  cambiar de pantalla, el resultado anterior visible tras un error, «Failed to fetch» y
  detalles de la tabla.
- **Uso y costos** (018565b): `X-NLQP-Origin` solo para el técnico; se registra el
  costo de MAX_TOKENS; el runner guarda cada generación pagada apenas vuelve.
- **Conexiones** (634fde1):
  - la contraseña guardada no se usa con otro servidor, puerto o usuario;
  - Esquema tiene «Reintentar»;
  - carrera de `useAuth` al cerrar sesión;
  - guardia de pg-cursor.

### Docker (8ccf060)
- `nlqp/docker-compose.yml` + Dockerfiles: `docker compose up -d --build`.
- Solo el frontend (3000) se publica en la red. El navegador llama a `/api` y Next lo
  reenvía al backend, que queda en la red interna y en `127.0.0.1:8080`.
- Credencial de Google Cloud como secreto de solo lectura. Contenedores sin root, de
  solo lectura y sin capacidades. Dev bypass fijo en `false`.
- `NLQP_LOCALHOST_ALIAS`: las conexiones registradas con `localhost` llegan a la máquina
  anfitriona.
- Imágenes revisadas: sin `.env` ni credenciales. Guía: `DOCKER.md`.
- La primera construcción falló al descargar la fuente de Google (red); la segunda pasó.

### Verificado
- **API 275/275** (64 · 23 · 33 · 25 · 50 · 47 · 14 · 19).
- **Interfaz 102/102** (24 · 33 · 27 · **18**, `ui_consultar` nueva).
- **Seguridad 57/57 + 200/200**.
- **Evaluación en modo prueba 200/200**.
- Todo, también contra los contenedores de Docker. Además, una consulta de 48 s por el
  reenvío `/api` (el valor por defecto de Next corta a los 30 s).
- `ui_consultar` responde `/generateSQL` en el navegador (en `:8080` y en `/api`): no
  llamó a Gemini.

### No se hizo
- La revisión del Query Safety Engine quedó cortada: **pendiente**.
- El acceso desde otro equipo de la red no se probó.
- **Pendiente de David:**
  - contraseñas del banco de pruebas commiteadas y puertos en 0.0.0.0 (H2, alta);
  - `NLQP_ALLOW_DEV_AUTH_BYPASS=true` en `backend/.env`;
  - cambios al prompt;
  - límite de llamadas por usuario;
  - auditoría de la gestión de usuarios;
  - CSV y fórmulas;
  - DECIMAL de SQL Server;
  - cuenta de servicio para Docker.
- Los permisos: la sesión principal ya corría en modo automático; los pedidos de
  aprobación venían de los agentes de la auditoría. No se cambió la configuración.

### Docs y plan
- `AUDITORIA_2026-10-24.md` y `DOCKER.md` (nuevos).
- `SEGURIDAD.md` §15, `RENDIMIENTO_E_INTEGRIDAD.md` (bugs 5 y 6),
  `PREPARACION_EVALUACION_GEMINI.md` §8 (nota del 24/10).
- `RESUMEN_PARA_DOC_TEORICO.md`: **30 pendientes** (+5).
- Plan: tareas nuevas 50 (auditoría) y 51 (Docker), al 100 %. Corte 24/10: plan 93 %,
  real 93 %, +0,3. El Excel del corte quedó en el scratchpad de la sesión, porque
  `Claude outputs/Plan_de_Trabajo_PG2 24-10-2026.xlsx` estaba abierto: volver a
  generarlo con Excel cerrado.

### Sigue
- El piloto con paráfrasis (~$0.10–0.16), con confirmación. Incluye la primera
  verificación real del 422 de límite no pedido.

---

## 2026-10-24 — Cuenta de David como superadmin y contraseña nueva desde Usuarios

Sin gasto en GCP.

### Acceso a la app
- David no podía entrar con las cuentas de la demo. Las cuentas estaban bien: activas,
  con rol, y la contraseña del `.env` entra (verificado contra Firebase y con `/me` 200
  en las dos). **La app no estaba levantada**: Docker, el backend y el frontend estaban
  apagados.
- Las contraseñas de la demo las lee David del `.env` con `!`; no pasan por el chat.
- **Cuenta de David como superadmin:** `davidmonterroso0897@gmail.com`, creada por él con
  `npm run set:superadmin -- … --crear`. Verificado: `role: tecnico`,
  `superadmin: true`, activa y con inicio de sesión registrado. **Tarea 48 al 100 %.**

### Contraseña nueva (pedido de David, "dale" a la propuesta)
- `PUT /users?uid=…` acepta `{ password }` (de 8 a 128 caracteres, la misma validación
  que el alta, ahora en `parsePassword`). Solo el superadmin, para cualquier cuenta,
  incluida la suya.
- Pantalla Usuarios: botón «Cambiar contraseña» en cada fila, que abre el formulario
  debajo, con confirmación.
- La contraseña solo va a Firebase Auth: no se guarda, no se registra y no vuelve en la
  respuesta.
- Firebase invalida los refresh tokens de la cuenta, pero **el token ya emitido sigue
  valiendo hasta una hora**: el backend no verifica revocaciones (el reloj, 19/10). Para
  cortar el acceso al instante, se desactiva la cuenta.
- Verificado:
  - **API 189/189** (59 · 23 · 32 · 25 · **50**);
  - **interfaz 84/84** (24 · 33 · **27**);
  - **seguridad 57/57 + 200/200**.
- La primera corrida de seguridad no mostró resultado porque corrió en paralelo con la
  de interfaz; sola dio verde.
- **Docs:** `SEGURIDAD.md` §14, `MANUAL_POSTMAN.md` §6, `CAMBIO_ON_PREMISES.md` **US-09**
  (RF-16, 6.5, 6.5.1 y glosario) y `RESUMEN_PARA_DOC_TEORICO.md` (25 pendientes).
- **Plan:** tarea 48 al 100 %. Corte 24/10: plan 93 %, real 93 %, **+0,3 puntos**.
- **Sigue:** piloto con paráfrasis (~$0.10–0.16), con confirmación previa.

---

## 2026-10-19 (2) — Tope de ejecución por conexión y superadministrador con gestión de usuarios

Pedidos de David del 19/10 ("dale" a las propuestas). Sin gasto en GCP.

### Tope por conexión
- `queryTimeoutSec` en cada conexión, de 10 s a 60 min, con 8 min por defecto
  (`NLQP_QUERY_TIMEOUT_MS`). Lo fija el técnico en el formulario de Conexiones, y la
  lista lo muestra.
- Se aplica al abrir el pool, y editar cierra el pool.
- `QueryTimeoutError` dice el tope de esa conexión.
- Las 4 conexiones existentes quedan con 8 min.
- Verificado:
  - con 10 s, el motor cancela en los 4 (10,4–10,8 s);
  - la consulta de 186 s completa;
  - `api_conexiones` 59/59 y `ui_conexiones` 33/33.
- La consulta lenta de la prueba usa `SUM`, porque MySQL y SQL Server resuelven
  `COUNT(*)` de un producto cartesiano sin recorrer las filas.

### Superadministrador y gestión de usuarios
- Claim `superadmin: true` junto con el rol técnico, que solo asigna
  `npm run set:superadmin -- <correo> [--crear]`. Con `--crear`, el script imprime un
  enlace para que el dueño elija su contraseña.
- `GET/POST/PUT /users` (`requireSuperadmin`), `GET /me` y pantalla **Usuarios**: alta
  con rol, cambio de rol, desactivar y reactivar, sin borrar.
- El superadmin no puede desactivarse ni quitarse el rol técnico.
- **Se eliminó `/signup`.** Una cuenta sin rol recibe 403.
- **El rol y el estado se leen de la cuenta en cada solicitud** (`getUser`), no del
  token. Los cambios rigen al instante, con un costo de unos 150 ms por solicitud.
- Se descartó revocar sesiones: el **reloj de esta PC está unos 3 s adelantado**
  respecto de Google y el SDK marca la revocación con la hora local, así que rechazaba
  también los inicios de sesión de esos segundos (fallaba de forma intermitente).
- Usuario de pruebas nuevo: `nlqp-ci-superadmin@example.com`, con la contraseña solo en
  `.env` (`NLQP_SUPERADMIN_*`).
- `limpiar:pruebas` borra además las cuentas `nlqp-ci-tmp-*@example.com`.
- Verificado:
  - `api_usuarios` 35/35, cinco veces seguidas;
  - `ui_usuarios` 20/20, en 8 de 9 corridas (la que no dio resultado no se repitió en
    6 más).

### Resultados de las pruebas y documentación
- **Pruebas:**
  - **API 174/174** (59 · 23 · 32 · 25 · 35);
  - **interfaz 77/77** (24 · 33 · 20);
  - **seguridad 57/57 + 200/200**.
- **Prueba ajustada:** en `ui_conexiones`, "Editar: nombre nuevo en la lista" era
  intermitente, por una carrera de la prueba que ya existía. Ahora espera la fila; dio
  5/5.
- **Docs:**
  - `SEGURIDAD.md` §14 (registro público abierto y rol leído del token; corregido);
  - `RENDIMIENTO_E_INTEGRIDAD.md` (tope por conexión);
  - `MANUAL_POSTMAN.md` §6;
  - `CAMBIO_ON_PREMISES.md` Parte 6 (US-01…US-08) y OD-02 reescrito;
  - `RESUMEN_PARA_DOC_TEORICO.md` (las 4 entradas del 19/10 incluyen los US);
  - plan: tareas nuevas 47, 48 y 49; corte del 19/10: plan 87 %, real 88 %, +1,0.

### Entorno
- Un `node` viejo quedó escuchando en :8080 (el `TaskStop` cerró la terminal pero no
  el proceso). La primera corrida de pruebas fue contra código viejo y dejó 2
  conexiones de prueba, que se borraron por la API.

### Sigue
- Asignar la cuenta de David como superadmin: falta su correo.
- Piloto (21/10, con confirmación).
- Pasar `CAMBIO_ON_PREMISES.md` al Word.

---

## 2026-10-19 — Revisión del Word v2 contra el código; decisión: despliegue on-premises

- Se leyó completo `PG2-2026 capítulo 6 revisado 17-10-2026 v2.docx` (caps. 1–6,
  figuras incluidas) y se comparó con el código.
- **Coinciden:** Node 22 (22.23.2), Next 16 (16.3.5), TS 5, drivers y Secret Manager.
- **No coincidía:** el despliegue. La tesis describe Cloud Functions + Firebase Hosting;
  el sistema corre en local (Express en :8080, `next dev`), sin `firebase.json`.
- Se debatió desplegar en Firebase/GCP: hace falta una VM para las bases, porque SQL
  Server necesita 2 GB (unos USD 25–30 al mes), más ajustes de código.
- **Decisión de David:** quedarse **on-premises**, la opción más rentable y realista
  para una empresa (bases en su red, acceso por LAN/VPN), y presentar la arquitectura
  serverless como ruta de escalamiento.
- Se escribió **`CAMBIO_ON_PREMISES.md`**: instrucciones paso a paso para el Word, 41
  cambios `OP` y 9 diferencias `OD`, con el texto exacto. Incluye la Figura 8 nueva, las
  secciones nuevas 5.3.1/5.3.2 y la 6.7.4 (después de verificar).
- Diferencias encontradas que no dependen del despliegue:
  - **6.1.4 afirma cuentas de solo lectura, y `testuser` tiene permisos amplios.**
  - Tope de 60 s frente a los 8 min de RNF-01.
  - En 2.7: reglas de Firestore y "preferencias" que no existen.
  - Hay registro de cambios (auditoría del 13/10), y 1.5/1.7/4.4 dicen que no.
  - RF-13: el no técnico no edita.
  - Figura 7 distinta de las colecciones reales.
  - Tabla 4: "35 secretos".
  - 3.8 sin React/Express/Docker.
- Encontrado en el código, no tocado (anotado en "Abierto"): los handlers de
  `functions.http` no verifican el token; `cors()` abierto en el servidor que ahora es
  el real.
- `RESUMEN_PARA_DOC_TEORICO.md`: +4 entradas, una por capítulo, que remiten al archivo
  nuevo (24 pendientes). Sin gasto. Sin cambios de código.
- **Tope de ejecución: de 60 s a 8 min** (pedido de David: que los reportes que duren
  hasta los 8 min de RNF-01 se puedan ejecutar).
  - Cambiado en `connectionManager.service.ts` (valor por defecto) y en `.env.example`;
    el `.env` no lo define.
  - No se quitó el límite del todo: sin tope, una consulta mal formada ocuparía la base
    indefinidamente.
  - Verificado: `test:seguridad` 57/57 + 200/200, y una consulta de **186,4 s** en
    PostgreSQL completó por `/executeQuery` (`npm start`) con HTTP 200.
  - No verificado: más de 60 s en MySQL, MariaDB y SQL Server, ni desde la UI.
  - Datos de prueba limpiados (`limpiar:pruebas`).
  - Docs actualizados: `RENDIMIENTO_E_INTEGRIDAD.md`, `MANUAL_POSTMAN.md`,
    `PREPARACION_EVALUACION_GEMINI.md` y OD-02 en `CAMBIO_ON_PREMISES.md`.
- Tabla 4, "35 secretos": David cree que salió de los 35 usuarios. Igual se corrige,
  porque los secretos son uno por conexión (los usuarios usan Firebase Auth).
- Sigue: el piloto (21/10, con confirmación). En paralelo y sin costo: pasar los cambios
  al Word y verificar el acceso desde otro equipo de la red (para 6.7.4).

## 2026-10-18 (3) — Cierre del día

- Hecho hoy: cambio a Gemini 3.8 Flash (`bde255e`) y usuarios exclusivos para las
  pruebas con el historial de la demo limpio (`db8d141`). Gasto del día: $0.0012 (1
  llamada); total en Gemini ≈ $0.023.
- Auditoría de lo que falta sin costo (pedido de David): textos para el Word (cambio de
  modelo en caps. 1–5, 6.3.2, 6.7.1, 3.3.1.2, limitaciones), figuras del Cap. 5 (0 %),
  capturas de las Figuras 9 y 11, banco de volumen alto (recomendado: después de la
  corrida o como limitación) y la encuesta de 35 participantes, que sigue sin coordinar.
- Sin respuesta de David todavía: ¿se hizo la presentación del 14/10? (tarea 35 en 0 %,
  sin entrada en la bitácora), ¿el equipo de 3.8 es el suyo?, ¿referencia de Spider 2.0
  de 2025?
- Sigue: piloto con paráfrasis (40 llamadas, ~$0.10–0.16, tope $0.25), con confirmación;
  propuesto a más tardar el 21/10, y la corrida completa el 22/10.

## 2026-10-18 (2) — Historial de prueba limpio y usuarios exclusivos para las pruebas

- Pedido de David (13/10, "dale" el 18/10). Antes: 161 consultas de prueba en el
  historial de los usuarios de la demo y 1408 ejecuciones de prueba en `usageEvents`.
- **Usuarios exclusivos de las pruebas:** `nlqp-ci-tecnico@example.com` (técnico) y
  `nlqp-ci-usuario@example.com` (no técnico). `test:api`, `test:ui`, `test:token` y
  `eval:gemini` los usan por defecto; los de la demo (`nlqp-test`, `nlqp-usuario`)
  quedan solo para entrar desde la interfaz.
- **`npm run limpiar:pruebas`** (`scripts/limpiar_pruebas.mjs`): borra de esos usuarios
  historial, guardadas, auditoría y eventos de ejecución; nunca los de `generateSQL`
  (llamadas reales con costo). Solo acepta correos `@example.com`. `test:api` y
  `test:ui` lo corren solos al terminar.
- **Contraseñas:** el repo es público (verificado: la API de GitHub responde sin
  autenticar) y las de la demo estaban commiteadas. Se cambiaron las cuatro (aleatorias,
  solo en `.env`: `NLQP_TEST_USER_*`, `NLQP_USUARIO_*`, `NLQP_DEMO_*`), se revocaron las
  sesiones y se quitaron del código (`get_test_token.mjs`, `evaluacion_gemini.mjs`) y de
  esta bitácora. La vieja ya no entra (400). Quedan en el historial de git, pero ya no
  sirven.
- Limpieza de lo que quedó (una vez, usuarios de la demo): historial 67 + 94, uso 1304 +
  104. Quedan las 3 llamadas reales a Gemini.
- `ui_general.mjs`: el usuario de las pruebas empieza con el historial vacío, así que
  primero ejecuta una consulta por la API (+1 verificación).
- Verificado: `test:api` 38/38 · 23/23 · 32/32 · 25/25; `test:ui` 24/24 + 27/27;
  después de cada corrida Firestore queda sin nada de las pruebas (solo las 3 llamadas a
  Gemini); los usuarios de la demo entran con las contraseñas nuevas (200).
- Sigue: piloto con paráfrasis (con confirmación).

## 2026-10-18 — Cambio de modelo: Gemini 3.8 Flash (Gemini 2.5 Pro se retira el 20/10)

- Verificado en la página oficial de Vertex AI ("Model versions and lifecycle"): el
  retiro de `gemini-2.5-pro` es el **20/10/2026** (ya no figura como provisorio). Lo
  resuelto el 09/10 era el SDK deprecado, no el modelo.
- **Decisión de David:** cambiar ya a un modelo que no se venza pronto, con todo lo que
  conlleva (código, docs, tesis), en vez de correr la evaluación con 2.5 Pro.
- Elegido **`gemini-3.8-flash`** (GA 02/09/2026, retiro no antes del 02/09/2027; Google
  lo propone como reemplazo). Descartados `gemini-3.1-pro-preview` (preview) y
  `gemini-4-argon` (ignora temperatura y es más caro).
- Cambios: `.env`/`.env.example` (`VERTEX_AI_MODEL=gemini-3.8-flash`,
  `GCP_LOCATION=global`, porque el modelo no está en `us-central1`);
  `vertexAI.service.ts` (`thinkingLevel: LOW` en vez de `thinkingBudget: 1024`, sin
  temperatura porque el modelo la ignora, valores por defecto nuevos);
  `vertexAiPricing.service.ts` ($1.50 / $7.50 por millón, del catálogo de Cloud
  Billing); runner (`COSTO_ESTIMADO_POR_LLAMADA` 0.004, topes $0.25 / $2.50). Prompt
  sin cambios.
- Verificado: `tsc` sin errores; `countTokens` con el modelo nuevo (gratis, 507);
  `test:seguridad` 57/57 + 200/200; `test:api` 38/38 · 23/23 · 32/32 · 25/25.
- **1 llamada pagada autorizada por David** (S10, Postgres): mismo SQL que con 2.5 Pro
  (rango de fechas), aprobado por el Query Safety Engine, resultado 104 = referencia.
  621 / 39 / **0** tokens de razonamiento, 1/8 tablas, **$0.001224**, 2,9 s (con 2.5
  Pro: $0.01188, 14,5 s). Gasto total en Gemini ≈ $0.023.
- Nueva proyección de la evaluación: piloto (40) ~$0.10–0.16, completa (400)
  ~$0.80–1.60.
- Docs: `CAPITULO_6.md` (6.3.2 y 6.7.1), `RESUMEN_PARA_DOC_TEORICO.md` (+3 pendientes:
  cambio de modelo en caps. 1–5, 6.3.2, 6.7.1; actualizadas 1.6.3 y limitaciones),
  `PREPARACION_EVALUACION_GEMINI.md` (§6 y §8 2c), `USO_Y_COSTOS.md`,
  `MANUAL_POSTMAN.md`, `PLAN_DE_TRABAJO.md` (riesgo cerrado), plan: tarea nueva 46 y
  corte 18/10 (plan 92 %, real 93 %, +0,9 puntos).
- Sigue: piloto con paráfrasis (con confirmación), luego corrida completa.

## 2026-10-17 (4) — Plan: ajuste de David al corte 17/10

- David quitó el comentario de la tarea 38 (Entrega PG2) en el Excel. Se quitó también de
  `plan.json` para que no vuelva a salir en los próximos cortes. Fechas y porcentajes sin
  cambios. Sin commit.

## 2026-10-17 (3) — Plan: corte 17/10 y entrega movida al 31/10

- La universidad corrió la entrega al 31/10. Por pedido de David se cambiaron solo dos
  fechas del plan: tarea 37 (conclusiones y revisión final) termina el 30/10 y la 38
  (entrega PG2) pasa al 31/10; el grupo "Cierre y entrega" y el proyecto terminan el
  31/10. La presentación del prototipo (35) queda el 14/10, en 0 %.
- Avance real: M4 y M5 100 % (documentados en el Word), integración 80 % (falta
  "Generar SQL" con Gemini desde la interfaz), conclusiones y revisión final 50 %.
- Corte 17/10: plan 91 %, real 93 %, **+1,5 puntos**. Excel en `Claude
  outputs/Plan_de_Trabajo_PG2 17-10-2026.xlsx`. Sin commit.

## 2026-10-17 (2) — Correcciones de David, formato general y Figura 10

- David corrigió el Word: títulos sin "Módulo N —" (6.1, 6.2, 6.3, 6.5, 6.6), subtítulos
  como títulos numerados (6.1.1–6.1.5, 6.2.3, 6.5.1, 6.6.1) y rayas por paréntesis en tres
  párrafos. Se toma su versión como base; `CAPITULO_6.md` sincronizado.
- Formato pedido: interlineado 1,5 y 2 pt antes y después en todo el documento (desde el
  índice; portada y celdas de tablas sin cambio); títulos de todo nivel en 12 pt, negrita,
  sin cursiva (el estilo de nivel 4 era cursiva y azul); nivel 3 en adelante con sangría.
- Figura 10: captura de Conexiones en 6.5, recortada y sin `localhost`. La Figura 9
  sigue siendo la vieja (falta captura con pregunta real).
- Índices regenerados; capítulos en página impar; Cap. 6 p. 93–118. Entregado como
  `PG2-2026 capítulo 6 revisado 17-10-2026 v2.docx`. Sin commit.

## 2026-10-17 — Word con los cambios acordados (`PG2-2026 capítulo 6 revisado 17-10-2026.docx`)

- David aprobó la lista (ahora toda modificación al Word se acuerda antes). Pedido del
  asesor: menos tablas y pocas figuras nuevas (1–2), sin quitar las existentes.
- Aplicado lo del 16/10 (6.1, 6.4, 6.5 M4, 6.6 M5, integración = 6.7, 6.7.1, dos
  hallazgos en 6.7.2), pero M4 y M5 **sin tablas**, y las tablas de 6.3.4, 6.3.5 y 6.7.1
  pasadas a texto. El Cap. 6 queda con 2 tablas: hallazgos (14) y latencias (15).
- Figuras sin cambios: la Figura 9 vieja sigue; falta la captura de Consultar con una
  pregunta real y elegir la Figura 10 (Historial, previa limpieza, o Conexiones sin
  `localhost`). Las capturas nuevas del 16/10 tienen datos de prueba.
- Verificado: validación OK, índices regenerados, capítulos en página impar, ningún
  párrafo pasa de 12 líneas; Cap. 6 de la p. 93 a la 117. Sin commit.

## 2026-10-16 — Word con M1, M4 y M5 (`PG2-2026 capítulo 6 revisado 16-10-2026.docx`)

- Aplicado al Word todo lo pendiente del Cap. 6 que ya tenía texto en `CAPITULO_6.md`:
  6.1 (pool por conexión, Secret Manager al abrir el pool, subsección "Registro de
  conexiones", verificación 38/38 y 27/27); 6.4 reescrita; 6.5 Módulo 4 (Tabla 16) y 6.6
  Módulo 5 (Tabla 17) nuevas; integración renumerada a 6.7 (tablas 18–20); 6.7.1 sin
  "Dos limitaciones…"; 6.7.2 con dos filas nuevas.
- Ajustes al texto al pasarlo: frase repetida de la contraseña en 6.1; párrafos de
  verificación divididos para no pasar de 12 líneas; Tabla 17 dice "conexión (nombre y
  motor)" (el historial guarda el nombre de la conexión); la limitación del SQL no
  firmado ya no remite a 6.7.2 (no la trata); se agregó el **hallazgo 13** de
  `SEGURIDAD.md` (contraseñas en `.env`, media, corregido 13/10), que faltaba en la
  tabla, con un párrafo para los dos hallazgos medios.
- Capturas: las de `Claude outputs/capturas 10-10-2026/` no sirven (datos de prueba,
  interfaz del 10/10). La Figura 9 vieja sigue en el Word; Figuras 10 y 11 sin poner.
- Verificado: validación OK, referencias enlazadas (56 nuevas), índices regenerados,
  ningún párrafo pasa de 12 líneas, capítulos en página impar; Cap. 6 de la p. 93 a la
  118 (26 páginas). Resumen: 17 pendientes, 1 por verificar, 63 aplicados. Sin commit.
- Ojo: el piloto y la corrida con Gemini (límites 14 y 15/10) no se hicieron; la entrega
  es el 17/10.

## 2026-10-13 (6) — Cierre del día

- David notó en Historial consultas como `SELECT 40 + 2 AS ui166705`: las dejan las
  pruebas automáticas (`test:api`, `test:ui`), que usan los mismos usuarios de prueba
  que él ve en la interfaz. **David decidió:** dejarlo para la siguiente sesión (punto 4
  de "Próximo paso" en `CLAUDE.md`).
- Commits del día subidos: `c546cc5`, `d48e359`, `0b73a87` y este cierre.
- Sigue: piloto con paráfrasis (~$0.50, con confirmación; el tablero lo fija a más
  tardar el 14/10) y la limpieza del historial de prueba.

## 2026-10-13 (5) — Textos de la interfaz con tono de producto

- **David pidió:** que la interfaz no tenga textos que parezcan aclaraciones para él ni
  mencione la tesis: debe ser un sistema listo para producción.
- Quitados o reescritos: la nota al pie de Uso y costos (precio de lista, «Evaluación»
  de la tesis), la de Conexiones (explicación del pool), «Secret Manager» y «Gemini» en
  descripciones y pistas, «tal como los recibe el modelo» en Esquema, la explicación
  del dialecto al editar una conexión y el aviso largo del historial («Para modificar
  esta consulta, guárdela primero»). Filtros de Uso: «Usuarios / Pruebas automáticas /
  Todo»; «Costo total» → «Costo estimado». El aviso de costo al generar solo lo ve el
  técnico. Las explicaciones siguen en la documentación.
- **Verificado:** `test:ui` 23/23 + 27/27; `tsc` y `lint` limpios; grep sin «tesis»,
  «evaluación», «Gemini», «Vertex», «Secret Manager» ni «banco de pruebas» en textos de
  la interfaz.

## 2026-10-13 (4) — Edición del SQL por origen y auditoría de cambios

- **David decidió:** el técnico edita la sentencia al generarla y las consultas
  guardadas, **no** las del historial: para editar una del historial, primero la guarda
  (y ahí mismo queda editable). La auditoría de los cambios la ve solo el técnico.
- Backend: `sqlEditAudit.service.ts` (colección `sqlEdits`): sentencia original,
  editada, partes reemplazadas (comparación por palabras, LCS, sin dependencias nuevas;
  los cambios solo de espacios no cuentan), quién (correo), fecha y hora, base, origen y
  acciones (ejecutada / guardada). El id es un hash: la misma edición no se duplica.
  `/executeQuery` y `POST /savedQueries` aceptan `edit` { origin, originalSql |
  savedQueryId }; en una guardada el original lo toma el backend. Historial editado →
  409; no técnico que edita → 403. `PUT /savedQueries?id=` (técnico) reemplaza la
  sentencia; `GET /sqlEdits` (técnico) lista las últimas 100. El middleware guarda el
  correo del token.
- Frontend: la consulta en curso sabe su origen (generada / historial / guardada). Del
  historial se muestra sin editar, con el aviso; al guardarla pasa a guardada y es
  editable. Con una guardada editada: «Guardar cambios» y «Guardar como nueva». En
  Guardadas, el técnico ve «Reutilizar o editar». Pestaña «Cambios» en Historial
  (`SqlEditList`): «Reemplazó X por Y», quién, fecha y hora, base, origen, acciones y la
  sentencia completa marcada.
- Indicador de Next.js (la «N» flotante): movido abajo a la derecha
  (`devIndicators.position` en `next.config.ts`). Es la herramienta de desarrollo de
  Next.js: solo aparece con `npm run dev`, no la agregó el proyecto, no se puede
  traducir; a la izquierda tapaba el pie de la barra lateral y su menú no se abría bien.
- **Verificado:** `test:api` 38/38 + 23/23 + 32/32 + 25/25 (nueva: auditoría);
  `test:ui` 23/23 (general, reescrita con el flujo nuevo) + 27/27; `tsc` y `lint`
  limpios. Las pruebas borran sus registros de auditoría al terminar. Gasto en
  Gemini: $0.
- Tesis: 6.5 (párrafos de edición y auditoría, fila nueva en la Tabla 16,
  verificación 23/23 + 25/25) y 6.6 (reusar). Resumen: 24 pendientes.

## 2026-10-13 (3) — Nombre de conexión único

- **David pidió:** que no se puedan guardar dos conexiones con el mismo nombre. Las
  conexiones son compartidas (no por usuario), así que el nombre es único en todo el
  sistema.
- Ya se rechazaba (400) al crear y al editar, sin distinguir mayúsculas. Se agregó:
  espacios repetidos se reducen a uno (al guardar y al comparar), y el nombre se revisa
  **antes** de probar la conexión (antes, un nombre repetido con contraseña incorrecta
  daba 422 en vez de "Ya existe una conexión llamada…").
- **Error mío corregido:** el arreglo de `/testConnectionConfig` del commit `89e28ff`
  tenía un error de tipos que no se vio porque se compiló con `npm run build | tail -1`
  (el pipe ocultó el fallo de `tsc`; el JS se emitió igual y funcionaba). Ya compila
  limpio.
- **Verificado:** `test:api` 38/38 (5 casos nuevos: mayúsculas y espacios, aviso antes
  de probar, editar con el nombre de otra, conserva su nombre, espacios al guardar) +
  23/23 + 32/32; `test:ui` 13/13 + 27/27 (4 nuevos: crear y editar con nombre
  repetido); `test:seguridad` 57/57 + 200/200; `tsc` limpio.
- Tesis: 6.1 con el nombre único y las cifras 38/38 y 27/27 (misma entrada del
  resumen).

## 2026-10-13 (2) — Conexiones desde la interfaz y pruebas en el repo

- **David decidió:** lo que cuesta dinero (piloto, corrida completa y "Generar SQL"
  desde la interfaz) va al final; antes se termina todo lo demás.
- **David decidió:** dejar 6.1 "Verificación" como está ("cuentas con permisos
  exclusivamente de lectura"). Su criterio: los permisos amplios de `testuser` son del
  banco de pruebas, no del proyecto; en producción las cuentas serán de solo lectura,
  como capa extra.
- Frontend: pantalla Conexiones con formulario (`ConnectionForm`): nueva, probar,
  guardar, editar (motor bloqueado, contraseña vacía = se conserva) y eliminar. Lista
  con servidor y base, estado, latencia y pool por conexión. `useConnections`
  (contexto con la lista) y `ConnectionSelector` en lugar de `EngineSelector`:
  Consultar y Esquema eligen entre las conexiones registradas, con nombre y motor.
  Historial y guardadas muestran el nombre de la conexión (las entradas viejas, el
  motor). Las solicitudes mandan `connectionId`.
- Pruebas versionadas: `npm run test:api` (backend; pide los tokens solo y corre
  `scripts/pruebas/api_*.mjs`) y `npm run test:ui` (frontend; `scripts/pruebas/ui_*.mjs`
  con `playwright-core`, que no es dependencia: `npm install --no-save
  playwright-core@1.64.0`). Las contraseñas de los usuarios de prueba se leen de
  `NLQP_TEST_USER_PASSWORD` y `NLQP_USUARIO_PASSWORD` del `.env` del backend (agregadas
  hoy): el primer intento de commit se bloqueó porque estaban escritas en los scripts.
  Quedan escritas en archivos ya commiteados (ver "Abierto" en `CLAUDE.md`).
- **Verificado:** `test:api` 33/33 + 23/23 + 32/32; `test:ui` 13/13 (general) + 23/23
  (conexiones nuevas: alta con contraseña incorrecta rechazada, alta correcta, esquema
  de la nueva con 8 tablas, edición, baja, no técnico); `tsc` y `lint` limpios. Gasto
  en Gemini: $0.
- Tesis: `CAPITULO_6.md` 6.1 (formulario y 23/23), 6.4 (se elige la conexión, párrafo
  de alcance) y Tabla 16 (fila Conexiones). Las capturas de las Figuras 9 y 10 del
  10/10 ya no muestran la interfaz actual: retomarlas. Contador sin cambios (23).

## 2026-10-13 — Registro de conexiones (M1) documentado y verificado

- **Hallazgo de la revisión:** después del commit `a596cff` (10/10, 16:18) quedó sin
  commitear ni documentar un cambio del backend hecho esa misma tarde: el **registro de
  conexiones de M1**. La sesión se cortó antes de verificarlo y anotarlo.
- Qué es: las conexiones salen de Firestore (`connections/{id}`) y la contraseña de
  Secret Manager (`nlqp-conn-{id}`), ya no del `.env`. Pool por conexión (no por
  motor). `GET|POST|PUT|DELETE /connections` (lista para todos, sin datos de acceso
  para el no técnico; el resto, solo técnico, probando antes de guardar) y `POST
  /testConnectionConfig`. Historial y guardadas registran `connectionId` y
  `connectionName`. `engine` sigue como alias de `connectionId`, así que el runner de
  evaluación, Postman y el frontend funcionan sin cambios. `npm run seed:connections`
  ya se había corrido: 4 conexiones ("Tienda · Servidor A–D", ids `postgres`,
  `mysql`, `mariadb`, `mssql`) y 4 secretos (cuota gratuita: 6).
- Corregido hoy: (1) la pantalla Conexiones buscaba `engine` en el resultado de
  `/testConnection`, que ahora trae `connectionId`, y mostraba el estado vacío; (2)
  `/testConnectionConfig` exigía `name` aunque solo se prueban los datos.
- **David decidió:** quedarse con el backend nuevo (hace cierto lo que 6.1 ya afirmaba
  sobre Secret Manager); el formulario para crear y editar conexiones en la interfaz
  queda en "Abierto".
- **Verificado:** conexiones 33/33 (API), roles 23/23, M5 32/32 (cambia un caso:
  guardar con `engine: 'oracle'` ahora da 404, "la conexión no existe", en vez de
  400), interfaz 13/13 (las 12 del 10/10 + Conexiones con las 4 conectadas),
  `test:seguridad` 57/57 + 200/200, `tsc` y `lint` limpios. Gasto en Gemini: $0. Las
  pruebas siguen en el scratchpad (no versionadas).
- Docs: `SEGURIDAD.md` §13, `USO_Y_COSTOS.md` (Secret Manager), `MANUAL_POSTMAN.md`,
  `CAPITULO_6.md` 6.1 (la credencial queda en memoria mientras el pool está abierto;
  subsección "Registro de conexiones"; 33/33). Resumen: 23 pendientes.
- Plan: corte del 13/10 generado (plan 97 %, real 95 %, −2,1 puntos); reemplaza al
  del 10/10 que faltaba regenerar.
- Sigue: piloto con paráfrasis, a más tardar el 14/10 (~$0.50, con confirmación).

## 2026-10-10 (11) — M4 por roles y rediseño del frontend

- Commit `7d81e97` (M5 y documentación pendiente), sin push.
- **David decidió:** el frontend se hace "de verdad": diseño profesional, blanco con
  naranja claro, sin aspecto de hecho por IA, una pantalla por módulo. **M4 es lo que
  puede hacer el rol técnico**, y el pool de conexiones solo lo ve ese rol. Uso y costos
  también, solo para el técnico.
- Backend: rol como custom claim de Firebase (`role: 'tecnico'`; sin claim = no
  técnico). `requireTechnicalRole` (403) en `/testConnection`, `/getSchema`,
  `/getUsageStats` y `/poolStatus` (nuevo: abiertas, libres, en uso y en espera por
  motor, sin abrir conexiones). `npm run set:role -- <correo> <tecnico|no_tecnico>`.
  Usuarios de prueba: `nlqp-test@example.com` técnico, `nlqp-usuario@example.com`
  no técnico (contraseñas en `.env`; las de esta fecha se cambiaron el 18/10).
- Frontend: route group `(app)` con barra lateral según el rol; pantallas Consultar,
  Historial, Conexiones, Esquema y Uso y costos. Paleta blanca con neutros cálidos y
  acento naranja claro; IBM Plex Sans y Mono servidas por `next/font`. Técnico: SQL
  editable (marcado "Editada"; si el backend la rechaza queda "Bloqueada" con el
  motivo) y consumo de la generación. No técnico: SQL plegado, solo lectura. La
  consulta en curso se conserva al cambiar de pantalla. Login y registro con errores de
  Firebase traducidos.
- **Verificado:** roles 23/23 (API, ambos roles, 401/403/200, aislamiento del
  historial, pool coherente); M5 sigue 32/32; interfaz 12/12 (edición, bloqueo de
  `DELETE` editado, guardar/reutilizar/eliminar, rutas técnicas restringidas al no
  técnico) y capturas de las 8 pantallas sin errores de consola; `test:seguridad`
  57/57 + 200/200; `tsc`, `lint`, `build` limpios. Gasto en Gemini: $0 (las pruebas
  abortaban si se pedía `/generateSQL`).
- Riesgo aceptado, documentado en `SEGURIDAD.md` §12: un no técnico puede mandar SQL
  propio a `/executeQuery` con su token (lo sigue validando el Query Safety Engine).
- Tesis: `CAPITULO_6.md` con 6.4 reescrita, 6.5 Módulo 4 nueva, integración renumerada
  a 6.7 (tablas 14–20, figuras 9–11). Resumen: 22 pendientes. Capturas para las
  figuras en `Claude outputs/capturas 10-10-2026/` (tienen datos de prueba; conviene
  retomarlas con preguntas reales después del piloto).
- Plan: M4 90 %, frontend 95 %. El corte del 10/10 sigue sin regenerar (Excel abierto).

## 2026-10-10 (10) — M5 historial y consultas guardadas (versión mínima)

- **David decidió:** lo que cuesta dinero va al final, con fecha límite: piloto a más
  tardar el 14/10 (recomendado el 13/10), corrida completa a más tardar el 15/10, cifras
  en la tesis el 16/10. M5 pasa a ser el siguiente.
- **David decidió:** historial y consultas guardadas son cosas distintas: el historial
  es automático, guardar es siempre manual.
- Backend: `queryHistory.service.ts` + `functions/queryHistory.ts`. Firestore por
  usuario: `users/{uid}/history` (lo escribe `/executeQuery` con éxito o error; no lo
  bloqueado ni lo marcado `X-NLQP-Origin: evaluacion`) y `users/{uid}/saved`.
  Endpoints: `GET /history` (últimas 50), `GET|POST|DELETE /savedQueries`
  (`DELETE ?id=`). `/executeQuery` acepta `question` opcional. Al guardar se valida el
  SQL con el Query Safety Engine; al ejecutar se vuelve a validar como siempre.
- Frontend: `HistoryPanel` (pestañas Historial / Guardadas; Reusar, Guardar, Borrar) y
  `SaveQueryButton` (nombre en línea). Reusar remonta el formulario con la consulta, sin
  llamar a Gemini.
- **Verificado:** API 32/32 (4 motores, errores, bloqueadas y evaluación fuera del
  historial, validaciones 400/403/404/405, 401 sin token); interfaz 10/10 con Chromium
  automatizado (la prueba abortaba si se pedía `/generateSQL`); `npm run test:seguridad`
  57/57 + 200/200; frontend `tsc`, `lint` y `build` sin errores. Gasto en Gemini: $0.
  Quedan unas 8 entradas de prueba en el historial del usuario de prueba.
- Tesis: borrador de **6.6 Módulo 5** en `CAPITULO_6.md` (Tabla 19, Figura 10 pendiente)
  y corrección del alcance de 6.4; 2 entradas nuevas en el resumen (19 pendientes).
- Plan: tarea 33 (M5) con real 90 %. El corte del 10/10 **no se regeneró**: el Excel
  del corte estaba abierto. Hay que cerrarlo y correr `generar_corte.py 2026-10-10`.
- Sigue: piloto con paráfrasis (≈ $0.50, con confirmación), recomendado el 13/10.

## 2026-10-10 (9) — Plan: filas en orden de fecha

- David: en el plan una fila no puede ir antes que otra con fecha anterior. Las filas
  nuevas se habían puesto junto a su tarea relacionada (p. ej. la 44, del 09/10, quedaba
  antes de la 28, del 24/09).
- `generar_corte.py` ordena las filas dentro de cada grupo por fecha de inicio (con el
  mismo inicio, primero la tarea sin subtareas; después fecha de fin y número). No
  cambia fechas ni números de tarea.
- Las tareas 42, 43 y 44 (08–09/10) pasan de "Módulo 3" a ser tareas directas del Cap. 6:
  dentro de Módulo 3 quedaban antes de Frontend (21/09) y del Módulo 4 (05/10). Ahora
  todo el plan va en orden de inicio de arriba abajo.
- Corte 10/10 regenerado: proyecto sin cambios (plan 96 %, real 91 %, −4,6); Módulo 3
  pasa a 96 % de real porque ya no incluye esas tres. Sin commit.

## 2026-10-10 (8) — Word, segunda versión: sin marcadores, referencias enlazadas, 6.3.2 y 6.3.4

- Pedido de David: referencias a secciones con vínculo, nada pendiente en el Word y
  aplicar los cambios del proyecto que faltaban (mencionó que Vertex AI ya no se usa).
- **Verificado en el código:** Vertex AI **sí** se sigue usando (`vertexAI.service.ts`:
  `new GoogleGenAI({ vertexai: true, project, location })`, Gemini 2.5 Pro). Lo que ya no
  se usa es el SDK `@google-cloud/vertexai` (migrado a `@google/genai` el 09/10). El Word
  se corrigió en ese sentido (2.5 y 6.3.2); si David cambia de proveedor, hay que
  rehacer 6.3.2, 2.5, RF-06, actores y costos.
- Word (`PG2-2026 capítulo 6 revisado 10-10-2026.docx`, mismo nombre): quitados los
  marcadores de 6.3.6, 6.5 y 6.6; integración renumerada a 6.5 (6.5.1–6.5.3); 6.3.2
  actualizada (SDK, prompt de seis partes con valores de CHECK, marcas de índice, reglas
  de dominio y de rendimiento, razonamiento 1024 / salida 4096 con error ante corte,
  llamada real del 09/10: $0.01188, 14,5 s); 6.3.4 con la comparación por contenido y
  las dos revisiones de las referencias (cancelados; empates, días, `LIMIT`, zona
  horaria); 6.3.1 con el dato de paráfrasis (2 de 50) en vez de remitir a 6.3.6; 2.9
  describe la poda real; RNF-13 remite a 6.3.2.
- 44 referencias nuevas como hipervínculo al título (como las del original) y las
  existentes reapuntadas; índices general, de tablas y de figuras regenerados con
  páginas del render (Word los vuelve a actualizar al abrir). Validado; ningún párrafo
  pasa de 12 líneas; capítulos en página impar (Cap. 6: 21 páginas).
- `CAPITULO_6.md` y `RESUMEN_PARA_DOC_TEORICO.md` sincronizados (17 pendientes, 1 por
  verificar, 54 aplicados). Sin commit, por pedido de David.

## 2026-10-10 (7) — Plan de trabajo: corte 10/10 actualizado

- Corte 10/10 regenerado con `generar_corte.py` (sin cambiar fechas del plan base):
  tarea 39 (correcciones de figuras, rótulos y numeración del Cap. 5) pasa a 100 %;
  tarea 37 (conclusiones y revisión final del documento) a 30 %, antes de su fecha, por
  la revisión del documento hecha hoy. Proyecto: plan 96 %, real 91 %, **−4,6 puntos**
  (antes −6,4). Lo que sigue pesando: M4 y M5 sin empezar, pruebas de generación 70 %,
  frontend 85 %.
- Excel en `Claude outputs/Plan_de_Trabajo_PG2 10-10-2026.xlsx` (sobrescribe el del
  mismo corte). Sin commit, por pedido de David.

## 2026-10-10 (6) — Word revisado con control de cambios

- David pasó el .docx actual (`PG2-2026 capítulo 6.3.5 agregado 02-10-2026`) y pidió
  aplicar todo con el formato exacto del documento y sus reglas (interlineado 1.5,
  espaciado 2 pt, títulos de nivel 3+ con sangría, capítulos en página impar, máximo 12
  líneas por párrafo, mínimo 12 páginas por capítulo, APA 7). Claude entregó `PG2-2026
  capítulo 6 revisado 10-10-2026.docx` con **control de cambios** (autor "Claude"): 267
  inserciones, 172 eliminaciones, 31 cambios de formato y 3 comentarios. Validado con el
  esquema de Word (sin errores) y revisado en PDF.
- Aplicadas todas las entradas de `RESUMEN_PARA_DOC_TEORICO.md` que no dependen de la
  corrida ni están en espera. 6.3.2 y 6.3.4 solo recibieron la referencia 6.5 → 6.7.1 y
  el reordenamiento, sin tocar su contenido.
- Hallazgos de formato al revisar el .docx: las leyendas del Cap. 6 tenían el número
  escrito a mano y la numeración automática apagada (por eso salían mal en los índices);
  6.3.5 no tenía estilo de título; la tabla de hallazgos era flotante; RF-05, RNF-02 y
  RNF-11 tenían asteriscos de markdown sueltos. Corregido.
- Estructura final del Cap. 6 en el Word: 6.3.3.1 y 6.3.3.2 (títulos de nivel 4), 6.3.6
  (marcador), 6.5 y 6.6 (marcadores), 6.7 con 6.7.1 Registro de uso y costos, 6.7.2
  Revisión de seguridad y 6.7.3 Tiempos de ejecución. `CAPITULO_6.md` actualizado con
  esa numeración. Tablas del Cap. 6: 14 a 18.
- Páginas por capítulo (render con LibreOffice, puede variar ±1 en Word): Cap. 1: 20,
  Cap. 2: 28, Cap. 3: 20, Cap. 4: 14, Cap. 5: 12, Cap. 6: 20. Todos empiezan en página
  impar. Cap. 4 y 5 cumplen el mínimo pero no el ideal de 15.
- Quedan 3 comentarios en el Word para David (equipo de 3.8, referencia sugerida de
  Spider 2.0, recálculo de 1.6.3) y marcadores amarillos en 6.3.6, 6.5 y 6.6. Sin
  commit, por pedido de David.
- Corrección del mismo día: David no quiere el control de cambios (tachados y colores)
  ni comentarios; no es parte del formato. Se reemplazó por una **versión limpia** con
  los cambios ya incorporados, sin comentarios y sin resaltado (mismo nombre de
  archivo). Validada y revisada en PDF; el texto del cuerpo coincide con la versión
  aceptada. Referencia APA 7 sugerida para Spider 2.0 (no aplicada): Lei, F., Chen, J.,
  Ye, Y., Cao, R., Shin, D., Su, H., Suo, Z., Gao, H., Hu, W., Yin, P., Zhong, V.,
  Xiong, C., Sun, R., Liu, Q., Wang, S., & Yu, T. (2025). Spider 2.0: Evaluating
  language models on real-world enterprise text-to-SQL workflows. En International
  Conference on Learning Representations (ICLR 2025).
  https://proceedings.iclr.cc/paper_files/paper/2025/file/46c10f6c8ea5aa6f267bcdabcb123f97-Paper-Conference.pdf

## 2026-10-10 (5) — Decisiones sobre el texto de tesis

- David pidió que Claude tomara las decisiones pendientes del texto de tesis. Quedaron
  registradas como **Decisión (10/10)** en `RESUMEN_PARA_DOC_TEORICO.md`, con el motivo.
  Las principales: eliminar la "Tabla 10." vacía del Cap. 3 (las referencias de 4.3.5 ya
  contaban sin ella; las tablas del Cap. 6 pasan a 14–18); Spider 2.0 con los datos de
  la versión publicada (arXiv v2: >1,000 columnas, o1-preview 21.3 % frente a 91.2 % en
  Spider 1.0); agregar RF-14 de autenticación y dejar RF-12; agregar el motor de base de
  datos como actor secundario en 4.2; no redibujar las Figuras 2 y 5 y aclarar el texto
  (caché como mejora futura, Figura 5 ilustrativa); eliminar el párrafo del segundo
  escenario de 5.1.3; no cambiar el umbral de 15 s; recalcular 1.6.3 una sola vez con el
  costo promedio de la corrida completa (si el 13/10 no hay corrida, con $0.012); 3.8
  con los datos de la Tabla 8 (David confirma el equipo); perfiles de usuario como
  limitación; reordenar 6.7 ya.
- `CAPITULO_6.md`: 6.3.1 reescrita (poda nueva, hallazgo de "clientes", 72 % / 43,4 %);
  hallazgos 9 a 11 agregados a la tabla de seguridad con sus párrafos; tablas
  renumeradas a 14–18. 6.3.3 verificada sin cambios.
- El contenido nuevo del prompt se movió de 6.3.1 a 6.3.2 (en espera), para no describir
  el prompt en dos lugares. La entrada "descripción de la poda en el Cap. 5" se cerró:
  verificado que el Cap. 5 no la describe.
- Contador: 53 pendientes, 0 por verificar, 10 aplicados. Sin commit, por pedido de
  David.

## 2026-10-10 (4) — Texto de tesis sincronizado con el Word

- Lo redactado en el chat de Cowork (25/09 y 02/10) no estaba en el repo. Se verificó
  qué tiene el Word contra el PDF que pasó David (128 páginas): están 6.3.1, 6.3.2, 6.4
  (con la captura como Figura 9), "Registro de uso y costos" como 6.5 e "Integración"
  como 6.6, versión del 25/09; 6.3.5 pegada el 02/10; tablas del texto renumeradas a
  17–19.
- Lo que el Word **no** tiene o tiene mal: el segundo párrafo de la introducción sigue
  sin reemplazar; 6.3.3 tiene solo tres párrafos de la versión de 17 casos (falta el
  hallazgo de Transact-SQL); **6.3.5 quedó pegada en medio de 6.3.4**, así que la tabla
  de ejecución controlada es la 16 y la de verificación la 15; 6.3.5 todavía dice "60
  segundos" y le falta el párrafo de limitación; 6.4 no tiene las correcciones del 25/09
  ni las del 02/10; los índices están desactualizados y los títulos de tablas salen en
  el índice general.
- `CAPITULO_6.md` reescrito con la estructura acordada: 6.3.5 control de tiempo, 6.3.6
  evaluación con Gemini, 6.5 M4, 6.6 M5, 6.7 integración con "Registro de uso y costos"
  como primera subsección. Tablas 15 a 19. 6.1, 6.2 y 6.3.3 copiadas sin cambios
  (verificado con diff); 6.4 sin rótulos en cursiva, como en el Word.
- `RESUMEN_PARA_DOC_TEORICO.md`: rehecho contra el PDF. Agregadas las observaciones de
  la revisión del documento del 25/09 (caps. 1 a 5), todas confirmadas como pendientes
  en el PDF salvo 4.4 y "modelo de organización" (`[?]`); la entrada de requisitos no
  funcionales ya no menciona el valor del tope de tiempo (decisión de David, 02/10);
  6.3.2 y 6.3.4 quedan **en espera** por pedido de David (03/10). Contador: 52
  pendientes, 2 por verificar, 9 aplicados.
- Dato nuevo para 1.6.3: el costo medido (~$0.012 por consulta) es ~40 % mayor que el
  que supone la Tabla 4 (~$0.0087); con el escenario de 35 usuarios serían ~$125 al mes.
- Sin commit, por pedido de David.

## 2026-10-10 (3) — Plan de trabajo con cortes por fecha

- David: el plan base **no se cambia** (aunque las fechas no coincidan, es lo que
  muestra si vamos adelantados o atrasados); lo nuevo entra como **fila nueva
  resaltada**; un Excel por fecha de corte, mismo formato. Revertido el calendario
  nuevo que se había puesto en `PLAN_DE_TRABAJO.md`.
- `nlqp/docs/plan/`: `plantilla_plan_PG2.xlsx` (copia del plan del 02/10, fuente
  del formato), `plan.json` (línea base + avance), `generar_corte.py` (solo
  biblioteca estándar) y `cortes/AAAA-MM-DD.json`. Verificado: regenerar el corte
  02/10 da **0 diferencias** con el Excel original en las 40 tareas; el del 10/10
  abre en Excel sin reparación, recalcula igual, 16 comentarios, filas nuevas en azul.
- **Corte 10/10:** plan 96 %, real 90 %, **−6,4 puntos (atrasados)**. Pesa: M4 y M5
  sin empezar, figuras del Cap. 5, frontend 85 %, pruebas de generación 70 %
  (criterio de Claude a pedido de David: falta la corrida y el análisis).
- Filas nuevas (implementadas): 41 uso y costos (21/09), 42 endurecimiento del Query
  Safety Engine (08/10), 43 migración del SDK (09/10), 44 rediseño de la poda
  (09/10); la 40 (control de tiempo e integridad, del 02/10) ahora también resaltada.
- El archivo que subió David como "16/02/2026" no existe: el subido es idéntico
  byte por byte al del 02/10.

## 2026-10-10 (2) — Orden de la documentación

- Pedido de David: que cada sesión arranque sabiendo de qué va el proyecto, cómo está
  y qué sigue, sin desviarse, y que lo que afecta a la tesis quede en un documento
  aparte para saber qué modificar en el documento principal.
- `CLAUDE.md` reescrito como **tablero**: qué es, calendario, estado por área,
  próximo paso (lo terminado se borra y queda acá), protocolo de sesión (inicio,
  durante —no desviarse, proponer antes de algo grande, confirmar gastos— y cierre
  en 4 pasos), mapa de documentos, reglas.
- Nuevo `RESUMEN_PARA_DOC_TEORICO.md`: lista de trabajo para el Word por capítulo y
  sección, con casillas `[ ]`/`[x]`/`[?]` y contador. Arranca con 25 pendientes y 4
  por verificar, juntando lo que estaba disperso.
- `CAPITULO_6_Y_PLAN.md` → `CAPITULO_6.md` (solo texto de tesis); la Parte 2 (plan
  del 19/09), los resultados del 21/09 y el runner viejo → `docs/historico/`.
- `PLAN_DE_TRABAJO.md` reescrito: solo plan hasta el 17/10 y riesgos (sin estado).
- `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` marcado como histórico.
- Postman: la colección no mandaba el token (todo daba 401 desde el 21/09); ahora
  manda `Bearer {{idToken}}` y el manual explica `npm run test:token`.
- `frontend/README.md` en español (era el de plantilla de Next.js).

## 2026-10-10 — Runner de la evaluación con Gemini (sin costo de Vertex AI)

- David eligió: runner por **HTTP como el frontend** (opción a) y **con
  paráfrasis**. Aclarado: el costo por consulta no cambia (~$0.012); cambia el
  total (200 → 400 llamadas, ~$2.40 → ~$4.75).
- `scripts/evaluacion_gemini.mjs` (`npm run eval:gemini`): modos prueba (gratis) /
  piloto / completa, guardado incremental sin repetir llamadas pagadas, renovación
  de token, reintentos ante 429, comparación por contenido, antipatrones, resumen.
  Modo prueba: 400/400.
- Uso y costos: eventos con `origin` (`usuario`/`evaluacion`); `getUsageStats`
  excluye las evaluaciones por defecto.
- **Bug del sistema corregido:** fechas distintas según el motor (mysql2 leía
  `DATETIME` y pg leía `DATE` en hora local, corridos 6 h). Ahora idénticas en los 4.
- **Referencias corregidas:** C10 tenía `LIMIT 10` no pedido (recortaba 20 → 10);
  M19, C02, C04, C07 con empates no deterministas (desempate por id); M20 con días
  fraccionarios en Postgres vs. calendario en el resto. El "0 inconsistencias"
  anterior comparaba solo número de filas; ahora la regresión compara contenido:
  57/57 + 200/200, 50/50 idénticas en los 4 motores.
- `parafrasis_50.json`: **aprobadas por David** sin cambios. Medición
  gratis: la poda pierde tablas en 2/50 paráfrasis (M17, C08); no se ajustan los
  sinónimos (sería ajustar con el examen).
- Siguiente: piloto (~$0.25) → corrida completa con paráfrasis (~$4.75).

## 2026-10-09 (3) — Referencias S10 y M13 eficientes

- S10 y M13 (`consultas_prueba_50.json`) filtran por rango de fechas en vez de
  `EXTRACT`/`YEAR` sobre `order_date` (que impedía usar el índice). Resultados
  idénticos al SQL anterior en los 4 motores. Barrido de antipatrones en las 50:
  nada más que corregir. Regresión 57/57 y 200/200.
- Siguiente: runner nuevo de la corrida con Gemini.

## 2026-10-09 (2) — Poda de esquema rediseñada

- `schemaPruning.service.ts`: núcleo = tablas nombradas + tablas con columna
  distintiva (término en 1–2 tablas); conexión por camino más corto de FKs en vez
  de expandir un salto alrededor de todo. Opción (b) elegida por David.
- Bugs corregidos: "clientes" nunca coincidía (singularizado a "client") y
  "categories" quedaba en "categori". La poda vieja perdía `customers` en C07 y C09.
- Verificado gratis: 0/50 consultas con tablas faltantes; 5,56 → 2,18 tablas
  promedio; `countTokens` en las 50: 1238 → 701 tokens, **43,4 %** de reducción del
  prompt (~72 % sobre la parte de esquema).
- Limitación: sinónimos ajustados con las 50 preguntas; generalización a probar
  con paráfrasis.

## 2026-10-09 — Migración a `@google/genai`

- `vertexAI.service.ts` migrado de `@google-cloud/vertexai` (deprecado) a
  `@google/genai` en modo Vertex AI, versión fijada **2.24.0** (publicada 22/09; la
  2.28.0 tenía un día). Misma configuración: temperatura 0, razonamiento 1024,
  salida 4096, error explícito ante `MAX_TOKENS`. SDK viejo desinstalado.
- Verificado gratis con `countTokens` (493 tokens) y con **una llamada real
  autorizada por David**: S10 en Postgres → `SELECT COUNT(*) FROM orders WHERE
  order_date >= '2025-01-01' AND order_date < '2026-01-01'` (usa rango, como pide la
  regla de rendimiento), aprobada por el Query Safety Engine, 104 = referencia.
  Tokens 1208 / 39 / 998 de razonamiento; **$0.01188**; 14,5 s.
- Hallazgo: la poda envió 7 de 8 tablas para una pregunta de una sola tabla
  (expansión por FK a un salto). Decisión pendiente (PREPARACION §8, 2f).

## 2026-10-08 (2) — Query Safety Engine endurecido

- `querySafety.service.ts`: el contenido de los literales entre comillas simples ya
  no se inspecciona (corrige falsos positivos, SEGURIDAD §9), con modo estricto ante
  `\`, `$`, `[` o literal sin cerrar, y seguimiento de comillas dobles/backticks
  para que no se pueda desincronizar. Nueva lista de funciones prohibidas (archivos,
  SQL como texto, estado, bloqueos, demoras, §10). Palabras clave `OPENDATASOURCE`,
  `WAITFOR`. Opción (b) elegida por David.
- Batería versionada: `nlqp/backend/scripts/regresion_seguridad.mjs`,
  `npm run test:seguridad` (§11). **57/57** (44 bloqueos + 13 legítimas) y **50
  consultas 200/200, 0 inconsistencias**.
- Texto de tesis: 6.3.3 reescrito (batería de 57 casos, sin la afirmación falsa
  sobre literales, subsección nueva "Segunda revisión").
- Siguiente: corrida con Gemini, empezando por la migración a `@google/genai`.

## 2026-10-08 — Revisión completa del estado (sin costo de Vertex AI)

- **Verificado:** backend y frontend compilan sin errores (`tsc --noEmit`). Banco
  Docker levantado, los 4 motores *healthy*.
- **Verificado:** las 50 consultas de referencia, **con las 5 corregidas el 02/10**,
  pasadas por el Query Safety Engine y ejecutadas en los 4 motores: **200/200 OK,
  0 inconsistencias entre motores**. Cierra el riesgo "volver a verificar las
  referencias corregidas". Se ejecutó llamando directo a `validateQuerySafety()` +
  `runQuery()` (sin pasar por HTTP ni Firebase).
- **Hallazgo (SEGURIDAD.md §9):** el validador bloquea palabras reservadas y `;`
  **dentro de literales de texto** (`WHERE name = 'Update Corp'` → bloqueada).
  El texto de 6.3.3 (`CAPITULO_6_Y_PLAN.md`) afirma lo contrario → corregir el
  texto o el validador. No afecta la corrida con Gemini (ningún valor de `CHECK`
  ni ninguna de las 50 consultas cae en esto).
- **Hallazgo (SEGURIDAD.md §10):** el validador **no** bloquea funciones de lectura
  de archivos (`pg_read_file`, `LOAD_FILE`, …). No explotable hoy: Postgres responde
  `permission denied`, MySQL/MariaDB devuelven `NULL` (`secure_file_priv`
  restringido), `testuser` no es superusuario ni `sysadmin`. Pero 6.3.3 dice que el
  validador los bloquea; hoy los frenan los permisos del motor.
- **Hallazgo:** la batería de 17 casos de seguridad **no está en el repo**, solo
  descrita en texto. Se reconstruyó una de 22 casos (19 deben bloquearse, 3
  legítimos) en un script temporal: resultado 19/22 (fallan los dos de lectura de
  archivos y el de `;` dentro de literal). Pendiente guardarla en el repo.
- **Verificado (búsqueda web):** la página oficial de Vertex AI da **20/10/2026**
  como fecha más temprana de retiro de `gemini-2.5-pro` (el 16/10 que se citaba
  corresponde a la Gemini API, que es otro producto). Sigue siendo provisoria.
- **Detectado contra el Excel del plan (`Claude outputs/Plan_de_Trabajo_PG2
  02-10-2026.xlsx`):** Módulo 4 (herramientas técnicas, plan 05–07/10) atrasado y
  sin empezar; Módulo 5 (historial) planificado 08–09/10; correcciones de figuras
  del Cap. 5 (plan 28–29/09) en 0 %. Integración 12–13/10, **presentación 14/10**,
  conclusiones 15–16/10, **entrega PG2 17/10**.
- **Docs actualizados:** CLAUDE.md (estado + próximo paso), PLAN_DE_TRABAJO.md,
  PREPARACION_EVALUACION_GEMINI.md §8, SEGURIDAD.md §9–10, CAPITULO_6_Y_PLAN.md
  (avisos de corrección), esta bitácora.

## 2026-10-02

- Rendimiento e integridad de resultados: timeout de 60 s dentro del motor en los
  4, ejecución única con snapshot, `/getResultPage`, CSV completo
  (`RENDIMIENTO_E_INTEGRIDAD.md`). Verificado en los 4 motores y en navegador.
- Seguridad: corregida la caída del backend ante resultados demasiado grandes
  (SEGURIDAD.md §7); endpoint CSV autorizado por token de un solo uso (§8).
- Preparación de la corrida con Gemini (`PREPARACION_EVALUACION_GEMINI.md`):
  valores de `CHECK`, reglas de dominio, índices y reglas de rendimiento en el
  prompt; `/generateSQL` devuelve `metrics`.
- Corregidas 5 referencias inconsistentes con los pedidos cancelados (M03, M07,
  M12, M13, C11).
- Requisito nuevo de David: el SQL generado debe ser correcto **y eficiente** con
  muchos datos.
- Riesgos detectados: SDK `@google-cloud/vertexai` deprecado; retiro de
  `gemini-2.5-pro` en octubre.
- Frontend: verificados "Ejecutar", paginación y CSV en navegador real.

## 2026-10-01

- Presupuesto de razonamiento de Gemini separado y contabilizado en el costo
  (hasta ~$0.011 por llamada).
- Decisión: la tesis se presenta **en local**, no se despliega. Acceso remoto al
  banco documentado, no implementado (`ACCESO_REMOTO.md`).

## 2026-09-21

- Proyecto GCP + Firebase unificado `proyectog-340d3`: Vertex AI, Authentication y
  Firestore habilitados. Primera llamada real a Gemini verificada.
- Módulo de uso y costos (backend, `USO_Y_COSTOS.md`).
- Frontend Next.js v1: login/registro y flujo principal, verificado con navegador.
- Repo publicado en GitHub (`08DOMS97/nl-query-platform`, `main`).

## 2026-09-19

- Texto del Capítulo 6 (6.1, 6.2, parte de 6.3 y 6.7) redactado en
  `CAPITULO_6_Y_PLAN.md`.

## 2026-09-17

- Construcción inicial del backend: módulos 1, 2, 3, 5 y 6 verificados en los 4
  motores. 50 consultas de referencia: 200/200.
- Revisión de seguridad (`SEGURIDAD.md` §1–6): corregido el bypass del Query Safety
  Engine en SQL Server (sentencias apiladas sin `;`), el bypass de auth
  "fail-open" y `trustServerCertificate` fijo.
