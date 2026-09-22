# Revisión de seguridad — backend NLQP (2026-09-17)

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
| 6 | 14 vulnerabilidades moderadas transitivas (`npm audit`) | Baja | Documentado, no corregido |

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
