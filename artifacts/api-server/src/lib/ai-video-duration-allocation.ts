export type SceneDurationAllocation = {
  durations: number[];
  required: number[];
};

/**
 * Gives measured speech its smallest safe integer slot first, then borrows only
 * the slack needed from the other existing slots.  Keeping the old allocation
 * unless it is necessary avoids needless visual churn.
 */
export function allocateAiVideoSceneDurations(options: {
  totalSeconds: number;
  currentDurations: number[];
  speechSeconds: Array<number | null>;
  leads: number[];
  tails: number[];
  safetySeconds: number;
}): SceneDurationAllocation | undefined {
  const { totalSeconds, currentDurations, speechSeconds, leads, tails, safetySeconds } = options;
  if (!Number.isInteger(totalSeconds) || totalSeconds <= 0
    || currentDurations.length === 0
    || currentDurations.length !== speechSeconds.length
    || leads.length !== speechSeconds.length || tails.length !== speechSeconds.length) return undefined;

  const required = speechSeconds.map((speech, index) => {
    if (speech === null) return 2;
    if (!Number.isFinite(speech) || speech < 0.15) return Number.POSITIVE_INFINITY;
    return Math.max(2, Math.ceil(speech + leads[index]! + tails[index]! + safetySeconds - 1e-9));
  });
  if (required.some((duration) => duration > 7) || required.reduce((sum, duration) => sum + duration, 0) > totalSeconds) {
    return undefined;
  }

  const durations = currentDurations.map((duration) => Math.max(2, Math.min(7, Math.round(duration))));
  if (durations.reduce((sum, duration) => sum + duration, 0) !== totalSeconds) return undefined;

  // Raise constrained slots. Prefer the earliest largest donor; this is stable
  // and means a one-second borrow changes exactly two scenes.
  for (let receiver = 0; receiver < durations.length; receiver += 1) {
    while (durations[receiver]! < required[receiver]!) {
      const donor = durations
        .map((duration, index) => ({ index, slack: duration - required[index]! }))
        .filter(({ index, slack }) => index !== receiver && slack > 0)
        .sort((a, b) => b.slack - a.slack || a.index - b.index)[0];
      if (!donor) return undefined;
      durations[donor.index]! -= 1;
      durations[receiver]! += 1;
    }
  }
  return { durations, required };
}