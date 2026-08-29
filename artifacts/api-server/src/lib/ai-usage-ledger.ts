import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type AiUsageModality = "text" | "audio" | "image";
export type AiUsageStatus = "started" | "succeeded" | "failed" | "cached";

export interface AiUsageCallConfig {
  toolKey: string;
  callKey: string;
  provider: string;
  model: string;
  modality: AiUsageModality;
  teacherId?: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedAiUsage {
  tokensIn?: number | null;
  tokensOut?: number | null;
  usageQuantity?: number | null;
  usageUnit?: string | null;
  /** Provider-reported cost, in micro-USD. */
  costMicroUsd?: number | null;
  costSource?: "provider" | "estimated" | "unavailable";
}

/**
 * Estimated USD per one million text tokens. These are a reporting fallback,
 * not provider invoices; provider-reported costs always take precedence.
 */
export const AI_TEXT_PRICING_CATALOG: Record<string, { inputUsdPerMillion: number; outputUsdPerMillion: number }> = {
  "claude-sonnet-4-6": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-haiku-4-5": { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
  "claude-sonnet-4-5": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-3-5-haiku-latest": { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 },
  "claude-3-5-sonnet-latest": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "gpt-5": { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  "gpt-5.2": { inputUsdPerMillion: 1.75, outputUsdPerMillion: 14 },
  "gpt-4o-mini": { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  "gpt-4o": { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
};

function finiteNonNegative(value: number | null | undefined): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : 0;
}

export function estimateTextCostMicroUsd(model: string, tokensIn?: number | null, tokensOut?: number | null): number | null {
  const price = AI_TEXT_PRICING_CATALOG[model.toLowerCase()];
  if (!price) return null;
  // (USD / million tokens) × token count × 1m micro-USD/USD = price × count.
  return Math.round(price.inputUsdPerMillion * finiteNonNegative(tokensIn) + price.outputUsdPerMillion * finiteNonNegative(tokensOut));
}

/** Returns the credit hold identifier when present, so ledger and credits correlate. */
export function getAiUsageRequestId(req: Request, toolKey: string): string {
  const request = req as Request & { __creditRequestId?: string; __aiUsageRequestIds?: Record<string, string> };
  if (request.__creditRequestId) return request.__creditRequestId;
  request.__aiUsageRequestIds ??= {};
  return (request.__aiUsageRequestIds[toolKey] ??= `${toolKey}:${randomUUID()}`);
}

function ledgerTeacherId(req: Request, config: AiUsageCallConfig): number | undefined {
  return config.teacherId ?? req.session?.teacherId;
}

async function startLedgerRow(req: Request, config: AiUsageCallConfig): Promise<{ status: AiUsageStatus; inserted: boolean } | undefined> {
  const teacherId = ledgerTeacherId(req, config);
  if (!teacherId) return undefined;
  const requestId = getAiUsageRequestId(req, config.toolKey);
  const inserted = await db.execute(sql`
    INSERT INTO ai_usage_ledger
      (teacher_id, request_id, call_key, tool_key, provider, model, modality, status, metadata)
    VALUES (${teacherId}, ${requestId}, ${config.callKey}, ${config.toolKey}, ${config.provider},
      ${config.model}, ${config.modality}, 'started', ${JSON.stringify(config.metadata ?? {})}::jsonb)
    ON CONFLICT (teacher_id, request_id, call_key) DO NOTHING
    RETURNING status
  `) as { rows?: Array<{ status: AiUsageStatus }> };
  if (inserted.rows?.[0]) return { status: inserted.rows[0].status, inserted: true };
  const existing = await db.execute(sql`
    SELECT status FROM ai_usage_ledger
    WHERE teacher_id = ${teacherId} AND request_id = ${requestId} AND call_key = ${config.callKey}
    LIMIT 1
  `) as { rows?: Array<{ status: AiUsageStatus }> };
  const status = existing.rows?.[0]?.status;
  return status ? { status, inserted: false } : undefined;
}

async function finalizeLedgerRow(req: Request, config: AiUsageCallConfig, status: "succeeded" | "failed", usage: ExtractedAiUsage, errorCode?: string) {
  const teacherId = ledgerTeacherId(req, config);
  if (!teacherId) return;
  const tokensIn = finiteNonNegative(usage.tokensIn);
  const tokensOut = finiteNonNegative(usage.tokensOut);
  const providerCost = usage.costMicroUsd;
  const estimated = config.modality === "text" && providerCost == null
    ? estimateTextCostMicroUsd(config.model, tokensIn, tokensOut)
    : null;
  const costMicroUsd = providerCost == null ? estimated : finiteNonNegative(providerCost);
  const costSource = providerCost != null ? "provider" : estimated != null ? "estimated" : "unavailable";
  await db.execute(sql`
    UPDATE ai_usage_ledger SET
      status = ${status}, tokens_in = ${tokensIn}, tokens_out = ${tokensOut},
      usage_quantity = ${usage.usageQuantity == null ? null : finiteNonNegative(usage.usageQuantity)},
      usage_unit = ${usage.usageUnit ?? null}, cost_micro_usd = ${costMicroUsd},
      cost_source = ${usage.costSource === "provider" && providerCost != null ? "provider" : costSource},
      error_code = ${errorCode ?? null}, completed_at = NOW(), updated_at = NOW()
    WHERE teacher_id = ${teacherId} AND request_id = ${getAiUsageRequestId(req, config.toolKey)}
      AND call_key = ${config.callKey} AND status = 'started'
  `);
}

/**
 * Wrap a real provider request. Ledger errors are intentionally swallowed:
 * observability must never turn a successful generation into a failed one.
 */
export async function trackAiUsageCall<T>(
  req: Request,
  config: AiUsageCallConfig,
  invoke: () => Promise<T>,
  usageExtractor: (result: T) => ExtractedAiUsage = () => ({}),
): Promise<T> {
  try { await startLedgerRow(req, config); } catch (err) { logger.warn({ err, config }, "AI usage ledger start failed"); }
  // HTTP replay prevention belongs to checkCredits.  The ledger must never
  // change generation semantics, so terminal duplicates still invoke and are
  // merely prevented from mutating the completed accounting record below.
  try {
    const result = await invoke();
    try { await finalizeLedgerRow(req, config, "succeeded", usageExtractor(result)); } catch (err) { logger.warn({ err, config }, "AI usage ledger finalization failed"); }
    return result;
  } catch (err) {
    const errorCode = err instanceof Error ? err.name : "provider_error";
    try { await finalizeLedgerRow(req, config, "failed", {}, errorCode); } catch (ledgerErr) { logger.warn({ err: ledgerErr, config }, "AI usage ledger failure finalization failed"); }
    throw err;
  }
}

export async function recordCachedAiUsage(req: Request, config: AiUsageCallConfig): Promise<void> {
  try {
    const state = await startLedgerRow(req, config);
    // A concurrent started call belongs to its owner; do not turn it cached.
    if (!state || state.status !== "started" || !state.inserted) return;
    const teacherId = ledgerTeacherId(req, config);
    if (!teacherId) return;
    await db.execute(sql`
      UPDATE ai_usage_ledger SET status = 'cached', completed_at = NOW(), updated_at = NOW()
      WHERE teacher_id = ${teacherId} AND request_id = ${getAiUsageRequestId(req, config.toolKey)}
        AND call_key = ${config.callKey} AND status = 'started'
    `);
  } catch (err) {
    logger.warn({ err, config }, "AI usage cached ledger write failed");
  }
}