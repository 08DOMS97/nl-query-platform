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
### Corte 10/10/2026

**Proyecto: plan 96 % · real 90 % · diferencia -6.4 puntos → vamos atrasados.** Excel: `Claude outputs/Plan_de_Trabajo_PG2 10-10-2026.xlsx`; foto: `plan/cortes/2026-10-10.json`.

Lo que más pesa en el atraso: Módulo 4: Herramientas de apoyo para usuarios técnicos (0 % de 100 %); Correcciones de figuras, rótulos y numeración del capítulo (0 % de 100 %); Módulo 5: Historial y gestión de consultas guardadas (0 % de 100 %); Frontend Next.js y autenticación de interfaz (85 % de 100 %); Pruebas de generación SQL en los cuatro motores (70 % de 100 %).

| No. | Tarea | Inicio | Fin | %plan | %real | Dif. | Comentario |
|---|---|---|---|---|---|---|---|
| 1 | **Proyecto NL-Query-Platform** | 01/06 | 17/10 | 96 % | 90 % | -6 |  |
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
| 15 | **Capítulo 5 - Diseño de la aplicación** | 31/08 | 08/09 | 100 % | 78 % | -22 |  |
| 16 | · Diagramas UML de comportamiento (casos de uso, actividades, secuencias) | 31/08 | 01/09 | 100 % | 100 % | +0 |  |
| 17 | · Diagramas UML de estructura (componentes, objetos, clases) | 02/09 | 03/09 | 100 % | 100 % | +0 |  |
| 18 | · Modelo lógico de datos del almacenamiento interno | 03/09 | 03/09 | 100 % | 100 % | +0 |  |
| 19 | · Diagramas de infraestructura sobre GCP | 04/09 | 04/09 | 100 % | 100 % | +0 |  |
| 20 | · Redacción e integración del texto del capítulo | 04/09 | 04/09 | 100 % | 100 % | +0 |  |
| 39 | · Correcciones de figuras, rótulos y numeración del capítulo | 07/09 | 08/09 | 100 % | 0 % | -100 | Sin empezar. Incluye reemplazar la cifra de 71 % sobre 42 tablas por la medición real (43,4 % del prompt), ver RESUMEN_PARA_DOC_TEORICO.md. |
| 21 | **Capítulo 6 - Desarrollo de la aplicación** | 07/09 | 14/10 | 94 % | 80 % | -14 |  |
| 22 | · Módulo 1: Gestión segura de conexiones | 07/09 | 11/09 | 100 % | 100 % | +0 | Completo y verificado en los 4 motores (sección 6.1). |
| 23 | **· Módulo 2: Extracción e interpretación de esquema** | 14/09 | 25/09 | 100 % | 100 % | +0 |  |
| 24 | · · Inspección de esquema: PostgreSQL y MySQL | 14/09 | 18/09 | 100 % | 100 % | +0 | Completo y verificado (sección 6.2.1). |
| 25 | · · Inspección de esquema: MariaDB y SQL Server; normalización | 21/09 | 25/09 | 100 % | 100 % | +0 | Completo y verificado; 8 tablas y 8 FK en los 4 motores (sección 6.2.2). |
| 26 | **· Módulo 3: Generación NL2SQL y Query Safety Engine** | 21/09 | 02/10 | 100 % | 96 % | -4 |  |
| 27 | · · Diseño de prompt y estrategia de schema pruning | 21/09 | 23/09 | 100 % | 100 % | +0 | Poda con sinónimos ES-EN y prompt por dialecto (CHECKs, reglas de dominio, índices, reglas de rendimiento). 09/10: poda rediseñada (núcleo + camino más corto de FK), ver tarea 44. |
| 44 | · · Rediseño de la poda de esquema y medición de tokens 🆕 | 09/10 | 09/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 09/10: 5,56 → 2,18 tablas enviadas, 0/50 consultas pierden tablas, 43,4 % menos tokens del prompt (countTokens). |
| 28 | · · Integración con Vertex AI Gemini Pro | 24/09 | 28/09 | 100 % | 100 % | +0 | Probado en vivo: pregunta en español, SQL de Gemini, validación y ejecución en PostgreSQL. 09/10: SDK migrado (tarea 43) y llamada real verificada: SQL correcto y eficiente, $0.012, 14,5 s. |
| 43 | · · Migración del SDK de Vertex AI a @google/genai 🆕 | 09/10 | 09/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 09/10: el SDK anterior estaba deprecado. Verificada con una llamada real. |
| 29 | · · Implementación del Query Safety Engine | 29/09 | 30/09 | 100 % | 100 % | +0 | Batería 17/17 y bypass de SQL Server corregido. 08/10: endurecido, batería de 57 casos versionada (tarea 42). |
| 42 | · · Endurecimiento del Query Safety Engine y batería de regresión versionada 🆕 | 08/10 | 08/10 | 100 % | 100 % | +0 | Tarea nueva, implementada 08/10: literales, funciones de archivo y de ejecución de SQL como texto; batería de 57 casos + 50 consultas en 4 motores (npm run test:seguridad). |
| 30 | · · Pruebas de generación SQL en los cuatro motores | 01/10 | 02/10 | 100 % | 70 % | -30 | 10/10: 70 %. Hecho: runner de evaluación por HTTP (probado gratis 400/400), 50 referencias con resultado idéntico en los 4 motores (C10, empates, M20 corregidos), 50 paráfrasis aprobadas. Falta: piloto (~$0.50), corrida completa con Gemini (~$4.25) y análisis de resultados; antes del retiro del modelo (~20/10). |
| 40 | · · Control de tiempo de ejecución e integridad de resultados 🆕 | 01/10 | 02/10 | 100 % | 100 % | +0 | Tarea nueva (agregada 02/10, sección 6.3.5): tope de tiempo en los 4 motores, lectura por streaming, snapshot con paginación y CSV completo. 10/10: corregido bug de zona horaria (fechas distintas según el motor). |
| 31 | · Frontend Next.js y autenticación de interfaz | 21/09 | 02/10 | 100 % | 85 % | -15 | v1: login, registro, flujo motor-pregunta-SQL-ejecutar, paginación y descarga CSV verificadas en navegador. Falta: probar "Generar SQL" con Gemini desde la interfaz, distinguir perfiles técnico/no técnico y dashboard de uso y costos. |
| 41 | · Módulo de uso y costos (tokens y costo por llamada en Firestore) 🆕 | 21/09 | 21/09 | 100 % | 100 % | +0 | Tarea nueva, implementada 21/09 (backend): registro de tokens, costo y latencia por llamada y endpoint de estadísticas. 10/10: separa el uso normal de las corridas de evaluación. Falta el dashboard en el frontend. |
| 32 | · Módulo 4: Herramientas de apoyo para usuarios técnicos | 05/10 | 07/10 | 100 % | 0 % | -100 | Sin empezar (plan 05–07/10). Se hará solo si hay tiempo después de la evaluación y el historial; si no, alcance reducido. |
| 33 | · Módulo 5: Historial y gestión de consultas guardadas | 08/10 | 09/10 | 100 % | 0 % | -100 | Sin empezar (plan 08–09/10). Prioridad después de la corrida con Gemini: versión mínima (guardar, listar y reutilizar consultas). |
| 34 | · Integración de módulos y pruebas del sistema | 12/10 | 13/10 | 0 % | 0 % | +0 |  |
| 35 | · Presentación del prototipo funcional | 14/10 | 14/10 | 0 % | 0 % | +0 |  |
| 36 | **Cierre y entrega** | 15/10 | 17/10 | 0 % | 0 % | +0 |  |
| 37 | · Conclusiones y revisión final del documento | 15/10 | 16/10 | 0 % | 0 % | +0 |  |
| 38 | · Entrega PG2 | 17/10 | 17/10 | 0 % | 0 % | +0 |  |

🆕 = tarea nueva, fuera del plan original, ya implementada (azul en el Excel).
<!-- corte:fin -->

## Riesgos abiertos

| Riesgo | Impacto | Acción |
|---|---|---|
| Retiro de `gemini-2.5-pro` en Vertex AI (no antes del 20/10/2026, provisorio) | Después del retiro la generación deja de funcionar, incluida la demo | Correr la evaluación antes del 14/10; confirmar la fecha en la consola antes de cada corrida (`PREPARACION_EVALUACION_GEMINI.md` §8, 2c) |
| M4 y M5 atrasados con presentación el 14/10 | El prototipo se presenta incompleto | Evaluación primero, M5 mínimo después, M4 solo si sobra tiempo |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo (sección 3.6) | Convocar ya; no depende de código |
| Mucho texto de tesis por aplicar (Cap. 1–6) en los días de cierre (15–16/10) | Entrega con texto desactualizado | Ir aplicando `RESUMEN_PARA_DOC_TEORICO.md` durante la semana |
| La latencia de generación (~14,5 s en una consulta simple) está al borde del umbral de 15 s de la sección 3.3.1.3 | La hipótesis de tiempo de respuesta puede no cumplirse | Medirla en la corrida completa y discutirla en resultados |
| El banco de pruebas es chico (200 clientes, 300 pedidos) | La eficiencia con mucho volumen no queda demostrada | Banco grande con `EXPLAIN` si sobra tiempo; si no, limitación declarada |
| Vertex AI sin crédito de prueba | Cada llamada se factura (~$0.012) | Confirmar con David antes de cada corrida |

Riesgos cerrados (detalle en `BITACORA.md`): SDK deprecado → migrado (09/10); poda que
casi no podaba → rediseñada (09/10); referencias inconsistentes → corregidas (02/10 y
10/10); texto de 6.3.3 inexacto → corregido (08/10); bases solo en local → se presenta
en local (01/10); bloqueos de cuentas de nube → resueltos (21/09).
