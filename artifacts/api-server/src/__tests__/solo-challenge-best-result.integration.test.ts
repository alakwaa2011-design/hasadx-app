/**
 * اختبار تكاملي لحفظ أفضل نتيجة عند تعدد محاولات المشارك نفسه.
 *
 * يعمل عبر vitest.integration.config.ts فقط، حيث تُستخدم قاعدة TEST_DATABASE_URL.
 * يثبت أن محاولتين موثقتين تشتركان في سجل نتيجة واحد، وأن الاستعادة من إثبات
 * أي محاولة تُرجع النتيجة الأفضل المحفوظة.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { persistSoloChallengeResult } from "../lib/solo-challenge-results";
import soloChallengesRouter from "../routes/solo-challenges";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const runId = randomUUID().replaceAll("-", "");
const slug = `best-result-${runId.slice(0, 16)}`;
const participantKey = `participant-${runId.slice(0, 20)}`;
const firstGameRunId = `run-first-${runId.slice(0, 20)}`;
const bestGameRunId = `run-best-${runId.slice(0, 20)}`;

let teacherId = 0;

function makeGame(gameRunId: string, score: number) {
  return {
    soloChallengeSlug: slug,
    gameRunId,
    questions: [{ id: 1 }, { id: 2 }, { id: 3 }] as any[],
    players: new Map([
      ["socket", {
        name: "طالب الاختبار",
        isBot: false,
        score,
        totalCorrect: 2,
        answers: new Map([
          [0, { time: 4000 }],
          [1, { time: 6000 }],
        ]),
      }],
    ]),
  } as any;
}

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { error: () => undefined };
    next();
  });
  app.use("/api", soloChallengesRouter);
  return app;
}

describe.skipIf(!RUN_INTEGRATION)("solo challenge best result — integration", () => {
  beforeAll(async () => {
    if (!RUN_INTEGRATION) return;

    // The integration suite connects directly to PostgreSQL without starting
    // the API entrypoint, so apply the small runtime migration this test needs.
    await db.execute(sql`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE solo_challenge_scores
        ADD COLUMN IF NOT EXISTS participant_key TEXT,
        ADD COLUMN IF NOT EXISTS game_run_id TEXT,
        ADD COLUMN IF NOT EXISTS correct_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS time_taken INTEGER,
        ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_scores_participant_idx
      ON solo_challenge_scores(slug, participant_key)
      WHERE participant_key IS NOT NULL
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_scores_game_run_idx
      ON solo_challenge_scores(game_run_id)
      WHERE game_run_id IS NOT NULL
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenge_attempts (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        game_run_id TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS solo_challenge_attempts_game_run_idx
      ON solo_challenge_attempts(game_run_id)
    `);

    const teacher = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, created_at)
      VALUES ('أفضل نتيجة - اختبار', ${`${runId}@test.local`}, 'x', NOW())
      RETURNING id
    `);
    teacherId = Number((teacher.rows[0] as any).id);

    await db.execute(sql`
      INSERT INTO solo_challenges (slug, assignment_id, teacher_id, assignment_title)
      VALUES (${slug}, NULL, ${teacherId}, 'اختبار أفضل نتيجة')
    `);

    await db.execute(sql`
      INSERT INTO solo_challenge_attempts (slug, participant_key, game_run_id)
      VALUES
        (${slug}, ${participantKey}, ${firstGameRunId}),
        (${slug}, ${participantKey}, ${bestGameRunId})
    `);
  });

  afterAll(async () => {
    if (!RUN_INTEGRATION) return;

    await db.execute(sql`DELETE FROM solo_challenge_scores WHERE slug = ${slug}`);
    await db.execute(sql`DELETE FROM solo_challenge_attempts WHERE slug = ${slug}`);
    await db.execute(sql`DELETE FROM solo_challenges WHERE slug = ${slug}`);
    if (teacherId) {
      await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    }
  });

  it("keeps one highest result and recovers it through either verified attempt", async () => {
    await expect(persistSoloChallengeResult(makeGame(firstGameRunId, 240))).resolves.toBe("created");
    await expect(persistSoloChallengeResult(makeGame(bestGameRunId, 480))).resolves.toBe("updated");

    // Terminal retries for either attempt must not create another score row.
    await expect(persistSoloChallengeResult(makeGame(bestGameRunId, 480))).resolves.toBe("duplicate");
    await expect(persistSoloChallengeResult(makeGame(firstGameRunId, 240))).resolves.toBe("kept");

    const storedScores = await db.execute(sql`
      SELECT game_run_id, score, correct_count, time_taken, total_questions
      FROM solo_challenge_scores
      WHERE slug = ${slug} AND participant_key = ${participantKey}
    `);
    expect(storedScores.rows).toEqual([
      expect.objectContaining({
        game_run_id: bestGameRunId,
        score: 480,
        correct_count: 2,
        time_taken: 10,
        total_questions: 3,
      }),
    ]);

    const storedAttempts = await db.execute(sql`
      SELECT game_run_id
      FROM solo_challenge_attempts
      WHERE slug = ${slug} AND participant_key = ${participantKey}
      ORDER BY game_run_id
    `);
    expect(storedAttempts.rows).toHaveLength(2);

    const app = makeApp();
    for (const scoreProof of [firstGameRunId, bestGameRunId]) {
      const recovered = await request(app)
        .get(`/api/solo-challenges/${slug}/result`)
        .query({ participantKey, scoreProof });

      expect(recovered.status, JSON.stringify(recovered.body)).toBe(200);
      expect(recovered.body).toMatchObject({
        ok: true,
        playerName: "طالب الاختبار",
        score: 480,
        correctCount: 2,
        timeTaken: 10,
        totalQuestions: 3,
      });
    }
  });
});