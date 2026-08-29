import { date, integer, pgTable, primaryKey, text, timestamp, jsonb, bigint, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { teachersTable } from "./teachers";

export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    outlineCount: integer("outline_count").default(0).notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    costMicroUsd: integer("cost_micro_usd").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.day] })],
);

export type AiUsageDaily = typeof aiUsageDaily.$inferSelect;

/**
 * Immutable-per-provider-call accounting record.  This is deliberately more
 * granular than ai_usage_daily: daily usage remains useful for legacy UI,
 * while this table is the audit source for provider cost reporting.
 */
export const aiUsageLedger = pgTable(
  "ai_usage_ledger",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    callKey: text("call_key").notNull(),
    toolKey: text("tool_key").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    modality: text("modality").notNull(),
    status: text("status").notNull().default("started"),
    tokensIn: integer("tokens_in").default(0),
    tokensOut: integer("tokens_out").default(0),
    usageQuantity: integer("usage_quantity"),
    usageUnit: text("usage_unit"),
    // bigint avoids overflow for long-lived installations; number is safe for
    // practical micro-USD values and keeps API consumers ergonomic.
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }),
    costSource: text("cost_source").notNull().default("unavailable"),
    errorCode: text("error_code"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().default(sql`NOW()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`NOW()`),
  },
  (t) => [
    uniqueIndex("ai_usage_ledger_teacher_request_call_uidx").on(t.teacherId, t.requestId, t.callKey),
    index("ai_usage_ledger_completed_at_idx").on(t.completedAt),
    index("ai_usage_ledger_provider_model_idx").on(t.provider, t.model, t.completedAt),
    index("ai_usage_ledger_tool_completed_idx").on(t.toolKey, t.completedAt),
    index("ai_usage_ledger_teacher_completed_idx").on(t.teacherId, t.completedAt),
  ],
);

export type AiUsageLedger = typeof aiUsageLedger.$inferSelect;
