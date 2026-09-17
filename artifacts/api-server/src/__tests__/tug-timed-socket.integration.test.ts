import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { getTugGame, setupTugSocket } from "../game/tug-handlers";

type Ack = Record<string, any>;

function emitAck(socket: Socket, event: string, data: Record<string, unknown>): Promise<Ack> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement`)), 2_000);
    socket.emit(event, data, (response: Ack) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 4_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

function connectClient(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createClient(`${url}/tug`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

describe("timed tug Socket.IO lifecycle", () => {
  let httpServer: HttpServer | undefined;
  let io: Server | undefined;
  const clients: Socket[] = [];

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    clients.length = 0;
    await new Promise<void>((resolve) => io?.close(() => resolve()) ?? resolve());
    await new Promise<void>((resolve) => {
      if (!httpServer?.listening) return resolve();
      httpServer.close(() => resolve());
    });
  });

  it("keeps host and both teams on one deadline through repeat, pause, finish, and replay", async () => {
    httpServer = createServer();
    io = new Server(httpServer, { transports: ["websocket"] });
    setupTugSocket(io);
    await new Promise<void>((resolve) => httpServer!.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose a TCP port");
    const url = `http://127.0.0.1:${address.port}`;

    const [host, blue, red] = await Promise.all([
      connectClient(url),
      connectClient(url),
      connectClient(url),
    ]);
    clients.push(host, blue, red);

    const created = await emitAck(host, "tug:create", {
      questions: [
        { text: "Q1", options: ["A", "B"], correct: 0 },
        { text: "Q2", options: ["A", "B"], correct: 1 },
      ],
      duration: 5,
      endMode: "time",
      matchDurationSeconds: 10,
      giftsEnabled: false,
    });
    expect(created).toMatchObject({
      pin: expect.any(String),
      creatorToken: expect.any(String),
      endMode: "time",
      matchDurationSeconds: 10,
    });
    const pin = created.pin as string;
    expect(await emitAck(blue, "tug:join", { pin, name: "Blue" })).toMatchObject({ success: true, team: "blue" });
    expect(await emitAck(red, "tug:join", { pin, name: "Red" })).toMatchObject({ success: true, team: "red" });

    const game = getTugGame(pin);
    if (!game) throw new Error("Timed tug game was not created");
    game.questions.forEach((question) => {
      question.duration = 0.05;
    });
    game.matchDurationSeconds = 7;

    const seenQuestions: string[] = [];
    blue.on("tug:question", ({ text }: { text: string }) => seenQuestions.push(text));
    expect(await emitAck(host, "tug:start", { pin })).toEqual({ success: true });
    expect(await emitAck(host, "tug:skip", { pin })).toEqual({ success: true });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Question order did not repeat: ${seenQuestions.join(",")}`)), 8_000);
      const poll = setInterval(() => {
        if (seenQuestions.length >= 3) {
          clearInterval(poll);
          clearTimeout(timeout);
          resolve();
        }
      }, 10);
    });
    expect(seenQuestions.slice(0, 3)).toEqual(["Q2", "Q1", "Q2"]);

    const deadlineBeforePause = game.matchDeadline!;
    const pausedEvent = waitForEvent<{ matchTimeRemaining: number }>(red, "tug:paused");
    expect(await emitAck(host, "tug:pause", { pin })).toEqual({ success: true });
    expect((await pausedEvent).matchTimeRemaining).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const resumedEvents = clients.map((client) =>
      waitForEvent<{ matchDeadline: number }>(client, "tug:resumed"),
    );
    expect(await emitAck(host, "tug:resume", { pin })).toEqual({ success: true });
    const resumed = await Promise.all(resumedEvents);
    expect(new Set(resumed.map((event) => event.matchDeadline)).size).toBe(1);
    expect(resumed[0].matchDeadline).toBeGreaterThan(deadlineBeforePause);

    const endEvents = new Map<string, Array<{ receivedAt: number; payload: Ack }>>();
    for (const client of clients) {
      endEvents.set(client.id!, []);
      client.on("tug:game-end", (payload: Ack) => {
        endEvents.get(client.id!)!.push({ receivedAt: Date.now(), payload });
      });
    }

    game.matchDeadline = Date.now() - 1;
    const rejected = await emitAck(blue, "tug:answer", { pin, answerIndex: 0 });
    expect(rejected).toEqual({ error: "انتهى وقت المباراة." });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const delivered = [...endEvents.values()].flat();
    expect([...endEvents.values()].map((events) => events.length)).toEqual([1, 1, 1]);
    expect(Math.max(...delivered.map((event) => event.receivedAt)) - Math.min(...delivered.map((event) => event.receivedAt))).toBeLessThan(50);
    expect(delivered.map((event) => event.payload.endMode)).toEqual(["time", "time", "time"]);

    const replayedEvents = clients.map((client) => waitForEvent(client, "tug:replayed"));
    expect(await emitAck(host, "tug:replay", { pin })).toEqual({ success: true });
    await Promise.all(replayedEvents);
    expect(game.matchDeadline).toBeUndefined();

    const replayQuestion = waitForEvent<{ matchDeadline: number }>(red, "tug:question");
    expect(await emitAck(host, "tug:start", { pin })).toEqual({ success: true });
    expect(await emitAck(host, "tug:skip", { pin })).toEqual({ success: true });
    const fresh = await replayQuestion;
    expect(fresh.matchDeadline).toBeGreaterThan(Date.now());
    expect(fresh.matchDeadline).not.toBe(resumed[0].matchDeadline);
    expect(game.matchDeadline).toBe(fresh.matchDeadline);

    expect(await emitAck(host, "tug:end-early", { pin })).toEqual({ success: true });
  }, 15_000);
});