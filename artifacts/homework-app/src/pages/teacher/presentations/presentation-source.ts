export function hasPresentationEducationalContent(topic: string, sourceText: string): boolean {
  return Boolean(topic.trim() || sourceText.trim());
}