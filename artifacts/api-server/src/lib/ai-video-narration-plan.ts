import { z } from "zod";
import {
  aiVideoSceneSchema,
  aiVideoStoryboardSchema,
  type AiVideoStoryboard,
} from "./ai-video-schemas";

const narrationPlanSceneSchema = aiVideoSceneSchema.pick({
  id: true,
  narration: true,
  objective: true,
  onScreenText: true,
  visualPrompt: true,
}).extend({
  sourceSceneIds: z.array(z.string()).min(1).max(18),
}).strip();

const narrationPlanSchema = z.object({
  scenes: z.array(narrationPlanSceneSchema).min(5).max(18),
}).strip();

export type ReflowResult = z.infer<typeof narrationPlanSchema>;

export type NarrationPlanIssue = {
  code: string;
  field?: string;
  sceneId?: string;
};

export type NarrationPlanValidation =
  | { success: true; data: ReflowResult }
  | { success: false; feedback: string; issues: NarrationPlanIssue[] };

type JsonSchema = Record<string, unknown>;

/**
 * The provider contract is deliberately stricter than the runtime parser:
 * providers must not add prose/metadata, while harmless extra response keys
 * from older callers can still be ignored by validateNarrationPlan.
 */
export function createNarrationPlanJsonSchema(ids: string[]): JsonSchema {
  const stringProperty = (minLength: number, maxLength: number): JsonSchema => ({
    type: "string",
    minLength,
    maxLength,
  });

  return {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        minItems: ids.length,
        maxItems: ids.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "narration",
            "objective",
            "onScreenText",
            "visualPrompt",
            "sourceSceneIds",
          ],
          properties: {
            id: {
              ...stringProperty(1, 50),
              pattern: "^[A-Za-z0-9_-]+$",
              enum: [...ids],
            },
            narration: stringProperty(1, 1_500),
            objective: stringProperty(1, 300),
            onScreenText: stringProperty(0, 60),
            visualPrompt: stringProperty(1, 800),
            sourceSceneIds: {
              type: "array",
              minItems: 1,
              maxItems: 18,
              items: { type: "string", enum: [...ids] },
            },
          },
        },
      },
    },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function addIssue(
  issues: NarrationPlanIssue[],
  details: string[],
  issue: NarrationPlanIssue,
  detail: string,
): void {
  if (!issues.some((existing) =>
    existing.code === issue.code
    && existing.field === issue.field
    && existing.sceneId === issue.sceneId)) {
    issues.push(issue);
    details.push(detail);
  }
}

function sceneLabel(
  raw: unknown,
  index: number,
  expectedIds: ReadonlySet<string>,
): { label: string; sceneId?: string } {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const id = (raw as Record<string, unknown>).id;
    if (typeof id === "string" && expectedIds.has(id)) {
      return { label: `scene ${id}`, sceneId: id };
    }
  }
  return { label: `scene at index ${index}`, sceneId: undefined };
}

function fieldRule(field: string): string {
  switch (field) {
    case "id": return "must be an ID string of 1-50 letters, numbers, underscores, or hyphens";
    case "narration": return "must be a non-empty string of at most 1500 characters";
    case "objective": return "must be a non-empty string of at most 300 characters";
    case "onScreenText": return "must be a string of at most 60 characters and no more than 7 words";
    case "visualPrompt": return "must be a non-empty string of at most 800 characters";
    case "sourceSceneIds": return "must contain 1-18 source scene ID strings";
    default: return "is invalid";
  }
}

function failure(issues: NarrationPlanIssue[], details: string[]): NarrationPlanValidation {
  return {
    success: false,
    feedback: `Invalid narration plan: ${details.join("; ")}.`,
    issues,
  };
}

/**
 * Validates model output without using estimated narration word counts. Actual
 * WAV duration checks remain the authoritative timing gate.
 */
export function validateNarrationPlan(
  raw: unknown,
  original: AiVideoStoryboard,
  current: AiVideoStoryboard,
): NarrationPlanValidation {
  const issues: NarrationPlanIssue[] = [];
  const details: string[] = [];
  const originalMetadata = aiVideoStoryboardSchema.safeParse(original);
  const currentMetadata = aiVideoStoryboardSchema.safeParse(current);

  if (!originalMetadata.success) {
    addIssue(issues, details, { code: "invalid_original_metadata" },
      "original storyboard metadata is invalid");
  }
  if (!currentMetadata.success) {
    addIssue(issues, details, { code: "invalid_current_metadata" },
      "current storyboard metadata is invalid");
  }
  if (!originalMetadata.success || !currentMetadata.success) {
    return failure(issues, details);
  }

  const originalIds = originalMetadata.data.scenes.map((scene) => scene.id);
  const currentIds = currentMetadata.data.scenes.map((scene) => scene.id);
  const expectedSummary = `${currentIds.length} scene entries with IDs [${currentIds.join(", ")}]`;

  if (unique(originalIds).length !== originalIds.length) {
    addIssue(issues, details, { code: "duplicate_original_scene_id", field: "id" },
      "original storyboard scene IDs are not unique");
  }
  if (unique(currentIds).length !== currentIds.length) {
    addIssue(issues, details, { code: "duplicate_current_scene_id", field: "id" },
      "current storyboard scene IDs are not unique");
  }
  if (issues.length) return failure(issues, details);

  const rawScenes = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>).scenes
    : undefined;
  if (!Array.isArray(rawScenes)) {
    addIssue(issues, details, { code: "invalid_root", field: "scenes" },
      `root field scenes must be an array; expected ${expectedSummary}`);
    return failure(issues, details);
  }

  if (rawScenes.length !== currentIds.length) {
    addIssue(issues, details, { code: "invalid_scene_count", field: "scenes" },
      `field scenes has ${rawScenes.length} entries; expected ${expectedSummary}`);
  }

  const parsed = narrationPlanSchema.safeParse(raw);
  if (!parsed.success) {
    for (const zodIssue of parsed.error.issues) {
      const path = zodIssue.path;
      if (path[0] !== "scenes" || typeof path[1] !== "number") {
        addIssue(issues, details, { code: "invalid_field", field: "scenes" },
          `field scenes is invalid; expected ${expectedSummary}`);
        continue;
      }
      const index = path[1];
      const field = typeof path[2] === "string" ? path[2] : "scenes";
      const identified = sceneLabel(rawScenes[index], index, new Set(currentIds));
      addIssue(
        issues,
        details,
        { code: "invalid_field", field, sceneId: identified.sceneId },
        `${identified.label} field ${field} ${fieldRule(field)}`,
      );
    }
  }

  // ID diagnostics intentionally inspect only metadata, never narration text.
  const suppliedIds = rawScenes.map((scene) =>
    scene && typeof scene === "object" && !Array.isArray(scene)
      ? (scene as Record<string, unknown>).id
      : undefined);
  const suppliedCounts = new Map<string, number>();
  suppliedIds.forEach((id) => {
    if (typeof id === "string") suppliedCounts.set(id, (suppliedCounts.get(id) ?? 0) + 1);
  });
  const currentIdSet = new Set(currentIds);
  for (const [id, count] of suppliedCounts) {
    if (count > 1) {
      const known = currentIdSet.has(id);
      addIssue(
        issues,
        details,
        { code: "duplicate_scene_id", field: "id", sceneId: known ? id : undefined },
        known
          ? `scene ID ${id} occurs ${count} times; each expected ID must occur once`
          : `an unexpected scene ID occurs ${count} times; each expected ID must occur once`,
      );
    }
  }
  suppliedIds.forEach((id, index) => {
    if (typeof id === "string" && !currentIdSet.has(id)) {
      addIssue(issues, details, { code: "foreign_scene_id", field: "id" },
        `scene at index ${index} has an unexpected ID; expected IDs are [${currentIds.join(", ")}]`);
    }
  });
  const suppliedIdSet = new Set(
    suppliedIds.filter((id): id is string => typeof id === "string"),
  );
  const missingIds = currentIds.filter((id) => !suppliedIdSet.has(id));
  for (const id of missingIds) {
    addIssue(issues, details, { code: "missing_scene_id", field: "id", sceneId: id },
      `expected scene ID ${id} is missing`);
  }

  if (!parsed.success) return failure(issues, details);

  const originalIdSet = new Set(originalIds);
  const covered = new Set<string>();
  for (const scene of parsed.data.scenes) {
    for (const [sourceIndex, sourceId] of scene.sourceSceneIds.entries()) {
      if (!originalIdSet.has(sourceId)) {
        const knownSceneId = currentIdSet.has(scene.id) ? scene.id : undefined;
        addIssue(
          issues,
          details,
          { code: "foreign_source_scene_id", field: "sourceSceneIds", sceneId: knownSceneId },
          `${knownSceneId ? `scene ${knownSceneId}` : "a scene"} field sourceSceneIds at index ${sourceIndex} contains an unexpected ID; expected original IDs [${originalIds.join(", ")}]`,
        );
      } else {
        covered.add(sourceId);
      }
    }
  }
  for (const id of originalIds) {
    if (!covered.has(id)) {
      addIssue(
        issues,
        details,
        { code: "missing_source_coverage", field: "sourceSceneIds", sceneId: id },
        `original scene ID ${id} has no sourceSceneIds coverage`,
      );
    }
  }

  if (issues.length) return failure(issues, details);

  const byId = new Map(parsed.data.scenes.map((scene) => [scene.id, scene]));
  return {
    success: true,
    data: { scenes: currentIds.map((id) => byId.get(id)!) },
  };
}