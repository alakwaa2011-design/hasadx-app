import { Server } from "socket.io";
import { logger } from "../lib/logger";
import { randomBytes } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RocketQuestionType = "mcq" | "true_false" | "fill_blank";

export interface RocketQuestion {
  text: string;
  type: RocketQuestionType;
  options: string[];          // for mcq / true_false; for fill_blank: alt accepted answers
  correct: number;            // index for mcq/tf; -1 for fill_blank (uses correctText)
  correctText?: string;       // for fill_blank: the canonical answer
  duration: number;           // seconds
}

export interface RocketPlayer {
  socketId: string;
  name: string;
  avatar: string;
  rocketColor: string;        // assigned at join
  altitude: number;           // 0..100 — current rocket height
  score: number;
  correctCount: number;
  wrongCount: number;
  currentQuestionIdx: number; // current question index (cycles)
  totalAnswered: number;      // total questions answered (for cycle calc)
  wrongIndices: number[];     // queue of wrong question indices to retry
  questionStartTime?: number;
  finished: boolean;
  finishedAt?: number;
  finishRank?: number;
  streak: number;
}

interface PendingPlayer {
  socketId: string;
  name: string;
  avatar: string;
}

interface RocketGame {
  pin: string;
  creatorSocketId: string;
  creatorToken: string;
  questions: RocketQuestion[];
  state: "lobby" | "countdown" | "racing" | "finished";
  players: Record<string, RocketPlayer>;
  pendingPlayers: Record<string, PendingPlayer>;
  startedAt?: number;
  duration: number;           // per-question duration in seconds
  totalDurationSecs: number;  // total game timer (default 300s = 5 min)
  raceTimer?: ReturnType<typeof setTimeout>;
  finishOrder: string[];      // socketIds in finish order
  targetClass?: string;
  teacherId?: number;
  title?: string;
}

// ─── State ──────────────────────────────────────────────────────────────────

const rocketGames = new Map<string, RocketGame>();

const ROCKET_COLORS = [
  "#dc2626", "#2563eb", "#16a34a", "#d97706", "#9333ea",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569",
  "#7c3aed", "#0d9488", "#e11d48", "#1d4ed8", "#84cc16",
];

export function getRocketGame(pin: string): RocketGame | undefined {
  return rocketGames.get(pin);
}

function generatePin(): string {
  let pin: string;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rocketGames.has(pin));
  return pin;
}

function pickColor(game: RocketGame): string {
  const used = new Set(Object.values(game.players).map(p => p.rocketColor));
  for (const c of ROCKET_COLORS) if (!used.has(c)) return c;
  return ROCKET_COLORS[Math.floor(Math.random() * ROCKET_COLORS.length)];
}

function getPlayerList(game: RocketGame) {
  return Object.values(game.players).map((p) => ({
    name: p.name,
    avatar: p.avatar,
    rocketColor: p.rocketColor,
    altitude: p.altitude,
    score: p.score,
    correctCount: p.correctCount,
    wrongCount: p.wrongCount,
    finished: p.finished,
    finishRank: p.finishRank,
    streak: p.streak,
    currentQuestionIdx: p.currentQuestionIdx,
  }));
}

// Rocket altitude calculation: base 100/N per correct answer + speed bonus
// Faster correct answers boost altitude more
function altitudeForAnswer(timeMs: number, durationSecs: number, totalQuestions: number): number {
  const baseStep = 100 / totalQuestions;
  const speedRatio = Math.max(0, 1 - timeMs / (durationSecs * 1000));
  // Speed bonus: up to +30% of the base step
  const bonus = baseStep * 0.3 * speedRatio;
  return baseStep + bonus;
}

function scoreForAnswer(correct: boolean, timeMs: number, durationSecs: number, streak: number): number {
  if (!correct) return 0;
  const base = 100;
  const speedBonus = Math.floor((1 - timeMs / (durationSecs * 1000)) * 80);
  const streakBonus = streak >= 3 ? 50 : streak >= 5 ? 100 : 0;
  return base + Math.max(0, speedBonus) + streakBonus;
}

function cleanupGame(pin: string) {
  const game = rocketGames.get(pin);
  if (game?.raceTimer) clearTimeout(game.raceTimer);
  rocketGames.delete(pin);
}

// Helper: get next question index for a player (wrong-first priority, then cycle)
function nextQuestionIdx(game: RocketGame, player: RocketPlayer): number {
  if (player.wrongIndices.length > 0) {
    return player.wrongIndices.shift()!;
  }
  return player.totalAnswered % game.questions.length;
}

function endGame(rocketNs: ReturnType<Server["of"]>, game: RocketGame) {
  if (game.state === "finished") return;
  game.state = "finished";
  if (game.raceTimer) clearTimeout(game.raceTimer);

  // Rank all players by score (fastest ties resolved by correctCount then wrongCount)
  const sortedPlayers = Object.values(game.players).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.wrongCount - b.wrongCount;
  });
  sortedPlayers.forEach((p, i) => {
    p.finished = true;
    p.finishedAt = Date.now();
    p.finishRank = i + 1;
  });

  rocketNs.to(`rocket:${game.pin}`).emit("rocket:game-end", {
    players: getPlayerList(game),
    duration: game.startedAt ? Math.floor((Date.now() - game.startedAt) / 1000) : 0,
  });

  setTimeout(() => cleanupGame(game.pin), 30 * 60 * 1000);
}

function startRace(rocketNs: ReturnType<Server["of"]>, game: RocketGame) {
  game.state = "countdown";

  rocketNs.to(`rocket:${game.pin}`).emit("rocket:countdown", {
    total: game.questions.length,
    durationSecs: game.duration,
    totalDurationSecs: game.totalDurationSecs,
  });

  setTimeout(() => {
    if (game.state !== "countdown") return;
    game.state = "racing";
    game.startedAt = Date.now();

    // Init each player for looping mode
    for (const p of Object.values(game.players)) {
      p.currentQuestionIdx = 0;
      p.totalAnswered = 0;
      p.wrongIndices = [];
      p.questionStartTime = Date.now();
    }

    const q = game.questions[0];
    rocketNs.to(`rocket:${game.pin}`).emit("rocket:race-start", {
      total: game.questions.length,
      gameDuration: game.totalDurationSecs,
      question: {
        index: 0,
        text: q.text,
        type: q.type,
        options: q.options,
        duration: q.duration,
      },
    });

    // Game ends when total timer expires
    if (game.raceTimer) clearTimeout(game.raceTimer);
    game.raceTimer = setTimeout(() => endGame(rocketNs, game), game.totalDurationSecs * 1000);
  }, 4000);
}

// ─── Rate Limit ──────────────────────────────────────────────────────────────

const ROCKET_CREATE_WINDOW_MS = 60 * 1000;
const ROCKET_CREATE_MAX = 5;
const rocketCreateBuckets = new Map<string, number[]>();
function allowRocketCreate(socketId: string): boolean {
  const now = Date.now();
  const bucket = (rocketCreateBuckets.get(socketId) || []).filter(
    (t) => now - t < ROCKET_CREATE_WINDOW_MS,
  );
  if (bucket.length >= ROCKET_CREATE_MAX) {
    rocketCreateBuckets.set(socketId, bucket);
    return false;
  }
  bucket.push(now);
  rocketCreateBuckets.set(socketId, bucket);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [sid, bucket] of rocketCreateBuckets.entries()) {
    const fresh = bucket.filter((t) => now - t < ROCKET_CREATE_WINDOW_MS);
    if (fresh.length === 0) rocketCreateBuckets.delete(sid);
    else if (fresh.length !== bucket.length) rocketCreateBuckets.set(sid, fresh);
  }
}, 5 * 60 * 1000).unref();

// ─── Setup ──────────────────────────────────────────────────────────────────

export function setupRocketSocket(io: Server) {
  const rocketNs = io.of("/rocket");

  rocketNs.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Rocket socket connected");

    // ── Create ────────────────────────────────────────────────────────────
    socket.on(
      "rocket:create",
      (
        data: {
          questions: RocketQuestion[];
          duration?: number;
          totalDurationSecs?: number;
          targetClass?: string;
          title?: string;
        },
        cb: (r: object) => void,
      ) => {
        try {
          if (!allowRocketCreate(socket.id))
            return cb({ error: "محاولات إنشاء كثيرة جداً. الرجاء الانتظار دقيقة." });
          if (!Array.isArray(data.questions) || data.questions.length < 1)
            return cb({ error: "يجب إضافة سؤال واحد على الأقل" });
          if (data.questions.length > 30)
            return cb({ error: "الحد الأقصى 30 سؤالاً" });

          const session = (socket.request as { session?: { teacherId?: number } }).session;
          const sessionTeacherId = session?.teacherId;

          const pin = generatePin();
          const duration = Math.max(5, Math.min(60, data.duration ?? 20));
          const totalDurationSecs = Math.max(60, Math.min(3600, data.totalDurationSecs ?? 300));
          const creatorToken = randomBytes(16).toString("hex");

          const questions: RocketQuestion[] = data.questions.map((q) => ({
            text: q.text,
            type: q.type,
            options: q.options,
            correct: q.correct,
            correctText: q.correctText,
            duration,
          }));

          const game: RocketGame = {
            pin,
            creatorSocketId: socket.id,
            creatorToken,
            questions,
            state: "lobby",
            players: {},
            pendingPlayers: {},
            duration,
            totalDurationSecs,
            finishOrder: [],
            targetClass: data.targetClass || undefined,
            teacherId: sessionTeacherId || undefined,
            title: data.title || undefined,
          };

          rocketGames.set(pin, game);
          socket.join(`rocket:${pin}`);

          // Auto-cleanup after 3 hours
          setTimeout(() => cleanupGame(pin), 3 * 60 * 60 * 1000);

          logger.info({ pin }, "Rocket game created");
          cb({ pin, creatorToken });
        } catch (err) {
          logger.error(err, "rocket:create error");
          cb({ error: "حدث خطأ" });
        }
      },
    );

    // ── Reclaim host (page reload) ────────────────────────────────────────
    socket.on(
      "rocket:reclaim-host",
      (data: { pin: string; creatorToken: string }, cb: (r: object) => void) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorToken !== data.creatorToken) return cb({ error: "رمز غير صحيح." });

        game.creatorSocketId = socket.id;
        socket.join(`rocket:${game.pin}`);

        cb({
          success: true,
          state: game.state,
          players: getPlayerList(game),
          totalQuestions: game.questions.length,
          duration: game.duration,
          title: game.title,
        });
      },
    );

    // ── Join as player ────────────────────────────────────────────────────
    socket.on(
      "rocket:join",
      (data: { pin: string; name: string; avatar?: string }, cb: (r: object) => void) => {
        try {
          const game = rocketGames.get(data.pin);
          if (!game) return cb({ error: "لم يتم العثور على الغرفة." });
          if (game.state !== "lobby") return cb({ error: "السباق بدأ بالفعل." });

          const trimmedName = (data.name || "").trim();
          if (!trimmedName) return cb({ error: "يرجى إدخال اسمك." });
          if (trimmedName.length > 30) return cb({ error: "الاسم طويل جداً." });

          // Prevent duplicate names in same room
          const existingNames = Object.values(game.players).map(p => p.name.toLowerCase());
          if (existingNames.includes(trimmedName.toLowerCase())) {
            return cb({ error: "هذا الاسم مستخدم. اختر اسماً مختلفاً." });
          }

          const player: RocketPlayer = {
            socketId: socket.id,
            name: trimmedName,
            avatar: data.avatar || "🦁",
            rocketColor: pickColor(game),
            altitude: 0,
            score: 0,
            correctCount: 0,
            wrongCount: 0,
            currentQuestionIdx: 0,
            totalAnswered: 0,
            wrongIndices: [],
            finished: false,
            streak: 0,
          };
          game.players[socket.id] = player;
          socket.join(`rocket:${game.pin}`);

          rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
            players: getPlayerList(game),
          });

          cb({
            success: true,
            pin: game.pin,
            rocketColor: player.rocketColor,
            totalQuestions: game.questions.length,
            duration: game.duration,
            totalDurationSecs: game.totalDurationSecs,
            title: game.title,
          });
        } catch (err) {
          logger.error(err, "rocket:join error");
          cb({ error: "حدث خطأ" });
        }
      },
    );

    // ── Reconnect player ──────────────────────────────────────────────────
    socket.on(
      "rocket:rejoin",
      (data: { pin: string; name: string; avatar?: string }, cb: (r: object) => void) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        const trimmedName = (data.name || "").trim();
        if (!trimmedName) return cb({ error: "يرجى إدخال اسمك." });

        // Find existing player by name
        const existing = Object.values(game.players).find(p => p.name.toLowerCase() === trimmedName.toLowerCase());

        if (existing) {
          delete game.players[existing.socketId];
          existing.socketId = socket.id;
          game.players[socket.id] = existing;
          socket.join(`rocket:${game.pin}`);

          const q = game.questions[existing.currentQuestionIdx];
          cb({
            success: true,
            pin: game.pin,
            state: game.state,
            altitude: existing.altitude,
            score: existing.score,
            currentQuestionIdx: existing.currentQuestionIdx,
            totalQuestions: game.questions.length,
            rocketColor: existing.rocketColor,
            title: game.title,
            activeQuestion: game.state === "racing" && q ? {
              index: existing.currentQuestionIdx,
              text: q.text,
              type: q.type,
              options: q.options,
              duration: q.duration,
            } : null,
            finished: existing.finished,
            finishRank: existing.finishRank,
          });

          rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
            players: getPlayerList(game),
          });
          return;
        }

        // Otherwise, treat as fresh join (only if lobby)
        if (game.state !== "lobby") return cb({ error: "السباق بدأ بالفعل." });

        const player: RocketPlayer = {
          socketId: socket.id,
          name: trimmedName,
          avatar: data.avatar || "🦁",
          rocketColor: pickColor(game),
          altitude: 0, score: 0, correctCount: 0, wrongCount: 0,
          currentQuestionIdx: 0, totalAnswered: 0, wrongIndices: [],
          finished: false, streak: 0,
        };
        game.players[socket.id] = player;
        socket.join(`rocket:${game.pin}`);

        rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
          players: getPlayerList(game),
        });

        cb({
          success: true, pin: game.pin, rocketColor: player.rocketColor,
          totalQuestions: game.questions.length, duration: game.duration,
          totalDurationSecs: game.totalDurationSecs, title: game.title,
        });
      },
    );

    // ── Start race (host) ─────────────────────────────────────────────────
    socket.on("rocket:start", (data: { pin: string }, cb: (r: object) => void) => {
      const game = rocketGames.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      if (game.state !== "lobby") return cb({ error: "السباق بدأ بالفعل." });
      if (Object.keys(game.players).length === 0) return cb({ error: "لا يوجد لاعبون." });

      startRace(rocketNs, game);
      cb({ success: true });
    });

    // ── Player submits answer ────────────────────────────────────────────
    socket.on(
      "rocket:answer",
      (
        data: { pin: string; answerIndex: number; answerText?: string },
        cb: (r: object) => void,
      ) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.state !== "racing") return cb({ error: "السباق ليس نشطاً." });

        const player = game.players[socket.id];
        if (!player) return cb({ error: "أنت غير مسجل." });
        if (player.finished) return cb({ error: "أنهيت السباق بالفعل." });

        const q = game.questions[player.currentQuestionIdx];
        if (!q) return cb({ error: "خطأ في السؤال." });

        const elapsedMs = player.questionStartTime ? Date.now() - player.questionStartTime : 0;
        let correct = false;

        if (q.type === "fill_blank") {
          const submitted = (data.answerText || "").trim().toLowerCase();
          const accepted = [
            (q.correctText || "").trim().toLowerCase(),
            ...(q.options || []).map(o => o.trim().toLowerCase()),
          ].filter(Boolean);
          correct = accepted.includes(submitted);
        } else {
          correct = data.answerIndex === q.correct;
        }

        const currentQIdx = player.currentQuestionIdx;

        if (correct) {
          player.correctCount += 1;
          player.streak += 1;
          const altitudeGain = altitudeForAnswer(elapsedMs, q.duration, game.questions.length);
          player.altitude = Math.min(100, player.altitude + altitudeGain);
          player.score += scoreForAnswer(true, elapsedMs, q.duration, player.streak);
        } else {
          player.wrongCount += 1;
          player.streak = 0;
          // Queue this question for retry (avoid duplicates)
          if (!player.wrongIndices.includes(currentQIdx)) {
            player.wrongIndices.push(currentQIdx);
          }
        }

        // Advance: get next question index (wrong-first priority, then cycle)
        player.totalAnswered += 1;
        player.currentQuestionIdx = nextQuestionIdx(game, player);
        player.questionStartTime = Date.now();

        // Send personal answer feedback (never "finished" during race; game ends by timer)
        cb({
          success: true,
          correct,
          correctIndex: q.type === "fill_blank" ? -1 : q.correct,
          correctText: q.correctText,
          altitude: player.altitude,
          score: player.score,
          streak: player.streak,
          finished: false,
        });

        // Send next question immediately
        const nextQ = game.questions[player.currentQuestionIdx];
        if (nextQ) {
          socket.emit("rocket:next-question", {
            index: player.currentQuestionIdx,
            text: nextQ.text,
            type: nextQ.type,
            options: nextQ.options,
            duration: nextQ.duration,
          });
        }

        // Broadcast leaderboard update to all
        rocketNs.to(`rocket:${game.pin}`).emit("rocket:leaderboard", {
          players: getPlayerList(game),
        });
      },
    );

    // ── End game manually (host) ──────────────────────────────────────────
    socket.on("rocket:end", (data: { pin: string }, cb: (r: object) => void) => {
      const game = rocketGames.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      endGame(rocketNs, game);
      cb({ success: true });
    });

    // ── Replay (host) ────────────────────────────────────────────────────
    socket.on("rocket:replay", (data: { pin: string }, cb: (r: object) => void) => {
      const game = rocketGames.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });

      game.state = "lobby";
      game.finishOrder = [];
      if (game.raceTimer) { clearTimeout(game.raceTimer); game.raceTimer = undefined; }
      game.startedAt = undefined;
      for (const p of Object.values(game.players)) {
        p.altitude = 0; p.score = 0; p.correctCount = 0; p.wrongCount = 0;
        p.currentQuestionIdx = 0; p.finished = false; p.finishRank = undefined;
        p.streak = 0; p.questionStartTime = undefined; p.finishedAt = undefined;
      }
      rocketNs.to(`rocket:${game.pin}`).emit("rocket:replay", {
        players: getPlayerList(game),
      });
      cb({ success: true });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Find any game this socket was in and remove player from active list
      for (const game of rocketGames.values()) {
        if (game.players[socket.id]) {
          // Don't actually delete; just leave them in finishOrder if present.
          // They can rejoin by name. But broadcast updated list with them
          // marked as still present (rejoin logic will re-attach socketId).
          break;
        }
      }
      rocketCreateBuckets.delete(socket.id);
    });
  });
}
