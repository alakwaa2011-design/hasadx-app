import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

/**
 * Per-teacher monthly usage counters. Keyed by (teacher_id, period_month).
 * period_month is "YYYY-MM" (UTC). Resources counted in real time from their
 * own tables (students, classes) are NOT stored here — only flow counters
 * that are time-bounded (homeworks per month, AI per month).
 *
 * Atomic increment pattern:
 *   INSERT INTO subscription_usage (teacher_id, period_month, homeworks_count, ai_usage_count)
 *   VALUES (?, ?, 1, 0)
 *   ON CONFLICT (teacher_id, period_month)
 *     DO UPDATE SET homeworks_count = subscription_usage.homeworks_count + 1
 *     WHERE subscription_usage.homeworks_count < ?  -- enforced limit, omit if NULL
 *   RETURNING homeworks_count;
 */
export const subscriptionUsageTable = pgTable(
  "subscription_usage",
  {
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    /** Format: "YYYY-MM" UTC */
    periodMonth: text("period_month").notNull(),
    homeworksCount: integer("homeworks_count").notNull().default(0),
    aiUsageCount: integer("ai_usage_count").notNull().default(0),
    studentsAddedCount: integer("students_added_count").notNull().default(0),
    classesCreatedCount: integer("classes_created_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.periodMonth] })],
);

export type SubscriptionUsage = typeof subscriptionUsageTable.$inferSelect;
