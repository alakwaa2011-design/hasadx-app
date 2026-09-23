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

// The production limiter is intentionally disabled in this database integration
// suite. Rate-limit behavior is covered by the limiter's own tests; sharing one
// process limiter would make otherwise independent cases affect each other.
vi.mock("../lib/rate-limiter", () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  registerLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Google route coverage: mock the ID-token verifier so /auth/google can run without real OAuth.
const googleProfile = { sub: "", email: "", emailVerified: true, name: "Google Test" };
const { sendEmailMock } = vi.hoisted(() => ({
  // Auth route coverage must never send mail to a real provider.
  sendEmailMock: vi.fn().mockResolvedValue({ delivered: true }),
}));
const logWarnMock = vi.fn();
vi.mock("../lib/google-verify", () => ({
  verifyGoogleIdToken: vi.fn(async () => ({ ...googleProfile })),
}));
vi.mock("../lib/email", () => ({
  sendEmail: sendEmailMock,
  getAppBaseUrl: () => "http://test.local",
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
let mostRecentSession: { save: ReturnType<typeof vi.fn> } | null = null;

function makeApp() {
  const app = express();
  const sessions = new Map<string, any>();
  let nextSessionId = 0;
  app.use(express.json());
  app.use((req: any, res, next) => {
    let sid = req.headers.cookie?.match(/(?:^|;\s*)test_sid=([^;]+)/)?.[1] ?? `s${++nextSessionId}`;
    let session = sessions.get(sid);
    if (!session) {
      session = {
        cookie: {},
        save: vi.fn((callback: (error?: unknown) => void) => callback()),
      };
      sessions.set(sid, session);
      res.cookie("test_sid", sid);
    }
    req.session = session;
    req.sessionID = sid;
    session.regenerate = vi.fn((callback: (error?: unknown) => void) => {
      const old = session;
      const rotatedSid = `s${++nextSessionId}`;
      const rotated: any = {
        cookie: { ...old.cookie },
        save: vi.fn((cb: (error?: unknown) => void) => cb()),
      };
      sessions.delete(sid);
      sessions.set(rotatedSid, rotated);
      sid = rotatedSid;
      session = rotated;
      req.session = rotated;
      req.sessionID = rotatedSid;
      mostRecentSession = rotated;
      res.cookie("test_sid", rotatedSid);
      callback();
    });
    mostRecentSession = session;
    req.log = { info: () => {}, warn: logWarnMock, error: () => {} };
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

async function getVerificationCredentials(tid: number) {
  const result = await db.execute(sql`
    SELECT verification_otp, otp_expires_at, email_verify_token, email_verify_token_expires_at
    FROM teachers WHERE id = ${tid}
  `);
  return result.rows[0] as Record<string, unknown>;
}

async function cleanTeacher(tid: number) {
  await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_batches   WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_accounts  WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM xp_events        WHERE teacher_id = ${tid}`).catch(() => {});
  await db.execute(sql`DELETE FROM login_devices    WHERE teacher_id = ${tid}`).catch(() => {});
  await db.execute(sql`DELETE FROM trusted_devices  WHERE teacher_id = ${tid}`).catch(() => {});
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
    // Keep this suite runnable against a freshly-created dedicated test DB
    // without requiring a full Drizzle push. These are the phase-one additive
    // columns only; production migrations are never executed by tests.
    await db.execute(sql`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMP
    `);
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
    expect(mostRecentSession?.save).toHaveBeenCalledOnce();
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

  it("AUTH7 — تسجيل Google يحفظ المادة المخصصة عند إعادة تحميل الملف الشخصي", async () => {
    googleProfile.sub = `g_${RUN_ID}_custom_subject`;
    googleProfile.email = `${RUN_ID}_google_custom_subject@test.local`;
    const customSubject = "التصميم الصناعي";
    const agent = request.agent(app);

    const registration = await agent
      .post("/api/auth/google")
      .send({
        credential: "mock-token",
        primarySubject: customSubject,
        subjects: [customSubject],
      });
    expect(registration.status).toBe(200);
    const tid = Number(registration.body.teacher.id);
    tids.push(tid);

    // A fresh authenticated request represents reopening the profile after Google registration.
    const profile = await agent.get("/api/auth/me");
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({
      id: tid,
      primarySubject: customSubject,
      subjects: [customSubject],
    });
  });

  it("AUTH1 — معلم موثّق مع OTP قديم يستطيع الدخول من عملاء جدد ويحفظ جلساتهم", async () => {
    const t = await createUnverifiedTeacher("verified_stale", { otp: "111111", token: "old-token" });
    tids.push(t.id);
    await db.execute(sql`
      UPDATE teachers
      SET email_verified = true, verified_at = NOW() - INTERVAL '1 day'
      WHERE id = ${t.id}
    `);

    const firstDevice = request.agent(app);
    const secondDevice = request.agent(app);
    const [firstLogin, secondLogin] = await Promise.all([
      firstDevice.post("/api/auth/login").set("User-Agent", "auth-test-device-one").send({ email: t.email, password: PASSWORD }),
      secondDevice.post("/api/auth/login").set("User-Agent", "auth-test-device-two").send({ email: t.email, password: PASSWORD }),
    ]);
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
    expect(firstLogin.body.teacher.id).toBe(t.id);
    expect(secondLogin.body.teacher.id).toBe(t.id);
    expect((await firstDevice.get("/api/auth/me")).status).toBe(200);
    expect((await secondDevice.get("/api/auth/me")).status).toBe(200);

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: t.email, password: "not-the-password" });
    expect(wrongPassword.status).toBe(401);
  });

  it("AUTH2 — التسجيل المعلّق فعلاً يبقى محجوباً قبل إنشاء جلسة", async () => {
    const t = await createUnverifiedTeacher("pending_login", { otp: "222222", token: "pending-token" });
    tids.push(t.id);
    const agent = request.agent(app);

    const login = await agent.post("/api/auth/login").send({ email: t.email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ message: "NEEDS_VERIFICATION", identifier: t.email });
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it.each([
    ["email_verified", "email_verified = true"],
    ["verified_at", "verified_at = NOW()"],
    ["google_id", "google_id = 'google-auth-marker'"],
  ])("AUTH3 — resend-otp لا يغيّر الاعتمادات ولا يرسل بريداً عندما يكون %s موجوداً", async (_marker, verificationUpdate) => {
    const t = await createUnverifiedTeacher(`resend_verified_${_marker}`, { otp: "333333", token: "stale-token" });
    tids.push(t.id);
    await db.execute(sql.raw(`UPDATE teachers SET ${verificationUpdate} WHERE id = ${t.id}`));
    const before = await getVerificationCredentials(t.id);
    sendEmailMock.mockClear();
    const agent = request.agent(app);

    const resend = await agent.post("/api/auth/resend-otp").send({ identifier: t.email });
    expect(resend.status).toBe(200);
    expect(resend.body).toEqual({ ok: true });
    expect(await getVerificationCredentials(t.id)).toEqual(before);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("AUTH4 — resend-otp للحساب غير الموثّق يحدّث الاعتمادات ويرسل عبر البريد المقلّد", async () => {
    const t = await createUnverifiedTeacher("resend_pending", { otp: "444444", token: "old-pending-token" });
    tids.push(t.id);
    // Make this pending registration eligible now rather than exercising the cooldown.
    await db.execute(sql`
      UPDATE teachers
      SET otp_expires_at = NOW() - INTERVAL '31 minutes',
          email_verify_token_expires_at = NOW() - INTERVAL '31 minutes'
      WHERE id = ${t.id}
    `);
    const before = await getVerificationCredentials(t.id);
    sendEmailMock.mockClear();

    const resend = await request(app).post("/api/auth/resend-otp").send({ identifier: t.email });
    expect(resend.status).toBe(200);
    expect(resend.body).toEqual({ ok: true, channel: "email" });
    const after = await getVerificationCredentials(t.id);
    expect(after.verification_otp).not.toBe(before.verification_otp);
    expect(after.email_verify_token).not.toBe(before.email_verify_token);
    expect(after.otp_expires_at).not.toEqual(before.otp_expires_at);
    expect(after.email_verify_token_expires_at).not.toEqual(before.email_verify_token_expires_at);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: t.email }));
  });

  it("AUTH4A — رفض مزوّد البريد تسجيل الحساب يعيد 502 ويسجل السبب فقط", async () => {
    const email = `${RUN_ID}_register_delivery_rejected@test.local`;
    const rejectionReason = "provider_rejected_registration";
    sendEmailMock.mockResolvedValueOnce({ delivered: false, reason: rejectionReason });
    logWarnMock.mockClear();

    const registration = await request(app)
      .post("/api/auth/register")
      .send({ name: "Delivery Failure", email, password: PASSWORD });

    expect(registration.status).toBe(502);
    expect(registration.body).toEqual({
      message: "تعذّر إرسال رمز التفعيل بالبريد. يرجى المحاولة بعد قليل.",
    });

    const row = await db.execute(sql`
      SELECT id FROM teachers WHERE lower(email) = ${email.toLowerCase()} LIMIT 1
    `);
    const tid = Number((row.rows[0] as any).id);
    tids.push(tid);

    const sentMessage = sendEmailMock.mock.calls.at(-1)?.[0];
    const otp = `${sentMessage?.text ?? sentMessage?.html ?? ""}`.match(/\b\d{6}\b/)?.[0];
    const serializedLogs = JSON.stringify(logWarnMock.mock.calls);
    expect(logWarnMock).toHaveBeenCalledWith(
      { teacherId: tid, reason: rejectionReason },
      "OTP email not delivered",
    );
    expect(serializedLogs).not.toContain(email);
    expect(otp).toBeDefined();
    expect(serializedLogs).not.toContain(otp);
  });

  it("AUTH4AA — يستطيع صاحب التسجيل المعلّق استعادته دون تجاوز مهلة الإرسال أو كشف حالته", async () => {
    const email = `${RUN_ID}_register_delivery_recovery@test.local`;
    sendEmailMock.mockClear();
    sendEmailMock
      .mockResolvedValueOnce({ delivered: false, reason: "provider_rejected_registration" })
      .mockResolvedValueOnce({ delivered: true });

    const first = await request(app)
      .post("/api/auth/register")
      .send({ name: "Recovery Owner", email, password: PASSWORD });
    expect(first.status).toBe(502);

    const row = await db.execute(sql`
      SELECT id FROM teachers WHERE lower(email) = ${email.toLowerCase()} LIMIT 1
    `);
    const tid = Number((row.rows[0] as any).id);
    tids.push(tid);
    const before = await getVerificationCredentials(tid);

    const tooSoon = await request(app)
      .post("/api/auth/register")
      .send({ name: "Recovery Owner", email, password: PASSWORD });
    expect(tooSoon.status).toBe(429);
    expect(await getVerificationCredentials(tid)).toEqual(before);

    const wrongPassword = await request(app)
      .post("/api/auth/register")
      .send({ name: "Recovery Owner", email, password: "wrong-password" });
    expect(wrongPassword.status).toBe(409);
    expect(wrongPassword.body).toEqual({
      message: "البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً",
    });

    await db.execute(sql`
      UPDATE teachers
      SET otp_expires_at = NOW() + INTERVAL '8 minutes'
      WHERE id = ${tid}
    `);

    const recovery = await request(app)
      .post("/api/auth/register")
      .send({ name: "Recovery Owner", email, password: PASSWORD });
    expect(recovery.status).toBe(201);
    expect(recovery.body).toEqual({
      needsVerification: true,
      identifier: email,
      channel: "email",
    });

    const after = await getVerificationCredentials(tid);
    expect(after.verification_otp).not.toBe(before.verification_otp);
    expect(after.email_verify_token).not.toBe(before.email_verify_token);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    const sentMessage = sendEmailMock.mock.calls.at(-1)?.[0];
    const otp = `${sentMessage?.text ?? sentMessage?.html ?? ""}`.match(/\b\d{6}\b/)?.[0];
    expect(otp).toBeDefined();
    const verification = await request(app)
      .post("/api/auth/verify-otp")
      .send({ identifier: email, otp });
    expect(verification.status).toBe(200);
  });

  it("AUTH4B — رفض مزوّد البريد إعادة الإرسال يعيد 502 ويسجل السبب فقط", async () => {
    const t = await createUnverifiedTeacher("resend_delivery_rejected", {
      otp: "454545",
      token: "old-rejected-token",
    });
    tids.push(t.id);
    await db.execute(sql`
      UPDATE teachers
      SET otp_expires_at = NOW() - INTERVAL '31 minutes',
          email_verify_token_expires_at = NOW() - INTERVAL '31 minutes'
      WHERE id = ${t.id}
    `);
    const rejectionReason = "provider_rejected_resend";
    sendEmailMock.mockResolvedValueOnce({ delivered: false, reason: rejectionReason });
    logWarnMock.mockClear();

    const resend = await request(app)
      .post("/api/auth/resend-otp")
      .send({ identifier: t.email });

    expect(resend.status).toBe(502);
    expect(resend.body).toEqual({
      message: "تعذّر إرسال رمز التفعيل بالبريد. يرجى المحاولة بعد قليل.",
    });

    const sentMessage = sendEmailMock.mock.calls.at(-1)?.[0];
    const otp = `${sentMessage?.text ?? sentMessage?.html ?? ""}`.match(/\b\d{6}\b/)?.[0];
    const serializedLogs = JSON.stringify(logWarnMock.mock.calls);
    expect(logWarnMock).toHaveBeenCalledWith(
      { teacherId: t.id, reason: rejectionReason },
      "OTP resend email not delivered",
    );
    expect(serializedLogs).not.toContain(t.email);
    expect(otp).toBeDefined();
    expect(serializedLogs).not.toContain(otp);
  });

  it("AUTH5 — الدخول والتحقق لا يتأثران بحالة أحرف البريد أو المسافات الخارجية", async () => {
    const t = await createUnverifiedTeacher("email_case", { otp: "515151" });
    tids.push(t.id);
    const storedMixedCase = t.email.replace(RUN_ID, RUN_ID.toUpperCase());
    await db.execute(sql`UPDATE teachers SET email = ${storedMixedCase} WHERE id = ${t.id}`);

    const verification = await request(app)
      .post("/api/auth/verify-otp")
      .send({ identifier: `  ${t.email.toUpperCase()}  `, otp: "515151" });
    expect(verification.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: `  ${t.email.toUpperCase()}  `, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.teacher.id).toBe(t.id);
  });

  it("AUTH6 — التسجيل يحفظ البريد بصيغة موحّدة ويمنع تكراره باختلاف الأحرف", async () => {
    const email = `${RUN_ID}_REGISTER_CASE@TEST.LOCAL`;
    sendEmailMock.mockClear();
    const registration = await request(app)
      .post("/api/auth/register")
      .send({ name: "Case Test", email: `  ${email}  `, password: PASSWORD });
    expect(registration.status).toBe(201);

    const row = await db.execute(sql`
      SELECT id, email, verification_otp, otp_expires_at
      FROM teachers WHERE lower(email) = ${email.toLowerCase()} LIMIT 1
    `);
    const tid = Number((row.rows[0] as any).id);
    tids.push(tid);
    expect((row.rows[0] as any).email).toBe(email.toLowerCase());
    expect((row.rows[0] as any).verification_otp).toMatch(/^[0-9a-f]{64}$/i);
    expect(new Date((row.rows[0] as any).otp_expires_at).getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: email.toLowerCase() }));

    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({ name: "Duplicate", email: email.toLowerCase(), password: "different-password" });
    expect(duplicate.status).toBe(409);
  });

  it("AUTH8 — wrong OTP attempts are bounded and resend resets the lock", async () => {
    const t = await createUnverifiedTeacher("attempt-lock", { otp: "616161" });
    tids.push(t.id);
    for (let i = 0; i < 4; i++) {
      expect((await request(app).post("/api/auth/verify-otp")
        .send({ identifier: t.email, otp: "000000" })).status).toBe(400);
    }
    expect((await request(app).post("/api/auth/verify-otp")
      .send({ identifier: t.email, otp: "000000" })).status).toBe(429);
    const locked = await db.execute(sql`
      SELECT otp_attempts, otp_locked_until FROM teachers WHERE id = ${t.id}
    `);
    expect(Number((locked.rows[0] as any).otp_attempts)).toBeGreaterThanOrEqual(5);
    expect((locked.rows[0] as any).otp_locked_until).not.toBeNull();

    await db.execute(sql`UPDATE teachers SET otp_expires_at = NOW() - INTERVAL '2 minutes' WHERE id = ${t.id}`);
    expect((await request(app).post("/api/auth/resend-otp").send({ identifier: t.email })).status).toBe(200);
    const reset = await db.execute(sql`
      SELECT otp_attempts, otp_locked_until FROM teachers WHERE id = ${t.id}
    `);
    expect(Number((reset.rows[0] as any).otp_attempts)).toBe(0);
    expect((reset.rows[0] as any).otp_locked_until).toBeNull();
  });

  it("AUTH9 — an email verification token is single-use and never logs in twice", async () => {
    const token = `single-use-${RUN_ID}-token`;
    const t = await createUnverifiedTeacher("single-use", { token });
    tids.push(t.id);
    const first = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(first.status).toBe(200);
    const second = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(second.status).toBe(400);
    expect(second.body.invalid).toBe(true);
  });
});
