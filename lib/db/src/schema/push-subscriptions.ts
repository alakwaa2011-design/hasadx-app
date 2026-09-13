import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { notificationsTable } from "./notifications";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  sessionId: text("session_id"),
  userAgent: text("user_agent"),
  locale: text("locale").notNull().default("ar"),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  failureCount: integer("failure_count").notNull().default(0),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  endpointUnique: uniqueIndex("push_subscriptions_endpoint_uq").on(table.endpoint),
  teacherIdx: index("push_subscriptions_teacher_idx").on(table.teacherId),
  sessionIdx: index("push_subscriptions_session_idx").on(table.sessionId),
}));

export const pushNotificationDeliveriesTable = pgTable("push_notification_deliveries", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id")
    .notNull()
    .references(() => notificationsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => pushSubscriptionsTable.id, { onDelete: "cascade" }),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  notificationSubscriptionUnique: uniqueIndex("push_notification_deliveries_notification_subscription_uq")
    .on(table.notificationId, table.subscriptionId),
  pendingIdx: index("push_notification_deliveries_pending_idx").on(table.processedAt, table.nextAttemptAt),
}));

export type PushSubscriptionRecord = typeof pushSubscriptionsTable.$inferSelect;