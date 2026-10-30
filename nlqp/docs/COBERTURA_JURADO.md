# Cobertura de las métricas de la tesis que el jurado puede señalar (29–31/10/2026)

Pedido de David (29/10): cubrir, con lo que queda de tiempo, las métricas de las
secciones 3.3 y 3.7 que no estaban medidas. Autorizó trabajar sin pedir permiso y
gastar en Gemini hasta USD 3, solo si hace falta. **No se inventan respuestas de la
encuesta**: se prepara el instrumento y se aplica a personas reales (o queda como
limitación).

**Si la sesión se corta, retomar desde la tabla:** el estado de cada punto y el comando
para continuar.

| # | Métrica (sección) | Estado | Cómo continuar |
|---|---|---|---|
| 1 | Disponibilidad ≥ 99 % (3.3.1.4) | 🟡 Monitor corriendo desde el 29/10 (proceso independiente) | Ver `--resumen` abajo. Si se detuvo, relanzarlo |
| 2 | Manejo correcto de errores (3.3.1.4) | ✅ **31/31** (`scripts/pruebas/api_errores.mjs`). La primera corrida dio 28/31 y encontró 2 defectos, corregidos: esquema vacío y mensaje vacío con la conexión rechazada. Seguridad 57/57 + 200/200, API 369/369 | — |
| 3 | Completitud de requerimientos (3.3.1.1) | ✅ 16/16 RF implementados y verificados (7 críticos) | Texto de la tesis: 6.7.5 |
| 4 | Consistencia por repetición (3.3.1.4) | ⏳ | Script de repetición y variantes (10 consultas) |
| 5 | Robustez con 10 × 3 variantes (3.3.1.2) | ⏳ | Mismo script |
| 6 | Tiempo de respuesta, segunda medición (3.3.1.3) | ⏳ | Sale de los puntos 4 y 5 |
| 7 | Encuesta de usabilidad (3.3.2, 3.7) | 🟡 Instrumento listo (`nlqp/docs/encuesta/`: guion, Google Form por script, análisis). **Falta aplicarlo a personas reales** (David) | Ver `encuesta/INSTRUMENTO.md` |

## 1. Disponibilidad

- Backend y monitor corren como procesos independientes de Claude Code (logs en
  `nlqp/backend/logs/`, no se versionan).
- Datos: `nlqp/docs/evaluacion_gemini/disponibilidad.jsonl`.
- Resumen: `cd nlqp/backend; node --env-file=.env scripts/monitor_disponibilidad.mjs --resumen`.
- Relanzar si la PC se reinició (PowerShell, en `nlqp/backend`):
  `Start-Process node -ArgumentList '--env-file=.env','lib/index.js' -WindowStyle Hidden -RedirectStandardOutput logs\backend.out.log -RedirectStandardError logs\backend.err.log`
  y lo mismo con `scripts/monitor_disponibilidad.mjs` (logs `monitor.*.log`).
- Si la PC se suspende no hay chequeos: el resumen lo informa como «sin medición».
