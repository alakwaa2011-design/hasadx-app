import { pgTable, serial, text, timestamp, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

/** One permanent public link per challenge (teacher-owned).
 *  Can be linked to an existing assignment OR be standalone with inline questions. */
export const soloChallengesTable = pgTable("solo_challenges", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  /** Short ASCII slug used in social-share URLs, e.g. "eid-quiz-k4x2". */
  shortSlug: text("short_slug").unique(),
  /** Nullable for standalone challenges (questions stored in `questions` column). */
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  assignmentTitle: text("assignment_title").notNull(),
  notes: text("notes"),
  /** If set, the challenge is closed after this timestamp. */
  expiresAt: timestamp("expires_at"),
  /** Inline questions for standalone challenges (null when linked to an assignment).
   *  Shape: Array<{ text, optionA, optionB, optionC, optionD, correctAnswer: "A"|"B"|"C"|"D" }> */
  questions: jsonb("questions"),
  /** Seconds allocated per question (clamped 5–120 by the game engine). */
  timePerQuestion: integer("time_per_question").default(20),
  /** Optional cap on how many questions each participant answers, randomly
   *  selected (and shuffled) per run from the full bank. Null = all questions. */
  questionsPerParticipant: integer("questions_per_participant"),
  /** How many entries to show in the leaderboard: 'top3' | 'top20' | 'all' */
  leaderboardDisplay: text("leaderboard_display").default("top20"),
  /** How many attempts count toward the final score, per device/participant.
   *  1 (default) = only the first attempt counts, replays don't change it.
   *  2 = after the 2nd attempt, the participant manually picks which score to keep.
   *  >2 = participant must play all N attempts, then the best result is auto-picked. */
  maxAttempts: integer("max_attempts").notNull().default(1),
  playCount: integer("play_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** Optional difficulty preset: 'easy' (30 s), 'medium' (15 s), 'hard' (8 s).
   *  When set, overrides timePerQuestion for non-multi-level challenges. */
  difficulty: text("difficulty"),
  /** When true, the difficulty level also scales the base points per question. */
  difficultyAffectsPoints: boolean("difficulty_affects_points").notNull().default(false),
  /** When true, the challenge is split into multiple levels defined in `levels`. */
  isMultiLevel: boolean("is_multi_level").notNull().default(false),
  /** Level definitions for multi-level challenges.
   *  Shape: Array<{ name: string, questionCount: number, timePerQuestion: number }> */
  levels: jsonb("levels"),
  /** Difficulty distribution for question-selection mode.
   *  Shape: { easy: number, medium: number, hard: number } | null
   *  When set, the /start handler picks questions by difficulty bucket
   *  (questions.difficulty: 1=easy 2=medium 3=hard). */
  difficultyDistribution: jsonb("difficulty_distribution"),
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
  /** Total points earned (base 100 × question × time-speed bonus multiplier). */
  score: integer("score").notNull().default(0),
  /** Number of correctly answered questions (secondary sort key). */
  correctCount: integer("correct_count").notNull().default(0),
  /** Total time taken in seconds (stored for leaderboard display). */
  timeTaken: integer("time_taken"),
  playedAt: timestamp("played_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("solo_challenge_scores_slug_idx").on(t.slug),
  scoreIdx: index("solo_challenge_scores_score_idx").on(t.slug, t.score),
}));

export type SoloChallenge = typeof soloChallengesTable.$inferSelect;
export type InsertSoloChallenge = typeof soloChallengesTable.$inferInsert;
export type SoloChallengeScore = typeof soloChallengeScoresTable.$inferSelect;
export type InsertSoloChallengeScore = typeof soloChallengeScoresTable.$inferInsert;
