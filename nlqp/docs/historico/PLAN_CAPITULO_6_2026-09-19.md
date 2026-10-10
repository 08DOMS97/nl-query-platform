# Plan del Capítulo 6 al 19/09/2026 (histórico)

> Separado de CAPITULO_6_Y_PLAN.md el 10/10/2026. No refleja el estado actual: ver CLAUDE.md.

Estado al 19 de septiembre de 2026, sobre la estructura de tu plan.

## Capítulo 6 — Desarrollo de la aplicación

| Actividad | Estado | Puede escribirse |
|---|---|---|
| Módulo 1: Gestión segura de conexiones | **Completo y verificado** | Sí — sección 6.1 |
| Módulo 2: Extracción e interpretación de esquema | **Completo y verificado** | Sí — sección 6.2 |
| · Inspección: PostgreSQL y MySQL | Completo | Sí — 6.2.1 |
| · Inspección: MariaDB y SQL Server; normalización | Completo | Sí — 6.2.2 |
| Módulo 3: Generación NL2SQL y Query Safety Engine | **Parcial** | Parcial |
| · Diseño de prompt y estrategia de schema pruning | Poda completa; prompt sin verificar | Sí — 6.3.1 |
| · Integración con Vertex AI Gemini Pro | **Bloqueado** — falta proyecto GCP | No |
| · Implementación del Query Safety Engine | **Completo y verificado** | Sí — 6.3.3 |
| · Pruebas de generación SQL en los cuatro motores | **Bloqueado** — depende de la generación | Parcial — 6.3.4 cubre la ejecución |
| Frontend Next.js y autenticación de interfaz | **Bloqueado** — falta proyecto Firebase | No |
| Módulo 4: Herramientas de apoyo para usuarios técnicos | No iniciado | No |
| Módulo 5: Historial y gestión de consultas guardadas | **Bloqueado** — falta Firestore | No |
| Integración de módulos y pruebas del sistema | **Parcial** | Sí — sección 6.7 |
| Presentación del prototipo funcional | No iniciado | No |

**Cierre y entrega:** sin iniciar, depende de lo anterior.

## Lectura del avance

De trece actividades del Capítulo 6, **cinco están terminadas y verificadas**, dos van
parciales y seis no pueden empezar. Podés escribir aproximadamente el 45 % del capítulo hoy
mismo, y es la parte más difícil: los dos módulos de infraestructura contra cuatro motores
reales y el componente de seguridad con un hallazgo crítico documentado.

Lo que falta no está frenado por dificultad técnica. Está frenado por dos cuentas.

## El camino crítico

```
Proyecto GCP con Vertex AI habilitado
        ↓
6.3.2 Integración con Vertex AI  →  6.3.4 Pruebas de generación
        ↓
Métricas de precisión, tokens, robustez y consistencia
```

```
Proyecto Firebase (Auth + Firestore)
        ↓
6.4 Frontend  →  6.5 Módulo 4  →  6.6 Módulo 5
        ↓
6.8 Prototipo funcional  →  Encuesta con 35 usuarios
```

Vertex AI desbloquea dos secciones y todas las métricas de la hipótesis. Firebase desbloquea
cuatro secciones y la verificación de la variable dependiente. **Firebase bloquea más
capítulo; Vertex AI bloquea más tesis.**

## Orden recomendado

1. **Crear el proyecto de Google Cloud y habilitar Vertex AI.** El código del servicio ya
   está escrito. Con solo poner el identificador de proyecto en la configuración se
   desbloquea la sección 6.3.2.

2. **Ejecutar el conjunto de cincuenta consultas generando el SQL**, en lugar de usar el de
   referencia. De esa única corrida salen la sección 6.3.4 completa y cuatro métricas del
   capítulo de resultados.

3. **Crear el proyecto de Firebase.** Habilita Authentication y Firestore, y con ellos las
   secciones 6.4, 6.5 y 6.6.

4. **Construir frontend, herramientas técnicas e historial.** Es la mayor carga de trabajo
   restante, pero sin bloqueos externos una vez creado el proyecto.

5. **Coordinar los 35 participantes de la encuesta.** Es lo único que no se resuelve con
   código y necesita anticipación: son 35 personas durante dos semanas.

## Riesgos abiertos

| Riesgo | Impacto |
|---|---|
| Sin proyecto GCP no hay métrica central de la hipótesis | Bloquea la defensa, no solo el capítulo |
| Sin los 35 participantes no se verifica la variable dependiente | Obliga a reducir la muestra y documentarlo en la sección 3.6 |
| El Capítulo 5 menciona 42 tablas y una reducción del 71 % | El banco tiene 8 tablas; la cifra es irreproducible y debe corregirse |
| Las bases corren en contenedores locales | No serán alcanzables desde el backend desplegado; decidir dónde vivirán para la evaluación |
| No hay commits en el repositorio | Riesgo de pérdida; ya ocurrió con los documentos de la auditoría inicial |
| Quedan pendientes los cambios documentales de los capítulos 1 a 4 | Organización, esquema cacheado, índices y versión de Node |
