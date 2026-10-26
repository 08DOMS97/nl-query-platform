# Resumen para el documento teórico

Lista de trabajo para el **documento principal de la tesis** (el Word). Ordenada por
capítulo y sección, no por fecha, para saber exactamente dónde tocar. Solo entra lo que
cambia lo que la tesis **afirma, mide o describe**; los detalles técnicos internos van a
`BITACORA.md`.

**Cómo se usa**

- `[ ]` pendiente · `[x]` aplicado en el Word · `[?]` no se sabe si ya está en el Word:
  David lo confirma y se marca `[x]` o `[ ]`.
- Cada entrada: **(fecha) Acción** (agregar / reemplazar / corregir / eliminar /
  redactar) → dónde → con qué datos o texto → de qué documento sale.
- Cuando David pasa algo al Word, avisa ("ya pasé el 6.3.4") y se marca `[x]` con la
  fecha. Las entradas `[x]` se dejan (sirven de historial), pero se pasan al final de su
  sección.
- El texto ya redactado para pegar está en `CAPITULO_6.md`. Este archivo dice **qué**
  hacer; ese tiene **el texto**. El texto de los cambios de los caps. 1 a 5 decididos el
  10/10 se le pasó a David por el chat de Cowork; cada entrada dice qué cambia.
- **En espera** = David pidió no aplicarla todavía; no se toca hasta que lo indique.
- **Decisión (10/10)** = la tomó Claude a pedido de David ("tomá las decisiones"), con
  el motivo al lado.
- **Estado del Word verificado el 10/10** contra el PDF que pasó David (`PG2-2026
  capítulo 6.3.5 agregado`, 128 páginas). Las entradas que dicen "sigue igual" se
  comprobaron ahí.

## Contador (actualizado 2026-10-25, cotejo con el Word del 22/10)

| Capítulo | Pendientes `[ ]` | Por verificar `[?]` | Aplicados `[x]` |
|---|---|---|---|
| Preliminares y 1–4 | 6 | 1 | 22 |
| 5 | 2 | 0 | 5 |
| 6 | 9 | 0 | 42 |
| Conclusiones / limitaciones | 7 | 0 | 2 |
| **Total** | **24** | **1** | **71** |

> **25/10 — Cotejo con `PG2-2026 revisado 22-10-2026.docx`.** El Word que David revisó
> el 22/10 ya tenía el on-premises (las 4 entradas), el cambio de modelo, 6.3.2 y 6.7.1,
> pero no estaba registrado. Se cotejó frase por frase contra `CAMBIO_ON_PREMISES.md`.
> Quedan sin aplicar OP-13 (Tabla 4, con el recálculo de 1.6.3), OP-36 (6.7.4, después
> de verificar el acceso en red) y US-09. La limitación del «banco chico» ya no va. El
> Word vigente es el del 22/10.

> **19/10 — Despliegue on-premises, tope por conexión y gestión de usuarios.** Las 4
> entradas nuevas (una por capítulo, marcadas "(19/10) On-premises") remiten a
> **`CAMBIO_ON_PREMISES.md`**. Ese archivo tiene las instrucciones paso a paso, con el
> texto exacto a reemplazar, agregar o eliminar:
> - `OP-01`…`OP-41` y `OD-01`…`OD-10`;
> - Parte 6, `US-01`…`US-08`: tope por conexión y superadministrador. Las tildes de avance se llevan allá; acá se marca `[x]`
> cuando esté aplicado todo lo de ese capítulo.

---

## Preliminares y capítulos 1 a 4

- [ ] (10/10) **1.6.3 — recalcular costos, ROI y VAN con el costo medido**. **Al
  recalcular, aplicar también** (25/10) lo que quedó de las entradas del on-premises y
  del cambio de modelo, ya aplicadas en el resto del documento: OP-13 de
  `CAMBIO_ON_PREMISES.md` (texto de 1.6.3.2, filas de la Tabla 4 y Secret Manager con un
  secreto por conexión) y "Vertex AI Gemini Pro 2.5" en la Tabla 4 y "Vertex AI Gemini
  Pro (98% del gasto)" en el párrafo que le sigue → Gemini 3.8 Flash. La Tabla 4
  supone ≈ $0.0087 por consulta ($91.88 / 10,500); la única medición real (09/10, con la
  poda vieja) dio $0.01188, casi todo razonamiento del modelo. **Decisión:** recalcular
  una sola vez con el **costo promedio por consulta de la corrida completa** (200
  llamadas, en vez de una sola), tablas 4, 5 y 6, "Q712" de 2.10 y Conclusiones; si el
  13/10 todavía no hay corrida, usar $0.012. **Actualización 18/10:** la corrida se
  hace con Gemini 3.8 Flash (S10 costó $0.0012, la décima parte); usar su costo
  promedio, no los $0.012 de 2.5 Pro. Al recalcular se corrigen también los
  errores de la entrada siguiente y se usa VAN = −inversión inicial + Σ flujos netos de
  los años 1 a 3 descontados al 10 %.
- [ ] (25/09) **1.6.3 — errores de cálculo actuales** (se corrigen al recalcular,
  entrada anterior): máximo mensual $96.55, no $95.45; el mínimo omite los $0.07 de
  Secret Manager; costo por usuario Q20.35/mes, no Q22.50; ROI año 2 = 995.5 %, no 994.9
  %; el costo de Q10,844 no se explica; el VAN de Q309,456 no se reproduce (con los
  flujos del documento da ≈ Q196,000–210,000). Sigue igual el 10/10.
- [ ] (10/10) **3.3.1.2 — niveles de complejidad**: contrastar la definición formal con
  la clasificación usada en las 50 consultas (15 simples, 20 intermedias, 15 complejas;
  criterios en `PREPARACION_EVALUACION_GEMINI.md` §2).
- [ ] (10/10) **3.3.1.3 — umbrales de tiempo**: la generación de una consulta **simple**
  tardó **14,5 s** (llamada real del 09/10) contra un umbral de **15 s**. **Decisión:**
  no cambiar el umbral; reportar en la sección de evaluación (cuando se escriba) cuántas
  consultas lo cumplen y discutirlo.
  Cambiar una meta después de medir le quita valor a la evaluación.
  **Actualización — decisión de David (24/10):** agregar en 3.3.1.3, y donde RNF-01
  dé un tiempo para la generación, que el tiempo **no es fijo**:
  - depende de la consulta;
  - depende sobre todo del servicio externo del modelo, que varía según su carga;
  - a eso se suma el tiempo de conexión y de proceso desde que el usuario aprieta
    «Generar SQL»: autenticación, lectura del esquema, validación y red.

  Los umbrales quedan como **referencia**, no como garantía. Datos para el texto
  (24/10):
  - una consulta simple («Muéstrame las categorías que hay», 533 tokens de entrada y 12
    de salida, sin razonamiento) tardó **24,2 s**. Unos 20 s fueron espera al modelo,
    ~2,7 s la preparación del cliente en la primera llamada y ~0,3–0,6 s el esquema y la
    autenticación;
  - otras consultas simples tardaron 2,9 s y 5,5 s;
  - mediana de las 5 generaciones registradas: 9,8 s.

  Desde el 24/10 la preparación se hace al arrancar el servidor y el esquema se
  guarda en caché 60 s. Fuente: `BITACORA.md` 24/10 (3) y `USO_Y_COSTOS.md`.
- [ ] (19/09) **3.6 — muestra**: si no se consiguen los 35 participantes, documentar la
  muestra reducida.
- [?] (10/10) **Confirmar el equipo de 3.8**: el texto se unificó con la Tabla 8 (i7 de
  12.ª generación, 16 GB, 1 TB, Q600). David confirma que es su equipo real.
- [ ] (10/10) **Referencia de Spider 2.0** (sugerida, no aplicada): los datos de 1.1 y
  2.3 ya son los de la versión publicada (ICLR 2025). Hay un comentario en la entrada de
  Lei et al. con la referencia APA 7 sugerida; si David la acepta, la entrada y las
  citas pasan a 2025.
- [x] (10/10) **Sin marcadores de secciones pendientes**: David pidió (10/10) que el Word
  tenga solo lo que se documenta. Se quitaron los títulos y párrafos de 6.3.6, 6.5 y 6.6;
  esas secciones entran cuando tengan texto. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **Referencias a secciones como hipervínculos**: toda mención "sección X.Y" o
  "Capítulo N" del cuerpo lleva un vínculo al título correspondiente, como las que ya
  tenía el documento (44 nuevas; las existentes se reapuntaron a su título actual).
  Índice general, de tablas y de figuras regenerados con la estructura nueva. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **2.5 — SDK**: "mediante el SDK oficial de Google Cloud para Node.js" →
  `@google/genai` configurado para Vertex AI (migración del 09/10). Vertex AI y Gemini
  2.5 Pro se siguen usando: el código llama `new GoogleGenAI({ vertexai: true, … })`. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **2.9 — descripción de la poda**: decía "filtrado basado en la similitud
  semántica"; ahora describe la poda real (tablas nombradas o por sinónimo, columnas
  distintivas, camino más corto de claves foráneas, esquema completo si no hay
  coincidencias) y remite a 6.3.1. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **4.5 — RNF-13**: ya no remite a 6.3.6 (que no está en el Word); remite a las
  reglas de rendimiento de 6.3.2. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (25/09) **Corregir preliminares**: la portada dice "Mayo 2026" (dos veces) →
  "Octubre 2026"; la introducción dice "comprende tres capítulos desarrollados en esta
  primera entrega" → "seis capítulos", y agregar un párrafo que presente los caps. 4, 5
  y 6. Sigue igual el 10/10. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (10/10) **Índice general e índice de tablas**: no incluyen 6.3.5 ni la tabla de
  verificación de 6.3.5, y los números del índice no coinciden con el texto. Los títulos
  de tablas y la Figura 9 del Cap. 6 salen dentro del índice general porque tienen
  estilo de título: cambiarlos al estilo de leyenda y actualizar todos los índices al
  final, después de reordenar 6.3.4/6.3.5 y de quitar la Tabla 10. **Aplicado el 10/10**
  en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin control de
  cambios.
- [x] (25/09) **Eliminar frases duplicadas**: en 1.2, "constituye el único mecanismo
  estándar" aparece dos veces; en la introducción, la oración "genera consultas SQL
  funcionalmente correctas con mecanismos posteriores de validación y optimización
  considerando el esquema real… con mecanismos de validación y control…" repite la idea.
  Sigue igual el 10/10. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (25/09) **Unificar los datos de Spider 2.0** en 1.1 y 2.3. **Decisión (10/10):**
  usar los de la versión publicada del artículo (arXiv 2411.07763 v2, 17/03/2025): bases
  de datos de **más de 1,000 columnas**; un agente basado en **o1-preview resuelve el
  21.3 %**, frente al **91.2 %** en Spider 1.0 y el 73.0 % en BIRD. El "GPT-4 6 %" de
  1.1, y el "3,000 columnas" y "GPT-4o 10.1 % frente a 86.6 %" de 2.3, no coinciden con
  esa versión. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (25/09) **1.6.2 — corregir el total**: los pesos de la factibilidad operativa
  suman **93**, no 95 → "93/100". Sigue igual el 10/10. **Aplicado el 10/10** en
  `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin control de
  cambios.
- [x] (19/09, aclarado 10/10) **Actualizar versiones**: Node.js 20 LTS → **Node.js 22
  LTS**, Next.js 14 → **Next.js 16**, TypeScript 5.4 → TypeScript 5. Dónde: 1.6.1
  (indicador 2), 3.8 (texto y Tabla 8) y Recomendaciones, donde además hay que cambiar
  las fechas: Node.js 22 recibe mantenimiento de seguridad hasta abril de 2027 (Node 20
  ya llegó a fin de vida en abril de 2026). **Aplicado el 10/10** en `PG2-2026 capítulo
  6 revisado 10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (25/09) **2.6 — conexiones**: dice que la función "no mantiene conexiones abiertas
  entre invocaciones", pero el Módulo 1 reutiliza conexiones (6.1). **Decisión:**
  ajustar la frase de 2.6 ("solo reutiliza conexiones dentro de una misma instancia
  mientras esta permanece activa, sin que las credenciales salgan del backend"), porque
  el código es correcto y lo que describe mal es el texto. Sigue igual el 10/10.
  **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión
  limpia, sin control de cambios.
- [x] (19/09, aclarado 10/10) **3.4 — "modelo de organización"**: 3.4 dice que la unidad
  de estudio "garantiza que la evaluación se realice en condiciones de uso reales y no
  simuladas", pero la evaluación técnica se hace sobre el banco de pruebas.
  **Decisión:** reemplazar esa frase por una que distinga las dos evaluaciones: la
  técnica (3.3.1) sobre el banco de pruebas, que permite comparar resultados entre
  motores, y la de usabilidad (3.3.2) con usuarios de la organización receptora.
  **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión
  limpia, sin control de cambios.
- [x] (25/09) **3.8 — equipo inconsistente**: el texto dice i7 de décima generación, 32
  GB, 512 GB y Q462; la Tabla 8 dice 12va gen, 16 GB, 1 TB y Q600. **Decisión:**
  unificar con los datos de la Tabla 8 y Q600 (Q12,000 / 60 meses × 3 meses, el mismo
  período que usa la infraestructura). David confirma que la Tabla 8 describe su equipo
  real. Sigue igual el 10/10. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (25/09) **3.9 — porcentaje y párrafo duplicado**: 67 % → **58 %** (semanas 4 a 10
  = 7 de 12); quitar la oración "La fase de construcción concentra…" del párrafo "Las
  fases de inicio y elaboración…", que se repite en el párrafo siguiente. Sigue igual el
  10/10. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (25/09) **Tabla 10 vacía**: es un rótulo "Tabla 10." suelto al final de 3.9, sin
  tabla. **Decisión:** eliminarlo. Así las referencias de 4.3.5 (que ya cuentan sin esa
  tabla: actores 10, artefactos 11, RF 12, RNF 13) quedan correctas, y las tablas
  siguientes bajan un número: caps. 4 → 10 a 13; Cap. 6 → 14 a 18. Sigue igual el 10/10.
  **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión
  limpia, sin control de cambios.
- [x] (25/09) **4.2 — actores**. **Decisión:** agregar en la tabla de actores una fila
  para el **motor de base de datos externo** (secundario, sistema externo), cambiar "un
  actor secundario" por "dos actores secundarios" en el texto, y cambiar "gestionar el
  historial de consultas del equipo" por "gestionar su historial de consultas"
  (Firestore aísla por usuario). Así coincide con el diagrama de 5.1.1. Sigue igual el
  10/10. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (25/09) **4.4 — requerimientos**. **Decisión:** dejar RF-12 como está (coincide
  con el alcance de 1.5 y el objetivo 5) y **agregar RF-14 "Autenticación de usuarios"**
  (registro e inicio de sesión con correo y contraseña mediante Firebase Authentication;
  el backend rechaza toda solicitud sin token válido; actores: ambos), porque está
  implementado y 6.4 lo describe sin un requerimiento al que remitir. **Aplicado el
  10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin control
  de cambios.
- [x] (02/10) **Agregar requisitos no funcionales**. **Decisión (10/10):** agregarlos en
  4.5 como **RNF-13** (rendimiento: el SQL generado no usa antipatrones conocidos —
  `SELECT *`, funciones sobre columnas indexadas al filtrar, `NOT IN` con subconsulta,
  `LIMIT` no pedido —, verificado en la evaluación) y **RNF-14** (fiabilidad: ningún
  resultado se trunca; se entrega completo por páginas y CSV, o el sistema responde con
  error), porque el sistema ya los cumple y 6.3.5 los describe sin un requerimiento al
  que remitir. **No mencionar el valor del tope de tiempo** (decisión de David, 02/10).
  Fuente: `RENDIMIENTO_E_INTEGRIDAD.md`. **Aplicado el 10/10** en `PG2-2026 capítulo 6
  revisado 10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (10/10) **Formato general** aplicado en el Word revisado: capítulos 1 a 6 con
  salto de sección de página impar; leyendas del Cap. 6 con el estilo y la numeración
  automática de las demás; 6.3.4 y 6.3.5 con formato de título de nivel 3; párrafos del
  Cap. 6 justificados; tabla de hallazgos ya no flotante; asteriscos sueltos de RF-05,
  RNF-02 y RNF-11 corregidos (cursiva); "Capítulo 6 -" → "Capítulo 6 —"; párrafos de
  2.2, 2.3, 2.5, 2.8 y 3.1 divididos para no pasar de 12 líneas; índices marcados para
  actualizarse al abrir (Word pregunta y se responde "Sí").
- [x] (19/10) **On-premises — caps. 1 a 4**: `CAMBIO_ON_PREMISES.md` OP-09 a OP-32
  (Introducción, 1.3, 1.5, Tabla 1, 1.6.3 con Tabla 4, 1.7, 2.5–2.8, 2.10, 3.2.1,
  3.3.1.4, 3.8 con Tabla 8, 3.9, 4.1, 4.3.3, RNF-11) y OD-04 (registro de cambios y
  RF-13 en 1.5, 1.7 y 4.4). Decisión de David del 19/10. **También US-01**
  (superadministrador como permiso del técnico, 4.2) **y US-02** (RF-14 sin registro
  público, RF-15 tope por conexión y RF-16 gestión de usuarios). **Aplicado el 22/10**
  en `PG2-2026 revisado 22-10-2026.docx` (cotejado el 25/10 frase por frase), **salvo
  OP-13** (Tabla 4), que pasó a la entrada del recálculo de 1.6.3.
- [x] (18/10) **Cambio de modelo en todo el documento**: Gemini 2.5 Pro se retira de
  Vertex AI el 20/10/2026 y la plataforma pasó a **Gemini 3.8 Flash** (`gemini-3.8-flash`,
  ubicación `global`, GA, soporte hasta el 02/09/2027 o más). Reemplazar "Gemini 2.5 Pro"
  / "Gemini Pro" por "Gemini 3.8 Flash" en resumen, objetivos, alcance, 2.x (marco
  tecnológico, incl. 2.5), 4.x (requerimientos) y 5.x (arquitectura y diagramas), salvo
  donde se cuenta la historia del desarrollo (ahí: "se desarrolló con Gemini 2.5 Pro y se
  cambió a Gemini 3.8 Flash antes de su retiro"). Si el marco teórico justifica elegir un
  modelo "Pro" por capacidad de razonamiento, ajustar: 3.8 Flash es el reemplazo que
  recomienda Google y razona internamente (nivel configurable). Fuente: `CAPITULO_6.md`
  6.3.2, `BITACORA.md` 18/10. **Aplicado el 22/10** en `PG2-2026 revisado
  22-10-2026.docx`: 31 menciones a "3.8 Flash" y ninguna a "2.5 Pro". **Quedan** las
  dos menciones de la Tabla 4 y su párrafo (1.6.3), que pasaron a la entrada del
  recálculo. El documento no cuenta la historia del cambio de modelo.

## Capítulo 5 — Diseño de la aplicación

- [ ] (24/10) **Instalación con Docker — 5.3 / 5.3.1 y Figura 8**: agregar que frontend
  y backend se instalan como dos contenedores con un solo comando
  (`docker compose up -d --build`), lo que facilita llevar el sistema a otro servidor.
  Para la Figura 8:
  - solo el frontend se publica en la red; el navegador llama a `/api` y el frontend
    reenvía al backend por la red interna;
  - la credencial de Google Cloud se monta como secreto de solo lectura;
  - las bases siguen fuera de los contenedores.

  Fuente: `DOCKER.md`.

- [ ] (plan 28–29/09) **Correcciones de figuras, rótulos y numeración** del capítulo
  (actividad del plan, en 0 %).
- [x] (19/10) **On-premises — Cap. 5**: `CAMBIO_ON_PREMISES.md` OP-01 a OP-08. Incluye:
  - reemplazar el párrafo de 5.3;
  - **5.3.1 Justificación del despliegue local** y **5.3.2 Escalamiento a la
    arquitectura sin servidor** (nuevas);
  - **redibujar la Figura 8** ("Diagrama de despliegue de NLQP");
  - cambiar rótulos de las Figuras 3 y 4;
  - una nota sobre `AdaptadorMotor` en 5.1.6;
  - el párrafo nuevo de 5.2 sobre las colecciones reales;
  - **US-03**: casos de uso "Gestionar usuarios" y "Configurar tiempo máximo de
    ejecución" en la Figura 1.

  **Aplicado el 22/10** en `PG2-2026 revisado 22-10-2026.docx` (cotejado el 25/10: el
  texto de OP-01 a OP-08 y US-03 está; 5.3.2 con otra redacción). Las figuras se
  comprobaron solo por cantidad: el Word tiene 5 imágenes nuevas, como las Figuras 1, 2,
  3, 4 y 8 que registra el plan.
- [x] (09/10) **5.1.5 — reducción del 71 % sobre 42 tablas** (irreproducible: el banco
  tiene 8 tablas). **Decisión:** no redibujar la Figura 5; reescribir el párrafo para
  que diga que la instantánea es ilustrativa (consulta hipotética sobre 42 tablas) y
  remitir a la medición real de 6.3.1: **~72 %** de reducción sobre la parte de esquema
  (cumple la meta de RNF-02) y 43,4 % sobre el prompt completo. Motivo: el tiempo hasta
  la entrega. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (19/09, aclarado 10/10) **Caché de esquema** (Figura 2, 5.1.2 y 5.2): el código no
  tiene caché, extrae el esquema en cada generación. **Decisión:** no redibujar la
  Figura 2; agregar en 5.1.2 y 5.2 que la caché es parte del diseño y quedó como mejora
  futura. Además, corregir la frase de 5.1.2 que dice que el sistema no accede a las
  credenciales hasta validar la sentencia: sí se conecta antes para extraer el esquema;
  lo que se garantiza es que una sentencia bloqueada nunca se envía al motor. **Aplicado
  el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin
  control de cambios.
- [x] (25/09) **5.1.3 — "un segundo escenario"** que no tiene figura. **Decisión:**
  eliminar ese párrafo; el bloqueo de una sentencia ya se ve en la Figura 2 (tercer
  punto de decisión). Sigue igual el 10/10. **Aplicado el 10/10** en `PG2-2026 capítulo
  6 revisado 10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (10/10) **Descripción de la poda en el Cap. 5**: no aplica. Verificado en el PDF:
  el Cap. 5 no describe el método de poda (solo 6.3.1).

## Capítulo 6 — Desarrollo de la aplicación

Texto base en `CAPITULO_6.md`. **Estructura en el Word (16/10):** 6.1–6.3.5 · 6.4
Frontend · 6.5 Módulo 4 · 6.6 Módulo 5 · **6.7 Integración y pruebas** (6.7.1 uso y
costos, 6.7.2 seguridad, 6.7.3 tiempos). La evaluación con Gemini entra como 6.3.6 cuando
haya resultados y la presentación como 6.8. **Tablas (17/10, pedido del asesor: menos tablas):** solo 14 (hallazgos) y 15
(latencias); el resto del capítulo va en texto. **Figuras:** 9 (6.4, captura vieja) y
una sola nueva (10) pendiente.

- [ ] (19/10) **OP-36 — 6.7.4 nueva, "Instalación en la red de la organización"**
  (`CAMBIO_ON_PREMISES.md`): se escribe **después** de verificar el acceso desde otro
  equipo de la red. Es lo único de la entrada "On-premises — Cap. 6" que no está en el
  Word del 22/10.

- [ ] (24/10) **Contraseña nueva por el superadministrador**: `CAMBIO_ON_PREMISES.md`
  **US-09**. RF-16 (Tabla 12, cap. 4), párrafo de 6.5, cifras de 6.5.1 (API 50/50, UI
  27/27) y glosario. Se cuenta en este capítulo, aunque RF-16 y el glosario estén en
  otros. Pedido de David del 24/10. El Word del 22/10 tiene US-02 y US-06 (35/35 y
  20/20): se edita ese texto.

- [x] (19/10) **On-premises — Cap. 6**: `CAMBIO_ON_PREMISES.md`:
  - **OD-01**: 6.1.4 dice "cuentas con permisos exclusivamente de lectura", pero
    `testuser` tiene permisos amplios a propósito. **Dato incorrecto.**
  - OD-02: tope de 60 s frente a los 8 min; hay que verificarlo antes.
  - OP-33: 6.3.5.
  - OP-34: 6.7.1.
  - OP-35: Tabla 14 y su párrafo.
  - **US-04 a US-07**: tope en el formulario de conexiones (6.1.2 y 6.1.4, 59/59 y
    33/33); 6.4 sin `/signup`; 6.5 con la gestión de usuarios (35/35 y 20/20); y
    hallazgo nuevo en la Tabla 14. **OD-02** ahora describe el tope por conexión
    (8 min por defecto).

  **Aplicado el 22/10** en `PG2-2026 revisado 22-10-2026.docx` (cotejado el 25/10 frase
  por frase), incluido el dato incorrecto de 6.1.4. OP-36 quedó como entrada aparte,
  arriba.

### Introducción
- [x] (25/09) **Reemplazar el segundo párrafo** por el de `CAPITULO_6.md`: el Word
  todavía dice "sobre el entorno de pruebas descrito en el Capítulo 5", y el Cap. 5 no
  lo describe. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.

### 6.1 y 6.2 — Conexiones y esquema
- [x] (13/10) **Actualizar 6.1** con el texto de `CAPITULO_6.md`: (1) en "Arquitectura
  de conexión", el pool es **por conexión registrada** (no por motor) y la contraseña
  se lee de Secret Manager **al abrir el pool** y queda en la memoria del backend
  mientras el pool está activo: reemplaza la frase "se descarta al finalizar la
  operación, sin persistir en memoria entre invocaciones", que ya no es cierta;
  registro en Firestore, un secreto por conexión, dentro de la cuota gratuita.
  (2) Subsección nueva **"Registro de conexiones"**: alta, edición y baja del técnico
  desde la pantalla Conexiones (formulario con "Probar"), prueba antes de guardar,
  motor fijo al editar, contraseña que no se vuelve a mostrar, cerrar el pool al editar
  o eliminar, el no técnico ve solo nombre, motor y base. (3) En "Verificación",
  párrafo nuevo con **38/38** (API) y **27/27** (interfaz); nombre de conexión único en
  todo el sistema (las conexiones son compartidas). Sale de `BITACORA.md`
  (13/10). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`. Ajuste: el párrafo del registro quedó sin la frase repetida de la contraseña y la verificación en dos párrafos (API e interfaz).
- [x] (10/10) **Unificar los títulos**: 6.2 → "6.2 Módulo 2 — Extracción e
  interpretación de esquema" y 6.3 → "6.3 Módulo 3 — Generación NL2SQL y Query Safety
  Engine", como 6.1 y como dice el índice. **Aplicado el 10/10** en `PG2-2026 capítulo 6
  revisado 10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (18/09) Texto en el Word desde la v5; sin cambios al 10/10.

### 6.3.1 — Prompt y poda de esquema
- [x] (09/10) **Reemplazar el primer párrafo** por el de `CAPITULO_6.md` (poda nueva:
  núcleo + camino más corto + fail-open; el Word describe la vieja: "a un salto", "se
  limita a veinte"). **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (09/10) **Agregar el cuarto párrafo** de `CAPITULO_6.md` ("La primera versión de
  la poda…"): 5,56 → 2,18 tablas, el error con "clientes", 0 de 50 consultas pierden
  tablas. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (10/10) **Reemplazar el último párrafo** ("su efecto sobre la meta del 60 %… se
  medirá en la evaluación") por el de `CAPITULO_6.md`: ~72 % sobre el esquema, 43,4 %
  sobre el prompt, y que el diccionario se ajustó con las mismas preguntas. **Aplicado
  el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin
  control de cambios.
- [x] (25/09) Texto pegado en el Word (versión con la poda vieja).

### 6.3.2 — Integración con Vertex AI Gemini Pro (pasa a "Integración con Gemini en Vertex AI")
- [ ] (24/10) **Agregar los controles alrededor de la llamada al modelo**, para todos
  los roles:
  - (a) si la «pregunta» ya es una sentencia SQL, se rechaza antes de llamar al modelo y
    sin costo;
  - (b) la pregunta admite hasta 1000 caracteres;
  - (c) si el SQL generado limita las filas (LIMIT/TOP/FETCH) y la pregunta no pide una
    cantidad ni un extremo, no se entrega: se avisa, para no presentar como completo un
    resultado parcial (refuerza RF-07 y la regla de no truncar).

  Ninguna de las 100 preguntas del conjunto (50 + 50 paráfrasis) se toma por SQL y las
  22 que piden un límite pasan. Fuente: `PREPARACION_EVALUACION_GEMINI.md` §8 (nota del
  24/10) y `AUDITORIA_2026-10-24.md` §1. En 6.3.6, el veredicto `limite_no_pedido` va
  como categoría propia.

- [x] (18/10) **Actualizar por el cambio de modelo**: título → "Integración con Gemini en
  Vertex AI"; modelo por defecto `gemini-3.8-flash` en `global` (no `gemini-2.5-pro` en
  `us-central1`); párrafo nuevo sobre el retiro de 2.5 Pro (20/10/2026) y el cambio sin
  tocar arquitectura ni prompt; temperatura: 3.8 Flash la ignora, el determinismo se
  controla con el nivel de razonamiento; razonamiento en nivel bajo (`LOW`) en vez del
  presupuesto de 1,024 tokens; verificación con S10 en ambos modelos (Flash: 621 / 39 / 0
  tokens, 2.9 s, USD 0.0012, 104 = referencia). Texto en `CAPITULO_6.md`. **Aplicado
  el 22/10** en `PG2-2026 revisado 22-10-2026.docx` (título, nivel bajo, sin el
  presupuesto de 1,024, S10 con 621 / 39 / 0 tokens, 2.9 s y USD 0.0012). No está el
  párrafo sobre el retiro de 2.5 Pro: el documento no cuenta el cambio de modelo.
- [x] (10/10) **Actualizar** (no redactar: el Word ya tiene el texto del 25/09). Estaba en
  espera desde el 03/10; David pidió el 10/10 aplicar los cambios del proyecto. Cambios: SDK `@google/genai`
  (migrado el 09/10 desde `@google-cloud/vertexai`, deprecado); salida máxima **4096**
  (el texto dice 1,024), con error explícito si la respuesta se corta; presupuesto de
  razonamiento de 1024 tokens; el texto cita USD 0.00063375 de la prueba del 21/09, sin
  contar razonamiento: el costo medido es **~$0.012 por consulta** (998 de 1024 tokens
  de razonamiento) y la latencia 14,5 s; "sección 6.5" pasa a "sección 6.7". El retiro
  del modelo va en limitaciones. Fuentes: `PREPARACION_EVALUACION_GEMINI.md` §8 (2b,
  2c), `USO_Y_COSTOS.md`. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas). Texto en `CAPITULO_6.md`; la referencia a uso y costos queda como 6.5.1.
- [x] (02/10) **Agregar el contenido nuevo del prompt** (movido desde 6.3.1 el 10/10: el
  prompt se describe en 6.3.2 y no conviene describirlo en dos lugares). Valores permitidos de columnas categóricas (leídos de
  los `CHECK`), reglas de dominio (excluir pedidos cancelados en montos de venta; pagos
  solo `COMPLETED`), marcas de índice y reglas de rendimiento. Fuente:
  `PREPARACION_EVALUACION_GEMINI.md` §4. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (25/09) Texto pegado en el Word.

### 6.3.3 — Query Safety Engine
- [x] (08/10) **Reemplazar toda la sección** por la de `CAPITULO_6.md`. El Word tiene
  solo los tres primeros párrafos de la versión de 17 casos: falta la subsección
  "Hallazgo: evasión del validador en el dialecto Transact-SQL" (la que la tabla de
  hallazgos y 6.7 dicen que se describe en 6.3.3) y falta la "Segunda revisión". La
  versión actual: batería de 57 casos (44 que deben bloquearse y 13 legítimos),
  literales y funciones prohibidas. **Aplicado el 10/10** en `PG2-2026 capítulo 6
  revisado 10-10-2026.docx`, versión limpia, sin control de cambios.

### 6.3.4 — Pruebas de ejecución controlada
- [x] (10/10) **Corregir** el párrafo de equivalencia (estaba en espera desde el 03/10). Hoy
  dice que se compararon conteos de filas; reemplazar por: se compara el **resultado
  completo (filas y valores)**, y las 50 dan resultados idénticos en los 4 motores. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **Agregar** las dos correcciones del conjunto de referencia, con qué se
  aprendió de cada una (estaba en espera desde el 03/10).
  1. (02/10) 5 referencias inconsistentes con los pedidos cancelados (M03, M07, M12,
     M13, C11), unificadas con una regla de dominio.
  2. (10/10) Al comparar contenido y no solo conteos: empates en el corte de los "top N"
     (M19, C02, C04, C07: cada motor elegía otros registros empatados → desempate
     determinista), M20 calculaba días de dos formas, C10 recortaba con un `LIMIT` que
     la pregunta no pedía, y un **defecto del sistema** de zona horaria (MySQL/MariaDB
     corrían las fechas 6 h y Postgres las columnas `DATE`), corregido.
  La tabla de ejecución controlada sigue siendo válida (200/200). Fuente:
  `PREPARACION_EVALUACION_GEMINI.md` §8, 2g; `RENDIMIENTO_E_INTEGRIDAD.md`, bug 4. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **Reordenar**: 6.3.5 quedó pegada en medio de 6.3.4, después de su primer
  párrafo. Mover el resto de 6.3.4 (desde "Las sentencias de esta corrida son de
  referencia…" hasta "…extracción de año o mes.", con su tabla) para que quede antes del
  título 6.3.5. Después, la tabla de ejecución controlada es la **14** y la de
  verificación de 6.3.5 la **15**. **Aplicado el 10/10** en `PG2-2026 capítulo 6
  revisado 10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (25/09) Texto pegado; ya no dice que la integración está pendiente (resuelve la
  entrada del 08/10).

### 6.3.5 — Control de tiempo de ejecución e integridad de resultados
- [ ] (24/10) **Agregar a la verificación de integridad** los defectos que encontró la
  auditoría, ya corregidos y verificados en los 4 motores (19/19):
  - dos columnas con el mismo nombre mostraban un valor en lugar de otro (ahora se
    rechaza con un aviso);
  - el `TIMESTAMP` de PostgreSQL salía corrido 6 h;
  - un BIGINT grande de MySQL/MariaDB llegaba redondeado;
  - si fallaba fijar el tope de tiempo en MySQL/MariaDB, la conexión quedaba sin tope.

  Fuente: `RENDIMIENTO_E_INTEGRIDAD.md`, bug 5.

- [ ] (24/10) **La descarga pasa de CSV a Excel** (pedido de David: el CSV se veía
  desordenado). Cambios en el Word, con el texto ya listo en `CAPITULO_6.md`:
  - 6.3.5, «Lectura y entrega del resultado»: «descarga en CSV» → «descarga en Excel».
  - 6.3.5: reemplazar el párrafo «Descarga en CSV» por los dos de «Descarga en Excel».
  - Tabla 15: quitar «el CSV trae las 20,000 filas» y agregar la fila de la descarga en
    Excel (68/68).
  - 6.3.5, último párrafo de rendimiento: «el CSV completo se genera en alrededor de
    1 s» → «el archivo de Excel con las 400,000 filas se descargó en unos 11 s».
  - 6.4: «Descargar CSV completo» → «Descargar Excel» y «la descarga del CSV completo»
    → «la descarga del resultado completo».
  - Si 6.7.2 o la tabla de hallazgos mencionan el endpoint de descarga «de CSV»,
    cambiarlo a «de descarga del resultado».

  Fuente: `RENDIMIENTO_E_INTEGRIDAD.md` §4.1.

- [x] (02/10) **Reemplazar el párrafo "Tiempo máximo de ejecución"** por el de
  `CAPITULO_6.md`: el Word todavía dice "de 60 segundos por defecto", y David decidió no
  mencionar el valor. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (02/10) **Agregar el último párrafo** ("Como limitación, el almacén de copias…"),
  que no está en el Word. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (10/10) **Cambiar** "(sección 6.6)" por "(sección 6.7)" en el párrafo del error
  grave, al reordenar 6.7. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (02/10) Pegada en el Word con su tabla (en el lugar equivocado: ver 6.3.4).
  Resuelve la entrada del 02/10 que la ubicaba en 6.7.

### Evaluación de la generación con Gemini (6.3.6 cuando se escriba)
- [ ] (10/10) **Redactar cuando termine la corrida** (pendiente: piloto y corrida
  completa). Métricas: precisión por ejecución (exacto / con columnas extra), por nivel
  y por motor; consistencia entre motores; robustez con paráfrasis; reducción de tokens;
  costo y latencia (incluido cuántas simples cumplen los 15 s); seguridad (consultas
  bloqueadas); antipatrones. **(24/10)** Reportar el tiempo con la mediana y el p95, y
  separado por etapa: espera al modelo frente a esquema, poda y controles. Los datos
  salen de `stages` en `resultados.jsonl` y del evento de uso; Uso y costos los muestra.
  Datos: `evaluacion_gemini/resumen.md`. Método de
  comparación: `PREPARACION_EVALUACION_GEMINI.md` §8 punto 6. Sus tablas van antes de la
  16 y corren las siguientes.

### 6.4 — Frontend y autenticación
- [x] (25/09) **Aplicar las correcciones del 25/09**, que no están en el Word: "cumple
  con RF-09 en lo esencial" → cubre RF-09 en parte; "sin información interna del sistema
  (RNF-04)" → RNF-04 se cumple solo en parte (hallazgo 5); agregar que la ejecución
  reutiliza el motor de la generación y que los motores están preconfigurados. Texto en
  `CAPITULO_6.md`. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (02/10) **Reemplazar los párrafos del flujo, la verificación y el alcance** por
  los de `CAPITULO_6.md`: paginación y CSV completo; ejecutar, paginación y CSV
  verificados en navegador; sin la frase "Tampoco se ha desplegado en Firebase Hosting".
  **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión
  limpia, sin control de cambios.
- [x] (10/10) **Leyenda de la Figura 9**: "Figura 9 Pantalla…" → "Figura 9. Pantalla…",
  como las demás. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado
  10-10-2026.docx`, versión limpia, sin control de cambios.
- [x] (25/09) Sección pegada en el Word, con la captura de la pantalla principal como
  Figura 9.

### 6.5 y 6.6 — Módulos 4 y 5
- [x] (13/10) **Edición del SQL y auditoría** en 6.5 y 6.6, con el texto actual de
  `CAPITULO_6.md`: el técnico edita la sentencia generada y las guardadas, no las del
  historial (se guardan antes); «Guardar cambios»; auditoría de cada edición ejecutada o
  guardada (lo reemplazado, quién, fecha y hora, base, origen), sin duplicados y con el
  original tomado del backend; fila nueva **"Auditoría de cambios"** en la Tabla 16;
  verificación **23/23** (interfaz) + **25/25** (API); en 6.6, cómo se reusa cada una.
  Sale de `BITACORA.md` (13/10, 4). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`.
- [x] (10/10) **Agregar 6.5 Módulo 4 — Herramientas de apoyo para usuarios técnicos**
  (sección nueva, después de 6.4) con el texto de `CAPITULO_6.md`: roles técnico y no
  técnico como custom claim que solo asigna el backend, control en el backend (403);
  Tabla 16 (edición del SQL, conexiones y pool, esquema, uso y costos); SQL editado
  validado al ejecutar; endpoint del pool; verificación 23/23 (API, ambos roles) +
  12/12 (interfaz) + regresión 57/57 y 200/200; limitación del SQL no firmado. Lleva la
  Figura 10 (captura de Conexiones; está en `Claude outputs/capturas 10-10-2026/`).
  **13/10:** la fila "Conexiones" de la Tabla 16 y el párrafo del pool cambiaron (lista
  de conexiones registradas con formulario para agregarlas, probarlas, editarlas y
  eliminarlas): tomar el texto actual de `CAPITULO_6.md`. La captura del 10/10 ya no
  sirve para la Figura 10: hay que retomarla. **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`. Sin la Figura 10 (ver entrada de capturas); la limitación del SQL no firmado ya no remite a 6.7.2, que no la trata.
- [x] (10/10) **Agregar 6.6 Módulo 5 — Historial y gestión de consultas guardadas**
  (sección nueva, después de 6.5) con el texto de `CAPITULO_6.md`: historial
  automático y consultas guardadas por decisión del usuario, en colecciones separadas
  de Firestore por usuario; Tabla 17 (datos de cada registro); reutilizar sin llamar al
  modelo y con nueva validación del Query Safety Engine; verificación 32/32 (API, 4
  motores) + 10/10 (interfaz) + regresión 57/57 y 200/200; lo que queda fuera. Lleva la
  Figura 11 (captura de Historial; en la misma carpeta). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`. Sin la Figura 11 (ver entrada de capturas). En la Tabla 17 dice "conexión (nombre y motor)" en vez de "motor": el historial y las guardadas guardan el nombre de la conexión.
- [x] (10/10) **Reemplazar 6.4** por el texto de `CAPITULO_6.md`: pantallas por módulo
  con barra lateral y menú según el rol, criterio visual (blanco, neutros cálidos,
  acento naranja claro, IBM Plex), SQL plegado para el no técnico y editable para el
  técnico (cubre RF-09), la consulta se conserva al cambiar de pantalla, y el párrafo
  de alcance sin "todavía no incluye…". **Reemplazar la Figura 9** por la captura de
  la pantalla Consultar nueva (en la misma carpeta). **13/10:** el usuario elige la
  base de datos entre las conexiones registradas (no el motor) y el párrafo de alcance
  ya no dice que falta administrar conexiones: tomar el texto actual. La captura del
  10/10 muestra el selector de motores viejo: hay que retomarla.
 **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`. La Figura 9 sigue siendo la captura vieja hasta tener la nueva (ver entrada de capturas).
### 6.7 — Integración y pruebas del sistema
- [ ] (24/10) **6.7.2 — filas nuevas en la tabla de hallazgos** (`SEGURIDAD.md` §15):

  | Hallazgo | Severidad | Estado |
  |---|---|---|
  | Caída del backend ante un dato de tipo inesperado | Alta | Corregido |
  | Reuso de la contraseña guardada con otro servidor | Media | Corregido |
  | Origen de uso falsificable | Media | Corregido |
  | Contraseñas del banco de pruebas en el repositorio | Alta | Pendiente |

  Actualizar también las cifras de pruebas: API 275/275, interfaz 102/102 y seguridad
  57/57 + 200/200.

- [x] (18/10) **6.7.1 — precios y razonamiento del modelo nuevo**: precio de lista de
  Gemini 3.8 Flash (global): USD 1.50 / M entrada y USD 7.50 / M salida y razonamiento
  (catálogo de Cloud Billing, 18/10); razonamiento en el nivel más bajo; ~USD 0.001 por
  consulta simple (con 2.5 Pro, ~USD 0.012). Texto en `CAPITULO_6.md`. **Aplicado el
  22/10** en `PG2-2026 revisado 22-10-2026.docx`.
- [x] (10/10) **Renumerar la integración a 6.7** (6.7.1 uso y costos, 6.7.2 seguridad,
  6.7.3 tiempos) al entrar 6.5 (M4) y 6.6 (M5); las referencias son hipervínculos, solo
  cambia el número escrito. Las tablas 16–18 pasan a 18–20 (numeración automática). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`.
- [x] (10/10) **6.7.1**: reemplazar el párrafo "Dos limitaciones: el panel visual… no
  define un rol de administrador" por el de `CAPITULO_6.md` (las estadísticas están en
  la pantalla Uso y costos, solo rol técnico). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`.
- [x] (10/10) **6.7.2**: agregar a la tabla de hallazgos la fila "Funciones técnicas
  accesibles a cualquier usuario autenticado | Media | Corregido" (`SEGURIDAD.md` §12). **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`.
- [x] (10/10) **Renumerar a 6.5** al quitar los marcadores de 6.5 y 6.6: 6.5 Integración,
  6.5.1 Registro de uso y costos, 6.5.2 Revisión de seguridad, 6.5.3 Tiempos de ejecución;
  referencias de 6.3.2, 6.3.5 y 6.4 actualizadas. **Aplicado el 10/10** (segunda versión del Word, sin marcadores y con referencias enlazadas).
- [x] (10/10) **Reordenar en el Word**. **Decisión:** hacerlo ya, aunque M4 y M5 no
  estén escritos, para que la numeración de secciones coincida con los módulos de la
  tesis. "6.5 Registro de uso y costos" pasa a ser la primera subsección de 6.7 y "6.6
  Integración de módulos y pruebas del sistema" pasa a 6.7; 6.5 y 6.6 quedan para M4 y
  M5. Ponerle subtítulo a cada parte (registro de uso y costos, revisión de seguridad,
  tiempos de ejecución). Referencias: "sección 6.5" en 6.3.2 y "sección 6.6" en 6.3.5 y
  6.4 → 6.7. **Aplicado el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`,
  versión limpia, sin control de cambios.
- [x] (02/10) **Uso y costos**: reemplazar el párrafo del costo y la tercera fila de la
  tabla de campos por los de `CAPITULO_6.md` (razonamiento del modelo facturado como
  salida, ~$0.012 por llamada, `metrics` en la respuesta de `generateSQL`). **Aplicado
  el 10/10** en `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin
  control de cambios.
- [x] (10/10) **Ampliar la tabla de hallazgos** con los hallazgos 7 a 11 de
  `SEGURIDAD.md` y reemplazar los dos párrafos que la siguen; las filas y los párrafos
  están en `CAPITULO_6.md` (completos desde el 10/10). **Aplicado el 10/10** en
  `PG2-2026 capítulo 6 revisado 10-10-2026.docx`, versión limpia, sin control de
  cambios.
- [x] (02/10) Tablas renumeradas en el texto (uso y costos 17, hallazgos 18, latencias
  19; con la Tabla 10 eliminada pasan a 16, 17 y 18).
- [x] (25/09) Registro de uso y costos redactado y pegado (como 6.5). Resuelve el `[?]`
  del 21/09 sobre dónde va.
- [x] (25/09) Integración y pruebas pegado (como 6.6), con los hallazgos 1 a 6 y las
  latencias.

- [x] (16/10) **6.7.2 — hallazgo 13** (`SEGURIDAD.md` §13: contraseñas leídas del `.env`
  y no de Secret Manager, media, corregido el 13/10 con el registro de conexiones): no
  estaba en esta lista. Se agregó como fila de la Tabla 19 y con un párrafo para los dos
  hallazgos medios (roles y contraseñas); "Los tres últimos" pasa a "Los tres
  siguientes". **Aplicado el 16/10** en `PG2-2026 capítulo 6 revisado 16-10-2026.docx`.
- [ ] (16/10) **Capturas de las Figuras 9, 10 y 11**: las de `Claude outputs/capturas
  10-10-2026/` tienen datos de prueba (`SELECT 1 AS x`, "prueba M5…") y la interfaz del
  10/10 (selector de motores, Conexiones sin formulario). En el Word sigue la Figura 9
  vieja (primera versión del frontend). **17/10:** la Figura 10 (Conexiones) ya está.
  **18/10:** el historial de los usuarios de la demo quedó limpio, así que ya se pueden
  tomar la 9 y la 11. Falta tomarlas con
  preguntas reales (David elige si las toma él o Claude con el navegador del app).

### Presentación del prototipo (6.8 cuando se escriba)
- [ ] Redactar después del 14/10.

## Conclusiones y limitaciones

- [ ] (24/10) **Limitaciones**: agregar
  - la pérdida de precisión de DECIMAL/MONEY en el driver de SQL Server;
  - ~~que el CSV no neutraliza valores que Excel interpreta como fórmulas~~: ya no va
    (24/10), porque la descarga es un Excel que guarda el texto como texto;
  - que el control de límites no pedidos se basa en palabras de la pregunta, y puede
    dejar pasar un límite cuando la pregunta usa «más» o «mayor».

  Fuente: `AUDITORIA_2026-10-24.md`.

- [ ] (25/09) **Reescribir las Conclusiones actuales**: afirman resultados que todavía
  no se midieron (mejora de precisión por la poda, Q712 al mes, ROI de 39,2 %).
  Reescribirlas con los datos de la evaluación y el costo medido.
- [ ] (10/10) **Limitación — SQL no firmado** (reemplaza la de perfiles del 25/09, que
  ya no aplica: los roles se implementaron el 10/10, sección 6.5). Un usuario no
  técnico no puede editar el SQL en la interfaz, pero con su token puede enviar una
  sentencia propia a `executeQuery`; el Query Safety Engine la sigue validando (no
  puede modificar datos). Cerrarlo: firmar en el backend el SQL generado
  (`SEGURIDAD.md` §12).
- [ ] (09/10) **Limitación**: el diccionario de sinónimos de la poda se ajustó con las
  mismas 50 preguntas de la evaluación. Medido con las paráfrasis (antes de la corrida):
  en 2 de 50 la poda pierde tablas (M17, C08). Se decidió **no** ajustarlo para no
  sesgar el resultado.
- [ ] (10/10) **Limitación**: las 50 consultas y sus paráfrasis las redactó el mismo
  asistente que conoce el esquema, no usuarios reales.
- [ ] (08/10) **Limitación / riesgo**: dependencia de un modelo con fecha de retiro.
  **Actualizado 18/10:** ya pasó una vez (`gemini-2.5-pro`, retirado el 20/10/2026) y se
  resolvió cambiando a `gemini-3.8-flash` por configuración, antes de la evaluación; el
  modelo nuevo también tiene fecha (no antes del 02/09/2027). Los resultados medidos
  quedan atados al modelo con que se corrieron.
- [ ] (09/10) **Dato para la discusión**: el costo por consulta (~$0.012) y la latencia
  (~14 s) están dominados por el razonamiento del modelo, no por el tamaño del prompt:
  la poda reduce poco el costo total (~$0.0007 por consulta). **Actualizado 18/10:** con
  Gemini 3.8 Flash en nivel bajo, S10 no razonó (0 tokens), costó $0.0012 y tardó 2.9 s;
  usar las cifras de la corrida.
- [x] (19/10) **On-premises — Conclusiones, recomendaciones, glosario y bibliografía**:
  `CAMBIO_ON_PREMISES.md` OP-37 a OP-41 y la recomendación de OD-04:
  - tres frases de las Conclusiones (se aplican también si se reescriben);
  - dos recomendaciones nuevas: instalación segura y migración a serverless;
  - glosario: Cloud Firestore, Cloud Functions y GCP, más Despliegue híbrido,
    On-premises y VPN;
  - referencia de Microsoft (on-premises data gateway), que hay que verificar;
  - índice;
  - **US-08**: "Superadministrador" en el glosario.

  **Aplicado el 22/10** en `PG2-2026 revisado 22-10-2026.docx` (cotejado el 25/10). La
  referencia quedó como "Microsoft Corporation. (2025)". Si se reescriben las
  Conclusiones, conservar las tres frases.
- [x] (02/10) ~~**Limitación**: el banco de pruebas es chico (200 clientes, 300
  pedidos); la eficiencia con mucho volumen se evaluará con `EXPLAIN` sobre un banco
  grande o queda como trabajo futuro.~~ **Ya no va (25/10):** desde el 24/10 el banco
  tiene 1 485 641 filas en los 4 motores (`Bases de datos/README.md`, «Volumen»). El Word
  del 22/10 no menciona el tamaño viejo. Por decisión de David (24/10), el volumen no
  necesita entradas nuevas acá.
