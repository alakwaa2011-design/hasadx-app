/**
 * Subscription management routes.
 *
 * GET  /api/subscriptions/plans     — list available plans
 * GET  /api/subscriptions/me        — current teacher subscription + balance
 * POST /api/subscriptions/checkout  — create Lemon Squeezy checkout URL
 */
import { Router, type IRouter } from "express";
import { db, plansTable, subscriptionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── List plans ───────────────────────────────────────────────────────────────

router.get("/subscriptions/plans", async (req, res) => {
  try {
    const plans = await db
      .select({
        id:                   plansTable.id,
        code:                 plansTable.code,
        nameAr:               plansTable.nameAr,
        nameEn:               plansTable.nameEn,
        priceMinor:           plansTable.priceMinor,
        currency:             plansTable.currency,
        billingPeriodDays:    plansTable.billingPeriodDays,
        monthlyCredits:       plansTable.monthlyCredits,
        rolloverCap:          plansTable.rolloverCap,
        maxStudents:          plansTable.maxStudents,
        maxClasses:           plansTable.maxClasses,
        maxHomeworksPerMonth: plansTable.maxHomeworksPerMonth,
        aiUsageDailyLimit:    plansTable.aiUsageDailyLimit,
        isActive:             plansTable.isActive,
        sortOrder:            plansTable.sortOrder,
      })
      .from(plansTable)
      .where(eq(plansTable.isActive, true))
      .orderBy(asc(plansTable.sortOrder));

    res.json({ plans });
  } catch (err) {
    logger.error(err, "GET /subscriptions/plans failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ─── Current teacher subscription ────────────────────────────────────────────

router.get("/subscriptions/me", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "غير مصرح" });
    return;
  }
  try {
    const rows = await db.execute(sql`
      SELECT
        s.id, s.status, s.payment_status, s.current_period_end,
        s.cancelled_at, s.external_subscription_id, s.created_at,
        p.code  AS plan_code,
        p.name_ar AS plan_name_ar,
        p.name_en AS plan_name_en,
        p.price_minor, p.currency,
        p.monthly_credits, p.rollover_cap,
        ca.balance,
        ca.subscription_balance,
        ca.free_balance,
        ca.paid_balance,
        ca.promo_balance,
        ca.earned_balance
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      LEFT JOIN credit_accounts ca ON ca.teacher_id = s.teacher_id
      WHERE s.teacher_id = ${teacherId}
      LIMIT 1
    `);
    res.json({ subscription: (rows.rows[0] as any) ?? null });
  } catch (err) {
    logger.error(err, "GET /subscriptions/me failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ─── Create checkout URL ──────────────────────────────────────────────────────

router.post("/subscriptions/checkout", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "غير مصرح" });
    return;
  }

  const { planCode } = req.body ?? {};
  if (!planCode || !["basic", "pro"].includes(planCode)) {
    res.status(400).json({ message: "كود الباقة غير صحيح" });
    return;
  }

  try {
    const [plan] = await db
      .select({
        lemonVariantId: plansTable.lemonVariantId,
        nameAr:         plansTable.nameAr,
      })
      .from(plansTable)
      .where(eq(plansTable.code, planCode))
      .limit(1);

    if (!plan) {
      res.status(404).json({ message: "الباقة غير موجودة" });
      return;
    }
    if (!plan.lemonVariantId) {
      res.status(503).json({ message: "رابط الاشتراك غير متاح حالياً — تواصل مع الدعم" });
      return;
    }

    const LS_API_KEY  = process.env["LEMON_SQUEEZY_API_KEY"];
    const LS_STORE_ID = process.env["LEMON_SQUEEZY_STORE_ID"];
    const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "";

    if (!LS_API_KEY || !LS_STORE_ID) {
      logger.error("LEMON_SQUEEZY_API_KEY or LEMON_SQUEEZY_STORE_ID not set");
      res.status(503).json({ message: "خدمة الدفع غير مُعدَّة" });
      return;
    }

    const lsRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${LS_API_KEY}`,
        "Content-Type": "application/vnd.api+json",
        Accept:         "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              custom: { user_id: String(teacherId) },
            },
            product_options: {
              redirect_url: `${FRONTEND_URL}/teacher/credits?subscribed=1`,
            },
          },
          relationships: {
            store:   { data: { type: "stores",   id: LS_STORE_ID } },
            variant: { data: { type: "variants",  id: plan.lemonVariantId } },
          },
        },
      }),
    });

    if (!lsRes.ok) {
      const errBody = await lsRes.text().catch(() => "");
      logger.error({ status: lsRes.status, body: errBody }, "LS checkout creation failed");
      res.status(502).json({ message: "فشل إنشاء رابط الدفع" });
      return;
    }

    const lsData: any    = await lsRes.json();
    const checkoutUrl: string = lsData?.data?.attributes?.url ?? "";
    if (!checkoutUrl) {
      res.status(502).json({ message: "لم يُرسل رابط الدفع من Lemon Squeezy" });
      return;
    }

    res.json({ checkoutUrl });
  } catch (err) {
    logger.error(err, "POST /subscriptions/checkout failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
