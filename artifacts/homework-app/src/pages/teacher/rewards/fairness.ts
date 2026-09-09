export interface FairnessCandidate {
  id: number;
  points: number;
  recognizedThisWeek?: boolean;
}

/**
 * Select the least-recognised student without mutating the board data.
 * A random source can be supplied so tie-breaking remains deterministic in
 * unit tests.
 */
export function selectFairnessStudent<T extends FairnessCandidate>(
  students: T[],
  random = Math.random,
): T | undefined {
  if (students.length === 0) return undefined;
  const unrecognized = students.filter((student) => !student.recognizedThisWeek);
  const fairnessPool = unrecognized.length ? unrecognized : students;
  const lowestPoints = Math.min(...fairnessPool.map((student) => student.points));
  const candidates = fairnessPool.filter((student) => student.points === lowestPoints);
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  return candidates[index];
}