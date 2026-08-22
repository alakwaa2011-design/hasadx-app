/**
 * Admin-only routes for the credits system.
 * All routes require `isAdmin === true` on the teacher's session.
 * Mounted at /api/admin/credits via routes/index.ts.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, teachersTable, creditToolPricesTable, creditAccountsTable, creditTransactionsTable, creditPackagesTable, platformSettingsTable, subscriptionsTable, plansTable } from "@workspace/db";
import { eq, sql, and, ilike, or, desc, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { CreditService } from "../lib/credit-service";
import { invalidateCreditsSettingsCache } from "../lib/check-credits";

const router: IRouter = Router();

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const teacherId = req.session?.teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مصرح" }); return; }
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  if (!t?.isAdmin) { res.status(403).json({ message: "للمسؤولين فقط" }); return; }
  next();
}

router.use(requireAdmin as any);

// ─── Tool Prices ──────────────────────────────────────────────────────────────

router.get("/tool-prices", async (req, res) => {
  try {
    const { category, q } = req.query as Record<string, string>;
    let query = db.select().from(creditToolPricesTable).$dynamic();
    const conditions: any[] = [];
    if (category) conditions.push(eq(creditToolPricesTable.category, category));
    if (q)        conditions.push(or(ilike(creditToolPricesTable.toolKey, `%${q}%`), ilike(creditToolPricesTable.toolNameAr, `%${q}%`)));
    if (conditions.length) query = query.where(and(...(conditions as [any, ...any[]])));
    const rows = await query.orderBy(asc(creditToolPricesTable.category), asc(creditToolPricesTable.toolKey));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل أسعار الأدوات" });
  }
});

const ToolPricePatchSchema = z.object({
  creditsCost:      z.number().int().min(0).optional(),
  timeoutSeconds:   z.number().int().min(1).optional(),
  isCreditEnabled:  z.boolean().optional(),
  reset:            z.boolean().optional(),
}).strict();

router.patch("/tool-prices/:toolKey", async (req, res) => {
  try {
    const { toolKey } = req.params;
    const body = ToolPricePatchSchema.parse(req.body);
    const adminId = req.session!.teacherId!;

    const updates: Record<string, any> = { updatedBy: adminId, updatedAt: new Date() };
    if (body.reset) {
      // Reset credits_cost back to default
      const [current] = await db.select({ def: creditToolPricesTable.defaultCreditsCost }).from(creditToolPricesTable).where(eq(creditToolPricesTable.toolKey, toolKey)).limit(1);
      updates.creditsCost = current?.def ?? 0;
    } else {
      if (body.creditsCost     !== undefined) updates.creditsCost    = body.creditsCost;
      if (body.timeoutSeconds  !== undefined) updates.timeoutSeconds = body.timeoutSeconds;
      if (body.isCreditEnabled !== undefined) updates.isCreditEnabled = body.isCreditEnabled;
    }

    const [updated] = await db.update(creditToolPricesTable).set(updates).where(eq(creditToolPricesTable.toolKey, toolKey)).returning();
    if (!updated) { res.status(404).json({ message: "أداة غير موجودة" }); return; }
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل تحديث سعر الأداة" });
  }
});

// ─── Teachers / Accounts ──────────────────────────────────────────────────────

router.get("/teachers", async (req, res) => {
  try {
    const { q, page = "1", pageSize = "30" } = req.query as Record<string, string>;
    const allTeachers = pageSize === "all";
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));
    const offset = (pg - 1) * size;

    // الـ SQL الخام أدناه يشير للجدول بالاسم المستعار "ca" — يجب أن يحمل الـ join نفس الاسم
    const ca = alias(creditAccountsTable, "ca");
    const sub = alias(subscriptionsTable, "sub");
    const pl = alias(plansTable, "pl");
    let baseQuery = db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        email: teachersTable.email,
        unlimitedCredits: teachersTable.unlimitedCredits,
        balance: sql<number>`COALESCE(ca.balance, 0)`,
        totalEarned: sql<number>`COALESCE(ca.total_earned, 0)`,
        totalSpent: sql<number>`COALESCE(ca.total_spent, 0)`,
        updatedAt: sql<string>`ca.updated_at`,
        planCode: sql<string | null>`pl.code`,
        planNameAr: sql<string | null>`pl.name_ar`,
        subscriptionStatus: sql<string | null>`sub.status`,
        planExpiresAt: sql<string | null>`COALESCE(sub.expires_at, sub.current_period_end)`,
      })
      .from(teachersTable)
      .leftJoin(ca, eq(ca.teacherId, teachersTable.id))
      .leftJoin(sub, eq(sub.teacherId, teachersTable.id))
      .leftJoin(pl, eq(pl.id, sub.planId))
      .$dynamic();

    // شرط البحث يُبنى مرة واحدة ويُطبَّق على الصفوف والعدّاد معًا
    const searchWhere = q
      ? or(ilike(teachersTable.name, `%${q}%`), ilike(teachersTable.email, `%${q}%`))
      : undefined;
    if (searchWhere) baseQuery = baseQuery.where(searchWhere);

    let countQuery = db.select({ total: sql<number>`COUNT(*)::int` }).from(teachersTable).$dynamic();
    if (searchWhere) countQuery = countQuery.where(searchWhere);

    const rowsQuery = baseQuery.orderBy(desc(sql`COALESCE(ca.balance, 0)`));
    const [rows, [{ total }]] = await Promise.all([
      allTeachers ? rowsQuery : rowsQuery.limit(size).offset(offset),
      countQuery,
    ]);

    res.json({ rows, total, page: allTeachers ? 1 : pg, pageSize: allTeachers ? total : size });
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل أرصدة المعلمين" });
  }
});

router.get("/teachers/:id/balance", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const balance = await CreditService.getBalance(id);
    res.json({ teacherId: id, balance });
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل الرصيد" });
  }
});

const AdjustSchema = z.object({
  delta:  z.number().int(),
  reason: z.string().min(1),
  mode:   z.enum(["add", "deduct", "set"]).default("add"),
}).strict();

// ─── Toggle unlimited credits ──────────────────────────────────────────────────

const ToggleUnlimitedSchema = z.object({
  reason: z.string().min(1, "السبب مطلوب"),
}).strict();

router.post("/teachers/:id/toggle-unlimited", requireAdmin, async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id as string);
    if (Number.isNaN(teacherId)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const { reason } = ToggleUnlimitedSchema.parse(req.body);
    const adminId = req.session!.teacherId!;

    // Fetch current state
    const [teacher] = await db
      .select({ id: teachersTable.id, name: teachersTable.name, unlimitedCredits: teachersTable.unlimitedCredits })
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);
    if (!teacher) { res.status(404).json({ message: "المعلم غير موجود" }); return; }

    const newValue = !teacher.unlimitedCredits;

    await db.transaction(async (tx) => {
      await tx
        .update(teachersTable)
        .set({ unlimitedCredits: newValue })
        .where(eq(teachersTable.id, teacherId));

      // سجّل العملية في credit_transactions للمراجعة والإحصائيات
      await tx.insert(creditTransactionsTable).values({
        teacherId,
        amount: 0,
        type: "adjust",
        reason: `${newValue ? "تفعيل" : "تعطيل"} الاستخدام غير المحدود — ${reason}`,
        adminId,
        status: "completed",
        creditType: "promo",
        source: "admin_adjustment",
      });
    });

    res.json({ teacherId, unlimitedCredits: newValue });
  } catch (err: any) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "السبب مطلوب", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل تحديث الإعداد" });
  }
});

router.post("/teachers/:id/adjust", async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);
    const { delta, reason, mode } = AdjustSchema.parse(req.body);
    const adminId = req.session!.teacherId!;
    const newBalance = await CreditService.adjustBalance(teacherId, delta, reason, adminId, mode);
    res.json({ teacherId, newBalance });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل تعديل الرصيد" });
  }
});

const BulkAdjustSchema = z.object({
  delta:  z.number().int(),
  reason: z.string().min(1),
}).strict();

router.post("/teachers/bulk-adjust", async (req, res) => {
  try {
    const { delta, reason } = BulkAdjustSchema.parse(req.body);
    const adminId = req.session!.teacherId!;
    const count = await CreditService.bulkAdjustBalance(delta, reason, adminId);
    res.json({ count, message: `تم تعديل رصيد ${count} معلم` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل التعديل الجماعي" });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get("/transactions", async (req, res) => {
  try {
    const { teacherId, type, toolKey, status, fromDate, toDate, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const result = await CreditService.listTransactions(
      {
        teacherId: teacherId ? parseInt(teacherId) : undefined,
        type, toolKey, status,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate:   toDate   ? new Date(toDate)   : undefined,
      },
      parseInt(page),
      Math.min(200, parseInt(pageSize))
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل السجل" });
  }
});

router.get("/transactions/export.csv", async (req, res) => {
  try {
    const { teacherId, type, toolKey, status, fromDate, toDate } = req.query as Record<string, string>;
    const csv = await CreditService.exportTransactionsCsv({
      teacherId: teacherId ? parseInt(teacherId) : undefined,
      type, toolKey, status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate:   toDate   ? new Date(toDate)   : undefined,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="credit-transactions-${Date.now()}.csv"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8
  } catch (err) {
    res.status(500).json({ message: "فشل تصدير السجل" });
  }
});

// ─── Packages ─────────────────────────────────────────────────────────────────

router.get("/packages", async (req, res) => {
  try {
    const rows = await db.select().from(creditPackagesTable).orderBy(asc(creditPackagesTable.sortOrder));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل الباقات" });
  }
});

const PackageSchema = z.object({
  name:           z.string().min(1),
  description:    z.string().nullable().optional(),
  priceUsdCents:  z.number().int().min(1),
  credits:        z.number().int().min(1),
  lemonProductId: z.string().nullable().optional(),
  lemonVariantId: z.string().nullable().optional(),
  sortOrder:      z.number().int().default(0),
  isVisible:      z.boolean().default(true),
  isFeatured:     z.boolean().default(false),
}).strict();

/** باقة موصى بها واحدة فقط */
async function clearOtherFeatured(exceptId?: number) {
  if (exceptId !== undefined) {
    await db.execute(sql`UPDATE credit_packages SET is_featured = FALSE WHERE id <> ${exceptId}`);
  } else {
    await db.execute(sql`UPDATE credit_packages SET is_featured = FALSE`);
  }
}

router.post("/packages", async (req, res) => {
  try {
    const body = PackageSchema.parse(req.body);
    if (body.isFeatured) await clearOtherFeatured();
    const [row] = await db.insert(creditPackagesTable).values({ ...body, updatedAt: new Date() }).returning();
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل إضافة الباقة" });
  }
});

router.patch("/packages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = PackageSchema.partial().parse(req.body);
    if (body.isFeatured) await clearOtherFeatured(id);
    const [row] = await db.update(creditPackagesTable).set({ ...body, updatedAt: new Date() }).where(eq(creditPackagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "باقة غير موجودة" }); return; }
    res.json(row);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل تحديث الباقة" });
  }
});

router.post("/packages/:id/archive", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(creditPackagesTable)
      .set({ archivedAt: new Date(), isVisible: false, isFeatured: false, updatedAt: new Date() })
      .where(eq(creditPackagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "باقة غير موجودة" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ message: "فشل أرشفة الباقة" });
  }
});

router.post("/packages/:id/unarchive", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(creditPackagesTable)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(creditPackagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "باقة غير موجودة" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ message: "فشل إلغاء الأرشفة" });
  }
});

router.delete("/packages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // منع الحذف الحقيقي لباقة مرتبطة بعمليات شراء — الأرشفة فقط
    const linked = await db.execute(sql`SELECT 1 FROM credit_purchases WHERE package_id = ${id} LIMIT 1`);
    if (linked.rows.length > 0) {
      res.status(409).json({ message: "لا يمكن حذف باقة مرتبطة بعمليات شراء — استخدم الأرشفة" });
      return;
    }
    await db.delete(creditPackagesTable).where(eq(creditPackagesTable.id, id));
    res.json({ message: "تم حذف الباقة" });
  } catch (err) {
    res.status(500).json({ message: "فشل حذف الباقة" });
  }
});

// ─── Purchases & Webhook events (مراجعة) ─────────────────────────────────────

router.get("/purchases", async (req, res) => {
  try {
    const { page = "1", pageSize = "50", status } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));
    const where = status ? sql`WHERE cp.payment_status = ${status}` : sql``;
    const rows = await db.execute(sql`
      SELECT cp.*, t.name AS teacher_name, t.email AS teacher_email
      FROM credit_purchases cp
      LEFT JOIN teachers t ON t.id = cp.teacher_id
      ${where}
      ORDER BY cp.created_at DESC
      LIMIT ${size} OFFSET ${(pg - 1) * size}
    `);
    const [{ total }] = (await db.execute(sql`SELECT COUNT(*)::int AS total FROM credit_purchases cp ${where}`)).rows as any[];
    res.json({ rows: rows.rows, total, page: pg, pageSize: size });
  } catch {
    res.status(500).json({ message: "فشل تحميل المشتريات" });
  }
});

router.get("/webhook-events", async (req, res) => {
  try {
    const { page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));
    const rows = await db.execute(sql`
      SELECT id, provider, event_name, provider_object_id, idempotency_key, status, attempts, error_message, processed_at, failed_at, created_at
      FROM webhook_events ORDER BY created_at DESC LIMIT ${size} OFFSET ${(pg - 1) * size}
    `);
    res.json(rows.rows);
  } catch {
    res.status(500).json({ message: "فشل تحميل سجل الأحداث" });
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/settings", async (req, res) => {
  try {
    const [row] = await db
      .select({
        creditsEnabled:      platformSettingsTable.creditsEnabled,
        welcomeCredits:      platformSettingsTable.welcomeCredits,
        adminCreditTestMode: platformSettingsTable.adminCreditTestMode,
      })
      .from(platformSettingsTable)
      .limit(1);
    res.json(row ?? { creditsEnabled: false, welcomeCredits: 120, adminCreditTestMode: false });
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل الإعدادات" });
  }
});

const CreditSettingsSchema = z.object({
  creditsEnabled:      z.boolean().optional(),
  welcomeCredits:      z.number().int().min(0).optional(),
  adminCreditTestMode: z.boolean().optional(),
}).strict();

router.patch("/settings", async (req, res) => {
  try {
    const body = CreditSettingsSchema.parse(req.body);
    await db.update(platformSettingsTable).set(body);
    invalidateCreditsSettingsCache();
    const [row] = await db
      .select({ creditsEnabled: platformSettingsTable.creditsEnabled, welcomeCredits: platformSettingsTable.welcomeCredits, adminCreditTestMode: platformSettingsTable.adminCreditTestMode })
      .from(platformSettingsTable).limit(1);
    res.json(row);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل حفظ الإعدادات" });
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get("/summary", async (req, res) => {
  try {
    const summary = await CreditService.getSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: "فشل تحميل الإحصائيات" });
  }
});

// ─── Missing-Welcome Credits ───────────────────────────────────────────────────
// Returns teachers who have no credit_batches row with source='free',
// meaning the welcome-credits grant silently failed at login time.

router.get("/missing-welcome", async (req, res) => {
  try {
    const { page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const pg   = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));
    const offset = (pg - 1) * size;

    const [rows, countRows] = await Promise.all([
      db.execute(sql`
        SELECT t.id, t.name, t.email, t.created_at
        FROM teachers t
        WHERE NOT EXISTS (
          SELECT 1 FROM credit_batches cb
          WHERE cb.teacher_id = t.id
            AND cb.source = 'free'
        )
        ORDER BY t.created_at DESC
        LIMIT ${size} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM teachers t
        WHERE NOT EXISTS (
          SELECT 1 FROM credit_batches cb
          WHERE cb.teacher_id = t.id
            AND cb.source = 'free'
        )
      `),
    ]);

    const total = Number((countRows.rows[0] as any)?.total ?? 0);
    res.json({ rows: rows.rows, total, page: pg, pageSize: size });
  } catch (err) {
    console.error("[missing-welcome] query failed:", err);
    res.status(500).json({ message: "فشل تحميل قائمة المعلمين" });
  }
});

// Grant welcome credits to a single teacher (idempotent — safe to retry).
router.post("/missing-welcome/grant/:id", async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);
    if (Number.isNaN(teacherId)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    await CreditService.grantWelcomeCredits(teacherId);
    res.json({ teacherId, ok: true });
  } catch (err) {
    console.error("[missing-welcome] single grant failed:", err);
    res.status(500).json({ message: "فشل منح النقاط" });
  }
});

// Grant welcome credits to ALL teachers still missing them (idempotent per teacher).
router.post("/missing-welcome/grant-all", async (req, res) => {
  try {
    const missingRows = await db.execute(sql`
      SELECT t.id
      FROM teachers t
      WHERE NOT EXISTS (
        SELECT 1 FROM credit_batches cb
        WHERE cb.teacher_id = t.id
          AND cb.source = 'free'
      )
    `);

    const ids = (missingRows.rows as { id: number }[]).map((r) => r.id);
    let succeeded = 0;
    let failed    = 0;

    // Process sequentially to avoid hammering the DB with concurrent locks.
    for (const id of ids) {
      try {
        await CreditService.grantWelcomeCredits(id);
        succeeded++;
      } catch (e) {
        console.error(`[missing-welcome] grant failed for teacher ${id}:`, e);
        failed++;
      }
    }

    res.json({
      total: ids.length,
      succeeded,
      failed,
      message: `تم منح النقاط لـ ${succeeded} معلم${failed > 0 ? `، فشل ${failed}` : ""}`,
    });
  } catch (err) {
    console.error("[missing-welcome] grant-all failed:", err);
    res.status(500).json({ message: "فشل تنفيذ المنح الجماعي" });
  }
});

export default router;
