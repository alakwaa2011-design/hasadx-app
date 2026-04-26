import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const activityTypeEnum = pgEnum("activity_type", [
  "game_flags",
  "game_color",
  "game_memory",
  "game_multiply",
  "game_scramble",
  "game_tug",
  "game_capitals",
  "game_adventure",
  "assignment",
  "video_lesson",
]);

export const sectionsTable = pgTable("sections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  icon: text("icon").notNull().default("Folder"),
  color: text("color").notNull().default("#0d6b75"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subSectionsTable = pgTable("sub_sections", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  icon: text("icon").notNull().default("FolderOpen"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activitySectionMapTable = pgTable("activity_section_map", {
  id: serial("id").primaryKey(),
  activityType: activityTypeEnum("activity_type").notNull(),
  activityId: text("activity_id").notNull(),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id, { onDelete: "cascade" }),
  subSectionId: integer("sub_section_id").references(() => subSectionsTable.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Section = typeof sectionsTable.$inferSelect;
export type SubSection = typeof subSectionsTable.$inferSelect;
export type ActivitySectionMap = typeof activitySectionMapTable.$inferSelect;
