# Cambios en la tesis del 19/10/2026: despliegue on-premises, tope por conexión y gestión de usuarios

> **Contenido:**
> - Partes 1–5: despliegue on-premises y diferencias con el código (`OP-xx`, `OD-xx`).
> - **Parte 6**: tope de ejecución por conexión y superadministrador con gestión de
>   usuarios (`US-xx`), implementados y verificados el 19/10.
>
> Todo se pasa al Word en una sola revisión.

> **Estado (cotejado el 25/10/2026):** David aplicó todo en `PG2-2026 revisado
> 22-10-2026.docx` (marcado `[x]`), salvo tres puntos:
> - **OP-13**: Tabla 4 y 1.6.3.2. Va con el recálculo de 1.6.3, que también cambia ahí
>   "Gemini Pro 2.5".
> - **OP-36**: 6.7.4. Se escribe después de verificar el acceso desde otro equipo de la
>   red.
> - **US-09**: posterior al Word. Se edita el texto de US-02 y US-06 que ya está.
>
> El cotejo se hizo por frases del texto nuevo y del viejo. OP-03 (5.3.2) quedó con otra
> redacción, y las figuras se comprobaron solo por cantidad de imágenes nuevas (5).

**Decisión de David (19/10/2026):** NLQP se instala **en la red de la organización
(on-premises)**: el frontend y el backend corren en un servidor de la empresa, junto a
sus bases de datos, y se accede por la red local o por VPN. Vertex AI, Firebase Auth,
Firestore y Secret Manager se siguen usando como servicios gestionados de GCP, así que
el despliegue es **híbrido**. La arquitectura serverless de los caps. 2 y 5 (Cloud
Functions + Firebase Hosting) se mantiene como **arquitectura de referencia a la que
el sistema puede escalar**, sin modificar los módulos.

**Motivo:** es lo más rentable y lo más realista para una empresa:
- las bases están en su red privada;
- los resultados no salen de la red;
- no hay costo de cómputo con un servidor existente;
- es lo que se construyó y verificó.

Se descartó desplegar en Firebase/GCP: una VM para SQL Server costaría unos USD 25–30
al mes, y además habría que hacer cambios en el código.

**Documento base:** `Claude outputs/PG2-2026 capítulo 6 revisado 17-10-2026 v2.docx`.
Las instrucciones de abajo salen de leer ese Word completo y compararlo con el código el
19/10/2026.

---

## Cómo usar este documento

- Cada cambio tiene un **ID**, la **sección**, la **acción** y el **texto**:
  - `OP-xx`: por el on-premises;
  - `OD-xx`: otra diferencia con el código que apareció en la misma revisión;
  - `US-xx`: por el tope por conexión y la gestión de usuarios.
- **Ubicar:** el párrafo se identifica por la sección y por cómo empieza; los números de
  página del Word cambian, así que no se usan.
- **Reemplazar** = cambiar exactamente el texto citado por el nuevo. **Agregar** = texto
  nuevo en el lugar indicado. **Eliminar** = quitar el texto citado.
- **[M]** = en ese mismo párrafo también corre el **cambio de modelo** pendiente
  (Gemini 2.5 Pro → Gemini 3.8 Flash, entrada del 18/10 en
  `RESUMEN_PARA_DOC_TEORICO.md`). El texto nuevo de este documento ya dice "Gemini 3.8
  Flash"; en el resto del párrafo aplicar ese cambio a la vez.
- **[Verificar]** = no afirmarlo en el Word hasta comprobarlo (se indica cómo).
- Al pasar un cambio al Word, marcarlo `[x]` acá con la fecha y avisar en el chat
  para actualizar `RESUMEN_PARA_DOC_TEORICO.md`.

**Orden recomendado:**
1. Cap. 5, que es el núcleo y al que remiten los demás.
2. Caps. 1–4.
3. Cap. 6.
4. Conclusiones, recomendaciones, glosario y bibliografía.
5. Figuras.
6. Índice.

**Lo que NO cambia:**
- los cinco módulos y los RF (salvo RF-13, en OD-04);
- las métricas y metas del cap. 3;
- el Query Safety Engine;
- el uso de Vertex AI, Firebase Authentication, Firestore y Secret Manager;
- el marco teórico de serverless de 2.6, que sigue siendo válido porque describe la
  arquitectura de referencia.

---

## Parte 1 — Capítulo 5 (núcleo del cambio)

### [x] OP-01 · 5.3 Diagramas de Infraestructura — Reemplazar el párrafo después de la Figura 8
**Ubicar:** el párrafo que empieza "La totalidad de los componentes de la plataforma se
despliega sobre servicios gestionados…". **Reemplazarlo completo por:**

> El sistema adopta un despliegue híbrido. El frontend y el backend se instalan en un
> servidor dentro de la red de la organización receptora (on-premises), junto a sus
> bases de datos, y los servicios de identidad, almacenamiento interno, gestión de
> secretos e inteligencia artificial se consumen como servicios gestionados de Google
> Cloud Platform. Los usuarios acceden desde el navegador a la dirección del servidor
> dentro de la red local o, desde fuera de ella, a través de la red privada virtual
> (VPN) de la organización. El elemento determinante del diagrama sigue siendo el límite
> de confianza entre el navegador y el backend: las credenciales de acceso a las bases
> de datos residen exclusivamente del lado del servidor y nunca se transmiten al cliente.
> Como el backend comparte la red con los motores, la organización no necesita exponer
> sus bases de datos a internet ni aceptar conexiones entrantes: el único tráfico que
> sale de su red es el que el backend inicia hacia las APIs de Google, cifrado mediante
> TLS.

### [x] OP-02 · 5.3.1 (nuevo) — Agregar después de OP-01
**Agregar** el subtítulo **"5.3.1 Justificación del despliegue local"** y este texto:

> El diseño de los capítulos anteriores, que ubica el backend en funciones de Cloud
> Functions de segunda generación (sección 2.6) y el frontend en Firebase Hosting
> (sección 2.7), se mantiene como arquitectura de referencia. Para la versión inicial se
> eligió, sin embargo, instalar la aplicación en la red de la organización, por cuatro
> razones.
>
> Primera, las bases de datos que el sistema consulta se encuentran, en la mayoría de
> las organizaciones, en su red privada y no expuestas a internet. Con el backend en la
> nube, cada conexión tendría que atravesar esa frontera mediante una VPN entre la nube
> y la organización, un conector de red o la publicación de los puertos de los motores;
> con el backend en la misma red, la conexión es directa. Las soluciones comerciales
> resuelven este problema de forma análoga: Microsoft Power BI, por ejemplo, instala una
> puerta de enlace de datos local (on-premises data gateway) dentro de la red de la
> organización para consultar sus bases sin exponerlas (Microsoft, 2025).
>
> Segunda, los resultados de las consultas no salen de la red de la organización. Al
> modelo de lenguaje solo se envían la pregunta y el esquema podado, nunca los datos
> (sección 6.3.2); con el backend en la nube, en cambio, cada fila de cada resultado
> pasaría por la infraestructura del proveedor.
>
> Tercera, el costo de cómputo es nulo cuando la organización ya cuenta con un servidor,
> y desaparecen las restricciones propias del modelo de funciones: el inicio en frío, el
> almacenamiento temporal en memoria, que limitaría el tamaño de los resultados
> paginados, y la necesidad de compartir esos resultados entre instancias (sección
> 6.3.5).
>
> Cuarta, es el despliegue sobre el cual se construyó y verificó el prototipo, de modo
> que los resultados del Capítulo 6 corresponden al sistema que se entrega.
>
> La contrapartida es que la organización asume la operación del servidor (su
> disponibilidad, sus actualizaciones y sus respaldos), que en el modelo sin servidor
> correspondía al proveedor, y que el escalado deja de ser automático. Para el escenario
> de 35 usuarios de la sección 1.6.3 basta un solo servidor. Los requisitos son un equipo
> con Node.js 22 LTS, acceso de red a los motores de bases de datos, salida a internet
> hacia las APIs de Google (Firebase Authentication, Cloud Firestore, Secret Manager y
> Vertex AI) y una cuenta de servicio de Google Cloud con permisos limitados a esos
> servicios.

> **Bibliografía:** agregar la referencia de Microsoft (OP-40).

### [x] OP-03 · 5.3.2 (nuevo) — Agregar después de OP-02
**Agregar** el subtítulo **"5.3.2 Escalamiento a la arquitectura sin servidor"** y:

> La migración a la arquitectura de referencia no requiere modificar los módulos
> funcionales. Cada función del backend está registrada también como función HTTP de
> Cloud Functions de segunda generación, y el servidor local solo las agrupa en un único
> proceso. Para desplegarlas en la nube hacen falta cuatro ajustes:
>
> - aplicar en cada función la verificación del token de identidad y del rol, que hoy
>   aplica el servidor local;
> - trasladar las copias de los resultados paginados del disco del servidor a un
>   almacenamiento compartido, como Cloud Storage (sección 6.3.5);
> - conectar las funciones con la red de la organización mediante una VPN entre Google
>   Cloud y la organización o un conector de red privada, sin exponer los motores a
>   internet;
> - publicar el frontend como sitio estático en Firebase Hosting, lo que es posible
>   porque no utiliza funciones del lado del servidor.
>
> Conviene migrar cuando el número de usuarios o su distribución geográfica exijan
> escalado automático, o cuando la organización prefiera no operar un servidor propio.

> Fuente técnica: en el código cada archivo de `nlqp/backend/src/functions/` registra
> `functions.http(...)`, pero esos registros no pasan por `verifyFirebaseAuth`. Solo
> `src/index.ts`, el servidor Express, aplica la autenticación. Por eso el primer ajuste
> es obligatorio.

### [x] OP-04 · Figura 8 — Redibujar
**Leyenda nueva:** "Figura 8. Diagrama de despliegue de NLQP. Fuente: Elaboración
propia." (actualizar también el **índice de figuras**).

La figura actual muestra "Google Cloud Platform – proyecto nlqp-prod" con Firebase
Hosting y "Cloud Functions gen2 – us-central1", y "Vertex AI – Gemini 2.5 Pro". El
contenido nuevo es este:

| Bloque | Contenido |
|---|---|
| **Usuarios** | Usuario técnico y usuario no técnico → **Navegador web**. Un usuario remoto llega por **VPN** a la red de la organización |
| **Red de la organización receptora** (recuadro grande) | **Servidor NLQP** con dos cajas: **Frontend Next.js** y **Backend Node.js 22 (Express)**. **Motores de bases de datos**: PostgreSQL, MySQL, MariaDB y SQL Server |
| **Google Cloud Platform – servicios gestionados** (recuadro aparte, fuera de la red) | Firebase Authentication, Cloud Firestore, Secret Manager, Vertex AI – Gemini 3.8 Flash |
| **Flechas** | Navegador → Frontend (HTTP, red local o VPN). Navegador → Backend (API con token JWT). Navegador → Firebase Authentication (inicio de sesión). Backend → los 4 motores (red local). Backend → Firestore, Secret Manager y Vertex AI (HTTPS saliente) |
| **Límite de confianza** | Línea punteada entre el navegador y el Servidor NLQP: "las credenciales nunca cruzan esta frontera" |
| **Opcional** | Recuadro punteado "Escalamiento (sección 5.3.2): Cloud Functions 2.ª gen. + Firebase Hosting" |

Quitar "proyecto nlqp-prod": ese nombre no es el del proyecto real
(`proyectog-340d3`), y no hace falta poner ninguno. Quitar también "us-central1": hoy
la ubicación es `global`.

### [x] OP-05 · 5.1.3 Diagrama de secuencias — Texto y Figura 3
- **Reemplazar** "La secuencia confirma que toda la interacción con servicios sensibles
  ocurre desde la Cloud Function y nunca desde el frontend." **por** "La secuencia
  confirma que toda la interacción con servicios sensibles ocurre desde el backend y
  nunca desde el frontend."
- En el mismo párrafo, **reemplazar** "se originan exclusivamente en la capa de cómputo"
  **por** "se originan exclusivamente en el backend".
- **Figura 3:** renombrar la línea de vida "Cloud Function queryHandler" → **"Backend
  (Node.js)"** y "Vertex AI Gemini Pro" → **"Vertex AI Gemini 3.8 Flash"** [M].
- *Opcional (OD-07):* la figura muestra un solo `POST /query` que genera y ejecuta, y
  pide las credenciales en cada consulta. El sistema real tiene dos pasos (`generateSQL`;
  el usuario revisa y pulsa Ejecutar; `executeQuery`) y lee la contraseña al abrir el
  pool. Si no se redibuja, basta con agregar al final del párrafo: "Por simplicidad, la
  figura agrupa en una sola solicitud la generación y la ejecución, que en el sistema
  son dos solicitudes separadas, con la revisión del usuario entre ambas (sección
  6.4)."

### [x] OP-06 · 5.1.4 Diagrama de componentes — Texto y Figura 4
- **Reemplazar** "toda comunicación con esos elementos se canaliza obligatoriamente a
  través de la capa de lógica desplegada en Cloud Functions." **por** "toda comunicación
  con esos elementos se canaliza obligatoriamente a través de la capa de lógica del
  backend."
- **Figura 4:** "Capa de presentacion - Firebase Hosting" → **"Capa de presentación –
  Frontend Next.js"**. "Capa de logica - Cloud Functions gen2" → **"Capa de lógica –
  Backend Node.js"**. "Vertex AI Gemini Pro" → **"Vertex AI Gemini 3.8 Flash"** [M]. La
  estructura de capas no cambia.

### [x] OP-07 · 5.1.6 Diagrama de clases — Agregar una oración (OD-05)
**Ubicar:** el párrafo que empieza "La estructura se organiza en cuatro agrupaciones.".
**Agregar después de** "…sin modificar los componentes de generación ni de validación."
lo siguiente:

> En la implementación, esta jerarquía se materializa como un módulo con una variante
> por motor para la extracción del esquema y la ejecución, en lugar de clases; la
> extensibilidad es la misma: un motor nuevo requiere agregar su variante sin modificar
> la generación ni la validación.

(En el código no hay clase `AdaptadorMotor`: `schemaExtractor.service.ts` y
`connectionManager.service.ts` usan `switch (engine)`.)

### [x] OP-08 · 5.2 Modelo Entidad-Relación — Reemplazar el párrafo después de la Figura 7 (OD-06)
**Ubicar:** el párrafo que empieza "El modelo comprende cinco colecciones.".
**Reemplazarlo completo por:**

> El diagrama representa el modelo de datos del diseño. En el prototipo se implementó
> con las siguientes diferencias. La colección de conexiones guarda la referencia al
> secreto de Secret Manager y no la credencial (RNF-05), y es compartida por todos los
> usuarios, con el registro de quién la creó. El historial y las consultas guardadas se
> almacenan bajo cada usuario, y una consulta guardada copia la pregunta, la conexión y
> la sentencia en lugar de referenciar la ejecución que la originó, de modo que borrar
> una no afecta a la otra (sección 6.6). Los datos del usuario y su rol residen en
> Firebase Authentication y no en una colección propia. La colección de esquemas en
> caché no se implementó (sección 5.1.2). Se agregaron dos colecciones que el diseño no
> contemplaba: la auditoría de ediciones del SQL (sección 6.5) y el registro de uso y
> costos (sección 6.7.1), donde residen los tokens, el costo y la latencia de cada
> llamada que alimentan la evaluación de la sección 3.3.1.

Diferencias con la Figura 7, por si se quiere redibujar (opcional):
- CONEXIONES tiene `uid` como FK, pero en el código es compartida y guarda `createdBy`.
- USUARIOS no existe como colección.
- CONSULTAS_HISTORIAL no guarda `reduccionTokens` ni `tiempoRespuestaMs`: eso está en
  `usageEvents`.
- CONSULTAS_GUARDADAS no tiene `idConsulta`.
- Faltan `sqlEdits` y `usageEvents`.

Las colecciones reales son `connections`, `users/{uid}/history`, `users/{uid}/saved`,
`sqlEdits` y `usageEvents`.

---

## Parte 2 — Introducción y capítulos 1 a 4

### [x] OP-09 · Introducción [M]
- Párrafo que empieza "El presente trabajo de graduación documenta…": **reemplazar**
  "dentro de una arquitectura sin servidor sobre Google Cloud Platform, garantizando
  seguridad, escalabilidad y eficiencia operativa." **por** "con un backend que se
  instala en la red de la organización, junto a sus bases de datos, y que consume como
  servicios gestionados de Google Cloud Platform la inteligencia artificial, la
  autenticación y el almacenamiento interno; la arquitectura puede escalar a un
  despliegue sin servidor sin modificar sus módulos."
- Párrafo que empieza "El Capítulo 4 presenta el análisis…": **reemplazar** "el modelo
  lógico de datos y la infraestructura sobre Google Cloud Platform" **por** "el modelo
  lógico de datos y el modelo de despliegue".

### [x] OP-10 · 1.3 Justificación
Párrafo que empieza "Adicionalmente, el proyecto aborda una dimensión de seguridad…":
**reemplazar** "toda la conectividad ocurre exclusivamente desde el backend mediante una
arquitectura serverless sobre Google Cloud" **por** "toda la conectividad con las bases
de datos ocurre exclusivamente desde el backend, instalado en la red de la organización,
de modo que las bases no se exponen a internet".

### [x] OP-11 · 1.5 Alcance [M]
Cuarto párrafo, el que empieza "La plataforma se desarrolla sobre una arquitectura sin
servidor…". **Reemplazar** su primera oración, "La plataforma se desarrolla sobre una
arquitectura sin servidor utilizando los servicios de Google Cloud, específicamente Cloud
Functions de segunda generación para el procesamiento del backend, Firestore como base
de datos interna del sistema, Firebase Authentication para la gestión de identidades y
Firebase Hosting para la distribución del frontend desarrollado en Next.js.", **por:**

> La plataforma se compone de un frontend desarrollado en Next.js y un backend en
> Node.js que se instalan en un servidor dentro de la red de la organización
> (on-premises), con acceso para los usuarios por la red local o por la VPN de la
> organización. El backend consume como servicios gestionados de Google Cloud a
> Firestore como base de datos interna del sistema, Firebase Authentication para la
> gestión de identidades, Secret Manager para las credenciales y Vertex AI para la
> generación de consultas. La arquitectura está preparada para escalar a un despliegue
> sin servidor (el backend en Cloud Functions de segunda generación y el frontend en
> Firebase Hosting) sin modificar los módulos funcionales (sección 5.3.2).

En el mismo párrafo hay un espacio faltante: "…gestión de consultas de datos.El
sistema implementa…" → "datos. El sistema".

### [x] OP-12 · 1.6.1 Factibilidad técnica — Tabla 1
- Indicador 1: **reemplazar** "¿Se dispone de los conocimientos técnicos adecuados para
  desarrollar una aplicación web con arquitectura serverless (arquitectura sin
  servidores) en Google Cloud Platform?" **por** "¿Se dispone de los conocimientos
  técnicos adecuados para desarrollar una aplicación web que integre servicios de Google
  Cloud Platform y pueda instalarse tanto en un servidor de la organización como en una
  arquitectura sin servidor?"
- Indicador 8: **reemplazar** "¿La arquitectura sin servidores permite escalado
  automático sin intervención manual?" **por** "¿La arquitectura permite escalar, sin
  modificar sus módulos, de un servidor local a un despliegue sin servidor con escalado
  automático?"
- Los pesos no cambian.

### [ ] OP-13 · 1.6.3.2 y 1.6.3.3 Costos operativos — Tabla 4
**Se hace junto con el recálculo pendiente de 1.6.3** (entradas del 10/10 y del 25/09
en `RESUMEN_PARA_DOC_TEORICO.md`), para no recalcular dos veces.
- 1.6.3.2: **reemplazar** "Todos los servicios utilizan Google Cloud Platform con modelo
  de pago por uso, sin cargos fijos de infraestructura." **por** "Los servicios de Google
  Cloud Platform que consume el sistema se cobran por uso, sin cargos fijos. El frontend
  y el backend se instalan en un servidor de la organización (sección 5.3.1), cuyo costo
  no se incluye porque se asume un equipo existente; si la organización necesita uno
  dedicado, su costo se suma a esta tabla."
- Tabla 4: **eliminar** las filas "Cloud Functions 2nd Gen", "Firebase Hosting" y
  "Google Cloud Storage". Ninguna se usa en el despliegue local.
- Tabla 4: **agregar** la fila "Servidor de la organización (frontend y backend) | Equipo
  existente con Node.js 22 LTS | $0.00 | Q0.00".
- Tabla 4, fila Secret Manager (OD-08): "Almacenamiento de 35 secretos, ~10.5k accesos"
  está mal. Lo más probable es que el "35" saliera de los 35 usuarios del escenario,
  como sospecha David, pero los usuarios no tienen secretos: inician sesión con
  Firebase Authentication. En Secret Manager solo se guardan las contraseñas de las
  bases de datos. Es **un secreto por conexión registrada, no por usuario** (4 en el banco de
  pruebas), y el secreto se lee al abrir el pool, no en cada consulta. Quedaría "Un
  secreto por conexión registrada (4 en el escenario base), leído al abrir cada
  conexión", con un costo de $0.00 dentro de la cuota gratuita. Verificar la cuota
  vigente al recalcular.
- Recalcular los totales y los textos que los citan ("Q712", "Q8,727") con el recálculo
  de Vertex AI ya pendiente.

*(OP-14 descartado: una fila "Despliegue" en la Tabla 6 obligaría a afirmar cómo se
despliegan Text2SQL.ai, Power BI y Tableau, y eso no está verificado.)*

### [x] OP-15 · 1.7 Limitaciones — Agregar la sexta
**Agregar al final de 1.7:**

> En sexto lugar, la versión inicial se instala en un servidor de la organización
> (sección 5.3.1). Esto traslada a la organización la operación de ese servidor
> (disponibilidad, actualizaciones y respaldos) y hace que el escalado no sea
> automático. Además, tanto el servidor como los navegadores de los usuarios necesitan
> salida a internet hacia los servicios de Google: Firebase Authentication para iniciar
> sesión, y Cloud Firestore, Secret Manager y Vertex AI desde el backend. Por eso el
> sistema no puede operar en una red aislada de internet. El despliegue en la
> arquitectura sin servidor de referencia queda descrito en la sección 5.3.2.

[Verificar] Si se quiere agregar "en el prototipo el backend se autentica ante Google
Cloud con las credenciales de la cuenta de desarrollo y no con una cuenta de servicio
dedicada", antes hay que confirmar con qué credenciales corre el backend en la máquina
(`gcloud auth application-default print-access-token` / variable
`GOOGLE_APPLICATION_CREDENTIALS`).

### [x] OP-16 · 2.5 Vertex AI y el modelo Gemini Pro — Último párrafo [M]
**Ubicar:** "La integración de Vertex AI Gemini Pro en NL-Query-Platform se realiza
exclusivamente desde el backend a través de Cloud Functions de segunda generación,
mediante @google/genai…".
- **Reemplazar** "exclusivamente desde el backend a través de Cloud Functions de segunda
  generación, mediante" **por** "exclusivamente desde el backend, mediante".
- **Reemplazar** "que la clave de servicio de acceso al modelo nunca sea expuesta al
  cliente, que todo el tráfico de inferencia ocurra dentro de la red privada de Google
  Cloud, y que" **por** "que las credenciales de acceso al modelo nunca se expongan al
  cliente, que el tráfico hacia Vertex AI viaje cifrado mediante TLS, y que".

### [x] OP-17 · 2.6 Arquitectura serverless — Párrafo de seguridad aplicado a NLQP
**Ubicar:** el párrafo que empieza "En el contexto de NL-Query-Platform, estas
características se traducen en que la función encargada de conectarse…".
**Reemplazarlo completo por:**

> Estas ventajas aplican a NL-Query-Platform en su arquitectura de referencia: la
> función que se conecta a las bases de datos externas operaría con una identidad de
> servicio dedicada con permisos mínimos y sin puertos de escucha permanentes. En el
> despliegue local adoptado para la versión inicial (sección 5.3.1), la protección
> equivalente proviene de que el servidor solo es accesible dentro de la red de la
> organización o a través de su VPN, y de que las credenciales nunca salen del backend.

### [x] OP-18 · 2.6 — Párrafos de "La elección de Cloud Functions…" (también corrige OD-10)
**Ubicar:** el párrafo que empieza "La elección de Cloud Functions de segunda generación
como plataforma de backend para NLQP responde a cuatro criterios técnicos verificados."
y el que le sigue ("Tercero, el modelo de costos…").
- **Reemplazar** "La elección de Cloud Functions de segunda generación como plataforma
  de backend para NLQP responde a cuatro criterios técnicos verificados." **por**
  "Cloud Functions de segunda generación es la plataforma prevista para el backend en la
  arquitectura de referencia de NLQP, por cuatro criterios técnicos."
- **Reemplazar** el cuarto criterio, desde "Cuarto, el aislamiento de ejecución que
  garantiza que las credenciales…" hasta el final del párrafo, **por:** "Cuarto, el
  aislamiento de ejecución: cada instancia mantiene sus propias conexiones, y las
  credenciales con que las abrió, solo en su memoria, sin que lleguen nunca al
  cliente."
  - Motivo: el texto actual dice que las credenciales se leen "en cada invocación" y
    "nunca persisten en memoria entre solicitudes". Eso contradice 6.1.1 y el código,
    donde la contraseña se lee al abrir el pool y queda en memoria mientras el pool está
    activo.
- **Agregar** un párrafo al final de 2.6:

> El backend de NLQP se construyó para esta plataforma: cada una de sus funciones está
> registrada como función HTTP de Cloud Functions. Para la versión inicial, esas
> funciones se agrupan en un único servidor instalado en la red de la organización, por
> las razones expuestas en la sección 5.3.1, y la migración a Cloud Functions se
> describe en la sección 5.3.2.

### [x] OP-19 · 2.7 Firebase — Segundo párrafo
**Ubicar:** "En el contexto de NL-Query-Platform, Firebase actúa como la columna vertebral
de la infraestructura del sistema, proveyendo tres servicios fundamentales…".
**Reemplazar** "proveyendo tres servicios fundamentales que operan de forma integrada:
Firebase Authentication para la gestión de identidades de usuario, Cloud Firestore como
base de datos interna del sistema, y Firebase Hosting para la distribución del
frontend." **por** "proveyendo dos servicios fundamentales que operan de forma integrada:
Firebase Authentication para la gestión de identidades de usuario y Cloud Firestore como
base de datos interna del sistema. Un tercero, Firebase Hosting, está previsto para
distribuir el frontend cuando el sistema escale a la arquitectura sin servidor (sección
5.3.2)."

### [x] OP-20 · 2.7 — Párrafo del JWT
**Ubicar:** "El mecanismo de autenticación opera mediante JSON Web Tokens (JWT)…".
- **Reemplazar** "Cloud Functions de segunda generación verifica la validez de este
  token en cada invocación" **por** "El backend verifica la validez de este token en
  cada solicitud".
- **Reemplazar** "Este modelo de autenticación basada en tokens es particularmente
  adecuado para arquitecturas serverless, dado que elimina la necesidad de mantener
  sesiones en servidor: cada función verifica el token de forma independiente y sin
  estado, en alineación con el principio de ejecución efímera descrito en la sección
  2.6." **por** "Este modelo de autenticación basada en tokens elimina la necesidad de
  mantener sesiones en el servidor: cada solicitud se verifica de forma independiente y
  sin estado, lo que permite que el mismo backend funcione en el servidor de la
  organización y, al escalar, en funciones efímeras (sección 2.6)."

### [x] OP-21 · 2.7 — Firestore: contenido y reglas de seguridad (también corrige OD-03)
- Párrafo que empieza "Cloud Firestore es la base de datos NoSQL…": **reemplazar** "almacena
  los metadatos de las conexiones registradas (sin incluir credenciales, que son
  gestionadas por Secret Manager), el historial de consultas, las preferencias de usuario
  y los registros de auditoría de ejecuciones." **por** "almacena el registro de las
  conexiones (sin las contraseñas, que residen en Secret Manager), el historial y las
  consultas guardadas de cada usuario, la auditoría de las ediciones de SQL y el
  registro de uso y costos." No existen "preferencias de usuario".
- Párrafo que empieza "Para NLQP, la regla de seguridad central establece…":
  **reemplazar su primera oración** ("Para NLQP, la regla de seguridad central establece
  que cada usuario solo puede leer y escribir sus propios documentos, lo que garantiza
  el aislamiento de datos entre usuarios sin requerir lógica de autorización adicional
  en el código de las funciones.") **por:** "En NLQP, el navegador no accede a Firestore:
  todas las lecturas y escrituras las realiza el backend con el SDK de administración de
  Firebase, y el aislamiento entre usuarios lo aplica el propio backend, que guarda el
  historial y las consultas guardadas bajo el identificador del usuario obtenido del
  token verificado (sección 6.6)." La oración de la cuota gratuita queda igual.
  - Motivo: el repositorio no tiene `firestore.rules` y el SDK de administración no
    pasa por ellas. Así 2.7 queda consistente con 6.6.

### [x] OP-22 · 2.7 — Firebase Hosting
- Párrafo que empieza "Firebase Hosting es el servicio de distribución de contenido
  estático…": **reemplazar completo por:**

> Firebase Hosting es el servicio de distribución de contenido estático de Firebase,
> que sirve los archivos desde una red de distribución de contenido (CDN) global con
> certificado SSL/TLS gestionado automáticamente. En la arquitectura de referencia de
> NLQP distribuye el frontend como sitio estático, desacoplado del backend, según los
> principios de la arquitectura Jamstack. En el despliegue local adoptado para la
> versión inicial (sección 5.3.1), el frontend se sirve desde el servidor de la
> organización; como no utiliza funciones del lado del servidor, puede publicarse en
> Firebase Hosting sin cambios cuando el sistema escale (sección 5.3.2).

- Párrafo siguiente, el que empieza "El beneficio operativo más relevante es que el
  frontend no introduce costos de cómputo…": **eliminar**.

### [x] OP-23 · 2.7 — Párrafo del flujo integrado
**Ubicar:** "La integración entre los tres servicios de Firebase en NLQP se materializa…".
- "La integración entre los tres servicios" → "La integración entre los servicios".
- **Reemplazar** "El frontend en Firebase Hosting envía ese JWT junto con cada solicitud
  al backend en Cloud Functions. La función verifica el JWT utilizando el Firebase Admin
  SDK, extrae el identificador único del usuario y usa ese identificador tanto para
  recuperar sus configuraciones de conexión desde Firestore como para registrar la
  ejecución de la consulta." **por** "El frontend envía ese JWT junto con cada solicitud
  al backend, que lo verifica utilizando el Firebase Admin SDK, extrae el identificador
  único del usuario y lo usa para registrar su historial, sus consultas guardadas y su
  uso del sistema."
  - Las conexiones son compartidas, no "configuraciones del usuario".
- En el párrafo siguiente, **reemplazar** "exclusivamente dentro del entorno de
  ejecución de la función" **por** "exclusivamente dentro del backend".

### [x] OP-24 · 2.8 Seguridad (también corrige OD-10)
- Párrafo "En el contexto de sistemas de acceso a bases de datos, este principio se
  concreta en dos capas…": **reemplazar** "el acceso a bases de datos ocurre
  exclusivamente desde Cloud Functions en el backend, y las credenciales configuradas
  son de solo lectura por diseño." **por** "el acceso a bases de datos ocurre
  exclusivamente desde el backend, y las credenciales que se configuran en una
  instalación son de solo lectura por diseño (sección 6.1.4)."
- Párrafo "Según la documentación oficial de Google Cloud (2025), Secret Manager cifra…":
  **reemplazar** "En la arquitectura de NLQP, la función de Cloud Functions recupera las
  credenciales desde Secret Manager en el momento de ejecutar cada consulta, las utiliza
  para establecer la conexión y las descarta al finalizar la invocación, sin persistir
  ningún valor sensible en memoria entre invocaciones ni en registros de ejecución."
  **por** "En NLQP, el backend recupera la contraseña de cada conexión desde Secret
  Manager al abrir su conjunto de conexiones (pool), la mantiene solo en memoria
  mientras ese conjunto está activo y nunca la devuelve al cliente ni la escribe en los
  registros de ejecución (sección 6.1.1)."
- Párrafo "La combinación de estos cuatro principios…": **reemplazar** "la verificación
  del JWT en Cloud Functions" **por** "la verificación del JWT en el backend".

### [x] OP-25 · 2.10 Democratización — Tercera condición
**Ubicar:** "…Tercero, la arquitectura serverless elimina la necesidad de infraestructura
propia de cómputo, reduciendo la barrera de adopción a la disponibilidad de conectividad
y una cuenta de Google Cloud, condiciones alcanzables para la mayoría de las
organizaciones formales de la región." **Reemplazar** esa oración **por:**

> Tercero, el sistema se instala en un único servidor dentro de la red de la
> organización, donde ya residen sus bases de datos, y consume como servicios
> gestionados la inteligencia artificial, la autenticación y el almacenamiento interno;
> la barrera de adopción se reduce a un equipo con Node.js, conectividad a internet y una
> cuenta de Google Cloud, condiciones alcanzables para la mayoría de las organizaciones
> formales de la región que ya operan bases de datos propias. Si la organización
> prefiere no operar ese servidor, el sistema puede migrarse a un despliegue sin
> servidor (sección 5.3.2).

### [x] OP-26 · 3.2.1 Variable independiente [M]
**Reemplazar** "generación automática de SQL mediante Vertex AI Gemini Pro, arquitectura
serverless sobre Google Cloud Platform y mecanismos de seguridad" **por** "generación
automática de SQL mediante Vertex AI Gemini 3.8 Flash, una arquitectura que integra
servicios gestionados de Google Cloud Platform con un servidor instalado en la red de la
organización, y mecanismos de seguridad".

### [x] OP-27 · 3.3.1.4 Confiabilidad
**Reemplazar** "La meta de aceptación es igual o superior al 99%, coherente con los
acuerdos de nivel de servicio típicos de Google Cloud Platform." **por** "La meta de
aceptación es igual o superior al 99%, medida sobre el sistema instalado en el servidor
de la organización durante el período de prueba." Se quita la referencia al SLA de GCP:
la disponibilidad ahora depende sobre todo del servidor propio.

### [x] OP-28 · 3.8 Recursos utilizados — Texto y Tabla 8 (también corrige OD-09) [M]
- Párrafo de hardware: **reemplazar** "No se requiere infraestructura de servidores
  propios dado que toda la arquitectura de producción opera sobre Google Cloud Platform."
  **por** "Durante el desarrollo, esta estación de trabajo cumplió también el papel del
  servidor de la organización: ejecutó el frontend, el backend y los cuatro motores del
  banco de pruebas."
- Párrafo de software: **reemplazar** desde "Los recursos de software y servicios en la
  nube incluyen…" hasta "…para las pruebas de las APIs del backend.." (incluye el doble
  punto que hoy tiene) **por:**

> Los recursos de software y servicios en la nube incluyen los servicios de Google
> Cloud Platform Firebase Authentication, Cloud Firestore, Vertex AI (Gemini 3.8 Flash)
> y Google Cloud Secret Manager; Node.js 22 LTS como entorno de ejecución del backend,
> con Express como servidor HTTP; Next.js 16 con React 19, TypeScript 5 y Tailwind CSS
> 4 para el frontend; Docker Desktop para ejecutar el banco de pruebas con los cuatro
> motores de bases de datos; Visual Studio Code [versión] como entorno de desarrollo
> integrado; Git 2.55 y GitHub para el control de versiones del código fuente, y Postman
> (versión gratuita individual) para las pruebas de las APIs del backend.

  - [Verificar] la versión de VS Code (Ayuda → Acerca de). Git instalado: 2.55. Docker
    Desktop es gratuito para uso personal, educativo y de empresas pequeñas, no para
    todo uso comercial. Si se mantiene la frase "todas las herramientas de software son
    de código abierto con licencia gratuita para uso comercial", agregar esa salvedad.
- Tabla 8, fila "Google Cloud Platform": **quitar** "Hosting, Cloud Functions 2a gen" y
  cambiar "Vertex AI Gemini Pro" → "Vertex AI Gemini 3.8 Flash". El costo (Q2,136) se
  ajusta con el recálculo de 1.6.3 (OP-13).
- Tabla 8, fila "Software de desarrollo": la misma lista del párrafo nuevo.

### [x] OP-29 · 3.9 Cronograma
- Tabla 9, semana 12: "Análisis de resultados, documentación técnica y de usuario,
  despliegue final" → "Análisis de resultados, documentación técnica y de usuario,
  instalación en el servidor de la organización".
- Párrafo que empieza "La metodología RUP fue seleccionada…": **reemplazar** "cuya
  arquitectura serverless y los mecanismos de seguridad asociados" **por** "cuya
  arquitectura y los mecanismos de seguridad asociados".

### [x] OP-30 · 4.1 Descripción del Proyecto [M]
**Ubicar:** "…se construye sobre una arquitectura serverless en Google Cloud Platform,
integrando Vertex AI Gemini Pro como modelo de generación de lenguaje, Cloud Functions de
segunda generación como capa de backend, Firestore como base de datos interna, y Firebase
Authentication y Firebase Hosting para la gestión de identidades y la distribución del
frontend desarrollado en Next.js." **Reemplazar** desde "se construye sobre…" hasta el
final de la oración **por:**

> se construye con un frontend en Next.js y un backend en Node.js instalados en un
> servidor de la organización, que integran como servicios gestionados de Google Cloud
> Platform a Vertex AI Gemini 3.8 Flash como modelo de generación de lenguaje, Cloud
> Firestore como base de datos interna, Secret Manager para las credenciales y Firebase
> Authentication para la gestión de identidades. La arquitectura admite migrar el
> backend a Cloud Functions de segunda generación y el frontend a Firebase Hosting
> (sección 5.3.2).

### [x] OP-31 · 4.3.3 Características (RUP)
**Reemplazar** "dado que su arquitectura serverless y los mecanismos de seguridad
asociados (la cadena de capas descrita en la sección 2.6 y 2.8," **por** "dado que su
arquitectura y los mecanismos de seguridad asociados (la cadena de capas descrita en las
secciones 2.7 y 2.8,".

### [x] OP-32 · 4.5 Requerimientos no funcionales — Tabla 13, RNF-11
| Columna | Actual | Nuevo |
|---|---|---|
| Requerimiento | Escalado automático de la infraestructura sin intervención manual | Despliegue local con ruta de escalamiento |
| Criterio de aceptación | Arquitectura serverless con asignación y liberación automática de recursos según demanda (sección 2.6) | Instalación en un servidor de la organización y migración a una arquitectura sin servidor con escalado automático sin modificar los módulos funcionales (sección 5.3.2) |

---

## Parte 3 — Capítulo 6

### [x] OD-01 · 6.1.4 Verificación — Cuenta de base de datos (dato incorrecto)
**Reemplazar** "La conexión se estableció correctamente contra los cuatro motores del
banco de pruebas, utilizando en todos los casos cuentas configuradas con permisos
exclusivamente de lectura, conforme a la cuarta capa de la estrategia de defensa en
profundidad descrita en la sección 2.8." **por:**

> La conexión se estableció correctamente contra los cuatro motores del banco de
> pruebas. La cuenta utilizada tiene, a propósito, permisos amplios dentro de la base de
> prueba: así las pruebas comprueban que la restricción de solo lectura la aplica el
> Query Safety Engine aun cuando la cuenta podría escribir. En una instalación real se
> configura una cuenta con permisos exclusivamente de lectura, que constituye la cuarta
> capa de la estrategia de defensa en profundidad descrita en la sección 2.8.

Fuente: `Bases de datos/README.md`. `testuser` tiene todos los permisos dentro de
`testdb` "a propósito", y `init/postgres/02-users.sql` le da `GRANT ALL PRIVILEGES`. Las
cuentas de solo lectura estaban en `../db/`, que no existe en disco.

### [x] OP-33 · 6.3.5 — Limitación del almacén de copias
**Ubicar:** "Como limitación, el almacén de copias reside en el disco del proceso del
backend. En un despliegue con varias instancias de Cloud Functions tendría que
trasladarse a almacenamiento compartido, como Cloud Storage. Además, reiniciar el backend
invalida los resultados vigentes." **Reemplazar completo por:**

> El almacén de copias reside en el disco del servidor del backend, lo que funciona en
> el despliegue local, que ejecuta un solo proceso (sección 5.3.1). Al escalar a Cloud
> Functions tendría que trasladarse a un almacenamiento compartido, como Cloud Storage,
> porque cada instancia tiene su propio almacenamiento temporal y este reside en memoria
> (sección 5.3.2). Como limitación, reiniciar el backend invalida los resultados
> vigentes.

### [x] OD-02 · 6.3.5 — Tope de tiempo: ahora por conexión, 8 min por defecto (código del 19/10)
El tope era de 60 s globales, pero RNF-01, 3.3.1.3, 3.7 y el indicador 6 de la
factibilidad operativa aceptan reportes de hasta 8 minutos.

**Decisiones de David (19/10):**
1. Que los reportes de ese tiempo se puedan ejecutar.
2. Que el tope lo configure el técnico **por conexión**, al registrarla.

En el código:
- `queryTimeoutSec` en cada conexión, de 10 s a 60 min;
- 8 min por defecto (`NLQP_QUERY_TIMEOUT_MS`);
- siempre hay un tope.

**Verificado el 19/10:**
- Una consulta de **186,4 s** se completó por la API con el tope de 8 min.
- Una conexión con tope de **10 s**: el propio motor canceló la consulta en los 4
  (10,4–10,8 s) y la conexión siguió sana.
- API 59/59, UI 33/33, `test:seguridad` 57/57 + 200/200.

**Cambios en el Word, 6.3.5**, párrafo que empieza "Tiempo máximo de ejecución.":
- **reemplazar** "Se fijó un tope de tiempo configurable que se aplica dentro de cada
  motor" **por** "Cada conexión tiene un tope de tiempo, que el usuario técnico fija al
  registrarla, entre 10 segundos y una hora, y que por defecto es de 8 minutos, el
  tiempo que la sección 3.3.1.3 acepta para reportes complejos. El tope se aplica
  dentro de cada motor";
- **agregar al final del párrafo:**

> Con el tope por defecto, una consulta de 186 segundos se completó sin interrupciones;
> con una conexión configurada en 10 segundos, cada uno de los cuatro motores canceló
> la consulta a los 10 segundos y la conexión siguió disponible.

El párrafo de verificación de 6.3.5 ("Con un tope de 2 segundos…") queda igual.

### [x] OP-34 · 6.7.1 Registro de uso y costos
**Reemplazar** "Se espera la escritura antes de responder, porque en Cloud Functions una
operación pendiente puede perderse si la instancia se recicla." **por** "Se espera la
escritura antes de responder, de modo que el registro no se pierda si el proceso se
reinicia o si, al escalar a Cloud Functions, la instancia se recicla."

### [x] OP-35 · 6.7.2 Revisión de seguridad — Tabla 14 y párrafo
- Tabla 14: "Sin restricción de origen en el servidor de desarrollo" → "Sin restricción
  de origen en el servidor del backend". El estado sigue "Documentado". Ahora el
  servidor Express es el servidor real, no solo el de desarrollo.
- Párrafo que empieza "De los hallazgos de severidad baja, tres se dejaron documentados
  con justificación:": **reemplazar** "los dos primeros afectan solo al servidor de
  desarrollo, y el de dependencias corresponde a bibliotecas oficiales del proveedor,
  cuya actualización forzada implicaría más riesgo del que mitiga; quedan como trabajo
  previo a un despliegue en producción." **por** "los dos primeros afectan al servidor
  del backend, cuya exposición en el despliegue local se limita a la red de la
  organización o a su VPN, y el de dependencias corresponde a bibliotecas oficiales del
  proveedor, cuya actualización forzada implicaría más riesgo del que mitiga; los tres
  quedan como trabajo previo a la instalación en producción."

### [ ] OP-36 · 6.7.4 (nuevo) Instalación en la red de la organización — Escribir después de verificar
**No pasarlo al Word hasta hacer la verificación** (próximo paso en `CLAUDE.md`). Hoy el
sistema solo se probó en `localhost` con `next dev`. Borrador:

> **6.7.4 Instalación en la red de la organización**
> El sistema se instaló como lo describe la sección 5.3.1: en un mismo equipo se
> ejecutan el backend (Node.js 22, compilado y ejecutado como proceso de producción) y
> el frontend (Next.js, compilado y servido en modo de producción), con las cuatro bases
> de datos del banco de pruebas en contenedores. Los usuarios acceden desde el navegador
> a la dirección del equipo en la red local. Desde [completar: otro equipo / un
> teléfono] conectado a la misma red se verificó [completar: inicio de sesión de ambos
> roles, ejecución, paginación, CSV, historial — N de N comprobaciones].

Para verificarlo, sin costo salvo "Generar SQL" (~$0.001–0.004 por intento):
1. `npm run build` + `npm start` en el backend.
2. En el frontend, `NEXT_PUBLIC_BACKEND_URL=http://<IP-LAN>:8080`, y después
   `npm run build` + `npm start`.
3. Abrir el puerto en el firewall de Windows solo para la red privada.
4. Entrar desde un teléfono en la misma Wi-Fi.

**Agregar 6.7.4 al índice.**

---

## Parte 4 — Conclusiones, recomendaciones, glosario, bibliografía e índice

Las conclusiones están pendientes de reescritura completa (entrada del 25/09 en
`RESUMEN_PARA_DOC_TEORICO.md`). Estos cambios se aplican también si se reescriben.

### [x] OP-37 · Conclusiones
- Primer párrafo: **reemplazar** "la integración de modelos de lenguaje de gran escala
  con arquitecturas serverless sobre Google Cloud Platform constituye" **por** "la
  integración de modelos de lenguaje de gran escala, consumidos como servicio gestionado
  de Google Cloud Platform, con un backend instalado en la red de la organización
  constituye".
- Segundo párrafo: **reemplazar** "verificación en Cloud Functions" **por**
  "verificación del token en el backend".
- Último párrafo: **reemplazar** "La arquitectura serverless elimina la necesidad de
  infraestructura propia de cómputo, reduciendo la barrera de adopción a la
  disponibilidad de conectividad y una cuenta de Google Cloud." **por** "La instalación
  en un único servidor de la organización, junto a sus bases de datos, reduce la barrera
  de adopción a un equipo con conectividad a internet y una cuenta de Google Cloud, sin
  exponer las bases a internet, y la arquitectura conserva la posibilidad de migrar a un
  despliegue sin servidor cuando el volumen de uso lo justifique."

### [x] OP-38 · Recomendaciones — Agregar dos
**Agregar al final:**

> Se recomienda que la instalación en la organización utilice una cuenta de servicio de
> Google Cloud dedicada, con permisos limitados a Vertex AI, Cloud Firestore y Secret
> Manager; cuentas de base de datos con permisos exclusivamente de lectura; acceso
> remoto únicamente a través de la VPN de la organización, y la restricción de las
> solicitudes al origen del frontend (sección 6.7.2).
>
> Se recomienda migrar a la arquitectura sin servidor de referencia (sección 5.3.2)
> cuando el número de usuarios, su distribución geográfica o la falta de personal para
> operar el servidor lo justifiquen. Antes de esa migración deben completarse los
> cuatro ajustes descritos en esa sección, en particular la verificación del token de
> identidad y del rol en cada función desplegada, sin la cual las funciones quedarían
> accesibles sin autenticación.

### [x] OP-39 · Glosario
- **Cloud Firestore:** "…utilizada en NLQP como sistema de almacenamiento interno para
  metadatos, historial de consultas y configuraciones de usuario." → "…utilizada en NLQP
  como almacenamiento interno para el registro de conexiones, el historial y las
  consultas guardadas, la auditoría de ediciones y el registro de uso."
- **Cloud Functions:** "En NLQP constituye la capa completa de backend." → "En NLQP es la
  plataforma prevista para el backend al escalar a la arquitectura sin servidor (sección
  5.3.2)."
- **GCP:** "…sobre el cual se construye la arquitectura completa de NLQP." → "…del cual
  NLQP consume los servicios de identidad, almacenamiento interno, gestión de secretos e
  inteligencia artificial."
- **Agregar**, en orden alfabético:
  - **Despliegue híbrido:** Modalidad de despliegue que combina componentes instalados
    en la infraestructura de la organización con servicios gestionados en la nube. En
    NLQP, el frontend y el backend se instalan en la red de la organización y consumen
    servicios de Google Cloud.
  - **On-premises (instalación local):** Modalidad de despliegue en la que el software
    se instala y ejecuta en servidores de la propia organización, dentro de su red, en
    lugar de en la infraestructura de un proveedor de nube.
  - **VPN (Virtual Private Network):** Red privada virtual. Conexión cifrada que permite
    a un usuario fuera de las instalaciones acceder a la red interna de la organización
    como si estuviera dentro de ella.
- "Gemini Pro" en Token, Transformer y Vertex AI: corre el cambio de modelo [M].

### [x] OP-40 · Bibliografía
- **Agregar:** Microsoft. (2025). *What is an on-premises data gateway?* Microsoft
  Learn. https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-onprem
  - [Verificar] antes de citarla: abrir el enlace y ajustar el año a la fecha que
    muestre la página.
- Las referencias de serverless, Cloud Functions y Firebase Hosting **se mantienen**,
  porque 2.6 y 2.7 las siguen citando para la arquitectura de referencia.

### [x] OP-41 · Índice, índice de figuras y numeración
- Agregar 5.3.1, 5.3.2 y 6.7.4 (esta última cuando se escriba).
- Figura 8: leyenda nueva (OP-04).
- Actualizar los campos del Word (clic derecho en el índice → Actualizar campos → Toda
  la tabla).

---

## Parte 5 — Otras diferencias con el código (no dependen del on-premises)

Salieron en la misma revisión. Las que caen en un párrafo ya tocado arriba están
integradas en esa instrucción.

| ID | Qué | Dónde se corrige |
|---|---|---|
| OD-01 | 6.1.4 dice que las pruebas usaron cuentas de solo lectura; `testuser` tiene permisos amplios a propósito | OD-01 (Parte 3) |
| OD-02 | Tope de 60 s frente a reportes de hasta 8 min → ahora por conexión, 8 min por defecto (código del 19/10) | OD-02 (Parte 3) |
| OD-03 | 2.7: aislamiento por reglas de Firestore (no existen) y "preferencias de usuario" (no existen) | OP-21 |
| OD-04 | **Registro de cambios ya existe** (auditoría de ediciones del 13/10), pero 1.5, 1.7, 4.4 y Recomendaciones dicen que no. **RF-13** pone al no técnico como actor de la edición, pero solo el técnico puede editar el SQL | Abajo |
| OD-05 | Clase `AdaptadorMotor` sin equivalente en el código | OP-07 |
| OD-06 | Modelo de datos (Figura 7) distinto de las colecciones reales | OP-08 |
| OD-07 | Figura 3: un solo `POST /query` y credenciales en cada consulta | OP-05 (opcional) |
| OD-08 | Tabla 4: "35 secretos" (es uno por conexión) | OP-13 |
| OD-09 | 3.8: falta React, Express, Tailwind y Docker; Git 2.45 → 2.55 | OP-28 |
| OD-10 | 2.6 y 2.8: credenciales "en cada invocación" frente a la lectura al abrir el pool | OP-18 y OP-24 |

### [x] OD-04 · Registro de cambios y RF-13
- **1.5 Alcance**, final del tercer párrafo: **reemplazar** "La versión inicial no
  incluye registro de cambios sobre las ediciones realizadas a las consultas guardadas,
  funcionalidad prevista para versiones futuras del sistema." **por** "Las ediciones del
  SQL que realiza el usuario técnico, sobre la sentencia generada o sobre una consulta
  guardada, quedan en un registro de auditoría con la sentencia original, la editada, el
  usuario y la fecha (sección 6.5); el control de versiones completo de cada consulta
  guardada queda previsto para versiones futuras."
- **1.7, quinto lugar:** **reemplazar el párrafo completo** (empieza "En quinto lugar, el
  módulo de historial y gestión de consultas guardadas implementado en la versión
  inicial del sistema no incluye un mecanismo de registro de cambios…") **por:**

> En quinto lugar, el módulo de historial y consultas guardadas registra cada edición
> del SQL en una auditoría (sección 6.5), pero no ofrece control de versiones: desde una
> consulta guardada no es posible consultar ni restaurar sus versiones anteriores, y
> solo el usuario técnico puede editar el SQL. La incorporación de un control de
> versiones, con la posibilidad de comparar y restaurar versiones, queda prevista para
> versiones futuras del sistema.

- **4.4, Tabla 12, RF-13:** Descripción → "El sistema debe permitir reutilizar una
  consulta guardada sin requerir una nueva formulación en lenguaje natural y, al usuario
  técnico, editar su sentencia SQL". Actor → "Usuario No Técnico (reutilización),
  Usuario Técnico (reutilización y edición)".
- **4.4, párrafo después de la Tabla 12:** **reemplazar** "así como el registro de
  historial de cambios sobre las ediciones de consultas guardadas, dado que ambos casos
  están explícitamente delimitados como fuera del alcance de la versión inicial del
  sistema, según se documentó en las secciones 1.5 y 1.7." **por** "que está
  explícitamente delimitado como fuera del alcance del sistema, según se documentó en
  las secciones 1.5 y 1.7."
- **Recomendaciones**, la que empieza "Se recomienda extender en versiones futuras el
  módulo de historial…": **reemplazar completa por:** "Se recomienda extender la
  auditoría de ediciones del SQL (sección 6.5) a un control de versiones de cada
  consulta guardada, que permita consultar, comparar y restaurar sus versiones
  anteriores desde la propia consulta. Esta funcionalidad, identificada como limitación
  en la sección 1.7, incrementaría la trazabilidad de las consultas reutilizadas dentro
  de la organización."

---

## Parte 6 — Tope por conexión y gestión de usuarios (implementados el 19/10)

Dos funciones nuevas pedidas por David el 19/10, ya implementadas y verificadas. El
tope por conexión va en OD-02 (6.3.5) y acá en 6.1. La gestión de usuarios la hace un
**superadministrador**, presentado como un **permiso del Usuario Técnico** y no como un
actor nuevo. Así el 4.2, la Tabla 7 y la muestra no cambian.

Datos del código:
- el permiso es `superadmin: true` en Firebase y solo se asigna con
  `npm run set:superadmin`;
- pantalla Usuarios;
- `/signup` eliminado;
- rol y estado leídos de la cuenta en cada solicitud.

Verificado: API 35/35 (usuarios) y 59/59 (conexiones), UI 20/20 y 33/33, seguridad
57/57 + 200/200.

### [x] US-01 · 4.2 Identificación de usuarios — Agregar una oración
**Ubicar** el párrafo que empieza "Es relevante señalar que, a diferencia de sistemas
transaccionales convencionales, NLQP no define un actor de tipo «administrador del
sistema»…". **Agregar al final:**

> La gestión de las cuentas de usuario la realiza un usuario técnico con permiso de
> superadministrador; ese permiso no constituye un actor distinto, sino una atribución
> adicional del Usuario Técnico, que se asigna fuera de la interfaz del sistema.

### [x] US-02 · 4.4 Requerimientos funcionales — Tabla 12
- **RF-14**, descripción → "El sistema debe permitir el inicio de sesión con correo y
  contraseña mediante Firebase Authentication. Las cuentas las crea el
  superadministrador, sin registro público, y el backend debe rechazar toda solicitud
  sin un token de identidad válido o de una cuenta sin rol o desactivada".
- **Agregar RF-15:**

  | Campo | Valor |
  |---|---|
  | Requerimiento | Tiempo máximo de ejecución por conexión |
  | Descripción | El sistema debe permitir al usuario técnico fijar, al registrar o editar una conexión, el tiempo máximo de ejecución de sus consultas, entre 10 segundos y una hora, con 8 minutos por defecto |
  | Módulo relacionado | Gestión de conexiones |
  | Actor asociado | Usuario Técnico |

- **Agregar RF-16:**

  | Campo | Valor |
  |---|---|
  | Requerimiento | Gestión de usuarios |
  | Descripción | El sistema debe permitir al usuario técnico con permiso de superadministrador crear cuentas con un rol asignado, cambiar su rol y desactivarlas o reactivarlas, sin eliminarlas |
  | Módulo relacionado | Transversal a todos los módulos |
  | Actor asociado | Usuario Técnico (superadministrador) |

### [x] US-03 · 5.1.1 Casos de uso — Figura 1 y su párrafo
- **Figura 1**, agregar dos casos de uso:
  - "Gestionar usuarios", asociado al Usuario Técnico, con la nota «superadministrador»;
  - "Configurar tiempo máximo de ejecución", que extiende "Administrar conexiones".
- **Agregar** al final del párrafo que empieza "El diagrama evidencia la diferenciación
  de acceso…":

> La gestión de usuarios corresponde al usuario técnico con permiso de
> superadministrador, que crea las cuentas y asigna sus roles; el sistema no tiene
> registro público.

### [x] US-04 · 6.1.2 y 6.1.4 — Tope en el registro de conexiones
- **6.1.2**, agregar al final del primer párrafo (el que termina "…al editar, dejarla
  vacía conserva la guardada."):

> El formulario incluye además el tiempo máximo de ejecución de la conexión, entre 10
> segundos y una hora, con 8 minutos por defecto (sección 6.3.5). Al editarlo, el nuevo
> valor rige desde la consulta siguiente, porque editar la conexión cierra su conjunto
> de conexiones.

- **6.1.4**:
  - **reemplazar** "El registro de conexiones se verificó con 38 de 38 casos sobre la
    API:" **por** "El registro de conexiones se verificó con 59 de 59 casos sobre la
    API:";
  - **agregar** antes de "…y una conexión eliminada responde 404." el texto: "el tiempo
    máximo fuera de rango se rechaza, una conexión nueva sin tiempo máximo queda con 8
    minutos, una edición sin ese dato lo conserva, con un tope de 10 segundos cada uno
    de los cuatro motores cancela una consulta larga a los 10 segundos,";
  - **reemplazar** "En la interfaz, 27 de 27 comprobaciones fueron correctas:" **por**
    "En la interfaz, 33 de 33 comprobaciones fueron correctas:" y **agregar** al final
    de la enumeración: "; el tiempo máximo viene en 8 minutos, un valor fuera de rango
    no deja guardar y el valor editado se muestra en la lista".

### [x] US-05 · 6.4 Frontend — Pantallas y rol
- **Reemplazar** "Fuera de la sesión hay dos pantallas, /login y /signup." **por**
  "Fuera de la sesión hay una sola pantalla, /login: no hay registro público, porque las
  cuentas las crea el superadministrador (sección 6.5)."
- **Reemplazar** "y Conexiones, Esquema y Uso y costos solo para el rol técnico (sección
  6.5)." **por** "Conexiones, Esquema y Uso y costos solo para el rol técnico, y
  Usuarios solo para el superadministrador (sección 6.5)."
- **Reemplazar** "junto con el rol del usuario, que se lee del token de identidad."
  **por** "junto con el rol del usuario y su permiso de superadministrador, que el
  frontend pide al backend y este lee de la cuenta, no del token."

### [x] US-06 · 6.5 Herramientas técnicas — Roles y gestión de usuarios
- **Reemplazar** "Las cuentas creadas desde el registro empiezan como no técnicas, el
  permiso menor." **por** "No hay registro público: las cuentas las crea el
  superadministrador, siempre con un rol, y el backend rechaza cualquier cuenta sin rol,
  por ejemplo una creada directamente contra el servicio de identidades."
- **Reemplazar** "un middleware verifica el rol en cada solicitud a una función técnica
  y responde 403 si no corresponde." **por** "un middleware lee el rol y el estado de la
  cuenta en cada solicitud, no del token, que conserva hasta una hora los datos con que
  se emitió, y responde 403 si no corresponde; así un cambio de rol o una desactivación
  rigen en la solicitud siguiente."
- **Agregar**, antes de "6.5.1 Verificación", el párrafo:

> La gestión de usuarios corresponde al superadministrador, un usuario técnico con un
> permiso adicional que solo se asigna con una herramienta de administración, nunca
> desde la interfaz. Desde la pantalla Usuarios crea cuentas con correo, contraseña
> temporal y rol, cambia el rol y desactiva o reactiva cuentas; no las elimina, para
> conservar su historial y su auditoría. No puede desactivar su propia cuenta ni
> quitarse el rol técnico.

- **6.5.1**, agregar al final:

> La gestión de usuarios se verificó con 35 de 35 comprobaciones sobre la API: solo el
> superadministrador accede; se rechazan el correo inválido, la contraseña corta, el
> rol inválido y el correo repetido; el cambio de rol rige en la solicitud siguiente
> con la misma sesión; una cuenta desactivada es rechazada al instante y no puede
> iniciar sesión; la cuenta propia está protegida, y una cuenta sin rol recibe 403. En
> la interfaz, 20 de 20: el inicio de sesión ya no ofrece crear una cuenta, la pantalla
> de registro no existe, y se verificaron el alta, el cambio de rol, la desactivación
> con su aviso al iniciar sesión, la reactivación y que el técnico no accede a la
> pantalla.

### [x] US-07 · 6.7.2 Revisión de seguridad — Tabla 14
- **Agregar la fila:** "Registro público abierto y rol leído del token | Media |
  Corregido".
- **Agregar** al final de la sección:

> El último hallazgo apareció al decidir la instalación en la red de la organización:
> cualquiera podía crearse una cuenta y consultar las bases, y un cambio de rol tardaba
> hasta una hora en regir porque el rol se leía del token. Se eliminó el registro
> público, se exige un rol en cada cuenta y el backend lee el rol y el estado de la
> cuenta en cada solicitud (sección 6.5).

### [x] US-08 · Glosario
**Agregar**, en orden alfabético:
- **Superadministrador:** Usuario técnico con permiso para gestionar las cuentas del
  sistema: crearlas con un rol, cambiar su rol y desactivarlas o reactivarlas.

### [ ] US-09 · Contraseña nueva por el superadministrador (24/10)
Pedido de David del 24/10. Se aplica **sobre** lo que ya dejaron US-02 y US-06 (si ya
están en el Word, editar ese texto).
- **RF-16** (Tabla 12), descripción → "El sistema debe permitir al usuario técnico con
  permiso de superadministrador crear cuentas con un rol asignado, cambiar su rol,
  ponerles una contraseña nueva y desactivarlas o reactivarlas, sin eliminarlas".
- **6.5**, en el párrafo de la gestión de usuarios, **reemplazar** "cambia el rol y
  desactiva o reactiva cuentas;" **por** "cambia el rol, pone una contraseña nueva y
  desactiva o reactiva cuentas;" y **agregar** al final del párrafo:

> Una contraseña nueva impide renovar las sesiones abiertas de la cuenta, aunque la que
> esté en uso sigue vigente hasta que vence su token, una hora como máximo; para cortar
> el acceso al instante, la cuenta se desactiva.

- **6.5.1**, en el párrafo agregado por US-06:
  - **reemplazar** "35 de 35 comprobaciones sobre la API" **por** "50 de 50
    comprobaciones sobre la API";
  - **agregar** antes de "y una cuenta sin rol recibe 403." el texto: "solo el
    superadministrador puede poner una contraseña nueva, que se valida igual que en el
    alta, deja de valer la anterior e impide renovar las sesiones abiertas;";
  - **reemplazar** "En la interfaz, 20 de 20:" **por** "En la interfaz, 27 de 27:" y
    **agregar** antes de "y que el técnico no accede a la pantalla." el texto: "el
    cambio de contraseña con su confirmación,".
- **Glosario** (US-08), **Superadministrador**, reemplazar "cambiar su rol y
  desactivarlas o reactivarlas" por "cambiar su rol, ponerles una contraseña nueva y
  desactivarlas o reactivarlas".

---

## Pendientes de código relacionados (no son cambios del Word; están en "Abierto" de `CLAUDE.md`)

- `cors()` abierto en `backend/src/index.ts`. Con el despliegue local, ese es el
  servidor real; conviene restringirlo al origen del frontend en la red.
- El comentario de `backend/src/index.ts` dice "este archivo no se usa en producción".
  Con la decisión del 19/10 sí es el servidor de producción.
- Los handlers registrados con `functions.http(...)` no verifican el token. Solo
  importa si algún día se despliega en Cloud Functions (OP-03).
- No hay cuenta de BD de solo lectura en el banco de pruebas (`../db/` no existe).
