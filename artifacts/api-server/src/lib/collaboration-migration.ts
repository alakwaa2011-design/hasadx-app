import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function migrateCollaborationBoards() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS collaboration_boards (
      id uuid PRIMARY KEY, teacher_id integer NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      client_id uuid NOT NULL, pin varchar(8) NOT NULL, data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS collaboration_boards_pin_unique ON collaboration_boards(pin)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS collaboration_boards_retry_unique ON collaboration_boards(teacher_id, client_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS collaboration_boards_teacher_idx ON collaboration_boards(teacher_id)`);
}
