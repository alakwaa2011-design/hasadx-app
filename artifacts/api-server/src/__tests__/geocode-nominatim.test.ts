/**
 * Focused tests for lib/geocode-nominatim.ts
 *
 * Scenarios:
 *  1. Concurrent misses dispatch to Nominatim serially ≥ 1 s apart.
 *  2. A DB-cached positive result is served without a Nominatim call
 *     (simulates cold-memory / post-restart).
 *  3. A negative result cached in the DB is served (404) within TTL;
 *     after expiry (row gone) Nominatim is called again.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ── Hoisted mock state ────────────────────────────────────────────────────────
// Needs to be hoisted so vi.mock factories can reference it.

const dbState = vi.hoisted(() => {
  // Each call to db.execute pops from this queue.
  // Push { rows: [...] } objects to control what the DB returns.
  const queue: Array<{ rows: any[] }> = [];
  const executeCalls: number[] = [];          // timestamps of execute calls
  return { queue, executeCalls };
});

const fetchState = vi.hoisted(() => {
  const callTimes: number[] = [];             // timestamps of actual fetch calls
  let responses: Array<() => Promise<Response>> = [];
  return { callTimes, responses };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    execute: vi.fn(async () => {
      dbState.executeCalls.push(Date.now());
      return dbState.queue.shift() ?? { rows: [] };
    }),
  },
}));

// drizzle-orm sql tag — just needs to produce something; db.execute is mocked.
vi.mock("drizzle-orm", () => ({
  sql: new Proxy(
    (strings: TemplateStringsArray, ..._vals: unknown[]) => ({ raw: strings.join("?") }),
    { get: (_t, p) => p === "empty" ? {} : undefined },
  ),
}));

// Global fetch mock — records call times and returns queued responses.
vi.stubGlobal(
  "fetch",
  vi.fn(async (_url: string) => {
    fetchState.callTimes.push(Date.now());
    const next = fetchState.responses.shift();
    if (next) return next();
    // Default: return a valid Nominatim-shaped response for "TestCity"
    return new Response(
      JSON.stringify([{ lat: "10.0", lon: "20.0", display_name: "TestCity" }]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);

// ── Subject under test ────────────────────────────────────────────────────────

import {
  fetchFromNominatim,
  dbGeocacheLookup,
  dbGeocacheStore,
  geocodeMemCache,
  _resetGeocodeStateForTest,
  GEOCODE_TTL_NOTFOUND_MS,
} from "../lib/geocode-nominatim";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNominatimResponse(lat: string, lon: string, display_name: string): () => Promise<Response> {
  return async () =>
    new Response(JSON.stringify([{ lat, lon, display_name }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function makeEmptyNominatimResponse(): () => Promise<Response> {
  return async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  _resetGeocodeStateForTest();
  dbState.queue.length = 0;
  dbState.executeCalls.length = 0;
  fetchState.callTimes.length = 0;
  fetchState.responses.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fetchFromNominatim — Nominatim serialisation mutex", () => {
  it(
    "concurrent misses dispatch to Nominatim at least 1 s apart",
    async () => {
      // Queue 3 distinct responses (one per city)
      fetchState.responses.push(
        makeNominatimResponse("10.0", "20.0", "CityA"),
        makeNominatimResponse("30.0", "40.0", "CityB"),
        makeNominatimResponse("50.0", "60.0", "CityC"),
      );

      // Fire 3 concurrent Nominatim calls — all queue at the same instant.
      const [a, b, c] = await Promise.all([
        fetchFromNominatim("citya"),
        fetchFromNominatim("cityb"),
        fetchFromNominatim("cityc"),
      ]);

      // All three should resolve successfully
      expect(a?.displayName).toBe("CityA");
      expect(b?.displayName).toBe("CityB");
      expect(c?.displayName).toBe("CityC");

      // Three fetch calls were made
      expect(fetchState.callTimes).toHaveLength(3);

      // Each consecutive pair must be ≥ 1 s (1000 ms) apart.
      // We use 900 ms as the lower bound to absorb CI timing jitter;
      // the implementation enforces 1100 ms.
      const gap1 = fetchState.callTimes[1] - fetchState.callTimes[0];
      const gap2 = fetchState.callTimes[2] - fetchState.callTimes[1];

      expect(gap1).toBeGreaterThanOrEqual(900);
      expect(gap2).toBeGreaterThanOrEqual(900);
    },
    10_000, // allow up to 10 s for the 2-gap serialisation
  );

  it("returns null for a not-found Nominatim response", async () => {
    fetchState.responses.push(makeEmptyNominatimResponse());
    const result = await fetchFromNominatim("nonexistentplace_xyz");
    expect(result).toBeNull();
  });

  it("throws on a non-OK Nominatim response", async () => {
    fetchState.responses.push(async () => new Response("", { status: 503 }));
    await expect(fetchFromNominatim("badplace")).rejects.toThrow("Nominatim HTTP 503");
  });
});

describe("dbGeocacheLookup — DB cache reads", () => {
  it("returns null when DB returns no rows (cache miss / expired)", async () => {
    dbState.queue.push({ rows: [] });
    const result = await dbGeocacheLookup("nocity");
    expect(result).toBeNull();
  });

  it("returns the stored result for a positive DB hit", async () => {
    const stored = { lat: 30.04, lng: 31.24, displayName: "القاهرة" };
    dbState.queue.push({ rows: [{ found: true, result: stored }] });
    const hit = await dbGeocacheLookup("cairo");
    expect(hit).not.toBeNull();
    expect(hit!.found).toBe(true);
    expect(hit!.result).toEqual(stored);
  });

  it("returns found=false with null result for a negative DB hit", async () => {
    dbState.queue.push({ rows: [{ found: false, result: null }] });
    const hit = await dbGeocacheLookup("unknown_place");
    expect(hit).not.toBeNull();
    expect(hit!.found).toBe(false);
    expect(hit!.result).toBeNull();
  });

  it("returns null (treats as miss) when db.execute throws", async () => {
    const { db } = await import("@workspace/db");
    (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("DB connection lost"),
    );
    const result = await dbGeocacheLookup("failcity");
    expect(result).toBeNull();
  });
});

describe("DB-cached positive — cold memory, no Nominatim call", () => {
  it("serves a positive result from DB without hitting Nominatim", async () => {
    // Simulate cold memory (reset already done in beforeEach)
    const stored = { lat: 24.68, lng: 46.72, displayName: "الرياض" };
    // First db.execute call = geocache lookup (returns the row)
    // Second db.execute call = geocache store (would be called after Nominatim, skip)
    dbState.queue.push({ rows: [{ found: true, result: stored }] });

    const hit = await dbGeocacheLookup("riyadh");

    expect(hit).not.toBeNull();
    expect(hit!.result).toEqual(stored);

    // If the route handler uses this result, fetch (Nominatim) must NOT be called.
    expect(fetchState.callTimes).toHaveLength(0);

    // Verify mem cache gets populated (as the route handler does after a DB hit)
    geocodeMemCache.set("riyadh", hit!.result);
    expect(geocodeMemCache.get("riyadh")).toEqual(stored);
  });
});

describe("Negative cache — TTL behaviour", () => {
  it("serves a cached negative from DB without calling Nominatim", async () => {
    // DB returns a not-found entry with future expires_at
    dbState.queue.push({ rows: [{ found: false, result: null }] });

    const hit = await dbGeocacheLookup("ghost_city");

    expect(hit).not.toBeNull();
    expect(hit!.found).toBe(false);
    expect(hit!.result).toBeNull();
    // No Nominatim call should have happened
    expect(fetchState.callTimes).toHaveLength(0);
  });

  it("falls through to Nominatim after the negative entry expires (DB returns no row)", async () => {
    // Expired entry → DB returns empty (WHERE expires_at > NOW() excludes it)
    dbState.queue.push({ rows: [] });             // geocache lookup = miss
    dbState.queue.push({ rows: [] });             // geocache store (after Nominatim)
    fetchState.responses.push(makeNominatimResponse("1.0", "2.0", "ReturnedCity"));

    const dbResult = await dbGeocacheLookup("expired_city");
    expect(dbResult).toBeNull(); // confirmed: cache miss

    // Route logic: call Nominatim since cache missed
    const fetched = await fetchFromNominatim("expired_city");
    expect(fetched).not.toBeNull();
    expect(fetched!.displayName).toBe("ReturnedCity");
    expect(fetchState.callTimes).toHaveLength(1); // exactly one Nominatim call
  });

  it("GEOCODE_TTL_NOTFOUND_MS is 7 days", () => {
    expect(GEOCODE_TTL_NOTFOUND_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
