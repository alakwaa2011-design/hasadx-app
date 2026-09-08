import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { aiVideoProjectsTable } from "./ai-video-projects";

export const aiVideoProviderRequestsTable = pgTable("ai_video_provider_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => aiVideoProjectsTable.id, { onDelete: "cascade" }),
  sceneIndex: integer("scene_index").notNull(),
  storyboardHash: text("storyboard_hash").notNull(),
  providerModel: text("provider_model").notNull(),
  trackingModel: text("tracking_model").notNull(),
  requestId: text("request_id"),
  state: text("state").notNull().default("intent"),
  renderLeaseId: text("render_lease_id").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ai_video_provider_requests_identity_uq")
    .on(table.projectId, table.sceneIndex, table.storyboardHash),
  index("ai_video_provider_requests_project_idx").on(table.projectId, table.createdAt),
]);

export type AiVideoProviderRequest = typeof aiVideoProviderRequestsTable.$inferSelect;