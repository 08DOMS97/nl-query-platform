# ============================================================================
#  verificar_dataset.ps1  -  Verificacion PROFUNDA del dataset NL2SQL
# ----------------------------------------------------------------------------
#  Para los 4 motores:
#    1. las 8 tablas existen  ->  filas por tabla
#    2. claves foraneas declaradas (deben ser 8)
#    3. integridad referencial: 0 filas huerfanas en toda relacion
#    4. coherencia de importes: total = subtotal + tax + shipping_cost,
#       subtotal del pedido = suma de sus order_items, formula de linea
#    5. bateria de consultas NL2SQL (JOIN, LEFT JOIN, GROUP BY, HAVING,
#       agregaciones, funciones de fecha, multiples JOIN, subconsultas)
#
#  Uso:   .\verificar_dataset.ps1
#  Requiere los contenedores arriba (.\ ... docker compose up -d).
# ============================================================================

$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

$cfg = @{}
Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2; $cfg[$k.Trim()] = $v.Trim()
}
$U = $cfg['TEST_DB_USER']; $P = $cfg['TEST_DB_PASSWORD']; $DB = $cfg['TEST_DB_NAME']
$SA_PG = $cfg['POSTGRES_SUPERUSER_PASSWORD']

# --- runners: ejecutan SQL como testuser y devuelven texto plano ---
function PG($sql)   { docker exec -e PGPASSWORD=$P nlqp-postgres psql -U $U -d $DB -P pager=off -F ' | ' -A -c $sql 2>$null }
function MY($sql)   { docker exec nlqp-mysql   mysql   -u $U -p"$P" $DB -t -e $sql 2>$null }
function MA($sql)   { docker exec nlqp-mariadb mariadb -u $U -p"$P" $DB -t -e $sql 2>$null }
function MS($sql)   { docker exec nlqp-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U $U -P $P -C -d $DB -W -Q "SET NOCOUNT ON;$sql" 2>$null }

$TABLES = 'categories', 'customers', 'addresses', 'products', 'orders', 'order_items', 'payments', 'shipments'

# ---------------------------------------------------------------------------
# 1. Filas por tabla
# ---------------------------------------------------------------------------
Write-Host "`n==== 1. FILAS POR TABLA ====" -ForegroundColor Green
$std = ($TABLES | ForEach-Object { "SELECT '$_' AS tabla, COUNT(*) AS filas FROM $_" }) -join ' UNION ALL '
$mss = ($TABLES | ForEach-Object { "SELECT '$_' AS tabla, COUNT(*) AS filas FROM dbo.$_" }) -join ' UNION ALL '
Write-Host "`n-- PostgreSQL --"; PG "$std ORDER BY 1;"
Write-Host "`n-- MySQL --";      MY "$std ORDER BY 1;"
Write-Host "`n-- MariaDB --";    MA "$std ORDER BY 1;"
Write-Host "`n-- SQL Server --"; MS "$mss ORDER BY 1;"

# ---------------------------------------------------------------------------
# 2. Claves foraneas declaradas (esperado: 8 por motor)
# ---------------------------------------------------------------------------
Write-Host "`n==== 2. CLAVES FORANEAS (esperado 8) ====" -ForegroundColor Green
Write-Host ("  PostgreSQL : " + (PG "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';").Trim())
Write-Host ("  MySQL      : " + ((MY "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='$DB';") -join '' -replace '[^0-9]',''))
Write-Host ("  MariaDB    : " + ((MA "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='$DB';") -join '' -replace '[^0-9]',''))
Write-Host ("  SQL Server : " + (MS "SELECT COUNT(*) FROM sys.foreign_keys;").Trim())

# ---------------------------------------------------------------------------
# 3 + 4. Integridad y coherencia  (toda fila debe dar 0)
# ---------------------------------------------------------------------------
$checksStd = @"
SELECT 'huerfana orders->customers' AS check_name, COUNT(*) AS n FROM orders o LEFT JOIN customers c ON o.customer_id=c.customer_id WHERE c.customer_id IS NULL
UNION ALL SELECT 'huerfana order_items->orders', COUNT(*) FROM order_items oi LEFT JOIN orders o ON oi.order_id=o.order_id WHERE o.order_id IS NULL
UNION ALL SELECT 'huerfana order_items->products', COUNT(*) FROM order_items oi LEFT JOIN products p ON oi.product_id=p.product_id WHERE p.product_id IS NULL
UNION ALL SELECT 'huerfana products->categories', COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id=c.category_id WHERE c.category_id IS NULL
UNION ALL SELECT 'huerfana payments->orders', COUNT(*) FROM payments pm LEFT JOIN orders o ON pm.order_id=o.order_id WHERE o.order_id IS NULL
UNION ALL SELECT 'huerfana shipments->orders', COUNT(*) FROM shipments s LEFT JOIN orders o ON s.order_id=o.order_id WHERE o.order_id IS NULL
UNION ALL SELECT 'huerfana addresses->customers', COUNT(*) FROM addresses a LEFT JOIN customers c ON a.customer_id=c.customer_id WHERE c.customer_id IS NULL
UNION ALL SELECT 'huerfana orders->addresses', COUNT(*) FROM orders o LEFT JOIN addresses a ON o.shipping_address_id=a.address_id WHERE o.shipping_address_id IS NOT NULL AND a.address_id IS NULL
UNION ALL SELECT 'total <> subtotal+tax+ship', COUNT(*) FROM orders WHERE total <> ROUND(subtotal+tax+shipping_cost,2)
UNION ALL SELECT 'subtotal pedido <> suma items', COUNT(*) FROM orders o WHERE o.subtotal <> (SELECT COALESCE(SUM(oi.subtotal),0) FROM order_items oi WHERE oi.order_id=o.order_id)
UNION ALL SELECT 'linea <> qty*precio-desc', COUNT(*) FROM order_items WHERE subtotal <> ROUND(quantity*unit_price-discount,2)
UNION ALL SELECT 'pedidos sin items', COUNT(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=o.order_id)
UNION ALL SELECT 'entrega antes de envio', COUNT(*) FROM shipments WHERE delivery_date IS NOT NULL AND shipment_date IS NOT NULL AND delivery_date < shipment_date
"@
$checksMss = $checksStd -replace '\bFROM (orders|customers|addresses|products|order_items|payments|shipments)\b', 'FROM dbo.$1'

Write-Host "`n==== 3+4. INTEGRIDAD Y COHERENCIA (todo debe ser 0) ====" -ForegroundColor Green
Write-Host "`n-- PostgreSQL --"; PG "$checksStd;"
Write-Host "`n-- MySQL --";      MY "$checksStd;"
Write-Host "`n-- MariaDB --";    MA "$checksStd;"
Write-Host "`n-- SQL Server --"; MS "$checksMss;"

# ---------------------------------------------------------------------------
# 5. Bateria de consultas NL2SQL
# ---------------------------------------------------------------------------
Write-Host "`n==== 5. CONSULTAS NL2SQL ====" -ForegroundColor Green

$batStd = @"
SELECT '1. clientes / activos' AS consulta, COUNT(*) AS total,
       SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS activos FROM customers;
SELECT '3. pedidos 2025' AS consulta, COUNT(*) AS r FROM orders WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';
SELECT '4/5. ventas totales / ticket (sin CANCELLED)' AS consulta,
       ROUND(SUM(total),2) AS ventas, ROUND(AVG(total),2) AS ticket FROM orders WHERE status <> 'CANCELLED';
SELECT '6. top 5 productos por unidades' AS producto, SUM(oi.quantity) AS unidades
  FROM order_items oi JOIN orders o ON o.order_id=oi.order_id AND o.status<>'CANCELLED'
  GROUP BY oi.product_id ORDER BY unidades DESC LIMIT 5;
SELECT '9. clientes sin pedidos' AS consulta, COUNT(*) AS r
  FROM customers c LEFT JOIN orders o ON o.customer_id=c.customer_id WHERE o.order_id IS NULL;
SELECT '10. productos nunca vendidos' AS consulta, COUNT(*) AS r
  FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id=p.product_id);
SELECT '14. ventas por categoria (top 3)' AS categoria, ROUND(SUM(oi.subtotal),2) AS ventas
  FROM order_items oi JOIN products p ON p.product_id=oi.product_id
  JOIN categories c ON c.category_id=p.category_id
  JOIN orders o ON o.order_id=oi.order_id AND o.status<>'CANCELLED'
  GROUP BY c.name ORDER BY ventas DESC LIMIT 3;
SELECT '15. cliente que mas ha gastado' AS cliente,
       CONCAT(c.first_name,' ',c.last_name) AS nombre, ROUND(SUM(o.total),2) AS gastado
  FROM customers c JOIN orders o ON o.customer_id=c.customer_id AND o.status<>'CANCELLED'
  GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY gastado DESC LIMIT 1;
SELECT '16. clientes con mas de 3 pedidos' AS consulta, COUNT(*) AS r
  FROM (SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 3) x;
SELECT '19. pedidos con pago PENDING' AS consulta, COUNT(DISTINCT order_id) AS r FROM payments WHERE status='PENDING';
SELECT '23. ciudad con mas clientes' AS ciudad, city AS nombre, COUNT(*) AS n
  FROM customers GROUP BY city ORDER BY n DESC LIMIT 3;
SELECT '25. productos stock < 10 / agotados' AS consulta,
       SUM(CASE WHEN stock < 10 THEN 1 ELSE 0 END) AS bajo10,
       SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS agotados FROM products;
SELECT '26. ventas por metodo de pago' AS metodo, payment_method AS nombre, ROUND(SUM(amount),2) AS v
  FROM payments WHERE status='COMPLETED' GROUP BY payment_method ORDER BY v DESC;
SELECT '27. % pedidos cancelados' AS consulta,
       ROUND(100.0*SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)/COUNT(*),2) AS pct FROM orders;
SELECT '13. ventas por anio' AS anio,
       EXTRACT(YEAR FROM order_date) AS y, COUNT(*) AS pedidos, ROUND(SUM(total),2) AS ventas
  FROM orders GROUP BY EXTRACT(YEAR FROM order_date) ORDER BY y;
"@

$batMss = @"
SELECT '1. clientes / activos' AS consulta, COUNT(*) AS r1, SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS r2 FROM dbo.customers;
SELECT '3. pedidos 2025' AS consulta, COUNT(*) AS r FROM dbo.orders WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';
SELECT '4/5. ventas / ticket (sin CANCELLED)' AS consulta, ROUND(SUM(total),2) AS ventas, ROUND(AVG(total),2) AS ticket FROM dbo.orders WHERE status <> 'CANCELLED';
SELECT TOP 5 '6. top productos' AS producto, oi.product_id, SUM(oi.quantity) AS unidades
  FROM dbo.order_items oi JOIN dbo.orders o ON o.order_id=oi.order_id AND o.status<>'CANCELLED'
  GROUP BY oi.product_id ORDER BY unidades DESC;
SELECT '9. clientes sin pedidos' AS consulta, COUNT(*) AS r
  FROM dbo.customers c LEFT JOIN dbo.orders o ON o.customer_id=c.customer_id WHERE o.order_id IS NULL;
SELECT '10. productos nunca vendidos' AS consulta, COUNT(*) AS r
  FROM dbo.products p WHERE NOT EXISTS (SELECT 1 FROM dbo.order_items oi WHERE oi.product_id=p.product_id);
SELECT TOP 3 '14. ventas por categoria' AS categoria, c.name, ROUND(SUM(oi.subtotal),2) AS ventas
  FROM dbo.order_items oi JOIN dbo.products p ON p.product_id=oi.product_id
  JOIN dbo.categories c ON c.category_id=p.category_id
  JOIN dbo.orders o ON o.order_id=oi.order_id AND o.status<>'CANCELLED'
  GROUP BY c.name ORDER BY ventas DESC;
SELECT TOP 1 '15. cliente que mas gasta' AS cliente, c.first_name+' '+c.last_name AS nombre, ROUND(SUM(o.total),2) AS gastado
  FROM dbo.customers c JOIN dbo.orders o ON o.customer_id=c.customer_id AND o.status<>'CANCELLED'
  GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY gastado DESC;
SELECT '16. clientes con mas de 3 pedidos' AS consulta, COUNT(*) AS r
  FROM (SELECT customer_id FROM dbo.orders GROUP BY customer_id HAVING COUNT(*) > 3) x;
SELECT '19. pedidos con pago PENDING' AS consulta, COUNT(DISTINCT order_id) AS r FROM dbo.payments WHERE status='PENDING';
SELECT TOP 3 '23. ciudad con mas clientes' AS ciudad, city, COUNT(*) AS n FROM dbo.customers GROUP BY city ORDER BY n DESC;
SELECT '25. stock<10 / agotados' AS consulta, SUM(CASE WHEN stock<10 THEN 1 ELSE 0 END) AS bajo10, SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) AS agotados FROM dbo.products;
SELECT '26. ventas por metodo' AS metodo, payment_method, ROUND(SUM(amount),2) AS v FROM dbo.payments WHERE status='COMPLETED' GROUP BY payment_method ORDER BY v DESC;
SELECT '27. pct cancelados' AS consulta, ROUND(100.0*SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)/COUNT(*),2) AS pct FROM dbo.orders;
SELECT '13. ventas por anio' AS anio, YEAR(order_date) AS y, COUNT(*) AS pedidos, ROUND(SUM(total),2) AS ventas
  FROM dbo.orders GROUP BY YEAR(order_date) ORDER BY y;
"@

Write-Host "`n---------- PostgreSQL ----------" -ForegroundColor Cyan; PG $batStd
Write-Host "`n---------- MySQL ----------"      -ForegroundColor Cyan; MY $batStd
Write-Host "`n---------- MariaDB ----------"    -ForegroundColor Cyan; MA $batStd
Write-Host "`n---------- SQL Server ----------" -ForegroundColor Cyan; MS $batMss

Write-Host "`nFIN. Revisar que TODOS los checks de la seccion 3+4 sean 0 y que los" -ForegroundColor Green
Write-Host "resultados de la seccion 5 coincidan entre los 4 motores." -ForegroundColor Green
