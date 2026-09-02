import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const trustedDevicesTable = pgTable(
  "trusted_devices",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    fingerprintHash: text("fingerprint_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    revokeTokenHash: text("revoke_token_hash"),
    revokeTokenExpiresAt: timestamp("revoke_token_expires_at"),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (t) => ({
    teacherFpIdx: uniqueIndex("trusted_devices_teacher_fp_idx").on(t.teacherId, t.fingerprintHash),
  }),
);

export type TrustedDevice = typeof trustedDevicesTable.$inferSelect;
