import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { assignmentsTable } from "./assignments";

export const examSessionsTable = pgTable("exam_sessions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull(),
  deviceFingerprint: text("device_fingerprint").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});

export type ExamSession = typeof examSessionsTable.$inferSelect;
