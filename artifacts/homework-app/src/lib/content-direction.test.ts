import { describe, expect, it } from "vitest";
import { contentDirection } from "./content-direction";

describe("contentDirection", () => {
  it("switches between Arabic and English from the entered content", () => {
    expect(contentDirection("اكتب الإجابة", "ltr")).toBe("rtl");
    expect(contentDirection("Write the answer", "rtl")).toBe("ltr");
  });

  it("keeps math-only expressions left-to-right", () => {
    expect(contentDirection("(-8) + (-6) =", "rtl")).toBe("ltr");
  });

  it("uses the interface direction while the field is empty", () => {
    expect(contentDirection("", "rtl")).toBe("rtl");
  });
});