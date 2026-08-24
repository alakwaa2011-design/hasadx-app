import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { personalAssistantMessagesTable } from "./personal-assistant-messages";
import { personalAssistantThreadsTable } from "./personal-assistant-threads";

export const PERSONAL_ASSISTANT_ACTION_STATUSES = ["pending_review", "confirmed", "cancelled"] as const;
export type PersonalAssistantActionStatus = (typeof PERSONAL_ASSISTANT_ACTION_STATUSES)[number];

export const personalAssistantActionsTable = pgTable("personal_assistant_actions", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => personalAssistantThreadsTable.id, { onDelete: "cascade" }),
  messageId: integer("message_id")
    .notNull()
    .unique()
    .references(() => personalAssistantMessagesTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull().default("review"),
  status: text("status").notNull().default("pending_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertPersonalAssistantActionSchema = createInsertSchema(personalAssistantActionsTable).omit({
  createdAt: true,
});
export type InsertPersonalAssistantAction = z.infer<typeof insertPersonalAssistantActionSchema>;
export type PersonalAssistantAction = typeof personalAssistantActionsTable.$inferSelect;