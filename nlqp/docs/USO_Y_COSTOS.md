# Módulo de uso y costos

Registra, para cada llamada a `/generateSQL` y `/executeQuery`, cuánto costó
(si aplica) y cómo se usó el sistema — pensado para alimentar un panel de
control (dashboard) que se construirá junto con el frontend (Módulo 8).

## Por qué existe

Los módulos 1-6 resuelven la traducción NL→SQL y su ejecución segura, pero no
dejan rastro de cuánto consume cada consulta en Vertex AI ni de cómo se usa
la aplicación en agregado (cuántas consultas, por qué motor, qué tasa de
error). Sin eso no hay forma de responder, con datos reales, cuánto cuesta
operar el sistema ni cuál es su patrón de uso — algo relevante para la
defensa de la tesis además de para la operación real del prototipo.

## Modelo de datos

Colección de Firestore `usageEvents`. Un documento por invocación relevante,
con esta forma (`UsageEvent`, ver `src/services/usageTracking.service.ts`):

| Campo | Tipo | Cuándo se llena |
|---|---|---|
| `type` | `'generateSQL' \| 'executeQuery'` | Siempre |
| `engine` | `DbEngine` | Siempre |
| `uid` | `string \| null` | Siempre (del token de Firebase verificado) |
| `success` | `boolean` | Siempre |
| `latencyMs` | `number` | Siempre |
| `errorReason` | `string` | Solo si `success: false` |
| `tokensInput` / `tokensOutput` / `tokensTotal` | `number` | Solo en `generateSQL` exitoso |
| `tokensThinking` | `number` | Solo en `generateSQL` exitoso — razonamiento interno de Gemini (3.8 Flash desde el 18/10/2026; antes 2.5 Pro), no visible pero facturado como salida |
| `costUsd` | `number` | Solo en `generateSQL` exitoso (entrada + salida visible + razonamiento) |
| `safe` | `boolean` | Solo en `generateSQL` exitoso (resultado del Query Safety Engine) |
| `timestamp` | fecha | Siempre, asignada por el backend al escribir |

`/testConnection` y `/getSchema` no generan eventos — son llamadas de
diagnóstico/setup, no "uso" de la aplicación en el sentido que mide este
módulo.

## Estimación de costo

`src/services/vertexAiPricing.service.ts` calcula `costUsd` multiplicando los
tokens reales que devuelve Vertex AI (`usageMetadata` de la respuesta de
Gemini) por un precio de lista fijo en el código (documentado con la fecha en
que se verificó). Desde el 18/10/2026, Gemini 3.8 Flash en `global`: USD 1.50 por
millón de tokens de entrada y USD 7.50 por millón de salida + razonamiento (catálogo
de Cloud Billing). Hasta esa fecha, Gemini 2.5 Pro: USD 1.25 / 10. **Es una estimación, no el monto real de la factura** — no
sustituye la consola de facturación de Google Cloud si se necesita el gasto
exacto. Los precios se pueden ajustar sin tocar código vía
`VERTEX_AI_PRICE_INPUT_PER_1M_USD` / `VERTEX_AI_PRICE_OUTPUT_PER_1M_USD` en
`.env`.

### Secret Manager (13/10/2026)

Las contraseñas de las conexiones están en Secret Manager (ver `SEGURIDAD.md` §13).
Cobra por versión activa y por lectura, con cuota gratuita de 6 versiones activas y
10 000 lecturas al mes. Para no salir de ella: una sola versión activa por conexión
(al cambiar la contraseña se destruyen las anteriores) y el secreto se lee al abrir el
pool, no en cada consulta. Hoy hay 4 secretos (las conexiones iniciales): quedan 2
conexiones más antes de empezar a pagar (unos $0.06 por versión al mes). No entra en el
registro de uso y costos, que solo mide Vertex AI.

## Métricas en la respuesta de `/generateSQL` (02/10/2026)

Además de registrarse en `usageEvents`, cada respuesta exitosa de `/generateSQL`
incluye `metrics` con los mismos datos: `tokensInput`, `tokensOutput`,
`tokensThinking` (razonamiento interno de Gemini, que se factura como salida),
`tokensTotal`, `costUsd`, `latencyMs`, y además `tablesSent`/`tablesTotal` (tablas
enviadas al modelo tras el pruning frente al total del esquema). Lo usa el runner
de evaluación para medir costo y reducción de esquema por consulta sin leer
Firestore (ver `PREPARACION_EVALUACION_GEMINI.md`).

`/executeQuery` sigue registrando un evento por ejecución. Desde el 02/10 la
consulta se ejecuta una sola vez y las páginas y el CSV se leen de un snapshot
(`RENDIMIENTO_E_INTEGRIDAD.md`), así que navegar páginas o descargar el CSV no
genera eventos nuevos ni carga la base.

## Tiempo de generación por etapa (24/10/2026)

David vio una generación simple de 24,2 s («Muéstrame las categorías que hay», MariaDB).
Desglose medido sin costo:

| Etapa | Tiempo |
|---|---|
| Autenticación + esquema | ~0,3–0,6 s |
| Primera llamada a Vertex del proceso (cliente, token, TLS) | ~2,7 s (`countTokens`: 2,8 s la primera, 0,14 s después) |
| Espera al modelo | ~20 s, con 533 tokens de entrada, 12 de salida y 0 de razonamiento |

La espera depende del servicio de Google, no de NLQP: con un prompt igual de chico,
otras generaciones tardaron 2,9 s y 5,5 s.

Lo que se cambió:
- **Vertex listo al arrancar** (`warmUpVertex`, un `countTokens` que no se factura): la
  primera generación ya no paga los ~2,7 s.
- **Esquema en caché** 60 s por conexión (`NLQP_SCHEMA_CACHE_SEC`, 0 la apaga):
  - se borra al editar o eliminar la conexión;
  - la pantalla Esquema y las corridas de evaluación lo leen siempre actual.
- **Tiempo por etapa** en `metrics.stages` y en el evento de uso: `schemaMs`, `pruneMs`,
  `modelMs` y `checkMs`. Uso y costos muestra, en «Tiempos de generación», la mediana, el
  p95 y el máximo del total, de la espera al modelo y del esquema. En Consultar, el
  técnico ve «modelo / resto».
- **Sin llamada al modelo para «hola»:** si la pregunta no deja palabras útiles, o deja
  una sola sin relación con el esquema, da 422 `nlqp/no-content`. Antes esas entradas
  mandaban el esquema completo, la llamada más cara.
- **`/executeQuery`** registra el uso y el historial en paralelo.

Se evaluó y se descartó (revisión con agentes del 24/10):
- **Caché de contexto:** 3.8 Flash la admite desde 6.144 tokens y los prompts tienen
  500–1.200.
- **Batch prediction:** cuesta 50 % menos, pero no mide latencia y no pasa por
  `/generateSQL`.
- **Otro modelo o prompt más corto:** obliga a rehacer la evaluación.
- **Priority PayGo / Provisioned Throughput:** no tiene cifras oficiales de mejora y la
  capacidad reservada exige un compromiso mínimo de una semana.
- **Razonamiento MINIMAL:** el modelo lo rechaza; LOW ya es el mínimo.
- **Timeout + reintento:** se cobra igual. David decidió no hacerlo. **Cambió el 26/10** (ver abajo).
- **Tope de gasto por usuario y caché del rol:** David decidió no hacerlos.

Para la tesis (decisión de David, 24/10): el tiempo de generación no es fijo. Depende de
la consulta y del servicio del modelo, y se suman la conexión y el proceso; se reporta
con la mediana y el p95 por etapa (`RESUMEN_PARA_DOC_TEORICO.md` 3.3.1.3 y 6.3.6).

## Generación por partes con corte y reintento (26/10/2026)

Durante la corrida de evaluación, Vertex AI estuvo saturado: hubo esperas de 2 a 5 min y
un 429. David aprobó cortar y reintentar (`vertexAI.service.ts`):
- `generateContentStream` con `includeThoughts`: la primera parte, aunque sea
  razonamiento, prueba que el modelo está trabajando. El razonamiento no entra en el SQL.
- Sin primera parte en **20 / 40 / 80 s** → nuevo intento. El tope por intento es
  120 s, y un 429 o 503 se reintenta a los 2 s.
- **Métricas nuevas** en la respuesta y en el evento de uso:
  - `attempts`: intentos usados;
  - `firstChunkMs`: tiempo hasta la primera parte del intento que respondió.

  En Consultar, el técnico ve «Intentos». A los 20 s, cualquier usuario ve un aviso de
  que el servicio está ocupado.
- **Costo:** el costo registrado es el del intento que respondió. Falta verificar en la
  facturación de GCP si Google cobra los intentos cortados.
- **Medido en la corrida** (332 generaciones): mediana 4,9 s, p95 61 s y máximo 133 s.
  Sin corte, con el servicio saturado, el p95 había sido 279 s y el máximo 303 s.
  Intentos: 247 con uno, 68 con dos y 17 con tres. Detalle en
  `PREPARACION_EVALUACION_GEMINI.md` §9.

## Endpoint

`GET /getUsageStats?periodDays=30` (autenticado, igual que el resto de la
API) devuelve un agregado de los últimos N días: total de llamadas, costo
total estimado, desglose por tipo de llamada y por motor, y cantidad de
errores. Ver `GetUsageStatsResponse` en `src/types/index.ts`.

**Origen de las llamadas (10/10/2026).** Cada evento guarda `origin`: `'usuario'`
(uso normal) o `'evaluacion'` (el runner de la tesis manda `X-NLQP-Origin:
evaluacion`). `getUsageStats` cuenta por defecto solo `origin=usuario`, para que las
corridas de evaluación no inflen el consumo normal; `?origin=evaluacion` da el costo
de las evaluaciones y `?origin=todos` el total. Los eventos anteriores, sin el campo,
cuentan como `'usuario'`. El costo por consulta no cambia: Vertex AI factura igual
cualquier llamada; solo cambia en qué cifra se cuenta.

## Qué falta (fuera del alcance de este backend)

El "tiempo real" de un dashboard depende del frontend (Módulo 8): cuando se
construya, puede leer este endpoint periódicamente o usar un listener de
Firestore (`onSnapshot`) directamente sobre `usageEvents` para actualizarse
sin recargar. Tampoco hay control de acceso por rol todavía — cualquier
usuario autenticado puede leer `/getUsageStats` igual que el resto de los
endpoints, ya que el sistema no tiene un concepto de "administrador" (mismo
alcance de autenticación que el resto de la API; documentado como limitación
conocida, igual que los hallazgos de `SEGURIDAD.md`).

## Distinción con el futuro Módulo de Historial

Este módulo es **telemetría de operación** (cuánto costó, cuánto se usó, con
qué latencia y tasa de error). El Módulo de Historial (Firestore, pendiente)
es **producto** — guarda el par pregunta-en-lenguaje-natural + SQL generado
para que el usuario lo reutilice o edite. Comparten Firestore como backend
pero son colecciones separadas (`usageEvents` vs. la del historial) porque
resuelven necesidades distintas.
