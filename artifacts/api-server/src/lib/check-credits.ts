/**
 * checkCredits(toolKey) — Express middleware for the credits system.
 *
 * When the global switch is OFF (default) this is a complete no-op: every
 * request falls straight through to next() with zero overhead. Only when the
 * admin turns the system on (or activates self-test mode) does any credit logic
 * run, so current teachers/students see no change in behaviour.
 */
import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { platformSettingsTable, creditTransactionsTable, creditHoldsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreditService } from "./credit-service";
import { randomUUID } from "node:crypto";
import { teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Settings cache (30-second TTL) ──────────────────────────────────────────

let settingsCache: {
  creditsEnabled: boolean;
  adminCreditTestMode: boolean;
  adminId: number | null;
} | null = null;
let cacheExpiresAt = 0;

async function getSettings() {
  if (settingsCache && Date.now() < cacheExpiresAt) return settingsCache;

  const [row] = await db
    .select({
      creditsEnabled:      platformSettingsTable.creditsEnabled,
      adminCreditTestMode: platformSettingsTable.adminCreditTestMode,
    })
    .from(platformSettingsTable)
    .limit(1);

  // Fetch admin teacher id for test-mode check
  let adminId: number | null = null;
  if (row?.adminCreditTestMode) {
    const [admin] = await db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.isAdmin, true))
      .limit(1);
    adminId = admin?.id ?? null;
  }

  settingsCache = {
    creditsEnabled:      row?.creditsEnabled      ?? false,
    adminCreditTestMode: row?.adminCreditTestMode ?? false,
    adminId,
  };
  cacheExpiresAt = Date.now() + 30_000;
  return settingsCache;
}

/** Call this whenever the admin changes settings so the cache flushes immediately. */
export function invalidateCreditsSettingsCache(): void {
  settingsCache = null;
  cacheExpiresAt = 0;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

export function checkCredits(toolKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = req.session?.teacherId;
      if (!teacherId) {
        // Auth will be caught by the route handler; just pass through
        return next();
      }

      const settings = await getSettings();

      // ── System OFF — complete no-op ──────────────────────────────────────────
      const isAdminTestMode =
        settings.adminCreditTestMode && settings.adminId === teacherId;

      if (!settings.creditsEnabled && !isAdminTestMode) {
        return next();
      }

      // ── استخدام غير محدود (per-teacher override) ──────────────────────────────
      // يتجاوز الحجز والخصم بالكامل، لكن يسجّل الاستخدام في credit_transactions
      // للإحصائيات حتى لا تضيع بيانات الأداء.
      const [teacherRow] = await db
        .select({ unlimitedCredits: teachersTable.unlimitedCredits })
        .from(teachersTable)
        .where(eq(teachersTable.id, teacherId))
        .limit(1);

      if (teacherRow?.unlimitedCredits) {
        // سجّل الاستخدام بمبلغ 0 (لا خصم) — النوع unlimited_use
        try {
          await db.insert(creditTransactionsTable).values({
            teacherId,
            amount: 0,
            type: "unlimited_use",
            reason: `استخدام غير محدود: ${toolKey}`,
            toolKey,
            requestId: randomUUID(),
            status: "completed",
            source: "unlimited_bypass",
          });
        } catch {
          // غير حرجة — لا تعطّل الطلب
        }
        return next();
      }

      // ── System ON — hold credits ─────────────────────────────────────────────
      // إن أرسل العميل مفتاح idempotency صالحًا (UUID) نستخدمه بدل UUID عشوائي؛
      // CreditService.hold idempotent على requestId، فإعادة الإرسال/التكرار من
      // المتصفح بنفس المفتاح لا تنشئ حجزًا ثانيًا ولا خصمًا مكررًا.
      const clientKey = String(req.get("x-idempotency-key") ?? "");
      const isValidKey =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientKey);
      const requestId = isValidKey ? `${teacherId}:${toolKey}:${clientKey}` : randomUUID();
      const { creditsHeld, existingStatus } = await CreditService.hold(teacherId, toolKey, requestId);

      /* Terminal replay guard.
         completed: the paid work already succeeded — if the response body was
         snapshotted at capture time, replay it verbatim (200, no new charge,
         no re-generation). This covers "client lost the connection after the
         server succeeded, then retried the same X-Idempotency-Key". Without a
         snapshot (older holds), fall back to 409.
         refunded: the attempt failed and money was returned — the key is
         burned; the client must retry with a NEW key. */
      if (existingStatus === "completed") {
        const [holdRow] = await db
          .select({ resultJson: creditHoldsTable.resultJson })
          .from(creditHoldsTable)
          .where(eq(creditHoldsTable.requestId, requestId))
          .limit(1);
        if (holdRow?.resultJson) {
          try {
            res.status(200).json(JSON.parse(holdRow.resultJson));
            return;
          } catch {
            // corrupt snapshot — fall through to 409
          }
        }
        res.status(409).json({
          code: "DUPLICATE_REQUEST",
          message: "سبق تنفيذ هذا الطلب بنجاح. إن لم تظهر النتيجة، أعد المحاولة من جديد.",
        });
        return;
      }
      if (existingStatus === "refunded") {
        res.status(409).json({
          code: "DUPLICATE_REQUEST",
          message: "أُلغيت هذه المحاولة واستُرد رصيدها. أعد المحاولة من جديد.",
        });
        return;
      }
      /* pending: another request with the SAME key is still running the paid
         work. Letting this one through would run the generator a second time
         (unbilled — the hold is shared). Reject as in-progress instead. */
      if (existingStatus === "pending") {
        res.status(409).json({
          code: "REQUEST_IN_PROGRESS",
          message: "هذا الطلب قيد التنفيذ بالفعل — انتظر اكتماله.",
        });
        return;
      }

      // Attach to req so the route handler can capture or refund
      (req as any).__creditRequestId  = requestId;
      (req as any).__creditToolKey    = toolKey;
      (req as any).__creditsHeld      = creditsHeld;

      return next();
    } catch (err: any) {
      if (err?.message?.includes("رصيد غير كافٍ")) {
        const required = typeof err.required === "number" ? err.required : undefined;
        const balance  = typeof err.balance  === "number" ? err.balance  : undefined;
        const message = required !== undefined && balance !== undefined
          ? `لا يكفي رصيدك لإتمام هذه العملية. تحتاج إلى ${required} نقطة حصاد، ورصيدك الحالي ${balance} نقطة.`
          : err.message;
        res.status(402).json({ message, code: "INSUFFICIENT_CREDITS", required, balance });
        return;
      }
      // Any unexpected verification/hold error must STOP the request before it
      // reaches a paid AI provider (fail-closed). Distinct from insufficient
      // credits (402 above): this is a temporary verification failure (503).
      // No credits are deducted: CreditService.hold is transactional, so a
      // thrown hold error means no hold row. One edge remains — a DB error in
      // the replay-snapshot lookup AFTER an existing hold was found can leave
      // that pending hold in place; the 60s autoRefundStaleHolds sweeper
      // refunds it after its timeout, so nothing is permanently lost.
      (req as any).log?.error?.(
        { err, toolKey, teacherId: req.session?.teacherId },
        "checkCredits fail-closed: unexpected error — request BLOCKED before AI provider",
      );
      res.status(503).json({
        code: "CREDITS_CHECK_UNAVAILABLE",
        message: "تعذر التحقق من رصيد نقاط حصاد حالياً، حاول مرة أخرى بعد قليل.",
      });
      return;
    }
  };
}

// ─── Route helpers ────────────────────────────────────────────────────────────

/** Call after successful AI response to confirm the hold. Pass the response
    body (`result`) so a later replay of the same idempotency key returns the
    stored result instead of re-running the paid work. */
export async function captureCredits(req: Request, result?: unknown): Promise<void> {
  const requestId = (req as any).__creditRequestId;
  if (requestId) {
    try {
      let resultJson: string | undefined;
      if (result !== undefined) {
        try { resultJson = JSON.stringify(result); } catch { /* non-serialisable — skip snapshot */ }
      }
      await CreditService.capture(requestId, resultJson);
    } catch {
      // non-fatal
    }
  }
}

/** Call on error to restore the held credits. */
export async function refundCredits(req: Request, reason?: string): Promise<void> {
  const requestId = (req as any).__creditRequestId;
  if (requestId) {
    try {
      await CreditService.refund(requestId, reason);
    } catch {
      // non-fatal
    }
  }
}
