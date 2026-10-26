# Entorno LOCAL de pruebas — 4 motores · dataset e-commerce para NL2SQL

Cuatro motores de base de datos, cada uno en su propio contenedor Docker, con un
**dataset relacional de e-commerce** (8 tablas, 1 485 641 filas) pensado para probar la
generación de SQL a partir de lenguaje natural (NL2SQL) de NL-Query-Platform y para
medir la eficiencia de las consultas con `EXPLAIN` (ver [Volumen](#volumen-alimentación-del-24102026)).

**Esto no es parte del sistema NLQP.** Es un banco de pruebas local. No contiene código
de NLQP. Las credenciales de `.env` son de pruebas locales, **no** son secretos del
sistema (los reales van en Google Cloud Secret Manager, RNF-05).

> **No levantar a la vez que `../db/docker-compose.yml`.** Ese otro entorno (decisión
> D-05) usa los mismos puertos de host. Solo uno de los dos puede estar arriba.

---

## Motores, puertos y credenciales

| Motor | Imagen | Host:puerto | Base | Init automática |
|---|---|---|---|---|
| PostgreSQL 16 | `postgres:16` | `localhost:5432` | `testdb` | `/docker-entrypoint-initdb.d` |
| MySQL 8.0 | `mysql:8.0` | `localhost:3306` | `testdb` | `/docker-entrypoint-initdb.d` |
| MariaDB 11.4 (LTS) | `mariadb:11.4` | `localhost:3307` | `testdb` | `/docker-entrypoint-initdb.d` |
| SQL Server 2022 (Developer) | `mcr.microsoft.com/mssql/server:2022-latest` | `localhost:1433` | `testdb` | servicio `sqlserver-init` |

MariaDB se publica en **3307** (internamente escucha en 3306, igual que MySQL).

**Cuenta de la aplicación (la que se usa para probar NLQP):**

```
usuario:     testuser
contraseña:  TestUser_2026_DB!
base:        testdb
```

`testuser` tiene todos los permisos **dentro de `testdb`** y ninguno a nivel de
servidor. Las cuentas administradoras (`postgres` / `root` / `root` / `sa`) están en
`.env` y son **solo para administración**.

---

## El dataset

Dominio: tienda en línea. Datos **deterministas** (semilla fija `20260907` en
`generar_seed.py`) e **idénticos en su contenido lógico** en los cuatro motores, para
poder comparar fila a fila la misma consulta entre motores. Los valores no son
repetitivos: nombres, ciudades, países, precios, fechas y estados varían de forma
realista.

### Diagrama lógico de relaciones

```
                 ┌───────────────┐
                 │  categories   │
                 │ category_id PK│
                 └──────┬────────┘
                        │ 1
                        │
                        │ N
                 ┌──────┴────────┐
                 │   products    │
                 │ product_id PK │
                 │ category_id FK│
                 └──────┬────────┘
                        │ 1
                        │ N
   ┌────────────┐   ┌───┴───────────┐   ┌────────────┐
   │ customers  │1 N│  order_items  │N 1│  (products)│
   │customer_id │──▶│ order_item_id │◀──│            │
   │    PK      │   │ order_id   FK │   └────────────┘
   └────┬───┬───┘   │ product_id FK │
      1 │   │ 1     └───────┬───────┘
        │   │               │ N
      N │   │ N             │ 1
   ┌────┴───┐ │        ┌────┴──────────┐
   │addresses│ └───────▶│    orders     │
   │address_ │  (1:N)   │  order_id PK  │
   │  id PK  │◀─────────│ customer_id FK│
   │cust. FK │  orders. │ shipping_     │
   └─────────┘ shipping_│  address_id FK│
               address_ └───┬───────┬───┘
               id (FK)      │ 1     │ 1
                            │ N     │ N
                     ┌──────┴──┐ ┌──┴────────┐
                     │payments │ │ shipments │
                     │payment_ │ │shipment_  │
                     │ id PK   │ │  id PK    │
                     │order_ FK│ │ order_ FK │
                     └─────────┘ └───────────┘
```

Relaciones (8 claves foráneas por motor):

| Relación | Cardinalidad | FK |
|---|---|---|
| `categories` → `products` | 1:N | `products.category_id` |
| `customers` → `addresses` | 1:N | `addresses.customer_id` |
| `customers` → `orders` | 1:N | `orders.customer_id` |
| `addresses` → `orders` | 1:N (opcional) | `orders.shipping_address_id` |
| `orders` → `order_items` | 1:N | `order_items.order_id` |
| `products` → `order_items` | 1:N | `order_items.product_id` |
| `orders` → `payments` | 1:N | `payments.order_id` |
| `orders` → `shipments` | 1:N (normalmente 1:1) | `shipments.order_id` |

`order_items` es la tabla intermedia entre `orders` y `products`
(`UNIQUE (order_id, product_id)`).

### Tablas y columnas

| Tabla | Filas | (base + volumen) | Columnas principales |
|---|---:|---:|---|
| `categories` | 15 | 15 + 0 | `category_id`, `name` (único), `description`, `active` |
| `customers` | 50 000 | 200 + 49 800 | `customer_id`, `first_name`, `last_name`, `email` (único), `phone`, `date_of_birth`, `registration_date`, `status`, `country`, `city` |
| `addresses` | 72 038 | 250 + 71 788 | `address_id`, `customer_id` FK, `address_type`, `address_line`, `city`, `state`, `postal_code`, `country`, `is_default` |
| `products` | 2 000 | 100 + 1 900 | `product_id`, `category_id` FK, `name`, `description`, `price`, `stock`, `status`, `created_at` |
| `orders` | 250 000 | 300 + 249 700 | `order_id`, `customer_id` FK, `order_date`, `status`, `subtotal`, `tax`, `shipping_cost`, `total`, `shipping_address_id` FK |
| `order_items` | 631 630 | 802 + 630 828 | `order_item_id`, `order_id` FK, `product_id` FK, `quantity`, `unit_price`, `discount`, `subtotal` |
| `payments` | 280 797 | 337 + 280 460 | `payment_id`, `order_id` FK, `payment_date`, `payment_method`, `amount`, `status`, `transaction_reference` (único) |
| `shipments` | 199 161 | 229 + 198 932 | `shipment_id`, `order_id` FK, `shipment_date`, `delivery_date`, `carrier`, `tracking_number` (único), `status` |
| **Total** | **1 485 641** | 2 233 + 1 483 408 | |

Ocupa ~355 MB en PostgreSQL.

### Coherencia garantizada

- Cada `total` de pedido = `subtotal + tax + shipping_cost`.
- Cada `subtotal` de pedido = suma de los `subtotal` de sus `order_items`.
- Cada línea: `subtotal = quantity * unit_price - discount`.
- `tax` = 12 % del `subtotal` (IVA de Guatemala).
- Sin referencias huérfanas: toda FK apunta a una fila existente.
- `payment_date >= order_date`; `delivery_date >= shipment_date`.
- Coherencia de estados: un pedido `DELIVERED` tiene envío `DELIVERED` y pago
  `COMPLETED`; un `CANCELLED` no tiene envío activo; etc.

### Diversidad (para consultas con filtros reales)

- **Clientes:** 18 282 sin pedidos · 5 884 con 1 · 18 109 con más de 3 (máximo 161).
  41 599 `ACTIVE`, 8 401 `INACTIVE`. Ciudad con más clientes: Guatemala City (11 187).
  9 países, 45 ciudades.
- **Productos:** 160 nunca vendidos · 103 agotados (`stock = 0`) · 321 con `stock < 10` ·
  best-sellers claros. Precios de 3,49 a 4 999,99 (el más caro es único:
  *Stark Graphics Card (Max)*). 3 estados (`ACTIVE` / `INACTIVE` / `DISCONTINUED`).
- **Categorías:** 15, con 47 a 245 productos cada una (más productos: *Electronics*).
  13 `active`, 2 no.
- **Pedidos:** repartidos 2023–2026 (40 598 / 63 340 / 86 479 / 59 583; 2026 hasta el
  6 de septiembre). 6 estados. 32 529 `CANCELLED` (~13 %).
- **Pagos:** 5 métodos, 4 estados. Hay pagos `FAILED` y `PENDING`.
- **Envíos:** 5 estados. Hay envíos `PREPARING` / `IN_TRANSIT` y `DELIVERED`.

### Dominios de valores (estados)

| Columna | Valores |
|---|---|
| `customers.status` | `ACTIVE`, `INACTIVE` |
| `products.status` | `ACTIVE`, `INACTIVE`, `DISCONTINUED` |
| `orders.status` | `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `payments.status` | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED` |
| `payments.payment_method` | `CREDIT_CARD`, `DEBIT_CARD`, `PAYPAL`, `BANK_TRANSFER`, `CASH_ON_DELIVERY` |
| `shipments.status` | `PREPARING`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `RETURNED` |
| `addresses.address_type` | `HOME`, `BILLING`, `SHIPPING` |

Todos estos dominios están además protegidos con `CHECK` en las cuatro bases.

### Índices

Además de las PK y las restricciones `UNIQUE` (`categories.name`, `customers.email`,
`order_items(order_id, product_id)`, `payments.transaction_reference`,
`shipments.tracking_number`), se crean índices sobre:

- **FK:** `addresses.customer_id`, `products.category_id`, `orders.customer_id`,
  `orders.shipping_address_id`, `order_items.order_id`, `order_items.product_id`,
  `payments.order_id`, `shipments.order_id`.
- **Fechas:** `orders.order_date`, `payments.payment_date`, `shipments.shipment_date`,
  `customers.registration_date`, `products.created_at` *(solo el `DEFAULT`, sin índice)*.
- **Estados:** `customers.status`, `products.status`, `orders.status`,
  `payments.status`, `shipments.status`.
- **Otras de filtro frecuente:** `customers.city`, `customers.country`,
  `products.price`, `payments.payment_method`.
- **Compuestos (24/10/2026, para el volumen):** pensados para los reportes que hacen las
  50 consultas de referencia; los tres primeros son *cubrientes* (la consulta se
  responde desde el índice, sin leer la tabla).

  | Índice | Columnas | Para |
  |---|---|---|
  | `ix_orders_customer_status` | `orders (customer_id, status, total)` | gasto y pedidos por cliente |
  | `ix_orders_date_status` | `orders (order_date, status, total)` | ventas por período sin cancelados |
  | `ix_order_items_product_sales` | `order_items (product_id, order_id, quantity, subtotal)` | unidades y ventas por producto |
  | `ix_payments_status_method` | `payments (status, payment_method, amount)` | recaudación por método de pago |
  | `ix_customers_name` | `customers (last_name, first_name)` | búsqueda de un cliente por nombre |

  Que el optimizador los use o no depende del motor y de la consulta: por ejemplo,
  PostgreSQL resuelve el gasto de un cliente con *Index Only Scan* sobre
  `ix_orders_customer_status`, pero para las ventas de un año prefiere `ix_orders_date`.
  Los pedidos están en orden cronológico, así que ese índice casi coincide con el orden
  físico de la tabla. Esas diferencias son justamente lo que se mide con `EXPLAIN`.

En PostgreSQL y SQL Server los índices de FK se declaran de forma explícita (esos
motores no los crean solos); en MySQL/MariaDB InnoDB ya los exige.

### Volumen (alimentación del 24/10/2026)

El dataset base (2 233 filas, secciones 1–7 de `generar_seed.py`) sigue **igual, fila
por fila**: mismos ids y mismos valores. Encima se generaron 1 483 408 filas más
(sección 8, con datos de `catalogo_volumen.py`) para tener un banco donde `EXPLAIN`
mida algo: con 300 pedidos cualquier plan es instantáneo. Mismos datos lógicos en los
4 motores.

Cómo se ven los datos nuevos:

- **Clientes:** nombres y apellidos frecuentes en Guatemala y la región, incluidos los de
  origen maya y los dos apellidos. Correos derivados del nombre en dominios reservados
  (`example.*`, RFC 2606: ningún buzón real). Teléfonos con el formato de cada país
  (`+502 5401 1270`, `+52 55 5825 0657`). Fecha de nacimiento coherente: mayores de 18
  al registrarse. ~6 % sin teléfono y ~10 % sin fecha de nacimiento, como en una base real.
- **Direcciones:** formato de cada país (`17a Avenida 34-05, Zona 16` con código postal
  `01016`; `Carrera 15 # 93-47`; `Calle de Alcala 145, 3o B`). Entre 1 y 3 por cliente.
  Algunas están en otra ciudad u otro país.
- **Productos:** marca, línea, tipo y modelo (`Hooli Edge 24in Monitor FHD M482`), con
  precio realista para cada tipo de artículo. Los descontinuados y los de categorías
  inactivas dejan de venderse.
- **Pedidos:** siempre después del registro del cliente y de la creación del producto.
  Ids en orden cronológico. Crecimiento año a año y temporada: diciembre, Black Friday,
  Hot Sale, quincena y menos compras el fin de semana. Más descuentos en las promociones.
- **Pagos y envíos:** con las mismas reglas de coherencia que el base. Los métodos de pago
  dependen del país (contra entrega sobre todo en Guatemala, PayPal en EE. UU.), y también
  los transportistas: Guatex, Cargo Expreso y Forza solo en Guatemala. El número de guía
  tiene el formato de cada transportista.
- **Sin tildes ni eñes**, igual que el base, para que un filtro por nombre o ciudad
  funcione igual en filas viejas y nuevas.

Las 50 consultas de referencia se comprobaron después de la carga: dan el mismo
resultado en los 4 motores (50/50). El generador descarta cualquier variante de los
datos donde un `LIMIT` de esas referencias cortara en medio de un empate, porque ahí
el resultado dependería del motor.

Salida: `init/postgres/04-volumen.sql.gz`, `init/mysql/03-volumen.sql.gz`,
`init/mariadb/03-volumen.sql.gz` e `init/sqlserver/04-volumen.sql.gz` (~25 MB cada uno).
**No se versionan** (`.gitignore`): los genera `python generar_seed.py`, que es
determinista. Sin esos archivos, el banco levanta solo con el dataset base. Al terminar
la carga se actualizan las estadísticas del optimizador en los 4 motores (`VACUUM
ANALYZE`, `ANALYZE TABLE`, `UPDATE STATISTICS`).

---

## SELECT-only

Estas bases se usan para probar NLQP. **La restricción de solo lectura la aplica NLQP**
(su Query Safety Engine, RNF-06), no este banco de pruebas.

`testuser` mantiene permisos amplios dentro de `testdb` **a propósito**: el objetivo es
probar que NLQP bloquea la escritura *aunque la cuenta pudiera escribir*. La cuarta capa
de defensa en profundidad (cuenta de BD de solo lectura) se prueba por separado con las
cuentas de `../db/esquema/usuario_lectura_*.sql`.

---

## Uso

```powershell
# 1. Preparar credenciales (solo la primera vez)
Copy-Item .env.example .env    # y editar valores si se desea

# 2. Generar el volumen (solo la primera vez en un equipo nuevo; ~2 min, Python 3)
python generar_seed.py

# 3. Levantar los 4 motores. La primera carga tarda: ~2 min PostgreSQL, MySQL y
#    MariaDB, ~8 min SQL Server. Mientras tanto aparecen como "starting".
docker compose up -d

# 4. Ver progreso del init de SQL Server (los otros 3 cargan sin log)
docker compose logs -f sqlserver-init      # Ctrl+C al ver "[init] completado OK"

# 5. Verificar
.\verificar.ps1              # infraestructura + conectividad + conteo global
.\verificar_dataset.ps1      # 8 tablas, FK, huérfanas, coherencia, consultas NL2SQL
```

### Reiniciar / recrear

```powershell
docker compose stop            # detener sin borrar datos
docker compose start           # reanudar

docker compose down            # eliminar contenedores y red (los datos se conservan)
docker compose down -v         # eliminar TAMBIÉN los datos -> fuerza re-inicialización
docker compose up -d           #   ... y volver a crear todo desde cero
```

Los scripts de `init/` **solo se ejecutan al crear el volumen**. Para aplicar un cambio
de esquema o de datos hay que `docker compose down -v` y `docker compose up -d`.

### Regenerar los datos

```powershell
python generar_seed.py         # reescribe los 4 *seed*.sql y los 4 *-volumen.sql.gz (semillas fijas, ~2 min)
docker compose down -v ; docker compose up -d
```

Editar el modelo en `generar_seed.py` (y los catálogos en `catalogo_volumen.py`),
**nunca** los `.sql` / `.sql.gz` generados (se sobrescriben). El dataset base no
depende del volumen: cambiar la sección 8 no altera ni una fila de las 2 233 base.

---

## Cómo comprobar los datos

```powershell
# conteo por tabla (PostgreSQL)
docker exec -e PGPASSWORD=Pg_Adm_9f3Kq2Lx7Tw nlqp-postgres `
  psql -U postgres -d testdb -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 1;"

# una consulta como testuser (MySQL)
docker exec nlqp-mysql mysql -u testuser -p'TestUser_2026_DB!' testdb `
  -e "SELECT status, COUNT(*) FROM orders GROUP BY status;"

# SQL Server
docker exec nlqp-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U testuser `
  -P 'TestUser_2026_DB!' -C -d testdb -Q "SELECT COUNT(*) FROM customers;"
```

O directamente `.\verificar_dataset.ps1`, que ejecuta una batería de consultas NL2SQL en
los cuatro motores y muestra los resultados lado a lado.

---

## Ejemplos de consultas

```sql
-- Clientes activos
SELECT COUNT(*) FROM customers WHERE status = 'ACTIVE';

-- Total de ventas y ticket promedio (excluyendo cancelados)
SELECT ROUND(SUM(total), 2) AS ventas, ROUND(AVG(total), 2) AS ticket
FROM orders WHERE status <> 'CANCELLED';

-- 10 productos más vendidos
SELECT p.name, SUM(oi.quantity) AS unidades
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
JOIN orders o   ON o.order_id = oi.order_id AND o.status <> 'CANCELLED'
GROUP BY p.name
ORDER BY unidades DESC
LIMIT 10;                      -- SQL Server: SELECT TOP 10 ... (sin LIMIT)

-- Clientes que nunca han hecho un pedido (LEFT JOIN ... IS NULL)
SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;

-- Cuánto ha gastado cada cliente (el ejemplo del enunciado)
SELECT c.first_name, c.last_name, COUNT(o.order_id) AS pedidos, COALESCE(SUM(o.total), 0) AS gastado
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY gastado DESC;

-- Ventas por año / mes (funciones de fecha)
SELECT EXTRACT(YEAR FROM order_date) AS anio,
       EXTRACT(MONTH FROM order_date) AS mes,
       ROUND(SUM(total), 2) AS ventas
FROM orders
GROUP BY EXTRACT(YEAR FROM order_date), EXTRACT(MONTH FROM order_date)
ORDER BY anio, mes;            -- SQL Server: YEAR(order_date), MONTH(order_date)

-- Ventas por categoría (múltiples JOIN + GROUP BY)
SELECT cat.name, ROUND(SUM(oi.subtotal), 2) AS ventas
FROM order_items oi
JOIN products   p   ON p.product_id = oi.product_id
JOIN categories cat ON cat.category_id = p.category_id
JOIN orders     o   ON o.order_id = oi.order_id AND o.status <> 'CANCELLED'
GROUP BY cat.name
ORDER BY ventas DESC;

-- Clientes con más de 3 pedidos (HAVING)
SELECT customer_id, COUNT(*) AS pedidos
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 3
ORDER BY pedidos DESC;

-- Pedidos pagados pero aún no enviados
SELECT o.order_id, o.status, o.total
FROM orders o
JOIN payments pm ON pm.order_id = o.order_id AND pm.status = 'COMPLETED'
LEFT JOIN shipments s ON s.order_id = o.order_id
WHERE o.status NOT IN ('SHIPPED', 'DELIVERED', 'CANCELLED')
  AND (s.shipment_id IS NULL OR s.status = 'PREPARING');

-- Productos con stock bajo
SELECT name, stock FROM products WHERE stock < 10 ORDER BY stock;

-- Valor total vendido por método de pago
SELECT payment_method, ROUND(SUM(amount), 2) AS total
FROM payments WHERE status = 'COMPLETED'
GROUP BY payment_method ORDER BY total DESC;
```

---

## Cadenas de conexión (aplicación externa en Windows)

Sustituir `TestUser_2026_DB!` por el valor real de `TEST_DB_PASSWORD`.

**SQL Server**
```
Server=localhost,1433;Database=testdb;User Id=testuser;Password=TestUser_2026_DB!;Encrypt=True;TrustServerCertificate=True;
```
**PostgreSQL**
```
postgresql://testuser:TestUser_2026_DB!@localhost:5432/testdb
```
**MySQL**
```
mysql://testuser:TestUser_2026_DB!@localhost:3306/testdb
```
**MariaDB**
```
mysql://testuser:TestUser_2026_DB!@localhost:3307/testdb
```

> La contraseña contiene `!`. En PowerShell entre comillas dobles hay que escaparlo
> (`` `! ``) o usar comillas simples; en `.env` y en las cadenas de conexión va literal.

---

## Consultar el dataset desde DBeaver

Una conexión por motor. **Database / Host / Port / User / Password** en cada caso:

| Motor | Tipo en DBeaver | Host | Port | Database | Usuario | Contraseña |
|---|---|---|---|---|---|---|
| PostgreSQL | PostgreSQL | `localhost` | `5432` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| MySQL | MySQL | `localhost` | `3306` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| MariaDB | MariaDB | `localhost` | `3307` | `testdb` | `testuser` | `TestUser_2026_DB!` |
| SQL Server | SQL Server | `localhost` | `1433` | `testdb` | `testuser` | `TestUser_2026_DB!` |

Notas:

- **SQL Server:** en la pestaña de la conexión, activar *Show all databases* y, en
  **Driver properties**, poner `encrypt = true` y `trustServerCertificate = true`
  (el contenedor usa un certificado autofirmado). Autenticación: *SQL Server
  Authentication*.
- **MySQL / MariaDB:** si DBeaver pide *Allow public key retrieval*, activarlo
  (`allowPublicKeyRetrieval = true`) — es una base local.
- **PostgreSQL:** sin ajustes especiales. SSL puede quedar en *disable*.
- DBeaver descarga el driver JDBC de cada motor la primera vez.
- Al abrir la conexión, el esquema con las 8 tablas está en
  `testdb` → `public` (PostgreSQL), `testdb` (MySQL/MariaDB) o `testdb` → `dbo`
  (SQL Server).

---

## Diferencias entre los cuatro motores

El **contenido lógico** (mismas filas, mismos valores, mismos totales) es idéntico. Lo
que cambia es lo propio de cada motor:

| Aspecto | PostgreSQL | MySQL / MariaDB | SQL Server |
|---|---|---|---|
| Identidad de PK | `GENERATED BY DEFAULT AS IDENTITY` | `AUTO_INCREMENT` | `IDENTITY(1,1)` |
| Texto | `VARCHAR(n)` | `VARCHAR(n)` utf8mb4 | `NVARCHAR(n)` |
| Booleanos (`active`, `is_default`) | `BOOLEAN` (`true`/`false`) | `BOOLEAN` = `TINYINT(1)` (`1`/`0`) | `BIT` (`1`/`0`) |
| Fecha/hora | `TIMESTAMPTZ` | `DATETIME` | `DATETIME2(0)` |
| Decimales | `NUMERIC(10,2)` / `(12,2)` | `DECIMAL(10,2)` / `(12,2)` | `DECIMAL(10,2)` / `(12,2)` |
| Límite de filas | `LIMIT n` | `LIMIT n` | `SELECT TOP n` |
| Funciones de fecha | `EXTRACT(YEAR FROM ...)` | `EXTRACT(...)` / `YEAR(...)` | `YEAR(...)`, `MONTH(...)`, `DATEPART(...)` |
| Concatenar | `||` o `CONCAT` | `CONCAT` | `+` o `CONCAT` |
| Índices de FK | explícitos (`CREATE INDEX`) | los crea InnoDB | explícitos (`CREATE INDEX`) |
| Esquema | `public` | la propia base | `dbo` |
| Init | 3 archivos en `init/postgres/` | 2 archivos en `init/{mysql,mariadb}/` | servicio `sqlserver-init` ejecuta `init/sqlserver/` |

`TIMESTAMPTZ` de PostgreSQL guarda zona horaria (los datos se cargan en UTC); los otros
motores guardan el instante sin zona. Para las consultas de este banco (todo en UTC) el
resultado es equivalente.

---

## Inicialización — mecanismo por motor

| Motor | Base de datos | Usuario `testuser` | Esquema + índices | Datos |
|---|---|---|---|---|
| PostgreSQL | var. `POSTGRES_DB` | `init/postgres/02-users.sql` (`CREATE ROLE` + `GRANT`) | `init/postgres/01-schema.sql` | `init/postgres/03-seed.sql` + `04-volumen.sql.gz` (COPY) |
| MySQL | var. `MYSQL_DATABASE` | la imagen (`MYSQL_USER`/`MYSQL_PASSWORD`) | `init/mysql/01-schema.sql` | `init/mysql/02-seed.sql` + `03-volumen.sql.gz` |
| MariaDB | var. `MARIADB_DATABASE` | la imagen (`MARIADB_USER`/`MARIADB_PASSWORD`) | `init/mariadb/01-schema.sql` | `init/mariadb/02-seed.sql` + `03-volumen.sql.gz` |
| SQL Server | `sqlserver-init` → `CREATE DATABASE` | `sqlserver-init` → `init/sqlserver/02-users.sql` (`CREATE LOGIN` + `CREATE USER` + `db_owner`) | `init/sqlserver/01-schema.sql` | `init/sqlserver/03-seed.sql` + `04-volumen.sql.gz` (si `orders` tiene ≤ 300 filas) |

Los `*-seed.sql` y `*-volumen.sql.gz` los genera `generar_seed.py`. Los `*-schema.sql` y `02-users.sql` se
mantienen a mano (requieren revisión humana: autenticación, permisos y validación SQL).

---

## Estructura

```
Bases de datos/
├── docker-compose.yml        # los 4 motores + servicio sqlserver-init
├── .env                      # credenciales locales (NO se versiona)
├── .env.example              # plantilla
├── .gitignore
├── generar_seed.py           # genera los 4 *-seed.sql (semilla 20260907) y el volumen
├── catalogo_volumen.py       # nombres, ciudades, formatos y catálogo para el volumen
├── verificar.ps1             # verificación de infraestructura + conectividad
├── verificar_dataset.ps1     # verificación profunda del dataset + consultas
├── README.md
└── init/
    ├── postgres/   01-schema.sql  02-users.sql  03-seed.sql  04-volumen.sql.gz*
    ├── mysql/      01-schema.sql  02-seed.sql  03-volumen.sql.gz*
    ├── mariadb/    01-schema.sql  02-seed.sql  03-volumen.sql.gz*
    └── sqlserver/  01-schema.sql  02-users.sql  03-seed.sql  04-volumen.sql.gz*
                    (* generados, no versionados)
```

---

## Seguridad

- `.env` está en `.gitignore`. No subir credenciales al repositorio.
- La aplicación se conecta con `testuser`, nunca con la cuenta administradora.
- No exponer estos contenedores fuera de la máquina de desarrollo (los puertos se
  publican en `localhost`).
- Solo se publican los 4 puertos de base de datos; ningún otro servicio.
- El dataset no contiene datos personales reales: los nombres son genéricos, los correos
  usan dominios `example.com/org/net` (RFC 2606, sin buzón real) y los teléfonos y
  direcciones son generados.
