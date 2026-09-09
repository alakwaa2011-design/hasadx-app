/**
 * Admin alert: missing welcome-credits
 *
 * Two signal paths:
 *  1. Immediate — called from auth.ts when maybeGrantWelcomeCredits catches
 *     an error, so admins are notified the moment a grant fails.
 *  2. Daily digest — a scheduled job that queries teachers missing a free
 *     credit_batch and emails admins if any are found.
 *
 * Both paths use the shared Resend integration via sendEmail().
 * Admin addresses are sourced from ADMIN_ALERT_EMAILS env var (comma-separated)
 * or fall back to the hardcoded list used elsewhere in index.ts.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendEmail, getAppBaseUrl } from "./email";
import { emailHighlight, renderHasaadEmail } from "./email-design";
import { esc } from "./html-escape";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h

// Hardcoded fallback matches the ADMIN_EMAILS list in index.ts.
const DEFAULT_ADMIN_EMAILS = ["alakwaa2011@gmail.com", "marwanakwaa@yahoo.com"];

function getAdminEmails(): string[] {
  const env = process.env.ADMIN_ALERT_EMAILS;
  if (env) {
    const parsed = env
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (parsed.length > 0) return parsed;
  }
  return DEFAULT_ADMIN_EMAILS;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissingTeacher {
  id: number;
  name: string;
  email: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Only flags teachers who actually completed activation (verified_at set —
 * via OTP/email link or Google login) but still have no 'free' credit_batch.
 * Accounts still stuck in pending-verification are excluded on purpose: they
 * never establish a session, so a missing welcome grant there is expected
 * behavior, not a bug — including them just buries the real anomalies in noise.
 */
export async function fetchTeachersMissingWelcomeCredits(): Promise<MissingTeacher[]> {
  const result = await db.execute(sql`
    SELECT t.id, t.name, t.email, t.created_at
    FROM teachers t
    WHERE t.verified_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM credit_batches cb
        WHERE cb.teacher_id = t.id
          AND cb.source = 'free'
      )
    ORDER BY t.created_at DESC
    LIMIT 200
  `);
  return result.rows as unknown as MissingTeacher[];
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function buildMissingWelcomeCreditsEmail(
  teachers: MissingTeacher[],
  panelUrl: string,
  context: "failure" | "digest",
): { html: string; text: string } {
  const count = teachers.length;
  const dateFormatter = new Intl.DateTimeFormat("ar-KW-u-nu-latn", {
    dateStyle: "short",
    timeZone: "Asia/Kuwait",
  });

  const subjectContext =
    context === "failure"
      ? "فشل منح نقاط الترحيب عند تسجيل الدخول"
      : "تقرير يومي: معلمون بدون نقاط ترحيبية";

  // Table rows — show up to 50 inline, mention total count if more
  const displayedRows = teachers.slice(0, 50);
  const hasMore = count > 50;

  const tableRows = displayedRows
    .map(
      (t) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827">${esc(String(t.id))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827">${esc(t.name ?? "—")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;direction:ltr;text-align:left">${esc(t.email ?? "—")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${esc(dateFormatter.format(new Date(t.created_at)))}</td>
        </tr>`,
    )
    .join("");

  const moreNote = hasMore
    ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280">… و${count - 50} معلم آخر. افتح لوحة التحكم للاطلاع على القائمة الكاملة.</p>`
    : "";

  const contextText =
    context === "failure"
      ? "تعذر منح نقاط الترحيب تلقائيًا عند تسجيل الدخول. راجع سجلات الخادم، ثم استخدم لوحة التحكم لتصحيح الرصيد."
      : "هذا تقرير يومي للحسابات المفعّلة التي لا تملك دفعة نقاط ترحيبية.";

  const html = renderHasaadEmail({
    title: subjectContext,
    preheader: `${count} معلم بدون نقاط ترحيبية.`,
    tone: "admin",
    bodyHtml: `
      ${emailHighlight(`<strong>${count}</strong> معلم يحتاج إلى المراجعة.`, "admin")}
      <p style="margin:0 0 18px">${esc(contextText)}</p>
      <div style="overflow-x:auto">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 8px;font-size:12px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 8px;text-align:right;color:#374151;border-bottom:1px solid #e5e7eb">ID</th>
              <th style="padding:10px 8px;text-align:right;color:#374151;border-bottom:1px solid #e5e7eb">الاسم</th>
              <th style="padding:10px 8px;text-align:left;color:#374151;border-bottom:1px solid #e5e7eb;direction:ltr">البريد</th>
              <th style="padding:10px 8px;text-align:right;color:#374151;border-bottom:1px solid #e5e7eb">التسجيل</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${moreNote}`,
    cta: { label: "فتح لوحة نقاط الترحيب", url: panelUrl },
    footer: "تنبيه إداري آلي من حصاد.",
  });

  // Plain-text fallback
  const rows = displayedRows
    .map((t) => `  - [${t.id}] ${t.name} | ${t.email ?? "—"} | ${dateFormatter.format(new Date(t.created_at))}`)
    .join("\n");
  const text =
    `${subjectContext}\n\nعدد المعلمين المتأثرين: ${count}\n\n${rows}${hasMore ? `\n  … و${count - 50} آخرين` : ""}\n\nلوحة التحكم:\n${panelUrl}`;

  return { html, text };
}

// ---------------------------------------------------------------------------
// Sending helpers
// ---------------------------------------------------------------------------

/** Send an alert email to all admin addresses. Resolves quietly on errors. */
async function sendAdminAlert(
  teachers: MissingTeacher[],
  context: "failure" | "digest",
): Promise<void> {
  const admins = getAdminEmails();
  if (admins.length === 0) {
    logger.warn("welcome-credits-alert: no admin emails configured; alert skipped");
    return;
  }

  const panelUrl = `${getAppBaseUrl()}/teacher/admin?tab=hasad-credits`;
  const { html, text } = buildMissingWelcomeCreditsEmail(teachers, panelUrl, context);

  const subject =
    context === "failure"
      ? `حصاد: فشل منح نقاط الترحيب (${teachers.length} معلم)`
      : `حصاد: تقرير يومي — ${teachers.length} معلم بدون نقاط ترحيبية`;

  for (const adminEmail of admins) {
    try {
      const result = await sendEmail({ to: adminEmail, subject, html, text });
      if (result.delivered) {
        logger.info({ adminEmail, context, count: teachers.length }, "welcome-credits alert sent");
      } else {
        logger.warn({ adminEmail, context, reason: result.reason }, "welcome-credits alert not delivered");
      }
    } catch (err) {
      logger.error({ err, adminEmail, context }, "welcome-credits alert send error");
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an immediate admin alert for a single teacher whose welcome-credit
 * grant just failed at login. Call this from the catch block of
 * maybeGrantWelcomeCredits so admins are notified right away.
 */
export async function alertAdminsOnWelcomeGrantFailure(
  teacherId: number,
  teacherName?: string,
  teacherEmail?: string | null,
): Promise<void> {
  try {
    const syntheticTeacher: MissingTeacher = {
      id: teacherId,
      name: teacherName ?? `Teacher #${teacherId}`,
      email: teacherEmail ?? null,
      created_at: new Date().toISOString(),
    };
    await sendAdminAlert([syntheticTeacher], "failure");
  } catch (err) {
    // Best-effort: never let alert failures bubble up to the auth route.
    logger.error({ err, teacherId }, "welcome-credits failure alert threw unexpectedly");
  }
}

/**
 * Daily digest: query all teachers missing welcome credits and email admins
 * if any are found. Runs once immediately on startup, then every 24 h.
 */
export async function checkAndAlertMissingWelcomeCredits(): Promise<void> {
  try {
    const teachers = await fetchTeachersMissingWelcomeCredits();
    if (teachers.length === 0) {
      logger.info("welcome-credits daily check: all teachers have welcome credits — no alert sent");
      return;
    }
    logger.warn({ count: teachers.length }, "welcome-credits daily check: teachers missing welcome credits");
    await sendAdminAlert(teachers, "digest");
  } catch (err) {
    logger.error({ err }, "welcome-credits daily check failed");
  }
}

/** Start the 24-hour digest job. Call once after server startup. */
export function startMissingWelcomeCreditsAlertJob(): NodeJS.Timeout {
  // Run an initial check shortly after startup (60 s delay to let migrations settle).
  const initialTimer = setTimeout(() => {
    void checkAndAlertMissingWelcomeCredits();
  }, 60_000);
  if (typeof initialTimer.unref === "function") initialTimer.unref();

  // Then run every 24 h.
  const handle = setInterval(() => {
    void checkAndAlertMissingWelcomeCredits();
  }, ALERT_JOB_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();

  logger.info("welcome-credits missing-grant alert job started (daily digest)");
  return handle;
}
