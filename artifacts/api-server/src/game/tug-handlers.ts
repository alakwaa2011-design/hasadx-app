import { Server } from "socket.io";
import { logger } from "../lib/logger";
import { randomBytes } from "crypto";
import { db, studentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface TugQuestion {
  text: string;
  options: string[];
  correct: number;
  duration: number;
}

interface TugPlayer {
  socketId: string;
  name: string;
  avatar: string;
  team: "blue" | "red";
  score: number;
  streak: number;
}

interface RoundAnswer {
  correct: boolean;
  timeMs: number;
}

interface PendingPlayer {
  socketId: string;
  name: string;
  avatar: string;
}

interface TugGame {
  pin: string;
  creatorSocketId: string;
  creatorToken: string;
  questions: TugQuestion[];
  currentQuestionIndex: number;
  state: "lobby" | "countdown" | "question" | "round-end" | "finished" | "paused";
  stateBeforePause?: "countdown" | "question";
  pausedTimeRemaining?: number;
  players: Record<string, TugPlayer>;
  pendingPlayers: Record<string, PendingPlayer>;
  ropePosition: number;
  roundAnswers: Record<string, RoundAnswer>;
  questionStartTime?: number;
  questionTimer?: ReturnType<typeof setTimeout>;
  autoAdvanceTimer?: ReturnType<typeof setTimeout>;
  autoAdvance: boolean;
  targetClass?: string;
  teacherId?: number;
  winner?: "blue" | "red" | "draw";
}

const tugGames = new Map<string, TugGame>();

export function getTugGame(pin: string): TugGame | undefined {
  return tugGames.get(pin);
}

function generatePin(): string {
  let pin: string;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (tugGames.has(pin));
  return pin;
}

function isPowerQuestion(index: number): boolean {
  return index > 0 && (index + 1) % 3 === 0;
}

function getPlayerList(game: TugGame) {
  return Object.values(game.players).map((p) => ({
    name: p.name,
    avatar: p.avatar,
    team: p.team,
    score: p.score,
    streak: p.streak,
  }));
}

function calcCurrentRopePosition(
  game: TugGame,
  questionDuration: number
): { ropePosition: number; blueScore: number; redScore: number } {
  const bluePlayers = Object.values(game.players).filter((p) => p.team === "blue");
  const redPlayers = Object.values(game.players).filter((p) => p.team === "red");

  const power = isPowerQuestion(game.currentQuestionIndex);
  const multiplier = power ? 2 : 1;

  let blueScore = 0;
  let redScore = 0;

  for (const [socketId, answer] of Object.entries(game.roundAnswers)) {
    const player = game.players[socketId];
    if (!player) continue;
    const speedBonus = 1 + Math.max(0, 1 - answer.timeMs / (questionDuration * 1000));
    const streakBonus = player.streak >= 3 ? 0.5 : 0;
    const pts = answer.correct ? (speedBonus + streakBonus) * multiplier : -0.5;
    if (player.team === "blue") blueScore += pts;
    else redScore += pts;
  }

  const blueNorm = blueScore / Math.max(bluePlayers.length, 1);
  const redNorm = redScore / Math.max(redPlayers.length, 1);

  const delta = (redNorm - blueNorm) * 4;
  const newPosition = Math.max(5, Math.min(95, game.ropePosition + delta));

  return {
    ropePosition: Math.round(newPosition * 10) / 10,
    blueScore: Math.round(blueScore * 100) / 100,
    redScore: Math.round(redScore * 100) / 100,
  };
}

function cleanupGame(pin: string) {
  const game = tugGames.get(pin);
  if (game?.questionTimer) clearTimeout(game.questionTimer);
  if (game?.autoAdvanceTimer) clearTimeout(game.autoAdvanceTimer);
  tugGames.delete(pin);
}

const COUNTDOWN_MS = 3500;
const SHORT_COUNTDOWN_MS = 0;
const AUTO_ADVANCE_MS = 5000;

function advanceToNext(tugNs: ReturnType<Server["of"]>, game: TugGame) {
  if (game.state !== "round-end") return;
  game.currentQuestionIndex += 1;

  if (game.currentQuestionIndex >= game.questions.length) {
    let winner: "blue" | "red" | "draw";
    if (game.ropePosition < 45) winner = "blue";
    else if (game.ropePosition > 55) winner = "red";
    else winner = "draw";

    game.winner = winner;
    game.state = "finished";

    tugNs.to(`tug:${game.pin}`).emit("tug:game-end", {
      winner,
      ropePosition: game.ropePosition,
      players: getPlayerList(game),
    });

    setTimeout(() => cleanupGame(game.pin), 30 * 60 * 1000);
  } else {
    broadcastQuestion(tugNs, game);
  }
}

function broadcastQuestion(tugNs: ReturnType<Server["of"]>, game: TugGame) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) return;

  const power = isPowerQuestion(game.currentQuestionIndex);
  const isFirst = game.currentQuestionIndex === 0;
  const countdownMs = isFirst ? COUNTDOWN_MS : SHORT_COUNTDOWN_MS;

  if (game.questionTimer) clearTimeout(game.questionTimer);

  if (countdownMs > 0) {
    game.state = "countdown";
    tugNs.to(`tug:${game.pin}`).emit("tug:countdown", {
      index: game.currentQuestionIndex,
      total: game.questions.length,
      isPower: power,
      brief: false,
    });

    game.questionTimer = setTimeout(() => {
      startQuestion(tugNs, game, q, power);
    }, countdownMs);
  } else {
    startQuestion(tugNs, game, q, power);
  }
}

function startQuestion(tugNs: ReturnType<Server["of"]>, game: TugGame, q: TugQuestion, power: boolean) {
  game.state = "question";
  game.roundAnswers = {};
  game.questionStartTime = Date.now();

  tugNs.to(`tug:${game.pin}`).emit("tug:question", {
    index: game.currentQuestionIndex,
    total: game.questions.length,
    text: q.text,
    options: q.options,
    duration: q.duration,
    isPower: power,
  });

  scheduleBotAnswers(tugNs, game);

  game.questionTimer = setTimeout(() => {
    endRound(tugNs, game);
  }, q.duration * 1000 + 500);
}

function scheduleBotAnswers(tugNs: ReturnType<Server["of"]>, game: TugGame) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) return;

  const bots = Object.entries(game.players).filter(([id]) => id.startsWith("bot-"));
  for (const [botId, bot] of bots) {
    const delay = 1500 + Math.random() * (q.duration * 1000 * 0.6);
    setTimeout(() => {
      if (game.state !== "question" || game.roundAnswers[botId]) return;

      const correct = Math.random() < 0.5;
      const answerIndex = correct ? q.correct : ((q.correct + 1 + Math.floor(Math.random() * (q.options.length - 1))) % q.options.length);
      const timeMs = delay;

      game.roundAnswers[botId] = { correct, timeMs };

      const newStreak = correct ? bot.streak + 1 : 0;
      bot.streak = newStreak;

      const { ropePosition, blueScore, redScore } = calcCurrentRopePosition(game, q.duration);
      tugNs.to(`tug:${game.pin}`).emit("tug:rope-update", {
        ropePosition,
        blueScore,
        redScore,
        answeredCount: Object.keys(game.roundAnswers).length,
        totalPlayers: Object.keys(game.players).length,
      });

      const playerCount = Object.keys(game.players).length;
      const answeredCount = Object.keys(game.roundAnswers).length;
      if (answeredCount >= playerCount) {
        if (game.questionTimer) clearTimeout(game.questionTimer);
        endRound(tugNs, game);
      }
    }, delay);
  }
}

function endRound(tugNs: ReturnType<Server["of"]>, game: TugGame) {
  if (game.state !== "question") return;
  game.state = "round-end";
  if (game.questionTimer) clearTimeout(game.questionTimer);

  const q = game.questions[game.currentQuestionIndex];
  const power = isPowerQuestion(game.currentQuestionIndex);
  const { ropePosition, blueScore, redScore } = calcCurrentRopePosition(game, q.duration);
  game.ropePosition = ropePosition;

  const streakUpdates: Record<string, number> = {};

  for (const [socketId, answer] of Object.entries(game.roundAnswers)) {
    const player = game.players[socketId];
    if (!player) continue;
    if (answer.correct) {
      player.streak += 1;
      const timeBonus = Math.floor((1 - answer.timeMs / (q.duration * 1000)) * 50);
      let pts = 100 + Math.max(0, timeBonus);
      if (power) pts *= 2;
      if (player.streak >= 3) pts += 50;
      player.score += pts;
    } else {
      player.streak = 0;
    }
    streakUpdates[player.name] = player.streak;
  }

  const blueStreaks = Object.values(game.players)
    .filter(p => p.team === "blue" && p.streak >= 3).length;
  const redStreaks = Object.values(game.players)
    .filter(p => p.team === "red" && p.streak >= 3).length;

  const isLast = game.currentQuestionIndex >= game.questions.length - 1;

  tugNs.to(`tug:${game.pin}`).emit("tug:round-end", {
    correctIndex: q.correct,
    ropePosition: game.ropePosition,
    blueScore,
    redScore,
    players: getPlayerList(game),
    questionIndex: game.currentQuestionIndex,
    total: game.questions.length,
    isLast,
    isPower: power,
    streakUpdates,
    blueOnFire: blueStreaks > 0,
    redOnFire: redStreaks > 0,
    autoAdvance: true,
    autoAdvanceIn: 0,
  });

  if (game.autoAdvanceTimer) clearTimeout(game.autoAdvanceTimer);
  game.autoAdvanceTimer = setTimeout(() => {
    game.autoAdvanceTimer = undefined;
    advanceToNext(tugNs, game);
  }, 1000);
}

// Per-socket rate limiter for tug:create. Prevents flood-creating tug games
// that would otherwise sit in memory for the cleanup TTL. Uses a regular Map
// keyed by socket.id (string) and is cleaned up on disconnect, plus a periodic
// sweep that drops empty/stale buckets so memory stays bounded.
const TUG_CREATE_WINDOW_MS = 60 * 1000;
const TUG_CREATE_MAX = 5;
const tugCreateBuckets = new Map<string, number[]>();
function allowTugCreate(socketId: string): boolean {
  const now = Date.now();
  const bucket = (tugCreateBuckets.get(socketId) || []).filter(
    (t) => now - t < TUG_CREATE_WINDOW_MS,
  );
  if (bucket.length >= TUG_CREATE_MAX) {
    tugCreateBuckets.set(socketId, bucket);
    return false;
  }
  bucket.push(now);
  tugCreateBuckets.set(socketId, bucket);
  return true;
}
function clearTugRateBucket(socketId: string): void {
  tugCreateBuckets.delete(socketId);
}
// Safety net: periodic sweep of stale empty buckets (in case a disconnect
// handler is missed). Runs every 5 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [sid, bucket] of tugCreateBuckets.entries()) {
    const fresh = bucket.filter((t) => now - t < TUG_CREATE_WINDOW_MS);
    if (fresh.length === 0) tugCreateBuckets.delete(sid);
    else if (fresh.length !== bucket.length) tugCreateBuckets.set(sid, fresh);
  }
}, 5 * 60 * 1000).unref();

export function setupTugSocket(io: Server) {
  const tugNs = io.of("/tug");

  tugNs.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Tug socket connected");

    socket.on(
      "tug:create",
      (data: { questions: TugQuestion[]; duration?: number; autoAdvance?: boolean; targetClass?: string }, cb: (r: object) => void) => {
        try {
          if (!allowTugCreate(socket.id))
            return cb({ error: "محاولات إنشاء كثيرة جداً. الرجاء الانتظار دقيقة." });
          if (!Array.isArray(data.questions) || data.questions.length < 1)
            return cb({ error: "يجب إضافة سؤال واحد على الأقل" });
          if (data.questions.length > 20)
            return cb({ error: "الحد الأقصى 20 سؤالاً" });

          const session = (socket.request as any).session;
          const sessionTeacherId = session?.teacherId as number | undefined;

          const pin = generatePin();
          const duration = Math.max(5, Math.min(60, data.duration ?? 20));
          const creatorToken = randomBytes(16).toString("hex");

          const questions: TugQuestion[] = data.questions.map((q) => ({
            text: q.text,
            options: q.options,
            correct: q.correct,
            duration,
          }));

          const game: TugGame = {
            pin,
            creatorSocketId: socket.id,
            creatorToken,
            questions,
            currentQuestionIndex: 0,
            state: "lobby",
            players: {},
            pendingPlayers: {},
            ropePosition: 50,
            roundAnswers: {},
            autoAdvance: data.autoAdvance !== false,
            targetClass: data.targetClass || undefined,
            teacherId: sessionTeacherId || undefined,
          };

          tugGames.set(pin, game);
          socket.join(`tug:${pin}`);

          setTimeout(() => cleanupGame(pin), 3 * 60 * 60 * 1000);

          logger.info({ pin }, "Tug game created");
          cb({ pin, creatorToken });
        } catch (err) {
          logger.error(err, "tug:create error");
          cb({ error: "حدث خطأ" });
        }
      }
    );

    socket.on(
      "tug:reclaim-host",
      (data: { pin: string; creatorToken: string }, cb: (r: object) => void) => {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorToken !== data.creatorToken) return cb({ error: "رمز غير صحيح." });

        game.creatorSocketId = socket.id;
        socket.join(`tug:${game.pin}`);

        const q = game.questions[game.currentQuestionIndex] ?? null;
        const elapsedMs = game.questionStartTime ? Date.now() - game.questionStartTime : 0;
        const remainingSecs = q ? Math.max(0, q.duration - Math.floor(elapsedMs / 1000)) : 0;

        cb({
          success: true,
          state: game.state,
          pending: Object.values(game.pendingPlayers).map(p => ({ name: p.name, avatar: p.avatar, socketId: p.socketId })),
          questionIndex: game.currentQuestionIndex,
          ropePosition: game.ropePosition,
          players: getPlayerList(game),
          activeQuestion: (game.state === "question" || game.state === "paused" || game.state === "round-end") && q ? {
            index: game.currentQuestionIndex,
            total: game.questions.length,
            text: q.text,
            options: q.options,
            duration: q.duration,
            remainingSecs: game.state === "paused" ? (game.pausedTimeRemaining ?? q.duration) : remainingSecs,
            isPower: isPowerQuestion(game.currentQuestionIndex),
          } : null,
          roundSummary: game.state === "round-end" && q ? (() => {
            const { ropePosition, blueScore, redScore } = calcCurrentRopePosition(game, q.duration);
            return {
              correctIndex: q.correct,
              ropePosition,
              blueScore,
              redScore,
              isLast: game.currentQuestionIndex >= game.questions.length - 1,
              questionIndex: game.currentQuestionIndex,
              total: game.questions.length,
              isPower: isPowerQuestion(game.currentQuestionIndex),
            };
          })() : null,
        });
      }
    );

    socket.on(
      "tug:join",
      async (data: { pin: string; name: string; avatar?: string }, cb: (r: object) => void) => {
        try {
          const game = tugGames.get(data.pin);
          if (!game) return cb({ error: "لم يتم العثور على الغرفة. تحقق من الرمز." });
          if (game.state === "finished") return cb({ error: "انتهت اللعبة." });

          const trimmedName = (data.name || "").trim();
          if (!trimmedName) return cb({ error: "يرجى إدخال اسمك." });

          if (game.targetClass) {
            if (!game.teacherId) {
              return cb({ error: "خطأ في إعداد اللعبة. لا يمكن التحقق من قائمة الصف." });
            }
            const students = await db
              .select({ name: studentsTable.name })
              .from(studentsTable)
              .where(and(eq(studentsTable.teacherId, game.teacherId), eq(studentsTable.gradeLevel, game.targetClass)));
            const validNames = students.map(s => s.name.trim());
            if (!validNames.includes(trimmedName)) {
              return cb({ error: "اسمك غير موجود في قائمة الصف. اختر اسمك من القائمة." });
            }
          }

          const avatar = data.avatar || "🦁";

          const blueCount = Object.values(game.players).filter((p) => p.team === "blue").length;
          const redCount = Object.values(game.players).filter((p) => p.team === "red").length;
          const team: "blue" | "red" = blueCount <= redCount ? "blue" : "red";

          const player: TugPlayer = {
            socketId: socket.id,
            name: trimmedName,
            avatar,
            team,
            score: 0,
            streak: 0,
          };
          game.players[socket.id] = player;
          socket.join(`tug:${game.pin}`);

          tugNs.to(`tug:${game.pin}`).emit("tug:players-updated", { players: getPlayerList(game) });

          const q = game.questions[game.currentQuestionIndex];
          const remainingSecs = (game.state === "question" && game.questionStartTime && q)
            ? Math.max(0, q.duration - Math.floor((Date.now() - game.questionStartTime) / 1000))
            : (game.state === "paused" ? (game.pausedTimeRemaining ?? q?.duration) : undefined);

          cb({
            success: true,
            team,
            players: getPlayerList(game),
            pin: game.pin,
            gameState: game.state,
            ropePosition: game.ropePosition,
            activeQuestion: (game.state === "question" || game.state === "paused" || game.state === "round-end") && q ? {
              index: game.currentQuestionIndex,
              total: game.questions.length,
              text: q.text,
              options: q.options,
              duration: q.duration,
              isPower: isPowerQuestion(game.currentQuestionIndex),
              remainingSecs,
            } : undefined,
            roundSummary: game.state === "round-end" && q ? {
              correctIndex: q.correct,
              ropePosition: game.ropePosition,
              blueScore: 0, redScore: 0,
              questionIndex: game.currentQuestionIndex,
              total: game.questions.length,
              isLast: game.currentQuestionIndex >= game.questions.length - 1,
            } : undefined,
          });
        } catch (err) {
          logger.error(err, "tug:join error");
          cb({ error: "حدث خطأ" });
        }
      }
    );

    socket.on("tug:add-bots", (data: { pin: string; count: number }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state !== "lobby") return cb({ error: "اللعبة بدأت بالفعل." });

        const botNames = ["روبوت ١", "روبوت ٢", "روبوت ٣", "روبوت ٤", "روبوت ٥", "روبوت ٦", "روبوت ٧", "روبوت ٨"];
        const botAvatars = ["🤖", "👾", "🎮", "🕹️", "🧩", "🎲", "🃏", "🎯"];
        const count = Math.min(data.count || 2, 8);

        let added = 0;
        for (let i = 0; i < count; i++) {
          const botId = `bot-${game.pin}-${Date.now()}-${i}`;
          const existing = Object.values(game.players).filter(p => p.socketId.startsWith("bot-")).length;
          if (existing >= 8) break;

          const blueCount = Object.values(game.players).filter((p) => p.team === "blue").length;
          const redCount = Object.values(game.players).filter((p) => p.team === "red").length;
          const team: "blue" | "red" = blueCount <= redCount ? "blue" : "red";

          game.players[botId] = {
            socketId: botId,
            name: botNames[existing % botNames.length],
            avatar: botAvatars[existing % botAvatars.length],
            team,
            score: 0,
            streak: 0,
          };
          added++;
        }

        tugNs.to(`tug:${game.pin}`).emit("tug:players-updated", { players: getPlayerList(game) });
        cb({ success: true, added });
      } catch (err) {
        logger.error(err, "tug:add-bots error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:remove-bots", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });

        for (const id of Object.keys(game.players)) {
          if (id.startsWith("bot-")) delete game.players[id];
        }

        tugNs.to(`tug:${game.pin}`).emit("tug:players-updated", { players: getPlayerList(game) });
        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:remove-bots error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:move-player", (data: { pin: string; playerName: string; team: "blue" | "red" }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط المعلم يمكنه تغيير الفرق." });
        const player = Object.values(game.players).find(p => p.name === data.playerName);
        if (!player) return cb({ error: "اللاعب غير موجود." });
        player.team = data.team;
        tugNs.to(`tug:${game.pin}`).emit("tug:players-updated", { players: getPlayerList(game) });
        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:move-player error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:start", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة يمكنه البدء." });
        if (game.state !== "lobby") return cb({ error: "اللعبة بدأت بالفعل." });
        if (Object.keys(game.players).length < 1) return cb({ error: "يجب أن ينضم لاعب واحد على الأقل." });

        broadcastQuestion(tugNs, game);
        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:start error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on(
      "tug:answer",
      (data: { pin: string; answerIndex: number; answerText?: string }, cb: (r: object) => void) => {
        try {
          const game = tugGames.get(data.pin);
          if (!game) return cb({ error: "الغرفة غير موجودة." });
          if (game.state !== "question") return cb({ error: "لا يوجد سؤال نشط." });

          const player = game.players[socket.id];
          if (!player) return cb({ error: "أنت لست في هذه اللعبة." });
          if (game.roundAnswers[socket.id]) return cb({ error: "أجبت بالفعل." });

          const q = game.questions[game.currentQuestionIndex];
          const timeMs = Date.now() - (game.questionStartTime ?? Date.now());
          const submittedText = typeof data.answerText === "string" ? data.answerText.trim() : "";
          const correctText = q.options[q.correct]?.trim() ?? "";
          const correct = data.answerIndex === q.correct || (!!submittedText && submittedText === correctText);
          const isBoost = correct && timeMs < q.duration * 1000 * 0.25;
          const power = isPowerQuestion(game.currentQuestionIndex);

          game.roundAnswers[socket.id] = { correct, timeMs };

          const newStreak = correct ? player.streak + 1 : 0;

          cb({ correct, timeMs, isBoost, isPower: power, streak: newStreak, correctIndex: q.correct });

          const { ropePosition, blueScore, redScore } = calcCurrentRopePosition(game, q.duration);
          tugNs.to(`tug:${game.pin}`).emit("tug:rope-update", {
            ropePosition,
            blueScore,
            redScore,
            answeredCount: Object.keys(game.roundAnswers).length,
            totalPlayers: Object.keys(game.players).length,
          });

          const playerCount = Object.keys(game.players).length;
          const answeredCount = Object.keys(game.roundAnswers).length;
          if (answeredCount >= playerCount) {
            clearTimeout(game.questionTimer!);
            endRound(tugNs, game);
          }
        } catch (err) {
          logger.error(err, "tug:answer error");
          cb({ error: "حدث خطأ" });
        }
      }
    );

    socket.on("tug:next", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة يمكنه المتابعة." });
        if (game.state !== "round-end") return cb({ error: "الجولة لم تنته بعد." });

        if (game.autoAdvanceTimer) { clearTimeout(game.autoAdvanceTimer); game.autoAdvanceTimer = undefined; }

        advanceToNext(tugNs, game);
        cb({ success: true, finished: (game.state as string) === "finished" });
      } catch (err) {
        logger.error(err, "tug:next error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:toggle-auto-advance", (data: { pin: string; enabled: boolean }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        game.autoAdvance = !!data.enabled;
        if (!game.autoAdvance && game.autoAdvanceTimer) {
          clearTimeout(game.autoAdvanceTimer);
          game.autoAdvanceTimer = undefined;
        }
        if (game.autoAdvance && game.state === "round-end" && game.currentQuestionIndex < game.questions.length - 1 && !game.autoAdvanceTimer) {
          game.autoAdvanceTimer = setTimeout(() => {
            game.autoAdvanceTimer = undefined;
            if (game.state === "round-end") advanceToNext(tugNs, game);
          }, AUTO_ADVANCE_MS);
          tugNs.to(`tug:${game.pin}`).emit("tug:auto-advance-started", { autoAdvanceIn: AUTO_ADVANCE_MS / 1000 });
        }
        if (!game.autoAdvance) {
          tugNs.to(`tug:${game.pin}`).emit("tug:auto-advance-cancelled");
        }
        cb({ success: true, autoAdvance: game.autoAdvance });
      } catch (err) {
        logger.error(err, "tug:toggle-auto-advance error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:skip", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state !== "question" && game.state !== "countdown") return cb({ error: "لا يوجد سؤال نشط." });
        if (game.questionTimer) clearTimeout(game.questionTimer);
        if (game.state === "countdown") {
          game.state = "question";
          game.questionStartTime = Date.now();
        }
        endRound(tugNs, game);
        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:skip error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:pause", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state !== "question" && game.state !== "countdown") return cb({ error: "لا يمكن الإيقاف الآن." });

        if (game.questionTimer) clearTimeout(game.questionTimer);
        const elapsed = game.questionStartTime ? Date.now() - game.questionStartTime : 0;
        const q = game.questions[game.currentQuestionIndex];
        game.pausedTimeRemaining = Math.max(0, q.duration * 1000 - elapsed);
        game.stateBeforePause = game.state as "countdown" | "question";
        game.state = "paused";

        tugNs.to(`tug:${game.pin}`).emit("tug:paused", {
          pausedBy: "teacher",
          timeRemaining: game.pausedTimeRemaining,
        });

        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:pause error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:resume", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state !== "paused") return cb({ error: "اللعبة ليست متوقفة." });

        const remaining = game.pausedTimeRemaining ?? 0;

        if (game.stateBeforePause === "countdown") {
          game.state = "countdown";
          game.stateBeforePause = undefined;
          game.pausedTimeRemaining = undefined;
          broadcastQuestion(tugNs, game);
        } else {
          game.state = "question";
          game.questionStartTime = Date.now() - ((game.questions[game.currentQuestionIndex].duration * 1000) - remaining);
          game.stateBeforePause = undefined;
          game.pausedTimeRemaining = undefined;

          tugNs.to(`tug:${game.pin}`).emit("tug:resumed", {
            timeRemaining: Math.ceil(remaining / 1000),
          });

          game.questionTimer = setTimeout(() => {
            endRound(tugNs, game);
          }, remaining + 500);
        }

        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:resume error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:end-early", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state === "finished") return cb({ error: "اللعبة انتهت بالفعل." });
        if (game.questionTimer) clearTimeout(game.questionTimer);

        let winner: "blue" | "red" | "draw";
        if (game.ropePosition < 45) winner = "blue";
        else if (game.ropePosition > 55) winner = "red";
        else winner = "draw";

        game.winner = winner;
        game.state = "finished";
        tugNs.to(`tug:${game.pin}`).emit("tug:game-end", {
          winner,
          ropePosition: game.ropePosition,
          players: getPlayerList(game),
        });
        setTimeout(() => cleanupGame(game.pin), 30 * 60 * 1000);
        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:end-early error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on("tug:replay", (data: { pin: string }, cb: (r: object) => void) => {
      try {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorSocketId !== socket.id) return cb({ error: "فقط منشئ اللعبة." });
        if (game.state !== "finished") return cb({ error: "اللعبة لم تنته بعد." });

        if (game.questionTimer) clearTimeout(game.questionTimer);
        if (game.autoAdvanceTimer) clearTimeout(game.autoAdvanceTimer);
        game.autoAdvanceTimer = undefined;

        game.currentQuestionIndex = 0;
        game.ropePosition = 50;
        game.roundAnswers = {};
        game.winner = undefined;
        game.state = "lobby";
        game.questionStartTime = undefined;
        game.stateBeforePause = undefined;
        game.pausedTimeRemaining = undefined;

        for (const p of Object.values(game.players)) {
          p.score = 0;
          p.streak = 0;
        }

        tugNs.to(`tug:${game.pin}`).emit("tug:replayed", {
          players: getPlayerList(game),
          ropePosition: 50,
        });

        cb({ success: true });
      } catch (err) {
        logger.error(err, "tug:replay error");
        cb({ error: "حدث خطأ" });
      }
    });

    socket.on(
      "tug:rejoin",
      (data: { pin: string; name: string; avatar: string }, cb: (r: object) => void) => {
        const game = tugGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });

        const existing = Object.values(game.players).find((p) => p.name === data.name && p.avatar === data.avatar);
        if (existing) {
          const oldSocketId = existing.socketId;
          delete game.players[oldSocketId];
          existing.socketId = socket.id;
          game.players[socket.id] = existing;
          if (game.roundAnswers[oldSocketId]) {
            game.roundAnswers[socket.id] = game.roundAnswers[oldSocketId];
            delete game.roundAnswers[oldSocketId];
          }
          socket.join(`tug:${game.pin}`);

          const q = game.questions[game.currentQuestionIndex] ?? null;
          const elapsedMs = game.questionStartTime ? Date.now() - game.questionStartTime : 0;
          const remainingSecs = q ? Math.max(0, q.duration - Math.floor(elapsedMs / 1000)) : 0;

          cb({
            success: true,
            rejoined: true,
            team: existing.team,
            state: game.state,
            ropePosition: game.ropePosition,
            players: getPlayerList(game),
            activeQuestion: (game.state === "question" || game.state === "paused" || game.state === "round-end") && q ? {
              index: game.currentQuestionIndex,
              total: game.questions.length,
              text: q.text,
              options: q.options,
              duration: q.duration,
              remainingSecs: game.state === "paused" ? (game.pausedTimeRemaining ?? q.duration) : remainingSecs,
              isPower: isPowerQuestion(game.currentQuestionIndex),
            } : null,
            hasAnswered: !!game.roundAnswers[socket.id],
            roundSummary: game.state === "round-end" && q ? (() => {
              const { ropePosition, blueScore, redScore } = calcCurrentRopePosition(game, q.duration);
              return {
                correctIndex: q.correct,
                ropePosition,
                blueScore,
                redScore,
                isLast: game.currentQuestionIndex >= game.questions.length - 1,
                questionIndex: game.currentQuestionIndex,
                total: game.questions.length,
                isPower: isPowerQuestion(game.currentQuestionIndex),
              };
            })() : null,
          });
          return;
        }
        cb({ error: "لم يتم العثور على سجل لاعبك." });
      }
    );

    socket.on("disconnect", () => {
      clearTugRateBucket(socket.id);
      for (const [pin, game] of tugGames.entries()) {
        if (game.players[socket.id]) {
          // Only drop the player while we're still in the lobby. During an
          // active game a disconnect is almost always a transient network blip
          // (mobile data, Wi-Fi handoff, tab sleep) — Socket.IO reconnects with
          // a NEW socket.id. If we deleted the record here, `tug:rejoin` would
          // no longer find it, the student would get re-added with a reset score
          // (or hit "أنت لست في هذه اللعبة" on their next answer). So we KEEP the
          // record mid-game; `tug:rejoin` re-keys it to the fresh socket.id and
          // their team + score persist seamlessly.
          if (game.state === "lobby") {
            delete game.players[socket.id];
            tugNs.to(`tug:${pin}`).emit("tug:players-updated", {
              players: getPlayerList(game),
            });
          }
        }

        if (game.pendingPlayers[socket.id]) {
          delete game.pendingPlayers[socket.id];
          tugNs.to(`tug:${pin}`).emit("tug:pending-updated", {
            pending: Object.values(game.pendingPlayers).map(p => ({ name: p.name, avatar: p.avatar, socketId: p.socketId })),
          });
        }

        if (game.creatorSocketId === socket.id && game.state === "lobby" && Object.keys(game.players).length === 0) {
          cleanupGame(pin);
        }
      }
    });
  });
}
