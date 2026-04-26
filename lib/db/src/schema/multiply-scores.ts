import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { studentAccountsTable } from "./student-accounts";

export const multiplicationScoresTable = pgTable("multiplication_scores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull().default(0),
  level: integer("level").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  timeMs: integer("time_ms").notNull().default(0),
  difficulty: text("difficulty").notNull().default("medium"),
  studentAccountId: integer("student_account_id").references(() => studentAccountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
