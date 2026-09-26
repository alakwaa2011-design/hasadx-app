import { describe, expect, it } from "vitest";
import {
  addQuranDays,
  assessPersonalVerse,
  emptyQuranPersonalState,
  masteredTodayInPlan,
  nextPersonalMemorization,
  personalDueReviews,
  validPersonalPlan,
  verseAtOrdinal,
  verseOrdinal,
} from "./quran-personal-plan";

describe("anonymous Quran memorization and review", () => {
  const plan = {
    start: { surah: 1, ayah: 7 },
    end: { surah: 2, ayah: 2 },
    dailyGoal: 2,
  };

  it("supports a precise cross-surah range and rejects reversed or invalid ranges", () => {
    expect(validPersonalPlan(plan)).toBe(true);
    expect(verseAtOrdinal(verseOrdinal(plan.start)! + 1)).toEqual({ surah: 2, ayah: 1 });
    expect(validPersonalPlan({ ...plan, start: plan.end, end: plan.start })).toBe(false);
    expect(validPersonalPlan({ ...plan, dailyGoal: 0 })).toBe(false);
    expect(validPersonalPlan({ ...plan, end: { surah: 2, ayah: 999 } })).toBe(false);
  });

  it("schedules new successes in two days, then seven, and unsuccessful review tomorrow", () => {
    const initial = { ...emptyQuranPersonalState(), plan };
    const ayah = plan.start;
    const first = assessPersonalVerse(initial, ayah, "mastered", "2026-09-26");
    expect(personalDueReviews(first, "2026-09-27")).toEqual([]);
    expect(personalDueReviews(first, "2026-09-28")).toEqual([
      { ...ayah, dueDate: "2026-09-28", intervalDays: 2 },
    ]);
    const second = assessPersonalVerse(first, ayah, "mastered", "2026-09-28");
    expect(personalDueReviews(second, "2026-10-05")).toHaveLength(1);
    const retry = assessPersonalVerse(second, ayah, "review", "2026-10-05");
    expect(personalDueReviews(retry, "2026-10-06")).toEqual([
      { ...ayah, dueDate: "2026-10-06", intervalDays: 1 },
    ]);
    expect(masteredTodayInPlan(retry, "2026-10-05")).toBe(0);
  });

  it("retains the first mastery date and advances only to an unmastered verse", () => {
    let state = { ...emptyQuranPersonalState(), plan };
    expect(nextPersonalMemorization(state)).toEqual(plan.start);
    state = assessPersonalVerse(state, plan.start, "review", "2026-09-26");
    expect(nextPersonalMemorization(state)).toEqual(plan.start);
    state = assessPersonalVerse(state, plan.start, "mastered", "2026-09-26");
    expect(nextPersonalMemorization(state)).toEqual({ surah: 2, ayah: 1 });
    expect(masteredTodayInPlan(state, "2026-09-26")).toBe(1);
    state = assessPersonalVerse(state, plan.start, "mastered", "2026-09-28");
    expect(masteredTodayInPlan(state, "2026-09-26")).toBe(1);
    expect(masteredTodayInPlan(state, "2026-09-28")).toBe(0);
  });

  it("handles calendar boundaries without UTC date slicing", () => {
    expect(addQuranDays("2026-12-31", 2)).toBe("2027-01-02");
  });
});