import { Server, Socket } from "socket.io";
import { db, assignmentsTable, questionsTable, gameHistoryTable, studentsTable, studentAccountsTable, wameethScoresTable, millionBankQuestionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  removePlayer,
  kickPlayerByName,
  setPointsEnabled,
  setGiftsEnabled,
  setTtsEnabled,
  setHackMode,
  generatePasswordChoices,
  claimPlayerPassword,
  generateMysteryBoxes,
  applyMysteryBox,
  getHackPasswordChoices,
  resolveHackAttempt,
  assignTeamsAlphabetically,
  getPlayerList,
  getActivePlayerCount,
  nextQuestion,
  submitAnswer,
  getLeaderboard,
  getTeamLeaderboard,
  getAnswerDistribution,
  isDoublePointsRound,
  clearQuestionTimeout,
  resetGameToLobby,
  findGameByTeacher,
  findGameByPlayer,
  setRoomLocked,
  setTeamLocked,
  movePlayerToTeam,
  useGift,
  getOtherPlayers,
  addBotPlayers,
  shouldStartGiftRound,
  startGiftRound,
  recordGiftRoundChoice,
  allPlayersChoseGift,
  endGiftRound,
  initPersonalSequencesForHack,
  getNextPersonalQuestion,
  setPersonalShuffledOptions,
  submitPersonalAnswer,
  startHackTimer,
  markPlayerHackFinished,
  GIFT_ROUND_DURATION_MS,
  type GameQuestion,
  type GamePlayer,
  type Game,
  type GiftType,
  type GameMode,
} from "./manager";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity-logger";
import { trackEvent } from "../lib/analytics";

interface CreateGameData {
  assignmentId: number;
  questionDuration?: number;
  autoAdvance?: boolean;
  gameMode?: GameMode;
  teamCount?: number;
  customTeamNames?: string[];
  hackMode?: boolean;
  // Hack-mode question-bank source (Million bank) — used when assignmentId is 0
  bankSubject?: string;
  bankLevel?: string;
  bankQuestionCount?: number;
  // Teacher-selected target class (overrides the assignment's stored class
  // when supplied). Used by Wameedh/Hack live-game flows.
  targetClass?: string;
}

// Map Arabic / friendly subject labels to bank category enum values
const BANK_SUBJECT_TO_CATEGORY: Record<string, string> = {
  "إسلاميات": "religion",
  "دين": "religion",
  "religion": "religion",
  "علوم": "science",
  "science": "science",
  "رياضيات": "mathematics",
  "mathematics": "mathematics",
  "math": "mathematics",
  "لغة عربية": "language",
  "لغة": "language",
  "language": "language",
  "أدب": "literature",
  "literature": "literature",
  "جغرافيا": "geography",
  "geography": "geography",
  "تاريخ": "history",
  "history": "history",
  "ثقافة عامة": "culture",
  "ثقافة": "culture",
  "culture": "culture",
  "تقنية": "technology",
  "technology": "technology",
  "رياضة": "sports",
  "sports": "sports",
  "فن": "art",
  "art": "art",
  "فضاء": "space",
  "space": "space",
  "حيوانات": "animals",
  "animals": "animals",
  "طعام": "food",
  "food": "food",
  "طب": "medicine",
  "medicine": "medicine",
  "اختراعات": "inventions",
  "inventions": "inventions",
  "دول": "countries",
  "countries": "countries",
};

interface CreateGameResponse {
  pin?: string;
  title?: string;
  questionCount?: number;
  questionDuration?: number;
  gameMode?: GameMode;
  teamCount?: number;
  teamNames?: string[];
  error?: string;
}

interface JoinGameData {
  pin: string;
  name: string;
  avatar?: string;
  studentId?: number;
}

interface JoinGameResponse {
  success?: boolean;
  title?: string;
  questionCount?: number;
  players?: { name: string; score: number; streak: number; teamName?: string | null }[];
  gameMode?: GameMode;
  teamNames?: string[];
  myTeam?: string | null;
  error?: string;
}

interface PinData {
  pin: string;
}

interface SubmitAnswerData {
  pin: string;
  answer: string;
  // Echoed from game:player-question to detect stale hack-mode submits.
  questionInstanceId?: number;
}

interface UseGiftData {
  pin: string;
  giftType: GiftType;
  targetName?: string;
  stealAmount?: number;
}

const AUTO_ADVANCE_DELAY_MS = 5000;
const TEACHER_RECONNECT_GRACE_LOBBY_MS = 90000;
const TEACHER_RECONNECT_GRACE_ACTIVE_MS = 10 * 60 * 1000;

let _sharedIo: Server | null = null;
export function getGameIo(): Server | null { return _sharedIo; }

// Track which game pins have already been persisted to history so we don't
// double-save. Stored as Map<pin, savedAtMs> with a periodic sweep so the
// structure cannot grow unbounded over the lifetime of the server.
const SAVED_GAME_TTL_MS = 60 * 60 * 1000; // 1 hour
const savedGames = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [pin, ts] of savedGames.entries()) {
    if (now - ts > SAVED_GAME_TTL_MS) savedGames.delete(pin);
  }
}, 10 * 60 * 1000).unref();

const teacherDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function saveGameHistory(game: Game) {
  if (savedGames.has(game.pin)) return;
  if (game.players.size === 0 || game.currentQuestionIndex < 0) return;
  try {
    const leaderboard = getLeaderboard(game);
    const humanLeaderboard = leaderboard.filter(p => {
      const pl = Array.from(game.players.values()).find(x => x.name === p.name);
      return pl && !pl.isBot;
    });
    const rankingList = humanLeaderboard.length > 0 ? humanLeaderboard : leaderboard;
    const winner = rankingList[0];
    const topPlayers = rankingList.slice(0, 5).map((p) => ({
      name: p.name,
      avatar: p.avatar,
      score: p.score,
    }));

    const detailedResults = Array.from(game.players.values())
      .filter(p => !p.isBot)
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => {
        const answersArr: { questionIndex: number; questionText: string; answer: string; correct: boolean; points: number; time: number }[] = [];
        for (const [qIdx, ans] of p.answers.entries()) {
          const q = game.questions[qIdx];
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
          studentId: p.studentId || null,
          totalCorrect: p.totalCorrect,
          totalQuestions: game.questions.length,
          teamName: p.teamName,
          answers: answersArr,
        };
      });

    await db.insert(gameHistoryTable).values({
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
    });
    savedGames.set(game.pin, Date.now());

    /* Auto-tag: any assignment that has actually been launched as a live
       game is a competition by definition. Flip stale 'homework' rows so
       the competitions library stays current as new games are played
       (task #599). Conditional WHERE keeps it idempotent and a no-op for
       rows the teacher already marked as 'competition'. */
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
        logger.error({ err: flipErr, assignmentId: game.assignmentId }, "Failed to auto-tag assignment as competition");
      }
    }

    const allPlayers = Array.from(game.players.values()).filter(p => !p.isBot);
    const sortedAll = [...allPlayers].sort((a, b) => b.score - a.score);
    const totalPlayerCount = allPlayers.length;
    const accountPlayers = allPlayers.filter(p => p.studentAccountId);
    for (const p of accountPlayers) {
      const position = sortedAll.findIndex(x => x.socketId === p.socketId) + 1;
      try {
        await db.insert(wameethScoresTable).values({
          studentAccountId: p.studentAccountId!,
          assignmentTitle: game.assignmentTitle,
          score: p.score,
          position,
          playerCount: totalPlayerCount,
          totalCorrect: p.totalCorrect,
          totalQuestions: game.questions.length,
        });
        await db.update(studentAccountsTable)
          .set({
            totalScore: sql`${studentAccountsTable.totalScore} + ${p.score}`,
            gamesPlayed: sql`${studentAccountsTable.gamesPlayed} + 1`,
          })
          .where(eq(studentAccountsTable.id, p.studentAccountId!));
      } catch (scoreErr) {
        logger.error({ err: scoreErr }, "Error saving wameeth score for student account");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saving game history");
  }
}

function pickBotAnswer(question: GameQuestion, correct: boolean): string {
  const qType = question.questionType || "mcq";
  if (qType === "true_false") {
    return correct ? (question.correctAnswer || "true") : (question.correctAnswer === "true" ? "false" : "true");
  }
  if (qType === "fill_blank") {
    if (correct) return question.correctAnswer || "";
    const wrong = (question.correctAnswer || "").split("").reverse().join("");
    return wrong !== question.correctAnswer ? wrong : (question.correctAnswer || "") + "؟";
  }
  if (correct) {
    return question.correctAnswer || "A";
  }
  const options = ["A", "B", "C", "D"].filter(o => {
    if (o === "A" && !question.optionA) return false;
    if (o === "B" && !question.optionB) return false;
    if (o === "C" && !question.optionC) return false;
    if (o === "D" && !question.optionD) return false;
    return o !== question.correctAnswer;
  });
  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : "A";
}

function scheduleBotAnswers(io: Server, game: Game, questionIndex: number) {
  for (const t of game.botTimers) clearTimeout(t);
  game.botTimers = [];

  for (const player of game.players.values()) {
    if (!player.isBot) continue;

    const delay = 1000 + Math.floor(Math.random() * 7000);
    const timer = setTimeout(() => {
      const currentGame = getGame(game.pin);
      if (
        !currentGame ||
        currentGame.state !== "question" ||
        currentGame.paused ||
        currentGame.currentQuestionIndex !== questionIndex
      ) return;

      const isCorrect = Math.random() < (player.botAccuracy || 0.6);
      const q = currentGame.questions[questionIndex];
      const answer = pickBotAnswer(q, isCorrect);

      const result = submitAnswer(currentGame, player.socketId, answer);
      if (!result) return;

      io.to(currentGame.teacherSocketId).emit("game:answer-received", {
        answeredCount: currentGame.answeredCount,
        totalPlayers: getActivePlayerCount(currentGame),
      });

      if (currentGame.answeredCount >= getActivePlayerCount(currentGame)) {
        clearQuestionTimeout(currentGame);
        endQuestion(io, currentGame);
      }
    }, delay);

    game.botTimers.push(timer);
  }
}

function shuffleAndStoreOptions(game: Game, question: GameQuestion): { optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null; shuffledCorrectAnswer: string | null } {
  const qt = question.questionType || "mcq";
  if (qt !== "mcq") {
    game.currentShuffledCorrectAnswer = null;
    game.currentShuffledOptions = null;
    return { optionA: question.optionA, optionB: question.optionB, optionC: question.optionC, optionD: question.optionD, shuffledCorrectAnswer: question.correctAnswer };
  }
  const keys: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const entries: { key: string; text: string | null }[] = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ].filter(e => !!e.text);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  const shuffled = {
    optionA: entries[0]?.text || null,
    optionB: entries[1]?.text || null,
    optionC: entries[2]?.text || null,
    optionD: entries[3]?.text || null,
  };
  let newCorrect = question.correctAnswer;
  const originalCorrectKey = question.correctAnswer;
  if (originalCorrectKey && keys.includes(originalCorrectKey as any)) {
    const originalIndex = keys.indexOf(originalCorrectKey as any);
    const originalEntry = { key: originalCorrectKey, text: [question.optionA, question.optionB, question.optionC, question.optionD][originalIndex] };
    const newIndex = entries.findIndex(e => e.key === originalCorrectKey);
    if (newIndex >= 0) {
      newCorrect = keys[newIndex];
    }
  }
  game.currentShuffledCorrectAnswer = newCorrect;
  game.currentShuffledOptions = shuffled;
  return { ...shuffled, shuffledCorrectAnswer: newCorrect };
}

function emitQuestionToRoom(io: Server, game: Game, question: GameQuestion) {
  const isDouble = isDoublePointsRound(game);
  const shuffled = shuffleAndStoreOptions(game, question);
  const baseData = {
    index: game.currentQuestionIndex,
    total: game.questions.length,
    text: question.text,
    optionA: shuffled.optionA,
    optionB: shuffled.optionB,
    optionC: shuffled.optionC,
    optionD: shuffled.optionD,
    points: question.points,
    duration: game.questionDuration,
    isDoublePoints: isDouble,
    imageUrl: question.imageUrl || null,
    questionType: question.questionType || "mcq",
    pointsEnabled: game.pointsEnabled,
    giftsEnabled: game.giftsEnabled,
    gameTtsEnabled: game.ttsEnabled,
    readAloud: question.readAloud,
  };

  for (const player of game.players.values()) {
    if (player.isBot) continue;
    const isFrozen = player.frozenForQuestion === game.currentQuestionIndex;
    if (player.pendingMysteryBoxes) {
      player.pendingMysteryBoxes = null;
      player.pendingHackSession = null;
      io.to(player.socketId).emit("game:mystery-boxes-clear");
    }
    io.to(player.socketId).emit("game:question", {
      ...baseData,
      frozen: isFrozen,
      hasShield: player.hasShield,
      freezeUsed: player.freezeUsed,
    });
  }
  io.to(game.teacherSocketId).emit("game:question", baseData);

  scheduleBotAnswers(io, game, game.currentQuestionIndex);
}

function emitLeaderboardData(io: Server, game: Game, event: string, extra: Record<string, any> = {}) {
  const leaderboard = getLeaderboard(game);
  const teamLeaderboard = getTeamLeaderboard(game);
  io.to(`game:${game.pin}`).emit(event, {
    leaderboard,
    teamLeaderboard,
    gameMode: game.gameMode,
    ...extra,
  });
}

function shuffleOptionsForPlayer(question: GameQuestion): { optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null; shuffledCorrectAnswer: string | null } {
  const qt = question.questionType || "mcq";
  if (qt !== "mcq") {
    return { optionA: question.optionA, optionB: question.optionB, optionC: question.optionC, optionD: question.optionD, shuffledCorrectAnswer: question.correctAnswer };
  }
  const keys: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const entries: { key: string; text: string | null }[] = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ].filter(e => !!e.text);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  const shuffled = {
    optionA: entries[0]?.text || null,
    optionB: entries[1]?.text || null,
    optionC: entries[2]?.text || null,
    optionD: entries[3]?.text || null,
  };
  let newCorrect = question.correctAnswer;
  const originalCorrectKey = question.correctAnswer;
  if (originalCorrectKey && keys.includes(originalCorrectKey as any)) {
    const newIndex = entries.findIndex(e => e.key === originalCorrectKey);
    if (newIndex >= 0) newCorrect = keys[newIndex];
  }
  return { ...shuffled, shuffledCorrectAnswer: newCorrect };
}

function emitPersonalQuestion(io: Server, game: Game, player: GamePlayer): boolean {
  if (!game.hackMode) return false;
  if (player.disconnected || player.isBot) return false;
  const next = getNextPersonalQuestion(game, player);
  if (!next) return false;
  const shuffled = shuffleOptionsForPlayer(next.question);
  const instanceId = setPersonalShuffledOptions(player, {
    optionA: shuffled.optionA,
    optionB: shuffled.optionB,
    optionC: shuffled.optionC,
    optionD: shuffled.optionD,
  }, shuffled.shuffledCorrectAnswer);
  const remainingMs = game.hackDeadline ? Math.max(0, game.hackDeadline - Date.now()) : null;
  io.to(player.socketId).emit("game:player-question", {
    text: next.question.text,
    optionA: shuffled.optionA,
    optionB: shuffled.optionB,
    optionC: shuffled.optionC,
    optionD: shuffled.optionD,
    points: next.question.points,
    duration: game.questionDuration,
    imageUrl: next.question.imageUrl || null,
    questionType: next.question.questionType || "mcq",
    pointsEnabled: game.pointsEnabled,
    giftsEnabled: false,
    gameTtsEnabled: game.ttsEnabled,
    readAloud: next.question.readAloud,
    personalAnswered: player.personalAnsweredCount ?? 0,
    cycle: next.cycle,
    totalUnique: game.questions.length,
    hackDeadline: game.hackDeadline,
    hackRemainingMs: remainingMs,
    questionInstanceId: instanceId,
  });
  return true;
}

function endHackGame(io: Server, game: Game) {
  if (!game.hackMode) return;
  if (game.state === "finished") return;
  if (game.hackEndTimerId) {
    clearTimeout(game.hackEndTimerId);
    game.hackEndTimerId = null;
  }
  for (const p of game.players.values()) {
    markPlayerHackFinished(p);
  }
  game.state = "finished";
  emitLeaderboardData(io, game, "game:finished", {
    totalQuestions: game.questions.length,
    hackTimeUp: true,
  });
  saveGameHistory(game);
  trackEvent({
    userRole: "teacher",
    eventName: "game_completed",
    eventCategory: "game",
    metadata: {
      gameSessionId: String(game.pin),
      gameType: game.gameMode || "wameedh",
      playerCount: game.players.size,
    },
  });
  game.finishDeleteTimerId = setTimeout(() => deleteGame(game.pin), 60000);
}

function hasPendingBoxesOrHacks(game: Game): boolean {
  for (const p of game.players.values()) {
    if (p.isBot) continue;
    if (p.pendingMysteryBoxes !== null && p.pendingMysteryBoxes !== undefined) return true;
    if (p.pendingHackSession && !p.pendingHackSession.used) return true;
  }
  return false;
}

function doAutoAdvance(io: Server, pin: string) {
  const currentGame = getGame(pin);
  if (!currentGame || currentGame.state !== "leaderboard") return;
  if (currentGame.paused) return;

  currentGame.autoAdvanceTimerId = null;
  clearQuestionTimeout(currentGame);
  const question = nextQuestion(currentGame);
  if (!question) {
    emitLeaderboardData(io, currentGame, "game:finished", {
      totalQuestions: currentGame.questions.length,
    });
    saveGameHistory(currentGame);
    currentGame.finishDeleteTimerId = setTimeout(() => deleteGame(currentGame.pin), 60000);
    return;
  }
  emitQuestionToRoom(io, currentGame, question);
  scheduleQuestionTimeout(io, currentGame, currentGame.currentQuestionIndex);
}

function scheduleAutoAdvance(io: Server, game: Game) {
  if (!game.autoAdvance) return;
  if (game.paused) return;

  if (game.autoAdvanceTimerId) clearTimeout(game.autoAdvanceTimerId);

  if (game.hackMode) {
    const MAX_WAIT_MS = 60_000;
    const HACK_POST_BOXES_DELAY_MS = 3500;
    const POLL_INTERVAL_MS = 400;
    const startedAt = Date.now();
    const poll = () => {
      const g = getGame(game.pin);
      if (!g || g.state !== "leaderboard" || g.paused) return;
      if (!hasPendingBoxesOrHacks(g) || Date.now() - startedAt >= MAX_WAIT_MS) {
        g.autoAdvanceTimerId = setTimeout(() => doAutoAdvance(io, g.pin), HACK_POST_BOXES_DELAY_MS);
      } else {
        g.autoAdvanceTimerId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    poll();
    return;
  }

  game.autoAdvanceTimerId = setTimeout(() => {
    doAutoAdvance(io, game.pin);
  }, AUTO_ADVANCE_DELAY_MS);
}

function deferredEndQuestion(io: Server, game: Game) {
  const MAX_WAIT_MS = 60_000;
  const POLL_INTERVAL_MS = 400;
  const startedAt = Date.now();
  const tick = () => {
    const g = getGame(game.pin);
    if (!g || g.state !== "question") return;
    if (!hasPendingBoxesOrHacks(g) || Date.now() - startedAt >= MAX_WAIT_MS) {
      endQuestion(io, g);
    } else {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  tick();
}

function endQuestion(io: Server, game: Game) {
  console.log(`[GAME ${game.pin}] endQuestion: questionIndex=${game.currentQuestionIndex}, state was=${game.state}, answeredCount=${game.answeredCount}, players=${game.players.size}`);
  game.state = "leaderboard";
  game.currentTimeoutId = null;
  const question = game.questions[game.currentQuestionIndex];
  const leaderboard = getLeaderboard(game);
  const teamLeaderboard = getTeamLeaderboard(game);
  const distribution = getAnswerDistribution(game);

  const giftRoundNext = shouldStartGiftRound(game);

  io.to(`game:${game.pin}`).emit("game:question-ended", {
    leaderboard,
    teamLeaderboard,
    distribution,
    correctAnswer: game.currentShuffledCorrectAnswer ?? question.correctAnswer,
    questionIndex: game.currentQuestionIndex,
    totalQuestions: game.questions.length,
    gameMode: game.gameMode,
    giftRoundNext,
  });

  if (giftRoundNext) {
    const giftDelay = game.autoAdvance ? 3000 : 0;
    if (game.giftRoundTimerId) clearTimeout(game.giftRoundTimerId);
    game.giftRoundTimerId = setTimeout(() => {
      const g = getGame(game.pin);
      if (!g || g.state === "finished") return;
      emitGiftRound(io, g);
    }, giftDelay);
  } else {
    scheduleAutoAdvance(io, game);
  }
}

function emitGiftRound(io: Server, game: Game) {
  startGiftRound(game);

  for (const player of game.players.values()) {
    if (player.isBot) continue;
    const others = getOtherPlayers(game, player.socketId);
    io.to(player.socketId).emit("game:gift-round", {
      players: others,
      duration: GIFT_ROUND_DURATION_MS / 1000,
      usedGiftTypes: Array.from(player.usedGiftTypes),
    });
  }

  io.to(game.teacherSocketId).emit("game:gift-round", {
    duration: GIFT_ROUND_DURATION_MS / 1000,
  });

  for (const player of game.players.values()) {
    if (player.isBot) {
      setTimeout(() => {
        const g = getGame(game.pin);
        if (!g || g.state !== "gift-round") return;
        recordGiftRoundChoice(g, player.socketId);
        if (allPlayersChoseGift(g)) {
          finishGiftRound(io, g);
        }
      }, 2000 + Math.random() * 3000);
    }
  }

  game.giftRoundTimerId = setTimeout(() => {
    const g = getGame(game.pin);
    if (!g || g.state !== "gift-round") return;
    finishGiftRound(io, g);
  }, GIFT_ROUND_DURATION_MS);
}

function finishGiftRound(io: Server, game: Game) {
  if (game.state !== "gift-round") return;
  endGiftRound(game);

  const leaderboard = getLeaderboard(game);
  const teamLeaderboard = getTeamLeaderboard(game);

  io.to(`game:${game.pin}`).emit("game:gift-round-ended", {
    leaderboard,
    teamLeaderboard,
  });

  game.state = "leaderboard";

  const hasMoreQuestions = game.currentQuestionIndex + 1 < game.questions.length;
  if (!hasMoreQuestions) {
    nextQuestion(game);
    emitLeaderboardData(io, game, "game:finished", {
      totalQuestions: game.questions.length,
    });
    saveGameHistory(game);
    game.finishDeleteTimerId = setTimeout(() => deleteGame(game.pin), 60000);
    return;
  }

  if (game.hackMode) {
    if (game.autoAdvance) {
      scheduleAutoAdvance(io, game);
    } else {
      const MAX_WAIT_MS = 60_000;
      const HACK_POST_BOXES_DELAY_MS = 3500;
      const POLL_INTERVAL_MS = 400;
      const startedAt = Date.now();
      const pollThenAdvance = () => {
        const g = getGame(game.pin);
        if (!g || g.state !== "leaderboard") return;
        if (!hasPendingBoxesOrHacks(g) || Date.now() - startedAt >= MAX_WAIT_MS) {
          setTimeout(() => {
            const g2 = getGame(game.pin);
            if (!g2 || g2.state !== "leaderboard") return;
            const q = nextQuestion(g2);
            if (!q) return;
            emitQuestionToRoom(io, g2, q);
            scheduleQuestionTimeout(io, g2, g2.currentQuestionIndex);
          }, HACK_POST_BOXES_DELAY_MS);
        } else {
          setTimeout(pollThenAdvance, POLL_INTERVAL_MS);
        }
      };
      pollThenAdvance();
    }
  } else {
    nextQuestion(game);
    setTimeout(() => {
      const g = getGame(game.pin);
      if (!g) return;
      emitQuestionToRoom(io, g, g.questions[g.currentQuestionIndex]);
      scheduleQuestionTimeout(io, g, g.currentQuestionIndex);
    }, 1500);
  }
}

function scheduleQuestionTimeout(io: Server, game: Game, questionIndex: number) {
  clearQuestionTimeout(game);

  game.currentTimeoutId = setTimeout(() => {
    const currentGame = getGame(game.pin);
    if (
      !currentGame ||
      currentGame.state !== "question" ||
      currentGame.currentQuestionIndex !== questionIndex
    ) {
      return;
    }

    endQuestion(io, currentGame);
  }, game.questionDuration * 1000);
}

function getTeacherIdFromSocket(socket: Socket): number | null {
  const session = ((socket.request as unknown) as Express.Request & { session?: { teacherId?: number } }).session;
  return session?.teacherId ?? null;
}

export function startGameFromRest(pin: string): { success: boolean; error?: string } {
  const io = _sharedIo;
  if (!io) return { success: false, error: "Socket server not ready" };
  const game = getGame(pin);
  if (!game) return { success: false, error: "Game not found" };
  if (game.state !== "lobby") return { success: false, error: "Game already started" };
  const question = nextQuestion(game);
  if (!question) return { success: false, error: "No questions" };
  emitQuestionToRoom(io, game, question);
  scheduleQuestionTimeout(io, game, game.currentQuestionIndex);
  return { success: true };
}

// Per-socket rate limiter for "create"-type events. Allows up to N events
// per window per socket. Returns true when the event is allowed.
const CREATE_RATE_WINDOW_MS = 60 * 1000;
const CREATE_RATE_MAX = 5; // 5 game creations per socket per minute
const createRateBuckets = new WeakMap<Socket, number[]>();
function allowCreate(socket: Socket): boolean {
  const now = Date.now();
  const bucket = (createRateBuckets.get(socket) || []).filter(
    (t) => now - t < CREATE_RATE_WINDOW_MS,
  );
  if (bucket.length >= CREATE_RATE_MAX) {
    createRateBuckets.set(socket, bucket);
    return false;
  }
  bucket.push(now);
  createRateBuckets.set(socket, bucket);
  return true;
}

function buildPlayersUpdatedPayload(game: ReturnType<typeof getGame>) {
  if (!game) return null;
  return {
    players: getPlayerList(game),
    gameMode: game.gameMode,
    teamNames: game.teamNames,
    roomLocked: game.roomLocked,
    lockedTeams: Array.from(game.lockedTeams),
  };
}

export function setupGameSocket(io: Server) {
  _sharedIo = io;
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("teacher:create-game", async (data: CreateGameData, callback: (res: CreateGameResponse) => void) => {
      try {
        const teacherId = getTeacherIdFromSocket(socket);
        if (!teacherId) {
          callback?.({ error: "يجب تسجيل الدخول أولاً" });
          return;
        }
        if (!allowCreate(socket)) {
          callback?.({ error: "محاولات إنشاء كثيرة جداً. الرجاء الانتظار دقيقة." });
          return;
        }

        logActivity({
          userId: teacherId,
          userRole: "teacher",
          action: "start_game",
          details: { gameType: data.gameMode || "wameedh", assignmentId: data.assignmentId ?? null },
        });
        // We delay the trackEvent call until after the game is created so we
        // can include the pin (used as gameSessionId) for the live-games KPI.

        const { assignmentId, questionDuration, autoAdvance, gameMode, teamCount, customTeamNames, hackMode, bankSubject, bankLevel, bankQuestionCount, targetClass: clientTargetClass } = data;
        const trimmedClientClass = typeof clientTargetClass === "string" ? clientTargetClass.trim() : "";

        let questions: GameQuestion[];
        let resolvedAssignmentId = assignmentId;
        let resolvedTitle = "";
        let resolvedTargetClass: string | null = null;
        let resolvedTargetClasses: string[] | null = null;

        const subjectTrimmed = typeof bankSubject === "string" ? bankSubject.trim() : "";
        const levelTrimmed = typeof bankLevel === "string" ? bankLevel.trim() : "";
        const usingBank = !!hackMode && (subjectTrimmed.length > 0 || levelTrimmed.length > 0);

        if (usingBank) {
          const mappedCategory = subjectTrimmed && subjectTrimmed !== "all"
            ? (BANK_SUBJECT_TO_CATEGORY[subjectTrimmed] ?? subjectTrimmed.toLowerCase())
            : "";
          const conds = [];
          if (mappedCategory) conds.push(eq(millionBankQuestionsTable.category, mappedCategory));
          if (levelTrimmed && levelTrimmed !== "all") conds.push(eq(millionBankQuestionsTable.level, levelTrimmed));
          const rows = conds.length > 0
            ? await db.select().from(millionBankQuestionsTable).where(and(...conds))
            : await db.select().from(millionBankQuestionsTable);
          if (rows.length === 0) {
            callback?.({ error: "لا توجد أسئلة في البنك حسب المادة المحددة" });
            return;
          }
          // Shuffle and clamp count (default 20, range 5–60)
          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const count = Math.max(5, Math.min(60, bankQuestionCount ?? 20));
          const picked = shuffled.slice(0, Math.min(count, shuffled.length));
          questions = picked.map((q) => ({
            id: q.id,
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            points: 1,
            imageUrl: null,
            questionType: "mcq",
            readAloud: false,
          }));
          resolvedAssignmentId = 0;
          const labelParts: string[] = [];
          if (subjectTrimmed && subjectTrimmed !== "all") labelParts.push(subjectTrimmed);
          if (levelTrimmed && levelTrimmed !== "all") labelParts.push(levelTrimmed);
          resolvedTitle = labelParts.length > 0 ? `بنك الأسئلة — ${labelParts.join(" / ")}` : "بنك الأسئلة";
          resolvedTargetClass = null;
          resolvedTargetClasses = null;
        } else {
          const [assignment] = await db
            .select()
            .from(assignmentsTable)
            .where(eq(assignmentsTable.id, assignmentId))
            .limit(1);

          if (!assignment) {
            callback?.({ error: "الواجب غير موجود" });
            return;
          }

          // Allow if teacher owns it, OR if it's a shared+approved assignment
          // (any logged-in teacher can launch admin/shared content with their students).
          const isOwner = assignment.teacherId === teacherId;
          const isSharedApproved = !!assignment.isShared && !!assignment.isShareApproved;
          if (!isOwner && !isSharedApproved) {
            callback?.({ error: "غير مصرح لك بإنشاء لعبة لهذا الواجب" });
            return;
          }

          const dbQuestions = await db
            .select()
            .from(questionsTable)
            .where(eq(questionsTable.assignmentId, assignmentId));

          const gameQuestions = dbQuestions.filter(
            (q) => {
              const qt = q.questionType || "mcq";
              if (qt === "mcq") return q.optionA && q.optionB;
              if (qt === "true_false") return q.correctAnswer === "true" || q.correctAnswer === "false";
              if (qt === "fill_blank") return q.correctAnswer && q.correctAnswer.trim().length > 0;
              if (qt === "dictation") return q.optionA && q.optionA.trim().length > 0;
              return false;
            }
          );

          if (gameQuestions.length === 0) {
            callback?.({ error: "لا توجد أسئلة صالحة في هذا الواجب" });
            return;
          }

          questions = gameQuestions.map((q) => ({
            id: q.id,
            text: q.text,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            points: q.points,
            imageUrl: q.imageUrl || null,
            questionType: q.questionType || "mcq",
            readAloud: q.readAloud ?? false,
          }));
          resolvedTitle = assignment.title;
          resolvedTargetClass = assignment.targetClass;
          resolvedTargetClasses = (assignment as any).targetClasses && Array.isArray((assignment as any).targetClasses) && (assignment as any).targetClasses.length > 0
            ? (assignment as any).targetClasses
            : (assignment.targetClass ? [assignment.targetClass] : null);
        }

        // Teacher-supplied class on the live-game setup page wins over whatever
        // the assignment carried (they may be launching the same assignment for
        // a different class today).
        if (trimmedClientClass) {
          resolvedTargetClass = trimmedClientClass;
          resolvedTargetClasses = [trimmedClientClass];
        }

        const game = createGame(
          resolvedAssignmentId,
          resolvedTitle,
          socket.id,
          teacherId,
          questions,
          questionDuration || 20,
          autoAdvance || false,
          gameMode || "solo",
          teamCount || 2,
          customTeamNames,
          resolvedTargetClass,
          !!hackMode,
          resolvedTargetClasses
        );

        socket.join(`game:${game.pin}`);
        callback?.({
          pin: game.pin,
          title: game.assignmentTitle,
          questionCount: game.questions.length,
          questionDuration: game.questionDuration,
          gameMode: game.gameMode,
          teamCount: game.teamCount,
          teamNames: game.teamNames,
        });
      } catch (err) {
        logger.error({ err }, "Error creating game");
        callback?.({ error: "خطأ في إنشاء اللعبة" });
      }
    });

    socket.on("student:join-game", async (data: JoinGameData & { studentAccountId?: number }, callback: (res: JoinGameResponse) => void) => {
      const { pin, name, avatar, studentId, studentAccountId } = data;
      const game = getGame(pin);

      if (!game) {
        callback?.({ error: "كود اللعبة غير صحيح" });
        return;
      }

      logActivity({
        userId: studentAccountId ?? studentId ?? null,
        userName: name?.toString().slice(0, 100) ?? null,
        userRole: "student",
        action: "join_game",
        details: { pin, gameType: "wameedh" },
      });
      trackEvent({
        userId: studentAccountId ?? studentId ?? null,
        userName: name?.toString().slice(0, 100) ?? null,
        userRole: "student",
        eventName: "student_joined_game",
        eventCategory: "game",
        metadata: { pin, gameType: "wameedh" },
      });
      if (game.state === "finished") {
        callback?.({ error: "اللعبة انتهت بالفعل" });
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        callback?.({ error: "يرجى إدخال اسمك" });
        return;
      }

      // Reject NEW joins when the room is locked. Reconnections (player with
      // the same name already in the room) are still allowed below in addPlayer.
      if (game.roomLocked) {
        const isReconnect = Array.from(game.players.values()).some(
          (p) => p.name === trimmedName && !p.isBot,
        );
        if (!isReconnect) {
          callback?.({ error: "الغرفة مقفلة من قبل المعلم — لا يمكن الانضمام الآن" });
          return;
        }
      }

      let verifiedStudentId: number | null = null;
      if (studentId && game.targetClass && game.teacherId) {
        try {
          const [student] = await db
            .select({ id: studentsTable.id, name: studentsTable.name })
            .from(studentsTable)
            .where(and(
              eq(studentsTable.id, studentId),
              eq(studentsTable.teacherId, game.teacherId),
              eq(studentsTable.gradeLevel, game.targetClass)
            ))
            .limit(1);
          if (student && student.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
            verifiedStudentId = student.id;
          }
        } catch (err) {
          console.error("Student verification failed:", err);
        }
      }

      let verifiedStudentAccountId: number | null = null;
      if (studentAccountId) {
        try {
          const [account] = await db
            .select({ id: studentAccountsTable.id })
            .from(studentAccountsTable)
            .where(eq(studentAccountsTable.id, studentAccountId))
            .limit(1);
          if (account) verifiedStudentAccountId = account.id;
        } catch (err) {
          console.error("Student account verification failed:", err);
        }
      }

      const player = addPlayer(pin, socket.id, trimmedName, avatar || "🦁", verifiedStudentId, verifiedStudentAccountId);
      if (!player) {
        callback?.({ error: "هذا الاسم مستخدم بالفعل، اختر اسماً آخر" });
        return;
      }

      socket.join(`game:${pin}`);
      socket.data.gamePin = pin;

      const playerList = getPlayerList(game);
      io.to(`game:${pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);

      const response: any = {
        success: true,
        title: game.assignmentTitle,
        questionCount: game.questions.length,
        players: playerList,
        gameMode: game.gameMode,
        teamNames: game.teamNames,
        roomLocked: game.roomLocked,
        lockedTeams: Array.from(game.lockedTeams),
        myTeam: player.teamName,
        myScore: player.score,
        myStreak: player.streak,
      };

      if (game.state === "question" && !game.hackMode) {
        const q = game.questions[game.currentQuestionIndex];
        const elapsed = (Date.now() - game.questionStartTime) / 1000;
        const remaining = Math.max(0, game.questionDuration - elapsed);
        const opts = game.currentShuffledOptions ?? { optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD };
        response.currentQuestion = {
          index: game.currentQuestionIndex,
          total: game.questions.length,
          text: q.text,
          optionA: opts.optionA,
          optionB: opts.optionB,
          optionC: opts.optionC,
          optionD: opts.optionD,
          points: q.points,
          duration: game.questionDuration,
          timeRemaining: remaining,
          isDoublePoints: isDoublePointsRound(game),
          imageUrl: q.imageUrl || null,
          questionType: q.questionType || "mcq",
          pointsEnabled: game.pointsEnabled,
          giftsEnabled: game.giftsEnabled,
          frozen: player.frozenForQuestion === game.currentQuestionIndex,
          gameTtsEnabled: game.ttsEnabled,
          readAloud: q.readAloud ?? false,
        };
        response.gameState = "question";
      } else if (game.state === "question" && game.hackMode) {
        response.gameState = "question";
        response.hackMarathon = {
          deadline: game.hackDeadline,
          remainingMs: game.hackDeadline ? Math.max(0, game.hackDeadline - Date.now()) : null,
          totalUnique: game.questions.length,
        };
      } else if (game.state === "leaderboard") {
        response.gameState = "leaderboard";
      } else if (game.state === "gift-round") {
        response.gameState = "gift-round";
      }

      response.hackMode = game.hackMode;
      if (game.hackMode && player.password) {
        response.myPassword = player.password;
      }

      if (game.hackMode && !player.password) {
        const choices = generatePasswordChoices(game);
        player.passwordChoices = choices;
        // Emit immediately so the picker shows up without a perceived delay,
        // then re-emit shortly after as a safety net in case the client wasn't
        // fully attached to the listener at the moment of the first emit.
        socket.emit("game:password-choices", { choices });
        setTimeout(() => {
          // Re-emit only if the player still hasn't picked a password
          const stillNeedsPick = !player.password;
          if (stillNeedsPick) socket.emit("game:password-choices", { choices });
        }, 400);
      }

      callback?.(response);

      // Hack-mode marathon: late-joiner or reconnecting player
      if (game.hackMode && game.state === "question") {
        const hasOrder = Array.isArray(player.personalQuestionOrder) && player.personalQuestionOrder.length > 0;
        const hasPending = (player.pendingMysteryBoxes && player.pendingMysteryBoxes.length > 0)
          || (player.pendingHackSession && !player.pendingHackSession.used);
        if (!hasOrder) {
          // Brand-new joiner mid-marathon: initialize their order. The first
          // question is only emitted once the player has chosen a password —
          // password selection is a mandatory gate to play in hack mode.
          const totalIndices = Array.from({ length: game.questions.length }, (_, i) => i);
          for (let i = totalIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [totalIndices[i], totalIndices[j]] = [totalIndices[j], totalIndices[i]];
          }
          player.personalQuestionOrder = totalIndices;
          player.personalQuestionIndex = -1;
          player.personalAnsweredCount = 0;
          player.personalCycle = 0;
          player.personalFinished = false;
          player.answers = new Map();
          if (player.password) {
            setTimeout(() => emitPersonalQuestion(io, game, player), 800);
          }
        } else if (player.password && player.personalCurrentQuestionId !== undefined && !hasPending) {
          // Reconnecting mid-question: re-send their current question
          const q = game.questions[player.personalCurrentQuestionId];
          const opts = player.personalShuffledOptions ?? { optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD };
          const remainingMs = game.hackDeadline ? Math.max(0, game.hackDeadline - Date.now()) : null;
          // Bump the instance id so any submit from the pre-disconnect session
          // is treated as stale and ignored — the client re-renders against the
          // resumed payload and will echo this new id on its next submit.
          player.personalQuestionInstanceId = (player.personalQuestionInstanceId ?? 0) + 1;
          const resumedInstanceId = player.personalQuestionInstanceId;
          setTimeout(() => {
            io.to(socket.id).emit("game:player-question", {
              text: q.text,
              optionA: opts.optionA,
              optionB: opts.optionB,
              optionC: opts.optionC,
              optionD: opts.optionD,
              points: q.points,
              duration: game.questionDuration,
              imageUrl: q.imageUrl || null,
              questionType: q.questionType || "mcq",
              pointsEnabled: game.pointsEnabled,
              giftsEnabled: false,
              gameTtsEnabled: game.ttsEnabled,
              readAloud: q.readAloud,
              personalAnswered: player.personalAnsweredCount ?? 0,
              cycle: player.personalCycle ?? 0,
              totalUnique: game.questions.length,
              hackDeadline: game.hackDeadline,
              hackRemainingMs: remainingMs,
              resumed: true,
              questionInstanceId: resumedInstanceId,
            });
          }, 500);
        } else if (!hasPending && player.personalCurrentQuestionId === undefined) {
          // Reconnecting between questions: send next personal question.
          // Respect the late-join password gate: don't send if no password yet.
          if (player.password) {
            setTimeout(() => emitPersonalQuestion(io, game, player), 600);
          }
        }
      }

      // Restore pending mystery boxes / hack sessions after reconnect
      if (player.pendingMysteryBoxes && player.pendingMysteryBoxes.length > 0) {
        setTimeout(() => {
          socket.emit("game:mystery-boxes", { count: player.pendingMysteryBoxes!.length });
        }, 500);
      } else if (player.pendingHackSession && !player.pendingHackSession.used) {
        setTimeout(() => {
          if (player.pendingHackSession?.targetName) {
            const choices = getHackPasswordChoices(game, player.pendingHackSession.targetName, socket.id);
            if (choices) {
              socket.emit("game:mystery-boxes", { count: 1 });
              setTimeout(() => {
                socket.emit("game:hack-targets", { targets: player.pendingHackSession!.hackTargets });
              }, 300);
              setTimeout(() => {
                socket.emit("game:hack-password-choices", { targetName: player.pendingHackSession!.targetName, choices });
              }, 600);
            }
          } else {
            socket.emit("game:mystery-boxes", { count: 1 });
            setTimeout(() => {
              socket.emit("game:hack-targets", { targets: player.pendingHackSession!.hackTargets });
            }, 300);
          }
        }, 600);
      }
    });

    socket.on("teacher:reconnect-game", (data: PinData, callback: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game) {
        callback?.({ error: "اللعبة غير موجودة" });
        return;
      }

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const existingTimer = teacherDisconnectTimers.get(game.pin);
      if (existingTimer) {
        clearTimeout(existingTimer);
        teacherDisconnectTimers.delete(game.pin);
      }

      game.teacherSocketId = socket.id;
      socket.join(`game:${game.pin}`);

      const playerList = getPlayerList(game);
      const leaderboard = getLeaderboard(game);
      const teamLeaderboard = getTeamLeaderboard(game);

      const response: any = {
        success: true,
        title: game.assignmentTitle,
        questionCount: game.questions.length,
        questionDuration: game.questionDuration,
        gameMode: game.gameMode,
        teamCount: game.teamCount,
        teamNames: game.teamNames,
        players: playerList,
        state: game.state,
        currentQuestionIndex: game.currentQuestionIndex,
        leaderboard,
        teamLeaderboard,
        pointsEnabled: game.pointsEnabled,
        giftsEnabled: game.giftsEnabled,
        ttsEnabled: game.ttsEnabled,
        hackMode: game.hackMode,
        roomLocked: game.roomLocked,
        lockedTeams: Array.from(game.lockedTeams),
        targetClass: game.targetClass,
        targetClasses: game.targetClasses,
      };

      if (game.state === "question") {
        if (game.hackMode) {
          // Hack-mode marathon: there is no single "current question" on the
          // host screen — players each race through their own personal
          // sequence. Surface the marathon deadline so the rejoined host can
          // restore the monitoring view with the correct countdown.
          response.hackMarathon = {
            active: true,
            deadline: game.hackDeadline,
            remainingMs: game.hackDeadline ? Math.max(0, game.hackDeadline - Date.now()) : null,
            durationMs: game.hackDurationMs,
            totalUnique: game.questions.length,
          };
          // Snapshot of accumulated per-student stats so the monitor view
          // is populated immediately on reconnect, instead of waiting for
          // the next live `hack:student-stats` event for each student.
          response.hackStudentStats = Array.from(game.players.values())
            .filter((p) => !p.isBot)
            .map((p) => ({
              name: p.name,
              avatar: p.avatar,
              correct: p.totalCorrect,
              wrong: p.hackWrongCount ?? 0,
              score: p.score,
              personalAnsweredCount: p.personalAnsweredCount ?? 0,
              personalCycle: p.personalCycle ?? 0,
              personalQuestionIndex: p.personalQuestionIndex ?? 0,
            }));
        } else {
          const q = game.questions[game.currentQuestionIndex];
          const elapsed = (Date.now() - game.questionStartTime) / 1000;
          const opts = game.currentShuffledOptions ?? { optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD };
          response.currentQuestion = {
            index: game.currentQuestionIndex,
            total: game.questions.length,
            text: q.text,
            questionType: q.questionType,
            optionA: opts.optionA,
            optionB: opts.optionB,
            optionC: opts.optionC,
            optionD: opts.optionD,
            points: q.points,
            duration: game.questionDuration,
            timeRemaining: Math.max(0, game.questionDuration - elapsed),
          };
          response.answeredCount = game.answeredCount;
          response.totalPlayers = getActivePlayerCount(game);
        }
      } else if (game.state === "leaderboard") {
        const q = game.questions[game.currentQuestionIndex];
        response.correctAnswer = game.currentShuffledCorrectAnswer ?? q.correctAnswer;
        response.distribution = getAnswerDistribution(game);
      } else if (game.state === "gift-round") {
        response.state = "gift-round";
      }

      callback?.(response);

      logger.info({ pin: data.pin, teacherId }, "Teacher reconnected to game");
    });

    socket.on("teacher:start-game", (data: PinData & { autoAdvance?: boolean; ttsEnabled?: boolean; hackDurationMinutes?: number }) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) return;

      if (game.state !== "lobby") return;
      if (game.players.size === 0) return;

      if (data.autoAdvance !== undefined) {
        game.autoAdvance = data.autoAdvance;
      }
      if (data.ttsEnabled !== undefined) {
        game.ttsEnabled = data.ttsEnabled;
      }

      if (game.hackMode) {
        for (const player of game.players.values()) {
          if (player.isBot || player.disconnected || player.password) continue;
          const choices = generatePasswordChoices(game);
          if (choices.length === 0) continue;
          const assigned = choices[Math.floor(Math.random() * choices.length)];
          claimPlayerPassword(game, player.socketId, assigned);
          io.to(player.socketId).emit("game:password-set", { word: assigned, auto: true });
        }
      }

      if (game.gameMode === "teams") {
        assignTeamsAlphabetically(game);
        io.to(`game:${game.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);
      }

      // Hack mode "marathon": per-player async questions + global time limit.
      if (game.hackMode) {
        game.state = "question";
        game.currentQuestionIndex = 0;
        game.mysteryBoxRound = 0;
        game.questionStartTime = Date.now();

        const minutes = Math.max(1, Math.min(60, Math.floor(data.hackDurationMinutes ?? 7)));
        const durationMs = minutes * 60 * 1000;

        startHackTimer(game, durationMs, () => {
          const g = getGame(game.pin);
          if (!g) return;
          endHackGame(io, g);
        });

        // Notify the room about the marathon timer
        io.to(`game:${game.pin}`).emit("game:hack-marathon-started", {
          durationMs,
          deadline: game.hackDeadline,
          totalUnique: game.questions.length,
        });

        initPersonalSequencesForHack(game);
        for (const player of game.players.values()) {
          if (player.isBot || player.disconnected) continue;
          emitPersonalQuestion(io, game, player);
        }
        return;
      }

      const question = nextQuestion(game);
      if (!question) return;

      emitQuestionToRoom(io, game, question);
      scheduleQuestionTimeout(io, game, game.currentQuestionIndex);
    });

    socket.on("teacher:pause-game", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;
      if (game.state === "finished" || game.paused) return;

      game.paused = true;

      if (game.autoAdvanceTimerId) {
        clearTimeout(game.autoAdvanceTimerId);
        game.autoAdvanceTimerId = null;
      }

      if (game.state === "question") {
        game.pausedAt = Date.now();
        clearQuestionTimeout(game);
      }

      io.to(`game:${game.pin}`).emit("game:paused", { state: game.state });
    });

    socket.on("teacher:resume-game", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;
      if (!game.paused) return;

      game.paused = false;
      io.to(`game:${game.pin}`).emit("game:resumed", { state: game.state });

      if (game.state === "leaderboard" && game.autoAdvance) {
        scheduleAutoAdvance(io, game);
      } else if (game.state === "question" && game.pausedAt !== null) {
        const pausedMs = Date.now() - game.pausedAt;
        game.questionStartTime = game.questionStartTime + pausedMs;
        game.pausedAt = null;
        scheduleQuestionTimeout(io, game, game.currentQuestionIndex);
      }
    });

    socket.on("student:submit-answer", (data: SubmitAnswerData) => {
      const game = getGame(data.pin);
      if (!game) return;

      // ===== Hack mode: per-player async marathon flow =====
      if (game.hackMode) {
        const player = game.players.get(socket.id);
        if (!player || player.isBot) return;
        // Password is a mandatory gate: don't process answers until player has chosen one.
        if (!player.password) return;
        // Capture the player's shuffled options BEFORE submit clears them
        const playerForOpts = game.players.get(socket.id);
        const shuffledOptsSnapshot = playerForOpts?.personalShuffledOptions ?? null;
        const personalResult = submitPersonalAnswer(game, socket.id, data.answer, data.questionInstanceId);
        if (!personalResult) {
          // Recovery: a duplicate or stale submit arrived (e.g. double-tap or
          // post-reconnect). Without this, the client UI would be stuck with a
          // disabled state and never receive the next question. Re-sync by
          // re-emitting the player's current/next personal question.
          if (player.personalCurrentQuestionId === undefined && !player.personalFinished) {
            emitPersonalQuestion(io, game, player);
          }
          return;
        }

        // Derive the correct answer's text label so the client doesn't have to map letters
        let correctAnswerText: string | null = null;
        const ca = personalResult.correctAnswer;
        if (ca) {
          const q = game.questions[personalResult.questionId];
          const opts = shuffledOptsSnapshot ?? (q ? { optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD } : null);
          if (ca === "true") correctAnswerText = "صح";
          else if (ca === "false") correctAnswerText = "خطأ";
          else if (ca === "A") correctAnswerText = opts?.optionA ?? null;
          else if (ca === "B") correctAnswerText = opts?.optionB ?? null;
          else if (ca === "C") correctAnswerText = opts?.optionC ?? null;
          else if (ca === "D") correctAnswerText = opts?.optionD ?? null;
          else correctAnswerText = ca;
        }

        socket.emit("game:answer-result", {
          correct: personalResult.correct,
          correctAnswer: personalResult.correctAnswer,
          correctAnswerText,
          selectedAnswer: data.answer,
          points: personalResult.points,
          streak: personalResult.streak,
          totalScore: personalResult.totalScore,
          giftEarned: false,
          frozen: false,
        });

        // Live leaderboard updates so everyone sees position changes
        const lbLeaderboard = getLeaderboard(game);
        const lbTeam = getTeamLeaderboard(game);
        io.to(`game:${game.pin}`).emit("game:scores-updated", { leaderboard: lbLeaderboard, teamLeaderboard: lbTeam, gameMode: game.gameMode });

        // Emit per-student stats to teacher for the monitoring screen
        {
          const playerForStats = game.players.get(socket.id);
          if (playerForStats) {
            io.to(game.teacherSocketId).emit("hack:student-stats", {
              name: playerForStats.name,
              avatar: playerForStats.avatar,
              correct: playerForStats.totalCorrect,
              wrong: playerForStats.hackWrongCount ?? 0,
              score: playerForStats.score,
              personalAnsweredCount: playerForStats.personalAnsweredCount ?? 0,
              personalCycle: playerForStats.personalCycle ?? 0,
              personalQuestionIndex: playerForStats.personalQuestionIndex ?? 0,
            });
          }
        }

        if (personalResult.correct && personalResult.points > 0) {
          // Mystery boxes — student picks one, then gets next personal question.
          game.mysteryBoxRound += 1;
          const boxes = generateMysteryBoxes(game, personalResult.points, socket.id);
          player.pendingMysteryBoxes = boxes;
          socket.emit("game:mystery-boxes", { count: boxes.length });
          // Safety net: if the student doesn't pick a box within 12s, auto-pick
          // a random one for them so they don't get stuck on the boxes screen.
          if (player.mysteryBoxAutoPickTimerId) clearTimeout(player.mysteryBoxAutoPickTimerId);
          player.mysteryBoxAutoPickTimerId = setTimeout(() => {
            const g = getGame(game.pin);
            if (!g || g.state === "finished") return;
            const p = g.players.get(socket.id);
            if (!p || p.disconnected) return;
            p.mysteryBoxAutoPickTimerId = null;
            if (!p.pendingMysteryBoxes || p.pendingMysteryBoxes.length === 0) return;
            const autoIndex = Math.floor(Math.random() * p.pendingMysteryBoxes.length);
            const result = applyMysteryBox(g, socket.id, autoIndex);
            if (!result.success) return;
            io.to(socket.id).emit("game:box-opened", {
              boxIndex: autoIndex,
              box: result.box,
              newScore: result.newScore,
              autoPicked: true,
            });
            if (result.box?.type === "hack" && result.hackTargets) {
              io.to(socket.id).emit("game:hack-targets", { targets: result.hackTargets });
              return;
            }
            const lb = getLeaderboard(g);
            const tlb = getTeamLeaderboard(g);
            io.to(`game:${g.pin}`).emit("game:scores-updated", { leaderboard: lb, teamLeaderboard: tlb, gameMode: g.gameMode });
            emitPersonalQuestion(io, g, p);
          }, 12000);
        } else {
          // Wrong answer — wait for student:ready-for-next, with 4s auto-advance fallback.
          if (player.hackReadyForNextTimerId) clearTimeout(player.hackReadyForNextTimerId);
          player.hackReadyForNextTimerId = setTimeout(() => {
            const g = getGame(game.pin);
            if (!g || g.state === "finished") return;
            const p = g.players.get(socket.id);
            if (!p || p.disconnected) return;
            p.hackReadyForNextTimerId = null;
            // Idempotency guard: if the player has already been advanced via
            // student:ready-for-next or any other path, don't double-advance
            // (which would cause a question to be skipped or, worse, race a
            // pending submit and grade it against the next question's shuffled
            // correct answer).
            if (p.personalCurrentQuestionId !== undefined) return;
            if (p.pendingMysteryBoxes && p.pendingMysteryBoxes.length > 0) return;
            if (p.pendingHackSession && !p.pendingHackSession.used) return;
            emitPersonalQuestion(io, g, p);
          }, 4000);
        }
        return;
      }

      // ===== Standard (non-hack) flow =====
      const result = submitAnswer(game, socket.id, data.answer);
      if (!result) return;

      const currentQ = game.questions[game.currentQuestionIndex];
      socket.emit("game:answer-result", {
        correct: result.correct,
        correctAnswer: currentQ.correctAnswer,
        points: result.points,
        streak: result.streak,
        totalScore: result.totalScore,
        giftEarned: false,
        frozen: result.frozen || false,
      });

      io.to(game.teacherSocketId).emit("game:answer-received", {
        answeredCount: game.answeredCount,
        totalPlayers: getActivePlayerCount(game),
      });

      if (game.answeredCount >= getActivePlayerCount(game)) {
        clearQuestionTimeout(game);
        endQuestion(io, game);
      }
    });

    socket.on("student:ready-for-next", (data: { pin: string }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode || game.state === "finished") return;
      const player = game.players.get(socket.id);
      if (!player || player.isBot || player.disconnected) return;
      // Cancel the fallback auto-advance timer and proceed immediately.
      if (player.hackReadyForNextTimerId) {
        clearTimeout(player.hackReadyForNextTimerId);
        player.hackReadyForNextTimerId = null;
      }
      // Only advance when the player is between questions. If a question is
      // already active (e.g. the server's auto-advance timer fired first, or
      // a stale countdown re-fired after a correct answer), ignore — otherwise
      // we'd skip a question or race a pending submit.
      if (player.personalCurrentQuestionId !== undefined) return;
      if (player.pendingMysteryBoxes && player.pendingMysteryBoxes.length > 0) return;
      if (player.pendingHackSession && !player.pendingHackSession.used) return;
      emitPersonalQuestion(io, game, player);
    });

    socket.on("student:request-password-choices", (data: { pin: string }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode) return;
      const player = game.players.get(socket.id);
      if (!player || player.password) return;
      // Re-emit existing choices if we have them, or generate fresh ones.
      let choices = Array.isArray(player.passwordChoices) && player.passwordChoices.length > 0
        ? player.passwordChoices.filter(w => !game.takenPasswords.has(w))
        : [];
      if (choices.length === 0) {
        choices = generatePasswordChoices(game);
        player.passwordChoices = choices;
      } else {
        player.passwordChoices = choices;
      }
      socket.emit("game:password-choices", { choices });
    });

    socket.on("student:set-password", (data: { pin: string; word: string }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode) return;
      const word = (data.word || "").trim().toUpperCase();
      if (!word) return;
      const claimed = claimPlayerPassword(game, socket.id, word);
      if (claimed) {
        socket.emit("game:password-set", { word });
        for (const [sid, p] of game.players) {
          if (sid !== socket.id && !p.password) {
            const freshChoices = generatePasswordChoices(game);
            p.passwordChoices = freshChoices;
            io.to(sid).emit("game:password-choices", { choices: freshChoices });
          }
        }
        // Late-joiner gating: if the marathon is already running and this
        // player has not yet received their first personal question (because
        // the password was a required gate), send it now.
        if (game.state === "question") {
          const me = game.players.get(socket.id);
          if (
            me &&
            !me.disconnected &&
            Array.isArray(me.personalQuestionOrder) &&
            me.personalQuestionOrder.length > 0 &&
            (me.personalQuestionIndex ?? -1) < 0 &&
            me.personalCurrentQuestionId === undefined
          ) {
            setTimeout(() => emitPersonalQuestion(io, game, me), 400);
          }
        }
      } else {
        const player = game.players.get(socket.id);
        const existing = player?.passwordChoices ?? [];
        const filtered = existing.filter(w => !game.takenPasswords.has(w));
        if (player) player.passwordChoices = filtered;
        socket.emit("game:password-choices", { choices: filtered, taken: true });
      }
    });

    socket.on("student:open-box", (data: { pin: string; boxIndex: number }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode) return;
      const playerForTimer = game.players.get(socket.id);
      if (playerForTimer?.mysteryBoxAutoPickTimerId) {
        clearTimeout(playerForTimer.mysteryBoxAutoPickTimerId);
        playerForTimer.mysteryBoxAutoPickTimerId = null;
      }
      const result = applyMysteryBox(game, socket.id, data.boxIndex);
      if (!result.success) return;

      socket.emit("game:box-opened", {
        boxIndex: data.boxIndex,
        box: result.box,
        newScore: result.newScore,
      });

      if (result.box?.type === "hack" && result.hackTargets) {
        socket.emit("game:hack-targets", { targets: result.hackTargets });
        // Don't auto-advance — wait for the hack flow to resolve.
        return;
      }

      const leaderboard = getLeaderboard(game);
      const teamLeaderboard = getTeamLeaderboard(game);
      io.to(`game:${game.pin}`).emit("game:scores-updated", { leaderboard, teamLeaderboard, gameMode: game.gameMode });

      // After non-hack box, immediately advance to the next personal question.
      {
        const _gBox = getGame(game.pin);
        if (_gBox && _gBox.state !== "finished") {
          const _pBox = _gBox.players.get(socket.id);
          if (_pBox && !_pBox.disconnected) emitPersonalQuestion(io, _gBox, _pBox);
        }
      }
    });

    socket.on("student:pick-hack-target", (data: { pin: string; targetName: string }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode) return;
      const player = game.players.get(socket.id);
      if (!player?.pendingHackSession || player.pendingHackSession.used) return;
      const validTarget = player.pendingHackSession.hackTargets.some(t => t.name === data.targetName);
      if (!validTarget) return;
      player.pendingHackSession.targetName = data.targetName;
      const choices = getHackPasswordChoices(game, data.targetName, socket.id);
      if (!choices) {
        socket.emit("game:hack-password-choices", { error: "لا يمتلك هذا اللاعب كلمة سر" });
        return;
      }
      socket.emit("game:hack-password-choices", { targetName: data.targetName, choices });
    });

    socket.on("student:guess-hack-password", (data: { pin: string; targetName: string; guess: string }) => {
      const game = getGame(data.pin);
      if (!game || !game.hackMode) return;
      const player = game.players.get(socket.id);
      if (!player?.pendingHackSession || player.pendingHackSession.used) return;
      if (player.pendingHackSession.targetName !== data.targetName) return;
      const result = resolveHackAttempt(game, socket.id, data.targetName, data.guess);
      const hacker = game.players.get(socket.id);

      if (result.success) {
        socket.emit("game:hack-result", {
          success: true,
          stolenAmount: result.stolenAmount,
          targetName: data.targetName,
          newScore: result.hackerScore,
        });
        if (result.targetSocketId) {
          io.to(result.targetSocketId).emit("game:hack-notification", {
            fromPlayer: hacker?.name || "",
            fromAvatar: hacker?.avatar || "",
            stolenAmount: result.stolenAmount,
            newScore: result.targetScore,
          });
        }
        // Broadcast hack event to the whole room (teacher sees live feed)
        io.to(`game:${game.pin}`).emit("game:hack-broadcast", {
          hackerName: hacker?.name || "",
          hackerAvatar: hacker?.avatar || "",
          targetName: data.targetName,
          stolenAmount: result.stolenAmount,
          timestamp: Date.now(),
        });
        const leaderboard = getLeaderboard(game);
        const teamLeaderboard = getTeamLeaderboard(game);
        io.to(`game:${game.pin}`).emit("game:scores-updated", { leaderboard, teamLeaderboard, gameMode: game.gameMode });
      } else {
        socket.emit("game:hack-result", { success: false, targetName: data.targetName });
      }

      // Marathon flow: after hack resolves, advance hacker to next personal question.
      if (game.hackMode) {
        setTimeout(() => {
          const g = getGame(game.pin);
          if (!g || g.state === "finished") return;
          const p = g.players.get(socket.id);
          if (!p || p.disconnected) return;
          emitPersonalQuestion(io, g, p);
        }, 3500);
      }
    });

    socket.on("student:use-gift", (data: UseGiftData) => {
      const game = getGame(data.pin);
      if (!game) return;

      const result = useGift(game, socket.id, data.giftType, data.targetName, data.stealAmount);

      const player = game.players.get(socket.id);

      if ((result as any).shieldBlocked && result.affectedPlayer) {
        socket.emit("game:gift-result", { success: true, message: "", shieldBlocked: true });
        const target = Array.from(game.players.values()).find((p) => p.name === result.affectedPlayer);
        if (target) {
          io.to(target.socketId).emit("game:shield-blocked", {
            attackerName: player?.name,
            message: `درعك صدّ هجوم ${player?.name}! 🛡️`,
          });
        }
      } else {
        socket.emit("game:gift-result", result);
      }

      if (result.success) {
        if (result.affectedPlayer) {
          const target = Array.from(game.players.values()).find((p) => p.name === result.affectedPlayer);
          if (target) {
            if (result.froze) {
              io.to(target.socketId).emit("game:frozen", {
                fromPlayer: player?.name,
                fromAvatar: player?.avatar,
                message: `${player?.name} جمّدك لسؤال واحد! 🥶`,
              });
            } else if (data.giftType === "give") {
              io.to(target.socketId).emit("game:gift-notification", {
                fromPlayer: player?.name,
                fromAvatar: player?.avatar,
                giftType: data.giftType,
                message: `${player?.name} أهداك ${result.pointsChanged} نقطة! 🎁`,
                pointsChanged: result.pointsChanged || 0,
              });
            } else if (data.giftType === "steal") {
              io.to(target.socketId).emit("game:gift-notification", {
                fromPlayer: player?.name,
                fromAvatar: player?.avatar,
                giftType: "steal",
                message: `${player?.name} سحب ${result.pointsChanged} نقطة منك! 💰`,
                pointsChanged: -(result.pointsChanged || 0),
              });
            }
          }
        }

        io.to(game.teacherSocketId).emit("game:gift-used", {
          playerName: player?.name,
          playerAvatar: player?.avatar,
          giftType: data.giftType,
          message: result.message,
          affectedPlayer: result.affectedPlayer,
        });

        const leaderboard = getLeaderboard(game);
        const teamLeaderboard = getTeamLeaderboard(game);
        io.to(`game:${data.pin}`).emit("game:scores-updated", { leaderboard, teamLeaderboard, gameMode: game.gameMode });
      }

      if (game.state === "gift-round") {
        recordGiftRoundChoice(game, socket.id);
        if (allPlayersChoseGift(game)) {
          finishGiftRound(io, game);
        }
      }
    });

    socket.on("teacher:broadcast-message", (data: PinData & { message: string }) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;
      if (!game.hackMode) return;

      const message = (data.message || "").trim();
      if (!message) return;

      for (const player of game.players.values()) {
        if (player.isBot || player.disconnected) continue;
        io.to(player.socketId).emit("game:teacher-message", { message });
      }
    });

    socket.on("teacher:next-question", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) return;

      if (game.state !== "leaderboard") return;

      clearQuestionTimeout(game);

      const question = nextQuestion(game);
      if (!question) {
        emitLeaderboardData(io, game, "game:finished", {
          totalQuestions: game.questions.length,
        });
        saveGameHistory(game);
        game.finishDeleteTimerId = setTimeout(() => deleteGame(data.pin), 60000);
        return;
      }

      emitQuestionToRoom(io, game, question);
      scheduleQuestionTimeout(io, game, game.currentQuestionIndex);
    });

    socket.on("teacher:kick-player", (data: PinData & { playerName: string }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const playerName = typeof data.playerName === "string" ? data.playerName.trim() : "";
      if (!playerName) {
        callback?.({ error: "اسم اللاعب مطلوب" });
        return;
      }

      const kicked = kickPlayerByName(data.pin, playerName);
      if (!kicked) {
        callback?.({ error: "اللاعب غير موجود" });
        return;
      }

      io.to(kicked.socketId).emit("game:kicked", { message: "تم إخراجك من اللعبة من قبل المعلم" });

      const kickedSocket = io.sockets.sockets.get(kicked.socketId);
      if (kickedSocket) {
        kickedSocket.leave(`game:${data.pin}`);
      }

      io.to(`game:${data.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);

      if (game.state === "question" && getActivePlayerCount(game) > 0 && game.answeredCount >= getActivePlayerCount(game)) {
        clearQuestionTimeout(game);
        endQuestion(io, game);
      }

      callback?.({ success: true, kickedPlayer: kicked.name });
      logger.info({ pin: data.pin, kicked: kicked.name }, "Teacher kicked player");
    });

    // Allows the teacher to change (or clear) the target class of an active
    // game from the host screen — useful when they jumped straight into the
    // game without picking a class on the setup page, or want to re-target it
    // mid-lobby. The change takes effect immediately for subsequent
    // student-class checks.
    socket.on("teacher:set-target-class", (data: PinData & { targetClass?: string | null }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const trimmed = typeof data.targetClass === "string" ? data.targetClass.trim().slice(0, 60) : "";
      game.targetClass = trimmed || null;
      game.targetClasses = trimmed ? [trimmed] : null;
      callback?.({ success: true, targetClass: game.targetClass, targetClasses: game.targetClasses });
      logger.info({ pin: data.pin, targetClass: game.targetClass }, "Teacher updated game target class");
    });

    socket.on("teacher:toggle-room-lock", (data: PinData & { locked: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const locked = !!data.locked;
      const ok = setRoomLocked(game.pin, locked);
      if (!ok) {
        callback?.({ error: "تعذر تحديث حالة الغرفة" });
        return;
      }
      io.to(`game:${game.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);
      callback?.({ success: true, locked });
      logger.info({ pin: data.pin, locked }, "Teacher toggled room lock");
    });

    socket.on("teacher:toggle-team-lock", (data: PinData & { teamName: string; locked: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teamName = typeof data.teamName === "string" ? data.teamName.trim() : "";
      if (!teamName || !game.teamNames.includes(teamName)) {
        callback?.({ error: "الفريق غير موجود" });
        return;
      }
      const locked = !!data.locked;
      const ok = setTeamLocked(game.pin, teamName, locked);
      if (!ok) {
        callback?.({ error: "تعذر تحديث حالة الفريق" });
        return;
      }
      io.to(`game:${game.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);
      callback?.({ success: true, teamName, locked });
      logger.info({ pin: data.pin, teamName, locked }, "Teacher toggled team lock");
    });

    socket.on("teacher:move-player", (data: PinData & { playerName: string; teamName: string }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      if (game.gameMode !== "teams") {
        callback?.({ error: "لا يمكن نقل اللاعبين إلا في وضع الفرق" });
        return;
      }
      const playerName = typeof data.playerName === "string" ? data.playerName.trim() : "";
      const teamName = typeof data.teamName === "string" ? data.teamName.trim() : "";
      if (!playerName || !teamName) {
        callback?.({ error: "اسم اللاعب والفريق مطلوبان" });
        return;
      }
      if (!game.teamNames.includes(teamName)) {
        callback?.({ error: "الفريق غير موجود" });
        return;
      }
      const moved = movePlayerToTeam(game.pin, playerName, teamName);
      if (!moved) {
        callback?.({ error: "اللاعب غير موجود" });
        return;
      }
      io.to(`game:${game.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);
      // Notify the moved player so their UI can update myTeam.
      const player = Array.from(game.players.values()).find((p) => p.name === playerName && !p.isBot);
      if (player) {
        io.to(player.socketId).emit("game:team-changed", { teamName });
      }
      callback?.({ success: true, playerName, teamName });
      logger.info({ pin: data.pin, playerName, teamName }, "Teacher moved player to team");
    });

    socket.on("teacher:toggle-points", (data: PinData & { enabled: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const enabled = data.enabled === true;
      setPointsEnabled(data.pin, enabled);
      io.to(`game:${data.pin}`).emit("game:points-toggled", { enabled });
      callback?.({ success: true, enabled });
      logger.info({ pin: data.pin, pointsEnabled: enabled }, "Teacher toggled points");
    });

    socket.on("teacher:toggle-gifts", (data: PinData & { enabled: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const enabled = data.enabled === true;
      if (enabled && game.hackMode) {
        callback?.({ error: "لا يمكن تفعيل الهدايا في وضع الاختراق" });
        return;
      }
      setGiftsEnabled(data.pin, enabled);
      io.to(`game:${data.pin}`).emit("game:gifts-toggled", { enabled });
      callback?.({ success: true, enabled });
      logger.info({ pin: data.pin, giftsEnabled: enabled }, "Teacher toggled gifts");
    });

    socket.on("teacher:toggle-tts", (data: PinData & { enabled: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const enabled = data.enabled === true;
      setTtsEnabled(data.pin, enabled);
      io.to(`game:${data.pin}`).emit("game:tts-toggled", { enabled });
      callback?.({ success: true, enabled });
      logger.info({ pin: data.pin, ttsEnabled: enabled }, "Teacher toggled TTS");
    });

    socket.on("teacher:toggle-hack-mode", (data: PinData & { enabled: boolean }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) {
        callback?.({ error: "غير مصرح" });
        return;
      }

      const enabled = data.enabled === true;
      setHackMode(data.pin, enabled);
      io.to(`game:${game.pin}`).emit("game:hack-mode-toggled", { enabled });

      if (enabled) {
        for (const player of game.players.values()) {
          if (player.isBot || player.disconnected || player.password) continue;
          const choices = generatePasswordChoices(game);
          player.passwordChoices = choices;
          io.to(player.socketId).emit("game:password-choices", { choices });
        }
      }

      callback?.({ success: true, enabled });
      logger.info({ pin: data.pin, hackMode: enabled }, "Teacher toggled hack mode");
    });

    socket.on("teacher:add-bots", (data: PinData & { count: number }, callback?: (res: any) => void) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) {
        callback?.({ error: "غير مصرح" });
        return;
      }
      if (game.state !== "lobby") {
        callback?.({ error: "لا يمكن إضافة لاعبين وهميين بعد بدء اللعبة" });
        return;
      }

      const count = Math.max(2, Math.min(8, Number(data.count) || 4));
      addBotPlayers(game, count);

      io.to(`game:${data.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);

      callback?.({ success: true, count });
      logger.info({ pin: data.pin, count }, "Teacher added bot players");
    });

    socket.on("teacher:skip-question", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) return;

      if (game.state !== "question") return;

      clearQuestionTimeout(game);
      endQuestion(io, game);
    });

    socket.on("teacher:replay-game", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) return;

      if (game.state !== "finished") return;

      resetGameToLobby(game);
      const playerList = getPlayerList(game);
      io.to(`game:${game.pin}`).emit("game:replay", {
        players: playerList,
        gameMode: game.gameMode,
        teamNames: game.teamNames,
        roomLocked: game.roomLocked,
        lockedTeams: Array.from(game.lockedTeams),
      });
    });

    socket.on("teacher:end-game", (data: PinData) => {
      const game = getGame(data.pin);
      if (!game || game.teacherSocketId !== socket.id) return;

      const teacherId = getTeacherIdFromSocket(socket);
      if (!teacherId || teacherId !== game.teacherId) return;

      clearQuestionTimeout(game);
      game.state = "finished";
      emitLeaderboardData(io, game, "game:finished", {
        totalQuestions: game.questions.length,
      });
      saveGameHistory(game);
      game.finishDeleteTimerId = setTimeout(() => deleteGame(data.pin), 60000);
    });

    socket.on("disconnect", () => {
      const teacherGame = findGameByTeacher(socket.id);
      if (teacherGame) {
        logger.info({ pin: teacherGame.pin }, "Teacher disconnected, starting grace period");

        const existingTimer = teacherDisconnectTimers.get(teacherGame.pin);
        if (existingTimer) clearTimeout(existingTimer);

        const isActiveGame = teacherGame.state !== "lobby" && teacherGame.state !== "finished";
        const graceMs = isActiveGame ? TEACHER_RECONNECT_GRACE_ACTIVE_MS : TEACHER_RECONNECT_GRACE_LOBBY_MS;
        const timer = setTimeout(() => {
          teacherDisconnectTimers.delete(teacherGame.pin);
          const currentGame = getGame(teacherGame.pin);
          if (!currentGame) return;
          clearQuestionTimeout(currentGame);
          io.to(`game:${currentGame.pin}`).emit("game:teacher-disconnected");
          deleteGame(currentGame.pin);
          logger.info({ pin: teacherGame.pin, graceMs }, "Teacher did not reconnect, game deleted");
        }, graceMs);
        teacherDisconnectTimers.set(teacherGame.pin, timer);
        return;
      }

      const playerGame = findGameByPlayer(socket.id);
      if (playerGame) {
        const { game } = playerGame;
        removePlayer(game.pin, socket.id);
        io.to(`game:${game.pin}`).emit("game:players-updated", buildPlayersUpdatedPayload(game)!);
      }
    });
  });
}
