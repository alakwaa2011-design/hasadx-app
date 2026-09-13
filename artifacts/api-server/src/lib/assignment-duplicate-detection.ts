type AssignmentForDuplicateScan = {
  id: number;
  teacherId: number;
  title: string;
  subject: string | null;
  contentKind: string | null;
  totalPoints: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  archivedAt: Date | null;
  importedFromAssignmentId?: number | null;
  submissionCount: number;
  teacherName?: string | null;
};

type QuestionForDuplicateScan = {
  assignmentId: number;
  questionType: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
  imageUrl: string | null;
  readAloud: boolean;
  difficulty: number | null;
  skill: string | null;
  allowMultipleAnswers: boolean;
  repeatQuestion: boolean;
};

export type AssignmentDuplicateCandidate = {
  source: {
    id: number;
    title: string;
    teacherId: number;
    teacherName: string | null;
    subject: string | null;
    contentKind: string | null;
    createdAt: string;
    updatedAt: string;
    questionCount: number;
  };
  duplicate: {
    id: number;
    title: string;
    teacherId: number;
    subject: string | null;
    contentKind: string | null;
    createdAt: string;
    updatedAt: string;
    version: number;
    questionCount: number;
    submissionCount: number;
    archivedAt: string | null;
  };
  hasTeacherEdits: boolean;
  hasUsage: boolean;
  canArchive: boolean;
  recommendedAction: "archive_duplicate" | "keep_duplicate";
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function baseTitle(value: string): string {
  return normalizeText(value)
    .replace(/\s*\((?:نسخة|copy|مستورد(?:\s+من)?[^)]*)\)\s*$/iu, "")
    .replace(/\s*[-–—]\s*(?:نسخة|copy)\s*$/iu, "")
    .trim();
}

function comparableQuestion(question: QuestionForDuplicateScan) {
  return {
    questionType: normalizeText(question.questionType),
    text: normalizeText(question.text),
    optionA: normalizeText(question.optionA),
    optionB: normalizeText(question.optionB),
    optionC: normalizeText(question.optionC),
    optionD: normalizeText(question.optionD),
    correctAnswer: normalizeText(question.correctAnswer),
    points: question.points,
    imageUrl: question.imageUrl ?? null,
    readAloud: question.readAloud,
    difficulty: question.difficulty,
    skill: normalizeText(question.skill),
    allowMultipleAnswers: question.allowMultipleAnswers,
    repeatQuestion: question.repeatQuestion,
  };
}

export function assignmentContentFingerprint(
  assignment: AssignmentForDuplicateScan,
  questions: QuestionForDuplicateScan[],
): string {
  return JSON.stringify({
    subject: normalizeText(assignment.subject),
    contentKind: normalizeText(assignment.contentKind),
    totalPoints: assignment.totalPoints,
    questions: questions.map(comparableQuestion),
  });
}

function titleMatches(sourceTitle: string, localTitle: string): boolean {
  const source = normalizeText(sourceTitle);
  const local = normalizeText(localTitle);
  return source === local || baseTitle(localTitle) === source;
}

function hasTeacherEdits(assignment: AssignmentForDuplicateScan): boolean {
  // version is the strongest signal. The timestamp check covers older rows
  // created before optimistic versioning was introduced.
  return (
    assignment.version > 1 ||
    assignment.updatedAt.getTime() - assignment.createdAt.getTime() > 1000
  );
}

function candidateRank(candidate: AssignmentDuplicateCandidate): number {
  if (candidate.hasTeacherEdits || candidate.hasUsage) return 2;
  return 1;
}

export function buildLegacyDuplicateCandidates({
  sources,
  localAssignments,
  questionsByAssignmentId,
}: {
  sources: AssignmentForDuplicateScan[];
  localAssignments: AssignmentForDuplicateScan[];
  questionsByAssignmentId: Map<number, QuestionForDuplicateScan[]>;
}): AssignmentDuplicateCandidate[] {
  const candidatesBySource = new Map<number, AssignmentDuplicateCandidate[]>();

  for (const source of sources) {
    const sourceQuestions = questionsByAssignmentId.get(source.id) ?? [];
    if (sourceQuestions.length === 0) continue;
    const sourceFingerprint = assignmentContentFingerprint(source, sourceQuestions);

    for (const local of localAssignments) {
      if (
        local.teacherId === source.teacherId ||
        local.importedFromAssignmentId != null ||
        local.archivedAt != null ||
        !titleMatches(source.title, local.title) ||
        assignmentContentFingerprint(local, questionsByAssignmentId.get(local.id) ?? []) !== sourceFingerprint
      ) {
        continue;
      }

      const hasEdits = hasTeacherEdits(local);
      const candidate: AssignmentDuplicateCandidate = {
        source: {
          id: source.id,
          title: source.title,
          teacherId: source.teacherId,
          teacherName: source.teacherName ?? null,
          subject: source.subject,
          contentKind: source.contentKind,
          createdAt: source.createdAt.toISOString(),
          updatedAt: source.updatedAt.toISOString(),
          questionCount: sourceQuestions.length,
        },
        duplicate: {
          id: local.id,
          title: local.title,
          teacherId: local.teacherId,
          subject: local.subject,
          contentKind: local.contentKind,
          createdAt: local.createdAt.toISOString(),
          updatedAt: local.updatedAt.toISOString(),
          version: local.version,
          questionCount: (questionsByAssignmentId.get(local.id) ?? []).length,
          submissionCount: Number(local.submissionCount ?? 0),
          archivedAt: null,
        },
        hasTeacherEdits: hasEdits,
        hasUsage: Number(local.submissionCount ?? 0) > 0,
        canArchive: !hasEdits && Number(local.submissionCount ?? 0) === 0,
        recommendedAction: hasEdits || Number(local.submissionCount ?? 0) > 0
          ? "keep_duplicate"
          : "archive_duplicate",
      };
      const group = candidatesBySource.get(source.id) ?? [];
      group.push(candidate);
      candidatesBySource.set(source.id, group);
    }
  }

  // If several untouched copies match one source, retain the newest one and
  // only offer older excess copies for archiving. A used or edited copy is
  // never demoted by this ranking.
  for (const group of candidatesBySource.values()) {
    group.sort((a, b) => {
      const rankDiff = candidateRank(b) - candidateRank(a);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.duplicate.createdAt).getTime() - new Date(a.duplicate.createdAt).getTime();
    });
    const retainedUntouchedId = group.find((candidate) => !candidate.hasTeacherEdits && !candidate.hasUsage)?.duplicate.id;
    if (retainedUntouchedId == null) continue;
    let retainedUntouched = true;
    for (const candidate of group) {
      if (candidate.duplicate.id === retainedUntouchedId) {
        candidate.canArchive = false;
        candidate.recommendedAction = "keep_duplicate";
        retainedUntouched = false;
      } else if (retainedUntouched && candidate.canArchive) {
        candidate.canArchive = false;
        candidate.recommendedAction = "keep_duplicate";
      }
    }
  }

  return [...candidatesBySource.values()]
    .flat()
    .filter((candidate) => candidate.canArchive || candidate.recommendedAction === "keep_duplicate");
}