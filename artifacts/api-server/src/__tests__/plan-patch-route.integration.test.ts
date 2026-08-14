/**
 * اختبارات تكاملية route-level: PATCH /api/billing/admin/plans/:id
 *
 * تعمل فقط عبر `pnpm run test:integration` (setup-integration يوجّه DATABASE_URL
 * إلى TEST_DATABASE_URL). تُتخطى بأمان في تشغيل الـ mock الافتراضي.
 *
 * P1. بدون جلسة → 401
 * P2. جلسة معلم غير مسؤول → 403
 * P3. مسؤول + خطة free + priceMinor → 400 (حارس الخطة المجانية)
 * P4. مسؤول + خطة free + nameAr فقط → 200 (الحقول غير التسعيرية مسموحة)
 * P5. مسؤول + خطة basic + سعر/lemon IDs → 200 ويُحفظ فعليًا في DB
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import billingRouter from "../routes/billing";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `pp${Date.now()}`;

function makeApp(teacherId: number | null) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = teacherId ? { teacherId } : {};
    next();
  });
  app.use("/api", billingRouter);
  return app;
}

describe.skipIf(!RUN_INTEGRATION)("PATCH /api/billing/admin/plans/:id — route", () => {
  let adminId = 0;
  let teacherId = 0;
  let freePlanId = 0;
  let basicPlanId = 0;
  let basicBackup: any = null;

  beforeAll(async () => {
    const a = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('Admin', ${`${RUN_ID}_admin@test.local`}, 'x', true, NOW()) RETURNING id`);
    adminId = Number((a.rows[0] as any).id);
    const t = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('Teacher', ${`${RUN_ID}_t@test.local`}, 'x', false, NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);

    const free = await db.execute(sql`SELECT id FROM plans WHERE code = 'free' LIMIT 1`);
    const basic = await db.execute(sql`
      SELECT id, price_minor, lemon_product_id, lemon_variant_id, name_ar FROM plans WHERE code = 'basic' LIMIT 1`);
    if (!free.rows[0] || !basic.rows[0]) throw new Error("free/basic plans missing in test DB");
    freePlanId = Number((free.rows[0] as any).id);
    basicPlanId = Number((basic.rows[0] as any).id);
    basicBackup = basic.rows[0];
  });

  afterAll(async () => {
    if (basicBackup) {
      await db.execute(sql`
        UPDATE plans SET price_minor = ${basicBackup.price_minor},
          lemon_product_id = ${basicBackup.lemon_product_id},
          lemon_variant_id = ${basicBackup.lemon_variant_id},
          name_ar = ${basicBackup.name_ar}
        WHERE id = ${basicPlanId}`);
    }
    await db.execute(sql`DELETE FROM teachers WHERE id IN (${adminId}, ${teacherId})`);
  });

  it("P1 — بدون جلسة → 401", async () => {
    const res = await request(makeApp(null))
      .patch(`/api/billing/admin/plans/${basicPlanId}`)
      .send({ priceMinor: 599 });
    expect(res.status).toBe(401);
  });

  it("P2 — معلم غير مسؤول → 403", async () => {
    const res = await request(makeApp(teacherId))
      .patch(`/api/billing/admin/plans/${basicPlanId}`)
      .send({ priceMinor: 599 });
    expect(res.status).toBe(403);
  });

  it("P3 — تعديل تسعير الخطة المجانية مرفوض → 400", async () => {
    const res = await request(makeApp(adminId))
      .patch(`/api/billing/admin/plans/${freePlanId}`)
      .send({ priceMinor: 100, monthlyCredits: 999 });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(expect.arrayContaining(["priceMinor", "monthlyCredits"]));
    const check = await db.execute(sql`SELECT price_minor FROM plans WHERE id = ${freePlanId}`);
    expect(Number((check.rows[0] as any).price_minor)).toBe(0);
  });

  it("P4 — تعديل اسم الخطة المجانية مسموح → 200", async () => {
    const orig = await db.execute(sql`SELECT name_ar FROM plans WHERE id = ${freePlanId}`);
    const origName = (orig.rows[0] as any).name_ar;
    const res = await request(makeApp(adminId))
      .patch(`/api/billing/admin/plans/${freePlanId}`)
      .send({ nameAr: `${origName}` });
    expect(res.status).toBe(200);
  });

  it("P5 — تعديل basic (سعر + lemon IDs) يُحفظ في DB → 200", async () => {
    const res = await request(makeApp(adminId))
      .patch(`/api/billing/admin/plans/${basicPlanId}`)
      .send({ priceMinor: 499, lemonProductId: "448058", lemonVariantId: "2017697" });
    expect(res.status).toBe(200);
    const row = (await db.execute(sql`
      SELECT price_minor, lemon_product_id, lemon_variant_id FROM plans WHERE id = ${basicPlanId}`)).rows[0] as any;
    expect(Number(row.price_minor)).toBe(499);
    expect(row.lemon_product_id).toBe("448058");
    expect(row.lemon_variant_id).toBe("2017697");
  });
});
