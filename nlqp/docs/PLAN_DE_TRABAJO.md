# Plan de trabajo actualizado — NLQP

Estado al 21 de septiembre de 2026 (reescrito completo; la versión anterior era
del 19/09). Cambios principales desde entonces: los dos bloqueos de cuentas de
nube se resolvieron, el Módulo 3 (NL2SQL + Query Safety Engine) quedó completo
y verificado con una llamada real a Vertex AI, el repositorio ya tiene
commits y está en GitHub, y se agregó una actividad nueva no contemplada en el
plan original — el módulo de uso y costos.

Alcance de la entrega en curso: **Capítulo 6 hasta la sección 6.2 inclusive**
(sin cambios — ver §3, es una decisión de alcance ya tomada, no de avance
técnico).

---

## 1. Estado general

| | |
|---|---|
| Actividades del Capítulo 6 (plan original) | 13 |
| Terminadas y verificadas | 8 |
| Parciales | 2 |
| Bloqueadas por cuentas de nube | 0 (antes 4) |
| No iniciadas | 3 |
| Actividad nueva fuera del plan original | 1 (módulo de uso y costos — backend terminado) |
| **Incluidas en esta entrega** | **3** (Módulo 1 y las dos de Módulo 2, sin cambios) |

El avance técnico sigue por delante del alcance de esta entrega. Se documenta
hasta 6.2 por decisión de alcance, no por falta de material.

---

## 2. Estructura del plan con estado real

| Actividad | Estado real | Entrega |
|---|---|---|
| **Capítulo 6 — Desarrollo de la aplicación** | | |
| Módulo 1: Gestión segura de conexiones | Completo y verificado en los 4 motores | **Esta entrega** |
| Módulo 2: Extracción e interpretación de esquema | Completo y verificado | **Esta entrega** |
| · Inspección de esquema: PostgreSQL y MySQL | Completo | **Esta entrega** |
| · Inspección de esquema: MariaDB y SQL Server; normalización | Completo | **Esta entrega** |
| Módulo 3: Generación NL2SQL y Query Safety Engine | **Completo** | Siguiente |
| · Diseño de prompt y estrategia de schema pruning | Completo y verificado | Siguiente |
| · Integración con Vertex AI Gemini Pro | **Completo y verificado** — proyecto `proyectog-340d3`, llamada real confirmada | Siguiente |
| · Implementación del Query Safety Engine | Completo y verificado, 17/17 | Siguiente |
| · Pruebas de generación SQL en los cuatro motores | **Parcial** — 200/200 ejecuciones verificadas con SQL de referencia; falta repetir la corrida generando con Gemini para las métricas reales | Siguiente |
| Frontend Next.js y autenticación de interfaz | No iniciado — infraestructura lista (Firebase Auth habilitado), ya no bloqueado | Posterior |
| Módulo 4: Herramientas de apoyo para usuarios técnicos | No iniciado | Posterior |
| Módulo 5: Historial y gestión de consultas guardadas | No iniciado — infraestructura lista (Firestore habilitado), ya no bloqueado | Posterior |
| Integración de módulos y pruebas del sistema | Parcial: revisión de seguridad y pruebas multimotor hechas; falta integrar con frontend | Siguiente |
| Presentación del prototipo funcional | No iniciado | Posterior |
| **Cierre y entrega** | | |
| Conclusiones y revisión final del documento | No iniciado | Final |
| Entrega PG2 | — | Final |
| **Fuera del plan original** | | |
| Módulo de uso y costos (registro de tokens/costo de Vertex AI y uso general en Firestore, endpoint de estadísticas) | **Completo y verificado (backend)** — dashboard visual pendiente del frontend | A definir dónde encaja en la estructura formal de tesis |

---

## 3. Qué entra en esta entrega

Tres actividades, todas terminadas y verificadas contra los cuatro motores reales:

**Módulo 1 — Gestión segura de conexiones.** Administrador de conexiones con controladores
por motor, separación entre metadatos y credenciales mediante Secret Manager, prueba de
conectividad con diagnóstico diferenciado de fallos. Verificado en PostgreSQL, MySQL,
MariaDB y SQL Server con cuentas de solo lectura. Incluye una corrección de seguridad
aplicada durante la revisión.

**Módulo 2 — Extracción e interpretación de esquema.** Capa de abstracción multimotor con
una implementación de introspección por motor y una representación normalizada común.
Verificado: ocho tablas y ocho relaciones de clave foránea correctamente identificadas en
los cuatro motores, con representación equivalente.

El texto redactado para ambas secciones está en `nlqp/docs/CAPITULO_6_Y_PLAN.md`, listo
para pegar.

---

## 4. Material terminado que queda fuera de esta entrega

Conviene tenerlo presente para la planificación, porque no requiere trabajo adicional
—solo redacción— cuando decidas incorporarlo:

| Contenido | Estado | Comentario |
|---|---|---|
| Query Safety Engine (6.3.3) | Verificado, 17/17 | Incluye el hallazgo del bypass en Transact-SQL, explotado y corregido |
| Poda de esquema (6.3.1) | Verificado | Incluye el diccionario español–inglés como hallazgo |
| Ejecución controlada (6.3.4) | Verificado, 200/200 | Con la aclaración de que el SQL es de referencia |
| Revisión de seguridad (6.7) | Completa | 6 hallazgos: 3 corregidos, 3 documentados |
| **Integración con Vertex AI Gemini Pro** | **Verificado con llamada real** | Nuevo desde 19/09 — texto aún no redactado en `CAPITULO_6_Y_PLAN.md` |
| **Módulo de uso y costos** | **Completo (backend)** | Actividad nueva, fuera del alcance original — ver `nlqp/docs/USO_Y_COSTOS.md`; falta decidir su numeración formal en la tesis y redactar el texto |

El Query Safety Engine sigue siendo el componente más defendible y verificado. La
integración con Vertex AI ahora también está verificada end-to-end — es la pieza que
falta redactar con mayor peso para la siguiente entrega, porque valida la hipótesis
central de la tesis.

---

## 5. Bloqueos

**Ninguno actualmente.** Los dos bloqueos de cuentas de nube que frenaban seis
actividades (proyecto de Google Cloud con Vertex AI, proyecto de Firebase con
Authentication y Firestore) se resolvieron el 21/09/2026 — proyecto unificado
`proyectog-340d3`. Lo único pendiente que no se resuelve con código es
coordinar a los 35 participantes de la encuesta (ver §6).

---

## 6. Secuencia recomendada para el siguiente tramo

1. ~~Crear el proyecto de Google Cloud y habilitar Vertex AI.~~ **Hecho (21/09).**

2. **Ejecutar el conjunto de cincuenta consultas generando el SQL** en lugar de usar el de
   referencia. Es el paso pendiente más importante ahora mismo: cierra la sección de
   pruebas de generación y produce las métricas de precisión, reducción de tokens,
   robustez lingüística y consistencia que sostienen la hipótesis de la tesis. Como cada
   corrida llama a Vertex AI 50 veces, tiene un costo real (pequeño, del orden de
   fracciones de dólar en total con el pricing actual) — confirmar antes de correrla.

3. ~~Crear el proyecto de Firebase.~~ **Hecho (21/09).** Authentication y Firestore
   habilitados.

4. **Construir el frontend**, y con él las herramientas técnicas y el historial. Es la mayor
   carga de trabajo restante, pero ya sin bloqueos externos. También es lo que habilita el
   dashboard visual del módulo de uso y costos.

5. **Integración final y prototipo funcional.**

6. **Coordinar los 35 participantes de la encuesta.** Sigue siendo lo único que no se
   resuelve con código y requiere anticipación: son 35 personas durante dos semanas.
   Conviene empezar a convocarlos en paralelo al desarrollo, no al final.

---

## 7. Riesgos abiertos

| Riesgo | Impacto | Acción |
|---|---|---|
| Las métricas de generación real (precisión, tokens, robustez) todavía no se midieron — solo se probó que el pipeline funciona | Bloquea la defensa de la hipótesis, no solo el capítulo | Correr las 50 consultas generando con Gemini (§6, paso 2) |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo en la sección 3.6 | Empezar a convocar ahora |
| El Capítulo 5 menciona 42 tablas y una reducción del 71 % | El banco tiene 8 tablas: la cifra es irreproducible | Sustituir por la medición real cuando exista |
| Las bases de datos corren en contenedores locales | No serán alcanzables desde el backend desplegado | Decidir dónde vivirán para la evaluación |
| Cambios documentales pendientes en los capítulos 1 a 4 | Modelo de organización, esquema cacheado, índices y versión de Node | Aplicar antes de la entrega final |
| Sin crédito de prueba en la cuenta de Google Cloud, cualquier uso de Vertex AI se factura de verdad | Bajo (fracciones de centavo por llamada), pero hay que avisar antes de cada corrida grande | Confirmar con David antes de corridas masivas (ej. las 50 consultas) |
