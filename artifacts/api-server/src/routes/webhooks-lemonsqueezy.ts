/**
 * POST /api/webhooks/lemonsqueezy
 *
 * - Verifies X-Signature HMAC before any processing.
 * - Idempotency via webhook_events.idempotency_key (UNIQUE).
 * - Credit grant source: subscription_payment_success ONLY.
 * - Primary invoice guard: subscription_credit_grants.subscription_invoice_id UNIQUE.
 */
import { Router, type IRouter } from "express";
import {
  db,
  creditPackagesTable,
  creditPurchasesTable,
  webhookEventsTable,
  subscriptionsTable,
  plansTable,
  planBillingOptionsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { verifySignature } from "../lib/lemonsqueezy";
import { CreditService } from "../lib/credit-service";
import { logger } from "../lib/logger";
import { addOneCalendarMonth, addCalendarMonthsUtc, lockProviderSubscription } from "../lib/annual-credit-release";

const router: IRouter = Router();

/**
 * خلل دائم في الـ payload نفسه (لا يُصلحه أي retry من Lemon Squeezy).
 * يُسجَّل failed مع رسالة واضحة، لكن نرد 200 حتى لا يدخل LS في عاصفة إعادة إرسال.
 * إن أُعيد إرساله لاحقًا (يدويًا) فمسار retry الداخلي يسمح بإعادة المعالجة.
 */
class TerminalWebhookError extends Error {}

router.post("/webhooks/lemonsqueezy", async (req, res) => {
  try {
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

    const eventName: string  = payload?.meta?.event_name ?? "unknown";
    const objectId: string   = String(payload?.data?.id ?? "");
    const objectType: string = payload?.data?.type ?? "";
    const webhookId: string | undefined = payload?.meta?.webhook_id;

    const idempotencyKey = buildIdempotencyKey(eventName, objectId, payload);

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
      const [existing] = await db
        .select({ id: webhookEventsTable.id, status: webhookEventsTable.status })
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (!existing) {
        res.status(200).json({ message: "duplicate — already handled" });
        return;
      }
      const STALE_MS = 5 * 60 * 1000;
      const retried = await db
        .update(webhookEventsTable)
        .set({ status: "processing", attempts: sql`attempts + 1`, updatedAt: new Date() })
        .where(and(
          eq(webhookEventsTable.id, existing.id),
          sql`(status = 'failed' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '${sql.raw(String(STALE_MS / 1000))} seconds'))`
        ))
        .returning({ id: webhookEventsTable.id });
      if (retried.length === 0) {
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
      switch (eventName) {
        case "order_created":
          await handleOrderCreated(payload);
          await finish("processed");
          break;
        case "order_refunded":
          await handleOrderRefunded(payload);
          await finish("processed");
          break;
        case "subscription_created":
          await handleSubscriptionCreated(payload);
          await finish("processed");
          break;
        case "subscription_payment_success":
          await handleSubscriptionPaymentSuccess(payload);
          await finish("processed");
          break;
        case "subscription_payment_failed":
          await handleSubscriptionPaymentFailed(payload);
          await finish("processed");
          break;
        case "subscription_payment_recovered":
          await handleSubscriptionPaymentRecovered(payload);
          await finish("processed");
          break;
        case "subscription_cancelled":
          await handleSubscriptionCancelled(payload);
          await finish("processed");
          break;
        case "subscription_expired":
          await handleSubscriptionExpired(payload);
          await finish("processed");
          break;
        case "subscription_resumed":
          await handleSubscriptionResumed(payload);
          await finish("processed");
          break;
        case "subscription_updated":
          await handleSubscriptionUpdated(payload);
          await finish("processed");
          break;
        default:
          await finish("ignored");
      }
      res.status(200).json({ message: "ok" });
    } catch (err: any) {
      logger.error(err, `LS webhook failed (${eventName} ${objectId})`);
      await finish("failed", String(err?.message ?? err).slice(0, 2000));
      if (err instanceof TerminalWebhookError) {
        // عيب دائم في الـ payload — أقرّ الاستلام (200) لمنع retry storm من LS
        res.status(200).json({ message: "acknowledged — terminal payload defect recorded" });
      } else {
        res.status(500).json({ message: "processing failed — retry" });
      }
    }
  } catch (err) {
    logger.error(err, "Lemon Squeezy webhook: unexpected error");
    res.status(500).json({ message: "internal error" });
  }
});

// ─── Idempotency key builder ──────────────────────────────────────────────────

function buildIdempotencyKey(eventName: string, objectId: string, payload: any): string {
  const attrs = payload?.data?.attributes ?? {};
  switch (eventName) {
    case "order_refunded": {
      const refundedAmount = Number(attrs?.refunded_amount ?? 0);
      return `lemonsqueezy:order_refunded:${objectId}:${refundedAmount}`;
    }
    case "subscription_payment_success":
      // objectId = payload.data.id = the unique invoice ID
      return `lemonsqueezy:subscription_payment_success:${objectId}`;
    case "subscription_payment_recovered":
      return `lemonsqueezy:subscription_payment_recovered:${objectId}`;
    case "subscription_payment_failed": {
      const attempt = Number(attrs?.billing_anchor ?? 0);
      return `lemonsqueezy:subscription_payment_failed:${objectId}:${attempt}`;
    }
    case "subscription_updated": {
      const updatedAt = attrs?.updated_at ?? "";
      return `lemonsqueezy:subscription_updated:${objectId}:${updatedAt}`;
    }
    default:
      return `lemonsqueezy:${eventName}:${objectId}`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveTeacherFromSubscription(externalSubId: string): Promise<number | null> {
  const rows = await db
    .select({ teacherId: subscriptionsTable.teacherId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.externalSubscriptionId, externalSubId))
    .limit(1);
  return rows[0]?.teacherId ?? null;
}

async function resolvePlanByVariant(variantId: string): Promise<any | null> {
  const rows = await db
    .select({ plan: plansTable, billingInterval: planBillingOptionsTable.billingInterval, variantId: planBillingOptionsTable.lemonVariantId })
    .from(planBillingOptionsTable)
    .innerJoin(plansTable, eq(planBillingOptionsTable.planId, plansTable.id))
    .where(eq(planBillingOptionsTable.lemonVariantId, variantId))
    .limit(1);
  return rows[0] ? { ...rows[0].plan, billingInterval: rows[0].billingInterval, lemonVariantId: rows[0].variantId } : null;
}

/**
 * Fetch Subscription attributes from LS API to get the authoritative renews_at.
 * Returns null on any failure. Payment processing must retry rather than
 * inventing a paid-through date.
 */
async function fetchLSSubscriptionAttrs(subscriptionId: string): Promise<any | null> {
  const LS_API_KEY = process.env["LEMON_SQUEEZY_API_KEY"];
  if (!LS_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${LS_API_KEY}`, Accept: "application/vnd.api+json" } }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    return data?.data?.attributes ?? null;
  } catch {
    return null;
  }
}

/** Subscription Invoice is immutable historical evidence; unlike Subscription it
 * is safe to fetch for delayed webhooks. */
async function fetchLSInvoiceAttrs(invoiceId: string): Promise<any | null> {
  const key = process.env["LEMON_SQUEEZY_API_KEY"];
  if (!key) return null;
  try {
    const r = await fetch(`https://api.lemonsqueezy.com/v1/subscription-invoices/${invoiceId}`,
      { headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json" } });
    if (!r.ok) return null;
    return (await r.json() as any)?.data?.attributes ?? null;
  } catch { return null; }
}

function providerTimestamp(attrs: any): Date | null {
  const raw = attrs?.updated_at ?? attrs?.created_at ?? null;
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

// ─── order_created ────────────────────────────────────────────────────────────

async function handleOrderCreated(payload: any): Promise<void> {
  const attrs    = payload?.data?.attributes ?? {};
  const custom   = payload?.meta?.custom_data ?? {};
  const orderId  = String(payload?.data?.id ?? "");
  const variantId  = String(attrs?.first_order_item?.variant_id ?? "");
  const totalCents = Number(attrs?.total ?? 0);
  const currency   = String(attrs?.currency ?? "USD");
  const teacherId  = parseInt(String(custom.user_id ?? ""));
  const purchaseIntentId = String(custom.purchase_intent_id ?? "");

  await db.transaction(async (tx) => {
    let purchase: any = null;
    if (purchaseIntentId) {
      const r = await tx.execute(sql`
        SELECT * FROM credit_purchases WHERE purchase_intent_id = ${purchaseIntentId} FOR UPDATE
      `);
      purchase = r.rows[0] ?? null;
    }

    const [pkg] = variantId
      ? await tx.select().from(creditPackagesTable).where(eq(creditPackagesTable.lemonVariantId, variantId)).limit(1)
      : [];

    if (!purchase && !pkg) {
      throw new Error(`Variant غير معروف (${variantId}) ولا يوجد Purchase Intent`);
    }

    if (purchase) {
      if (variantId && String(purchase.lemon_variant_id) !== variantId)
        throw new Error(`Variant لا يطابق الـ Intent`);
      if (custom.user_id && String(purchase.teacher_id) !== String(custom.user_id))
        throw new Error(`user_id لا يطابق الـ Intent`);
    }

    const finalTeacherId = purchase ? Number(purchase.teacher_id) : teacherId;
    if (!finalTeacherId || Number.isNaN(finalTeacherId))
      throw new Error("تعذر تحديد المستخدم");

    const credits = purchase ? Number(purchase.package_credits_snapshot) : Number(pkg!.credits);
    let purchaseRowId: number;

    if (purchase) {
      if (purchase.payment_status !== "pending_checkout") return;
      await tx.execute(sql`
        UPDATE credit_purchases
        SET lemon_order_id = ${orderId}, amount_cents = ${totalCents}, currency = ${currency},
            payment_status = 'completed', purchased_at = NOW(), processed_at = NOW(), updated_at = NOW()
        WHERE id = ${purchase.id}
      `);
      purchaseRowId = Number(purchase.id);
    } else {
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
      tx, finalTeacherId, credits, purchaseRowId,
      `ls_order_${orderId}`, `شراء باقة رصيد (${credits} رصيد)`
    );
  });
}

// ─── order_refunded ───────────────────────────────────────────────────────────

async function handleOrderRefunded(payload: any): Promise<void> {
  const attrs         = payload?.data?.attributes ?? {};
  const orderId       = String(payload?.data?.id ?? "");
  const refundedCents = Number(attrs?.refunded_amount ?? 0);
  const totalCents    = Number(attrs?.total ?? 0);
  const subscriptionId = String(attrs?.subscription_id ?? "");

  // Subscription order refunds have no credit_purchase row. Stop unreleased
  // annual months immediately; already released credit handling remains the
  // existing invoice/batch policy and is intentionally not multiplied by 12.
  if (subscriptionId) {
      const isFullRefund = totalCents > 0 && refundedCents >= totalCents;
      if (isFullRefund) {
        await db.transaction(async (tx) => {
          await lockProviderSubscription(tx, subscriptionId);
          const revoked = await tx.execute(sql`
            UPDATE subscription_credit_entitlements SET status = 'revoked', updated_at = NOW()
            WHERE subscription_id = ${subscriptionId}
              AND status = 'active'
              AND ${orderId} <> ''
              AND provider_order_id = ${orderId}
            RETURNING id, teacher_id
          `);
          for (const entitlement of revoked.rows as any[]) {
            // This removes only unused batches whose grant is bound to this
            // invoice entitlement; another paid term is never touched.
            const result = await CreditService.revokeEntitlementBatchesInTx(
              tx, Number(entitlement.teacher_id), Number(entitlement.id)
            );
            if (result.shortfall > 0) {
              await tx.execute(sql`
                UPDATE subscription_credit_entitlements
                SET refund_review_status = 'needs_review',
                    refund_review_note = ${`refund batch/cache shortfall: ${result.shortfall}`},
                    updated_at = NOW()
                WHERE id = ${Number(entitlement.id)}
              `);
            }
          }
          if (revoked.rows.length === 0) {
            // A concrete refund must never revoke unrelated/null-order paid
            // terms. Keep them active and flag the unmatched refund for review.
            await tx.execute(sql`
              UPDATE subscription_credit_entitlements
              SET refund_review_status = 'needs_review',
                  refund_review_note = ${`unmatched full provider refund for order ${orderId || "unknown"}`},
                  updated_at = NOW()
              WHERE subscription_id = ${subscriptionId}
                AND status = 'active'
            `);
          }
          // Do not expire the current subscription projection here: a refund
          // can target an older term. Authoritative lifecycle webhooks decide
          // whether the current subscription itself is cancelled or expired.
        });
      } else {
        /* A partial provider refund has no automatic entitlement policy. Keep
           paid access intact and leave an explicit audit signal for review. */
        await db.transaction(async (tx) => {
          await lockProviderSubscription(tx, subscriptionId);
          await tx.execute(sql`
            UPDATE subscription_credit_entitlements
            SET refund_review_status = 'needs_review',
                refund_review_note = ${`partial provider refund ${refundedCents}/${totalCents}`}, updated_at = NOW()
            WHERE subscription_id = ${subscriptionId}
              AND (
                (${orderId} <> '' AND provider_order_id = ${orderId})
                OR (${orderId} = '' AND provider_order_id IS NULL)
              )
          `);
        });
        logger.warn({ subscriptionId, refundedCents, totalCents }, "partial subscription refund requires review");
      }
    return;
  }

  await db.transaction(async (tx) => {
    const r = await tx.execute(sql`
      SELECT * FROM credit_purchases WHERE lemon_order_id = ${orderId} FOR UPDATE
    `);
    const purchase: any = r.rows[0];
    if (!purchase) throw new Error(`Refund لطلب غير معروف (${orderId})`);

    const alreadyRefundedCents   = Number(purchase.refunded_amount_cents ?? 0);
    const newRefundCents         = refundedCents - alreadyRefundedCents;
    if (newRefundCents <= 0) return;

    const totalCredits           = Number(purchase.package_credits_snapshot);
    const priceRef               = totalCents > 0 ? totalCents : Number(purchase.amount_cents || purchase.package_price_snapshot || 1);
    const alreadyRefundedCredits = Number(purchase.refunded_credits_amount ?? 0);
    const remainingCredits       = totalCredits - alreadyRefundedCredits;
    const isFullRefund           = refundedCents >= priceRef;
    const creditsToDeduct        = isFullRefund
      ? remainingCredits
      : Math.min(remainingCredits, Math.round((newRefundCents / priceRef) * totalCredits));

    const { deducted, shortfall } = await CreditService.deductRefundedCredits(
      tx, Number(purchase.teacher_id), creditsToDeduct, Number(purchase.id),
      `ls_order_${orderId}`,
      isFullRefund ? "استرجاع كامل لعملية شراء" : "استرجاع جزئي لعملية شراء"
    );

    await tx.execute(sql`
      UPDATE credit_purchases
      SET refunded_amount_cents   = ${refundedCents},
          refunded_credits_amount = ${alreadyRefundedCredits + deducted},
          payment_status          = ${isFullRefund ? "refunded" : "partially_refunded"},
          refund_review_status    = ${shortfall > 0 ? "needs_review" : (purchase.refund_review_status ?? "none")},
          refund_review_note      = ${shortfall > 0
            ? `refund_adjustment_required: عجز ${shortfall} رصيد (سُحب ${deducted} من ${creditsToDeduct})`
            : purchase.refund_review_note},
          refund_processed_at = NOW(), updated_at = NOW()
      WHERE id = ${purchase.id}
    `);
  });
}

// ─── subscription_created ────────────────────────────────────────────────────
// Creates/updates the subscription record only. NO credit grant.
// Credits are granted exclusively from subscription_payment_success.

async function handleSubscriptionCreated(payload: any): Promise<void> {
  const attrs      = payload?.data?.attributes ?? {};
  const custom     = payload?.meta?.custom_data ?? {};
  const subId      = String(payload?.data?.id ?? "");
  const variantId  = String(attrs?.variant_id ?? "");
  const customerId = String(attrs?.customer_id ?? "");
  const renewsAt   = attrs?.renews_at ? new Date(attrs.renews_at) : null;
  const status     = String(attrs?.status ?? "active");
  const eventAt = providerTimestamp(attrs);

  const teacherId = parseInt(String(custom.user_id ?? ""));
  if (!teacherId || Number.isNaN(teacherId)) {
    // عيب دائم في الـ payload — retry بنفس الحمولة لن يصلحه
    throw new TerminalWebhookError(`subscription_created: user_id مفقود في custom_data (sub ${subId})`);
  }

  const plan = variantId ? await resolvePlanByVariant(variantId) : null;
  if (!plan) {
    // Variant غير مربوط بخطة — فشل صريح حتى يمكن إعادة المحاولة بعد تصحيح الربط
    throw new Error(`subscription_created: Variant غير معروف (${variantId}) — لم يُربط الاشتراك (sub ${subId})`);
  }

  await db.execute(sql`
    INSERT INTO subscriptions
      (teacher_id, plan_id, status, payment_status, external_subscription_id,
       external_customer_id, current_period_end, payment_provider, billing_interval, lemon_variant_id, provider_updated_at, started_at, created_at, updated_at)
    VALUES
      (${teacherId}, ${plan.id}, ${status}, 'active', ${subId},
        ${customerId}, ${renewsAt}, 'lemonsqueezy', ${plan.billingInterval}, ${variantId}, ${eventAt}, NOW(), NOW(), NOW())
    ON CONFLICT (teacher_id) DO UPDATE
      SET plan_id                  = EXCLUDED.plan_id,
          status                   = EXCLUDED.status,
          payment_status           = 'active',
          external_subscription_id = EXCLUDED.external_subscription_id,
          external_customer_id     = EXCLUDED.external_customer_id,
          current_period_end       = EXCLUDED.current_period_end,
           billing_interval         = EXCLUDED.billing_interval,
           lemon_variant_id         = EXCLUDED.lemon_variant_id,
          payment_provider         = 'lemonsqueezy',
           provider_updated_at      = COALESCE(EXCLUDED.provider_updated_at, subscriptions.provider_updated_at),
           updated_at               = NOW()
       WHERE subscriptions.provider_updated_at IS NULL
          OR EXCLUDED.provider_updated_at IS NULL
          OR subscriptions.provider_updated_at <= EXCLUDED.provider_updated_at
  `);

  logger.info({ subId, teacherId, plan: plan.code }, "subscription_created: record upserted (no credit grant)");
}

// ─── subscription_payment_success ────────────────────────────────────────────
// The ONLY source of subscription credit grants.
//
// invoiceId    = payload.data.id          (unique LS invoice object ID)
// subscriptionId = payload.data.attributes.subscription_id
// Period and economics come only from immutable invoice fields, never the
// mutable Subscription object's current renews_at/variant.

async function handleSubscriptionPaymentSuccess(payload: any): Promise<void> {
  let attrs            = payload?.data?.attributes ?? {};
  const invoiceId      = String(payload?.data?.id ?? "");
  let subscriptionId = String(attrs?.subscription_id ?? "");

  if (!invoiceId) {
    // عيب دائم في الـ payload — retry بنفس الحمولة لن يصلحه
    throw new TerminalWebhookError(`subscription_payment_success: invoice/subscription id مفقود (invoice=${invoiceId || "?"}, sub=${subscriptionId || "?"})`);
  }
  if (!attrs?.created_at || !(attrs?.variant_id ?? attrs?.first_order_item?.variant_id) || !attrs?.billing_reason) {
    const fetched = await fetchLSInvoiceAttrs(invoiceId);
    if (fetched) attrs = { ...attrs, ...fetched };
    subscriptionId = String(attrs?.subscription_id ?? subscriptionId);
  }
  if (!subscriptionId) {
    throw new Error(`subscription_payment_success: immutable invoice subscription_id unavailable (invoice ${invoiceId}); review/retry required`);
  }

  const invoiceCreated = attrs?.created_at ? new Date(attrs.created_at) : null;
  if (!invoiceCreated || Number.isNaN(invoiceCreated.getTime())) {
    throw new Error(`subscription_payment_success: immutable invoice created_at unavailable (invoice ${invoiceId}); review/retry required`);
  }
  const invoiceVariant = String(attrs?.variant_id ?? attrs?.first_order_item?.variant_id ?? "");
  if (!invoiceVariant) throw new Error(`subscription_payment_success: immutable invoice variant unavailable (invoice ${invoiceId}); review/retry required`);
  const billingReason = String(attrs?.billing_reason ?? "");
  if (!["subscription_created", "subscription_renewed"].includes(billingReason)) {
    throw new Error(`subscription_payment_success: ${billingReason || "missing"} billing reason is not a full-cycle invoice; review required`);
  }
  const plan = await resolvePlanByVariant(invoiceVariant);
  if (!plan) throw new Error(`subscription_payment_success: unknown invoice variant ${invoiceVariant}; review/retry required`);
  const intervalMonths = plan.billingInterval === "year" ? 12 : 1;
  const periodStart = invoiceCreated;
  const periodEnd = addCalendarMonthsUtc(periodStart, intervalMonths);
  const providerOrderId = attrs?.order_id ? String(attrs.order_id) : null;
  const eventAt = providerTimestamp(attrs);

  await db.transaction(async (tx) => {
    await lockProviderSubscription(tx, subscriptionId);
    const local = await tx.execute(sql`
      SELECT teacher_id FROM subscriptions WHERE external_subscription_id = ${subscriptionId} FOR UPDATE
    `);
    const teacherId = Number((local.rows[0] as any)?.teacher_id ?? 0);
    if (!teacherId) throw new Error(`subscription_payment_success: Subscription غير موجود محليًا (${subscriptionId})`);
    const inserted = await tx.execute(sql`
      INSERT INTO subscription_credit_entitlements
        (provider_invoice_id, subscription_id, provider_order_id, teacher_id, plan_code, billing_interval,
         monthly_credits_snapshot, rollover_cap_snapshot, period_start, period_end, release_through, status, provider_event_at, created_at, updated_at)
      VALUES (${invoiceId}, ${subscriptionId}, ${providerOrderId}, ${teacherId}, ${plan.code}, ${plan.billingInterval},
        ${Number(plan.monthlyCredits ?? 0)}, ${plan.rolloverCap == null ? null : Number(plan.rolloverCap)},
        ${periodStart}, ${periodEnd}, ${plan.billingInterval === "year" ? addOneCalendarMonth(periodStart) : periodEnd},
        'active', ${eventAt}, NOW(), NOW())
      ON CONFLICT (provider_invoice_id) DO NOTHING RETURNING *
    `);
    if (!inserted.rows.length) return;
    const e = inserted.rows[0] as any;
    // Keep lock while grant's inner transaction runs, so refund cannot revoke
    // between entitlement creation/status check and batch creation.
    const firstEnd = new Date(e.release_through);
    const grantKey = plan.billingInterval === "year"
      ? `annual:${invoiceId}:${firstEnd.toISOString()}` : invoiceId;
    await CreditService.grantSubscriptionCredits(teacherId, String(plan.code), grantKey, subscriptionId,
      plan.billingInterval === "year" ? firstEnd : periodEnd,
      addOneCalendarMonth(plan.billingInterval === "year" ? firstEnd : periodEnd),
      plan.billingInterval === "year" ? grantKey : undefined, {
        monthlyCredits: Number(e.monthly_credits_snapshot),
        rolloverCap: e.rollover_cap_snapshot == null ? null : Number(e.rollover_cap_snapshot),
        entitlementId: Number(e.id),
      });
    await tx.execute(sql`
      UPDATE subscriptions SET payment_status = 'active', current_period_end = ${periodEnd},
        paid_through = GREATEST(COALESCE(paid_through, ${periodEnd}), ${periodEnd}), updated_at = NOW()
      WHERE external_subscription_id = ${subscriptionId}
    `);
  });
}

// ─── subscription_payment_failed ─────────────────────────────────────────────

async function handleSubscriptionPaymentFailed(payload: any): Promise<void> {
  const attrs          = payload?.data?.attributes ?? {};
  const subscriptionId = String(attrs?.subscription_id ?? payload?.data?.id ?? "");

  await db.execute(sql`
    UPDATE subscriptions
    SET payment_status = 'past_due', updated_at = NOW()
    WHERE external_subscription_id = ${subscriptionId}
  `);

  logger.info({ subscriptionId }, "subscription_payment_failed: payment_status → past_due");
}

// ─── subscription_payment_recovered ──────────────────────────────────────────
// Updates payment status only. NO credit grant.
// Credits come from subscription_payment_success which LS fires alongside/after recovery.

async function handleSubscriptionPaymentRecovered(payload: any): Promise<void> {
  const attrs          = payload?.data?.attributes ?? {};
  const subscriptionId = String(attrs?.subscription_id ?? payload?.data?.id ?? "");
  const renewsAt       = attrs?.renews_at ? new Date(attrs.renews_at) : null;

  await db.execute(sql`
    UPDATE subscriptions
    SET payment_status     = 'active',
        current_period_end = COALESCE(${renewsAt}, current_period_end),
        updated_at         = NOW()
    WHERE external_subscription_id = ${subscriptionId}
  `);

  logger.info({ subscriptionId }, "subscription_payment_recovered: payment_status → active (no credit grant)");
}

// ─── subscription_cancelled ───────────────────────────────────────────────────

async function handleSubscriptionCancelled(payload: any): Promise<void> {
  const attrs          = payload?.data?.attributes ?? {};
  const subId          = String(payload?.data?.id ?? "");
  const endsAt         = attrs?.ends_at ? new Date(attrs.ends_at) : null;
  const eventAt        = providerTimestamp(attrs);

  await db.transaction(async (tx) => {
  await lockProviderSubscription(tx, subId);
  await tx.execute(sql`
    UPDATE subscriptions
    SET status             = 'canceled',
        cancelled_at       = NOW(),
        current_period_end = COALESCE(${endsAt}, current_period_end),
         provider_updated_at = COALESCE(${eventAt}, provider_updated_at),
        updated_at         = NOW()
    WHERE external_subscription_id = ${subId}
      AND (provider_updated_at IS NULL OR ${eventAt} IS NULL OR provider_updated_at <= ${eventAt})
  `);
  });

  logger.info({ subId }, "subscription_cancelled: credits remain until period end");
}

// ─── subscription_expired ────────────────────────────────────────────────────

async function handleSubscriptionExpired(payload: any): Promise<void> {
  const subId     = String(payload?.data?.id ?? "");
  const eventAt   = providerTimestamp(payload?.data?.attributes ?? {});
  const teacherId = await resolveTeacherFromSubscription(subId);

  if (!teacherId) {
    // قابل للإصلاح بوصول subscription_created متأخرًا — فشل retryable، لا processed صامت
    throw new Error(`subscription_expired: Subscription غير موجود محليًا (${subId}) — أعد المحاولة بعد ربط subscription_created`);
  }

  let didExpire = false;
  await db.transaction(async (tx) => {
  await lockProviderSubscription(tx, subId);
  const updated = await tx.execute(sql`
    UPDATE subscriptions
    SET status = 'expired', provider_updated_at = COALESCE(${eventAt}, provider_updated_at), updated_at = NOW()
    WHERE external_subscription_id = ${subId}
      AND (provider_updated_at IS NULL OR ${eventAt} IS NULL OR provider_updated_at <= ${eventAt})
    RETURNING id
  `);
  // Never revoke a newer replacement/state due to a stale expiry webhook.
  if (updated.rows.length > 0) {
    await CreditService.expireSubscriptionBatches(teacherId);
    didExpire = true;
  }
  });

  logger.info({ subId, teacherId, didExpire }, "subscription_expired: batches zeroed");
}

// ─── subscription_resumed ─────────────────────────────────────────────────────

async function handleSubscriptionResumed(payload: any): Promise<void> {
  const attrs          = payload?.data?.attributes ?? {};
  const subId          = String(payload?.data?.id ?? "");
  const renewsAt       = attrs?.renews_at ? new Date(attrs.renews_at) : null;
  const customerId     = String(attrs?.customer_id ?? "");
  const eventAt        = providerTimestamp(attrs);

  // Metadata sync only — no credit grant.
  await db.transaction(async (tx) => {
  await lockProviderSubscription(tx, subId);
  await tx.execute(sql`
    UPDATE subscriptions
    SET status               = 'active',
        cancelled_at         = NULL,
        payment_status       = 'active',
        current_period_end   = COALESCE(${renewsAt}, current_period_end),
        external_customer_id = COALESCE(NULLIF(${customerId}, ''), external_customer_id),
         provider_updated_at  = COALESCE(${eventAt}, provider_updated_at),
        updated_at           = NOW()
    WHERE external_subscription_id = ${subId}
      AND (provider_updated_at IS NULL OR ${eventAt} IS NULL OR provider_updated_at <= ${eventAt})
  `);
  });

  logger.info({ subId }, "subscription_resumed: cancelled_at cleared (no credit grant)");
}

// ─── subscription_updated ────────────────────────────────────────────────────

async function handleSubscriptionUpdated(payload: any): Promise<void> {
  const attrs      = payload?.data?.attributes ?? {};
  const subId      = String(payload?.data?.id ?? "");
  const variantId  = String(attrs?.variant_id ?? "");
  const renewsAt   = attrs?.renews_at ? new Date(attrs.renews_at) : null;
  const customerId = String(attrs?.customer_id ?? "");
  const eventAt    = providerTimestamp(attrs);

  let planId: number | undefined;
  let billingInterval: string | undefined;
  if (variantId) {
    const plan = await resolvePlanByVariant(variantId);
    if (!plan) {
      // variant غير مربوط — تجاهله بصمت يعني بقاء الخطة القديمة للأبد؛ فشل retryable حتى يُصحَّح الربط
      throw new Error(`subscription_updated: Variant غير معروف (${variantId}) — لم تُحدَّث الخطة (sub ${subId})`);
    }
    planId = plan.id;
    billingInterval = plan.billingInterval;
  }

  await db.transaction(async (tx) => {
  await lockProviderSubscription(tx, subId);
  await tx.execute(sql`
    UPDATE subscriptions
    SET plan_id = COALESCE(${planId ?? null}, plan_id),
         billing_interval = COALESCE(${billingInterval ?? null}, billing_interval),
         lemon_variant_id = COALESCE(NULLIF(${variantId}, ''), lemon_variant_id),
        current_period_end   = COALESCE(${renewsAt}, current_period_end),
        external_customer_id = COALESCE(NULLIF(${customerId}, ''), external_customer_id),
         provider_updated_at  = COALESCE(${eventAt}, provider_updated_at),
        updated_at           = NOW()
    WHERE external_subscription_id = ${subId}
      AND (provider_updated_at IS NULL OR ${eventAt} IS NULL OR provider_updated_at <= ${eventAt})
  `);
  });

  logger.info({ subId, planId }, "subscription_updated: metadata synced (no credit grant)");
}

export default router;
