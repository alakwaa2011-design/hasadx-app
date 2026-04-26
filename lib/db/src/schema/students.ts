import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
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
  notes: text("notes"),
  accountUsername: text("account_username"),
  studentAccountId: integer("student_account_id").unique().references(() => studentAccountsTable.id, { onDelete: "set null" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
