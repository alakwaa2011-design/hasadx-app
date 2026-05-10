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
  /** In host_sync: last syncQuestionIdx this player answered (prevent double submit). */
  lastAnsweredSyncIdx?: number;
  /** ─── Phase progression (linear, tied to question pool, never resets) ─── */
  /** Current phase index 0=Space, 1=Asteroids, 2=Crystal. */
  currentPhase: 0 | 1 | 2;
  /** Count of unique questions cleared (correctly) in current segment. Mirrors clearedInPhase.size. */
  phaseProgress: number;
  /** Set of unique question indices the player has CORRECTLY cleared in the current phase segment. */
  clearedInPhase: Set<number>;
  /** ─── Power-ups ─── */
  /** Pending boost charges (max 1 typical). Boost = 2× altitude on next correct. */
  boostAvailable: number;
  /** Pending multiplier charges (max 1). Multiplier = 2× score on next correct. */
  multiplierAvailable: number;
  /** True when player has armed boost (consumed on next correct answer). */
  boostArmed: boolean;
  /** True when player has armed multiplier. */
  multiplierArmed: boolean;
  /** How many 3-streak milestones we've already turned into a power-up. */
  streakRewardsClaimed: number;
  /** Alternates boost/multiplier on each milestone reward. */
  nextRewardKind: "boost" | "multiplier";
  /** ─── Continuous cruise (rocket never stops moving) ─── */
  /** Current cruise velocity multiplier. 1 = base cruise; spikes to 4× on correct answers and decays back. */
  velocity: number;
  /** Timestamp (ms) until which velocity is held at peak before it begins decaying. */
  velocityBoostUntil: number;
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
  totalDurationSecs: number;  // total game timer in seconds (60-900 = 1-15 min)
  raceTimer?: ReturnType<typeof setTimeout>;
  /** Cruise loop: ticks every second to give every player passive forward motion. */
  cruiseTimer?: ReturnType<typeof setInterval>;
  finishOrder: string[];      // socketIds in finish order
  targetClass?: string;
  teacherId?: number;
  title?: string;
  /** Independent pace (default) vs one question at a time for the whole room (teacher advances). */
  advanceMode: "per_player" | "host_sync";
  /** Authoritative question index while racing in host_sync (all players answer the same prompt). */
  syncQuestionIdx: number;
  /** Pre-computed contiguous segments of `questions` for the 3 phases (0/1/2). */
  phaseSegments: { start: number; end: number }[];
}

/** Tracks delayed `next-question` jobs so we cancel them when the race stops. */
const rocketPendingTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
function scheduleDelayedQuestion(
  pin: string,
  socketId: string,
  fn: () => void,
  delay: number,
) {
  let byPin = rocketPendingTimers.get(pin);
  if (!byPin) {
    byPin = new Map();
    rocketPendingTimers.set(pin, byPin);
  }
  const prev = byPin.get(socketId);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    byPin?.delete(socketId);
    fn();
  }, delay);
  byPin.set(socketId, t);
}
function clearPendingQuestionTimers(pin: string) {
  const byPin = rocketPendingTimers.get(pin);
  if (!byPin) return;
  for (const t of byPin.values()) clearTimeout(t);
  rocketPendingTimers.delete(pin);
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
    phase: p.currentPhase,
    boostAvailable: p.boostAvailable,
    multiplierAvailable: p.multiplierAvailable,
    boostArmed: p.boostArmed,
    multiplierArmed: p.multiplierArmed,
    velocity: Number(p.velocity.toFixed(2)),
  }));
}

/**
 * Split the question pool into up to 3 NON-EMPTY contiguous segments tied to
 * game phases. Returns 1 segment for total<=2/3 (or fewer than 3 questions),
 * 2 segments when only 2 are possible, otherwise 3 roughly equal segments.
 * Guarantees: every returned segment has end > start, and the union covers
 * exactly [0, total).
 */
function computePhaseSegments(totalQs: number): { start: number; end: number }[] {
  const total = Math.max(1, totalQs);
  const phaseCount = Math.min(3, total);
  const segs: { start: number; end: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < phaseCount; i++) {
    const remaining = total - cursor;
    const slotsLeft = phaseCount - i;
    // ceil-divide so earlier segments absorb the remainder; every slot ≥ 1.
    const size = Math.max(1, Math.ceil(remaining / slotsLeft));
    segs.push({ start: cursor, end: cursor + size });
    cursor += size;
  }
  return segs;
}

/** Reset all per-race fields on a player back to a fresh state. */
function resetPlayerForRace(p: RocketPlayer, game: RocketGame) {
  p.altitude = 0;
  p.score = 0;
  p.correctCount = 0;
  p.wrongCount = 0;
  p.totalAnswered = 0;
  p.streak = 0;
  p.wrongIndices = [];
  p.questionStartTime = undefined;
  p.lastAnsweredSyncIdx = undefined;
  p.finished = false;
  p.finishRank = undefined;
  p.finishedAt = undefined;
  p.currentPhase = 0;
  p.phaseProgress = 0;
  p.clearedInPhase = new Set();
  p.boostAvailable = 0;
  p.multiplierAvailable = 0;
  p.boostArmed = false;
  p.multiplierArmed = false;
  p.streakRewardsClaimed = 0;
  p.nextRewardKind = "boost";
  p.velocity = 1;
  p.velocityBoostUntil = 0;
  p.currentQuestionIdx =
    game.advanceMode === "host_sync" ? game.syncQuestionIdx : game.phaseSegments[0].start;
}

// Rocket altitude calculation: base 100/N per correct answer + speed bonus
// Faster correct answers boost altitude more
function altitudeForAnswer(timeMs: number, durationSecs: number, totalQuestions: number): number {
  const baseStep = 100 / totalQuestions;
  const speedRatio = Math.max(0, 1 - timeMs / (durationSecs * 1000));
  // Faster = up to +60% more altitude (rewards speed significantly)
  const bonus = baseStep * 0.6 * speedRatio;
  return baseStep + bonus;
}

function scoreForAnswer(correct: boolean, timeMs: number, durationSecs: number, streak: number): number {
  if (!correct) return 0;
  const speedRatio = Math.max(0, 1 - timeMs / (durationSecs * 1000));
  // Base 50 + up to 150 speed bonus = max 200 per question; fast answers are worth 3× slow ones
  const base = 50;
  const speedBonus = Math.floor(speedRatio * 150);
  const streakBonus = streak >= 5 ? 100 : streak >= 3 ? 50 : 0;
  return base + speedBonus + streakBonus;
}

function cleanupGame(pin: string) {
  const game = rocketGames.get(pin);
  if (game?.raceTimer) clearTimeout(game.raceTimer);
  if (game?.cruiseTimer) clearInterval(game.cruiseTimer);
  clearPendingQuestionTimers(pin);
  rocketGames.delete(pin);
}

/**
 * Cruise loop: ticks every second while the race is running and gives every
 * rocket passive forward motion. Velocity decays toward 1 (base cruise) once
 * a player's boost window has elapsed, so a correct answer feels like a
 * sustained burst rather than an instant jump. Phase is also recomputed each
 * tick from elapsed time so all players experience the same adventure.
 */
const CRUISE_TICK_MS = 1000;
const CRUISE_BASE_RATE = 0.35; // altitude per second at velocity = 1
function startCruiseLoop(rocketNs: ReturnType<Server["of"]>, game: RocketGame) {
  if (game.cruiseTimer) clearInterval(game.cruiseTimer);
  game.cruiseTimer = setInterval(() => {
    const g = rocketGames.get(game.pin);
    if (!g || g.state !== "racing") return;
    const now = Date.now();
    const newPhase = computeTimePhase(g);
    let phaseChanged = false;
    for (const p of Object.values(g.players)) {
      if (now >= p.velocityBoostUntil && p.velocity > 1) {
        p.velocity = Math.max(1, p.velocity - 0.5);
      }
      const tickGain = CRUISE_BASE_RATE * (CRUISE_TICK_MS / 1000) * p.velocity;
      p.altitude += tickGain;
      if (p.currentPhase !== newPhase) {
        p.currentPhase = newPhase;
        phaseChanged = true;
      }
    }
    rocketNs.to(`rocket:${g.pin}`).emit("rocket:cruise", {
      players: getPlayerList(g),
      phase: newPhase,
      phaseChanged,
    });
  }, CRUISE_TICK_MS);
}

/**
 * Pick the next question for a player. Phases are now time-driven (not
 * gated by question clearance) so the player draws from the FULL question
 * pool: prefer any question they have not yet answered correctly; once
 * every question is cleared, cycle through them using totalAnswered. This
 * keeps the rocket adventure flowing endlessly — even slow students keep
 * seeing fresh questions and progressing through phases.
 *
 * Note: `clearedInPhase` Set is now used as a global "questions cleared"
 * tracker (never reset mid-race) — name kept for backward compatibility.
 */
function nextQuestionIdx(game: RocketGame, player: RocketPlayer): number {
  const total = game.questions.length;
  if (total === 0) return 0;
  for (let i = 0; i < total; i++) {
    if (!player.clearedInPhase.has(i)) return i;
  }
  return player.totalAnswered % total;
}

/**
 * Phase is purely a function of elapsed game time so every student
 * experiences the full Space → Asteroid → Crystal adventure regardless
 * of accuracy. Boundaries: 0–34% Space, 34–67% Asteroid, 67–100% Crystal.
 */
function computeTimePhase(game: RocketGame): 0 | 1 | 2 {
  if (!game.startedAt || game.totalDurationSecs <= 0) return 0;
  const frac = (Date.now() - game.startedAt) / (game.totalDurationSecs * 1000);
  if (frac < 0.34) return 0;
  if (frac < 0.67) return 1;
  return 2;
}

/** Whenever streak hits a new multiple of 3, grant the next alternating power-up. */
function maybeGrantPowerUp(player: RocketPlayer): "boost" | "multiplier" | null {
  if (player.streak <= 0) return null;
  const milestone = Math.floor(player.streak / 3);
  if (milestone <= player.streakRewardsClaimed) return null;
  player.streakRewardsClaimed = milestone;
  const granted = player.nextRewardKind;
  if (granted === "boost") {
    player.boostAvailable = Math.min(3, player.boostAvailable + 1);
  } else {
    player.multiplierAvailable = Math.min(3, player.multiplierAvailable + 1);
  }
  player.nextRewardKind = granted === "boost" ? "multiplier" : "boost";
  return granted;
}

function endGame(rocketNs: ReturnType<Server["of"]>, game: RocketGame) {
  if (game.state === "finished") return;
  game.state = "finished";
  if (game.raceTimer) clearTimeout(game.raceTimer);
  if (game.cruiseTimer) { clearInterval(game.cruiseTimer); game.cruiseTimer = undefined; }
  clearPendingQuestionTimers(game.pin);

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
    game.syncQuestionIdx = 0;
    game.startedAt = Date.now();

    // Init each player for fresh phase progression
    for (const p of Object.values(game.players)) {
      resetPlayerForRace(p, game);
      p.questionStartTime = Date.now();
    }

    const q = game.questions[game.syncQuestionIdx];
    rocketNs.to(`rocket:${game.pin}`).emit("rocket:race-start", {
      total: game.questions.length,
      gameDuration: game.totalDurationSecs,
      totalDurationSecs: game.totalDurationSecs,
      advanceMode: game.advanceMode,
      question: {
        index: game.syncQuestionIdx,
        text: q.text,
        type: q.type,
        options: q.options,
        duration: q.duration,
      },
    });

    // Restore game-duration timer: race auto-ends when totalDurationSecs elapses.
    if (game.raceTimer) clearTimeout(game.raceTimer);
    game.raceTimer = setTimeout(() => {
      const g = rocketGames.get(game.pin);
      if (!g || g.state !== "racing") return;
      endGame(rocketNs, g);
    }, game.totalDurationSecs * 1000);

    // Kick off the cruise loop so every rocket starts moving immediately.
    startCruiseLoop(rocketNs, game);
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
          /** per_player = each student cycles questions at own pace; host_sync = same question until teacher advances */
          advanceMode?: "per_player" | "host_sync";
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
          // Race timer: teacher selects 1-15 minutes (clamped). Default 5 min.
          const totalDurationSecs = Math.max(60, Math.min(900, data.totalDurationSecs ?? 300));
          const creatorToken = randomBytes(16).toString("hex");

          const questions: RocketQuestion[] = data.questions.map((q) => ({
            text: q.text,
            type: q.type,
            options: q.options,
            correct: q.correct,
            correctText: q.correctText,
            duration,
          }));

          const advanceMode: "per_player" | "host_sync" =
            data.advanceMode === "host_sync" ? "host_sync" : "per_player";

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
            advanceMode,
            syncQuestionIdx: 0,
            phaseSegments: computePhaseSegments(questions.length),
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
      (data: { pin: string; creatorToken: string },         cb: (r: object) => void) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.creatorToken !== data.creatorToken) return cb({ error: "رمز غير صحيح." });

        game.creatorSocketId = socket.id;
        socket.join(`rocket:${game.pin}`);

        const syncQ =
          game.state === "racing" && game.advanceMode === "host_sync"
            ? game.questions[game.syncQuestionIdx]
            : undefined;
        cb({
          success: true,
          state: game.state,
          players: getPlayerList(game),
          totalQuestions: game.questions.length,
          duration: game.duration,
          title: game.title,
          advanceMode: game.advanceMode,
          syncQuestionIdx: game.syncQuestionIdx,
          currentQuestionPreview:
            syncQ !== undefined
              ? { index: game.syncQuestionIdx, text: syncQ.text }
              : undefined,
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
          if (game.state === "finished") return cb({ error: "انتهى السباق." });

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
            currentQuestionIdx: game.state === "racing" && game.advanceMode === "host_sync" ? game.syncQuestionIdx : 0,
            totalAnswered: 0,
            wrongIndices: [],
            finished: false,
            streak: 0,
            currentPhase: 0,
            phaseProgress: 0,
            clearedInPhase: new Set<number>(),
            boostAvailable: 0,
            multiplierAvailable: 0,
            boostArmed: false,
            multiplierArmed: false,
            streakRewardsClaimed: 0,
            nextRewardKind: "boost",
            velocity: 1,
            velocityBoostUntil: 0,
          };
          game.players[socket.id] = player;
          socket.join(`rocket:${game.pin}`);

          rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
            players: getPlayerList(game),
          });

          // If game is already racing, send remaining time and first question
          if (game.state === "racing") {
            const remainingSecs = game.startedAt
              ? Math.max(0, Math.round((game.startedAt + game.totalDurationSecs * 1000 - Date.now()) / 1000))
              : game.totalDurationSecs;
            player.questionStartTime = Date.now();
            const firstQ = game.questions[game.advanceMode === "host_sync" ? game.syncQuestionIdx : 0];
            cb({
              success: true, pin: game.pin, rocketColor: player.rocketColor,
              totalQuestions: game.questions.length, duration: game.duration,
              totalDurationSecs: remainingSecs, title: game.title, lateJoin: true,
              advanceMode: game.advanceMode,
            });
            if (firstQ) {
              socket.emit("rocket:race-start", {
                total: game.questions.length, gameDuration: remainingSecs,
                advanceMode: game.advanceMode,
                question: firstQ
                  ? {
                      index: game.advanceMode === "host_sync" ? game.syncQuestionIdx : 0,
                      text: firstQ.text,
                      type: firstQ.type,
                      options: firstQ.options,
                      duration: firstQ.duration,
                    }
                  : undefined,
              });
            }
          } else {
            cb({
              success: true, pin: game.pin, rocketColor: player.rocketColor,
              totalQuestions: game.questions.length, duration: game.duration,
              totalDurationSecs: game.totalDurationSecs, title: game.title,
            });
          }
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

          const qIdx =
            game.advanceMode === "host_sync"
              ? game.syncQuestionIdx
              : existing.currentQuestionIdx;
          const q = game.questions[qIdx];
          const remainingSecs = game.startedAt
            ? Math.max(0, Math.round((game.startedAt + game.totalDurationSecs * 1000 - Date.now()) / 1000))
            : game.totalDurationSecs;
          cb({
            success: true,
            pin: game.pin,
            state: game.state,
            altitude: existing.altitude,
            score: existing.score,
            advanceMode: game.advanceMode,
            currentQuestionIdx:
              game.advanceMode === "host_sync" ? qIdx : existing.currentQuestionIdx,
            totalQuestions: game.questions.length,
            rocketColor: existing.rocketColor,
            title: game.title,
            totalDurationSecs: remainingSecs,
            activeQuestion: game.state === "racing" && q
              ? {
                  index: qIdx,
                  text: q.text,
                  type: q.type,
                  options: q.options,
                  duration: q.duration,
                }
              : null,
            finished: false,
            finishRank: existing.finishRank,
            phase: existing.currentPhase,
            boostAvailable: existing.boostAvailable,
            multiplierAvailable: existing.multiplierAvailable,
            boostArmed: existing.boostArmed,
            multiplierArmed: existing.multiplierArmed,
            velocity: Number(existing.velocity.toFixed(2)),
          });

          rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
            players: getPlayerList(game),
          });
          return;
        }

        // Otherwise, fresh join — allow during racing too
        if (game.state === "finished") return cb({ error: "انتهى السباق." });

        const player: RocketPlayer = {
          socketId: socket.id,
          name: trimmedName,
          avatar: data.avatar || "🦁",
          rocketColor: pickColor(game),
          altitude: 0,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          currentQuestionIdx:
            game.state === "racing" && game.advanceMode === "host_sync"
              ? game.syncQuestionIdx
              : 0,
          totalAnswered: 0,
          wrongIndices: [],
          finished: false,
          streak: 0,
          clearedInPhase: new Set<number>(),
          currentPhase: 0,
          phaseProgress: 0,
          boostAvailable: 0,
          multiplierAvailable: 0,
          boostArmed: false,
          multiplierArmed: false,
          streakRewardsClaimed: 0,
          nextRewardKind: "boost",
          velocity: 1,
          velocityBoostUntil: 0,
        };
        player.questionStartTime = game.state === "racing" ? Date.now() : undefined;
        game.players[socket.id] = player;
        socket.join(`rocket:${game.pin}`);

        rocketNs.to(`rocket:${game.pin}`).emit("rocket:players-updated", {
          players: getPlayerList(game),
        });

        const remainingSecsFresh =
          game.startedAt != null
            ? Math.max(0, Math.round((game.startedAt + game.totalDurationSecs * 1000 - Date.now()) / 1000))
            : game.totalDurationSecs;
        const freshQIdx =
          game.state === "racing" && game.advanceMode === "host_sync"
            ? game.syncQuestionIdx
            : player.currentQuestionIdx;
        const freshQ =
          game.state === "racing" && game.questions[freshQIdx] ? game.questions[freshQIdx] : undefined;

        cb({
          success: true,
          pin: game.pin,
          rocketColor: player.rocketColor,
          state: game.state,
          altitude: player.altitude,
          score: player.score,
          totalQuestions: game.questions.length,
          duration: game.duration,
          totalDurationSecs: game.state === "racing" || game.state === "countdown" ? remainingSecsFresh : game.totalDurationSecs,
          title: game.title,
          advanceMode: game.advanceMode,
          activeQuestion:
            game.state === "racing" && freshQ
              ? {
                  index: freshQIdx,
                  text: freshQ.text,
                  type: freshQ.type,
                  options: freshQ.options,
                  duration: freshQ.duration,
                }
              : null,
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
        data: {
          pin: string;
          answerIndex: number;
          answerText?: string;
          skipToNext?: boolean;
          questionIdx?: number;
        },
        cb: (r: object) => void,
      ) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.state !== "racing") return cb({ error: "السباق ليس نشطاً." });
        // Endless mode: no time-based rejection. Race ends only on teacher action or cleanup.

        const player = game.players[socket.id];
        if (!player) return cb({ error: "أنت غير مسجل." });

        // skipToNext is a legacy no-op — ignore it silently.
        if (data.skipToNext) return cb({ success: true, skipped: true });

        const qIdx =
          game.advanceMode === "host_sync"
            ? game.syncQuestionIdx
            : player.currentQuestionIdx;
        const q = game.questions[qIdx];
        if (!q) return cb({ error: "خطأ في السؤال." });

        if (
          game.advanceMode === "host_sync" &&
          player.lastAnsweredSyncIdx === game.syncQuestionIdx
        ) {
          return cb({ error: "تم تسجيل إجابة لهذا السؤال بالفعل." });
        }

        // Per-question idempotency for per_player mode: if the client tells us which question
        // it is answering, reject submissions that don't match the player's current question.
        // This prevents a rapid double-emit from accidentally counting against the next question.
        if (
          game.advanceMode === "per_player" &&
          typeof data.questionIdx === "number" &&
          data.questionIdx !== qIdx
        ) {
          return cb({ success: true, skipped: true });
        }

        const elapsedMs = player.questionStartTime ? Date.now() - player.questionStartTime : 0;
        let correct = false;

        if (q.type === "fill_blank") {
          const submitted = (data.answerText || "").trim().toLowerCase();
          const accepted = [
            (q.correctText || "").trim().toLowerCase(),
            ...(q.options || []).map((o) => o.trim().toLowerCase()),
          ].filter(Boolean);
          correct = accepted.includes(submitted);
        } else {
          correct = data.answerIndex === q.correct;
        }

        let altitudeChange = 0;
        // Snapshot armed power-ups so we know what to consume on a correct answer.
        const usingBoost = correct && player.boostArmed && player.boostAvailable > 0;
        const usingMultiplier = correct && player.multiplierArmed && player.multiplierAvailable > 0;

        if (correct) {
          player.correctCount += 1;
          player.streak += 1;
          altitudeChange = altitudeForAnswer(elapsedMs, q.duration, game.questions.length);
          if (usingBoost) altitudeChange *= 2;
          player.altitude = player.altitude + altitudeChange;
          let earned = scoreForAnswer(true, elapsedMs, q.duration, player.streak);
          if (usingMultiplier) earned *= 2;
          player.score += earned;
          // Continuous-cruise boost: rocket sustains 4× velocity for 6s after a
          // correct answer, then decays back to base via the cruise loop.
          player.velocity = usingBoost ? 6 : 4;
          player.velocityBoostUntil = Date.now() + 6000;
        } else {
          player.wrongCount += 1;
          player.streak = 0;
          // No backward motion — rockets keep cruising. Wrong answers only
          // break the streak; the player still drifts forward at base velocity.
          altitudeChange = 0;
        }

        // Consume any armed power-ups on a correct answer (wrong answers preserve them).
        let consumedBoost: "boost" | null = null;
        let consumedMultiplier: "multiplier" | null = null;
        if (usingBoost) {
          player.boostAvailable = Math.max(0, player.boostAvailable - 1);
          player.boostArmed = false;
          consumedBoost = "boost";
        }
        if (usingMultiplier) {
          player.multiplierAvailable = Math.max(0, player.multiplierAvailable - 1);
          player.multiplierArmed = false;
          consumedMultiplier = "multiplier";
        }

        // Maybe grant a new power-up for hitting a 3-streak milestone.
        const grantedPower = correct ? maybeGrantPowerUp(player) : null;

        // Track globally cleared questions (used by `nextQuestionIdx` to draw
        // fresh content from the full pool until everything has been answered
        // correctly at least once, then cycles).
        if (correct) {
          player.clearedInPhase.add(qIdx);
          player.phaseProgress = player.clearedInPhase.size;
        }
        // Phase is now driven purely by elapsed game time; sync the player's
        // cached phase from the cruise clock and report whether it changed.
        const prevPhase = player.currentPhase;
        player.currentPhase = computeTimePhase(game);
        const phaseAdvanced = player.currentPhase !== prevPhase;

        if (game.advanceMode === "host_sync") {
          player.lastAnsweredSyncIdx = game.syncQuestionIdx;
          player.totalAnswered += 1;
          player.currentQuestionIdx = game.syncQuestionIdx;
        } else {
          player.totalAnswered += 1;
          player.currentQuestionIdx = nextQuestionIdx(game, player);
        }
        player.questionStartTime = Date.now();

        cb({
          success: true,
          correct,
          altitudeChange,
          correctIndex: q.type === "fill_blank" ? -1 : q.correct,
          correctText: q.correctText,
          altitude: player.altitude,
          score: player.score,
          streak: player.streak,
          finished: false,
          phase: player.currentPhase,
          phaseAdvanced,
          boostAvailable: player.boostAvailable,
          multiplierAvailable: player.multiplierAvailable,
          boostArmed: player.boostArmed,
          multiplierArmed: player.multiplierArmed,
          grantedPower,
          consumedBoost,
          consumedMultiplier,
        });

        rocketNs.to(`rocket:${game.pin}`).emit("rocket:leaderboard", {
          players: getPlayerList(game),
        });

        if (game.advanceMode === "host_sync") {
          return;
        }

        const delay = correct ? 800 : 1200;
        scheduleDelayedQuestion(game.pin, socket.id, () => {
          const g = rocketGames.get(data.pin);
          if (!g || g.state !== "racing") return;
          const p = g.players[socket.id];
          if (!p) return;
          const nextQ = g.questions[p.currentQuestionIdx];
          if (nextQ) {
            socket.emit("rocket:next-question", {
              index: p.currentQuestionIdx,
              phase: p.currentPhase,
              text: nextQ.text,
              type: nextQ.type,
              options: nextQ.options,
              duration: nextQ.duration,
            });
          }
        }, delay);
      },
    );

    // ── Host advances question (sync mode only) ─────────────────────────
    socket.on("rocket:host-next", (data: { pin: string }, cb: (r: object) => void) => {
      const game = rocketGames.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      if (game.advanceMode !== "host_sync") {
        return cb({ error: "هذا الوضع ليس ضبط الأسئلة اليدوي." });
      }
      if (game.state !== "racing") return cb({ error: "السباق غير نشط." });

      const nextIdx = (game.syncQuestionIdx + 1) % game.questions.length;
      game.syncQuestionIdx = nextIdx;
      const nq = game.questions[nextIdx];
      if (!nq) return cb({ error: "لا يوجد سؤال." });

      for (const pl of Object.values(game.players)) {
        pl.lastAnsweredSyncIdx = undefined;
        pl.currentQuestionIdx = nextIdx;
        pl.questionStartTime = Date.now();
      }

      rocketNs.to(`rocket:${game.pin}`).emit("rocket:sync-question", {
        index: nextIdx,
        text: nq.text,
        type: nq.type,
        options: nq.options,
        duration: nq.duration,
      });
      rocketNs.to(`rocket:${game.pin}`).emit("rocket:leaderboard", {
        players: getPlayerList(game),
      });
      cb({ success: true });
    });

    // ── Player arms / disarms a power-up (server confirms availability) ─
    socket.on(
      "rocket:use-power",
      (data: { pin: string; kind: "boost" | "multiplier" }, cb: (r: object) => void) => {
        const game = rocketGames.get(data.pin);
        if (!game) return cb({ error: "الغرفة غير موجودة." });
        if (game.state !== "racing") return cb({ error: "السباق ليس نشطاً." });
        const player = game.players[socket.id];
        if (!player) return cb({ error: "أنت غير مسجل." });

        if (data.kind === "boost") {
          if (player.boostAvailable < 1 && !player.boostArmed) {
            return cb({ error: "لا يوجد دفع متاح." });
          }
          player.boostArmed = !player.boostArmed;
        } else if (data.kind === "multiplier") {
          if (player.multiplierAvailable < 1 && !player.multiplierArmed) {
            return cb({ error: "لا يوجد مضاعف متاح." });
          }
          player.multiplierArmed = !player.multiplierArmed;
        } else {
          return cb({ error: "نوع غير معروف." });
        }

        cb({
          success: true,
          boostAvailable: player.boostAvailable,
          multiplierAvailable: player.multiplierAvailable,
          boostArmed: player.boostArmed,
          multiplierArmed: player.multiplierArmed,
        });

        rocketNs.to(`rocket:${game.pin}`).emit("rocket:leaderboard", {
          players: getPlayerList(game),
        });
      },
    );

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
      game.syncQuestionIdx = 0;
      if (game.raceTimer) {
        clearTimeout(game.raceTimer);
        game.raceTimer = undefined;
      }
      if (game.cruiseTimer) {
        clearInterval(game.cruiseTimer);
        game.cruiseTimer = undefined;
      }
      game.startedAt = undefined;
      clearPendingQuestionTimers(game.pin);
      for (const p of Object.values(game.players)) {
        resetPlayerForRace(p, game);
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
