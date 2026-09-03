const SOURCE_TITLE_MAX_LENGTH = 100;

/**
 * Gives generated questions a useful, non-sensitive label without carrying
 * their complete pasted source into a game payload.
 */
export function getAiSourceTitle(topic: string, sourceText: string): string {
  const preferredTitle = topic.trim();
  if (preferredTitle) return preferredTitle;

  const firstMeaningfulLine = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";

  return firstMeaningfulLine.length > SOURCE_TITLE_MAX_LENGTH
    ? `${firstMeaningfulLine.slice(0, SOURCE_TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : firstMeaningfulLine;
}