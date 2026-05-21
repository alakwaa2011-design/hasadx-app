import { Router, type IRouter } from "express";
import { db, gameHistoryTable, studentsTable, assignmentsTable, presentationSessionsTable } from "@workspace/db";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import type { Game, GamePlayer, GameQuestion } from "../game/manager.js";
import { getGame, findActiveGameByTeacher } from "../game/manager.js";

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

    /* Auto-tag: a game-history insert means the assignment was actually
       launched as a live game, so flip stale 'homework' rows to
       'competition' to keep the competitions library current
       (task #599). Idempotent — no-op when already 'competition'. */
    if (game.assignmentId && game.assignmentId > 0) {
      try {
        await db
          .update(assignmentsTable)
          .set({ contentKind: "competition" })
          .where(and(
            eq(assignmentsTable.id, game.assignmentId),
            eq(assignmentsTable.contentKind, "homework"),
          ));
      } catch (flipErr) {
        req.log.error({ err: flipErr, assignmentId: game.assignmentId }, "Failed to auto-tag assignment as competition");
      }
    }

    res.json({ success: true, message: "saved", id: inserted.id });
  } catch {
    res.status(500).json({ error: "Failed to save game results" });
  }
});

// ── Active game lookup for resume banner ──────────────────────────────────────
// Returns the teacher's currently-active Wameed/Hack game, if any.
// Used by the teacher dashboard to show a one-tap rejoin banner whenever a
// game is still being held alive by the server (e.g. during the disconnect
// grace period after a tab crash).
router.get("/active-game", (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const game = findActiveGameByTeacher(teacherId);
  if (!game) {
    res.json({ active: false });
    return;
  }

  let playerCount = 0;
  for (const p of game.players.values()) {
    if (!p.isBot) playerCount++;
  }

  res.json({
    active: true,
    pin: game.pin,
    title: game.assignmentTitle,
    state: game.state,
    hackMode: !!game.hackMode,
    gameMode: game.gameMode,
    playerCount,
    questionCount: game.questions.length,
    currentQuestionIndex: game.currentQuestionIndex,
  });
});

// ── Unified PIN lookup ─────────────────────────────────────────────────────────
// Returns { gameType } so the client can redirect to the correct join page.
router.get("/pin-lookup/:pin", async (req, res) => {
  const { pin } = req.params;
  if (!pin || !/^\d{6}$/.test(pin)) {
    res.json({ gameType: "unknown" });
    return;
  }

  // 1. Wameeth (main live quiz)
  const wameethGame = getGame(pin);
  if (wameethGame) { res.json({ gameType: "wameeth" }); return; }

  // 2. Tug of War
  const { getTugGame } = await import("../game/tug-handlers.js");
  if (getTugGame(pin)) { res.json({ gameType: "tug" }); return; }

  // 3. Rocket Race
  const { getRocketGame } = await import("../game/rocket-handlers.js");
  if (getRocketGame(pin)) { res.json({ gameType: "rocket" }); return; }

  // 4. HotSeat
  const { getHotSeatGame } = await import("../game/hotseat-handlers.js");
  if (getHotSeatGame(pin)) { res.json({ gameType: "hotseat" }); return; }

  // 5. Million Team
  const { getMillionTeamSession } = await import("../game/million-team-handlers.js");
  if (getMillionTeamSession(pin)) { res.json({ gameType: "million-team" }); return; }

  // 6. Million Class (DB-backed)
  const { getClassSession } = await import("../game/million-class-handlers.js");
  const classSession = getClassSession(pin);
  if (classSession) { res.json({ gameType: "million" }); return; }

  // 7. Scramble
  const { getScrambleSession } = await import("../game/scramble-socket-handlers.js");
  if (getScrambleSession && getScrambleSession(pin)) { res.json({ gameType: "scramble" }); return; }

  // 8. Flags multiplayer
  const { getFlagGame } = await import("../game/flag-manager.js");
  if (getFlagGame(pin)) { res.json({ gameType: "flags" }); return; }

  // 9. Capitals multiplayer
  const { getCapitalGame } = await import("../game/capital-manager.js");
  if (getCapitalGame(pin)) { res.json({ gameType: "capitals" }); return; }

  // 10. Presentation live session
  const [presSession] = await db
    .select({ id: presentationSessionsTable.id })
    .from(presentationSessionsTable)
    .where(and(
      eq(presentationSessionsTable.pin, pin),
      ne(presentationSessionsTable.status, "ended"),
    ))
    .limit(1);
  if (presSession) { res.json({ gameType: "presentation" }); return; }

  // 11. Private assignment access code
  const normalizedPin = pin.trim().toUpperCase();
  const [assignment] = await db
    .select({ id: assignmentsTable.id })
    .from(assignmentsTable)
    .where(sql`upper(${assignmentsTable.accessCode}) = ${normalizedPin}`)
    .limit(1);
  if (assignment) {
    res.json({ gameType: "assignment", assignmentId: assignment.id });
    return;
  }

  res.json({ gameType: "unknown" });
});

export default router;
