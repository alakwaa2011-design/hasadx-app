import { describe, expect, it } from "vitest";
import {
  assignmentContentFingerprint,
  buildLegacyDuplicateCandidates,
} from "../lib/assignment-duplicate-detection";

const date = (value: string) => new Date(`2026-01-01T${value}:00.000Z`);
const question = (assignmentId: number, text = "ما عاصمة مصر؟") => ({
  assignmentId,
  questionType: "mcq",
  text,
  optionA: "القاهرة",
  optionB: "الرياض",
  optionC: null,
  optionD: null,
  correctAnswer: "A",
  points: 1,
  imageUrl: null,
  readAloud: false,
  difficulty: null,
  skill: null,
  allowMultipleAnswers: false,
  repeatQuestion: false,
});


const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  teacherId: 10,
  title: "عواصم عربية",
  subject: "جغرافيا",
  contentKind: "homework",
  totalPoints: 1,
  createdAt: date("09:00"),
  updatedAt: date("09:00"),
  version: 1,
  archivedAt: null,
  duplicateScanConfirmedAt: null,
  importedFromAssignmentId: null,
  submissionCount: 0,
  teacherName: "المعلم المصدر",
  ...overrides,
});

describe("legacy assignment duplicate detection", () => {
  it("matches only exact, high-confidence source copies", () => {
    const source = assignment({ id: 2, teacherId: 20 });
    const local = assignment({ id: 3, teacherId: 10, title: "عواصم عربية (نسخة)" });
    const questions = new Map([
      [2, [question(2)]],
      [3, [question(3)]],
    ]);

    const result = buildLegacyDuplicateCandidates({
      sources: [source],
      localAssignments: [local],
      questionsByAssignmentId: questions,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      canArchive: false,
      recommendedAction: "keep_duplicate",
      hasTeacherEdits: false,
      hasUsage: false,
    });
    expect(assignmentContentFingerprint(source, questions.get(2)!))
      .toBe(assignmentContentFingerprint(local, questions.get(3)!));
  });

  it("never offers an edited or used copy for archive", () => {
    const source = assignment({ id: 2, teacherId: 20 });
    const edited = assignment({
      id: 3,
      teacherId: 10,
      version: 2,
      updatedAt: date("09:05"),
      submissionCount: 4,
    });

    const result = buildLegacyDuplicateCandidates({
      sources: [source],
      localAssignments: [edited],
      questionsByAssignmentId: new Map([
        [2, [question(2)]],
        [3, [question(3)]],
      ]),
    });

    expect(result[0]).toMatchObject({
      canArchive: false,
      recommendedAction: "keep_duplicate",
      hasTeacherEdits: true,
      hasUsage: true,
    });
  });

  it("offers only older untouched copies when several legacy copies exist", () => {
    const source = assignment({ id: 2, teacherId: 20 });
    const older = assignment({ id: 3, teacherId: 10, createdAt: date("09:00") });
    const newer = assignment({ id: 4, teacherId: 10, createdAt: date("10:00") });
    const result = buildLegacyDuplicateCandidates({
      sources: [source],
      localAssignments: [older, newer],
      questionsByAssignmentId: new Map([
        [2, [question(2)]],
        [3, [question(3)]],
        [4, [question(4)]],
      ]),
    });

    expect(result).toHaveLength(2);
    expect(result.find((candidate) => candidate.duplicate.id === 3)).toMatchObject({
      canArchive: true,
      recommendedAction: "archive_duplicate",
    });
    expect(result.find((candidate) => candidate.duplicate.id === 4)).toMatchObject({
      canArchive: false,
      recommendedAction: "keep_duplicate",
    });
  });

  it("excludes marked imports and content changes", () => {
    const source = assignment({ id: 2, teacherId: 20 });
    const markedImport = assignment({
      id: 3,
      teacherId: 10,
      importedFromAssignmentId: 2,
    });
    const changed = assignment({ id: 4, teacherId: 10 });

    const result = buildLegacyDuplicateCandidates({
      sources: [source],
      localAssignments: [markedImport, changed],
      questionsByAssignmentId: new Map([
        [2, [question(2)]],
        [3, [question(3)]],
        [4, [question(4, "ما عاصمة المغرب؟")]],
      ]),
    });

    expect(result).toEqual([]);
  });

  it("excludes an intentionally kept copy without changing its content", () => {
    const source = assignment({ id: 2, teacherId: 20 });
    const local = assignment({
      id: 3,
      teacherId: 10,
      duplicateScanConfirmedAt: new Date("2026-01-01T12:00:00.000Z"),
    });
    const questions = new Map([
      [2, [question(2)]],
      [3, [question(3)]],
    ]);

    const result = buildLegacyDuplicateCandidates({
      sources: [source],
      localAssignments: [local],
      questionsByAssignmentId: questions,
    });

    expect(result).toEqual([]);
    expect(local).toMatchObject({
      archivedAt: null,
      version: 1,
      submissionCount: 0,
    });
  });
});