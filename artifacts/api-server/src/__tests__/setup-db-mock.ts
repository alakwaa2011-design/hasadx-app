/**
 * Global vitest setup: auto-stub every export from @workspace/db.
 *
 * Problem this solves
 * -------------------
 * When a new Drizzle table is added to lib/db/src/schema and used in a route,
 * any test whose vi.mock("@workspace/db", factory) factory doesn't list that
 * table receives `undefined` for it. Passing `undefined` to db.insert() (or
 * similar) causes a 500 instead of the expected success status, and the error
 * message rarely points at the missing export.
 *
 * Solution
 * --------
 * This file is loaded as a vitest setupFile (see vitest.config.ts). It calls
 * vi.mock("@workspace/db", proxyFactory) once, globally. The proxy factory:
 *
 *   • Provides a fully-functional `db` mock (select / insert / update / delete
 *     / transaction chains) that resolves to an empty array by default.
 *   • Returns a Proxy-backed stub for every named export that is not explicitly
 *     listed in the known overrides map (tables, constants, etc.).
 *
 * Per-file overrides still work
 * -----------------------------
 * Any test file that calls vi.mock("@workspace/db", ownFactory) has its factory
 * take precedence over this global registration for that file only. This means
 * all existing test files that supply their own factories continue to work
 * unchanged, while tests that do NOT provide a factory receive a safe,
 * auto-stubbing mock with no manual table list to maintain.
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Reusable promise chain that forwards all Drizzle query builder methods
// and resolves to `result` when awaited.
// ---------------------------------------------------------------------------
function makeChain(result: unknown): unknown {
  const p: Promise<unknown> = Promise.resolve(result);
  const handler: ProxyHandler<Promise<unknown>> = {
    get(target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const fn = (target as Record<string, unknown>)[prop as string] as (
          ...args: unknown[]
        ) => unknown;
        return fn.bind(target);
      }
      // Any builder method (from, where, join, orderBy, limit, returning, …)
      // returns the same chain so arbitrary chaining never throws.
      return () => makeChain(result);
    },
  };
  return new Proxy(p, handler);
}

// ---------------------------------------------------------------------------
// Default db mock: every operation resolves to [] (no rows).
// Individual tests override this via their own vi.mock factory or by
// configuring per-test state in a beforeEach.
// ---------------------------------------------------------------------------
function makeDefaultDb() {
  const txMethods = () => ({
    select: () => makeChain([]),
    insert: () => makeChain([]),
    update: () => makeChain([]),
    delete: () => makeChain([]),
  });
  return {
    select: () => makeChain([]),
    insert: () => makeChain([]),
    update: () => makeChain([]),
    delete: () => makeChain([]),
    transaction: async (fn: (tx: ReturnType<typeof txMethods>) => unknown) =>
      fn(txMethods()),
  };
}

// ---------------------------------------------------------------------------
// A table stub that is a safe stand-in for any Drizzle table reference.
// It returns a string for every property access so tableName(stub).__tableName
// is always defined (avoids TypeErrors in helpers that inspect table objects).
// ---------------------------------------------------------------------------
const tableStub = new Proxy(
  {},
  {
    get(_target, prop) {
      // Return the property name as a string so __tableName lookups succeed.
      if (typeof prop === "string") return prop;
      return undefined;
    },
  },
);

// ---------------------------------------------------------------------------
// Known non-table constants exported from @workspace/db.
// These are the only values that need explicit stubs; all table-shaped exports
// are covered automatically by the catch-all Proxy below.
// ---------------------------------------------------------------------------
const KNOWN_OVERRIDES: Record<string, unknown> = {
  db: makeDefaultDb(),
  pool: { connect: vi.fn(), end: vi.fn(), query: vi.fn() },
  DEFAULT_ARENA_IMPORT_SOURCES: {
    manual: true,
    ai: true,
    homework: true,
    file: true,
  },
  DEFAULT_PRESENTATION_LIMITS: { maxDecks: 1000, maxAssetMb: 100 },
  XP_MIGRATION_SQL: "",
};

// ---------------------------------------------------------------------------
// Register the global mock. The Proxy's get trap ensures that any future
// table export (not yet listed in KNOWN_OVERRIDES) returns tableStub rather
// than undefined.
// ---------------------------------------------------------------------------
vi.mock(
  "@workspace/db",
  () =>
    new Proxy(KNOWN_OVERRIDES, {
      get(target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop in target) return target[prop];
        // Unknown export → safe table stub. This covers every table added to
        // lib/db/src/schema in the future without any manual test file edits.
        return tableStub;
      },
      has(_target, _prop) {
        // Make `in` checks always succeed so vitest's module introspection
        // doesn't treat missing keys as absent.
        return true;
      },
    }),
);
