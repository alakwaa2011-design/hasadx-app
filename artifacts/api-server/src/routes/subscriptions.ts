/**
 * Subscription management routes.
 *
 * GET  /api/subscriptions/plans     — list available plans
 * GET  /api/subscriptions/me        — current teacher subscription + balance
 * POST /api/subscriptions/checkout  — create Lemon Squeezy checkout URL
 * POST /api/subscriptions/cancel    — cancel active subscription (end of period)
 */
import { Router, type IRouter } from "express";
import { db, plansTable, subscriptionsTable, platformSettingsTable, teachersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createCheckout, frontendOrigin } from "../lib/lemonsqueezy";

const router: IRouter = Router();

// ─── List plans ───────────────────────────────────────────────────────────────

router.get("/subscriptions/plans", async (req, res) => {
  try {
    const [plans, [settings]] = await Promise.all([
      db
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
        .orderBy(asc(plansTable.sortOrder)),
      db
        .select({ pricingPageVisible: platformSettingsTable.pricingPageVisible })
        .from(platformSettingsTable)
        .orderBy(asc(platformSettingsTable.id))
        .limit(1),
    ]);

    let pricingPageVisible = settings?.pricingPageVisible ?? false;
    if (!pricingPageVisible && req.session?.teacherId) {
      const [viewer] = await db
        .select({ isAdmin: teachersTable.isAdmin })
        .from(teachersTable)
        .where(eq(teachersTable.id, req.session.teacherId))
        .limit(1);
      pricingPageVisible = viewer?.isAdmin === true;
    }

    res.json({ plans, pricingPageVisible, paymentsEnabled: process.env.PAYMENTS_ENABLED === "true" });
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

  // حارس: يرفض الطلب مباشرةً إذا كانت المدفوعات معطّلة من الإعداد.
  if (process.env.PAYMENTS_ENABLED !== "true") {
    res.status(503).json({ code: "PAYMENTS_DISABLED", message: "الدفع غير متاح حاليًا" });
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

    // بيانات المعلم لملء حقول الدفع مسبقًا
    const [teacher] = await db
      .select({ email: teachersTable.email, name: teachersTable.name })
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);

    const { checkoutUrl } = await createCheckout({
      variantId:  plan.lemonVariantId,
      email:      teacher?.email ?? null,
      name:       teacher?.name  ?? null,
      successUrl: `${frontendOrigin()}/teacher/credits?subscribed=1`,
      customData: {
        user_id:            String(teacherId),
        package_id:         "",
        purchase_intent_id: "",
      },
    });

    res.json({ checkoutUrl });
  } catch (err) {
    logger.error(err, "POST /subscriptions/checkout failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ─── Cancel subscription ──────────────────────────────────────────────────────
// Cancels at end of current billing period (not immediately).
// If Lemon Squeezy is configured: calls PATCH /v1/subscriptions/:id {cancelled:true}.
// If not configured (dev/test): cancels locally only.

router.post("/subscriptions/cancel", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "غير مصرح" });
    return;
  }
  try {
    // Load current subscription
    const rows = await db.execute(sql`
      SELECT s.id, s.status, s.external_subscription_id, s.current_period_end,
             p.code AS plan_code
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.teacher_id = ${teacherId}
      LIMIT 1
    `);
    const sub = rows.rows[0] as any;

    if (!sub) {
      res.status(404).json({ message: "لا يوجد اشتراك" });
      return;
    }
    if (sub.plan_code === "free") {
      res.status(400).json({ message: "لا يمكن إلغاء الباقة المجانية" });
      return;
    }
    // Accept both spellings used across the codebase ('cancelled' / 'canceled')
    if (sub.status === "cancelled" || sub.status === "canceled") {
      res.status(400).json({ message: "الاشتراك ملغى بالفعل" });
      return;
    }

    // ── Call Lemon Squeezy API if configured ───────────────────────────────
    const LS_API_KEY = process.env["LEMON_SQUEEZY_API_KEY"];
    const lsSubId   = sub.external_subscription_id as string | null;

    if (LS_API_KEY && lsSubId) {
      const lsRes = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${lsSubId}`,
        {
          method: "PATCH",
          headers: {
            Authorization:  `Bearer ${LS_API_KEY}`,
            "Content-Type": "application/vnd.api+json",
            Accept:         "application/vnd.api+json",
          },
          body: JSON.stringify({
            data: {
              type:       "subscriptions",
              id:         String(lsSubId),
              attributes: { cancelled: true },
            },
          }),
        },
      );
      if (!lsRes.ok) {
        const errBody = await lsRes.text().catch(() => "");
        logger.error(
          { status: lsRes.status, body: errBody },
          "LS cancel subscription failed",
        );
        res.status(502).json({ message: "فشل إلغاء الاشتراك عبر خدمة الدفع" });
        return;
      }
      logger.info({ teacherId, lsSubId }, "LS subscription cancel request sent");
    } else {
      // Dev / test mode — cancel locally only
      logger.info(
        { teacherId },
        "cancel: Lemon Squeezy not configured — local cancel only",
      );
    }

    // ── Update DB ──────────────────────────────────────────────────────────
    await db.execute(sql`
      UPDATE subscriptions
      SET status       = 'cancelled',
          cancelled_at = NOW(),
          updated_at   = NOW()
      WHERE teacher_id = ${teacherId}
    `);

    res.json({ success: true, currentPeriodEnd: sub.current_period_end ?? null });
  } catch (err) {
    logger.error(err, "POST /subscriptions/cancel failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
