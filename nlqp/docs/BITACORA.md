# Bitácora — NLQP

Registro fechado de lo que se hizo, se verificó o se decidió. Lo más reciente
arriba. El detalle de cada tema está en el documento enlazado; acá solo va el qué y
el cuándo. **Al cerrar cada sesión de trabajo, agregar una entrada.**

---

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
