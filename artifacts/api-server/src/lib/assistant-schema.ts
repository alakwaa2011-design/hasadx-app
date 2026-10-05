import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Additive startup migration; preserves all existing Guide and worksheet data. */
export async function migrateAssistantSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS assistant_configuration (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      pilot_only BOOLEAN NOT NULL DEFAULT TRUE,
      teacher_ids INTEGER[] NOT NULL DEFAULT '{}'
    );
    INSERT INTO assistant_configuration (id) VALUES (1) ON CONFLICT DO NOTHING;
    ALTER TABLE assistant_configuration ADD COLUMN IF NOT EXISTS pilot_only BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE assistant_configuration ADD COLUMN IF NOT EXISTS teacher_ids INTEGER[] NOT NULL DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS assistant_worksheet_operations (
      id UUID PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      request_text TEXT NOT NULL,
      reply TEXT NOT NULL,
      parameters JSONB NOT NULL,
      template TEXT NOT NULL DEFAULT 'geometric',
      messages JSONB NOT NULL,
      missing_fields JSONB NOT NULL,
      quote JSONB,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','quoted','queued','running','saving','completed','failed','cancelled')),
      credits INTEGER NOT NULL DEFAULT 0,
      held BOOLEAN NOT NULL DEFAULT FALSE,
      credit_request_id TEXT NOT NULL UNIQUE,
      output JSONB,
      worksheet_id INTEGER REFERENCES worksheets(id) ON DELETE SET NULL,
      error_code TEXT,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      lease_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS assistant_operations_teacher_history
      ON assistant_worksheet_operations(teacher_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS assistant_operations_queue
      ON assistant_worksheet_operations(status, lease_until);
  `);
}
