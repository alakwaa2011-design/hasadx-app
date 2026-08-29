import { describe, expect, it } from "vitest";
import type { OutlineCard } from "@workspace/slide-templates";
import { buildOneSlide, resolveImagePlacement } from "../lib/materialize-slide";

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

  it("keeps five Arabic visual-hero poster points inside the 16:9 canvas", () => {
    const out = buildOneSlide({
      card: card({
        kind: "visual-hero",
        slideType: "visualHero",
        layoutVariant: "poster",
        talkingPoints: [
          "تسخن الشمس مياه البحار فتتحول تدريجياً إلى بخار ماء",
          "يرتفع البخار إلى طبقات الجو الأعلى بسبب انخفاض كثافته",
          "يبرد بخار الماء ويتكاثف حول دقائق صغيرة مكوّناً السحب",
          "تكبر قطرات الماء داخل السحب حتى تصبح أثقل من الهواء",
          "تهطل المياه وتعود إلى الأنهار والبحار لتبدأ دورة جديدة",
        ],
        imagePlan: { fallback: "diagram", placement: "none" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
    });

    const text = out.slide.elements.filter((el) => el.kind === "text");
    expect(text.filter((el) => el.id.includes("-b"))).toHaveLength(5);
    expect(text.every((el) => el.y >= 0 && el.y + el.h <= 720)).toBe(true);
  });

  it("moves a busy explanatory hero image beside the Arabic text", () => {
    const denseCard = card({
      kind: "visual-hero",
      slideType: "visualHero",
      talkingPoints: [
        "يمر الطعام أولاً عبر الفم حيث يبدأ الهضم الميكانيكي",
        "ينقل المريء الطعام إلى المعدة بحركات عضلية منتظمة",
        "تخلط المعدة الطعام بالعصارات الهاضمة قبل انتقاله",
        "تمتص الأمعاء الدقيقة معظم العناصر الغذائية المفيدة",
      ],
      imagePlan: { mediaType: "illustration", placement: "background", fallback: "diagram" },
    });

    expect(resolveImagePlacement(denseCard, "background", true)).toBe("side");
    const out = buildOneSlide({
      card: denseCard,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/digestive-system.jpg",
    });

    expect(out.slide.backgroundImage).toBeUndefined();
    const image = out.slide.elements.find((el) => el.kind === "image");
    expect(image).toMatchObject({
      kind: "image",
      objectFit: "contain",
      x: 44,
    });
    expect(out.slide.elements.some((el) => el.id.endsWith("-img-frame"))).toBe(true);
  });

  it("reserves full-bleed photos for concise hero statements", () => {
    const concise = card({
      kind: "visual-hero",
      slideType: "visualHero",
      talkingPoints: ["كيف يعمل الجهاز الهضمي؟"],
      imagePlan: { mediaType: "photo", placement: "background", fallback: "diagram" },
    });

    const out = buildOneSlide({
      card: concise,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/hero.jpg",
    });

    expect(out.slide.backgroundImage).toBe("https://images.example.test/hero.jpg");
    expect(out.slide.elements.find((el) => el.id.endsWith("-bg-overlay"))).toMatchObject({
      kind: "shape",
      bgColor: "rgba(0,0,0,0.58)",
    });
  });

  it("does not layer extra photos over native teaching diagrams", () => {
    const steps = card({
      kind: "steps",
      slideType: "process",
      imagePlan: { mediaType: "photo", placement: "side", fallback: "timeline" },
    });

    expect(resolveImagePlacement(steps, "side", true)).toBe("none");
    const out = buildOneSlide({
      card: steps,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/steps.jpg",
    });
    expect(out.slide.elements.some((el) => el.kind === "image")).toBe(false);
    expect(out.slide.visualFallback).toBe("timeline");
  });

  it("preserves an uploaded source image even when the selected card has a native layout", () => {
    const sourceSteps = card({
      kind: "steps",
      slideType: "process",
      talkingPoints: [
        "تبدأ العملية بالملاحظة الدقيقة",
        "تُسجّل النتائج في جدول واضح",
        "تُقارن النتائج لاستخلاص العلاقة",
      ],
      imagePlan: { placement: "side", fallback: "timeline" },
    });

    expect(resolveImagePlacement(sourceSteps, "background", true, true)).toBe("side");
    const out = buildOneSlide({
      card: sourceSteps,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/uploaded-page.png",
      imagePlacement: "background",
      preserveImageContent: true,
    });

    expect(out.slide.backgroundImage).toBeUndefined();
    expect(out.slide.layout).toBe("concept-card");
    expect(out.slide.elements.find((el) => el.kind === "image")).toMatchObject({
      kind: "image",
      objectFit: "contain",
    });
  });

  it("paints inline images after atmosphere layers and before teaching content", () => {
    const out = buildOneSlide({
      card: card({
        layoutVariant: "editorial",
        imagePlan: { mediaType: "photo", placement: "side", fallback: "diagram" },
      }),
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/editorial.jpg",
    });

    const atmosphereEnd = Math.max(
      ...out.slide.elements.map((el, index) => el.id.includes("-atm-") ? index : -1),
    );
    const imageIndex = out.slide.elements.findIndex((el) => el.kind === "image");
    const firstTextIndex = out.slide.elements.findIndex((el) => el.kind === "text");
    expect(imageIndex).toBeGreaterThan(atmosphereEnd);
    expect(imageIndex).toBeLessThan(firstTextIndex);
  });

  it("uses slideType semantics when suppressing web photos on native process layouts", () => {
    const mismatchedProcess = card({
      kind: "concept-card",
      slideType: "process",
      imagePlan: { mediaType: "photo", placement: "side", fallback: "timeline" },
    });

    expect(resolveImagePlacement(mismatchedProcess, "side", true)).toBe("none");
    const out = buildOneSlide({
      card: mismatchedProcess,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/process.jpg",
    });
    expect(out.slide.layout).toBe("steps");
    expect(out.slide.elements.some((el) => el.kind === "image")).toBe(false);
  });

  it("uses slideType semantics to preserve uploaded process sources in a side frame", () => {
    const mismatchedProcess = card({
      kind: "concept-card",
      slideType: "process",
      imagePlan: { placement: "background", fallback: "timeline" },
    });

    expect(resolveImagePlacement(mismatchedProcess, "background", true, true)).toBe("side");
    const out = buildOneSlide({
      card: mismatchedProcess,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/uploaded-process.png",
      imagePlacement: "background",
      preserveImageContent: true,
    });
    expect(out.slide.layout).toBe("concept-card");
    expect(out.slide.elements.find((el) => el.kind === "image")).toMatchObject({
      kind: "image",
      objectFit: "contain",
    });
  });

  it("keeps slideType quiz activity surfaces free of uploaded image overlays", () => {
    const mismatchedQuiz = card({
      kind: "concept-card",
      slideType: "quiz",
      interactionHint: "quiz",
      imagePlan: { placement: "side", fallback: "coloredExample" },
    });

    expect(resolveImagePlacement(mismatchedQuiz, "side", true, true)).toBe("none");
    const out = buildOneSlide({
      card: mismatchedQuiz,
      themeKey: "harvest",
      density: "balanced",
      lang: "ar",
      backgroundImageUrl: "https://images.example.test/uploaded-quiz.png",
      imagePlacement: "side",
      preserveImageContent: true,
    });
    expect(out.slide.layout).toBe("interactive");
    expect(out.slide.elements.some((el) => el.kind === "image")).toBe(false);
    expect(out.slide.elements.some((el) => el.kind === "activity")).toBe(true);
  });
});