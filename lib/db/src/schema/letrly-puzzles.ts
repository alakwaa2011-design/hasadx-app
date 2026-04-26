import { pgTable, varchar, text, integer, boolean, timestamp, date, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const letrlyPuzzlesTable = pgTable(
  "letrly_puzzles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    pin: varchar("pin", { length: 8 }).unique(),
    creatorTeacherId: integer("creator_teacher_id"),
    word: text("word").notNull(),
    normalized: text("normalized").notNull(),
    hint: text("hint").notNull().default(""),
    length: integer("length").notNull(),
    category: text("category").notNull().default("general"),
    isDaily: boolean("is_daily").notNull().default(false),
    dailyDate: date("daily_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    dailyDateIdx: index("letrly_puzzles_daily_date_idx").on(table.dailyDate),
    creatorIdx: index("letrly_puzzles_creator_idx").on(table.creatorTeacherId),
  })
);
