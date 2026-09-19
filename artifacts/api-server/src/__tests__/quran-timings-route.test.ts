import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { getTimings, getDisplayReciters } = vi.hoisted(() => ({
  getTimings: vi.fn(),
  getDisplayReciters: vi.fn(),
}));
vi.mock("../lib/quran-foundation-client", () => ({
  getQuranFoundationAyahTimings: getTimings,
  getQuranFoundationAudioUrl: vi.fn(),
  getQuranFoundationMadaniPage: vi.fn(),
  getQuranFoundationSurahContent: vi.fn(),
  getQuranFoundationAyahEducation: vi.fn(),
  listQuranFoundationSurahs: vi.fn(),
  listQuranFoundationReciters: vi.fn(),
  listQuranFoundationDisplayReciters: getDisplayReciters,
  SADIQ_ALNIZAM_RECITATION_ID: 2_000_114,
  ABU_BAKR_AL_DHABI_RECITATION_ID: 2_001_095,
  isUnverifiedQuranRecitation: (recitationId: number) =>
    recitationId === 2_000_114,
}));

import quranRouter from "../routes/quran";

function app(session: { teacherId?: number; studentAccountId?: number } = { teacherId: 1 }) {
  const instance = express();
  instance.use((req: any, _res, next) => {
    req.session = session;
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  instance.use("/api", quranRouter);
  return instance;
}

describe("Quran ayah timings route", () => {
  beforeEach(() => {
    getTimings.mockReset();
    getDisplayReciters.mockReset();
    getDisplayReciters.mockResolvedValue([
      { id: 7, name: "Verified", style: "Murattal", available: true },
      { id: 2_000_114, name: "صادق النظام", style: "Murattal", available: false },
      { id: 2_001_095, name: "أبوبكر الظبي", style: "Murattal", available: true },
    ]);
    getTimings.mockResolvedValue({
      recitationId: 1, verseKey: "1:1",
      audioUrl: "https://verses.quran.foundation/chapter.mp3", verseStartMs: 0, verseEndMs: 100,
      segments: [{ wordPosition: 1, startMs: 0, endMs: 100 }],
      synchronized: true,
    });
  });

  it("does not expose an unverified sample recitation to anonymous readers", async () => {
    const response = await request(app({})).get("/api/quran/reciters");
    expect(response.status).toBe(200);
    expect(response.body.reciters).toEqual([
      { id: 7, name: "Verified", style: "Murattal", available: true },
      { id: 2_001_095, name: "أبوبكر الظبي", style: "Murattal", available: true },
    ]);
  });

  it("keeps only the unverified sample hidden while serving Abu Bakr Al-Dhabi officially", async () => {
    expect((await request(app({})).get("/api/quran/audio/2000114/114/3/timings")).status).toBe(404);
    expect((await request(app({})).get("/api/quran/audio/2001095/95/1/timings")).status).toBe(200);
    expect(getTimings).toHaveBeenCalledWith(2_001_095, 95, 1);
  });

  it("allows anonymous readers to load verified timings", async () => {
    const response = await request(app({})).get("/api/quran/audio/1/1/1/timings");
    expect(response.status).toBe(200);
    expect(getTimings).toHaveBeenCalledWith(1, 1, 1);
  });

  it("returns 400 for invalid identifiers and canonical verses", async () => {
    expect((await request(app()).get("/api/quran/audio/nope/1/1/timings")).status).toBe(400);
    expect((await request(app()).get("/api/quran/audio/1/1/8/timings")).status).toBe(400);
    expect(getTimings).not.toHaveBeenCalled();
  });

  it("returns 404 for a verified mapping or unavailable verse", async () => {
    getTimings.mockRejectedValue(new Error("Quran Foundation timing mapping is unavailable"));
    const response = await request(app()).get("/api/quran/audio/8/1/1/timings");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Verified Quran timing data is unavailable" });
  });

  it("keeps malformed/schema and upstream failures at 503", async () => {
    getTimings.mockRejectedValueOnce(new Error("Quran Foundation verse timings are malformed"));
    expect((await request(app()).get("/api/quran/audio/1/1/1/timings")).status).toBe(503);
    getTimings.mockRejectedValueOnce(new Error("upstream unavailable"));
    expect((await request(app()).get("/api/quran/audio/1/1/1/timings")).status).toBe(503);
  });

  it("returns normalized timings with a public immutable cache header", async () => {
    const response = await request(app()).get("/api/quran/audio/1/1/1/timings");
    expect(response.status).toBe(200);
    expect(response.body.synchronized).toBe(true);
    expect(response.headers["cache-control"]).toContain("public");
    expect(response.headers["cache-control"]).toContain("immutable");
  });
});