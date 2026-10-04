// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { WorksheetActivityView, shuffleStable, activityHeightMm } from "./worksheet-activity";
import {
  suggestActivities, autoRequestFields, pruneConstraints, fitBlockMessage, appendAutoFormFields,
} from "./worksheet-quick-setup";

describe("quick setup requests", () => {
  it("suggests three distinct contextual styles", () => {
    const a = suggestActivities("العلوم", "الصف الثامن");
    expect(new Set(a.map(x => x.style)).size).toBe(3);
    const young = suggestActivities("", "الصف الأول");
    expect(young.map(x => x.style)).toContain("coloring");
  });
  it("auto request carries no legacy pedagogical defaults or board flag", () => {
    const f = autoRequestFields({ activityStyle: "auto", executionMode: "individual", constraints: {}, pages: 1, boardEnabled: false });
    expect(f).toEqual({ questionSelection: "auto", pages: 1, activityStyle: "auto", executionMode: "individual", generationConstraints: {} });
    for (const k of ["difficulty", "cognitiveSkill", "activityDuration", "differentiation", "assessmentMode", "counts", "groupSize"]) expect(f).not.toHaveProperty(k);
  });
  it("includes group size and board only when chosen; form data JSON-encodes constraints", () => {
    const input = { activityStyle: "group_task" as const, executionMode: "group" as const, groupSize: 4, constraints: { difficulty: "easy" as const }, pages: 2 as const, boardEnabled: true };
    const f = autoRequestFields(input);
    expect(f.groupSize).toBe(4);
    expect(f.counts).toEqual({ tic_tac_toe: 1 });
    const fd = new FormData();
    appendAutoFormFields(fd, input);
    expect(JSON.parse(String(fd.get("generationConstraints")))).toEqual({ difficulty: "easy" });
  });
  it("prunes unset constraints", () => {
    expect(pruneConstraints({ difficulty: undefined, allowedTypes: [], learningObjective: " x " })).toEqual({ learningObjective: "x" });
    expect(pruneConstraints({ learningObjective: "   " })).toEqual({});
  });
  it("does not suggest childish coloring for secondary grades with primary-like names", () => {
    expect(suggestActivities("الرياضيات", "الصف الأول الثانوي").map(x => x.style)).not.toContain("coloring");
  });
  it("reports page mismatch truthfully", () => {
    expect(fitBlockMessage(1, 2, false)).toContain("2 pages");
    expect(fitBlockMessage(2, 2, false)).toBeNull();
    expect(fitBlockMessage(undefined, 9, false)).toBeNull();
  });
});

describe("activity renderer", () => {
  it.each([
    { kind: "concept_map" as const, center: "الماء", branches: ["المصادر", "الاستخدامات"], spaceHeight: 120 },
    { kind: "drawing" as const, spaceHeight: 140 },
    { kind: "coloring" as const, spaceHeight: 60 },
    { kind: "group_task" as const, roles: ["قارئ", "كاتب"], steps: ["ناقش", "اتفق"], spaceHeight: 120 },
  ])("renders the blank printable $kind workspace", activity => {
    const { container } = render(<WorksheetActivityView activity={activity} seed="activity" />);
    expect(container.querySelector(`[data-activity="${activity.kind}"]`)).toBeTruthy();
    expect(container.querySelectorAll("textarea,input").length).toBe(0);
    cleanup();
  });
  it("never reorders into the original order and renders blank structures", () => {
    const items = ["a", "b", "c", "d"];
    expect(shuffleStable(items, "q1")).not.toEqual(items);
    const { container } = render(<WorksheetActivityView seed="q1" activity={{ kind: "sequencing", items, spaceHeight: 100 }} />);
    expect(container.querySelectorAll("[data-activity=sequencing] b").length).toBe(4);
    cleanup();
  });
  it("sorting shows categories and no answers; heights grow with space", () => {
    const a = { kind: "sorting" as const, items: ["x", "y"], categories: ["c1", "c2"], spaceHeight: 100 };
    const { getByText } = render(<WorksheetActivityView seed="s" activity={a} />);
    expect(getByText("c1")).toBeTruthy();
    expect(activityHeightMm({ ...a, spaceHeight: 180 })).toBeGreaterThan(activityHeightMm(a));
    cleanup();
  });
});
