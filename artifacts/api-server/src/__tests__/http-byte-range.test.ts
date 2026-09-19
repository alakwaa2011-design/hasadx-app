import { describe, expect, it } from "vitest";
import { parseHttpByteRange } from "../lib/http-byte-range";

describe("parseHttpByteRange", () => {
  it("parses bounded, open-ended, and suffix byte ranges", () => {
    expect(parseHttpByteRange("bytes=100-199", 1_000)).toEqual({ start: 100, end: 199 });
    expect(parseHttpByteRange("bytes=900-", 1_000)).toEqual({ start: 900, end: 999 });
    expect(parseHttpByteRange("bytes=-100", 1_000)).toEqual({ start: 900, end: 999 });
  });

  it("clamps the requested end to the object size", () => {
    expect(parseHttpByteRange("bytes=950-1200", 1_000)).toEqual({ start: 950, end: 999 });
  });

  it("rejects malformed, multiple, and unsatisfiable ranges", () => {
    expect(parseHttpByteRange("bytes=100-200,300-400", 1_000)).toBe("invalid");
    expect(parseHttpByteRange("bytes=100-99", 1_000)).toBe("invalid");
    expect(parseHttpByteRange("bytes=1000-", 1_000)).toBe("invalid");
    expect(parseHttpByteRange("items=0-1", 1_000)).toBe("invalid");
  });

  it("returns null when no range was requested", () => {
    expect(parseHttpByteRange(undefined, 1_000)).toBeNull();
  });
});