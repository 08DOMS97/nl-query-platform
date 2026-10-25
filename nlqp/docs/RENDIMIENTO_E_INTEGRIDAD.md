# Rendimiento e integridad de resultados (2026-10-02)

Capa de ejecución que protege a la base de datos de consultas costosas **sin
sacrificar la integridad de lo que se devuelve**. Complementa al Query Safety
Engine: el Safety Engine decide *qué* se puede ejecutar (solo lectura); esta capa
controla *cuánto* puede costar ejecutarlo y *cómo* se entrega el resultado.

## Por qué existe

Requisito explícito: las consultas no solo deben traer datos correctos, también
deben poder ejecutarse en un entorno con muchos datos y transacciones sin que la
sesión se caiga por tiempo ni se ralentice la base. Antes de este cambio:

- Solo SQL Server tenía un tope de tiempo (15 s). En Postgres, MySQL y MariaDB
  una consulta podía correr indefinidamente.
- `/executeQuery` cargaba el resultado completo en memoria y lo enviaba en una
  sola respuesta: una consulta como "¿cuánto ha gastado cada cliente?" sobre
  millones de clientes podía agotar la memoria del backend o del navegador.

## Principio de diseño: integridad antes que recorte

Se descartó explícitamente **truncar resultados** (p. ej. "devolver como máximo
1000 filas"). Un resultado recortado en silencio es una respuesta incompleta que
parece completa — peor que un error, porque nadie se entera. Por la misma razón
el prompt de Gemini **no** debe agregar `LIMIT`/`TOP` que el usuario no pidió.

Todo límite de esta capa es **todo o nada**: o el usuario recibe el resultado
completo, o recibe un error claro. Nunca un resultado parcial.

## Componentes

### 1. Tope de tiempo del lado del servidor (`connectionManager.service.ts`)

**Cada conexión tiene su tope** (`queryTimeoutSec` en `connections/{id}`, desde el
19/10/2026). Lo fija el técnico en la pantalla Conexiones, entre 10 s y 60 min. Las
conexiones sin valor propio usan el de defecto, `NLQP_QUERY_TIMEOUT_MS`: 480 000 ms =
8 min, el umbral de reportes complejos de RNF-01. Hasta el 19/10 era un tope global de
60 000 ms.

- Siempre hay un tope: sin él, una consulta descontrolada ocuparía la base
  indefinidamente.
- Se aplica al abrir el pool de la conexión. Editar la conexión cierra su pool, así que
  un tope nuevo rige desde la consulta siguiente.
- Se aplica **dentro del motor**, no solo en el cliente: al vencer, el propio motor
  cancela la sentencia y libera sus recursos. Que el cliente deje de esperar no
  alcanza: la consulta seguiría consumiendo la base.

Verificado el 19/10:
- una consulta de 186 s completa con el tope de 8 min;
- con 10 s, el motor cancela en los 4 (10,4–10,8 s, `api_conexiones.mjs`).

Para que la prueba dure, la consulta lenta usa `SUM` sobre un producto cartesiano.
**`COUNT(*)` no sirve**: MySQL y SQL Server lo resuelven multiplicando los conteos de
cada tabla, sin recorrer las filas (0,4 s y 6 s para 9 000 millones de filas).

| Motor | Mecanismo | Error que se reconoce |
|---|---|---|
| PostgreSQL | `statement_timeout` en el pool | código `57014` |
| MySQL | `SET SESSION max_execution_time` (ms) al abrir cada conexión | errno `3024` |
| MariaDB | `SET SESSION max_statement_time` (segundos) — MariaDB no tiene `max_execution_time` | errno `1969` |
| SQL Server | `requestTimeout` del driver, que envía ATTENTION al servidor | `ETIMEOUT` |

El error se traduce a `QueryTimeoutError` con un mensaje en español y
`/executeQuery` responde `504`.

### 2. Lectura por streaming (`streamQuery`)

Recorre el resultado fila a fila sin cargarlo entero en memoria, en los 4 drivers:

- PostgreSQL: cursor (`pg-cursor`, dependencia nueva) en lotes de 2000 filas.
- MySQL/MariaDB: API de eventos del driver base (`mysql2`).
- SQL Server: `request.stream = true` (`mssql`).

Tiene **contrapresión**: si el consumidor va más lento (p. ej. una descarga), el
motor se pausa en lugar de acumular filas en memoria. Si el consumidor aborta, la
consulta se cancela en el motor (cursor cerrado, socket destruido o ATTENTION). Con
un cursor, el timeout del motor aplica por lote, así que además se exige un plazo
total igual al tope de la conexión desde el inicio.

### 3. Snapshot del resultado (`resultStore.service.ts`)

La consulta se ejecuta **una sola vez** y el resultado completo se vuelca por
streaming a un archivo NDJSON temporal (`<tmp>/nlqp-results/`). Las páginas y la
descarga en Excel se leen de ese mismo archivo.

Por qué un snapshot y no re-ejecutar la consulta en cada página: sin un `ORDER BY`
estable, dos ejecuciones pueden devolver las filas en distinto orden, y paginar
re-ejecutando podría **repetir o saltarse filas** entre páginas. Además, cada
página volvería a cargar la base. Con el snapshot, lo que el usuario ve en
pantalla y lo que descarga son exactamente los mismos datos.

- Páginas de 1000 filas. Se guarda el byte de inicio de cada página, así que
  cualquier página se lee en milisegundos sin recorrer las anteriores.
- Tamaño máximo: `NLQP_RESULT_MAX_BYTES` (por defecto 1 GB). Si se supera, se
  descarta el snapshot **completo** y se responde `413` (todo o nada).
- Vigencia: 30 minutos. Un barrido cada minuto borra los vencidos; al arrancar el
  backend se borran los de ejecuciones anteriores.
- Solo el usuario que ejecutó la consulta (`uid` de Firebase) puede leer su
  resultado.

### 4. Endpoints

| Endpoint | Auth | Qué hace |
|---|---|---|
| `POST /executeQuery` `{engine, sql}` | Firebase | Ejecuta una vez, guarda el snapshot y devuelve la página 1: `resultId, columns, rows, rowCount, totalRows, page, pageSize, totalPages`. `rowCount` = total del resultado (no de la página). |
| `GET /getResultPage?resultId&page` | Firebase | Otra página del snapshot. No re-ejecuta. |
| `POST /createResultExport` `{resultId}` | Firebase | Devuelve `{ path }` con un token de descarga. |
| `GET /exportResult?token` | Token de un solo uso | Resultado completo como Excel (.xlsx) por streaming (§4.1). Hasta el 24/10 era `/exportResultCsv` y entregaba CSV. |

Códigos de error: `504` timeout, `413` resultado demasiado grande, `404` resultado
inexistente o vencido, `400` página fuera de rango.

La descarga es una navegación del navegador (para que el archivo vaya
directo a disco sin pasar por la memoria de la página), y una navegación no puede
llevar el encabezado `Authorization`. Por eso `/exportResult` no pasa por el
middleware de Firebase: lo autoriza un token aleatorio de un solo uso, que vence a
los 2 minutos y solo se emite al dueño del resultado. Ver `SEGURIDAD.md` §7.

### 4.1 Exportación a Excel (`resultExcel.service.ts`, 24/10/2026)

Pedido de David: el CSV llevaba los datos, pero en Excel salían desordenados. La causa:
Windows en es-GT usa `;` como separador de listas y el CSV usaba `,`, así que Excel
ponía cada fila entera en la columna A. Además, las fechas salían en formato ISO y
los encabezados con el nombre de SQL. Se reemplazó por un .xlsx pensado para un
usuario no técnico:

- Hoja «Resultado»: cada dato en su columna, en cualquier configuración regional.
  Los encabezados son legibles (`total_pedido` → «Total pedido»; las siglas se
  respetan), en negrita, con fondo naranja claro, fijos al bajar y con filtro. El
  ancho de cada columna se calcula con la primera página.
- Fechas como fechas (`dd/mm/yyyy`, o con `hh:mm:ss` si alguna trae hora), la misma
  hora que muestra la pantalla.
- Números como números, para sumar y ordenar. Los decimales se muestran con todos
  sus dígitos (12.50 y no 12.5). El tipo se decide por columna al guardar el snapshot
  (`ColumnProfile`): una columna es numérica solo si **todos** sus valores lo son.
  Un número de más de 15 dígitos (BIGINT, DECIMAL grandes) o con ceros a la izquierda
  (`00123`) queda como **texto**, porque Excel no lo guarda exacto.
- Un texto que empieza con `=` se guarda como texto y no se vuelve fórmula
  (resuelve E8 de la auditoría). NULL queda como celda vacía.
- Hoja «Detalles»: la pregunta (si la hubo), la conexión, la fecha y hora de la
  consulta (hora de Guatemala) y el total de filas.
- **Nunca se trunca.** Excel admite 1 048 576 filas por hoja; si el resultado
  tiene más, continúa en «Resultado 2», «Resultado 3»…, y «Detalles» lo indica. Una
  celda de Excel admite 32 767 caracteres: si algún valor es más largo, la descarga
  sale como CSV (el formato anterior) para no recortarlo.
- Memoria: exceljs pasa el XML de la hoja al zip sin esperar a que lo comprima, y
  con 800 000 filas acumulaba ~130 MB. La escritura espera a que el zip alcance
  (`zipCaughtUp`, usa campos internos de exceljs/readable-stream). Medido aislado:
  pico de 143 MB con 200 000 filas y también con 800 000, con un cliente rápido o
  lento.
- Dependencia nueva: `exceljs@4.4.0` (versión fija).

### 5. Frontend (`QueryResult.tsx`)

- Arriba de la tabla: "Filas 1–1000 de 20.000", navegación Anterior/Siguiente con
  "Página N de M" y «Descargar Excel» (hasta el 24/10, «Descargar CSV completo»).
- La tabla tiene scroll propio (60 % de la altura de la ventana) con encabezado
  fijo; al cambiar de página vuelve al inicio.

## Verificación

Todo contra las bases reales del banco de pruebas, sin llamadas a Vertex AI.

| Prueba | Resultado |
|---|---|
| Timeout con tope de 2 s y consulta cartesiana pesada, 4 motores | Los 4 cancelan en ~2 s y responden `504`; la conexión sigue sana |
| ¿Queda la consulta viva en SQL Server tras el timeout? (`sys.dm_exec_requests`) | 0 — cancelada en el servidor |
| `streamQuery` vs. lectura completa: 50 consultas de prueba × 4 motores | 200/200 idénticas (columnas, filas y valores) |
| Resultado vacío | Las columnas llegan igual en los 4 motores |
| Consumidor que aborta a mitad de la lectura | Error limpio y conexión sana en los 4 motores |
| 20 000 filas por HTTP: 20 páginas unidas vs. resultado directo | Idénticas en los 4 motores; el CSV trae las 20 000 filas |
| Token de descarga reutilizado / `resultId` inexistente / sin token / `DELETE` | `404` / `404` / `401` / `403` |
| Tope de 100 KB con un resultado de 20 000 filas, 4 motores | `413` en los 4; ningún archivo queda en disco; el backend sigue vivo |
| Descarga de CSV cortada por el cliente | El backend sigue vivo; la descarga siguiente sale completa |
| Interfaz real en el navegador (Playwright) | Paginación, conteo, scroll y descarga del CSV correctos; 0 errores de consola |
| (24/10) Exportación a Excel, 4 motores (`api_exportacion.mjs`) | 68/68. Tipos, encabezados, fechas, decimales, `=` como texto, NULL vacío, número de 16 dígitos exacto, `00123`, «Detalles», enlace de un solo uso y 40 000 filas completas y en orden |
| (24/10) 1 100 000 filas (aislado) | 1 048 575 en «Resultado» + 51 425 en «Resultado 2»: todas |
| (24/10) 400 000 / 800 000 filas en Docker | Descarga en 11 s / 22 s con un cliente lento |

Rendimiento con 400 000 filas (Postgres local): la primera respuesta pasó de 8,4 s
a 1,5 s tras las optimizaciones (lotes de cursor más grandes, esperar solo cuando
el consumidor pide pausa, escritura del snapshot en bloques de 256 KB). Cualquier
otra página: ~5 ms. CSV completo: ~1 s.

## Bugs encontrados por las pruebas (corregidos)

1. **Un resultado demasiado grande tumbaba el backend completo.** Al descartar el
   archivo quedaban escrituras pendientes que emitían un evento `error` sin
   manejador, y Node termina el proceso ante eso. Una sola consulta grande podía
   dejar el servicio caído para todos los usuarios.
2. En MySQL, MariaDB y SQL Server ese mismo caso devolvía un error equivocado y
   **dejaba archivos en disco**: `events.once(stream, 'close')` rechaza si antes
   llega un `error`, lo que se saltaba el borrado.
3. Si el usuario cancelaba una descarga, la escritura del CSV quedaba esperando
   para siempre un evento `drain` que nunca llegaba.
4. **(10/10/2026) Las fechas salían distintas según el motor.** El dato guardado era
   el mismo en los 4 (p. ej. pedido 48: `2026-08-26 16:45`), pero `mysql2` leía los
   `DATETIME` como hora local del servidor de NLQP (Guatemala, UTC-6) y los
   devolvía 6 h corridos (`22:45Z`), y `pg` hacía lo mismo con las columnas `DATE`
   (`1979-07-28T06:00Z` en vez de `T00:00Z`). La app y el CSV mostraban otra hora u
   otro día según el motor. Corregido en `connectionManager.service.ts`: `mysql2`
   con `timezone: 'Z'` y parser de `DATE` en `pg` a medianoche UTC. Ahora los 4
   motores devuelven el mismo valor. Lo detectó el runner de evaluación al comparar
   contenido (antes solo se comparaba el número de filas).
5. **(24/10/2026, auditoría) Valores que se mostraban mal o en lugar de otros.**
   Prueba nueva: `scripts/pruebas/api_integridad.mjs`, 19/19 en los 4 motores.
   Detalle en `AUDITORIA_2026-10-24.md` §2.
   - Dos columnas con el mismo nombre (p. ej. `c.customer_id` y
     `o.order_id AS customer_id`) quedaban en la misma clave de la fila: se mostraba un
     valor en la columna del otro. En SQL Server, una columna sin nombre
     (`COUNT(*)`) también. Ahora es **422** con un aviso que pide alias distintos
     (`ResultShapeError`). En SQL Server se detecta porque el driver junta los valores
     repetidos en un arreglo; se descartó `arrayRowMode` porque rompe `FOR JSON`.
   - `TIMESTAMP` sin zona de Postgres salía +6 h (`pg` lo leía como hora local): ahora
     se lee como UTC, igual que el `DATETIME` de MySQL. Los valores especiales
     (`infinity`) quedan como texto.
   - BIGINT de MySQL/MariaDB de más de 2^53 llegaba redondeado: ahora llega como texto
     exacto (`supportBigNumbers`), como en Postgres. Un conteo sigue siendo número.
   - MySQL/MariaDB: si fallaba el `SET SESSION` del tope de tiempo, la conexión quedaba
     sin tope y el error salía sin manejar. Ahora la conexión se descarta y la
     consulta falla.
   - Postgres: si pg-cursor no da la descripción de columnas (es un campo privado) y
     hay filas, ahora es un error y no filas vacías.
6. **(24/10/2026) Pantalla Consultar.**
   - Una respuesta lenta podía dejar un resultado viejo bajo una sentencia nueva.
   - Un error al ejecutar dejaba visible el resultado anterior.
   - Los objetos y JSON salían como `[object Object]`, y los espacios repetidos se
     colapsaban.

   Corregido en `useQueryDraft.tsx`, `page.tsx` y `QueryResult.tsx`
   (`ui_consultar` 18/18).

## Limitaciones conocidas

- El almacén de snapshots vive en el disco y la memoria de un solo proceso. Encaja
  con la presentación en local (decisión del 01/10/2026). En Cloud Functions con
  varias instancias habría que moverlo a almacenamiento compartido (p. ej. Cloud
  Storage).
- Un reinicio del backend invalida los resultados vigentes (el usuario vuelve a
  ejecutar la consulta).
- (24/10, pendiente de David) SQL Server: DECIMAL y MONEY pierden precisión en el driver
  (12.50 → 12.5; un DECIMAL(38,2) grande se redondea). MySQL: las fechas cero llegan
  como NULL y el `TIMESTAMP` depende de la `time_zone` de la sesión. (El problema del
  CSV con `=` quedó resuelto el 24/10 con la exportación a Excel, §4.1. En el Excel,
  NULL queda vacío y la cadena vacía también: siguen sin distinguirse.)
- En Docker, `/tmp` es tmpfs: los snapshots ocupan RAM del contenedor (unos 230 MB con
  tres resultados de 800 000 filas). Vencen a los 30 min. Medido el 24/10; no se
  cambió.
- En Docker, el frontend reenvía `/api` al backend con un tope de 61 min (más que los
  60 min máximos de una conexión). Verificado con una consulta de 48 s; el valor por
  defecto de Next era 30 s (`DOCKER.md`).
- Pendiente (decisión del 02/10/2026): un "guardián de costo" que rechace consultas
  **antes** de ejecutarlas según el costo estimado por `EXPLAIN`. Se calibrará con
  los datos del banco de volumen alto en vez de fijar un umbral a ciegas.

## Archivos

- `backend/src/services/connectionManager.service.ts` — timeout del servidor,
  `QueryTimeoutError`, `streamQuery`.
- `backend/src/services/resultStore.service.ts` — nuevo: snapshot, páginas, CSV,
  tokens de descarga.
- `backend/src/functions/executeQuery.ts` — ejecuta vía snapshot, devuelve la página 1.
- `backend/src/functions/resultPages.ts` — nuevo: `getResultPage`,
  `createResultExport`, `exportResult` (antes `exportResultCsv`).
- `backend/src/services/resultExcel.service.ts` — (24/10) exportación a Excel.
- `backend/src/index.ts`, `backend/src/types/index.ts` — rutas y tipos.
- `backend/package.json` — dependencia `pg-cursor`.
- `frontend/src/components/QueryResult.tsx`, `QueryForm.tsx`, `lib/types.ts`,
  `lib/api.ts` — paginación y descarga.
- `docs/MANUAL_POSTMAN.md` — endpoints nuevos y errores 504/413/404.
