import { db, passwordResetTokensTable } from "@workspace/db";
import { lt, or, and, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 7;

export async function cleanupPasswordResetTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  try {
    const deleted = await db
      .delete(passwordResetTokensTable)
      .where(
        or(
          lt(passwordResetTokensTable.expiresAt, cutoff),
          and(
            isNotNull(passwordResetTokensTable.usedAt),
            lt(passwordResetTokensTable.usedAt, cutoff),
          ),
        ),
      )
      .returning({ id: passwordResetTokensTable.id });
    if (deleted.length > 0) {
      logger.info(
        { count: deleted.length, cutoff: cutoff.toISOString() },
        "Pruned stale password reset tokens",
      );
    }
    return deleted.length;
  } catch (err) {
    logger.error({ err }, "Failed to prune password reset tokens");
    return 0;
  }
}

export function startPasswordResetCleanupJob(): NodeJS.Timeout {
  void cleanupPasswordResetTokens();
  const handle = setInterval(() => {
    void cleanupPasswordResetTokens();
  }, CLEANUP_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return handle;
}