# Preparación de la evaluación con Gemini (2026-10-02, actualizada 2026-10-18)

Trabajo previo a correr las 50 consultas de prueba **generando el SQL con Gemini**
(hasta ahora se habían corrido con el SQL de referencia escrito a mano). Objetivo:
que la corrida mida al modelo y al sistema, y no fallas de configuración o de las
propias referencias — y no pagar dos veces la misma corrida por errores evitables.

Estado (29/10/2026): **piloto, corrida completa, reintento de los 6 errores y revisión
a mano y `EXPLAIN` hechos (400/400, $0.8132; 94,8 % correcto; 93,5 % con costo ≤ 2 veces el
de la referencia) (§9).**
Antes, al 18/10: runner listo y probado gratis. Modelo: **`gemini-3.8-flash`** en `global`
desde el 18/10 (Gemini 2.5 Pro se retira el 20/10, §8 punto 2c). Llamadas pagadas
para verificar la integración: 09/10 con 2.5 Pro ($0.01188) y 18/10 con 3.8 Flash
($0.0012), ambas S10 en Postgres.

## 1. Qué se mide

La corrida tiene que sostener la hipótesis con cuatro métricas, más un requisito
agregado el 02/10/2026:

| Métrica | Cómo se mide |
|---|---|
| Precisión | Se compara el **resultado** de ejecutar el SQL generado contra el del SQL de referencia (no el texto del SQL) |
| Reducción de tokens | Tokens del prompt con el esquema podado vs. con el esquema completo (API `countTokens`, gratuita) |
| Robustez lingüística | Precisión con una paráfrasis de cada consulta vs. con la redacción original |
| Consistencia entre motores | El SQL generado para cada motor devuelve el mismo resultado en los 4 |
| **Eficiencia** (nuevo) | Costo estimado por `EXPLAIN`, detección de antipatrones y latencia real en un banco de volumen alto |

Comparar resultados y no texto es el criterio de "execution accuracy" de los
benchmarks de NL→SQL (Spider, BIRD): hay muchas formas correctas de escribir la
misma consulta (alias, `JOIN` vs. subconsulta, etc.).

## 2. El conjunto de 50 consultas

### Origen

Entraron en el commit inicial (`ee19110`, 21/09/2026) para cumplir la exigencia de
"50 consultas representativas (simple/intermedio/complejo)" de la metodología de la
tesis (sección 3.3.1.2, ver `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md`). **El texto de
la sección 3.3.1.2 no está en el repositorio**: la clasificación de abajo se dedujo
del SQL de referencia y debe contrastarse con la definición formal del capítulo 3.

### Qué cubre cada nivel

| Nivel | Qué pone a prueba | Ejemplos |
|---|---|---|
| Simple (15) | Una tabla: conteos, filtros, orden, límite, promedio, `DISTINCT`, filtro por año. Mide el mapeo de vocabulario (español → esquema en inglés) y el uso de valores categóricos | S01 conteo, S03 top 10, S13 `IN_TRANSIT`, S10 año 2025 |
| Intermedio (20) | Un `JOIN` o `GROUP BY`; anti-joins ("nunca han…"), `HAVING`, agrupación por año/mes, porcentajes, diferencia de fechas, condiciones combinadas | M05/M06/M15 anti-join, M14 `HAVING`, M18 %, M20 días entre fechas |
| Complejo (15) | CTE, subconsultas contra un promedio, funciones de ventana (top N por grupo), 3–4 tablas encadenadas, `COUNT DISTINCT`, % sobre el total, integridad | C02/C11 ventana, C03/C12 vs. promedio, C05 % del total, C06 integridad |

Entre todas cubren las 8 tablas y las 8 FK del banco de pruebas.

### Por qué están construidas así

- **Referencia escrita a mano, con variante por dialecto solo donde la sintaxis
  cambia** (`TOP` vs. `LIMIT`, booleanos, funciones de fecha). Aísla la capa de
  dialectos: si las 4 variantes devuelven lo mismo, la referencia es correcta en
  los 4 motores.
- **Se generan por motor**, no una vez: la hipótesis incluye que el sistema funcione
  sobre 4 motores, así que la misma pregunta debe producir SQL válido en cada
  dialecto.

### Debilidades conocidas (a declarar en el capítulo)

- Las redactó el mismo asistente que conoce el esquema, no usuarios reales: tienden
  a estar bien escritas y con vocabulario favorable. Las paráfrasis compensan
  parcialmente; serían más sólidas si las redactaran personas ajenas al sistema
  (p. ej. participantes de la encuesta).
- Algunas admiten más de una lectura razonable (M03 "cada cliente": ¿incluye a los
  que nunca compraron?; empates en los "top N"; M13: ¿el conteo de pedidos excluye
  cancelados?). Los resultados que no coincidan se revisarán a mano y se
  clasificarán como "error del modelo" o "interpretación válida distinta".
- Todas están en español correcto, sin errores de tipeo ni lenguaje coloquial.

## 3. Corrección del SQL de referencia

Al revisar las referencias para escribir las reglas de negocio se encontró que
**eran inconsistentes entre sí** respecto de los pedidos cancelados:

- M03 "¿Cuánto ha gastado cada cliente?" **incluía** cancelados; C01 "¿Quién es el
  cliente que más ha gastado?" los **excluía**.
- M07 "total de ventas por categoría" y C11 los **incluían**; C05 y C08 (ventas e
  ingreso) los **excluían**.

Con referencias así, ninguna regla podía coincidir con todas, y la precisión medida
habría castigado al modelo por una ambigüedad del conjunto de prueba. Se fijó una
sola regla — *si la pregunta involucra montos de ventas, ingresos, gasto o ticket,
la consulta excluye los pedidos `CANCELLED`* — y se corrigieron las 5 referencias
que no la cumplían (incluidas sus variantes de SQL Server):

| ID | Pregunta | Cambio |
|---|---|---|
| M03 | ¿Cuánto ha gastado cada cliente? | `LEFT JOIN orders ... AND o.status <> 'CANCELLED'` (sigue listando clientes sin pedidos con 0) |
| M07 | ¿Cuál es el total de ventas por categoría? | `JOIN orders` con `o.status <> 'CANCELLED'` |
| M12 | ¿Cuál es el ticket promedio por año? | `WHERE status <> 'CANCELLED'` |
| M13 | ¿Cuántos pedidos y cuánto se vendió cada mes de 2025? | `AND status <> 'CANCELLED'` |
| C11 | 3 productos más vendidos de la categoría con mayores ventas | Filtro en los dos CTE (ventas por categoría y ranking de productos) |

Las 5 corregidas ejecutan sin error en los 4 motores (verificado al comparar el
streaming nuevo contra la lectura directa, ver `RENDIMIENTO_E_INTEGRIDAD.md`).
**Pendiente:** volver a confirmar con el runner que siguen siendo consistentes
entre los 4 motores, y auditarlas por eficiencia (§7).

Nota para el Capítulo 6: los resultados de `historico/resultados_consultas_prueba.md`
(200/200, 50/50 consistentes) se obtuvieron con las referencias **anteriores** a
esta corrección.

## 4. Cambios al prompt y al esquema

### Valores permitidos de columnas categóricas

Antes, el prompt no le decía al modelo que `status` solo admite `'ACTIVE'`,
`'IN_TRANSIT'`, `'FAILED'`, etc.: tenía que adivinar los literales, y en ~15
consultas un error ahí da un resultado incorrecto que es culpa del sistema, no del
modelo. Ahora `SchemaExtractor` lee los `CHECK ... IN (...)` de los 4 motores y el
prompt muestra `status (nvarchar) [valores: 'CANCELLED'|'CONFIRMED'|...]`.

| Motor | Fuente | Particularidad |
|---|---|---|
| PostgreSQL | `pg_constraint` + `pg_get_constraintdef` | `= ANY (ARRAY['A'::character varying, ...])` |
| MySQL | `information_schema.CHECK_CONSTRAINTS` ⋈ `TABLE_CONSTRAINTS` | No expone la tabla en `CHECK_CONSTRAINTS`; **escapa las comillas** (`\'`) y antepone `_utf8mb4` a cada literal |
| MariaDB | `information_schema.CHECK_CONSTRAINTS` | Sí incluye `TABLE_NAME` |
| SQL Server | `sys.check_constraints` | `([status]='B' OR [status]='A')` |

`parseEnumCheck()` acepta solo CHECK de enumeración sobre una columna (descarta
rangos, `NOT IN`, varias columnas). Es un enriquecimiento opcional: si la consulta
de CHECK falla, el esquema sale igual que antes. Verificado: los mismos 7 campos
categóricos, con los mismos valores, en los 4 motores.

### Reglas de dominio (`domainRules.service.ts`)

La semántica que no se deduce del esquema va como reglas en el prompt, igual que
los sinónimos ES→EN del pruning cubren el vocabulario:

- Si la pregunta involucra montos de ventas, ingresos, gasto o ticket promedio,
  excluir los pedidos `CANCELLED`.
- Los montos pagados se calculan solo con pagos `COMPLETED`.

Cubren el dataset de e-commerce del banco de pruebas; en producción serían
configuración por cliente.

### Índices en el esquema

`SchemaExtractor` lee también los índices secundarios de los 4 motores
(`pg_index`, `information_schema.STATISTICS`, `sys.indexes`) y los guarda completos
en `TableInfo.indexes` (sirven para la auditoría con `EXPLAIN`). Al prompt solo va
una marca `IDX` en las columnas que son **primera columna** de algún índice — que es
lo que importa para que un filtro o un JOIN pueda usarlo — para gastar pocos
tokens. Los índices difieren entre motores donde el banco de pruebas difiere de
verdad: en MySQL/MariaDB `order_items.order_id` no tiene índice propio porque lo
cubre el único compuesto `(order_id, product_id)`; las columnas marcadas `IDX`
quedan idénticas en los 4.

### Reglas de rendimiento

Se agregaron al prompt (`PERFORMANCE_RULES` en `vertexAI.service.ts`). Ninguna
cambia **qué** filas devuelve la consulta, solo **cómo** las obtiene:

- Solo las columnas necesarias; nunca `SELECT *`.
- No aplicar funciones a columnas `IDX` al filtrar o unir; para fechas, rangos
  (`col >= '2025-01-01' AND col < '2026-01-01'`) en vez de `YEAR(col) = 2025`.
- `NOT EXISTS` (o `LEFT JOIN ... IS NULL`) para "los que no tienen / nunca han", no
  `NOT IN` con subconsulta (que además falla con NULL).
- Evitar subconsultas correlacionadas en el `SELECT`.
- No usar `DISTINCT` para tapar duplicados de un JOIN: agregar antes de unir.
- `LIMIT`/`TOP` solo si la pregunta pide una cantidad o un máximo/mínimo; nunca
  recortar un listado completo (ver `RENDIMIENTO_E_INTEGRIDAD.md`).

Se corrigieron además las notas de dialecto, que decían "usa `EXTRACT(YEAR FROM
col)` para fechas" sin distinguir: ahora indican esas funciones solo para
**agrupar o mostrar**, no para filtrar.

Costo en tokens (medido con `countTokens`, gratis): los valores de `CHECK` + marcas
`IDX` agregan 85–230 tokens por prompt (~$0.0003 por llamada). Ejemplo: "¿Cuántos
envíos están en tránsito?" → 730 tokens podado vs. 1236 con el esquema completo.

### Métricas en la respuesta de `/generateSQL`

`/generateSQL` devuelve ahora `metrics`: `tokensInput`, `tokensOutput`,
`tokensThinking`, `tokensTotal`, `costUsd`, `latencyMs`, `tablesSent`,
`tablesTotal` — lo mismo que ya se registraba en Firestore (`usageEvents`), para
que el runner no tenga que leerlo de ahí.

### Conteo de tokens del prompt (`countPromptTokens`)

Cuenta los tokens que tendría un prompt sin generar nada, con la API `countTokens`
de Vertex AI, que **no se factura**. Permite medir la reducción de tokens del
pruning comparando el prompt podado con el del esquema completo.

## 5. Verificaciones gratuitas ya hechas

- **Pruning**: con el código real contra Postgres, ninguna de las 50 consultas pierde
  una tabla que su SQL de referencia necesita (0/50). En promedio se envía ~70 % del
  esquema (por longitud del texto); en 7 consultas se envía completo.
- **Valores categóricos**: idénticos en los 4 motores (§4).

## 6. Costo estimado de la corrida

**Actualizado 18/10 (Gemini 3.8 Flash, razonamiento `LOW`):** precio de lista
$1.50/M entrada y $7.50/M salida + razonamiento. S10 costó **$0.0012** (621
entrada / 39 salida / 0 razonamiento, 2,9 s). Las consultas complejas pueden razonar
algo y tener prompts más largos: se estima ~$0.002–0.004 por llamada. El runner usa
$0.004 para el tope.

| Corrida | Llamadas | Costo estimado | Tope por defecto |
|---|---|---|---|
| Piloto (5 consultas × 4 motores, con paráfrasis) | 40 | ~$0.10–0.16 | $0.25 |
| 50 consultas + 50 paráfrasis × 4 motores | 400 en total | ~$0.80–1.60 | $2.50 |

El piloto se reutiliza en la corrida completa: no se paga dos veces.

Antes (Gemini 2.5 Pro, presupuesto de razonamiento de 1024 tokens): ~$0.012 por
llamada, casi todo razonamiento; 400 llamadas ≈ $4,75.

Se confirma con David antes de cada corrida pagada.

## 7. Decisiones tomadas (02/10/2026)

- Valores categóricos: leerlos de los `CHECK` (no muestrear datos).
- Reglas de negocio en el prompt, con las referencias corregidas para ser
  consistentes con ellas.
- Robustez: 1 paráfrasis por cada una de las 50 consultas, en los 4 motores.
- Además de correctas, las consultas deben ser **eficientes en un entorno con muchos
  datos**: índices y reglas de rendimiento en el prompt, medición con `EXPLAIN` y
  detector de antipatrones, banco de volumen alto **en los 4 motores**.
- No truncar resultados ni pedir al modelo `LIMIT` no solicitados (ver
  `RENDIMIENTO_E_INTEGRIDAD.md`).
- Timeout de 60 s (desde el 19/10, 8 min por defecto: las consultas del banco tardan ms, no cambia la corrida); guardián de costo previo con `EXPLAIN`, después y calibrado.

## 8. Pendiente antes de la corrida

> **24/10/2026 — Controles de `/generateSQL` y cambios del runner** (auditoría,
> `AUDITORIA_2026-10-24.md` §1 y §5):
> - **Antes del modelo, sin costo:**
>   - una «pregunta» que ya es SQL da 422 `nlqp/sql-input`;
>   - una de más de 1000 caracteres da 400.
>
>   Ninguna de las 100 preguntas del corpus se toma por SQL (`api_generacion` 47/47).
> - **Después del modelo:** si el SQL limita filas (LIMIT/TOP/FETCH) y la pregunta no
>   pide una cantidad ni un extremo, da 422 `nlqp/unrequested-row-limit`, con el SQL y
>   las métricas. En el runner es el veredicto nuevo **`limite_no_pedido`**: cuenta como
>   no correcto y tiene su propia línea en el resumen.
>   - Las 22 preguntas del corpus que piden un límite pasan.
>   - El control es deliberadamente laxo: 22 preguntas sin límite (13 consultas) usan
>     palabras como «más» o «mayor» y dejarían pasar un LIMIT.
>   - **Falta verificarlo con Gemini real** (~$0.002): se hace en el piloto.
> - **Runner:**
>   - ejecuta la referencia antes de pagar la generación;
>   - guarda cada generación apenas vuelve, así que si algo falla después, la próxima
>     corrida la reutiliza;
>   - suma el costo estimado si una respuesta no trae métricas;
>   - el resumen ignora (y avisa) las generaciones guardadas sin comparar.
>
>   El encabezado `X-NLQP-Origin: evaluacion` ahora solo vale para el rol técnico; el
>   runner ya usaba la cuenta técnica de las pruebas. Modo prueba: 200/200.

1. ~~Streaming, paginación y CSV~~ — hecho (`RENDIMIENTO_E_INTEGRIDAD.md`).
2. ~~Índices en el esquema + reglas de rendimiento en el prompt~~ — hecho (§4).
2b. ~~Migrar a `@google/genai`~~ — **hecho 09/10/2026** (`@google/genai` 2.24.0
   fijado, `@google-cloud/vertexai` desinstalado). Verificado con `countTokens`
   (gratis) y con una llamada real (S10, Postgres): SQL correcto y eficiente
   (`order_date >= '2025-01-01' AND order_date < '2026-01-01'`, mismo resultado que
   la referencia, 104), Query Safety Engine lo aprueba, 1208 tokens de entrada / 39
   de salida / **998 de razonamiento** (casi todo el presupuesto de 1024), costo
   **$0.01188**, latencia 14,5 s. Proyección: 200 llamadas (50 × 4) ≈ $2,40; 400 con
   paráfrasis ≈ $4,75.
   Texto original del riesgo: el SDK `@google-cloud/vertexai` está deprecado y su aviso
   indica eliminación el 24/06/2026 (ya pasada). Sigue respondiendo al 02/10/2026,
   pero puede dejar de hacerlo en cualquier momento, incluso a mitad de la corrida.
   Reemplazo oficial: `@google/genai` (modo Vertex AI), que además tipa de forma
   nativa `thinkingConfig` y `thoughtsTokenCount`. Conviene migrar antes de la
   corrida pagada.
2c. ~~Retiro de `gemini-2.5-pro`~~ — **resuelto 18/10/2026: cambio a
   `gemini-3.8-flash`.** La página oficial ("Model versions and lifecycle") da el
   **20/10/2026** como retiro de 2.5 Pro (ya no provisoria) y propone 3.8 Flash o 3.5
   Flash. Se eligió `gemini-3.8-flash`: GA desde el 02/09/2026, retiro **no antes del
   02/09/2027** ("may be extended, won't be moved to an earlier date"). Descartados:
   `gemini-3.1-pro-preview` (preview, solo `global`) y `gemini-4-argon` (modelo de
   frontera, ignora temperatura/top_p y es más caro). Cambios:
   - `VERTEX_AI_MODEL=gemini-3.8-flash` y `GCP_LOCATION=global` (3.8 Flash no está en
     `us-central1`; solo `global`, `us`, `eu`). Mismos valores por defecto en
     `vertexAI.service.ts`.
   - Razonamiento: `thinkingLevel: LOW` en vez de `thinkingBudget: 1024` (3.8 Flash
     ya no acepta presupuesto en tokens; `MINIMAL` da error). Salida máxima 4096, igual.
   - Temperatura: ya no se envía (3.8 Flash la ignora).
   - Precios en `vertexAiPricing.service.ts`: $1.50 / $7.50 (SKUs "Gemini 3.8 Flash
     Global Text Input/Output - Predictions" del catálogo de Cloud Billing, 18/10).
   - Runner: `COSTO_ESTIMADO_POR_LLAMADA` 0.004 y topes $0.25 (piloto) / $2.50.
   - Prompt sin cambios. Verificado: `countTokens` (gratis), seguridad 57/57 +
     200/200, API 38/38 · 23/23 · 32/32 · 25/25, y S10 real con resultado 104 =
     referencia, $0.0012.
   - La evaluación se corre con 3.8 Flash y el resumen registra el modelo.

   Historial del riesgo (02–08/10): retiro del modelo `gemini-2.5-pro` en
   Vertex AI. La página oficial de versiones de modelos de Vertex AI indica
   "Not before October 16, 2026" como fecha de retiro; fuentes externas reportan que
   la página nueva de ciclo de vida ya muestra el 20/10/2026, y en la Gemini API la
   fecha del 16/10 se retiró sin aviso. La fecha se está moviendo, pero en cualquier
   caso cae junto a la presentación del prototipo (14/10) y la entrega de PG2 (17/10).
   Después del retiro, las llamadas a `gemini-2.5-pro` fallan: tanto la corrida como
   cualquier demo posterior.
   - **Actualización 08/10/2026:** la página oficial de Vertex AI ("Model versions
     and lifecycle" y la ficha de Gemini 2.5 Pro) muestra ahora **20/10/2026** como
     fecha más temprana de retiro. El 16/10 corresponde al calendario de la Gemini
     API, que es otro producto. Sigue siendo provisoria; el reemplazo que sugiere
     Google es la familia Gemini 3.x Flash.
   - Hacer el piloto y la corrida completa **antes de la presentación (14/10)**; en
     ningún caso después del 16/10.
   - Antes de cada corrida, confirmar la fecha vigente en la consola de Google Cloud.
   - El modelo se cambia por `VERTEX_AI_MODEL` en `.env`, pero cambiar de modelo
     obliga a revisar el prompt, la configuración de razonamiento y los precios de
     `vertexAiPricing.service.ts`, y los resultados medidos quedan atados al modelo
     con el que se corrieron (dejar registrado cuál fue).
   - Hacer la migración del SDK (2b) y este cambio de modelo, si hace falta, en la
     misma pasada.
2d. ~~Volver a verificar las referencias corregidas el 02/10~~ — hecho 08/10/2026:
   200/200 ejecuciones, 0 inconsistencias entre motores (cada consulta pasada por
   `validateQuerySafety()` y ejecutada con `runQuery()`, usando `overrides` por motor).
2e. ~~Endurecer el Query Safety Engine y versionar la batería~~ — hecho 08/10/2026
   (`SEGURIDAD.md` §9–11, `npm run test:seguridad`). La corrida mide el validador
   definitivo.
2f. **Hallazgo 09/10/2026 — la poda casi no poda en este banco.** Para S10 ("¿Cuántos
   pedidos se hicieron en 2025?"), que solo necesita `orders`, se enviaron 7 de 8
   tablas. Causa: `pruneSchema()` agrega las tablas vecinas por FK a un salto
   (`expandOneHop`), y `orders` está conectada con casi todo el esquema. Impacto:
   la métrica de **reducción de tokens** va a salir baja en muchas consultas.
   David eligió la (b): ajustar la poda. **Hecho 09/10/2026** (`schemaPruning.service.ts`):
   - Núcleo = tablas nombradas (sustantivo principal del nombre: `order_items` →
     "item") + tablas con una columna distintiva nombrada (término presente en 1–2
     tablas). Conexión solo por el camino más corto de FKs entre las del núcleo.
     Fail-open (esquema completo) si nada coincide.
   - Bugs corregidos de paso: "clientes" no coincidía nunca (se singularizaba a
     "client" antes de buscar el sinónimo) y "categories" quedaba en "categori".
     Con la poda vieja, C07 y C09 **perdían `customers`**: solo funcionaba porque
     enviaba casi todo.
   - Sinónimos de negocio: venta/gasto/ingreso/compra → `orders` (la regla de
     dominio exige `orders` para excluir cancelados); vendido/comprado/unidades →
     además `order_items`.
   - **Verificado contra las 50 consultas** (tablas que usa la referencia vs.
     tablas enviadas): 0/50 con tablas faltantes; tablas enviadas promedio 5,56 →
     **2,18** (necesarias 1,76; esquema 8).
   - **Reducción de tokens medida con `countTokens` (gratis), Postgres, 50
     consultas:** prompt completo 1238 → podado 701 tokens promedio, **43,4 %**
     (simples 51,3 %, intermedias 43,2 %, complejas 35,8 %). ~490 tokens del prompt
     son fijos (instrucciones, reglas, pregunta); sobre la parte de esquema sola la
     reducción es ~72 % (≈745 → ≈208). Reportar ambas cifras y aclarar cuál es cuál.
   - **Limitación a declarar en la tesis:** el diccionario de sinónimos se ajustó
     mirando estas 50 preguntas, así que sobre ellas la poda tiene ventaja. La
     métrica de robustez con paráfrasis es justamente la prueba de que generaliza;
     si se omiten las paráfrasis, decirlo explícitamente.
   - El Cap. 5 cita un 71 % sobre 42 tablas: irreproducible, reemplazar por estas
     cifras.
2g. **Hallazgos del 10/10/2026 al probar el runner (gratis):**
   - **C10 tenía `LIMIT 10` sin que la pregunta lo pidiera** ("¿Qué clientes tienen
     pagos incompletos…?"): la referencia recortaba 20 filas a 10. Un SQL generado
     correcto (sin límite, como exige la regla de no truncar) habría contado como
     error. Quitado el `LIMIT` y el override de SQL Server.
   - **"0 inconsistencias entre motores" solo comparaba el número de filas.**
     Comparando el contenido, 6 de 50 referencias daban resultados distintos entre
     motores: S11 por un bug de zona horaria del sistema
     (`RENDIMIENTO_E_INTEGRIDAD.md`, bug 4, corregido); M19, C02, C04 y C07 por
     **empates en el corte del top N** (cada motor elegía otros registros
     empatados; se agregó desempate por id); M20 porque Postgres calculaba días
     fraccionarios (5,30) y los otros 3 días calendario (5,43): alineado a días
     calendario. Ahora las 50 dan **contenido idéntico** en los 4 motores, y
     `regresion_seguridad.mjs` compara contenido (verificado que detecta las 5
     referencias viejas).
   - Para la tesis: los "200/200, 50/50 consistentes" anteriores al 10/10 eran por
     número de filas.
3. ~~Banco de volumen alto en los 4 motores~~ — **hecho 24/10/2026**, a pedido de
   David. No quedó como una base separada: se alimentó **el mismo banco**, que pasó de
   2 233 a 1 485 641 filas (250 000 pedidos, 631 630 líneas, 50 000 clientes, 2 000
   productos). Las 2 233 filas base no cambiaron y se agregaron 5 índices compuestos
   (detalle en `Bases de datos/README.md`, «Volumen» e «Índices»). Las referencias
   se comparan contra el resultado en vivo, así que siguen sirviendo, pero ahora dan
   otros números (S01 = 50 000, etc.). `--modo prueba`: 200/200 exactos y 50/50 con
   el mismo resultado en los 4 motores. El generador descarta variantes de los datos
   con empates en el borde de un `LIMIT` de las referencias. El costo por llamada no
   cambia: el prompt lleva el esquema, no los datos. M02 y M03 devuelven 50 000 filas
   (~6 s cada una con la paginación).
4. ~~Auditoría de eficiencia del SQL de referencia~~ — **hecho 09/10/2026.** S10 y
   M13 filtraban con `EXTRACT(YEAR FROM order_date) = 2025` / `YEAR(order_date) =
   2025`, que impide usar el índice `ix_orders_date`; ahora usan
   `order_date >= '2025-01-01' AND order_date < '2026-01-01'` (S10 ya no necesita
   override para SQL Server). Resultados **idénticos** al SQL anterior en los 4
   motores (S10 = 104; M13 mes a mes igual). Barrido del resto buscando `SELECT *`,
   `NOT IN (SELECT…)`, `DISTINCT`, subconsultas en el `SELECT` y funciones sobre
   columnas en el `WHERE`: lo que aparece es legítimo (`DISTINCT` de S14 es la
   pregunta; `COUNT(DISTINCT…)` en C07/C09/C13 es la semántica; las funciones de
   fecha de M12/M13/M20 están en `SELECT`/`GROUP BY`, no en el filtro). Regresión:
   57/57 y 200/200. La auditoría con `EXPLAIN` sobre volumen alto ya se puede hacer:
   el banco tiene volumen desde el 24/10 (punto 3).
5. Paráfrasis (50): **borrador escrito 10/10/2026** (`parafrasis_50.json`,
   **aprobadas por David el 10/10 sin cambios**, `"estado": "revisada"`; el runner
   no gasta en paráfrasis sin revisar).
   David decidió incluirlas (10/10). Se escribieron sin tocar el diccionario de
   sinónimos de la poda. Medición gratis: en 2/50 la poda pierde tablas (M17 "ya se
   pagaron… despachado" → solo `orders`; C08 "más dinero han generado" → sin
   `orders`/`order_items`); 2/50 caen en esquema completo; promedio 2,44 tablas
   (originales 2,18). **No ajustar los sinónimos por esto**: sería volver a ajustar
   con el examen. Es el resultado de robustez a reportar. El banco de volumen alto
   (punto 3) puede hacerse después de la corrida: `EXPLAIN` sobre el SQL ya
   generado no necesita a Gemini.
6. ~~Runner nuevo~~ — **hecho 10/10/2026**: `nlqp/backend/scripts/evaluacion_gemini.mjs`
   (`npm run eval:gemini`). Opción (a) elegida por David: pasa por HTTP como el
   frontend (Firebase Auth → `/generateSQL` → `/executeQuery` → `/getResultPage`),
   con las llamadas marcadas como `origin=evaluacion` (`USO_Y_COSTOS.md`).
   - Modos: `--modo prueba` (gratis, usa la referencia como "SQL generado"),
     `--modo piloto` (S10, S13, M03, M05, C02 × 4 motores) y `--modo completa`;
     los pagados exigen `--confirmar` y tienen tope `--max-costo`. `--parafrasis`
     agrega las paráfrasis (solo si están revisadas). `--resumen` regenera el
     reporte sin llamadas.
   - Guarda cada caso en `nlqp/docs/evaluacion_gemini/resultados.jsonl` apenas lo
     obtiene y nunca repite una generación pagada; si solo falló la ejecución, la
     rehace con el SQL guardado. Renueva el token cada 50 min (y ante un 401);
     reintenta errores pasajeros de Vertex AI (429/503) con espera creciente.
   - Comparación por contenido: `exacto`, `columnas_extra` (las de la referencia y
     además otras), `empate_posible` (top N con el mismo puntaje y otros registros
     empatados: revisión manual, no cuenta como correcto), `distinto`,
     `bloqueada`, `error_*`. Números a 2 decimales, sin importar orden de filas,
     de columnas ni alias. Comparador probado con 17 casos sintéticos.
   - Antipatrones por detección estática (`SELECT *`, `NOT IN` con subconsulta,
     función sobre columna en `WHERE`, `LIMIT`/`TOP` no pedido, `DISTINCT` que la
     referencia no usa). **`EXPLAIN` no está en el runner**: se hace sobre el SQL ya
     guardado cuando exista el banco de volumen alto (punto 3), sin volver a pagar.
   - Escribe `nlqp/docs/evaluacion_gemini/resumen.md`: precisión por variante,
     categoría y motor, consistencia entre motores, robustez, seguridad, tokens,
     latencia, tablas enviadas, antipatrones y la lista para revisión manual.
   - Verificado gratis: `--modo prueba --parafrasis` → 400/400 exactos, 100/100
     preguntas con el mismo resultado en los 4 motores; resumen y filtro de origen
     probados.
7. Piloto pagado y corrida completa, con confirmación de costo. Comandos (con el
   backend levantado con `npm run build` y **`npm start`**, no `npm run dev`: en
   Windows `node --watch` se reinicia sin motivo y puede cortar una llamada ya
   cobrada):
   `npm run eval:gemini -- --modo piloto --parafrasis --confirmar` (40 llamadas,
   ~$0.10–0.16 con 3.8 Flash, tope automático $0.25) y luego
   `npm run eval:gemini -- --modo completa --parafrasis --confirmar`.
   **Hecho el 26–27/10: ver §9.**

## 9. Piloto y corrida completa (26–27/10/2026)

Gasto aprobado por David antes de cada paso. Pidió gastar **una sola vez**: todo lo que
se pueda rehacer se rehace sin llamar a Gemini (`--reevaluar`, `--resumen`).

### Piloto
`--modo piloto --parafrasis`: 40 llamadas, **$0.0947**. Revisado a mano: **37/40
correctos**. Los 3 errores son paráfrasis de M03, en las que el `INNER JOIN` deja
afuera a los clientes sin compras.

El piloto destapó dos problemas que no eran del modelo:
- **SQL Server rechazaba `COUNT(*)` sin alias** (lo daba E1 de la auditoría). Ahora las
  expresiones sin alias reciben un nombre legible en los 4 motores
  (`columnNames.service.ts`, `RENDIMIENTO_E_INTEGRIDAD.md` §2.1).
- **Referencias que contaban pedidos cancelados como ventas o compras.** Se alinearon
  con la regla de dominio del prompt («un pedido cancelado no es una venta ni una
  compra»):
  - C02;
  - M04, con su override de mssql;
  - M06, ahora `NOT EXISTS` sobre pedidos no cancelados;
  - C07, con su override de mssql;
  - C09.

  En todas cambiaba el resultado y no hay empates en los bordes. `test:seguridad` dio
  200/200 con 0 inconsistencias entre motores, y el piloto reevaluado sin costo siguió
  en 37/40. **Hay que declararlo en la tesis**: es la tercera corrección del conjunto de
  referencia (§3).

### Cambios durante la corrida
- **Vertex AI saturado.** Hubo esperas de 2 a 5 min, un 429 `RESOURCE_EXHAUSTED` y una
  llamada que cortó la corrida a los 303 s. Ninguna de esas fallas aparece cobrada en
  `usageEvents`.
- **Runner:**
  - `--reevaluar` vuelve a ejecutar y comparar el SQL guardado sin llamar a Gemini;
  - `UND_ERR_HEADERS_TIMEOUT` se reintenta en lugar de cortar la corrida.
- **Generación por partes con corte y reintento** (`vertexAI.service.ts`, con el «dale»
  de David). La espera depende de la complejidad de la consulta, no del volumen de
  datos; la ejecución mantiene su tope por conexión.
  - Usa `generateContentStream` con `includeThoughts`. El razonamiento solo se usa como
    señal de vida y nunca entra en el SQL.
  - Si no llega la primera parte en 20 / 40 / 80 s, reintenta, con un tope de 120 s por
    intento. Un 429 o 503 se reintenta a los 2 s.
  - `attempts` y `firstChunkMs` se guardan en las métricas y en el evento de uso.
  - En Consultar, a los 20 s aparece un aviso de demora.
  - Verificado: API 369/369, seguridad 57/57 + 200/200. Falta `test:ui`.

### Resultado automático (antes de la revisión a mano)
Fuente: `evaluacion_gemini/resumen.md`, con 400 casos y $0.8132 (incluye el piloto y
los 6 reintentos del 29/10).

| Grupo | Exacto | Exacto + columnas extra |
|---|---|---|
| Originales (200) | 59,5 % | 86,5 % |
| Paráfrasis (200) | 56,5 % | 79,5 % |
| Simple / intermedio / complejo (originales) | 73,3 / 60,0 / 45,0 % | 100 / 85,0 / 75,0 % |
| Postgres / MySQL / MariaDB / SQL Server | 60 / 58 / 55 / 59 % | 84 / 82 / 80 / 86 % |

- **Consistencia entre motores:** 77 de 100 preguntas dan el mismo resultado en los 4
  (71 antes del reintento). Sin contar columnas extra: **83/100**.
  **Decisión de David (29/10):** la consistencia del sistema se reporta como **83/100**. Se cuentan como consistentes las 6 preguntas en que los 4 motores traen lo de la referencia y solo difieren en columnas no pedidas (C08, C14, M01 par., M05 par., M07, S11). La medida estricta, por huella del resultado completo, da 77/100.
  Las otras 17: en 12 unos motores aciertan y otros no (M19 es «empate posible»), y en
  5 ningún motor acierta (C08 par., C13 orig. y par., M14 par., M20 orig.).
  En 23 casos la original acierta y la paráfrasis no.
- **Seguridad:** el Query Safety Engine no bloqueó ninguna consulta, no hubo límites no
  pedidos ni errores de ejecución, y la detección estática no encontró antipatrones.
- **Tokens:** en promedio, 712 de entrada, 70 de salida y 60 de razonamiento. Se
  enviaron 2,31 de 8 tablas.
- **Latencia de generación** (de `metrics.latencyMs`):

  | Tramo | Casos | Mediana | p95 | Máximo |
  |---|---|---|---|---|
  | Con corte y reintento | 332 | 4,9 s | 61 s | 133 s |
  | Piloto | 40 | 7,9 s | 80 s | 101 s |
  | Sin corte, con el servicio saturado | 22 | 11,6 s | 279 s | 303 s |

  - Con corte y reintento, 233 de 332 casos (70 %) tardaron 15 s o menos.
  - Intentos: 247 con uno, 68 con dos y 17 con tres.
  - El promedio general del resumen (19,3 s) mezcla los tres tramos: no usarlo solo.
- **6 errores de generación**, en los que Vertex no respondió en los 3 intentos:

  | ID | Variante | Motor |
  |---|---|---|
  | S05 | paráfrasis | mysql |
  | M08 | paráfrasis | mariadb |
  | M08 | original | mssql |
  | M09 | paráfrasis | mssql |
  | M11 | paráfrasis | mariadb |
  | M13 | original | mysql |

  Son fallas del servicio, no del modelo. **Reintentados el 29/10** (6 llamadas,
  $0.0085, aprobado por David): los 6 generaron SQL. Quedaron 4 exactos, 1 con
  columnas extra (S05 par. mysql) y 1 distinto (M08 original mssql). M09 par. mssql
  volvió a tardar 61,6 s. Errores de generación: 0.

### Revisión a mano (29/10)
Se revisaron las 68 filas no correctas (54 «distinto», 14 «empate posible»), agrupadas en
23 preguntas. Se ejecutaron la referencia y la generada por `/executeQuery` (Query Safety
Engine) y se compararon columna por columna. Sin llamadas a Gemini. La clasificación de
cada fila, con su causa, está en `evaluacion_gemini/revision_manual.json`.

**Por qué tantos «distinto» eran correctos:** si la referencia trae una columna
informativa que la pregunta no pide (el conteo de categorías en C09, de países en C13,
de pedidos en M14 y C15, el porcentaje en C05) y la generada no la trae, la comparación
automática da «distinto» aunque las filas sean las mismas (`comparar()`, caso
`gen.columnas.length <= ref.columnas.length`).

| Clasificación | Filas | Preguntas |
|---|---|---|
| Correcto: falta una columna no pedida (mismas filas y valores) | 33 | C15 ×8, C13 ×8, C09 ×6, M14 ×5, C05 ×4, C10 ×2 |
| Correcto: empate válido | 6 | M19: 4 010 clientes con el máximo de 3 direcciones; la pregunta no fija desempate |
| Correcto por decisión de David | 8 | M08 original ×4 (aplica «un cancelado no es venta» del prompt; la referencia no se alineó) y M06 paráfrasis ×4 («no aparecen en ninguna orden» es literal; la paráfrasis no era equivalente a «nunca se han vendido») |
| Ambigüedad: otra lectura válida | 10 | C03 par. ×2 (promedio con los que no compraron), C11 par. ×2 (categoría que más vende en unidades), M20 ×6 (días exactos o de calendario; filtro por DELIVERED) |
| Error de la poda | 6 | M17 par. ×4 (solo `orders`), C08 par. mysql y mariadb (sin `order_items`) |
| Error del modelo | 5 | M03 par. ×3 (`INNER JOIN` deja afuera a los clientes sin compras), C08 par. postgres y mssql (ingreso sin descuento) |

**Resultado después de la revisión** (correcto = exacto, columnas extra o correcto en la
revisión; las ambigüedades no se cuentan como correctas):

| Grupo | Correcto | Ambigüedad | Error de poda | Error del modelo |
|---|---|---|---|---|
| Originales (200) | **98,0 %** | 4 | 0 | 0 |
| Paráfrasis (200) | **91,5 %** | 6 | 6 | 5 |
| Total (400) | **94,8 %** | 10 (2,5 %) | 6 (1,5 %) | 5 (1,25 %) |
| Simple / intermedio / complejo, originales | 100 / 95,0 / 100 % | | | |
| Simple / intermedio / complejo, paráfrasis | 100 / 88,8 / 86,7 % | | | |
| Postgres / MySQL / MariaDB / SQL Server | 95 / 96 / 93 / 95 % | | | |

- **Consistencia entre motores** con el criterio de David (no cuentan las columnas no
  pedidas): **94/100** preguntas dan la misma respuesta en los 4 (los 4 correctos, o la
  misma huella). Antes de la revisión, 83/100; con la huella estricta, 77/100.
- **Robustez:** en 15 casos la original acierta y la paráfrasis no (23 antes de la
  revisión). Las preguntas originales no tienen errores; todos los errores son de
  paráfrasis, y 6 de 11 son de la poda (vocabulario que el diccionario no conoce), no
  del modelo.
- **Mitigación (David, 29/10):** se dará una capacitación a los usuarios sobre cómo
  formular las solicitudes. Los datos la respaldan: las 10 ambigüedades y los 6
  errores de poda vienen de cómo está redactada la pregunta.
- `resumen.md` sigue mostrando las cifras automáticas: el script no lee
  `revision_manual.json` (no se cambió).

### Eficiencia: `EXPLAIN` sin `ANALYZE` (29/10)
`backend/scripts/evaluacion_explain.mjs` pide el plan estimado de los 400 SQL generados y
de sus referencias en el banco de volumen (1,5 M de filas), sin ejecutarlos: Postgres
`EXPLAIN (FORMAT JSON)`, MySQL y MariaDB `EXPLAIN FORMAT=JSON`, SQL Server
`SHOWPLAN_XML`. Cada SQL pasó antes por `validateQuerySafety()`: 400/400 aprobados, 0
errores. Resultado en `evaluacion_gemini/explain.json`. Sin costo.

Como el costo estimado de cada motor está en unidades propias, se compara el del SQL
generado con el de su referencia en el mismo motor (razón generado / referencia).

| Razón de costo | Casos | % |
|---|---|---|
| ≤ 1,1 (igual o más barato) | 333 | 83,3 % |
| 1,1 a 2 | 41 | 10,3 % |
| 2 a 10 | 23 | 5,8 % |
| > 10 | 3 | 0,8 % |

- **374 de 400 (93,5 %)** cuestan como mucho el doble que la referencia, y 76 (19 %)
  son más baratos (< 0,9). La mediana es 1,0 en los 4 motores. Originales y paráfrasis
  dan casi lo mismo (≤ 2: 185 y 189 de 200).
- **Los 26 casos de más del doble** tienen tres causas:
  1. hacen más trabajo porque traen más información o aplican una regla: M14 y M02
     unen `customers` para mostrar el nombre; M08 original une `orders` para descontar
     los cancelados; C10 trae los dos montos por separado;
  2. son una particularidad del modelo de costos con SQL casi idéntico a la referencia:
     M09, M11 y M01 en MariaDB (sin `ORDER BY`, 5 veces el costo), S13 paráfrasis en
     Postgres (`COUNT(shipment_id)` en lugar de `COUNT(*)`), y S11 y M19 en SQL Server,
     con costos absolutos ínfimos;
  3. C03 original en MariaDB estima 421 veces el costo de la referencia, pero tardó
     1 461 ms, igual que en los otros motores (1 390–1 708 ms).
- **El costo estimado no anticipa el tiempo real.** Los tiempos de ejecución medidos en
  la corrida, en el mismo banco, son similares a los de los otros motores en los 26
  casos (por ejemplo, M14: 2,6–3,6 s en los 4). En los 400, la ejecución por HTTP tuvo
  una mediana de 415 ms, un p95 de 3,5 s y un máximo de 9,6 s (resultados de 50 000 filas
  con paginación).
- **Barridos completos de tabla:** 41 generados tienen alguno que la referencia no tiene,
  y 26 tienen menos. Los agregados son sobre tablas temporales de CTE (MySQL), tablas
  chicas (`categories`, 15 filas) o el `JOIN` con `customers` para traer el nombre.
- La detección estática de antipatrones no encontró ninguno (resumen automático).
- **Cálculo del costo:** en MySQL y MariaDB, el costo del bloque principal no incluye las
  CTE ni las subconsultas materializadas. Se suman todos los bloques del plan (sin eso,
  la referencia de C05 en MariaDB marcaba 0,19 en lugar de 1 210). MySQL estima sus
  estadísticas por muestreo, así que dos corridas dan costos levemente distintos (en 38
  de 400 cambió la razón, sin mover las conclusiones).
- **Índices compuestos en el prompt:** no hay evidencia de consultas ineficientes, así
  que no se mandan. **Decisión de David (29/10):** no mandarlos ahora, pero dejar el
  sistema listo por si una base los requiere. Desde el 29/10 se activan con
  `NLQP_PROMPT_INDICES_COMPUESTOS=true` (`vertexAI.service.ts`): cada tabla lista sus
  índices compuestos con las columnas en orden, más una regla de rendimiento. Apagado
  (por defecto), el prompt es idéntico al evaluado: verificado sin llamar a Gemini (2
  líneas de diferencia al encenderlo, ninguna apagado).

### Pendiente
Nada de la evaluación. Queda cargar las cifras en la tesis (`RESUMEN_PARA_DOC_TEORICO.md`).
