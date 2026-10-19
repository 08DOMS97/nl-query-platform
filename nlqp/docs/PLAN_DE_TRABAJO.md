# Plan de trabajo — NLQP

**El plan base no se cambia.** Las tareas y fechas son las del plan de David
(`Plan_de_Trabajo_PG2`); aunque el trabajo real vaya en otras fechas, se mide contra
esa línea base para ver si vamos adelantados, al día o atrasados. Lo nuevo que no
estaba en el plan entra como **fila nueva resaltada** (implementada), sin mover las
fechas de las demás.

**Cómo se actualiza** (ver `plan/`):
1. Editar el avance en `plan/plan.json`: `real` (0–1) y `comentario` de cada tarea.
   Tarea nueva: agregarla con `"nueva": {"agregada": …, "implementada": …}`.
2. `python nlqp/docs/plan/generar_corte.py AAAA-MM-DD` → genera
   `Claude outputs/Plan_de_Trabajo_PG2 DD-MM-AAAA.xlsx` (mismo formato que el
   original: %plan por fechas, %real, diferencia, pesos, comentarios en %real), la
   foto `plan/cortes/AAAA-MM-DD.json` y la tabla de abajo.
3. Un corte por fecha: los anteriores no se pisan.

El estado diario y el próximo paso están en `CLAUDE.md`; el historial en `BITACORA.md`.

## Último corte

<!-- corte:inicio (generado, no editar a mano) -->
### Corte 18/10/2026

**Proyecto: plan 92 % · real 93 % · diferencia +0.9 puntos → vamos al día.** Excel: `Claude outputs/Plan_de_Trabajo_PG2 18-10-2026.xlsx`; foto: `plan/cortes/2026-10-18.json`.

Lo que más pesa en el atraso: Presentación del prototipo funcional (0 % de 100 %); Frontend Next.js y autenticación de interfaz (95 % de 100 %); Pruebas de generación SQL en los cuatro motores (70 % de 100 %); Integración de módulos y pruebas del sistema (80 % de 100 %).

| No. | Tarea | Inicio | Fin | %plan | %real | Dif. | Comentario |
|---|---|---|---|---|---|---|---|
| 1 | **Proyecto NL-Query-Platform** | 01/06 | 31/10 | 92 % | 93 % | +1 |  |
| 2 | **Capítulo 3 - Análisis y Diseño** | 01/06 | 14/08 | 100 % | 100 % | +0 |  |
| 3 | **· Análisis de la situación propuesta** | 01/06 | 26/06 | 100 % | 100 % | +0 |  |
| 4 | · · Levantamiento de requerimientos y factibilidad | 01/06 | 12/06 | 100 % | 100 % | +0 |  |
| 5 | · · Definición de metodología y marco de investigación | 15/06 | 19/06 | 100 % | 100 % | +0 |  |
| 6 | · · Definición de arquitectura y stack tecnológico | 22/06 | 26/06 | 100 % | 100 % | +0 |  |
| 7 | · Investigación y fundamentación teórica del sistema | 29/06 | 24/07 | 100 % | 100 % | +0 |  |
| 8 | · Diseño metodológico, métricas e instrumentos de evaluación | 27/07 | 14/08 | 100 % | 100 % | +0 |  |
| 9 | **Capítulo 4 - Análisis de la aplicación** | 17/08 | 04/09 | 100 % | 100 % | +0 |  |
| 10 | · Descripción del proyecto y alcance funcional | 17/08 | 19/08 | 100 % | 100 % | +0 |  |
| 11 | · Identificación de usuarios y actores del sistema | 20/08 | 21/08 | 100 % | 100 % | +0 |  |
| 12 | · Modelado del negocio bajo RUP | 24/08 | 26/08 | 100 % | 100 % | +0 |  |
| 13 | · Especificación de requerimientos funcionales y no funcionales | 27/08 | 28/08 | 100 % | 100 % | +0 |  |
| 14 | · Revisión con asesor e integración del capítulo | 31/08 | 04/09 | 100 % | 100 % | +0 |  |
| 15 | **Capítulo 5 - Diseño de la aplicación** | 31/08 | 08/09 | 100 % | 100 % | +0 |  |
| 16 | · Diagramas UML de comportamiento (casos de uso, actividades, secuencias) | 31/08 | 01/09 | 100 % | 100 % | +0 |  |
| 17 | · Diagramas UML de estructura (componentes, objetos, clases) | 02/09 | 03/09 | 100 % | 100 % | +0 |  |
| 18 | · Modelo lógico de datos del almacenamiento interno | 03/09 | 03/09 | 100 % | 100 % | +0 |  |
| 19 | · Diagramas de infraestructura sobre GCP | 04/09 | 04/09 | 100 % | 100 % | +0 |  |
| 20 | · Redacción e integración del texto del capítulo | 04/09 | 04/09 | 100 % | 100 % | +0 |  |
| 39 | · Correcciones de figuras, rótulos y numeración del capítulo | 07/09 | 08/09 | 100 % | 100 % | +0 | 10/10: hecho en el Word revisado. 5.1.2, 5.1.3, 5.1.5 y 5.2 corregidos (caché de esquema como mejora futura; Figura 5 como ejemplo ilustrativo, con el 72 % medido); Tabla 10 vacía eliminada y leyendas con numeración automática. Las Figuras 2 y 5 no se redibujaron (decisión del 10/10). |
| 21 | **Capítulo 6 - Desarrollo de la aplicación** | 07/09 | 14/10 | 100 % | 95 % | -5 |  |
| 22 | · Módulo 1: Gestión segura de conexiones | 07/09 | 11/09 | 100 % | 100 % | +0 | Completo y verificado en los 4 motores (sección 6.1). 13/10: registro de conexiones (Firestore + Secret Manager) con alta, prueba, edición y baja del técnico desde la pantalla Conexiones; Consultar y Esquema eligen entre las conexiones registradas. Verificado 38/38 API + 27/27 UI. |
| 23 | **· Módulo 2: Extracción e interpretación de esquema** | 14/09 | 25/09 | 100 % | 100 % | +0 |  |
| 24 | · · Inspección de esquema: PostgreSQL y MySQL | 14/09 | 18/09 | 100 % | 100 % | +0 | Completo y verificado (sección 6.2.1). |
| 25 | · · Inspección de esquema: MariaDB y SQL Server; normalización | 21/09 | 25/09 | 100 % | 100 % | +0 | Completo y verificado; 8 tablas y 8 FK en los 4 motores (sección 6.2.2). |
| 41 | · Módulo de uso y costos (tokens y costo por llamada en Firestore) 🆕 | 21/09 | 21/09 | 100 % | 100 % | +0 | Tarea nueva, implementada 21/09 (backend): registro de tokens, costo y latencia por llamada y endpoint de estadísticas. 10/10: separa el uso normal de las corridas de evaluación. Falta el dashboard en el frontend. |
| 31 | · Frontend Next.js y autenticación de interfaz | 21/09 | 02/10 | 100 % | 95 % | -5 | 10/10: rediseño completo (pantallas por módulo, menú según el rol, blanco + naranja claro, IBM Plex) y perfiles técnico/no técnico. Verificado en navegador 12/12. 13/10: pantalla Conexiones con formulario y selector de conexiones en Consultar y Esquema; pruebas versionadas (npm run test:ui: 13/13 + 27/27). Falta: probar "Generar SQL" con Gemini desde la interfaz. |
| 26 | **· Módulo 3: Generación NL2SQL y Query Safety Engine** | 21/09 | 02/10 | 100 % | 96 % | -4 |  |
| 27 | · · Diseño de prompt y estrategia de schema pruning | 21/09 | 23/09 | 100 % | 100 % | +0 | Poda con sinónimos ES-EN y prompt por dialecto (CHECKs, reglas de dominio, índices, reglas de rendimiento). 09/10: poda rediseñada (núcleo + camino más corto de FK), ver tarea 44. |
| 28 | · · Integración con Vertex AI Gemini Pro | 24/09 | 28/09 | 100 % | 100 % | +0 | Probado en vivo: pregunta en español, SQL de Gemini, validación y ejecución en PostgreSQL. 09/10: SDK migrado (tarea 43) y llamada real verificada: SQL correcto y eficiente, $0.012, 14,5 s. 18/10: cambio a Gemini 3.8 Flash (tarea 46): S10 correcto, $0.0012, 2,9 s. |
| 29 | · · Implementación del Query Safety Engine | 29/09 | 30/09 | 100 % | 100 % | +0 | Batería 17/17 y bypass de SQL Server corregido. 08/10: endurecido, batería de 57 casos versionada (tarea 42). |
| 30 | · · Pruebas de generación SQL en los cuatro motores | 01/10 | 02/10 | 100 % | 70 % | -30 | 10/10: 70 %. Hecho: runner de evaluación por HTTP (probado gratis 400/400), 50 referencias con resultado idéntico en los 4 motores (C10, empates, M20 corregidos), 50 paráfrasis aprobadas. Falta: piloto (~$0.50), corrida completa con Gemini (~$4.25) y análisis de resultados; antes del retiro del modelo (~20/10). 18/10: sigue en 70 %. El modelo pasó a Gemini 3.8 Flash (tarea 46): el piloto cuesta ~$0.10–0.16 y la corrida completa ~$0.80–1.60; ya no hay apuro por el retiro. |
| 40 | · · Control de tiempo de ejecución e integridad de resultados 🆕 | 01/10 | 02/10 | 100 % | 100 % | +0 | Tarea nueva (agregada 02/10, sección 6.3.5): tope de tiempo en los 4 motores, lectura por streaming, snapshot con paginación y CSV completo. 10/10: corregido bug de zona horaria (fechas distintas según el motor). |
| 32 | · Módulo 4: Herramientas de apoyo para usuarios técnicos | 05/10 | 07/10 | 100 % | 100 % | +0 | Hecho el 10/10 (plan 05–07/10): roles por custom claim aplicados en el backend; rol técnico con SQL editable y consumo, conexiones + pool, esquema y uso y costos. Verificado 23/23 API + 12/12 UI. Falta pasarlo al Word con su captura. 17/10: 100 %. Documentado en el Word (sección 6.5), con la Figura 10. |
| 42 | · Endurecimiento del Query Safety Engine y batería de regresión versionada 🆕 | 08/10 | 08/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 08/10: literales, funciones de archivo y de ejecución de SQL como texto; batería de 57 casos + 50 consultas en 4 motores (npm run test:seguridad). |
| 33 | · Módulo 5: Historial y gestión de consultas guardadas | 08/10 | 09/10 | 100 % | 100 % | +0 | Versión mínima hecha el 10/10 (plan 08–09/10): historial automático y consultas guardadas por el usuario, reusar sin llamar a Gemini. Verificado 32/32 API + 10/10 UI. Falta la captura y pasarlo al Word; fuera: búsqueda, carpetas, compartir. 17/10: 100 %. Documentado en el Word (sección 6.6). |
| 43 | · Migración del SDK de Vertex AI a @google/genai 🆕 | 09/10 | 09/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 09/10: el SDK anterior estaba deprecado. Verificada con una llamada real. |
| 44 | · Rediseño de la poda de esquema y medición de tokens 🆕 | 09/10 | 09/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 09/10: 5,56 → 2,18 tablas enviadas, 0/50 consultas pierden tablas, 43,4 % menos tokens del prompt (countTokens). |
| 34 | · Integración de módulos y pruebas del sistema | 12/10 | 13/10 | 100 % | 80 % | -20 | 17/10: 80 %. Pruebas de API, interfaz y seguridad en el repo y documentadas (sección 6.7). Falta probar "Generar SQL" con Gemini desde la interfaz. |
| 45 | · Edición del SQL por origen y auditoría de cambios 🆕 | 13/10 | 13/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 13/10 a pedido de David: el técnico edita la sentencia generada y las guardadas (las del historial se guardan antes de editarlas), «Guardar cambios», y auditoría de cada edición ejecutada o guardada (lo reemplazado, quién, fecha y hora) en la pestaña Cambios. Verificado 25/25 API + 23/23 UI. |
| 35 | · Presentación del prototipo funcional | 14/10 | 14/10 | 100 % | 0 % | -100 |  |
| 46 | · Cambio de modelo a Gemini 3.8 Flash por el retiro de Gemini 2.5 Pro 🆕 | 18/10 | 18/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 18/10 a pedido de David: Gemini 2.5 Pro se retira de Vertex AI el 20/10. gemini-3.8-flash en global (GA, hasta 02/09/2027 o más), razonamiento LOW, precios $1.50/$7.50. Verificado: seguridad 57/57 + 200/200, API 38/38 · 23/23 · 32/32 · 25/25, S10 real correcto ($0.0012, 2,9 s). |
| 36 | **Cierre y entrega** | 15/10 | 31/10 | 24 % | 47 % | +24 |  |
| 37 | · Conclusiones y revisión final del documento | 15/10 | 30/10 | 25 % | 50 % | +25 | 10/10: 30 %, antes de su fecha. Hecho: revisión del documento en el Word revisado (correcciones de los caps. 1 a 5, índices, capítulos en página impar, párrafos de máximo 12 líneas). Falta: reescribir las Conclusiones con los resultados de la corrida, recalcular 1.6.3 y la revisión final antes de entregar. 17/10: 50 %. Revisión del Word casi completa (M1, M4, M5, formato, tablas reducidas, índices). Falta: conclusiones. Fecha de fin movida al 30/10 porque la universidad pasó la entrega al 31/10. |
| 38 | · Entrega PG2 | 31/10 | 31/10 | 0 % | 0 % | +0 |  |

🆕 = tarea nueva, fuera del plan original, ya implementada (azul en el Excel).
<!-- corte:fin -->

## Riesgos abiertos

| Riesgo | Impacto | Acción |
|---|---|---|
| M4 y M5 atrasados con presentación el 14/10 | El prototipo se presenta incompleto | Evaluación primero, M5 mínimo después, M4 solo si sobra tiempo |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo (sección 3.6) | Convocar ya; no depende de código |
| Mucho texto de tesis por aplicar (Cap. 1–6) en los días de cierre (15–16/10) | Entrega con texto desactualizado | Ir aplicando `RESUMEN_PARA_DOC_TEORICO.md` durante la semana |
| La latencia de generación puede acercarse al umbral de 15 s de la sección 3.3.1.3 (con 2.5 Pro: ~14,5 s en una consulta simple; con 3.8 Flash: 2,9 s, 18/10) | La hipótesis de tiempo de respuesta puede no cumplirse en consultas complejas | Medirla en la corrida completa y discutirla en resultados |
| El banco de pruebas es chico (200 clientes, 300 pedidos) | La eficiencia con mucho volumen no queda demostrada | Banco grande con `EXPLAIN` si sobra tiempo; si no, limitación declarada |
| Vertex AI sin crédito de prueba | Cada llamada se factura (~$0.001–0.004 con 3.8 Flash; ~$0.012 con 2.5 Pro) | Confirmar con David antes de cada corrida |

Riesgos cerrados (detalle en `BITACORA.md`): retiro de `gemini-2.5-pro` (20/10) →
cambio a `gemini-3.8-flash`, vigente hasta el 02/09/2027 o más (18/10); SDK deprecado → migrado (09/10); poda que
casi no podaba → rediseñada (09/10); referencias inconsistentes → corregidas (02/10 y
10/10); texto de 6.3.3 inexacto → corregido (08/10); bases solo en local → se presenta
en local (01/10); bloqueos de cuentas de nube → resueltos (21/09).
