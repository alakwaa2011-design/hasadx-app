import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rejectStudentLiveRecitation } from "../lib/quran-live-recitation-access";

function makeApp(session: { teacherId?: number; studentAccountId?: number }) {
  const app = express();
  const state = { reachedAudioHandler: false };
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  app.post(
    "/api/quran/recitation/partial",
    rejectStudentLiveRecitation,
    (_req, _res, next) => {
      state.reachedAudioHandler = true;
      next();
    },
    express.raw({ type: "*/*", limit: "1mb" }),
    (_req, res) => res.json({ accepted: true }),
  );
  return { app, state };
}

describe("Quran live recitation access", () => {
  it("rejects a student before reading the uploaded audio body", async () => {
    const { app, state } = makeApp({ studentAccountId: 41 });

    const response = await request(app)
      .post("/api/quran/recitation/partial")
      .set("Content-Type", "audio/wav")
      .send(Buffer.alloc(64));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Live recitation is still in teacher-only evaluation",
    });
    expect(state.reachedAudioHandler).toBe(false);
  });

  it("allows a teacher request to continue to audio handling", async () => {
    const { app, state } = makeApp({ teacherId: 7 });
    const response = await request(app)
      .post("/api/quran/recitation/partial")
      .set("Content-Type", "audio/wav")
      .send(Buffer.alloc(64));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accepted: true });
    expect(state.reachedAudioHandler).toBe(true);
  });
});