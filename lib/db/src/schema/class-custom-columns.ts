import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";

export const classCustomColumnsTable = pgTable("class_custom_columns", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  appliedTo: text("applied_to").notNull().default("*"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentCustomGradesTable = pgTable("student_custom_grades", {
  id: serial("id").primaryKey(),
  columnId: integer("column_id").notNull().references(() => classCustomColumnsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
