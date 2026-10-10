/* Re-skins slides that were already built with a design identity: swaps the identity (or its colour
   variant) in every design-asset reference, and maps the identity's own colours — text, accents, paper,
   fonts — onto the new one. Layout geometry is untouched, so the teacher's edits and positions survive. */

import { designFor, designHue, baseDesignKey } from "./designs";
import { DESIGN_ASSET_PREFIX } from "./assets";

type AnyEl = Record<string, unknown>;
type AnySlide = Record<string, unknown> & { elements?: AnyEl[] };

const norm = (c: string) => c.trim().toLowerCase();

function shiftHex(hex: string, deg: number): string {
  // reuse designFor's tint logic by tinting a throwaway key is overkill: rotate here
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || deg % 360 === 0) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.08 || l < 0.1 || l > 0.96) return hex;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 720) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), mm = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

function designKeyIn(url: string): string | null {
  const parts = url.slice(DESIGN_ASSET_PREFIX.length).split("/");
  const k = parts[0] === "art" ? parts[2] : parts[1];
  return k && /^d_[a-z]+(~h\d{1,3})?$/.test(k) ? k : null;
}

export function restyleSlides<T extends AnySlide>(slides: T[], toKey: string): T[] {
  const toD = designFor(toKey);
  if (!toD) return slides;
  return slides.map((slide) => {
    const els = Array.isArray(slide.elements) ? slide.elements : [];
    let fromKey: string | null = null;
    for (const el of els) {
      const u = typeof el.url === "string" ? el.url : "";
      if (u.startsWith(DESIGN_ASSET_PREFIX)) { fromKey = designKeyIn(u); if (fromKey) break; }
    }
    const fromD = designFor(fromKey);
    if (!fromD || fromD.key === toD.key) return slide;
    const sameBase = baseDesignKey(fromD.key) === baseDesignKey(toD.key);
    const delta = designHue(toD.key) - designHue(fromD.key);
    const pairs = new Map<string, string>();
    pairs.set(norm(fromD.ink), toD.ink); pairs.set(norm(fromD.muted), toD.muted); pairs.set(norm(fromD.heading), toD.heading);
    fromD.accents.forEach((c, i) => pairs.set(norm(c), toD.accents[i]));
    const mapColor = (c: string): string => {
      const hit = pairs.get(norm(c));
      if (hit) return hit;
      return sameBase ? shiftHex(c, delta) : c;
    };
    const next = els.map((el) => {
      const out: AnyEl = { ...el };
      if (typeof el.url === "string" && el.url.startsWith(DESIGN_ASSET_PREFIX)) {
        const parts = el.url.slice(DESIGN_ASSET_PREFIX.length).split("/");
        const di = parts[0] === "art" ? 2 : 1;
        parts[di] = toD.key;
        for (let i = di + 1; i < parts.length; i++) {
          if (/^[0-9a-fA-F]{6}$/.test(parts[i])) parts[i] = mapColor(`#${parts[i]}`).replace(/^#/, "");
        }
        out.url = DESIGN_ASSET_PREFIX + parts.join("/");
      }
      for (const f of ["color", "bgColor"] as const) {
        if (typeof el[f] === "string" && /^#[0-9a-f]{6}$/i.test(el[f] as string)) out[f] = mapColor(el[f] as string);
      }
      if (typeof el.fontFamily === "string") {
        if (el.fontFamily === fromD.head) out.fontFamily = toD.head;
        else if (el.fontFamily === fromD.body) out.fontFamily = toD.body;
      }
      return out;
    });
    const out: AnySlide = { ...slide, elements: next };
    if (typeof slide.background === "string" && slide.background === fromD.paper) out.background = toD.paper;
    return out as T;
  });
}
