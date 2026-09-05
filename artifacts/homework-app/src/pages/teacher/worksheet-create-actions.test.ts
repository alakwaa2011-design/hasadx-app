import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/teacher/worksheet-create.tsx"),
  "utf8",
);

describe("worksheet builder navigation and destructive actions", () => {
  it("uses safe in-app back navigation", () => {
    expect(source).toContain('useSmartBack("/teacher")');
    expect(source).toContain("onClick={goBack}");
  });

  it("requires confirmation before clearing every question and removes stale layout settings", () => {
    expect(source).toContain("هل تريد حذف جميع الأسئلة؟");
    expect(source).toContain("setQuestions([])");
    expect(source).toContain("pageBreaks: [], questionStyles: []");
  });
});