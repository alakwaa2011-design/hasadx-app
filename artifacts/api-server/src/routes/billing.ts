import { Router, type IRouter } from "express";
import { eq, sql, desc, and, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, plansTable, subscriptionsTable, teachersTable } from "@workspace/db";
import { featureAccess, FEATURES } from "@workspace/billing";

const router: IRouter = Router();

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
  const [plan] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(eq(plansTable.code, planCode))
    .limit(1);
  if (!plan) return res.status(404).json({ message: "الباقة غير موجودة" });

  await db
    .insert(subscriptionsTable)
    .values({ teacherId, planId: plan.id, status: "active" })
    .onConflictDoUpdate({
      target: subscriptionsTable.teacherId,
      set: { planId: plan.id, status: "active", updatedAt: new Date() },
    });
  featureAccess.invalidate(teacherId);
  res.json({ ok: true });
});

/* -------------------------------------------------------------------------- */
/*  Admin: plans catalog management                                            */
/* -------------------------------------------------------------------------- */

/** GET /api/billing/admin/overview — totals + per-plan subscriber count + MRR estimate */
router.get("/billing/admin/overview", requireAdminMw, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.sortOrder);

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
    maxHomeworksPerMonth: z.number().int().min(0).nullable().optional(),
    aiUsageDailyLimit: z.number().int().min(0).nullable().optional(),
    maxUsers: z.number().int().min(0).nullable().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
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
