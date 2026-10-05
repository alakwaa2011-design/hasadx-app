import { pgTable, uuid, integer, text, varchar, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { presentationSessionsTable } from "./presentation-sessions";
import { studentsTable } from "./students";

export const presentationWallRunsTable = pgTable("presentation_wall_runs", {
  id: uuid("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => presentationSessionsTable.id, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  revision: integer("revision").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ sessionIdx: index("presentation_wall_runs_session_idx").on(t.sessionId) }));

export const presentationWallCardsTable = pgTable("presentation_wall_cards", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => presentationWallRunsTable.id, { onDelete: "cascade" }),
  studentKey: varchar("student_key", { length: 40 }).notNull(),
  studentName: text("student_name").notNull(),
  classStudentId: integer("class_student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  text: varchar("text", { length: 500 }).notNull(),
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ uniqueStudent: uniqueIndex("presentation_wall_cards_student_unique").on(t.runId, t.studentKey) }));

export type PresentationWallRun = typeof presentationWallRunsTable.$inferSelect;
export type PresentationWallCard = typeof presentationWallCardsTable.$inferSelect;
