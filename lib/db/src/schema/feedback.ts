import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
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
});

export type Feedback = typeof feedbackTable.$inferSelect;
