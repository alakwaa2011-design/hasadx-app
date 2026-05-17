/* web-image-search.ts
   Shared helper that fetches a single relevant web image for a free-text
   query. Uses Brave Search Images when BRAVE_SEARCH_API_KEY is set, falls
   back to Wikimedia Commons otherwise (free, no key, education-friendly).

   Returns the first usable image URL or null. Designed to be safe to call
   in parallel during presentation import — every error is swallowed and
   returned as null so a single failed lookup never breaks slide build. */

export interface WebImageResult {
  url: string;
  title: string;
  source: string;
}

/* Tiny in-memory LRU so the same query inside one import (e.g. "math")
   doesn't hammer the upstream provider. Process-local, no persistence. */
const cache = new Map<string, WebImageResult | null>();
const CACHE_MAX = 200;

function cacheGet(key: string): WebImageResult | null | undefined {
  if (!cache.has(key)) return undefined;
  const v = cache.get(key);
  cache.delete(key);
  if (v !== undefined) cache.set(key, v ?? null);
  return v;
}

function cacheSet(key: string, value: WebImageResult | null): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, value);
}

async function searchBrave(
  query: string,
  key: string,
  signal: AbortSignal,
): Promise<WebImageResult | null> {
  const url =
    `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=3&safesearch=strict`;
  const r = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      properties?: { url?: string };
      thumbnail?: { src?: string };
      source?: string;
    }>;
  };
  for (const item of data.results ?? []) {
    const u = item.properties?.url || item.thumbnail?.src || item.url;
    if (u) {
      return {
        url: u,
        title: item.title ?? query,
        source: item.source ?? "Brave Search",
      };
    }
  }
  return null;
}

async function searchWikimedia(
  query: string,
  signal: AbortSignal,
): Promise<WebImageResult | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}` +
    `&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=1280` +
    `&gsrlimit=3&format=json&origin=*`;
  const r = await fetch(url, { signal });
  if (!r.ok) return null;
  const data = (await r.json()) as {
    query?: {
      pages?: Record<string, {
        title?: string;
        imageinfo?: Array<{ url?: string; thumburl?: string }>;
      }>;
    };
  };
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const u = info?.thumburl || info?.url;
    if (u) {
      return {
        url: u,
        title: (page.title ?? query).replace(/^File:/, "").replace(/\.[^.]+$/, ""),
        source: "Wikimedia Commons",
      };
    }
  }
  return null;
}

export async function findWebImage(
  query: string,
  opts: { timeoutMs?: number } = {},
): Promise<WebImageResult | null> {
  const trimmed = query.trim().slice(0, 200);
  if (!trimmed) return null;

  const cached = cacheGet(trimmed);
  if (cached !== undefined) return cached;

  const totalBudgetMs = opts.timeoutMs ?? 4000;
  /* Give Brave the smaller half of the budget so a slow/timed-out call
     still leaves time for the Wikimedia fallback. */
  const braveBudgetMs = Math.min(2000, Math.floor(totalBudgetMs / 2));
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const start = Date.now();

  let result: WebImageResult | null = null;
  if (braveKey) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), braveBudgetMs);
    try {
      result = await searchBrave(trimmed, braveKey, ac.signal);
    } catch {
      /* timeout / network — fall through */
    } finally {
      clearTimeout(t);
    }
  }

  if (!result) {
    const remaining = Math.max(500, totalBudgetMs - (Date.now() - start));
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), remaining);
    try {
      result = await searchWikimedia(trimmed, ac.signal);
    } catch {
      result = null;
    } finally {
      clearTimeout(t);
    }
  }

  cacheSet(trimmed, result);
  return result;
}

/** Rich hit shape for the interactive presentation editor image picker. */
export interface PresentationImageHit {
  url: string;
  thumbUrl: string;
  title: string;
  source: string;
}

function mapBraveResponseToHits(data: unknown, limit: number): PresentationImageHit[] {
  const d = data as {
    results?: Array<{
      title?: string;
      url?: string;
      thumbnail?: { src?: string };
      properties?: { url?: string; placeholder?: string };
      source?: string;
    }>;
  };
  const out: PresentationImageHit[] = [];
  for (const item of d.results ?? []) {
    const imageUrl = item.properties?.url || item.thumbnail?.src || item.url;
    if (!imageUrl || typeof imageUrl !== "string") continue;
    const thumbUrl = item.thumbnail?.src || item.properties?.placeholder || imageUrl;
    out.push({
      url: imageUrl,
      thumbUrl,
      title: (item.title ?? "").trim() || "Image",
      source: (item.source ?? "Brave Search").trim() || "Brave Search",
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchBravePresentationHits(
  query: string,
  limit: number,
): Promise<{ hits: PresentationImageHit[]; error?: string }> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!braveKey) return { hits: [] };
  try {
    const url =
      `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}` +
      `&count=${limit}&safesearch=strict`;
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": braveKey,
      },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { hits: [], error: `Brave HTTP ${r.status}: ${text.slice(0, 400)}` };
    }
    const data: unknown = await r.json();
    return { hits: mapBraveResponseToHits(data, limit) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hits: [], error: msg };
  }
}

async function fetchWikimediaPresentationHits(
  query: string,
  limit: number,
): Promise<{ hits: PresentationImageHit[]; error?: string }> {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  /* Same pattern as searchWikimedia(): plain gsrsearch — do NOT prefix "File:",
     which breaks normal keyword searches (esp. Arabic). */
  const wikiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}` +
    `&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=600` +
    `&gsrlimit=${safeLimit}&format=json&origin=*`;
  try {
    const r = await fetch(wikiUrl);
    if (!r.ok) {
      return { hits: [], error: `Wikimedia HTTP ${r.status}` };
    }
    const data = (await r.json()) as {
      error?: unknown;
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string }> }
        >;
      };
    };
    if (data.error != null) {
      return { hits: [], error: `Wikimedia API error: ${JSON.stringify(data.error).slice(0, 300)}` };
    }
    const pages = Object.values(data.query?.pages ?? {});
    const hits: PresentationImageHit[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      const url = info?.url;
      if (!url) continue;
      hits.push({
        url,
        thumbUrl: info.thumburl ?? url,
        title: (p.title ?? "").replace(/^File:/, "").replace(/\.[^.]+$/, ""),
        source: "Wikimedia Commons",
      });
      if (hits.length >= limit) break;
    }
    return { hits };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hits: [], error: msg };
  }
}

/**
 * Multi-result search for the presentation editor: tries Brave (if key is set),
 * then Wikimedia Commons. Never throws; surfaces provider errors via diagnostics
 * for logging.
 */
export async function searchPresentationWebImages(
  query: string,
  count: number,
): Promise<{
  results: PresentationImageHit[];
  diagnostics: {
    primary: "brave" | "wikimedia" | "none";
    braveError?: string;
    wikimediaError?: string;
  };
}> {
  const trimmed = query.trim().slice(0, 200);
  const n = Math.min(Math.max(1, count), 20);

  const brave = await fetchBravePresentationHits(trimmed, n);
  if (brave.hits.length > 0) {
    return { results: brave.hits, diagnostics: { primary: "brave" } };
  }

  const wiki = await fetchWikimediaPresentationHits(trimmed, n);
  if (wiki.hits.length > 0) {
    return {
      results: wiki.hits,
      diagnostics: {
        primary: "wikimedia",
        braveError: brave.error,
      },
    };
  }

  return {
    results: [],
    diagnostics: {
      primary: "none",
      braveError: brave.error,
      wikimediaError: wiki.error,
    },
  };
}

/* Fetch images for many queries in parallel with bounded concurrency so a
   12-slide deck doesn't open 12 sockets at once. Returns one entry per
   query in input order; failed lookups become null. */
export async function findWebImagesBatch(
  queries: (string | null | undefined)[],
  opts: { concurrency?: number; timeoutMs?: number } = {},
): Promise<(WebImageResult | null)[]> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 6, 12));
  const results: (WebImageResult | null)[] = new Array(queries.length).fill(null);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= queries.length) return;
      const q = queries[i];
      if (!q || typeof q !== "string") continue;
      results[i] = await findWebImage(q, { timeoutMs: opts.timeoutMs });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
