import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Immutable aliases: shortening never creates rooms or changes game access. */
export const gameShareLinksTable = pgTable("game_share_links", {
  code: text("code").primaryKey(),
  destinationHash: text("destination_hash").notNull().unique(),
  destination: text("destination").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});