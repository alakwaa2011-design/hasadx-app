import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { createXoGameFromRest, setupXoSocket } from "../game/xo-handlers";

type SocketEventHandler = (...args: any[]) => void;

class TestSocket {
  readonly request: { session?: { teacherId?: number } };
  readonly join = vi.fn();
  readonly leave = vi.fn();
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
  it("updates the existing waiting room without changing its two students or rejoin identities", () => {
    const sockets = makeSocketServer();
    const created = createXoGameFromRest({ questions, teamX: "Old X", teamO: "Old O" });
    const host = new TestSocket("edit-host"), x = new TestSocket("edit-x"), o = new TestSocket("edit-o");
    [host, x, o].forEach(s => sockets.connect(s));
    const control = { pin: created.pin, controlToken: created.controlToken };
    emitWithCallback(host, "xo:reclaim-host", control);
    const px = emitWithCallback(x, "xo:join", { pin: created.pin, name: "X", avatar: "x" }).player;
    const po = emitWithCallback(o, "xo:join", { pin: created.pin, name: "O", avatar: "o" }).player;
    const roster = sockets.namespace.latestState()!.players;
    const changed = questions.map(q => ({ ...q, text: `Edited ${q.text}`, imageUrl: "/api/objects/test.png" }));
    const result = emitWithCallback(host, "xo:update-setup", { ...control, questions: changed, title: "Edited title", teamX: "New X", teamO: "New O", duration: 30 });
    expect(result).toMatchObject({ success: true, pin: created.pin, phase: "waiting", started: false, title: "Edited title", teamNames: { x: "New X", o: "New O" } });
    expect(result.players).toEqual(roster);
    expect(result.setup.questions).toHaveLength(2);
    expect(result.setup.questions.every((q: any) => q.duration === 30 && q.text.startsWith("Edited"))).toBe(true);
    expect(sockets.namespace.latestState()).not.toHaveProperty("setup");
    expect(sockets.namespace.latestState()!.question).toBeNull();
    expect(emitWithCallback(x, "xo:join", { pin: created.pin, playerId: px.id, rejoinToken: px.rejoinToken }).player).toEqual(px);
    expect(emitWithCallback(o, "xo:join", { pin: created.pin, playerId: po.id, rejoinToken: po.rejoinToken }).player).toEqual(po);
    expect(emitWithCallback(host, "xo:start", control)).toMatchObject({ success: true });
    expect(sockets.namespace.latestState()!.question).toMatchObject({ duration: 30, imageUrl: "/api/objects/test.png" });
    emitWithCallback(host, "xo:end", control);
  });

  it.each(["start-first", "update-first"])("serializes setup saving and match start atomically: %s", order => {
    const sockets = makeSocketServer();
    const host = new TestSocket(`race-host-${order}`, 7), x = new TestSocket(`race-x-${order}`), o = new TestSocket(`race-o-${order}`);
    [host, x, o].forEach(s => sockets.connect(s));
    const { pin } = emitWithCallback(host, "xo:create", { questions, teamX: "Original X" });
    emitWithCallback(x, "xo:join", { pin, name: "X" });
    emitWithCallback(o, "xo:join", { pin, name: "O" });
    const update = () => emitWithCallback(host, "xo:update-setup", { pin, questions, duration: 45, teamX: "Updated X", teamO: "Updated O", title: "Updated" });
    if (order === "start-first") {
      emitWithCallback(host, "xo:start", { pin });
      const before = structuredClone(sockets.namespace.latestState());
      expect(update()).toMatchObject({ code: "xo-room-started" });
      expect(sockets.namespace.latestState()).toEqual(before);
      expect(emitWithCallback(host, "xo:reclaim-host", { pin }).setup.teamX).toBe("Original X");
    } else {
      expect(update()).toMatchObject({ success: true });
      expect(emitWithCallback(host, "xo:start", { pin })).toMatchObject({ success: true });
      expect(sockets.namespace.latestState()).toMatchObject({ started: true, title: "Updated", question: { duration: 45 }, teamNames: { x: "Updated X" } });
      expect(update()).toMatchObject({ code: "xo-room-started" });
    }
    emitWithCallback(host, "xo:end", { pin });
  });

  it("rejects non-host edits and invalid settings without partially changing the waiting room", () => {
    const sockets = makeSocketServer();
    const host = new TestSocket("validation-host", 7), stranger = new TestSocket("validation-stranger", 8);
    [host, stranger].forEach(s => sockets.connect(s));
    const { pin } = emitWithCallback(host, "xo:create", { questions });
    const update = { pin, questions, duration: 20, teamX: "X", teamO: "O", title: "Valid" };
    expect(emitWithCallback(stranger, "xo:update-setup", update)).toMatchObject({ code: "xo-room-forbidden" });
    const before = emitWithCallback(host, "xo:reclaim-host", { pin });
    for (const invalid of [{ teamX: "" }, { teamO: "O".repeat(41) }, { title: null }, { duration: 12 }, { duration: NaN }, { questions: [questions[0]] }, { questions: [{ ...questions[0], correct: 8 }, questions[1]] }]) {
      expect(emitWithCallback(host, "xo:update-setup", { ...update, ...invalid })).toMatchObject({ code: "xo-room-invalid" });
      expect(emitWithCallback(host, "xo:reclaim-host", { pin })).toEqual(before);
    }
    emitWithCallback(host, "xo:end", { pin });
  });

  it("runs the public REST-created room with one host and two students in the same room", () => {
    const sockets = makeSocketServer();
    const created = createXoGameFromRest({ questions, teamX: "Team X", teamO: "Team O" });
    const host = new TestSocket("public-host");
    const x = new TestSocket("public-x");
    const o = new TestSocket("public-o");
    sockets.connect(host); sockets.connect(x); sockets.connect(o);
    expect(emitWithCallback(host, "xo:reclaim-host", { pin: created.pin, controlToken: "invalid" })).toHaveProperty("error");
    expect(emitWithCallback(host, "xo:reclaim-host", { pin: created.pin, controlToken: created.controlToken })).toMatchObject({ success: true, started: false });
    expect(emitWithCallback(host, "xo:start", { pin: created.pin, controlToken: created.controlToken })).toHaveProperty("error");
    const px = emitWithCallback(x, "xo:join", { pin: created.pin, name: "X" }).player;
    emitWithCallback(o, "xo:join", { pin: created.pin, name: "O" });
    expect(emitWithCallback(x, "xo:start", { pin: created.pin })).toHaveProperty("error");
    expect(emitWithCallback(host, "xo:start", { pin: created.pin, controlToken: created.controlToken })).toMatchObject({ success: true });
    const state = sockets.namespace.latestState()!;
    expect(state.activePlayerId).toBe(px.id);
    expect(state).not.toHaveProperty("controlToken");
    expect(state).not.toHaveProperty("publicHostControlToken");
    expect(state.players).toHaveLength(2);
    expect(emitWithCallback(x, "xo:answer", { pin: created.pin, playerId: px.id, turnId: state.turnId, answerIndex: 0 })).toMatchObject({ success: true, correct: true });
    expect(emitWithCallback(x, "xo:place", { pin: created.pin, playerId: px.id, turnId: state.turnId })).toHaveProperty("error");
    expect(emitWithCallback(x, "xo:place", { pin: created.pin, playerId: px.id, turnId: sockets.namespace.latestState()!.turnId, cell: 0 })).toMatchObject({ success: true });
    expect(sockets.namespace.latestState()?.board[0]).toBe("x");
    emitWithCallback(host, "xo:end", { pin: created.pin, controlToken: created.controlToken });
  });

  it("rotates representatives in each team and rejects teammates, rivals and stale actions", () => {
    const sockets = makeSocketServer();
    const host = new TestSocket("rotation-host", 7);
    const students = Array.from({ length: 6 }, (_, i) => new TestSocket(`rotation-${i}`));
    sockets.connect(host); students.forEach(s => sockets.connect(s));
    const { pin } = emitWithCallback(host, "xo:create", { questions });
    const joined = students.map((s, i) => emitWithCallback(s, "xo:join", { pin, name: `Student ${i}` }).player);
    expect(joined.map(p => p.team)).toEqual(["x", "o", "x", "o", "x", "o"]);
    // A repeated initialise on the same connection does not duplicate a student.
    expect(emitWithCallback(students[0], "xo:join", { pin, name: "Student 0" }).player.id).toBe(joined[0].id);
    expect(sockets.namespace.latestState()?.players).toHaveLength(6);
    emitWithCallback(host, "xo:start", { pin });
    const firstTurnId = sockets.namespace.latestState()!.turnId;
    expect(emitWithCallback(students[2], "xo:answer", { pin, answerIndex: 0 })).toMatchObject({ error: "هذا الدور لممثل فريقك الحالي." });
    expect(emitWithCallback(students[1], "xo:answer", { pin, answerIndex: 0 })).toMatchObject({ error: "ليس دور فريقك." });
    const representatives: string[] = [];
    for (let round = 0; round < 8; round++) {
      representatives.push(sockets.namespace.latestState()!.activePlayerId);
      emitWithCallback(host, "xo:skip", { pin });
    }
    expect(representatives).toEqual([0, 1, 2, 3, 4, 5, 0, 1].map(i => joined[i].id));
    expect(emitWithCallback(students[2], "xo:answer", { pin, turnId: firstTurnId, answerIndex: 0 })).toMatchObject({ error: "تغير الدور، انتظر تحديث اللعبة." });
    emitWithCallback(host, "xo:end", { pin });
  });

  it("counts only connected players for start and transfers a disconnected representative without extending the timer", () => {
    vi.useFakeTimers();
    const sockets = makeSocketServer();
    const host = new TestSocket("online-host", 7);
    const x = new TestSocket("online-x"); const o = new TestSocket("online-o"); const x2 = new TestSocket("online-x2");
    [host, x, o, x2].forEach(s => sockets.connect(s));
    const { pin } = emitWithCallback(host, "xo:create", { questions });
    const px = emitWithCallback(x, "xo:join", { pin, name: "X" }).player;
    const po = emitWithCallback(o, "xo:join", { pin, name: "O" }).player;
    emitWithCallback(x2, "xo:join", { pin, name: "X2" });
    o.trigger("disconnect");
    expect(emitWithCallback(host, "xo:start", { pin })).toMatchObject({ error: "يجب أن ينضم لاعب واحد على الأقل لكل فريق." });
    emitWithCallback(o, "xo:join", { pin, playerId: po.id, rejoinToken: po.rejoinToken });
    emitWithCallback(host, "xo:start", { pin });
    const deadline = sockets.namespace.latestState()!.timerExpiresAt;
    vi.advanceTimersByTime(2100);
    x.trigger("disconnect");
    const state = sockets.namespace.latestState()!;
    expect(state.activePlayerId).not.toBe(px.id);
    expect(state.players.find((p: any) => p.id === px.id).connected).toBe(false);
    expect(state.timerExpiresAt).toBe(deadline);
    expect(state.question.remainingSecs).toBe(8);
    expect(emitWithCallback(x, "xo:answer", { pin, answerIndex: 0 })).toMatchObject({ error: "أنت لست في هذه اللعبة." });
    emitWithCallback(x, "xo:join", { pin, playerId: px.id, rejoinToken: px.rejoinToken });
    expect(sockets.namespace.latestState()!.activePlayerId).toBe(state.activePlayerId);
    expect(sockets.namespace.latestState()!.players).toHaveLength(3);
    emitWithCallback(host, "xo:end", { pin });
  });

  it("transfers earned placement on leave, handles an entirely offline team and resumes on rejoin", () => {
    vi.useFakeTimers();
    const sockets = makeSocketServer();
    const host = new TestSocket("placement-host", 7);
    const x = new TestSocket("placement-x"); const o = new TestSocket("placement-o"); const x2 = new TestSocket("placement-x2");
    [host, x, o, x2].forEach(s => sockets.connect(s));
    const { pin } = emitWithCallback(host, "xo:create", { questions });
    const px = emitWithCallback(x, "xo:join", { pin, name: "X" }).player;
    emitWithCallback(o, "xo:join", { pin, name: "O" });
    const px2 = emitWithCallback(x2, "xo:join", { pin, name: "X2" }).player;
    emitWithCallback(host, "xo:start", { pin });
    emitWithCallback(x, "xo:answer", { pin, answerIndex: 0 });
    const deadline = sockets.namespace.latestState()!.timerExpiresAt;
    vi.advanceTimersByTime(5000);
    x.trigger("xo:leave", { pin });
    expect(sockets.namespace.latestState()).toMatchObject({ phase: "placement", activePlayerId: px2.id, placementPlayerId: px2.id, timerExpiresAt: deadline });
    expect(x.leave).toHaveBeenCalledWith(`xo:${pin}`);
    x2.trigger("disconnect");
    expect(sockets.namespace.latestState()).toMatchObject({ phase: "placement", activePlayerId: null, placementPlayerId: null, timerExpiresAt: deadline });
    emitWithCallback(x, "xo:join", { pin, playerId: px.id, rejoinToken: px.rejoinToken });
    expect(sockets.namespace.latestState()).toMatchObject({ activePlayerId: px.id, placementPlayerId: px.id, timerExpiresAt: deadline });
    expect(emitWithCallback(x, "xo:place", { pin, cell: 2 })).toMatchObject({ success: true });
    expect(sockets.namespace.latestState()?.board[2]).toBe("x");
    emitWithCallback(host, "xo:end", { pin });
  });
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