import { Router, type IRouter } from "express";
import { eq, sql, desc, and, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, plansTable, subscriptionsTable, teachersTable, platformSettingsTable } from "@workspace/db";
import { featureAccess, FEATURES } from "@workspace/billing";
import { CreditService } from "../lib/credit-service";
import { notifyTeacherOfAward } from "../lib/credit-award-notifications";

const router: IRouter = Router();
const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  next();
}

async function isAdmin(teacherId: number): Promise<boolean> {
  const [t] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  return !!t?.isAdmin;
}

async function requireAdminMw(req: any, res: any, next: any) {
  if (!req.session?.teacherId) return res.status(401).json({ message: "غير مصرح" });
  if (!(await isAdmin(req.session.teacherId))) {
    return res.status(403).json({ message: "للمسؤول فقط" });
  }
  next();
}

/** GET /api/billing/plans — list active plans (public, for pricing page) */
router.get("/billing/plans", async (_req, res) => {
  const rows = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.sortOrder);
  res.json(rows);
});

/** GET /api/billing/me — current subscription, plan limits, and usage for every gated feature */
router.get("/billing/me", requireAuth, async (req: any, res) => {
  const teacherId: number = req.session.teacherId;
  const sub = await featureAccess.getSubscription(teacherId);
  const usage: Record<string, unknown> = {};
  for (const f of FEATURES) {
    usage[f] = await featureAccess.check(teacherId, f);
  }
  res.json({
    paymentsEnabled: process.env.PAYMENTS_ENABLED === "true",
    subscription: {
      id: sub.subscriptionId,
      planId: sub.planId,
      planCode: sub.planCode,
      planNameAr: sub.planNameAr,
      planNameEn: sub.planNameEn,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      status: sub.status,
      expiresAt: sub.expiresAt,
      limits: sub.limits,
    },
    usage,
  });
});

/** POST /api/billing/admin/assign — admin assigns a plan to a teacher */
router.post("/billing/admin/assign", requireAdminMw, async (req: any, res) => {
  const teacherId = Number(req.body?.teacherId);
  const planCode = String(req.body?.planCode || "").trim();
  if (!Number.isFinite(teacherId) || teacherId <= 0 || !planCode) {
    return res.status(400).json({ message: "teacherId و planCode مطلوبان" });
  }
  // خطة school القديمة خارج نظام نقاط حصاد — لا تُعيَّن يدويًا (الصف يبقى في DB)
  if (!HASAD_PLAN_CODES.includes(planCode)) {
    return res.status(400).json({ message: "هذه الباقة خارج نظام نقاط حصاد ولا يمكن تعيينها" });
  }
  const [plan] = await db
    .select({ id: plansTable.id, nameAr: plansTable.nameAr })
    .from(plansTable)
    .where(eq(plansTable.code, planCode))
    .limit(1);
  if (!plan) return res.status(404).json({ message: "الباقة غير موجودة" });

  const [current] = await db
    .select({ code: plansTable.code })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(eq(subscriptionsTable.teacherId, teacherId))
    .limit(1);

  await db
    .insert(subscriptionsTable)
    .values({ teacherId, planId: plan.id, status: "active" })
    .onConflictDoUpdate({
      target: subscriptionsTable.teacherId,
      set: { planId: plan.id, status: "active", updatedAt: new Date() },
    });
  featureAccess.invalidate(teacherId);
  if (
    planCode !== "free" &&
    (PLAN_RANK[planCode] ?? 0) > (PLAN_RANK[current?.code ?? "free"] ?? 0)
  ) {
    await notifyTeacherOfAward(teacherId, {
      kind: "plan",
      planNameAr: plan.nameAr,
      credits: 0,
    });
  }
  res.json({ ok: true });
});

/**
 * POST /api/billing/admin/grant-plan — منح باقة حصاد يدوياً (basic/pro) مع نقاط الاشتراك.
 *
 * ينفّذ تحديث الاشتراك + منح نقاط الاشتراك عبر نفس مسار webhook الدفع الناجح
 * (CreditService.grantSubscriptionCredits → credit_batches / credit_transactions / credit_accounts).
 * لا ينشئ أي عملية في Lemon Squeezy ولا تجديداً تلقائياً.
 *
 * منع التكرار: العميل يرسل grantId (UUID) ثابتاً لكل عملية؛ يُستخدم كـ
 * subscription_invoice_id = manual_plan_grant_<grantId> — القيد الفريد في
 * subscription_credit_grants يضمن أن إعادة نفس الطلب لا تضيف دفعة ثانية.
 */
const MANUAL_GRANT_CODES = ["basic", "pro"];
router.post("/billing/admin/grant-plan", requireAdminMw, async (req: any, res) => {
  const teacherId = Number(req.body?.teacherId);
  const planCode = String(req.body?.planCode || "").trim();
  const grantId = String(req.body?.grantId || "").trim();
  if (!Number.isFinite(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: "teacherId غير صالح" });
  }
  if (!MANUAL_GRANT_CODES.includes(planCode)) {
    return res.status(400).json({ message: "المنح اليدوي يقبل الأساسية أو الاحترافية فقط" });
  }
  if (!/^[0-9a-zA-Z-]{8,64}$/.test(grantId)) {
    return res.status(400).json({ message: "grantId مطلوب (معرّف فريد للعملية)" });
  }
  const invoiceId = `manual_plan_grant_${grantId}`;

  const [teacher] = await db
    .select({
      id: teachersTable.id,
      name: teachersTable.name,
      currentPlanCode: plansTable.code,
    })
    .from(teachersTable)
    .leftJoin(subscriptionsTable, eq(subscriptionsTable.teacherId, teachersTable.id))
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!teacher) return res.status(404).json({ message: "المعلم غير موجود" });

  // ── المعاملة الواحدة: مطالبة المرجع الفريد + قفل الحساب + الاشتراك + الدفعة + الحركة ──
  // إعادة نفس grantId (نقر مزدوج/إعادة طلب) تعيد نتيجة العملية الأولى بلا أي كتابة.
  const result = await CreditService.grantManualPlan(teacherId, planCode, invoiceId);

  const [plan] = await db
    .select({ nameAr: plansTable.nameAr })
    .from(plansTable)
    .where(eq(plansTable.code, result.planCode))
    .limit(1);

  featureAccess.invalidate(teacherId);
  const newBalance = await CreditService.getBalance(teacherId);
  const isDowngrade =
    (PLAN_RANK[result.planCode] ?? 0) <
    (PLAN_RANK[teacher.currentPlanCode ?? "free"] ?? 0);
  if (!result.alreadyGranted && !isDowngrade) {
    await notifyTeacherOfAward(teacherId, {
      kind: "plan",
      planNameAr: plan?.nameAr ?? result.planCode,
      credits: result.granted,
      expiresAt: result.expiresAt,
    });
  }
  res.json({
    ok: true,
    alreadyGranted: result.alreadyGranted,
    planCode: result.planCode,
    planNameAr: plan?.nameAr ?? result.planCode,
    granted: result.granted,
    newBalance,
    expiresAt: result.expiresAt,
  });
});

/* -------------------------------------------------------------------------- */
/*  Admin: plans catalog management                                            */
/* -------------------------------------------------------------------------- */

/** خطط نظام نقاط حصاد المعتمد — أي خطة أخرى (مثل school القديمة) تُستبعد من الواجهة الجديدة */
const HASAD_PLAN_CODES = ["free", "basic", "pro"];

/** GET /api/billing/admin/overview — totals + per-plan subscriber count + MRR estimate */
router.get("/billing/admin/overview", requireAdminMw, async (_req, res) => {
  const [allPlans, [settings]] = await Promise.all([
    db.select().from(plansTable).orderBy(plansTable.sortOrder),
    db
      .select({ pricingPageVisible: platformSettingsTable.pricingPageVisible })
      .from(platformSettingsTable)
      .orderBy(platformSettingsTable.id)
      .limit(1),
  ]);

  const perPlan = await db
    .select({
      planId: subscriptionsTable.planId,
      total: sql<number>`COUNT(*)::int`,
      active: sql<number>`COUNT(*) FILTER (WHERE ${subscriptionsTable.status} = 'active')::int`,
    })
    .from(subscriptionsTable)
    .groupBy(subscriptionsTable.planId);

  const byPlanId = new Map<number, { total: number; active: number }>();
  for (const r of perPlan) {
    byPlanId.set(r.planId, { total: r.total, active: r.active });
  }

  // استبعاد الخطط خارج النظام المعتمد (school القديمة) — يبقى صفها في DB دون حذف
  const plans = allPlans.filter((p) => HASAD_PLAN_CODES.includes(p.code));

  let totalSubscribers = 0;
  let activeSubscribers = 0;
  let mrrFils = 0;
  const plansWithCounts = plans.map((p) => {
    const c = byPlanId.get(p.id) ?? { total: 0, active: 0 };
    totalSubscribers += c.total;
    activeSubscribers += c.active;
    if (p.billingPeriodDays === 30) mrrFils += c.active * p.priceMinor;
    else if (p.billingPeriodDays === 365) mrrFils += Math.round((c.active * p.priceMinor) / 12);
    return { ...p, subscriberCount: c.total, activeCount: c.active };
  });

  res.json({
    plans: plansWithCounts,
    totals: {
      plans: plans.length,
      totalSubscribers,
      activeSubscribers,
      mrrFils,
      currency: plans[0]?.currency ?? "KWD",
    },
    paymentsEnabled: process.env.PAYMENTS_ENABLED === "true",
    pricingPageVisible: settings?.pricingPageVisible ?? false,
  });
});

const PlanPatchSchema = z
  .object({
    nameAr: z.string().min(1).max(100).optional(),
    nameEn: z.string().min(1).max(100).optional(),
    priceMinor: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    billingPeriodDays: z.number().int().min(0).max(3650).optional(),
    maxStudents: z.number().int().min(0).nullable().optional(),
    maxClasses: z.number().int().min(0).nullable().optional(),
    maxUsers: z.number().int().min(0).nullable().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    lemonVariantId:   z.string().regex(/^\d+$/, "يجب أن يكون رقماً صحيحاً").nullable().optional(),
    lemonProductId:   z.string().regex(/^\d+$/, "يجب أن يكون رقماً صحيحاً").nullable().optional(),
    monthlyCredits:   z.number().int().min(0).nullable().optional(),
    rolloverCap:      z.number().int().min(0).nullable().optional(),
  })
  .strict();

/** PATCH /api/billing/admin/plans/:id — edit a plan's name/price/limits */
router.patch("/billing/admin/plans/:id", requireAdminMw, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "id غير صالح" });
  const parsed = PlanPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "بيانات غير صالحة", issues: parsed.error.issues });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ message: "لا توجد حقول للتحديث" });
  }
  // الخطة المجانية ثابتة في النظام المعتمد — يُمنع تعديل حقول التسعير/النقاط الخاصة بها
  const [existing] = await db
    .select({ code: plansTable.code })
    .from(plansTable)
    .where(eq(plansTable.id, id))
    .limit(1);
  if (!existing) return res.status(404).json({ message: "الباقة غير موجودة" });
  if (existing.code === "free") {
    const lockedFields = ["priceMinor", "monthlyCredits", "rolloverCap", "lemonProductId", "lemonVariantId", "currency", "billingPeriodDays"];
    const attempted = Object.keys(parsed.data).filter((k) => lockedFields.includes(k));
    if (attempted.length > 0) {
      return res.status(400).json({ message: "لا يمكن تعديل حقول التسعير أو النقاط للخطة المجانية", fields: attempted });
    }
  }
  const [updated] = await db
    .update(plansTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(plansTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ message: "الباقة غير موجودة" });

  // Invalidate cache for every teacher on this plan so the new limits take effect immediately.
  const subs = await db
    .select({ teacherId: subscriptionsTable.teacherId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.planId, id));
  for (const s of subs) featureAccess.invalidate(s.teacherId);

  res.json(updated);
});

/** GET /api/billing/admin/subscriptions — paginated list of subscribers, optionally filtered */
router.get("/billing/admin/subscriptions", requireAdminMw, async (req: any, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const planCode = typeof req.query.planCode === "string" ? req.query.planCode.trim() : "";
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const conds: any[] = [];
  if (planCode) conds.push(eq(plansTable.code, planCode));
  if (search) {
    const like = `%${search}%`;
    conds.push(
      or(
        ilike(teachersTable.name, like),
        ilike(teachersTable.email, like),
        ilike(teachersTable.phone, like),
      )!,
    );
  }

  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      subscriptionId: subscriptionsTable.id,
      teacherId: teachersTable.id,
      teacherName: teachersTable.name,
      teacherEmail: teachersTable.email,
      teacherPhone: teachersTable.phone,
      isAdmin: teachersTable.isAdmin,
      planId: plansTable.id,
      planCode: plansTable.code,
      planNameAr: plansTable.nameAr,
      priceMinor: plansTable.priceMinor,
      currency: plansTable.currency,
      status: subscriptionsTable.status,
      startedAt: subscriptionsTable.startedAt,
      expiresAt: subscriptionsTable.expiresAt,
      paymentProvider: subscriptionsTable.paymentProvider,
    })
    .from(subscriptionsTable)
    .innerJoin(teachersTable, eq(subscriptionsTable.teacherId, teachersTable.id))
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(where)
    .orderBy(desc(subscriptionsTable.startedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(subscriptionsTable)
    .innerJoin(teachersTable, eq(subscriptionsTable.teacherId, teachersTable.id))
    .innerJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(where);

  res.json({ rows, total, limit, offset });
});

export default router;
