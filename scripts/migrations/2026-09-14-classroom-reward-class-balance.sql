CREATE TABLE IF NOT EXISTS classroom_reward_class_balances (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_class_balances_class_uq
  ON classroom_reward_class_balances(teacher_id,teacher_class_id);

CREATE TABLE IF NOT EXISTS classroom_reward_class_transactions (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('award','deduct')),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  resulting_balance INTEGER NOT NULL CHECK (resulting_balance >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_class_transactions_owner_request_uq
  ON classroom_reward_class_transactions(teacher_id,idempotency_key);

CREATE INDEX IF NOT EXISTS classroom_reward_class_transactions_class_created_idx
  ON classroom_reward_class_transactions(teacher_id,teacher_class_id,created_at DESC);