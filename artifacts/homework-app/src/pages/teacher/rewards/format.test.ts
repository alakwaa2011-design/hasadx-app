import { describe, expect, it } from "vitest";
import { formatRewardPoints } from "./format";

describe("formatRewardPoints", () => {
  it("uses English digits for numeric points", () => {
    expect(formatRewardPoints(1234)).toBe("1,234");
  });

  it("normalizes Arabic-Indic digit strings before formatting", () => {
    expect(formatRewardPoints("١٢٣٤")).toBe("1,234");
  });
});