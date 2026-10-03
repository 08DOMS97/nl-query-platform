/**
 * Reglas de negocio del dominio que se inyectan en el prompt. Son la parte de
 * la semántica que no se puede deducir del esquema: por ejemplo, que un pedido
 * cancelado no cuenta como venta. Sin ellas, una pregunta como "¿cuánto ha
 * gastado cada cliente?" tiene dos respuestas razonables y el modelo elegiría
 * una al azar. Igual que los sinónimos ES→EN de `schemaPruning.service.ts`,
 * cubren el dataset de e-commerce del banco de pruebas; en producción serían
 * configuración por cliente.
 */
export const DOMAIN_RULES: string[] = [
  "Si la pregunta involucra montos de ventas, ingresos, gasto o ticket promedio, excluye de la " +
    "consulta los pedidos con status 'CANCELLED' (un pedido cancelado no es una venta).",
  "Los montos pagados se calculan solo con pagos de status 'COMPLETED'.",
];
