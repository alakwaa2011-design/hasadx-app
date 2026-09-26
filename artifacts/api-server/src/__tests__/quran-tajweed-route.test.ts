import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { getWordTajweed } = vi.hoisted(() => ({
  getWordTajweed: vi.fn(),
}));
vi.mock("../lib/quran-foundation-client", () => ({
  getQuranFoundationWordTajweed: getWordTajweed,
  getQuranFoundationAudioUrl: vi.fn(),
  getQuranFoundationWordAudioUrl: vi.fn(),
  getQuranFoundationAyahTimings: vi.fn(),
  getQuranFoundationMadaniPage: vi.fn(),
  getQuranFoundationSurahContent: vi.fn(),
  getQuranFoundationAyahEducation: vi.fn(),
  listQuranFoundationSurahs: vi.fn(),
  listQuranFoundationReciters: vi.fn(),
  listQuranFoundationDisplayReciters: vi.fn(),
  SADIQ_ALNIZAM_RECITATION_ID: 2_000_114,
  ABU_BAKR_AL_DHABI_RECITATION_ID: 2_001_095,
  isUnverifiedQuranRecitation: () => false,
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

const SAMPLE_TAJWEED = {
  verseKey: "1:3",
  wordId: 4,
  position: 1,
  text: "ٱلرَّحۡمَـٰنِ",
  rules: [
    {
      class: "ham_wasl",
      letters: "ٱ",
      nameAr: "همزة الوصل",
      descriptionAr: "همزة تُنطق عند البدء بالكلمة.",
      color: "#a5a5a5",
      colorNameAr: "رمادي",
    },
  ],
  source: {
    id: null,
    name: "أحكام التجويد المعتمدة (مجمع الملك فهد)",
    provider: "Quran Foundation",
    version: "Content API v4 · text_uthmani_tajweed",
  },
};

describe("Quran word Tajweed route", () => {
  beforeEach(() => {
    getWordTajweed.mockReset();
  });

  it("returns the verified Tajweed rules for a word with a public cache header", async () => {
    getWordTajweed.mockResolvedValue(SAMPLE_TAJWEED);
    const response = await request(app({})).get("/api/quran/tajweed/word/1/3/1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(SAMPLE_TAJWEED);
    expect(getWordTajweed).toHaveBeenCalledWith(1, 3, 1);
    expect(response.headers["cache-control"]).toContain("public");
  });

  it("returns an empty rules array as a normal 200 response, not an error, when no rule applies", async () => {
    getWordTajweed.mockResolvedValue({ ...SAMPLE_TAJWEED, rules: [] });
    const response = await request(app({})).get("/api/quran/tajweed/word/1/4/1");
    expect(response.status).toBe(200);
    expect(response.body.rules).toEqual([]);
  });

  it("does not require authentication to read Tajweed rules", async () => {
    getWordTajweed.mockResolvedValue(SAMPLE_TAJWEED);
    const response = await request(app({})).get("/api/quran/tajweed/word/1/3/1");
    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid surah, ayah, or word position", async () => {
    expect((await request(app()).get("/api/quran/tajweed/word/0/1/1")).status).toBe(400);
    expect((await request(app()).get("/api/quran/tajweed/word/1/1/0")).status).toBe(400);
    expect((await request(app()).get("/api/quran/tajweed/word/1/8/1")).status).toBe(400);
    expect(getWordTajweed).not.toHaveBeenCalled();
  });

  it("returns 404 when the selected word is not part of the ayah", async () => {
    getWordTajweed.mockRejectedValue(new Error("Selected Quran word is not part of the ayah"));
    const response = await request(app()).get("/api/quran/tajweed/word/1/1/50");
    expect(response.status).toBe(404);
  });

  it("keeps upstream/schema failures at 503 without fabricating rule data", async () => {
    getWordTajweed.mockRejectedValue(new Error("upstream unavailable"));
    const response = await request(app()).get("/api/quran/tajweed/word/1/1/1");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "Official Tajweed rule data is temporarily unavailable" });
  });
});
