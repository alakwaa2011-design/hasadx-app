import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

/** One permanent public link per assignment (teacher-owned). */
export const soloChallengesTable = pgTable("solo_challenges", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  /** Short ASCII slug used in social-share URLs, e.g. "eid-quiz-k4x2".
   *  Nullable for rows created before this column was added. */
  shortSlug: text("short_slug").unique(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  assignmentTitle: text("assignment_title").notNull(),
  playCount: integer("play_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("solo_challenges_slug_idx").on(t.slug),
  shortSlugIdx: index("solo_challenges_short_slug_idx").on(t.shortSlug),
  assignmentIdx: index("solo_challenges_assignment_idx").on(t.assignmentId),
  teacherIdx: index("solo_challenges_teacher_idx").on(t.teacherId),
}));

/** Every completed play attempt recorded for leaderboard. */
export const soloChallengeScoresTable = pgTable("solo_challenge_scores", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull().default(0),
  playedAt: timestamp("played_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("solo_challenge_scores_slug_idx").on(t.slug),
  scoreIdx: index("solo_challenge_scores_score_idx").on(t.slug, t.score),
}));

export type SoloChallenge = typeof soloChallengesTable.$inferSelect;
export type InsertSoloChallenge = typeof soloChallengesTable.$inferInsert;
export type SoloChallengeScore = typeof soloChallengeScoresTable.$inferSelect;
export type InsertSoloChallengeScore = typeof soloChallengeScoresTable.$inferInsert;
