import { describe, expect, it } from "vitest";
import type { OutlineCard } from "@workspace/slide-templates";
import { buildOneSlide } from "../lib/materialize-slide";

function card(overrides: Partial<OutlineCard> = {}): OutlineCard {
  return {
    index: 2,
    kind: "concept-card",
    title: "دورة الماء في الطبيعة",
    purpose: "توضيح العلاقة بين مراحل الدورة",
    talkingPoints: ["التبخر يبدأ بحرارة الشمس", "يتكاثف البخار ثم يهطل"],
    interactionHint: null,
    visualDirection: { icon: "Droplets" },
    ...overrides,
  };
}

describe("materialized presentation visual quality", () => {
  it("adds a deterministic visual for legacy cards without imagePlan", () => {
    const out = buildOneSlide({
      card: card({ layoutVariant: "editorial" }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    expect(out.slide.visualFallback).toBe("diagram");
    expect(out.slide.elements.some((el) => el.id.includes("-fallback-center"))).toBe(true);
    const atmosphereIndex = out.slide.elements.findIndex((el) => el.id.includes("-atm-panel"));
    const fallbackIndex = out.slide.elements.findIndex((el) => el.id.includes("-fallback-panel"));
    expect(atmosphereIndex).toBeGreaterThanOrEqual(0);
    expect(fallbackIndex).toBeGreaterThan(atmosphereIndex);
  });

  it("does not flag intentionally clipped staggered atmosphere shapes", () => {
    const out = buildOneSlide({
      card: card({
        layoutVariant: "staggered",
        imagePlan: { fallback: "diagram", placement: "none" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    expect(out.warnings.join(" ")).not.toMatch(/خارج حدود الشريحة|beyond the slide bounds/);
  });

  it("maps process and examples to distinct local visual families", () => {
    const process = buildOneSlide({
      card: card({ kind: "steps", slideType: "process" }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });
    const example = buildOneSlide({
      card: card({ kind: "formula", slideType: "workedExample" }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    expect(process.slide.visualFallback).toBe("timeline");
    expect(example.slide.visualFallback).toBe("coloredExample");
    expect(process.slide.elements.some((el) => el.id.includes("-fallback-"))).toBe(false);
    expect(example.slide.elements.some((el) => el.id.includes("-fallback-"))).toBe(false);
  });

  it("keeps native objectives and interactive visuals unobscured", () => {
    const objectives = buildOneSlide({
      card: card({
        kind: "objectives",
        imagePlan: { fallback: "relationshipMap", placement: "none" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });
    const interactive = buildOneSlide({
      card: card({
        kind: "interactive",
        interactionHint: "quiz",
        imagePlan: { fallback: "coloredExample", placement: "none" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    expect(objectives.slide.visualFallback).toBe("relationshipMap");
    expect(interactive.slide.visualFallback).toBe("coloredExample");
    expect(objectives.slide.elements.some((el) => el.id.includes("-fallback-"))).toBe(false);
    expect(interactive.slide.elements.some((el) => el.id.includes("-fallback-"))).toBe(false);
    expect(interactive.slide.elements.some((el) =>
      el.kind === "activity" || el.kind === "hasad-game",
    )).toBe(true);
  });

  it("uses the effective slideType layout when kind and slideType conflict", () => {
    const out = buildOneSlide({
      card: card({
        kind: "concept-card",
        slideType: "process",
        imagePlan: { fallback: "timeline", placement: "none" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    expect(out.slide.layout).toBe("steps");
    expect(out.slide.visualFallback).toBe("timeline");
    expect(out.slide.elements.some((el) => el.id.includes("-fallback-"))).toBe(false);
  });
});