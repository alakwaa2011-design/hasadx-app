import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { getEducation } = vi.hoisted(() => ({
  getEducation: vi.fn(),
}));

vi.mock("../lib/quran-foundation-client", () => ({
  getQuranFoundationAyahEducation: getEducation,
  getQuranFoundationAudioUrl: vi.fn(),
  getQuranFoundationMadaniPage: vi.fn(),
  getQuranFoundationSurahContent: vi.fn(),
  listQuranFoundationSurahs: vi.fn(),
}));

import quranRouter from "../routes/quran";

function appWithSession(session: { teacherId?: number; studentAccountId?: number }) {
  const app = express();
  app.use((req: any, _res, next) => {
    req.session = session;
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", quranRouter);
  return app;
}

const sourcedResponse = {
  surahNumber: 2,
  ayahNumber: 255,
  verseKey: "2:255",
  selectedWord: {
    id: 1,
    position: 1,
    text: "ٱللَّهُ",
    meaning: "الله الحي القيوم",
    source: { id: 16, name: "التفسير الميسر", provider: "Quran Foundation", version: "Content API v4" },
    arabicMeaning: {
      text: "المعبود بحق",
      source: { id: 519, name: "الميسر في غريب القرآن", provider: "Quranic Universal Library (QUL)", version: "Tafsir resource 519" },
    },
  },
  tafsir: {
    text: "الله الحي القيوم",
    source: { id: 16, name: "التفسير الميسر", provider: "Quran Foundation", version: "Content API v4" },
  },
};

describe("sourced Quran education route", () => {
  beforeEach(() => {
    getEducation.mockReset();
    getEducation.mockResolvedValue(sourcedResponse);
  });

  it("serves sourced education content without requiring a teacher or student session", async () => {
    const response = await request(appWithSession({}))
      .get("/api/quran/education/2/255?wordPosition=1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(sourcedResponse);
    expect(getEducation).toHaveBeenCalledWith(2, 255, 1);
  });

  it.each([
    ["teacher", { teacherId: 41 }],
    ["student", { studentAccountId: 72 }],
  ])("serves account-neutral sourced content to a signed-in %s", async (_role, session) => {
    const response = await request(appWithSession(session))
      .get("/api/quran/education/2/255?wordPosition=1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(sourcedResponse);
    expect(response.body).not.toHaveProperty("teacherId");
    expect(response.body).not.toHaveProperty("studentAccountId");
    expect(getEducation).toHaveBeenLastCalledWith(2, 255, 1);
  });

  it("rejects an ayah outside its canonical surah before calling the provider", async () => {
    const response = await request(appWithSession({ teacherId: 41 }))
      .get("/api/quran/education/2/287?wordPosition=1");

    expect(response.status).toBe(400);
    expect(getEducation).not.toHaveBeenCalled();
  });
});