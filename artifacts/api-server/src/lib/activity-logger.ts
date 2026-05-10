import type { Request } from "express";
import { db, activityLogsTable } from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { parseUserAgent } from "./device-info";
import { logger } from "./logger";

export type UserRole = "teacher" | "organizer" | "student" | "admin" | "visitor";

export type ActivityAction =
  | "login"
  | "logout"
  | "create_homework"
  | "edit_homework"
  | "delete_homework"
  | "start_game"
  | "end_game"
  | "join_game"
  | "create_quiz"
  | "view"
  | "ai_use"
  | "settings_change"
  | "unauthorized_access"
  | "delete"
  | "edit";

export interface LogActivityInput {
  req?: Request;
  userId?: number | null;
  userName?: string | null;
  userRole?: UserRole;
  action: ActivityAction | string;
  details?: Record<string, unknown> | null;
  pageUrl?: string | null;
}

/** Keys we never want in `details` even if a caller mistakenly includes them. */
const PRIVACY_BLOCKLIST = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "newpassword",
  "oldpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "card",
  "cardnumber",
  "cvv",
  "cvc",
  "iban",
  "amount",
  "price",
  "stripetoken",
  "creditcard",
]);

function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v.length > 500 ? v.slice(0, 500) + "…" : v;
  if (Array.isArray(v)) return v.slice(0, 50).map(sanitizeValue);
  if (typeof v === "object") return sanitizeDetails(v as Record<string, unknown>);
  return v;
}

export function sanitizeDetails(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const norm = k.toLowerCase().replace(/[_-]/g, "");
    if (PRIVACY_BLOCKLIST.has(norm)) continue;
    if (v === undefined) continue;
    out[k] = sanitizeValue(v);
  }
  return out;
}

function ipFromReq(req: Request | undefined): string | null {
  if (!req) return null;
  return (req.ip ?? null);
}

function pageUrlFromReq(req: Request | undefined): string | null {
  if (!req) return null;
  const referer = req.headers["referer"] || req.headers["referrer"];
  if (typeof referer === "string" && referer.length > 0) {
    try {
      const u = new URL(referer);
      return (u.pathname + u.search).slice(0, 500);
    } catch {
      return referer.slice(0, 500);
    }
  }
  return req.originalUrl?.slice(0, 500) ?? null;
}

/**
 * Fire-and-forget activity logger. Never throws, never blocks the response path.
 * Falls back to logger.warn if the DB insert fails.
 */
export function logActivity(input: LogActivityInput): void {
  void (async () => {
    try {
      const ua = input.req?.headers["user-agent"];
      const parsed = parseUserAgent(typeof ua === "string" ? ua : null);
      const device = parsed.deviceType ? (parsed.deviceType === "tablet" ? "mobile" : parsed.deviceType) : null;
      await db.insert(activityLogsTable).values({
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        userRole: input.userRole ?? "visitor",
        action: String(input.action).slice(0, 64),
        details: sanitizeDetails(input.details ?? null),
        ipAddress: ipFromReq(input.req),
        device,
        browser: parsed.browser ?? null,
        pageUrl: input.pageUrl ?? pageUrlFromReq(input.req),
      });
    } catch (err) {
      logger.warn({ err, action: input.action }, "activity_log_insert_failed");
    }
  })();
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

/**
 * Schedule daily cleanup of activity logs older than 90 days. The deletion
 * scope is intentionally limited to the activity_logs table — user content
 * (assignments, submissions, students, games, etc.) is never touched here.
 */
export function startActivityLogsCleanupJob(): void {
  const run = async () => {
    try {
      const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
      const res = await db.delete(activityLogsTable).where(lt(activityLogsTable.createdAt, cutoff));
      logger.info({ cutoff: cutoff.toISOString(), deleted: (res as { rowCount?: number }).rowCount ?? null }, "activity_logs_cleanup");
    } catch (err) {
      logger.warn({ err }, "activity_logs_cleanup_failed");
    }
  };
  setTimeout(run, 60_000);
  setInterval(run, CLEANUP_INTERVAL_MS);
}

/** Best-effort detection of >100 actions in the last hour for a user. */
export async function suspiciousHighRateUsers(): Promise<Array<{ userId: number; userName: string | null; userRole: string; count: number }>> {
  const rows = await db.execute<{ user_id: number; user_name: string | null; user_role: string; cnt: number }>(sql`
    SELECT user_id, MAX(user_name) AS user_name, MAX(user_role) AS user_role, COUNT(*)::int AS cnt
    FROM activity_logs
    WHERE created_at > NOW() - INTERVAL '1 hour' AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 100
    ORDER BY cnt DESC
    LIMIT 50
  `);
  return rows.rows.map((r) => ({ userId: r.user_id, userName: r.user_name, userRole: r.user_role, count: Number(r.cnt) }));
}

/** Detects same userId logging in from 2+ distinct IPs in last 30 minutes. */
export async function suspiciousConcurrentLogins(): Promise<Array<{ userId: number; userName: string | null; userRole: string; ips: string[] }>> {
  const rows = await db.execute<{ user_id: number; user_name: string | null; user_role: string; ips: string[] }>(sql`
    SELECT user_id,
           MAX(user_name) AS user_name,
           MAX(user_role) AS user_role,
           ARRAY_AGG(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) AS ips
    FROM activity_logs
    WHERE action = 'login'
      AND created_at > NOW() - INTERVAL '30 minutes'
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(DISTINCT ip_address) > 1
    ORDER BY user_id DESC
    LIMIT 50
  `);
  return rows.rows.map((r) => ({ userId: r.user_id, userName: r.user_name, userRole: r.user_role, ips: r.ips ?? [] }));
}
