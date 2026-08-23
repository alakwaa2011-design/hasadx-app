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
  it("returns a readable slide with a visual fallback when the template throws", () => {
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

    // The last-resort layout preserves a visual anchor instead of an empty
    // title-only slide.
    expect(out.slide.id).toBe("s7");
    expect(out.slide.layout).toBe("concept-card");
    expect(out.slide.visualFallback).toBe("icon");
    expect(out.slide.imagePlan).toBeUndefined();
    expect(out.slide.elements).toHaveLength(3);
    expect(out.slide.elements.some((el) => el.kind === "shape")).toBe(true);
    expect(out.slide.elements.some((el) => el.kind === "icon")).toBe(true);
    const el = out.slide.elements.find((item) => item.kind === "text");
    expect(el).toBeDefined();
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
