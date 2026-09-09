import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DashboardOverview student links", () => {
  it("copies the registered student solve route instead of the removed 404 route", () => {
    const source = readFileSync(
      "src/components/teacher/DashboardOverview.tsx",
      "utf8",
    );

    expect(source).toContain("`${window.location.origin}/solve/${a.id}`");
    expect(source).not.toContain("/student/assignment/");
  });
});