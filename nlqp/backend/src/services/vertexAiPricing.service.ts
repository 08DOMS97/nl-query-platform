/**
 * Estimación de costo de Vertex AI por precio de lista — NO es el monto real
 * de la factura (esa depende de descuentos, redondeos de facturación, etc.).
 * Precios de Gemini 3.8 Flash (endpoint `global`, estándar, sin lote ni
 * prioridad) verificados al 2026-10-18 en el catálogo de Cloud Billing
 * (SKUs "Gemini 3.8 Flash Global Text Input/Output - Predictions"; la salida
 * incluye el razonamiento). Revisar si el número dejó de ser razonable.
 * Sobreescribibles sin tocar código vía `VERTEX_AI_PRICE_INPUT_PER_1M_USD` /
 * `VERTEX_AI_PRICE_OUTPUT_PER_1M_USD` en `.env`. Hasta el 18/10/2026 se usaba
 * Gemini 2.5 Pro: USD 1.25 / 10 (contexto ≤200k).
 */

const DEFAULT_PRICE_INPUT_PER_1M_USD = 1.5;
const DEFAULT_PRICE_OUTPUT_PER_1M_USD = 7.5;

export function estimateCostUsd(tokensInput: number, tokensOutput: number): number {
  const priceInput = Number(
    process.env.VERTEX_AI_PRICE_INPUT_PER_1M_USD ?? DEFAULT_PRICE_INPUT_PER_1M_USD,
  );
  const priceOutput = Number(
    process.env.VERTEX_AI_PRICE_OUTPUT_PER_1M_USD ?? DEFAULT_PRICE_OUTPUT_PER_1M_USD,
  );
  return (tokensInput / 1_000_000) * priceInput + (tokensOutput / 1_000_000) * priceOutput;
}
