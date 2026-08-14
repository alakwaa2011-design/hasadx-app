/**
 * اختبارات تكاملية لاستهلاك النقاط عبر الأدوات — DB حقيقي بدون mocks.
 *
 * C1. Basic: توليد الأسئلة (ai-questions) يحجز 10 ثم capture → خصم 10 وحركة واحدة
 * C2. Pro:   نفس الأداة تحجز 8 فقط (خصم 20% مركزي في CreditService.hold)
 * C3. Basic: الخريطة الذهنية (mindmap) 5 — Pro: 4
 * C4. رصيد غير كافٍ → hold يرمي خطأً عربيًا، لا خصم ولا حركة
 * C5. فشل التوليد (refund) → يعود الرصيد كاملًا، الحركة تصبح refunded
 * C6. Idempotency: نفس requestId مرتين → حجز واحد فقط؛ capture مكرر لا يخصم مجددًا
 * C7. presentation-slide مسعّرة (5) — المفتاح الجديد موجود في credit_tool_prices
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CreditService } from "../lib/credit-service";

const RUN_ID = `cc${Date.now()}`;
const teachers: number[] = [];

async function createTeacher(suffix: string): Promise<number> {
  const email = `${RUN_ID}_${suffix}@test.local`;
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${email}, 'x', NOW()) RETURNING id
  `);
  const id = Number((r.rows[0] as any).id);
  teachers.push(id);
  return id;
}

async function seedBalance(tid: number, amount: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, created_at)
    VALUES (${tid}, 'purchased', ${amount}, ${amount}, NOW())
  `);
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, paid_balance, total_earned)
    VALUES (${tid}, ${amount}, ${amount}, ${amount})
    ON CONFLICT (teacher_id) DO UPDATE
      SET balance = ${amount}, paid_balance = ${amount}, total_earned = ${amount}
  `);
}

async function seedSubscription(tid: number, planCode: "basic" | "pro"): Promise<void> {
  const planRow = await db.execute(sql`SELECT id FROM plans WHERE code = ${planCode} LIMIT 1`);
  if (!planRow.rows[0]) throw new Error(`Plan '${planCode}' not found`);
  const planId = Number((planRow.rows[0] as any).id);
  await db.execute(sql`
    INSERT INTO subscriptions
      (teacher_id, plan_id, status, payment_status, external_subscription_id,
       payment_provider, started_at, created_at, updated_at)
    VALUES
      (${tid}, ${planId}, 'active', 'active', ${'sub_' + RUN_ID + '_' + tid},
       'lemonsqueezy', NOW(), NOW(), NOW())
  `);
}

async function balance(tid: number): Promise<number> {
  return CreditService.getBalance(tid);
}

async function spendTxCount(tid: number): Promise<number> {
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM credit_transactions
    WHERE teacher_id = ${tid} AND type = 'spend'
  `);
  return Number((r.rows[0] as any).c);
}

beforeAll(async () => {
  // نفس seed التشغيل في index.ts — قاعدة الاختبار قد لا تحتوي المفتاح الجديد بعد
  await db.execute(sql`
    INSERT INTO credit_tool_prices (tool_key, tool_name_ar, category, credits_cost, default_credits_cost, timeout_seconds)
    VALUES
      ('presentation-slide','توليد شريحة واحدة','ai', 5, 5,120),
      ('ai-questions',      'توليد أسئلة AI',   'ai',10,10,120),
      ('mindmap',           'الخريطة الذهنية',  'ai', 5, 5,120)
    ON CONFLICT (tool_key) DO NOTHING
  `);
  // ثبّت التكلفة حتى لو كانت الصفوف موجودة بقيم مخصصة قديمة في قاعدة الاختبار
  await db.execute(sql`UPDATE credit_tool_prices SET credits_cost = 10 WHERE tool_key = 'ai-questions'`);
  await db.execute(sql`UPDATE credit_tool_prices SET credits_cost = 5  WHERE tool_key = 'mindmap'`);
});

afterAll(async () => {
  for (const tid of teachers) {
    await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${tid})`);
    await db.execute(sql`DELETE FROM credit_holds        WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM credit_batches      WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM credit_accounts     WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM subscriptions       WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM teachers            WHERE id = ${tid}`);
  }
});

describe("C1/C2 — ai-questions: Basic يخصم 10، Pro يخصم 8", () => {
  it("Basic: hold=10، capture يثبّت الخصم، حركة spend واحدة", async () => {
    const tid = await createTeacher("basic_q");
    await seedSubscription(tid, "basic");
    await seedBalance(tid, 100);

    const reqId = randomUUID();
    const { creditsHeld, newBalance } = await CreditService.hold(tid, "ai-questions", reqId);
    expect(creditsHeld).toBe(10);
    expect(newBalance).toBe(90);

    await CreditService.capture(reqId);
    expect(await balance(tid)).toBe(90);
    expect(await spendTxCount(tid)).toBe(1);
  });

  it("Pro: hold=8 (خصم 20% مركزي وليس في الواجهة)", async () => {
    const tid = await createTeacher("pro_q");
    await seedSubscription(tid, "pro");
    await seedBalance(tid, 100);

    const reqId = randomUUID();
    const { creditsHeld } = await CreditService.hold(tid, "ai-questions", reqId);
    expect(creditsHeld).toBe(8);

    await CreditService.capture(reqId);
    expect(await balance(tid)).toBe(92);
    expect(await spendTxCount(tid)).toBe(1);
  });
});

describe("C3 — mindmap: Basic=5، Pro=4", () => {
  it("Basic يخصم 5", async () => {
    const tid = await createTeacher("basic_m");
    await seedSubscription(tid, "basic");
    await seedBalance(tid, 20);
    const reqId = randomUUID();
    const { creditsHeld } = await CreditService.hold(tid, "mindmap", reqId);
    expect(creditsHeld).toBe(5);
    await CreditService.capture(reqId);
    expect(await balance(tid)).toBe(15);
  });

  it("Pro يخصم 4 (ceil(5*0.8))", async () => {
    const tid = await createTeacher("pro_m");
    await seedSubscription(tid, "pro");
    await seedBalance(tid, 20);
    const reqId = randomUUID();
    const { creditsHeld } = await CreditService.hold(tid, "mindmap", reqId);
    expect(creditsHeld).toBe(4);
    await CreditService.capture(reqId);
    expect(await balance(tid)).toBe(16);
  });
});

describe("C4 — رصيد غير كافٍ", () => {
  it("hold يرمي خطأً عربيًا ولا يخصم شيئًا ولا يسجل حركة", async () => {
    const tid = await createTeacher("broke");
    await seedBalance(tid, 3);

    const reqId = randomUUID();
    await expect(CreditService.hold(tid, "ai-questions", reqId)).rejects.toThrow(/رصيد غير كافٍ/);
    expect(await balance(tid)).toBe(3);
    expect(await spendTxCount(tid)).toBe(0);
  });
});

describe("C5 — فشل التوليد → refund كامل", () => {
  it("refund يعيد الرصيد للدفعة نفسها ولا يبقى خصم", async () => {
    const tid = await createTeacher("refund");
    await seedBalance(tid, 50);

    const reqId = randomUUID();
    await CreditService.hold(tid, "ai-questions", reqId);
    expect(await balance(tid)).toBe(40);

    await CreditService.refund(reqId, "فشل التوليد (اختبار)");
    expect(await balance(tid)).toBe(50);

    const batch = await db.execute(sql`
      SELECT amount_remaining FROM credit_batches WHERE teacher_id = ${tid}
    `);
    expect(Number((batch.rows[0] as any).amount_remaining)).toBe(50);
  });
});

describe("C6 — idempotency: لا خصم مكرر", () => {
  it("نفس requestId مرتين → حجز واحد فقط", async () => {
    const tid = await createTeacher("idem");
    await seedBalance(tid, 50);

    const reqId = randomUUID();
    await CreditService.hold(tid, "ai-questions", reqId);
    const second = await CreditService.hold(tid, "ai-questions", reqId);
    expect(second.creditsHeld).toBe(10);
    expect(await balance(tid)).toBe(40); // خصم واحد لا اثنان

    await CreditService.capture(reqId);
    await CreditService.capture(reqId); // capture مكرر — لا أثر
    expect(await balance(tid)).toBe(40);
    expect(await spendTxCount(tid)).toBe(1);
  });

  it("refund بعد capture لا يعيد نقاطًا (الحجز لم يعد pending)", async () => {
    const tid = await createTeacher("idem2");
    await seedBalance(tid, 50);
    const reqId = randomUUID();
    await CreditService.hold(tid, "ai-questions", reqId);
    await CreditService.capture(reqId);
    await CreditService.refund(reqId, "محاولة استرجاع بعد النجاح");
    expect(await balance(tid)).toBe(40);
  });
});

describe("C7 — المفتاح الجديد presentation-slide", () => {
  it("مسعّر بـ5 نقاط في credit_tool_prices", async () => {
    const r = await db.execute(sql`
      SELECT credits_cost FROM credit_tool_prices WHERE tool_key = 'presentation-slide'
    `);
    expect(r.rows.length).toBe(1);
    expect(Number((r.rows[0] as any).credits_cost)).toBe(5);
  });
});
