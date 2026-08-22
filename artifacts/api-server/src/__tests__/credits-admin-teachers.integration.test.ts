/**
 * اختبار تكاملي: GET /api/admin/credits/teachers (تبويب «أرصدة المعلمين»)
 *
 * السبب الجذري الذي يغطيه: الـ SQL الخام في الاستعلام يشير للجدول بالاسم
 * المستعار "ca" بينما كان الـ join بلا alias → «missing FROM-clause entry
 * for table "ca"» → 500 «فشل تحميل الأرصدة».
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `ca${Date.now()}`;

describe.skipIf(!RUN_INTEGRATION)("GET /api/admin/credits/teachers", () => {
  let adminId = 0;
  let teacherId = 0;
  let app: express.Express;

  beforeAll(async () => {
    const a = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('AdminBal', ${`${RUN_ID}-admin@test.local`}, 'x', true, NOW()) RETURNING id`);
    adminId = Number((a.rows[0] as any).id);

    const t = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('BasicSubT', ${`${RUN_ID}-t@test.local`}, 'x', false, NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);

    // رصيد ناتج عن حركة اشتراك Basic (250 نقطة) — إدراج مباشر في قاعدة الاختبار
    await db.execute(sql`
      INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
      VALUES (${teacherId}, 250, 250, 0, NOW())`);

    const { default: creditsAdminRouter } = await import("../routes/credits-admin");
    app = express();
    app.use(express.json());
    // جلسة مسؤول وهمية — نختبر الاستعلام لا نظام الجلسات
    app.use((req: any, _res, next) => { req.session = { teacherId: adminId }; next(); });
    app.use("/api/admin/credits", creditsAdminRouter);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id IN (${teacherId}, ${adminId})`);
  });

  it("يرجع 200 مع صف المعلم ورصيده 250 (اشتراك Basic) مجمّعًا صحيحًا", async () => {
    const res = await request(app)
      .get(`/api/admin/credits/teachers?q=${RUN_ID}-t`)
      .expect(200);

    expect(Array.isArray(res.body.rows)).toBe(true);
    const row = res.body.rows.find((r: any) => r.id === teacherId);
    expect(row).toBeTruthy();
    expect(Number(row.balance)).toBe(250);
    expect(Number(row.totalEarned)).toBe(250);
    expect(Number(row.totalSpent)).toBe(0);
    // العدّاد يجب أن يعكس نتيجة البحث نفسها، لا كل المعلمين
    expect(Number(res.body.total)).toBe(1);
  });

  it("يرجع 200 بلا فلترة (المسار الافتراضي للتبويب) والترتيب تنازليًا بالرصيد", async () => {
    const res = await request(app)
      .get("/api/admin/credits/teachers?page=1&pageSize=30")
      .expect(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
    const balances = res.body.rows.map((r: any) => Number(r.balance));
    const sorted = [...balances].sort((x, y) => y - x);
    expect(balances).toEqual(sorted);
  });

  it("يعيد جميع المعلمين المطابقين عند pageSize=all بلا تقسيم إلى صفحات", async () => {
    const res = await request(app)
      .get(`/api/admin/credits/teachers?pageSize=all&q=${RUN_ID}-t`)
      .expect(200);

    expect(res.body.page).toBe(1);
    expect(Number(res.body.total)).toBe(1);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].id).toBe(teacherId);
  });
});
