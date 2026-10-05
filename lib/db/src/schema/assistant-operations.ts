import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { teachersTable } from "./teachers";
import { worksheetsTable } from "./worksheets";
import { bigserial } from "drizzle-orm/pg-core";

export const assistantExecutionTrialsTable = pgTable("assistant_execution_trials", {
  teacherId: integer("teacher_id").primaryKey().references(() => teachersTable.id, { onDelete: "cascade" }),
  reservedOperationId: uuid("reserved_operation_id"),
  consumedOperationId: uuid("consumed_operation_id"),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const assistantExecutionEventsTable = pgTable("assistant_execution_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  eventName: text("event_name").notNull(),
  operationId: uuid("operation_id"),
  eventKey: text("event_key").notNull().unique(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantOperationsTable = pgTable("assistant_worksheet_operations", {
  id: uuid("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  requestText: text("request_text").notNull(),
  reply: text("reply").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  template: text("template").notNull().default("geometric"),
  messages: jsonb("messages").$type<Array<{ role: "user" | "assistant"; text: string }>>().notNull(),
  missingFields: jsonb("missing_fields").$type<string[]>().notNull(),
  quote: jsonb("quote").$type<{ id: string; credits: number; expiresAt: string }>(),
  status: text("status").notNull().default("draft"),
  credits: integer("credits").notNull().default(0),
  held: boolean("held").notNull().default(false),
  creditRequestId: text("credit_request_id").notNull().unique(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  worksheetId: integer("worksheet_id").references(() => worksheetsTable.id, { onDelete: "set null" }),
  errorCode: text("error_code"),
  archived: boolean("archived").notNull().default(false),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const assistantConfigurationTable = pgTable("assistant_configuration", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  pilotOnly: boolean("pilot_only").notNull().default(true),
  teacherIds: integer("teacher_ids").array().notNull().default([]),
});
export const insertAssistantOperationSchema = createInsertSchema(assistantOperationsTable);
export type AssistantOperationRow = typeof assistantOperationsTable.$inferSelect;
export type NewAssistantOperation = typeof assistantOperationsTable.$inferInsert;
