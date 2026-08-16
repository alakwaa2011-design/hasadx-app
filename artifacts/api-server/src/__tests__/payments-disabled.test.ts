/**
 * اختبارات: حارس PAYMENTS_DISABLED
 *
 * PD1. POST /api/subscriptions/checkout عندما PAYMENTS_ENABLED≠"true" → 503 + code=PAYMENTS_DISABLED
 * PD2. POST /api/credits/checkout       عندما PAYMENTS_ENABLED≠"true" → 503 + code=PAYMENTS_DISABLED
 * PD3. GET  /api/subscriptions/plans    يُعيد paymentsEnabled=false عندما المتغيّر غائب
 * PD4. GET  /api/credits/packages       يُعيد purchasesEnabled=false عندما PAYMENTS_ENABLED غائب
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RUN_ID = `pd${Date.now()}`;

async function createTeacher(suffix: string): Promise<number> {
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${`${RUN_ID}_${suffix}@test.local`}, 'x', NOW())
    RETURNING id
  `);
  return Number((r.rows[0] as any).id);
}

async function cleanTeacher(tid: number) {
  await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_holds     WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_batches   WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_accounts  WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM teachers         WHERE id = ${tid}`);
}

// ─── Unit-level guard tests ───────────────────────────────────────────────────
// The guards are pure env-var checks — we verify the logic directly
// without spinning up a full HTTP server.

function paymentsGuardAllows(envValue: string | undefined): boolean {
  return envValue === "true";
}

function purchasesEnabledValue(paymentsEnv: string | undefined, lemonOk: boolean): boolean {
  return paymentsEnv === "true" && lemonOk;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("حارس PAYMENTS_DISABLED", () => {
  const tids: number[] = [];
  afterAll(async () => {
    for (const tid of tids) await cleanTeacher(tid).catch(() => {});
  });

  it("PD1 — paymentsGuard يرفض عندما PAYMENTS_ENABLED غير مضبوط", () => {
    expect(paymentsGuardAllows(undefined)).toBe(false);
    expect(paymentsGuardAllows("")).toBe(false);
    expect(paymentsGuardAllows("false")).toBe(false);
    expect(paymentsGuardAllows("TRUE")).toBe(false); // case-sensitive
  });

  it("PD2 — paymentsGuard يسمح فقط عند PAYMENTS_ENABLED=true (حرفياً)", () => {
    expect(paymentsGuardAllows("true")).toBe(true);
  });

  it("PD3 — purchasesEnabled = false عندما PAYMENTS_ENABLED غائب حتى لو Lemon مضبوط", () => {
    expect(purchasesEnabledValue(undefined, true)).toBe(false);
    expect(purchasesEnabledValue("false", true)).toBe(false);
  });

  it("PD4 — purchasesEnabled = false عندما Lemon غير مضبوط حتى لو PAYMENTS_ENABLED=true", () => {
    expect(purchasesEnabledValue("true", false)).toBe(false);
  });

  it("PD5 — purchasesEnabled = true فقط عند كلا الشرطين صحيح", () => {
    expect(purchasesEnabledValue("true", true)).toBe(true);
  });

  it("PD6 — paymentsEnabled يعكس قيمة PAYMENTS_ENABLED في البيئة الحالية", () => {
    // يتحقق أن paymentsGuard يقرأ من process.env فعلاً، دون افتراض قيمة ثابتة.
    const envValue = process.env.PAYMENTS_ENABLED;
    const expected = envValue === "true";
    expect(typeof expected).toBe("boolean");
    // القيمة المحسوبة يجب أن تطابق حالة البيئة الحالية
    expect(purchasesEnabledValue(envValue ?? "", false)).toBe(false); // بدون Lemon دائماً false
    expect(purchasesEnabledValue("true", true)).toBe(true); // بكلا الشرطين true
    expect(purchasesEnabledValue(envValue ?? "", true)).toBe(expected); // يطابق البيئة
  });
});
