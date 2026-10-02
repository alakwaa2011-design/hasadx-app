import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createHash } from "node:crypto";

const state = vi.hoisted(() => {
  const queue: unknown[] = [];
  const inserted: unknown[] = [];
  const chain = (result: unknown): unknown => new Proxy({}, {
    get: (_target, property) => property === "then"
      ? (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
        result instanceof Error ? reject(result) : resolve(result)
      : () => chain(result),
  });
  return { queue, inserted, chain };
});
vi.mock("@workspace/db", () => ({
  gameShareLinksTable: { code: "code", destinationHash: "destination_hash" },
  db: {
    select: () => state.chain(state.queue.shift()),
    insert: () => ({ values: (value: unknown) => {
      state.inserted.push(value);
      return state.chain(state.queue.shift());
    } }),
  },
}));
import router from "../routes/game-share-links";
import { GAME_SHARE_CODE, generateGameShareCode, normalizeGameSharePath } from "../lib/game-share-path";

function app() {
  const server = express();
  server.set("trust proxy", 1);
  server.use(express.json());
  server.use((req, _res, next) => {
    req.log = { error: vi.fn() } as unknown as typeof req.log;
    next();
  });
  server.use("/api", router);
  return server;
}
beforeEach(() => { state.queue.length = 0; state.inserted.length = 0; });

describe("game share destination validation", () => {
  it.each(["/game/join/1234", "/play/opaque-token", "/play/wheel/token",
    "/solo/رياضيات%25test", "/game/future/student?pin=12&name=طالب#question",
    "/solo/quiz%2Fchapter%25test", "/api/g/1234", "/api/s/legacy", "/board/code",
    "/kids/activity/42"])(
    "preserves valid existing and future game paths: %s", path => {
      const expected = new URL(path, "https://game-share.invalid");
      expect(normalizeGameSharePath(path)).toBe(expected.pathname + expected.search + expected.hash);
    });
  it.each(["https://evil.example/game/join/1234", "//evil.example/game",
    "/teacher/private", "/auth/login", "/game/../../teacher/private",
    "/game\\evil", "/game/%GG", "/game/x\r\nLocation: evil", "/s/abcdefghjk",
    "/%2f%2fevil.example", "/api/game-share-links/aaaa/redirect"])(
    "rejects external, looping and non-game destinations: %s", path => {
      expect(normalizeGameSharePath(path)).toBeNull();
    });
  it("uses cryptographic lowercase URL-safe codes", () => {
    const codes = Array.from({ length: 100 }, generateGameShareCode);
    expect(codes.every(code => GAME_SHARE_CODE.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(100);
  });
});

describe("permanent public game share aliases", () => {
  const code = "abcdef2345";
  const path = "/play/permanent-opaque-token?mode=class#join";
  const row = { code, destination: path, destinationHash: createHash("sha256").update(path).digest("hex") };
  it("returns the same saved alias without a session or another insert", async () => {
    state.queue.push([row]);
    const response = await request(app()).post("/api/game-share-links").send({ path });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code, path, shortPath: `/s/${code}` });
    expect(state.inserted).toHaveLength(0);
  });
  it("persists a new destination", async () => {
    state.queue.push([], [row]);
    const response = await request(app()).post("/api/game-share-links").send({ path });
    expect(response.status).toBe(201);
    expect(response.body.shortPath).toBe(`/s/${code}`);
    expect(state.inserted).toHaveLength(1);
  });
  it("fetches the winner of concurrent destination creation", async () => {
    state.queue.push([], [], [row]);
    const response = await request(app()).post("/api/game-share-links").send({ path });
    expect(response.status).toBe(200);
    expect(response.body.code).toBe(code);
  });
  it("retries a random-code collision rather than changing the destination", async () => {
    state.queue.push([], [], [], [row]);
    const response = await request(app()).post("/api/game-share-links").send({ path });
    expect(response.status).toBe(201);
    expect(state.inserted).toHaveLength(2);
  });
  it("redirects anonymously without losing parameters or fragments", async () => {
    state.queue.push([row]);
    const response = await request(app()).get(`/api/game-share-links/${code}/redirect`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(path);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("returns an explicit 404 for an unknown code", async () => {
    state.queue.push([]);
    expect((await request(app()).get(`/api/game-share-links/${code}/redirect`)).status).toBe(404);
  });
  it("never redirects to an invalid destination even if a stored row is corrupt", async () => {
    state.queue.push([{ ...row, destination: "//evil.example" }]);
    expect((await request(app()).get(`/api/game-share-links/${code}/redirect`)).status).toBe(404);
  });
  it("fails explicitly without silently sharing a long URL on a database failure", async () => {
    state.queue.push(new Error("unavailable"));
    const response = await request(app()).post("/api/game-share-links").send({ path });
    expect(response.status).toBe(503);
    expect(response.body.shortPath).toBeUndefined();
  });
});