import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";
import { randomBytes } from "crypto";
import { db, millionTeamSessionsTable, millionTeamVotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

type OptionKey = "A" | "B" | "C" | "D";
type TeamId = "A" | "B";
type GameStatus = "waiting" | "playing" | "revealing" | "finished";

const PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const SAFE_HAVEN_LEVELS = new Set([4, 9]);

function getQuestionMeta(idx: number, totalQ: number): { tier: number; isPower: boolean; pointsPerVoter: number } {
  const ratio = idx / Math.max(1, totalQ - 1);
  const tier = ratio < 1 / 3 ? 1 : ratio < 2 / 3 ? 2 : 3;
  const isPower = (idx + 1) % 5 === 0;
  return { tier, isPower, pointsPerVoter: tier * 100 * (isPower ? 2 : 1) };
}
const QUESTION_SECONDS = 30;
const SPEED_BONUS_RATIO = 0.2;

interface TeamQuestion {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl: string | null;
}

interface PlayerLifelines {
  fifty: boolean;
  swap: boolean;
  callFriend: boolean;
  freeze: boolean;
}

interface TeamPlayer {
  name: string;
  team: TeamId;
  socketId: string;
  rejoinToken: string;
  connected: boolean;
  correctCount: number;
  wrongCount: number;
  playerLifelinesUsed: PlayerLifelines;
  pendingFrozen: boolean;
  frozenThisRound: boolean;
}

interface TeamLifelines {
  fifty: boolean;
  swap: boolean;
  freeze: boolean;
  takePrize: boolean;
  callFriend: boolean;
}

interface LifelineVoteState {
  team: TeamId;
  votes: Map<string, keyof TeamLifelines>;
  availableLifelines: string[];
  timeout: ReturnType<typeof setTimeout> | null;
}

interface MajorityTrack {
  A: { option: OptionKey | null; reachedAtSec: number | null };
  B: { option: OptionKey | null; reachedAtSec: number | null };
}

interface LastRevealData {
  correctAnswer: OptionKey;
  teamA: { answer: OptionKey | null; correct: boolean; prizeLevel: number; points: number; prize: number; speedBonus: boolean };
  teamB: { answer: OptionKey | null; correct: boolean; prizeLevel: number; points: number; prize: number; speedBonus: boolean };
  eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
  frozenTeam: TeamId | null;
  isLastQuestion: boolean;
}

interface TeamSession {
  pin: string;
  hostSocketId: string;
  hostToken: string;
  questions: TeamQuestion[];
  currentIndex: number;
  status: GameStatus;
  teamNames: { A: string; B: string };
  timerInterval: ReturnType<typeof setInterval> | null;
  timerSeconds: number;
  paused: boolean;
  votes: { A: Map<string, OptionKey>; B: Map<string, OptionKey> };
  prizeLevels: { A: number; B: number };
  points: { A: number; B: number };
  players: Map<string, TeamPlayer>;
  eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
  frozenTeam: TeamId | null;
  pendingFreezeTeam: TeamId | null;
  lifelinesUsed: { A: TeamLifelines; B: TeamLifelines };
  majority: MajorityTrack;
  questionElapsedSec: number;
  lastRevealData: LastRevealData | null;
  lifelineVote: LifelineVoteState | null;
}

const sessions = new Map<string, TeamSession>();

function generatePin(): string {
  let pin: string;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (sessions.has(pin));
  return pin;
}

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

function getPlayerList(session: TeamSession) {
  return Array.from(session.players.values()).map(p => ({
    name: p.name,
    team: p.team,
    connected: p.connected,
    correctCount: p.correctCount,
    wrongCount: p.wrongCount,
    frozenThisRound: p.frozenThisRound,
  }));
}

function getConnectedTeamPlayers(session: TeamSession, team: TeamId): TeamPlayer[] {
  return Array.from(session.players.values()).filter(p => p.team === team && p.connected);
}

function countVotes(votes: Map<string, OptionKey>): Record<OptionKey, number> {
  const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const opt of votes.values()) {
    counts[opt]++;
  }
  return counts;
}

function getMajorityVote(votes: Map<string, OptionKey>, connectedPlayers: TeamPlayer[]): OptionKey | null {
  const teamSize = connectedPlayers.length;
  if (teamSize === 0) return null;
  const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const p of connectedPlayers) {
    const v = votes.get(p.socketId);
    if (v) counts[v]++;
  }
  const threshold = Math.floor(teamSize / 2) + 1;
  for (const opt of (["A", "B", "C", "D"] as OptionKey[])) {
    if (counts[opt] >= threshold) return opt;
  }
  return null;
}

function getLeadingVote(votes: Map<string, OptionKey>): OptionKey | null {
  if (votes.size === 0) return null;
  const counts = countVotes(votes);
  let best: OptionKey | null = null;
  let bestCount = 0;
  for (const opt of (["A", "B", "C", "D"] as OptionKey[])) {
    if (counts[opt] > bestCount) { bestCount = counts[opt]; best = opt; }
  }
  return best;
}

function allConnectedVoted(votes: Map<string, OptionKey>, connectedPlayers: TeamPlayer[]): boolean {
  return connectedPlayers.length > 0 && connectedPlayers.every(p => votes.has(p.socketId));
}

function stopTimer(session: TeamSession) {
  if (session.timerInterval) {
    clearInterval(session.timerInterval);
    session.timerInterval = null;
  }
}

function buildVoteUpdate(session: TeamSession) {
  const teamAConnected = getConnectedTeamPlayers(session, "A");
  const teamBConnected = getConnectedTeamPlayers(session, "B");
  return {
    teamA: countVotes(session.votes.A),
    teamB: countVotes(session.votes.B),
    teamASize: teamAConnected.length,
    teamBSize: teamBConnected.length,
    majority: {
      A: session.majority.A,
      B: session.majority.B,
    },
    frozenTeam: session.frozenTeam,
  };
}

function revealQuestion(io: Server, session: TeamSession) {
  stopTimer(session);
  session.status = "revealing";

  const q = session.questions[session.currentIndex];
  if (!q) return;

  const correctKey = q.correctAnswer.trim().toUpperCase() as OptionKey;

  const teamAConnected = getConnectedTeamPlayers(session, "A");
  const teamBConnected = getConnectedTeamPlayers(session, "B");

  const frozenTeam = session.frozenTeam;

  const answerA = frozenTeam === "A" ? null : (getMajorityVote(session.votes.A, teamAConnected) ?? getLeadingVote(session.votes.A));
  const answerB = frozenTeam === "B" ? null : (getMajorityVote(session.votes.B, teamBConnected) ?? getLeadingVote(session.votes.B));

  const correctA = answerA === correctKey;
  const correctB = answerB === correctKey;

  if (correctA) {
    const newLevel = Math.min(session.prizeLevels.A + 1, PRIZE_LADDER.length - 1);
    session.prizeLevels.A = newLevel;
  }

  if (correctB) {
    const newLevel = Math.min(session.prizeLevels.B + 1, PRIZE_LADDER.length - 1);
    session.prizeLevels.B = newLevel;
  }

  let correctVotersA = 0;
  let correctVotersB = 0;

  for (const player of session.players.values()) {
    if (!player.connected) continue;
    const playerVote = player.team === "A" ? session.votes.A.get(player.socketId) : session.votes.B.get(player.socketId);
    if (playerVote !== undefined) {
      if (playerVote === correctKey) {
        player.correctCount++;
        if (player.team === "A") correctVotersA++;
        else correctVotersB++;
      } else {
        player.wrongCount++;
      }
    }
  }

  const { pointsPerVoter } = getQuestionMeta(session.currentIndex, session.questions.length);
  session.points.A += correctVotersA * pointsPerVoter;
  session.points.B += correctVotersB * pointsPerVoter;

  const prizeA = PRIZE_LADDER[Math.max(0, session.prizeLevels.A)] ?? 0;
  const prizeB = PRIZE_LADDER[Math.max(0, session.prizeLevels.B)] ?? 0;
  const isLastQuestion = session.currentIndex >= session.questions.length - 1;

  const revealPayload: LastRevealData = {
    correctAnswer: correctKey,
    teamA: {
      answer: answerA,
      correct: correctA,
      prizeLevel: session.prizeLevels.A,
      points: session.points.A,
      prize: prizeA,
      speedBonus: false,
    },
    teamB: {
      answer: answerB,
      correct: correctB,
      prizeLevel: session.prizeLevels.B,
      points: session.points.B,
      prize: prizeB,
      speedBonus: false,
    },
    eliminatedOptions: session.eliminatedOptions,
    frozenTeam,
    isLastQuestion,
  };

  session.lastRevealData = revealPayload;
  session.frozenTeam = null;

  io.to(`million-team:${session.pin}`).emit("million-team:question-revealed", {
    ...revealPayload,
    safeHavenA: SAFE_HAVEN_LEVELS.has(session.prizeLevels.A),
    safeHavenB: SAFE_HAVEN_LEVELS.has(session.prizeLevels.B),
    correctVotersA,
    correctVotersB,
  });

  const teamAConnectedCount = getConnectedTeamPlayers(session, "A").length;
  const teamBConnectedCount = getConnectedTeamPlayers(session, "B").length;

  const voteRowsA = {
    sessionPin: session.pin,
    questionIndex: session.currentIndex,
    team: "A",
    teamAnswer: answerA ?? null,
    correctAnswer: correctKey,
    isCorrect: correctA,
    voteCount: session.votes.A.size,
    teamSize: teamAConnectedCount,
    prizeWon: correctA ? prizeA : 0,
    prizeLevel: session.prizeLevels.A,
  };

  const voteRowsB = {
    sessionPin: session.pin,
    questionIndex: session.currentIndex,
    team: "B",
    teamAnswer: answerB ?? null,
    correctAnswer: correctKey,
    isCorrect: correctB,
    voteCount: session.votes.B.size,
    teamSize: teamBConnectedCount,
    prizeWon: correctB ? prizeB : 0,
    prizeLevel: session.prizeLevels.B,
  };

  db.insert(millionTeamVotesTable)
    .values([voteRowsA, voteRowsB])
    .catch(err => logger.error(err, "Failed to persist team votes"));
}

function startTimer(io: Server, session: TeamSession) {
  stopTimer(session);
  session.paused = false;

  session.timerInterval = setInterval(() => {
    if (session.paused) return;

    session.timerSeconds -= 1;
    session.questionElapsedSec += 1;

    const teamAConnected = getConnectedTeamPlayers(session, "A");
    const teamBConnected = getConnectedTeamPlayers(session, "B");

    if (!session.majority.A.option) {
      const maj = getMajorityVote(session.votes.A, teamAConnected);
      if (maj) {
        session.majority.A = { option: maj, reachedAtSec: session.questionElapsedSec };
      }
    }
    if (!session.majority.B.option) {
      const maj = getMajorityVote(session.votes.B, teamBConnected);
      if (maj) {
        session.majority.B = { option: maj, reachedAtSec: session.questionElapsedSec };
      }
    }

    io.to(`million-team:${session.pin}`).emit("million-team:timer", {
      seconds: session.timerSeconds,
      paused: false,
    });

    io.to(`million-team:${session.pin}`).emit("million-team:vote-update", buildVoteUpdate(session));

    if (session.timerSeconds <= 0) {
      revealQuestion(io, session);
    }
  }, 1000);
}

function broadcastQuestion(io: Server, session: TeamSession) {
  const q = session.questions[session.currentIndex];
  if (!q) return;

  session.status = "playing";
  session.timerSeconds = QUESTION_SECONDS;
  session.questionElapsedSec = 0;
  session.votes = { A: new Map(), B: new Map() };
  session.eliminatedOptions = { A: [], B: [] };
  session.frozenTeam = session.pendingFreezeTeam ?? null;
  session.pendingFreezeTeam = null;
  session.majority = { A: { option: null, reachedAtSec: null }, B: { option: null, reachedAtSec: null } };
  session.lastRevealData = null;
  if (session.lifelineVote?.timeout) clearTimeout(session.lifelineVote.timeout);
  session.lifelineVote = null;

  for (const player of session.players.values()) {
    player.frozenThisRound = player.pendingFrozen;
    player.pendingFrozen = false;
    if (player.frozenThisRound && player.connected) {
      io.to(player.socketId).emit("million-team:you-are-frozen");
    }
  }

  const qMeta = getQuestionMeta(session.currentIndex, session.questions.length);
  io.to(`million-team:${session.pin}`).emit("million-team:next-question", {
    question: {
      id: q.id,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      imageUrl: q.imageUrl,
    },
    questionIndex: session.currentIndex,
    totalQuestions: session.questions.length,
    prizeLevels: session.prizeLevels,
    points: session.points,
    lifelinesUsed: session.lifelinesUsed,
    teamNames: session.teamNames,
    frozenTeam: session.frozenTeam,
    questionTier: qMeta.tier,
    isPowerQuestion: qMeta.isPower,
    pointsPerVoter: qMeta.pointsPerVoter,
  });

  startTimer(io, session);
}

function cleanupSession(pin: string) {
  const session = sessions.get(pin);
  if (!session) return;
  stopTimer(session);
  sessions.delete(pin);
}

async function persistGameResult(session: TeamSession, winner: string) {
  try {
    const teamAPlayers = Array.from(session.players.values()).filter(p => p.team === "A").length;
    const teamBPlayers = Array.from(session.players.values()).filter(p => p.team === "B").length;

    await db
      .update(millionTeamSessionsTable)
      .set({
        winner,
        teamAPoints: session.points.A,
        teamBPoints: session.points.B,
        teamAPrize: PRIZE_LADDER[Math.max(0, session.prizeLevels.A)] ?? 0,
        teamBPrize: PRIZE_LADDER[Math.max(0, session.prizeLevels.B)] ?? 0,
        teamAPlayers,
        teamBPlayers,
        finishedAt: new Date(),
      })
      .where(eq(millionTeamSessionsTable.pin, session.pin));
  } catch (err) {
    logger.error(err, "persistGameResult error");
  }
}

function findSessionByHost(socketId: string): TeamSession | undefined {
  for (const s of sessions.values()) {
    if (s.hostSocketId === socketId) return s;
  }
  return undefined;
}

export function setupMillionTeamSocket(io: Server) {
  io.on("connection", (socket: Socket) => {

    socket.on("million-team:create", (
      data: { questions: TeamQuestion[]; teamNames?: { A: string; B: string } },
      cb?: (res: { pin?: string; hostToken?: string; error?: string }) => void
    ) => {
      try {
        if (!Array.isArray(data.questions) || data.questions.length < 5) {
          cb?.({ error: "لا يوجد أسئلة كافية" });
          return;
        }

        const pin = generatePin();
        const hostToken = generateToken();

        const session: TeamSession = {
          pin,
          hostSocketId: socket.id,
          hostToken,
          questions: data.questions.slice(0, 40),
          currentIndex: 0,
          status: "waiting",
          teamNames: {
            A: data.teamNames?.A?.trim() || "الفريق أ",
            B: data.teamNames?.B?.trim() || "الفريق ب",
          },
          timerInterval: null,
          timerSeconds: QUESTION_SECONDS,
          paused: false,
          votes: { A: new Map(), B: new Map() },
          prizeLevels: { A: -1, B: -1 },
          points: { A: 0, B: 0 },
          players: new Map(),
          eliminatedOptions: { A: [], B: [] },
          frozenTeam: null,
          pendingFreezeTeam: null,
          lifelinesUsed: {
            A: { fifty: false, swap: false, freeze: false, takePrize: false, callFriend: false },
            B: { fifty: false, swap: false, freeze: false, takePrize: false, callFriend: false },
          },
          majority: { A: { option: null, reachedAtSec: null }, B: { option: null, reachedAtSec: null } },
          questionElapsedSec: 0,
          lastRevealData: null,
          lifelineVote: null,
        };

        sessions.set(pin, session);
        socket.join(`million-team:${pin}`);
        logger.info({ pin }, "Million team game created");

        db.insert(millionTeamSessionsTable)
          .values({ pin, totalQuestions: session.questions.length })
          .catch(err => logger.error(err, "Failed to insert team session record"));

        cb?.({ pin, hostToken });

        setTimeout(() => {
          if (sessions.get(pin)?.status === "waiting") cleanupSession(pin);
        }, 60 * 60 * 1000);
      } catch (err) {
        logger.error(err, "million-team:create error");
        cb?.({ error: "فشل إنشاء الغرفة" });
      }
    });

    socket.on("million-team:rejoin-host", (
      data: { pin: string; hostToken: string },
      cb?: (res: { success?: boolean; error?: string }) => void
    ) => {
      const session = sessions.get(data.pin);
      if (!session) { cb?.({ error: "الغرفة غير موجودة" }); return; }
      if (data.hostToken !== session.hostToken) { cb?.({ error: "رمز غير صحيح" }); return; }

      session.hostSocketId = socket.id;
      socket.join(`million-team:${data.pin}`);

      socket.emit("million-team:state-sync", {
        players: getPlayerList(session),
        status: session.status,
        currentIndex: session.currentIndex,
        prizeLevels: session.prizeLevels,
        points: session.points,
        lifelinesUsed: session.lifelinesUsed,
        teamNames: session.teamNames,
        question: session.status !== "waiting" ? (() => {
          const q = session.questions[session.currentIndex];
          return q ? { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, imageUrl: q.imageUrl } : null;
        })() : null,
        totalQuestions: session.questions.length,
        timerSeconds: session.timerSeconds,
        paused: session.paused,
        eliminatedOptions: session.eliminatedOptions,
        frozenTeam: session.frozenTeam,
        lastRevealData: session.lastRevealData,
      });
      cb?.({ success: true });
    });

    socket.on("million-team:check-pin", (
      data: { pin: string },
      cb?: (res: { valid: boolean; error?: string }) => void
    ) => {
      const session = sessions.get(data.pin);
      if (!session) { cb?.({ valid: false, error: "الغرفة غير موجودة" }); return; }
      if (session.status === "finished") { cb?.({ valid: false, error: "انتهت اللعبة" }); return; }
      cb?.({ valid: true });
    });

    socket.on("million-team:join", (
      data: { pin: string; name: string; team: TeamId },
      cb?: (res: { success?: boolean; error?: string; rejoinToken?: string; teamNames?: { A: string; B: string } }) => void
    ) => {
      const session = sessions.get(data.pin);
      if (!session) { cb?.({ error: "الغرفة غير موجودة" }); return; }
      if (session.status === "finished") { cb?.({ error: "انتهت اللعبة" }); return; }
      if (!data.name?.trim()) { cb?.({ error: "أدخل اسمك" }); return; }
      if (data.team !== "A" && data.team !== "B") { cb?.({ error: "اختر الفريق" }); return; }

      const trimmedName = data.name.trim().slice(0, 40);

      const existing = Array.from(session.players.values()).find(
        p => p.name === trimmedName && p.team === data.team && !p.connected
      );

      let rejoinToken: string;
      if (existing) {
        const oldSocketId = existing.socketId;
        session.players.delete(oldSocketId);
        existing.socketId = socket.id;
        existing.connected = true;
        rejoinToken = existing.rejoinToken;
        session.players.set(socket.id, existing);
      } else {
        rejoinToken = generateToken();
        session.players.set(socket.id, {
          name: trimmedName,
          team: data.team,
          socketId: socket.id,
          rejoinToken,
          connected: true,
          correctCount: 0,
          wrongCount: 0,
          playerLifelinesUsed: { fifty: false, swap: false, callFriend: false, freeze: false },
          pendingFrozen: false,
          frozenThisRound: false,
        });
      }

      socket.join(`million-team:${data.pin}`);
      cb?.({ success: true, rejoinToken, teamNames: session.teamNames });

      io.to(`million-team:${data.pin}`).emit("million-team:players-updated", {
        players: getPlayerList(session),
      });

      if (session.status !== "waiting") {
        const q = session.questions[session.currentIndex];
        if (q) {
          socket.emit("million-team:next-question", {
            question: { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, imageUrl: q.imageUrl },
            questionIndex: session.currentIndex,
            totalQuestions: session.questions.length,
            prizeLevels: session.prizeLevels,
            points: session.points,
            lifelinesUsed: session.lifelinesUsed,
            teamNames: session.teamNames,
          });
          socket.emit("million-team:timer", { seconds: session.timerSeconds, paused: session.paused });
        }
      }
    });

    socket.on("million-team:player-rejoin", (
      data: { pin: string; rejoinToken: string },
      cb?: (res: { success?: boolean; error?: string; name?: string; team?: TeamId; teamNames?: { A: string; B: string } }) => void
    ) => {
      const session = sessions.get(data.pin);
      if (!session) { cb?.({ error: "الغرفة غير موجودة" }); return; }

      const player = Array.from(session.players.values()).find(p => p.rejoinToken === data.rejoinToken);
      if (!player) { cb?.({ error: "رمز إعادة الانضمام غير صحيح" }); return; }

      const oldSocketId = player.socketId;
      session.players.delete(oldSocketId);
      player.socketId = socket.id;
      player.connected = true;
      session.players.set(socket.id, player);
      socket.join(`million-team:${data.pin}`);

      io.to(`million-team:${data.pin}`).emit("million-team:players-updated", {
        players: getPlayerList(session),
      });

      const q = session.status !== "waiting" ? session.questions[session.currentIndex] : null;
      socket.emit("million-team:state-sync", {
        status: session.status,
        question: q ? { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, imageUrl: q.imageUrl } : null,
        questionIndex: session.currentIndex,
        totalQuestions: session.questions.length,
        prizeLevels: session.prizeLevels,
        points: session.points,
        lifelinesUsed: session.lifelinesUsed,
        teamNames: session.teamNames,
        timerSeconds: session.timerSeconds,
        paused: session.paused,
        eliminatedOptions: session.eliminatedOptions,
        frozenTeam: session.frozenTeam,
        lastRevealData: session.status === "revealing" ? session.lastRevealData : null,
        myPlayerLifelinesUsed: player.playerLifelinesUsed,
        myFrozenThisRound: player.frozenThisRound,
      });

      cb?.({ success: true, name: player.name, team: player.team, teamNames: session.teamNames });
    });

    socket.on("million-team:reassign-player", (
      data: { playerName: string; toTeam: TeamId },
      cb?: (res: { success?: boolean; error?: string }) => void
    ) => {
      const session = findSessionByHost(socket.id);
      if (!session) { cb?.({ error: "الغرفة غير موجودة" }); return; }
      if (session.status !== "waiting") { cb?.({ error: "لا يمكن نقل اللاعب أثناء اللعب" }); return; }
      if (data.toTeam !== "A" && data.toTeam !== "B") { cb?.({ error: "فريق غير صحيح" }); return; }

      const player = Array.from(session.players.values()).find(p => p.name === data.playerName);
      if (!player) { cb?.({ error: "اللاعب غير موجود" }); return; }

      player.team = data.toTeam;
      io.to(`million-team:${session.pin}`).emit("million-team:players-updated", {
        players: getPlayerList(session),
      });
      cb?.({ success: true });
    });

    socket.on("million-team:rename-teams", (data: { teamNames: { A: string; B: string } }) => {
      const session = findSessionByHost(socket.id);
      if (!session) return;
      const newA = data.teamNames?.A?.trim().slice(0, 20);
      const newB = data.teamNames?.B?.trim().slice(0, 20);
      if (!newA || !newB) return;
      session.teamNames = { A: newA, B: newB };
      io.to(`million-team:${session.pin}`).emit("million-team:teams-renamed", { teamNames: session.teamNames });
    });

    socket.on("million-team:start", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "waiting") return;
      session.currentIndex = 0;
      broadcastQuestion(io, session);
    });

    socket.on("million-team:vote", (data: { pin: string; option: OptionKey }) => {
      const session = sessions.get(data.pin);
      if (!session || session.status !== "playing") return;

      const player = session.players.get(socket.id);
      if (!player || !player.connected) return;

      if (session.frozenTeam === player.team || player.frozenThisRound) return;

      const teamVotes = session.votes[player.team];
      if (teamVotes.has(socket.id)) return;
      if (!["A", "B", "C", "D"].includes(data.option)) return;

      teamVotes.set(socket.id, data.option);

      const teamConnected = getConnectedTeamPlayers(session, player.team);
      const maj = getMajorityVote(teamVotes, teamConnected);
      const track = session.majority[player.team];
      if (maj && !track.option) {
        session.majority[player.team] = { option: maj, reachedAtSec: session.questionElapsedSec };
      }

      io.to(`million-team:${session.pin}`).emit("million-team:vote-update", buildVoteUpdate(session));

      const teamAConnected = getConnectedTeamPlayers(session, "A");
      const teamBConnected = getConnectedTeamPlayers(session, "B");

      const effectiveAConnected = session.frozenTeam === "A" ? [] : teamAConnected.filter(p => !p.frozenThisRound);
      const effectiveBConnected = session.frozenTeam === "B" ? [] : teamBConnected.filter(p => !p.frozenThisRound);

      const allVotedA = session.frozenTeam === "A" || allConnectedVoted(session.votes.A, effectiveAConnected);
      const allVotedB = session.frozenTeam === "B" || allConnectedVoted(session.votes.B, effectiveBConnected);
      if (allVotedA && allVotedB) {
        revealQuestion(io, session);
      }
    });

    socket.on("million-team:reveal", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      revealQuestion(io, session);
    });

    socket.on("million-team:next", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "revealing") return;

      const nextIndex = session.currentIndex + 1;
      if (nextIndex >= session.questions.length) {
        session.status = "finished";
        stopTimer(session);

        const winner = session.points.A > session.points.B ? "A"
          : session.points.B > session.points.A ? "B" : "draw";

        const lastQ = session.questions[session.currentIndex];
        const lastCorrectAnswer = lastQ ? lastQ.correctAnswer.trim().toUpperCase() : null;

        io.to(`million-team:${session.pin}`).emit("million-team:game-over", {
          winner,
          teamNames: session.teamNames,
          teamA: { points: session.points.A, prizeLevel: session.prizeLevels.A, prize: PRIZE_LADDER[Math.max(0, session.prizeLevels.A)] ?? 0 },
          teamB: { points: session.points.B, prizeLevel: session.prizeLevels.B, prize: PRIZE_LADDER[Math.max(0, session.prizeLevels.B)] ?? 0 },
          players: getPlayerList(session),
          lastCorrectAnswer,
        });

        void persistGameResult(session, winner);
        setTimeout(() => cleanupSession(session.pin), 30 * 60 * 1000);
      } else {
        session.currentIndex = nextIndex;
        broadcastQuestion(io, session);
      }
    });

    socket.on("million-team:pause", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      session.paused = true;
      io.to(`million-team:${session.pin}`).emit("million-team:timer", { seconds: session.timerSeconds, paused: true });
    });

    socket.on("million-team:resume", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      session.paused = false;
      io.to(`million-team:${session.pin}`).emit("million-team:timer", { seconds: session.timerSeconds, paused: false });
    });

    socket.on("million-team:extend", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      session.timerSeconds = Math.min(session.timerSeconds + 15, 60);
      io.to(`million-team:${session.pin}`).emit("million-team:timer", { seconds: session.timerSeconds, paused: session.paused });
    });

    socket.on("million-team:lifeline-fifty", (data: { team: TeamId }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      if (session.lifelinesUsed[data.team].fifty) return;

      session.lifelinesUsed[data.team].fifty = true;

      const q = session.questions[session.currentIndex];
      if (!q) return;

      const correctKey = q.correctAnswer.trim().toUpperCase() as OptionKey;
      const teamElim = session.eliminatedOptions[data.team];
      const wrongOptions = (["A", "B", "C", "D"] as OptionKey[]).filter(
        o => o !== correctKey && !teamElim.includes(o)
      );
      const toEliminate = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2);
      session.eliminatedOptions[data.team] = [...teamElim, ...toEliminate];

      io.to(`million-team:${session.pin}`).emit("million-team:lifeline-fifty-applied", {
        team: data.team,
        eliminatedOptions: session.eliminatedOptions,
        lifelinesUsed: session.lifelinesUsed,
      });
    });

    socket.on("million-team:swap-question", (data: { team: TeamId; newQuestion: TeamQuestion }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      if (session.lifelinesUsed[data.team].swap) return;

      const q = data.newQuestion;
      if (!q || !q.id || !q.text) return;

      session.lifelinesUsed[data.team].swap = true;
      session.questions[session.currentIndex] = q;
      session.votes = { A: new Map(), B: new Map() };
      session.eliminatedOptions = { A: [], B: [] };
      session.frozenTeam = null;
      session.majority = { A: { option: null, reachedAtSec: null }, B: { option: null, reachedAtSec: null } };
      session.timerSeconds = QUESTION_SECONDS;
      session.questionElapsedSec = 0;

      io.to(`million-team:${session.pin}`).emit("million-team:question-swapped", {
        team: data.team,
        question: { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, imageUrl: q.imageUrl },
        eliminatedOptions: { A: [], B: [] },
        lifelinesUsed: session.lifelinesUsed,
      });

      io.to(`million-team:${session.pin}`).emit("million-team:timer", { seconds: QUESTION_SECONDS, paused: session.paused });
    });

    function applyFreezeLifeline(session: TeamSession, usingTeam: TeamId) {
      const targetTeam: TeamId = usingTeam === "A" ? "B" : "A";
      if (session.lifelinesUsed[usingTeam].freeze) return;
      if (session.pendingFreezeTeam !== null) return;

      session.lifelinesUsed[usingTeam].freeze = true;
      session.pendingFreezeTeam = targetTeam;

      io.to(`million-team:${session.pin}`).emit("million-team:lifeline-freeze-applied", {
        pendingFreezeTeam: targetTeam,
        lifelinesUsed: session.lifelinesUsed,
      });
    }

    socket.on("million-team:lifeline-freeze", (data: { team: TeamId }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      applyFreezeLifeline(session, data.team);
    });

    socket.on("million-team:use-freeze", (data: { team: TeamId }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      applyFreezeLifeline(session, data.team);
    });

    function applyTakePrize(session: TeamSession, team: TeamId) {
      if (session.lifelinesUsed[team].takePrize) return;
      const ownLevel = session.prizeLevels[team];
      if (ownLevel <= 0) return;
      const prevLevel = ownLevel - 1;
      const prevPrize = PRIZE_LADDER[prevLevel] ?? 0;
      session.lifelinesUsed[team].takePrize = true;
      session.points[team] += prevPrize;
      io.to(`million-team:${session.pin}`).emit("million-team:lifeline-take-prize-applied", {
        team,
        claimedPrize: prevPrize,
        lifelinesUsed: session.lifelinesUsed,
        points: session.points,
      });
    }

    socket.on("million-team:lifeline-take-prize", (data: { team: TeamId }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      applyTakePrize(session, data.team);
    });

    socket.on("million-team:take-prev-prize", (data: { team: TeamId }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      applyTakePrize(session, data.team);
    });

    socket.on("million-team:end-game", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status === "finished") return;
      session.status = "finished";
      stopTimer(session);

      const winner = session.points.A > session.points.B ? "A"
        : session.points.B > session.points.A ? "B" : "draw";

      const lastQ = session.questions[session.currentIndex];
      const lastCorrectAnswer = lastQ ? lastQ.correctAnswer.trim().toUpperCase() : null;

      io.to(`million-team:${session.pin}`).emit("million-team:game-over", {
        winner,
        teamNames: session.teamNames,
        teamA: { points: session.points.A, prizeLevel: session.prizeLevels.A, prize: PRIZE_LADDER[Math.max(0, session.prizeLevels.A)] ?? 0 },
        teamB: { points: session.points.B, prizeLevel: session.prizeLevels.B, prize: PRIZE_LADDER[Math.max(0, session.prizeLevels.B)] ?? 0 },
        players: getPlayerList(session),
        lastCorrectAnswer,
      });

      void persistGameResult(session, winner);
      setTimeout(() => cleanupSession(session.pin), 30 * 60 * 1000);
    });

    function resolveLifelineVote(session: TeamSession, team: TeamId) {
      if (!session.lifelineVote || session.lifelineVote.team !== team) return;
      if (session.lifelineVote.timeout) clearTimeout(session.lifelineVote.timeout);

      const voteMap = session.lifelineVote.votes;
      const counts: Record<string, number> = {};
      for (const v of voteMap.values()) {
        counts[v as string] = (counts[v as string] ?? 0) + 1;
      }
      const fallback = session.lifelineVote.availableLifelines[0] ?? "fifty";
      const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
      session.lifelineVote = null;

      io.to(`million-team:${session.pin}`).emit("million-team:lifeline-vote-result", { team, winner, counts });

      if (winner === "fifty" && !session.lifelinesUsed[team].fifty) {
        session.lifelinesUsed[team].fifty = true;
        const q = session.questions[session.currentIndex];
        if (q) {
          const correctKey = q.correctAnswer.trim().toUpperCase() as OptionKey;
          const teamElim = session.eliminatedOptions[team];
          const wrongOptions = (["A", "B", "C", "D"] as OptionKey[]).filter(o => o !== correctKey && !teamElim.includes(o));
          const toEliminate = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2);
          session.eliminatedOptions[team] = [...teamElim, ...toEliminate];
          io.to(`million-team:${session.pin}`).emit("million-team:lifeline-fifty-applied", {
            team, eliminatedOptions: session.eliminatedOptions, lifelinesUsed: session.lifelinesUsed,
          });
        }
      } else if (winner === "freeze" && !session.lifelinesUsed[team].freeze && !session.pendingFreezeTeam && !session.frozenTeam) {
        applyFreezeLifeline(session, team);
      } else if (winner === "takePrize" && !session.lifelinesUsed[team].takePrize) {
        applyTakePrize(session, team);
      } else if (winner === "swap" || winner === "callFriend") {
        io.to(session.hostSocketId).emit("million-team:lifeline-apply-needed", { team, lifeline: winner });
      }
    }

    socket.on("million-team:lifeline-vote-start", (data: { team: TeamId; availableLifelines: string[] }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      if (session.lifelineVote) return;

      const used = session.lifelinesUsed[data.team];
      const ownLevel = session.prizeLevels[data.team];
      const actuallyAvailable = (["fifty", "swap", "freeze", "callFriend", "takePrize"] as (keyof TeamLifelines)[]).filter(k => {
        if (used[k]) return false;
        if (k === "takePrize" && ownLevel === 0) return false;
        if (k === "freeze" && (session.frozenTeam !== null || session.pendingFreezeTeam !== null)) return false;
        return true;
      });
      const validatedLifelines = (data.availableLifelines ?? []).filter(l => actuallyAvailable.includes(l as keyof TeamLifelines));
      if (validatedLifelines.length === 0) return;

      session.lifelineVote = {
        team: data.team,
        votes: new Map(),
        availableLifelines: validatedLifelines,
        timeout: setTimeout(() => {
          resolveLifelineVote(session, data.team);
        }, 5_000),
      };

      io.to(`million-team:${session.pin}`).emit("million-team:lifeline-vote-started", {
        team: data.team,
        availableLifelines: validatedLifelines,
      });
    });

    socket.on("million-team:lifeline-vote-cast", (data: { pin: string; lifeline: string }) => {
      const session = sessions.get(data.pin);
      if (!session || !session.lifelineVote) return;

      const player = session.players.get(socket.id);
      if (!player || !player.connected) return;
      if (player.team !== session.lifelineVote.team) return;
      if (session.lifelineVote.votes.has(socket.id)) return;
      if (!session.lifelineVote.availableLifelines.includes(data.lifeline)) return;

      session.lifelineVote.votes.set(socket.id, data.lifeline as keyof TeamLifelines);

      const teamPlayers = getConnectedTeamPlayers(session, session.lifelineVote.team);
      if (teamPlayers.every(p => session.lifelineVote!.votes.has(p.socketId))) {
        resolveLifelineVote(session, session.lifelineVote.team);
      }
    });

    socket.on("million-team:call-friend-result", (data: { team: TeamId; hint: string }) => {
      const session = findSessionByHost(socket.id);
      if (!session || session.status !== "playing") return;
      if (data.team !== "A" && data.team !== "B") return;
      if (session.lifelinesUsed[data.team].callFriend) return;

      session.lifelinesUsed[data.team].callFriend = true;

      io.to(`million-team:${session.pin}`).emit("million-team:call-friend-hint", {
        team: data.team,
        hint: data.hint,
      });
    });

    socket.on("million-team:player-lifeline", (
      data: { type: "fifty" | "swap" | "callFriend" | "freeze"; targetPlayerName?: string },
      cb?: (res: { success?: boolean; error?: string }) => void
    ) => {
      let session: TeamSession | undefined;
      for (const s of sessions.values()) {
        if (s.players.has(socket.id)) { session = s; break; }
      }
      if (!session || session.status !== "playing") { cb?.({ error: "اللعبة غير نشطة" }); return; }

      const player = session.players.get(socket.id);
      if (!player || !player.connected) { cb?.({ error: "اللاعب غير موجود" }); return; }

      const VALID_TYPES = ["fifty", "swap", "callFriend", "freeze"] as const;
      if (!VALID_TYPES.includes(data.type as typeof VALID_TYPES[number])) { cb?.({ error: "نوع غير صالح" }); return; }

      if (player.playerLifelinesUsed[data.type]) { cb?.({ error: "استُخدمت هذه الوسيلة مسبقاً" }); return; }
      if (player.frozenThisRound) { cb?.({ error: "أنت مجمَّد هذه الجولة" }); return; }

      const q = session.questions[session.currentIndex];

      if (data.type === "fifty") {
        if (!q) { cb?.({ error: "لا يوجد سؤال" }); return; }
        player.playerLifelinesUsed[data.type] = true;
        const correctKey = q.correctAnswer.trim().toUpperCase() as OptionKey;
        const wrongOptions = (["A", "B", "C", "D"] as OptionKey[]).filter(o => o !== correctKey);
        const toElim = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2);
        socket.emit("million-team:player-fifty-applied", { eliminatedOptions: toElim });
        cb?.({ success: true });
      } else if (data.type === "swap") {
        player.playerLifelinesUsed[data.type] = true;
        io.to(session.hostSocketId).emit("million-team:lifeline-apply-needed", { team: player.team, lifeline: "swap" });
        cb?.({ success: true });
      } else if (data.type === "callFriend") {
        if (!q) { cb?.({ error: "لا يوجد سؤال" }); return; }
        player.playerLifelinesUsed[data.type] = true;
        cb?.({ success: true });
        if (!openai) {
          socket.emit("million-team:player-call-friend-hint", { hint: "خدمة التلميح غير متاحة حالياً." });
          return;
        }
        const prompt = `أنت مساعد تعليمي. لديك هذا السؤال وخياراته:\n\nالسؤال: ${q.text.slice(0, 300)}\nأ) ${(q.optionA || "").slice(0, 100)}\nب) ${(q.optionB || "").slice(0, 100)}\nج) ${(q.optionC || "").slice(0, 100)}\nد) ${(q.optionD || "").slice(0, 100)}\n\nقدّم تلميحاً مفيداً يساعد الطالب على التفكير في الاتجاه الصحيح، دون الكشف عن الإجابة مباشرة. التلميح يجب أن يكون جملة أو جملتين بالعربية.`;
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
          temperature: 0.7,
        }).then(completion => {
          const hint = completion.choices[0]?.message?.content?.trim() ?? "لا يتوفر تلميح الآن.";
          socket.emit("million-team:player-call-friend-hint", { hint });
        }).catch(() => {
          socket.emit("million-team:player-call-friend-hint", { hint: "لا يتوفر تلميح الآن." });
        });
      } else if (data.type === "freeze") {
        if (!data.targetPlayerName) { cb?.({ error: "حدد اللاعب المستهدف" }); return; }
        const targetPlayer = Array.from(session.players.values()).find(
          p => p.name === data.targetPlayerName && p.team !== player.team && p.connected && !p.frozenThisRound && !p.pendingFrozen
        );
        if (!targetPlayer) { cb?.({ error: "اللاعب غير متاح" }); return; }
        player.playerLifelinesUsed[data.type] = true;
        targetPlayer.pendingFrozen = true;
        socket.emit("million-team:player-freeze-confirmed", { targetName: data.targetPlayerName });
        cb?.({ success: true });
      }
    });

    socket.on("disconnect", () => {
      for (const session of sessions.values()) {
        const player = session.players.get(socket.id);
        if (player) {
          player.connected = false;
          io.to(`million-team:${session.pin}`).emit("million-team:players-updated", {
            players: getPlayerList(session),
          });
          if (session.status === "playing") {
            const teamAConnected = getConnectedTeamPlayers(session, "A");
            const teamBConnected = getConnectedTeamPlayers(session, "B");
            const effectiveA = session.frozenTeam === "A" ? [] : teamAConnected.filter(p => !p.frozenThisRound);
            const effectiveB = session.frozenTeam === "B" ? [] : teamBConnected.filter(p => !p.frozenThisRound);
            const allVotedA = session.frozenTeam === "A" || allConnectedVoted(session.votes.A, effectiveA);
            const allVotedB = session.frozenTeam === "B" || allConnectedVoted(session.votes.B, effectiveB);
            if (allVotedA && allVotedB) {
              revealQuestion(io, session);
            }
          }
        }
        if (session.hostSocketId === socket.id && session.status === "waiting") {
          setTimeout(() => {
            const s = sessions.get(session.pin);
            if (s && s.hostSocketId === socket.id && s.status === "waiting") {
              cleanupSession(session.pin);
            }
          }, 5 * 60 * 1000);
        }
      }
    });
  });
}
