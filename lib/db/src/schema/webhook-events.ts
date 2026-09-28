import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * سجل أحداث Webhook (Lemon Squeezy وغيرها) مع منع التكرار عبر idempotency_key.
 */
export const webhookEventsTable = pgTable("webhook_events", {
  id:                 serial("id").primaryKey(),
  provider:           text("provider").notNull().default("lemonsqueezy"),
  eventName:          text("event_name").notNull(),
  providerObjectType: text("provider_object_type"),
  providerObjectId:   text("provider_object_id"),
  providerEventId:    text("provider_event_id"),
  idempotencyKey:     text("idempotency_key").notNull().unique(),
  /** received | processing | processed | failed | ignored */
  status:             text("status").notNull().default("received"),
  attempts:           integer("attempts").notNull().default(0),
  rawPayload:         text("raw_payload"),
  errorMessage:       text("error_message"),
  reviewEvidence:     jsonb("review_evidence"),
  processedAt:        timestamp("processed_at"),
  failedAt:           timestamp("failed_at"),
  createdAt:          timestamp("created_at").notNull().default(sql`NOW()`),
  updatedAt:          timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type NewWebhookEvent = typeof webhookEventsTable.$inferInsert;
