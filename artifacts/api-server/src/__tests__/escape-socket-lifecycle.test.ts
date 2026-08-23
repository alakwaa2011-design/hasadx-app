import { describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { setupEscapeSocket } from "../game/escape-handlers";

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

class TestSocketServer {
  readonly roomEmit = vi.fn();
  readonly to = vi.fn(() => ({ emit: this.roomEmit }));
  private readonly connectionHandlers = new Set<(socket: TestSocket) => void>();

  on(event: string, handler: (socket: TestSocket) => void): this {
    if (event === "connection") this.connectionHandlers.add(handler);
    return this;
  }

  connectionListenerCount() {
    return this.connectionHandlers.size;
  }

  connect(socket: TestSocket) {
    for (const handler of this.connectionHandlers) handler(socket);
  }
}

const validSetup = {
  questions: [
    { text: "Question 1", options: ["A", "B"], correct: 0 },
    { text: "Question 2", options: ["A", "B"], correct: 1 },
    { text: "Question 3", options: ["A", "B"], correct: 0 },
  ],
  totalTime: 600,
  lockCount: 3,
  hints: 2,
};

describe("Escape room socket lifecycle", () => {
  it("does not accumulate connection listeners while preserving create, join, and end events", () => {
    const io = new TestSocketServer();

    setupEscapeSocket(io as unknown as Server);
    setupEscapeSocket(io as unknown as Server);

    expect(io.connectionListenerCount()).toBe(1);

    const teacher = new TestSocket("teacher", 1);
    io.connect(teacher);
    const created = vi.fn();
    teacher.trigger("escape:create", validSetup, created);

    expect(created).toHaveBeenCalledWith(expect.objectContaining({
      pin: expect.any(String),
      creatorToken: expect.any(String),
    }));
    const { pin } = created.mock.calls[0][0] as { pin: string };

    const player = new TestSocket("player");
    io.connect(player);
    const joined = vi.fn();
    player.trigger("escape:join", { pin, name: "Student" }, joined);
    expect(joined).toHaveBeenCalledWith(expect.objectContaining({ ok: true, state: "lobby" }));

    teacher.trigger("escape:end");
    expect(io.roomEmit).toHaveBeenCalledWith("escape:ended");
    expect(io.connectionListenerCount()).toBe(1);
  });
});