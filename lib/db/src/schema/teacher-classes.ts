import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const teacherClassesTable = pgTable(
  "teacher_classes",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    teacherNameUnique: uniqueIndex("teacher_classes_teacher_name_unique").on(t.teacherId, t.name),
  }),
);

export type TeacherClass = typeof teacherClassesTable.$inferSelect;
