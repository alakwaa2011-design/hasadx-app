import { and, eq, sql } from "drizzle-orm";
import {
  db,
  soloChallengeAttemptsTable,
  soloChallengeScoresTable,
} from "@workspace/db";
import type { Game } from "../game/manager";

export type SoloChallengeResultPersistence =
  | "created"
  | "updated"
  | "kept"
  | "duplicate"
  | "not_solo_challenge"
  | "missing_attempt"
  | "missing_player";

/**
 * Store the verified result before the in-memory game is discarded.
 *
 * The attempt row is the server-owned link between a participant capability
 * and a game run. The browser never supplies score values to this function.
 * The unique participant/game-run indexes plus the participant advisory lock
 * keep finish retries idempotent when more than one terminal path fires.
 */
export async function persistSoloChallengeResult(
  game: Pick<Game, "soloChallengeSlug" | "gameRunId" | "players" | "questions">,
): Promise<SoloChallengeResultPersistence> {
  const slug = game.soloChallengeSlug;
  if (!slug) return "not_solo_challenge";

  const player = Array.from(game.players.values()).find((candidate) => !candidate.isBot);
  if (!player) return "missing_player";

  const nextScore = Math.max(0, Math.round(player.score));
  const nextCorrectCount = Math.max(0, Math.round(player.totalCorrect));
  const verifiedTimeTaken = Math.max(
    0,
    Math.round(
      Array.from(player.answers.values()).reduce((sum, answer) => sum + answer.time, 0) / 1000,
    ),
  );

  const [attempt] = await db
    .select({ participantKey: soloChallengeAttemptsTable.participantKey })
    .from(soloChallengeAttemptsTable)
    .where(and(
      eq(soloChallengeAttemptsTable.slug, slug),
      eq(soloChallengeAttemptsTable.gameRunId, game.gameRunId),
    ))
    .limit(1);
  if (!attempt) return "missing_attempt";

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${slug}:${attempt.participantKey}`}))`);

    const [existingScore] = await tx
      .select({
        gameRunId: soloChallengeScoresTable.gameRunId,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
      })
      .from(soloChallengeScoresTable)
      .where(and(
        eq(soloChallengeScoresTable.slug, slug),
        eq(soloChallengeScoresTable.participantKey, attempt.participantKey),
      ))
      .limit(1);

    if (existingScore?.gameRunId === game.gameRunId) return "duplicate";

    const isBetter = !existingScore ||
      nextCorrectCount > existingScore.correctCount ||
      (nextCorrectCount === existingScore.correctCount &&
        (verifiedTimeTaken < (existingScore.timeTaken ?? Number.MAX_SAFE_INTEGER) ||
          (verifiedTimeTaken === (existingScore.timeTaken ?? Number.MAX_SAFE_INTEGER) &&
            nextScore > existingScore.score)));

    if (!existingScore) {
      await tx.insert(soloChallengeScoresTable).values({
        slug,
        participantKey: attempt.participantKey,
        gameRunId: game.gameRunId,
        playerName: player.name,
        score: nextScore,
        correctCount: nextCorrectCount,
        timeTaken: verifiedTimeTaken,
        totalQuestions: game.questions.length,
      });
      return "created";
    }

    if (!isBetter) return "kept";

    await tx
      .update(soloChallengeScoresTable)
      .set({
        gameRunId: game.gameRunId,
        playerName: player.name,
        score: nextScore,
        correctCount: nextCorrectCount,
        timeTaken: verifiedTimeTaken,
        totalQuestions: game.questions.length,
        playedAt: new Date(),
      })
      .where(and(
        eq(soloChallengeScoresTable.slug, slug),
        eq(soloChallengeScoresTable.participantKey, attempt.participantKey),
      ));
    return "updated";
  });
}