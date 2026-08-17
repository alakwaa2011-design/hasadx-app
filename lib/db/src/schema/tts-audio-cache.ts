import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Per-teacher persistent TTS audio cache metadata. The audio itself lives in
 * private Object Storage (storage_key); this table only tracks state.
 *
 * Financial ordering invariant: a row may only become status='ready' AFTER the
 * credit hold referenced by credit_request_id was successfully captured.
 * Serving audio is allowed ONLY from status='ready' rows.
 */
export const ttsAudioCacheTable = pgTable(
  "tts_audio_cache",
  {
    id:              serial("id").primaryKey(),
    teacherId:       integer("teacher_id").notNull(),
    /** sha256 over everything that affects the output (text/voice/model/format/prompt/v) */
    cacheKey:        text("cache_key").notNull(),
    /** internal object-storage path — never exposed to clients */
    storageKey:      text("storage_key"),
    /** idempotency reference of the credit hold for THIS generation cycle.
        Written at pending-row creation, BEFORE the hold is created, so crash
        recovery always has the reference. */
    creditRequestId: text("credit_request_id").notNull(),
    /** pending | ready | failed */
    status:          text("status").notNull().default("pending"),
    sizeBytes:       integer("size_bytes"),
    errorMessage:    text("error_message"),
    createdAt:       timestamp("created_at").notNull().default(sql`NOW()`),
    failedAt:        timestamp("failed_at"),
    lastUsedAt:      timestamp("last_used_at").notNull().default(sql`NOW()`),
  },
  (t) => [unique("tts_audio_cache_teacher_key_uq").on(t.teacherId, t.cacheKey)],
);

/** Single-row state table driving the opportunistic (autoscale-safe) cleanup. */
export const ttsCacheStateTable = pgTable("tts_cache_state", {
  id:            integer("id").primaryKey(),
  lastCleanupAt: timestamp("last_cleanup_at").notNull().default(sql`NOW()`),
});

export type TtsAudioCache = typeof ttsAudioCacheTable.$inferSelect;
