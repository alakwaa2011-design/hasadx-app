import { randomBytes } from "crypto";
import { Server } from "socket.io";
import { logger } from "../lib/logger";
import {
  answerXoQuestion, clientQuestion, createXoState, type XoQuestion, type XoState, type XoTeam,
  placeXoMark, timeoutXoQuestion, validateXoQuestions,
} from "./xo-engine";

interface XoPlayer { id: string; socketId: string; name: string; avatar: string; team: XoTeam; rejoinToken: string; }
interface XoGame {
  pin: string; teacherId: number; hostSocketId: string; questions: XoQuestion[]; state: XoState;
  players: Record<string, XoPlayer>; started: boolean; timer?: ReturnType<typeof setTimeout>; questionStartedAt?: number;
  teamNames: Record<XoTeam, string>;
}
const games = new Map<string, XoGame>();
const room = (pin: string) => `xo:${pin}`;
const makePin = () => { let pin: string; do pin = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(pin)); return pin; };
const players = (game: XoGame) => Object.values(game.players).map(({ id, name, avatar, team }) => ({ id, name, avatar, team }));
const publicState = (game: XoGame) => ({
  ...game.state,
  board: [...game.state.board],
  started: game.started,
  question: game.started && game.state.phase === "question" ? {
    ...clientQuestion(game.questions[game.state.questionIndex]),
    remainingSecs: Math.max(0, Math.ceil((game.questions[game.state.questionIndex].duration * 1000 - (Date.now() - (game.questionStartedAt ?? Date.now()))) / 1000)),
  } : null,
  players: players(game),
  teamNames: game.teamNames,
});
const isHost = (socket: { id: string; request: unknown }, game: XoGame) =>
  game.hostSocketId === socket.id && (socket.request as any).session?.teacherId === game.teacherId;

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
    emitState(ns, game); scheduleQuestion(ns, game);
  }, game.questions[game.state.questionIndex].duration * 1000);
}
function schedulePlacement(ns: ReturnType<Server["of"]>, game: XoGame) {
  clearTimer(game);
  if (game.state.phase !== "placement") return;
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
  if (game.state.phase === "question") game.questionStartedAt = Date.now();
  else game.questionStartedAt = undefined;
  emitState(ns, game);
  if (game.state.phase === "question") scheduleQuestion(ns, game);
  else if (game.state.phase === "placement") schedulePlacement(ns, game);
}

export function setupXoSocket(io: Server) {
  const ns = io.of("/xo");
  ns.on("connection", (socket) => {
    socket.on("xo:create", (data: { questions: unknown; duration?: number; teamX?: string; teamO?: string }, cb: (result: object) => void = () => {}) => {
      const teacherId = (socket.request as any).session?.teacherId as number | undefined;
      if (!teacherId) return cb({ error: "يجب تسجيل دخول المعلم لإنشاء لعبة." });
      const questions = validateXoQuestions(data?.questions, data?.duration);
      if (!questions) return cb({ error: "الأسئلة يجب أن تحتوي نصاً وخيارين إلى أربعة خيارات صالحة." });
      const pin = makePin();
      const game: XoGame = {
        pin, teacherId, hostSocketId: socket.id, questions, state: createXoState(), players: {}, started: false,
        teamNames: {
          x: typeof data.teamX === "string" && data.teamX.trim() ? data.teamX.trim().slice(0, 40) : "X",
          o: typeof data.teamO === "string" && data.teamO.trim() ? data.teamO.trim().slice(0, 40) : "O",
        },
      };
      games.set(pin, game); socket.join(room(pin));
      setTimeout(() => { const current = games.get(pin); if (current === game) { clearTimer(game); games.delete(pin); } }, 3 * 60 * 60 * 1000).unref();
      cb({ success: true, pin, state: publicState(game) });
    });

    socket.on("xo:reclaim-host", (data: { pin: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      const teacherId = (socket.request as any).session?.teacherId as number | undefined;
      if (!game || !teacherId || teacherId !== game.teacherId) return cb({ error: "تعذر استعادة غرفة المعلم." });
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

    socket.on("xo:start", (data: { pin: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (!isHost(socket, game)) return cb({ error: "فقط المعلم المنشئ يمكنه البدء." });
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
      const result = answerXoQuestion(game.state, game.questions, player.id, player.team, data.answerIndex);
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

    socket.on("xo:skip", (data: { pin: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game)) return cb({ error: "فقط المعلم يمكنه التخطي." });
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
    const endGame = (data: { pin: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game)) return cb({ error: "فقط المعلم يمكنه الإنهاء." });
      clearTimer(game); games.delete(game.pin); ns.to(room(game.pin)).emit("xo:ended"); cb({ success: true });
    };
    socket.on("xo:end", endGame);
    socket.on("xo:end-early", endGame);
    socket.on("xo:replay", (data: { pin: string }, cb: (result: object) => void = () => {}) => {
      const game = games.get(data?.pin);
      if (!game || !isHost(socket, game)) return cb({ error: "فقط المعلم يمكنه إعادة اللعب." });
      clearTimer(game); game.state = createXoState(); game.questionStartedAt = undefined; game.started = true; setState(ns, game); cb({ success: true });
    });
    socket.on("disconnect", () => logger.debug({ socketId: socket.id }, "XO socket disconnected"));
  });
}