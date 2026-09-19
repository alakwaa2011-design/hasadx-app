import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { objectStorageDownloadMock } = vi.hoisted(() => ({
  objectStorageDownloadMock: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  parseObjectPath: (path: string) => {
    const parts = path.replace(/^\/+/, "").split("/");
    return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
  },
  objectStorageClient: {
    bucket: () => ({
      file: () => ({ download: objectStorageDownloadMock }),
    }),
  },
}));

import {
  getQuranFoundationAudioUrl,
  getQuranFoundationWordAudioUrl,
  getQuranFoundationAyahTimings,
  getQuranFoundationAyahEducation,
  getQuranFoundationMadaniPage,
  getQuranFoundationSurahContent,
  listQuranFoundationSurahs,
  listQuranFoundationReciters,
  listQuranFoundationDisplayReciters,
  ABU_BAKR_AL_DHABI_RECITATION_ID,
  SADIQ_ALNIZAM_RECITATION_ID,
  resetQuranFoundationClientForTests,
} from "../lib/quran-foundation-client";
import qcfPageOneFixture from "./fixtures/qcf-v2-page-1.json";

const originalClientId = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID;
const originalClientSecret = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET;
const originalPrivateObjectDir = process.env.PRIVATE_OBJECT_DIR;
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
    process.env.PRIVATE_OBJECT_DIR = "/test-bucket/private";
    objectStorageDownloadMock.mockReset().mockResolvedValue([Buffer.from(JSON.stringify({
      1: [441, 6_580, 12_056, 18_192, 22_204, 26_834, 32_988, 53_760],
      94: [369, 10_116, 14_416, 19_723, 23_503, 28_282, 33_187, 37_779, 41_587],
    }))]);
    resetQuranFoundationClientForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetQuranFoundationClientForTests();
    if (originalClientId === undefined) delete process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID;
    else process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET;
    else process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET = originalClientSecret;
    if (originalPrivateObjectDir === undefined) delete process.env.PRIVATE_OBJECT_DIR;
    else process.env.PRIVATE_OBJECT_DIR = originalPrivateObjectDir;
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
        reciters: [{ id: 7, reciter_name: "مشاري العفاسي", style: "Murattal" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: { verse_key: "2:255", audio: { url: "Alafasy/mp3/002255.mp3" } },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAudioUrl(7, 2, 255))
      .resolves.toBe("https://verses.quran.foundation/Alafasy/mp3/002255.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await listQuranFoundationReciters();
    const second = await listQuranFoundationReciters();
    expect(first).toHaveLength(2);
    expect(first.map((reciter) => reciter.id).sort()).toEqual([6, 7]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows only verified recitation styles and keeps child-repeat distinct from Muallim", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [
          { id: 1, reciter_name: "عبد الباسط عبد الصمد", style: "Mujawwad" },
          { id: 2, reciter_name: "عبد الباسط عبد الصمد", style: "Murattal" },
          { id: 6, reciter_name: "محمود خليل الحصري", style: null },
          { id: 8, reciter_name: "محمد صديق المنشاوي", style: "Mujawwad" },
          { id: 9, reciter_name: "محمد صديق المنشاوي", style: "Murattal" },
          { id: 12, reciter_name: "محمود خليل الحصري", style: "Muallim" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reciters: [
          { id: 1, reciter_name: "عبد الباسط عبد الصمد - مجود", style: "Mujawwad" },
          { id: 6, reciter_name: "محمود خليل الحصري", style: "Murattal" },
          { id: 168, reciter_name: "محمد صديق المنشاوي", style: "Kids repeat" },
          { id: 176, reciter_name: "قارئ تجريبي", style: "Murattal" },
        ],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const display = await listQuranFoundationDisplayReciters();

    expect(display.map(({ id, style }) => ({ id, style }))).toEqual([
      { id: ABU_BAKR_AL_DHABI_RECITATION_ID, style: "Murattal" },
      { id: SADIQ_ALNIZAM_RECITATION_ID, style: "Murattal" },
      { id: 1, style: "Mujawwad" },
      { id: 2, style: "Murattal" },
      { id: 1_000_168, style: "Kids repeat" },
      { id: 8, style: "Mujawwad" },
      { id: 9, style: "Murattal" },
      { id: 1_000_006, style: "Murattal" },
    ]);
    expect(display.some((item) => item.style === "Muallim")).toBe(false);
    expect(display.find((item) => item.id === SADIQ_ALNIZAM_RECITATION_ID)).toMatchObject({
      name: "صادق النظام",
      available: false,
    });
    expect(display.find((item) => item.id === ABU_BAKR_AL_DHABI_RECITATION_ID)).toMatchObject({
      name: "أبوبكر الظبي",
      available: true,
    });
  });

  it("keeps the Sadiq Al-Nizam sample behind the verified-surah timing contract", async () => {
    await expect(getQuranFoundationAyahTimings(SADIQ_ALNIZAM_RECITATION_ID, 114, 3))
      .resolves.toMatchObject({
        recitationId: SADIQ_ALNIZAM_RECITATION_ID,
        verseKey: "114:3",
        audioUrl: "/api/storage/objects/uploads/quran-recitation/sadiq-alnizam/114.mp3",
        verseStartMs: 15_920,
        verseEndMs: 25_720,
        synchronized: true,
      });
    await expect(getQuranFoundationAyahTimings(SADIQ_ALNIZAM_RECITATION_ID, 114, 1))
      .resolves.toMatchObject({ verseStartMs: 286, verseEndMs: 11_680 });
    await expect(getQuranFoundationAyahTimings(SADIQ_ALNIZAM_RECITATION_ID, 114, 6))
      .resolves.toMatchObject({ verseStartMs: 42_280, verseEndMs: 48_216 });
    await expect(getQuranFoundationAyahTimings(SADIQ_ALNIZAM_RECITATION_ID, 113, 1))
      .rejects.toThrow("timing mapping is unavailable");
    await expect(getQuranFoundationAudioUrl(SADIQ_ALNIZAM_RECITATION_ID, 114, 1))
      .resolves.toBe("/api/storage/objects/uploads/quran-recitation/sadiq-alnizam/114.mp3");
  });

  it("loads Abu Bakr Al-Dhabi timings for every surah while preserving the existing At-Tin sample", async () => {
    await expect(getQuranFoundationAyahTimings(ABU_BAKR_AL_DHABI_RECITATION_ID, 1, 1))
      .resolves.toMatchObject({
        verseKey: "1:1",
        audioUrl: "/api/storage/objects/uploads/quran-recitation/abu-bakr-al-dhabi/001.mp3",
        verseStartMs: 441,
        verseEndMs: 6_580,
      });
    await expect(getQuranFoundationAyahTimings(ABU_BAKR_AL_DHABI_RECITATION_ID, 94, 8))
      .resolves.toMatchObject({
        verseKey: "94:8",
        audioUrl: "/api/storage/objects/uploads/quran-recitation/abu-bakr-al-dhabi/094.mp3",
        verseStartMs: 37_779,
        verseEndMs: 41_587,
      });
    await expect(getQuranFoundationAyahTimings(ABU_BAKR_AL_DHABI_RECITATION_ID, 95, 1))
      .resolves.toMatchObject({
        recitationId: ABU_BAKR_AL_DHABI_RECITATION_ID,
        verseKey: "95:1",
        audioUrl: "/api/storage/objects/uploads/a1210437-e13f-4f8c-809f-0148d6028867.mp3",
        verseStartMs: 288,
        verseEndMs: 10_366,
        synchronized: true,
      });
    await expect(getQuranFoundationAyahTimings(ABU_BAKR_AL_DHABI_RECITATION_ID, 95, 8))
      .resolves.toMatchObject({ verseStartMs: 53_431, verseEndMs: 61_727 });
    await expect(getQuranFoundationAudioUrl(ABU_BAKR_AL_DHABI_RECITATION_ID, 95, 1))
      .resolves.toBe("/api/storage/objects/uploads/a1210437-e13f-4f8c-809f-0148d6028867.mp3");
    expect(objectStorageDownloadMock).toHaveBeenCalledTimes(1);
  });

  it("resolves only the exact official word-by-word audio path", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: {
          verse_key: "6:3",
          words: [
            { position: 1, char_type_name: "word", audio_url: "wbw/006_003_004.mp3" },
            { position: 2, char_type_name: "word", audio_url: "https://example.com/not-trusted.mp3" },
          ],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationWordAudioUrl(6, 3, 1))
      .resolves.toBe("https://audio.qurancdn.com/wbw/006_003_004.mp3");
    await expect(getQuranFoundationWordAudioUrl(6, 3, 1))
      .resolves.toBe("https://audio.qurancdn.com/wbw/006_003_004.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resetQuranFoundationClientForTests();
    const untrustedFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        verse: {
          verse_key: "6:3",
          words: [
            { position: 2, char_type_name: "word", audio_url: "https://example.com/not-trusted.mp3" },
          ],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", untrustedFetch);
    await expect(getQuranFoundationWordAudioUrl(6, 3, 2))
      .rejects.toThrow("unavailable");
  });

  it("rejects audio identifiers that are absent from the trusted recitation catalog", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAudioUrl(999, 1, 1))
      .rejects.toThrow("not in the trusted catalog");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps native recitation fallback ayah-scoped and rejects chapter-only fallback audio", async () => {
    const nativeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 159, reciter_name: "Chapter Only" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ verse: { verse_key: "2:255", audio: { url: "Alafasy/ayah.mp3" } } }), { status: 200 }));
    vi.stubGlobal("fetch", nativeFetch);
    await expect(getQuranFoundationAudioUrl(7, 2, 255)).resolves.toContain("ayah.mp3");
    expect(nativeFetch.mock.calls[3][0]).toContain("verses/by_key/2:255");

    resetQuranFoundationClientForTests();
    const chapterFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 160, reciter_name: "Chapter Only" }] }), { status: 200 }));
    vi.stubGlobal("fetch", chapterFetch);
    await expect(getQuranFoundationAudioUrl(1_000_160, 1, 1))
      .rejects.toThrow("require synchronized timing playback");
    expect(chapterFetch).toHaveBeenCalledTimes(3);
  });

  it("resolves localized merged chapter IDs by reversible membership, not name equality", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reciters: [{ id: 160, reciter_name: "Bandar Baleela", translated_name: { name: "بندر بليلة" } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: { audio_url: "https://download.quranicaudio.com/chapter.mp3",
          timestamps: [{ verse_key: "1:1", timestamp_from: 100, timestamp_to: 500, segments: [[1, 100, 200]] }] },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAyahTimings(1_000_160, 1, 1))
      .resolves.toMatchObject({ recitationId: 1_000_160, verseKey: "1:1", segments: [{ wordPosition: 1, startMs: 0, endMs: 100 }] });

    resetQuranFoundationClientForTests();
    const malformedFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 159, reciter_name: "Maher al-Muaiqly" }] }), { status: 200 }));
    vi.stubGlobal("fetch", malformedFetch);
    await expect(getQuranFoundationAyahTimings(1_000_999, 1, 1)).rejects.toThrow("mapping is unavailable");
  });

  it("uses Maher Al-Muaiqly's standard ayah-scoped recording instead of the dated chapter recording", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 7, reciter_name: "مشاري العفاسي", style: "Murattal" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reciters: [{ id: 159, reciter_name: "Maher al-Muaiqly", translated_name: { name: "ماهر المعيقلي" }, style: "Murattal" }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAyahTimings(1_000_159, 1, 1))
      .rejects.toThrow("ayah-scoped playback");
    await expect(getQuranFoundationAudioUrl(1_000_159, 2, 255))
      .resolves.toBe("https://everyayah.com/data/MaherAlMuaiqly128kbps/002255.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("validates chapter-reciter identity with object styles and permits null ayah styles", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 6, reciter_name: "Khalil", style: null }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reciters: [{ id: 6, reciter_name: "Khaleel", style: { name: "Murattal" } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: { audio_url: "chapter.mp3", timestamps: [{ verse_key: "1:1", timestamp_from: 1_000, timestamp_to: 2_000,
          segments: [[2, 1_200, 1_400], [1, 1_050, 1_100]] }] },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAyahTimings(6, 1, 1)).resolves.toMatchObject({
      recitationId: 6, verseKey: "1:1",
      segments: [{ wordPosition: 1, startMs: 50, endMs: 100 }, { wordPosition: 2, startMs: 200, endMs: 400 }],
      audioUrl: "https://verses.quran.foundation/chapter.mp3", verseStartMs: 1_000, verseEndMs: 2_000, synchronized: true,
    });
  });

  it("supports Mohamed/Muhammad aliases and rejects exact identity mismatches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recitations: [{ id: 9, reciter_name: "Muhammad", style: "Murattal" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        reciters: [{ id: 9, reciter_name: "Mohamed", style: "Murattal" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: { audio_url: "chapter.mp3", timestamps: [{ verse_key: "1:1", timestamp_from: 0, timestamp_to: 10, segments: [[1, 0, 10]] }] },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAyahTimings(9, 1, 1)).resolves.toHaveProperty("segments");

    resetQuranFoundationClientForTests();
    const mismatchFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 9, reciter_name: "Other", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 9, reciter_name: "Mohamed", style: "Murattal" }] }), { status: 200 }));
    vi.stubGlobal("fetch", mismatchFetch);
    await expect(getQuranFoundationAyahTimings(9, 1, 1)).rejects.toThrow("mapping is unavailable");
  });

  it("discards malformed word timings while preserving the exact ayah range", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ audio_file: { audio_url: "chapter.mp3", timestamps: [{ verse_key: "1:1", timestamp_from: 0, timestamp_to: 10, segments: [[1, 20, 10], [1, 30, 40]] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAyahTimings(1, 1, 1)).resolves.toMatchObject({
      verseStartMs: 0,
      verseEndMs: 10,
      segments: [],
      synchronized: true,
    });
  });

  it("ignores Quran Foundation marker entries mixed with valid word timing triplets", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 168, reciter_name: "Kids repeat" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: {
          audio_url: "https://download.quranicaudio.com/kids-repeat.mp3",
          timestamps: [{
            verse_key: "6:3",
            timestamp_from: 1_000,
            timestamp_to: 2_000,
            segments: [
              [91030],
              [1],
              [1, 1_050, 1_200],
              [2, 1_300, 1_500],
              [1, 1_550, 1_700],
              [2, 1_750, 1_900],
              [3, 1_950, 1_850],
              [69661],
            ],
          }],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAyahTimings(1_000_168, 6, 3)).resolves.toMatchObject({
      recitationId: 1_000_168,
      verseKey: "6:3",
      segments: [
        { wordPosition: 1, startMs: 50, endMs: 200 },
        { wordPosition: 2, startMs: 300, endMs: 500 },
        { wordPosition: 1, startMs: 550, endMs: 700 },
        { wordPosition: 2, startMs: 750, endMs: 900 },
      ],
    });
  });

  it("keeps exact ayah playback when official word segments contain markers only", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 7, reciter_name: "A" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 168, reciter_name: "Kids repeat" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: {
          audio_url: "https://download.quranicaudio.com/kids-repeat.mp3",
          timestamps: [{
            verse_key: "6:32",
            timestamp_from: 10_000,
            timestamp_to: 12_000,
            segments: [[10_000], [12_000]],
          }],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getQuranFoundationAyahTimings(1_000_168, 6, 32)).resolves.toMatchObject({
      verseStartMs: 10_000,
      verseEndMs: 12_000,
      segments: [],
      synchronized: true,
    });
  });

  it("rejects invalid chapter timestamp ranges and untrusted chapter audio URLs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ audio_file: {
        audio_url: "https://evil.example/chapter.mp3",
        timestamps: [{ verse_key: "1:1", timestamp_from: 10, timestamp_to: 20, segments: [[1, 20, 30]] }],
      } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getQuranFoundationAyahTimings(1, 1, 1)).rejects.toThrow("untrusted chapter audio URL");
  });

  it("deduplicates concurrent timing requests and caches the immutable result", async () => {
    let release!: (response: Response) => void;
    const timingResponse = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recitations: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reciters: [{ id: 1, reciter_name: "A", style: "Murattal" }] }), { status: 200 }))
      .mockReturnValueOnce(timingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const first = getQuranFoundationAyahTimings(1, 1, 1);
    const second = getQuranFoundationAyahTimings(1, 1, 1);
    release(new Response(JSON.stringify({ audio_file: { audio_url: "chapter.mp3", timestamps: [{ verse_key: "1:1", timestamp_from: 0, timestamp_to: 10, segments: [[1, 0, 10]] }] } }), { status: 200 }));
    const [left, right] = await Promise.all([first, second]);
    expect(left).toBe(right);
    expect(Object.isFrozen(left)).toBe(true);
    await getQuranFoundationAyahTimings(1, 1, 1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
        reciters: [{ id: 7, reciter_name: "مشاري العفاسي" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audio_file: { audio_url: null },
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
        reciters: [{ id: 7, reciter_name: "مشاري العفاسي" }],
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