import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { studentAccountsTable } from "./student-accounts";

export const capitalScoresTable = pgTable("capital_scores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  total: integer("total").notNull().default(0),
  tier: integer("tier").notNull().default(1),
  timeMs: integer("time_ms").notNull().default(0),
  studentAccountId: integer("student_account_id").references(() => studentAccountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
