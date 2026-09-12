import { describe, expect, it } from "vitest";
import { getArabicRewardError } from "./error-message";

describe("getArabicRewardError", () => {
  it("translates invalid time errors into Arabic", () => {
    expect(getArabicRewardError(new RangeError("Invalid time value"))).toContain("التاريخ أو الوقت");
  });

  it("keeps an Arabic server message", () => {
    expect(getArabicRewardError(new Error("انتهت صلاحية الهدف"))).toBe("انتهت صلاحية الهدف");
  });

  it("does not expose an unknown English server error", () => {
    expect(getArabicRewardError(new Error("Unexpected provider failure"), "تعذر حفظ الهدف")).toBe("تعذر حفظ الهدف");
  });
});