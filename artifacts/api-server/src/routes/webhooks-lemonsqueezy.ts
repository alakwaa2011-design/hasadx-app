/**
 * POST /api/webhooks/lemonsqueezy
 *
 * - يستقبل raw body (يُهيأ في app.ts) ويتحقق من X-Signature قبل أي معالجة.
 * - Idempotency عبر webhook_events.idempotency_key (unique) — إدراج السجل أولاً؛
 *   تعارض unique = حدث مكرر → نجاح فوري بدون معالجة.
 * - order_created: إضافة رصيد مدفوع (expires_at = NULL) داخل Transaction واحدة.
 * - order_refunded: كامل/جزئي، سحب الرصيد بدون سالب + refund_adjustment_required عند العجز.
 */
import { Router, type IRouter } from "express";
import { db, creditPackagesTable, creditPurchasesTable, webhookEventsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { verifySignature } from "../lib/lemonsqueezy";
import { CreditService } from "../lib/credit-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/webhooks/lemonsqueezy", async (req, res) => {
  try {
    // 1) توقيع HMAC على الـ raw body — رفض فوري بدون أي أثر على الرصيد
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const signature = req.headers["x-signature"] as string | undefined;
    if (!verifySignature(rawBody, signature)) {
      logger.warn("Lemon Squeezy webhook: invalid signature");
      res.status(401).json({ message: "invalid signature" });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ message: "invalid payload" });
      return;
    }

    const eventName: string = payload?.meta?.event_name ?? "unknown";
    const objectId: string = String(payload?.data?.id ?? "");
    const objectType: string = payload?.data?.type ?? "";
    const webhookId: string | undefined = payload?.meta?.webhook_id;

    // مفتاح idempotency: يميز الحدث نفسه (النوع + الكائن + مرحلة الاسترجاع)
    const refundedAmount = Number(payload?.data?.attributes?.refunded_amount ?? 0);
    const idempotencyKey =
      eventName === "order_refunded"
        ? `lemonsqueezy:${eventName}:${objectId}:${refundedAmount}`
        : `lemonsqueezy:${eventName}:${objectId}`;

    // 2) تسجيل الحدث — unique conflict = حدث مكرر
    const inserted = await db
      .insert(webhookEventsTable)
      .values({
        provider: "lemonsqueezy",
        eventName,
        providerObjectType: objectType,
        providerObjectId: objectId,
        providerEventId: webhookId ?? null,
        idempotencyKey,
        status: "processing",
        attempts: 1,
        rawPayload: rawBody.toString("utf8").slice(0, 100_000),
      })
      .onConflictDoNothing({ target: webhookEventsTable.idempotencyKey })
      .returning({ id: webhookEventsTable.id });

    let eventRowId: number;
    if (inserted.length === 0) {
      // مفتاح موجود مسبقاً: إما معالج/قيد المعالجة (نجاح فوري بدون تكرار)،
      // أو فشل سابقاً — فنعيد المحاولة على نفس السجل (قابل للمراجعة).
      const [existing] = await db
        .select({ id: webhookEventsTable.id, status: webhookEventsTable.status })
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (!existing) {
        res.status(200).json({ message: "duplicate — already handled" });
        return;
      }
      // failed → إعادة معالجة. processing قديم (> 5 دقائق) → انهيار سابق أثناء
      // المعالجة؛ يُستصلح السجل ويُعاد. processed/ignored/processing حديث → نجاح فوري.
      const STALE_PROCESSING_MS = 5 * 60 * 1000;
      const retried = await db
        .update(webhookEventsTable)
        .set({ status: "processing", attempts: sql`attempts + 1`, updatedAt: new Date() })
        .where(and(
          eq(webhookEventsTable.id, existing.id),
          sql`(status = 'failed' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '${sql.raw(String(STALE_PROCESSING_MS / 1000))} seconds'))`
        ))
        .returning({ id: webhookEventsTable.id });
      if (retried.length === 0) {
        // معالج مسبقاً أو قيد معالجة نشطة
        res.status(200).json({ message: "duplicate — already handled" });
        return;
      }
      eventRowId = existing.id;
    } else {
      eventRowId = inserted[0].id;
    }

    const finish = async (status: string, errorMessage?: string) => {
      await db
        .update(webhookEventsTable)
        .set({
          status,
          errorMessage: errorMessage ?? null,
          processedAt: status === "processed" || status === "ignored" ? new Date() : null,
          failedAt: status === "failed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(webhookEventsTable.id, eventRowId));
    };

    try {
      if (eventName === "order_created") {
        await handleOrderCreated(payload);
        await finish("processed");
      } else if (eventName === "order_refunded") {
        await handleOrderRefunded(payload);
        await finish("processed");
      } else {
        await finish("ignored");
      }
      res.status(200).json({ message: "ok" });
    } catch (err: any) {
      logger.error(err, `Lemon Squeezy webhook processing failed (${eventName} ${objectId})`);
      // يبقى السجل بحالة failed (قابل للمراجعة)؛ إعادة الإرسال من Lemon Squeezy
      // ستجد السجل failed وتعيد المعالجة على نفس المفتاح.
      await finish("failed", String(err?.message ?? err).slice(0, 2000));
      res.status(500).json({ message: "processing failed — retry" });
    }
  } catch (err) {
    logger.error(err, "Lemon Squeezy webhook: unexpected error");
    res.status(500).json({ message: "internal error" });
  }
});

// ─── order_created ───────────────────────────────────────────────────────────

async function handleOrderCreated(payload: any): Promise<void> {
  const attrs = payload?.data?.attributes ?? {};
  const custom = payload?.meta?.custom_data ?? {};
  const orderId = String(payload?.data?.id ?? "");
  const variantId = String(attrs?.first_order_item?.variant_id ?? "");
  const totalCents = Number(attrs?.total ?? 0);
  const currency = String(attrs?.currency ?? "USD");

  const teacherId = parseInt(String(custom.user_id ?? ""));
  const purchaseIntentId = String(custom.purchase_intent_id ?? "");

  await db.transaction(async (tx) => {
    // مطابقة Purchase Intent (قفل الصف لمنع التزامن)
    let purchase: any = null;
    if (purchaseIntentId) {
      const r = await tx.execute(sql`
        SELECT * FROM credit_purchases WHERE purchase_intent_id = ${purchaseIntentId} FOR UPDATE
      `);
      purchase = r.rows[0] ?? null;
    }

    // مطابقة الـ Variant مع باقة معروفة (تُقبل حتى لو عُطّلت الباقة بعد الـ Checkout)
    const [pkg] = variantId
      ? await tx.select().from(creditPackagesTable).where(eq(creditPackagesTable.lemonVariantId, variantId)).limit(1)
      : [];

    if (!purchase && !pkg) {
      throw new Error(`Variant غير معروف (${variantId}) ولا يوجد Purchase Intent — لن يُضاف رصيد`);
    }

    // تحقق تطابق بيانات الـ Webhook مع الـ Intent قبل أي إضافة رصيد
    if (purchase) {
      if (variantId && String(purchase.lemon_variant_id) !== variantId) {
        throw new Error(`Variant لا يطابق الـ Intent (${variantId} ≠ ${purchase.lemon_variant_id})`);
      }
      if (custom.user_id && String(purchase.teacher_id) !== String(custom.user_id)) {
        throw new Error(`user_id لا يطابق الـ Intent`);
      }
    }

    const finalTeacherId = purchase ? Number(purchase.teacher_id) : teacherId;
    if (!finalTeacherId || Number.isNaN(finalTeacherId)) {
      throw new Error("تعذر تحديد المستخدم من custom_data أو Purchase Intent");
    }

    // الرصيد من الـ Snapshot إن وُجد؛ وإلا من الباقة المطابقة للـ Variant
    const credits = purchase ? Number(purchase.package_credits_snapshot) : Number(pkg!.credits);
    let purchaseRowId: number;

    if (purchase) {
      if (purchase.payment_status !== "pending_checkout") {
        // معالج سابقاً (أمان إضافي فوق idempotency)
        return;
      }
      await tx.execute(sql`
        UPDATE credit_purchases
        SET lemon_order_id = ${orderId},
            amount_cents = ${totalCents},
            currency = ${currency},
            payment_status = 'completed',
            purchased_at = NOW(), processed_at = NOW(), updated_at = NOW()
        WHERE id = ${purchase.id}
      `);
      purchaseRowId = Number(purchase.id);
    } else {
      // لا يوجد Intent (نادر) — أنشئ سجل شراء من بيانات الباقة
      const [row] = await tx
        .insert(creditPurchasesTable)
        .values({
          purchaseIntentId: `ls_order_${orderId}`,
          teacherId: finalTeacherId,
          packageId: pkg!.id,
          lemonOrderId: orderId,
          lemonVariantId: variantId,
          amountCents: totalCents,
          currency,
          creditsAmount: credits,
          packageNameSnapshot: pkg!.name || `باقة ${pkg!.credits}`,
          packagePriceSnapshot: pkg!.priceUsdCents,
          packageCreditsSnapshot: credits,
          paymentStatus: "completed",
          purchasedAt: new Date(),
          processedAt: new Date(),
        })
        .returning({ id: creditPurchasesTable.id });
      purchaseRowId = row.id;
    }

    await CreditService.addPurchasedCredits(
      tx,
      finalTeacherId,
      credits,
      purchaseRowId,
      `ls_order_${orderId}`,
      `شراء باقة رصيد (${credits} رصيد)`
    );
  });
}

// ─── order_refunded ──────────────────────────────────────────────────────────

async function handleOrderRefunded(payload: any): Promise<void> {
  const attrs = payload?.data?.attributes ?? {};
  const orderId = String(payload?.data?.id ?? "");
  const refundedCents = Number(attrs?.refunded_amount ?? 0);
  const totalCents = Number(attrs?.total ?? 0);

  await db.transaction(async (tx) => {
    const r = await tx.execute(sql`
      SELECT * FROM credit_purchases WHERE lemon_order_id = ${orderId} FOR UPDATE
    `);
    const purchase: any = r.rows[0];
    if (!purchase) throw new Error(`Refund لطلب غير معروف (${orderId})`);

    const alreadyRefundedCents = Number(purchase.refunded_amount_cents ?? 0);
    const newRefundCents = refundedCents - alreadyRefundedCents;
    if (newRefundCents <= 0) return; // نفس الـ Refund مكرر

    // الرصيد المسحوب يتناسب مع نسبة المبلغ المسترجع الجديد
    const totalCredits = Number(purchase.package_credits_snapshot);
    const priceRef = totalCents > 0 ? totalCents : Number(purchase.amount_cents || purchase.package_price_snapshot || 1);
    const alreadyRefundedCredits = Number(purchase.refunded_credits_amount ?? 0);
    const remainingCredits = totalCredits - alreadyRefundedCredits;
    const isFullRefund = refundedCents >= priceRef;
    const creditsToDeduct = isFullRefund
      ? remainingCredits
      : Math.min(remainingCredits, Math.round((newRefundCents / priceRef) * totalCredits));

    const { deducted, shortfall } = await CreditService.deductRefundedCredits(
      tx,
      Number(purchase.teacher_id),
      creditsToDeduct,
      Number(purchase.id),
      `ls_refund_${orderId}_${refundedCents}`,
      isFullRefund ? "استرجاع كامل لعملية شراء" : "استرجاع جزئي لعملية شراء"
    );

    await tx.execute(sql`
      UPDATE credit_purchases
      SET refunded_amount_cents = ${refundedCents},
          refunded_credits_amount = ${alreadyRefundedCredits + creditsToDeduct},
          payment_status = ${isFullRefund ? "refunded" : "partially_refunded"},
          refund_review_status = ${shortfall > 0 ? "needs_review" : purchase.refund_review_status ?? "none"},
          refund_review_note = ${shortfall > 0 ? `refund_adjustment_required: عجز ${shortfall} رصيد (سُحب ${deducted} من ${creditsToDeduct})` : purchase.refund_review_note},
          refund_processed_at = NOW(), updated_at = NOW()
      WHERE id = ${purchase.id}
    `);
  });
}

export default router;
