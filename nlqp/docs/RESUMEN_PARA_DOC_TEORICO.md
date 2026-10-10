# Resumen para el documento teórico

Lista de trabajo para el **documento principal de la tesis** (el Word). Ordenada por
capítulo y sección, no por fecha, para saber exactamente dónde tocar. Solo entra lo que
cambia lo que la tesis **afirma, mide o describe**; los detalles técnicos internos van a
`BITACORA.md`.

**Cómo se usa**

- `[ ]` pendiente · `[x]` aplicado en el Word · `[?]` no se sabe si ya está en el Word:
  David lo confirma y se marca `[x]` o `[ ]`.
- Cada entrada: **(fecha) Acción** (agregar / reemplazar / corregir / eliminar / redactar)
  → dónde → con qué datos o texto → de qué documento sale.
- Cuando David pasa algo al Word, avisa ("ya pasé el 6.3.4") y se marca `[x]` con la
  fecha. Las entradas `[x]` se dejan (sirven de historial), pero se pasan al final de
  su sección.
- El texto ya redactado para pegar está en `CAPITULO_6.md`. Este archivo dice **qué**
  hacer; ese tiene **el texto**.

## Contador (actualizado 2026-10-10)

| Capítulo | Pendientes `[ ]` | Por verificar `[?]` | Aplicados `[x]` |
|---|---|---|---|
| 1–4 | 4 | 1 | 0 |
| 5 | 3 | 0 | 0 |
| 6 | 13 | 3 | 0 |
| Conclusiones / limitaciones | 5 | 0 | 0 |
| **Total** | **25** | **4** | **0** |

---

## Capítulos 1 a 4

- [?] (19/09) **Revisar cambios documentales anotados el 19/09**: "modelo de
  organización, esquema cacheado, índices y versión de Node". El detalle de qué había
  que cambiar no quedó registrado en el repo: **David confirma qué era**. Datos actuales
  para contrastar: el backend corre en **Node 22**; el esquema **no** se guarda en caché
  (se extrae en cada generación); los índices sí se leen de los 4 motores y se marcan
  en el prompt (`PREPARACION_EVALUACION_GEMINI.md` §4).
- [ ] (02/10) **Agregar requisitos no funcionales** (cap. de requerimientos, si
  corresponde): (a) las consultas generadas deben ser **eficientes** con mucho
  volumen; (b) **nunca truncar resultados** en silencio: timeout de 60 s y límite de
  1 GB son todo o nada, resultados completos por páginas y CSV. Fuente:
  `RENDIMIENTO_E_INTEGRIDAD.md`.
- [ ] (10/10) **3.3.1.2 — niveles de complejidad**: contrastar la definición formal
  con la clasificación usada en las 50 consultas (15 simples, 20 intermedias, 15
  complejas; criterios en `PREPARACION_EVALUACION_GEMINI.md` §2).
- [ ] (10/10) **3.3.1.3 — umbrales de tiempo**: la generación de una consulta
  **simple** tardó **14,5 s** (llamada real del 09/10, casi todo es razonamiento del
  modelo), contra un umbral de **15 s**. Confirmar con la corrida completa y decidir si
  el umbral se mantiene o se discute en resultados. Fuente: `BITACORA.md` 09/10.
- [ ] (19/09) **3.6 — muestra**: si no se consiguen los 35 participantes, documentar
  la muestra reducida.

## Capítulo 5 — Diseño de la aplicación

- [ ] (09/10) **Reemplazar** "reducción del 71 % sobre 42 tablas" (irreproducible: el
  banco tiene 8 tablas) por: "la poda redujo el prompt en **43,4 %** en promedio
  (1238 → 701 tokens; simples 51,3 %, intermedias 43,2 %, complejas 35,8 %); sobre la
  parte de esquema la reducción es de **~72 %**; medido con `countTokens` sobre las 50
  consultas". Aclarar cuál cifra es cuál. Fuente: `PREPARACION_EVALUACION_GEMINI.md`
  §8, 2f.
- [ ] (09/10) **Corregir la descripción de la poda** si el Cap. 5 la describe como
  "tablas coincidentes + vecinas por clave foránea": desde el 09/10 es **núcleo**
  (tablas nombradas + tablas con una columna distintiva) **+ camino más corto de FK**
  entre ellas, con **fail-open** (esquema completo) si nada coincide. Fuente: ídem.
- [ ] (plan 28–29/09) **Correcciones de figuras, rótulos y numeración** del capítulo
  (actividad del plan, en 0 %).

## Capítulo 6 — Desarrollo de la aplicación

Texto base en `CAPITULO_6.md`.

### 6.1 y 6.2 — Conexiones y esquema
- [?] (19/09) Texto de 6.1 y 6.2 de `CAPITULO_6.md`: era el alcance de la entrega
  anterior; verificar que esté en el Word.

### 6.3.1 — Prompt y poda de esquema
- [ ] (09/10) **Reescribir el segundo párrafo**: el texto actual describe la poda
  vieja ("se agregan las tablas relacionadas por clave foránea"). Nueva: núcleo +
  camino más corto + fail-open; la versión anterior enviaba 5,56 tablas en promedio
  para preguntas que necesitan 1,76, porque `orders` está conectada con casi todo, y
  la nueva envía **2,18**, sin perder tablas necesarias en ninguna de las 50.
- [ ] (09/10) **Agregar** el hallazgo: con la poda vieja "clientes" nunca coincidía
  (se singularizaba a "client") y dos consultas perdían la tabla `customers`; solo
  funcionaba porque enviaba casi todo el esquema.
- [ ] (02/10) **Agregar** el contenido del prompt: valores permitidos de columnas
  categóricas (leídos de los `CHECK`), reglas de dominio (excluir pedidos cancelados
  en montos de venta; pagos solo `COMPLETED`), marcas de índice y reglas de
  rendimiento. Fuente: `PREPARACION_EVALUACION_GEMINI.md` §4.

### 6.3.2 — Integración con Vertex AI Gemini Pro
- [ ] (10/10) **Redactar la sección** (hoy dice "pendiente"; ya se puede escribir):
  Gemini 2.5 Pro vía Vertex AI (`proyectog-340d3`), temperatura 0, presupuesto de
  razonamiento 1024 tokens, salida máxima 4096, error explícito si la respuesta se
  corta; SDK `@google/genai` (migrado el 09/10 desde `@google-cloud/vertexai`,
  deprecado); costo medido **~$0.012 por consulta**, casi todo razonamiento (998 de
  1024 tokens), latencia 14,5 s. Retiro del modelo anunciado no antes del 20/10/2026.
  Fuentes: `PREPARACION_EVALUACION_GEMINI.md` §8 (2b, 2c), `USO_Y_COSTOS.md`.

### 6.3.3 — Query Safety Engine
- [?] (08/10) Texto reescrito en `CAPITULO_6.md` (batería de 57 casos, literales,
  funciones prohibidas, subsección "Segunda revisión"): verificar que esté en el Word.

### 6.3.4 — Pruebas de ejecución controlada
- [ ] (08/10) **Corregir** "cuya integración se encuentra pendiente según se indica en
  la sección 6.3.2": la integración está verificada desde el 21/09.
- [ ] (10/10) **Corregir** el párrafo de equivalencia: hoy dice "comparando el número
  de registros… conteos idénticos". Reemplazar por: se compara el **resultado
  completo (filas y valores)**, y las 50 dan resultados idénticos en los 4 motores.
- [ ] (10/10) **Agregar** las dos correcciones del conjunto de referencia, con qué se
  aprendió de cada una:
  1. (02/10) 5 referencias inconsistentes con los pedidos cancelados (M03, M07, M12,
     M13, C11), unificadas con una regla de dominio.
  2. (10/10) Al comparar contenido y no solo conteos: empates en el corte de los "top
     N" (M19, C02, C04, C07: cada motor elegía otros registros empatados → desempate
     determinista), M20 calculaba días de dos formas, C10 recortaba con un `LIMIT` que
     la pregunta no pedía, y un **defecto del sistema** de zona horaria (MySQL/MariaDB
     corrían las fechas 6 h y Postgres las columnas `DATE`), corregido.
  La Tabla 14 sigue siendo válida (200/200). Fuente: `PREPARACION_EVALUACION_GEMINI.md`
  §8, 2g; `RENDIMIENTO_E_INTEGRIDAD.md`, bug 4.

### 6.3.5 (nueva) — Evaluación de la generación con Gemini
- [ ] (10/10) **Redactar cuando termine la corrida** (pendiente: piloto y corrida
  completa). Métricas: precisión por ejecución (exacto / con columnas extra), por
  nivel y por motor; consistencia entre motores; robustez con paráfrasis; reducción
  de tokens; costo y latencia; seguridad (consultas bloqueadas); antipatrones. Datos:
  `evaluacion_gemini/resumen.md`. Método de comparación: `PREPARACION_EVALUACION_GEMINI.md`
  §8 punto 6.

### 6.4 — Frontend y autenticación
- [ ] (10/10) **Redactar** (ya se puede: Firebase listo desde el 21/09): login y
  registro con Firebase Authentication, token enviado al backend en cada llamada,
  flujo motor → pregunta → SQL → ejecutar → resultados paginados + CSV completo.
  Falta el dashboard de uso y costos.

### 6.5 y 6.6 — Módulos 4 y 5
- [ ] (10/10) Redactar según lo que se construya; si no da el tiempo, documentar como
  alcance reducido.

### 6.7 — Integración y pruebas del sistema
- [ ] (10/10) **Ampliar la Tabla 15** con los hallazgos 7 a 11 de `SEGURIDAD.md`:
  caída del backend ante un resultado demasiado grande (Alta, corregido); descarga de
  CSV sin autenticación de Firebase (Baja, mitigado por diseño); falsos positivos con
  palabras reservadas dentro de textos (Baja, corregido); funciones de lectura de
  archivos no bloqueadas por el validador (Baja, corregido); batería de pruebas no
  versionada (Baja, corregido).
- [ ] (02/10) **Agregar subsección "Rendimiento e integridad de resultados"**
  (actividad fuera del plan original): timeout de 60 s en el motor, ejecución única con
  snapshot, paginación, CSV completo, principio de "nunca truncar en silencio".
  Fuente: `RENDIMIENTO_E_INTEGRIDAD.md`.
- [?] (21/09) **Módulo de uso y costos** (actividad nueva): decidir dónde va en la
  estructura formal (¿6.7 o sección propia?) y redactarlo. Fuente: `USO_Y_COSTOS.md`.

### 6.8 — Presentación del prototipo
- [ ] Redactar después del 14/10.

## Conclusiones y limitaciones

- [ ] (09/10) **Limitación**: el diccionario de sinónimos de la poda se ajustó con las
  mismas 50 preguntas de la evaluación. Medido con las paráfrasis (antes de la
  corrida): en 2 de 50 la poda pierde tablas (M17, C08). Se decidió **no** ajustarlo
  para no sesgar el resultado.
- [ ] (10/10) **Limitación**: las 50 consultas y sus paráfrasis las redactó el mismo
  asistente que conoce el esquema, no usuarios reales.
- [ ] (02/10) **Limitación**: el banco de pruebas es chico (200 clientes, 300
  pedidos); la eficiencia con mucho volumen se evaluará con `EXPLAIN` sobre un banco
  grande o queda como trabajo futuro.
- [ ] (08/10) **Limitación / riesgo**: dependencia de un modelo con fecha de retiro
  (`gemini-2.5-pro`, no antes del 20/10/2026); cambiar de modelo obliga a revisar el
  prompt y repetir la evaluación.
- [ ] (09/10) **Dato para la discusión**: el costo por consulta (~$0.012) y la
  latencia (~14 s) están dominados por el razonamiento del modelo, no por el tamaño
  del prompt: la poda reduce poco el costo total (~$0.0007 por consulta).
