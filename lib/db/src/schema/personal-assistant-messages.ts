import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { personalAssistantThreadsTable } from "./personal-assistant-threads";

export const personalAssistantMessagesTable = pgTable("personal_assistant_messages", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => personalAssistantThreadsTable.id, { onDelete: "cascade" }),
  externalMessageId: text("external_message_id").notNull().unique(),
  direction: text("direction").notNull().default("inbound"),
  messageText: text("message_text").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonalAssistantMessageSchema = createInsertSchema(personalAssistantMessagesTable).omit({
  createdAt: true,
});
export type InsertPersonalAssistantMessage = z.infer<typeof insertPersonalAssistantMessageSchema>;
export type PersonalAssistantMessage = typeof personalAssistantMessagesTable.$inferSelect;