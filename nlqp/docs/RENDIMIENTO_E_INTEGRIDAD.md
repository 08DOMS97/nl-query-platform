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

`NLQP_QUERY_TIMEOUT_MS` (por defecto 60 000 ms) se aplica **dentro del motor**, no
solo en el cliente: al vencer, el propio motor cancela la sentencia y libera sus
recursos. Que el cliente deje de esperar no alcanza — la consulta seguiría
consumiendo la base.

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
total de `NLQP_QUERY_TIMEOUT_MS` desde el inicio.

### 3. Snapshot del resultado (`resultStore.service.ts`)

La consulta se ejecuta **una sola vez** y el resultado completo se vuelca por
streaming a un archivo NDJSON temporal (`<tmp>/nlqp-results/`). Las páginas y el
CSV se leen de ese mismo archivo.

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
| `GET /exportResultCsv?token` | Token de un solo uso | CSV completo por streaming (UTF-8 con BOM para Excel). |

Códigos de error: `504` timeout, `413` resultado demasiado grande, `404` resultado
inexistente o vencido, `400` página fuera de rango.

La descarga del CSV es una navegación del navegador (para que el archivo vaya
directo a disco sin pasar por la memoria de la página), y una navegación no puede
llevar el encabezado `Authorization`. Por eso `/exportResultCsv` no pasa por el
middleware de Firebase: lo autoriza un token aleatorio de un solo uso, que vence a
los 2 minutos y solo se emite al dueño del resultado. Ver `SEGURIDAD.md` §7.

### 5. Frontend (`QueryResult.tsx`)

- Arriba de la tabla: "Filas 1–1000 de 20.000", navegación Anterior/Siguiente con
  "Página N de M" y "Descargar CSV completo".
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

## Limitaciones conocidas

- El almacén de snapshots vive en el disco y la memoria de un solo proceso. Encaja
  con la presentación en local (decisión del 01/10/2026). En Cloud Functions con
  varias instancias habría que moverlo a almacenamiento compartido (p. ej. Cloud
  Storage).
- Un reinicio del backend invalida los resultados vigentes (el usuario vuelve a
  ejecutar la consulta).
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
  `createResultExport`, `exportResultCsv`.
- `backend/src/index.ts`, `backend/src/types/index.ts` — rutas y tipos.
- `backend/package.json` — dependencia `pg-cursor`.
- `frontend/src/components/QueryResult.tsx`, `QueryForm.tsx`, `lib/types.ts`,
  `lib/api.ts` — paginación y descarga.
- `docs/MANUAL_POSTMAN.md` — endpoints nuevos y errores 504/413/404.
