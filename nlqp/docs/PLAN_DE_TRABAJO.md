# Plan de trabajo actualizado — NLQP

Estado al 19 de septiembre de 2026.
Alcance de la entrega en curso: **Capítulo 6 hasta la sección 6.2 inclusive.**

---

## 1. Estado general

| | |
|---|---|
| Actividades del Capítulo 6 | 13 |
| Terminadas y verificadas | 5 |
| Parciales | 2 |
| Bloqueadas por cuentas de nube | 4 |
| No iniciadas | 2 |
| **Incluidas en esta entrega** | **3** (Módulo 1 y las dos de Módulo 2) |

El avance técnico es mayor que el alcance de esta entrega. Se documenta hasta 6.2 por
decisión de alcance, no por falta de material.

---

## 2. Estructura del plan con estado real

| Actividad | Estado real | Entrega |
|---|---|---|
| **Capítulo 6 — Desarrollo de la aplicación** | | |
| Módulo 1: Gestión segura de conexiones | Completo y verificado en los 4 motores | **Esta entrega** |
| Módulo 2: Extracción e interpretación de esquema | Completo y verificado | **Esta entrega** |
| · Inspección de esquema: PostgreSQL y MySQL | Completo | **Esta entrega** |
| · Inspección de esquema: MariaDB y SQL Server; normalización | Completo | **Esta entrega** |
| Módulo 3: Generación NL2SQL y Query Safety Engine | Parcial | Siguiente |
| · Diseño de prompt y estrategia de schema pruning | Poda completa y verificada; prompt escrito, sin ejecutar | Siguiente |
| · Integración con Vertex AI Gemini Pro | Código escrito, sin verificar — **bloqueado** | Siguiente |
| · Implementación del Query Safety Engine | **Completo y verificado**, 17/17 | Siguiente |
| · Pruebas de generación SQL en los cuatro motores | Ejecución verificada (200/200); generación bloqueada | Siguiente |
| Frontend Next.js y autenticación de interfaz | No iniciado — **bloqueado** | Posterior |
| Módulo 4: Herramientas de apoyo para usuarios técnicos | No iniciado | Posterior |
| Módulo 5: Historial y gestión de consultas guardadas | No iniciado — **bloqueado** | Posterior |
| Integración de módulos y pruebas del sistema | Parcial: revisión de seguridad y pruebas multimotor hechas | Siguiente |
| Presentación del prototipo funcional | No iniciado | Posterior |
| **Cierre y entrega** | | |
| Conclusiones y revisión final del documento | No iniciado | Final |
| Entrega PG2 | — | Final |

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
| Query Safety Engine (6.3.3) | **Verificado, 17/17** | Incluye el hallazgo del bypass en Transact-SQL, explotado y corregido |
| Poda de esquema (6.3.1) | Verificado | Incluye el diccionario español–inglés como hallazgo |
| Ejecución controlada (6.3.4) | Verificado, 200/200 | Con la aclaración de que el SQL es de referencia |
| Revisión de seguridad (6.7) | Completa | 6 hallazgos: 3 corregidos, 3 documentados |

El Query Safety Engine es el componente más defendible de todo lo construido y ya está
verificado. Queda a tu criterio si lo sumás a esta entrega o lo reservás para la siguiente.

---

## 5. Bloqueos

Dos cuentas frenan seis actividades. Ninguna de ellas requiere trabajo técnico previo.

**Proyecto de Google Cloud con Vertex AI habilitado** — bloquea la integración con el
modelo y las pruebas de generación. El servicio ya está implementado; falta el
identificador de proyecto en la configuración del backend.

**Proyecto de Firebase con Authentication y Firestore** — bloquea el frontend, el Módulo 4,
el Módulo 5 y, en consecuencia, la presentación del prototipo.

```
Google Cloud + Vertex AI
        └── Integración con Gemini Pro  →  Pruebas de generación

Firebase (Auth + Firestore)
        └── Frontend  →  Módulo 4  →  Módulo 5  →  Prototipo funcional
```

Firebase bloquea más actividades del capítulo. Vertex AI bloquea las métricas que verifican
la hipótesis.

---

## 6. Secuencia recomendada para el siguiente tramo

1. **Crear el proyecto de Google Cloud y habilitar Vertex AI.** Desbloquea la integración
   con el modelo, que ya está codificada.

2. **Ejecutar el conjunto de cincuenta consultas generando el SQL** en lugar de usar el de
   referencia. Esa única corrida cierra la sección de pruebas de generación y produce las
   métricas de precisión, reducción de tokens, robustez lingüística y consistencia.

3. **Crear el proyecto de Firebase.** Habilita Authentication y Firestore.

4. **Construir el frontend**, y con él las herramientas técnicas y el historial. Es la mayor
   carga de trabajo restante, pero sin bloqueos externos.

5. **Integración final y prototipo funcional.**

6. **Coordinar los 35 participantes de la encuesta.** Es lo único que no se resuelve con
   código y requiere anticipación: son 35 personas durante dos semanas. Conviene empezar a
   convocarlos en paralelo al desarrollo, no al final.

---

## 7. Riesgos abiertos

| Riesgo | Impacto | Acción |
|---|---|---|
| Sin proyecto de Google Cloud no hay métrica central de la hipótesis | Bloquea la defensa, no solo el capítulo | Crear el proyecto y habilitar Vertex AI |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo en la sección 3.6 | Empezar a convocar ahora |
| El Capítulo 5 menciona 42 tablas y una reducción del 71 % | El banco tiene 8 tablas: la cifra es irreproducible | Sustituir por la medición real cuando exista |
| Las bases de datos corren en contenedores locales | No serán alcanzables desde el backend desplegado | Decidir dónde vivirán para la evaluación |
| El repositorio no tiene commits | Riesgo de pérdida; ya ocurrió con los documentos de la auditoría inicial | Hacer el commit inicial |
| Cambios documentales pendientes en los capítulos 1 a 4 | Modelo de organización, esquema cacheado, índices y versión de Node | Aplicar antes de la entrega final |
