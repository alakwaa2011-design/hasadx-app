import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  type: varchar("type", { length: 20 }).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  adminResponse: text("admin_response"),
  respondedAt: timestamp("responded_at"),
  respondedBy: integer("responded_by"),
  responseEmailStatus: varchar("response_email_status", { length: 20 }),
  responseEmailRefKey: varchar("response_email_ref_key", { length: 100 }),
});

export type Feedback = typeof feedbackTable.$inferSelect;
