/**
 * Client-side utilities for the activity question-editor extract flow.
 *
 * Extracted from create-assignment.tsx so they can be unit-tested without
 * importing the full React component tree.
 */
import type { CreateQuestionBody } from "@workspace/api-client-react";

/** File-extension allowlist mirroring the backend's file-upload.ts. */
export const EXTRACT_EXT_RE = /\.(jpe?g|png|webp|gif|pdf|docx|pptx|txt|md)$/i;

/**
 * Returns an Arabic or bilingual error string for an unsupported file name,
 * or null when the file is accepted.
 */
export function extractFileError(
  fileName: string,
  lang: "ar" | "en" = "ar",
): string | null {
  if (EXTRACT_EXT_RE.test(fileName)) return null;
  return lang === "ar"
    ? `صيغة غير مدعومة: ${fileName} — المسموح: صور JPG/PNG/WEBP/GIF أو PDF أو DOCX أو PPTX أو TXT/MD`
    : `Unsupported format: ${fileName} — allowed: JPG/PNG/WEBP/GIF images, PDF, DOCX, PPTX, TXT/MD`;
}

/**
 * Stable fingerprint for a selected source-file set: name + size +
 * lastModified per file, order-insensitive. Used to detect "the teacher is
 * extracting the exact same source again" so we can offer
 * replace / add-anyway / cancel instead of silently duplicating questions.
 */
export function fingerprintFiles(
  files: Array<{ name: string; size: number; lastModified?: number }>,
): string {
  return files
    .map((f) => `${f.name}:${f.size}:${f.lastModified ?? 0}`)
    .sort()
    .join("|");
}

/**
 * Maps raw worksheet-shaped questions returned by /worksheets/ai/extract
 * into CreateQuestionBody rows understood by the activity question editor.
 *
 * Supported types: mcq, true_false, fill_blank.
 * Unsupported types (short_answer, matching, …) are silently dropped.
 * Questions with an empty prompt are filtered out.
 */
export function mapExtractedToActivity(raw: unknown[]): CreateQuestionBody[] {
  const LETTERS = ["A", "B", "C", "D"] as const;
  const out: CreateQuestionBody[] = [];

  for (const item of raw) {
    const q = item as Record<string, unknown>;
    const base = {
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      points:
        typeof q.points === "number" && q.points > 0 ? q.points : 1,
    };

    if (q.type === "mcq" && Array.isArray(q.options)) {
      const opts = (q.options as string[]).slice(0, 4);
      const idx = Math.min(
        Math.max(Number(q.correctIndex) || 0, 0),
        opts.length - 1,
      );
      out.push({
        ...base,
        text: String(q.prompt || ""),
        optionA: opts[0] || "",
        optionB: opts[1] || "",
        optionC: opts[2] || "",
        optionD: opts[3] || "",
        correctAnswer: LETTERS[idx] || "A",
        questionType: "mcq",
      } as CreateQuestionBody);
    } else if (q.type === "true_false") {
      out.push({
        ...base,
        text: String(q.prompt || ""),
        correctAnswer: q.correct ? "true" : "false",
        questionType: "true_false",
      } as CreateQuestionBody);
    } else if (q.type === "fill_blank") {
      out.push({
        ...base,
        text: String(q.prompt || ""),
        correctAnswer: String(q.answer || ""),
        questionType: "fill_blank",
      } as CreateQuestionBody);
    }
    // short_answer / matching / other types → dropped intentionally
  }

  return out.filter((q) => q.text && q.text.trim().length > 0);
}
