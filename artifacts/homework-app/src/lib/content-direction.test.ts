import { describe, expect, it } from "vitest";
import { contentDirection, isEquationOnly } from "./content-direction";

describe("contentDirection", () => {
  it("switches between Arabic and English from the entered content", () => {
    expect(contentDirection("اكتب الإجابة", "ltr")).toBe("rtl");
    expect(contentDirection("Write the answer", "rtl")).toBe("ltr");
  });

  it("keeps math-only expressions left-to-right", () => {
    expect(contentDirection("(-8) + (-6) =", "rtl")).toBe("ltr");
    expect(contentDirection("(+20) - (+14)", "rtl")).toBe("ltr");
    expect(isEquationOnly("(-5) + (-9) - (+4)")).toBe(true);
    expect(isEquationOnly("+6")).toBe(true);
    expect(isEquationOnly("-34")).toBe(true);
    expect(isEquationOnly("+18")).toBe(true);
    expect(isEquationOnly("-10")).toBe(true);
    expect(isEquationOnly("احسب 5 + 3")).toBe(false);
  });

  it("uses the interface direction while the field is empty", () => {
    expect(contentDirection("", "rtl")).toBe("rtl");
  });
});