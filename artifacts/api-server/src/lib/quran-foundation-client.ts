const OAUTH_BASE_URL = "https://oauth2.quran.foundation";
const CONTENT_BASE_URL = "https://apis.quran.foundation";
const TOKEN_EARLY_REFRESH_MS = 60_000;
const CATALOG_CACHE_MS = 24 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 10_000;

export type QuranFoundationSurah = {
  number: number;
  arabicName: string;
  ayahCount: number;
};

type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;
let cachedCatalog: { value: QuranFoundationSurah[]; expiresAt: number } | null = null;

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
  return requestAccessToken();
}

async function requestChapters(retryAuth = true): Promise<unknown> {
  const { clientId } = credentials();
  const token = await accessToken(!retryAuth);
  const response = await fetch(`${CONTENT_BASE_URL}/content/api/v4/chapters?language=ar`, {
    headers: {
      "x-auth-token": token,
      "x-client-id": clientId,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401 && retryAuth) {
    cachedToken = null;
    return requestChapters(false);
  }
  if (!response.ok) {
    throw new Error(`Quran Foundation chapters request failed with status ${response.status}`);
  }
  return response.json();
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

export function resetQuranFoundationClientForTests(): void {
  cachedToken = null;
  cachedCatalog = null;
}