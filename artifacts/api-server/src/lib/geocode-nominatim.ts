/**
 * Nominatim geocoding helper with a two-level cache (in-memory + DB)
 * and a process-wide promise-chain mutex that serialises Nominatim calls
 * ≥ 1.1 s apart — even when many concurrent requests all miss the cache.
 *
 * The previous pattern (read lastNominatimAt → await delay → set lastNominatimAt)
 * was not atomic: every concurrent miss computed its own wait at the same
 * instant and all fired together.  The mutex below chains each Nominatim
 * call onto a single promise so they are dispatched strictly in sequence.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// ── TTL constants ─────────────────────────────────────────────────────────────
// Positive (place found): 90 days — coordinates are geographically stable.
// Negative (not found):    7 days — allow Nominatim to gain new entries.
export const GEOCODE_TTL_FOUND_MS    = 90 * 24 * 60 * 60 * 1000;
export const GEOCODE_TTL_NOTFOUND_MS =  7 * 24 * 60 * 60 * 1000;

export type GeocodeResult = { lat: number; lng: number; displayName: string };

// ── L1 in-memory cache ────────────────────────────────────────────────────────
export const geocodeMemCache = new Map<string, GeocodeResult | null>();

// ── Nominatim mutex ───────────────────────────────────────────────────────────
// A promise chain that serialises all Nominatim calls process-wide.
// Each new call is appended to the tail; the chain advances (error-suppressed)
// regardless of whether the previous call succeeded or failed.
let nominatimChain: Promise<void> = Promise.resolve();
let lastNominatimAt = 0;

/**
 * Schedules `fn` to run only after the previous Nominatim call has finished
 * AND at least 1.1 s have elapsed since that call fired.
 * Returns a promise that resolves/rejects with fn's result.
 */
function scheduleNominatimCall<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = nominatimChain.then(async () => {
    const wait = Math.max(0, lastNominatimAt + 1100 - Date.now());
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fn();
  });

  // Advance the chain regardless of success / failure so subsequent calls
  // are never blocked by a previous rejection.
  nominatimChain = result.then(
    () => {},
    () => {},
  );

  return result;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function dbGeocacheLookup(
  key: string,
): Promise<{ found: boolean; result: GeocodeResult | null } | null> {
  try {
    const rows = await db.execute(sql`
      SELECT found, result
      FROM geocode_cache
      WHERE query_key = ${key} AND expires_at > NOW()
    `);
    const row = ((rows as any).rows ?? rows)[0];
    if (!row) return null;
    return { found: Boolean(row.found), result: (row.result as GeocodeResult) ?? null };
  } catch {
    return null;
  }
}

export async function dbGeocacheStore(
  key: string,
  result: GeocodeResult | null,
): Promise<void> {
  try {
    const ttlMs    = result ? GEOCODE_TTL_FOUND_MS : GEOCODE_TTL_NOTFOUND_MS;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await db.execute(sql`
      INSERT INTO geocode_cache (query_key, found, result, expires_at)
      VALUES (
        ${key},
        ${result !== null},
        ${result ? JSON.stringify(result) : null}::jsonb,
        ${expiresAt}::timestamp
      )
      ON CONFLICT (query_key) DO UPDATE
        SET found       = EXCLUDED.found,
            result      = EXCLUDED.result,
            created_at  = NOW(),
            expires_at  = EXCLUDED.expires_at
    `);
  } catch {
    /* non-fatal — L1 mem cache still works if DB write fails */
  }
}

// ── Public geocode entry-point ────────────────────────────────────────────────

/**
 * Fetches coordinates from Nominatim via the serialised mutex.
 * Returns null if the place was not found.
 * Throws on network / HTTP errors.
 */
export async function fetchFromNominatim(q: string): Promise<GeocodeResult | null> {
  return scheduleNominatimCall(async () => {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=ar`;
    const r = await fetch(url, {
      headers: { "User-Agent": "hasad-edu-app/1.0 (educational whiteboard)" },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
    const data  = (await r.json()) as any[];
    const lat   = parseFloat(data?.[0]?.lat);
    const lng   = parseFloat(data?.[0]?.lon);
    if (!data?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: String(data[0].display_name ?? "") };
  });
}

// ── Test helper ───────────────────────────────────────────────────────────────
/** Resets all module-level state. Call in beforeEach inside tests. */
export function _resetGeocodeStateForTest(): void {
  geocodeMemCache.clear();
  nominatimChain  = Promise.resolve();
  lastNominatimAt = 0;
}
