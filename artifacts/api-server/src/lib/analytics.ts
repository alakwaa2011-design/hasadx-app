import type { Request } from "express";
import crypto from "node:crypto";
import {
  db,
  activityLogsTable,
  onlineSessionsTable,
} from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { parseUserAgent } from "./device-info";
import { logger } from "./logger";
import { sanitizeDetails } from "./activity-logger";

export type Role = "teacher" | "organizer" | "student" | "admin" | "visitor";

/** Stable salt for IP hashing. Prefers ANALYTICS_IP_SALT, then SESSION_SECRET
 *  (both stable across restarts). Falls back to a fixed deterministic constant
 *  with a loud warning so behavior remains stable across restarts even when
 *  the operator forgot to configure a salt. */
const IP_SALT = (() => {
  const env = process.env.ANALYTICS_IP_SALT || process.env.SESSION_SECRET;
  if (env && env.length >= 8) return env;
  logger.warn(
    "ANALYTICS_IP_SALT and SESSION_SECRET both unset; using fixed fallback. Set ANALYTICS_IP_SALT for better privacy guarantees.",
  );
  return "hasadx-analytics-fixed-fallback-do-not-use-in-prod";
})();

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto
    .createHash("sha256")
    .update(`${IP_SALT}:${ip}`)
    .digest("base64url")
    .slice(0, 24);
}

function ipFromReq(req: Request | undefined): string | null {
  return req?.ip ?? null;
}

export interface ActorIdentity {
  userId: number | null;
  userRole: Role;
  userName: string | null;
}

/** Resolve the actor for a request from session cookies. */
export function resolveActor(req: Request | undefined): ActorIdentity {
  const sess = (req?.session ?? {}) as Record<string, unknown>;
  const teacherId = typeof sess.teacherId === "number" ? sess.teacherId : null;
  const studentId =
    typeof sess.studentAccountId === "number"
      ? (sess.studentAccountId as number)
      : null;
  if (teacherId) {
    return {
      userId: teacherId,
      userRole: (sess.role as Role) || "teacher",
      userName: (sess.teacherName as string) ?? null,
    };
  }
  if (studentId) {
    return {
      userId: studentId,
      userRole: "student",
      userName: (sess.studentName as string) ?? null,
    };
  }
  return { userId: null, userRole: "visitor", userName: null };
}

export interface TrackEventInput {
  req?: Request;
  userId?: number | null;
  userRole?: Role;
  userName?: string | null;
  sessionId?: string | null;
  eventName: string;
  eventCategory?: string | null;
  page?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Fire-and-forget: write a unified event to the activity_logs table. Never
 *  throws, never blocks the response. The new event_category / session_id /
 *  ip_hash columns are filled in alongside the legacy fields, so existing
 *  consumers keep working untouched. */
export function trackEvent(input: TrackEventInput): void {
  void (async () => {
    try {
      const ua = input.req?.headers["user-agent"];
      const parsed = parseUserAgent(typeof ua === "string" ? ua : null);
      const device = parsed.deviceType
        ? parsed.deviceType === "tablet"
          ? "mobile"
          : parsed.deviceType
        : null;
      const ip = ipFromReq(input.req);
      await db.insert(activityLogsTable).values({
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        userRole: input.userRole ?? "visitor",
        action: String(input.eventName).slice(0, 64),
        eventCategory: input.eventCategory
          ? String(input.eventCategory).slice(0, 32)
          : null,
        sessionId: input.sessionId ? String(input.sessionId).slice(0, 64) : null,
        details: sanitizeDetails(input.metadata ?? null),
        // We deliberately do NOT persist plain IPs for events emitted via the
        // new tracker; only the salted hash is retained.
        ipAddress: null,
        ipHash: hashIp(ip),
        device,
        browser: parsed.browser ?? null,
        pageUrl: input.page ? String(input.page).slice(0, 500) : null,
      });
    } catch (err) {
      logger.warn(
        { err, eventName: input.eventName },
        "analytics_track_failed",
      );
    }
  })();
}

export interface UpsertHeartbeatInput {
  req: Request;
  sessionId: string;
  page?: string | null;
}

/** Insert-or-update an online_sessions row. Idempotent on session_id. */
export async function upsertHeartbeat(
  input: UpsertHeartbeatInput,
): Promise<void> {
  const actor = resolveActor(input.req);
  const ua = input.req.headers["user-agent"];
  const parsed = parseUserAgent(typeof ua === "string" ? ua : null);
  const device = parsed.deviceType
    ? parsed.deviceType === "tablet"
      ? "mobile"
      : parsed.deviceType
    : null;
  const ipH = hashIp(ipFromReq(input.req));
  const now = new Date();
  await db
    .insert(onlineSessionsTable)
    .values({
      sessionId: input.sessionId.slice(0, 64),
      userId: actor.userId,
      userRole: actor.userRole,
      userName: actor.userName,
      page: input.page ? input.page.slice(0, 500) : null,
      device,
      browser: parsed.browser ?? null,
      ipHash: ipH,
      lastHeartbeatAt: now,
    })
    .onConflictDoUpdate({
      target: onlineSessionsTable.sessionId,
      set: {
        userId: actor.userId,
        userRole: actor.userRole,
        userName: actor.userName,
        page: input.page ? input.page.slice(0, 500) : null,
        device,
        browser: parsed.browser ?? null,
        ipHash: ipH,
        lastHeartbeatAt: now,
      },
    });
}

const ONLINE_THRESHOLD_MS = 90_000; // 90s without heartbeat → offline
const ONLINE_CLEANUP_INTERVAL_MS = 60_000; // sweep every 60s

/** Keep the online_sessions table small: drop rows we haven't seen in
 *  >10 minutes (way past the 90s offline cutoff used for "online now"). */
export function startOnlineSessionsCleanupJob(): void {
  const run = async () => {
    try {
      const cutoff = new Date(Date.now() - 10 * 60_000);
      await db
        .delete(onlineSessionsTable)
        .where(lt(onlineSessionsTable.lastHeartbeatAt, cutoff));
    } catch (err) {
      logger.warn({ err }, "online_sessions_cleanup_failed");
    }
  };
  setTimeout(run, 30_000);
  setInterval(run, ONLINE_CLEANUP_INTERVAL_MS);
}

export interface OnlineSnapshot {
  total: number;
  byRole: { teacher: number; student: number; organizer: number; admin: number; visitor: number };
}

/** "Online now" = distinct session_id seen within the last 90s. Each browser
 *  tab counts as one presence — multiple tabs from the same user are counted
 *  separately because session_id is the unique key. */
export async function getOnlineSnapshot(): Promise<OnlineSnapshot> {
  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const rows = await db.execute<{ user_role: string; cnt: number }>(sql`
    SELECT user_role, COUNT(DISTINCT session_id)::int AS cnt
    FROM online_sessions
    WHERE last_heartbeat_at > ${cutoff}
    GROUP BY user_role
  `);
  const byRole = { teacher: 0, student: 0, organizer: 0, admin: 0, visitor: 0 };
  let total = 0;
  for (const r of rows.rows) {
    const k = r.user_role as keyof typeof byRole;
    if (k in byRole) byRole[k] = Number(r.cnt);
    total += Number(r.cnt);
  }
  return { total, byRole };
}

/** Number of currently-active live games. Best-effort: counts game-history
 *  rows that started in the last 2h and have no end_at, falling back to
 *  emitted "live_game_started" events in the last 2h not followed by a
 *  matching "game_completed" for the same session. */
export async function getLiveGamesCount(): Promise<number> {
  try {
    const r = await db.execute<{ cnt: number }>(sql`
      WITH starts AS (
        SELECT details->>'gameSessionId' AS sid, MAX(created_at) AS started
        FROM activity_logs
        WHERE action = 'live_game_started'
          AND created_at > NOW() - INTERVAL '2 hours'
          AND details ? 'gameSessionId'
        GROUP BY 1
      ),
      ends AS (
        SELECT details->>'gameSessionId' AS sid, MAX(created_at) AS ended
        FROM activity_logs
        WHERE action = 'game_completed'
          AND created_at > NOW() - INTERVAL '2 hours'
          AND details ? 'gameSessionId'
        GROUP BY 1
      )
      SELECT COUNT(*)::int AS cnt
      FROM starts s
      LEFT JOIN ends e ON e.sid = s.sid
      WHERE e.ended IS NULL OR e.ended < s.started
    `);
    return Number(r.rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}
