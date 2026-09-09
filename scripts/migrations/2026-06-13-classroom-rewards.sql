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
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classroom_reward_transactions_amount_kind_ck'
      AND conrelid = 'classroom_reward_transactions'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%adjustment%'
  ) THEN
    ALTER TABLE classroom_reward_transactions DROP CONSTRAINT classroom_reward_transactions_amount_kind_ck;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classroom_reward_transactions_amount_kind_ck' AND conrelid = 'classroom_reward_transactions'::regclass) THEN
    ALTER TABLE classroom_reward_transactions ADD CONSTRAINT classroom_reward_transactions_amount_kind_ck CHECK ((kind = 'grant' AND amount >= 1) OR (kind IN ('reversal','adjustment') AND amount <= -1)) NOT VALID;
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

-- Automatic rules use only persisted final assignment submissions or completed
-- kids sessions with an explicit students.id linkage. They never touch XP/stars.
CREATE TABLE IF NOT EXISTS classroom_reward_rules (
  id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('assignment_submission','kids_activity_completion','game_history')),
  condition TEXT NOT NULL CHECK (condition IN ('completion','score_at_least')),
  threshold INTEGER, reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount >= 1), category_snapshot TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((condition='completion' AND threshold IS NULL) OR (condition='score_at_least' AND threshold IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS classroom_reward_rules_teacher_source_idx ON classroom_reward_rules(teacher_id,source_type);
CREATE TABLE IF NOT EXISTS classroom_reward_rule_evaluations (
  id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES classroom_reward_rules(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, source_result_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL, detail TEXT, evidence_summary JSONB, transaction_id INTEGER REFERENCES classroom_reward_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT classroom_reward_rule_evaluations_once_uq UNIQUE(rule_id,source_type,source_result_id,student_id)
);
ALTER TABLE classroom_reward_rules ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE classroom_reward_rules SET name = 'قاعدة تلقائية #' || id WHERE name IS NULL;
ALTER TABLE classroom_reward_rules ALTER COLUMN name SET NOT NULL;
DO $$ DECLARE constraint_name TEXT; BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='classroom_reward_rules'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%source_type%' LOOP
    EXECUTE format('ALTER TABLE classroom_reward_rules DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;
ALTER TABLE classroom_reward_rules DROP CONSTRAINT IF EXISTS classroom_reward_rules_source_ck;
ALTER TABLE classroom_reward_rules ADD CONSTRAINT classroom_reward_rules_source_ck CHECK (source_type IN ('assignment_submission','kids_activity_completion','game_history'));
ALTER TABLE classroom_reward_rule_evaluations ADD COLUMN IF NOT EXISTS evidence_summary JSONB;
ALTER TABLE classroom_reward_rule_evaluations ADD COLUMN IF NOT EXISTS rule_name_snapshot TEXT;
UPDATE classroom_reward_rule_evaluations e SET rule_name_snapshot=r.name FROM classroom_reward_rules r WHERE e.rule_name_snapshot IS NULL AND e.rule_id=r.id;
UPDATE classroom_reward_rule_evaluations SET rule_name_snapshot='قاعدة محذوفة' WHERE rule_name_snapshot IS NULL;
ALTER TABLE classroom_reward_rule_evaluations ALTER COLUMN rule_name_snapshot SET NOT NULL;
ALTER TABLE classroom_reward_rule_evaluations DROP CONSTRAINT IF EXISTS classroom_reward_rule_evaluations_once_uq;
DROP INDEX IF EXISTS classroom_reward_rule_evaluations_once_uq;
ALTER TABLE classroom_reward_rule_evaluations ADD CONSTRAINT classroom_reward_rule_evaluations_once_uq UNIQUE(rule_id,source_type,source_result_id,student_id);
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS source_result_id INTEGER;
ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS rule_id INTEGER;
CREATE INDEX IF NOT EXISTS classroom_reward_transactions_source_idx ON classroom_reward_transactions(teacher_id,source_type,source_result_id);
CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_suggestion_evidence_uq ON classroom_reward_transactions(teacher_id, source_result_id) WHERE source_type = 'reward_suggestion_submission' AND kind = 'grant';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE game_history DROP CONSTRAINT IF EXISTS game_history_teacher_pin_uq;
DROP INDEX IF EXISTS game_history_teacher_pin_uq;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS game_run_id TEXT;
ALTER TABLE game_history ALTER COLUMN assignment_id DROP NOT NULL;
UPDATE game_history SET game_run_id='legacy:' || id WHERE game_run_id IS NULL;
ALTER TABLE game_history ALTER COLUMN game_run_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS game_history_game_run_uq ON game_history(game_run_id);