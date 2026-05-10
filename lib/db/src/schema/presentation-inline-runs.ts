import { pgTable, serial, integer, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { presentationSessionsTable } from "./presentation-sessions";
import { studentsTable } from "./students";

/* Persisted record of a completed inline hasad-game quiz run during a
   live presentation session. Captured when the teacher reaches the end
   of the inline quiz so the leaderboard outlives the in-memory state.

   One row per (run, student). A "run" is identified by the
   (sessionId, elementId, finishedAt) tuple — if the teacher reopens
   the same activity in the same session, a fresh set of rows is
   inserted with a new finishedAt. */
export const presentationInlineQuizRunsTable = pgTable("presentation_inline_quiz_runs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => presentationSessionsTable.id, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  /* Total number of questions in this run (snapshot at run-end, so
     deck edits afterwards don't shift historical numbers). */
  totalQuestions: integer("total_questions").notNull(),
  /* Per-student summary. studentKey matches the live socket student
     key (also used in presentation_responses.studentKey). */
  studentKey: varchar("student_key", { length: 40 }).notNull(),
  studentName: text("student_name").notNull(),
  classStudentId: integer("class_student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  correct: integer("correct").notNull(),
  answered: integer("answered").notNull(),
  /* Timestamp at which the run ended; identifies the run when grouped
     with sessionId + elementId. */
  finishedAt: timestamp("finished_at").notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index("presentation_inline_quiz_runs_session_idx").on(t.sessionId),
  runIdx: index("presentation_inline_quiz_runs_run_idx").on(t.sessionId, t.elementId, t.finishedAt),
}));

export type PresentationInlineQuizRunRow = typeof presentationInlineQuizRunsTable.$inferSelect;
