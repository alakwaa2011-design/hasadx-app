import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

/* Wheel of Fortune (عجلة الحظ) — teacher-driven classroom game.
   The teacher spins a wheel on the class display, the wheel lands on a
   "segment" (most are questions, a few may be bonus actions), the teacher
   reads the question to the class, students answer aloud, and the teacher
   awards the points to a team. Templates are saved per teacher and can be
   shared by admins.

   Shape of `segments` (jsonb):
     Array<{
       id: string;                    // stable id within the wheel
       text: string;                  // question text (or bonus title)
       answer?: string;               // correct answer the teacher reveals
       explanation?: string;          // optional teaching note
       points: number;                // 50 | 100 | 200 | 300 | 500
       color?: string;                // hex; auto-assigned if missing
       kind: "question" | "bonus";    // question = normal, bonus = special
       bonusType?: "double" | "skip" | "swap" | "lucky" | "lose";
     }>

   Shape of `config` (jsonb):
     {
       teamCount: number;             // 2..6
       teamNames: string[];           // length === teamCount
       spinSeconds: number;           // 4..8, default 5
       soundOn: boolean;              // tick + win sounds
     }
*/
export const wheelTemplatesTable = pgTable("wheel_templates", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  title: text("title").notNull(),
  language: text("language").notNull().default("ar"),
  gradeLevel: text("grade_level"),
  subject: text("subject"),
  segments: jsonb("segments").notNull(),
  config: jsonb("config").notNull(),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
