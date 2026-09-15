import { describe, expect, it } from "vitest";
import { normalizeXoTitle } from "./xo-display";

describe("normalizeXoTitle", () => {
  it("normalizes known built-in titles without changing custom titles", () => {
    expect(normalizeXoTitle("إكس أو")).toBe("X O");
    expect(normalizeXoTitle("XO Class")).toBe("X O");
    expect(normalizeXoTitle("Teacher's XO tournament")).toBe("Teacher's XO tournament");
  });
});