import { describe, expect, it } from "vitest";
import {
  canonicalizeJson,
  gameContentFingerprint,
  savedGameActivityUpsertSchema,
} from "../lib/saved-game-activities";

describe("saved game activity canonicalization", () => {
  it("sorts object keys recursively but preserves question order", () => {
    expect(canonicalizeJson({
      z: [{ b: 2, a: 1 }, "second"],
      a: { y: true, x: null },
    })).toBe('{"a":{"x":null,"y":true},"z":[{"a":1,"b":2},"second"]}');
  });

  it("uses one fingerprint for equivalent JSON content", () => {
    expect(gameContentFingerprint("rocket", { b: 2, a: { y: 1, x: 0 } }))
      .toBe(gameContentFingerprint("rocket", { a: { x: 0, y: 1 }, b: 2 }));
    expect(gameContentFingerprint("rocket", [{ id: 1 }, { id: 2 }]))
      .not.toBe(gameContentFingerprint("rocket", [{ id: 2 }, { id: 1 }]));
  });
});

describe("saved game activity request validation", () => {
  it("rejects a client-supplied teacherId and missing game content", () => {
    expect(savedGameActivityUpsertSchema.safeParse({
      teacherId: 7, gameType: "rocket", title: "Test", content: [],
    }).success).toBe(false);
    expect(savedGameActivityUpsertSchema.safeParse({
      gameType: "rocket", title: "Test",
    }).success).toBe(false);
  });

  it("accepts bounded game content and defaults save metadata", () => {
    const result = savedGameActivityUpsertSchema.safeParse({
      gameType: "rocket", title: "Test", questions: [{ prompt: "1 + 1?" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
      expect(result.data.settings).toEqual({});
    }
  });
});