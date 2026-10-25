# Auditoría del 23–24/10/2026

Pedido de David: una auditoría a fondo del sistema, corregir lo que se pueda sin
riesgo y sin costo, y documentar todo. Se revisaron:
- la generación (`/generateSQL`);
- la ejecución y la integridad de los valores en los 4 motores;
- la robustez del servidor;
- la pantalla Consultar;
- uso y costos y el runner de la evaluación;
- conexiones, usuarios y despliegue.

La revisión del **Query Safety Engine** quedó cortada y **está pendiente**. La batería de
seguridad sigue en verde (57/57 + 200/200), pero no hubo una revisión nueva del validador.

Sin gasto en GCP. Todas las correcciones tienen pruebas y un commit propio. El 24/10
también se empaquetó NLQP en Docker (`DOCKER.md`).

**Resultados al cierre (24/10):**
- API **275/275**: 64 · 23 · 33 · 25 · 50 · 47 · 14 · 19.
- Interfaz **102/102**: 24 · 33 · 27 · 18.
- Seguridad **57/57 + 200/200**.
- Evaluación en modo prueba **200/200**.

Las tres primeras se corrieron también contra los contenedores de Docker.

Estados: **Corregido** · **Pendiente (David)**, porque cambia el prompt, la metodología o
la configuración, o agrega una función · **Aceptado**: riesgo conocido, con el motivo.

## 1. Generación (`/generateSQL`)

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| G1 | Si la «pregunta» ya era SQL (caso de David, 24/10: `SELECT TOP 10…` en MySQL), se pagaba una traducción. | Media | **Corregido** (ec7948c): 422 `nlqp/sql-input` antes del modelo, para todos los roles. 0 de las 100 preguntas del corpus (50 + 50 paráfrasis) se toman por SQL. |
| G2 | Un LIMIT/TOP/FETCH que la pregunta no pide entregaba un resultado parcial que se veía completo. | Alta | **Corregido** (ec7948c): 422 `nlqp/unrequested-row-limit` con aviso, sin tocar el SQL. Las 22 preguntas del corpus que piden un límite pasan. **Falta verificarlo con Gemini real (~$0.002).** |
| G3 | Sin largo máximo de la pregunta. | Baja | **Corregido**: 1000 caracteres (400). |
| G4 | MAX_TOKENS o respuesta sin texto se registraban con costo 0, aunque se facturan. | Media | **Corregido** (018565b): `GenerationFailedError` lleva los tokens y el evento registra el costo. |
| G5 | El 500 mostraba al no técnico errores crudos de Vertex AI, del motor o de Secret Manager. | Baja | **Corregido**: el detalle solo lo ve el técnico. |
| G6 | La poda de esquema pierde tablas con algunos verbos conjugados (paráfrasis de M17: solo manda `orders`; «compraron», «vendieron», «sin pagar»). | Media | **Pendiente (David)**. No se ajusta el diccionario: las paráfrasis se escribieron sin ajustarlo a propósito (`parafrasis_50.json`). Se puede medir gratis la cobertura de tablas. |
| G7 | Prompt: «el que más» con LIMIT 1 pierde empates. Las reglas de dominio de e-commerce se aplican a toda conexión. «Nunca SELECT *» recorta «todos los datos». La pregunta va sin delimitar (inyección de instrucciones). No exige alias únicos. «hola» manda el esquema completo. | Media | **Pendiente (David)**: cambia el prompt y, por lo tanto, la medición. |
| G8 | Sin límite de llamadas ni de gasto por usuario (429), ni timeout en `generateContent`. | Media | **Pendiente (David)**: función nueva. |
| G9 | Tope de 20 tablas en la poda. | Baja | **Pendiente (David)**. |

## 2. Ejecución e integridad de los valores

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| E1 | Dos columnas con el mismo nombre (o sin nombre en SQL Server) mostraban un valor en lugar de otro. | Alta | **Corregido** (639614c): 422 con aviso en los 4 motores. |
| E2 | `TIMESTAMP` de Postgres corrido +6 h. | Alta | **Corregido**: se lee como UTC. `infinity` queda como texto. |
| E3 | BIGINT de MySQL/MariaDB de más de 2^53 llegaba alterado. | Media | **Corregido**: `supportBigNumbers`. |
| E4 | Si fallaba el `SET SESSION` del tope de tiempo de MySQL/MariaDB, la conexión quedaba sin tope (y el error, sin manejar). | Alta | **Corregido**: la conexión se descarta. |
| E5 | Postgres: si pg-cursor (campo privado) no daba las columnas, se entregaban filas vacías. | Baja | **Corregido** (634fde1): error explícito. |
| E6 | SQL Server DECIMAL/MONEY pierde precisión (12.50 → 12.5; DECIMAL(38,2) redondeado). | Media | **Pendiente (David)**: implica tocar el driver. |
| E7 | MySQL: las fechas cero llegan como NULL; el TIMESTAMP depende de la `time_zone` de la sesión. | Baja | **Pendiente (David)**. |
| E8 | CSV: un valor que empieza con `=` se abre en Excel como fórmula. NULL y cadena vacía se exportan igual. | Media | **Corregido** (24/10, a pedido de David): la descarga es un Excel (.xlsx) y el texto se guarda como texto, así que `=1+1` no se vuelve fórmula (`api_exportacion.mjs`, 4 motores). NULL y la cadena vacía siguen viéndose iguales (celda vacía). Solo si un valor supera los 32 767 caracteres de una celda la descarga sale como CSV, que conserva el riesgo. `RENDIMIENTO_E_INTEGRIDAD.md` §4.1. |
| E9 | No se cancela la consulta al cerrar la página. El plazo se calcula antes de `getConnection`. | Baja | **Pendiente (David)**. |

## 3. Robustez del servidor

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| R1 | `/executeQuery` con `sql: 1` tumbaba el proceso: cualquier cuenta podía apagar el backend. | Alta | **Corregido** (ec7948c): validación de tipos y `wrap()` en los 16 handlers async. |
| R2 | JSON malformado o cuerpo de más de 100 kB respondían HTML con el stack trace. | Media | **Corregido**: errores JSON (400 / 413 / 500 genérico). |
| R3 | El 401 incluía el detalle interno de la verificación del token. | Baja | **Corregido**: se registra en el log, no se responde. |
| R4 | Sin topes de largo para `question`/`sql` del historial y las guardadas. | Baja | **Aceptado**: el cuerpo ya está limitado a 100 kB y Firestore admite 1 MiB por documento. |

## 4. Pantalla Consultar (frontend)

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| F1 | Un resultado viejo aparecía bajo una sentencia nueva (una respuesta lenta llegaba después de otra acción). | Alta | **Corregido** (a46e398): número de corrida en `QueryDraftProvider`; una respuesta vieja se descarta. |
| F2 | Salir de Consultar mientras se generaba y volver permitía pagar otra generación. | Alta | **Corregido**: el estado «generando» vive en el provider. |
| F3 | Un error al ejecutar dejaba visible el resultado anterior. | Media | **Corregido**: el resultado se quita al empezar. |
| F4 | Cambiar de conexión no descartaba la sentencia de la anterior. «Generar SQL» seguía habilitado mientras se ejecutaba. | Media | **Corregido**. |
| F5 | Sin red, se mostraba «Failed to fetch». | Baja | **Corregido**: «No hay conexión con el servidor…» en todas las pantallas (`api.ts`). |
| F6 | Objetos, JSON y Buffer salían como `[object Object]`. Los espacios repetidos se colapsaban. | Baja | **Corregido**. |
| F7 | «Guardada» no llegaba a verse. Notice de error sin `role="alert"`. Textos del backend en tú. «Query Safety Engine» a la vista del no técnico. | Baja | **Corregido**. |
| F8 | Esquema sin «Reintentar». Carrera de `useAuth` al cerrar sesión con `/me` en curso. | Baja | **Corregido** (634fde1). |

Prueba nueva `ui_consultar` 18/18. No cuesta nada: `/generateSQL` se responde en el
navegador, tanto en `:8080` como en `/api`.

## 5. Uso y costos y runner de la evaluación

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| U1 | `X-NLQP-Origin: evaluacion` se aceptaba de cualquiera: cualquier usuario podía sacar su consumo de «Uso y costos» y del historial. | Media | **Corregido** (018565b): solo el rol técnico (el runner usa la cuenta técnica de las pruebas). |
| U2 | El runner contaba como $0 un rechazo ya cobrado, y el tope de la corrida se quedaba corto. | Media | **Corregido** (ec7948c / 018565b): se suman sus métricas, o el costo estimado si no las hay. |
| U3 | El runner podía perder generaciones pagadas: guardaba recién después de ejecutar y una falla cortaba todo. | Media | **Corregido**: guarda la generación apenas vuelve, ejecuta la referencia antes de pagar y corta sin perder lo pagado. |
| U4 | El `fetch` de Node espera 300 s, menos que el tope de 8 min de la conexión. | Baja | **Aceptado**: una consulta generada tan lenta cuenta como `error_ejecucion` con su motivo. |

## 6. Conexiones, usuarios y despliegue

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| H2 | Las contraseñas de las bases del banco de pruebas (`testuser`, admin de Postgres) están commiteadas en `Bases de datos/README.md` e `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md` y siguen vigentes. Su compose publica los puertos en 0.0.0.0. | **Alta** con la instalación en red | **Pendiente (David)**: cambiarlas y publicar en 127.0.0.1. CLAUDE.md dice que «se cambiaron el 18/10», pero eso valía solo para los usuarios de la app. |
| H3 | Al editar o probar una conexión se reutilizaba la contraseña guardada con otro servidor, puerto o usuario: se la podía mandar a un servidor cualquiera. | Media | **Corregido** (634fde1): hay que escribirla de nuevo. `api_conexiones` 64/64. |
| H4 | `NLQP_ALLOW_DEV_AUTH_BYPASS=true` en `backend/.env` (inactivo mientras haya FIREBASE_PROJECT_ID). | Media | **Pendiente (David)** fuera de Docker: recomendado `false`. En Docker queda fijo en `false`. |
| H7 | La gestión de usuarios no deja registro de auditoría. Un superadmin puede operar sobre otro superadmin. | Media | **Pendiente (David)**. |
| H8 | Carrera al cambiar los claims de una cuenta a la vez desde dos sesiones. | Baja | **Pendiente (David)**. |
| H11 | Las reglas de Firestore no están versionadas. | Media | **Pendiente (David)**: verificar en la consola. |
| D1 | No había forma simple de instalar NLQP en otro equipo. | — | **Hecho**: Docker (8ccf060, `DOCKER.md`). Solo el frontend se publica en la red; la credencial va como secreto de solo lectura; contenedores sin root. |
