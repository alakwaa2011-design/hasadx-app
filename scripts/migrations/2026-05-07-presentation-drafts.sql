-- AI Presentation Builder Phase 1A (#457) — outline drafts.
CREATE TABLE IF NOT EXISTS presentation_drafts (
  id              SERIAL PRIMARY KEY,
  teacher_id      INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  presentation_id INTEGER REFERENCES presentations(id) ON DELETE SET NULL,
  brief           JSONB NOT NULL,
  outline         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  build_progress  JSONB,
  model_used      TEXT,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  cost_micro_usd  BIGINT NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentation_drafts_teacher_idx
  ON presentation_drafts(teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS presentation_drafts_status_idx
  ON presentation_drafts(teacher_id, status);
