import { Router, type IRouter } from "express";
import { db, gameHistoryTable, studentsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import type { Game, GamePlayer, GameQuestion } from "../game/manager.js";
import { getGame } from "../game/manager.js";

interface AnswerDetail {
  questionIndex: number;
  questionText: string;
  answer: string;
  correct: boolean;
  points: number;
  time: number;
}

interface PlayerResult {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  teamName: string | null;
  answers: AnswerDetail[];
}

interface TopPlayer {
  name: string;
  avatar: string;
  score: number;
}

function buildDetailedResults(game: Game): PlayerResult[] {
  return Array.from(game.players.values())
    .filter((p: GamePlayer) => !p.isBot)
    .sort((a: GamePlayer, b: GamePlayer) => b.score - a.score)
    .map((p: GamePlayer, idx: number) => {
      const answersArr: AnswerDetail[] = [];
      for (const [qIdx, ans] of p.answers.entries()) {
        const q: GameQuestion | undefined = game.questions[qIdx];
        answersArr.push({
          questionIndex: qIdx,
          questionText: q?.text || `سؤال ${qIdx + 1}`,
          answer: ans.answer,
          correct: ans.correct,
          points: ans.points,
          time: ans.time,
        });
      }
      return {
        rank: idx + 1,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        totalCorrect: p.totalCorrect,
        totalQuestions: game.questions.length,
        teamName: p.teamName,
        answers: answersArr,
      };
    });
}

const router: IRouter = Router();

router.get("/tug-game-info/:pin", async (req, res) => {
  const { getTugGame } = await import("../game/tug-handlers");
  const game = getTugGame(req.params.pin);
  if (!game) {
    res.json({ exists: false });
    return;
  }
  const info: any = { exists: true, targetClass: game.targetClass || null };
  if (game.targetClass && game.teacherId) {
    try {
      const students = await db
        .select({ name: studentsTable.name })
        .from(studentsTable)
        .where(and(eq(studentsTable.teacherId, game.teacherId), eq(studentsTable.gradeLevel, game.targetClass)));
      info.students = students.map(s => ({ name: s.name }));
    } catch {
      info.students = [];
    }
  }
  res.json(info);
});

router.get("/game-info/:pin", async (req, res) => {
  const game = getGame(req.params.pin);
  if (!game) {
    res.json({ exists: false });
    return;
  }
  const classList = (game.targetClasses && game.targetClasses.length > 0)
    ? game.targetClasses
    : (game.targetClass ? [game.targetClass] : []);
  const info: any = {
    exists: true,
    targetClass: game.targetClass,
    targetClasses: classList,
    assignmentTitle: game.assignmentTitle,
    hackMode: !!game.hackMode,
  };
  if (classList.length > 0 && game.teacherId) {
    try {
      const { inArray } = await import("drizzle-orm");
      const students = await db
        .select({ id: studentsTable.id, name: studentsTable.name, gradeLevel: studentsTable.gradeLevel })
        .from(studentsTable)
        .where(and(eq(studentsTable.teacherId, game.teacherId), inArray(studentsTable.gradeLevel, classList)));
      info.students = students;
    } catch {
      info.students = [];
    }
  }
  res.json(info);
});

router.get("/game-history", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const history = await db
      .select({
        id: gameHistoryTable.id,
        teacherId: gameHistoryTable.teacherId,
        assignmentId: gameHistoryTable.assignmentId,
        assignmentTitle: gameHistoryTable.assignmentTitle,
        pin: gameHistoryTable.pin,
        playerCount: gameHistoryTable.playerCount,
        questionCount: gameHistoryTable.questionCount,
        winnerName: gameHistoryTable.winnerName,
        winnerAvatar: gameHistoryTable.winnerAvatar,
        winnerScore: gameHistoryTable.winnerScore,
        topPlayers: gameHistoryTable.topPlayers,
        gameMode: gameHistoryTable.gameMode,
        createdAt: gameHistoryTable.createdAt,
      })
      .from(gameHistoryTable)
      .where(eq(gameHistoryTable.teacherId, teacherId))
      .orderBy(desc(gameHistoryTable.createdAt))
      .limit(50);

    res.json(history);
  } catch {
    res.status(500).json({ error: "Failed to fetch game history" });
  }
});

router.get("/game-history/:id", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [record] = await db
      .select()
      .from(gameHistoryTable)
      .where(and(eq(gameHistoryTable.id, id), eq(gameHistoryTable.teacherId, teacherId)))
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(record);
  } catch {
    res.status(500).json({ error: "Failed to fetch game details" });
  }
});

router.post("/game-history/save/:pin", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const pin = req.params.pin;

    const existing = await db
      .select({ id: gameHistoryTable.id })
      .from(gameHistoryTable)
      .where(and(eq(gameHistoryTable.pin, pin), eq(gameHistoryTable.teacherId, teacherId)))
      .limit(1);

    if (existing.length > 0) {
      res.json({ success: true, message: "already_saved", id: existing[0].id });
      return;
    }

    const { getGame, getLeaderboard } = await import("../game/manager.js");
    const game = getGame(pin);
    if (!game) {
      res.status(404).json({ error: "Game not found or already cleaned up" });
      return;
    }
    if (game.teacherId !== teacherId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const leaderboard = getLeaderboard(game);
    const humanLeaderboard = leaderboard.filter((p: { name: string; score: number; avatar: string }) => {
      const pl = Array.from(game.players.values()).find((x: GamePlayer) => x.name === p.name);
      return pl && !pl.isBot;
    });
    const rankingList = humanLeaderboard.length > 0 ? humanLeaderboard : leaderboard;
    const winner = rankingList[0];
    const topPlayers: TopPlayer[] = rankingList.slice(0, 5).map((p: { name: string; score: number; avatar: string }) => ({
      name: p.name,
      avatar: p.avatar,
      score: p.score,
    }));

    const detailedResults = buildDetailedResults(game);

    const [inserted] = await db.insert(gameHistoryTable).values({
      teacherId: game.teacherId,
      assignmentId: game.assignmentId,
      assignmentTitle: game.assignmentTitle,
      pin: game.pin,
      playerCount: game.players.size,
      questionCount: game.questions.length,
      winnerName: winner?.name || null,
      winnerAvatar: winner?.avatar || null,
      winnerScore: winner?.score || null,
      topPlayers: topPlayers,
      gameMode: game.gameMode,
      detailedResults: detailedResults,
    }).returning({ id: gameHistoryTable.id });

    res.json({ success: true, message: "saved", id: inserted.id });
  } catch {
    res.status(500).json({ error: "Failed to save game results" });
  }
});

export default router;
