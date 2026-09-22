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
| `costUsd` | `number` | Solo en `generateSQL` exitoso |
| `safe` | `boolean` | Solo en `generateSQL` exitoso (resultado del Query Safety Engine) |
| `timestamp` | fecha | Siempre, asignada por el backend al escribir |

`/testConnection` y `/getSchema` no generan eventos — son llamadas de
diagnóstico/setup, no "uso" de la aplicación en el sentido que mide este
módulo.

## Estimación de costo

`src/services/vertexAiPricing.service.ts` calcula `costUsd` multiplicando los
tokens reales que devuelve Vertex AI (`usageMetadata` de la respuesta de
Gemini) por un precio de lista fijo en el código (documentado con la fecha en
que se verificó). **Es una estimación, no el monto real de la factura** — no
sustituye la consola de facturación de Google Cloud si se necesita el gasto
exacto. Los precios se pueden ajustar sin tocar código vía
`VERTEX_AI_PRICE_INPUT_PER_1M_USD` / `VERTEX_AI_PRICE_OUTPUT_PER_1M_USD` en
`.env`.

## Endpoint

`GET /getUsageStats?periodDays=30` (autenticado, igual que el resto de la
API) devuelve un agregado de los últimos N días: total de llamadas, costo
total estimado, desglose por tipo de llamada y por motor, y cantidad de
errores. Ver `GetUsageStatsResponse` en `src/types/index.ts`.

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
