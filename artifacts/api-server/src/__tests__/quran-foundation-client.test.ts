import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listQuranFoundationSurahs,
  resetQuranFoundationClientForTests,
} from "../lib/quran-foundation-client";

const originalClientId = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID;
const originalClientSecret = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET;

function chaptersPayload(count = 114) {
  return {
    chapters: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name_arabic: `سورة ${index + 1}`,
      verses_count: index + 3,
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
    expect(first[0]).toEqual({ number: 1, arabicName: "سورة 1", ayahCount: 3 });
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
});