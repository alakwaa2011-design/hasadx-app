import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import quranRouter from "../routes/quran";

function appWithSession(session: { teacherId?: number; studentAccountId?: number } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = session;
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", quranRouter);
  return app;
}

describe("Quran reader state validation and ownership boundary", () => {
  it("requires an authenticated owner", async () => {
    const response = await request(appWithSession()).get("/api/quran/reader-state");
    expect(response.status).toBe(401);
  });

  it.each([
    [{ teacherId: 10 }, { surahNumber: 2, ayahNumber: 0, pageNumber: 1, expectedRevision: 1 }],
    [{ studentAccountId: 20 }, { surahNumber: 115, ayahNumber: 1, pageNumber: 1, expectedRevision: 1 }],
    [{ teacherId: 10 }, { surahNumber: 2, ayahNumber: 1, pageNumber: 605, expectedRevision: 1 }],
  ])("rejects invalid verse/page input for %j", async (session, body) => {
    const response = await request(appWithSession(session))
      .put("/api/quran/reader-state/position")
      .send(body);
    expect(response.status).toBe(400);
  });

  it("requires the expected revision for every position write", async () => {
    const response = await request(appWithSession({ teacherId: 10 }))
      .put("/api/quran/reader-state/position")
      .send({ surahNumber: 1, ayahNumber: 1, pageNumber: 1 });
    expect(response.status).toBe(400);
  });

  it.each([
    ["/api/quran/reader-state/bookmarks/2/0", { pageNumber: 1 }],
    ["/api/quran/reader-state/bookmarks/2/1", { pageNumber: 0 }],
    ["/api/quran/reader-state/bookmarks/115/1", { pageNumber: 1 }],
  ])("rejects invalid bookmark %s", async (path, body) => {
    const response = await request(appWithSession({ teacherId: 10 }))
      .put(path)
      .send(body);
    expect(response.status).toBe(400);
  });

  it("does not expose another owner through the unified endpoint", async () => {
    const response = await request(appWithSession({ teacherId: 10 })).get("/api/quran/reader-state");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ position: null, bookmarks: [] });
    expect(response.body).not.toHaveProperty("studentAccountId");
    expect(response.body).not.toHaveProperty("teacherId");
  });
});