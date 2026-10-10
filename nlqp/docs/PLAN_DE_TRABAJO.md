# Plan de trabajo — NLQP (reescrito 2026-10-10)

Solo **plan y riesgos**. El estado actual y el próximo paso están en `CLAUDE.md` (raíz);
el historial, en `BITACORA.md`. Este archivo se toca al replanificar o cuando cambia un
riesgo. Plan original con fechas: `Claude outputs/Plan_de_Trabajo_PG2 02-10-2026.xlsx`.
Versión anterior (21/09–09/10) en el historial de git.

## Plan hasta la entrega

| Fechas | Actividad | Qué incluye | Si no da el tiempo |
|---|---|---|---|
| 10–11/10 | Evaluación con Gemini | Piloto (~$0.50) y corrida completa con paráfrasis (~$4.25 más); revisión manual de los casos dudosos | **No se recorta**: es la métrica central de la hipótesis |
| 11–12/10 | M5 historial (mínimo) | Guardar pregunta + SQL en Firestore, listarlos y reutilizarlos desde el frontend | Documentar como alcance reducido |
| 12–13/10 | Integración y prueba del prototipo | Flujo completo desde la UI con Gemini real, ensayo de la presentación | — |
| 12–13/10 | M4 herramientas técnicas | Solo si sobra tiempo | Alcance reducido / trabajo futuro |
| **14/10** | **Presentación del prototipo** | En local | — |
| 15–16/10 | Documento | Aplicar `RESUMEN_PARA_DOC_TEORICO.md` (Cap. 1–6), conclusiones y limitaciones, figuras del Cap. 5 | — |
| **17/10** | **Entrega PG2** | | |

Fuera de plan, solo si sobra tiempo: dashboard de uso y costos en el frontend, banco de
volumen alto con `EXPLAIN` (puede hacerse después de la corrida, sin volver a pagar
Gemini).

## Riesgos abiertos

| Riesgo | Impacto | Acción |
|---|---|---|
| Retiro de `gemini-2.5-pro` en Vertex AI (no antes del 20/10/2026, provisorio) | Después del retiro la generación deja de funcionar, incluida la demo | Correr la evaluación antes del 14/10; confirmar la fecha en la consola antes de cada corrida (`PREPARACION_EVALUACION_GEMINI.md` §8, 2c) |
| M4 y M5 atrasados con presentación el 14/10 | El prototipo se presenta incompleto | Evaluación primero, M5 mínimo después, M4 solo si sobra tiempo |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo (sección 3.6) | Convocar ya; no depende de código |
| Mucho texto de tesis por aplicar (Cap. 1–6) en 2 días (15–16/10) | Entrega con texto desactualizado | Ir aplicando `RESUMEN_PARA_DOC_TEORICO.md` durante la semana, no todo al final |
| La latencia de generación (~14,5 s en una consulta simple) está al borde del umbral de 15 s de la sección 3.3.1.3 | La hipótesis de tiempo de respuesta puede no cumplirse | Medirla en la corrida completa y discutirla en resultados |
| El banco de pruebas es chico (200 clientes, 300 pedidos) | La eficiencia con mucho volumen no queda demostrada | Banco grande con `EXPLAIN` si sobra tiempo; si no, limitación declarada |
| Vertex AI sin crédito de prueba | Cada llamada se factura (~$0.012) | Confirmar con David antes de cada corrida |

## Riesgos cerrados (resumen; detalle en `BITACORA.md`)

SDK deprecado → migrado (09/10). Poda que casi no podaba → rediseñada (09/10).
Referencias inconsistentes → corregidas (02/10 y 10/10). Texto de 6.3.3 inexacto →
validador corregido y texto reescrito (08/10). Bases solo en local → se presenta en
local (01/10). Bloqueos de cuentas de nube → resueltos (21/09).
