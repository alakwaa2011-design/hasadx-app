import "./instrument";
import { createServer } from "http";
import { Server } from "socket.io";
import { setRealtimeServer } from "./lib/realtime";
import app, { sessionMiddleware, ensureSessionTable, corsOriginFn } from "./app";
import { logger } from "./lib/logger";
import { setupGameSocket } from "./game/socket-handlers";
import { setupWhiteboardSocket } from "./game/whiteboard-handlers";
import { setupTugSocket } from "./game/tug-handlers";
import { setupXoSocket } from "./game/xo-handlers";
import { setupRocketSocket } from "./game/rocket-handlers";
import { setupFlagSocket } from "./game/flag-socket-handlers";
import { setupColorSocket } from "./game/color-socket-handlers";
import { setupVideoSocket } from "./game/video-socket-handlers";
import { setupScrambleSocket } from "./game/scramble-socket-handlers";
import { setupEscapeSocket } from "./game/escape-handlers";
import { setupCapitalSocket } from "./game/capital-socket-handlers";
import { setupMillionTeamSocket } from "./game/million-team-handlers";
import { setupMillionClassSocket } from "./game/million-class-handlers";
import { setupArenaSocket } from "./game/arena-handlers";
import { setupHotSeatSocket } from "./game/hotseat-handlers";
import { setupSecretGameSocket } from "./game/secret-game-handlers";
import { seedSecretGameIfNeeded } from "./seedSecretGame";
import { setupPresentationSocket } from "./game/presentation-handlers";
import { db, teachersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { seedMillionBankIfEmpty } from "./seedMillionBank";
import { seedIslamicIfNeeded } from "./seedIslamic";
import { seedIslamicExtraIfNeeded } from "./seedIslamicExtra";
import { seedIslamicLevelsIfNeeded } from "./seedIslamicLevels";
import { seedTaarifAyatShortIfNeeded } from "./seedTaarifAyatShort";
import { seedIstihdarAyatIfNeeded } from "./seedIstihdarAyat";
import { seedPlansIfMissing } from "./seedPlans";
import { seedArenaContentIfNeeded } from "./seedArenaContent";
import { seedStaticArenaIfNeeded } from "./seedStaticArena";
import { startPasswordResetCleanupJob } from "./lib/password-reset-cleanup";
import { startLibraryOrphanSweepJob } from "./lib/library-orphan-sweep";
import { startActivityLogsCleanupJob } from "./lib/activity-logger";
import { startOnlineSessionsCleanupJob } from "./lib/analytics";
import { XP_MIGRATION_SQL } from "@workspace/db";
import { seedXpDefaultsIfNeeded } from "./lib/xp/seed";
import { bindXpSocket } from "./lib/xp/socket";
import { startEmailOutboxWorker } from "./lib/xp/email-worker";
import { startMissingWelcomeCreditsAlertJob } from "./lib/welcome-credits-alert";
import { startAnnualCreditReleaseJob } from "./lib/annual-credit-release";
import { CONFIGURED_ADMIN_EMAILS } from "./lib/admin-identity";
import { migrateKidsSchema, seedKidsCatalogV1 } from "./kids-catalog";
import { setKidsReady } from "./routes/kids";

async function runSchemaMigrations() {
  try {
    await migrateKidsSchema();
    // Assignment history is also applied at runtime for deployments that do
    // not run the reviewed SQL files during boot.
    await db.execute(sql`
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS extra_attempts INTEGER NOT NULL DEFAULT 0;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'assignments_extra_attempts_range'
        ) THEN
          ALTER TABLE assignments
            ADD CONSTRAINT assignments_extra_attempts_range CHECK (extra_attempts BETWEEN 0 AND 1);
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS assignment_revisions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        source_version INTEGER NOT NULL,
        settings JSONB NOT NULL,
        questions JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS assignment_revisions_assignment_created_idx
        ON assignment_revisions (assignment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS assignment_revisions_teacher_idx
        ON assignment_revisions (teacher_id);
    `);
    // Classroom motivation ledger. Kept here as an idempotent runtime migration for
    // deployed databases; the matching reviewed SQL migration lives in scripts/migrations.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(84291173)`);
      await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS classroom_reward_types (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general', description TEXT, icon TEXT, color TEXT,
        default_amount INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_types_teacher_name_uq UNIQUE (teacher_id,name)
      );
      CREATE TABLE IF NOT EXISTS classroom_reward_balances (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
        balance INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_balances_owner_student_type_uq UNIQUE (teacher_id,student_id,reward_type_id)
      );
      CREATE TABLE IF NOT EXISTS classroom_reward_batches (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL, class_name_snapshot TEXT NOT NULL, teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL,
        reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
        reason_snapshot TEXT NOT NULL, points INTEGER NOT NULL,
        target_count INTEGER NOT NULL, request_fingerprint TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_batches_owner_request_uq UNIQUE (teacher_id,idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS classroom_reward_transactions (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL, student_name_snapshot TEXT NOT NULL,
        reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'grant', idempotency_key TEXT NOT NULL, batch_id INTEGER REFERENCES classroom_reward_batches(id) ON DELETE RESTRICT, batch_key TEXT,
        reversal_of_id INTEGER UNIQUE REFERENCES classroom_reward_transactions(id) ON DELETE RESTRICT, note TEXT,
        class_name_snapshot TEXT, teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL, reward_type_name_snapshot TEXT NOT NULL, category_snapshot TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_transactions_owner_request_student_uq UNIQUE (teacher_id,idempotency_key,student_id)
      );
      CREATE TABLE IF NOT EXISTS classroom_reward_audit_logs (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, idempotency_key TEXT, detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS icon TEXT;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS color TEXT;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS default_amount INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE classroom_reward_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
      ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classroom_reward_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS reason_snapshot TEXT;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS points INTEGER;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS target_count INTEGER;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
      ALTER TABLE classroom_reward_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS student_name_snapshot TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE RESTRICT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'grant';
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES classroom_reward_batches(id) ON DELETE RESTRICT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS batch_key TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reversal_of_id INTEGER REFERENCES classroom_reward_transactions(id) ON DELETE RESTRICT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS reward_type_name_snapshot TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS category_snapshot TEXT;
      ALTER TABLE classroom_reward_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS entity_id INTEGER;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS detail TEXT;
      ALTER TABLE classroom_reward_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      UPDATE classroom_reward_transactions tr SET student_name_snapshot=s.name FROM students s WHERE tr.student_name_snapshot IS NULL AND tr.student_id=s.id;
      UPDATE classroom_reward_transactions SET student_name_snapshot='طالب محذوف' WHERE student_name_snapshot IS NULL;
      ALTER TABLE classroom_reward_transactions ALTER COLUMN student_name_snapshot SET NOT NULL;
      ALTER TABLE classroom_reward_transactions ALTER COLUMN student_id DROP NOT NULL;
      DO $$ DECLARE fk_name TEXT; BEGIN
        SELECT conname INTO fk_name FROM pg_constraint
        WHERE conrelid='classroom_reward_transactions'::regclass AND contype='f' AND confrelid='students'::regclass
          AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='classroom_reward_transactions'::regclass AND attname='student_id')];
        IF fk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE classroom_reward_transactions DROP CONSTRAINT %I',fk_name); END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_transactions_student_set_null_fk' AND conrelid='classroom_reward_transactions'::regclass) THEN
          ALTER TABLE classroom_reward_transactions ADD CONSTRAINT classroom_reward_transactions_student_set_null_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_types_positive_amount_ck' AND conrelid='classroom_reward_types'::regclass) THEN
          ALTER TABLE classroom_reward_types ADD CONSTRAINT classroom_reward_types_positive_amount_ck CHECK (default_amount >= 1) NOT VALID;
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname='classroom_reward_transactions_amount_kind_ck'
            AND conrelid='classroom_reward_transactions'::regclass
            AND pg_get_constraintdef(oid) NOT LIKE '%adjustment%'
        ) THEN
          ALTER TABLE classroom_reward_transactions DROP CONSTRAINT classroom_reward_transactions_amount_kind_ck;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classroom_reward_transactions_amount_kind_ck' AND conrelid='classroom_reward_transactions'::regclass) THEN
          ALTER TABLE classroom_reward_transactions ADD CONSTRAINT classroom_reward_transactions_amount_kind_ck CHECK ((kind='grant' AND amount >= 1) OR (kind IN ('reversal','adjustment') AND amount <= -1)) NOT VALID;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS classroom_reward_types_teacher_idx ON classroom_reward_types(teacher_id);
      CREATE INDEX IF NOT EXISTS classroom_reward_balances_student_idx ON classroom_reward_balances(teacher_id,student_id);
      CREATE INDEX IF NOT EXISTS classroom_reward_transactions_student_created_idx ON classroom_reward_transactions(teacher_id,student_id,created_at);
      CREATE INDEX IF NOT EXISTS classroom_reward_transactions_category_created_idx ON classroom_reward_transactions(teacher_id,category_snapshot,created_at);
      CREATE INDEX IF NOT EXISTS classroom_reward_batches_class_idx ON classroom_reward_batches(teacher_id,teacher_class_id);
      CREATE INDEX IF NOT EXISTS classroom_reward_transactions_class_created_idx ON classroom_reward_transactions(teacher_id,teacher_class_id,created_at);
      CREATE TABLE IF NOT EXISTS classroom_reward_groups (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE classroom_reward_groups ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE classroom_reward_groups ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
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
        ON classroom_reward_group_score_receipts(teacher_id,idempotency_key);
      CREATE INDEX IF NOT EXISTS classroom_reward_group_score_receipts_group_idx
        ON classroom_reward_group_score_receipts(teacher_id,group_id);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_groups_class_name_uq ON classroom_reward_groups(teacher_id,teacher_class_id,name);
      CREATE INDEX IF NOT EXISTS classroom_reward_groups_class_idx ON classroom_reward_groups(teacher_id,teacher_class_id);
      CREATE TABLE IF NOT EXISTS classroom_reward_group_members (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES classroom_reward_groups(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_group_members_group_student_uq ON classroom_reward_group_members(group_id,student_id);
      CREATE INDEX IF NOT EXISTS classroom_reward_group_members_teacher_student_idx ON classroom_reward_group_members(teacher_id,student_id);
      CREATE TABLE IF NOT EXISTS classroom_reward_goals (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        skill TEXT NOT NULL DEFAULT 'هدف أكاديمي',
        target_points INTEGER NOT NULL CHECK (target_points > 0),
        reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE SET NULL,
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS classroom_reward_goals_class_idx ON classroom_reward_goals(teacher_id,teacher_class_id,is_active);
      CREATE INDEX IF NOT EXISTS classroom_reward_goals_student_idx ON classroom_reward_goals(teacher_id,student_id,is_active);
      ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS skill TEXT;
      ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS reward_type_id INTEGER REFERENCES classroom_reward_types(id) ON DELETE SET NULL;
      ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE classroom_reward_goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      UPDATE classroom_reward_goals SET skill=COALESCE(NULLIF(skill,''),title),is_active=(status='active') WHERE skill IS NULL OR skill='' OR is_active<>(status='active');
      ALTER TABLE classroom_reward_goals ALTER COLUMN skill SET DEFAULT 'هدف أكاديمي';
      ALTER TABLE classroom_reward_goals ALTER COLUMN skill SET NOT NULL;
      -- Do not deduplicate a conflicting partial deployment: unique-index creation
      -- must fail explicitly rather than silently merging or discarding ledger data.
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_types_owner_name_semantic_uq
        ON classroom_reward_types(teacher_id,name);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_balances_owner_student_type_semantic_uq
        ON classroom_reward_balances(teacher_id,student_id,reward_type_id);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batches_owner_request_semantic_uq
        ON classroom_reward_batches(teacher_id,idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_owner_request_student_semantic_uq
        ON classroom_reward_transactions(teacher_id,idempotency_key,student_id);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_reversal_target_semantic_uq
        ON classroom_reward_transactions(reversal_of_id) WHERE reversal_of_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_reversal_request_uq ON classroom_reward_transactions(teacher_id,idempotency_key) WHERE kind='reversal';
      CREATE INDEX IF NOT EXISTS classroom_reward_audit_owner_created_idx ON classroom_reward_audit_logs(teacher_id,created_at);
      CREATE INDEX IF NOT EXISTS classroom_reward_goals_owner_class_idx ON classroom_reward_goals(teacher_id,teacher_class_id);
      CREATE INDEX IF NOT EXISTS classroom_reward_goals_owner_status_idx ON classroom_reward_goals(teacher_id,status);
      CREATE TABLE IF NOT EXISTS classroom_reward_batch_reversals (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        batch_id INTEGER NOT NULL REFERENCES classroom_reward_batches(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batch_reversals_owner_key_uq ON classroom_reward_batch_reversals(teacher_id,idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_batch_reversals_owner_batch_uq ON classroom_reward_batch_reversals(teacher_id,batch_id);
      `);
    });
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS classroom_reward_rules (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, name TEXT NOT NULL,
        source_type TEXT NOT NULL, condition TEXT NOT NULL, threshold INTEGER,
        reward_type_id INTEGER NOT NULL REFERENCES classroom_reward_types(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL, category_snapshot TEXT NOT NULL, is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_rules_source_ck CHECK (source_type IN ('assignment_submission','kids_activity_completion','game_history')),
        CONSTRAINT classroom_reward_rules_condition_ck CHECK (condition IN ('completion','score_at_least')),
        CONSTRAINT classroom_reward_rules_amount_ck CHECK (amount >= 1),
        CONSTRAINT classroom_reward_rules_threshold_ck CHECK ((condition='completion' AND threshold IS NULL) OR (condition='score_at_least' AND threshold IS NOT NULL))
      );
      CREATE TABLE IF NOT EXISTS classroom_reward_rule_evaluations (
        id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        rule_id INTEGER NOT NULL REFERENCES classroom_reward_rules(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL, source_result_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        outcome TEXT NOT NULL, detail TEXT, evidence_summary JSONB,
        transaction_id INTEGER REFERENCES classroom_reward_transactions(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT classroom_reward_rule_evaluations_once_uq UNIQUE(rule_id,source_type,source_result_id,student_id)
      );
      ALTER TABLE classroom_reward_rules ADD COLUMN IF NOT EXISTS name TEXT;
      UPDATE classroom_reward_rules SET name='قاعدة تلقائية #' || id WHERE name IS NULL;
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
      CREATE INDEX IF NOT EXISTS classroom_reward_rules_teacher_source_idx ON classroom_reward_rules(teacher_id,source_type);
      CREATE INDEX IF NOT EXISTS classroom_reward_transactions_source_idx ON classroom_reward_transactions(teacher_id,source_type,source_result_id);
      CREATE UNIQUE INDEX IF NOT EXISTS classroom_reward_transactions_suggestion_evidence_uq ON classroom_reward_transactions(teacher_id,source_result_id) WHERE source_type='reward_suggestion_submission' AND kind='grant';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE game_history DROP CONSTRAINT IF EXISTS game_history_teacher_pin_uq;
      DROP INDEX IF EXISTS game_history_teacher_pin_uq;
      ALTER TABLE game_history ADD COLUMN IF NOT EXISTS game_run_id TEXT;
      ALTER TABLE game_history ALTER COLUMN assignment_id DROP NOT NULL;
      UPDATE game_history SET game_run_id='legacy:' || id WHERE game_run_id IS NULL;
      ALTER TABLE game_history ALTER COLUMN game_run_id SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS game_history_game_run_uq ON game_history(game_run_id);
    `);
    await db.execute(sql`
      ALTER TABLE adaptive_sessions
        ADD COLUMN IF NOT EXISTS completion_reason TEXT,
        ADD COLUMN IF NOT EXISTS last_question_id INTEGER,
        ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_question_started_at TIMESTAMP
    `);
    // ── Persistent per-teacher TTS audio cache (metadata only; audio in Object Storage) ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tts_audio_cache (
        id                SERIAL PRIMARY KEY,
        teacher_id        INTEGER NOT NULL,
        cache_key         TEXT NOT NULL,
        storage_key       TEXT,
        credit_request_id TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        size_bytes        INTEGER,
        error_message     TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        failed_at         TIMESTAMP,
        last_used_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT tts_audio_cache_teacher_key_uq UNIQUE (teacher_id, cache_key)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tts_cache_state (
        id              INTEGER PRIMARY KEY,
        last_cleanup_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO tts_cache_state (id, last_cleanup_at)
      VALUES (1, NOW() - INTERVAL '25 hours')
      ON CONFLICT (id) DO NOTHING
    `);
    // ── Direct messages: image attachments ──
    await db.execute(sql`
      ALTER TABLE direct_messages
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS feedback_id INTEGER REFERENCES feedback(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'general'
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS direct_messages_feedback_idx ON direct_messages(feedback_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS direct_messages_recipient_unread_idx
        ON direct_messages(recipient_id, read_at)
    `);
    await db.execute(sql`
      ALTER TABLE feedback
        ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS response_email_ref_key VARCHAR(100)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS feedback_teacher_idx ON feedback(teacher_id)
    `);
    await db.execute(sql`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT
    `);
    // ── Hasaad Guide: hand a teacher conversation to human support ──
    await db.execute(sql`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS support_status TEXT NOT NULL DEFAULT 'ai',
        ADD COLUMN IF NOT EXISTS support_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS support_admin_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS conversations_support_status_updated_idx
        ON conversations(support_status, updated_at DESC)
    `);
    // ── Unified analytics & presence (task: realtime analytics) ──
    await db.execute(sql`
      ALTER TABLE activity_logs
        ADD COLUMN IF NOT EXISTS event_category TEXT,
        ADD COLUMN IF NOT EXISTS session_id TEXT,
        ADD COLUMN IF NOT EXISTS ip_hash TEXT
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS activity_logs_category_idx ON activity_logs(event_category)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS activity_logs_session_idx ON activity_logs(session_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS online_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        user_id INTEGER,
        user_role TEXT NOT NULL DEFAULT 'visitor',
        user_name TEXT,
        page TEXT,
        device TEXT,
        browser TEXT,
        ip_hash TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS online_sessions_heartbeat_idx ON online_sessions(last_heartbeat_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS online_sessions_role_idx ON online_sessions(user_role)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS online_sessions_user_idx ON online_sessions(user_id)
    `);

    await db.execute(sql`
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
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS presentation_drafts_teacher_idx
        ON presentation_drafts(teacher_id, created_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS presentation_drafts_status_idx
        ON presentation_drafts(teacher_id, status)
    `);
    await db.execute(sql`
      ALTER TABLE ai_usage_daily
        ADD COLUMN IF NOT EXISTS outline_count INTEGER NOT NULL DEFAULT 0
    `);
    // ── Detailed AI provider-cost ledger ────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_usage_ledger (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        request_id TEXT NOT NULL,
        call_key TEXT NOT NULL,
        tool_key TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        modality TEXT NOT NULL CHECK (modality IN ('text', 'audio', 'image')),
        status TEXT NOT NULL DEFAULT 'started'
          CHECK (status IN ('started', 'succeeded', 'failed', 'cached')),
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        usage_quantity INTEGER,
        usage_unit TEXT,
        cost_micro_usd BIGINT,
        cost_source TEXT NOT NULL DEFAULT 'unavailable'
          CHECK (cost_source IN ('provider', 'estimated', 'unavailable')),
        error_code TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (teacher_id, request_id, call_key)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_usage_ledger_completed_at_idx ON ai_usage_ledger(completed_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_usage_ledger_provider_model_idx ON ai_usage_ledger(provider, model, completed_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_usage_ledger_tool_completed_idx ON ai_usage_ledger(tool_key, completed_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_usage_ledger_teacher_completed_idx ON ai_usage_ledger(teacher_id, completed_at)`);
    await db.execute(sql`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS account_username TEXT,
        ADD COLUMN IF NOT EXISTS student_account_id INTEGER,
        ADD COLUMN IF NOT EXISTS avatar TEXT
    `);
    await db.execute(sql`
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS target_classes TEXT[]
    `);
    await db.execute(sql`
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS version INTEGER,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
    `);
    await db.execute(sql`
      UPDATE assignments
      SET updated_at = COALESCE(updated_at, created_at, NOW()),
          version = COALESCE(version, 1)
      WHERE updated_at IS NULL OR version IS NULL
    `);
    await db.execute(sql`
      ALTER TABLE assignments
        ALTER COLUMN updated_at SET DEFAULT NOW(),
        ALTER COLUMN updated_at SET NOT NULL,
        ALTER COLUMN version SET DEFAULT 1,
        ALTER COLUMN version SET NOT NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS assignments_teacher_archive_created_idx
        ON assignments (teacher_id, archived_at, created_at DESC)
    `);
    // Composite index for the kind-filtered shared-library hot path
    // (task #595). Covers WHERE is_shared=true AND hidden_by_admin=false
    // AND content_kind=? ORDER BY created_at DESC.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS assignments_shared_library_idx
        ON assignments (is_shared, hidden_by_admin, content_kind, created_at DESC)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS class_custom_columns (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        applied_to TEXT NOT NULL DEFAULT '*',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS student_custom_grades (
        id SERIAL PRIMARY KEY,
        column_id INTEGER NOT NULL REFERENCES class_custom_columns(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        value TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE tug_templates
        ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS source TEXT
    `);
    await db.execute(sql`
      ALTER TABLE million_class_sessions
        ADD COLUMN IF NOT EXISTS question_count INTEGER NOT NULL DEFAULT 15,
        ADD COLUMN IF NOT EXISTS points_scheme TEXT NOT NULL DEFAULT 'even',
        ADD COLUMN IF NOT EXISTS base_points INTEGER NOT NULL DEFAULT 100
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rocket_templates (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        title TEXT NOT NULL,
        questions JSONB NOT NULL,
        duration INTEGER NOT NULL DEFAULT 20,
        is_shared BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wheel_templates (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        title TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ar',
        grade_level TEXT,
        subject TEXT,
        segments JSONB NOT NULL,
        config JSONB NOT NULL,
        is_shared BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS worksheets (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        client_request_id TEXT,
        title TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ar',
        grade_level TEXT,
        subject TEXT,
        questions JSONB NOT NULL,
        settings JSONB NOT NULL,
        is_shared BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE worksheets
        ADD COLUMN IF NOT EXISTS linked_assignment_id INTEGER,
        ADD COLUMN IF NOT EXISTS client_request_id TEXT
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS worksheets_teacher_client_request_uidx
        ON worksheets(teacher_id, client_request_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lesson_plans (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        client_request_id TEXT,
        title TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ar',
        grade_level TEXT,
        subject TEXT,
        duration_minutes INTEGER,
        sections JSONB NOT NULL,
        settings JSONB NOT NULL,
        is_shared BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE lesson_plans
        ADD COLUMN IF NOT EXISTS client_request_id TEXT
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS lesson_plans_teacher_client_request_uidx
        ON lesson_plans(teacher_id, client_request_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS islamic_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        question_id INTEGER REFERENCES islamic_questions(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES islamic_categories(id) ON DELETE SET NULL,
        session_id TEXT,
        time_taken REAL,
        is_correct BOOLEAN,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS islamic_events_user_idx ON islamic_events(user_id, created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS islamic_events_session_idx ON islamic_events(session_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS islamic_events_type_idx ON islamic_events(event_type, created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS islamic_events_category_idx ON islamic_events(category_id, created_at)`);
    // Reveal/self-assessment questions retain the legacy MCQ columns for
    // backwards compatibility; question_type determines how they are played.
    await db.execute(sql`
      ALTER TABLE islamic_questions
        ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'mcq',
        ADD COLUMN IF NOT EXISTS source_url TEXT,
        ADD COLUMN IF NOT EXISTS source_name TEXT
    `);
    // Ensure teachers.role column exists, then backfill from is_admin so legacy
    // admin accounts get role='admin' instead of the default 'teacher'.
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'teacher'
    `);
    await db.execute(sql`
      UPDATE teachers
        SET role = 'admin'
        WHERE is_admin = true AND role <> 'admin'
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name TEXT,
        user_role TEXT NOT NULL DEFAULT 'visitor',
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        device TEXT,
        browser TEXT,
        page_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs (user_id, user_role)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs (action)`);
    /* Arena Challenge — admin-controlled per-source toggles for the
       category editor (manual / AI / homework / file). Defaults match
       DEFAULT_ARENA_IMPORT_SOURCES in the Drizzle schema. */
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS arena_import_sources JSONB NOT NULL
        DEFAULT '{"manual":true,"ai":true,"homework":true,"file":true}'::jsonb
    `);
    /* Backfill: any existing row that still has homework/file=false from
       the original defaults gets flipped on so organisers see the buttons.
       Admins can still toggle them off from the admin panel. */
    await db.execute(sql`
      UPDATE platform_settings
        SET arena_import_sources = arena_import_sources
          || '{"homework":true,"file":true}'::jsonb
        WHERE (arena_import_sources->>'homework')::boolean IS DISTINCT FROM TRUE
           OR (arena_import_sources->>'file')::boolean IS DISTINCT FROM TRUE
    `);
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS teacher_xp_rewards_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS show_public_stats BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS public_stats_override JSONB
    `);
    await db.execute(sql`
      ALTER TABLE teacher_stats
        ADD COLUMN IF NOT EXISTS display_level_override INTEGER
    `);
    await db.execute(sql`
      ALTER TABLE video_lessons
        ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS hidden_by_id INTEGER REFERENCES teachers(id),
        ADD COLUMN IF NOT EXISTS hide_reason TEXT,
        ADD COLUMN IF NOT EXISTS teacher_class_id INTEGER REFERENCES teacher_classes(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS skip_segments TEXT
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seed_completions (
        key          TEXT PRIMARY KEY,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // OTP verification columns for teacher account verification flow.
    // Legacy accounts keep verificationOtp=NULL and emailVerified=false (soft-nudge only).
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS verification_otp   TEXT,
        ADD COLUMN IF NOT EXISTS otp_expires_at     TIMESTAMP,
        ADD COLUMN IF NOT EXISTS verified_at        TIMESTAMP,
        ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // One-click email verification token (complement to OTP; same TTL, single-use).
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS email_verify_token            TEXT,
        ADD COLUMN IF NOT EXISTS email_verify_token_expires_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS school_logo TEXT
    `);
    // ── Credits system — platform_settings columns ────────────────────────────
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS credits_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS welcome_credits       INTEGER NOT NULL DEFAULT 120,
        ADD COLUMN IF NOT EXISTS admin_credit_test_mode BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pricing_page_visible  BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // توحيد welcome_credits على 50 — آمن ومكرر التنفيذ: يُصحّح القيمة الافتراضية القديمة فقط
    await db.execute(sql`
      UPDATE platform_settings SET welcome_credits = 50 WHERE welcome_credits = 120
    `);
    // استخدام غير محدود بدون خصم — per-teacher override
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS unlimited_credits BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // روابط وسائل التواصل الاجتماعي
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    // نظام منظم المسابقات — إخفاء/إظهار
    await db.execute(sql`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS organizer_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await db.execute(sql`
      UPDATE platform_settings
      SET social_links = '[{"id":"instagram","url":"https://www.instagram.com/hasaadxapp","enabled":true,"order":1},{"id":"twitter","url":"","enabled":false,"order":2},{"id":"facebook","url":"","enabled":false,"order":3},{"id":"tiktok","url":"","enabled":false,"order":4},{"id":"youtube","url":"","enabled":false,"order":5},{"id":"snapchat","url":"","enabled":false,"order":6},{"id":"threads","url":"","enabled":false,"order":7},{"id":"linkedin","url":"","enabled":false,"order":8},{"id":"whatsapp","url":"","enabled":false,"order":9}]'::jsonb
      WHERE jsonb_array_length(social_links) = 0
    `);
    // ── Mind maps — teacher-owned saved mind maps ────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mind_maps (
        id          SERIAL PRIMARY KEY,
        teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        client_request_id TEXT,
        title       TEXT NOT NULL,
        topic       TEXT NOT NULL,
        language    TEXT NOT NULL DEFAULT 'ar',
        depth       TEXT NOT NULL DEFAULT 'standard',
        map         JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS mind_maps_teacher_idx
        ON mind_maps(teacher_id, updated_at DESC)
    `);
    await db.execute(sql`
      ALTER TABLE mind_maps
        ADD COLUMN IF NOT EXISTS client_request_id TEXT
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS mind_maps_teacher_client_request_uidx
        ON mind_maps(teacher_id, client_request_id)
    `);
    logger.info("Schema migrations applied");
  } catch (err) {
    logger.error(err, "Schema migration failed");
  }

  // ── Persisted AI educational videos (metadata only; media stays in Object Storage) ──
  // Isolated so unrelated legacy migrations cannot prevent this feature table
  // from being provisioned on an existing deployment.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_video_projects (
        id                         SERIAL PRIMARY KEY,
        teacher_id                 INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        title                      TEXT NOT NULL,
        status                     TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'storyboard_ready', 'rendering', 'ready', 'failed')),
        brief                      JSONB NOT NULL,
        storyboard                 JSONB,
        output_url                 TEXT,
        error_message              TEXT,
        storyboard_idempotency_key TEXT NOT NULL,
        storyboard_lease_id         TEXT,
        storyboard_lease_expires_at TIMESTAMPTZ,
        render_idempotency_key     TEXT,
        render_lease_id             TEXT,
        render_lease_expires_at     TIMESTAMPTZ,
        created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_video_projects_storyboard_idempotency_uq
        ON ai_video_projects(storyboard_idempotency_key)
    `);
    await db.execute(sql`
      UPDATE ai_video_projects
         SET storyboard = NULL
       WHERE status = 'draft'
         AND COALESCE(jsonb_array_length(storyboard->'scenes'), 0) = 0
    `);
    await db.execute(sql`
      ALTER TABLE ai_video_projects
        ALTER COLUMN storyboard DROP NOT NULL,
        ALTER COLUMN storyboard DROP DEFAULT
    `);
    await db.execute(sql`
      ALTER TABLE ai_video_projects
        ADD COLUMN IF NOT EXISTS storyboard_lease_id TEXT,
        ADD COLUMN IF NOT EXISTS storyboard_lease_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS render_quote JSONB,
        ADD COLUMN IF NOT EXISTS render_approval JSONB,
        ADD COLUMN IF NOT EXISTS render_lease_id TEXT,
        ADD COLUMN IF NOT EXISTS render_lease_expires_at TIMESTAMPTZ
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ai_video_projects_teacher_updated_idx
        ON ai_video_projects(teacher_id, updated_at DESC)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_video_provider_requests (
        id                SERIAL PRIMARY KEY,
        project_id        INTEGER NOT NULL REFERENCES ai_video_projects(id) ON DELETE CASCADE,
        scene_index       INTEGER NOT NULL CHECK (scene_index >= 0),
        storyboard_hash   TEXT NOT NULL,
        provider_model    TEXT NOT NULL,
        tracking_model    TEXT NOT NULL,
        request_id        TEXT,
        state             TEXT NOT NULL DEFAULT 'intent'
          CHECK (state IN ('intent', 'submitting', 'submitted', 'submission_unknown', 'completed', 'failed', 'unusable')),
        render_lease_id   TEXT NOT NULL,
        error_message     TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_video_provider_requests_identity_uq
        ON ai_video_provider_requests(project_id, scene_index, storyboard_hash)
    `);
    await db.execute(sql`
      ALTER TABLE ai_video_provider_requests
        DROP CONSTRAINT IF EXISTS ai_video_provider_requests_state_check
    `);
    await db.execute(sql`
      ALTER TABLE ai_video_provider_requests
        ADD CONSTRAINT ai_video_provider_requests_state_check
        CHECK (state IN ('intent', 'submitting', 'submitted', 'submission_unknown', 'completed', 'failed', 'unusable'))
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ai_video_provider_requests_project_idx
        ON ai_video_provider_requests(project_id, created_at)
    `);
    logger.info("AI video projects table ready");
  } catch (err) {
    logger.error(err, "AI video projects migration failed");
  }

  // Kept separate from the legacy migration bundle so this new table is still
  // provisioned if an unrelated historical migration above fails.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS saved_game_activities (
        id                  SERIAL PRIMARY KEY,
        teacher_id          INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        game_type           TEXT NOT NULL,
        title               TEXT NOT NULL,
        content             JSONB NOT NULL,
        settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
        source              TEXT NOT NULL DEFAULT 'manual',
        is_shared           BOOLEAN NOT NULL DEFAULT false,
        published_at        TIMESTAMPTZ,
        hidden_by_admin     BOOLEAN NOT NULL DEFAULT false,
        content_fingerprint TEXT NOT NULL,
        question_count      INTEGER NOT NULL DEFAULT 0,
        play_count          INTEGER NOT NULL DEFAULT 1,
        last_played_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT saved_game_activities_teacher_game_content_uq
          UNIQUE (teacher_id, game_type, content_fingerprint)
      )
    `);
    await db.execute(sql`
      ALTER TABLE saved_game_activities
        ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS saved_game_activities_teacher_updated_idx
        ON saved_game_activities(teacher_id, updated_at DESC)
    `);
    logger.info("Saved game activities table ready");
  } catch (err) {
    logger.error(err, "Saved game activities migration failed");
  }

  // ── Personal assistant — isolated storage, no foreign keys into Hasaad data ──
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_threads (
        id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        channel                 TEXT NOT NULL DEFAULT 'whatsapp',
        external_contact_phone  TEXT NOT NULL UNIQUE,
        last_message_at         TIMESTAMPTZ,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_messages (
        id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        thread_id             INTEGER NOT NULL REFERENCES personal_assistant_threads(id) ON DELETE CASCADE,
        external_message_id   TEXT NOT NULL UNIQUE,
        direction             TEXT NOT NULL DEFAULT 'inbound',
        message_text          TEXT NOT NULL,
        received_at           TIMESTAMPTZ NOT NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_actions (
        id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        thread_id     INTEGER NOT NULL REFERENCES personal_assistant_threads(id) ON DELETE CASCADE,
        message_id    INTEGER NOT NULL UNIQUE REFERENCES personal_assistant_messages(id) ON DELETE CASCADE,
        action_type   TEXT NOT NULL DEFAULT 'review',
        status        TEXT NOT NULL DEFAULT 'pending_review'
          CHECK (status IN ('pending_review', 'confirmed', 'cancelled')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at   TIMESTAMPTZ
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS personal_assistant_messages_thread_idx
        ON personal_assistant_messages(thread_id, received_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS personal_assistant_actions_status_idx
        ON personal_assistant_actions(status, created_at DESC)
    `);
    logger.info("Personal assistant tables ready");
  } catch (err) {
    logger.error(err, "Personal assistant table migration failed");
  }

  // ── Credits system — tables ──────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_tool_prices (
        tool_key               TEXT PRIMARY KEY,
        tool_name_ar           TEXT NOT NULL,
        tool_name_en           TEXT,
        category               TEXT NOT NULL DEFAULT 'ai',
        credits_cost           INTEGER NOT NULL DEFAULT 0,
        default_credits_cost   INTEGER NOT NULL DEFAULT 0,
        is_credit_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
        timeout_seconds        INTEGER NOT NULL DEFAULT 60,
        estimated_api_cost_usd NUMERIC(10,6),
        updated_by             INTEGER,
        updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE credit_tool_prices
      ADD COLUMN IF NOT EXISTS tool_name_en TEXT
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_accounts (
        teacher_id   INTEGER PRIMARY KEY,
        balance      INTEGER NOT NULL DEFAULT 0,
        total_earned INTEGER NOT NULL DEFAULT 0,
        total_spent  INTEGER NOT NULL DEFAULT 0,
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id         SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL,
        amount     INTEGER NOT NULL,
        type       TEXT NOT NULL,
        reason     TEXT,
        tool_key   TEXT,
        request_id TEXT UNIQUE,
        status     TEXT NOT NULL DEFAULT 'completed',
        admin_id   INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_transactions_teacher_idx ON credit_transactions(teacher_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_transactions_type_idx   ON credit_transactions(type, tool_key)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_holds (
        id              SERIAL PRIMARY KEY,
        teacher_id      INTEGER NOT NULL,
        tool_key        TEXT NOT NULL,
        credits_held    INTEGER NOT NULL,
        request_id      TEXT NOT NULL UNIQUE,
        status          TEXT NOT NULL DEFAULT 'pending',
        timeout_seconds INTEGER NOT NULL DEFAULT 60,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMP,
        refunded_at     TIMESTAMP
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_holds_pending_idx ON credit_holds(status, created_at)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_packages (
        id             SERIAL PRIMARY KEY,
        price_usd_cents INTEGER NOT NULL,
        credits        INTEGER NOT NULL,
        sort_order     INTEGER NOT NULL DEFAULT 0,
        is_visible     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── Credit purchases (Lemon Squeezy) — MUST run after the base credit tables above ──
    await db.execute(sql`
      ALTER TABLE credit_accounts
        ADD COLUMN IF NOT EXISTS paid_balance   INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS promo_balance  INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS earned_balance INTEGER NOT NULL DEFAULT 0
    `);
    // Backfill: legacy balances become promo (free) credit
    await db.execute(sql`
      UPDATE credit_accounts
      SET promo_balance = balance - paid_balance - earned_balance
      WHERE paid_balance + promo_balance + earned_balance <> balance
    `);
    await db.execute(sql`
      ALTER TABLE credit_transactions
        ADD COLUMN IF NOT EXISTS credit_type TEXT NOT NULL DEFAULT 'promo',
        ADD COLUMN IF NOT EXISTS source      TEXT,
        ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS purchase_id INTEGER
    `);
    await db.execute(sql`
      ALTER TABLE credit_holds
        ADD COLUMN IF NOT EXISTS held_promo  INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS held_earned INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS held_paid   INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS result_json TEXT
    `);
    await db.execute(sql`
      ALTER TABLE credit_packages
        ADD COLUMN IF NOT EXISTS name             TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS slug             TEXT,
        ADD COLUMN IF NOT EXISTS description      TEXT,
        ADD COLUMN IF NOT EXISTS lemon_product_id TEXT,
        ADD COLUMN IF NOT EXISTS lemon_variant_id TEXT,
        ADD COLUMN IF NOT EXISTS currency         TEXT NOT NULL DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS credit_packages_slug_uniq    ON credit_packages(slug)             WHERE slug IS NOT NULL`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS credit_packages_variant_uniq ON credit_packages(lemon_variant_id) WHERE lemon_variant_id IS NOT NULL`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_purchases (
        id                       SERIAL PRIMARY KEY,
        purchase_intent_id       TEXT NOT NULL UNIQUE,
        teacher_id               INTEGER NOT NULL,
        package_id               INTEGER NOT NULL,
        lemon_order_id           TEXT UNIQUE,
        lemon_variant_id         TEXT NOT NULL,
        amount_cents             INTEGER NOT NULL,
        currency                 TEXT NOT NULL DEFAULT 'USD',
        credits_amount           INTEGER NOT NULL,
        package_name_snapshot    TEXT NOT NULL,
        package_price_snapshot   INTEGER NOT NULL,
        package_credits_snapshot INTEGER NOT NULL,
        payment_status           TEXT NOT NULL DEFAULT 'pending_checkout',
        refunded_amount_cents    INTEGER NOT NULL DEFAULT 0,
        refunded_credits_amount  INTEGER NOT NULL DEFAULT 0,
        refund_review_status     TEXT NOT NULL DEFAULT 'none',
        refund_review_note       TEXT,
        purchased_at             TIMESTAMP,
        processed_at             TIMESTAMP,
        refund_processed_at      TIMESTAMP,
        created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_purchases_teacher_idx ON credit_purchases(teacher_id, created_at DESC)`);
    // Seed default credit packages (once — only when the table is empty)
    await db.execute(sql`
      INSERT INTO credit_packages (name, price_usd_cents, credits, sort_order, is_visible, is_featured)
      SELECT * FROM (VALUES
        ('100 رصيد',  299,  100, 1, TRUE, FALSE),
        ('300 رصيد',  699,  300, 2, TRUE, TRUE),
        ('600 رصيد', 1199,  600, 3, TRUE, FALSE)
      ) AS seed(name, price_usd_cents, credits, sort_order, is_visible, is_featured)
      WHERE NOT EXISTS (SELECT 1 FROM credit_packages)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id                   SERIAL PRIMARY KEY,
        provider             TEXT NOT NULL DEFAULT 'lemonsqueezy',
        event_name           TEXT NOT NULL,
        provider_object_type TEXT,
        provider_object_id   TEXT,
        provider_event_id    TEXT,
        idempotency_key      TEXT NOT NULL UNIQUE,
        status               TEXT NOT NULL DEFAULT 'received',
        attempts             INTEGER NOT NULL DEFAULT 0,
        raw_payload          TEXT,
        error_message        TEXT,
        processed_at         TIMESTAMP,
        failed_at            TIMESTAMP,
        created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── Seed default tool prices (INSERT only — never overwrite customized values) ──
    await db.execute(sql`
      INSERT INTO credit_tool_prices (tool_key, tool_name_ar, tool_name_en, category, credits_cost, default_credits_cost, timeout_seconds)
      VALUES
        ('whiteboard',       'السبورة الذكية',          'Smart Whiteboard',                 'ai',     5,  5,  120),
        ('mindmap',          'الخريطة الذهنية',         'Mind Map',                         'ai',     5,  5,  120),
        ('ai-questions',     'توليد أسئلة AI',          'AI Question Generation',           'ai',    10, 10,  120),
        ('ai-image',         'توليد صورة AI',           'AI Image Generation',              'ai',    10, 10,   60),
        ('worksheet',        'ورقة العمل',              'Worksheet',                        'ai',    15, 15,  120),
        ('worksheet-tic-tac-toe-cell', 'إعادة توليد مربع تيك تاك توك', 'Regenerate Tic-Tac-Toe Square', 'ai', 2, 2, 120),
        ('lesson-plan',      'خطة الدرس',               'Lesson Plan',                      'ai',    15, 15,  120),
        ('pdf-to-questions', 'استخراج أسئلة من PDF',    'Extract Questions from PDF',       'ai',    15, 15,  120),
        ('extract_questions_from_source', 'استخراج أسئلة من مصدر', 'Extract Questions from Source', 'ai', 10, 10, 180),
        ('presentation',     'العرض التقديمي',           'Presentation',                     'ai',    20, 20,  300),
        ('presentation-slide','توليد شريحة واحدة',       'Generate One Slide',               'ai',     5,  5,  120),
        ('ai-video',         'لوحة قصة فيديو تعليمي',   'Educational Video Storyboard',     'ai',    15, 15,  180),
        ('ai-video-render',  'إخراج فيديو تعليمي',      'Educational Video Render',         'ai',    25, 25,  600),
        ('ai-video-economy', 'خطة فيديو شرح بالصور',    'Narrated Image Video Storyboard',   'ai',     4,  4,  120),
        ('ai-video-economy-render-30', 'إخراج شرح بالصور — 30 ثانية', 'Narrated Image Video — 30 Seconds', 'ai', 6, 6, 480),
        ('ai-video-economy-render-60', 'إخراج شرح بالصور — 60 ثانية', 'Narrated Image Video — 60 Seconds', 'ai', 10, 10, 600),
        ('ai-video-economy-render-90', 'إخراج شرح بالصور — 90 ثانية', 'Narrated Image Video — 90 Seconds', 'ai', 14, 14, 720),
        ('video-interactive','الفيديو التفاعلي',         'Interactive Video',                'ai',    20, 20,  180),
        ('adaptive-test',    'الاختبار التكيّفي',        'Adaptive Test',                    'ai',    20, 20,  120),
        ('tts',              'تحويل النص إلى صوت',      'Text to Speech',                   'ai',     2,  2,  120),
        ('ai-chat',          'مرشد حصاد (محادثة)',       'Hasaad Guide Chat',                'ai',     1,  1,   60),
        ('arena-generate',   'توليد أسئلة الميدان',      'Arena Question Generation',        'ai',     5,  5,  120),
        ('quick-challenge',  'التحدي السريع (AI)',       'AI Quick Challenge',               'ai',     5,  5,  120),
        ('arena',            'ميدان التحدي',            'Challenge Arena',                  'game',   0,  0,   60),
        ('hack',             'لعبة هاك',                'Hack Game',                        'game',   0,  0,   60),
        ('solo',             'التحدي الفردي',           'Solo Challenge',                   'game',   0,  0,   60),
        ('flags',            'لعبة الأعلام',            'Flags Game',                       'game',   0,  0,   60),
        ('colors',           'لعبة الألوان',            'Colors Game',                      'game',   0,  0,   60),
        ('memory',           'الذاكرة',                 'Memory Game',                      'game',   0,  0,   60),
        ('multiply',         'الضرب السريع',            'Quick Multiplication',             'game',   0,  0,   60),
        ('scramble',         'الكلمات المبعثرة',        'Word Scramble',                    'game',   0,  0,   60),
        ('capitals',         'عواصم العالم',            'World Capitals',                   'game',   0,  0,   60),
        ('million',          'من سيربح المليون',        'Who Wants to Be a Millionaire',    'game',   0,  0,   60),
        ('stroop',           'اختبار ستروب',            'Stroop Test',                      'game',   0,  0,   60),
        ('secret-game',      'اكتشف السر',              'Discover the Secret',              'game',   0,  0,   60),
        ('letrly',           'كلمة اليوم',              'Word of the Day',                  'game',   0,  0,   60),
        ('assignments',      'الواجبات',                'Assignments',                      'tool',   0,  0,   60),
        ('video-lessons',    'دروس الفيديو',            'Video Lessons',                    'tool',   0,  0,   60)
      ON CONFLICT (tool_key) DO UPDATE
      SET tool_name_en = COALESCE(credit_tool_prices.tool_name_en, EXCLUDED.tool_name_en)
    `);
    logger.info("Credits tables ready");
  } catch (err) {
    logger.error(err, "Credits table migration failed");
  }

  // ── Solo Challenge Links — isolated block so earlier failures don't block it ──
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenges (
        id            SERIAL PRIMARY KEY,
        slug          TEXT NOT NULL UNIQUE,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        assignment_title TEXT NOT NULL,
        play_count    INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_slug_idx        ON solo_challenges(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_assignment_idx  ON solo_challenges(assignment_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_teacher_idx     ON solo_challenges(teacher_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenge_scores (
        id          SERIAL PRIMARY KEY,
        slug        TEXT NOT NULL,
        player_name TEXT NOT NULL,
        score       INTEGER NOT NULL DEFAULT 0,
        played_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenge_scores_slug_idx  ON solo_challenge_scores(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenge_scores_score_idx ON solo_challenge_scores(slug, score DESC)`);
    await db.execute(sql`ALTER TABLE solo_challenge_scores ADD COLUMN IF NOT EXISTS participant_key TEXT`);
    await db.execute(sql`ALTER TABLE solo_challenge_scores ADD COLUMN IF NOT EXISTS game_run_id TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_scores_participant_idx ON solo_challenge_scores(slug, participant_key) WHERE participant_key IS NOT NULL`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_scores_game_run_idx ON solo_challenge_scores(game_run_id) WHERE game_run_id IS NOT NULL`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenge_attempts (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        game_run_id TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenge_attempts_participant_idx ON solo_challenge_attempts(slug, participant_key)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_attempts_game_run_idx ON solo_challenge_attempts(game_run_id)`);
    await db.execute(sql`ALTER TABLE solo_challenges ADD COLUMN IF NOT EXISTS notes TEXT`);
    await db.execute(sql`ALTER TABLE solo_challenges ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
    logger.info("Solo challenge tables ready");
  } catch (err) {
    logger.error(err, "Solo challenge table migration failed");
  }

  // ── Direct Play Links ─────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS direct_play_links (
        id            SERIAL PRIMARY KEY,
        token         TEXT NOT NULL UNIQUE,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        game_type     TEXT NOT NULL,
        teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS direct_play_links_token_idx
        ON direct_play_links(token)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS direct_play_links_assignment_game_unique_idx
        ON direct_play_links(assignment_id, game_type, teacher_id)
    `);
    // Wheel of Challenge links use the same opaque-token table as assignment
    // links. Existing rows remain assignment-backed; a wheel link has a null
    // assignment_id and is removed automatically with its template.
    await db.execute(sql`
      ALTER TABLE direct_play_links
        ALTER COLUMN assignment_id DROP NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE direct_play_links
        ADD COLUMN IF NOT EXISTS wheel_template_id INTEGER
          REFERENCES wheel_templates(id) ON DELETE CASCADE
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS direct_play_links_wheel_game_unique_idx
        ON direct_play_links(wheel_template_id, game_type, teacher_id)
        WHERE wheel_template_id IS NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE direct_play_links
        ADD COLUMN IF NOT EXISTS saved_game_activity_id INTEGER
          REFERENCES saved_game_activities(id) ON DELETE CASCADE
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS direct_play_links_saved_game_type_uq
        ON direct_play_links(saved_game_activity_id, game_type)
        WHERE saved_game_activity_id IS NOT NULL
    `);
    logger.info("Direct play links table ready");
  } catch (err) {
    logger.error(err, "Direct play links migration failed");
  }

  // ── Secret Game tables ──
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS secret_game_categories (
        id         SERIAL PRIMARY KEY,
        name_ar    TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT '🎯',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active  BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS secret_game_items (
        id          SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES secret_game_categories(id) ON DELETE CASCADE,
        name_ar     TEXT NOT NULL,
        image_url   TEXT,
        difficulty  TEXT NOT NULL DEFAULT 'medium',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS secret_game_items_cat_idx ON secret_game_items(category_id)`);
    await db.execute(sql`ALTER TABLE secret_game_categories ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE secret_game_categories ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE secret_game_categories ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE`);
    logger.info("Secret game tables ready");
  } catch (err) {
    logger.error(err, "Secret game table migration failed");
  }

  // ── Presentations — idempotent column / table additions ──
  // Core tables are created via Drizzle push; these guards protect
  // production deployments whose last push predates a feature phase.
  try {
    // presentations: columns added after initial push
    await db.execute(sql`
      ALTER TABLE presentations
        ADD COLUMN IF NOT EXISTS pattern TEXT NOT NULL DEFAULT 'solid',
        ADD COLUMN IF NOT EXISTS mode TEXT,
        ADD COLUMN IF NOT EXISTS template TEXT,
        ADD COLUMN IF NOT EXISTS cover_emoji TEXT DEFAULT '📚',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS linked_activity_id TEXT,
        ADD COLUMN IF NOT EXISTS linked_activity_kind TEXT,
        ADD COLUMN IF NOT EXISTS last_presented_at TIMESTAMP
    `);
    // presentation_sessions: session_mode added for Self-Paced Mode
    await db.execute(sql`
      ALTER TABLE presentation_sessions
        ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'teacher'
    `);
    // presentation_responses: class_student_id added for class-mode joins
    await db.execute(sql`
      ALTER TABLE presentation_responses
        ADD COLUMN IF NOT EXISTS class_student_id INTEGER
          REFERENCES students(id) ON DELETE SET NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS presentation_responses_class_student_idx
        ON presentation_responses(class_student_id)
    `);
    // presentation_assets: tier-system asset tracking table (Phase 2B)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS presentation_assets (
        id               SERIAL PRIMARY KEY,
        presentation_id  INTEGER NOT NULL
          REFERENCES presentations(id) ON DELETE CASCADE,
        kind             TEXT NOT NULL,
        url              TEXT NOT NULL,
        byte_size        INTEGER NOT NULL DEFAULT 0,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // presentation_inline_quiz_runs: per-student quiz-run history (Phase 6)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS presentation_inline_quiz_runs (
        id               SERIAL PRIMARY KEY,
        session_id       INTEGER NOT NULL
          REFERENCES presentation_sessions(id) ON DELETE CASCADE,
        element_id       TEXT NOT NULL,
        total_questions  INTEGER NOT NULL,
        student_key      VARCHAR(40) NOT NULL,
        student_name     TEXT NOT NULL,
        class_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        correct          INTEGER NOT NULL,
        answered         INTEGER NOT NULL,
        finished_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS presentation_inline_quiz_runs_session_idx
        ON presentation_inline_quiz_runs(session_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS presentation_inline_quiz_runs_run_idx
        ON presentation_inline_quiz_runs(session_id, element_id, finished_at)
    `);
    logger.info("Presentation migrations applied");
  } catch (err) {
    logger.error(err, "Presentation migrations failed");
  }

  // ── Solo Challenge Enhancements ──────────────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE solo_challenges
        ADD COLUMN IF NOT EXISTS questions         JSONB,
        ADD COLUMN IF NOT EXISTS time_per_question INTEGER DEFAULT 20,
        ADD COLUMN IF NOT EXISTS leaderboard_display TEXT DEFAULT 'top20'
    `);
    // Allow standalone challenges (no linked assignment)
    await db.execute(sql`ALTER TABLE solo_challenges ALTER COLUMN assignment_id DROP NOT NULL`);
    logger.info("Solo challenge enhancement migrations applied");
  } catch (err) {
    logger.error(err, "Solo challenge enhancement migrations failed");
  }

  try {
    await db.execute(sql`ALTER TABLE islamic_challenges ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`);
    logger.info("Islamic challenges started_at migration applied");
  } catch (err) {
    logger.error(err, "Islamic challenges started_at migration failed");
  }

  // ── Teacher account verification columns ─────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS verification_otp  TEXT,
        ADD COLUMN IF NOT EXISTS otp_expires_at    TIMESTAMP,
        ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN NOT NULL DEFAULT FALSE
    `);
    logger.info("Teacher verification columns migrated");
  } catch (err) {
    logger.error(err, "Teacher verification column migration failed");
  }

  // ── Parent-report: students contact columns ───────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS parent_email TEXT,
        ADD COLUMN IF NOT EXISTS parent_name  TEXT
    `);
    logger.info("students.parent_email / parent_name columns migrated");
  } catch (err) {
    logger.error(err, "students parent contact column migration failed");
  }

  // ── Parent-report: parent_messages table ─────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parent_messages (
        id               SERIAL PRIMARY KEY,
        teacher_id       INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject          TEXT NOT NULL DEFAULT '',
        body             TEXT NOT NULL,
        parent_email     TEXT NOT NULL,
        parent_name      TEXT,
        sent_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        read_at          TIMESTAMP,
        reply_text       TEXT,
        replied_at       TIMESTAMP,
        reply_token      TEXT NOT NULL,
        token_expires_at TIMESTAMP NOT NULL,
        is_archived      BOOLEAN NOT NULL DEFAULT false,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS parent_messages_teacher_idx
        ON parent_messages(teacher_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS parent_messages_student_idx
        ON parent_messages(student_id)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS parent_messages_token_unique
        ON parent_messages(reply_token)
    `);
    logger.info("parent_messages table migrated");
  } catch (err) {
    logger.error(err, "parent_messages table migration failed");
  }

  // ── Parent-report: parent_message_replies table ───────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parent_message_replies (
        id         SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES parent_messages(id) ON DELETE CASCADE,
        sender     TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pmr_message_idx
        ON parent_message_replies(message_id)
    `);
    logger.info("parent_message_replies table migrated");
  } catch (err) {
    logger.error(err, "parent_message_replies table migration failed");
  }

  // ── Whiteboard sessions table ──────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whiteboard_sessions (
        id                  SERIAL PRIMARY KEY,
        teacher_id          INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        client_request_id   TEXT,
        student_account_id  INTEGER,
        question            TEXT NOT NULL,
        image_url           TEXT,
        extracted_text      TEXT,
        plan                JSONB NOT NULL DEFAULT '{}',
        subject             TEXT,
        grade_level         TEXT,
        level               TEXT,
        language            TEXT NOT NULL DEFAULT 'ar',
        created_at          TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE whiteboard_sessions
        ADD COLUMN IF NOT EXISTS client_request_id TEXT
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_sessions_teacher_client_request_uidx
        ON whiteboard_sessions(teacher_id, client_request_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS whiteboard_sessions_teacher_idx
        ON whiteboard_sessions(teacher_id, created_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS whiteboard_sessions_student_idx
        ON whiteboard_sessions(student_account_id, created_at DESC)
    `);
    logger.info("whiteboard_sessions table migrated");
  } catch (err) {
    logger.error(err, "whiteboard_sessions migration failed");
  }

  // ── Geocode cache ─────────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS geocode_cache (
        query_key    TEXT PRIMARY KEY,
        result       JSONB,
        found        BOOLEAN NOT NULL DEFAULT true,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at   TIMESTAMP NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS geocode_cache_expires_idx ON geocode_cache(expires_at)
    `);
    logger.info("geocode_cache table migrated");
  } catch (err) {
    logger.error(err, "geocode_cache migration failed");
  }

  // ── Notifications: message_id column ─────────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id INTEGER
    `);
    logger.info("notifications.message_id column migrated");
  } catch (err) {
    logger.error(err, "notifications.message_id column migration failed");
  }

  // ── Parent messages: attachments column ───────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS attachments TEXT
    `);
    logger.info("parent_messages.attachments column migrated");
  } catch (err) {
    logger.error(err, "parent_messages.attachments column migration failed");
  }

  // ── Parent messages: immutable motivation summary snapshot ────────────────
  try {
    await db.execute(sql`
      ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS motivation_summary JSONB
    `);
    logger.info("parent_messages.motivation_summary column migrated");
  } catch (err) {
    logger.error(err, "parent_messages.motivation_summary column migration failed");
  }

  // ── Parent message replies: attachments column ────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE parent_message_replies ADD COLUMN IF NOT EXISTS attachments TEXT
    `);
    logger.info("parent_message_replies.attachments column migrated");
  } catch (err) {
    logger.error(err, "parent_message_replies.attachments column migration failed");
  }

  // ── Solo challenges: allowed_classes column ────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE solo_challenges ADD COLUMN IF NOT EXISTS allowed_classes JSONB
    `);
    logger.info("solo_challenges.allowed_classes column migrated");
  } catch (err) {
    logger.error(err, "solo_challenges.allowed_classes column migration failed");
  }

  // ── Subscriptions system: new columns ─────────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE plans
        ADD COLUMN IF NOT EXISTS monthly_credits  INTEGER,
        ADD COLUMN IF NOT EXISTS rollover_cap     INTEGER,
        ADD COLUMN IF NOT EXISTS lemon_variant_id TEXT,
        ADD COLUMN IF NOT EXISTS lemon_product_id TEXT
    `);
    await db.execute(sql`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS current_period_end       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cancelled_at             TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_status           TEXT DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS last_credited_period_end TIMESTAMP,
        ADD COLUMN IF NOT EXISTS billing_interval         TEXT NOT NULL DEFAULT 'month',
        ADD COLUMN IF NOT EXISTS lemon_variant_id         TEXT,
        ADD COLUMN IF NOT EXISTS paid_through             TIMESTAMP,
        ADD COLUMN IF NOT EXISTS release_through          TIMESTAMP,
        ADD COLUMN IF NOT EXISTS provider_updated_at      TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE credit_accounts
        ADD COLUMN IF NOT EXISTS subscription_balance INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS free_balance         INTEGER NOT NULL DEFAULT 0
    `);
    logger.info("Subscriptions system columns migrated");
  } catch (err) {
    logger.error(err, "Subscriptions system column migration failed");
  }

  // ── Subscription Credit Grants — invoice-level idempotency guard ──────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_credit_grants (
        id                      SERIAL PRIMARY KEY,
        subscription_invoice_id TEXT NOT NULL,
        subscription_id         TEXT NOT NULL,
        teacher_id              INTEGER NOT NULL,
        plan_code               TEXT NOT NULL,
        credits_granted         INTEGER NOT NULL DEFAULT 0,
        period_end              TIMESTAMP NOT NULL,
        credit_cycle_key        TEXT,
        created_at              TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS scg_invoice_uniq
        ON subscription_credit_grants(subscription_invoice_id)
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scg_teacher_idx       ON subscription_credit_grants(teacher_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scg_subscription_idx  ON subscription_credit_grants(subscription_id)`);
    await db.execute(sql`ALTER TABLE subscription_credit_grants ADD COLUMN IF NOT EXISTS credit_cycle_key TEXT`);
    await db.execute(sql`ALTER TABLE subscription_credit_grants ADD COLUMN IF NOT EXISTS entitlement_id INTEGER`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS scg_entitlement_idx ON subscription_credit_grants(entitlement_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS scg_credit_cycle_uniq ON subscription_credit_grants(credit_cycle_key)`);
    logger.info("subscription_credit_grants table ready");
  } catch (err) {
    logger.error(err, "subscription_credit_grants migration failed");
  }

  // Provider invoices are immutable entitlement facts.  Do not derive future
  // annual releases from subscriptions, which is intentionally only a current
  // state projection and may have changed plans since payment.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_credit_entitlements (
        id                  SERIAL PRIMARY KEY,
        provider_invoice_id TEXT NOT NULL UNIQUE,
        subscription_id     TEXT NOT NULL,
        provider_order_id   TEXT,
        teacher_id          INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        plan_code           TEXT NOT NULL,
        monthly_credits_snapshot INTEGER NOT NULL DEFAULT 0,
        rollover_cap_snapshot INTEGER,
        billing_interval    TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
        period_start        TIMESTAMP NOT NULL,
        period_end          TIMESTAMP NOT NULL,
        release_through     TIMESTAMP NOT NULL,
        status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
        refund_review_status TEXT NOT NULL DEFAULT 'none',
        refund_review_note  TEXT,
        provider_event_at   TIMESTAMP,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE subscription_credit_entitlements ADD COLUMN IF NOT EXISTS monthly_credits_snapshot INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE subscription_credit_entitlements ADD COLUMN IF NOT EXISTS rollover_cap_snapshot INTEGER`);
    await db.execute(sql`ALTER TABLE subscription_credit_entitlements ADD COLUMN IF NOT EXISTS refund_review_status TEXT NOT NULL DEFAULT 'none', ADD COLUMN IF NOT EXISTS refund_review_note TEXT`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sce_subscription_status_idx ON subscription_credit_entitlements(subscription_id, status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sce_due_release_idx ON subscription_credit_entitlements(status, release_through)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sce_provider_order_idx ON subscription_credit_entitlements(provider_order_id)`);
    logger.info("subscription credit entitlements table ready");
  } catch (err) {
    logger.error(err, "subscription credit entitlements migration failed");
  }

  // ── Lemon Squeezy monthly/annual variants ─────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_billing_options (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
        lemon_variant_id TEXT NOT NULL,
        price_minor INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(plan_id, billing_interval),
        UNIQUE(lemon_variant_id)
      )
    `);
    // Preserve existing admin-configured monthly variants while annual variants
    // are configured in the same table (there is deliberately no guessed ID).
    await db.execute(sql`
      INSERT INTO plan_billing_options (plan_id, billing_interval, lemon_variant_id, price_minor, currency)
      SELECT id, 'month', lemon_variant_id, price_minor, currency
      FROM plans WHERE lemon_variant_id IS NOT NULL
      ON CONFLICT (plan_id, billing_interval) DO NOTHING
    `);
    logger.info("Annual billing options table ready");
  } catch (err) {
    logger.error(err, "Annual billing options migration failed");
  }

  // ── Credit Batches — Source of Truth for credits ───────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_batches (
        id               SERIAL PRIMARY KEY,
        teacher_id       INTEGER NOT NULL,
        source           TEXT NOT NULL,
        amount           INTEGER NOT NULL,
        amount_remaining INTEGER NOT NULL,
        expires_at       TIMESTAMP,
        reference_id     TEXT,
        plan_code        TEXT,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_batches_teacher_idx  ON credit_batches(teacher_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_batches_expires_idx  ON credit_batches(teacher_id, expires_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_batches_source_idx   ON credit_batches(teacher_id, source)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_hold_items (
        id       SERIAL PRIMARY KEY,
        hold_id  INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        amount   INTEGER NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_hold_items_hold_idx  ON credit_hold_items(hold_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS credit_hold_items_batch_idx ON credit_hold_items(batch_id)`);

    logger.info("credit_batches and credit_hold_items tables ready");
  } catch (err) {
    logger.error(err, "credit_batches / credit_hold_items migration failed");
  }

  // ── Credit Batches: seed existing balances ─────────────────────────────────
  // Converts legacy bucket balances in credit_accounts into credit_batches rows.
  // Uses seed_completions so this runs ONCE; never re-seeds.
  try {
    const seedKey = "credit_batches_seed_v1";
    const done = await db.execute(sql`SELECT 1 FROM seed_completions WHERE key = ${seedKey}`);
    if (done.rows.length === 0) {
      // Seed batch rows for every teacher who has any balance in the old buckets.
      // order: promo → paid → earned (matches old bucket semantics)
      await db.execute(sql`
        INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
        SELECT teacher_id, 'promo', promo_balance, promo_balance, NULL, 'legacy_seed', NOW(), NOW()
        FROM credit_accounts
        WHERE promo_balance > 0
      `);
      await db.execute(sql`
        INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
        SELECT teacher_id, 'purchased', paid_balance, paid_balance, NULL, 'legacy_seed', NOW(), NOW()
        FROM credit_accounts
        WHERE paid_balance > 0
      `);
      await db.execute(sql`
        INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
        SELECT teacher_id, 'earned', earned_balance, earned_balance, NULL, 'legacy_seed', NOW(), NOW()
        FROM credit_accounts
        WHERE earned_balance > 0
      `);
      // Grant a one-time welcome batch (50 credits, no expiry) for every teacher without one.
      // expires_at = NULL because welcome credits are permanent (not a monthly renewal).
      await db.execute(sql`
        INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
        SELECT ca.teacher_id, 'free', 50, 50, NULL, 'welcome_credits', NOW(), NOW()
        FROM credit_accounts ca
        WHERE NOT EXISTS (
          SELECT 1 FROM credit_batches cb WHERE cb.teacher_id = ca.teacher_id AND cb.source = 'free'
        )
      `);
      // Also sync free_balance and subscription_balance caches for seeded teachers
      await db.execute(sql`
        UPDATE credit_accounts ca
        SET free_balance = COALESCE((
              SELECT SUM(amount_remaining)
              FROM credit_batches cb
              WHERE cb.teacher_id = ca.teacher_id AND cb.source = 'free'
                AND (cb.expires_at IS NULL OR cb.expires_at > NOW())
            ), 0)
      `);
      await db.execute(sql`INSERT INTO seed_completions (key) VALUES (${seedKey})`);
      logger.info("[seed] credit_batches seeded from existing balances");
    }
  } catch (err) {
    logger.error(err, "credit_batches seed failed");
  }

  // ── Welcome credits backfill (v1) — one-time migration for legacy teachers ──
  // Policy: every teacher gets a one-time 50-credit welcome batch, even those
  // registered before the credits system existed. Guarded by seed_completions.
  try {
    const { runWelcomeCreditsBackfill } = await import("./lib/welcome-backfill");
    const result = await runWelcomeCreditsBackfill();
    if (result.applied) {
      logger.info({ granted: result.granted }, "[seed] welcome_credits_backfill_v1 applied");
    }
  } catch (err) {
    logger.error(err, "welcome_credits_backfill_v1 failed");
  }

  // ── Subscriptions: seed free plan rows for every teacher without one ────────
  try {
    const seedKey = "subscriptions_free_seed_v1";
    const done = await db.execute(sql`SELECT 1 FROM seed_completions WHERE key = ${seedKey}`);
    if (done.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO subscriptions (teacher_id, plan_id, status, started_at, created_at, updated_at)
        SELECT t.id,
               (SELECT id FROM plans WHERE code = 'free' LIMIT 1),
               'active',
               NOW(), NOW(), NOW()
        FROM teachers t
        WHERE NOT EXISTS (
          SELECT 1 FROM subscriptions s WHERE s.teacher_id = t.id
        )
        AND (SELECT id FROM plans WHERE code = 'free' LIMIT 1) IS NOT NULL
      `);
      await db.execute(sql`INSERT INTO seed_completions (key) VALUES (${seedKey})`);
      logger.info("[seed] free-plan subscriptions seeded for existing teachers");
    }
  } catch (err) {
    logger.error(err, "subscriptions free-plan seed failed");
  }

  // ── Remove deprecated quota columns from plans (2026-08 policy) ───────────
  // max_homeworks_per_month and ai_usage_daily_limit are no longer used;
  // manual work is unlimited and AI cost is governed by Hasad credits.
  try {
    await db.execute(sql`
      ALTER TABLE plans
        DROP COLUMN IF EXISTS max_homeworks_per_month,
        DROP COLUMN IF EXISTS ai_usage_daily_limit
    `);
    logger.info("plans: deprecated quota columns removed");
  } catch (err) {
    logger.error(err, "plans: quota column drop failed");
  }
}

async function backfillAdminSharedApproval() {
  try {
    // Admin is the approver, so admin-owned is_shared rows are auto-approved.
    // Run after seedAdmins so freshly-seeded admins are included on first boot.
    await db.execute(sql`
      UPDATE assignments SET is_share_approved = true
      WHERE is_shared = true
        AND is_share_approved = false
        AND teacher_id IN (SELECT id FROM teachers WHERE is_admin = true)
    `);
  } catch (err) {
    logger.error(err, "Admin-share backfill failed");
  }
}

async function seedAdmins() {
  try {
    await db.update(teachersTable)
      .set({ isAdmin: true, role: "admin" })
      .where(inArray(teachersTable.email, [...CONFIGURED_ADMIN_EMAILS]));
    logger.info("Configured admin emails seeded");
  } catch (err) {
    logger.error(err, "Failed to seed admins");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  maxHttpBufferSize: 1e6,
  cors: {
    origin: corsOriginFn,
    credentials: true,
  },
  path: "/api/socket.io",
});
setRealtimeServer(io);

// The root namespace intentionally combines the independent realtime game
// modules below. It currently has 14 static connection handlers, while each
// socket receives their corresponding event/disconnect handlers. Keep a
// finite ceiling above that known baseline so unexpected registrations still
// warn instead of disabling EventEmitter leak detection altogether.
const SOCKET_LISTENER_BUDGET = 17;
io.sockets.setMaxListeners(SOCKET_LISTENER_BUDGET);
io.use((socket, next) => {
  socket.setMaxListeners(SOCKET_LISTENER_BUDGET);
  next();
});

io.engine.use(sessionMiddleware);

setupGameSocket(io);
setupWhiteboardSocket(io);
setupTugSocket(io);
setupXoSocket(io);
setupRocketSocket(io);
setupFlagSocket(io);
setupColorSocket(io);
setupVideoSocket(io);
setupScrambleSocket(io);
setupEscapeSocket(io);
setupCapitalSocket(io);
setupMillionTeamSocket(io);
setupMillionClassSocket(io);
setupArenaSocket(io);
setupHotSeatSocket(io);
setupSecretGameSocket(io);
setupPresentationSocket(io);
bindXpSocket(io);

// Subscribe each authenticated teacher to their own room so XP toasts route correctly.
io.on("connection", (socket) => {
  const req = socket.request as unknown as { session?: { teacherId?: number } };
  const teacherId = req.session?.teacherId;
  if (typeof teacherId === "number") {
    socket.join(`teacher:${teacherId}`);
  }
});

/* Start listening immediately so the startup health probe at /api/healthz
   gets a 200 response right away, even while migrations are still running.
   All schema changes use IF NOT EXISTS / IF NOT EXISTS so they complete in
   milliseconds on a warm database — this is purely defensive against slow
   cold-start DB connections timing out the health check. */
httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  /* Run migrations + seeds in the background after the port is open. */
  ensureSessionTable()
    .then(() => runSchemaMigrations())
    .then(() => db.execute(XP_MIGRATION_SQL))
    .then(async () => {
      seedAdmins().then(() => backfillAdminSharedApproval());
      seedPlansIfMissing();
      seedMillionBankIfEmpty();
      // The dedicated reveal-question seed relies on the section created by
      // the canonical seed, so these must remain ordered.
      await seedIslamicIfNeeded();
      await seedTaarifAyatShortIfNeeded();
      await seedIstihdarAyatIfNeeded();
      seedIslamicExtraIfNeeded();
      seedIslamicLevelsIfNeeded();
      seedArenaContentIfNeeded();
      seedStaticArenaIfNeeded();
      seedSecretGameIfNeeded();
      seedXpDefaultsIfNeeded();
      await seedKidsCatalogV1();
      setKidsReady(true);
      startPasswordResetCleanupJob();
      startLibraryOrphanSweepJob();
      startActivityLogsCleanupJob();
      startOnlineSessionsCleanupJob();
      startEmailOutboxWorker();
      startMissingWelcomeCreditsAlertJob();
      startAnnualCreditReleaseJob();

      import("./lib/ai-video-renderer").then(({
        failStaleAiVideoRenders,
        failStaleAiVideoStoryboards,
      }) => {
        const recoverExpiredRenders = () => {
          Promise.all([
            failStaleAiVideoStoryboards(),
            failStaleAiVideoRenders(),
          ]).then(([storyboards, renders]) => {
            if (storyboards > 0) {
              logger.warn({ count: storyboards }, "Recovered expired AI video storyboard leases");
            }
            if (renders > 0) {
              logger.warn({ count: renders }, "Recovered expired AI video render leases");
            }
          }).catch((err) => {
            logger.warn({ err }, "AI video stale-work recovery failed");
          });
        };
        recoverExpiredRenders();
        setInterval(recoverExpiredRenders, 60_000).unref();
      }).catch((err) => {
        logger.warn({ err }, "Failed to start AI video render recovery");
      });

      import("./lib/ai-video-source-images").then(({
        deleteStaleUnclaimedAiVideoSourceImages,
      }) => {
        const cleanupSourceImages = () => {
          deleteStaleUnclaimedAiVideoSourceImages().then((deleted) => {
            if (deleted > 0) {
              logger.info({ deleted }, "Deleted stale unclaimed AI video source images");
            }
          }).catch((err) => {
            logger.warn({ err }, "AI video source image cleanup failed");
          });
        };
        cleanupSourceImages();
        setInterval(cleanupSourceImages, 60 * 60 * 1000).unref();
      }).catch((err) => {
        logger.warn({ err }, "Failed to start AI video source image cleanup");
      });

      // ── Credits: auto-refund stale holds every 60s ─────────────────────────
      import("./lib/credit-service").then(({ CreditService }) => {
        setInterval(() => {
          CreditService.autoRefundStaleHolds().catch((err) => {
            logger.warn({ err }, "Auto-refund stale holds failed");
          });
        }, 60_000);
        logger.info("Credits auto-refund cron started");
      }).catch((err) => {
        logger.warn({ err }, "Failed to start credits auto-refund cron");
      });
    })
    .catch((err) => {
      logger.error(err, "Post-startup migrations/seeds failed");
    });
});
