import { pgTable, serial, text, timestamp, integer, real, boolean, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { categoriesTable } from "./categories";
export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject"),
  description: text("description"),
  submissionMode: text("submission_mode").notNull().default("both"),
  accessMode: text("access_mode").notNull().default("public"),
  accessCode: text("access_code"),
  targetClass: text("target_class"),
  targetClasses: text("target_classes").array(),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  showResults: boolean("show_results").notNull().default(true),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  modelImageBase64: text("model_image_base64"),
  totalPoints: real("total_points").notNull().default(0),
  displayTotalPoints: real("display_total_points"),
  deadline: timestamp("deadline"),
  examMode: boolean("exam_mode").notNull().default(false),
  examDurationMinutes: integer("exam_duration_minutes"),
  resultsReleaseMode: text("results_release_mode").notNull().default("immediate"),
  aiGradingInstructions: text("ai_grading_instructions"),
  isShared: boolean("is_shared").notNull().default(true),
  isShareApproved: boolean("is_share_approved").notNull().default(true),
  /** "homework" (default) or "competition". Drives which library this appears in
   *  ("مكتبة الأنشطة" vs "مكتبة المسابقات الجاهزة"). */
  contentKind: text("content_kind").notNull().default("homework"),
  /** When non-null, the row is hidden from public libraries by an admin. */
  hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
  hiddenAt: timestamp("hidden_at"),
  hiddenById: integer("hidden_by_id").references(() => teachersTable.id, { onDelete: "set null" }),
  hideReason: text("hide_reason"),
  /** Origin of this assignment. NULL = created normally by the teacher.
   *  'worksheet' = auto-created behind the scenes to power smart paper
   *  grading for a worksheet; hidden from normal teacher assignment lists. */
  source: text("source"),
  isAdaptive: boolean("is_adaptive").notNull().default(false),
  adaptiveConfig: text("adaptive_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at"),
  closedAt: timestamp("closed_at"),
  extraAttempts: integer("extra_attempts").notNull().default(0),
  /** When created from a presentation activity slide, stores "presId:slideId" so the same
   *  assignment is reused on subsequent plays instead of creating a new one each time. */
  fromPresentationSlide: text("from_presentation_slide"),
  /** Source assignment id when this row was imported from the shared library. */
  importedFromAssignmentId: integer("imported_from_assignment_id"),
  // ─── Listening Activity fields ───────────────────────────────────────────────
  /** "listening" | null — marks this assignment as a listening activity */
  activityType: text("activity_type"),
  /** The full text that gets converted to TTS audio for the student */
  listeningAudioText: text("listening_audio_text"),
  /** TTS voice name (shimmer, alloy, nova, onyx, echo) */
  listeningVoice: text("listening_voice"),
  /** TTS playback speed stored as text (e.g. "1", "1.25") */
  listeningSpeed: text("listening_speed"),
  /** JSON blob: { maxListens, allowSpeedControl, allowSeek, showTranscript } */
  listeningSettings: text("listening_settings"),
}, (t) => ({
  teacherIdx: index("assignments_teacher_idx").on(t.teacherId),
  teacherCreatedIdx: index("assignments_teacher_archive_created_idx").on(t.teacherId, t.archivedAt, t.createdAt),
  categoryIdx: index("assignments_category_idx").on(t.categoryId),
  extraAttemptsRange: check("assignments_extra_attempts_range", sql`${t.extraAttempts} BETWEEN 0 AND 1`),
  // Hot path: shared-library scans filter by contentKind, isShared,
  // hiddenByAdmin, accessMode and order by createdAt DESC. A composite
  // index keyed on (content_kind, created_at desc) with isShared in the
  // leading position keeps the scan covering for both library tabs.
  sharedLibraryIdx: index("assignments_shared_library_idx").on(
    t.isShared, t.hiddenByAdmin, t.contentKind, t.createdAt,
  ),
  importedSourceUniqueIdx: uniqueIndex("assignments_imported_source_unique_idx").on(
    t.teacherId, t.importedFromAssignmentId,
  ),
}));
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  archivedAt: true,
});
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
