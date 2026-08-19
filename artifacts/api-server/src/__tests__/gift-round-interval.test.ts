import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import {
  createGame,
  deleteGame,
  setGiftRoundInterval,
  shouldStartGiftRound,
  type Game,
  type GameQuestion,
} from "../game/manager";
import { setupGameSocket } from "../game/socket-handlers";

const createdPins: string[] = [];

type SocketEventHandler = (...args: any[]) => void;

class TestSocket {
  readonly request: { session?: { teacherId?: number } };
  readonly join = vi.fn();
  readonly emit = vi.fn();
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

  trigger(event: string, ...args: any[]): void {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No handler registered for ${event}`);
    handler(...args);
  }
}

function makeSocketServer() {
  let onConnection: ((socket: TestSocket) => void) | undefined;
  const io = {
    on: vi.fn((event: string, handler: (socket: TestSocket) => void) => {
      if (event === "connection") onConnection = handler;
      return io;
    }),
    to: vi.fn(() => ({ emit: vi.fn() })),
  };

  setupGameSocket(io as unknown as Server);

  return {
    connect(socket: TestSocket) {
      if (!onConnection) throw new Error("Socket connection handler was not registered");
      onConnection(socket);
    },
  };
}

function makeGame(): Game {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    text: `Question ${index + 1}`,
    questionType: "mcq",
    optionA: "A",
    optionB: "B",
    correctAnswer: "A",
  })) as GameQuestion[];

  const game = createGame(1, "اختبار الهدايا", "teacher-socket", 1, questions);
  createdPins.push(game.pin);
  return game;
}

afterEach(() => {
  while (createdPins.length) deleteGame(createdPins.pop()!);
});

describe("Gift round intervals", () => {
  it("keeps the existing three-question interval by default", () => {
    const game = makeGame();

    game.currentQuestionIndex = 0;
    expect(shouldStartGiftRound(game)).toBe(false);
    game.currentQuestionIndex = 1;
    expect(shouldStartGiftRound(game)).toBe(false);
    game.currentQuestionIndex = 2;
    expect(shouldStartGiftRound(game)).toBe(true);
  });

  it("starts a round after each question when the teacher selects one", () => {
    const game = makeGame();

    expect(setGiftRoundInterval(game.pin, 1)).toBe(true);
    game.currentQuestionIndex = 0;
    expect(shouldStartGiftRound(game)).toBe(true);
    game.currentQuestionIndex = 3;
    expect(shouldStartGiftRound(game)).toBe(true);
  });

  it("rejects unsupported intervals and keeps the game on the selected value", () => {
    const game = makeGame();

    expect(setGiftRoundInterval(game.pin, 2)).toBe(false);
    expect(game.giftRoundInterval).toBe(3);
  });

  it("only lets the owning teacher select allowed intervals and restores the selection after reconnecting", () => {
    const sockets = makeSocketServer();
    const owner = new TestSocket("teacher-socket", 1);
    const player = new TestSocket("player-socket");
    const otherTeacher = new TestSocket("other-teacher-socket", 2);
    sockets.connect(owner);
    sockets.connect(player);
    sockets.connect(otherTeacher);

    const game = makeGame();

    const playerResult = vi.fn();
    player.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 1 }, playerResult);
    expect(playerResult).toHaveBeenCalledWith({ error: "غير مصرح" });
    expect(game.giftRoundInterval).toBe(3);

    const otherTeacherResult = vi.fn();
    otherTeacher.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 1 }, otherTeacherResult);
    expect(otherTeacherResult).toHaveBeenCalledWith({ error: "غير مصرح" });
    expect(game.giftRoundInterval).toBe(3);

    const invalidIntervalResult = vi.fn();
    owner.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 2 }, invalidIntervalResult);
    expect(invalidIntervalResult).toHaveBeenCalledWith({ error: "توقيت الهدايا غير صالح" });
    expect(game.giftRoundInterval).toBe(3);

    const everyAnswerResult = vi.fn();
    owner.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 1 }, everyAnswerResult);
    expect(everyAnswerResult).toHaveBeenCalledWith({ success: true, interval: 1 });
    expect(game.giftRoundInterval).toBe(1);

    const everyThreeAnswersResult = vi.fn();
    owner.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 3 }, everyThreeAnswersResult);
    expect(everyThreeAnswersResult).toHaveBeenCalledWith({ success: true, interval: 3 });
    expect(game.giftRoundInterval).toBe(3);

    owner.trigger("teacher:set-gift-round-interval", { pin: game.pin, interval: 1 }, vi.fn());
    const reconnectedOwner = new TestSocket("teacher-reconnected-socket", 1);
    sockets.connect(reconnectedOwner);

    const reconnectResult = vi.fn();
    reconnectedOwner.trigger("teacher:reconnect-game", { pin: game.pin }, reconnectResult);

    expect(reconnectResult).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        giftRoundInterval: 1,
      }),
    );
    expect(game.teacherSocketId).toBe("teacher-reconnected-socket");
  });
});