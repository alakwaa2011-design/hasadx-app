import { pgTable, serial, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const millionTeamVotesTable = pgTable("million_team_votes", {
  id: serial("id").primaryKey(),
  sessionPin: varchar("session_pin", { length: 6 }).notNull(),
  questionIndex: integer("question_index").notNull(),
  team: varchar("team", { length: 1 }).notNull(),
  teamAnswer: varchar("team_answer", { length: 1 }),
  correctAnswer: varchar("correct_answer", { length: 1 }).notNull(),
  isCorrect: boolean("is_correct").notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  teamSize: integer("team_size").notNull().default(0),
  prizeWon: integer("prize_won").notNull().default(0),
  prizeLevel: integer("prize_level").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MillionTeamVote = typeof millionTeamVotesTable.$inferSelect;
