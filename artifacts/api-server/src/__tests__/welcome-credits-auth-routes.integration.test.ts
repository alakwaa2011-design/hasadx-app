/**
 * اختبارات تكاملية route-level: منح رصيد الترحيب من مسارات المصادقة الثلاثة
 *
 * تعمل فقط عبر `pnpm run test:integration` (DATABASE_URL = TEST_DATABASE_URL).
 * تُتخطى بأمان في تشغيل الـ mock الافتراضي.
 *
 * WA1. POST /auth/verify-otp (أول تحقق) → تُمنح دفعة welcome_credits واحدة
 * WA2. GET /auth/verify-email (رابط التحقق) → تُمنح دفعة واحدة
 * WA3. login لاحق بعد المنح → لا دفعة ثانية
 * WA4. سباق OTP + login متزامنين → دفعة واحدة فقط
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Google route coverage: mock the ID-token verifier so /auth/google can run without real OAuth.
const googleProfile = { sub: "", email: "", emailVerified: true, name: "Google Test" };
vi.mock("../lib/google-verify", () => ({
  verifyGoogleIdToken: vi.fn(async () => ({ ...googleProfile })),
}));
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import authRouter from "../routes/auth";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `war${Date.now()}`;
const PASSWORD = "secret123";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { cookie: {} };
    req.log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use("/api", authRouter);
  return app;
}

async function createUnverifiedTeacher(suffix: string, opts: { otp?: string; token?: string } = {}) {
  const email = `${RUN_ID}_${suffix}@test.local`;
  const hash = await bcrypt.hash(PASSWORD, 4);
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, email_verified, verification_otp, otp_expires_at,
                          email_verify_token, email_verify_token_expires_at, created_at)
    VALUES ('Test', ${email}, ${hash}, false,
            ${opts.otp ?? null}, ${opts.otp ? sql`NOW() + INTERVAL '10 minutes'` : null},
            ${opts.token ?? null}, ${opts.token ? sql`NOW() + INTERVAL '10 minutes'` : null},
            NOW())
    RETURNING id
  `);
  return { id: Number((r.rows[0] as any).id), email };
}

async function cleanTeacher(tid: number) {
  await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_batches   WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_accounts  WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM xp_events        WHERE teacher_id = ${tid}`).catch(() => {});
  await db.execute(sql`DELETE FROM login_devices    WHERE teacher_id = ${tid}`).catch(() => {});
  await db.execute(sql`DELETE FROM teachers         WHERE id = ${tid}`);
}

async function getWelcomeBatches(tid: number) {
  const r = await db.execute(sql`
    SELECT id, amount FROM credit_batches
    WHERE teacher_id = ${tid} AND source = 'free' AND reference_id = 'welcome_credits'
  `);
  return r.rows as any[];
}

/** المنح غير حاجز (fire-and-forget) — ننتظر بالاستطلاع حتى تظهر الدفعة أو تنقضي المهلة. */
async function waitForWelcomeBatch(tid: number, timeoutMs = 5000): Promise<any[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const b = await getWelcomeBatches(tid);
    if (b.length > 0) return b;
    await new Promise((r) => setTimeout(r, 150));
  }
  return getWelcomeBatches(tid);
}

/** انتظار ثابت قصير لتصفية أي منح متأخر قبل عدّ الدفعات النهائي. */
const settle = (ms = 1200) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!RUN_INTEGRATION)("منح رصيد الترحيب من مسارات المصادقة", () => {
  const tids: number[] = [];
  const app = makeApp();
  let originalWelcomeCredits: number | null = null;

  beforeAll(async () => {
    const existing = await db.execute(sql`SELECT welcome_credits FROM platform_settings ORDER BY id LIMIT 1`);
    originalWelcomeCredits = existing.rows.length ? Number((existing.rows[0] as any).welcome_credits ?? 0) : null;
    await db.execute(sql`UPDATE platform_settings SET welcome_credits = 50 WHERE id = (SELECT id FROM platform_settings ORDER BY id LIMIT 1)`);
  });

  afterAll(async () => {
    for (const tid of tids) await cleanTeacher(tid).catch(() => {});
    if (originalWelcomeCredits !== null && originalWelcomeCredits !== 50) {
      await db.execute(sql`UPDATE platform_settings SET welcome_credits = ${originalWelcomeCredits} WHERE id = (SELECT id FROM platform_settings ORDER BY id LIMIT 1)`).catch(() => {});
    }
  });

  it("WA1 — verify-otp يمنح 50 نقطة ترحيبية مرة واحدة", async () => {
    const t = await createUnverifiedTeacher("otp", { otp: "123456" });
    tids.push(t.id);

    const res = await request(app).post("/api/auth/verify-otp").send({ identifier: t.email, otp: "123456" });
    expect(res.status).toBe(200);

    const batches = await waitForWelcomeBatch(t.id);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);
  });

  it("WA2 — verify-email (الرابط) يمنح دفعة واحدة", async () => {
    const token = `tok_${RUN_ID}_link_0123456789`;
    const t = await createUnverifiedTeacher("link", { token });
    tids.push(t.id);

    const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(res.status).toBe(200);

    const batches = await waitForWelcomeBatch(t.id);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);
  });

  it("WA3 — login لاحق بعد المنح لا يكرر الدفعة", async () => {
    const t = await createUnverifiedTeacher("relogin", { otp: "654321" });
    tids.push(t.id);

    await request(app).post("/api/auth/verify-otp").send({ identifier: t.email, otp: "654321" });
    const first = await waitForWelcomeBatch(t.id);
    expect(first).toHaveLength(1);

    const res = await request(app).post("/api/auth/login").send({ email: t.email, password: PASSWORD });
    expect(res.status).toBe(200);
    await settle();

    const batches = await getWelcomeBatches(t.id);
    expect(batches).toHaveLength(1);
  });

  it("WA4 — سباق دخولين متزامنين لمعلم موثّق بلا دفعة → دفعة واحدة فقط", async () => {
    // معلم موثّق مسبقاً (بلا OTP معلّق) وبلا أي دفعة مجانية — كلا الدخولين يصل للمنح.
    const email = `${RUN_ID}_race@test.local`;
    const hash = await bcrypt.hash(PASSWORD, 4);
    const r = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, email_verified, created_at)
      VALUES ('Test', ${email}, ${hash}, true, NOW())
      RETURNING id
    `);
    const tid = Number((r.rows[0] as any).id);
    tids.push(tid);

    const [r1, r2] = await Promise.all([
      request(app).post("/api/auth/login").send({ email, password: PASSWORD }),
      request(app).post("/api/auth/login").send({ email, password: PASSWORD }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const t = { id: tid };

    await waitForWelcomeBatch(t.id);
    await settle();

    const batches = await getWelcomeBatches(t.id);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);
  });

  it("WA5 — دخول Google (إنشاء حساب جديد) يمنح 50 نقطة ترحيبية مرة واحدة", async () => {
    googleProfile.sub = `g_${RUN_ID}_new`;
    googleProfile.email = `${RUN_ID}_google@test.local`;

    const res = await request(app).post("/api/auth/google").send({ credential: "mock-token" });
    expect(res.status).toBe(200);
    const tid = Number(res.body.teacher.id);
    tids.push(tid);

    const batches = await waitForWelcomeBatch(tid);
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].amount)).toBe(50);

    // دخول Google ثانٍ — لا دفعة ثانية
    const res2 = await request(app).post("/api/auth/google").send({ credential: "mock-token" });
    expect(res2.status).toBe(200);
    await settle();
    expect(await getWelcomeBatches(tid)).toHaveLength(1);
  });
});
