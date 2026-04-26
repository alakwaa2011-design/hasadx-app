import { pgTable, serial, text, integer, timestamp, bigint, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const teacherLibraryGroupsTable = pgTable(
  "teacher_library_groups",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    teacherNameUnique: uniqueIndex("teacher_library_groups_teacher_name_unique").on(t.teacherId, t.name),
  }),
);

export const teacherLibraryFilesTable = pgTable(
  "teacher_library_files",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => teacherLibraryGroupsTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    fileType: text("file_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    source: text("source").notNull(),
    objectPath: text("object_path"),
    externalUrl: text("external_url"),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    teacherIdx: index("teacher_library_files_teacher_idx").on(t.teacherId),
    objectPathUnique: uniqueIndex("teacher_library_files_object_path_unique").on(t.objectPath),
  }),
);

export const teacherLibraryPendingUploadsTable = pgTable(
  "teacher_library_pending_uploads",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull().unique(),
    expectedSize: bigint("expected_size", { mode: "number" }).notNull(),
    expectedContentType: text("expected_content_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    teacherIdx: index("teacher_library_pending_uploads_teacher_idx").on(t.teacherId),
  }),
);

export type TeacherLibraryGroup = typeof teacherLibraryGroupsTable.$inferSelect;
export type TeacherLibraryFile = typeof teacherLibraryFilesTable.$inferSelect;
