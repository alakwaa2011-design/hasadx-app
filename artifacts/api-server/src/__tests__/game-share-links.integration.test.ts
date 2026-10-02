import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { db, gameShareLinksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import router from "../routes/game-share-links";

const ready = !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

describe.skipIf(!ready)("game-share persistence and concurrent creation in PostgreSQL", () => {
  const path = `/game/join/short-link-integration-${crypto.randomUUID()}?mode=student#join`;
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error: () => {} } as unknown as typeof req.log;
    next();
  });
  app.use("/api", router);
  beforeAll(async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS game_share_links (
      code TEXT PRIMARY KEY, destination_hash TEXT NOT NULL UNIQUE,
      destination TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  });
  afterAll(async () => {
    await db.delete(gameShareLinksTable).where(eq(gameShareLinksTable.destination, path));
  });
  it("eight anonymous concurrent requests converge on one durable alias", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      request(app).post("/api/game-share-links").send({ path })));
    expect(responses.every(response => [200, 201].includes(response.status))).toBe(true);
    expect(new Set(responses.map(response => response.body.code)).size).toBe(1);
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    const code = responses[0].body.code;
    const again = await request(app).post("/api/game-share-links").send({ path });
    expect(again.body.code).toBe(code);
    const result = await request(app).get(`/api/game-share-links/${code}/redirect`);
    expect(result.status).toBe(302);
    expect(result.headers.location).toBe(path);
    const rows = await db.select().from(gameShareLinksTable)
      .where(eq(gameShareLinksTable.destination, path));
    expect(rows).toHaveLength(1);
  });
});