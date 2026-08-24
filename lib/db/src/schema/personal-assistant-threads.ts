import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const personalAssistantThreadsTable = pgTable("personal_assistant_threads", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  channel: text("channel").notNull().default("whatsapp"),
  externalContactPhone: text("external_contact_phone").notNull().unique(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonalAssistantThreadSchema = createInsertSchema(personalAssistantThreadsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPersonalAssistantThread = z.infer<typeof insertPersonalAssistantThreadSchema>;
export type PersonalAssistantThread = typeof personalAssistantThreadsTable.$inferSelect;