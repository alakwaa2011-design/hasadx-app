import { describe, expect, it } from "vitest";
import { formatRewardPoints, getRewardStudentFirstName } from "./format";

describe("formatRewardPoints", () => {
  it("uses English digits for numeric points", () => {
    expect(formatRewardPoints(1234)).toBe("1,234");
  });

  it("normalizes Arabic-Indic digit strings before formatting", () => {
    expect(formatRewardPoints("١٢٣٤")).toBe("1,234");
  });
});

describe("getRewardStudentFirstName", () => {
  it("returns only the first word from Arabic or Latin student names", () => {
    expect(getRewardStudentFirstName("أحمد محمد علي")).toBe("أحمد");
    expect(getRewardStudentFirstName("Sara Smith")).toBe("Sara");
  });

  it("uses a safe fallback when the name is blank", () => {
    expect(getRewardStudentFirstName("  ")).toBe("طالب");
    expect(getRewardStudentFirstName(null)).toBe("طالب");
  });
});