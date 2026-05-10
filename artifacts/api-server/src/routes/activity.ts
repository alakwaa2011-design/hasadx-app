import { Router, type IRouter } from "express";
import { db, activityLogsTable, teachersTable } from "@workspace/db";
import { sql, eq, and, gte, lte, desc, like, or } from "drizzle-orm";
import { z } from "zod";
import {
  logActivity,
  suspiciousHighRateUsers,
  suspiciousConcurrentLogins,
  sanitizeDetails,
} from "../lib/activity-logger";
import { rateLimit } from "express-rate-limit";

const router: IRouter = Router();

const pageViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { ok: false },
});

async function requireAdmin(req: any, res: any): Promise<boolean> {
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
    res.status(403).json({ message: "غير مصرح — صلاحيات المسؤول مطلوبة" });
    return false;
  }
  return true;
}

const PageViewBody = z.object({
  pageUrl: z.string().min(1).max(500),
}).strict();

/** Public endpoint the SPA calls on every route change to log a page view.
 *  Cheap path: pulls the actor identity from the session only (no DB lookup),
 *  so the request never blocks on a join. The userName column will fill in
 *  from concurrent login/AI/etc events via MAX(user_name) aggregation in stats. */
router.post("/activity/page-view", pageViewLimiter, (req, res) => {
  try {
    const body = PageViewBody.parse(req.body);
    const sess: any = req.session ?? {};
    let userId: number | null = null;
    let userRole: "teacher" | "student" | "visitor" = "visitor";
    if (sess.teacherId) { userId = sess.teacherId; userRole = "teacher"; }
    else if (sess.studentAccountId) { userId = sess.studentAccountId; userRole = "student"; }
    logActivity({
      req,
      userId,
      userRole,
      action: "view",
      pageUrl: body.pageUrl,
    });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false });
  }
});

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.coerce.number().int().optional(),
  userRole: z.enum(["teacher", "organizer", "student", "admin", "visitor"]).optional(),
  action: z.string().max(64).optional(),
  search: z.string().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get("/admin/activity-logs", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const q = ListQuery.parse(req.query);
    const conds: any[] = [];
    if (q.userId) conds.push(eq(activityLogsTable.userId, q.userId));
    if (q.userRole) conds.push(eq(activityLogsTable.userRole, q.userRole));
    if (q.action) conds.push(eq(activityLogsTable.action, q.action));
    if (q.from) {
      const d = new Date(q.from);
      if (!isNaN(d.getTime())) conds.push(gte(activityLogsTable.createdAt, d));
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!isNaN(d.getTime())) conds.push(lte(activityLogsTable.createdAt, d));
    }
    if (q.search) {
      const s = `%${q.search}%`;
      conds.push(or(
        like(activityLogsTable.userName, s),
        like(activityLogsTable.action, s),
        like(activityLogsTable.pageUrl, s),
      ));
    }
    const where = conds.length ? and(...conds) : undefined;
    const offset = (q.page - 1) * q.pageSize;

    const [items, [{ cnt }]] = await Promise.all([
      db.select().from(activityLogsTable)
        .where(where as any)
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(q.pageSize).offset(offset),
      db.select({ cnt: sql<number>`COUNT(*)::int` }).from(activityLogsTable).where(where as any),
    ]);

    res.json({ items, total: cnt, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    req.log.error({ err }, "activity_logs_list_failed");
    res.status(500).json({ message: "خطأ في جلب السجل" });
  }
});

router.get("/admin/activity-logs/stats", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const [activeRows, topPagesRows, topUsersRows, recentRows, totalsRows] = await Promise.all([
      db.execute<{ cnt: number }>(sql`
        SELECT COUNT(DISTINCT user_id)::int AS cnt
        FROM activity_logs
        WHERE user_id IS NOT NULL AND created_at >= date_trunc('day', NOW())
      `),
      db.execute<{ page_url: string; cnt: number }>(sql`
        SELECT page_url, COUNT(*)::int AS cnt
        FROM activity_logs
        WHERE action = 'view' AND page_url IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY page_url ORDER BY cnt DESC LIMIT 10
      `),
      db.execute<{ user_id: number; user_name: string | null; user_role: string; cnt: number }>(sql`
        SELECT user_id, MAX(user_name) AS user_name, MAX(user_role) AS user_role, COUNT(*)::int AS cnt
        FROM activity_logs
        WHERE user_id IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id ORDER BY cnt DESC LIMIT 10
      `),
      db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(10),
      db.execute<{ total: number; today: number }>(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today
        FROM activity_logs
      `),
    ]);

    res.json({
      activeUsersToday: activeRows.rows[0]?.cnt ?? 0,
      topPages: topPagesRows.rows.map((r) => ({ pageUrl: r.page_url, count: Number(r.cnt) })),
      topUsers: topUsersRows.rows.map((r) => ({ userId: r.user_id, userName: r.user_name, userRole: r.user_role, count: Number(r.cnt) })),
      recent: recentRows,
      totals: { all: Number(totalsRows.rows[0]?.total ?? 0), today: Number(totalsRows.rows[0]?.today ?? 0) },
    });
  } catch (err) {
    req.log.error({ err }, "activity_logs_stats_failed");
    res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
  }
});

router.get("/admin/activity-alerts", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const [highRate, concurrent, unauthorized] = await Promise.all([
      suspiciousHighRateUsers(),
      suspiciousConcurrentLogins(),
      db.select().from(activityLogsTable)
        .where(eq(activityLogsTable.action, "unauthorized_access"))
        .orderBy(desc(activityLogsTable.createdAt))
        .limit(20),
    ]);
    res.json({ highRate, concurrentLogins: concurrent, unauthorized });
  } catch (err) {
    req.log.error({ err }, "activity_alerts_failed");
    res.status(500).json({ message: "خطأ في جلب التنبيهات" });
  }
});

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : (typeof v === "object" ? JSON.stringify(v) : String(v));
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/admin/activity-logs/export", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const q = ListQuery.partial({ page: true, pageSize: true }).parse(req.query);
    const conds: any[] = [];
    if (q.userId) conds.push(eq(activityLogsTable.userId, q.userId));
    if (q.userRole) conds.push(eq(activityLogsTable.userRole, q.userRole));
    if (q.action) conds.push(eq(activityLogsTable.action, q.action));
    if (q.from) {
      const d = new Date(q.from);
      if (!isNaN(d.getTime())) conds.push(gte(activityLogsTable.createdAt, d));
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!isNaN(d.getTime())) conds.push(lte(activityLogsTable.createdAt, d));
    }
    if (q.search) {
      const s = `%${q.search}%`;
      conds.push(or(
        like(activityLogsTable.userName, s),
        like(activityLogsTable.action, s),
        like(activityLogsTable.pageUrl, s),
      ));
    }
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db.select().from(activityLogsTable)
      .where(where as any)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(10000);

    const header = ["id", "created_at", "user_id", "user_name", "user_role", "action", "ip_address", "device", "browser", "page_url", "details"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        r.id,
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        r.userId ?? "",
        r.userName ?? "",
        r.userRole,
        r.action,
        r.ipAddress ?? "",
        r.device ?? "",
        r.browser ?? "",
        r.pageUrl ?? "",
        r.details ? sanitizeDetails(r.details as Record<string, unknown>) : "",
      ].map(csvEscape).join(","));
    }
    const csv = "\uFEFF" + lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="activity-logs-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "activity_logs_export_failed");
    res.status(500).json({ message: "خطأ في التصدير" });
  }
});

export default router;
