import { describe, expect, it } from "vitest";
import { shouldHydrateAiVideoEditor } from "./use-ai-video";

const base = {
  currentProjectId: 7,
  nextProjectId: 7,
  status: "storyboard_ready" as const,
  currentContentKey: "backend-v1",
  nextContentKey: "backend-v2",
};

describe("AI video editor hydration", () => {
  it("preserves unsaved edits while storyboard review polling updates", () => {
    expect(shouldHydrateAiVideoEditor({ ...base, isDirty: true })).toBe(false);
  });

  it("hydrates fitted backend speech after editing is no longer active", () => {
    expect(shouldHydrateAiVideoEditor({
      ...base,
      status: "rendering",
      isDirty: true,
    })).toBe(true);
  });

  it("hydrates ready and failed projects and resets for a different project", () => {
    expect(shouldHydrateAiVideoEditor({
      ...base,
      status: "ready",
      isDirty: false,
    })).toBe(true);
    expect(shouldHydrateAiVideoEditor({
      ...base,
      status: "failed",
      isDirty: false,
    })).toBe(true);
    expect(shouldHydrateAiVideoEditor({
      ...base,
      nextProjectId: 8,
      isDirty: true,
    })).toBe(true);
  });
});