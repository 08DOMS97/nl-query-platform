# Revisión de seguridad — backend NLQP (2026-09-17, actualizada 2026-10-08)

Revisión manual del backend construido hasta el momento (módulos 1, 2, 3, 5 y 6:
ConnectionManager, SchemaExtractor, SchemaPruning, Query Safety Engine,
executeQuery). No cubre `vertexAI.service.ts`/`generateSQL` en ejecución real (sin
probar, pendiente del proyecto GCP) ni el frontend (no existe todavía).

## Metodología

El skill automático `/security-review` del entorno hace `git diff origin/HEAD...` y
falló porque el repositorio no tiene commits ni remoto todavía. Se hizo revisión
manual en su lugar: lectura de cada archivo del backend buscando desviaciones de la
garantía central del sistema (RF-07 — "nunca ejecutar SQL generado por el modelo sin
pasar primero por la validación sintáctica") y de las prácticas estándar de manejo de
credenciales/autenticación, **y se confirmó cada hallazgo explotándolo en vivo contra
el banco de pruebas real** (no solo lectura de código) antes de reportarlo.

## Resumen

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Bypass del Query Safety Engine en SQL Server (sentencias apiladas sin `;`) | **Crítica** | Corregido |
| 2 | Bypass de autenticación con diseño "fail-open" | **Alta** | Corregido |
| 3 | `trustServerCertificate` fijo en `true` para SQL Server | Media | Corregido |
| 4 | CORS sin restricción de origen en el servidor de desarrollo | Baja | Documentado, no corregido |
| 5 | Mensajes de error del driver expuestos tal cual al cliente | Baja | Documentado, no corregido |
| 6 | 14 vulnerabilidades moderadas transitivas (`npm audit`) | Baja | Documentado, no corregido (actualizado 02/10: 16, ver §6) |
| 7 | Caída del backend completo ante un resultado demasiado grande (02/10) | **Alta** | Corregido |
| 8 | Endpoint de descarga de CSV sin autenticación de Firebase (02/10) | Baja | Mitigado por diseño |
| 9 | Palabras reservadas y `;` dentro de literales se bloqueaban; el texto de 6.3.3 decía lo contrario (08/10) | Baja | Corregido (08/10) |
| 10 | Funciones de lectura de archivos (`pg_read_file`, `LOAD_FILE`) pasaban el validador; las frenaban los permisos del motor (08/10) | Baja | Corregido (08/10) |
| 11 | La batería de 17 casos no estaba versionada en el repo (08/10) | Baja | Corregido (08/10): `npm run test:seguridad` |

Después de aplicar las 3 correcciones: batería de seguridad 17/17, y las 50
consultas de prueba siguen en 200/200 ejecuciones y 50/50 consistentes entre los 4
motores (sin falsos positivos introducidos por los fixes).

---

## 1. Bypass del Query Safety Engine en SQL Server — CRÍTICA

**Archivo:** `nlqp/backend/src/services/querySafety.service.ts`

### El problema

El validador original rechazaba una consulta si contenía un `;` en medio del texto
(sentencias apiladas clásicas: `SELECT ...; DROP TABLE ...`). Esa regla asume que
**todo motor exige `;` para separar sentencias**. Es cierto en PostgreSQL, MySQL y
MariaDB — pero **no en SQL Server**: T-SQL permite un "batch" de varias sentencias
separadas solo por espacio en blanco o salto de línea, sin `;`.

Como el driver `mssql` que usa `connectionManager.service.ts` solo expone
`result.recordset` (el **primer** conjunto de resultados del batch), bastaba con
poner la consulta sensible **primero** y una decoy después para que el sistema la
devolviera igual, sin que ningún chequeo existente lo detectara:

- Empieza con `SELECT` → pasa el chequeo de whitelist.
- No tiene `;` → pasa el chequeo de sentencias apiladas.
- No contiene ninguna palabra de la blacklist (`DROP`, `DELETE`, etc.) → pasa el
  chequeo de blacklist.

### Prueba de concepto (ejecutada en vivo)

```http
POST /executeQuery
{
  "engine": "mssql",
  "sql": "SELECT email, phone FROM customers\nSELECT 1 AS decoy"
}
```

Respuesta real obtenida: **200 OK** con las 200 filas de `email`/`phone` de toda la
tabla `customers` — la validación no detectó nada anómalo.

Como control, la misma cadena contra los otros 3 motores fue rechazada por el propio
motor con error de sintaxis (confirmando que el hueco era específico de T-SQL, no del
Query Safety Engine en general):

```
PostgreSQL: "syntax error at or near \"SELECT\""
MySQL:      "You have an error in your SQL syntax ... near 'SELECT 2 AS b' at line 2"
MariaDB:    "You have an error in your SQL syntax ... near 'SELECT 2 AS b' at line 2"
```

### La corrección

Se agregó `hasUnauthorizedStackedStatement()` en `querySafety.service.ts` (líneas
60-124): un recorrido carácter por carácter del SQL (no un parser completo, solo lo
necesario) que:

1. Lleva la profundidad de paréntesis (`depth`) para ignorar cualquier `SELECT`
   dentro de una subconsulta o CTE.
2. Lleva el estado de "dentro de una cadena de texto" (`'...'` con `''` escapado),
   `"..."`, `` `...` `` (MySQL/MariaDB) y `[...]` (SQL Server), para no confundir la
   palabra `SELECT` dentro de un literal con una palabra clave real.
3. Registra la primera ocurrencia de `SELECT` a profundidad 0 como la sentencia
   principal (siempre permitida).
4. Cualquier ocurrencia **adicional** de `SELECT` a profundidad 0 debe venir
   precedida por un operador de conjunto (`UNION`, `UNION ALL`, `INTERSECT`,
   `EXCEPT`) — la única forma legítima de tener más de un `SELECT` de nivel superior
   en una sola sentencia SQL. Si no lo está, se rechaza.

```ts
if (depth === 0 && /^SELECT\b/i.test(body.slice(i))) {
  if (!seenTopLevelSelect) {
    seenTopLevelSelect = true;
  } else if (!SET_COMBINATOR_BEFORE.test(body.slice(0, i))) {
    return true; // sentencia apilada sin ";" detectada
  }
}
```

Se conecta a `validateQuerySafety()` como un chequeo más, antes de la blacklist de
palabras clave.

### Verificación tras el fix

```
PoC de exfiltración (SELECT email,phone \n SELECT decoy)  → 403 BLOQUEADO
SELECT 1 \n SELECT 2 (caso simple)                          → 403 BLOQUEADO
SELECT 'a' UNION SELECT 'b'                                  → 200 OK (sigue funcionando)
SELECT 1 UNION ALL SELECT 2                                  → 200 OK (sigue funcionando)
SELECT 'please SELECT this string' AS texto                  → 200 OK (sin falso positivo)
```

Regresión completa: batería de 17 casos de seguridad (17/17) y las 50 consultas de
prueba en los 4 motores (200/200 ejecuciones, 50/50 consistentes) — incluida `C11`,
que tiene un CTE con un `LIMIT`/`TOP` interno (el caso con más riesgo de falso
positivo para un chequeo basado en profundidad de paréntesis).

---

## 2. Bypass de autenticación con diseño "fail-open" — ALTA

**Archivo:** `nlqp/backend/src/middleware/auth.middleware.ts`

### El problema

El middleware original omitía la verificación del JWT de Firebase con una sola
condición: `if (!process.env.FIREBASE_PROJECT_ID)`. La intención era permitir probar
el backend en local mientras no existiera el proyecto Firebase (pendiente de David).
El problema es el patrón "fail-open": **la ausencia de una variable de entorno —
algo que puede pasar por error (typo, secreto no montado en el despliegue,
`firebase.json` mal configurado)** — bastaba para desactivar la autenticación de
**toda la API**, incluido `/executeQuery`, sin ningún aviso salvo un `console.warn`
fácil de perder en los logs.

### La corrección

Ahora se exigen **dos condiciones a la vez**:

```ts
const devBypassEnabled = process.env.NLQP_ALLOW_DEV_AUTH_BYPASS === 'true';

if (!process.env.FIREBASE_PROJECT_ID && devBypassEnabled) {
  console.warn('[auth.middleware] ... verificación de JWT omitida ...');
  next();
  return;
}
```

`NLQP_ALLOW_DEV_AUTH_BYPASS` es una variable **nueva**, separada de
`FIREBASE_PROJECT_ID`, que hay que poner en `true` a propósito en el `.env` local.
Si falta `FIREBASE_PROJECT_ID` mancomunado con que `NLQP_ALLOW_DEV_AUTH_BYPASS` no
esté en `true` (el escenario de "se me olvidó configurar algo en producción"), el
middleware ya no hace bypass: exige el header `Authorization: Bearer <token>`, y como
tampoco hay `FIREBASE_PROJECT_ID` para inicializar `firebase-admin` correctamente,
cualquier intento de verificar un token también falla — el sistema **falla cerrado**
en vez de abierto.

Se agregó la variable a `nlqp/backend/.env` (`=true`, con comentario de advertencia)
y a `.env.example` (`=false` por defecto, para que copiarlo y no leer el comentario
no abra el sistema sin querer).

### Verificación tras el fix

Simulación de "despliegue mal configurado" (mismo `.env`, pero sin
`NLQP_ALLOW_DEV_AUTH_BYPASS`):

```
GET /testConnection  (sin Authorization, sin NLQP_ALLOW_DEV_AUTH_BYPASS)
→ 401 {"error":"Falta el encabezado Authorization: Bearer <idToken>."}
```

Con el flag puesto en `.env` (desarrollo normal), el bypass sigue funcionando igual
que antes para no interrumpir el flujo de trabajo local.

---

## 3. `trustServerCertificate` fijo en `true` — MEDIA

**Archivo:** `nlqp/backend/src/services/connectionManager.service.ts` (línea ~112)

### El problema

La conexión a SQL Server tenía `options: { encrypt: true, trustServerCertificate:
true }` escrito directamente en el código, sin pasar por configuración.
`trustServerCertificate: true` desactiva la validación del certificado TLS del
servidor — necesario en local porque el contenedor de pruebas usa un certificado
autofirmado (documentado en el README de "Bases de datos"), pero si este mismo
archivo se reutiliza sin cambios contra un SQL Server real en producción, la
conexión aceptaría **cualquier** certificado, incluido uno falsificado por un
atacante en la red — habilitando un ataque man-in-the-middle sobre las credenciales
y los datos en tránsito.

### La corrección

```ts
options: {
  encrypt: true,
  trustServerCertificate: process.env.DB_MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
},
```

Nueva variable `DB_MSSQL_TRUST_SERVER_CERTIFICATE`, con `true` en `nlqp/backend/.env`
(entorno local, certificado autofirmado conocido) y `false` por defecto en
`.env.example` (el valor seguro, para que un despliegue que copie el ejemplo sin
editar quede protegido por defecto en vez de vulnerable por defecto).

### Verificación tras el fix

`GET /testConnection?engine=mssql` sigue devolviendo `{"ok": true}` con el flag en
`true` en el `.env` local — no se rompió la conectividad de desarrollo.

---

## 4. CORS sin restricción de origen — BAJA (documentado, no corregido)

**Archivo:** `nlqp/backend/src/index.ts` (línea 21): `app.use(cors());`

El servidor Express local no restringe qué orígenes pueden llamarlo. Combinado con
el bypass de autenticación en desarrollo, cualquier pestaña abierta en el navegador
del desarrollador (un script de un anuncio, de una extensión, etc.) podría hacer
`fetch()` a `http://localhost:8080` y consultar la base de datos vía
`/executeQuery` mientras el backend esté corriendo.

**Por qué no se corrigió todavía:** el propio archivo está documentado como "no se
usa en producción" — es solo para desarrollo local con `npm run dev`, y no existe
todavía un frontend cuyo origen real haya que permitir. Queda como pendiente para
cuando se construya el frontend: restringir `cors()` al origen de Firebase Hosting.

---

## 5. Mensajes de error del driver expuestos al cliente — BAJA (documentado, no corregido)

**Archivos:** `executeQuery.ts`, `getSchema.ts`, `generateSQL.ts`

Los tres endpoints devuelven `err.message` tal cual en la respuesta JSON cuando algo
falla. Un mensaje de error de PostgreSQL/MySQL/SQL Server puede incluir detalles
internos del driver o del motor.

**Por qué no se corrigió todavía:** severidad baja porque el esquema de la base de
datos ya es público a propósito vía `/getSchema` (es el diseño del sistema, no una
fuga), y durante esta fase de desarrollo los mensajes detallados son útiles para
depurar contra Postman. Vale la pena genericar antes de exponer el backend fuera de
la red local (reemplazar por un mensaje genérico al cliente + log detallado solo en
servidor).

---

## 6. Vulnerabilidades transitivas de dependencias — BAJA (documentado, no corregido)

`npm audit` reporta 14 vulnerabilidades moderadas, todas transitivas a través de las
librerías de Google Cloud/Firebase (`@google-cloud/firestore`, `firebase-admin`,
`google-gax`, `gaxios`, `mssql`→`tedious`→`@azure/identity`, etc.), con una raíz
común: un bug de límites de buffer en `uuid` v3/v5/v6 cuando se le pasa un `buf`
explícito.

**Por qué no se corrigió todavía:** `npm audit fix` no ofrece una corrección sin
`--force` (que fuerza versiones mayores de las SDKs de GCP ya validadas contra los 4
motores, con riesgo real de romper algo). El código de NLQP nunca pasa un `buf`
controlado por el usuario a `uuid` — ese parámetro solo lo usan internamente las
SDKs para generar IDs de request, fuera de cualquier ruta con entrada del usuario.
Revisar cuando esas SDKs publiquen versiones mayores que ya traigan `uuid`
actualizado.

**Actualización 02/10/2026:** `npm audit` reporta ahora 16 (13 moderadas, 3
altas). Ninguna proviene de `pg-cursor`, la única dependencia agregada ese día:
siguen siendo transitivas de las SDKs de Google/Firebase y de `mssql`. Las 3 altas
son avisos publicados después de esta revisión: `@grpc/grpc-js` (`getAuthContext`
puede devolver certificados no autorizados en ciertas configuraciones),
`node-forge` (verificación de firmas RSA PKCS#1 v1.5) y, a través de ellas,
`firebase-admin`. Mismo criterio que arriba: revisar al actualizar las SDKs, sin
`--force`.

---

## 7. Caída del backend completo ante un resultado demasiado grande — ALTA (corregido, 02/10/2026)

Encontrado al probar la capa de snapshots de resultados
(`RENDIMIENTO_E_INTEGRIDAD.md`), antes de llegar a producción.

**El problema:** cuando un resultado superaba `NLQP_RESULT_MAX_BYTES`, el archivo
temporal se descartaba con escrituras todavía pendientes. Esas escrituras emitían
un evento `error` sin manejador, y Node termina el proceso ante eso. Cualquier
usuario autenticado podía tumbar el backend para todos con una sola consulta que
devolviera muchas filas (denegación de servicio). Hallazgos relacionados: en
MySQL/MariaDB/SQL Server el error dejaba archivos en disco, y una descarga de CSV
cancelada por el cliente dejaba la escritura esperando para siempre.

**La corrección:** el stream de escritura tiene siempre un manejador de `error`; se
espera su cierre sin `events.once` (que rechaza ante un `error` y se saltaba el
borrado); las esperas de `drain` también se liberan ante `close`.

**Verificación:** con un tope de 100 KB, los 4 motores responden `413`, el backend
sigue vivo, no queda ningún archivo en disco y no hay salida en stderr. Una
descarga cortada por el cliente no afecta al backend.

---

## 8. Endpoint de descarga de CSV sin autenticación de Firebase — BAJA (mitigado por diseño, 02/10/2026)

`GET /exportResultCsv` no pasa por `verifyFirebaseAuth`: la descarga es una
navegación del navegador (para que el archivo vaya directo a disco), y una
navegación no puede llevar el encabezado `Authorization`. Poner el ID token de
Firebase en la URL lo expondría en el historial y en logs.

**Mitigación:** el endpoint solo acepta un token aleatorio (UUID v4, 122 bits) que
emite `POST /createResultExport` — autenticado — y únicamente al dueño del
resultado. El token es de **un solo uso** y vence a los **2 minutos**; el resultado
mismo vence a los 30. Riesgo residual: si la URL se filtra dentro de esos 2 minutos
y antes de usarse, quien la tenga puede descargar ese resultado una vez. Las páginas
(`/getResultPage`) sí exigen Firebase y verifican que el `uid` sea el del dueño.

---

## 9. Falsos positivos: palabras reservadas y `;` dentro de literales — BAJA (corregido, 08/10/2026)

**Archivo:** `nlqp/backend/src/services/querySafety.service.ts` (`KEYWORD_PATTERN` y
el chequeo de `;` en `validateQuerySafety()`)

**El problema:** la lista de palabras prohibidas y la búsqueda de `;` se aplican al
texto completo de la consulta, **incluidos los literales de texto**. Solo
`hasUnauthorizedStackedStatement()` ignora los literales. Verificado el 08/10:

| Consulta | Resultado |
|---|---|
| `SELECT * FROM customers WHERE name = 'Update Corp'` | Bloqueada por "Update" |
| `SELECT * FROM products WHERE name LIKE '%Replace%'` | Bloqueada por "Replace" |
| `SELECT 'a;b' AS x` | Bloqueada por el `;` |

Falla en el sentido seguro (bloquea, no deja pasar), así que no es una
vulnerabilidad. Pero:

- **El texto de tesis es inexacto:** 6.3.3 en `CAPITULO_6_Y_PLAN.md` afirma que "las
  consultas que contienen palabras reservadas dentro de literales de texto continúan
  ejecutándose". No es así.
- **Impacto en la corrida con Gemini:** ninguno hoy. Ningún valor de los `CHECK` del
  banco (`ACTIVE`, `INACTIVE`, `DISCONTINUED`, `BILLING`, `SHIPPING`, `HOME`, …) ni
  ninguna de las 50 consultas cae en esto (200/200 pasan).

**Opciones:** (a) corregir el texto de 6.3.3 para describir el comportamiento real
(conservador: ante la duda, bloquea); o (b) aplicar la lista de palabras y el `;`
solo fuera de literales, reutilizando el recorrido de
`hasUnauthorizedStackedStatement()`. La (b) cambia `querySafety.service.ts` y exige
la regresión completa. **David eligió la (b) el 08/10.**

### La corrección (08/10/2026)

`maskStringLiterals()` reemplaza por espacios el contenido de los literales entre
comillas simples, y `;`, comentarios, palabras y funciones prohibidas se buscan sobre
ese texto. El riesgo de la técnica es que validador y motor no coincidan en dónde
termina un literal: el validador vería como texto algo que el motor ejecuta. Por eso:

- Se siguen las comillas dobles y los backticks (una `'` adentro no abre literal),
  pero no se enmascaran. Sin esto, en MySQL
  `SELECT "it's", LOAD_FILE('/etc/passwd'), "x'y"` escondía la función.
- Si la consulta contiene `\` (escape en MySQL/MariaDB, no en los otros), `$`
  (literales `$$…$$` de PostgreSQL) o `[` (identificador en SQL Server, subíndice en
  PostgreSQL: `ARRAY[']']`), o un literal sin cerrar, **no se enmascara nada** y se
  valida el texto completo, como antes.
- Los comentarios no hace falta modelarlos: validador y motor coinciden hasta el
  primer `--`, `/*` o `#`, que queda fuera de todo literal y se bloquea.

La batería incluye un intento de evasión por cada una de esas construcciones.

## 10. Funciones de lectura de archivos no bloqueadas por el validador — BAJA (corregido, 08/10/2026)

**Archivo:** `nlqp/backend/src/services/querySafety.service.ts`

**El problema:** `SELECT pg_read_file('/etc/passwd')` y
`SELECT LOAD_FILE('/etc/passwd')` **pasan** el Query Safety Engine: empiezan con
`SELECT`, no tienen `;` y no contienen ninguna palabra de la lista. Lo mismo aplica,
por construcción, a otras funciones con efectos fuera de la consulta
(`pg_read_binary_file`, `pg_ls_dir`, `pg_stat_file`, `lo_import`, `lo_export`,
`dblink*`, `pg_terminate_backend`, `pg_cancel_backend`, `set_config`, …).

**Por qué no es explotable hoy (verificado en vivo el 08/10, pasando por el
validador):**

| Motor | Prueba | Resultado |
|---|---|---|
| PostgreSQL | `pg_read_file('PG_VERSION')`, `pg_read_file('/etc/hostname')` | `permission denied for function pg_read_file` |
| PostgreSQL | `current_setting('is_superuser')` | `off` |
| MySQL | `LOAD_FILE('/etc/hostname')` | `NULL` (`secure_file_priv = /var/lib/mysql-files/`) |
| MariaDB | `LOAD_FILE('/etc/hostname')` | `NULL` |
| SQL Server | `IS_SRVROLEMEMBER('sysadmin')` | `0` |

Lo que lo frena son los **permisos del motor**, no el validador. Es la defensa en
profundidad funcionando, pero:

- **El texto de tesis es inexacto:** 6.3.3 dice que la batería incluye "intentos de
  acceso al sistema de archivos del servidor" y que el componente los bloqueó. Los
  casos de la batería original eran, casi seguro, `INTO OUTFILE` / `OPENROWSET` /
  `BULK` (que sí están en la lista); las funciones de lectura no.
- Con una cuenta con más privilegios (superusuario, `FILE` en MySQL), sí filtraría
  archivos del servidor.

**Corrección propuesta:** lista de funciones prohibidas (patrón `\bnombre\s*\(`)
con las de arriba + `LOAD_FILE`, `SLEEP`/`pg_sleep`/`WAITFOR` (ya acotadas por el
timeout, pero no tienen uso legítimo), y casos nuevos en la batería. Exige la
regresión completa.

### La corrección (08/10/2026)

`FORBIDDEN_FUNCTIONS` en `querySafety.service.ts`, buscadas como `nombre(`:
archivos y large objects de PostgreSQL (`pg_read_file`, `pg_ls_*`, `lo_*`, …),
funciones que **ejecutan SQL recibido como texto** (`query_to_xml*`,
`cursor_to_xml*`, `ts_stat`, `ts_rewrite`, `dblink*` — imprescindibles desde §9,
porque el SQL escondido en un literal ya no se inspecciona), administración y
bloqueos (`pg_terminate_backend`, `pg_advisory*`, `set_config`, `nextval`, …),
demoras (`pg_sleep*`, `SLEEP`, `BENCHMARK`), MySQL (`LOAD_FILE`, `GET_LOCK`, …) y
lectura de archivos en SQL Server (`fn_xe_file_target_read_file`, `fn_get_audit_file`,
`fn_trace_gettable`, `fn_dblog`). Palabras clave nuevas: `OPENDATASOURCE`, `WAITFOR`.

## 11. La batería de seguridad no estaba versionada — BAJA (corregido, 08/10/2026)

La batería de 17 casos que respalda el "17/17" de 6.3.3 y de este documento **no
existe como archivo en el repo**; solo está descrita en texto. No se puede repetir
tal cual, y la regla de "volver a correr la batería ante cualquier cambio a
`querySafety.service.ts`" depende de reconstruirla.

El 08/10 se reconstruyó una de 22 casos en un script temporal (DML, DDL,
sentencias encadenadas con y sin `;`, acceso a archivos, `xp_cmdshell`,
mayúsculas/minúsculas mezcladas, `WITH … DELETE`, `GRANT`, más 3 consultas legítimas
de control). Resultado: **19/22** — fallan los dos casos de §10 y el de `;` dentro
de literal de §9. **Pendiente:** guardarla como script en el repo (junto con la
corrida de las 50 consultas vía `validateQuerySafety()` + `runQuery()`) para que
sea reproducible.

### La corrección (08/10/2026)

`nlqp/backend/scripts/regresion_seguridad.mjs`, con `npm run test:seguridad` (compila
y corre todo; `-- --solo-bateria` no toca las bases). 57 casos: 44 que deben
bloquearse y 13 legítimos. Resultado tras las correcciones de §9 y §10: **57/57, y
las 50 consultas 200/200 con 0 inconsistencias entre motores.**

---

## Archivos modificados en esta revisión

- `nlqp/backend/src/services/querySafety.service.ts` — nueva función
  `hasUnauthorizedStackedStatement()` + chequeo conectado a `validateQuerySafety()`.
- `nlqp/backend/src/middleware/auth.middleware.ts` — bypass de desarrollo ahora
  requiere `NLQP_ALLOW_DEV_AUTH_BYPASS=true` explícito, no solo `FIREBASE_PROJECT_ID`
  vacío.
- `nlqp/backend/src/services/connectionManager.service.ts` —
  `trustServerCertificate` movido a la variable de entorno
  `DB_MSSQL_TRUST_SERVER_CERTIFICATE`.
- `nlqp/backend/.env` — agregadas `NLQP_ALLOW_DEV_AUTH_BYPASS=true` y
  `DB_MSSQL_TRUST_SERVER_CERTIFICATE=true` (valores de desarrollo local).
- `nlqp/backend/.env.example` — mismas variables con los valores seguros por
  defecto (`false`).

Revisión del 08/10/2026 (§9–11):

- `nlqp/backend/src/services/querySafety.service.ts` — `maskStringLiterals()`,
  `FORBIDDEN_FUNCTIONS`, palabras clave `OPENDATASOURCE` y `WAITFOR`.
- `nlqp/backend/scripts/regresion_seguridad.mjs` (nuevo) + script
  `test:seguridad` en `package.json`.

Revisión del 02/10/2026 (§7 y §8):

- `nlqp/backend/src/services/resultStore.service.ts` — manejo de errores del stream
  de escritura, cierre antes de borrar, esperas de `drain` liberadas ante `close`,
  tokens de descarga de un solo uso.
- `nlqp/backend/src/functions/resultPages.ts` — `exportResultCsv` fuera del
  middleware de Firebase, autorizado por token.
