/*
 * Backfill assignments.content_kind = 'competition' for legacy rows
 * (Task #598).
 *
 * The `content_kind` column was introduced after most assignments were
 * already created, so every legacy row defaulted to 'homework'. As a
 * result the new "مكتبة المسابقات الجاهزة" (competitions library) is
 * empty even though plenty of older rows were genuinely competitions
 * (Kahoot-style live games, presentation activity slides, …).
 *
 * This script flips content_kind to 'competition' for rows that match
 * conservative competition heuristics:
 *
 *   1. Row exists in `game_history`  → it has been launched at least
 *      once as a live multiplayer game. This is the strongest signal.
 *   2. `from_presentation_slide IS NOT NULL` → row was auto-created
 *      from a live presentation activity slide (always a competition).
 *   3. Title contains the Arabic word "مسابقة" or the English word
 *      "competition" / "contest" (case-insensitive).
 *
 * Only rows currently set to the default 'homework' are touched and
 * adaptive / listening / exam rows are left alone — they are clearly
 * not competitions even if they happen to match a title keyword.
 *
 * The script is idempotent: re-running it after the first pass is a
 * no-op (every matched row will already be 'competition').
 *
 * Run with:  pnpm --filter @workspace/scripts run backfill:content-kind
 *
 * Pass `--dry-run` to print the candidate rows without writing.
 */
import { Client } from "pg";

interface Candidate {
  id: number;
  title: string;
  reason: string;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const dryRun = process.argv.includes("--dry-run");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Build the candidate set in SQL so we touch each row once.
    // Every condition is OR'd; we exclude rows that are already
    // 'competition' so re-runs are no-ops.
    const candidatesSql = `
      WITH candidates AS (
        SELECT
          a.id,
          a.title,
          CASE
            WHEN EXISTS (SELECT 1 FROM game_history gh WHERE gh.assignment_id = a.id)
              THEN 'played-as-live-game'
            WHEN a.from_presentation_slide IS NOT NULL
              THEN 'from-presentation-slide'
            WHEN a.title ILIKE '%مسابقة%'
              OR a.title ILIKE '%competition%'
              OR a.title ILIKE '%contest%'
              THEN 'title-keyword'
            ELSE NULL
          END AS reason
        FROM assignments a
        WHERE a.content_kind = 'homework'
          AND a.exam_mode = false
          AND a.is_adaptive = false
          AND a.activity_type IS DISTINCT FROM 'listening'
      )
      SELECT id, title, reason
      FROM candidates
      WHERE reason IS NOT NULL
      ORDER BY id ASC;
    `;

    const { rows } = await client.query<Candidate>(candidatesSql);

    if (rows.length === 0) {
      console.log("No legacy assignments matched competition heuristics — nothing to backfill.");
      return;
    }

    const byReason = new Map<string, number>();
    for (const r of rows) {
      byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
    }

    console.log(`Found ${rows.length} legacy assignment(s) to flip → 'competition':`);
    for (const [reason, count] of byReason) {
      console.log(`  • ${reason}: ${count}`);
    }
    console.log("");
    const preview = rows.slice(0, 10);
    for (const r of preview) {
      console.log(`  #${r.id}  [${r.reason}]  ${r.title}`);
    }
    if (rows.length > preview.length) {
      console.log(`  … and ${rows.length - preview.length} more`);
    }

    if (dryRun) {
      console.log("\n--dry-run set, no rows updated.");
      return;
    }

    const ids = rows.map((r) => r.id);
    const updateSql = `
      UPDATE assignments
      SET content_kind = 'competition'
      WHERE id = ANY($1::int[])
        AND content_kind = 'homework';
    `;
    const result = await client.query(updateSql, [ids]);
    console.log(`\nUpdated ${result.rowCount ?? 0} assignment(s) → content_kind = 'competition'.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
