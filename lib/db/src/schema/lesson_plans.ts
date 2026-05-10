import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

/* Lesson plan generator (مولّد خطط الدروس).
   A lesson plan is a structured printable document the teacher uses to plan
   a single class period. It captures objectives, materials, vocabulary, the
   warm-up, the introduction, the main activities, an assessment hook, the
   closure, optional homework, optional differentiation notes, and free-text
   teacher notes.

   Shape of `sections` (jsonb):
     {
       objectives: string[];                                  // SWBAT goals
       materials: string[];                                   // bullet list
       vocabulary: Array<{ term: string; definition?: string }>;
       warmUp:        { title?: string; durationMinutes?: number; description: string };
       introduction:  { title?: string; durationMinutes?: number; description: string };
       activities:   Array<{ title: string; durationMinutes?: number; description: string }>;
       assessment:    { description: string; method?: string };
       closure:       { description: string };
       homework?:     { description: string };
       differentiation?: { support?: string; extension?: string };
       notes?: string;
     }

   Shape of `settings` (jsonb):
     {
       includeObjectives: boolean;
       includeMaterials: boolean;
       includeVocabulary: boolean;
       includeWarmUp: boolean;
       includeIntroduction: boolean;
       includeActivities: boolean;
       includeAssessment: boolean;
       includeClosure: boolean;
       includeHomework: boolean;
       includeDifferentiation: boolean;
       includeNotes: boolean;
       headerNote?: string;
       footerNote?: string;
     }
*/
export const lessonPlansTable = pgTable("lesson_plans", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  title: text("title").notNull(),
  language: text("language").notNull().default("ar"),
  gradeLevel: text("grade_level"),
  subject: text("subject"),
  durationMinutes: integer("duration_minutes"),
  sections: jsonb("sections").notNull(),
  settings: jsonb("settings").notNull(),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
