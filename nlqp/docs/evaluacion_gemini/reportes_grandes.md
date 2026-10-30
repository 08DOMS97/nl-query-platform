# Reportes grandes — 29/10/2026

SQL generado por Gemini para cada pregunta y motor, tal como se ejecutó.

## R1. Listado de todas las líneas de pedido con el número de pedido, la fecha del pedido, el nombre y apellido del cliente, el nombre del producto, su categoría, la cantidad y el subtotal

### postgres — 631,630 filas

```sql
SELECT 
    o.order_id,
    o.order_date,
    c.first_name,
    c.last_name,
    p.name AS product_name,
    cat.name AS category_name,
    oi.quantity,
    oi.subtotal
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories cat ON p.category_id = cat.category_id
```

### mysql — 631,630 filas

```sql
SELECT 
    oi.order_item_id,
    o.order_id,
    o.order_date,
    c.first_name,
    c.last_name,
    p.name AS product_name,
    cat.name AS category_name,
    oi.quantity,
    oi.subtotal
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories cat ON p.category_id = cat.category_id
```

### mariadb — 631,630 filas

```sql
SELECT 
    oi.order_id,
    o.order_date,
    c.first_name,
    c.last_name,
    p.name AS product_name,
    cat.name AS category_name,
    oi.quantity,
    oi.subtotal
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories cat ON p.category_id = cat.category_id
```

### mssql — 631,630 filas

```sql
SELECT 
    oi.order_id,
    o.order_date,
    c.first_name,
    c.last_name,
    p.name AS product_name,
    cat.name AS category_name,
    oi.quantity,
    oi.subtotal
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories cat ON p.category_id = cat.category_id
```

## R2. Todos los pedidos con su número, fecha, nombre y apellido del cliente, estado y total

### postgres — 250,000 filas

```sql
SELECT o.order_id, o.order_date, c.first_name, c.last_name, o.status, o.total FROM orders o JOIN customers c ON o.customer_id = c.customer_id;
```

### mysql — 250,000 filas

```sql
SELECT o.order_id, o.order_date, c.first_name, c.last_name, o.status, o.total FROM orders o JOIN customers c ON o.customer_id = c.customer_id
```

### mariadb — 250,000 filas

```sql
SELECT 
    o.order_id,
    o.order_date,
    c.first_name,
    c.last_name,
    o.status,
    o.total
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
```

### mssql — 250,000 filas

```sql
SELECT 
    o.order_id, 
    o.order_date, 
    c.first_name, 
    c.last_name, 
    o.status, 
    o.total 
FROM orders o 
INNER JOIN customers c ON o.customer_id = c.customer_id
```

## R3. Para cada cliente que haya comprado, su nombre y apellido, el total gastado, la cantidad de pedidos y la fecha de su última compra, sin contar los pedidos cancelados

### postgres — 30,897 filas

```sql
SELECT 
    c.first_name,
    c.last_name,
    SUM(o.total) AS total_gastado,
    COUNT(o.order_id) AS cantidad_pedidos,
    MAX(o.order_date) AS fecha_ultima_compra
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status != 'CANCELLED'
GROUP BY c.customer_id, c.first_name, c.last_name
```

### mysql — 30,897 filas

```sql
SELECT c.customer_id, c.first_name, c.last_name, SUM(o.total) AS total_gastado, COUNT(o.order_id) AS cantidad_pedidos, MAX(o.order_date) AS fecha_ultima_compra FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name
```

### mariadb — 30,897 filas

```sql
SELECT 
    c.first_name, 
    c.last_name, 
    SUM(o.total) AS total_gastado, 
    COUNT(o.order_id) AS cantidad_pedidos, 
    MAX(o.order_date) AS fecha_ultima_compra
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status != 'CANCELLED'
GROUP BY c.customer_id, c.first_name, c.last_name
```

### mssql — 30,897 filas

```sql
SELECT 
    c.first_name,
    c.last_name,
    SUM(o.total) AS total_gastado,
    COUNT(o.order_id) AS cantidad_pedidos,
    MAX(o.order_date) AS fecha_ultima_compra
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status <> 'CANCELLED'
GROUP BY c.customer_id, c.first_name, c.last_name
```

## R4. Unidades vendidas y monto vendido por producto y por mes durante 2025, con la categoría del producto, sin contar los pedidos cancelados

### postgres — 16,082 filas

```sql
SELECT 
    p.product_id,
    p.name AS product_name,
    c.name AS category_name,
    EXTRACT(YEAR FROM o.order_date) AS order_year,
    EXTRACT(MONTH FROM o.order_date) AS order_month,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.subtotal) AS total_amount_sold
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.order_date >= '2025-01-01' 
  AND o.order_date < '2026-01-01'
  AND o.status != 'CANCELLED'
GROUP BY 
    p.product_id,
    p.name,
    c.name,
    EXTRACT(YEAR FROM o.order_date),
    EXTRACT(MONTH FROM o.order_date)
ORDER BY 
    order_month,
    p.product_id
```

### mysql — 16,082 filas

```sql
SELECT 
    p.product_id,
    p.name AS product_name,
    c.name AS category_name,
    MONTH(o.order_date) AS mes,
    SUM(oi.quantity) AS unidades_vendidas,
    SUM(oi.subtotal) AS monto_vendido
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.order_date >= '2025-01-01 00:00:00' 
  AND o.order_date < '2026-01-01 00:00:00'
  AND o.status != 'CANCELLED'
GROUP BY 
    p.product_id,
    p.name,
    c.name,
    MONTH(o.order_date)
```

### mariadb — 16,082 filas

```sql
SELECT 
    p.product_id,
    p.name AS product_name,
    c.name AS category_name,
    YEAR(o.order_date) AS year,
    MONTH(o.order_date) AS month,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.subtotal) AS total_amount_sold
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.order_date >= '2025-01-01' 
  AND o.order_date < '2026-01-01'
  AND o.status != 'CANCELLED'
GROUP BY 
    p.product_id, 
    p.name, 
    c.name, 
    YEAR(o.order_date), 
    MONTH(o.order_date)
```

### mssql — 16,082 filas

```sql
SELECT 
    p.product_id,
    p.name AS product_name,
    c.name AS category_name,
    YEAR(o.order_date) AS order_year,
    MONTH(o.order_date) AS order_month,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.subtotal) AS total_amount_sold
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.order_date >= '2025-01-01' AND o.order_date < '2026-01-01'
  AND o.status <> 'CANCELLED'
GROUP BY 
    p.product_id,
    p.name,
    c.name,
    YEAR(o.order_date),
    MONTH(o.order_date)
```

## R5. Todos los pagos completados con el número de pedido, el nombre y apellido del cliente, el método de pago, el monto y la fecha de pago

### postgres — 215,962 filas

```sql
SELECT p.order_id, c.first_name, c.last_name, p.payment_method, p.amount, p.payment_date FROM payments p JOIN orders o ON p.order_id = o.order_id JOIN customers c ON o.customer_id = c.customer_id WHERE p.status = 'COMPLETED'
```

### mysql — 215,962 filas

```sql
SELECT 
    p.order_id,
    c.first_name,
    c.last_name,
    p.payment_method,
    p.amount,
    p.payment_date
FROM payments p
JOIN orders o ON p.order_id = o.order_id
JOIN customers c ON o.customer_id = c.customer_id
WHERE p.status = 'COMPLETED'
```

### mariadb — 215,962 filas

```sql
SELECT 
    p.order_id,
    c.first_name,
    c.last_name,
    p.payment_method,
    p.amount,
    p.payment_date
FROM payments p
INNER JOIN orders o ON p.order_id = o.order_id
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE p.status = 'COMPLETED'
```

### mssql — 215,962 filas

```sql
SELECT 
    p.order_id,
    c.first_name,
    c.last_name,
    p.payment_method,
    p.amount,
    p.payment_date
FROM payments p
INNER JOIN orders o ON p.order_id = o.order_id
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE p.status = 'COMPLETED'
```

# Reportes elaborados — 29/10/2026

SQL generado por Gemini, con el veredicto contra la referencia escrita a mano.

## E1. Para cada categoría y cada mes de 2025: el monto vendido, la cantidad de pedidos, el ticket promedio (monto vendido entre cantidad de pedidos), el porcentaje que representa la categoría en las ventas de ese mes y la variación porcentual del monto respecto al mes anterior de la misma categoría, sin contar los pedidos cancelados

### postgres — 172 filas · columnas_extra

```sql
WITH monthly_category_sales AS (
    SELECT 
        c.category_id,
        c.name AS category_name,
        EXTRACT(MONTH FROM o.order_date) AS mes,
        SUM(oi.subtotal) AS monto_vendido,
        COUNT(DISTINCT o.order_id) AS cantidad_pedidos
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    WHERE o.order_date >= '2025-01-01' 
      AND o.order_date < '2026-01-01'
      AND o.status != 'CANCELLED'
    GROUP BY c.category_id, c.name, EXTRACT(MONTH FROM o.order_date)
)
SELECT 
    category_id,
    category_name,
    mes,
    monto_vendido,
    cantidad_pedidos,
    monto_vendido / NULLIF(cantidad_pedidos, 0) AS ticket_promedio,
    (monto_vendido / NULLIF(SUM(monto_vendido) OVER (PARTITION BY mes), 0)) * 100 AS porcentaje_del_mes,
    ((monto_vendido - LAG(monto_vendido) OVER (PARTITION BY category_id ORDER BY mes)) / NULLIF(LAG(monto_vendido) OVER (PARTITION BY category_id ORDER BY mes), 0)) * 100 AS variacion_pct_mes_anterior
FROM monthly_category_sales
ORDER BY category_id, mes
```

### mysql — 172 filas · columnas_extra

```sql
WITH monthly_category_sales AS (
    SELECT 
        c.category_id,
        c.name AS category_name,
        MONTH(o.order_date) AS order_month,
        SUM(oi.subtotal) AS total_sales,
        COUNT(DISTINCT o.order_id) AS total_orders
    FROM categories c
    JOIN products p ON c.category_id = p.category_id
    JOIN order_items oi ON p.product_id = oi.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.order_date >= '2025-01-01 00:00:00' 
      AND o.order_date < '2026-01-01 00:00:00'
      AND o.status != 'CANCELLED'
    GROUP BY c.category_id, c.name, MONTH(o.order_date)
)
SELECT 
    category_id,
    category_name,
    order_month,
    total_sales,
    total_orders,
    total_sales / total_orders AS average_ticket,
    (total_sales / SUM(total_sales) OVER (PARTITION BY order_month)) * 100 AS category_month_percentage,
    ((total_sales - LAG(total_sales) OVER (PARTITION BY category_id ORDER BY order_month)) 
        / LAG(total_sales) OVER (PARTITION BY category_id ORDER BY order_month)) * 100 AS mom_sales_growth_percentage
FROM monthly_category_sales
ORDER BY category_id, order_month
```

### mariadb — 172 filas · columnas_extra

```sql
WITH monthly_category_sales AS (
    SELECT 
        c.category_id,
        c.name AS category_name,
        MONTH(o.order_date) AS order_month,
        SUM(oi.subtotal) AS total_sales,
        COUNT(DISTINCT o.order_id) AS order_count
    FROM categories c
    JOIN products p ON c.category_id = p.category_id
    JOIN order_items oi ON p.product_id = oi.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.status != 'CANCELLED'
      AND o.order_date >= '2025-01-01'
      AND o.order_date < '2026-01-01'
    GROUP BY c.category_id, c.name, MONTH(o.order_date)
)
SELECT 
    category_id,
    category_name,
    order_month,
    total_sales,
    order_count,
    total_sales / order_count AS average_ticket,
    (total_sales / SUM(total_sales) OVER (PARTITION BY order_month)) * 100 AS pct_monthly_total,
    ((total_sales - LAG(total_sales) OVER (PARTITION BY category_id ORDER BY order_month)) / LAG(total_sales) OVER (PARTITION BY category_id ORDER BY order_month)) * 100 AS pct_change_prev_month
FROM monthly_category_sales
ORDER BY category_id, order_month
```

### mssql — 172 filas · columnas_extra

```sql
WITH monthly_category_sales AS (
    SELECT 
        c.category_id,
        c.name AS category_name,
        MONTH(o.order_date) AS order_month,
        SUM(oi.subtotal) AS total_amount,
        COUNT(DISTINCT o.order_id) AS total_orders
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    WHERE o.status <> 'CANCELLED'
      AND o.order_date >= '2025-01-01'
      AND o.order_date < '2026-01-01'
    GROUP BY 
        c.category_id,
        c.name,
        MONTH(o.order_date)
)
SELECT 
    category_id,
    category_name,
    order_month,
    total_amount,
    total_orders,
    CAST(total_amount * 1.0 / NULLIF(total_orders, 0) AS decimal(18, 2)) AS average_ticket,
    CAST(total_amount * 100.0 / NULLIF(SUM(total_amount) OVER (PARTITION BY order_month), 0) AS decimal(18, 2)) AS monthly_category_percentage,
    CAST((total_amount - LAG(total_amount) OVER (PARTITION BY category_id ORDER BY order_month)) * 100.0 
        / NULLIF(LAG(total_amount) OVER (PARTITION BY category_id ORDER BY order_month), 0) AS decimal(18, 2)) AS pct_change_vs_prev_month
FROM monthly_category_sales
```

## E2. Para cada cliente con compras: nombre, apellido, país, gasto total, cantidad de pedidos, fecha de la primera y de la última compra, la categoría en la que más ha gastado, el método de pago que más ha usado en sus pagos completados y el lugar que ocupa en el ranking de gasto de su país (1 = el que más gastó; los empates comparten lugar), sin contar los pedidos cancelados. Si hay empate en la categoría o en el método de pago, el primero en orden alfabético

### postgres — 30,897 filas · distinto

```sql
WITH customer_orders AS (
    SELECT 
        o.customer_id,
        SUM(o.total) AS total_spent,
        COUNT(o.order_id) AS order_count,
        MIN(o.order_date) AS first_order_date,
        MAX(o.order_date) AS last_order_date
    FROM orders o
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id
),
customer_categories AS (
    SELECT 
        o.customer_id,
        c.name AS category_name,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY SUM(oi.subtotal) DESC, c.name ASC
        ) AS rn
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id, c.name
),
top_category AS (
    SELECT customer_id, category_name
    FROM customer_categories
    WHERE rn = 1
),
customer_payments AS (
    SELECT 
        o.customer_id,
        p.payment_method,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY COUNT(p.payment_id) DESC, p.payment_method ASC
        ) AS rn
    FROM orders o
    JOIN payments p ON o.order_id = p.order_id
    WHERE o.status != 'CANCELLED'
      AND p.status = 'COMPLETED'
    GROUP BY o.customer_id, p.payment_method
),
top_payment AS (
    SELECT customer_id, payment_method
    FROM customer_payments
    WHERE rn = 1
)
SELECT 
    cu.first_name,
    cu.last_name,
    cu.country,
    co.total_spent,
    co.order_count,
    co.first_order_date,
    co.last_order_date,
    tc.category_name AS top_category,
    tp.payment_method AS top_payment_method,
    DENSE_RANK() OVER (
        PARTITION BY cu.country 
        ORDER BY co.total_spent DESC
    ) AS country_spending_rank
FROM customers cu
JOIN customer_orders co ON cu.customer_id = co.customer_id
LEFT JOIN top_category tc ON cu.customer_id = tc.customer_id
LEFT JOIN top_payment tp ON cu.customer_id = tp.customer_id
```

### mysql — 30,897 filas · distinto

```sql
WITH customer_orders AS (
    SELECT 
        o.customer_id,
        SUM(o.total) AS gasto_total,
        COUNT(o.order_id) AS cantidad_pedidos,
        MIN(o.order_date) AS primera_compra,
        MAX(o.order_date) AS ultima_compra
    FROM orders o
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id
),
category_spend AS (
    SELECT 
        o.customer_id,
        c.name AS category_name,
        SUM(oi.subtotal) AS total_categoria,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY SUM(oi.subtotal) DESC, c.name ASC
        ) AS rn_cat
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id, c.category_id, c.name
),
payment_usage AS (
    SELECT 
        o.customer_id,
        p.payment_method,
        COUNT(p.payment_id) AS total_usos,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY COUNT(p.payment_id) DESC, p.payment_method ASC
        ) AS rn_pay
    FROM orders o
    JOIN payments p ON o.order_id = p.order_id
    WHERE o.status != 'CANCELLED'
      AND p.status = 'COMPLETED'
    GROUP BY o.customer_id, p.payment_method
)
SELECT 
    cu.first_name,
    cu.last_name,
    cu.country,
    co.gasto_total,
    co.cantidad_pedidos,
    co.primera_compra,
    co.ultima_compra,
    cs.category_name AS categoria_mas_gastada,
    pu.payment_method AS metodo_pago_mas_usado,
    DENSE_RANK() OVER (
        PARTITION BY cu.country 
        ORDER BY co.gasto_total DESC
    ) AS ranking_gasto_pais
FROM customer_orders co
JOIN customers cu ON co.customer_id = cu.customer_id
LEFT JOIN category_spend cs ON co.customer_id = cs.customer_id AND cs.rn_cat = 1
LEFT JOIN payment_usage pu ON co.customer_id = pu.customer_id AND pu.rn_pay = 1
```

### mariadb — 30,897 filas · distinto

```sql
WITH customer_orders AS (
    SELECT 
        o.customer_id,
        SUM(o.total) AS total_spent,
        COUNT(o.order_id) AS total_orders,
        MIN(o.order_date) AS first_order_date,
        MAX(o.order_date) AS last_order_date
    FROM orders o
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id
),
customer_category_spent AS (
    SELECT 
        o.customer_id,
        c.name AS category_name,
        SUM(oi.subtotal) AS spent,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY SUM(oi.subtotal) DESC, c.name ASC
        ) AS rn
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    WHERE o.status != 'CANCELLED'
    GROUP BY o.customer_id, c.name
),
top_category AS (
    SELECT customer_id, category_name
    FROM customer_category_spent
    WHERE rn = 1
),
customer_payment_method AS (
    SELECT 
        o.customer_id,
        p.payment_method,
        COUNT(*) AS usage_count,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY COUNT(*) DESC, p.payment_method ASC
        ) AS rn
    FROM orders o
    JOIN payments p ON o.order_id = p.order_id
    WHERE o.status != 'CANCELLED'
      AND p.status = 'COMPLETED'
    GROUP BY o.customer_id, p.payment_method
),
top_payment AS (
    SELECT customer_id, payment_method
    FROM customer_payment_method
    WHERE rn = 1
)
SELECT 
    cu.first_name,
    cu.last_name,
    cu.country,
    co.total_spent,
    co.total_orders,
    co.first_order_date,
    co.last_order_date,
    tc.category_name AS top_category,
    tp.payment_method AS top_payment_method,
    DENSE_RANK() OVER (
        PARTITION BY cu.country 
        ORDER BY co.total_spent DESC
    ) AS country_spending_rank
FROM customer_orders co
JOIN customers cu ON co.customer_id = cu.customer_id
LEFT JOIN top_category tc ON co.customer_id = tc.customer_id
LEFT JOIN top_payment tp ON co.customer_id = tp.customer_id
```

### mssql — 30,897 filas · distinto

```sql
WITH customer_orders AS (
    SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.country,
        SUM(o.total) AS total_spent,
        COUNT(o.order_id) AS total_orders,
        MIN(o.order_date) AS first_order_date,
        MAX(o.order_date) AS last_order_date
    FROM customers c
    JOIN orders o ON c.customer_id = o.customer_id
    WHERE o.status <> 'CANCELLED'
    GROUP BY c.customer_id, c.first_name, c.last_name, c.country
),
customer_categories AS (
    SELECT 
        o.customer_id,
        cat.name AS category_name,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY SUM(oi.subtotal) DESC, cat.name ASC
        ) AS rn
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories cat ON p.category_id = cat.category_id
    WHERE o.status <> 'CANCELLED'
    GROUP BY o.customer_id, cat.category_id, cat.name
),
customer_payments AS (
    SELECT 
        o.customer_id,
        p.payment_method,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id 
            ORDER BY COUNT(p.payment_id) DESC, p.payment_method ASC
        ) AS rn
    FROM orders o
    JOIN payments p ON o.order_id = p.order_id
    WHERE o.status <> 'CANCELLED' 
      AND p.status = 'COMPLETED'
    GROUP BY o.customer_id, p.payment_method
)
SELECT 
    co.first_name,
    co.last_name,
    co.country,
    co.total_spent,
    co.total_orders,
    co.first_order_date,
    co.last_order_date,
    cc.category_name AS top_category,
    cp.payment_method AS top_payment_method,
    DENSE_RANK() OVER (
        PARTITION BY co.country 
        ORDER BY co.total_spent DESC
    ) AS country_spending_rank
FROM customer_orders co
LEFT JOIN customer_categories cc ON co.customer_id = cc.customer_id AND cc.rn = 1
LEFT JOIN customer_payments cp ON co.customer_id = cp.customer_id AND cp.rn = 1
```

## E3. Para los clientes registrados en 2024, por mes de registro: cuántos se registraron, cuántos hicieron al menos una compra no cancelada en los 30 días siguientes a su fecha de registro y qué porcentaje representan

### postgres — 12 filas · exacto

```sql
SELECT 
    EXTRACT(MONTH FROM c.registration_date) AS mes_registro,
    COUNT(*) AS total_registrados,
    COUNT(CASE WHEN o.order_id IS NOT NULL THEN 1 END) AS clientes_con_compra_30d,
    ROUND(COUNT(CASE WHEN o.order_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) AS porcentaje
FROM customers c
LEFT JOIN LATERAL (
    SELECT o.order_id
    FROM orders o
    WHERE o.customer_id = c.customer_id
      AND o.status != 'CANCELLED'
      AND o.order_date >= c.registration_date
      AND o.order_date < c.registration_date + INTERVAL '30 days'
    LIMIT 1
) o ON TRUE
WHERE c.registration_date >= '2024-01-01' 
  AND c.registration_date < '2025-01-01'
GROUP BY EXTRACT(MONTH FROM c.registration_date)
ORDER BY mes_registro;
```

### mysql — 12 filas · distinto

```sql
SELECT 
    MONTH(c.registration_date) AS mes,
    COUNT(*) AS total_registrados,
    COUNT(CASE WHEN o.customer_id IS NOT NULL THEN 1 END) AS clientes_con_compra_30d,
    (COUNT(CASE WHEN o.customer_id IS NOT NULL THEN 1 END) / COUNT(*)) * 100 AS porcentaje
FROM customers c
LEFT JOIN (
    SELECT DISTINCT customer_id, order_date
    FROM orders
    WHERE status != 'CANCELLED'
) o ON c.customer_id = o.customer_id 
    AND o.order_date >= c.registration_date 
    AND o.order_date <= DATE_ADD(c.registration_date, INTERVAL 30 DAY)
WHERE c.registration_date >= '2024-01-01' 
  AND c.registration_date < '2025-01-01'
GROUP BY MONTH(c.registration_date)
ORDER BY mes
```

### mariadb — 12 filas · exacto

```sql
SELECT 
    MONTH(c.registration_date) AS mes,
    COUNT(c.customer_id) AS total_registrados,
    COUNT(CASE WHEN o.order_id IS NOT NULL THEN 1 END) AS clientes_con_compra,
    (COUNT(CASE WHEN o.order_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(c.customer_id)) AS porcentaje
FROM customers c
LEFT JOIN (
    SELECT DISTINCT customer_id
    FROM orders
    WHERE status != 'CANCELLED'
) o_all ON 1 = 0
LEFT JOIN customers c2 ON c2.customer_id = c.customer_id
LEFT JOIN (
    SELECT o.customer_id, o.order_id
    FROM orders o
    JOIN customers c_sub ON o.customer_id = c_sub.customer_id
    WHERE c_sub.registration_date >= '2024-01-01' 
      AND c_sub.registration_date < '2025-01-01'
      AND o.status != 'CANCELLED'
      AND o.order_date >= c_sub.registration_date
      AND o.order_date <= DATE_ADD(c_sub.registration_date, INTERVAL 30 DAY)
    GROUP BY o.customer_id
) o ON c.customer_id = o.customer_id
WHERE c.registration_date >= '2024-01-01' 
  AND c.registration_date < '2025-01-01'
GROUP BY MONTH(c.registration_date)
ORDER BY mes
```

### mssql — 12 filas · exacto

```sql
WITH RegisteredCustomers AS (
    SELECT 
        c.customer_id,
        c.registration_date,
        MONTH(c.registration_date) AS registration_month,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM orders o 
                WHERE o.customer_id = c.customer_id 
                  AND o.status <> 'CANCELLED'
                  AND o.order_date >= CAST(c.registration_date AS datetime2)
                  AND o.order_date <= DATEADD(day, 30, CAST(c.registration_date AS datetime2))
            ) THEN 1 
            ELSE 0 
        END AS bought_within_30_days
    FROM customers c
    WHERE c.registration_date >= '2024-01-01' 
      AND c.registration_date < '2025-01-01'
)
SELECT 
    registration_month,
    COUNT(*) AS total_registered,
    SUM(bought_within_30_days) AS total_bought_within_30_days,
    CAST(SUM(bought_within_30_days) * 100.0 / COUNT(*) AS decimal(5, 2)) AS percentage
FROM RegisteredCustomers
GROUP BY registration_month
ORDER BY registration_month
```
