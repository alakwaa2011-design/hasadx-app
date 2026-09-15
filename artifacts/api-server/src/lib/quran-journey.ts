export type QuranJourneyProfile = {
  currentSurahNumber: number | null;
  currentAyah: number | null;
  progressPercent: number;
  masteredAyahCount: number;
  lastRecitedDate: string | null;
};

export type QuranJourneyWard = {
  id: number;
  mode: string;
  surahNumber: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
  assignedDate: string;
  dueDate: string | null;
  status: string;
};

export type QuranJourneyRecitation = {
  id: number;
  wardId: number;
  status: string;
  memorizationScore: number | null;
  recitationScore: number | null;
  recitedDate: string;
  createdAt?: Date | string;
};

export type QuranJourneySubmission = {
  id: number;
  wardId: number;
  status: string;
  memorizationScore: number | null;
  recitationScore: number | null;
  createdAt: Date | string;
};

export type QuranJourneyActivity = {
  type: "recitation" | "submission";
  wardId: number;
  date: string;
  surahName: string;
  startAyah: number;
  endAyah: number;
  status: string;
  memorizationScore: number | null;
  recitationScore: number | null;
};

export type QuranJourneyIndependentPosition = {
  textSurahNumber: number | null;
  textAyah: number | null;
  pageNumber: number | null;
  updatedAt: Date | string;
};

export type QuranJourneyIndependentPractice = {
  dates: readonly string[];
  latestPosition: QuranJourneyIndependentPosition | null;
};

export type QuranJourneyResult = {
  profile: QuranJourneyProfile;
  nextWard: QuranJourneyWard | null;
  summary: {
    completedWardCount: number;
    masteredAyahCount: number;
    needsReviewCount: number;
    pendingSubmissionCount: number;
    averageMemorizationScore: number | null;
    averageRecitationScore: number | null;
  };
  streak: {
    current: number;
    longest: number;
  };
  activeDates: string[];
  recentActivities: QuranJourneyActivity[];
  independentPractice: QuranJourneyIndependentPractice;
};

type JourneyInput = {
  profile: QuranJourneyProfile;
  wards: readonly QuranJourneyWard[];
  recitations: readonly QuranJourneyRecitation[];
  submissions: readonly QuranJourneySubmission[];
  independentPractice?: QuranJourneyIndependentPractice;
  today?: string;
};

function datePart(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function dateValue(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function dateFromValue(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function timestampValue(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function addDays(value: string, days: number): string {
  return dateFromValue(dateValue(value) + days * 86_400_000);
}

function latest<T extends { wardId: number; createdAt?: Date | string }>(
  rows: readonly T[],
  dateOf: (row: T) => string,
): Map<number, T> {
  const result = new Map<number, T>();
  for (const row of rows) {
    const previous = result.get(row.wardId);
    if (!previous) {
      result.set(row.wardId, row);
      continue;
    }
    const currentKey = [dateOf(row), timestampValue(row.createdAt ?? dateOf(row))];
    const previousKey = [dateOf(previous), timestampValue(previous.createdAt ?? dateOf(previous))];
    if (currentKey[0] > previousKey[0] || (
      currentKey[0] === previousKey[0] && currentKey[1] > previousKey[1]
    )) result.set(row.wardId, row);
  }
  return result;
}

function average(values: readonly (number | null)[]): number | null {
  const scored = values.filter((value): value is number => typeof value === "number");
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 10) / 10;
}

function completedAyahCount(
  wards: readonly QuranJourneyWard[],
  recitations: readonly QuranJourneyRecitation[],
): number {
  const wardById = new Map(wards.map((ward) => [ward.id, ward]));
  const rangesBySurah = new Map<number, Array<[number, number]>>();
  for (const recitation of recitations) {
    if (recitation.status !== "completed") continue;
    const ward = wardById.get(recitation.wardId);
    if (!ward) continue;
    const ranges = rangesBySurah.get(ward.surahNumber) ?? [];
    ranges.push([ward.startAyah, ward.endAyah]);
    rangesBySurah.set(ward.surahNumber, ranges);
  }

  let count = 0;
  for (const ranges of rangesBySurah.values()) {
    ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    let currentStart: number | null = null;
    let currentEnd = 0;
    for (const [start, end] of ranges) {
      if (currentStart === null) {
        currentStart = start;
        currentEnd = end;
      } else if (start <= currentEnd + 1) {
        currentEnd = Math.max(currentEnd, end);
      } else {
        count += currentEnd - currentStart + 1;
        currentStart = start;
        currentEnd = end;
      }
    }
    if (currentStart !== null) count += currentEnd - currentStart + 1;
  }
  return count;
}

function streaks(dates: readonly string[], today: string): { current: number; longest: number } {
  const unique = [...new Set(dates)].filter((date) => date <= today).sort();
  if (unique.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (dateValue(unique[index]) - dateValue(unique[index - 1]) === 86_400_000) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const dateSet = new Set(unique);
  let cursor = dateSet.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (dateSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

function wardPriority(
  ward: QuranJourneyWard,
  latestRecitation: QuranJourneyRecitation | undefined,
  latestSubmission: QuranJourneySubmission | undefined,
  completedWardIds: ReadonlySet<number>,
): number | null {
  if (
    latestRecitation?.status === "needs_review" ||
    (!latestRecitation && ward.status === "needs_review")
  ) return 0;
  if (latestSubmission?.status === "needs_resubmission") return 1;
  if (completedWardIds.has(ward.id) || latestSubmission?.status === "submitted") return null;
  if (ward.status === "in_progress") return 2;
  if (ward.status === "assigned") return 3;
  return null;
}

/**
 * Calculates the student's personal journey from already-owned Quran records.
 * Recitations are the canonical evaluation/completion record when both a
 * reviewed submission and the generated recitation exist for a ward.
 */
export function calculateQuranJourney(input: JourneyInput): QuranJourneyResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const completedRecitations = input.recitations.filter((row) => row.status === "completed");
  const completedWardIds = new Set(completedRecitations.map((row) => row.wardId));
  const masteredAyahCount = completedAyahCount(input.wards, input.recitations);
  const latestRecitations = latest(input.recitations, (row) => row.recitedDate);
  const latestSubmissions = latest(input.submissions, (row) => datePart(row.createdAt));

  const needsReviewWardIds = new Set(
    input.wards
      .filter((ward) => latestRecitations.get(ward.id)?.status === "needs_review" || (
        !latestRecitations.has(ward.id) && ward.status === "needs_review"
      ))
      .map((ward) => ward.id),
  );

  const pendingSubmissionCount = input.submissions.filter((row) => row.status === "submitted").length;
  const recitationScoreRows = input.recitations.filter((row) => (
    row.status === "completed" || row.status === "needs_review"
  ));
  const recitationWardIds = new Set(input.recitations.map((row) => row.wardId));
  const reviewedSubmissionScores = input.submissions.filter((row) => (
    row.status === "reviewed" && !recitationWardIds.has(row.wardId)
  ));

  const evaluatedMemorizationScores = [
    ...recitationScoreRows.map((row) => row.memorizationScore),
    ...reviewedSubmissionScores.map((row) => row.memorizationScore),
  ];
  const evaluatedRecitationScores = [
    ...recitationScoreRows.map((row) => row.recitationScore),
    ...reviewedSubmissionScores.map((row) => row.recitationScore),
  ];

  const nextWard = input.wards
    .map((ward) => ({
      ward,
      priority: wardPriority(
        ward,
        latestRecitations.get(ward.id),
        latestSubmissions.get(ward.id),
        completedWardIds,
      ),
    }))
    .filter((item): item is { ward: QuranJourneyWard; priority: number } => item.priority !== null)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      const leftDue = left.ward.dueDate ?? "9999-12-31";
      const rightDue = right.ward.dueDate ?? "9999-12-31";
      if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
      if (left.ward.assignedDate !== right.ward.assignedDate) {
        return left.ward.assignedDate.localeCompare(right.ward.assignedDate);
      }
      return left.ward.id - right.ward.id;
    })[0]?.ward ?? null;

  const activeDates = [...new Set(completedRecitations.map((row) => row.recitedDate))]
    .filter((date) => date >= addDays(today, -89) && date <= today)
    .sort();

  const wardById = new Map(input.wards.map((ward) => [ward.id, ward]));
  const activities: Array<QuranJourneyActivity & { sortDate: string; sortId: number }> = [];
  for (const recitation of input.recitations) {
    const ward = wardById.get(recitation.wardId);
    if (!ward) continue;
    activities.push({
      type: "recitation",
      wardId: ward.id,
      date: recitation.recitedDate,
      surahName: ward.surahName,
      startAyah: ward.startAyah,
      endAyah: ward.endAyah,
      status: recitation.status,
      memorizationScore: recitation.memorizationScore,
      recitationScore: recitation.recitationScore,
      sortDate: recitation.recitedDate,
      sortId: recitation.id,
    });
  }
  for (const submission of input.submissions) {
    // A reviewed submission may have caused a recitation. Once that canonical
    // row exists, showing both would make one act of learning look like two.
    if (recitationWardIds.has(submission.wardId)) continue;
    const ward = wardById.get(submission.wardId);
    if (!ward) continue;
    const date = datePart(submission.createdAt);
    activities.push({
      type: "submission",
      wardId: ward.id,
      date,
      surahName: ward.surahName,
      startAyah: ward.startAyah,
      endAyah: ward.endAyah,
      status: submission.status,
      memorizationScore: submission.memorizationScore,
      recitationScore: submission.recitationScore,
      sortDate: date,
      sortId: submission.id,
    });
  }
  activities.sort((left, right) => right.sortDate.localeCompare(left.sortDate) || right.sortId - left.sortId);

  return {
    // The profile's stored counter is a progress-position convenience and can
    // represent the furthest reached ayah. Journey mastery is stricter: it is
    // the union of ranges actually marked completed by recitations.
    profile: {
      ...input.profile,
      masteredAyahCount,
    },
    nextWard,
    summary: {
      completedWardCount: completedWardIds.size,
      masteredAyahCount,
      needsReviewCount: needsReviewWardIds.size,
      pendingSubmissionCount,
      averageMemorizationScore: average(evaluatedMemorizationScores),
      averageRecitationScore: average(evaluatedRecitationScores),
    },
    streak: streaks(completedRecitations.map((row) => row.recitedDate), today),
    activeDates,
    recentActivities: activities.slice(0, 20).map(({ sortDate: _sortDate, sortId: _sortId, ...activity }) => activity),
    independentPractice: {
      dates: [...new Set(input.independentPractice?.dates ?? [])].sort(),
      latestPosition: input.independentPractice?.latestPosition ?? null,
    },
  };
}