import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { parentMessagesTable } from "./parent-messages";

export const parentMessageRepliesTable = pgTable("parent_message_replies", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => parentMessagesTable.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(), // 'teacher' | 'parent'
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  messageIdx: index("pmr_message_idx").on(t.messageId),
}));

export type ParentMessageReply = typeof parentMessageRepliesTable.$inferSelect;
