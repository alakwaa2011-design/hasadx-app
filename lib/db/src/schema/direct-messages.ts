import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => teachersTable.id),
  recipientId: integer("recipient_id").notNull().references(() => teachersTable.id),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
