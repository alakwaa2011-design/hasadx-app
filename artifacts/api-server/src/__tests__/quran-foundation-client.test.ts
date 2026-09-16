import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getQuranFoundationAudioUrl,
  getQuranFoundationAyahEducation,
  getQuranFoundationMadaniPage,
  getQuranFoundationSurahContent,
  listQuranFoundationSurahs,
  listQuranFoundationReciters,
  resetQuranFoundationClientForTests,
} from "../lib/quran-foundation-client";
import qcfPageOneFixture from "./fixtures/qcf-v2-page-1.json";

const originalClientId = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID;
const originalClientSecret = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET;
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
  135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
  85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4,
  7, 3, 6, 3, 5, 4, 5, 6,
] as const;

function chaptersPayload(count = 114) {
  return {
    chapters: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name_arabic: `سورة ${index + 1}`,
      verses_count: AYAH_COUNTS[index],
    })),
  };
}

describe("Quran Foundation client", () => {
  beforeEach(() => {
    process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID = "test-client";
    process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET = "test-secret";
    resetQuranFoundationClientForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetQuranFoundationClientForTests();
    if (originalClientId === undefined) delete process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID;
    else process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET;
    else process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET = originalClientSecret;
  });

  it("authenticates server-side, normalizes all chapters, and caches the catalog", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chaptersPayload()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await listQuranFoundationSurahs();
    const second = await listQuranFoundationSurahs();

    expect(first).toHaveLength(114);
    expect(first[0]).toEqual({ number: 1, arabicName: "سورة 1", ayahCount: 7 });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      "x-auth-token": "access-token",
      "x-client-id": "test-client",
    });
  });

  it("refreshes its app token once after an unauthorized content response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "expired-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "fresh-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chaptersPayload()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listQuranFoundationSurahs()).resolves.toHaveLength(114);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1].headers["x-auth-token"]).toBe("fresh-token");
  });

  it("rejects an incomplete production catalog so callers can use a safe fallback", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chaptersPayload(2)), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listQuranFoundationSurahs()).rejects.toThrow("catalog is incomplete");
  });

  it("normalizes and caches official Uthmani surah text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(chaptersPayload()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verses: Array.from({ length: 7 }, (_, index) => ({
          verse_key: `1:${index + 1}`,
          text_uthmani: `الآية ${index + 1}`,
        })),
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getQuranFoundationSurahContent(1);
    const second = await getQuranFoundationSurahContent(1);

    expect(first.index).toBe(1);
    expect(first.name).toBe("سورة 1");
    expect(first.ayahs).toHaveLength(7);
    expect(first.ayahs[0]).toEqual({ index: 1, text: "الآية 1", bismillah: null });
    expect(first.source).toBe("quran_foundation");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("normalizes only allowlisted Quran Foundation audio URLs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي", style: "Murattal" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: { verse_key: "2:255", audio: { url: "Alafasy/mp3/002255.mp3" } },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAudioUrl(7, 2, 255))
      .resolves.toBe("https://verses.quran.foundation/Alafasy/mp3/002255.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("normalizes and caches the trusted recitation catalog", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [
          { id: 7, reciter_name: "مشاري العفاسي", style: "Murattal" },
          { id: 6, reciter_name: "محمود خليل الحصري", style: null },
        ],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await listQuranFoundationReciters();
    const second = await listQuranFoundationReciters();
    expect(first).toHaveLength(2);
    expect(first.map((reciter) => reciter.id).sort()).toEqual([6, 7]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects audio identifiers that are absent from the trusted recitation catalog", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAudioUrl(999, 1, 1))
      .rejects.toThrow("not in the trusted catalog");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns only source-attributed word context and tafsir, then caches it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: {
          verse_key: "2:255",
          words: [
            {
              id: 87148,
              position: 1,
              char_type_name: "word",
              text_uthmani: "ٱللَّهُ",
              translation: { text: "Allah", language_name: "english" },
            },
            {
              id: 87149,
              position: 2,
              char_type_name: "word",
              text_uthmani: "لَآ",
              translation: { text: "(there is) no", language_name: "english" },
            },
            { id: 87150, position: 3, char_type_name: "end", text_uthmani: "٢٥٥" },
          ],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tafsir: {
          resource_id: 16,
          text: "الله <span class=\"green\">الحي القيوم</span>",
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getQuranFoundationAyahEducation(2, 255, 2);
    const second = await getQuranFoundationAyahEducation(2, 255, 2);

    expect(first.verseKey).toBe("2:255");
    expect(first.selectedWord).toMatchObject({
      id: 87149,
      position: 2,
      text: "لَآ",
      meaning: "(there is) no",
      source: {
        id: null,
        name: "Quran.com Word-by-Word Translation",
        provider: "Quran Foundation",
        version: "Content API v4 · English",
      },
    });
    expect(first.tafsir.text).toBe("الله الحي القيوم");
    expect(first.tafsir.source).toMatchObject({ id: 16, name: "التفسير الميسر" });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects noncanonical ayah numbers before requesting sourced content", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAyahEducation(2, 287, 1))
      .rejects.toThrow("Invalid Quran surah or ayah number");
    await expect(getQuranFoundationAyahEducation(115, 1, 1))
      .rejects.toThrow("Invalid Quran surah or ayah number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not invent a word meaning when the documented translation is empty", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: {
          verse_key: "1:1",
          words: [{
            id: 1,
            position: 1,
            char_type_name: "word",
            text_uthmani: "بِسْمِ",
            translation: { text: null, language_name: "english" },
          }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tafsir: { resource_id: 16, text: "أبتدئ قراءة القرآن باسم الله" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getQuranFoundationAyahEducation(1, 1, 1);

    expect(result.selectedWord).toBeNull();
    expect(result.tafsir.source).toMatchObject({ id: 16, name: "التفسير الميسر" });
  });

  it("rejects a canonical catalog with a wrong ayah count", async () => {
    const payload = chaptersPayload();
    (payload.chapters[1] as { verses_count: number }).verses_count = 285;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listQuranFoundationSurahs()).rejects.toThrow("chapter fields are invalid");
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
    expect(fetchMock.mock.calls[1][1].redirect).toBe("error");
  });

  it("rejects audio for the wrong verse or a nonstandard trusted-host port", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: { verse_key: "2:254", audio: { url: "Alafasy/mp3/002255.mp3" } },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAudioUrl(7, 2, 255)).rejects.toThrow("audio response");

    resetQuranFoundationClientForTests();
    const secondFetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: {
          verse_key: "2:255",
          audio: { url: "https://verses.quran.foundation:444/Alafasy/mp3/002255.mp3" },
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", secondFetchMock);
    await expect(getQuranFoundationAudioUrl(7, 2, 255)).rejects.toThrow("untrusted audio URL");
  });

  it("normalizes, integrity-checks, and caches complete QCF V2 Madani page lines", async () => {
    const pagePayload = JSON.stringify(qcfPageOneFixture);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(pagePayload, { status: 200 }))
      .mockResolvedValueOnce(new Response(pagePayload, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getQuranFoundationMadaniPage(1);
    const second = await getQuranFoundationMadaniPage(1);

    expect(first.pageNumber).toBe(1);
    expect(first.juzNumber).toBe(1);
    expect(first.hizbNumber).toBe(1);
    expect(first.rubElHizbNumber).toBe(1);
    expect(first.surahStarts).toEqual([{ surahNumber: 1, lineNumber: 9 }]);
    expect(first.lines).toHaveLength(7);
    expect(first.lines.flatMap((line) => line.words)).toHaveLength(36);
    expect(first.source).toBe("quran_foundation_qcf_v2");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a truncated QCF page instead of caching incomplete Quran content", async () => {
    const truncatedPayload = structuredClone(qcfPageOneFixture);
    truncatedPayload.verses[0].words.pop();
    const payload = JSON.stringify(truncatedPayload);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(payload, { status: 200 }))
      .mockResolvedValueOnce(new Response(payload, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationMadaniPage(1))
      .rejects.toThrow("canonical integrity validation");
  });
});