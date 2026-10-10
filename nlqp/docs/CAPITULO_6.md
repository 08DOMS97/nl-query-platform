# Capítulo 6 — Desarrollo de la aplicación (borrador para el documento principal)

Texto redactado para pegar en el documento de tesis. **Solo contiene texto de tesis:**
qué falta corregir o agregar (en este capítulo y en los demás) está en
`RESUMEN_PARA_DOC_TEORICO.md`, que es la lista de trabajo. Solo está lo que ya se
documenta en el Word: las secciones que faltan (evaluación con Gemini, Módulos 4 y 5,
presentación del prototipo) no llevan título ni marcador hasta tener texto.

**Versión (sincronizado con el Word el 10/10):** cada sección tiene el texto más
reciente redactado. Si difiere de lo que ya está pegado en el Word,
`RESUMEN_PARA_DOC_TEORICO.md` dice qué cambiar. Parte de este texto se redactó en el
chat de Cowork (25/09 y 02/10).

**Numeración:** al quitar la "Tabla 10." vacía del Cap. 3 (10/10), antes de este
capítulo el Word llega a la Tabla 13 y a la Figura 8. Tablas del capítulo: 14 (6.3.4),
15 (6.3.5), 16 (6.5, Módulo 4), 17 (6.6, Módulo 5), 18 (6.7.1), 19 (6.7.2) y 20 (6.7.3);
Figuras 9 (6.4), 10 (6.5) y 11 (6.6). En el Word las leyendas se numeran solas (estilos
"Tabla 1" e "I_Figuras"): no se escribe el número a mano.
**Secciones (10/10, con M4 y M5):** 6.5 Módulo 4, 6.6 Módulo 5 y 6.7 Integración
(6.7.1 uso y costos, 6.7.2 seguridad, 6.7.3 tiempos). En el Word las referencias son
hipervínculos a los títulos, así que solo cambia el número escrito.

---

## Capítulo 6 — Desarrollo de la aplicación

El presente capítulo documenta la construcción del sistema conforme a los cinco módulos
funcionales establecidos en el alcance del proyecto (sección 1.5) y al diseño
arquitectónico desarrollado en el Capítulo 5. Para cada módulo se describen las decisiones
de implementación adoptadas, los problemas técnicos encontrados y la verificación
realizada sobre el banco de pruebas.

El desarrollo se llevó a cabo sobre un banco de pruebas compuesto por ocho tablas de un
dominio de comercio electrónico con aproximadamente 2,230 registros, replicado con
contenido lógico idéntico en los cuatro motores soportados. Esta condición permitió
verificar cada módulo contra bases de datos reales desde la primera etapa del
desarrollo, en lugar de posponer la validación multimotor a la fase de pruebas.

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

La poda selecciona, para cada consulta, solo las tablas que hacen falta antes de armar
el contexto que se envía al modelo, conforme a lo desarrollado en la sección 2.9. El
procedimiento normaliza los términos de la pregunta (sin acentos, sin palabras vacías y
en singular) y arma un núcleo con dos tipos de tablas: las que la pregunta nombra, como
«pedidos» para `orders`, y las que tienen una columna distintiva mencionada en la
pregunta, es decir, un término que aparece en una o dos tablas del esquema, como
«transportista» en `shipments.carrier`. Los términos que están en tres o más tablas,
como «estado» o «fecha», no deciden nada por sí solos. Si el núcleo tiene varias tablas,
se agregan solo las que están en el camino más corto de claves foráneas entre ellas,
para que el modelo pueda unirlas. Si ninguna tabla coincide, el sistema envía el esquema
completo: se prefiere gastar más tokens que ocultarle al modelo una tabla que sí
necesita.

Durante la implementación apareció una condición que el diseño no había previsto. El
banco de pruebas tiene nomenclatura en inglés y las preguntas se formulan en español,
así que la comparación directa no encuentra nada: «cliente» no coincide con `customers`,
ni «pedido» con `orders`. Fue necesario incorporar un diccionario de sinónimos
español–inglés al proceso de comparación.

Lo que parecía una particularidad del entorno de prueba resultó ser representativo del
contexto del proyecto, donde es común que los esquemas estén en inglés (por venir de
sistemas comerciales o marcos de desarrollo) mientras los usuarios de negocio preguntan
en español. Esto vuelve la prueba más exigente y más realista.

La primera versión de la poda agregaba, alrededor de cada tabla con alguna coincidencia,
todas sus vecinas por clave foránea. En el banco de pruebas eso casi no podaba: `orders`
está conectada con casi todas las tablas, así que se enviaban en promedio 5.56 de las 8
tablas para preguntas que necesitan 1.76. Al revisar la causa apareció además un error:
«clientes» nunca coincidía con `customers`, porque la palabra se pasaba a singular
(«client») antes de buscar el sinónimo, y dos consultas perdían esa tabla. Solo
funcionaba porque se enviaba casi todo el esquema. Con el rediseño se envían en promedio
2.18 tablas, y ninguna de las 50 consultas de prueba pierde una tabla que necesita.

El efecto se midió con la función de conteo de tokens del modelo sobre las 50 consultas
en PostgreSQL, sin generar SQL. La parte del prompt que describe el esquema bajó en
promedio de unos 745 a unos 208 tokens, una reducción del 72 %, por encima de la meta
del 60 % de la sección 3.3.1.3. Sobre el prompt completo la reducción es del 43.4 % (de
1,238 a 701 tokens; 51.3 % en las consultas simples, 43.2 % en las intermedias y 35.8 %
en las complejas), porque cerca de 490 tokens son fijos: instrucciones, reglas y la
pregunta. El diccionario de sinónimos se ajustó con estas mismas preguntas; para medir
si la poda funciona con formulaciones distintas, se aplicó sin generar SQL a una versión
parafraseada de cada pregunta, y en 2 de las 50 dejó fuera una tabla necesaria. El
diccionario no se ajustó a esas paráfrasis, para no adaptar el sistema a las preguntas
con que se evalúa.

### 6.3.2 Integración con Vertex AI Gemini Pro

La generación se implementó como un servicio del backend que invoca el modelo mediante
`@google/genai`, el SDK oficial de Google para Node.js, configurado para operar sobre
Vertex AI. Este SDK reemplazó a la biblioteca que se usó al inicio,
`@google-cloud/vertexai`, que Google declaró obsoleta y con fecha de retiro anunciada;
la migración conservó la misma configuración de generación y se verificó con una llamada
real antes de continuar. Por defecto usa `gemini-2.5-pro` en la región `us-central1`;
ambos valores se cambian por configuración sin tocar el código.

El prompt tiene seis partes. La primera es el rol: generador experto de SQL que debe
traducir la solicitud a una única sentencia de solo lectura para el motor indicado. La
segunda son reglas estrictas: responder solo con la sentencia, sin explicaciones ni
formato markdown; producir un solo `SELECT` (o `WITH ... SELECT`), nunca sentencias de
modificación ni de definición; usar únicamente las tablas y columnas listadas; usar
exactamente los valores permitidos de las columnas que los tienen, y respetar una nota
de dialecto propia de cada motor: `LIMIT` frente a `TOP`, funciones de fecha,
concatenación y tipo de los booleanos. La tercera son reglas del dominio, la cuarta son
reglas de rendimiento, la quinta es el esquema podado y la sexta es la pregunta del
usuario.

En el esquema podado, cada tabla ocupa una línea con el tipo de dato, la nulidad, la
clave primaria y la referencia de las claves foráneas de cada columna. Se agregaron dos
marcas: los valores permitidos de las columnas categóricas, que el sistema lee de las
restricciones `CHECK` de cada motor, y una marca en las columnas que encabezan un
índice. Sin los valores permitidos, el modelo tenía que adivinar literales como los
estados de un envío, y un error en ese punto produce un resultado incorrecto atribuible
al sistema y no al modelo; si la lectura de esas restricciones falla, el esquema se
envía sin ellos. Las reglas del dominio expresan lo que el esquema no dice: los montos
de ventas, ingresos o gasto excluyen los pedidos cancelados, y los montos pagados se
calculan solo con pagos completados. Cubren el banco de pruebas; en una instalación real
serían configuración de cada organización.

Las reglas de rendimiento orientan al modelo hacia sentencias que sigan siendo
eficientes cuando la base tiene muchos datos, sin cambiar qué filas devuelve la
consulta: seleccionar solo las columnas necesarias; no aplicar funciones a las columnas
indexadas al filtrar o unir, de modo que para fechas se usen rangos en lugar de extraer
el año; usar `NOT EXISTS` en lugar de `NOT IN` con subconsulta; evitar subconsultas
correlacionadas en la lista de columnas; no usar `DISTINCT` para ocultar duplicados
producidos por una unión, y limitar filas solo cuando la pregunta pide una cantidad o un
máximo. Esta última regla aplica el principio de no recortar resultados de la sección
6.3.5. En conjunto, estas reglas corresponden al requerimiento RNF-13 de la sección 4.5.

La temperatura se fijó en cero, porque, como se vio en la sección 2.4, en una tarea
donde la corrección del SQL es crítica conviene la salida más determinística. Gemini 2.5
Pro razona internamente antes de responder, y ese razonamiento consume tokens que se
facturan como salida; por eso se separaron dos límites. El presupuesto de razonamiento
se fijó en 1,024 tokens, lo que acota el costo de cada llamada, y el tope de salida en
4,096 tokens, holgado para que siempre quede espacio para la sentencia. Si la respuesta
se corta al alcanzar ese tope, el servicio reporta un error explícito en lugar de
entregar una sentencia incompleta, que de otro modo se contaría como un error de
precisión del modelo cuando en realidad es un fallo de configuración.

Aun así, el modelo puede envolver la respuesta en bloques de código pese a la
instrucción, por lo que el servicio retira esas marcas antes de devolver la sentencia.
Si la respuesta llega vacía, se reporta un error en lugar de continuar. De cada
respuesta se conservan los tokens de entrada, salida y razonamiento que informa Vertex
AI, que alimentan el registro de uso y costos (sección 6.7.1).

El servicio solo genera, no autoriza. El endpoint `generateSQL` extrae el esquema, lo
poda, invoca al modelo y devuelve la sentencia junto con un resultado informativo de
validación, sin ejecutar nada. La autorización real ocurre en `executeQuery`, como se
describe en la sección 6.3.3.

La integración se verificó, después de la migración del SDK, con una llamada real que
formuló la pregunta “¿Cuántos pedidos se hicieron en 2025?” sobre el banco de pruebas en
PostgreSQL. Gemini devolvió una sentencia correcta que filtra por un rango de fechas,
como pide la regla de rendimiento; el Query Safety Engine la aprobó y su resultado
coincidió con el de la sentencia de referencia. La llamada usó 1,208 tokens de entrada,
39 de salida y 998 de razonamiento, tardó 14.5 segundos y tuvo un costo estimado de USD
0.01188, casi todo por el razonamiento y no por el tamaño del prompt. Esta prueba
confirma que el flujo funciona de extremo a extremo, pero no mide la precisión de la
generación; esa medición corresponde a la evaluación con el conjunto de 50 consultas.

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

#### 6.3.3.1 Hallazgo: evasión del validador en el dialecto Transact-SQL

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

#### 6.3.3.2 Segunda revisión: literales de texto y funciones con efectos

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

Se verificó la cadena completa de validación y ejecución con un conjunto de cincuenta
consultas del dominio del banco de pruebas, distribuidas en los tres niveles de
complejidad de la sección 3.3.1.2. Cada consulta se ejecutó en los cuatro motores, para
un total de doscientas ejecuciones, y en todos los casos la sentencia pasó por el Query
Safety Engine antes de llegar al motor.

Las sentencias de esta corrida son de referencia, escritas a mano y adaptadas al
dialecto de cada motor; no las generó el modelo. Esta prueba verifica, por tanto, la
capa de validación y ejecución y la abstracción de dialectos, no la precisión de la
conversión de lenguaje natural a SQL, que se evalúa por separado sobre este mismo
conjunto.

**Tabla 14.** Ejecución controlada del conjunto de prueba en los cuatro motores. Fuente: Elaboración propia.

| Nivel de complejidad | Consultas | Ejecuciones | Ejecuciones exitosas |
|---|---|---|---|
| Simple | 15 | 60 | 60 |
| Intermedio | 20 | 80 | 80 |
| Complejo | 15 | 60 | 60 |
| **Total** | **50** | **200** | **200** |

Las diferencias de dialecto que hubo que resolver se concentraron en dos construcciones.
Una es la limitación de filas, que es `LIMIT` en PostgreSQL, MySQL y MariaDB y `TOP` en
SQL Server. La otra son las funciones de fecha, cuya sintaxis difiere entre los cuatro
motores, sobre todo en diferencias entre fechas y extracción de año o mes.

Además del número de filas, se comparó el contenido completo de cada resultado entre
motores, fila por fila y valor por valor: las cincuenta consultas devuelven resultados
idénticos en los cuatro. Llegar a ese punto requirió dos revisiones del conjunto de
referencia, que se describen a continuación porque muestran con qué facilidad un
conjunto de prueba puede castigar al modelo por errores que no son suyos.

La primera revisión encontró que las sentencias de referencia no trataban de forma
uniforme los pedidos cancelados: algunas consultas de gasto o de ventas los incluían y
otras equivalentes los excluían, de modo que ninguna respuesta del modelo podía
coincidir con todas. Se fijó una sola regla, excluir los pedidos cancelados cuando la
pregunta involucra montos de ventas, ingresos o gasto; se corrigieron las cinco
referencias que no la seguían, y la misma regla se incorporó al prompt como regla del
dominio (sección 6.3.2).

La segunda revisión surgió al pasar de comparar el número de filas a comparar el
contenido: seis de las cincuenta referencias daban resultados distintos entre motores
aunque devolvieran la misma cantidad de filas. En cuatro, la consulta pedía los primeros
registros de un ordenamiento con empates y cada motor elegía registros empatados
distintos; se agregó un criterio de desempate determinista. En otra, PostgreSQL
calculaba diferencias de días con fracción y los demás motores en días calendario, y se
unificó el cálculo en días calendario. Además, una referencia limitaba a diez filas un
listado que la pregunta no pedía recortar, y se le quitó el límite.

La sexta diferencia reveló un defecto del propio sistema: los controladores de MySQL y
MariaDB, y el de PostgreSQL en las columnas de tipo fecha, interpretaban los valores en
la hora local del servidor y los desplazaban seis horas. Se corrigió para que las fechas
lleguen idénticas desde los cuatro motores. Tras estas correcciones se repitió la
verificación, ahora comparando contenido, y las doscientas ejecuciones de la tabla
anterior siguieron siendo exitosas.

### 6.3.5 Control de tiempo de ejecución e integridad de resultados

Las pruebas anteriores se hicieron sobre un banco pequeño. En una base con muchos datos
aparecen dos problemas que el Query Safety Engine no resuelve, porque decide qué se
puede ejecutar pero no cuánto puede costar: una consulta puede ocupar el motor
indefinidamente, y un resultado grande puede agotar la memoria del backend o del
navegador. Para eso se agregó una capa de ejecución con un principio: no recortar
resultados. Un resultado truncado sin aviso parece completo y no lo es, lo cual es peor
que un error. Por eso todos los límites de esta capa son de todo o nada: el usuario
recibe el resultado completo o un error claro.

*Tiempo máximo de ejecución.* Se fijó un tope de tiempo configurable que se aplica
dentro de cada motor y no solo en el backend, de modo que al vencer sea el propio motor
el que cancele la sentencia y libere sus recursos. Cada motor lo implementa distinto:
`statement_timeout` en PostgreSQL, `max_execution_time` en MySQL, `max_statement_time`
en MariaDB (que no tiene el anterior) y la señal de cancelación del controlador en SQL
Server. Al vencer, el sistema responde con un error de tiempo agotado (504).

*Lectura y entrega del resultado.* El resultado se lee fila por fila mediante cursores o
streaming en los cuatro controladores, sin cargarlo entero en memoria. La consulta se
ejecuta una sola vez y el resultado completo se guarda temporalmente como una copia
(snapshot), de la que se sirven las páginas de 1,000 filas y la descarga en CSV. Se
eligió la copia en lugar de volver a ejecutar la consulta en cada página porque, sin un
orden estable, dos ejecuciones pueden devolver las filas en distinto orden y la
paginación podría repetirlas o saltarlas. Así, lo que el usuario ve y lo que descarga
son los mismos datos. La copia tiene un tamaño máximo configurable (1 GB por defecto):
si se supera, se descarta completa y se responde con error (413). Además, vence a los 30
minutos y solo puede leerla el usuario que ejecutó la consulta.

*Descarga en CSV.* La descarga es una navegación del navegador, que no puede llevar el
token de Firebase en el encabezado. Por eso este endpoint no usa ese token, sino uno
aleatorio de un solo uso que vence a los dos minutos y que solo se entrega, desde un
endpoint autenticado, al dueño del resultado.

**Tabla 15.** Verificación del control de ejecución en los cuatro motores. Fuente: Elaboración propia.

| Prueba | Resultado |
|---|---|
| Consulta pesada con tope de 2 s | Los 4 motores cancelan en ~2 s y responden 504; en SQL Server se confirmó que la consulta no queda activa en el servidor |
| Lectura por streaming frente a lectura completa (50 consultas × 4 motores) | 200/200 resultados idénticos |
| 20,000 filas: 20 páginas unidas frente al resultado directo | Idénticos en los 4 motores; el CSV trae las 20,000 filas |
| Tope de 100 KB con 20,000 filas | 413 en los 4 motores, sin archivos residuales y con el backend en funcionamiento |
| Token de descarga reutilizado / resultado inexistente / sin token / sentencia DELETE | 404 / 404 / 401 / 403 |

Con 400,000 filas en PostgreSQL, la primera página pasó de 8.4 s a 1.5 s tras optimizar
el tamaño de los lotes y la escritura de la copia. Cualquier otra página se lee en unos
5 ms y el CSV completo se genera en alrededor de 1 s.

Estas pruebas encontraron también un error grave: cuando un resultado superaba el tamaño
máximo, el descarte de la copia dejaba escrituras pendientes que terminaban el proceso
del backend. Una sola consulta grande dejaba el servicio caído para todos los usuarios.
Se corrigió y se registra en la revisión de seguridad (sección 6.7.2).

Como limitación, el almacén de copias reside en el disco del proceso del backend. En un
despliegue con varias instancias de Cloud Functions tendría que trasladarse a
almacenamiento compartido, como Cloud Storage. Además, reiniciar el backend invalida los
resultados vigentes.

---

## 6.4 Frontend Next.js y autenticación de interfaz

El frontend se construyó con Next.js (App Router) y TypeScript, con Tailwind para los
estilos y el SDK de Firebase para la autenticación. Fuera de la sesión hay dos
pantallas, `/login` y `/signup`. Dentro, una barra lateral fija organiza el sistema por
módulo, de modo que cada función tiene su propia pantalla en lugar de concentrarse en
una sola: Consultar (`/`) e Historial (`/historial`) para todo usuario, y Conexiones,
Esquema y Uso y costos solo para el rol técnico (sección 6.5).

La interfaz se diseñó como una herramienta de trabajo: fondo blanco, neutros cálidos y
un único color de acento, naranja claro, reservado para la ubicación actual en la
navegación y la acción principal de cada pantalla. La tipografía es IBM Plex Sans, con
IBM Plex Mono para el SQL, los nombres de tablas y columnas y las cifras, que se alinean
en columnas. Las fuentes se sirven desde la propia aplicación, sin pedidos a servicios
externos.

Un proveedor de contexto escucha el estado de sesión de Firebase Authentication (correo
y contraseña) y lo expone a toda la aplicación, junto con el rol del usuario, que se lee
del token de identidad. Si no hay sesión, la pantalla principal
redirige a `/login`. Cada llamada al backend obtiene el token de identidad vigente del
usuario y lo envía en el encabezado `Authorization`, de modo que el backend lo verifique
en cada solicitud, como se describió en la sección 2.7. Las credenciales de las bases de
datos nunca pasan por el cliente (RNF-07).

El usuario elige el motor, escribe su pregunta y pulsa «Generar SQL». La interfaz
muestra la sentencia producida y el resultado del Query Safety Engine, y el botón
«Ejecutar» solo se habilita si la sentencia fue aprobada. La ejecución reutiliza el
motor con el que se generó la sentencia, de modo que el SQL siempre se ejecuta en el
dialecto para el que fue producido. Al ejecutarla se muestra la primera página del
resultado con el rango y el total de filas (por ejemplo, «Filas 1–1,000 de 20,000»),
botones para avanzar y retroceder entre páginas y la opción «Descargar CSV completo»; si
la consulta no devolvió filas, se muestra un aviso.

La sentencia se muestra según el rol. Al usuario no técnico se le presenta plegada y
solo para lectura, porque lo que necesita es el resultado; el usuario técnico la ve
abierta y puede editarla antes de ejecutarla, junto con el consumo de la generación
(sección 6.5), lo que cubre el requerimiento RF-09. El bloqueo del botón es solo una
ayuda de interfaz: la autorización real la aplica el backend en `executeQuery`, que
vuelve a validar la sentencia. La consulta en curso se conserva al cambiar de pantalla,
de modo que consultar el esquema o el historial no borra la pregunta, el SQL ni el
resultado.

Se manejan estados de carga de sesión, generación y ejecución. Los errores del backend
se muestran al usuario tal como los devuelve la API; en esta versión ese mensaje puede
incluir texto del controlador de base de datos (hallazgo 5, sección 6.7.2), por lo que
RNF-04 se cumple solo de forma parcial.

Con un navegador automatizado se comprobó que sin sesión se redirige a `/login`, que el
inicio de sesión funciona contra Firebase Authentication real y que la pantalla
principal carga sin errores de consola. También se verificó contra el backend real la
ejecución, la paginación y la descarga del CSV completo, sustituyendo la respuesta de
generación por una sentencia fija para no generar llamadas a Vertex AI. La generación
con el modelo desde la interfaz queda pendiente de verificar; el endpoint
correspondiente ya se probó por separado.

El historial y las consultas guardadas se describen en la sección 6.6. La selección de
motor corresponde a los cuatro motores del banco de pruebas preconfigurados en el
backend; esta versión no incluye la administración de conexiones desde la interfaz:
la pantalla de Conexiones muestra su estado, pero no permite agregarlas ni editarlas.

*[Figura 9. Pantalla Consultar de NLQP. Fuente: Elaboración propia. — reemplazar la captura del Word por la de la interfaz nueva.]*

---

## 6.5 Módulo 4 — Herramientas de apoyo para usuarios técnicos

El sistema distingue los dos actores de la sección 4.2. El usuario no técnico pregunta,
obtiene resultados y gestiona su historial; el usuario técnico tiene, además,
herramientas para revisar lo que hace el sistema por dentro. El Módulo 4 reúne esas
herramientas.

El rol se guarda como un atributo del usuario en Firebase Authentication (custom claim)
que solo el backend puede escribir, mediante una herramienta de administración; el
usuario no puede asignárselo. Las cuentas creadas desde el registro empiezan como no
técnicas, el permiso menor. El control se aplica en el backend: un middleware verifica
el rol en cada solicitud a una función técnica y responde 403 si no corresponde. El
frontend solo oculta esas pantallas; ocultarlas no bastaría, porque las funciones
seguirían disponibles para quien llame a la API directamente.

**Tabla 16.** Herramientas del rol técnico. Fuente: Elaboración propia.

| Herramienta | Qué muestra | Para qué sirve |
|---|---|---|
| Edición del SQL | La sentencia generada, editable antes de ejecutarla, con tokens, costo, tiempo y tablas enviadas al modelo | Corregir o ajustar una sentencia y ver cuánto costó generarla |
| Conexiones | Estado de cada motor con su latencia y la ocupación del pool de conexiones (en uso, libres, en espera, máximo) | Diagnosticar fallas de conexión y saturación del pool |
| Esquema | Tablas, columnas, tipos, nulos, claves primarias y foráneas, valores permitidos e índices de cada motor | Ver el esquema tal como lo recibe el modelo y entender sus respuestas |
| Uso y costos | Llamadas, costo total y por generación, errores y llamadas por motor, por período y origen | Seguir el consumo de Vertex AI (sección 6.7.1) |

Una sentencia editada no se considera aprobada por haber sido generada antes: la
interfaz la marca como editada y el backend la valida con el Query Safety Engine al
ejecutarla, como a cualquier otra. Si la rechaza, la sentencia queda marcada como
bloqueada con el motivo y no se puede ejecutar hasta que se corrija.

El estado del pool se obtiene de un endpoint nuevo de solo lectura, que informa las
conexiones abiertas, libres, en uso y en espera de cada motor sin abrir conexiones
nuevas; un motor que todavía no se usó aparece como no iniciado.

*[Figura 10. Pantalla de Conexiones del rol técnico. Fuente: Elaboración propia. — captura pendiente.]*

### Verificación

Con un usuario de cada rol, contra el backend, 23 de 23 comprobaciones fueron
correctas: las cuatro funciones técnicas responden 403 al usuario no técnico, 200 al
técnico y 401 sin sesión; el historial, las consultas guardadas y la ejecución
funcionan con ambos roles, y el historial de uno no es visible para el otro. En la
interfaz, con un navegador automatizado, 12 de 12: el usuario no técnico no ve el menú
técnico y no accede a esas pantallas escribiendo la dirección; el técnico edita y
ejecuta una sentencia, y una sentencia editada con `DELETE` es rechazada por el
backend. La regresión de seguridad siguió en 57 de 57 casos y 200 de 200 ejecuciones.

Queda una limitación: la interfaz no permite editar el SQL al usuario no técnico, pero
con su token podría enviar una sentencia propia directamente a `executeQuery`. El Query
Safety Engine la sigue validando, así que no puede modificar datos, pero sí consultar
tablas por su cuenta. Cerrarlo requiere que el backend firme el SQL que genera y acepte
de un usuario no técnico solo sentencias firmadas; queda como trabajo futuro (sección
6.7.2).

---

## 6.6 Módulo 5 — Historial y gestión de consultas guardadas

El módulo distingue dos registros con propósitos distintos. El **historial** es
automático: cada consulta que el usuario ejecuta queda registrada sin que tenga que hacer
nada. Las **consultas guardadas** son una decisión del usuario: solo se guarda lo que él
elige, con un nombre que le permita reconocerlo después. Por eso se almacenan por
separado, y borrar una consulta guardada no altera el historial.

Ambos registros se guardan en Cloud Firestore, aislados por usuario: el historial en
`users/{uid}/history` y las consultas guardadas en `users/{uid}/saved`. El identificador
del usuario lo obtiene el backend del token de Firebase Authentication verificado, nunca
de un dato enviado por el cliente, de modo que un usuario no puede leer ni modificar el
historial de otro.

**Tabla 17.** Datos del historial y de las consultas guardadas. Fuente: Elaboración propia.

| Registro | Cuándo se crea | Qué guarda |
|---|---|---|
| Historial | Al ejecutar una consulta (`executeQuery`), con éxito o con error | Pregunta en lenguaje natural, motor, sentencia SQL, si se ejecutó con éxito, total de filas o motivo del error, y fecha |
| Consulta guardada | Cuando el usuario pulsa «Guardar» y le asigna un nombre (hasta 100 caracteres) | Nombre, pregunta, motor, sentencia SQL y fecha |

No entran al historial las sentencias que el Query Safety Engine bloquea, porque nunca
llegan a ejecutarse, ni las ejecuciones de la evaluación con Gemini, que se identifican
por separado igual que en el registro de uso y costos (sección 6.7.1). El historial
muestra las 50 ejecuciones más recientes.

Desde el historial o desde las consultas guardadas, el usuario puede **reusar** una
consulta: la sentencia vuelve al formulario con su motor y su pregunta, y se ejecuta con
el mismo botón «Ejecutar». Reusar no vuelve a llamar al modelo, por lo que no tiene costo
en Vertex AI. Una sentencia guardada no se considera confiable por haber sido guardada:
el Query Safety Engine la valida al guardarla y de nuevo cada vez que se ejecuta, porque
`executeQuery` sigue siendo el único punto de ejecución contra las bases de datos.

*[Figura 11. Pantalla de Historial. Fuente: Elaboración propia. — captura pendiente.]*

### Verificación

Contra el backend y los cuatro motores del banco de pruebas, 32 de 32 comprobaciones
fueron correctas: el registro de la ejecución en el historial en PostgreSQL, MySQL,
MariaDB y SQL Server; el registro de una ejecución fallida con su motivo; que una
sentencia bloqueada y una ejecución de evaluación no entren al historial; el orden y el
límite del historial; guardar, listar y borrar consultas guardadas; el rechazo de datos
inválidos y de SQL inseguro al guardar, y el rechazo de solicitudes sin token. Con un
navegador automatizado, sobre la interfaz real, 10 de 10 comprobaciones fueron correctas:
reusar desde el historial y desde las guardadas, ejecutar, guardar con nombre y borrar.
Ninguna prueba usó el modelo. Después del cambio en `executeQuery`, la regresión de
seguridad siguió en 57 de 57 casos del validador y 200 de 200 ejecuciones.

Quedan fuera de esta versión la búsqueda y el filtrado dentro del historial, la
organización de consultas guardadas en carpetas, compartir consultas entre usuarios y
borrar entradas del historial.

---

## 6.7 Integración de módulos y pruebas del sistema

Esta sección documenta la verificación del sistema como conjunto, una vez integrados los
módulos construidos.

### 6.7.1 Registro de uso y costos

Este componente no forma parte de los cinco módulos del alcance. Se agregó como
instrumento de medición porque sin él no hay forma de responder con datos cuánto consume
cada consulta en Vertex AI ni cómo se usa el sistema, información que necesitan las
métricas de eficiencia de la sección 3.3.1.3 y la validación de costos de la sección
1.6.3.

Por cada llamada a `generateSQL` y `executeQuery`, el backend guarda un documento en la
colección `usageEvents` de Cloud Firestore. `testConnection` y `getSchema` no generan
eventos, porque son llamadas de diagnóstico y no uso del sistema.

**Tabla 18.** Campos del evento de uso. Fuente: Elaboración propia.

| Campo | Cuándo se registra |
|---|---|
| Tipo de llamada, motor, usuario, éxito, latencia y fecha | Siempre |
| Motivo del error | Solo si la llamada falló |
| Tokens de entrada, salida, razonamiento y total; costo estimado; resultado del Query Safety Engine | Solo en `generateSQL` exitoso |

Gemini 2.5 Pro razona internamente antes de responder. Ese razonamiento no se ve en la
respuesta, pero se factura como salida, así que se limitó a 1,024 tokens por llamada y
se registra aparte. El costo se estima multiplicando los tokens reales que informa
Vertex AI por el precio de lista de Gemini 2.5 Pro para contextos de hasta 200,000
tokens: USD 1.25 por millón de tokens de entrada, y USD 10 por millón de salida y
razonamiento (verificados el 21-sep-2026). Con este límite, cada llamada cuesta
alrededor de USD 0.012, casi todo por el razonamiento. Es una estimación y no sustituye
la factura de Google Cloud; los precios se pueden ajustar por configuración. Además de
guardarse en Firestore, estos datos se devuelven en cada respuesta de `generateSQL`,
junto con el número de tablas enviadas al modelo frente al total del esquema, para medir
el efecto de la poda en la evaluación.

Un fallo al registrar un evento nunca interrumpe la respuesta al usuario. Se espera la
escritura antes de responder, porque en Cloud Functions una operación pendiente puede
perderse si la instancia se recicla.

El endpoint `getUsageStats` devuelve, para los últimos N días, el total de llamadas, el
costo acumulado, el desglose por tipo y motor y el número de errores. Se verificó en
vivo, incluida una llamada real a Vertex AI.

Las estadísticas se consultan en la pantalla Uso y costos, reservada al rol técnico
(sección 6.5). Este registro es telemetría de operación y
es independiente del historial de consultas guardadas (RF-11 a RF-13), aunque ambos usan
Firestore en colecciones separadas.

### 6.7.2 Revisión de seguridad del backend

Se hizo una revisión manual de los módulos implementados, buscando desviaciones de la
restricción de solo lectura y de las prácticas de manejo de credenciales y autenticación
de la sección 2.8. Cada hallazgo se comprobó contra el entorno real antes de reportarlo,
en lugar de deducirlo solo de leer el código.

**Tabla 19.** Hallazgos de la revisión de seguridad del backend. Fuente: Elaboración propia.

| Hallazgo | Severidad | Estado |
|---|---|---|
| Evasión del Query Safety Engine en SQL Server con sentencias encadenadas sin separador | Crítica | Corregido |
| Omisión de la verificación de identidad ante ausencia de configuración | Alta | Corregido |
| Validación del certificado del servidor de SQL Server deshabilitada de forma fija | Media | Corregido |
| Sin restricción de origen en el servidor de desarrollo | Baja | Documentado |
| Mensajes de error del controlador expuestos al cliente | Baja | Documentado |
| Vulnerabilidades moderadas en dependencias transitivas | Baja | Documentado |
| Caída del backend completo ante un resultado demasiado grande | Alta | Corregido |
| Endpoint de descarga de CSV sin autenticación de Firebase | Baja | Mitigado por diseño |
| Falsos positivos por palabras reservadas dentro de textos | Baja | Corregido |
| Funciones de lectura de archivos del servidor no bloqueadas por el validador | Baja | Corregido |
| Batería de pruebas de seguridad no versionada | Baja | Corregido |
| Funciones técnicas accesibles a cualquier usuario autenticado | Media | Corregido |

El primer hallazgo se describe en la sección 6.3.3, el tercero en la sección 6.1 y el de
la caída del backend en la sección 6.3.5. El segundo merece mención. La verificación del token se
omitía cuando faltaba una variable de configuración, algo previsto para desarrollar en
local antes de tener el proyecto de identidades. El problema es que esa variable puede
faltar por error en un despliegue, y bastaba eso para desactivar la autenticación de
toda la API. Ahora el bypass exige activar explícitamente una segunda variable, de modo
que una configuración incompleta rechace las solicitudes en lugar de aceptarlas.

De los hallazgos de severidad baja, tres se dejaron documentados con justificación: los
dos primeros afectan solo al servidor de desarrollo, y el de dependencias corresponde a
bibliotecas oficiales del proveedor, cuya actualización forzada implicaría más riesgo
del que mitiga; quedan como trabajo previo a un despliegue en producción. El endpoint de
descarga no usa el token de Firebase porque una descarga del navegador no puede
enviarlo; se mitigó con un token de un solo uso que vence a los dos minutos (sección
6.3.5), y el riesgo que queda es que, si el enlace se filtra antes de usarse, alguien
podría descargar ese resultado una vez. Los tres últimos se corrigieron: los dos
primeros se describen en la segunda revisión del Query Safety Engine (sección 6.3.3), y
la batería de pruebas de seguridad, que antes no estaba guardada junto al código, quedó
versionada y se ejecuta con un solo comando.

### 6.7.3 Tiempos de ejecución sobre el motor

Durante la verificación se midió el tiempo de ejecución de cada consulta en cada motor.
Corresponden solo a la ejecución, no al tiempo total de respuesta de la sección 3.3.1.3,
que incluye además el esquema, la poda y la generación con el modelo.

**Tabla 20.** Latencia de ejecución por motor, en milisegundos. Fuente: Elaboración propia.

| Motor | Ejecuciones | Mínimo | Mediana | Media | Percentil 95 | Máximo |
|---|---|---|---|---|---|---|
| PostgreSQL | 50 | 2 | 13.0 | 13.0 | 18 | 50 |
| MySQL | 50 | 2 | 16.0 | 14.8 | 22 | 26 |
| MariaDB | 50 | 2 | 15.0 | 14.6 | 20 | 22 |
| SQL Server | 50 | 5 | 19.0 | 18.7 | 23 | 65 |
| **Global** | **200** | **2** | **16.0** | **15.3** | **21** | **65** |

Lo relevante es la proporción respecto del presupuesto. El percentil 95 es de 21 ms, el
0.14 % del umbral de 15 segundos para consultas simples, así que la ejecución es
despreciable frente a la latencia del modelo. La latencia casi no cambia con la
complejidad: la mediana va de 16.0 a 16.5 ms en los tres niveles, porque el volumen del
banco permite resolver los planes en memoria. Los umbrales diferenciados de la sección
3.3.1.3 responden, por tanto, al costo de la generación y no al de la ejecución.
