export interface RocketRetryEntry {
  index: number;
  eligibleAfter: number;
}

export const ROCKET_WRONG_RETRY_GAP = 3;
const RECENT_QUESTION_WINDOW = 2;

function pickRandom(candidates: number[], recent: number[], rng: () => number): number {
  const recentSet = new Set(recent.slice(-RECENT_QUESTION_WINDOW));
  const diverse = candidates.filter((index) => !recentSet.has(index));
  const pool = diverse.length > 0 ? diverse : candidates;
  return pool[Math.floor(rng() * pool.length)] ?? candidates[0] ?? 0;
}

export function scheduleRocketQuestionRetry(
  retryQueue: RocketRetryEntry[],
  questionIndex: number,
  totalAnswered: number,
): RocketRetryEntry[] {
  return [
    ...retryQueue.filter((entry) => entry.index !== questionIndex),
    {
      index: questionIndex,
      eligibleAfter: totalAnswered + ROCKET_WRONG_RETRY_GAP + 1,
    },
  ];
}

export function chooseNextRocketQuestion(args: {
  totalQuestions: number;
  currentQuestionIndex: number;
  totalAnswered: number;
  clearedIndices: ReadonlySet<number>;
  retryQueue: RocketRetryEntry[];
  recentQuestionIndices: number[];
  rng?: () => number;
}): { questionIndex: number; retryQueue: RocketRetryEntry[] } {
  const {
    totalQuestions,
    currentQuestionIndex,
    totalAnswered,
    clearedIndices,
    recentQuestionIndices,
    rng = Math.random,
  } = args;

  if (totalQuestions <= 0) {
    return { questionIndex: 0, retryQueue: [] };
  }

  const validQueue = args.retryQueue.filter(
    (entry) => entry.index >= 0 && entry.index < totalQuestions,
  );
  const dueRetries = validQueue
    .filter(
      (entry) =>
        entry.eligibleAfter <= totalAnswered &&
        entry.index !== currentQuestionIndex,
    )
    .map((entry) => entry.index);

  if (dueRetries.length > 0) {
    const questionIndex = pickRandom(dueRetries, recentQuestionIndices, rng);
    return {
      questionIndex,
      retryQueue: validQueue.filter((entry) => entry.index !== questionIndex),
    };
  }

  const pendingRetries = new Set(validQueue.map((entry) => entry.index));
  const allIndices = Array.from({ length: totalQuestions }, (_, index) => index);
  const freshCandidates = allIndices.filter(
    (index) =>
      index !== currentQuestionIndex &&
      !clearedIndices.has(index) &&
      !pendingRetries.has(index),
  );

  if (freshCandidates.length > 0) {
    return {
      questionIndex: pickRandom(freshCandidates, recentQuestionIndices, rng),
      retryQueue: validQueue,
    };
  }

  const cycleCandidates = allIndices.filter(
    (index) =>
      index !== currentQuestionIndex &&
      !pendingRetries.has(index),
  );
  if (cycleCandidates.length > 0) {
    return {
      questionIndex: pickRandom(cycleCandidates, recentQuestionIndices, rng),
      retryQueue: validQueue,
    };
  }

  // In a small pool, repeat a non-retry question rather than bringing the
  // wrong question back before its review gap has elapsed.
  const repeatableCandidates = allIndices.filter(
    (index) => !pendingRetries.has(index),
  );
  if (repeatableCandidates.length > 0) {
    return {
      questionIndex: pickRandom(repeatableCandidates, recentQuestionIndices, rng),
      retryQueue: validQueue,
    };
  }

  // A one-question pool cannot provide an intervening question.
  const fallbackCandidates = allIndices.filter(
    (index) => index !== currentQuestionIndex,
  );
  return {
    questionIndex:
      fallbackCandidates.length > 0
        ? pickRandom(fallbackCandidates, recentQuestionIndices, rng)
        : currentQuestionIndex,
    retryQueue: validQueue,
  };
}