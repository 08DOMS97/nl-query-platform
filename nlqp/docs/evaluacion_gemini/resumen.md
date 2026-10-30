# Resultados de la evaluación con Gemini

Generado por `scripts/evaluacion_gemini.mjs --resumen` a partir de `resultados.jsonl`. No editar a mano.

- Modelo: gemini-3.8-flash
- Período de la corrida: 2026-10-27 a 2026-10-30
- Casos: 400 (200 originales, 200 paráfrasis)
- Costo total: $0.8132 · promedio por llamada $0.0020

## Precisión (execution accuracy)

"Exacto": mismas filas que la referencia. "Columnas extra": mismas filas en las columnas de la referencia, con columnas adicionales. "Empate posible" (top N con el mismo puntaje pero otros registros empatados) y el resto se revisan a mano (abajo); no se cuentan como correctos.

### Por variante

| Grupo | Casos | Exacto | Exacto + columnas extra |
|---|---|---|---|
| original | 200 | 59.5 % | 86.5 % |
| parafrasis | 200 | 56.5 % | 79.5 % |

### Por categoría (solo originales)

| Grupo | Casos | Exacto | Exacto + columnas extra |
|---|---|---|---|
| simple | 60 | 73.3 % | 100.0 % |
| intermedio | 80 | 60.0 % | 85.0 % |
| complejo | 60 | 45.0 % | 75.0 % |

### Por motor

| Grupo | Casos | Exacto | Exacto + columnas extra |
|---|---|---|---|
| postgres | 100 | 60.0 % | 84.0 % |
| mysql | 100 | 58.0 % | 82.0 % |
| mariadb | 100 | 55.0 % | 80.0 % |
| mssql | 100 | 59.0 % | 86.0 % |

## Consistencia entre motores

77 de 100 preguntas (77.0 %) dan el mismo resultado en los 4 motores.

Sin contar columnas extra: 83 de 100 (83.0 %). Suma las preguntas en que los 4 motores traen lo de la referencia y solo difieren en columnas no pedidas.

## Robustez lingüística

Paráfrasis correctas: 79.5 % (originales del mismo subconjunto: 86.5 %). Casos donde la original acierta y la paráfrasis no: 23.

## Seguridad

Consultas generadas bloqueadas por el Query Safety Engine: 0. Errores de generación: 0. Rechazadas por limitar filas sin que se pidiera: 0. Errores de ejecución: 0.

## Tokens, latencia y poda

| Métrica | Promedio |
|---|---|
| Tokens de entrada | 712 |
| Tokens de salida | 69 |
| Tokens de razonamiento | 60 |
| Latencia de generación | 19.2 s |
| Latencia de ejecución (HTTP, banco chico) | 976 ms |
| Tablas enviadas al modelo | 2.31 de 8 |

## Posibles antipatrones (detección estática, revisar a mano)

- Ninguno detectado.

## Para revisión manual

| ID | Variante | Motor | Veredicto | Detalle |
|---|---|---|---|---|
| M03 | parafrasis | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name, SUM(o.total) AS total_desembolsado FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name |
| M03 | parafrasis | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name, SUM(o.total) AS total_desembolsado FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name |
| M03 | parafrasis | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name, SUM(o.total) AS total_desembolsado FROM customers c INNER JOIN orders o ON c.customer_id = o.customer_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name |
| M06 | parafrasis | postgres | distinto | SELECT p.product_id, p.name FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id) |
| M06 | parafrasis | mysql | distinto | SELECT p.product_id, p.name FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id) |
| M06 | parafrasis | mariadb | distinto | SELECT p.product_id, p.name FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id) |
| M06 | parafrasis | mssql | distinto | SELECT p.product_id, p.name FROM products p WHERE NOT EXISTS ( SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id ) |
| M08 | original | postgres | distinto | SELECT p.payment_method, SUM(p.amount) AS total_vendido FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.status != 'CANCELLED' AND p.status = 'COMPLETED' GROUP BY p.payment_method; |
| M08 | original | mysql | distinto | SELECT p.payment_method, SUM(p.amount) AS total_sold FROM payments p INNER JOIN orders o ON p.order_id = o.order_id WHERE o.status != 'CANCELLED' AND p.status = 'COMPLETED' GROUP BY p.payment_method |
| M08 | original | mariadb | distinto | SELECT p.payment_method, SUM(p.amount) AS total_vendido FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.status != 'CANCELLED' AND p.status = 'COMPLETED' GROUP BY p.payment_method |
| M08 | original | mssql | distinto | SELECT p.payment_method, SUM(p.amount) AS total_vendido FROM payments p INNER JOIN orders o ON p.order_id = o.order_id WHERE o.status <> 'CANCELLED' AND p.status = 'COMPLETED' GROUP BY p.payment_method |
| M14 | original | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 3 |
| M14 | parafrasis | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(o.order_id) > 3 |
| M14 | parafrasis | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(o.order_id) > 3 |
| M14 | parafrasis | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(o.order_id) > 3 |
| M14 | parafrasis | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM testdb.dbo.customers c JOIN testdb.dbo.orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 3 |
| M17 | parafrasis | postgres | distinto | SELECT COUNT(*) FROM orders WHERE status IN ('CONFIRMED', 'PROCESSING') |
| M17 | parafrasis | mysql | distinto | SELECT COUNT(order_id) FROM orders WHERE status IN ('CONFIRMED', 'PROCESSING') |
| M17 | parafrasis | mariadb | distinto | SELECT COUNT(*) AS total_ordenes FROM orders WHERE status IN ('CONFIRMED', 'PROCESSING') |
| M17 | parafrasis | mssql | distinto | SELECT COUNT(*) FROM orders WHERE status IN ('CONFIRMED', 'PROCESSING') |
| M19 | original | postgres | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10; |
| M19 | parafrasis | postgres | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10 |
| M19 | original | mysql | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10 |
| M19 | parafrasis | mysql | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10 |
| M19 | original | mariadb | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10; |
| M19 | parafrasis | mariadb | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.address_id) AS total_addresses FROM customers c JOIN addresses a ON c.customer_id = a.customer_id GROUP BY c.customer_id, c.first_name, c.last_name ORDER BY total_addresses DESC LIMIT 10 |
| M20 | original | postgres | distinto | SELECT AVG(EXTRACT(EPOCH FROM (delivery_date - shipment_date)) / 86400.0) AS avg_delivery_time_days FROM shipments WHERE status = 'DELIVERED' AND delivery_date IS NOT NULL AND shipment_date IS NOT NULL |
| M20 | parafrasis | postgres | distinto | SELECT AVG(EXTRACT(EPOCH FROM (delivery_date - shipment_date)) / 86400.0) AS average_delivery_days FROM shipments WHERE shipment_date IS NOT NULL AND delivery_date IS NOT NULL; |
| M20 | original | mysql | distinto | SELECT AVG(TIMESTAMPDIFF(SECOND, shipment_date, delivery_date)) / 86400 AS avg_delivery_time_days FROM shipments WHERE status = 'DELIVERED' AND shipment_date IS NOT NULL AND delivery_date IS NOT NULL |
| M20 | original | mariadb | distinto | SELECT AVG(TIMESTAMPDIFF(SECOND, shipment_date, delivery_date)) / 86400 AS tiempo_promedio_dias FROM shipments WHERE status = 'DELIVERED' AND shipment_date IS NOT NULL AND delivery_date IS NOT NULL |
| M20 | parafrasis | mariadb | distinto | SELECT AVG(DATEDIFF(delivery_date, shipment_date)) AS promedio_dias_entrega FROM shipments WHERE shipment_date IS NOT NULL AND delivery_date IS NOT NULL AND status = 'DELIVERED' |
| M20 | original | mssql | distinto | SELECT AVG(CAST(DATEDIFF(minute, shipment_date, delivery_date) AS float) / 1440.0) AS promedio_dias_envio_entrega FROM shipments WHERE shipment_date IS NOT NULL AND delivery_date IS NOT NULL; |
| C03 | parafrasis | mysql | distinto | WITH customer_spending AS ( SELECT c.customer_id, c.first_name, c.last_name, COALESCE(SUM(o.total), 0) AS total_spent FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name ) SELECT customer_id, first_name, last_name, total_spent FROM customer_spending WHERE total_spent > ( SELECT AVG(total_spent) FROM customer_spending ) |
| C03 | parafrasis | mariadb | distinto | WITH customer_spending AS ( SELECT c.customer_id, c.first_name, c.last_name, COALESCE(SUM(o.total), 0) AS total_spent FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name ) SELECT customer_id, first_name, last_name, total_spent FROM customer_spending WHERE total_spent > (SELECT AVG(total_spent) FROM customer_spending) |
| C05 | original | mysql | distinto | WITH category_sales AS ( SELECT c.category_id, c.name, SUM(oi.subtotal) AS total_sales FROM categories c JOIN products p ON c.category_id = p.category_id JOIN order_items oi ON p.product_id = oi.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.status != 'CANCELLED' GROUP BY c.category_id, c.name ), overall_sales AS ( SELECT SUM(total_sales) AS grand_total FROM category_sales ) SELECT cs.category_id, cs.name, cs.total_sales FROM category_sales cs CROSS JOIN overall_sales os WHERE cs.total_sales > 0.15 * os.grand_total |
| C05 | parafrasis | mysql | distinto | SELECT c.category_id, c.name, SUM(oi.subtotal) AS total_vendido FROM categories c JOIN products p ON c.category_id = p.category_id JOIN order_items oi ON p.product_id = oi.product_id JOIN orders o ON oi.order_id = o.order_id CROSS JOIN ( SELECT SUM(oi2.subtotal) AS grand_total FROM order_items oi2 JOIN orders o2 ON oi2.order_id = o2.order_id WHERE o2.status != 'CANCELLED' ) t WHERE o.status != 'CANCELLED' GROUP BY c.category_id, c.name, t.grand_total HAVING SUM(oi.subtotal) > 0.15 * t.grand_total |
| C05 | original | mariadb | distinto | SELECT c.category_id, c.name FROM categories c JOIN products p ON c.category_id = p.category_id JOIN order_items oi ON p.product_id = oi.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.status != 'CANCELLED' GROUP BY c.category_id, c.name HAVING SUM(oi.subtotal) > ( SELECT SUM(oi2.subtotal) * 0.15 FROM order_items oi2 JOIN orders o2 ON oi2.order_id = o2.order_id WHERE o2.status != 'CANCELLED' ) |
| C05 | parafrasis | mariadb | distinto | SELECT c.category_id, c.name FROM categories c JOIN products p ON c.category_id = p.category_id JOIN order_items oi ON p.product_id = oi.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.status != 'CANCELLED' GROUP BY c.category_id, c.name HAVING SUM(oi.subtotal) > 0.15 * ( SELECT SUM(oi2.subtotal) FROM order_items oi2 JOIN orders o2 ON oi2.order_id = o2.order_id WHERE o2.status != 'CANCELLED' ) |
| C08 | parafrasis | postgres | distinto | SELECT p.name AS product_name, c.name AS category_name, SUM(oi.quantity * oi.unit_price) AS total_generado FROM products p JOIN categories c ON p.category_id = c.category_id JOIN order_items oi ON p.product_id = oi.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.status != 'CANCELLED' GROUP BY p.product_id, p.name, c.name ORDER BY total_generado DESC LIMIT 5; |
| C08 | parafrasis | mysql | distinto | SELECT p.name AS product_name, c.name AS category_name, 0 AS total_generated FROM products p JOIN categories c ON p.category_id = c.category_id LIMIT 5 |
| C08 | parafrasis | mariadb | distinto | SELECT p.name AS product_name, c.name AS category_name FROM products p JOIN categories c ON p.category_id = c.category_id ORDER BY (p.price * p.stock) DESC LIMIT 5; |
| C08 | parafrasis | mssql | distinto | SELECT TOP 5 p.name AS product_name, c.name AS category_name, SUM(oi.quantity * oi.unit_price) AS total_generado FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN products p ON oi.product_id = p.product_id JOIN categories c ON p.category_id = c.category_id WHERE o.status <> 'CANCELLED' GROUP BY p.product_id, p.name, c.name ORDER BY total_generado DESC |
| C09 | original | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C09 | original | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C09 | parafrasis | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C09 | original | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C09 | original | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C09 | parafrasis | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT p.category_id) > 5 |
| C10 | original | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email, o.total_orders, p.total_paid FROM customers c JOIN ( SELECT customer_id, SUM(total) AS total_orders FROM orders WHERE status != 'CANCELLED' GROUP BY customer_id ) o ON c.customer_id = o.customer_id LEFT JOIN ( SELECT o.customer_id, SUM(p.amount) AS total_paid FROM orders o JOIN payments p ON o.order_id = p.order_id WHERE o.status != 'CANCELLED' AND p.status = 'COMPLETED' GROUP BY o.customer_id ) p ON c.customer_id = p.customer_id WHERE COALESCE(p.total_paid, 0) < o.total_orders |
| C10 | parafrasis | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN ( SELECT customer_id, SUM(total) AS total_orders FROM orders WHERE status != 'CANCELLED' GROUP BY customer_id ) o ON c.customer_id = o.customer_id LEFT JOIN ( SELECT o.customer_id, SUM(p.amount) AS total_paid FROM orders o JOIN payments p ON o.order_id = p.order_id WHERE p.status = 'COMPLETED' AND o.status != 'CANCELLED' GROUP BY o.customer_id ) p ON c.customer_id = p.customer_id WHERE COALESCE(p.total_paid, 0) < o.total_orders |
| C11 | parafrasis | mariadb | distinto | WITH top_category AS ( SELECT p.category_id FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN products p ON oi.product_id = p.product_id WHERE o.status != 'CANCELLED' GROUP BY p.category_id ORDER BY SUM(oi.quantity) DESC LIMIT 1 ) SELECT p.product_id, p.name, SUM(oi.quantity) AS total_vendido FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN products p ON oi.product_id = p.product_id JOIN top_category tc ON p.category_id = tc.category_id WHERE o.status != 'CANCELLED' GROUP BY p.product_id, p.name ORDER BY total_vendido DESC LIMIT 3 |
| C11 | parafrasis | mssql | distinto | WITH TopCategory AS ( SELECT TOP 1 p.category_id FROM order_items oi INNER JOIN orders o ON oi.order_id = o.order_id INNER JOIN products p ON oi.product_id = p.product_id WHERE o.status <> 'CANCELLED' GROUP BY p.category_id ORDER BY SUM(oi.quantity) DESC ) SELECT TOP 3 p.product_id, p.name, SUM(oi.quantity) AS total_vendido FROM order_items oi INNER JOIN orders o ON oi.order_id = o.order_id INNER JOIN products p ON oi.product_id = p.product_id INNER JOIN TopCategory tc ON p.category_id = tc.category_id WHERE o.status <> 'CANCELLED' GROUP BY p.product_id, p.name ORDER BY SUM(oi.quantity) DESC |
| C13 | original | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | parafrasis | postgres | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | original | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | parafrasis | mysql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | original | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | parafrasis | mariadb | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | original | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name, c.email HAVING COUNT(DISTINCT a.country) > 1 |
| C13 | parafrasis | mssql | distinto | SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN addresses a ON o.shipping_address_id = a.address_id GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(DISTINCT a.country) > 1 |
| C15 | original | postgres | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS ticket_promedio FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 1 ORDER BY ticket_promedio DESC LIMIT 5 |
| C15 | parafrasis | postgres | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS promedio_por_orden FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) >= 2 ORDER BY promedio_por_orden DESC LIMIT 5; |
| C15 | original | mysql | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS gasto_promedio FROM customers c INNER JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 1 ORDER BY gasto_promedio DESC LIMIT 5 |
| C15 | parafrasis | mysql | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS promedio_gasto FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) >= 2 ORDER BY promedio_gasto DESC LIMIT 5 |
| C15 | original | mariadb | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS avg_spent FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 1 ORDER BY avg_spent DESC LIMIT 5 |
| C15 | parafrasis | mariadb | empate_posible | SELECT c.customer_id, c.first_name, c.last_name, AVG(o.total) AS avg_spent_per_order FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status != 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) >= 2 ORDER BY avg_spent_per_order DESC LIMIT 5 |
| C15 | original | mssql | empate_posible | SELECT TOP 5 c.customer_id, c.first_name, c.last_name, AVG(o.total) AS gasto_promedio FROM customers c INNER JOIN orders o ON c.customer_id = o.customer_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) > 1 ORDER BY gasto_promedio DESC |
| C15 | parafrasis | mssql | empate_posible | SELECT TOP 5 c.customer_id, c.first_name, c.last_name, AVG(o.total) AS promedio_gasto FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.status <> 'CANCELLED' GROUP BY c.customer_id, c.first_name, c.last_name HAVING COUNT(o.order_id) >= 2 ORDER BY promedio_gasto DESC |
