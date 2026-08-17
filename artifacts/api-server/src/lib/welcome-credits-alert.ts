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

export async function fetchTeachersMissingWelcomeCredits(): Promise<MissingTeacher[]> {
  const result = await db.execute(sql`
    SELECT t.id, t.name, t.email, t.created_at
    FROM teachers t
    WHERE NOT EXISTS (
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
  const dateFormatter = new Intl.DateTimeFormat("ar", {
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

  const headerColor = context === "failure" ? "#dc2626" : "#d97706";
  const headerBg    = context === "failure" ? "#fef2f2" : "#fffbeb";
  const headerIcon  = context === "failure" ? "🚨" : "⚠️";

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e5238,#2a6647);padding:28px 32px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900">منصة حصاد — تنبيه إداري</h1>
        </td></tr>

        <!-- Alert banner -->
        <tr><td style="background:${headerBg};border-bottom:2px solid ${headerColor};padding:16px 32px">
          <p style="margin:0;font-size:16px;font-weight:bold;color:${headerColor}">${headerIcon} ${esc(subjectContext)}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 12px;font-size:15px;color:#111827;line-height:1.7">
            عدد المعلمين الذين لم يتلقوا نقاط الترحيب: <strong style="color:${headerColor}">${count}</strong>
          </p>
          ${
            context === "failure"
              ? `<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
              فشلت عملية منح نقاط الترحيب تلقائياً عند تسجيل دخول أحد المعلمين. راجع سجلات الخادم (api-server) للاطلاع على تفاصيل الخطأ، ثم استخدم لوحة التحكم أدناه لمنح النقاط يدوياً.
            </p>`
              : `<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
              هذا تقرير يومي تلقائي. المعلمون أدناه لا يملكون أي دفعة نقاط ترحيبية (source='free'). يمكنك منحها بضغطة واحدة من لوحة التحكم.
            </p>`
          }

          <!-- Teachers table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 8px;font-size:13px">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:10px 12px;text-align:right;color:#374151;font-weight:600;border-bottom:1px solid #e5e7eb">ID</th>
                <th style="padding:10px 12px;text-align:right;color:#374151;font-weight:600;border-bottom:1px solid #e5e7eb">الاسم</th>
                <th style="padding:10px 12px;text-align:left;color:#374151;font-weight:600;border-bottom:1px solid #e5e7eb;direction:ltr">البريد الإلكتروني</th>
                <th style="padding:10px 12px;text-align:right;color:#374151;font-weight:600;border-bottom:1px solid #e5e7eb">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${moreNote}

          <!-- CTA button -->
          <p style="text-align:center;margin:28px 0 0">
            <a href="${esc(panelUrl)}"
               style="display:inline-block;background:#1e5238;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:bold">
              فتح لوحة نقاط الترحيب
            </a>
          </p>
          <p style="text-align:center;margin:10px 0 0;font-size:12px;color:#9ca3af;word-break:break-all">
            ${esc(panelUrl)}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8f8f8;padding:16px 32px;text-align:center">
          <p style="font-size:12px;color:#9ca3af;margin:0">منصة حصاد — تنبيه آلي · لا تردّ على هذه الرسالة</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
      ? `🚨 حصاد: فشل منح نقاط الترحيب (${teachers.length} معلم)`
      : `⚠️ حصاد: تقرير يومي — ${teachers.length} معلم بدون نقاط ترحيبية`;

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
