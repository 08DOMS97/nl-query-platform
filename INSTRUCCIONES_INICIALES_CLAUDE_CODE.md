# Instrucciones iniciales para Claude Code — NL-Query-Platform (NLQP)

## 0. Contexto que Claude Code debe leer primero

Este es el proyecto de tesis de David Monterroso (UMG): **NL-Query-Platform**, una
plataforma que convierte lenguaje natural a SQL usando Vertex AI Gemini Pro, sobre
arquitectura serverless de Google Cloud (Cloud Functions 2nd gen + Firestore +
Firebase Auth + Firebase Hosting). Soporta 4 motores: PostgreSQL, MySQL, MariaDB,
SQL Server. Solo permite operaciones `SELECT` (Query Safety Engine).

**Ya existe en disco** un banco de pruebas de bases de datos completamente
funcional en:

```
C:\Users\david\Proyectos\nl-query-platform\Bases de datos\
```

Ese banco de pruebas **NO es parte del código de NLQP** — es infraestructura Docker
de apoyo con un dataset de e-commerce ya cargado en los 4 motores. NLQP se construye
en una carpeta **hermana**, por ejemplo:

```
C:\Users\david\Proyectos\nl-query-platform\nlqp\
├── backend\
└── frontend\
```

**Primer paso obligatorio de Claude Code:** leer
`C:\Users\david\Proyectos\nl-query-platform\Bases de datos\README.md` completo
antes de tocar nada, para no reinterpretar mal el entorno.

---

## 1. Levantar el banco de pruebas (una sola vez, antes de programar)

```powershell
cd "C:\Users\david\Proyectos\nl-query-platform\Bases de datos"
docker compose up -d
docker compose logs -f sqlserver-init    # esperar "[init] completado OK", luego Ctrl+C
.\verificar.ps1
.\verificar_dataset.ps1
```

⚠️ **No levantar a la vez que `../db/docker-compose.yml`** (otro entorno que usa los
mismos puertos de host — confirmar con David antes de tocar esa carpeta si aparece).

---

## 2. Credenciales y conexión reales (entorno LOCAL de desarrollo)

Estas son las credenciales del banco de pruebas ya existente. **Usar exactamente
estos valores** en el `.env` del backend de NLQP durante desarrollo local — no
inventar otros ni generar contraseñas nuevas.

| Motor | Host | Puerto | Base | Usuario app | Password |
|---|---|---|---|---|---|
| PostgreSQL 16 | `localhost` | `5432` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| MySQL 8.0 | `localhost` | `3306` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| MariaDB 11.4 | `localhost` | `3307` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| SQL Server 2022 | `localhost` | `1433` | `testdb` | `testuser` | `TestUser_2026_DB!` |

Cadenas de conexión listas para usar en el backend:

```
postgresql://testuser:TestUser_2026_DB!@localhost:5432/testdb
mysql://testuser:TestUser_2026_DB!@localhost:3306/testdb
mysql://testuser:TestUser_2026_DB!@localhost:3307/testdb   (MariaDB)
Server=localhost,1433;Database=testdb;User Id=testuser;Password=TestUser_2026_DB!;Encrypt=True;TrustServerCertificate=True;   (SQL Server)
```

**Importante sobre seguridad de este `testuser`:** tiene permisos amplios *dentro*
de `testdb` a propósito — el objetivo es que el **Query Safety Engine de NLQP**
(no la cuenta de BD) sea lo que bloquee cualquier sentencia distinta de `SELECT`.
Esto es intencional para poder probar RF-07 (validación de solo lectura) de forma
realista: si NLQP fallara en bloquear un `DELETE`, con esta cuenta sí se ejecutaría.
**El Query Safety Engine debe implementarse desde el día 1**, no como una fase
posterior — nunca ejecutar SQL generado por el modelo sin pasar primero por la
validación sintáctica (whitelist `SELECT` + blacklist `INSERT/UPDATE/DELETE/DROP/
ALTER/TRUNCATE/CREATE/GRANT/EXEC/sp_`).

En producción esto cambia: las credenciales del cliente se guardan en Google Cloud
Secret Manager y deberían ser una cuenta de solo lectura real a nivel de motor
(defensa en profundidad, capa 4). Eso no aplica al entorno local de pruebas.

---

## 3. El dataset disponible para probar NL2SQL

8 tablas, ~2,233 filas, contenido idéntico en los 4 motores:

```
categories (15) → products (100) → order_items (798) ← orders (300) ← customers (200)
                                         ↓                    ↓
                                    payments (337)      addresses (250)
                                    shipments (233)
```

Relaciones (8 FK): `products.category_id`, `addresses.customer_id`,
`orders.customer_id`, `orders.shipping_address_id`, `order_items.order_id`,
`order_items.product_id`, `payments.order_id`, `shipments.order_id`.

Dominios de estado ya definidos con `CHECK` en las 4 bases (útiles para el prompt
de Vertex AI o para pruebas de generación SQL):

- `customers.status`: `ACTIVE`, `INACTIVE`
- `products.status`: `ACTIVE`, `INACTIVE`, `DISCONTINUED`
- `orders.status`: `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- `payments.status`: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`
- `payments.payment_method`: `CREDIT_CARD`, `DEBIT_CARD`, `PAYPAL`, `BANK_TRANSFER`, `CASH_ON_DELIVERY`
- `shipments.status`: `PREPARING`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `RETURNED`

Este dataset sirve directamente como conjunto de prueba para las 50 consultas
representativas (simple/intermedio/complejo) exigidas en la metodología de la
tesis (sección 3.3.1.2).

### Diferencias de dialecto a manejar en el módulo de extracción de esquema

| Aspecto | PostgreSQL | MySQL / MariaDB | SQL Server |
|---|---|---|---|
| Identidad de PK | `GENERATED BY DEFAULT AS IDENTITY` | `AUTO_INCREMENT` | `IDENTITY(1,1)` |
| Booleanos | `BOOLEAN` | `TINYINT(1)` | `BIT` |
| Fecha/hora | `TIMESTAMPTZ` | `DATETIME` | `DATETIME2(0)` |
| Límite de filas | `LIMIT n` | `LIMIT n` | `SELECT TOP n` |
| Funciones de fecha | `EXTRACT(YEAR FROM ...)` | `EXTRACT(...)` / `YEAR(...)` | `YEAR(...)`, `DATEPART(...)` |
| Concatenar | `\|\|` o `CONCAT` | `CONCAT` | `+` o `CONCAT` |
| Esquema de sistema | `information_schema` + `pg_catalog` | `information_schema` | `sys.*` + `information_schema` |
| Esquema contenedor | `public` | (la propia base) | `dbo` |

El módulo `SchemaExtractor` de NLQP debe generar, para cada motor, la sentencia de
introspección correcta contra estas vistas de sistema y normalizar el resultado a
una representación única antes de enviarla como contexto al modelo.

---

## 4. Estructura del proyecto NLQP a crear

```
nlqp/
├── backend/
│   ├── src/
│   │   ├── functions/
│   │   │   ├── testConnection.ts
│   │   │   ├── getSchema.ts
│   │   │   ├── generateSQL.ts
│   │   │   └── executeQuery.ts
│   │   ├── services/
│   │   │   ├── connectionManager.service.ts   # pool por motor, 4 adaptadores
│   │   │   ├── schemaExtractor.service.ts     # introspección + normalización
│   │   │   ├── schemaPruning.service.ts       # selección de subconjunto relevante
│   │   │   ├── vertexAI.service.ts            # prompt + llamada a Gemini Pro
│   │   │   ├── querySafety.service.ts         # whitelist/blacklist SELECT-only
│   │   │   └── secretManager.service.ts       # solo producción
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts             # verificación JWT Firebase
│   │   └── types/
│   │       └── index.ts
│   ├── .env                                    # ver sección 2 — NO commitear
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/firebase.ts
│   ├── package.json
│   └── next.config.js
└── firebase.json
```

## 5. Dependencias del backend (`package.json`)

```json
{
  "name": "nlqp-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "node --watch lib/index.js",
    "start": "node lib/index.js",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "@google-cloud/functions-framework": "^3.5.0",
    "@google-cloud/secret-manager": "^5.2.0",
    "@google-cloud/firestore": "^6.11.0",
    "@google-cloud/vertexai": "^0.6.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3",
    "mysql2": "^3.9.0",
    "mssql": "^10.0.2",
    "firebase-admin": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "@types/pg": "^8.10.9",
    "@types/cors": "^2.8.17",
    "typescript": "^5.4.0"
  }
}
```

> Nota: se usa `mysql2` en vez de `mysql` (el paquete `mysql` está deprecado y no
> tiene soporte activo — mejor usar `mysql2`, compatible con MySQL y MariaDB).

## 6. `.env` del backend para desarrollo local

```dotenv
# --- Conexiones de prueba (banco de datos local en Docker) ---
DB_POSTGRES_HOST=localhost
DB_POSTGRES_PORT=5432
DB_POSTGRES_DATABASE=testdb
DB_POSTGRES_USER=testuser
DB_POSTGRES_PASSWORD=TestUser_2026_DB!

DB_MYSQL_HOST=localhost
DB_MYSQL_PORT=3306
DB_MYSQL_DATABASE=testdb
DB_MYSQL_USER=testuser
DB_MYSQL_PASSWORD=TestUser_2026_DB!

DB_MARIADB_HOST=localhost
DB_MARIADB_PORT=3307
DB_MARIADB_DATABASE=testdb
DB_MARIADB_USER=testuser
DB_MARIADB_PASSWORD=TestUser_2026_DB!

DB_MSSQL_HOST=localhost
DB_MSSQL_PORT=1433
DB_MSSQL_DATABASE=testdb
DB_MSSQL_USER=testuser
DB_MSSQL_PASSWORD=TestUser_2026_DB!

# --- Google Cloud (David debe completar antes de probar generación NL2SQL) ---
GCP_PROJECT_ID=
GCP_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.5-pro

# --- Firebase (David debe completar) ---
FIREBASE_PROJECT_ID=
```

---

## 7. Orden de construcción recomendado (alineado a los 5 módulos del alcance)

1. **ConnectionManager** — pool de conexión a los 4 motores usando el `.env` de
   arriba; endpoint `testConnection` para verificar cada uno contra el banco de
   pruebas ya levantado.
2. **SchemaExtractor** — introspección real vía `information_schema`/`sys.*` según
   la tabla de dialectos (sección 3); probar contra `testdb` en los 4 motores y
   comparar que las 8 tablas y sus FKs salgan correctamente en los 4 casos.
3. **SchemaPruning** — filtrar el esquema completo (8 tablas) al subconjunto
   relevante por consulta; con solo 8 tablas el efecto es modesto, pero el
   mecanismo debe quedar listo para esquemas más grandes.
4. **VertexAIService + generateSQL** — requiere que David tenga ya un proyecto GCP
   con Vertex AI habilitado (pendiente, ver checklist final).
5. **QuerySafetyEngine** — validar contra las 50 consultas de prueba y contra
   sentencias no-`SELECT` inyectadas deliberadamente (meta: 100% de bloqueo).
6. **executeQuery** — solo después de que el Safety Engine esté validado.
7. **Historial y consultas guardadas** — sobre Firestore, al final.
8. **Frontend Next.js + Firebase Auth** — en paralelo o después del backend base.

No saltar el orden 1→2→3 antes de tocar Vertex AI: sin esquema extraído
correctamente, no hay forma de validar que el prompt esté bien construido.

---

## 8. Pendientes de David antes de que Claude Code pueda completar todo

- [ ] Proyecto de Google Cloud con **Vertex AI habilitado** y credenciales
      (`gcloud auth application-default login` o service account key)
- [ ] Proyecto de **Firebase** creado (Auth + Firestore + Hosting habilitados)
- [ ] Repositorio de **GitHub** vacío listo para el primer push
- [ ] Confirmar si `../db/` es un entorno alterno relevante para producción o
      material obsoleto (no levantar por conflicto de puertos hasta confirmarlo)

Hasta que los dos primeros estén listos, Claude Code puede avanzar completamente
en los módulos 1–3 (conexión, extracción de esquema, schema pruning) usando el
banco de pruebas ya funcional.
