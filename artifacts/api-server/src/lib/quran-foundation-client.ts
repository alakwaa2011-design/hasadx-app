import { createHash } from "node:crypto";
import qcfV2Integrity from "../data/qcf-v2-page-integrity.json";

const OAUTH_BASE_URL = "https://oauth2.quran.foundation";
const CONTENT_BASE_URL = "https://apis.quran.foundation";
const TOKEN_EARLY_REFRESH_MS = 60_000;
const CATALOG_CACHE_MS = 24 * 60 * 60 * 1_000;
const RECITATION_CATALOG_CACHE_MS = 24 * 60 * 60 * 1_000;
const SURAH_CACHE_MS = 24 * 60 * 60 * 1_000;
const MADANI_PAGE_CACHE_MS = 24 * 60 * 60 * 1_000;
const AUDIO_CACHE_MS = 7 * 24 * 60 * 60 * 1_000;
const TIMINGS_CACHE_MS = 30 * 24 * 60 * 60 * 1_000;

const EDUCATION_CACHE_MS = 24 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const VERSE_AUDIO_BASE_URL = "https://verses.quran.foundation";
const TRUSTED_AUDIO_ORIGINS = new Set([
  VERSE_AUDIO_BASE_URL,
  "https://download.quranicaudio.com",
  "https://audio.qurancdn.com",
]);

const TAFSIR_MUYASSAR_RESOURCE_ID = 16;
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

export type QuranFoundationReciter = {
  id: number;
  name: string;
  style: string | null;
};

export type QuranFoundationTimingSegment = {
  wordPosition: number;
  startMs: number;
  endMs: number;
};

export type QuranFoundationAyahTimings = {
  recitationId: number;
  verseKey: string;
  audioUrl: string;
  verseStartMs: number;
  verseEndMs: number;
  segments: readonly QuranFoundationTimingSegment[];
  synchronized: true;
};

type QuranFoundationChapterReciter = QuranFoundationReciter & { chapterReciterId: number };

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

export type QuranFoundationAyahEducation = {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  selectedWord: {
    id: number;
    position: number;
    text: string;
    meaning: string;
    source: typeof WORD_BY_WORD_SOURCE;
  } | null;
  tafsir: {
    text: string;
    source: typeof TAFSIR_MUYASSAR_SOURCE;
  };
};
type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;
let tokenRequestPromise: Promise<string> | null = null;
let cachedCatalog: { value: QuranFoundationSurah[]; expiresAt: number } | null = null;
let cachedRecitationCatalog: { value: QuranFoundationReciter[]; expiresAt: number } | null = null;
let cachedChapterReciterCatalog: { value: QuranFoundationChapterReciter[]; expiresAt: number } | null = null;
const cachedSurahs = new Map<number, { value: QuranFoundationSurahContent; expiresAt: number }>();
const cachedMadaniPages = new Map<number, { value: QuranFoundationMadaniPage; expiresAt: number }>();
const cachedAudio = new Map<string, { value: string; expiresAt: number }>();
const cachedTimings = new Map<string, { value: QuranFoundationAyahTimings; expiresAt: number }>();
const timingRequests = new Map<string, Promise<QuranFoundationAyahTimings>>();

const cachedEducation = new Map<string, { value: QuranFoundationAyahEducation; expiresAt: number }>();
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

function normalizeRecitationCatalog(payload: unknown): QuranFoundationReciter[] {
  const recitations = payload && typeof payload === "object"
    ? (payload as { recitations?: unknown }).recitations
    : null;
  if (!Array.isArray(recitations)) {
    throw new Error("Quran Foundation recitation response has no recitations array");
  }
  const normalized = recitations.map((recitation): QuranFoundationReciter => {
    if (!recitation || typeof recitation !== "object") {
      throw new Error("Quran Foundation recitation is invalid");
    }
    const value = recitation as Record<string, unknown>;
    const translatedName = value.translated_name && typeof value.translated_name === "object"
      ? (value.translated_name as Record<string, unknown>).name
      : null;
    const name = typeof translatedName === "string" && translatedName.trim()
      ? translatedName.trim()
      : typeof value.reciter_name === "string" && value.reciter_name.trim()
        ? value.reciter_name.trim()
        : null;
    if (!Number.isInteger(value.id) || (value.id as number) < 1 || !name) {
      throw new Error("Quran Foundation recitation fields are invalid");
    }
    return {
      id: value.id as number,
      name,
      style: typeof value.style === "string" && value.style.trim() ? value.style.trim() : null,
    };
  });
  if (normalized.length < 1 || new Set(normalized.map((reciter) => reciter.id)).size !== normalized.length) {
    throw new Error("Quran Foundation recitation catalog is invalid");
  }
  return normalized.sort((left, right) => left.name.localeCompare(right.name, "ar"));
}

export async function listQuranFoundationReciters(): Promise<QuranFoundationReciter[]> {
  if (cachedRecitationCatalog && cachedRecitationCatalog.expiresAt > Date.now()) {
    return cachedRecitationCatalog.value;
  }
  const value = normalizeRecitationCatalog(
    await requestContentJson("resources/recitations?language=ar"),
  );
  cachedRecitationCatalog = {
    value,
    expiresAt: Date.now() + RECITATION_CATALOG_CACHE_MS,
  };
  return value;
}

function normalizeIdentity(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "")
    .replace(/khaleel/g, "khalil").replace(/muhammad/g, "mohamed");
}

function normalizeStyle(value: string | null): string {
  return value ? normalizeIdentity(value) : "";
}

function normalizeChapterReciterCatalog(payload: unknown): QuranFoundationChapterReciter[] {
  const records = payload && typeof payload === "object"
    ? (payload as { reciters?: unknown; chapter_reciters?: unknown }).reciters
      ?? (payload as { chapter_reciters?: unknown }).chapter_reciters : null;
  if (!Array.isArray(records)) throw new Error("Quran Foundation chapter reciter response is invalid");
  return records.map((record): QuranFoundationChapterReciter => {
    if (!record || typeof record !== "object") throw new Error("Quran Foundation chapter reciter is invalid");
    const value = record as Record<string, unknown>;
    const translated = value.translated_name && typeof value.translated_name === "object"
      ? (value.translated_name as Record<string, unknown>).name : null;
    const name = typeof translated === "string" && translated.trim() ? translated.trim()
      : typeof value.reciter_name === "string" && value.reciter_name.trim() ? value.reciter_name.trim() : null;
    const id = value.id;
    if (!Number.isInteger(id) || (id as number) < 1 || !name) {
      throw new Error("Quran Foundation chapter reciter fields are invalid");
    }
    const style = value.style && typeof value.style === "object"
      ? (value.style as Record<string, unknown>).name : value.style;
    return { chapterReciterId: id as number, id: id as number, name, style:
      typeof style === "string" && style.trim() ? style.trim() : null };
  });
}

async function listQuranFoundationChapterReciters(): Promise<QuranFoundationChapterReciter[]> {
  if (cachedChapterReciterCatalog && cachedChapterReciterCatalog.expiresAt > Date.now()) {
    return cachedChapterReciterCatalog.value;
  }
  const value = normalizeChapterReciterCatalog(await requestContentJson("resources/chapter_reciters?language=ar"));
  cachedChapterReciterCatalog = { value, expiresAt: Date.now() + RECITATION_CATALOG_CACHE_MS };
  return value;
}

const VERIFIED_CHAPTER_RECITER_IDS: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 9: 9, 10: 10, 12: 12,
};

async function verifiedChapterReciterId(recitationId: number): Promise<number | null> {
  const chapterId = VERIFIED_CHAPTER_RECITER_IDS[recitationId];
  if (!chapterId) return null;
  const [reciters, chapterReciters] = await Promise.all([
    listQuranFoundationReciters(), listQuranFoundationChapterReciters(),
  ]);
  const reciter = reciters.find((item) => item.id === recitationId);
  const chapter = chapterReciters.find((item) => item.chapterReciterId === chapterId);
  if (!reciter || !chapter || normalizeIdentity(reciter.name) !== normalizeIdentity(chapter.name)) return null;
  if (reciter.style && normalizeStyle(reciter.style) !== normalizeStyle(chapter.style)) return null;
  return chapterId;
}

function normalizeTimings(payload: unknown, verseKey: string, recitationId: number): QuranFoundationAyahTimings {
  const audio = payload && typeof payload === "object" ? (payload as { audio_file?: unknown }).audio_file : null;
  const timestamps = audio && typeof audio === "object" ? (audio as { timestamps?: unknown }).timestamps : null;
  if (!Array.isArray(timestamps)) throw new Error("Quran Foundation timings response is invalid");
  const timestamp = timestamps.find((item) => item && typeof item === "object"
    && (item as { verse_key?: unknown }).verse_key === verseKey);
  if (!timestamp || typeof timestamp !== "object") throw new Error("Quran Foundation verse timings are unavailable");
  const value = timestamp as Record<string, unknown>;
  const audioUrl = audio && typeof audio === "object" ? (audio as { audio_url?: unknown }).audio_url : null;
  if (typeof audioUrl !== "string" || !audioUrl.trim()
    || typeof value.timestamp_from !== "number" || !Number.isFinite(value.timestamp_from)
    || typeof value.timestamp_to !== "number" || !Number.isFinite(value.timestamp_to)
    || value.timestamp_to <= value.timestamp_from || !Array.isArray(value.segments)) {
    throw new Error("Quran Foundation verse timings are malformed");
  }
  let normalizedAudioUrl: string;
  try {
    const parsedUrl = new URL(audioUrl, `${VERSE_AUDIO_BASE_URL}/`);
    if (!TRUSTED_AUDIO_ORIGINS.has(parsedUrl.origin)) throw new Error("untrusted");
    normalizedAudioUrl = parsedUrl.toString();
  } catch {
    throw new Error("Quran Foundation returned an untrusted chapter audio URL");
  }
  const rawSegments = value.segments.map((segment): QuranFoundationTimingSegment => {
    if (!Array.isArray(segment) || segment.length !== 3
      || !Number.isInteger(segment[0]) || (segment[0] as number) < 1
      || typeof segment[1] !== "number" || !Number.isFinite(segment[1])
      || typeof segment[2] !== "number" || !Number.isFinite(segment[2])
      || (segment[2] as number) < (segment[1] as number)) {
      throw new Error("Quran Foundation verse timings are malformed");
    }
    const from = value.timestamp_from as number;
    return { wordPosition: segment[0] as number, startMs: Math.max(0, segment[1] - from),
      endMs: Math.max(0, segment[2] - from) };
  });
  const segments = rawSegments.sort((left, right) => left.wordPosition - right.wordPosition);
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index].wordPosition === segments[index - 1].wordPosition
      || segments[index].startMs < segments[index - 1].startMs) {
      throw new Error("Quran Foundation verse timings are nonmonotonic");
    }
  }
  if (!segments.length) throw new Error("Quran Foundation verse timings are empty");
  return Object.freeze({
    recitationId, verseKey, audioUrl: normalizedAudioUrl,
    verseStartMs: value.timestamp_from, verseEndMs: value.timestamp_to,
    segments: Object.freeze(segments), synchronized: true,
  });
}

export async function getQuranFoundationAyahTimings(
  recitationId: number, surahNumber: number, ayahNumber: number,
): Promise<QuranFoundationAyahTimings> {
  if (!Number.isInteger(recitationId) || recitationId < 1) throw new Error("Invalid Quran Foundation recitation");
  validateVerseNumbers(surahNumber, ayahNumber);
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cacheKey = `${recitationId}:${verseKey}`;
  const cached = cachedTimings.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = timingRequests.get(cacheKey);
  if (existing) return existing;
  const request = (async () => {
    const chapterId = await verifiedChapterReciterId(recitationId);
    if (!chapterId) throw new Error("Quran Foundation timing mapping is unavailable");
    const value = normalizeTimings(
      await requestContentJson(`chapter_recitations/${chapterId}/${surahNumber}?segments=true`),
      verseKey, recitationId,
    );
    cachedTimings.set(cacheKey, { value, expiresAt: Date.now() + TIMINGS_CACHE_MS });
    return value;
  })();
  timingRequests.set(cacheKey, request);
  try { return await request; } finally { timingRequests.delete(cacheKey); }
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
  recitationId: number,
  surahNumber: number,
  ayahNumber: number,
): Promise<string> {
  if (!Number.isInteger(recitationId) || recitationId < 1) {
    throw new Error("Invalid Quran Foundation recitation");
  }
  const reciters = await listQuranFoundationReciters();
  if (!reciters.some((reciter) => reciter.id === recitationId)) {
    throw new Error("Quran Foundation recitation is not in the trusted catalog");
  }
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
  if (!TRUSTED_AUDIO_ORIGINS.has(url.origin)) {
    throw new Error("Quran Foundation returned an untrusted audio URL");
  }
  const value = url.toString();
  cachedAudio.set(cacheKey, { value, expiresAt: Date.now() + AUDIO_CACHE_MS });
  return value;
}

export async function getQuranFoundationAyahEducation(
  surahNumber: number,
  ayahNumber: number,
  wordPosition?: number,
): Promise<QuranFoundationAyahEducation> {
  validateVerseNumbers(surahNumber, ayahNumber);
  if (wordPosition !== undefined && (!Number.isInteger(wordPosition) || wordPosition < 1 || wordPosition > 200)) {
    throw new Error("Invalid Quran word position");
  }
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cacheKey = `${verseKey}:${wordPosition ?? 0}`;
  const cached = cachedEducation.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [versePayload, tafsirPayload] = await Promise.all([
    requestContentJson(`verses/by_key/${verseKey}?words=true&word_fields=text_uthmani,translation`),
    requestContentJson(`tafsirs/${TAFSIR_MUYASSAR_RESOURCE_ID}/by_ayah/${verseKey}`),
  ]);
  const verse = versePayload && typeof versePayload === "object"
    ? (versePayload as { verse?: unknown }).verse
    : null;
  const tafsir = tafsirPayload && typeof tafsirPayload === "object"
    ? (tafsirPayload as { tafsir?: unknown }).tafsir
    : null;
  if (!verse || typeof verse !== "object" || (verse as { verse_key?: unknown }).verse_key !== verseKey) {
    throw new Error("Quran Foundation education verse is invalid");
  }
  if (
    !tafsir
    || typeof tafsir !== "object"
    || (tafsir as { resource_id?: unknown }).resource_id !== TAFSIR_MUYASSAR_RESOURCE_ID
    || typeof (tafsir as { text?: unknown }).text !== "string"
  ) {
    throw new Error("Quran Foundation sourced tafsir is invalid");
  }
  const tafsirText = plainText((tafsir as { text: string }).text);
  if (!tafsirText) throw new Error("Quran Foundation sourced tafsir is empty");

  const words = Array.isArray((verse as { words?: unknown }).words)
    ? (verse as { words: unknown[] }).words
    : [];
  const selected = wordPosition === undefined
    ? null
    : words.find((word) =>
      word
      && typeof word === "object"
      && (word as { position?: unknown }).position === wordPosition
      && (word as { char_type_name?: unknown }).char_type_name === "word"
    );
  if (wordPosition !== undefined && !selected) {
    throw new Error("Selected Quran word is not part of the ayah");
  }
  const selectedValue = selected as Record<string, unknown> | null;
  if (
    selectedValue
    && (!Number.isInteger(selectedValue.id) || typeof selectedValue.text_uthmani !== "string" || !selectedValue.text_uthmani.trim())
  ) {
    throw new Error("Quran Foundation selected word is invalid");
  }

  const selectedTranslation = selectedValue?.translation;
  const sourcedWordMeaning = selectedTranslation
    && typeof selectedTranslation === "object"
    && typeof (selectedTranslation as { text?: unknown }).text === "string"
    && (selectedTranslation as { text: string }).text.trim()
    && (selectedTranslation as { language_name?: unknown }).language_name === "english"
      ? (selectedTranslation as { text: string }).text.trim()
      : null;
  const value: QuranFoundationAyahEducation = {
    surahNumber,
    ayahNumber,
    verseKey,
    selectedWord: selectedValue && sourcedWordMeaning ? {
      id: selectedValue.id as number,
      position: selectedValue.position as number,
      text: (selectedValue.text_uthmani as string).trim(),
      meaning: sourcedWordMeaning,
      source: WORD_BY_WORD_SOURCE,
    } : null,
    tafsir: { text: tafsirText, source: TAFSIR_MUYASSAR_SOURCE },
  };
  cachedEducation.set(cacheKey, { value, expiresAt: Date.now() + EDUCATION_CACHE_MS });
  return value;
}
export function resetQuranFoundationClientForTests(): void {
  cachedToken = null;
  tokenRequestPromise = null;
  cachedCatalog = null;
  cachedRecitationCatalog = null;
  cachedChapterReciterCatalog = null;
  cachedSurahs.clear();
  cachedMadaniPages.clear();
  cachedAudio.clear();
  cachedTimings.clear();
  timingRequests.clear();
  cachedEducation.clear();
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const TAFSIR_MUYASSAR_SOURCE = {
  id: TAFSIR_MUYASSAR_RESOURCE_ID,
  name: "التفسير الميسر",
  provider: "Quran Foundation",
  version: "Content API v4",
} as const;

const WORD_BY_WORD_SOURCE = {
  id: null,
  name: "Quran.com Word-by-Word Translation",
  provider: "Quran Foundation",
  version: "Content API v4 · English",
} as const;

function validateVerseNumbers(surahNumber: number, ayahNumber: number): void {
  if (
    !Number.isInteger(surahNumber)
    || surahNumber < 1
    || surahNumber > CANONICAL_AYAH_COUNTS.length
    || !Number.isInteger(ayahNumber)
    || ayahNumber < 1
    || ayahNumber > CANONICAL_AYAH_COUNTS[surahNumber - 1]
  ) {
    throw new Error("Invalid Quran surah or ayah number");
  }
}
