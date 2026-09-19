import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/teacher/solo-challenges.tsx"),
  "utf8",
);

describe("solo challenges settings layout", () => {
  it("renders inside the standard platform layout", () => {
    expect(source).toContain('import { Layout } from "@/components/layout"');
    expect(source).toContain("<Layout hideFooter>");
    expect(source).toContain("sticky top-12 sm:top-14");
  });
});