import { pgTable, serial, integer, text, varchar, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { presentationsTable } from "./presentations";
import { teachersTable } from "./teachers";
import { teacherClassesTable } from "./teacher-classes";
import { studentsTable } from "./students";

/* Presentations 2B — Live MVP. A `presentation_session` is one
   running instance of a deck: a PIN, a current slide pointer, an
   optional currently-open activity element, and reveal flags. */
export const presentationSessionsTable = pgTable("presentation_sessions", {
  id: serial("id").primaryKey(),
  presentationId: integer("presentation_id").notNull().references(() => presentationsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  pin: varchar("pin", { length: 6 }).notNull(),
  status: text("status").notNull().default("lobby"),
  currentSlideIndex: integer("current_slide_index").notNull().default(0),
  activeElementId: text("active_element_id"),
  revealDistribution: boolean("reveal_distribution").notNull().default(false),
  revealAnswer: boolean("reveal_answer").notNull().default(false),
  targetClassId: integer("target_class_id").references(() => teacherClassesTable.id, { onDelete: "set null" }),
  mode: text("mode").notNull().default("guest"),
  /** Pacing mode: "teacher" = teacher drives slides; "self_paced" = each student browses independently. */
  sessionMode: text("session_mode").notNull().default("teacher"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  presIdx: index("presentation_sessions_pres_idx").on(t.presentationId),
  teacherIdx: index("presentation_sessions_teacher_idx").on(t.teacherId),
  /* Active-PIN uniqueness — only one non-ended session can claim a
     given PIN at a time. Created via raw SQL in the migration; the
     drizzle definition mirrors it for documentation. */
  activePinUnique: uniqueIndex("presentation_sessions_active_pin_unique")
    .on(t.pin)
    .where(sql`status <> 'ended'`),
}));

export type PresentationSession = typeof presentationSessionsTable.$inferSelect;

export const presentationResponsesTable = pgTable("presentation_responses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => presentationSessionsTable.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index").notNull(),
  elementId: text("element_id").notNull(),
  studentKey: varchar("student_key", { length: 40 }).notNull(),
  studentName: text("student_name").notNull(),
  /* Stable identifier for class-mode joiners — references the roster
     row the student picked when joining. Lets the results endpoint
     classify class vs guest by ID instead of by typed name, which
     breaks for duplicate names, spelling variants, or roster edits
     made after the session. Nullable for guest-mode rows and legacy
     pre-migration rows (which fall back to name matching). */
  classStudentId: integer("class_student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  answerIndex: integer("answer_index"),
  answerText: text("answer_text"),
  isCorrect: boolean("is_correct"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index("presentation_responses_session_idx").on(t.sessionId),
  uniqueAnswer: uniqueIndex("presentation_responses_unique_answer").on(t.sessionId, t.elementId, t.studentKey),
}));

export type PresentationResponse = typeof presentationResponsesTable.$inferSelect;
