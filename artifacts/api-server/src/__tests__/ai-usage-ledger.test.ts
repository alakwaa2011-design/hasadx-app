import { beforeEach, describe, expect, it, vi } from "vitest";

const ledgerDb = vi.hoisted(() => {
  let executeCall = 0;
  let insertedAccountingRows = 0;
  const execute = vi.fn(async () => {
    executeCall += 1;
  // start, finalize, conflict start, terminal lookup, no-op terminal finalize
    if (executeCall === 1) { insertedAccountingRows += 1; return { rows: [{ status: "started" }] }; }
    if (executeCall === 3) return { rows: [] };
    if (executeCall === 4) return { rows: [{ status: "succeeded" }] };
    return { rows: [] };
  });
  return {
    execute,
    reset: () => { executeCall = 0; insertedAccountingRows = 0; execute.mockClear(); },
    insertedRows: () => insertedAccountingRows,
  };
});

vi.mock("@workspace/db", () => ({ db: { execute: ledgerDb.execute } }));
import { estimateTextCostMicroUsd, getAiUsageRequestId } from "../lib/ai-usage-ledger";
import { normalizeAiCostReportBreakdown, normalizeAiCostReportTotals, parseAiCostReportRange } from "../routes/credits-admin";

describe("AI usage ledger cost estimation", () => {
  beforeEach(() => {
    ledgerDb.reset();
  });
  it("uses the explicit model price catalog and preserves micro-USD precision", () => {
    // gpt-4o-mini: $0.15/M input + $0.60/M output.
    expect(estimateTextCostMicroUsd("gpt-4o-mini", 1_000, 2_000)).toBe(1_350);
    expect(estimateTextCostMicroUsd("unknown-model", 1_000, 2_000)).toBeNull();
    expect(estimateTextCostMicroUsd("gpt-5.2", 1_000, 2_000)).toBe(29_750);
  });

  it("does not allow negative token counts to reduce a cost", () => {
    expect(estimateTextCostMicroUsd("gpt-4o", -100, 100)).toBe(1_000);
  });

  it("uses a credit request id or a stable request-local idempotency key", () => {
    const correlated = { __creditRequestId: "hold-123" } as any;
    expect(getAiUsageRequestId(correlated, "ai-chat")).toBe("hold-123");
    const uncorrelated = {} as any;
    expect(getAiUsageRequestId(uncorrelated, "ai-chat")).toBe(getAiUsageRequestId(uncorrelated, "ai-chat"));
  });

  it("does not create a second accounting row for a repeated correlated call", async () => {
    const req = { session: { teacherId: 7 }, __creditRequestId: "hold-123" } as any;
    const config = { toolKey: "ai-chat", callKey: "completion", provider: "openai", model: "gpt-5", modality: "text" as const };
    const invoke = vi.fn(async () => ({ usage: { input: 10, output: 5 } }));
    const { trackAiUsageCall } = await import("../lib/ai-usage-ledger");

    await trackAiUsageCall(req, config, invoke, () => ({ tokensIn: 10, tokensOut: 5 }));
    await trackAiUsageCall(req, config, invoke, () => ({ tokensIn: 10, tokensOut: 5 }));

    expect(invoke).toHaveBeenCalledTimes(2); // ledger never breaks replay generation
    expect(ledgerDb.insertedRows()).toBe(1);
    expect(ledgerDb.execute).toHaveBeenCalledTimes(5); // terminal update is guarded by status='started'
  });
});

describe("AI cost report helpers", () => {
  it("accepts an ISO calendar half-open range with an exclusive end", () => {
    const range = parseAiCostReportRange({ from: "2026-01-01", to: "2026-02-01" });
    expect(range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rejects invalid, reversed, and greater-than-366-day ranges", () => {
    expect(() => parseAiCostReportRange({ from: "2026-01-01", to: "2026-01-01" })).toThrow();
    expect(() => parseAiCostReportRange({ from: "2026-01-01", to: "2027-01-03" })).toThrow();
    expect(() => parseAiCostReportRange({ from: "01-01-2026", to: "2026-01-02" })).toThrow();
  });

  it("normalizes postgres numeric aggregate strings", () => {
    expect(normalizeAiCostReportTotals({ attempts: "2", tokens_in: "11", distinct_teachers: "1" })).toMatchObject({
      attempts: 2, tokensIn: 11, distinctTeachers: 1, failed: 0, refundedOperations: 0,
    });
  });

  it("normalizes each grouped breakdown into camelCase API fields", () => {
    expect(normalizeAiCostReportBreakdown({
      provider: "openai", model: "gpt-5", tool_key: "ai-chat", day: "2026-01-01",
      attempts: "2", successful: "1", failed: "1",
      cached: "0", tokens_in: "11", tokens_out: "7", cost_micro_usd: "55",
      cost_unavailable_count: "1", refunded_operations: "1",
      completed_credit_points: "25", refunded_credit_points: "10",
    })).toEqual({
      provider: "openai", model: "gpt-5", toolKey: "ai-chat", day: "2026-01-01",
      attempts: 2, successful: 1, failed: 1, cached: 0, tokensIn: 11, tokensOut: 7,
      costMicroUsd: 55, costUnavailableCount: 1, distinctTeachers: 0, refundedOperations: 1,
      completedCreditPoints: 25, refundedCreditPoints: 10,
    });
  });
});