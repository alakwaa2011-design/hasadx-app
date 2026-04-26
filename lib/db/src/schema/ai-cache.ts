import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const aiCache = pgTable("ai_cache", {
  questionHash: varchar("question_hash", { length: 64 }).primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  model: text("model").notNull(),
  hitCount: integer("hit_count").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AiCache = typeof aiCache.$inferSelect;
