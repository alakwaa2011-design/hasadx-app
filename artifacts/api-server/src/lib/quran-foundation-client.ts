import { createHash } from "node:crypto";
import qcfV2Integrity from "../data/qcf-v2-page-integrity.json";
import abuBakrAlDhabiReviewedBoundaries from "../../scripts/abu-bakr-al-dhabi-reviewed-boundaries.json";
import { objectStorageClient, parseObjectPath } from "./objectStorage";

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
const TAJWEED_CACHE_MS = 24 * 60 * 60 * 1_000;
const QUL_GHARIB_CACHE_MS = 7 * 24 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const VERSE_AUDIO_BASE_URL = "https://verses.quran.foundation";
const MAHER_AL_MUAIQLY_RECITATION_ID = 1_000_159;
const MAHER_AL_MUAIQLY_AUDIO_BASE_URL = "https://everyayah.com/data/MaherAlMuaiqly128kbps";
export const MAHMOUD_ALI_AL_BANNA_RECITATION_ID = 2_000_032;
const MAHMOUD_ALI_AL_BANNA_AUDIO_BASE_URL =
  "https://everyayah.com/data/Mahmoud_Ali_Al_Banna_32kbps";
export const FARES_ABBAD_RECITATION_ID = 2_000_170;
const FARES_ABBAD_AUDIO_BASE_URL = "https://everyayah.com/data/Fares_Abbad_64kbps";
export const SADIQ_ALNIZAM_RECITATION_ID = 2_000_114;
const SADIQ_ALNIZAM_AUDIO_URL =
  "/api/storage/objects/uploads/quran-recitation/sadiq-alnizam/114.mp3";
const SADIQ_ALNIZAM_TIMINGS = Object.freeze([
  { ayahNumber: 1, verseStartMs: 286, verseEndMs: 11_680 },
  { ayahNumber: 2, verseStartMs: 11_680, verseEndMs: 15_920 },
  { ayahNumber: 3, verseStartMs: 15_920, verseEndMs: 25_720 },
  { ayahNumber: 4, verseStartMs: 25_720, verseEndMs: 35_690 },
  { ayahNumber: 5, verseStartMs: 35_690, verseEndMs: 42_280 },
  { ayahNumber: 6, verseStartMs: 42_280, verseEndMs: 48_216 },
] as const);
export const ABU_BAKR_AL_DHABI_RECITATION_ID = 2_001_095;
const ABU_BAKR_AL_DHABI_TIN_AUDIO_URL =
  "/api/storage/objects/uploads/a1210437-e13f-4f8c-809f-0148d6028867.mp3";
const ABU_BAKR_AL_DHABI_TIN_BOUNDARIES = Object.freeze([
  288, 10_366, 14_864, 19_565, 29_521, 36_624, 47_393, 53_431, 61_727,
]);
const ABU_BAKR_AL_DHABI_FATIHA_BOUNDARIES = Object.freeze([
  6_556, 12_050, 18_192, 22_131, 26_828, 32_986, 38_585, 53_760,
]);
const ABU_BAKR_AL_DHABI_MANIFEST_PATH =
  "uploads/quran-recitation/abu-bakr-al-dhabi/verse-boundaries.json";

const ABU_BAKR_AL_DHABI_BOUNDARY_PATCHES = (
  abuBakrAlDhabiReviewedBoundaries as unknown as {
    $patches?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  }
).$patches ?? {};
let abuBakrAlDhabiManifestRequest:
  Promise<Readonly<Record<string, readonly number[]>>> | null = null;

async function loadAbuBakrAlDhabiManifest(): Promise<Readonly<Record<string, readonly number[]>>> {
  if (abuBakrAlDhabiManifestRequest) return abuBakrAlDhabiManifestRequest;
  abuBakrAlDhabiManifestRequest = (async () => {
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) throw new Error("Quran Foundation timing mapping is unavailable");
    const { bucketName, objectName } = parseObjectPath(
      `${privateObjectDir}/${ABU_BAKR_AL_DHABI_MANIFEST_PATH}`,
    );
    const [buffer] = await objectStorageClient.bucket(bucketName).file(objectName).download();
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Quran Foundation verse timings are malformed");
    }
    return Object.freeze(parsed as Record<string, readonly number[]>);
  })().catch((error) => {
    abuBakrAlDhabiManifestRequest = null;
    throw error;
  });
  return abuBakrAlDhabiManifestRequest;
}

function getAbuBakrAlDhabiAudioUrl(surahNumber: number): string {
  if (surahNumber === 95) return ABU_BAKR_AL_DHABI_TIN_AUDIO_URL;
  return `/api/storage/objects/uploads/quran-recitation/abu-bakr-al-dhabi/${String(surahNumber).padStart(3, "0")}.mp3`;
}

async function getAbuBakrAlDhabiVerseTiming(
  surahNumber: number,
  ayahNumber: number,
): Promise<{ verseStartMs: number; verseEndMs: number } | null> {
  const storedBoundaries = surahNumber === 1
    ? ABU_BAKR_AL_DHABI_FATIHA_BOUNDARIES
    : surahNumber === 95
      ? ABU_BAKR_AL_DHABI_TIN_BOUNDARIES
      : (await loadAbuBakrAlDhabiManifest())[String(surahNumber)];
  const patches = ABU_BAKR_AL_DHABI_BOUNDARY_PATCHES[String(surahNumber)];
  const boundaries = storedBoundaries && patches
    ? storedBoundaries.map((boundary, index) => patches[String(index)] ?? boundary)
    : storedBoundaries;
  if (!boundaries || boundaries.length !== CANONICAL_AYAH_COUNTS[surahNumber - 1] + 1) return null;
  const verseStartMs = boundaries[ayahNumber - 1];
  const verseEndMs = boundaries[ayahNumber];
  if (
    !Number.isFinite(verseStartMs)
    || !Number.isFinite(verseEndMs)
    || verseStartMs < 0
    || verseEndMs <= verseStartMs
  ) {
    return null;
  }
  return { verseStartMs, verseEndMs };
}

export function isUnverifiedQuranRecitation(recitationId: number): boolean {
  return recitationId === SADIQ_ALNIZAM_RECITATION_ID;
}
const TRUSTED_AUDIO_ORIGINS = new Set([
  VERSE_AUDIO_BASE_URL,
  "https://download.quranicaudio.com",
  "https://audio.qurancdn.com",
  "https://everyayah.com",
]);
const CHAPTER_PUBLIC_ID_BASE = 1_000_000;
const HIDDEN_CHAPTER_RECITER_IDS = new Set([175]);
const ARABIC_CHAPTER_RECITER_NAMES: Readonly<Record<number, string>> = Object.freeze({
  158: "علي عبدالله جابر",
  159: "ماهر المعيقلي",
  160: "بندر بليلة",
  161: "خليفة الطنيجي",
  173: "مشاري راشد العفاسي",
  174: "ياسر الدوسري",
  176: "أحمد عبدالحميد طاحون - تجريبي",
});

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
  available?: boolean;
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
    arabicMeaning: {
      text: string;
      source: typeof QUL_GHARIB_SOURCE;
    } | null;
  } | null;
  tafsir: {
    text: string;
    source: typeof TAFSIR_MUYASSAR_SOURCE;
  };
};

export type QuranTajweedRuleClass = keyof typeof TAJWEED_RULE_DEFINITIONS;

export type QuranFoundationWordTajweed = {
  verseKey: string;
  wordId: number;
  position: number;
  text: string;
  rules: Array<{
    class: QuranTajweedRuleClass;
    letters: string;
    nameAr: string;
    descriptionAr: string;
    color: string;
    colorNameAr: string;
  }>;
  source: typeof QURAN_TAJWEED_SOURCE;
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
let chapterReciterRequestPromise: Promise<QuranFoundationChapterReciter[]> | null = null;
const cachedSurahs = new Map<number, { value: QuranFoundationSurahContent; expiresAt: number }>();
const cachedMadaniPages = new Map<number, { value: QuranFoundationMadaniPage; expiresAt: number }>();
const cachedAudio = new Map<string, { value: string; expiresAt: number }>();
const cachedWordAudio = new Map<string, { value: string; expiresAt: number }>();
const cachedTimings = new Map<string, { value: QuranFoundationAyahTimings; expiresAt: number }>();
const timingRequests = new Map<string, Promise<QuranFoundationAyahTimings>>();
const cachedTimingPayloads = new Map<string, { value: unknown; expiresAt: number }>();
const timingPayloadRequests = new Map<string, Promise<unknown>>();
const MAX_CACHED_AYAH_TIMINGS = 2_048;
const MAX_CACHED_TIMING_CHAPTERS = 64;

const cachedEducation = new Map<string, { value: QuranFoundationAyahEducation; expiresAt: number }>();
const cachedWordTajweed = new Map<string, { value: QuranFoundationWordTajweed; expiresAt: number }>();
const cachedQulGharib = new Map<string, {
  value: Array<{ phrase: string; meaning: string }>;
  expiresAt: number;
}>();

function normalizeArabicLookup(value: string): string {
  return value
    .replace(/[﴿﴾۞۩]/g, "")
    .replace(/[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A]/g, "");
}

function decodeQulHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

async function getQulGharibEntries(
  surahNumber: number,
  ayahNumber: number,
): Promise<Array<{ phrase: string; meaning: string }>> {
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cached = cachedQulGharib.get(verseKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch(
    `https://qul.tarteel.ai/resources/tafsir/519?ayah=${encodeURIComponent(verseKey)}`,
    {
      headers: { Accept: "text/html", "User-Agent": "Hasaad-Quran-Reader/1.0" },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) throw new Error(`QUL Gharib request failed with status ${response.status}`);
  const html = await response.text();
  const tafsirBlock = html.match(/<div class="tafsir arabic">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "";
  const entries = Array.from(
    tafsirBlock.matchAll(/<p>\s*<span[^>]*>([\s\S]*?)<\/span>\s*:\s*([\s\S]*?)<\/p>/gi),
    (match) => ({
      phrase: decodeQulHtml(match[1]),
      meaning: decodeQulHtml(match[2]),
    }),
  ).filter((entry) => entry.phrase && entry.meaning);
  cachedQulGharib.set(verseKey, {
    value: entries,
    expiresAt: Date.now() + QUL_GHARIB_CACHE_MS,
  });
  return entries;
}

async function getQulArabicWordMeaning(
  surahNumber: number,
  ayahNumber: number,
  wordText: string,
): Promise<{ text: string; source: typeof QUL_GHARIB_SOURCE } | null> {
  try {
    const normalizedWord = normalizeArabicLookup(wordText);
    const entries = await getQulGharibEntries(surahNumber, ayahNumber);
    const exact = entries.find((entry) => {
      const phrase = normalizeArabicLookup(entry.phrase);
      return phrase === normalizedWord || phrase.includes(normalizedWord) || normalizedWord.includes(phrase);
    });
    return exact ? { text: exact.meaning, source: QUL_GHARIB_SOURCE } : null;
  } catch {
    return null;
  }
}
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
      available: true,
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
  const chapterReciters = await listQuranFoundationChapterReciters();
  const usedIds = new Set(value.map((reciter) => reciter.id));
  for (const chapter of chapterReciters) {
    if (HIDDEN_CHAPTER_RECITER_IDS.has(chapter.chapterReciterId)) continue;
    const publicId = chapterPublicId(chapter.chapterReciterId);
    if (usedIds.has(publicId)) throw new Error("Quran recitation ID namespace collision");
    const localizedName = ARABIC_CHAPTER_RECITER_NAMES[chapter.chapterReciterId] ?? chapter.name;
    if (!value.some((reciter) => reciter.name === localizedName && reciter.style === chapter.style)) {
      value.push({ id: publicId, name: localizedName, style: chapter.style });
      usedIds.add(publicId);
    }
  }
  value.sort((left, right) => left.name.localeCompare(right.name, "ar")
    || (left.style ?? "").localeCompare(right.style ?? "", "ar"));
  cachedRecitationCatalog = {
    value,
    expiresAt: Date.now() + RECITATION_CATALOG_CACHE_MS,
  };
  return value;
}

function canonicalReciterName(name: string): string {
  return normalizeIdentity(name.replace(/[\s–—-]*(?:مجو[ّ]?د|mujawwad)$/iu, ""));
}

function canonicalDisplayStyle(style: string | null): "Murattal" | "Mujawwad" | "Kids repeat" | null {
  const normalized = normalizeStyle(style);
  if (normalized === "murattal") return "Murattal";
  if (normalized === "mujawwad") return "Mujawwad";
  if (normalized === "kidsrepeat") return "Kids repeat";
  return null;
}

/**
 * Returns only semantically verified display choices. Provider records with no
 * style are trusted for playback but are not useful duplicate picker options.
 * "Muallim" is intentionally excluded because it does not prove child repeat.
 */
export async function listQuranFoundationDisplayReciters(): Promise<QuranFoundationReciter[]> {
  const catalog = await listQuranFoundationReciters();
  const selected = new Map<string, QuranFoundationReciter>();
  for (const reciter of catalog) {
    const style = canonicalDisplayStyle(reciter.style);
    if (!style || /تجريبي|experimental/i.test(reciter.name)) continue;
    const normalized = { ...reciter, style };
    const key = `${canonicalReciterName(reciter.name)}:${style}`;
    const existing = selected.get(key);
    if (!existing || (existing.id >= CHAPTER_PUBLIC_ID_BASE && reciter.id < CHAPTER_PUBLIC_ID_BASE)) {
      selected.set(key, normalized);
    }
  }
  selected.set("صادق النظام:Murattal", {
    id: SADIQ_ALNIZAM_RECITATION_ID,
    name: "صادق النظام",
    style: "Murattal",
    available: false,
  });
  selected.set("أبوبكر الظبي:Murattal", {
    id: ABU_BAKR_AL_DHABI_RECITATION_ID,
    name: "أبوبكر الظبي",
    style: "Murattal",
    available: true,
  });
  selected.set("محمود علي البنا:Murattal", {
    id: MAHMOUD_ALI_AL_BANNA_RECITATION_ID,
    name: "محمود علي البنا",
    style: "Murattal",
    available: true,
  });
  selected.set("فارس عباد:Murattal", {
    id: FARES_ABBAD_RECITATION_ID,
    name: "فارس عباد",
    style: "Murattal",
    available: true,
  });
  return [...selected.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "ar")
    || (left.style ?? "").localeCompare(right.style ?? "", "en"));
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
  if (!chapterReciterRequestPromise) {
    chapterReciterRequestPromise = requestContentJson("resources/chapter_reciters?language=ar")
      .then(normalizeChapterReciterCatalog)
      .then((value) => {
        cachedChapterReciterCatalog = { value, expiresAt: Date.now() + RECITATION_CATALOG_CACHE_MS };
        return value;
      })
      .finally(() => { chapterReciterRequestPromise = null; });
  }
  return chapterReciterRequestPromise;
}

function chapterPublicId(chapterReciterId: number): number {
  return CHAPTER_PUBLIC_ID_BASE + chapterReciterId;
}

const VERIFIED_CHAPTER_RECITER_IDS: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 9: 9, 10: 10, 12: 12,
};

async function verifiedChapterReciterId(recitationId: number): Promise<number | null> {
  const isChapterPublicId = recitationId >= CHAPTER_PUBLIC_ID_BASE;
  const chapterId = VERIFIED_CHAPTER_RECITER_IDS[recitationId]
    ?? (isChapterPublicId ? recitationId - CHAPTER_PUBLIC_ID_BASE : null);
  if (!chapterId) return null;
  const [reciters, chapterReciters] = await Promise.all([
    listQuranFoundationReciters(), listQuranFoundationChapterReciters(),
  ]);
  if (isChapterPublicId) {
    return reciters.some((item) => item.id === recitationId)
      && chapterReciters.some((item) => item.chapterReciterId === chapterId)
      ? chapterId : null;
  }
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
  const from = value.timestamp_from as number;
  const to = value.timestamp_to as number;
  const rawSegments = value.segments
    .filter((segment): segment is [number, number, number] =>
      Array.isArray(segment)
      && segment.length === 3
      && Number.isInteger(segment[0])
      && segment[0] > 0
      && typeof segment[1] === "number"
      && Number.isFinite(segment[1])
      && typeof segment[2] === "number"
      && Number.isFinite(segment[2])
      && segment[1] >= from
      && segment[2] > segment[1]
      && segment[2] <= to)
    .map((segment): QuranFoundationTimingSegment => ({
      wordPosition: segment[0],
      startMs: segment[1] - from,
      endMs: segment[2] - from,
    }));
  const segments = rawSegments.sort((left, right) =>
    left.startMs - right.startMs || left.endMs - right.endMs);
  return Object.freeze({
    recitationId, verseKey, audioUrl: normalizedAudioUrl,
    verseStartMs: value.timestamp_from, verseEndMs: value.timestamp_to,
    segments: Object.freeze(segments), synchronized: true,
  });
}

async function getChapterTimingPayload(recitationId: number, surahNumber: number): Promise<unknown> {
  const chapterId = await verifiedChapterReciterId(recitationId);
  if (!chapterId) throw new Error("Quran Foundation timing mapping is unavailable");
  const cacheKey = `${chapterId}:${surahNumber}`;
  const cached = cachedTimingPayloads.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    cachedTimingPayloads.delete(cacheKey);
    cachedTimingPayloads.set(cacheKey, cached);
    return cached.value;
  }
  const now = Date.now();
  for (const [key, entry] of cachedTimingPayloads) {
    if (entry.expiresAt <= now) cachedTimingPayloads.delete(key);
  }
  const existing = timingPayloadRequests.get(cacheKey);
  if (existing) return existing;
  const request = requestContentJson(`chapter_recitations/${chapterId}/${surahNumber}?segments=true`);
  timingPayloadRequests.set(cacheKey, request);
  try {
    const value = await request;
    while (cachedTimingPayloads.size >= MAX_CACHED_TIMING_CHAPTERS) {
      const oldestKey = cachedTimingPayloads.keys().next().value;
      if (typeof oldestKey !== "string") break;
      cachedTimingPayloads.delete(oldestKey);
    }
    cachedTimingPayloads.set(cacheKey, { value, expiresAt: Date.now() + TIMINGS_CACHE_MS });
    return value;
  } finally {
    timingPayloadRequests.delete(cacheKey);
  }
}

export async function getQuranFoundationAyahTimings(
  recitationId: number, surahNumber: number, ayahNumber: number,
): Promise<QuranFoundationAyahTimings> {
  if (!Number.isInteger(recitationId) || recitationId < 1) throw new Error("Invalid Quran Foundation recitation");
  validateVerseNumbers(surahNumber, ayahNumber);
  if (recitationId === SADIQ_ALNIZAM_RECITATION_ID) {
    if (surahNumber !== 114) {
      throw new Error("Quran Foundation timing mapping is unavailable");
    }
    const timing = SADIQ_ALNIZAM_TIMINGS.find((item) => item.ayahNumber === ayahNumber);
    if (!timing) throw new Error("Quran Foundation verse timings are unavailable");
    return Object.freeze({
      recitationId,
      verseKey: `${surahNumber}:${ayahNumber}`,
      audioUrl: SADIQ_ALNIZAM_AUDIO_URL,
      verseStartMs: timing.verseStartMs,
      verseEndMs: timing.verseEndMs,
      segments: Object.freeze([]),
      synchronized: true,
    });
  }
  if (recitationId === ABU_BAKR_AL_DHABI_RECITATION_ID) {
    const timing = await getAbuBakrAlDhabiVerseTiming(surahNumber, ayahNumber);
    if (!timing) throw new Error("Quran Foundation verse timings are unavailable");
    return Object.freeze({
      recitationId,
      verseKey: `${surahNumber}:${ayahNumber}`,
      audioUrl: getAbuBakrAlDhabiAudioUrl(surahNumber),
      verseStartMs: timing.verseStartMs,
      verseEndMs: timing.verseEndMs,
      segments: Object.freeze([]),
      synchronized: true,
    });
  }
  if (
    recitationId === MAHER_AL_MUAIQLY_RECITATION_ID
    || recitationId === MAHMOUD_ALI_AL_BANNA_RECITATION_ID
    || recitationId === FARES_ABBAD_RECITATION_ID
  ) {
    throw new Error("This standard recitation uses ayah-scoped playback");
  }
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cacheKey = `${recitationId}:${verseKey}`;
  const cached = cachedTimings.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    cachedTimings.delete(cacheKey);
    cachedTimings.set(cacheKey, cached);
    return cached.value;
  }
  const now = Date.now();
  for (const [key, entry] of cachedTimings) {
    if (entry.expiresAt <= now) cachedTimings.delete(key);
  }
  const existing = timingRequests.get(cacheKey);
  if (existing) return existing;
  const request = (async () => {
    const value = normalizeTimings(
      await getChapterTimingPayload(recitationId, surahNumber),
      verseKey, recitationId,
    );
    while (cachedTimings.size >= MAX_CACHED_AYAH_TIMINGS) {
      const oldestKey = cachedTimings.keys().next().value;
      if (typeof oldestKey !== "string") break;
      cachedTimings.delete(oldestKey);
    }
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
  if (recitationId === SADIQ_ALNIZAM_RECITATION_ID) {
    validateVerseNumbers(surahNumber, ayahNumber);
    if (surahNumber !== 114) {
      throw new Error("Quran Foundation audio mapping is unavailable");
    }
    return SADIQ_ALNIZAM_AUDIO_URL;
  }
  if (recitationId === ABU_BAKR_AL_DHABI_RECITATION_ID) {
    validateVerseNumbers(surahNumber, ayahNumber);
    return getAbuBakrAlDhabiAudioUrl(surahNumber);
  }
  if (recitationId === MAHMOUD_ALI_AL_BANNA_RECITATION_ID || recitationId === FARES_ABBAD_RECITATION_ID) {
    validateVerseNumbers(surahNumber, ayahNumber);
    const baseUrl = recitationId === FARES_ABBAD_RECITATION_ID
      ? FARES_ABBAD_AUDIO_BASE_URL
      : MAHMOUD_ALI_AL_BANNA_AUDIO_BASE_URL;
    const fileName = `${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
    const value = `${baseUrl}/${fileName}`;
    cachedAudio.set(`${recitationId}:${surahNumber}:${ayahNumber}`, {
      value,
      expiresAt: Date.now() + AUDIO_CACHE_MS,
    });
    return value;
  }
  const reciters = await listQuranFoundationReciters();
  if (!reciters.some((reciter) => reciter.id === recitationId)) {
    throw new Error("Quran Foundation recitation is not in the trusted catalog");
  }
  if (recitationId === MAHER_AL_MUAIQLY_RECITATION_ID) {
    validateVerseNumbers(surahNumber, ayahNumber);
    const fileName = `${String(surahNumber).padStart(3, "0")}${String(ayahNumber).padStart(3, "0")}.mp3`;
    const value = `${MAHER_AL_MUAIQLY_AUDIO_BASE_URL}/${fileName}`;
    cachedAudio.set(`${recitationId}:${surahNumber}:${ayahNumber}`, {
      value,
      expiresAt: Date.now() + AUDIO_CACHE_MS,
    });
    return value;
  }
  const cacheKey = `${recitationId}:${surahNumber}:${ayahNumber}`;
  const cached = cachedAudio.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (recitationId >= CHAPTER_PUBLIC_ID_BASE) {
    throw new Error("Chapter-only Quran recitations require synchronized timing playback");
  }
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

export async function getQuranFoundationWordAudioUrl(
  surahNumber: number,
  ayahNumber: number,
  wordPosition: number,
): Promise<string> {
  validateVerseNumbers(surahNumber, ayahNumber);
  if (!Number.isInteger(wordPosition) || wordPosition < 1 || wordPosition > 200) {
    throw new Error("Invalid Quran word position");
  }
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cacheKey = `${verseKey}:${wordPosition}`;
  const cached = cachedWordAudio.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const payload = await requestContentJson(
    `verses/by_key/${verseKey}?words=true&word_fields=audio_url`,
  );
  const verse = payload && typeof payload === "object"
    ? (payload as { verse?: unknown }).verse
    : null;
  if (!verse || typeof verse !== "object" || (verse as { verse_key?: unknown }).verse_key !== verseKey) {
    throw new Error("Quran Foundation word audio verse is invalid");
  }
  const words = Array.isArray((verse as { words?: unknown }).words)
    ? (verse as { words: unknown[] }).words
    : [];
  const word = words.find((item) =>
    item
    && typeof item === "object"
    && (item as { position?: unknown }).position === wordPosition
    && (item as { char_type_name?: unknown }).char_type_name === "word"
  ) as Record<string, unknown> | undefined;
  const rawPath = word?.audio_url;
  const verseAudioPath = new RegExp(
    `^wbw/${String(surahNumber).padStart(3, "0")}_${String(ayahNumber).padStart(3, "0")}_\\d{3}\\.mp3$`,
  );
  if (typeof rawPath !== "string" || !verseAudioPath.test(rawPath)) {
    throw new Error("Quran Foundation word audio is unavailable");
  }
  const url = new URL(rawPath, "https://audio.qurancdn.com/");
  if (!TRUSTED_AUDIO_ORIGINS.has(url.origin)) {
    throw new Error("Quran Foundation returned an untrusted word audio URL");
  }
  const value = url.toString();
  cachedWordAudio.set(cacheKey, { value, expiresAt: Date.now() + AUDIO_CACHE_MS });
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
  const arabicMeaning = selectedValue
    ? await getQulArabicWordMeaning(
        surahNumber,
        ayahNumber,
        (selectedValue.text_uthmani as string).trim(),
      )
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
      arabicMeaning,
    } : null,
    tafsir: { text: tafsirText, source: TAFSIR_MUYASSAR_SOURCE },
  };
  cachedEducation.set(cacheKey, { value, expiresAt: Date.now() + EDUCATION_CACHE_MS });
  return value;
}

/**
 * Returns only Tajweed rules the official Quran Foundation API explicitly tags
 * for this exact word (via `text_uthmani_tajweed`). Never inferred or guessed:
 * an empty `rules` array means the word carries no distinguishable rule per the
 * source, and callers must treat that as "no verified rule available" rather
 * than falling back to a guess. This lookup is intentionally independent of the
 * QCF v4 color font toggle — it reads structured rule text, not glyph colors.
 */
export async function getQuranFoundationWordTajweed(
  surahNumber: number,
  ayahNumber: number,
  wordPosition: number,
): Promise<QuranFoundationWordTajweed> {
  validateVerseNumbers(surahNumber, ayahNumber);
  if (!Number.isInteger(wordPosition) || wordPosition < 1 || wordPosition > 200) {
    throw new Error("Invalid Quran word position");
  }
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const cacheKey = `${verseKey}:${wordPosition}`;
  const cached = cachedWordTajweed.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const payload = await requestContentJson(
    `verses/by_key/${verseKey}?words=true&word_fields=text_uthmani_tajweed`,
  );
  const verse = payload && typeof payload === "object"
    ? (payload as { verse?: unknown }).verse
    : null;
  if (!verse || typeof verse !== "object" || (verse as { verse_key?: unknown }).verse_key !== verseKey) {
    throw new Error("Quran Foundation Tajweed verse is invalid");
  }
  const words = Array.isArray((verse as { words?: unknown }).words)
    ? (verse as { words: unknown[] }).words
    : [];
  const word = words.find((item) =>
    item
    && typeof item === "object"
    && (item as { position?: unknown }).position === wordPosition
    && (item as { char_type_name?: unknown }).char_type_name === "word"
  ) as Record<string, unknown> | undefined;
  if (!word) throw new Error("Selected Quran word is not part of the ayah");
  if (!Number.isInteger(word.id) || typeof word.text_uthmani_tajweed !== "string") {
    throw new Error("Quran Foundation Tajweed word is invalid");
  }

  const value: QuranFoundationWordTajweed = {
    verseKey,
    wordId: word.id as number,
    position: wordPosition,
    text: word.text_uthmani_tajweed.replace(/<[^>]+>/g, ""),
    rules: parseTajweedRuleSpans(word.text_uthmani_tajweed),
    source: QURAN_TAJWEED_SOURCE,
  };
  cachedWordTajweed.set(cacheKey, { value, expiresAt: Date.now() + TAJWEED_CACHE_MS });
  return value;
}

export function resetQuranFoundationClientForTests(): void {
  abuBakrAlDhabiManifestRequest = null;
  cachedToken = null;
  tokenRequestPromise = null;
  cachedCatalog = null;
  cachedRecitationCatalog = null;
  cachedChapterReciterCatalog = null;
  chapterReciterRequestPromise = null;
  cachedSurahs.clear();
  cachedMadaniPages.clear();
  cachedAudio.clear();
  cachedWordAudio.clear();
  cachedTimings.clear();
  timingRequests.clear();
  cachedTimingPayloads.clear();
  timingPayloadRequests.clear();
  cachedEducation.clear();
  cachedQulGharib.clear();
  cachedWordTajweed.clear();
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

const QUL_GHARIB_SOURCE = {
  id: 519,
  name: "الميسر في غريب القرآن",
  provider: "Quranic Universal Library (QUL)",
  version: "Tafsir resource 519",
} as const;

const QURAN_TAJWEED_SOURCE = {
  id: null,
  name: "أحكام التجويد المعتمدة (مجمع الملك فهد)",
  provider: "Quran Foundation",
  version: "Content API v4 · text_uthmani_tajweed",
} as const;

/**
 * Every entry is keyed by the exact `class` value the official Quran Foundation
 * Content API embeds in a word's `text_uthmani_tajweed` field (verified against
 * live API responses across many surahs). Colors mirror the five-family Tajweed
 * legend already shown to readers in the color-mode info popover, so a rule's
 * swatch here always matches what the colored font displays.
 */
const TAJWEED_RULE_DEFINITIONS = {
  ghunnah: {
    nameAr: "الغُنّة",
    descriptionAr: "صوت أنفي يمتد عند تشديد النون أو الميم (نّ / مّ) بمقدار حركتين تقريبًا.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  ham_wasl: {
    nameAr: "همزة الوصل",
    descriptionAr: "همزة تُنطق عند البدء بالكلمة، وتسقط لفظًا إذا وُصلت القراءة بما قبلها.",
    color: "#a5a5a5",
    colorNameAr: "رمادي",
  },
  idgham_ghunnah: {
    nameAr: "الإدغام بغنة",
    descriptionAr: "إدغام النون الساكنة أو التنوين في أحد حروف (ي ن م و) مع بقاء صوت الغنة.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  idgham_mutajanisayn: {
    nameAr: "إدغام المتجانسين",
    descriptionAr: "إدغام حرفين يتفقان في المخرج ويختلفان في الصفة، فيصيران حرفًا واحدًا مشددًا.",
    color: "#ff7b00",
    colorNameAr: "برتقالي",
  },
  idgham_mutaqaribayn: {
    nameAr: "إدغام المتقاربين",
    descriptionAr: "إدغام حرفين يتقاربان في المخرج والصفة، فيصيران حرفًا واحدًا مشددًا.",
    color: "#ff7b00",
    colorNameAr: "برتقالي",
  },
  idgham_shafawi: {
    nameAr: "الإدغام الشفوي",
    descriptionAr: "إدغام الميم الساكنة في ميم بعدها مع غنة، ومخرجهما من الشفتين.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  idgham_wo_ghunnah: {
    nameAr: "الإدغام بغير غنة",
    descriptionAr: "إدغام النون الساكنة أو التنوين في اللام أو الراء دون غنة.",
    color: "#ff7b00",
    colorNameAr: "برتقالي",
  },
  ikhafa: {
    nameAr: "الإخفاء الحقيقي",
    descriptionAr: "إخفاء النون الساكنة أو التنوين عند حروف الإخفاء الخمسة عشر، مع غنة خفيفة.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  ikhafa_shafawi: {
    nameAr: "الإخفاء الشفوي",
    descriptionAr: "إخفاء الميم الساكنة عند حرف الباء مع غنة، ومخرجهما من الشفتين.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  iqlab: {
    nameAr: "الإقلاب",
    descriptionAr: "قلب النون الساكنة أو التنوين ميمًا مخفاة عند حرف الباء، مع غنة.",
    color: "#09b000",
    colorNameAr: "أخضر",
  },
  laam_shamsiyah: {
    nameAr: "اللام الشمسية",
    descriptionAr: "لام «أل» التعريف تُدغم في الحرف الشمسي الذي يليها، فلا تُنطق اللام نفسها.",
    color: "#a5a5a5",
    colorNameAr: "رمادي",
  },
  madda_necessary: {
    nameAr: "المد اللازم",
    descriptionAr: "مدّ بمقدار ست حركات لوجود سكون أصلي ثابت بعد حرف المد.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  madda_normal: {
    nameAr: "المد الطبيعي",
    descriptionAr: "مدّ بمقدار حركتين بلا همز ولا سكون بعد حرف المد.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  madda_obligatory_monfasel: {
    nameAr: "المد الجائز المنفصل",
    descriptionAr: "حرف المد في آخر الكلمة، وهمزة القطع في أول الكلمة التالية، ويُمد 4 أو 5 حركات.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  madda_obligatory_mottasel: {
    nameAr: "المد الواجب المتصل",
    descriptionAr: "يجتمع حرف المد والهمزة في كلمة واحدة، فيُمد وجوبًا 4 أو 5 حركات.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  madda_permissible: {
    nameAr: "مد البدل",
    descriptionAr: "همزة يليها حرف مد في أصل الكلمة، ويُمد بمقدار حركتين.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  qalaqah: {
    nameAr: "القلقلة",
    descriptionAr: "اضطراب في الصوت عند النطق بأحد حروف (قطب جد) الساكنة يُحدث نبرة واضحة.",
    color: "#3f48e6",
    colorNameAr: "أزرق",
  },
  slnt: {
    nameAr: "حرف لا يُنطق",
    descriptionAr: "حرف مكتوب في المصحف لا يُنطق أثناء التلاوة وفق رواية حفص عن عاصم.",
    color: "#a5a5a5",
    colorNameAr: "رمادي",
  },
} as const satisfies Record<string, { nameAr: string; descriptionAr: string; color: string; colorNameAr: string }>;

function parseTajweedRuleSpans(taggedText: string): QuranFoundationWordTajweed["rules"] {
  const rules: QuranFoundationWordTajweed["rules"] = [];
  const pattern = /<(?:tajweed|rule)\s+class=(?:"([a-zA-Z_]+)"|([a-zA-Z_]+))>([^<]*)<\/(?:tajweed|rule)>/g;
  for (const match of taggedText.matchAll(pattern)) {
    const ruleClass = match[1] ?? match[2];
    const letters = match[3];
    const definition = (TAJWEED_RULE_DEFINITIONS as Record<string, typeof TAJWEED_RULE_DEFINITIONS[QuranTajweedRuleClass]>)[ruleClass];
    if (!definition || !letters) continue;
    rules.push({ class: ruleClass as QuranTajweedRuleClass, letters, ...definition });
  }
  return rules;
}

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
