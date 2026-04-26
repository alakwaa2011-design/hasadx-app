import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const millionScoresTable = pgTable("million_scores", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull().default(0),
  level: integer("level").notNull().default(1),
  assignmentTitle: text("assignment_title"),
  category: text("category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MillionScore = typeof millionScoresTable.$inferSelect;
