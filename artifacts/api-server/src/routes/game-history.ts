import { Router, type IRouter } from "express";
import { createHmac } from "node:crypto";
import { db, gameHistoryTable, studentsTable, assignmentsTable, presentationSessionsTable } from "@workspace/db";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import type { Game, GamePlayer, GameQuestion } from "../game/manager.js";
import { getGame, findActiveGameByTeacher } from "../game/manager.js";
import { evaluateClassroomRewardEvidence } from "../lib/classroom-reward-evaluator";
import { saveFullWameethGame } from "../lib/wameeth-full-save";

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
  /** Server-verified at game join; omitted for guests/unlinked players. */
  studentId?: number;
  answers: AnswerDetail[];
}

interface TopPlayer {
  name: string;
  avatar: string;
  score: number;
}

export function buildDetailedResults(game: Game): PlayerResult[] {
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
        ...(Number.isInteger(p.studentId) && (p.studentId as number) > 0 ? { studentId: p.studentId as number } : {}),
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
    teamNames: game.teamNames,
    studentTeamChoiceEnabled: !!game.studentTeamChoiceEnabled,
    gameMode: game.gameMode,
  };
  res.json(info);
});

router.get("/game-info/:pin/roster", async (req, res) => {
  const game = getGame(req.params.pin);
  const className = typeof req.query.className === "string" ? req.query.className.trim() : "";
  if (!game || !className) { res.status(404).json({ error: "اللعبة أو الصف غير موجود" }); return; }
  const allowed = game.targetClasses?.length ? game.targetClasses : (game.targetClass ? [game.targetClass] : []);
  if (!allowed.includes(className) || !game.teacherId) { res.status(403).json({ error: "الصف غير مسموح به" }); return; }
  const rows = await db.select({ id: studentsTable.id, name: studentsTable.name })
    .from(studentsTable)
    .where(and(eq(studentsTable.teacherId, game.teacherId), eq(studentsTable.gradeLevel, className)));
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(503).json({ error: "خدمة الأسماء غير متاحة" }); return; }
  res.json({
    students: rows.map(row => ({
      name: row.name,
      token: createHmac("sha256", secret).update(`${game.pin}\u0000${className}\u0000${row.id}`).digest("base64url"),
    })),
  });
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
    const { getGame } = await import("../game/manager.js");
    const game = getGame(pin);

    // An active run always wins over historical PIN reuse. PIN is display/join
    // data only and is not an execution identity.
    if (!game) {
    const existing = await db
      .select({ id: gameHistoryTable.id, assignmentId: gameHistoryTable.assignmentId, detailedResults: gameHistoryTable.detailedResults })
      .from(gameHistoryTable)
      .where(and(eq(gameHistoryTable.pin, pin), eq(gameHistoryTable.teacherId, teacherId)))
      .orderBy(desc(gameHistoryTable.createdAt),desc(gameHistoryTable.id))
      .limit(1);

    if (existing.length > 0) {
      await db.transaction(async tx => {
        for (const player of ((existing[0].detailedResults as PlayerResult[] | null) ?? [])) if (player.studentId) {
          await evaluateClassroomRewardEvidence(tx, { teacherId, sourceType:"game_history", sourceResultId:existing[0].id, studentId:player.studentId, completed:true, score:player.score,
            evidenceSummary:{ gameHistoryId:existing[0].id, assignmentId:existing[0].assignmentId, score:player.score, rank:player.rank, totalCorrect:player.totalCorrect, totalQuestions:player.totalQuestions } });
        }
      });
      res.json({ success: true, message: "already_saved", id: existing[0].id });
      return;
    }
    res.status(404).json({ error: "Game not found or already cleaned up" });
    return;
    }
    if (game.teacherId !== teacherId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if(game.state!=="finished") {
      res.status(409).json({error:"Game is not finished"});
      return;
    }
    const saved=await saveFullWameethGame(game);
    const canonical=await db.select({id:gameHistoryTable.id}).from(gameHistoryTable)
      .where(eq((gameHistoryTable as any).gameRunId,game.gameRunId)).limit(1);
    res.json({success:true,message:saved.replayed?"already_saved":"saved",id:canonical[0]?.id ?? saved.id});
    return;
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
