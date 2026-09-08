import { describe, expect, it } from "vitest";
import {
  createNarrationPlanJsonSchema,
  validateNarrationPlan,
} from "../lib/ai-video-narration-plan";
import type { AiVideoStoryboard } from "../lib/ai-video-schemas";

function storyboard(): AiVideoStoryboard {
  return {
    title: "Lesson",
    version: 1,
    scenes: Array.from({ length: 5 }, (_, index) => ({
      id: `scene-${index + 1}`,
      objective: `Objective ${index + 1}`,
      narration: `Narration ${index + 1}.`,
      onScreenText: `Label ${index + 1}`,
      visualPrompt: `Visual ${index + 1}`,
      durationSeconds: 6,
      transition: "dissolve" as const,
      sourceImage: null,
    })),
  };
}

function plan(input = storyboard()) {
  return {
    scenes: input.scenes.map((scene) => ({
      id: scene.id,
      narration: scene.narration,
      objective: scene.objective,
      onScreenText: scene.onScreenText,
      visualPrompt: scene.visualPrompt,
      sourceSceneIds: [scene.id],
    })),
  };
}

describe("AI video narration plan contract", () => {
  it("creates a strict exact-count structured-output schema with every field required", () => {
    const ids = storyboard().scenes.map((scene) => scene.id);
    const schema = createNarrationPlanJsonSchema(ids) as any;
    const scenes = schema.properties.scenes;
    const item = scenes.items;

    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["scenes"],
    });
    expect(scenes).toMatchObject({ type: "array", minItems: 5, maxItems: 5 });
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual([
      "id", "narration", "objective", "onScreenText", "visualPrompt", "sourceSceneIds",
    ]);
    expect(item.properties.id).toMatchObject({ enum: ids, minLength: 1, maxLength: 50 });
    expect(item.properties.narration.maxLength).toBe(1_500);
    expect(item.properties.objective.maxLength).toBe(300);
    expect(item.properties.onScreenText.maxLength).toBe(60);
    expect(item.properties.visualPrompt.maxLength).toBe(800);
    expect(item.properties.sourceSceneIds.items.enum).toEqual(ids);
  });

  it("strips harmless extra keys and returns scenes in current storyboard order", () => {
    const original = storyboard();
    const current = storyboard();
    current.scenes.reverse();
    const raw = {
      title: "ignored",
      version: 99,
      explanation: "ignored",
      scenes: plan(original).scenes.map((scene) => ({ ...scene, explanation: "ignored" })),
    };
    const result = validateNarrationPlan(raw, original, current);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scenes.map((scene) => scene.id))
      .toEqual(current.scenes.map((scene) => scene.id));
    expect(result.data).not.toHaveProperty("title");
    expect(result.data.scenes[0]).not.toHaveProperty("explanation");
  });

  it("rejects missing semantic coverage with specific privacy-safe diagnostics", () => {
    const original = storyboard();
    const raw = plan(original);
    raw.scenes.forEach((scene) => { scene.sourceSceneIds = ["scene-1"]; });
    const result = validateNarrationPlan(raw, original, original);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toContainEqual({
      code: "missing_source_coverage",
      field: "sourceSceneIds",
      sceneId: "scene-2",
    });
    expect(result.feedback).toContain("original scene ID scene-2 has no sourceSceneIds coverage");
    expect(result.feedback).not.toContain("Narration 2.");
  });

  it("rejects duplicate, missing, and foreign IDs and reports expected IDs and counts", () => {
    const original = storyboard();
    const raw = plan(original);
    raw.scenes[3]!.id = "scene-1";
    raw.scenes[4]!.id = "foreign";
    const result = validateNarrationPlan(raw, original, original);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "duplicate_scene_id", "foreign_scene_id", "missing_scene_id",
    ]));
    expect(result.feedback).toContain("occurs 2 times");
    expect(result.feedback).toContain("expected IDs are [scene-1, scene-2, scene-3, scene-4, scene-5]");
    expect(result.feedback).not.toContain("foreign");
    expect(result.feedback).not.toContain("Narration");
  });

  it("never echoes private text supplied as scene or source IDs", () => {
    const original = storyboard();
    const privateSceneText = "A private sentence placed in the scene ID field.";
    const privateSourceText = "Another private sentence placed in source coverage.";
    for (const [privateText, mutate, expectedCode] of [
      [
        privateSceneText,
        (raw: ReturnType<typeof plan>) => { raw.scenes[0]!.id = privateSceneText; },
        "foreign_scene_id",
      ],
      [
        privateSourceText,
        (raw: ReturnType<typeof plan>) => { raw.scenes[1]!.sourceSceneIds = [privateSourceText]; },
        "foreign_source_scene_id",
      ],
    ] as const) {
      const raw = plan(original);
      mutate(raw);
      const result = validateNarrationPlan(raw, original, original);

      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
      expect(JSON.stringify(result)).not.toContain(privateText);
      expect(result.feedback).toContain("[scene-1, scene-2, scene-3, scene-4, scene-5]");
    }
  });

  it("reports invalid fields per scene without exposing narration", () => {
    const original = storyboard();
    const raw = plan(original);
    raw.scenes[1]!.objective = "";
    raw.scenes[2]!.visualPrompt = "";
    const result = validateNarrationPlan(raw, original, original);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: "invalid_field", field: "objective", sceneId: "scene-2" },
      { code: "invalid_field", field: "visualPrompt", sceneId: "scene-3" },
    ]));
    expect(result.feedback).toContain("scene scene-2 field objective");
    expect(result.feedback).toContain("scene scene-3 field visualPrompt");
    expect(result.feedback).not.toContain("Narration 1.");
  });

  it("accepts narration above a timing word-count guideline", () => {
    const original = storyboard();
    const raw = plan(original);
    raw.scenes[0]!.narration = Array.from({ length: 120 }, () => "word").join(" ");

    const result = validateNarrationPlan(raw, original, original);
    expect(result.success).toBe(true);
  });
});