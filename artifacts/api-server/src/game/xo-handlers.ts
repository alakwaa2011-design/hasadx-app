import { randomBytes } from "crypto";
import { Server } from "socket.io";
import { logger } from "../lib/logger";
import {
  answerXoQuestion, clientQuestion, createXoState, type XoQuestion, type XoState, type XoTeam,
  placeXoMark, shuffleXoQuestion, timeoutXoQuestion, validateXoQuestions,
} from "./xo-engine";

interface XoPlayer { id: string; socketId: string; name: string; avatar: string; team: XoTeam; rejoinToken: string; }
interface XoGame {
  pin: string; teacherId: number; hostSocketId: string; questions: XoQuestion[]; state: XoState;
  /** Public direct-play rooms are controlled by this capability, not a
   * teacher session. It is never included in socket state. */
  publicHostControlToken?: string;
  players: Record<string, XoPlayer>; started: boolean; timer?: ReturnType<typeof setTimeout>;
  questionStartedAt?: number; placementStartedAt?: number;
  activeQuestion: XoQuestion; lastCorrectSlot: number;
  teamNames: Record<XoTeam, string>;
}
const games = new Map<string, XoGame>();
const room = (pin: string) => `xo:${pin}`;
const makePin = () => { let pin: string; do pin = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(pin)); return pin; };
function shuffledQuestions(questions: XoQuestion[]): XoQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((question, index) => question === questions[index])) {
    shuffled.push(shuffled.shift()!);
  }
  return shuffled;
}
const players = (game: XoGame) => Object.values(game.players).map(({ id, name, avatar, team }) => ({ id, name, avatar, team }));
const publicState = (game: XoGame) => ({
  ...game.state,
  board: [...game.state.board],
  started: game.started,
  timerRemainingSecs: game.state.phase === "question"
    ? Math.max(0, Math.ceil((game.activeQuestion.duration * 1000 - (Date.now() - (game.questionStartedAt ?? Date.now()))) / 1000))
    : game.state.phase === "placement"
      ? Math.max(0, Math.ceil((20_000 - (Date.now() - (game.placementStartedAt ?? Date.now()))) / 1000))
      : 0,
  question: game.started && game.state.phase === "question" ? {
    ...clientQuestion(game.activeQuestion),
    remainingSecs: Math.max(0, Math.ceil((game.activeQuestion.duration * 1000 - (Date.now() - (game.questionStartedAt ?? Date.now()))) / 1000)),
  } : null,
  players: players(game),
  teamNames: game.teamNames,
});
function socketControlToken(socket: { request: unknown }, suppliedToken?: unknown): string | undefined {
  if (typeof suppliedToken === "string" && suppliedToken.length > 0) return suppliedToken;
  const request = socket.request as any;
  const handshake = request?.handshake;
  const authToken = handshake?.auth?.controlToken;
  if (typeof authToken === "string") return authToken;
  const queryToken = handshake?.query?.controlToken;
  return typeof queryToken === "string" ? queryToken : undefined;
}

const isHost = (
  socket: { id: string; request: unknown },
  game: XoGame,
  suppliedToken?: unknown,
) => {
  const teacherId = (socket.request as any).session?.teacherId;
  if (game.publicHostControlToken && socketControlToken(socket, suppliedToken) === game.publicHostControlToken) {
    return true;
  }
  return game.hostSocketId === socket.id && teacherId === game.teacherId;
};

function clearTimer(game: XoGame) { if (game.timer) clearTimeout(game.timer); game.timer = undefined; }
function emitState(ns: ReturnType<Server["of"]>, game: XoGame) { ns.to(room(game.pin)).emit("xo:state", publicState(game)); }
function scheduleQuestion(ns: ReturnType<Server["of"]>, game: XoGame) {
  clearTimer(game);
  if (game.state.phase !== "question") return;
  game.questionStartedAt = Date.now();
  game.timer = setTimeout(() => {
    if (game.state.phase !== "question") return;
    const result = timeoutXoQuestion(game.state, game.questions.length);
    if (!result.ok) return;
    game.state = result.state;
    ns.to(room(game.pin)).emit("xo:answer-result", { correct: false, timeout: true, turn: game.state.turn });
    setState(ns, game);
  }, game.activeQuestion.duration * 1000);
}
function schedulePlacement(ns: ReturnType<Server["of"]>, game: XoGame) {
  clearTimer(game);
  if (game.state.phase !== "placement") return;
  game.placementStartedAt = Date.now();
  game.timer = setTimeout(() => {
    if (game.state.phase !== "placement") return;
    game.state = {
      ...game.state,
      turn: game.state.turn === "x" ? "o" : "x",
      phase: "question",
      placementPlayerId: null,
      questionIndex: (game.state.questionIndex + 1) % game.questions.length,
    };
    ns.to(room(game.pin)).emit("xo:answer-result", { correct: false, placementTimeout: true, turn: game.state.turn });
    setState(ns, game);
  }, 20_000);
}
function setState(ns: ReturnType<Server["of"]>, game: XoGame) {
  clearTimer(game);
  if (game.state.phase === "question") {
    const sourceQuestion = game.questions[game.state.questionIndex];
    const nextCorrectSlot = sourceQuestion.type === "true_false"
      ? sourceQuestion.correct
      : (game.lastCorrectSlot + 1) % sourceQuestion.options.length;
    game.activeQuestion = shuffleXoQuestion(sourceQuestion, nextCorrectSlot);
    if (sourceQuestion.type !== "true_false") game.lastCorrectSlot = game.activeQuestion.correct;
    game.questionStartedAt = Date.now();
    game.placementStartedAt = undefined;
  } else if (game.state.phase === "placement") {
    game.questionStartedAt = undefined;
    game.placementStartedAt = Date.now();
  } else {
    game.questionStartedAt = undefined;
    game.placementStartedAt = undefined;
  }
  emitState(ns, game);
  if (game.state.phase === "question") scheduleQuestion(ns, game);
  else if (game.state.phase === "placement") schedulePlacement(ns, game);
}

export interface XoRestSetup {
  questions: unknown;
  duration?: unknown;
  teamX?: unknown;
  teamO?: unknown;
  title?: unknown;
}

export interface XoRestRoom {
  pin: string;
  controlToken: string;
  state: ReturnType<typeof publicState>;
}

function savedQuestions(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { questions?: unknown }).questions)) {
    return (value as { questions: unknown[] }).questions;
  }
  return [];
}

function safeTeamName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 40)
    : fallback;
}

/**
 * Normalize a saved XO activity before exposing it to a public route or
 * creating a room. Unknown settings and question fields are deliberately
 * dropped; the answer index is retained because XO class mode runs its
 * answer checking in the browser.
 */
export function sanitizeXoSetup(content: unknown, settings: unknown): {
  questions: XoQuestion[];
  duration: number;
  teamX: string;
  teamO: string;
} | null {
  const config = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};
  const requestedDuration = typeof config.duration === "number" ? config.duration : 20;
  const duration = [10, 15, 20, 30, 45].includes(requestedDuration)
    ? requestedDuration
    : 20;
  const questions = validateXoQuestions(savedQuestions(content), duration);
  if (!questions || questions.length < 2) return null;
  return {
    questions,
    duration,
    teamX: safeTeamName(config.teamX, "X"),
    teamO: safeTeamName(config.teamO, "O"),
  };
}

/**
 * Create a public XO room without a teacher session. The returned token is a
 * capability for the caller that created the room and is accepted by host
 * control events; it is never broadcast in public state.
 */
export function createXoGameFromRest(setup: XoRestSetup): XoRestRoom {
  const questions = validateXoQuestions(savedQuestions(setup.questions), typeof setup.duration === "number" ? setup.duration : 20);
  if (!questions || questions.length < 2) {
    throw new Error("XO requires at least two supported questions");
  }
  const duration = typeof setup.duration === "number" && Number.isFinite(setup.duration)
    ? Math.max(5, Math.min(120, Math.floor(setup.duration)))
    : 20;
  const pin = makePin();
  const controlToken = randomBytes(32).toString("hex");
  const game: XoGame = {
    pin,
    // Anonymous rooms have no teacher identity. Keep the numeric field for
    // compatibility with existing game state and teacher-only reclaim checks.
    teacherId: 0,
    hostSocketId: "",
    publicHostControlToken: controlToken,
    questions: shuffledQuestions(questions),
    state: createXoState(),
    players: {},
    started: false,
    activeQuestion: questions[0],
    lastCorrectSlot: -1,
    teamNames: {
      x: safeTeamName(setup.teamX, "X"),
      o: safeTeamName(setup.teamO, "O"),
    },
  };
  games.set(pin, game);
  setTimeout(() => {
    const current = games.get(pin);
    if (current === game) {
      clearTimer(game);
      games.delete(pin);
    }
  }, 3 * 60 * 60 * 1000).unref?.();
  return { pin, controlToken, state: publicState(game) };
}

// Alias kept intentionally small and descriptive for REST callers.
export const createXoRoomFromRest = createXoGameFromRest;

export function setupXoSocket(io: Server) {
  const ns = io.of("/xo");
  ns.on("connection", (socket) => {
    socket.on("xo:create", (data: { questions: unknown; duration?: number; teamX?: string; teamO?: string }, cb: (result: object) => void = () => {}) => {
      const teacherId = (socket.request as any).session?.teacherId as number | undefined;
      if (!teacherId) return cb({ error: "يجب تسجيل دخول المعلم لإنشاء لعبة." });
      const validatedQuestions = validateXoQuestions(data?.questions, data?.duration);
      if (!validatedQuestions) return cb({ error: "الأسئلة يجب أن تحتوي نصاً وخيارين إلى أربعة خيارات صالحة." });
      const questions = shuffledQuestions(validatedQuestions);
      const pin = makePin();
      const game: XoGame = {
        pin, teacherId, hostSocketId: socket.id, questions, state: createXoState(), players: {}, started: false,
        activeQuestion: questions[0], lastCorrectSlot: -1,
        teamNames: {
          x: typeof data.teamX === "string" && data.teamX.trim() ? data.teamX.trim().slice(0, 40) : "X",
          o: typeof data.teamO === "string" && data.teamO.trim() ? data.teamO.trim().slice(0, 40) : "O",
        },
      };
      games.set(pin, game); socket.join(room(pin));
      setTimeout(() => { const current = games.get(pin); if (current === game) { clearTimer(game); games.delete(pin); } }, 3 * 60 * 60 * 1000).unref();
      cb({ success: true, pin, state: publicState(game) });
    });

    socket.on("xo:reclaim-host", (data: { pin: string; controlToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      const teacherId = (socket.request as any).session?.teacherId as number | undefined;
      const publicHost = !!game?.publicHostControlToken
        && socketControlToken(socket, data?.controlToken) === game.publicHostControlToken;
      if (!game || (!publicHost && (!teacherId || teacherId !== game.teacherId))) {
        return cb({ error: "تعذر استعادة غرفة المعلم." });
      }
      game.hostSocketId = socket.id;
      socket.join(room(game.pin));
      cb({ success: true, ...publicState(game) });
    });

    socket.on("xo:join", (data: { pin: string; name?: string; avatar?: string; playerId?: string; rejoinToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game) return cb({ error: "لم يتم العثور على الغرفة." });
      let player: XoPlayer | undefined;
      if (data.playerId && data.rejoinToken) {
        const existing = game.players[data.playerId];
        if (existing && existing.rejoinToken === data.rejoinToken) {
          existing.socketId = socket.id; player = existing;
        }
      }
      if (!player) {
        const name = typeof data.name === "string" ? data.name.trim().slice(0, 80) : "";
        if (!name) return cb({ error: "يرجى إدخال اسمك." });
        const counts = players(game).reduce((total, p) => { total[p.team]++; return total; }, { x: 0, o: 0 });
        const team: XoTeam = counts.x <= counts.o ? "x" : "o";
        const id = randomBytes(12).toString("hex");
        player = { id, socketId: socket.id, name, avatar: typeof data.avatar === "string" ? data.avatar.slice(0, 32) : "🙂", team, rejoinToken: randomBytes(18).toString("hex") };
        game.players[id] = player;
      }
      socket.join(room(game.pin)); emitState(ns, game);
      cb({ success: true, pin: game.pin, player: { id: player.id, team: player.team, rejoinToken: player.rejoinToken }, state: publicState(game) });
    });

    socket.on("xo:start", (data: { pin: string; controlToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (!isHost(socket, game, data?.controlToken)) return cb({ error: "فقط المعلم المنشئ يمكنه البدء." });
      const joinedTeams = new Set(players(game).map((player) => player.team));
      if (!joinedTeams.has("x") || !joinedTeams.has("o")) return cb({ error: "يجب أن ينضم لاعب واحد على الأقل لكل فريق." });
      if (game.started || game.state.phase === "finished") return cb({ error: "بدأت اللعبة بالفعل." });
      game.started = true;
      setState(ns, game); cb({ success: true });
    });

    socket.on("xo:answer", (data: { pin: string; answerIndex: number; playerId?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin); const player = game && Object.values(game.players).find((p) => p.socketId === socket.id && (!data.playerId || p.id === data.playerId));
      if (!game || !player) return cb({ error: "أنت لست في هذه اللعبة." });
      if (!game.started) return cb({ error: "لم تبدأ اللعبة بعد." });
      const activeQuestions = [...game.questions];
      activeQuestions[game.state.questionIndex] = game.activeQuestion;
      const result = answerXoQuestion(game.state, activeQuestions, player.id, player.team, data.answerIndex);
      if (!result.ok) return cb({ error: result.error });
      game.state = result.state; ns.to(room(game.pin)).emit("xo:answer-result", { playerId: player.id, correct: result.correct, turn: game.state.turn });
      setState(ns, game); cb({ success: true, correct: result.correct });
    });

    socket.on("xo:place", (data: { pin: string; cell: number; playerId?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin); const player = game && Object.values(game.players).find((p) => p.socketId === socket.id && (!data.playerId || p.id === data.playerId));
      if (!game || !player) return cb({ error: "أنت لست في هذه اللعبة." });
      if (!game.started) return cb({ error: "لم تبدأ اللعبة بعد." });
      const result = placeXoMark(game.state, player.id, player.team, data.cell, game.questions.length);
      if (!result.ok) return cb({ error: result.error });
      game.state = result.state; ns.to(room(game.pin)).emit("xo:move", { playerId: player.id, cell: data.cell, team: player.team, winner: result.winner });
      setState(ns, game); cb({ success: true, winner: result.winner });
    });

    socket.on("xo:skip", (data: { pin: string; controlToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game, data?.controlToken)) return cb({ error: "فقط المعلم يمكنه التخطي." });
      if (!game.started) return cb({ error: "لم تبدأ اللعبة بعد." });
      if (game.state.phase === "placement") {
        game.state = { ...game.state, turn: game.state.turn === "x" ? "o" : "x", phase: "question", placementPlayerId: null, questionIndex: (game.state.questionIndex + 1) % game.questions.length };
      } else {
        const result = timeoutXoQuestion(game.state, game.questions.length);
        if (!result.ok) return cb({ error: result.error });
        game.state = result.state;
      }
      setState(ns, game); cb({ success: true });
    });
    const endGame = (data: { pin: string; controlToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game, data?.controlToken)) return cb({ error: "فقط المعلم يمكنه الإنهاء." });
      clearTimer(game); games.delete(game.pin); ns.to(room(game.pin)).emit("xo:ended"); cb({ success: true });
    };
    socket.on("xo:end", endGame);
    socket.on("xo:end-early", endGame);
    socket.on("xo:replay", (data: { pin: string; controlToken?: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game, data?.controlToken)) return cb({ error: "فقط المعلم يمكنه إعادة اللعب." });
      clearTimer(game); game.questions = shuffledQuestions(game.questions); game.state = createXoState(); game.questionStartedAt = undefined; game.placementStartedAt = undefined; game.started = true; setState(ns, game); cb({ success: true });
    });
    socket.on("disconnect", () => logger.debug({ socketId: socket.id }, "XO socket disconnected"));
  });
}