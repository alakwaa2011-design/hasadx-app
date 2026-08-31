import { createHash } from "node:crypto";
import { z } from "zod";

const MAX_JSON_BYTES = 1_000_000;
const MAX_JSON_DEPTH = 20;
const MAX_JSON_NODES = 10_000;

/**
 * Serializes JSON with lexicographically sorted object keys.  Arrays retain
 * their order because order is meaningful for game questions and answers.
 */
export function canonicalizeJson(value: unknown): string {
  let nodes = 0;

  const normalize = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES) throw new Error("JSON is too complex");
    if (depth > MAX_JSON_DEPTH) throw new Error("JSON is nested too deeply");
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("JSON numbers must be finite");
      return item;
    }
    if (Array.isArray(item)) return item.map((entry) => normalize(entry, depth + 1));
    if (typeof item === "object") {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("Value must be JSON");
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        const entry = (item as Record<string, unknown>)[key];
        if (entry === undefined) throw new Error("JSON may not contain undefined");
        result[key] = normalize(entry, depth + 1);
      }
      return result;
    }
    throw new Error("Value must be JSON");
  };

  const canonical = JSON.stringify(normalize(value, 0));
  if (Buffer.byteLength(canonical, "utf8") > MAX_JSON_BYTES) throw new Error("JSON payload is too large");
  return canonical;
}

export function gameContentFingerprint(gameType: string, content: unknown): string {
  // Prefixing with gameType makes the value independently useful, in addition
  // to the composite database unique key.
  return createHash("sha256").update(`${gameType}\n${canonicalizeJson(content)}`).digest("hex");
}

const jsonContent = z.unknown().superRefine((value, ctx) => {
  if (value === null || (typeof value !== "object")) {
    ctx.addIssue({ code: "custom", message: "Must be a JSON object or array" });
    return;
  }
  try {
    canonicalizeJson(value);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid JSON" });
  }
});

export const savedGameActivityUpsertSchema = z.object({
  gameType: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(1).max(250),
  // `questions` is retained as a compatibility input. New callers should
  // send `content`, which can include game-specific configuration as well.
  content: jsonContent.optional(),
  questions: z.array(jsonContent).min(1).max(500).optional(),
  settings: jsonContent.optional().default({}),
  source: z.string().trim().min(1).max(100).optional().default("manual"),
}).strict().superRefine((body, ctx) => {
  if (body.content === undefined && body.questions === undefined) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "content or questions is required" });
  }
  if (body.content !== undefined && body.questions !== undefined) {
    ctx.addIssue({ code: "custom", path: ["questions"], message: "Send content or questions, not both" });
  }
});

export function activityContentFromBody(body: z.infer<typeof savedGameActivityUpsertSchema>): unknown {
  return body.content ?? body.questions!;
}

export function questionCountForContent(content: unknown): number {
  if (Array.isArray(content)) return content.length;
  if (content && typeof content === "object") {
    const questions = (content as Record<string, unknown>).questions;
    if (Array.isArray(questions)) return questions.length;
  }
  return 0;
}