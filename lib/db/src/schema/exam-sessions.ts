import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { assignmentsTable } from "./assignments";

export const examSessionsTable = pgTable("exam_sessions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull(),
  deviceFingerprint: text("device_fingerprint").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
}, (t) => ({
  assignmentFpIdx: index("exam_sessions_assignment_fp_idx").on(t.assignmentId, t.deviceFingerprint),
}));

export type ExamSession = typeof examSessionsTable.$inferSelect;
