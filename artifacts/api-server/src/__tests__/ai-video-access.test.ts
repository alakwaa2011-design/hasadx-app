import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.hoisted(() => vi.fn());

function chain(result: () => unknown): any {
  return new Proxy(function () {}, {
    get(_target, property) {
      if (property === "then" || property === "catch" || property === "finally") {
        const promise = Promise.resolve().then(result);
        return (promise as any)[property].bind(promise);
      }
      return () => chain(result);
    },
    apply: () => chain(result),
  });
}

vi.mock("@workspace/db", () => ({
  db: { select },
  teachersTable: new Proxy({}, { get: (_target, property) => String(property) }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  };
});

import { hasAiVideoAdminAccess } from "../lib/ai-video-access";

describe("hasAiVideoAdminAccess", () => {
  beforeEach(() => {
    select.mockReset();
  });

  it("allows only a teacher row whose database isAdmin flag is true", async () => {
    select.mockImplementationOnce(() => chain(() => [{ isAdmin: true }]));
    await expect(hasAiVideoAdminAccess(42)).resolves.toBe(true);

    select.mockImplementationOnce(() => chain(() => [{ isAdmin: false }]));
    await expect(hasAiVideoAdminAccess(42)).resolves.toBe(false);
  });

  it("fails closed when no teacher row exists", async () => {
    select.mockImplementation(() => chain(() => []));

    await expect(hasAiVideoAdminAccess(42)).resolves.toBe(false);
  });

  it("propagates query failures so callers can return a service error", async () => {
    select.mockImplementation(() => chain(() => {
      throw new Error("database unavailable");
    }));

    await expect(hasAiVideoAdminAccess(42)).rejects.toThrow("database unavailable");
  });
});