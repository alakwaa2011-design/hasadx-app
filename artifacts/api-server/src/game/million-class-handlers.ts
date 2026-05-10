import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";
import { randomBytes } from "crypto";
import { db, millionClassSessionsTable, millionClassResultsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

type PlayerStatus = "playing" | "won" | "wrong" | "quit" | "finished";
type SessionMode = "individual" | "broadcast" | "team-control";
type LifelineKey = "fifty" | "phone" | "audience" | "swap";
type TeamSide = "A" | "B";
export type PointsScheme = "even" | "progressive" | "stages" | "millionaire-ladder";

interface ClassPlayer {
  name: string;
  playerToken: string;
  socketId: string;
  level: number;
  prize: number;
  correctCount: number;
  status: PlayerStatus;
  connected: boolean;
  updatedAt: number;
  totalTimeMs: number;
  lifelinesUsed: number;
  score: number;
  // Broadcast mode tracking
  currentAnswer?: string | null;
  answeredAt?: number;
}

interface TeamState {
  name: string;
  members: string[];
  score: number;
  lifelinesUsed: Record<LifelineKey, boolean>;
}

interface CachedQuestion {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl?: string | null;
}

interface ClassSession {
  pin: string;
  hostSocketId: string | null;
  hostToken: string;
  players: Map<string, ClassPlayer>;
  expiresAt: number;
  questionSource: string;
  assignmentId?: number;
  bankLevel?: string;
  bankCategory?: string;
  /** Optional teacher-selected target class — metadata for display only. */
  targetClass: string | null;
  autoAdvance: boolean;
  mode: SessionMode;
  // Broadcast state
  currentQuestionIdx: number;
  questionRevealed: boolean;
  // Team-control state
  teamA: TeamState | null;
  teamB: TeamState | null;
  transferredQuestions: Set<number>; // q indexes that were already transferred
  // Per-session game settings (team-control only)
  questionCount: number;
  pointsScheme: PointsScheme;
  basePoints: number;
  // Authoritative question list for server-side scoring & spectator display
  cachedQuestions: CachedQuestion[] | null;
}

// Prize ladder is mirrored from the client and used as the authoritative reward
// for each correctly-answered question in broadcast mode.
const PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];

/**
 * Per-question reward used by team-control mode.
 * - even        → every question awards `basePoints`
 * - progressive → starts at basePoints, grows by 25% of basePoints per question
 * - stages      → first half = basePoints, second half = 2× basePoints, last 5 questions = 5× basePoints
 * - millionaire-ladder → legacy 15-step pyramid (kept so existing solo/team-host modes are untouched)
 */
export function getQuestionPoints(
  scheme: PointsScheme,
  basePoints: number,
  questionIndex: number,
  totalQuestions: number,
): number {
  const base = Math.max(1, Math.floor(basePoints || 100));
  switch (scheme) {
    case "even":
      return base;
    case "progressive":
      return base + Math.floor(base * 0.25) * questionIndex;
    case "stages": {
      const lastFiveStart = Math.max(0, totalQuestions - 5);
      if (questionIndex >= lastFiveStart) return base * 5;
      const halfway = Math.floor(totalQuestions / 2);
      if (questionIndex >= halfway) return base * 2;
      return base;
    }
    case "millionaire-ladder":
    default:
      return PRIZE_LADDER[Math.min(questionIndex, PRIZE_LADDER.length - 1)] ?? base;
  }
}

const classSessions = new Map<string, ClassSession>();

function generatePin(): string {
  let pin: string;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (classSessions.has(pin));
  return pin;
}

function generateToken(len = 16): string {
  return randomBytes(len).toString("hex");
}

/** Composite score: prize is primary, speed secondary, fewer lifelines tertiary */
function computeScore(prize: number, totalTimeMs: number, lifelinesUsed: number): number {
  const speedBonus = Math.max(0, 1_000_000 - Math.floor(totalTimeMs / 300));
  const lifelinePenalty = lifelinesUsed * 50_000;
  return prize * 100 + speedBonus - lifelinePenalty;
}

function getPlayerList(session: ClassSession) {
  return Array.from(session.players.values())
    .map(p => ({
      name: p.name,
      playerToken: p.playerToken,
      level: p.level,
      prize: p.prize,
      correctCount: p.correctCount,
      status: p.status,
      connected: p.connected,
      totalTimeMs: p.totalTimeMs,
      lifelinesUsed: p.lifelinesUsed,
      score: p.score,
      hasAnswered: !!p.currentAnswer,
    }))
    // Spec: rank by accumulated correct-prize (desc); time is the tie-breaker (asc).
    // Number of correct answers and lifeline penalty are tertiary fallbacks.
    .sort((a, b) =>
      b.prize - a.prize ||
      a.totalTimeMs - b.totalTimeMs ||
      b.correctCount - a.correctCount ||
      a.lifelinesUsed - b.lifelinesUsed
    );
}

/** Returns a public-facing snapshot of the current question; hides the
 * correct answer until the host has revealed it. */
function getPublicCurrentQuestion(session: ClassSession) {
  const q = session.cachedQuestions?.[session.currentQuestionIdx];
  if (!q) return null;
  return {
    id: q.id,
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    imageUrl: q.imageUrl ?? null,
    correctAnswer: session.questionRevealed ? q.correctAnswer : null,
  };
}

function broadcastLeaderboard(io: Server, session: ClassSession) {
  io.to(`million-class:${session.pin}`).emit("million-class:leaderboard", {
    players: getPlayerList(session),
    currentQuestionIdx: session.currentQuestionIdx,
    questionRevealed: session.questionRevealed,
    currentQuestion: getPublicCurrentQuestion(session),
  });
}

function broadcastTeamState(io: Server, session: ClassSession) {
  if (session.mode !== "team-control" || !session.teamA || !session.teamB) return;
  io.to(`million-class:${session.pin}`).emit("million-class:team-state", {
    teamA: session.teamA,
    teamB: session.teamB,
    currentQuestionIdx: session.currentQuestionIdx,
    questionRevealed: session.questionRevealed,
    transferredQuestions: Array.from(session.transferredQuestions),
    currentQuestion: getPublicCurrentQuestion(session),
    pointsScheme: session.pointsScheme,
    basePoints: session.basePoints,
    questionCount: session.questionCount,
    currentQuestionPoints: getQuestionPoints(
      session.pointsScheme,
      session.basePoints,
      session.currentQuestionIdx,
      session.questionCount,
    ),
  });
}

/** Called by the REST /questions endpoint after it picks a question set,
 * so the live session has authoritative answers for scoring & spectator views. */
export function setCachedQuestions(pin: string, questions: CachedQuestion[]) {
  const session = classSessions.get(pin);
  if (!session) return;
  // Only set once — first caller (the host loading questions) wins.
  if (!session.cachedQuestions) session.cachedQuestions = questions;
}

export function setupMillionClassSocket(io: Server) {
  io.on("connection", (socket: Socket) => {

    socket.on("million-class:create", (
      data: { pin: string; hostToken: string },
      cb?: (res: { ok?: boolean; error?: string }) => void
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session || session.hostToken !== data.hostToken) {
          cb?.({ error: "غرفة غير موجودة" });
          return;
        }
        session.hostSocketId = socket.id;
        socket.join(`million-class:${data.pin}`);
        cb?.({ ok: true });
        socket.emit("million-class:leaderboard", { players: getPlayerList(session), currentQuestionIdx: session.currentQuestionIdx, questionRevealed: session.questionRevealed });
        if (session.mode === "team-control") broadcastTeamState(io, session);
      } catch (err) {
        logger.error(err, "million-class:create socket error");
        cb?.({ error: "خطأ" });
      }
    });

    // Lightweight room subscription — used by spectator pages (e.g. team-watch)
    // that already joined as a player elsewhere and only need to receive state updates.
    socket.on("million-class:subscribe", (data: { pin: string }) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) return;
        socket.join(`million-class:${session.pin}`);
        if (session.mode === "team-control") {
          socket.emit("million-class:team-state", {
            teamA: session.teamA,
            teamB: session.teamB,
            currentQuestionIdx: session.currentQuestionIdx,
            questionRevealed: session.questionRevealed,
            transferredQuestions: Array.from(session.transferredQuestions),
            currentQuestion: getPublicCurrentQuestion(session),
            pointsScheme: session.pointsScheme,
            basePoints: session.basePoints,
            questionCount: session.questionCount,
            currentQuestionPoints: getQuestionPoints(
              session.pointsScheme,
              session.basePoints,
              session.currentQuestionIdx,
              session.questionCount,
            ),
          });
        } else {
          socket.emit("million-class:leaderboard", {
            players: getPlayerList(session),
            currentQuestionIdx: session.currentQuestionIdx,
            questionRevealed: session.questionRevealed,
            currentQuestion: getPublicCurrentQuestion(session),
          });
        }
      } catch (err) {
        logger.error(err, "million-class:subscribe error");
      }
    });

    socket.on("million-class:join", (
      data: { pin: string; name: string },
      cb?: (res: { playerToken?: string; autoAdvance?: boolean; broadcastMode?: boolean; mode?: SessionMode; currentQuestionIdx?: number; error?: string }) => void
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) { cb?.({ error: "الرمز غير صحيح أو منتهي الصلاحية" }); return; }
        if (Date.now() > session.expiresAt) { cb?.({ error: "انتهت صلاحية الغرفة" }); return; }

        const name = (data.name || "").trim().slice(0, 40);
        if (!name) { cb?.({ error: "الاسم مطلوب" }); return; }

        const playerToken = generateToken(12);
        const player: ClassPlayer = {
          name, playerToken, socketId: socket.id,
          level: 0, prize: 0, correctCount: 0,
          status: "playing", connected: true,
          updatedAt: Date.now(),
          totalTimeMs: 0, lifelinesUsed: 0, score: 0,
        };

        session.players.set(playerToken, player);
        socket.join(`million-class:${data.pin}`);

        db.insert(millionClassResultsTable).values({
          sessionPin: data.pin, playerToken, playerName: name,
          level: 0, prize: 0, correctCount: 0, status: "playing",
        }).catch(err => logger.error(err, "Failed to insert class result on join"));

        broadcastLeaderboard(io, session);
        cb?.({
          playerToken,
          autoAdvance: session.autoAdvance,
          broadcastMode: session.mode === "broadcast",
          mode: session.mode,
          currentQuestionIdx: session.currentQuestionIdx,
        });
      } catch (err) {
        logger.error(err, "million-class:join error");
        cb?.({ error: "خطأ في الانضمام" });
      }
    });

    socket.on("million-class:player-rejoin", (
      data: { pin: string; playerToken: string },
      cb?: (res: { ok?: boolean; autoAdvance?: boolean; broadcastMode?: boolean; mode?: SessionMode; currentQuestionIdx?: number; error?: string }) => void
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) { cb?.({ error: "غرفة غير موجودة" }); return; }
        const player = session.players.get(data.playerToken);
        if (!player) { cb?.({ error: "رمز اللاعب غير صحيح" }); return; }
        player.socketId = socket.id;
        player.connected = true;
        socket.join(`million-class:${data.pin}`);
        cb?.({
          ok: true,
          autoAdvance: session.autoAdvance,
          broadcastMode: session.mode === "broadcast",
          mode: session.mode,
          currentQuestionIdx: session.currentQuestionIdx,
        });
      } catch (err) {
        logger.error(err, "million-class:player-rejoin error");
        cb?.({ error: "خطأ" });
      }
    });

    // ===== Broadcast mode: host advances question for everyone =====
    socket.on("million-class:host-next-question", (
      data: { pin: string; hostToken: string },
      cb?: (res: { ok?: boolean; currentQuestionIdx?: number; error?: string }) => void
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session || session.hostToken !== data.hostToken) { cb?.({ error: "غير مصرح" }); return; }
        if (session.mode !== "broadcast" && session.mode !== "team-control") {
          cb?.({ error: "هذا الوضع لا يدعم التحكم بالسؤال" });
          return;
        }
        session.currentQuestionIdx += 1;
        session.questionRevealed = false;
        // Reset per-question answers
        for (const p of session.players.values()) {
          p.currentAnswer = null;
          p.answeredAt = undefined;
        }
        io.to(`million-class:${session.pin}`).emit("million-class:question-changed", {
          currentQuestionIdx: session.currentQuestionIdx,
          currentQuestion: getPublicCurrentQuestion(session),
        });
        broadcastLeaderboard(io, session);
        if (session.mode === "team-control") broadcastTeamState(io, session);

        // If we just advanced past the final question, emit an explicit
        // game-ended event so the host & spectator pages can show their
        // celebratory final scoreboard immediately.
        const total = session.cachedQuestions?.length ?? 0;
        if (total > 0 && session.currentQuestionIdx >= total) {
          if (session.mode === "team-control" && session.teamA && session.teamB) {
            const winner: TeamSide | "TIE" =
              session.teamA.score > session.teamB.score ? "A"
              : session.teamB.score > session.teamA.score ? "B"
              : "TIE";
            io.to(`million-class:${session.pin}`).emit("million-class:game-ended", {
              mode: session.mode,
              totalQuestions: total,
              teamA: session.teamA,
              teamB: session.teamB,
              winner,
            });
          } else {
            io.to(`million-class:${session.pin}`).emit("million-class:game-ended", {
              mode: session.mode,
              totalQuestions: total,
            });
          }
        }
        cb?.({ ok: true, currentQuestionIdx: session.currentQuestionIdx });
      } catch (err) {
        logger.error(err, "million-class:host-next-question error");
        cb?.({ error: "خطأ" });
      }
    });

    // Player submits an answer in broadcast mode. The server is authoritative:
    // it ignores client-reported isCorrect/prizeForQuestion and validates against
    // the cached question answer + the official prize ladder.
    socket.on("million-class:answer", (
      data: { pin: string; playerToken: string; questionIdx: number; answer: string; totalTimeMs?: number },
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) return;
        const player = session.players.get(data.playerToken);
        if (!player) return;
        if (data.questionIdx !== session.currentQuestionIdx) return;
        // Idempotent: only first answer counts
        if (player.currentAnswer) return;

        const submitted = String(data.answer || "").trim().toUpperCase();
        if (!["A", "B", "C", "D"].includes(submitted)) return;
        const q = session.cachedQuestions?.[data.questionIdx];
        // If we don't have an authoritative question list, refuse to score (keeps integrity).
        if (!q) return;

        const isCorrect = submitted === q.correctAnswer.trim().toUpperCase();
        const prizeForQuestion = isCorrect ? (PRIZE_LADDER[data.questionIdx] ?? 0) : 0;

        player.currentAnswer = submitted;
        player.answeredAt = Date.now();
        if (isCorrect) {
          player.correctCount += 1;
          player.prize += prizeForQuestion;
        }
        player.level = data.questionIdx + 1;
        if (typeof data.totalTimeMs === "number" && data.totalTimeMs >= 0) {
          player.totalTimeMs = data.totalTimeMs;
        }
        player.score = computeScore(player.prize, player.totalTimeMs, player.lifelinesUsed);
        player.updatedAt = Date.now();
        broadcastLeaderboard(io, session);
      } catch (err) {
        logger.error(err, "million-class:answer error");
      }
    });

    // ===== Team-control mode: host actions =====
    socket.on("million-class:team-action", (
      data: {
        pin: string;
        hostToken: string;
        action: "reveal" | "transfer" | "award" | "lifeline" | "set-question" | "rename" | "roster";
        team?: TeamSide;
        points?: number;
        lifeline?: LifelineKey;
        questionIdx?: number;
        name?: string;
        teamAMembers?: unknown;
        teamBMembers?: unknown;
      },
      cb?: (res: { ok?: boolean; error?: string }) => void
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session || session.hostToken !== data.hostToken) { cb?.({ error: "غير مصرح" }); return; }
        if (session.mode !== "team-control" || !session.teamA || !session.teamB) { cb?.({ error: "ليس وضع فريقين" }); return; }

        let persistTeams = false;
        switch (data.action) {
          case "reveal":
            session.questionRevealed = true;
            break;
          case "transfer":
            session.transferredQuestions.add(session.currentQuestionIdx);
            session.questionRevealed = false;
            break;
          case "award": {
            if (!data.team || (data.team !== "A" && data.team !== "B")) { cb?.({ error: "فريق غير صالح" }); return; }
            const points = Number(data.points) || 0;
            const target = data.team === "A" ? session.teamA : session.teamB;
            target.score += points;
            break;
          }
          case "lifeline": {
            // Lifeline used BY a team AGAINST the opposing team. Each team can use each lifeline once.
            if (!data.team || !data.lifeline) { cb?.({ error: "بيانات ناقصة" }); return; }
            const validLifelines: LifelineKey[] = ["fifty", "phone", "audience", "swap"];
            if (!validLifelines.includes(data.lifeline)) { cb?.({ error: "مساعدة غير صالحة" }); return; }
            const target = data.team === "A" ? session.teamA : session.teamB;
            if (target.lifelinesUsed[data.lifeline]) { cb?.({ error: "تم استخدام هذه المساعدة" }); return; }
            target.lifelinesUsed[data.lifeline] = true;
            break;
          }
          case "set-question": {
            const q = Number(data.questionIdx);
            if (Number.isFinite(q) && q >= 0) {
              session.currentQuestionIdx = q;
              session.questionRevealed = false;
            }
            break;
          }
          case "rename": {
            if (!data.team || (data.team !== "A" && data.team !== "B")) { cb?.({ error: "فريق غير صالح" }); return; }
            const newName = String(data.name || "").trim().slice(0, 40);
            if (!newName) { cb?.({ error: "الاسم مطلوب" }); return; }
            const target = data.team === "A" ? session.teamA : session.teamB;
            target.name = newName;
            persistTeams = true;
            break;
          }
          case "roster": {
            // Use a single shared seen-set across both teams so a student
            // can never appear in team A and team B at the same time.
            const seen = new Set<string>();
            const cleanList = (arr: unknown): string[] => {
              if (!Array.isArray(arr)) return [];
              const out: string[] = [];
              for (const m of arr) {
                const s = String(m || "").trim().slice(0, 40);
                const key = s.toLowerCase();
                if (s && !seen.has(key)) { seen.add(key); out.push(s); }
              }
              return out;
            };
            // If only one side is being updated, seed `seen` with the
            // other (kept) team so a duplicate name is filtered out of
            // the side being changed.
            if (data.teamAMembers === undefined) {
              for (const m of session.teamA.members) seen.add(m.toLowerCase());
            }
            if (data.teamBMembers === undefined) {
              for (const m of session.teamB.members) seen.add(m.toLowerCase());
            }
            const nextA = data.teamAMembers !== undefined ? cleanList(data.teamAMembers) : session.teamA.members;
            const nextB = data.teamBMembers !== undefined ? cleanList(data.teamBMembers) : session.teamB.members;
            session.teamA.members = nextA;
            session.teamB.members = nextB;
            persistTeams = true;
            break;
          }
        }
        broadcastTeamState(io, session);
        broadcastLeaderboard(io, session);
        if (persistTeams) {
          db.update(millionClassSessionsTable)
            .set({
              teamAName: session.teamA.name,
              teamBName: session.teamB.name,
              teamAMembers: session.teamA.members,
              teamBMembers: session.teamB.members,
            })
            .where(eq(millionClassSessionsTable.pin, session.pin))
            .catch(err => logger.error(err, "Failed to persist team rename/roster change"));
        }
        cb?.({ ok: true });
      } catch (err) {
        logger.error(err, "million-class:team-action error");
        cb?.({ error: "خطأ" });
      }
    });

    socket.on("million-class:update-progress", (
      data: { pin: string; playerToken: string; level: number; prize: number; correctCount: number; totalTimeMs?: number; lifelinesUsed?: number; }
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) return;
        // Authoritative scoring: in broadcast/team-control modes, only
        // server-validated events (million-class:answer / team-action) may
        // mutate prize. Reject this legacy client event to prevent tampering.
        if (session.mode === "broadcast" || session.mode === "team-control") return;
        const player = session.players.get(data.playerToken);
        if (!player) return;
        player.level = data.level ?? player.level;
        player.prize = data.prize ?? player.prize;
        player.correctCount = data.correctCount ?? player.correctCount;
        if (data.totalTimeMs !== undefined) player.totalTimeMs = data.totalTimeMs;
        if (data.lifelinesUsed !== undefined) player.lifelinesUsed = data.lifelinesUsed;
        player.score = computeScore(player.prize, player.totalTimeMs, player.lifelinesUsed);
        player.updatedAt = Date.now();
        broadcastLeaderboard(io, session);
      } catch (err) {
        logger.error(err, "million-class:update-progress error");
      }
    });

    socket.on("million-class:finish", (
      data: { pin: string; playerToken: string; level: number; prize: number; correctCount: number; status: PlayerStatus; totalTimeMs?: number; lifelinesUsed?: number; }
    ) => {
      try {
        const session = classSessions.get(data.pin);
        if (!session) return;
        // See update-progress: server-authoritative modes ignore this.
        if (session.mode === "broadcast" || session.mode === "team-control") return;
        const player = session.players.get(data.playerToken);
        if (!player) return;
        player.level = data.level ?? player.level;
        player.prize = data.prize ?? player.prize;
        player.correctCount = data.correctCount ?? player.correctCount;
        player.status = data.status ?? "wrong";
        if (data.totalTimeMs !== undefined) player.totalTimeMs = data.totalTimeMs;
        if (data.lifelinesUsed !== undefined) player.lifelinesUsed = data.lifelinesUsed;
        player.score = computeScore(player.prize, player.totalTimeMs, player.lifelinesUsed);
        player.updatedAt = Date.now();
        broadcastLeaderboard(io, session);

        db.update(millionClassResultsTable)
          .set({ level: player.level, prize: player.prize, correctCount: player.correctCount, status: player.status, updatedAt: new Date() })
          .where(and(eq(millionClassResultsTable.sessionPin, data.pin), eq(millionClassResultsTable.playerToken, data.playerToken)))
          .catch(err => logger.error(err, "Failed to update class result on finish"));
      } catch (err) {
        logger.error(err, "million-class:finish error");
      }
    });

    socket.on("disconnect", () => {
      for (const session of classSessions.values()) {
        for (const player of session.players.values()) {
          if (player.socketId === socket.id) player.connected = false;
        }
        if (session.hostSocketId === socket.id) session.hostSocketId = null;
      }
    });
  });
}

export async function createClassSession(opts: {
  hostId?: number;
  questionSource: string;
  assignmentId?: number;
  bankLevel?: string;
  bankCategory?: string;
  targetClass?: string;
  autoAdvance?: boolean;
  mode?: SessionMode;
  teamAName?: string;
  teamBName?: string;
  teamAMembers?: string[];
  teamBMembers?: string[];
  questionCount?: number;
  pointsScheme?: PointsScheme;
  basePoints?: number;
}): Promise<{ pin: string; hostToken: string }> {
  const pin = generatePin();
  const hostToken = generateToken();
  const expiresAtMs = Date.now() + 4 * 60 * 60 * 1000;
  const expiresAtDate = new Date(expiresAtMs);
  const mode: SessionMode = opts.mode ?? "individual";

  const teamA: TeamState | null = mode === "team-control"
    ? { name: opts.teamAName || "الفريق أ", members: opts.teamAMembers || [], score: 0, lifelinesUsed: { fifty: false, phone: false, audience: false, swap: false } }
    : null;
  const teamB: TeamState | null = mode === "team-control"
    ? { name: opts.teamBName || "الفريق ب", members: opts.teamBMembers || [], score: 0, lifelinesUsed: { fifty: false, phone: false, audience: false, swap: false } }
    : null;

  // Game-settings defaults: legacy ladder & 15 questions for non team-control modes.
  const isTeamControl = mode === "team-control";
  const rawCount = opts.questionCount ?? (isTeamControl ? 15 : 15);
  const questionCount = Math.max(5, Math.min(50, Math.floor(rawCount)));
  const pointsScheme: PointsScheme = isTeamControl
    ? (opts.pointsScheme ?? "even")
    : "millionaire-ladder";
  const basePoints = Math.max(1, Math.min(10_000, Math.floor(opts.basePoints ?? 100)));

  const session: ClassSession = {
    pin,
    hostSocketId: null,
    hostToken,
    players: new Map(),
    expiresAt: expiresAtMs,
    questionSource: opts.questionSource,
    assignmentId: opts.assignmentId,
    bankLevel: opts.bankLevel,
    bankCategory: opts.bankCategory,
    targetClass: typeof opts.targetClass === "string" && opts.targetClass.trim() ? opts.targetClass.trim().slice(0, 60) : null,
    autoAdvance: opts.autoAdvance ?? true,
    mode,
    currentQuestionIdx: 0,
    questionRevealed: false,
    teamA,
    teamB,
    transferredQuestions: new Set(),
    questionCount,
    pointsScheme,
    basePoints,
    cachedQuestions: null,
  };
  classSessions.set(pin, session);
  setTimeout(() => classSessions.delete(pin), 4 * 60 * 60 * 1000);

  try {
    await db.insert(millionClassSessionsTable).values({
      pin,
      hostId: opts.hostId ?? null,
      questionSource: opts.questionSource,
      assignmentId: opts.assignmentId ?? null,
      bankLevel: opts.bankLevel ?? null,
      bankCategory: opts.bankCategory ?? null,
      mode,
      broadcastMode: mode === "broadcast",
      teamAName: teamA?.name ?? null,
      teamBName: teamB?.name ?? null,
      teamAMembers: teamA?.members ?? null,
      teamBMembers: teamB?.members ?? null,
      questionCount,
      pointsScheme,
      basePoints,
      expiresAt: expiresAtDate,
    });
  } catch (err) {
    logger.error(err, "Failed to persist class session to DB");
  }

  return { pin, hostToken };
}

export function getClassSession(pin: string): {
  pin: string;
  questionSource: string;
  assignmentId?: number;
  bankLevel?: string;
  bankCategory?: string;
  autoAdvance: boolean;
  mode: SessionMode;
  teamAName?: string;
  teamBName?: string;
  teamAMembers?: string[];
  teamBMembers?: string[];
  currentQuestionIdx: number;
  cachedQuestions: CachedQuestion[] | null;
  questionCount: number;
  pointsScheme: PointsScheme;
  basePoints: number;
} | null {
  const session = classSessions.get(pin);
  if (!session || Date.now() > session.expiresAt) return null;
  return {
    pin: session.pin,
    questionSource: session.questionSource,
    assignmentId: session.assignmentId,
    bankLevel: session.bankLevel,
    bankCategory: session.bankCategory,
    autoAdvance: session.autoAdvance,
    mode: session.mode,
    teamAName: session.teamA?.name,
    teamBName: session.teamB?.name,
    teamAMembers: session.teamA?.members,
    teamBMembers: session.teamB?.members,
    currentQuestionIdx: session.currentQuestionIdx,
    cachedQuestions: session.cachedQuestions,
    questionCount: session.questionCount,
    pointsScheme: session.pointsScheme,
    basePoints: session.basePoints,
  };
}
