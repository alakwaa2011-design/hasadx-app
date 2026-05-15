import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Unified event/activity log. Backwards-compatible with the original
 * "page-view" tracker (action="view") while also supporting the new unified
 * event-tracking taxonomy. New columns are nullable so legacy rows and legacy
 * inserters keep working unchanged.
 */
export const activityLogsTable = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    userName: text("user_name"),
    userRole: text("user_role").notNull().default("visitor"),
    /** event_name in the new taxonomy (e.g. "assignment_created_success"). */
    action: text("action").notNull(),
    /** event_category (e.g. "assignment", "game", "ai", "navigation", "auth"). Nullable for legacy rows. */
    eventCategory: text("event_category"),
    /** Per-tab session id from sessionStorage (used to dedupe online users). */
    sessionId: text("session_id"),
    /** Free-form metadata JSON. Same column as the legacy "details" field. */
    details: jsonb("details"),
    /** Legacy plain IP (kept nullable for backward-compat; new inserts prefer ipHash). */
    ipAddress: text("ip_address"),
    /** Privacy-preserving SHA-256 hash of the IP, no plain IP retained. */
    ipHash: text("ip_hash"),
    device: text("device"),
    browser: text("browser"),
    pageUrl: text("page_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index("activity_logs_created_at_idx").on(t.createdAt),
    userIdx: index("activity_logs_user_idx").on(t.userId, t.userRole),
    actionIdx: index("activity_logs_action_idx").on(t.action),
    categoryIdx: index("activity_logs_category_idx").on(t.eventCategory),
    sessionIdx: index("activity_logs_session_idx").on(t.sessionId),
  }),
);

export type ActivityLog = typeof activityLogsTable.$inferSelect;

/**
 * Online presence tracking. Each browser tab generates a session_id and pings
 * /api/analytics/heartbeat every 30 seconds. Rows older than ~90s without a
 * heartbeat are considered offline. Anonymous visitors are tracked too
 * (user_id is null), so we always carry the session_id as the unique key.
 */
export const onlineSessionsTable = pgTable(
  "online_sessions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull().unique(),
    userId: integer("user_id"),
    userRole: text("user_role").notNull().default("visitor"),
    userName: text("user_name"),
    page: text("page"),
    device: text("device"),
    browser: text("browser"),
    ipHash: text("ip_hash"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at").defaultNow().notNull(),
  },
  (t) => ({
    heartbeatIdx: index("online_sessions_heartbeat_idx").on(t.lastHeartbeatAt),
    roleIdx: index("online_sessions_role_idx").on(t.userRole),
    userIdx: index("online_sessions_user_idx").on(t.userId),
  }),
);

export type OnlineSession = typeof onlineSessionsTable.$inferSelect;
