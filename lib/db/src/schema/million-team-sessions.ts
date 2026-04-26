import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";

export const millionTeamSessionsTable = pgTable("million_team_sessions", {
  id: serial("id").primaryKey(),
  pin: varchar("pin", { length: 6 }).notNull(),
  teacherId: integer("teacher_id"),
  winner: text("winner"),
  teamAPoints: integer("team_a_points").notNull().default(0),
  teamBPoints: integer("team_b_points").notNull().default(0),
  teamAPrize: integer("team_a_prize").notNull().default(0),
  teamBPrize: integer("team_b_prize").notNull().default(0),
  teamAPlayers: integer("team_a_players").notNull().default(0),
  teamBPlayers: integer("team_b_players").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export type MillionTeamSession = typeof millionTeamSessionsTable.$inferSelect;
