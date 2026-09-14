import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import {
  addPlayer,
  createGame,
  deleteGame,
  type GameQuestion,
} from "../game/manager";
import { setupGameSocket } from "../game/socket-handlers";

type SocketEventHandler = (...args: any[]) => void;

class TestSocket {
  readonly request: { session?: { teacherId?: number } };
  readonly data: Record<string, unknown> = {};
  readonly join = vi.fn();
  readonly emit = vi.fn();
  private readonly handlers = new Map<string, SocketEventHandler>();

  constructor(readonly id: string, teacherId?: number) {
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

function makeSocketServer() {
  let onConnection: ((socket: TestSocket) => void) | undefined;
  const roomEmit = vi.fn();
  const io = {
    on: vi.fn((event: string, handler: (socket: TestSocket) => void) => {
      if (event === "connection") onConnection = handler;
      return io;
    }),
    to: vi.fn(() => ({ emit: roomEmit })),
  };

  setupGameSocket(io as unknown as Server);

  return {
    roomEmit,
    connect(socket: TestSocket) {
      if (!onConnection) throw new Error("Socket connection handler was not registered");
      onConnection(socket);
    },
  };
}

const questions = [{
  id: 1,
  text: "السؤال الأخير",
  questionType: "mcq",
  optionA: "الإجابة الصحيحة",
  optionB: "إجابة أخرى",
  correctAnswer: "A",
}] as GameQuestion[];

describe("solo automatic finish lifecycle", () => {
  const createdPins: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    while (createdPins.length) deleteGame(createdPins.pop()!);
    vi.useRealTimers();
  });

  it("moves the last auto-advanced question from leaderboard to finished", () => {
    const sockets = makeSocketServer();
    const teacher = new TestSocket("teacher", 7);
    const player = new TestSocket("player");
    sockets.connect(teacher);
    sockets.connect(player);

    const game = createGame(1, "مسابقة ذاتية", teacher.id, 7, questions, 20, true, "solo");
    createdPins.push(game.pin);
    addPlayer(game.pin, player.id, "طالب");

    teacher.trigger("teacher:start-game", { pin: game.pin, autoAdvance: true });
    expect(game.state).toBe("question");

    player.trigger("student:submit-answer", { pin: game.pin, answer: "B" });
    expect(game.state).toBe("leaderboard");

    vi.advanceTimersByTime(2500);

    expect(game.state).toBe("finished");
    expect(sockets.roomEmit).toHaveBeenCalledWith(
      "game:finished",
      expect.objectContaining({ totalQuestions: 1 }),
    );
  });

  it("rehydrates a finished result for the same player without reopening the lobby", () => {
    const sockets = makeSocketServer();
    const original = new TestSocket("original-player");
    const replacement = new TestSocket("replacement-player");
    sockets.connect(original);
    sockets.connect(replacement);

    const game = createGame(1, "مسابقة ذاتية", "teacher", 7, questions, 20, true, "solo");
    createdPins.push(game.pin);
    const player = addPlayer(game.pin, original.id, "طالب")!;
    player.score = 25;
    player.totalCorrect = 1;
    game.currentQuestionIndex = 0;
    game.state = "finished";
    original.trigger("disconnect", "transport close");

    const callback = vi.fn();
    replacement.trigger("student:join-game", { pin: game.pin, name: "طالب" }, callback);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      gameState: "finished",
      totalQuestions: 1,
      myScore: 25,
      myCorrectCount: 1,
      leaderboard: expect.arrayContaining([
        expect.objectContaining({ name: "طالب", score: 25 }),
      ]),
    }));
    expect(game.state).toBe("finished");
  });
});