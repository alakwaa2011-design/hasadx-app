import { pgTable, uuid, integer, text, varchar, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { presentationSessionsTable } from "./presentation-sessions";
import { studentsTable } from "./students";

export const presentationWordCloudRunsTable = pgTable("presentation_word_cloud_runs", {
  id: uuid("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => presentationSessionsTable.id, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ sessionIdx: index("presentation_word_cloud_runs_session_idx").on(t.sessionId) }));

export const presentationWordCloudSubmissionsTable = pgTable("presentation_word_cloud_submissions", {
  runId: uuid("run_id").notNull().references(() => presentationWordCloudRunsTable.id, { onDelete: "cascade" }),
  studentKey: varchar("student_key", { length: 40 }).notNull(),
  studentName: text("student_name").notNull(),
  classStudentId: integer("class_student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  word: varchar("word", { length: 60 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.runId, t.studentKey] }) }));

export const insertPresentationWordCloudRunSchema = createInsertSchema(presentationWordCloudRunsTable);
export const insertPresentationWordCloudSubmissionSchema = createInsertSchema(presentationWordCloudSubmissionsTable);
export type PresentationWordCloudRun = typeof presentationWordCloudRunsTable.$inferSelect;
export type PresentationWordCloudSubmission = typeof presentationWordCloudSubmissionsTable.$inferSelect;
