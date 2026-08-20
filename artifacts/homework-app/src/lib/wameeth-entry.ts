export const WAMEETH_SETUP_PATH = "/game/wameeth/create";

/**
 * The only teacher-side entry point for creating a Wameeth session.
 * Existing-assignment launchers carry the assignment id so the shared setup
 * can load its questions before the teacher chooses a play mode.
 */
export function getWameethSetupPath(assignmentId?: number | null): string {
  return assignmentId && Number.isInteger(assignmentId) && assignmentId > 0
    ? `${WAMEETH_SETUP_PATH}?assignmentId=${assignmentId}`
    : WAMEETH_SETUP_PATH;
}

/** Read and validate the assignment selected by a Wameeth entry link. */
export function getWameethSetupAssignmentId(search: string): number | null {
  const raw = new URLSearchParams(search).get("assignmentId");
  if (!raw || !/^\d+$/.test(raw)) return null;

  const assignmentId = Number(raw);
  return Number.isSafeInteger(assignmentId) && assignmentId > 0
    ? assignmentId
    : null;
}