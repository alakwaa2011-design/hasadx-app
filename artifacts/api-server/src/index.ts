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
import { db, teachersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { seedMillionBankIfEmpty } from "./seedMillionBank";
import { startPasswordResetCleanupJob } from "./lib/password-reset-cleanup";
import { startLibraryOrphanSweepJob } from "./lib/library-orphan-sweep";

const ADMIN_EMAILS = ["alakwaa2011@gmail.com", "marwanakwaa@yahoo.com"];

async function runSchemaMigrations() {
  try {
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
      .set({ isAdmin: true })
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

ensureSessionTable()
  .then(() => runSchemaMigrations())
  .then(() => {
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening");
      seedAdmins().then(() => backfillAdminSharedApproval());
      seedMillionBankIfEmpty();
      startPasswordResetCleanupJob();
      startLibraryOrphanSweepJob();
    });
  })
  .catch((err) => {
    logger.error(err, "Failed to start server");
    process.exit(1);
  });
