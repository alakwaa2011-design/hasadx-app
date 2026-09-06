/**
 * مسارات المعلم لشراء الرصيد (Lemon Squeezy).
 * - GET  /credits/packages          الباقات النشطة الظاهرة فقط
 * - GET  /credits/me                تفصيل رصيد المعلم الحالي
 * - POST /credits/checkout          إنشاء Checkout من الخادم — المتصفح يرسل package_id فقط
 * - GET  /credits/purchases         سجل مشتريات المعلم
 * - GET  /credits/purchases/:intent حالة عملية (لصفحة العودة — عرض فقط، لا يضيف رصيداً)
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db, teachersTable, creditPackagesTable, creditPurchasesTable } from "@workspace/db";
import { eq, and, isNull, asc, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { CreditService } from "../lib/credit-service";
import { createCheckout, lemonConfigured, frontendOrigin } from "../lib/lemonsqueezy";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireTeacher(req: Request, res: Response, next: () => void): void {
  if (!req.session?.teacherId) { res.status(401).json({ message: "غير مصرح" }); return; }
  next();
}

router.get("/credits/packages", requireTeacher as any, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: creditPackagesTable.id,
        name: creditPackagesTable.name,
        description: creditPackagesTable.description,
        priceUsdCents: creditPackagesTable.priceUsdCents,
        currency: creditPackagesTable.currency,
        credits: creditPackagesTable.credits,
        isFeatured: creditPackagesTable.isFeatured,
        sortOrder: creditPackagesTable.sortOrder,
      })
      .from(creditPackagesTable)
      .where(and(eq(creditPackagesTable.isVisible, true), isNull(creditPackagesTable.archivedAt)))
      .orderBy(asc(creditPackagesTable.sortOrder), asc(creditPackagesTable.id));
    res.json({ packages: rows, purchasesEnabled: process.env.PAYMENTS_ENABLED === "true" && lemonConfigured() });
  } catch {
    res.status(500).json({ message: "فشل تحميل الباقات" });
  }
});

/* سعر أداة للمعلم الحالي — السعر النهائي يأتي من المنطق المركزي (خصم Pro
   يطبَّق مرة واحدة في CreditService)، فالواجهة تعرضه فقط ولا تحسبه. */
router.get("/credits/tool-price/:toolKey", requireTeacher as any, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const teacherId = req.session!.teacherId!;
    const toolKey = String(req.params.toolKey || "").slice(0, 64);
    const [settingsRow] = await db.execute(sql`SELECT credits_enabled FROM platform_settings LIMIT 1`).then(r => r.rows as any[]);
    const creditsEnabled = Boolean(settingsRow?.credits_enabled);
    const { baseCost, effectiveCost, isPro } = await CreditService.getEffectiveCost(teacherId, toolKey);
    const balance = await CreditService.getBalance(teacherId);
    res.json({ toolKey, baseCost, effectiveCost, isPro, balance, creditsEnabled });
  } catch {
    res.status(500).json({ message: "فشل تحميل سعر الأداة" });
  }
});

router.get("/credits/me", requireTeacher as any, async (req, res) => {
  try {
    const detail = await CreditService.getBalanceDetail(req.session!.teacherId!);
    res.json(detail);
  } catch {
    res.status(500).json({ message: "فشل تحميل الرصيد" });
  }
});

const CheckoutSchema = z.object({ packageId: z.number().int().positive() }).strict();

router.post("/credits/checkout", requireTeacher as any, async (req, res) => {
  try {
    // حارس: يرفض الطلب مباشرةً إذا كانت المدفوعات معطّلة من الإعداد.
    if (process.env.PAYMENTS_ENABLED !== "true") {
      res.status(503).json({ code: "PAYMENTS_DISABLED", message: "الدفع غير متاح حاليًا" });
      return;
    }
    if (!lemonConfigured()) {
      res.status(503).json({ message: "الشراء غير متاح حالياً" });
      return;
    }
    const { packageId } = CheckoutSchema.parse(req.body);
    const teacherId = req.session!.teacherId!;

    const [pkg] = await db
      .select()
      .from(creditPackagesTable)
      .where(and(eq(creditPackagesTable.id, packageId), eq(creditPackagesTable.isVisible, true), isNull(creditPackagesTable.archivedAt)))
      .limit(1);
    if (!pkg) { res.status(404).json({ message: "الباقة غير متاحة" }); return; }
    if (!pkg.lemonVariantId) {
      res.status(503).json({ message: "الباقة غير مربوطة بمنتج الدفع بعد" });
      return;
    }
    if (pkg.priceUsdCents <= 0 || pkg.credits <= 0 || pkg.currency !== "USD") {
      res.status(409).json({ message: "إعدادات الباقة غير صالحة للشراء" });
      return;
    }

    const [teacher] = await db.select({ email: teachersTable.email, name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);

    // Purchase Intent + Snapshot قبل إنشاء الـ Checkout
    const purchaseIntentId = randomUUID();
    await db.insert(creditPurchasesTable).values({
      purchaseIntentId,
      teacherId,
      packageId: pkg.id,
      lemonVariantId: pkg.lemonVariantId,
      amountCents: pkg.priceUsdCents,
      currency: pkg.currency,
      creditsAmount: pkg.credits,
      packageNameSnapshot: pkg.name || `باقة ${pkg.credits}`,
      packagePriceSnapshot: pkg.priceUsdCents,
      packageCreditsSnapshot: pkg.credits,
      paymentStatus: "pending_checkout",
    });

    const { checkoutUrl } = await createCheckout({
      variantId: pkg.lemonVariantId,
      email: teacher?.email ?? null,
      name: teacher?.name  ?? null,
      successUrl: `${frontendOrigin()}/teacher/credits?purchase=success`,
      customData: {
        user_id: String(teacherId),
        package_id: String(pkg.id),
        purchase_intent_id: purchaseIntentId,
      },
    });

    res.json({ checkoutUrl, purchaseIntentId });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ message: "بيانات غير صحيحة" }); return; }
    logger.error(err, "Checkout creation failed");
    res.status(500).json({ message: "تعذر إنشاء صفحة الدفع، حاول مرة أخرى" });
  }
});

router.get("/credits/purchases", requireTeacher as any, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: creditPurchasesTable.id,
        packageName: creditPurchasesTable.packageNameSnapshot,
        amountCents: creditPurchasesTable.amountCents,
        currency: creditPurchasesTable.currency,
        credits: creditPurchasesTable.packageCreditsSnapshot,
        paymentStatus: creditPurchasesTable.paymentStatus,
        purchasedAt: creditPurchasesTable.purchasedAt,
        createdAt: creditPurchasesTable.createdAt,
      })
      .from(creditPurchasesTable)
      .where(eq(creditPurchasesTable.teacherId, req.session!.teacherId!))
      .orderBy(desc(creditPurchasesTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch {
    res.status(500).json({ message: "فشل تحميل سجل المشتريات" });
  }
});

router.get("/credits/purchases/:intentId/status", requireTeacher as any, async (req, res) => {
  try {
    const [row] = await db
      .select({
        paymentStatus: creditPurchasesTable.paymentStatus,
        credits: creditPurchasesTable.packageCreditsSnapshot,
        packageName: creditPurchasesTable.packageNameSnapshot,
      })
      .from(creditPurchasesTable)
      .where(and(
        eq(creditPurchasesTable.purchaseIntentId, req.params.intentId),
        eq(creditPurchasesTable.teacherId, req.session!.teacherId!)
      ))
      .limit(1);
    if (!row) { res.status(404).json({ message: "عملية غير موجودة" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ message: "فشل التحقق من العملية" });
  }
});

export default router;
