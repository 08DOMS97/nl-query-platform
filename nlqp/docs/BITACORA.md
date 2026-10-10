# Bitácora — NLQP

Registro fechado de lo que se hizo, se verificó o se decidió. Lo más reciente
arriba. El detalle de cada tema está en el documento enlazado; acá solo va el qué y
el cuándo. **Al cerrar cada sesión de trabajo, agregar una entrada.**

---

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
