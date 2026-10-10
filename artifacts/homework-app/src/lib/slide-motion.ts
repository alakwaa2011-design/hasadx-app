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
  /** how a card appears: lift (rise), pop (spring) or wipe (chalk write-on) */
  reveal: "lift" | "pop" | "wipe";
}

export function motionProfile(themeKey: string | null | undefined): MotionProfile | null {
  const base = baseDesignKey(themeKey);
  if (!base.startsWith("d_")) return null;
  switch (base) {
    case "d_kids": return { style: "playful", transition: "zoom", stagger: 110, reveal: "pop" };
    case "d_nature": return { style: "playful", transition: "rise", stagger: 90, reveal: "pop" };
    case "d_chalk": return { style: "calm", transition: "fade", stagger: 80, reveal: "wipe" };
    case "d_modern":
    case "d_lab": return { style: "calm", transition: "rise", stagger: 60, reveal: "lift" };
    default: return { style: "calm", transition: "fade", stagger: 60, reveal: "lift" };
  }
}

export interface SlideMotionState {
  /** elements not yet revealed on this slide */
  hidden: Set<string>;
  /** element id → position inside the step that just appeared (drives the stagger) */
  entering: Map<string, number>;
  style: MotionStyle;
  stagger: number;
  reveal?: "lift" | "pop" | "wipe";
  /** text direction of the deck (a chalk wipe starts from the reading side) */
  rtl?: boolean;
  /** called once when a number starts counting up (used for its sound) */
  onCount?: () => void;
  /** drawings keep a small idle movement (off when the system asks for reduced motion) */
  idle?: boolean;
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

/* ── Phase 2: idle life for the drawings ─────────────────────────────────────────────────────────────
   Each illustration gets a small, always-on movement that fits what it is (a lantern sways, a moon
   breathes, a butterfly flaps, a rocket bobs). Calm identities use the same movement at a lower amplitude. */
export interface ArtIdle { name: string; duration: number; origin?: string }

const IDLE: Array<[RegExp, ArtIdle]> = [
  [/^(lantern)$/, { name: "_hdSway", duration: 4200, origin: "50% 0%" }],
  [/^(bell)$/, { name: "_hdWiggle", duration: 3600, origin: "50% 0%" }],
  [/^(butterfly|bird|bee)$/, { name: "_hdFlap", duration: 1500 }],
  [/^(rocket|plane|paperplane|boat)$/, { name: "_hdBob", duration: 3200 }],
  [/^(sun|gear|atom|planet|compass)$/, { name: "_hdSpin", duration: 26000 }],
  [/^(moon|star|crescent|idea|bolt|medal|award|trophy|flame|heart|pulse|target|check)$/, { name: "_hdPulse", duration: 3000 }],
];

/** Idle movement for a design-art reference ("hd://art/<key>/<design>"), or null for anything else. */
export function artIdle(url: string | undefined | null): ArtIdle | null {
  const m = /^hd:\/\/art\/([a-z0-9_-]+)\//i.exec(url ?? "");
  if (!m) return null;
  const key = m[1].toLowerCase();
  for (const [re, idle] of IDLE) if (re.test(key)) return idle;
  return { name: "_hdFloat", duration: 4800 };
}

/** Stable per-element offset so several icons on one slide do not move in lockstep. */
export function idlePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1400;
}
