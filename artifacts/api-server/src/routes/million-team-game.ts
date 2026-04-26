/**
 * REST API for Team vs Team Million Game.
 *
 * Architecture note: Core gameplay (join, start, vote, timer, reveal) is
 * handled exclusively via Socket.IO events prefixed with `million-team:`.
 * Real-time bidirectional communication is required for sub-second vote
 * updates, server-managed timers, and majority tracking — HTTP polling would
 * introduce unacceptable latency for these operations.
 *
 * This HTTP layer covers:
 *   - Session lifecycle records (created/finished, winner, prize levels)
 *   - Per-round vote persistence (team_answer, correct_answer, prize_won)
 *   - Live-status read endpoint for external dashboards / post-game analytics
 *   - Historical session listing
 */
import { Router } from "express";
import { db, millionTeamSessionsTable, millionTeamVotesTable } from "@workspace/db";
import { desc, eq, isNull, or } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.post("/million/team-sessions", async (req, res) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  try {
    const { pin, totalQuestions } = req.body as { pin?: string; totalQuestions?: number };
    if (!pin || !totalQuestions) {
      return res.status(400).json({ message: "بيانات غير مكتملة" });
    }

    const [session] = await db
      .insert(millionTeamSessionsTable)
      .values({ pin, totalQuestions, teacherId: req.session.teacherId })
      .returning({ id: millionTeamSessionsTable.id });

    return res.status(201).json({ id: session.id });
  } catch (err) {
    logger.error(err, "POST /million/team-sessions error");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

router.post("/million/team-sessions/:pin/finish", async (req, res) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  try {
    const { pin } = req.params;
    const body = req.body as {
      winner?: string;
      teamAPoints?: number;
      teamBPoints?: number;
      teamAPrize?: number;
      teamBPrize?: number;
      teamAPlayers?: number;
      teamBPlayers?: number;
    };

    // Verify ownership: only the teacher who created the session (or legacy
    // sessions with no recorded owner) can finish it.
    const [existing] = await db
      .select({ teacherId: millionTeamSessionsTable.teacherId })
      .from(millionTeamSessionsTable)
      .where(eq(millionTeamSessionsTable.pin, pin))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "الجلسة غير موجودة" });
    }
    if (existing.teacherId != null && existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح بتعديل هذه الجلسة" });
    }

    await db
      .update(millionTeamSessionsTable)
      .set({
        winner: body.winner ?? null,
        teamAPoints: body.teamAPoints ?? 0,
        teamBPoints: body.teamBPoints ?? 0,
        teamAPrize: body.teamAPrize ?? 0,
        teamBPrize: body.teamBPrize ?? 0,
        teamAPlayers: body.teamAPlayers ?? 0,
        teamBPlayers: body.teamBPlayers ?? 0,
        finishedAt: new Date(),
      })
      .where(eq(millionTeamSessionsTable.pin, pin));

    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "POST /million/team-sessions/:pin/finish error");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

router.get("/million/team-sessions/:pin/live", async (req, res) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  try {
    const { pin } = req.params;

    const [session] = await db
      .select()
      .from(millionTeamSessionsTable)
      .where(eq(millionTeamSessionsTable.pin, pin))
      .limit(1);

    if (!session) {
      return res.status(404).json({ message: "الجلسة غير موجودة" });
    }
    if (session.teacherId != null && session.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح بعرض هذه الجلسة" });
    }

    const votes = await db
      .select()
      .from(millionTeamVotesTable)
      .where(eq(millionTeamVotesTable.sessionPin, pin))
      .orderBy(millionTeamVotesTable.questionIndex);

    return res.json({ session, votes });
  } catch (err) {
    logger.error(err, "GET /million/team-sessions/:pin/live error");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

router.get("/million/team-sessions", async (req, res) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  try {
    const sessions = await db
      .select()
      .from(millionTeamSessionsTable)
      .where(
        or(
          eq(millionTeamSessionsTable.teacherId, req.session.teacherId),
          isNull(millionTeamSessionsTable.teacherId),
        ),
      )
      .orderBy(desc(millionTeamSessionsTable.createdAt))
      .limit(20);
    return res.json(sessions);
  } catch (err) {
    logger.error(err, "GET /million/team-sessions error");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

export default router;
