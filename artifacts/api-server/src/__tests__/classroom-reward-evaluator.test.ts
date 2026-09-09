import { describe, expect, it, vi } from "vitest";
import { evaluateClassroomRewardEvidence } from "../lib/classroom-reward-evaluator";

const evidence = { teacherId: 1, ruleId: 7, sourceType: "assignment_submission" as const, sourceResultId: 44, studentId: 9, completed: true, score: 8, evidenceSummary: { effectivePoints: 8, totalPoints: 10 } };
const rule = { id: 7, name: "ثمانية نقاط", condition: "score_at_least", threshold: 7, reward_type_id: 3, amount: 2, category_snapshot: "work", reward_type_name: "نجاح" };

describe("automatic classroom reward evaluator receipts", () => {
  it("retries a failed receipt, while a granted receipt is terminal", async () => {
    // First run: receipt then a failed grant; savepoint rollback leaves no grant.
    const first = vi.fn()
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [rule] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 91 }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 9, name: "طالب" }] })
      .mockRejectedValueOnce(new Error("insert failed")).mockResolvedValue({ rows: [] });
    expect((await evaluateClassroomRewardEvidence({ execute: first }, evidence)).map(x => x.outcome)).toEqual(["failed"]);
    // Reprocess locks failed receipt, changes it back to pending, then grants.
    const second = vi.fn()
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [rule] }).mockResolvedValueOnce({ rows: [{ id: 91, outcome: "failed" }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 9, name: "طالب" }] })
      .mockResolvedValueOnce({ rows: [{ id: 12 }] }).mockResolvedValue({ rows: [] });
    expect((await evaluateClassroomRewardEvidence({ execute: second }, evidence))[0]).toMatchObject({ outcome: "granted", transactionId: 12 });
    const terminal = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [rule] }).mockResolvedValueOnce({ rows: [{ outcome: "granted" }] });
    expect((await evaluateClassroomRewardEvidence({ execute: terminal }, evidence))[0].outcome).toBe("already_processed");
  });

  it("documents source type as part of receipt identity", async () => {
    const text = await import("node:fs/promises").then(fs => fs.readFile(new URL("../lib/classroom-reward-evaluator.ts", import.meta.url), "utf8"));
    expect(text).toContain("rule_id,source_type,source_result_id,student_id");
    expect(text).toContain("source_type=${evidence.sourceType}");
  });
});