import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

export const videoLessonsTable = pgTable("video_lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject"),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  videoType: text("video_type").notNull().default("youtube"),
  targetClass: text("target_class"),
  accessMode: text("access_mode").notNull().default("public"),
  accessCode: text("access_code"),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  isPublished: boolean("is_published").notNull().default(true),
  isShared: boolean("is_shared").notNull().default(true),
  hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
  hiddenAt: timestamp("hidden_at"),
  hiddenById: integer("hidden_by_id").references(() => teachersTable.id, { onDelete: "set null" }),
  hideReason: text("hide_reason"),
  skipSegments: text("skip_segments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoLessonSchema = createInsertSchema(videoLessonsTable).omit({ id: true, createdAt: true });
export type InsertVideoLesson = z.infer<typeof insertVideoLessonSchema>;
export type VideoLesson = typeof videoLessonsTable.$inferSelect;
