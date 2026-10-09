/* Design assets are stored in slides as tiny references, never as inline SVG:
     hd://frame/<design>/<cover|content>/<0|1>
     hd://card/<design>/<w>x<h>/<hex>        hd://band/<design>/<w>x<h>/<hex>/<bandH>
     hd://pill/<design>/<w>x<h>/<hex>        hd://disc/<design>/<size>/<hex>
     hd://art/<key>/<design>                 hd://glow/<design>/<w>x<h>
   A reference is ~60 characters (the slide JSON stays small and passes the element schema) and is
   resolved to a real SVG `data:` URL at draw time by `resolveDesignAsset`, in the browser, in the
   print/PDF page and in the PowerPoint exporter. Because slides keep only the *design key and the
   idea*, the look can be improved later without rewriting saved decks. */

import { ART_KEYS, artSvg, svgUri } from "./art";
import { DESIGNS } from "./designs";

export const DESIGN_ASSET_PREFIX = "hd://";

export const isDesignAsset = (url: string | null | undefined): boolean => !!url && url.startsWith(DESIGN_ASSET_PREFIX);

const hex = (c: string) => c.replace(/^#/, "");
const col = (h: string) => `#${h}`;

export const frameRef = (design: string, kind: "cover" | "content", n: number) => `hd://frame/${design}/${kind}/${n % 2}`;
export const cardRef = (design: string, w: number, h: number, c: string) => `hd://card/${design}/${Math.round(w)}x${Math.round(h)}/${hex(c)}`;
export const bandRef = (design: string, w: number, h: number, c: string, band: number) => `hd://band/${design}/${Math.round(w)}x${Math.round(h)}/${hex(c)}/${Math.round(band)}`;
export const pillRef = (design: string, w: number, h: number, c: string) => `hd://pill/${design}/${Math.round(w)}x${Math.round(h)}/${hex(c)}`;
export const discRef = (design: string, s: number, c: string) => `hd://disc/${design}/${Math.round(s)}/${hex(c)}`;
export const artRef = (key: string, design: string) => `hd://art/${key}/${design}`;
export const glowRef = (design: string, w: number, h: number) => `hd://glow/${design}/${Math.round(w)}x${Math.round(h)}`;

const cache = new Map<string, string>();

function build(url: string): string | null {
  const parts = url.slice(DESIGN_ASSET_PREFIX.length).split("/");
  const kind = parts[0];
  const d = DESIGNS[kind === "art" ? parts[2] : parts[1]];
  if (!d) return null;
  const wh = (s: string | undefined): [number, number] => {
    const [a, b] = (s ?? "").split("x").map(Number);
    return [a > 0 && a < 4000 ? a : 100, b > 0 && b < 4000 ? b : 100];
  };
  switch (kind) {
    case "frame": return d.frame(parts[2] === "cover" ? "cover" : "content", Number(parts[3]) || 0);
    case "card": { const [w, h] = wh(parts[2]); return d.card(w, h, col(parts[3] ?? hex(d.accents[0]))); }
    case "band": { const [w, h] = wh(parts[2]); return d.bandCard(w, h, col(parts[3] ?? hex(d.accents[0])), Number(parts[4]) || 70); }
    case "pill": { const [w, h] = wh(parts[2]); return d.pill(w, h, col(parts[3] ?? hex(d.accents[0]))); }
    case "disc": { const s = Math.min(600, Number(parts[2]) || 60); return d.disc(s, col(parts[3] ?? hex(d.accents[0]))); }
    case "art": return artSvg(ART_KEYS.includes(parts[1]) ? parts[1] : "idea", d.art);
    case "glow": {
      const [w, h] = wh(parts[2]);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="g"><stop offset="0" stop-color="${d.art.a}" stop-opacity=".32"/><stop offset="1" stop-color="${d.art.a}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 4}" ry="${h / 2 - 4}" fill="url(#g)"/></svg>`;
    }
    default: return null;
  }
}

/** SVG markup for a design-asset reference (null when the reference is unknown). */
export function designAssetSvg(url: string): string | null {
  if (!isDesignAsset(url)) return null;
  return build(url);
}

/** `data:image/svg+xml` URL for a design-asset reference; returns the input unchanged for ordinary URLs. */
export function resolveDesignAsset(url: string): string {
  if (!isDesignAsset(url)) return url;
  const hit = cache.get(url);
  if (hit) return hit;
  const svg = build(url);
  const out = svg ? svgUri(svg) : "";
  if (cache.size > 800) cache.clear();
  cache.set(url, out);
  return out;
}
