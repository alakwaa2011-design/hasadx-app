import { describe, expect, it } from "vitest";
import { preferredSubjectScore, subjectMatchesQuery } from "@/pages/teacher/shared-content";

describe("activity library subject preference", () => {
  it("matches Arabic subject aliases", () => {
    expect(subjectMatchesQuery("حساب وجبر", "الرياضيات")).toBe(true);
    expect(subjectMatchesQuery("لغة عربية", "عربي")).toBe(true);
  });

  it("prioritizes only matching specialist content", () => {
    expect(preferredSubjectScore("رياضيات", "الرياضيات")).toBe(1);
    expect(preferredSubjectScore("علوم", "الرياضيات")).toBe(0);
  });

  it("does not narrow general or event organizers", () => {
    expect(preferredSubjectScore("علوم", "متعدد التخصصات")).toBe(0);
    expect(preferredSubjectScore("رياضيات", "فعاليات وتدريب")).toBe(0);
  });
});