import { describe, expect, it } from "vitest";
import {
  DESIGN_KEYS, isDesignAsset, isKnownThemeKey, materializeSlide, paletteForTheme, resolveDesignAsset,
  type Lang, type OutlineCard, type SlideKind,
} from "@workspace/slide-templates";
import { buildOneSlide } from "../lib/materialize-slide";

const KINDS: SlideKind[] = [
  "title", "objectives", "concept-card", "comparison", "visual-hero", "steps", "timeline",
  "closure", "formula", "stat", "quote", "callout", "interactive",
];

function card(kind: SlideKind, i: number): OutlineCard {
  return {
    index: i, kind, title: "مكروهات الصيام", subtitle: "التربية الإسلامية", purpose: "شرح",
    talkingPoints: [
      "ما يُثاب تاركه ولا يأثم فاعله", "المكروه: يُثاب تاركه", "ولا يأثم فاعله", "الحرام: يُثاب تاركه",
      "ويأثم فاعله", "30 يومًا — مدة رمضان",
    ],
    interactionHint: kind === "interactive" ? "quiz" : null,
    visualDirection: { icon: "crescent" },
  };
}

const W = 1280, H = 720;

describe("v2 design identities", () => {
  it("registers seven identities as known theme keys with a palette", () => {
    expect(DESIGN_KEYS).toHaveLength(7);
    for (const key of DESIGN_KEYS) {
      expect(isKnownThemeKey(key)).toBe(true);
      expect(paletteForTheme(key).design).toBe(key);
    }
  });

  for (const lang of ["ar", "en"] as Lang[]) {
    for (const key of DESIGN_KEYS) {
      it(`materializes every layout in ${key} (${lang}) with schema-safe, in-bounds elements`, () => {
        KINDS.forEach((kind, i) => {
          const { slide } = materializeSlide({ card: card(kind, i), theme: paletteForTheme(key), density: "balanced", lang });
          expect(slide.elements.length).toBeGreaterThan(0);
          for (const el of slide.elements) {
            expect(el.w).toBeGreaterThan(0);
            expect(el.h).toBeGreaterThan(0);
            if (el.kind === "image") {
              expect(el.url.length).toBeLessThanOrEqual(2000);
              if (isDesignAsset(el.url)) {
                expect(resolveDesignAsset(el.url).startsWith("data:image/svg+xml")).toBe(true);
                expect(el.url.length).toBeLessThan(120);
              }
            }
            if (el.kind === "text") {
              expect(el.text.length).toBeLessThanOrEqual(5000);
              expect(el.fontSize ?? 28).toBeGreaterThanOrEqual(6);
              expect(el.fontSize ?? 28).toBeLessThanOrEqual(220);
            }
            if (kind !== "interactive" && !el.id.includes("-frame")) {
              expect(el.x).toBeGreaterThanOrEqual(-1);
              expect(el.y).toBeGreaterThanOrEqual(-1);
              expect(el.x + el.w).toBeLessThanOrEqual(W + 1);
              expect(el.y + el.h).toBeLessThanOrEqual(H + 1);
            }
          }
        });
      });
    }
  }

  it("buildOneSlide keeps a design's page paper and shows a supplied photo", () => {
    const out = buildOneSlide({
      card: { ...card("concept-card", 3), imagePlan: { imageQuery: "photo", placement: "side" } },
      themeKey: "d_lab", density: "balanced", lang: "ar",
      backgroundImageUrl: "https://example.com/photo.jpg", imagePlacement: "side",
    });
    expect(out.slide.background).toBe("#F3F8FC");
    expect(out.slide.elements.some((e) => e.kind === "image" && e.url === "https://example.com/photo.jpg")).toBe(true);
    expect(out.slide.elements.some((e) => e.id.includes("-bg-overlay"))).toBe(false);
  });
});
