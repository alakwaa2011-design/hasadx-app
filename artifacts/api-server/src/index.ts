import "./instrument";
import { createServer } from "http";
import { Server } from "socket.io";
import app, { sessionMiddleware, ensureSessionTable, corsOriginFn } from "./app";
import { logger } from "./lib/logger";
import { setupGameSocket } from "./game/socket-handlers";
import { setupWhiteboardSocket } from "./game/whiteboard-handlers";
import { setupTugSocket } from "./game/tug-handlers";
import { setupRocketSocket } from "./game/rocket-handlers";
import { setupFlagSocket } from "./game/flag-socket-handlers";
import { setupColorSocket } from "./game/color-socket-handlers";
import { setupVideoSocket } from "./game/video-socket-handlers";
import { setupScrambleSocket } from "./game/scramble-socket-handlers";
import { setupCapitalSocket } from "./game/capital-socket-handlers";
import { setupMillionTeamSocket } from "./game/million-team-handlers";
import { setupMillionClassSocket } from "./game/million-class-handlers";
import { setupArenaSocket } from "./game/arena-handlers";
import { setupHotSeatSocket } from "./game/hotseat-handlers";
import { setupPresentationSocket } from "./game/presentation-handlers";
import { db, teachersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { seedMillionBankIfEmpty } from "./seedMillionBank";
import { seedIslamicIfNeeded } from "./seedIslamic";
import { seedIslamicExtraIfNeeded } from "./seedIslamicExtra";
import { seedPlansIfMissing } from "./seedPlans";
import { seedArenaContentIfNeeded } from "./seedArenaContent";
import { startPasswordResetCleanupJob } from "./lib/password-reset-cleanup";
import { startLibraryOrphanSweepJob } from "./lib/library-orphan-sweep";
import { startActivityLogsCleanupJob } from "./lib/activity-logger";

const ADMIN_EMAILS = ["alakwaa2011@gmail.com", "marwanakwaa@yahoo.com"];

async function runSchemaMigrations() {
  try {
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
    await db.execute(sql`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS account_username TEXT,
        ADD COLUMN IF NOT EXISTS student_account_id INTEGER
    `);
    await db.execute(sql`
      ALTER TABLE assignments
        ADD COLUMN IF NOT EXISTS target_classes TEXT[]
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
      CREATE TABLE IF NOT EXISTS lesson_plans (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
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
    logger.info("Schema migrations applied");
  } catch (err) {
    logger.error(err, "Schema migration failed");
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
      .where(inArray(teachersTable.email, ADMIN_EMAILS));
    logger.info({ emails: ADMIN_EMAILS }, "Admin emails seeded");
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

io.engine.use(sessionMiddleware);

setupGameSocket(io);
setupWhiteboardSocket(io);
setupTugSocket(io);
setupRocketSocket(io);
setupFlagSocket(io);
setupColorSocket(io);
setupVideoSocket(io);
setupScrambleSocket(io);
setupCapitalSocket(io);
setupMillionTeamSocket(io);
setupMillionClassSocket(io);
setupArenaSocket(io);
setupHotSeatSocket(io);
setupPresentationSocket(io);

ensureSessionTable()
  .then(() => runSchemaMigrations())
  .then(() => {
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening");
      seedAdmins().then(() => backfillAdminSharedApproval());
      seedPlansIfMissing();
      seedMillionBankIfEmpty();
      seedIslamicIfNeeded();
      seedIslamicExtraIfNeeded();
      seedArenaContentIfNeeded();
      startPasswordResetCleanupJob();
      startLibraryOrphanSweepJob();
      startActivityLogsCleanupJob();
    });
  })
  .catch((err) => {
    logger.error(err, "Failed to start server");
    process.exit(1);
  });
