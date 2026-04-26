import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";
import { adventureGamesTable } from "./adventure-games";

export const contentCollectionsTable = pgTable("content_collections", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").notNull().default(false),
  featuredOn: text("featured_on"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collectionItemsTable = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => contentCollectionsTable.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id, { onDelete: "cascade" }),
  adventureGameId: integer("adventure_game_id").references(() => adventureGamesTable.id, { onDelete: "cascade" }),
  itemOrder: integer("item_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ContentCollection = typeof contentCollectionsTable.$inferSelect;
export type CollectionItem = typeof collectionItemsTable.$inferSelect;
