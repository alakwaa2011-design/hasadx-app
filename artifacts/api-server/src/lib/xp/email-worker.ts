import { db, emailOutboxTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { sendEmail } from "../email";

const TICK_MS = 30_000;
const STARTUP_DELAY_MS = 15_000;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const BACKOFF_STEPS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
];
/** If a row is left in 'processing' for longer than this, treat it as
 *  abandoned (the worker that claimed it crashed/restarted) and let it be
 *  reclaimed on the next tick. */
const STUCK_PROCESSING_MS = 5 * 60_000;

let inFlight = false;

function backoffFor(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[idx] ?? BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1]!;
}

interface ClaimedRow {
  id: number;
  to_email: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  kind: string;
  ref_key: string;
  attempts: number;
  [key: string]: unknown;
}

/**
 * Atomically claim up to BATCH_SIZE due rows by transitioning them from
 * 'pending' (or stuck 'processing') to 'processing'. Uses FOR UPDATE SKIP
 * LOCKED so multiple workers / overlapping ticks never claim the same row.
 */
async function claimDueRows(limit: number): Promise<ClaimedRow[]> {
  const stuckCutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const claimedAt = new Date();
  const result = await db.execute<ClaimedRow>(sql`
    WITH due AS (
      SELECT id
      FROM email_outbox
      WHERE (
              status = 'pending'
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
            )
         OR (
              status = 'processing'
              AND sent_at IS NOT NULL
              AND sent_at <= ${stuckCutoff}
            )
      ORDER BY COALESCE(next_attempt_at, created_at) ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE email_outbox
    SET status = 'processing', sent_at = ${claimedAt}
    WHERE id IN (SELECT id FROM due)
    RETURNING id, to_email, subject, html_body, text_body, kind, ref_key, attempts
  `);
  return result.rows;
}

interface CycleStats {
  claimed: number;
  sent: number;
  failedTransient: number;
  failedPermanent: number;
}

async function processOnce(): Promise<CycleStats> {
  const rows = await claimDueRows(BATCH_SIZE);
  let sent = 0;
  let failedTransient = 0;
  let failedPermanent = 0;

  for (const row of rows) {
    const res = await sendEmail({
      to: row.to_email,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body ?? undefined,
    });

    if (res.delivered) {
      await db
        .update(emailOutboxTable)
        .set({
          status: "sent",
          sentAt: new Date(),
          attempts: sql`${emailOutboxTable.attempts} + 1`,
          lastError: null,
          nextAttemptAt: null,
        })
        .where(eq(emailOutboxTable.id, row.id));
      sent++;
      logger.info(
        { id: row.id, kind: row.kind, refKey: row.ref_key },
        "email_outbox_sent",
      );
      continue;
    }

    const newAttempts = row.attempts + 1;
    const giveUp = newAttempts >= MAX_ATTEMPTS;
    if (giveUp) {
      await db
        .update(emailOutboxTable)
        .set({
          status: "failed",
          attempts: newAttempts,
          lastError: res.reason ?? "unknown_error",
          sentAt: null,
          nextAttemptAt: null,
        })
        .where(eq(emailOutboxTable.id, row.id));
      failedPermanent++;
      logger.warn(
        {
          id: row.id,
          kind: row.kind,
          refKey: row.ref_key,
          reason: res.reason,
          attempts: newAttempts,
        },
        "email_outbox_failed_permanently",
      );
    } else {
      const nextAt = new Date(Date.now() + backoffFor(newAttempts - 1));
      await db
        .update(emailOutboxTable)
        .set({
          status: "pending",
          attempts: newAttempts,
          lastError: res.reason ?? "unknown_error",
          sentAt: null,
          nextAttemptAt: nextAt,
        })
        .where(eq(emailOutboxTable.id, row.id));
      failedTransient++;
      logger.warn(
        {
          id: row.id,
          kind: row.kind,
          attempts: newAttempts,
          reason: res.reason,
          nextAttemptAt: nextAt.toISOString(),
        },
        "email_outbox_retry_scheduled",
      );
    }
  }

  return {
    claimed: rows.length,
    sent,
    failedTransient,
    failedPermanent,
  };
}

export function startEmailOutboxWorker(): void {
  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await processOnce();
    } catch (err) {
      logger.warn({ err }, "email_outbox_worker_tick_failed");
    } finally {
      inFlight = false;
    }
  };
  setTimeout(tick, STARTUP_DELAY_MS);
  setInterval(tick, TICK_MS);
}

/** Drains the outbox once on demand (for admin-triggered flush). */
export async function flushEmailOutboxOnce(): Promise<CycleStats> {
  if (inFlight) {
    return { claimed: 0, sent: 0, failedTransient: 0, failedPermanent: 0 };
  }
  inFlight = true;
  try {
    return await processOnce();
  } finally {
    inFlight = false;
  }
}
