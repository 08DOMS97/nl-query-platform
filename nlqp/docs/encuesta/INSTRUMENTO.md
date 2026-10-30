# Encuesta de usabilidad de NLQP — instrumento y guion de la sesión

Instrumento de la sección 3.3.2 de la tesis: cinco dimensiones en escala Likert de 5
puntos, alineadas con la característica de usabilidad de ISO/IEC 25010. Los criterios
de verificación están en la sección 3.7:

- promedio ≥ 4.0 en al menos tres de las cinco dimensiones;
- al menos el 70 % de los participantes dispuesto a adoptar el sistema en lugar del
  proceso manual.

**Las respuestas deben venir de personas reales que usaron el sistema.** Si la muestra
es menor que la de la sección 3.6 (35: 25 no técnicos y 10 técnicos), se reporta como
aplicación piloto con muestra reducida, con el número real de participantes.

## Archivos

| Archivo | Para qué |
|---|---|
| `INSTRUMENTO.md` | Este documento: guion, tareas y preguntas |
| `crear_formulario.gs` | Crea el Google Form con todas las preguntas (pegar en script.google.com y ejecutar) |
| `analizar_encuesta.py` | Lee el CSV de respuestas de Google Forms y calcula los criterios de 3.7 |

## Preparación (una vez)

1. Backend y frontend levantados en el servidor; desde la red, `http://<IP>:3000`.
2. Cuentas de la demo (contraseñas en `nlqp/backend/.env`):
   - no técnico: `nlqp-usuario@example.com`;
   - técnico: `nlqp-test@example.com`.
   Si hay varios participantes a la vez, el superadministrador puede crear una cuenta
   por persona desde la pantalla Usuarios.
3. Crear el formulario: abrir https://script.google.com, proyecto nuevo, pegar
   `crear_formulario.gs`, ejecutar `crearFormulario` y autorizar. En el registro de
   ejecución aparecen el enlace para responder y el de edición.
4. Costo: cada pregunta al sistema cuesta unos USD 0.002 en Gemini. Una sesión de cinco
   tareas cuesta alrededor de USD 0.01 por participante.

## Guion de la sesión (10 a 15 minutos por participante)

1. **Presentación (1 min).** «NLQP permite consultar la base de datos de la empresa
   escribiendo preguntas en español. Vamos a hacer cinco tareas cortas y después hay
   una encuesta de 2 minutos. No se evalúa a la persona sino al sistema; no hay
   respuestas incorrectas.»
2. **Consentimiento.** La participación es voluntaria y anónima: la encuesta no pide el
   nombre. Los datos se usan solo para la tesis.
3. **Tareas.** El participante las hace solo; quien conduce la sesión no ayuda salvo
   que la persona se bloquee más de 2 minutos (anotarlo). Conexión: la tienda de
   prueba.

| # | Tarea (se le da por escrito) | Qué se observa |
|---|---|---|
| T1 | Averigüe cuántos clientes hay en cada país | Formula la pregunta sin ayuda |
| T2 | Averigüe cuánto se vendió en cada mes de 2025, sin contar los pedidos cancelados | Entiende el resultado |
| T3 | Encuentre los 5 productos que más dinero han generado | Usa el resultado para responder |
| T4 | Descargue el resultado anterior en Excel y ábralo | Encuentra el botón; el archivo se entiende |
| T5 | Guarde la consulta de T3 con un nombre y vuelva a ejecutarla desde el historial | Reutiliza sin escribir la pregunta otra vez |
| T6 (solo técnicos) | Revise el SQL de T2 y cambie el año a 2024 antes de ejecutarlo | Lee y edita el SQL |

4. **Registro de quien conduce la sesión** (opcional, en una hoja aparte): tareas
   completadas sin ayuda, tiempo aproximado de cada una y comentarios espontáneos.
5. **Encuesta (2 min)** en el Google Form.

## Preguntas del formulario

**Sección 1. Perfil**

1. ¿Cuál describe mejor su rol? (opción única)
   - Usuario de negocio (no trabajo con bases de datos)
   - Usuario técnico (sistemas, TI, DBA, desarrollo)
2. ¿Con qué frecuencia necesita datos o reportes de las bases de la organización?
   (opción única) Diaria / Semanal / Mensual / Rara vez
3. Hoy, cuando necesita un reporte, ¿cómo lo obtiene? (opción única)
   - Lo pido al área de TI o a un compañero técnico
   - Lo hago yo mismo con SQL o una herramienta técnica
   - Otro

**Sección 2. Evaluación** — escala de 1 (totalmente en desacuerdo) a 5 (totalmente de
acuerdo)

| Dimensión (ISO/IEC 25010) | Afirmación |
|---|---|
| D1 Facilidad de formulación (capacidad de aprendizaje) | P1. Me resultó fácil escribir mis preguntas en lenguaje natural. |
| | P2. Pude hacer las consultas sin conocer SQL ni la estructura de la base de datos. |
| D2 Claridad de los resultados (operabilidad) | P3. Los resultados se presentaron de forma clara y fácil de entender. |
| | P4. Pude usar el resultado (ver, descargar o guardar) sin ayuda. |
| D3 Confianza en el resultado (fiabilidad percibida) | P5. Confío en que los datos mostrados responden a lo que pregunté. |
| | P6. Usaría estos resultados para tomar una decisión o entregar un reporte. |
| D4 Velocidad de respuesta (rendimiento percibido) | P7. El sistema respondió en un tiempo aceptable. |
| | P8. Obtener el dato con el sistema fue más rápido que pedirlo por el proceso habitual. |
| D5 Satisfacción y disposición de adopción | P9. En general, estoy satisfecho con el sistema. |
| | P10. Recomendaría el sistema a otras personas de mi organización. |

**Sección 3. Adopción**

11. ¿Usaría NLQP en lugar de pedir el reporte por el proceso habitual? (opción única)
    Sí / No / No estoy seguro — para el criterio del 70 % cuenta solo «Sí».
12. ¿Qué mejoraría del sistema? (texto libre, opcional)

## Análisis

1. En el Google Form: Respuestas → Descargar respuestas (.csv).
2. `python nlqp/docs/encuesta/analizar_encuesta.py respuestas.csv`
3. El script imprime, por dimensión y por perfil, el promedio, la desviación estándar
   y la distribución de 1 a 5; el porcentaje de adopción, y si se cumplen los dos
   criterios de la sección 3.7. Escribe además `resultados_encuesta.md` con las tablas
   para la tesis.
