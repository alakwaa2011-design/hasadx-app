import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { studentAccountsTable } from "./student-accounts";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gradeLevel: text("grade_level"),
  studentClass: text("student_class"),
  parentPhone: text("parent_phone"),
  parentName: text("parent_name"),
  parentEmail: text("parent_email"),
  notes: text("notes"),
  accountUsername: text("account_username"),
  studentAccountId: integer("student_account_id").unique().references(() => studentAccountsTable.id, { onDelete: "set null" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  teacherIdx: index("students_teacher_idx").on(t.teacherId),
  teacherClassIdx: index("students_teacher_class_idx").on(t.teacherId, t.studentClass),
}));

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
