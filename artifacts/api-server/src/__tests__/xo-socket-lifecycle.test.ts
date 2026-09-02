import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { setupXoSocket } from "../game/xo-handlers";

type SocketEventHandler = (...args: any[]) => void;

class TestSocket {
  readonly request: { session?: { teacherId?: number } };
  readonly join = vi.fn();
  private readonly handlers = new Map<string, SocketEventHandler>();

  constructor(
    readonly id: string,
    teacherId?: number,
  ) {
    this.request = teacherId === undefined ? {} : { session: { teacherId } };
  }

  on(event: string, handler: SocketEventHandler): this {
    this.handlers.set(event, handler);
    return this;
  }

  trigger(event: string, ...args: any[]): unknown {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No handler registered for ${event}`);
    return handler(...args);
  }
}

class TestNamespace {
  readonly roomEmit = vi.fn();
  private connectionHandler?: (socket: TestSocket) => void;

  on(event: string, handler: (socket: TestSocket) => void): this {
    if (event === "connection") this.connectionHandler = handler;
    return this;
  }

  to() {
    return { emit: this.roomEmit };
  }

  connect(socket: TestSocket) {
    if (!this.connectionHandler) throw new Error("Socket connection handler was not registered");
    this.connectionHandler(socket);
  }

  latestState() {
    const calls = this.roomEmit.mock.calls.filter(([event]) => event === "xo:state");
    return calls.at(-1)?.[1] as Record<string, any> | undefined;
  }
}

function makeSocketServer() {
  const namespace = new TestNamespace();
  const io = { of: vi.fn(() => namespace) };
  setupXoSocket(io as unknown as Server);
  return { namespace, connect: (socket: TestSocket) => namespace.connect(socket) };
}

const questions = [
  { text: "Question 1", options: ["Correct", "Wrong"], correct: 0, duration: 10 },
  { text: "Question 2", options: ["Wrong", "Correct"], correct: 1, duration: 10 },
];

function emitWithCallback(socket: TestSocket, event: string, data: Record<string, unknown>) {
  const callback = vi.fn();
  socket.trigger(event, data, callback);
  return callback.mock.calls[0]?.[0] as Record<string, any>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("XO socket lifecycle", () => {
  it("runs a complete two-player match with turn changes, one placement, occupied-cell rejection, and a win", () => {
    const sockets = makeSocketServer();
    const teacher = new TestSocket("teacher", 7);
    const xPlayer = new TestSocket("x-player");
    const oPlayer = new TestSocket("o-player");
    sockets.connect(teacher);
    sockets.connect(xPlayer);
    sockets.connect(oPlayer);

    const created = emitWithCallback(teacher, "xo:create", { questions });
    expect(created).toMatchObject({ success: true, pin: expect.any(String) });
    const pin = created.pin as string;
    const joinedX = emitWithCallback(xPlayer, "xo:join", { pin, name: "X student" });
    const joinedO = emitWithCallback(oPlayer, "xo:join", { pin, name: "O student" });
    expect(joinedX.player).toMatchObject({ team: "x", rejoinToken: expect.any(String) });
    expect(joinedO.player).toMatchObject({ team: "o", rejoinToken: expect.any(String) });

    expect(emitWithCallback(teacher, "xo:start", { pin })).toMatchObject({ success: true });

    const wrong = emitWithCallback(xPlayer, "xo:answer", {
      pin,
      playerId: joinedX.player.id,
      answerIndex: 1,
    });
    expect(wrong).toMatchObject({ success: true, correct: false });
    expect(sockets.namespace.latestState()).toMatchObject({ turn: "o", phase: "question", questionIndex: 1 });

    const correct = emitWithCallback(oPlayer, "xo:answer", {
      pin,
      playerId: joinedO.player.id,
      answerIndex: 1,
    });
    expect(correct).toMatchObject({ success: true, correct: true });
    expect(sockets.namespace.latestState()).toMatchObject({
      turn: "o",
      phase: "placement",
      placementPlayerId: joinedO.player.id,
    });
    expect(emitWithCallback(oPlayer, "xo:place", { pin, playerId: joinedO.player.id, cell: 0 })).toMatchObject({ success: true });
    expect(sockets.namespace.latestState()).toMatchObject({ turn: "x", phase: "question" });
    expect(sockets.namespace.latestState()?.board).toEqual(["o", null, null, null, null, null, null, null, null]);

    expect(emitWithCallback(xPlayer, "xo:answer", { pin, playerId: joinedX.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: true });
    expect(emitWithCallback(xPlayer, "xo:place", { pin, playerId: joinedX.player.id, cell: 0 })).toMatchObject({ error: "هذه الخانة مشغولة." });
    expect(emitWithCallback(xPlayer, "xo:place", { pin, playerId: joinedX.player.id, cell: 1 })).toMatchObject({ success: true });

    expect(emitWithCallback(oPlayer, "xo:answer", { pin, playerId: joinedO.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: false });
    expect(emitWithCallback(xPlayer, "xo:answer", { pin, playerId: joinedX.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: true });
    expect(emitWithCallback(xPlayer, "xo:place", { pin, playerId: joinedX.player.id, cell: 2 })).toMatchObject({ success: true });
    expect(emitWithCallback(oPlayer, "xo:answer", { pin, playerId: joinedO.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: false });
    expect(emitWithCallback(xPlayer, "xo:answer", { pin, playerId: joinedX.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: true });
    expect(emitWithCallback(xPlayer, "xo:place", { pin, playerId: joinedX.player.id, cell: 4 })).toMatchObject({ success: true });
    expect(emitWithCallback(oPlayer, "xo:answer", { pin, playerId: joinedO.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: false });
    expect(emitWithCallback(xPlayer, "xo:answer", { pin, playerId: joinedX.player.id, answerIndex: 0 })).toMatchObject({ success: true, correct: true });
    expect(emitWithCallback(xPlayer, "xo:place", { pin, playerId: joinedX.player.id, cell: 7 })).toMatchObject({ success: true, winner: "x" });
    expect(sockets.namespace.latestState()).toMatchObject({ phase: "finished", winner: "x" });
    expect(sockets.namespace.latestState()?.board).toEqual(["o", "x", "x", null, "x", null, null, "x", null]);

    expect(emitWithCallback(teacher, "xo:end", { pin })).toMatchObject({ success: true });
    expect(sockets.namespace.roomEmit).toHaveBeenCalledWith("xo:ended");
  });

  it("rehydrates the teacher and player with the current board, turn, and timer", () => {
    vi.useFakeTimers();
    const sockets = makeSocketServer();
    const teacher = new TestSocket("teacher", 7);
    const xPlayer = new TestSocket("x-player");
    const oPlayer = new TestSocket("o-player");
    sockets.connect(teacher);
    sockets.connect(xPlayer);
    sockets.connect(oPlayer);

    const created = emitWithCallback(teacher, "xo:create", { questions });
    const pin = created.pin as string;
    const joined = emitWithCallback(xPlayer, "xo:join", { pin, name: "X student" });
    emitWithCallback(oPlayer, "xo:join", { pin, name: "O student" });
    emitWithCallback(teacher, "xo:start", { pin });
    const initialState = sockets.namespace.latestState();
    expect(initialState).toMatchObject({ board: Array(9).fill(null), turn: "x", phase: "question" });
    expect(initialState?.question.remainingSecs).toBe(10);

    vi.advanceTimersByTime(2_100);
    const replacementTeacher = new TestSocket("teacher-reconnected", 7);
    const replacementPlayer = new TestSocket("x-player-reconnected");
    sockets.connect(replacementTeacher);
    sockets.connect(replacementPlayer);
    const reclaimed = emitWithCallback(replacementTeacher, "xo:reclaim-host", { pin });
    const rejoined = emitWithCallback(replacementPlayer, "xo:join", {
      pin,
      name: "Ignored after reconnect",
      playerId: joined.player.id,
      rejoinToken: joined.player.rejoinToken,
    });

    expect(reclaimed).toMatchObject({ success: true, board: Array(9).fill(null), turn: "x", phase: "question" });
    expect(rejoined).toMatchObject({
      success: true,
      player: { id: joined.player.id, team: "x", rejoinToken: joined.player.rejoinToken },
      state: { board: Array(9).fill(null), turn: "x", phase: "question" },
    });
    expect(reclaimed.question.remainingSecs).toBeGreaterThan(0);
    expect(reclaimed.question.remainingSecs).toBeLessThan(10);
    expect(reclaimed.timerRemainingSecs).toBe(reclaimed.question.remainingSecs);

    expect(emitWithCallback(replacementTeacher, "xo:end", { pin })).toMatchObject({ success: true });
    expect(sockets.namespace.roomEmit).toHaveBeenCalledWith("xo:ended");
  });

  it("preserves the placement countdown across a reconnect", () => {
    vi.useFakeTimers();
    const sockets = makeSocketServer();
    const teacher = new TestSocket("teacher", 7);
    const xPlayer = new TestSocket("x-player");
    const oPlayer = new TestSocket("o-player");
    sockets.connect(teacher);
    sockets.connect(xPlayer);
    sockets.connect(oPlayer);

    const created = emitWithCallback(teacher, "xo:create", { questions });
    const pin = created.pin as string;
    const joined = emitWithCallback(xPlayer, "xo:join", { pin, name: "X student" });
    emitWithCallback(oPlayer, "xo:join", { pin, name: "O student" });
    emitWithCallback(teacher, "xo:start", { pin });
    emitWithCallback(xPlayer, "xo:answer", { pin, playerId: joined.player.id, answerIndex: 0 });
    vi.advanceTimersByTime(6_100);

    const replacementPlayer = new TestSocket("x-player-reconnected");
    sockets.connect(replacementPlayer);
    const rejoined = emitWithCallback(replacementPlayer, "xo:join", {
      pin,
      name: "Ignored after reconnect",
      playerId: joined.player.id,
      rejoinToken: joined.player.rejoinToken,
    });

    expect(rejoined.state).toMatchObject({ phase: "placement", placementPlayerId: joined.player.id });
    expect(rejoined.state.timerRemainingSecs).toBeGreaterThan(0);
    expect(rejoined.state.timerRemainingSecs).toBeLessThan(20);

    expect(emitWithCallback(teacher, "xo:end", { pin })).toMatchObject({ success: true });
  });
});