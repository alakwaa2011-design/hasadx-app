/**
 * اختبارات تكاملية — رصيد الترحيب المجاني (مرة واحدة)
 *
 * W1. معلم جديد بلا دفعة مجانية → يحصل على 50 نقطة ترحيبية (مرة واحدة)
 * W2. معلم لديه دفعة مجانية نشطة → لا تُمنح دفعة ثانية عند استدعاء grantWelcomeCredits
 * W3. معلم لديه دفعة مجانية منتهية ومصروفة → لا تُمنح دفعة ثانية (لا تجديد شهري)
 * W4. صلاحية الدفعة الترحيبية تكون NULL — لا تاريخ انتهاء
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreditService } from "../lib/credit-service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RUN_ID = `wc${Date.now()}`;

async function createTeacher(suffix: string): Promise<number> {
  const email = `${RUN_ID}_${suffix}@test.local`;
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${email}, 'x', NOW())
    RETURNING id
  `);
  return Number((r.rows[0] as any).id);
}

async function seedAccount(tid: number, balance = 0): Promise<void> {
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, free_balance, total_earned, updated_at)
    VALUES (${tid}, ${balance}, ${balance}, ${balance}, NOW())
    ON CONFLICT (teacher_id) DO NOTHING
  `);
}

async function cleanTeacher(tid: number): Promise<void> {
  await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${tid})`);
  await db.execute(sql`DELETE FROM credit_holds     WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_batches   WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_accounts  WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM teachers         WHERE id = ${tid}`);
}

async function getFreeBatches(tid: number) {
  const r = await db.execute(sql`
    SELECT id, amount, amount_remaining, expires_at, reference_id
    FROM credit_batches
    WHERE teacher_id = ${tid} AND source = 'free'
    ORDER BY id ASC
  `);
  return r.rows as any[];
}

async function getFreeBalance(tid: number): Promise<number> {
  const r = await db.execute(sql`
    SELECT free_balance FROM credit_accounts WHERE teacher_id = ${tid}
  `);
  return Number((r.rows[0] as any)?.free_balance ?? 0);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("رصيد الترحيب المجاني — grantWelcomeCredits", () => {
  const tids: number[] = [];
  beforeAll(async () => {});
  afterAll(async () => {
    for (const tid of tids) await cleanTeacher(tid).catch(() => {});
  });

  it("W1 — معلم جديد يحصل على 50 نقطة ترحيبية (مرة واحدة)", async () => {
    const tid = await createTeacher("w1");
    tids.push(tid);
    await seedAccount(tid);

    await CreditService.grantWelcomeCredits(tid);

    const batches = await getFreeBatches(tid);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);
    expect(Number(batches[0].amount_remaining)).toBe(50);
    expect(batches[0].reference_id).toBe("welcome_credits");

    const bal = await getFreeBalance(tid);
    expect(bal).toBe(50);
  });

  it("W2 — معلم لديه دفعة مجانية نشطة لا يحصل على دفعة ثانية", async () => {
    const tid = await createTeacher("w2");
    tids.push(tid);
    await seedAccount(tid, 50);

    // دفعة أولى تمثل رصيد ترحيبي نشط
    await db.execute(sql`
      INSERT INTO credit_batches
        (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
      VALUES (${tid}, 'free', 50, 50, NULL, 'welcome_credits', NOW(), NOW())
    `);

    // استدعاء مرة ثانية — يجب أن يكون no-op
    await CreditService.grantWelcomeCredits(tid);

    const batches = await getFreeBatches(tid);
    expect(batches).toHaveLength(1);           // لا تزال دفعة واحدة فقط
    expect(Number(batches[0].amount_remaining)).toBe(50); // لم تتغير
  });

  it("W3 — معلم دفعته المجانية منتهية (مصروفة بالكامل) لا يحصل على تجديد شهري", async () => {
    const tid = await createTeacher("w3");
    tids.push(tid);
    await seedAccount(tid, 0);

    // دفعة قديمة منتهية (مصروفة + تاريخ انتهاء في الماضي — تمثل حالة النظام القديم)
    await db.execute(sql`
      INSERT INTO credit_batches
        (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
      VALUES (${tid}, 'free', 50, 0, NOW() - INTERVAL '1 day', 'welcome_credits', NOW() - INTERVAL '31 days', NOW())
    `);

    // استدعاء grantWelcomeCredits — يجب أن يكون no-op لأن دفعة مجانية قديمة موجودة
    await CreditService.grantWelcomeCredits(tid);

    const batches = await getFreeBatches(tid);
    expect(batches).toHaveLength(1);   // لا تزال الدفعة القديمة فقط
    expect(Number(batches[0].amount_remaining)).toBe(0); // لم يُضف رصيد جديد

    const bal = await getFreeBalance(tid);
    expect(bal).toBe(0);              // الرصيد المجاني لا يزال صفراً
  });

  it("W4 — الدفعة الترحيبية لا تحمل تاريخ انتهاء (expires_at = NULL)", async () => {
    const tid = await createTeacher("w4");
    tids.push(tid);
    await seedAccount(tid);

    await CreditService.grantWelcomeCredits(tid);

    const batches = await getFreeBatches(tid);
    expect(batches).toHaveLength(1);
    expect(batches[0].expires_at).toBeNull();   // لا تنتهي أبداً
  });

  it("W5 — استدعاء grantWelcomeCredits مرتين متتاليتين → دفعة واحدة فقط", async () => {
    const tid = await createTeacher("w5");
    tids.push(tid);
    await seedAccount(tid);

    await Promise.all([
      CreditService.grantWelcomeCredits(tid),
      CreditService.grantWelcomeCredits(tid),
    ]);

    const batches = await getFreeBatches(tid);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);
  });
});
