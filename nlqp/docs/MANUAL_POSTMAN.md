# Manual: probar NLQP con Postman (desde cero)

Este manual asume que nunca has usado Postman. Con la colección incluida
(`postman/NLQP.postman_collection.json`) no necesitas escribir nada a mano — solo
importarla y darle "Send".

---

## 1. Instalar Postman

1. Ve a https://www.postman.com/downloads/ y descarga la versión de escritorio para
   Windows.
2. Instálalo como cualquier programa (siguiente, siguiente, instalar).
3. Ábrelo. Te va a pedir crear una cuenta o iniciar sesión.
   - Puedes usar **"Skip and go to the app"** / **"Continuar sin cuenta"** si aparece
     esa opción, o crear una cuenta gratuita con tu correo — cualquiera de las dos
     sirve para lo que vamos a hacer (todo corre en tu máquina, `localhost`).

---

## 2. Importar la colección y el environment

La "colección" es el conjunto de peticiones ya armadas (una por cada endpoint de
NLQP). El "environment" (entorno) guarda la variable `baseUrl` para no repetir
`http://localhost:8080` en cada petición.

1. En Postman, arriba a la izquierda, haz clic en **Import**.
2. Arrastra (o selecciona con "Choose Files") estos dos archivos:
   - `nlqp/docs/postman/NLQP.postman_collection.json`
   - `nlqp/docs/postman/NLQP.postman_environment.json`
3. Haz clic en **Import**.
4. En el panel izquierdo, bajo **Collections**, debe aparecer **"NLQP - NL Query
   Platform"** con 10 peticiones dentro.
5. Arriba a la derecha hay un selector de environment (probablemente dice "No
   Environment"). Haz clic ahí y selecciona **"NLQP Local"**.
   - Esto activa la variable `{{baseUrl}}` = `http://localhost:8080` que usan todas
     las peticiones.

---

## 3. Antes de probar: levantar el sistema

Necesitas dos cosas corriendo en tu máquina (Postman no las levanta por ti):

**a) El banco de pruebas (Docker):**
```powershell
cd "C:\Users\david\Proyectos\nl-query-platform\Bases de datos"
docker compose up -d
```

**b) El backend de NLQP:**
```powershell
cd "C:\Users\david\Proyectos\nl-query-platform\nlqp\backend"
npm run dev
```
Deja esa terminal abierta — mientras esté corriendo, el mensaje dirá algo como
`NLQP backend escuchando en http://localhost:8080`.

---

## 4. Probar cada endpoint

En el panel izquierdo, haz clic en cualquier petición de la colección para abrirla,
y luego en el botón azul **Send** (arriba a la derecha del panel central). La
respuesta aparece abajo, con el código de estado HTTP arriba (200, 403, etc.) y el
JSON de respuesta.

Prueba en este orden:

### 0. Health check
`GET /health` → debe responder `200 OK` con `{"ok": true}`. Si esto falla, el
backend no está corriendo (revisa el paso 3b).

### 1. Test Connection - los 4 motores
`GET /testConnection` → debe responder `200 OK` con un arreglo `results` de 4
elementos (`postgres`, `mysql`, `mariadb`, `mssql`), todos con `"ok": true`. Si
alguno da `false`, revisa que Docker esté arriba (paso 3a).

### 1b. Test Connection - un solo motor
Igual que el anterior pero filtrado por `?engine=postgres`. Puedes cambiar el valor
del parámetro `engine` en la pestaña **Params** del centro (`postgres`, `mysql`,
`mariadb` o `mssql`).

### 2. Get Schema - esquema completo
`GET /getSchema?engine=postgres` → devuelve las 8 tablas del dataset con sus
columnas, llaves primarias y foráneas, ya normalizadas (sin diferencias de
dialecto). Cambia `engine` en **Params** para ver el mismo esquema extraído de los
otros 3 motores.

### 2b. Get Schema - con schema pruning
Igual, pero con el parámetro `naturalLanguageQuery` — el sistema selecciona solo las
tablas relevantes a esa pregunta en vez de las 8 completas. Cambia el texto en
**Params** para probar con otras preguntas en español.

### 2c. Get Schema - SQL Server
Mismo endpoint apuntando a `mssql`, para confirmar que la introspección también
funciona ahí (usa `sys.*`/`INFORMATION_SCHEMA` internamente).

### 3. Execute Query - SELECT válido
`POST /executeQuery` con un cuerpo JSON `{"engine": "postgres", "sql": "SELECT ..."}`
(lo ves en la pestaña **Body** del centro, ya escrito). Debe dar `200 OK` con
`columns`, `rows` y `rowCount`. Este es el endpoint que de verdad ejecuta SQL contra
la base de datos — pasa primero por el Query Safety Engine.

Puedes editar el `sql` del Body para probar tus propias consultas. Recuerda: solo
`SELECT` (o `WITH ... SELECT`) — cualquier otra cosa la bloquea el sistema (ver
punto 4).

### 3b. Execute Query - SQL Server (sintaxis TOP)
Misma idea contra `mssql`, mostrando que ahí se usa `TOP 10` en vez de `LIMIT 10`
(diferencia de dialecto — ver la tabla en `INSTRUCCIONES_INICIALES_CLAUDE_CODE.md`).

### 4. Query Safety Engine - DELETE bloqueado
Envía un `DELETE` a propósito. Debe responder **403 Forbidden**, no 200 — esa es la
prueba de que el sistema bloquea escritura aunque la cuenta de BD (`testuser`) sí
tendría permiso para borrar. Revisa el campo `reason` en la respuesta.

### 4b. Query Safety Engine - sentencia apilada bloqueada
Envía `SELECT ...; DROP TABLE ...` (dos sentencias separadas por `;`, un truco común
de inyección SQL). También debe dar **403**.

### 5. Generate SQL (NL2SQL)
`POST /generateSQL` con `{"engine": "postgres", "naturalLanguageQuery": "..."}`.
**Esta todavía no va a funcionar** — responde `500` con un mensaje explicando que
falta `GCP_PROJECT_ID` (necesitas el proyecto de Google Cloud con Vertex AI
habilitado, que está pendiente). En cuanto tengas ese proyecto, este endpoint
convierte la pregunta en SQL automáticamente y ahí sí tiene sentido encadenarlo con
el endpoint 3 (Execute Query).

---

## 5. Cómo leer una respuesta en Postman

- **Código de estado** (arriba del panel de respuesta, junto al tiempo y tamaño):
  - `200` = todo bien.
  - `400` = pediste algo mal formado (falta un campo, motor inválido).
  - `403` = el Query Safety Engine bloqueó tu SQL (funcionando como debe).
  - `500` = error del servidor (revisa el mensaje `error` del JSON; si es
    `generateSQL`, casi seguro es porque falta configurar Vertex AI).
- **Pestaña "Body"** de la respuesta: el JSON devuelto. Postman lo formatea e
  indenta automáticamente ("Pretty").
- **Pestaña "Headers"**: no la necesitas para esto, es información técnica del HTTP.

---

## 6. Errores comunes

| Síntoma en Postman | Causa probable | Solución |
|---|---|---|
| "Could not send request" / "ECONNREFUSED" | El backend no está corriendo | `npm run dev` en `nlqp/backend` (paso 3b) |
| `testConnection` da `ok: false` en algún motor | Docker no está arriba o el contenedor aún no terminó de iniciar | `docker compose up -d` en `Bases de datos/`, esperar ~10s |
| `generateSQL` da 500 "GCP_PROJECT_ID no está configurado" | Esperado — falta el proyecto de Google Cloud | Pendiente de que se configure `GCP_PROJECT_ID` en `nlqp/backend/.env` |
| `executeQuery` da 403 en un SELECT que parece válido | El SQL no empieza exactamente con `SELECT`/`WITH`, tiene un `;` de más, o usa una palabra bloqueada (ver `querySafety.service.ts`) | Revisar el campo `reason` de la respuesta — te dice exactamente por qué |
