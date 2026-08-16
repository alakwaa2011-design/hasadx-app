/**
 * اختبارات تكاملية لسياسة نقاط «استخراج أسئلة من مصدر» — DB حقيقي بدون mocks.
 *
 * X1. Basic ورصيد كافٍ: حجز 10 ثم capture → خصم 10 مرة واحدة وحركة واحدة
 * X2. Pro ورصيد كافٍ: حجز 8 فقط (الخصم المركزي 20% في CreditService.hold)
 * X3. رصيد غير كافٍ: hold يرمي خطأً عربيًا بحقول required/balance، لا خصم ولا حركة
 * X4. فشل بعد الخصم: refund يعيد الرصيد كاملًا بنفس المرجع
 * X5. Idempotency: نفس requestId مرتين (تسلسليًا) → حجز واحد وخصم واحد
 * X6. النقر المتزامن: نفس requestId بالتوازي → خصم واحد فقط
 * X7. getEffectiveCost: يعيد baseCost=10 و effectiveCost=8 لمعلم Pro
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CreditService } from "../lib/credit-service";
import { checkCredits, captureCredits, invalidateCreditsSettingsCache } from "../lib/check-credits";

const TOOL = "extract_questions_from_source";
const RUN_ID = `xc${Date.now()}`;
const teachers: number[] = [];

/* يعمل فقط تحت vitest.integration.config.ts — الذي يوجّه DATABASE_URL إلى
   قاعدة الاختبار. تحت الإعداد الافتراضي (db mocked) تُتخطى الحزمة كاملة. */
const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const d = RUN_INTEGRATION ? describe : describe.skip;

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

async function seedProSubscription(tid: number): Promise<void> {
  const planRow = await db.execute(sql`SELECT id FROM plans WHERE code = 'pro' LIMIT 1`);
  if (!planRow.rows[0]) {
    await db.execute(sql`
      INSERT INTO plans (code, name, created_at) VALUES ('pro', 'Pro', NOW())
      ON CONFLICT DO NOTHING
    `);
  }
  const p2 = await db.execute(sql`SELECT id FROM plans WHERE code = 'pro' LIMIT 1`);
  const planId = Number((p2.rows[0] as any).id);
  await db.execute(sql`
    INSERT INTO subscriptions
      (teacher_id, plan_id, status, payment_status, external_subscription_id,
       payment_provider, started_at, created_at, updated_at)
    VALUES
      (${tid}, ${planId}, 'active', 'active', ${"sub_" + RUN_ID + "_" + tid},
       'lemonsqueezy', NOW(), NOW(), NOW())
  `);
}

async function txCount(tid: number): Promise<number> {
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM credit_transactions
    WHERE teacher_id = ${tid} AND tool_key = ${TOOL}
  `);
  return Number((r.rows[0] as any).c);
}

d("سياسة نقاط استخراج الأسئلة من مصدر", () => {
  beforeAll(async () => {
    // Test DB lacks the boot-time seed — normalise the tool row (10 credits).
    await db.execute(sql`
      INSERT INTO credit_tool_prices (tool_key, tool_name_ar, category, credits_cost, default_credits_cost, timeout_seconds)
      VALUES (${TOOL}, 'استخراج أسئلة من مصدر', 'ai', 10, 10, 180)
      ON CONFLICT (tool_key) DO UPDATE SET credits_cost = 10
    `);
  });

  afterAll(async () => {
    for (const tid of teachers) {
      await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${tid})`);
      await db.execute(sql`DELETE FROM credit_holds WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM teachers WHERE id = ${tid}`);
    }
  });

  it("X1: معلم Basic — حجز 10 ثم capture → خصم 10 مرة واحدة", async () => {
    const tid = await createTeacher("basic");
    await seedBalance(tid, 50);
    const rid = randomUUID();
    const hold = await CreditService.hold(tid, TOOL, rid);
    expect(hold.creditsHeld).toBe(10);
    await CreditService.capture(rid);
    expect(await CreditService.getBalance(tid)).toBe(40);
    expect(await txCount(tid)).toBe(1);
  });

  it("X2: معلم Pro — حجز 8 فقط عبر الخصم المركزي", async () => {
    const tid = await createTeacher("pro");
    await seedBalance(tid, 50);
    await seedProSubscription(tid);
    const rid = randomUUID();
    const hold = await CreditService.hold(tid, TOOL, rid);
    expect(hold.creditsHeld).toBe(8);
    await CreditService.capture(rid);
    expect(await CreditService.getBalance(tid)).toBe(42);
  });

  it("X3: رصيد غير كافٍ — خطأ عربي بحقول required/balance ولا خصم", async () => {
    const tid = await createTeacher("poor");
    await seedBalance(tid, 3);
    let threw: any = null;
    try {
      await CreditService.hold(tid, TOOL, randomUUID());
    } catch (e) { threw = e; }
    expect(threw).toBeTruthy();
    expect(String(threw.message)).toContain("رصيد غير كافٍ");
    expect(threw.required).toBe(10);
    expect(threw.balance).toBe(3);
    expect(await CreditService.getBalance(tid)).toBe(3);
    expect(await txCount(tid)).toBe(0);
  });

  it("X4: فشل بعد الخصم — refund يعيد الرصيد كاملًا", async () => {
    const tid = await createTeacher("refund");
    await seedBalance(tid, 20);
    const rid = randomUUID();
    await CreditService.hold(tid, TOOL, rid);
    expect(await CreditService.getBalance(tid)).toBe(10);
    await CreditService.refund(rid, "فشل التوليد بعد الخصم");
    expect(await CreditService.getBalance(tid)).toBe(20);
    const r = await db.execute(sql`SELECT status FROM credit_holds WHERE request_id = ${rid}`);
    expect((r.rows[0] as any).status).toBe("refunded");
  });

  it("X5: نفس requestId مرتين — حجز واحد وخصم واحد", async () => {
    const tid = await createTeacher("idem");
    await seedBalance(tid, 30);
    const rid = randomUUID();
    const h1 = await CreditService.hold(tid, TOOL, rid);
    const h2 = await CreditService.hold(tid, TOOL, rid);
    expect(h1.creditsHeld).toBe(10);
    expect(h2.creditsHeld).toBe(10);
    expect(await CreditService.getBalance(tid)).toBe(20); // خُصم مرة واحدة فقط
    await CreditService.capture(rid);
    await CreditService.capture(rid); // capture مكرر لا يخصم مجددًا
    expect(await CreditService.getBalance(tid)).toBe(20);
    const r = await db.execute(sql`SELECT COUNT(*)::int AS c FROM credit_holds WHERE request_id = ${rid}`);
    expect(Number((r.rows[0] as any).c)).toBe(1);
  });

  it("X6: النقر المتزامن بنفس requestId — خصم واحد فقط", async () => {
    const tid = await createTeacher("race");
    await seedBalance(tid, 30);
    const rid = randomUUID();
    const results = await Promise.allSettled([
      CreditService.hold(tid, TOOL, rid),
      CreditService.hold(tid, TOOL, rid),
    ]);
    // Both must succeed (loser of the unique-key race resolves to the winner's hold)
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await CreditService.getBalance(tid)).toBe(20);
    const r = await db.execute(sql`SELECT COUNT(*)::int AS c FROM credit_holds WHERE request_id = ${rid}`);
    expect(Number((r.rows[0] as any).c)).toBe(1);
  });

  it("X8: تزامن برصيد يكفي لمرة واحدة فقط — كلا الطلبين ينجح والخصم مرة واحدة", async () => {
    // يكشف سباق ترتيب القفل: الخاسر يجب أن يجد حجز الفائز تحت قفل الحساب
    // بدلاً من رؤية «رصيد غير كافٍ» بعد خصم الفائز.
    const tid = await createTeacher("race10");
    await seedBalance(tid, 10); // يكفي لعملية واحدة بالضبط
    const rid = randomUUID();
    const results = await Promise.allSettled([
      CreditService.hold(tid, TOOL, rid),
      CreditService.hold(tid, TOOL, rid),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await CreditService.getBalance(tid)).toBe(0);
    const r = await db.execute(sql`SELECT COUNT(*)::int AS c FROM credit_holds WHERE request_id = ${rid}`);
    expect(Number((r.rows[0] as any).c)).toBe(1);
  });

  it("X9: إعادة نفس المفتاح بعد refund — يعود existingStatus='refunded' ولا خصم", async () => {
    const tid = await createTeacher("replay");
    await seedBalance(tid, 20);
    const rid = randomUUID();
    await CreditService.hold(tid, TOOL, rid);
    await CreditService.refund(rid, "فشل");
    expect(await CreditService.getBalance(tid)).toBe(20);
    const replay = await CreditService.hold(tid, TOOL, rid);
    expect(replay.existingStatus).toBe("refunded"); // الوسيط يحوّلها إلى 409 لا تشغيل مجاني
    expect(await CreditService.getBalance(tid)).toBe(20); // لا خصم ثانٍ
    // capture على حجز مسترد لا يفعل شيئًا (يحدّث pending فقط)
    await CreditService.capture(rid);
    const st = await db.execute(sql`SELECT status FROM credit_holds WHERE request_id = ${rid}`);
    expect((st.rows[0] as any).status).toBe("refunded");
  });

  it("X10: إعادة نفس X-Idempotency-Key بعد النجاح → 200 بنفس النتيجة المخزنة، بلا خصم أو توليد جديد", async () => {
    const tid = await createTeacher("okreplay");
    await seedBalance(tid, 50);

    // فعّل نظام النقاط في إعدادات المنصة (مع استعادة الحالة السابقة)
    const prevRow = await db.execute(sql`SELECT id, credits_enabled FROM platform_settings LIMIT 1`);
    const hadRow = !!prevRow.rows[0];
    const prevEnabled = hadRow ? !!(prevRow.rows[0] as any).credits_enabled : null;
    if (hadRow) {
      await db.execute(sql`UPDATE platform_settings SET credits_enabled = TRUE WHERE id = ${(prevRow.rows[0] as any).id}`);
    } else {
      await db.execute(sql`INSERT INTO platform_settings (credits_enabled) VALUES (TRUE)`);
    }
    invalidateCreditsSettingsCache();

    try {
      const middleware = checkCredits(TOOL);
      const clientKey = randomUUID();
      let aiGeneratorCalls = 0;
      const storedResult = { questions: [{ text: "س: ما ناتج 2+2؟", questionType: "mcq" }] };

      const makeReqRes = () => {
        const state = { nextCalled: false, statusCode: 0, body: undefined as unknown };
        const req = {
          session: { teacherId: tid },
          get: (h: string) => (h.toLowerCase() === "x-idempotency-key" ? clientKey : undefined),
        } as any;
        const res = {
          status(code: number) { state.statusCode = code; return this; },
          json(payload: unknown) { state.body = payload; return this; },
        } as any;
        const next = () => { state.nextCalled = true; };
        return { req, res, next, state };
      };

      // 1) الطلب الأول: يمر الوسيط → «المولد» يعمل → capture مع تخزين النتيجة
      const r1 = makeReqRes();
      await middleware(r1.req, r1.res, r1.next);
      expect(r1.state.nextCalled).toBe(true);
      aiGeneratorCalls++;
      await captureCredits(r1.req, storedResult);
      expect(await CreditService.getBalance(tid)).toBe(40); // خصم 10 مرة واحدة

      // 2) إعادة نفس المفتاح (العميل فقد الرد): 200 بنفس النتيجة، بلا next()
      const r2 = makeReqRes();
      await middleware(r2.req, r2.res, r2.next);
      expect(r2.state.nextCalled).toBe(false); // المولد لم يُستدعَ ثانية
      expect(r2.state.statusCode).toBe(200);
      expect(r2.state.body).toEqual(storedResult);
      expect(aiGeneratorCalls).toBe(1);

      // 3) لا خصم إضافي ولا حجز ثانٍ
      expect(await CreditService.getBalance(tid)).toBe(40);
      const holds = await db.execute(sql`
        SELECT COUNT(*)::int AS c FROM credit_holds WHERE teacher_id = ${tid}
      `);
      expect(Number((holds.rows[0] as any).c)).toBe(1);
    } finally {
      if (hadRow) {
        await db.execute(sql`UPDATE platform_settings SET credits_enabled = ${prevEnabled} WHERE id = ${(prevRow.rows[0] as any).id}`);
      } else {
        await db.execute(sql`DELETE FROM platform_settings WHERE credits_enabled = TRUE`);
      }
      invalidateCreditsSettingsCache();
    }
  });

  it("X11: مفتاح قيد التنفيذ (pending) — الوسيط يرفض بـ 409 ولا يشغّل المولد ثانية", async () => {
    const tid = await createTeacher("pending");
    await seedBalance(tid, 50);

    const prevRow = await db.execute(sql`SELECT id, credits_enabled FROM platform_settings LIMIT 1`);
    const hadRow = !!prevRow.rows[0];
    const prevEnabled = hadRow ? !!(prevRow.rows[0] as any).credits_enabled : null;
    if (hadRow) {
      await db.execute(sql`UPDATE platform_settings SET credits_enabled = TRUE WHERE id = ${(prevRow.rows[0] as any).id}`);
    } else {
      await db.execute(sql`INSERT INTO platform_settings (credits_enabled) VALUES (TRUE)`);
    }
    invalidateCreditsSettingsCache();

    try {
      const middleware = checkCredits(TOOL);
      const clientKey = randomUUID();
      const makeReqRes = () => {
        const state = { nextCalled: false, statusCode: 0, body: undefined as any };
        const req = {
          session: { teacherId: tid },
          get: (h: string) => (h.toLowerCase() === "x-idempotency-key" ? clientKey : undefined),
        } as any;
        const res = {
          status(code: number) { state.statusCode = code; return this; },
          json(payload: unknown) { state.body = payload; return this; },
        } as any;
        return { req, res, next: () => { state.nextCalled = true; }, state };
      };

      // الطلب الأول يمر (الحجز pending — «المولد» ما يزال يعمل)
      const r1 = makeReqRes();
      await middleware(r1.req, r1.res, r1.next);
      expect(r1.state.nextCalled).toBe(true);

      // طلب متزامن بنفس المفتاح قبل capture → 409 REQUEST_IN_PROGRESS
      const r2 = makeReqRes();
      await middleware(r2.req, r2.res, r2.next);
      expect(r2.state.nextCalled).toBe(false);
      expect(r2.state.statusCode).toBe(409);
      expect(r2.state.body?.code).toBe("REQUEST_IN_PROGRESS");
      expect(await CreditService.getBalance(tid)).toBe(40); // حجز واحد فقط
    } finally {
      if (hadRow) {
        await db.execute(sql`UPDATE platform_settings SET credits_enabled = ${prevEnabled} WHERE id = ${(prevRow.rows[0] as any).id}`);
      } else {
        await db.execute(sql`DELETE FROM platform_settings WHERE credits_enabled = TRUE`);
      }
      invalidateCreditsSettingsCache();
    }
  });

  it("X7: getEffectiveCost — baseCost=10 و effectiveCost=8 لمعلم Pro", async () => {
    const tid = await createTeacher("cost");
    await seedProSubscription(tid);
    const c = await CreditService.getEffectiveCost(tid, TOOL);
    expect(c.baseCost).toBe(10);
    expect(c.effectiveCost).toBe(8);
    expect(c.isPro).toBe(true);
  });
});
