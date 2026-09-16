import { createHash } from "node:crypto";
import qcfV2Integrity from "../data/qcf-v2-page-integrity.json";

const OAUTH_BASE_URL = "https://oauth2.quran.foundation";
const CONTENT_BASE_URL = "https://apis.quran.foundation";
const TOKEN_EARLY_REFRESH_MS = 60_000;
const CATALOG_CACHE_MS = 24 * 60 * 60 * 1_000;
const SURAH_CACHE_MS = 24 * 60 * 60 * 1_000;
const MADANI_PAGE_CACHE_MS = 24 * 60 * 60 * 1_000;
const AUDIO_CACHE_MS = 7 * 24 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const VERSE_AUDIO_BASE_URL = "https://verses.quran.foundation";
const CANONICAL_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
  135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
  85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4,
  7, 3, 6, 3, 5, 4, 5, 6,
] as const;

export type QuranFoundationSurah = {
  number: number;
  arabicName: string;
  ayahCount: number;
};

export type QuranFoundationSurahContent = {
  index: number;
  name: string;
  ayahs: Array<{ index: number; text: string; bismillah: string | null }>;
  source: "quran_foundation";
};

export type QuranFoundationMadaniPage = {
  pageNumber: number;
  juzNumber: number;
  hizbNumber: number;
  rubElHizbNumber: number;
  surahStarts: Array<{
    surahNumber: number;
    lineNumber: number;
  }>;
  lines: Array<{
    lineNumber: number;
    words: Array<{
      id: number;
      position: number;
      verseKey: string;
      glyph: string;
      text: string;
      type: string;
    }>;
  }>;
  source: "quran_foundation_qcf_v2";
};

type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;
let tokenRequestPromise: Promise<string> | null = null;
let cachedCatalog: { value: QuranFoundationSurah[]; expiresAt: number } | null = null;
const cachedSurahs = new Map<number, { value: QuranFoundationSurahContent; expiresAt: number }>();
const cachedMadaniPages = new Map<number, { value: QuranFoundationMadaniPage; expiresAt: number }>();
const cachedAudio = new Map<string, { value: string; expiresAt: number }>();

function credentials() {
  const clientId = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_ID?.trim();
  const clientSecret = process.env.QURAN_FOUNDATION_PRODUCTION_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Quran Foundation production credentials are not configured");
  }
  return { clientId, clientSecret };
}

async function requestAccessToken(): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${OAUTH_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=content",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Quran Foundation token request failed with status ${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  if (typeof payload.access_token !== "string" || payload.access_token.length < 1) {
    throw new Error("Quran Foundation token response is missing access_token");
  }
  const expiresIn = typeof payload.expires_in === "number" && payload.expires_in > 0
    ? payload.expires_in
    : 3600;
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (expiresIn * 1000) - TOKEN_EARLY_REFRESH_MS,
  };
  return cachedToken.value;
}

async function accessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  if (!tokenRequestPromise) {
    tokenRequestPromise = requestAccessToken().finally(() => {
      tokenRequestPromise = null;
    });
  }
  return tokenRequestPromise;
}

async function requestContentJson(path: string, retryAuth = true): Promise<unknown> {
  const { clientId } = credentials();
  const token = await accessToken(!retryAuth);
  const response = await fetch(`${CONTENT_BASE_URL}/content/api/v4/${path}`, {
    headers: {
      "x-auth-token": token,
      "x-client-id": clientId,
    },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401 && retryAuth) {
    cachedToken = null;
    return requestContentJson(path, false);
  }
  if (!response.ok) {
    throw new Error(`Quran Foundation chapters request failed with status ${response.status}`);
  }
  return response.json();
}

async function requestChapters(): Promise<unknown> {
  return requestContentJson("chapters?language=ar");
}

function normalizeCatalog(payload: unknown): QuranFoundationSurah[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Quran Foundation chapters response is invalid");
  }
  const chapters = (payload as { chapters?: unknown }).chapters;
  if (!Array.isArray(chapters)) {
    throw new Error("Quran Foundation chapters response has no chapters array");
  }
  const normalized = chapters.map((chapter): QuranFoundationSurah => {
    if (!chapter || typeof chapter !== "object") {
      throw new Error("Quran Foundation chapter is invalid");
    }
    const value = chapter as Record<string, unknown>;
    if (
      !Number.isInteger(value.id)
      || typeof value.name_arabic !== "string"
      || !value.name_arabic.trim()
      || !Number.isInteger(value.verses_count)
      || value.verses_count !== CANONICAL_AYAH_COUNTS[value.id as number - 1]
    ) {
      throw new Error("Quran Foundation chapter fields are invalid");
    }
    return {
      number: value.id as number,
      arabicName: value.name_arabic.trim(),
      ayahCount: value.verses_count as number,
    };
  });
  if (normalized.length !== 114 || normalized.some((surah, index) => surah.number !== index + 1)) {
    throw new Error("Quran Foundation production catalog is incomplete");
  }
  return normalized;
}

export async function listQuranFoundationSurahs(): Promise<QuranFoundationSurah[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) {
    return cachedCatalog.value;
  }
  const value = normalizeCatalog(await requestChapters());
  cachedCatalog = { value, expiresAt: Date.now() + CATALOG_CACHE_MS };
  return value;
}

export async function getQuranFoundationSurahContent(surahNumber: number): Promise<QuranFoundationSurahContent> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new Error("Invalid Quran surah number");
  }
  const cached = cachedSurahs.get(surahNumber);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const catalog = await listQuranFoundationSurahs();
  const surah = catalog[surahNumber - 1];
  const payload = await requestContentJson(`quran/verses/uthmani?chapter_number=${surahNumber}`);
  const verses = payload && typeof payload === "object"
    ? (payload as { verses?: unknown }).verses
    : null;
  if (!Array.isArray(verses)) {
    throw new Error("Quran Foundation surah response has no verses array");
  }

  const ayahs = verses.map((verse, index) => {
    if (!verse || typeof verse !== "object") throw new Error("Quran Foundation verse is invalid");
    const value = verse as Record<string, unknown>;
    const expectedKey = `${surahNumber}:${index + 1}`;
    if (value.verse_key !== expectedKey || typeof value.text_uthmani !== "string" || !value.text_uthmani.trim()) {
      throw new Error("Quran Foundation verse fields are invalid");
    }
    return {
      index: index + 1,
      text: value.text_uthmani.trim(),
      bismillah: null,
    };
  });
  if (ayahs.length !== surah.ayahCount) {
    throw new Error("Quran Foundation surah content is incomplete");
  }

  const value: QuranFoundationSurahContent = {
    index: surahNumber,
    name: surah.arabicName,
    ayahs,
    source: "quran_foundation",
  };
  cachedSurahs.set(surahNumber, { value, expiresAt: Date.now() + SURAH_CACHE_MS });
  return value;
}

export async function getQuranFoundationMadaniPage(pageNumber: number): Promise<QuranFoundationMadaniPage> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    throw new Error("Invalid Madani Mushaf page number");
  }
  const cached = cachedMadaniPages.get(pageNumber);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pagePath = (page: number) =>
    `verses/by_page/${page}?mushaf=1&words=true&per_page=50&word_fields=code_v2,text_qpc_hafs,page_number,line_number,position`;
  const payloads = await Promise.all([
    pageNumber > 1 ? requestContentJson(pagePath(pageNumber - 1)) : Promise.resolve(null),
    requestContentJson(pagePath(pageNumber)),
    pageNumber < 604 ? requestContentJson(pagePath(pageNumber + 1)) : Promise.resolve(null),
  ]);
  const verses = payloads.flatMap((payload) => {
    const value = payload && typeof payload === "object"
      ? (payload as { verses?: unknown }).verses
      : null;
    return Array.isArray(value) ? value : [];
  });
  if (verses.length < 1) {
    throw new Error("Quran Foundation Madani page has no verses");
  }

  type StagedWord = QuranFoundationMadaniPage["lines"][number]["words"][number] & {
    lineNumber: number;
    surahNumber: number;
    verseNumber: number;
    juzNumber: number;
    hizbNumber: number;
    rubElHizbNumber: number;
  };
  const stagedWords = new Map<number, StagedWord>();
  for (const verse of verses) {
    if (!verse || typeof verse !== "object") throw new Error("Quran Foundation Madani verse is invalid");
    const verseValue = verse as Record<string, unknown>;
    if (
      typeof verseValue.verse_key !== "string"
      || !/^\d{1,3}:\d{1,3}$/.test(verseValue.verse_key)
      || !Number.isInteger(verseValue.juz_number)
      || !Number.isInteger(verseValue.hizb_number)
      || !Number.isInteger(verseValue.rub_el_hizb_number)
    ) {
      throw new Error("Quran Foundation Madani verse key is invalid");
    }
    const [surahNumber, verseNumber] = verseValue.verse_key.split(":").map(Number);
    if (!Array.isArray(verseValue.words)) {
      throw new Error("Quran Foundation Madani verse has no words");
    }
    for (const word of verseValue.words) {
      if (!word || typeof word !== "object") throw new Error("Quran Foundation Madani word is invalid");
      const value = word as Record<string, unknown>;
      if (value.page_number !== pageNumber) continue;
      if (
        !Number.isInteger(value.id)
        || !Number.isInteger(value.position)
        || !Number.isInteger(value.line_number)
        || (value.line_number as number) < 1
        || (value.line_number as number) > 15
        || typeof value.code_v2 !== "string"
        || !value.code_v2
        || typeof value.text_qpc_hafs !== "string"
        || typeof value.char_type_name !== "string"
      ) {
        throw new Error("Quran Foundation Madani word fields are invalid");
      }
      stagedWords.set(value.id as number, {
        id: value.id as number,
        position: value.position as number,
        verseKey: verseValue.verse_key,
        glyph: value.code_v2,
        text: value.text_qpc_hafs,
        type: value.char_type_name,
        lineNumber: value.line_number as number,
        surahNumber,
        verseNumber,
        juzNumber: verseValue.juz_number as number,
        hizbNumber: verseValue.hizb_number as number,
        rubElHizbNumber: verseValue.rub_el_hizb_number as number,
      });
    }
  }

  const orderedWords = [...stagedWords.values()].sort((left, right) =>
    left.lineNumber - right.lineNumber
    || left.surahNumber - right.surahNumber
    || left.verseNumber - right.verseNumber
    || left.position - right.position
  );
  const firstWord = orderedWords[0];
  if (!firstWord) {
    throw new Error("Quran Foundation Madani page has no words assigned to the requested page");
  }
  const expectedIntegrity = qcfV2Integrity.pages[String(pageNumber) as keyof typeof qcfV2Integrity.pages];
  const pageSignature = createHash("sha256")
    .update(orderedWords.map((word) =>
      `${word.id}:${word.position}:${word.lineNumber}:${word.verseKey}:${word.glyph}`
    ).join("|"))
    .digest("hex");
  if (
    !expectedIntegrity
    || orderedWords.length !== expectedIntegrity.wordCount
    || new Set(orderedWords.map((word) => word.lineNumber)).size !== expectedIntegrity.lineCount
    || pageSignature !== expectedIntegrity.signature
  ) {
    throw new Error("Quran Foundation Madani page failed canonical integrity validation");
  }
  const lineMap = new Map<number, QuranFoundationMadaniPage["lines"][number]["words"]>();
  const surahStartMap = new Map<number, number>();
  for (const word of orderedWords) {
    const words = lineMap.get(word.lineNumber) ?? [];
    words.push({
      id: word.id,
      position: word.position,
      verseKey: word.verseKey,
      glyph: word.glyph,
      text: word.text,
      type: word.type,
    });
    lineMap.set(word.lineNumber, words);
    if (word.verseNumber === 1 && !surahStartMap.has(word.surahNumber)) {
      surahStartMap.set(word.surahNumber, word.lineNumber);
    }
  }

  const lines = [...lineMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([lineNumber, words]) => ({ lineNumber, words }));
  if (lines.length < 1) {
    throw new Error("Quran Foundation Madani page has no renderable lines");
  }

  const value: QuranFoundationMadaniPage = {
    pageNumber,
    juzNumber: firstWord.juzNumber,
    hizbNumber: firstWord.hizbNumber,
    rubElHizbNumber: firstWord.rubElHizbNumber,
    surahStarts: [...surahStartMap.entries()].map(([surahNumber, lineNumber]) => ({
      surahNumber,
      lineNumber,
    })),
    lines,
    source: "quran_foundation_qcf_v2",
  };
  cachedMadaniPages.set(pageNumber, { value, expiresAt: Date.now() + MADANI_PAGE_CACHE_MS });
  return value;
}

export async function getQuranFoundationAudioUrl(
  recitationId: 3 | 6 | 7 | 9,
  surahNumber: number,
  ayahNumber: number,
): Promise<string> {
  const cacheKey = `${recitationId}:${surahNumber}:${ayahNumber}`;
  const cached = cachedAudio.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const payload = await requestContentJson(
    `verses/by_key/${surahNumber}:${ayahNumber}?language=ar&words=false&audio=${recitationId}`,
  );
  const verse = payload && typeof payload === "object"
    ? (payload as { verse?: unknown }).verse
    : null;
  const audio = verse && typeof verse === "object"
    ? (verse as { audio?: unknown }).audio
    : null;
  const verseKey = verse && typeof verse === "object"
    ? (verse as { verse_key?: unknown }).verse_key
    : null;
  const rawUrl = audio && typeof audio === "object"
    ? (audio as { url?: unknown }).url
    : null;
  if (verseKey !== `${surahNumber}:${ayahNumber}` || typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("Quran Foundation audio response has no URL");
  }

  const url = new URL(rawUrl, `${VERSE_AUDIO_BASE_URL}/`);
  if (url.origin !== VERSE_AUDIO_BASE_URL) {
    throw new Error("Quran Foundation returned an untrusted audio URL");
  }
  const value = url.toString();
  cachedAudio.set(cacheKey, { value, expiresAt: Date.now() + AUDIO_CACHE_MS });
  return value;
}

export function resetQuranFoundationClientForTests(): void {
  cachedToken = null;
  tokenRequestPromise = null;
  cachedCatalog = null;
  cachedSurahs.clear();
  cachedMadaniPages.clear();
  cachedAudio.clear();
}