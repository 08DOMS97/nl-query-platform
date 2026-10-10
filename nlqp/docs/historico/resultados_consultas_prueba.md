# Resultados — 50 consultas de prueba NL2SQL

Ejecutadas contra el backend real (`http://localhost:8080`) usando `/executeQuery`, que aplica
el Query Safety Engine antes de ejecutar cada SQL contra los 4 motores del banco de
pruebas. El SQL de cada consulta es de referencia (escrito a mano, adaptado por
dialecto) — no proviene de Vertex AI todavía (pendiente de proyecto GCP).

## Resumen

- Consultas: 50 (15 simples, 20 intermedias, 15 complejas)
- Ejecuciones totales: 200 (50 consultas × 4 motores)
- Ejecuciones exitosas: 200/200
- Consultas con conteo de filas consistente entre los 4 motores: 50/50
- Consultas con al menos un fallo: 0

| Categoría | Consultas | Ejecuciones OK |
|---|---|---|
| simple | 15 | 60/60 |
| intermedio | 20 | 80/80 |
| complejo | 15 | 60/60 |




## Detalle completo

| ID | Categoría | Consulta (lenguaje natural) | PostgreSQL | MySQL | MariaDB | SQL Server | Consistente |
|---|---|---|---|---|---|---|---|
| S01 | simple | ¿Cuántos clientes hay en total? | OK (1 filas, 50ms) | OK (1 filas, 26ms) | OK (1 filas, 18ms) | OK (1 filas, 16ms) | sí |
| S02 | simple | ¿Cuántos clientes están activos? | OK (1 filas, 4ms) | OK (1 filas, 8ms) | OK (1 filas, 16ms) | OK (1 filas, 18ms) | sí |
| S03 | simple | Lista los 10 productos más caros | OK (10 filas, 21ms) | OK (10 filas, 4ms) | OK (10 filas, 11ms) | OK (10 filas, 19ms) | sí |
| S04 | simple | ¿Cuántos productos están agotados? | OK (1 filas, 15ms) | OK (1 filas, 15ms) | OK (1 filas, 17ms) | OK (1 filas, 23ms) | sí |
| S05 | simple | Muestra los productos con stock menor a 10 | OK (26 filas, 12ms) | OK (26 filas, 17ms) | OK (26 filas, 16ms) | OK (26 filas, 18ms) | sí |
| S06 | simple | ¿Cuántas categorías de productos existen? | OK (1 filas, 13ms) | OK (1 filas, 18ms) | OK (1 filas, 15ms) | OK (1 filas, 20ms) | sí |
| S07 | simple | Lista las categorías activas | OK (13 filas, 16ms) | OK (13 filas, 20ms) | OK (13 filas, 14ms) | OK (13 filas, 21ms) | sí |
| S08 | simple | ¿Cuántos pedidos hay en total? | OK (1 filas, 13ms) | OK (1 filas, 15ms) | OK (1 filas, 16ms) | OK (1 filas, 20ms) | sí |
| S09 | simple | ¿Cuántos pedidos fueron cancelados? | OK (1 filas, 13ms) | OK (1 filas, 16ms) | OK (1 filas, 18ms) | OK (1 filas, 18ms) | sí |
| S10 | simple | ¿Cuántos pedidos se hicieron en 2025? | OK (1 filas, 12ms) | OK (1 filas, 16ms) | OK (1 filas, 16ms) | OK (1 filas, 20ms) | sí |
| S11 | simple | Muestra los 5 pedidos más recientes | OK (5 filas, 3ms) | OK (5 filas, 10ms) | OK (5 filas, 5ms) | OK (5 filas, 17ms) | sí |
| S12 | simple | ¿Cuántos pagos fueron rechazados? | OK (1 filas, 13ms) | OK (1 filas, 3ms) | OK (1 filas, 12ms) | OK (1 filas, 17ms) | sí |
| S13 | simple | ¿Cuántos envíos están en tránsito? | OK (1 filas, 14ms) | OK (1 filas, 17ms) | OK (1 filas, 16ms) | OK (1 filas, 10ms) | sí |
| S14 | simple | Lista los métodos de pago disponibles | OK (5 filas, 2ms) | OK (5 filas, 11ms) | OK (5 filas, 15ms) | OK (5 filas, 6ms) | sí |
| S15 | simple | ¿Cuál es el precio promedio de los productos? | OK (1 filas, 9ms) | OK (1 filas, 18ms) | OK (1 filas, 18ms) | OK (1 filas, 18ms) | sí |
| M01 | intermedio | ¿Cuántos productos tiene cada categoría? | OK (15 filas, 16ms) | OK (15 filas, 17ms) | OK (15 filas, 15ms) | OK (15 filas, 19ms) | sí |
| M02 | intermedio | ¿Cuántos pedidos ha hecho cada cliente? | OK (200 filas, 15ms) | OK (200 filas, 18ms) | OK (200 filas, 16ms) | OK (200 filas, 20ms) | sí |
| M03 | intermedio | ¿Cuánto ha gastado cada cliente? | OK (200 filas, 17ms) | OK (200 filas, 16ms) | OK (200 filas, 15ms) | OK (200 filas, 21ms) | sí |
| M04 | intermedio | ¿Cuáles son los 10 productos más vendidos por unidades? | OK (10 filas, 12ms) | OK (10 filas, 18ms) | OK (10 filas, 13ms) | OK (10 filas, 20ms) | sí |
| M05 | intermedio | ¿Cuáles clientes nunca han hecho un pedido? | OK (55 filas, 15ms) | OK (55 filas, 16ms) | OK (55 filas, 15ms) | OK (55 filas, 13ms) | sí |
| M06 | intermedio | ¿Qué productos nunca se han vendido? | OK (19 filas, 13ms) | OK (19 filas, 17ms) | OK (19 filas, 11ms) | OK (19 filas, 19ms) | sí |
| M07 | intermedio | ¿Cuál es el total de ventas por categoría? | OK (15 filas, 13ms) | OK (15 filas, 18ms) | OK (15 filas, 4ms) | OK (15 filas, 16ms) | sí |
| M08 | intermedio | ¿Cuál es el total vendido por método de pago? | OK (5 filas, 12ms) | OK (5 filas, 3ms) | OK (5 filas, 12ms) | OK (5 filas, 20ms) | sí |
| M09 | intermedio | ¿Cuántos pedidos tiene cada estado? | OK (6 filas, 13ms) | OK (6 filas, 16ms) | OK (6 filas, 20ms) | OK (6 filas, 18ms) | sí |
| M10 | intermedio | ¿Cuáles son las 5 ciudades con más clientes? | OK (5 filas, 15ms) | OK (5 filas, 15ms) | OK (5 filas, 18ms) | OK (5 filas, 18ms) | sí |
| M11 | intermedio | ¿Cuántos clientes hay por país? | OK (9 filas, 14ms) | OK (9 filas, 16ms) | OK (9 filas, 20ms) | OK (9 filas, 5ms) | sí |
| M12 | intermedio | ¿Cuál es el ticket promedio por año? | OK (4 filas, 10ms) | OK (4 filas, 3ms) | OK (4 filas, 13ms) | OK (4 filas, 21ms) | sí |
| M13 | intermedio | ¿Cuántos pedidos y cuánto se vendió cada mes de 2025? | OK (12 filas, 14ms) | OK (12 filas, 2ms) | OK (12 filas, 15ms) | OK (12 filas, 18ms) | sí |
| M14 | intermedio | ¿Qué clientes tienen más de 3 pedidos? | OK (18 filas, 14ms) | OK (18 filas, 16ms) | OK (18 filas, 16ms) | OK (18 filas, 19ms) | sí |
| M15 | intermedio | ¿Cuáles categorías no tienen productos activos? | OK (0 filas, 3ms) | OK (0 filas, 11ms) | OK (0 filas, 2ms) | OK (0 filas, 17ms) | sí |
| M16 | intermedio | ¿Cuál es el valor total de inventario por categoría? | OK (15 filas, 15ms) | OK (15 filas, 18ms) | OK (15 filas, 15ms) | OK (15 filas, 20ms) | sí |
| M17 | intermedio | ¿Cuántos pedidos están pagados pero aún no enviados? | OK (1 filas, 2ms) | OK (1 filas, 12ms) | OK (1 filas, 17ms) | OK (1 filas, 19ms) | sí |
| M18 | intermedio | ¿Cuál es el porcentaje de pedidos cancelados? | OK (1 filas, 14ms) | OK (1 filas, 16ms) | OK (1 filas, 18ms) | OK (1 filas, 17ms) | sí |
| M19 | intermedio | ¿Cuáles son los 10 clientes con más direcciones registradas? | OK (10 filas, 15ms) | OK (10 filas, 4ms) | OK (10 filas, 10ms) | OK (10 filas, 22ms) | sí |
| M20 | intermedio | ¿Cuál es el tiempo promedio entre el envío y la entrega, en días? | OK (1 filas, 13ms) | OK (1 filas, 16ms) | OK (1 filas, 16ms) | OK (1 filas, 19ms) | sí |
| C01 | complejo | ¿Quién es el cliente que más ha gastado y cuánto? | OK (1 filas, 14ms) | OK (1 filas, 16ms) | OK (1 filas, 17ms) | OK (1 filas, 20ms) | sí |
| C02 | complejo | Muestra el top 3 de productos más vendidos de cada categoría | OK (42 filas, 16ms) | OK (42 filas, 17ms) | OK (42 filas, 14ms) | OK (42 filas, 65ms) | sí |
| C03 | complejo | ¿Qué clientes han gastado más que el promedio general? | OK (54 filas, 5ms) | OK (54 filas, 18ms) | OK (54 filas, 14ms) | OK (54 filas, 18ms) | sí |
| C04 | complejo | ¿Cuáles son los 5 clientes con más pedidos entregados? | OK (5 filas, 15ms) | OK (5 filas, 20ms) | OK (5 filas, 15ms) | OK (5 filas, 17ms) | sí |
| C05 | complejo | ¿Qué categorías generan más del 15% de las ventas totales? | OK (3 filas, 17ms) | OK (3 filas, 19ms) | OK (3 filas, 16ms) | OK (3 filas, 19ms) | sí |
| C06 | complejo | ¿Qué pedidos tienen un total distinto a la suma de subtotal, impuestos y envío? | OK (0 filas, 9ms) | OK (0 filas, 15ms) | OK (0 filas, 18ms) | OK (0 filas, 19ms) | sí |
| C07 | complejo | ¿Cuáles son los 5 clientes con más productos distintos comprados? | OK (5 filas, 13ms) | OK (5 filas, 22ms) | OK (5 filas, 10ms) | OK (5 filas, 23ms) | sí |
| C08 | complejo | ¿Cuáles son los 5 productos con mayor ingreso generado, junto con su categoría? | OK (5 filas, 12ms) | OK (5 filas, 16ms) | OK (5 filas, 22ms) | OK (5 filas, 8ms) | sí |
| C09 | complejo | ¿Qué clientes han comprado productos de más de 5 categorías distintas? | OK (38 filas, 4ms) | OK (38 filas, 21ms) | OK (38 filas, 12ms) | OK (38 filas, 18ms) | sí |
| C10 | complejo | ¿Qué clientes tienen pagos incompletos frente al total de sus pedidos? | OK (10 filas, 18ms) | OK (10 filas, 18ms) | OK (10 filas, 15ms) | OK (10 filas, 8ms) | sí |
| C11 | complejo | ¿Cuáles son los 3 productos más vendidos dentro de la categoría con mayores ventas? | OK (3 filas, 7ms) | OK (3 filas, 17ms) | OK (3 filas, 13ms) | OK (3 filas, 20ms) | sí |
| C12 | complejo | ¿Cuántos pedidos superan el promedio de artículos por pedido? | OK (1 filas, 11ms) | OK (1 filas, 23ms) | OK (1 filas, 18ms) | OK (1 filas, 19ms) | sí |
| C13 | complejo | ¿Qué clientes han hecho pedidos con envío a más de un país? | OK (0 filas, 13ms) | OK (0 filas, 2ms) | OK (0 filas, 13ms) | OK (0 filas, 18ms) | sí |
| C14 | complejo | ¿Cuál es el precio mínimo, máximo y promedio por categoría? | OK (15 filas, 17ms) | OK (15 filas, 15ms) | OK (15 filas, 15ms) | OK (15 filas, 19ms) | sí |
| C15 | complejo | ¿Cuáles son los 5 clientes con mayor gasto promedio por pedido, considerando solo clientes con más de un pedido? | OK (5 filas, 14ms) | OK (5 filas, 17ms) | OK (5 filas, 15ms) | OK (5 filas, 23ms) | sí |
