-- Isolated classroom motivation ledger. It does not touch AI credits, XP, games, grades, or kids stars.
CREATE TABLE IF NOT EXISTS classroom_reward_types (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  icon TEXT,
  color TEXT,
  default_amount INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classroom_reward_types_teacher_name_uq UNIQUE (teacher_id, name)
);
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS default_amount INTEGER NOT NULL DEFAULT 1;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classroom_reward_types_positive_amount_ck' AND conrelid = 'classroom_reward_types'::regclass) THEN
    ALTER TABLE classroom_reward_types ADD CONSTRAINT classroom_reward_types_positive_amount_ck CHECK (default_amount >= 1) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS classroom_reward_types_teacher_idx ON classroom_reward_types(teacher_id);

CREATE TABLE IF NOT EXISTS classroom_reward_balances (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classroom_reward_balances_owner_student_type_uq UNIQUE (teacher_id, student_id, reward_type_id)
);
ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS classroom_reward_balances_student_idx ON classroom_reward_balances(teacher_id, student_id);

CREATE TABLE IF NOT EXISTS classroom_reward_batches (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  class_name_snapshot TEXT NOT NULL,
  teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL,
  reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
  reason_snapshot TEXT NOT NULL,
  points INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classroom_reward_batches_owner_request_uq UNIQUE (teacher_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS classroom_reward_transactions (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  student_name_snapshot TEXT NOT NULL,
  reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'grant',
  idempotency_key TEXT NOT NULL,
  batch_id INTEGER REFERENCES classroom_reward_batches(id) ON DELETE RESTRICT,
  batch_key TEXT,
  reversal_of_id INTEGER UNIQUE REFERENCES classroom_reward_transactions(id) ON DELETE RESTRICT,
  note TEXT,
  class_name_snapshot TEXT,
  teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL,
  reward_type_name_snapshot TEXT NOT NULL,
  category_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classroom_reward_transactions_owner_request_student_uq UNIQUE (teacher_id, idempotency_key, student_id)
);
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES classroom_reward_batches(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS reason_snapshot TEXT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS points INTEGER;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS target_count INTEGER;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS student_name_snapshot TEXT;
UPDATE classroom_reward_transactions tr SET student_name_snapshot = s.name FROM students s WHERE tr.student_name_snapshot IS NULL AND tr.student_id=s.id;
UPDATE classroom_reward_transactions SET student_name_snapshot = 'طالب محذوف' WHERE student_name_snapshot IS NULL;
ALTER TABLE classroom_reward_transactions ALTER COLUMN student_name_snapshot SET NOT NULL;
ALTER TABLE classroom_reward_transactions ALTER COLUMN student_id DROP NOT NULL;
DO $$ DECLARE fk_name text; BEGIN
  SELECT conname INTO fk_name FROM pg_constraint
  WHERE conrelid='classroom_reward_transactions'::regclass AND contype='f'
    AND confrelid='students'::regclass AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='classroom_reward_transactions'::regclass AND attname='student_id')];
  IF fk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE classroom_reward_transactions DROP CONSTRAINT %I', fk_name); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_transactions_student_set_null_fk' AND conrelid='classroom_reward_transactions'::regclass) THEN
    ALTER TABLE classroom_reward_transactions ADD CONSTRAINT classroom_reward_transactions_student_set_null_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
  END IF;
END $$;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'grant';
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS batch_key TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reversal_of_id INTEGER REFERENCES classroom_reward_transactions(id) ON DELETE RESTRICT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reward_type_name_snapshot TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS category_snapshot TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS classroom_reward_batches_class_idx ON classroom_reward_batches(teacher_id, teacher_class_id);
CREATE INDEX IF NOT EXISTS classroom_reward_transactions_class_created_idx ON classroom_reward_transactions(teacher_id, teacher_class_id, created_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classroom_reward_transactions_amount_kind_ck' AND conrelid = 'classroom_reward_transactions'::regclass) THEN
    ALTER TABLE classroom_reward_transactions ADD CONSTRAINT classroom_reward_transactions_amount_kind_ck CHECK ((kind = 'grant' AND amount >= 1) OR (kind = 'reversal' AND amount <= -1)) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS classroom_reward_transactions_student_created_idx ON classroom_reward_transactions(teacher_id, student_id, created_at);
CREATE INDEX IF NOT EXISTS classroom_reward_transactions_category_created_idx ON classroom_reward_transactions(teacher_id, category_snapshot, created_at);
-- Do not deduplicate a conflicting partial deployment: unique-index creation
-- must fail explicitly rather than silently merging or discarding ledger data.
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_types_owner_name_semantic_uq
  ON classroom_reward_types(teacher_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_balances_owner_student_type_semantic_uq
  ON classroom_reward_balances(teacher_id, student_id, reward_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batches_owner_request_semantic_uq
  ON classroom_reward_batches(teacher_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_owner_request_student_semantic_uq
  ON classroom_reward_transactions(teacher_id, idempotency_key, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_reversal_target_semantic_uq
  ON classroom_reward_transactions(reversal_of_id) WHERE reversal_of_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_reversal_request_uq ON classroom_reward_transactions(teacher_id, idempotency_key) WHERE kind = 'reversal';

CREATE TABLE IF NOT EXISTS classroom_reward_audit_logs (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  idempotency_key TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS classroom_reward_audit_owner_created_idx ON classroom_reward_audit_logs(teacher_id, created_at);