ALTER TABLE classroom_reward_groups
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS classroom_reward_group_score_receipts (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES classroom_reward_groups(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  points INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_group_score_receipts_owner_request_uq
  ON classroom_reward_group_score_receipts(teacher_id, idempotency_key);
CREATE INDEX IF NOT EXISTS classroom_reward_group_score_receipts_group_idx
  ON classroom_reward_group_score_receipts(teacher_id, group_id);