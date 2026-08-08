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
import { platformSettingsTable } from "@workspace/db";
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

      // ── System ON — hold credits ─────────────────────────────────────────────
      const requestId = randomUUID();
      const { creditsHeld } = await CreditService.hold(teacherId, toolKey, requestId);

      // Attach to req so the route handler can capture or refund
      (req as any).__creditRequestId  = requestId;
      (req as any).__creditToolKey    = toolKey;
      (req as any).__creditsHeld      = creditsHeld;

      return next();
    } catch (err: any) {
      if (err?.message?.includes("رصيد غير كافٍ")) {
        res.status(402).json({ message: err.message, code: "INSUFFICIENT_CREDITS" });
        return;
      }
      // Any unexpected error must not block the user — pass through silently
      return next();
    }
  };
}

// ─── Route helpers ────────────────────────────────────────────────────────────

/** Call after successful AI response to confirm the hold. */
export async function captureCredits(req: Request): Promise<void> {
  const requestId = (req as any).__creditRequestId;
  if (requestId) {
    try {
      await CreditService.capture(requestId);
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
