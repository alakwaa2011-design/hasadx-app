/**
 * اختبار تكاملي: POST /api/billing/admin/grant-plan — منح باقة حصاد يدوياً.
 *
 * يغطي:
 * 1. منح Basic يدوياً → اشتراك نشط + دفعة اشتراك بقيمة monthly_credits الحية + حركة + ارتفاع الرصيد.
 * 2. منح Pro يدوياً → نفس الضمانات بقيمة Pro.
 * 3. إعادة نفس الطلب (نفس grantId) → لا دفعة ثانية ولا مضاعفة رصيد.
 * 4. النقاط الترحيبية/المشتراة القائمة لا تُمس.
 * 5. planCode غير مسموح (free/school) → 400.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true }),
  getAppBaseUrl: () => "https://hasaadx.com",
}));

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `mpg${Date.now()}`;

async function planCredits(code: string): Promise<number> {
  const r = await db.execute(sql`SELECT monthly_credits FROM plans WHERE code = ${code} LIMIT 1`);
  return Number((r.rows[0] as any)?.monthly_credits ?? 0);
}

async function balanceOf(tid: number): Promise<number> {
  const r = await db.execute(sql`SELECT balance FROM credit_accounts WHERE teacher_id = ${tid}`);
  return Number((r.rows[0] as any)?.balance ?? 0);
}

describe.skipIf(!RUN_INTEGRATION)("POST /api/billing/admin/grant-plan", () => {
  let adminId = 0;
  let teacherId = 0;
  let app: express.Express;

  beforeAll(async () => {
    const a = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('AdminGrant', ${`${RUN_ID}-admin@test.local`}, 'x', true, NOW()) RETURNING id`);
    adminId = Number((a.rows[0] as any).id);

    const t = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('GrantT', ${`${RUN_ID}-t@test.local`}, 'x', false, NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);

    // رصيد قائم: 50 ترحيبية (free) + 100 مشتراة — يجب ألا تُمس عند المنح اليدوي
    await db.execute(sql`
      INSERT INTO credit_accounts (teacher_id, balance, free_balance, paid_balance, total_earned, updated_at)
      VALUES (${teacherId}, 150, 50, 100, 150, NOW())`);
    await db.execute(sql`
      INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, reference_id, created_at, updated_at)
      VALUES (${teacherId}, 'free', 50, 50, ${`welcome_${RUN_ID}`}, NOW(), NOW()),
             (${teacherId}, 'purchased', 100, 100, ${`order_${RUN_ID}`}, NOW(), NOW())`);

    const { default: billingRouter } = await import("../routes/billing");
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { req.session = { teacherId: adminId }; next(); });
    app.use("/api", billingRouter);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM notifications WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id IN (${teacherId}, ${adminId})`);
  });

  it("منح Basic: اشتراك نشط + دفعة + حركة + ارتفاع الرصيد بقيمة monthly_credits", async () => {
    const expected = await planCredits("basic");
    expect(expected).toBeGreaterThan(0);
    const before = await balanceOf(teacherId);

    const grantId = `${RUN_ID}-basic`;
    const res = await request(app)
      .post("/api/billing/admin/grant-plan")
      .send({ teacherId, planCode: "basic", grantId })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.planCode).toBe("basic");
    expect(res.body.granted).toBe(expected);
    expect(res.body.newBalance).toBe(before + expected);
    expect(res.body.expiresAt).toBeTruthy();

    // اشتراك نشط بمدة صحيحة
    const sub = await db.execute(sql`
      SELECT s.status, s.expires_at, p.code FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id WHERE s.teacher_id = ${teacherId}`);
    const s = sub.rows[0] as any;
    expect(s.code).toBe("basic");
    expect(s.status).toBe("active");
    expect(new Date(s.expires_at).getTime()).toBeGreaterThan(Date.now());

    // دفعة اشتراك واحدة بالمرجع الإداري
    const batches = await db.execute(sql`
      SELECT amount, source, reference_id FROM credit_batches
      WHERE teacher_id = ${teacherId} AND source = 'subscription'`);
    expect(batches.rows.length).toBe(1);
    expect(Number((batches.rows[0] as any).amount)).toBe(expected);
    expect((batches.rows[0] as any).reference_id).toBe(`manual_plan_grant_${grantId}`);

    // حركة earn مكتملة
    const txs = await db.execute(sql`
      SELECT amount, type, status FROM credit_transactions
      WHERE teacher_id = ${teacherId} AND source = ${`manual_plan_grant_${grantId}`}`);
    expect(txs.rows.length).toBe(1);
    expect((txs.rows[0] as any).type).toBe("earn");
    expect((txs.rows[0] as any).status).toBe("completed");

    const notifications = await db.execute(sql`
      SELECT type FROM notifications WHERE teacher_id = ${teacherId}`);
    expect(notifications.rows.map((row: any) => row.type)).toEqual(["plan_award"]);
  });

  it("إعادة نفس الطلب: لا دفعة ثانية ولا مضاعفة رصيد", async () => {
    const before = await balanceOf(teacherId);
    const res = await request(app)
      .post("/api/billing/admin/grant-plan")
      .send({ teacherId, planCode: "basic", grantId: `${RUN_ID}-basic` })
      .expect(200);
    expect(res.body.alreadyGranted).toBe(true);
    expect(await balanceOf(teacherId)).toBe(before);

    const batches = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM credit_batches
      WHERE teacher_id = ${teacherId} AND source = 'subscription'`);
    expect(Number((batches.rows[0] as any).n)).toBe(1);

    const notifications = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM notifications WHERE teacher_id = ${teacherId}`);
    expect(Number((notifications.rows[0] as any).n)).toBe(1);
  });

  it("منح Pro بعده: دفعة Pro جديدة والرصيد يرتفع بقيمة Pro (ضمن الحدود)", async () => {
    const proCredits = await planCredits("pro");
    expect(proCredits).toBeGreaterThan(0);
    const before = await balanceOf(teacherId);

    const res = await request(app)
      .post("/api/billing/admin/grant-plan")
      .send({ teacherId, planCode: "pro", grantId: `${RUN_ID}-pro` })
      .expect(200);
    expect(res.body.planCode).toBe("pro");
    expect(res.body.granted).toBeGreaterThan(0);
    expect(res.body.newBalance).toBe(before + res.body.granted);

    const sub = await db.execute(sql`
      SELECT p.code FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.teacher_id = ${teacherId}`);
    expect((sub.rows[0] as any).code).toBe("pro");

    const notifications = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM notifications WHERE teacher_id = ${teacherId}`);
    expect(Number((notifications.rows[0] as any).n)).toBe(2);
  });

  it("الخفض من Pro إلى Basic لا يرسل إشعار هدية", async () => {
    const before = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM notifications WHERE teacher_id = ${teacherId}`);

    await request(app)
      .post("/api/billing/admin/grant-plan")
      .send({ teacherId, planCode: "basic", grantId: `${RUN_ID}-downgrade` })
      .expect(200);

    const after = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM notifications WHERE teacher_id = ${teacherId}`);
    expect(Number((after.rows[0] as any).n)).toBe(Number((before.rows[0] as any).n));
  });

  it("النقاط الترحيبية والمشتراة القائمة لم تُمس", async () => {
    const r = await db.execute(sql`
      SELECT source, amount_remaining FROM credit_batches
      WHERE teacher_id = ${teacherId} AND source IN ('free','purchased')
      ORDER BY source`);
    const bySource = Object.fromEntries(r.rows.map((b: any) => [b.source, Number(b.amount_remaining)]));
    expect(bySource.free).toBe(50);
    expect(bySource.purchased).toBe(100);

    const acct = await db.execute(sql`
      SELECT free_balance, paid_balance FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    expect(Number((acct.rows[0] as any).free_balance)).toBe(50);
    expect(Number((acct.rows[0] as any).paid_balance)).toBe(100);
  });

  it("planCode خارج basic/pro → 400", async () => {
    for (const code of ["free", "school", ""]) {
      const res = await request(app)
        .post("/api/billing/admin/grant-plan")
        .send({ teacherId, planCode: code, grantId: `${RUN_ID}-x` });
      expect(res.status).toBe(400);
    }
  });

  it("طلبان متزامنان بنفس grantId → منح واحد فقط", async () => {
    const before = await balanceOf(teacherId);
    const gid = `${RUN_ID}-race-same`;
    const [r1, r2] = await Promise.all([
      request(app).post("/api/billing/admin/grant-plan").send({ teacherId, planCode: "basic", grantId: gid }),
      request(app).post("/api/billing/admin/grant-plan").send({ teacherId, planCode: "basic", grantId: gid }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // واحد فقط نفّذ المنح فعلياً
    expect([r1.body.alreadyGranted, r2.body.alreadyGranted].filter(Boolean).length).toBe(1);
    const granted = r1.body.alreadyGranted ? r2.body.granted : r1.body.granted;
    expect(await balanceOf(teacherId)).toBe(before + granted);

    const n = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM credit_batches
      WHERE teacher_id = ${teacherId} AND reference_id = ${`manual_plan_grant_${gid}`}`);
    expect(Number((n.rows[0] as any).n)).toBeLessThanOrEqual(1);
  });

  it("منحان متزامنان Basic/Pro بمعرّفين مختلفين → كل دفعة بقيمة باقتها هي", async () => {
    const basicCredits = await planCredits("basic");
    const proCredits = await planCredits("pro");
    const g1 = `${RUN_ID}-race-b`;
    const g2 = `${RUN_ID}-race-p`;
    const [r1, r2] = await Promise.all([
      request(app).post("/api/billing/admin/grant-plan").send({ teacherId, planCode: "basic", grantId: g1 }),
      request(app).post("/api/billing/admin/grant-plan").send({ teacherId, planCode: "pro", grantId: g2 }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // كل دفعة (إن مُنحت ضمن حد التراكم) تحمل plan_code وقيمة باقتها — لا تمويل متقاطع
    const rows = await db.execute(sql`
      SELECT reference_id, plan_code, amount FROM credit_batches
      WHERE teacher_id = ${teacherId} AND reference_id IN (${`manual_plan_grant_${g1}`}, ${`manual_plan_grant_${g2}`})`);
    for (const b of rows.rows as any[]) {
      if (b.reference_id === `manual_plan_grant_${g1}`) {
        expect(b.plan_code).toBe("basic");
        expect(Number(b.amount)).toBeLessThanOrEqual(basicCredits);
      } else {
        expect(b.plan_code).toBe("pro");
        expect(Number(b.amount)).toBeLessThanOrEqual(proCredits);
      }
    }
  });

  it("grantId مفقود → 400", async () => {
    await request(app)
      .post("/api/billing/admin/grant-plan")
      .send({ teacherId, planCode: "basic" })
      .expect(400);
  });
});
