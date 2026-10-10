# Capítulo 6 — Desarrollo de la aplicación (borrador para el documento principal)

Texto redactado para pegar en el documento de tesis. **Solo contiene texto de tesis:**
qué falta corregir o agregar (en este capítulo y en los demás) está en
`RESUMEN_PARA_DOC_TEORICO.md`, que es la lista de trabajo. Las secciones marcadas
*[Sección pendiente…]* todavía no tienen texto.

**Numeración:** al 19/09 el documento llegaba a la Tabla 13 y a la Figura 8; las tablas
de este capítulo arrancan en la 14. Verificar contra el documento principal.

---

## Capítulo 6 — Desarrollo de la aplicación

El presente capítulo documenta la construcción del sistema conforme a los cinco módulos
funcionales establecidos en el alcance del proyecto (sección 1.5) y al diseño
arquitectónico desarrollado en el Capítulo 5. Para cada módulo se describen las decisiones
de implementación adoptadas, los problemas técnicos encontrados y la verificación
realizada sobre el banco de pruebas.

El desarrollo se llevó a cabo sobre el entorno de pruebas descrito en el Capítulo 5,
compuesto por ocho tablas de un dominio de comercio electrónico con aproximadamente 2,230
registros, replicado con contenido lógico idéntico en los cuatro motores soportados. Esta
condición permitió verificar cada módulo contra bases de datos reales desde la primera
etapa del desarrollo, en lugar de posponer la validación multimotor a la fase de pruebas.

---

## 6.1 Módulo 1 — Gestión segura de conexiones

El módulo de gestión de conexiones resuelve el establecimiento y la administración de
conexiones hacia los cuatro motores soportados, manteniendo la restricción arquitectónica
de que las credenciales nunca sean accesibles desde el cliente (RNF-05 y RNF-07).

### Arquitectura de conexión

Se implementó un administrador de conexiones que mantiene un conjunto de conexiones
reutilizables por cada motor, empleando los controladores oficiales de cada uno. La
selección de controladores respondió a criterios de mantenimiento activo y compatibilidad
con el entorno de ejecución del backend: `pg` para PostgreSQL, `mysql2` para MySQL y
MariaDB —ambos motores comparten protocolo, por lo que un único controlador atiende a los
dos— y `mssql` para SQL Server.

La separación entre metadatos y credenciales se implementó en el nivel del modelo de
datos. El registro de una conexión almacena el motor, el servidor, el puerto, la base de
datos y el usuario, junto con una referencia al recurso donde reside la contraseña. El
valor de la credencial se recupera desde Google Cloud Secret Manager en el momento de
establecer la conexión y se descarta al finalizar la operación, sin persistir en memoria
entre invocaciones ni registrarse en las trazas de ejecución.

### Prueba de conexión y diagnóstico

El módulo expone una operación de prueba de conectividad que permite al usuario técnico
verificar una conexión antes de utilizarla. La operación distingue entre las distintas
causas de fallo —credenciales inválidas, servidor inaccesible, puerto incorrecto, tiempo
de espera agotado y error de autenticación— de modo que el mensaje presentado al usuario
sea accionable sin exponer información interna del sistema (RNF-04).

### Verificación

La conexión se estableció correctamente contra los cuatro motores del banco de pruebas,
utilizando en todos los casos cuentas configuradas con permisos exclusivamente de lectura,
conforme a la cuarta capa de la estrategia de defensa en profundidad descrita en la
sección 2.8.

### Corrección de seguridad aplicada

Durante la revisión del módulo se identificó que la validación del certificado del
servidor de SQL Server se encontraba deshabilitada de forma fija en el código. Esta
configuración es necesaria en el entorno local, donde el contenedor de pruebas utiliza un
certificado autofirmado, pero su presencia fija en el código implicaba que un despliegue
en producción aceptaría cualquier certificado, incluido uno suplantado, habilitando un
ataque de intermediario sobre las credenciales en tránsito.

La corrección trasladó ese comportamiento a una variable de configuración cuyo valor por
defecto es el seguro, de modo que un despliegue que no la modifique quede protegido en
lugar de vulnerable.

---

## 6.2 Módulo 2 — Extracción e interpretación de esquema

El módulo de extracción de esquema obtiene, mediante inspección de las tablas de sistema
de cada motor, una representación estructurada de la base de datos conectada, que
constituye el contexto sobre el cual opera la generación de consultas.

El desafío técnico central de este módulo es la heterogeneidad de los mecanismos de
introspección entre motores, señalada en la sección 2.1. Cada motor expone sus metadatos
mediante catálogos distintos, con nombres de vistas, tipos de datos y convenciones
propias. La solución adoptada consiste en una capa de adaptación con una implementación
por motor y una representación normalizada común, de modo que los módulos posteriores
operen sobre una estructura única independientemente del motor de origen.

### 6.2.1 Inspección de esquema en PostgreSQL y MySQL

En PostgreSQL la extracción se apoya en el esquema estándar `information_schema` para
tablas y columnas, y en los catálogos del sistema para las restricciones de clave foránea
y los índices, que `information_schema` no expone de forma completa.

En MySQL la extracción se realiza íntegramente sobre `information_schema`, que en este
motor incluye tanto las restricciones como los índices. Una diferencia relevante frente a
PostgreSQL es que MySQL crea automáticamente un índice sobre toda columna que participe en
una restricción de clave foránea, comportamiento requerido por su motor de almacenamiento,
mientras que PostgreSQL exige declararlos de forma explícita.

### 6.2.2 Inspección de esquema en MariaDB y SQL Server; normalización

MariaDB, al derivar de MySQL, comparte el mismo mecanismo de introspección, lo que permitió
reutilizar la implementación con diferencias menores.

SQL Server presenta la mayor divergencia. Sus metadatos residen en el esquema `sys`, con
una estructura de catálogos propia, y aunque ofrece vistas de compatibilidad
`information_schema`, estas no exponen la información de índices. La implementación para
este motor consulta directamente los catálogos del sistema.

La normalización produce una representación común en la que cada tabla contiene sus
columnas con tipo de dato y condición de nulidad, su clave primaria, sus relaciones de
clave foránea y sus índices. Los tipos de datos específicos de cada motor se mapean a un
conjunto común, de modo que la representación resultante sea comparable entre motores.

### Verificación

La extracción se ejecutó contra los cuatro motores del banco de pruebas, produciendo en
todos los casos una representación de ocho tablas con sus ocho relaciones de clave foránea
correctamente identificadas. La equivalencia de la representación obtenida en los cuatro
motores verifica el funcionamiento de la capa de abstracción.

---

## 6.3 Módulo 3 — Generación NL2SQL y Query Safety Engine

Este módulo concentra el flujo central del sistema: recibe la consulta en lenguaje
natural, selecciona el subconjunto relevante del esquema, construye el contexto enviado al
modelo de lenguaje, valida la sentencia producida y la ejecuta de forma controlada.

### 6.3.1 Diseño del prompt y estrategia de poda de esquema

La estrategia de poda de esquema selecciona, para cada consulta, únicamente las tablas
relevantes antes de construir el contexto enviado al modelo, conforme a los fundamentos
desarrollados en la sección 2.9.

El procedimiento implementado normaliza los términos de la consulta del usuario y los
compara con los nombres de tablas y columnas del esquema extraído, puntuando cada tabla
según la coincidencia obtenida. A las tablas seleccionadas se agregan aquellas relacionadas
con ellas mediante claves foráneas, dado que una consulta que involucra dos entidades
requiere también las tablas intermedias que las vinculan, aunque estas no aparezcan
mencionadas en la formulación del usuario.

Durante la implementación surgió una condición no prevista en el diseño inicial. El banco
de pruebas emplea nomenclatura en inglés, mientras que las consultas se formulan en
español, de modo que la comparación directa entre los términos de la pregunta y los
nombres del esquema no produce coincidencias: la palabra «cliente» no coincide con
`customers`, ni «pedido» con `orders`. Fue necesario incorporar un diccionario de sinónimos
español–inglés al procedimiento de comparación.

Lo que inicialmente parecía una particularidad del entorno de prueba resultó
representativo de los entornos reales del contexto al que se dirige el proyecto, donde es
frecuente que los esquemas de bases de datos estén nombrados en inglés —por provenir de
sistemas comerciales o de marcos de desarrollo— mientras que los usuarios de negocio
formulan sus consultas en español. Esta condición constituye, por tanto, un caso de prueba
más exigente y más realista que un esquema nombrado en el mismo idioma de las consultas.

### 6.3.2 Integración con Vertex AI Gemini Pro

*[Sección pendiente. El servicio de integración está implementado en el código, pero no ha
podido verificarse por requerir un proyecto de Google Cloud con la interfaz de Vertex AI
habilitada. Al completarse, esta sección debe documentar: la construcción del prompt
estructurado con las instrucciones de generación, el esquema podado y el dialecto del motor
de destino; los parámetros de invocación del modelo, en particular el valor de temperatura
seleccionado y su justificación conforme a la sección 2.4; y el tratamiento de las
respuestas del modelo previo a su validación.]*

### 6.3.3 Implementación del Query Safety Engine

El Query Safety Engine constituye el mecanismo de seguridad distintivo del sistema. Su
principio de diseño, establecido en las secciones 1.4.2 y 2.8, es la separación estricta
entre la generación de la sentencia y la autorización de su ejecución: el modelo de
lenguaje no posee autoridad sobre lo que el sistema ejecuta.

La implementación se sitúa en el backend, es independiente del componente generador y se
aplica a toda sentencia antes de su ejecución, sin excepción. La restricción de solo
lectura se hace efectiva mediante la verificación de que la sentencia corresponda
exclusivamente a una operación de consulta, complementada por los permisos restringidos de
la cuenta de base de datos utilizada.

Se construyó una batería de cincuenta y siete casos de prueba, versionada junto al código
y ejecutable con un único comando. Cuarenta y cuatro casos deben ser bloqueados: operaciones
de modificación de datos, operaciones de definición de estructura y de permisos, sentencias
encadenadas con y sin separador, funciones que leen archivos del servidor, funciones que
ejecutan sentencias recibidas como texto, funciones que alteran el estado del servidor o
retienen recursos, comentarios, variaciones de capitalización e intentos deliberados de
engañar al análisis de literales de texto descrito más adelante. Los trece casos restantes
son consultas legítimas que no deben ser bloqueadas, y permiten medir los falsos positivos.
El componente resolvió correctamente la totalidad de los casos, cumpliendo la meta de
aceptación del cien por ciento establecida en las secciones 3.3.1.2 y 3.7.

#### Hallazgo: evasión del validador en el dialecto Transact-SQL

Durante la revisión de seguridad del backend se identificó y corrigió una vulnerabilidad
crítica en la implementación inicial de este componente. Su documentación tiene valor
porque ilustra de forma concreta el tipo de riesgo que el Query Safety Engine existe para
contener.

La implementación inicial detectaba las sentencias encadenadas mediante la búsqueda del
carácter de punto y coma en el texto de la consulta. Esa regla asume que todo motor exige
dicho separador entre sentencias, lo cual es cierto en PostgreSQL, MySQL y MariaDB, pero no
en SQL Server: el lenguaje Transact-SQL admite la ejecución de varias sentencias separadas
únicamente por espacios en blanco o saltos de línea.

En consecuencia, una consulta construida como una sentencia de lectura seguida de un salto
de línea y una segunda sentencia superaba las tres validaciones existentes, pues comenzaba
con la palabra clave permitida, no contenía punto y coma y no incluía ninguna palabra de la
lista de operaciones prohibidas. Dado que el controlador de conexión empleado devuelve
únicamente el primer conjunto de resultados de un lote, bastaba con situar la consulta
sensible en primer lugar para obtener su resultado.

La condición se comprobó de forma empírica contra el banco de pruebas: una consulta
construida de esa forma devolvió la totalidad de los registros de correo electrónico y
teléfono de la tabla de clientes sin que la validación detectara anomalía alguna. Como
control, la misma cadena enviada a los otros tres motores fue rechazada por el propio motor
con error de sintaxis, lo que confirmó que la vulnerabilidad era específica del dialecto y
no una deficiencia general del componente.

La corrección sustituyó la búsqueda del separador por un recorrido del texto de la
sentencia que mantiene la profundidad de anidamiento entre paréntesis y el estado de
pertenencia a literales de cadena, y que admite una segunda sentencia de lectura de nivel
superior únicamente cuando esta se encuentra precedida por un operador de conjunto —unión,
intersección o diferencia—, que constituye la única forma sintácticamente legítima de que
una consulta contenga más de una sentencia de lectura de primer nivel.

Tras la corrección se verificó el bloqueo del caso original y que las consultas que
emplean operadores de conjunto de forma legítima continúan ejecutándose. Se repitió asimismo la totalidad de la batería de seguridad y el conjunto de
consultas de prueba en los cuatro motores, sin degradación de los resultados previos.

Este hallazgo respalda empíricamente la decisión de diseño documentada en la sección 2.8:
la validación de las sentencias no puede apoyarse en la coincidencia de patrones de texto,
sino que requiere un análisis de la estructura sintáctica que contemple las
particularidades de cada dialecto.

#### Segunda revisión: literales de texto y funciones con efectos

Una segunda revisión del componente identificó dos limitaciones adicionales. La primera
consistía en falsos positivos: la búsqueda de palabras reservadas se aplicaba también al
contenido de los literales de texto, de modo que una consulta legítima como la búsqueda de
un cliente cuyo nombre contiene la palabra «Update» era rechazada. La segunda consistía en
que las funciones de lectura de archivos del servidor, como `pg_read_file` en PostgreSQL o
`LOAD_FILE` en MySQL y MariaDB, superaban la validación por iniciar con una sentencia de
lectura y no contener palabras prohibidas. Se comprobó de forma empírica que en el banco de
pruebas los permisos de la cuenta de base de datos impedían la lectura efectiva —PostgreSQL
denegó la ejecución de la función y MySQL y MariaDB devolvieron un valor nulo—, por lo que
la limitación no era explotable; no obstante, la garantía del sistema no puede depender de
los permisos de la cuenta configurada.

La corrección de la primera limitación sustituye el contenido de los literales de texto
por espacios antes de buscar palabras reservadas, separadores y comentarios. Esta técnica
solo es segura si el validador y el motor coinciden exactamente en dónde comienza y termina
cada literal; de lo contrario, el validador consideraría texto inerte lo que el motor
ejecuta como código. Se identificaron tres construcciones en las que los motores no
coinciden entre sí —la barra invertida como carácter de escape en MySQL y MariaDB, los
literales delimitados por signos de dólar en PostgreSQL y los corchetes, que son
identificadores en SQL Server y subíndices de arreglos en PostgreSQL—; ante cualquiera de
ellas el componente renuncia al análisis de literales y valida el texto completo, con el
comportamiento estricto original. La batería incluye un caso de intento de evasión para
cada una de estas construcciones.

La corrección de la segunda limitación incorpora una lista de funciones prohibidas que
comprende las de acceso a archivos del servidor, las que ejecutan sentencias recibidas como
texto —cuyo bloqueo se vuelve imprescindible una vez que el contenido de los literales deja
de inspeccionarse—, y las que alteran el estado del servidor o retienen recursos. Tras ambas
correcciones se repitió la batería completa y el conjunto de consultas de prueba en los
cuatro motores, sin degradación de los resultados.

### 6.3.4 Pruebas de ejecución controlada en los cuatro motores

Se verificó el funcionamiento de la cadena completa de validación y ejecución mediante un
conjunto de cincuenta consultas representativas del dominio del banco de pruebas,
distribuidas en los tres niveles de complejidad definidos en la sección 3.3.1.2. Cada
consulta se ejecutó en los cuatro motores, para un total de doscientas ejecuciones, y en
todos los casos la sentencia atravesó el Query Safety Engine antes de alcanzar el motor.

Las sentencias empleadas en esta verificación son sentencias de referencia, redactadas
manualmente y adaptadas al dialecto de cada motor. No fueron generadas por el modelo de
lenguaje, cuya integración se encuentra pendiente según se indica en la sección 6.3.2. Esta
prueba verifica, por tanto, la capa de validación y ejecución y la capa de abstracción de
dialectos, y no la precisión del proceso de conversión de lenguaje natural a SQL.

**Tabla 14.** Ejecución controlada del conjunto de prueba en los cuatro motores. Fuente: Elaboración propia.

| Nivel de complejidad | Consultas | Ejecuciones | Ejecuciones exitosas |
|---|---|---|---|
| Simple | 15 | 60 | 60 |
| Intermedio | 20 | 80 | 80 |
| Complejo | 15 | 60 | 60 |
| **Total** | **50** | **200** | **200** |

Adicionalmente se verificó la equivalencia del resultado entre motores, comparando el
número de registros devueltos por cada consulta: las cincuenta produjeron conteos idénticos
en los cuatro motores, sin excepciones.

Las diferencias de dialecto que fue necesario resolver se concentraron en dos
construcciones. La primera es la limitación del número de filas devueltas, que se expresa
mediante la cláusula `LIMIT` en PostgreSQL, MySQL y MariaDB, y mediante `TOP` en SQL
Server. La segunda corresponde a las funciones de manipulación de fechas, cuya sintaxis
difiere entre los cuatro motores, particularmente en el cálculo de diferencias entre fechas
y en la extracción de componentes como el año o el mes.

---

## 6.4 Frontend Next.js y autenticación de interfaz

*[Sección pendiente. Requiere el proyecto de Firebase para la gestión de identidades. Al
completarse debe documentar: la estructura de la aplicación y sus destinos de navegación;
la integración con Firebase Authentication y el flujo de obtención y envío del token; la
presentación diferenciada según el perfil de usuario establecida en la sección 4.2; y el
tratamiento de los estados de la interfaz definidos en los requerimientos no funcionales.]*

---

## 6.5 Módulo 4 — Herramientas de apoyo para usuarios técnicos

*[Sección pendiente. Depende del frontend. Debe documentar las herramientas efectivamente
construidas para el perfil técnico, conforme a lo establecido en el alcance.]*

---

## 6.6 Módulo 5 — Historial y gestión de consultas guardadas

*[Sección pendiente. Requiere el proyecto de Firebase para la persistencia en Cloud
Firestore. Debe documentar la estructura de colecciones implementada conforme al modelo
lógico de datos de la sección 5.2, el almacenamiento del par de consulta en lenguaje
natural y sentencia SQL, y la edición y reutilización de consultas guardadas.]*

---

## 6.7 Integración de módulos y pruebas del sistema

Esta sección documenta la verificación del sistema como conjunto, una vez integrados los
módulos construidos.

### Revisión de seguridad del backend

Se realizó una revisión de seguridad sobre los módulos implementados, consistente en el
examen de cada componente en busca de desviaciones respecto de la restricción de solo
lectura y de las prácticas de manejo de credenciales y autenticación establecidas en la
sección 2.8. Cada hallazgo se comprobó de forma empírica contra el entorno real antes de
ser reportado, en lugar de deducirse únicamente de la lectura del código.

**Tabla 15.** Hallazgos de la revisión de seguridad del backend. Fuente: Elaboración propia.

| Hallazgo | Severidad | Estado |
|---|---|---|
| Evasión del Query Safety Engine en SQL Server mediante sentencias encadenadas sin separador | Crítica | Corregido |
| Omisión de la verificación de identidad ante ausencia de configuración | Alta | Corregido |
| Validación del certificado del servidor deshabilitada de forma fija | Media | Corregido |
| Ausencia de restricción de origen en el servidor de desarrollo | Baja | Documentado |
| Exposición de mensajes de error del controlador al cliente | Baja | Documentado |
| Vulnerabilidades moderadas en dependencias transitivas | Baja | Documentado |

El segundo hallazgo merece mención por su naturaleza. La verificación de identidad podía
omitirse cuando una variable de configuración se encontraba ausente, condición prevista
para permitir el desarrollo local mientras no existiera el proyecto de identidades. La
deficiencia de ese diseño reside en que la ausencia de una variable de configuración es un
escenario que puede producirse por error en un despliegue, de modo que un fallo de
configuración bastaba para desactivar la autenticación de la totalidad de la interfaz de
programación. La corrección exige ahora la activación explícita de una segunda variable
destinada únicamente a ese propósito, de forma que la condición por defecto ante una
configuración incompleta sea el rechazo de la solicitud y no su aceptación.

Los tres hallazgos de severidad baja se documentaron sin corregir, con justificación
explícita: los dos primeros afectan exclusivamente al servidor de desarrollo local, que no
forma parte del despliegue, y el tercero corresponde a dependencias transitivas de las
bibliotecas oficiales del proveedor de nube, cuya actualización forzada implicaría un
riesgo mayor que el que mitiga. Los tres quedan registrados como trabajo previo al
despliegue en producción.

### Tiempos de ejecución sobre el motor

Durante la verificación del conjunto de prueba se registró el tiempo de ejecución de cada
consulta sobre cada motor. Estos tiempos corresponden únicamente al componente de
ejecución y no al tiempo total de respuesta definido en la sección 3.3.1.3, que comprende
además la verificación del esquema, la poda y la generación mediante el modelo de lenguaje.

**Tabla 16.** Latencia de ejecución por motor, en milisegundos. Fuente: Elaboración propia.

| Motor | Ejecuciones | Mínimo | Mediana | Media | Percentil 95 | Máximo |
|---|---|---|---|---|---|---|
| PostgreSQL | 50 | 2 | 13.0 | 13.0 | 18 | 50 |
| MySQL | 50 | 2 | 16.0 | 14.8 | 22 | 26 |
| MariaDB | 50 | 2 | 15.0 | 14.6 | 20 | 22 |
| SQL Server | 50 | 5 | 19.0 | 18.7 | 23 | 65 |
| **Global** | **200** | **2** | **16.0** | **15.3** | **21** | **65** |

El dato relevante para el diseño del sistema no es la magnitud absoluta de estos tiempos
sino su proporción respecto del presupuesto establecido. El percentil 95 de la latencia de
ejecución es de veintiún milisegundos, equivalente al 0.14 por ciento del umbral de quince
segundos definido para consultas simples. La ejecución sobre el motor resulta, por tanto,
despreciable dentro del tiempo total de respuesta, que estará dominado por la latencia de
generación del modelo de lenguaje.

Se observa asimismo que la latencia apenas varía con el nivel de complejidad de la
consulta: la mediana se mantiene entre 16.0 y 16.5 milisegundos en los tres niveles. Este
comportamiento se explica por el volumen del banco de pruebas, que permite resolver los
planes de ejecución en memoria. La diferenciación de umbrales por complejidad establecida
en la sección 3.3.1.3 responde, en consecuencia, al costo de la generación y no al de la
ejecución, lo que deberá considerarse al interpretar los resultados de la evaluación
completa.

---

## 6.8 Presentación del prototipo funcional

*[Sección pendiente. Requiere el frontend y la integración completa.]*

