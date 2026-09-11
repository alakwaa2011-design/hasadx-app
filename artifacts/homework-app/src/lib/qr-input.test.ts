import { describe, expect, it } from "vitest";
import { prepareQrValue } from "./qr-input";

describe("prepareQrValue", () => {
  it("keeps Arabic text as the original Unicode string", () => {
    const text = "مرحبًا بكم في منصة حصاد";
    expect(prepareQrValue(text)).toBe(text);
  });

  it("keeps English and mixed text unchanged", () => {
    expect(prepareQrValue("Welcome to Hasaad")).toBe("Welcome to Hasaad");
    expect(prepareQrValue("حصاد Hasaad 2026")).toBe("حصاد Hasaad 2026");
  });

  it("keeps complete URLs raw and adds https to bare web addresses", () => {
    expect(prepareQrValue("https://example.com/a?x=1")).toBe("https://example.com/a?x=1");
    expect(prepareQrValue("example.com/a?x=1")).toBe("https://example.com/a?x=1");
    expect(prepareQrValue("mailto:teacher@example.com")).toBe("mailto:teacher@example.com");
  });

  it("returns an empty payload for whitespace-only input", () => {
    expect(prepareQrValue(" \n\t ")).toBe("");
  });
});