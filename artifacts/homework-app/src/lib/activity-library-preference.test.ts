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

  it.each([
    {
      label: "assignments",
      items: [
        { id: "assignment-matching-old", subject: "الروبوتات", secondary: 2 },
        { id: "assignment-matching-new", subject: "الروبوتات", secondary: 4 },
        { id: "assignment-other-new", subject: "العلوم", secondary: 5 },
        { id: "assignment-other-old", subject: "العلوم", secondary: 1 },
      ],
    },
    {
      label: "questions",
      items: [
        { id: "question-matching-low", subject: "الروبوتات", secondary: 1 },
        { id: "question-matching-high", subject: "الروبوتات", secondary: 3 },
        { id: "question-other-high", subject: "العلوم", secondary: 4 },
        { id: "question-other-low", subject: "العلوم", secondary: 2 },
      ],
    },
    {
      label: "videos",
      items: [
        { id: "video-matching-old", subject: "الروبوتات", secondary: 2 },
        { id: "video-matching-new", subject: "الروبوتات", secondary: 5 },
        { id: "video-other-new", subject: "العلوم", secondary: 6 },
        { id: "video-other-old", subject: "العلوم", secondary: 1 },
      ],
    },
    {
      label: "live activities",
      items: [
        { id: "live-matching-low", subject: "الروبوتات", secondary: 2 },
        { id: "live-matching-high", subject: "الروبوتات", secondary: 7 },
        { id: "live-other-high", subject: "العلوم", secondary: 8 },
        { id: "live-other-low", subject: "العلوم", secondary: 1 },
      ],
    },
  ])("$label put saved custom-subject matches first without changing secondary order", ({ items }) => {
    const sorted = sortByPreferredSubject(
      items,
      ["الروبوتات"],
      item => item.subject,
      (a, b) => b.secondary - a.secondary,
    );

    expect(sorted.map(item => item.id)).toEqual([
      items[1].id,
      items[0].id,
      items[2].id,
      items[3].id,
    ]);
  });
});