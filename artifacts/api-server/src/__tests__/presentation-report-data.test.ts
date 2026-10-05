import { describe, expect, it } from "vitest";
import { mergePresentationReportData, buildPresentationActivityIndex } from "../lib/presentation-report-data";

const time = new Date("2026-10-05T05:00:00Z");
const legacy = { id: 12, sessionId: 1, slideIndex: 0, elementId: "q", studentKey: "one", studentName: "One",
  classStudentId: null, answerIndex: 0, answerText: null, isCorrect: true, createdAt: time };
const event = (kind: string, payload: Record<string, any>, id = 1) => ({ id, sessionId: 1, kind, eventKey: String(id), payload, createdAt: time });

describe("durable presentation report evidence", () => {
  it("preserves joins with no answers and never treats a projector as a join", () => {
    const data = mergePresentationReportData([event("join", { studentKey: "silent", name: "Silent" }), event("open", { elementId: "q" }, 2)], [], []);
    expect(data.joins).toHaveLength(1);
    expect(data.rows).toHaveLength(0);
  });
  it("deduplicates only the exact mirrored legacy response", () => {
    const data = mergePresentationReportData([event("answer", {
      ...legacy, legacyResponseId: 12, baseElementId: "q",
    })], [legacy, { ...legacy, id: 13, studentKey: "older" }], []);
    expect(data.rows).toHaveLength(2);
    expect(data.rows.map(r => r.studentKey).sort()).toEqual(["older", "one"]);
  });
  it("keeps separate accepted rounds rather than merging a student's real answers", () => {
    const payload = { ...legacy, baseElementId: "q" };
    const data = mergePresentationReportData([event("answer", payload), event("answer", { ...payload, isCorrect: false }, 2)], [], []);
    expect(data.rows).toHaveLength(2);
    expect(data.rows.reduce((n, r) => n + r.correctUnits, 0)).toBe(1);
  });
  it("counts text and polls as participation, not graded correctness", () => {
    const data = mergePresentationReportData([event("answer", { ...legacy, answerIndex: null, answerText: "صدق", isCorrect: null })], [], []);
    expect(data.rows[0]).toMatchObject({ answerUnits: 1, correctUnits: 0, scoredUnits: 0 });
  });
  it("includes historical quiz summaries without inventing individual answers", () => {
    const run = { id: 4, sessionId: 1, elementId: "game", totalQuestions: 3, studentKey: "one", studentName: "One",
      classStudentId: null, correct: 2, answered: 3, finishedAt: time };
    const data = mergePresentationReportData([], [], [run]);
    expect(data.rows[0]).toMatchObject({ answerUnits: 3, correctUnits: 2, scoredUnits: 3, aggregateOnly: true, answerIndex: null, answerText: null });
    const index = buildPresentationActivityIndex([{ elements: [{ id: "game", kind: "hasad-game", questions: [{}, {}, {}] }] }], data.rows, []);
    expect([...index.keys()]).toEqual(["game"]);
  });
  it("does not double-count a completed quiz whose question answers are journaled", () => {
    const run = { id: 4, sessionId: 1, elementId: "game", totalQuestions: 1, studentKey: "one", studentName: "One",
      classStudentId: null, correct: 1, answered: 1, finishedAt: time };
    const data = mergePresentationReportData([
      event("answer", { ...legacy, elementId: "game::q:0", baseElementId: "game" }),
      event("quiz-complete", { elementId: "game", finishedAt: time.toISOString() }, 2),
    ], [], [run]);
    expect(data.rows).toHaveLength(1);
  });
  it("uses saved question content after editing a deck", () => {
    const data = mergePresentationReportData([event("answer", { ...legacy, meta: { prompt: "Original", correctIndex: 0 } })], [], []);
    const index = buildPresentationActivityIndex([{ elements: [{ kind: "activity", id: "q", prompt: "Edited", correctIndex: 1 }] }], data.rows, []);
    expect(index.get("q")?.element).toMatchObject({ prompt: "Original", correctIndex: 0 });
  });
});
