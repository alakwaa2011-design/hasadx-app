import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const activityLogsTable = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    userName: text("user_name"),
    userRole: text("user_role").notNull().default("visitor"),
    action: text("action").notNull(),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    device: text("device"),
    browser: text("browser"),
    pageUrl: text("page_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index("activity_logs_created_at_idx").on(t.createdAt),
    userIdx: index("activity_logs_user_idx").on(t.userId, t.userRole),
    actionIdx: index("activity_logs_action_idx").on(t.action),
  }),
);

export type ActivityLog = typeof activityLogsTable.$inferSelect;
