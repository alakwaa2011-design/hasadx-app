/**
 * Direct Play — رابط لعب مباشر
 *
 * Public endpoints that let anyone open an assignment link and play a solo
 * Wameeth game instantly — no login, no PIN, no teacher presence required.
 * Each visitor gets their own independent game session.
 *
 * Routes:
 *   GET  /api/assignments/:id/play-info   — public info for the landing page
 *   POST /api/assignments/:id/direct-play — create solo game, return PIN
 */
import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { createGame, type GameQuestion } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";

const router: IRouter = Router();

// ── GET /api/assignments/:id/play-info  (public, no auth) ─────────────────
router.get("/assignments/:id/play-info", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ message: "معرّف غير صالح" });
    }

    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      return res.status(404).json({ message: "النشاط غير موجود" });
    }

    const [cnt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.assignmentId, id),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ),
      );

    const questionCount = cnt?.count ?? 0;
    if (questionCount === 0) {
      return res.status(404).json({ message: "لا توجد أسئلة في هذا النشاط" });
    }

    return res.json({ id: assignment.id, title: assignment.title, questionCount });
  } catch (err) {
    req.log.error(err, "direct-play/play-info error");
    return res.status(500).json({ message: "خطأ في تحميل بيانات النشاط" });
  }
});

// ── POST /api/assignments/:id/direct-play  (public, no auth) ──────────────
router.post("/assignments/:id/direct-play", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ message: "معرّف غير صالح" });
    }

    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      return res.status(404).json({ message: "النشاط غير موجود" });
    }

    const dbQuestions = await db
      .select()
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.assignmentId, id),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ),
      );

    if (dbQuestions.length === 0) {
      return res.status(400).json({ message: "لا توجد أسئلة في هذا النشاط" });
    }

    const duration = 20; // ثانية لكل سؤال
    const gameQuestions: GameQuestion[] = dbQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      questionType: q.questionType as string,
      optionA: q.optionA ?? null,
      optionB: q.optionB ?? null,
      optionC: q.optionC ?? null,
      optionD: q.optionD ?? null,
      correctAnswer: q.correctAnswer ?? "",
      points: 100,
      duration,
      imageUrl: q.imageUrl ?? null,
      readAloud: q.readAloud ?? false,
      difficulty: q.difficulty ?? null,
    }));

    // كل زائر يحصل على جلسة مستقلة (نفس نمط المسابقة الذاتية).
    const game = createGame(
      assignment.id,
      assignment.title,
      "guest",  // لا معلم في الجلسة
      0,
      gameQuestions,
      duration,
      true,     // autoAdvance
      "solo",
      2,
      undefined, // teamNames
      null,      // targetClass
      false,     // hackMode
      null,      // targetClasses
      false,     // preserveOrder — يُخلط للزائر تلقائياً
    );

    startGameFromRest(game.pin);

    return res.json({
      pin: game.pin,
      title: assignment.title,
      questionCount: gameQuestions.length,
    });
  } catch (err) {
    req.log.error(err, "direct-play/start error");
    return res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

export default router;
