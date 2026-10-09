# Preparación de la evaluación con Gemini (2026-10-02, actualizada 2026-10-08)

Trabajo previo a correr las 50 consultas de prueba **generando el SQL con Gemini**
(hasta ahora se habían corrido con el SQL de referencia escrito a mano). Objetivo:
que la corrida mida al modelo y al sistema, y no fallas de configuración o de las
propias referencias — y no pagar dos veces la misma corrida por errores evitables.

Estado: **en preparación, la corrida todavía no se ejecutó.** Nada de lo de este
documento llamó a Vertex AI con costo.

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

Nota para el Capítulo 6: los resultados de `resultados_consultas_prueba.md`
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

Con el presupuesto de razonamiento de Gemini 2.5 Pro (`THINKING_BUDGET_TOKENS =
1024`), cada llamada cuesta hasta ~$0.011 (el razonamiento se factura como salida a
$10/M). La estimación anterior de ~$0.05 para toda la corrida era incorrecta: no
contaba el razonamiento.

| Corrida | Llamadas | Costo estimado |
|---|---|---|
| Piloto (5 consultas × 4 motores) | 20 | ~$0.05–0.2 |
| 50 consultas × 4 motores | 200 | ~$0.5–2.5 |
| + 50 paráfrasis × 4 motores | 400 en total | ~$1–5 |

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
- Timeout de 60 s; guardián de costo previo con `EXPLAIN`, después y calibrado.

## 8. Pendiente antes de la corrida

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
2c. **Riesgo nuevo (verificado 02/10/2026): retiro del modelo `gemini-2.5-pro` en
   Vertex AI.** La página oficial de versiones de modelos de Vertex AI indica
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
3. Banco de volumen alto en los 4 motores (base separada; no toca los resultados
   fijos del banco actual).
4. Auditoría de eficiencia del SQL de referencia. Ya detectado: S10 y M13 filtran con
   `EXTRACT(YEAR FROM order_date) = 2025`, que impide usar el índice
   `ix_orders_date`; lo eficiente es un rango de fechas.
5. Paráfrasis (50), revisadas por David antes de guardarlas. (08/10: si no se
   revisan antes del piloto, quedan como trabajo futuro; el banco de volumen alto
   (punto 3) puede hacerse después de la corrida, porque `EXPLAIN` sobre el SQL ya
   generado no necesita a Gemini.)
6. Runner nuevo: modo de prueba gratuito, piloto, guardado incremental (no repetir
   llamadas pagadas), renovación del token, reintentos ante 429, comparación de
   resultados, `EXPLAIN`/antipatrones/latencia.
7. Piloto pagado y corrida completa, con confirmación de costo.
