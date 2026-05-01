/**
 * Postgres store for express-session (connect-pg-simple).
 * Kept in Drizzle schema so `drizzle-kit push` never proposes dropping this table.
 */
import { index, json, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
  },
  (t) => [index("IDX_session_expire").on(t.expire)],
);
