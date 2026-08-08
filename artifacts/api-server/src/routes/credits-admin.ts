/**
 * Admin-only routes for the credits system.
 * All routes require `isAdmin === true` on the teacher's session.
 * Mounted at /api/admin/credits via routes/index.ts.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db, teachersTable, creditToolPricesTable, creditAccountsTable, creditTransactionsTable, creditPackagesTable, platformSettingsTable } from "@workspace/db";
import { eq, sql, and, ilike, or, desc, asc } from "drizzle-orm";
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
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));
    const offset = (pg - 1) * size;

    let baseQuery = db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        email: teachersTable.email,
        balance: sql<number>`COALESCE(ca.balance, 0)`,
        totalEarned: sql<number>`COALESCE(ca.total_earned, 0)`,
        totalSpent: sql<number>`COALESCE(ca.total_spent, 0)`,
        updatedAt: sql<string>`ca.updated_at`,
      })
      .from(teachersTable)
      .leftJoin(creditAccountsTable, eq(creditAccountsTable.teacherId, teachersTable.id))
      .$dynamic();

    if (q) {
      baseQuery = baseQuery.where(or(ilike(teachersTable.name, `%${q}%`), ilike(teachersTable.email, `%${q}%`)));
    }

    const [rows, [{ total }]] = await Promise.all([
      baseQuery.orderBy(desc(sql`ca.balance`)).limit(size).offset(offset),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(teachersTable),
    ]);

    res.json({ rows, total, page: pg, pageSize: size });
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
  priceUsdCents: z.number().int().min(0),
  credits:       z.number().int().min(1),
  sortOrder:     z.number().int().default(0),
  isVisible:     z.boolean().default(true),
}).strict();

router.post("/packages", async (req, res) => {
  try {
    const body = PackageSchema.parse(req.body);
    const [row] = await db.insert(creditPackagesTable).values(body).returning();
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
    const [row] = await db.update(creditPackagesTable).set(body).where(eq(creditPackagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "باقة غير موجودة" }); return; }
    res.json(row);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة", issues: err.issues }); return; }
    res.status(500).json({ message: "فشل تحديث الباقة" });
  }
});

router.delete("/packages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(creditPackagesTable).where(eq(creditPackagesTable.id, id));
    res.json({ message: "تم حذف الباقة" });
  } catch (err) {
    res.status(500).json({ message: "فشل حذف الباقة" });
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

export default router;
