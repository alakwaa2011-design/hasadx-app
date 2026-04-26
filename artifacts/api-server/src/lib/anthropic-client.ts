import Anthropic from "@anthropic-ai/sdk";

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!baseURL || !apiKey) {
  console.warn(
    "[anthropic] AI_INTEGRATIONS_ANTHROPIC_BASE_URL or AI_INTEGRATIONS_ANTHROPIC_API_KEY missing — AI chat will fail until provisioned.",
  );
}

export const anthropic = new Anthropic({
  baseURL: baseURL || undefined,
  apiKey: apiKey || "missing-key",
});

export const SONNET_MODEL = "claude-sonnet-4-6";

// Anthropic Sonnet pricing (USD per 1M tokens) — kept here so cost estimates
// are accurate even if billed through the Replit proxy.
export const PRICE_INPUT_PER_MTOK = 3;
export const PRICE_OUTPUT_PER_MTOK = 15;

export function estimateCostMicroUsd(tokensIn: number, tokensOut: number): number {
  const usd =
    (tokensIn / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (tokensOut / 1_000_000) * PRICE_OUTPUT_PER_MTOK;
  return Math.round(usd * 1_000_000);
}
