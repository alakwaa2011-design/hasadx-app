import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { assignmentsTable } from "./assignments";

export const adaptiveSessionsTable = pgTable("adaptive_sessions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull().default(""),
  deviceFingerprint: text("device_fingerprint"),
  currentAbility: real("current_ability").notNull().default(2.0),
  skillAbilities: text("skill_abilities"),
  questionSequence: text("question_sequence"),
  currentQuestionId: integer("current_question_id"),
  answeredCount: integer("answered_count").notNull().default(0),
  totalToAnswer: integer("total_to_answer").notNull(),
  correctCount: integer("correct_count").notNull().default(0),
  finalLevel: text("final_level"),
  submissionId: integer("submission_id"),
  completed: integer("completed").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type AdaptiveSession = typeof adaptiveSessionsTable.$inferSelect;
