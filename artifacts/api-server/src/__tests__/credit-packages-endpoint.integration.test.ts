/**
 * اختبار تكاملي: GET /api/credits/packages (قسم «نقاط إضافية — دفعة واحدة» في صفحة المعلم)
 *
 * السبب الجذري الذي يغطيه: الحزم كانت is_visible=false في قاعدة البيانات
 * فأرجع الـ endpoint مصفوفة فارغة → «لا توجد حزم نقاط متاحة حاليًا».
 * يثبت الاختبار أن الحزم المرئية غير المؤرشفة تُعاد (الثلاث المعتمدة)،
 * وأن المخفية/المؤرشفة (مثل default variants غير المنشورة) لا تظهر،
 * وأن purchasesEnabled=true عندما تكون المدفوعات مفعلة وLemon مضبوطًا.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `pkg${Date.now()}`;

// قيم بيئة تجريبية محلية لعملية الاختبار فقط — تُسترجع في afterAll
const envBackup = {
  payments: process.env.PAYMENTS_ENABLED,
  apiKey: process.env.LEMON_SQUEEZY_API_KEY,
  storeId: process.env.LEMON_SQUEEZY_STORE_ID,
  webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
};
if (RUN_INTEGRATION) {
  process.env.PAYMENTS_ENABLED = "true";
  process.env.LEMON_SQUEEZY_API_KEY = "test-key-local-only";
  process.env.LEMON_SQUEEZY_STORE_ID = "test-store";
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-secret-local-only";
}

describe.skipIf(!RUN_INTEGRATION)("GET /api/credits/packages", () => {
  let teacherId = 0;
  let app: express.Express;
  const pkgIds: number[] = [];

  beforeAll(async () => {
    const t = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('PkgT', ${`${RUN_ID}@test.local`}, 'x', false, NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);

    // ثلاث حزم مرئية (تحاكي المعتمدة 100/300/600) + مخفية + مؤرشفة
    const inserted = await db.execute(sql`
      INSERT INTO credit_packages (name, price_usd_cents, credits, sort_order, is_visible, is_featured, lemon_variant_id, archived_at)
      VALUES
        (${`${RUN_ID}-100`},  299, 100, 101, TRUE,  FALSE, '2017706', NULL),
        (${`${RUN_ID}-300`},  699, 300, 102, TRUE,  TRUE,  '2017715', NULL),
        (${`${RUN_ID}-600`}, 1199, 600, 103, TRUE,  FALSE, '2017717', NULL),
        (${`${RUN_ID}-hidden-default`}, 100, 50, 104, FALSE, FALSE, NULL, NULL),
        (${`${RUN_ID}-archived`}, 100, 50, 105, TRUE, FALSE, NULL, NOW())
      RETURNING id`);
    for (const r of inserted.rows) pkgIds.push(Number((r as any).id));

    const { default: purchasesRouter } = await import("../routes/credit-purchases");
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { req.session = { teacherId }; next(); });
    app.use("/api", purchasesRouter);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM credit_packages WHERE id IN (${sql.join(pkgIds.map((i) => sql`${i}`), sql`, `)})`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    // استرجاع دقيق: القيمة undefined تعني «حذف المتغير» لا تعيين النص "undefined"
    const restore = (key: string, val: string | undefined) => {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    };
    restore("PAYMENTS_ENABLED", envBackup.payments);
    restore("LEMON_SQUEEZY_API_KEY", envBackup.apiKey);
    restore("LEMON_SQUEEZY_STORE_ID", envBackup.storeId);
    restore("LEMON_SQUEEZY_WEBHOOK_SECRET", envBackup.webhookSecret);
  });

  it("يرجع الحزم المرئية الثلاث فقط (100/300/600) ويخفي المخفية والمؤرشفة، وpurchasesEnabled=true", async () => {
    const res = await request(app).get("/api/credits/packages").expect(200);

    const mine = res.body.packages.filter((p: any) => String(p.name).startsWith(RUN_ID));
    expect(mine.map((p: any) => p.credits)).toEqual([100, 300, 600]); // مرتبة بـ sort_order
    expect(mine.some((p: any) => String(p.name).includes("hidden"))).toBe(false);
    expect(mine.some((p: any) => String(p.name).includes("archived"))).toBe(false);
    expect(res.body.purchasesEnabled).toBe(true);

    // بوجود حزم غير فارغة، الواجهة تعرض البطاقات لا رسالة «لا توجد حزم نقاط متاحة حاليًا»
    expect(res.body.packages.length).toBeGreaterThanOrEqual(3);
  });
});
