import { date, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";

import { teachersTable } from "./teachers";

export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    messageCount: integer("message_count").default(0).notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    costMicroUsd: integer("cost_micro_usd").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.day] })],
);

export type AiUsageDaily = typeof aiUsageDaily.$inferSelect;
