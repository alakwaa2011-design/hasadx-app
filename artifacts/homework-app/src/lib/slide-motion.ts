/* Presentation motion for identity decks (phase 1: slide transitions + card-by-card reveal).

   The profile follows the deck's identity: playful for the children's and nature identities, calm and
   professional for the others. Legacy (non-identity) themes get no reveal and keep their old transition.
   Reveal groups are derived from the slide itself: every card image ("hd://card" / "hd://band") plus the
   elements that sit on it (its text, number disc, tick) form one step, in the layout's own reading order. */

import { baseDesignKey } from "@workspace/slide-templates";

export type MotionStyle = "calm" | "playful";
export interface MotionProfile {
  style: MotionStyle;
  /** slide-to-slide transition */
  transition: "fade" | "rise" | "zoom";
  /** ms between elements that appear in the same step */
  stagger: number;
}

export function motionProfile(themeKey: string | null | undefined): MotionProfile | null {
  const base = baseDesignKey(themeKey);
  if (!base.startsWith("d_")) return null;
  switch (base) {
    case "d_kids": return { style: "playful", transition: "zoom", stagger: 110 };
    case "d_nature": return { style: "playful", transition: "rise", stagger: 90 };
    case "d_modern":
    case "d_lab": return { style: "calm", transition: "rise", stagger: 60 };
    default: return { style: "calm", transition: "fade", stagger: 60 };
  }
}

export interface SlideMotionState {
  /** elements not yet revealed on this slide */
  hidden: Set<string>;
  /** element id → position inside the step that just appeared (drives the stagger) */
  entering: Map<string, number>;
  style: MotionStyle;
  stagger: number;
}

type El = { id: string; kind: string; x: number; y: number; w: number; h: number; url?: string };
const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Element ids per reveal step; empty when the slide has fewer than two cards (nothing to sequence). */
export function revealGroups(slide: { elements?: unknown[] } | null | undefined): string[][] {
  const els = ((slide?.elements ?? []) as El[]).filter((e) => e && typeof e.id === "string");
  if (els.some((e) => e.kind === "hasad-game" || e.kind === "activity" || e.kind === "hasad-activity" || e.kind === "video-embed")) {
    return [];
  }
  const isCard = (e: El) => e.kind === "image" && typeof e.url === "string" && /^hd:\/\/(card|band)\//.test(e.url);
  const cards = els.filter(isCard);
  if (cards.length < 2) return [];
  const groups: string[][] = cards.map((c) => [c.id]);
  const cardIds = new Set(cards.map((c) => c.id));
  for (const e of els) {
    if (cardIds.has(e.id)) continue;
    if (e.kind === "image" && typeof e.url === "string" && e.url.startsWith("hd://frame/")) continue;
    if (e.w * e.h > CANVAS_W * CANVAS_H * 0.5) continue;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    let hit = cards.findIndex((c) => cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h);
    if (hit < 0) {
      /* number discs and badges sit just above their card */
      hit = cards.findIndex((c) => cx >= c.x && cx <= c.x + c.w && cy >= c.y - 80 && cy < c.y);
    }
    if (hit >= 0) groups[hit].push(e.id);
  }
  return groups;
}
