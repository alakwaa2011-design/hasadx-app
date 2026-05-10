import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/slide-templates", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@workspace/slide-templates")>();
  return {
    ...orig,
    materializeSlide: vi.fn(() => {
      throw new Error("template boom");
    }),
  };
});

import { buildOneSlide } from "../lib/materialize-slide";
import type { OutlineCard } from "@workspace/slide-templates";

describe("buildOneSlide() — fallback path", () => {
  it("returns a title-only slide when the template throws", () => {
    const card: OutlineCard = {
      index: 7,
      kind: "concept-card",
      title: "Hello world",
      purpose: "Test fallback",
      talkingPoints: ["a", "b"],
      interactionHint: null,
      visualDirection: {},
    };
    const out = buildOneSlide({
      card,
      themeKey: "harvest",
      density: "balanced",
      lang: "en",
    });

    // One title-only text element pinned to the card title.
    expect(out.slide.id).toBe("s7");
    expect(out.slide.layout).toBe("concept-card");
    expect(out.slide.elements).toHaveLength(1);
    const el = out.slide.elements[0];
    expect(el.kind).toBe("text");
    expect((el as { text: string }).text).toBe("Hello world");

    // The fallback warning surfaces the underlying error message.
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/Slide 7 could not be built/);
    expect(out.warnings[0]).toMatch(/template boom/);
  });

  it("emits the Arabic warning copy when lang is ar", () => {
    const card: OutlineCard = {
      index: 2,
      kind: "title",
      title: "مرحبا",
      purpose: "اختبار",
      talkingPoints: [],
      interactionHint: null,
      visualDirection: {},
    };
    const out = buildOneSlide({
      card,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });
    expect(out.warnings[0]).toMatch(/تعذّر بناء الشريحة 2/);
  });
});
