import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id),
  messageId: integer("message_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;
