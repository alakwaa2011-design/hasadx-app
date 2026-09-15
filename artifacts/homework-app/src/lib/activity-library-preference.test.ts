import { describe, expect, it } from "vitest";
import {
  preferredSubjectScore,
  preferredSubjectsFromAccount,
  sortByPreferredSubject,
  subjectMatchesQuery,
} from "@/pages/teacher/shared-content";

describe("activity library subject preference", () => {
  it("matches Arabic subject aliases", () => {
    expect(subjectMatchesQuery("حساب وجبر", "الرياضيات")).toBe(true);
    expect(subjectMatchesQuery("لغة عربية", "عربي")).toBe(true);
  });

  it("prioritizes only matching specialist content", () => {
    expect(preferredSubjectScore("رياضيات", ["الرياضيات", "العلوم"])).toBe(1);
    expect(preferredSubjectScore("علوم", ["الرياضيات", "العلوم"])).toBe(1);
    expect(preferredSubjectScore("لغة عربية", ["الرياضيات", "العلوم"])).toBe(0);
  });

  it("does not narrow general or event organizers", () => {
    expect(preferredSubjectScore("علوم", [])).toBe(0);
    expect(preferredSubjectScore("رياضيات", ["فعاليات وتدريب"])).toBe(0);
  });

  it("uses the saved custom subject after a fresh account load to prioritize matching activities", () => {
    const accountAfterReload = {
      subjects: ["التفكير الحاسوبي"],
    };
    const preferredSubjects = preferredSubjectsFromAccount(accountAfterReload);
    const activities = [
      { id: "newer-general", subject: "علوم", createdAt: "2026-09-15T10:00:00Z" },
      { id: "saved-subject", subject: "التفكير الحاسوبي", createdAt: "2026-09-10T10:00:00Z" },
      { id: "other-subject", subject: "رياضيات", createdAt: "2026-09-14T10:00:00Z" },
    ];

    const ordered = sortByPreferredSubject(
      activities,
      preferredSubjects,
      (activity) => activity.subject,
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    expect(preferredSubjects).toEqual(["التفكير الحاسوبي"]);
    expect(preferredSubjectScore("التفكير الحاسوبي", preferredSubjects)).toBe(1);
    expect(ordered.map((activity) => activity.id)).toEqual([
      "saved-subject",
      "newer-general",
      "other-subject",
    ]);
    expect(ordered).toHaveLength(activities.length);
  });
});