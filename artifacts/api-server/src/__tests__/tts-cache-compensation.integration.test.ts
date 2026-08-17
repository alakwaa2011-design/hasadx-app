/**
 * اختبارات تكاملية لنظام cache صوت TTS — التعافي والتعويض (الخطة المعتمدة v1–v5).
 *
 * T1. completed + ملف مفقود نهائياً (404 مؤكد): تعويض النقاط مرة واحدة بالضبط،
 *     الرصيد يعود رقمياً، الاستدعاء الثاني لا يضيف نقاطاً، السجل failed،
 *     لا صوت يُقدَّم ولا محاولة تلقائية جديدة.
 * T2. خطأ تخزين مؤقت (timeout/5xx) أثناء التعافي: صفر تعويض، صفر حذف،
 *     السجل يبقى pending؛ ثم عندما يؤكد الفحص 404 → تعويض مرة واحدة بالضبط.
 * T3. capture غامض والحجز مكتمل فعلاً + الملف موجود: ready بلا refund ولا تعويض.
 * T4. capture غامض واستعلام حالة الحجز يفشل: يبقى pending غير قابل للتقديم،
 *     صفر إجراءات مالية.
 * T5. حجز pending (انقطاع قبل التحصيل): refund مرة واحدة والسجل failed.
 * T6. compensateCapturedHold لا يمس حجزاً pending (نطاقه completed فقط).
 * T7. الاستحواذ الذرّي: INSERT ON CONFLICT — فائز واحد فقط لنفس المفتاح.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CreditService } from "../lib/credit-service";
import {
  buildTtsCacheKey,
  tryInsertPending,
  getCacheRowById,
  resolveUncertainCapture,
} from "../lib/tts-cache";

const RUN_ID = `ttsc${Date.now()}`;
const teachers: number[] = [];

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const d = RUN_INTEGRATION ? describe : describe.skip;

const TOOL = "tts";

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

async function getBalance(tid: number): Promise<number> {
  const r = await db.execute(sql`SELECT balance FROM credit_accounts WHERE teacher_id = ${tid}`);
  return Number((r.rows[0] as any)?.balance ?? 0);
}

async function insertPendingRow(tid: number, textSuffix: string, requestId: string, storageKey?: string) {
  const key = buildTtsCacheKey(`نص اختبار ${RUN_ID} ${textSuffix}`, "nova");
  const row = await tryInsertPending(tid, key, requestId);
  expect(row).toBeDefined();
  if (storageKey) {
    await db.execute(sql`
      UPDATE tts_audio_cache SET storage_key = ${storageKey} WHERE id = ${row!.id}
    `);
  }
  return (await getCacheRowById(row!.id))!;
}

d("TTS cache — التعافي والتعويض (DB حقيقي)", () => {
  beforeAll(async () => {
    // قاعدة الاختبار قد لا تحتوي الجدول بعد — نفس DDL في runSchemaMigrations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tts_audio_cache (
        id                SERIAL PRIMARY KEY,
        teacher_id        INTEGER NOT NULL,
        cache_key         TEXT NOT NULL,
        storage_key       TEXT,
        credit_request_id TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        size_bytes        INTEGER,
        error_message     TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        failed_at         TIMESTAMP,
        last_used_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT tts_audio_cache_teacher_key_uq UNIQUE (teacher_id, cache_key)
      )
    `);
    await db.execute(sql`
      INSERT INTO credit_tool_prices (tool_key, tool_name_ar, category, credits_cost, default_credits_cost, timeout_seconds)
      VALUES (${TOOL}, 'تحويل نص إلى كلام', 'ai', 2, 2, 60)
      ON CONFLICT (tool_key) DO UPDATE SET credits_cost = 2
    `);
  });

  afterAll(async () => {
    for (const tid of teachers) {
      await db.execute(sql`DELETE FROM tts_audio_cache WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${tid})`);
      await db.execute(sql`DELETE FROM credit_holds WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${tid}`);
      await db.execute(sql`DELETE FROM teachers WHERE id = ${tid}`);
    }
  });

  it("T1: completed + ملف مفقود نهائياً → تعويض مرة واحدة بالضبط، failed، لا محاولة جديدة", async () => {
    const tid = await createTeacher("t1");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t1", requestId, "/bucket/tts-cache/missing.mp3");

    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.capture(requestId);
    expect(await getBalance(tid)).toBe(8); // خُصمت نقطتان

    const missing = async () => "missing" as const;
    const res1 = await resolveUncertainCapture(row, { checkFile: missing });
    expect(res1.outcome).toBe("compensated");
    expect(await getBalance(tid)).toBe(10); // عادت النقاط كاملة

    const after1 = (await getCacheRowById(row.id))!;
    expect(after1.status).toBe("failed");
    expect(after1.errorMessage).toBe("charged_no_file_compensated");

    // استدعاء ثانٍ — لا نقاط إضافية (idempotent عبر الاستحواذ على completed)
    const direct = await CreditService.compensateCapturedHold(requestId);
    expect(direct.compensated).toBe(false);
    expect(await getBalance(tid)).toBe(10);

    // حركة تعويض واحدة فقط
    const tx = await db.execute(sql`
      SELECT COUNT(*) AS n FROM credit_transactions
      WHERE teacher_id = ${tid} AND type = 'compensation'
    `);
    expect(Number((tx.rows[0] as any).n)).toBe(1);
  });

  it("T2: خطأ تخزين مؤقت → صفر تعويض ويبقى pending؛ ثم 404 مؤكد → تعويض مرة واحدة", async () => {
    const tid = await createTeacher("t2");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t2", requestId, "/bucket/tts-cache/x.mp3");

    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.capture(requestId);
    expect(await getBalance(tid)).toBe(8);

    // فحص التخزين يرمي (timeout/5xx) — نتيجة غير حاسمة
    const transient = async () => { throw new Error("503 storage timeout"); };
    const res1 = await resolveUncertainCapture(row, { checkFile: transient as any });
    expect(res1.outcome).toBe("indeterminate");
    expect(await getBalance(tid)).toBe(8);                       // صفر تعويض
    expect((await getCacheRowById(row.id))!.status).toBe("pending"); // صفر تغيير حالة
    const holdStatus1 = await CreditService.getHoldStatus(requestId);
    expect(holdStatus1).toBe("completed");                        // صفر إجراءات مالية

    // لاحقاً: الفحص يعود ويؤكد 404
    const res2 = await resolveUncertainCapture((await getCacheRowById(row.id))!, {
      checkFile: async () => "missing" as const,
    });
    expect(res2.outcome).toBe("compensated");
    expect(await getBalance(tid)).toBe(10);
    expect((await getCacheRowById(row.id))!.status).toBe("failed");
  });

  it("T3: capture غامض والحجز مكتمل والملف موجود → ready بلا refund", async () => {
    const tid = await createTeacher("t3");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t3", requestId, "/bucket/tts-cache/ok.mp3");

    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.capture(requestId);

    const res = await resolveUncertainCapture(row, { checkFile: async () => "exists" as const });
    expect(res.outcome).toBe("ready");
    expect(await getBalance(tid)).toBe(8);                        // الخصم باقٍ — لا refund
    expect((await getCacheRowById(row.id))!.status).toBe("ready");
  });

  it("T4: استعلام حالة الحجز يفشل → pending غير قابل للتقديم وصفر إجراءات مالية", async () => {
    const tid = await createTeacher("t4");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t4", requestId, "/bucket/tts-cache/y.mp3");

    await CreditService.hold(tid, TOOL, requestId);
    const balBefore = await getBalance(tid);

    const res = await resolveUncertainCapture(row, {
      getHoldStatus: async () => { throw new Error("db unreachable"); },
    });
    expect(res.outcome).toBe("indeterminate");
    expect(await getBalance(tid)).toBe(balBefore);
    expect((await getCacheRowById(row.id))!.status).toBe("pending");
  });

  it("T5: حجز pending (انقطاع قبل التحصيل) → refund مرة واحدة والسجل failed", async () => {
    const tid = await createTeacher("t5");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t5", requestId);

    await CreditService.hold(tid, TOOL, requestId);
    expect(await getBalance(tid)).toBe(8);

    const res = await resolveUncertainCapture(row, { checkFile: async () => "missing" as const });
    expect(res.outcome).toBe("refunded");
    expect(await getBalance(tid)).toBe(10);
    expect((await getCacheRowById(row.id))!.status).toBe("failed");
    expect(await CreditService.getHoldStatus(requestId)).toBe("refunded");
  });

  it("T6: compensateCapturedHold لا يمس حجزاً pending", async () => {
    const tid = await createTeacher("t6");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    await CreditService.hold(tid, TOOL, requestId);
    expect(await getBalance(tid)).toBe(8);

    const { compensated } = await CreditService.compensateCapturedHold(requestId);
    expect(compensated).toBe(false);
    expect(await getBalance(tid)).toBe(8);
    expect(await CreditService.getHoldStatus(requestId)).toBe("pending");
  });

  it("T8: capture بعد refund (فقدان الملكية) → captured=false ولا خصم", async () => {
    const tid = await createTeacher("t8");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.refund(requestId, "orphan recovery beat us");
    expect(await getBalance(tid)).toBe(10);

    const { captured } = await CreditService.capture(requestId);
    expect(captured).toBe(false); // البوابة: بدون captured=true لا يُقدَّم صوت مولّد
    expect(await CreditService.getHoldStatus(requestId)).toBe("refunded");
    expect(await getBalance(tid)).toBe(10);
  });

  it("T9: ملف ready فُقد نهائياً → تعويض مرة واحدة والسجل failed (handleReadyFileLost)", async () => {
    const { handleReadyFileLost, markReady } = await import("../lib/tts-cache");
    const tid = await createTeacher("t9");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t9", requestId);
    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.capture(requestId);
    expect(await markReady(row.id, requestId, "/bucket/tts-cache/gone.mp3", 123)).toBe(true);
    expect(await getBalance(tid)).toBe(8);

    const ready = (await getCacheRowById(row.id))!;
    await handleReadyFileLost(ready);
    expect(await getBalance(tid)).toBe(10);
    expect((await getCacheRowById(row.id))!.status).toBe("failed");

    // استدعاء ثانٍ — الادعاء الذرّي على ready يمنع أي تعويض إضافي
    await handleReadyFileLost(ready);
    expect(await getBalance(tid)).toBe(10);
    const tx = await db.execute(sql`
      SELECT COUNT(*) AS n FROM credit_transactions WHERE teacher_id = ${tid} AND type = 'compensation'
    `);
    expect(Number((tx.rows[0] as any).n)).toBe(1);
  });

  it("T10: completed بلا storage_key → indeterminate (لا تعويض — غياب المفتاح ليس غياب الملف)", async () => {
    const tid = await createTeacher("t10");
    await seedBalance(tid, 10);
    const requestId = randomUUID();
    const row = await insertPendingRow(tid, "t10", requestId); // بلا storage_key
    await CreditService.hold(tid, TOOL, requestId);
    await CreditService.capture(requestId);

    const res = await resolveUncertainCapture(row);
    expect(res.outcome).toBe("indeterminate");
    expect(await getBalance(tid)).toBe(8); // لا تعويض
    expect((await getCacheRowById(row.id))!.status).toBe("pending");
  });

  it("T7: الاستحواذ الذرّي — فائز واحد فقط لنفس المفتاح", async () => {
    const tid = await createTeacher("t7");
    const key = buildTtsCacheKey(`نص السباق ${RUN_ID}`, "nova");
    const results = await Promise.all([
      tryInsertPending(tid, key, randomUUID()),
      tryInsertPending(tid, key, randomUUID()),
      tryInsertPending(tid, key, randomUUID()),
    ]);
    const winners = results.filter(Boolean);
    expect(winners.length).toBe(1);
  });
});
