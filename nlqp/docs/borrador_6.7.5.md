### 6.7.5 Verificación de los requerimientos y de las métricas de confiabilidad

Esta sección reúne la verificación de las métricas de desarrollo (sección 3.3.1.1) y de
confiabilidad (sección 3.3.1.4) que no corresponden a la generación con el modelo.

**Completitud de los requerimientos funcionales.** La sección 3.3.1.1 fija como meta el
100 % de los requerimientos funcionales críticos implementados y verificados. La Tabla
23 coteja cada requerimiento de la sección 4.4 con la prueba que lo verifica. Los
dieciséis están implementados y verificados, incluidos los siete críticos, sin los
cuales el flujo principal de consulta no puede ejecutarse.

**Tabla 23.** Verificación de los requerimientos funcionales. Fuente: Elaboración propia.

| Requerimiento | Crítico | Verificación |
|---|---|---|
| RF-01 Registro de conexiones | Sí | Alta con la contraseña en Secret Manager en los cuatro motores; pruebas de conexiones, 64/64 (sección 6.1) |
| RF-02 Administración de conexiones | No | Edición, prueba y baja sin exponer la contraseña; mismas pruebas (sección 6.1) |
| RF-03 Extracción de esquema | Sí | Inspección de las tablas de sistema en los cuatro motores (sección 6.2.3) |
| RF-04 Formulación en lenguaje natural | Sí | Pantalla Consultar para todo usuario autenticado; pruebas de interfaz (sección 6.4) |
| RF-05 Poda de esquema | No | Reducción del 72 % de los tokens del esquema (sección 6.3.1) |
| RF-06 Generación de SQL | Sí | 400 casos en los cuatro motores, 94.8 % de precisión (sección 6.3.6) |
| RF-07 Validación de solo lectura | Sí | 57/57 casos de la batería de seguridad (sección 6.3.3) |
| RF-08 Ejecución controlada | Sí | 200/200 ejecuciones; integridad de valores 30/30 y exportación 68/68 (secciones 6.3.4 y 6.3.5) |
| RF-09 Visualización del SQL | No | SQL visible y editable para el rol técnico; pruebas de roles, 23/23 (sección 6.5) |
| RF-10 Exploración del esquema | No | Pantalla Esquema (sección 6.5) |
| RF-11 Guardado de consultas | No | Pruebas del Módulo 5, 33/33 (sección 6.6) |
| RF-12 Consulta del historial | No | Pruebas del Módulo 5 (sección 6.6) |
| RF-13 Edición y reutilización | No | Reutilización sin el modelo y edición con auditoría, 25/25 (secciones 6.5 y 6.6) |
| RF-14 Autenticación | Sí | Rechazo sin token, de cuentas sin rol o desactivadas; pruebas de usuarios, 50/50 |
| RF-15 Tiempo máximo por conexión | No | Cancelación por el propio motor en los cuatro (sección 6.3.5) |
| RF-16 Gestión de usuarios | No | Alta con rol, cambio de rol y desactivación; pruebas de usuarios, 50/50 |

**Manejo de errores.** El segundo indicador de la sección 3.3.1.4, y el requerimiento
RNF-04, piden mensajes de error informativos y seguros ante entradas inválidas,
esquemas vacíos, credenciales incorrectas o interrupciones de Vertex AI. Se construyó
una batería de 31 casos, versionada junto al código, que cubre esas cuatro situaciones.
Un caso cuenta como manejado correctamente solo si se cumplen tres condiciones: el
código de respuesta es el esperado, el mensaje explica qué ocurrió y la respuesta no
expone rastros de ejecución, rutas del servidor ni contraseñas. Para la interrupción de
Vertex AI se levantó una segunda instancia del backend configurada con un modelo
inexistente; ante esa falla, el usuario no técnico recibe un mensaje genérico, y el
técnico, el detalle del servicio.

**Tabla 24.** Manejo de errores por situación. Fuente: Elaboración propia.

| Situación | Casos | Manejados correctamente |
|---|---|---|
| Entradas inválidas | 16 | 16 |
| Credenciales incorrectas | 9 | 9 |
| Esquema vacío | 3 | 3 |
| Interrupción de Vertex AI | 3 | 3 |
| **Total** | **31** | **31** |

La primera ejecución de la batería resolvió correctamente 28 de los 31 casos y encontró
dos defectos, que se corrigieron antes de repetirla. El primero: ante una base de datos
sin tablas, el sistema enviaba al modelo un esquema vacío y este inventaba tablas
inexistentes. Ahora la generación se rechaza antes de invocar al modelo, con un mensaje
que indica revisar la base o los permisos del usuario de la conexión. El segundo: cuando
el servidor de PostgreSQL rechazaba la conexión, el controlador devolvía un error sin
texto y el usuario veía un aviso vacío. Ahora el mensaje describe la causa a partir del
código de red. Tras las correcciones, la batería resolvió los 31 casos, y las pruebas de
seguridad (57/57 y 200/200) y de la API siguieron en verde.
