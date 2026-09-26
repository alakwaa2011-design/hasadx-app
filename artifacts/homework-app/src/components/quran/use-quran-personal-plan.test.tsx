import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QURAN_PERSONAL_PLAN_KEY, assessPersonalVerse, emptyQuranPersonalState, readQuranPersonalState } from "./quran-personal-plan";
import { useQuranPersonalPlan } from "./use-quran-personal-plan";

afterEach(() => {
  cleanup();
  localStorage.removeItem(QURAN_PERSONAL_PLAN_KEY);
});

describe("personal Quran plan persistence", () => {
  it("refuses to overwrite unreadable prior assessments", () => {
    localStorage.setItem(QURAN_PERSONAL_PLAN_KEY, "{old unrecognized record");
    const { result } = renderHook(() => useQuranPersonalPlan(true));
    expect(result.current.error).toBe(true);
    act(() => {
      expect(result.current.savePlan({
        start: { surah: 1, ayah: 1 },
        end: { surah: 1, ayah: 2 },
        dailyGoal: 1,
      })).toBe(false);
    });
    expect(localStorage.getItem(QURAN_PERSONAL_PLAN_KEY)).toBe("{old unrecognized record");
  });

  it("keeps assessments written by a second tab after this tab mounted", () => {
    const { result } = renderHook(() => useQuranPersonalPlan(true));
    const external = assessPersonalVerse(emptyQuranPersonalState(), { surah: 1, ayah: 1 }, "mastered", "2026-09-26");
    localStorage.setItem(QURAN_PERSONAL_PLAN_KEY, JSON.stringify(external));
    act(() => {
      expect(result.current.assess({ surah: 1, ayah: 2 }, "mastered")).toBe(true);
    });
    const saved = readQuranPersonalState();
    expect(saved.assessments["1:1"]).toEqual(external.assessments["1:1"]);
    expect(saved.assessments["1:2"]?.result).toBe("mastered");
  });

  it("updates an open tab when another tab changes saved data", () => {
    const { result } = renderHook(() => useQuranPersonalPlan(true));
    const external = assessPersonalVerse(emptyQuranPersonalState(), { surah: 1, ayah: 1 }, "review", "2020-09-26");
    localStorage.setItem(QURAN_PERSONAL_PLAN_KEY, JSON.stringify(external));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: QURAN_PERSONAL_PLAN_KEY, newValue: JSON.stringify(external) }));
    });
    expect(result.current.due).toEqual([{ surah: 1, ayah: 1, dueDate: "2020-09-27", intervalDays: 1 }]);
    expect(result.current.error).toBe(false);
    expect(result.current.session?.verse).toEqual({ surah: 1, ayah: 1 });
  });
});