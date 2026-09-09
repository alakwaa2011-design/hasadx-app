import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classroomRewardFingerprint, classroomRewardReversalKey } from "../lib/classroom-reward-fingerprint";

describe("classroom reward request identity", () => {
  const request = { className: "5-A", studentIds: [9, 2, 9], typeId: 4 };

  it("is stable across target ordering and duplicates, but changes for a different request", () => {
    expect(classroomRewardFingerprint(request)).toBe(classroomRewardFingerprint({ className: "5-A", studentIds: [2, 9], typeId: 4 }));
    expect(classroomRewardFingerprint(request)).not.toBe(classroomRewardFingerprint({ className: "5-A", studentIds: [2, 9], typeId: 5 }));
    expect(classroomRewardFingerprint(request)).not.toBe(classroomRewardFingerprint({ className: "5-B", studentIds: [2, 9], typeId: 4 }));
  });

  it("uses a reversal-only namespace, avoiding grant request-key collisions", () => {
    expect(classroomRewardReversalKey("request-123")).toBe("__reversal__:request-123");
    expect(classroomRewardReversalKey("request-123")).not.toBe("request-123");
  });

  it("keeps the rewards route isolated from prohibited score and credit domains", () => {
    const route = readFileSync(new URL("../routes/classroom-rewards.ts", import.meta.url), "utf8");
    for (const table of ["credit_accounts", "credit_transactions", "xp_", "game_scores", "kids_adventure_states"]) {
      expect(route).not.toContain(table);
    }
    // Assignment evidence is an allowed automatic source, never a score mutation.
    expect(route).toContain("assignment_submission");
  });

  it("uses immutable teacher class identity for new ledger filtering", () => {
    const route = readFileSync(new URL("../routes/classroom-rewards.ts", import.meta.url), "utf8");
    expect(route).toContain("teacher_class_id");
    expect(route).toContain("ownedClass");
    expect(route).not.toContain("current_student");
  });

  it("preserves deleted-student ledger identity through snapshot and LEFT JOIN", () => {
    const route = readFileSync(new URL("../routes/classroom-rewards.ts", import.meta.url), "utf8");
    const migration = readFileSync(new URL("../../../../scripts/migrations/2026-06-13-classroom-rewards.sql", import.meta.url), "utf8");
    expect(route).toContain("LEFT JOIN students s");
    expect(route).toContain("COALESCE(s.name,tr.student_name_snapshot)");
    expect(route).toContain("student_name_snapshot");
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("ALTER COLUMN student_id DROP NOT NULL");
    expect(route).toContain("اسم نوع التحفيز مستخدم بالفعل");
  });

  it("wires submission relinking through the locked active-grant guard", () => {
    const route=readFileSync(new URL("../routes/submissions.ts",import.meta.url),"utf8");
    const handler=route.slice(route.indexOf('router.patch("/submissions/:submissionId/student-link"'),route.indexOf('router.get("/assignments/:id/export-csv"'));
    expect(handler).toContain("FOR UPDATE");
    expect(handler).toContain("lockAssignmentRewardEvidence");
    expect(handler).toContain("hasActiveAutomaticAssignmentGrant");
    expect(handler).toContain('status(409)');
  });
});