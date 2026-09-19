import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/student/solve.tsx"),
  "utf8",
);

describe("paper assignment student privacy", () => {
  it("uses a neutral upload prompt when the link is opened by a student", () => {
    expect(source).toContain("const canShowSmartGrading =");
    expect(source).toContain("{canShowSmartGrading ? (");
    expect(source).toContain("{t.solve.paperUploadTitle}");
    expect(source).toContain("canShowSmartGrading ? t.solve.submitAndGrade : t.solve.paperSubmit");
  });
});