import { db, presentationResponsesTable as responses } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/** Self-paced answers have no live-round identity. Always read committed rows,
 * never reuse the teacher-paced cloud or a process-local aggregation. */
export async function getSelfPacedCloud(sessionId: number, elementId: string, slideIndex: number, studentKey: string) {
  const rows = await db.select({
    text: responses.answerText, studentKey: responses.studentKey,
  }).from(responses).where(and(
    eq(responses.sessionId, sessionId), eq(responses.elementId, elementId),
    eq(responses.slideIndex, slideIndex),
  ));
  const words = new Map<string, number>();
  for (const row of rows) {
    const word = row.text?.trim().slice(0, 60).toLowerCase();
    if (word) words.set(word, (words.get(word) ?? 0) + 1);
  }
  return {
    elementId, slideIndex, selfPaced: true,
    submitted: rows.some(row => row.studentKey === studentKey),
    words: Array.from(words, ([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
  };
}
