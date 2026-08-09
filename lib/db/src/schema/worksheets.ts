import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

/* Worksheet generator (مولّد ورقة العمل).
   A worksheet is a printable document the teacher hands out to students.
   It has a header (title, name/date fields), an optional instructions
   block, then a list of mixed-type questions, and an optional answer key
   page that the teacher can toggle on/off.

   Shape of `questions` (jsonb):
     Array<
       | { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
       | { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
       | { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number }
       | { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
       | { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
     >

   Shape of `settings` (jsonb):
     {
       instructions?: string;       // shown above the questions
       includeName: boolean;        // show "Name: ____" field at top
       includeDate: boolean;        // show "Date: ____" field at top
       includeClass: boolean;       // show "Class: ____" field at top
       includeAnswerKey: boolean;   // append a separate answer-key page
       columns: 1 | 2;              // single or two-column layout
       headerNote?: string;         // free text shown under title
       footerNote?: string;         // free text shown at the bottom of every page
       schoolName?: string;         // printed in the worksheet header (top-left)
       section?: string;            // class section, printed in the header
       teacherName?: string;        // teacher's display name, printed in the header
       fontFamily?: "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia";
       fontSizePt?: number;         // base font size, 9-18 pt
       showWatermark?: boolean;     // big faint Hasad watermark behind content (default true)
     }
*/
export const worksheetsTable = pgTable("worksheets", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  title: text("title").notNull(),
  language: text("language").notNull().default("ar"),
  gradeLevel: text("grade_level"),
  subject: text("subject"),
  questions: jsonb("questions").notNull(),
  settings: jsonb("settings").notNull(),
  isShared: boolean("is_shared").notNull().default(false),
  /** When smart paper grading is enabled, points at the internal
   *  behind-the-scenes assignment that powers the existing grading engine.
   *  NULL = grading not enabled. The linked assignment has source='worksheet'
   *  and is hidden from the teacher's normal assignment lists. */
  linkedAssignmentId: integer("linked_assignment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
