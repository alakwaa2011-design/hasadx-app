import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { feedbackTable } from "./feedback";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => teachersTable.id),
  recipientId: integer("recipient_id").notNull().references(() => teachersTable.id),
  feedbackId: integer("feedback_id").references(() => feedbackTable.id, { onDelete: "set null" }),
  source: text("source").notNull().default("general"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
