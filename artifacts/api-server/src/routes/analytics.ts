import { Router, type IRouter, type Request, type Response } from "express";
import { db, activityLogsTable, teachersTable, onlineSessionsTable } from "@workspace/db";
import { sql, eq, gte, desc, and, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import {
  trackEvent,
  resolveActor,
  upsertHeartbeat,
  getOnlineSnapshot,
  getLiveGamesCount,
} from "../lib/analytics";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [t] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!t?.isAdmin) {
    res.status(403).json({ message: "غير مصرح" });
    return false;
  }
  return true;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Public ingestion                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240, // ~4/sec per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { ok: false },
});

const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6, // 1 every 10s with margin
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { ok: false },
});

const TrackBody = z.object({
  eventName: z.string().min(1).max(64).regex(/^[a-z0-9_:-]+$/i, "invalid_event_name"),
  eventCategory: z.string().max(32).optional(),
  page: z.string().max(500).optional(),
  sessionId: z.string().min(8).max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

router.post("/analytics/track", trackLimiter, (req, res) => {
  try {
    const parsed = TrackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false });
      return;
    }
    const actor = resolveActor(req);
    trackEvent({
      req,
      userId: actor.userId,
      userRole: actor.userRole,
      userName: actor.userName,
      sessionId: parsed.data.sessionId ?? null,
      eventName: parsed.data.eventName,
      eventCategory: parsed.data.eventCategory ?? null,
      page: parsed.data.page ?? null,
      metadata: parsed.data.metadata ?? null,
    });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false });
  }
});

const HeartbeatBody = z.object({
  sessionId: z.string().min(8).max(64),
  page: z.string().max(500).optional(),
});

router.post("/analytics/heartbeat", heartbeatLimiter, async (req, res) => {
  try {
    const parsed = HeartbeatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false });
      return;
    }
    await upsertHeartbeat({
      req,
      sessionId: parsed.data.sessionId,
      page: parsed.data.page ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "heartbeat_failed");
    res.status(500).json({ ok: false });
  }
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Admin realtime dashboard                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

router.get("/admin/analytics/realtime", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const [
      online,
      liveGames,
      lastHourCount,
      assignmentsTodayRow,
      aiUseTodayRow,
      topPagesRow,
      topClicksRow,
      topFeaturesRow,
      topCategoriesRow,
      lastHourEvents,
    ] = await Promise.all([
      getOnlineSnapshot(),
      getLiveGamesCount(),
      db.execute<{ cnt: number }>(sql`
        SELECT COUNT(*)::int AS cnt FROM activity_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `),
      db.execute<{ cnt: number }>(sql`
        SELECT COUNT(*)::int AS cnt FROM activity_logs
        WHERE action IN ('assignment_created_success','create_homework')
          AND created_at >= date_trunc('day', NOW())
      `),
      db.execute<{ cnt: number }>(sql`
        SELECT COUNT(*)::int AS cnt FROM activity_logs
        WHERE (action = 'ai_use'
               OR action LIKE 'ai_generation_%'
               OR event_category = 'ai')
          AND created_at >= date_trunc('day', NOW())
      `),
      db.execute<{ page_url: string; cnt: number }>(sql`
        SELECT page_url, COUNT(*)::int AS cnt FROM activity_logs
        WHERE (action = 'view' OR event_category = 'navigation')
          AND page_url IS NOT NULL
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY page_url ORDER BY cnt DESC LIMIT 10
      `),
      db.execute<{ action: string; cnt: number }>(sql`
        SELECT action, COUNT(*)::int AS cnt FROM activity_logs
        WHERE action LIKE '%_clicked'
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY action ORDER BY cnt DESC LIMIT 10
      `),
      db.execute<{ action: string; cnt: number }>(sql`
        SELECT action, COUNT(*)::int AS cnt FROM activity_logs
        WHERE action NOT IN ('view')
          AND action NOT LIKE '%_clicked'
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY action ORDER BY cnt DESC LIMIT 10
      `),
      db.execute<{ event_category: string; cnt: number }>(sql`
        SELECT COALESCE(event_category, 'uncategorized') AS event_category,
               COUNT(*)::int AS cnt FROM activity_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1 ORDER BY cnt DESC LIMIT 10
      `),
      db.select({
        id: activityLogsTable.id,
        action: activityLogsTable.action,
        userName: activityLogsTable.userName,
        userRole: activityLogsTable.userRole,
        eventCategory: activityLogsTable.eventCategory,
        pageUrl: activityLogsTable.pageUrl,
        createdAt: activityLogsTable.createdAt,
        details: activityLogsTable.details,
      })
        .from(activityLogsTable)
        .where(gte(activityLogsTable.createdAt, new Date(Date.now() - 60 * 60_000)))
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(30),
    ]);

    res.json({
      online: {
        total: online.total,
        teachers: online.byRole.teacher + online.byRole.organizer,
        students: online.byRole.student,
        admins: online.byRole.admin,
        visitors: online.byRole.visitor,
        breakdown: online.byRole,
      },
      liveGamesNow: liveGames,
      lastHour: {
        eventCount: Number(lastHourCount.rows[0]?.cnt ?? 0),
        recent: lastHourEvents,
      },
      today: {
        assignmentsCreated: Number(assignmentsTodayRow.rows[0]?.cnt ?? 0),
        aiUses: Number(aiUseTodayRow.rows[0]?.cnt ?? 0),
      },
      topPages: topPagesRow.rows.map((r) => ({ pageUrl: r.page_url, count: Number(r.cnt) })),
      topClicks: topClicksRow.rows.map((r) => ({ action: r.action, count: Number(r.cnt) })),
      topFeatures: topFeaturesRow.rows.map((r) => ({ action: r.action, count: Number(r.cnt) })),
      topCategories: topCategoriesRow.rows.map((r) => ({
        category: r.event_category,
        count: Number(r.cnt),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "analytics_realtime_failed");
    res.status(500).json({ message: "خطأ في جلب الإحصائيات اللحظية" });
  }
});

/** List currently online sessions (admin). Useful for the live "who's here" view. */
router.get("/admin/analytics/online-sessions", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const cutoff = new Date(Date.now() - 90_000);
    const rows = await db
      .select({
        sessionId: onlineSessionsTable.sessionId,
        userId: onlineSessionsTable.userId,
        userName: onlineSessionsTable.userName,
        userRole: onlineSessionsTable.userRole,
        page: onlineSessionsTable.page,
        device: onlineSessionsTable.device,
        browser: onlineSessionsTable.browser,
        startedAt: onlineSessionsTable.startedAt,
        lastHeartbeatAt: onlineSessionsTable.lastHeartbeatAt,
      })
      .from(onlineSessionsTable)
      .where(gte(onlineSessionsTable.lastHeartbeatAt, cutoff))
      .orderBy(desc(onlineSessionsTable.lastHeartbeatAt))
      .limit(200);
    res.json({ items: rows, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "online_sessions_list_failed");
    res.status(500).json({ message: "خطأ" });
  }
});

// Avoid unused-import warnings; some queries don't need them but keeping
// available for future expansion.
void and;
void isNotNull;

export default router;
