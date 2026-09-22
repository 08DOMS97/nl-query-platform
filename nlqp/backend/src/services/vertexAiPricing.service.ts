/**
 * Estimación de costo de Vertex AI por precio de lista — NO es el monto real
 * de la factura (esa depende de descuentos, redondeos de facturación, etc.).
 * Precios de Gemini 2.5 Pro (contexto ≤200k tokens) verificados al
 * 2026-09-21 en https://cloud.google.com/vertex-ai/generative-ai/pricing —
 * revisar esa página si el número dejó de ser razonable. Sobreescribibles sin
 * tocar código vía `VERTEX_AI_PRICE_INPUT_PER_1M_USD` /
 * `VERTEX_AI_PRICE_OUTPUT_PER_1M_USD` en `.env`.
 */

const DEFAULT_PRICE_INPUT_PER_1M_USD = 1.25;
const DEFAULT_PRICE_OUTPUT_PER_1M_USD = 10;

export function estimateCostUsd(tokensInput: number, tokensOutput: number): number {
  const priceInput = Number(
    process.env.VERTEX_AI_PRICE_INPUT_PER_1M_USD ?? DEFAULT_PRICE_INPUT_PER_1M_USD,
  );
  const priceOutput = Number(
    process.env.VERTEX_AI_PRICE_OUTPUT_PER_1M_USD ?? DEFAULT_PRICE_OUTPUT_PER_1M_USD,
  );
  return (tokensInput / 1_000_000) * priceInput + (tokensOutput / 1_000_000) * priceOutput;
}
