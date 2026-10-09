/* v2 layouts: one function per slide kind, drawn in whichever design identity is active.
   Coordinates are RTL-first (Arabic is the main audience); English decks mirror every horizontal
   position so the whole composition flips. Text sizes are fitted to their boxes so nothing is
   clipped and nothing is left tiny in the middle of a large empty card. */

import type { Element, ImageElement, MaterializeOptions, OutlineCard, TextElement, Lang } from "./types";
import { pickArtKey } from "./art";
import { artRef, bandRef, cardRef, discRef, frameRef, glowRef, pillRef } from "./assets";
import { H, W, type Design } from "./designs";

const SAFE_L = 80, SAFE_R = W - 80;
const SAFE_W = SAFE_R - SAFE_L;

const KIND_AR: Record<string, string> = {
  title: "درس", objectives: "أهداف الدرس", "concept-card": "فكرة", comparison: "مقارنة", "visual-hero": "تأمّل", steps: "الخطوات",
  interactive: "تفاعل", closure: "الخلاصة", timeline: "الخط الزمني", formula: "القاعدة", stat: "بالأرقام", quote: "اقتباس", callout: "انتبه",
};
const KIND_EN: Record<string, string> = {
  title: "Lesson", objectives: "Objectives", "concept-card": "Concept", comparison: "Compare", "visual-hero": "Look closer", steps: "Steps",
  interactive: "Interact", closure: "Summary", timeline: "Timeline", formula: "Rule", stat: "By the numbers", quote: "Quote", callout: "Note",
};

/** Largest font size (≤ max, ≥ min) at which `text` fits a w×h box. */
export function fitSize(text: string, w: number, h: number, max: number, min: number, weight = 800): number {
  const cw = weight >= 800 ? 0.6 : 0.54; // average glyph width in em (Arabic/Latin mix)
  for (let s = max; s >= min; s -= 2) {
    let lines = 0;
    for (const para of text.split("\n")) lines += Math.max(1, Math.ceil((para.length * s * cw) / w));
    if (lines * s * 1.28 <= h) return s;
  }
  return min;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const stripBullet = (s: string) => s.replace(/^[\s•\-–—◆▪●]+/, "").trim();

class B {
  els: Element[] = [];
  n = 0;
  constructor(public seed: string, public d: Design, public lang: Lang, public photo?: string) {}
  private id(k: string) { return `${this.seed}-${k}${++this.n}`; }
  text(x: number, y: number, w: number, h: number, text: string, o: { size?: number; weight?: number; color?: string; align?: TextElement["align"]; font?: string; fit?: [number, number]; mid?: boolean } = {}) {
    let size = o.size ?? 30;
    if (o.fit) size = fitSize(text, w, h, o.fit[0], o.fit[1], o.weight ?? 700);
    /* centre the block vertically inside its box (text elements are top-aligned) */
    if (o.mid !== false) {
      const cw = (o.weight ?? 700) >= 800 ? 0.6 : 0.54;
      let lines = 0;
      for (const para of text.split("\n")) lines += Math.max(1, Math.ceil((para.length * size * cw) / w));
      const th = Math.min(h, lines * size * 1.28 + 4);
      y += Math.max(0, (h - th) / 2);
      h = th;
    }
    this.els.push({
      id: this.id("t"), kind: "text", x, y, w, h, text,
      fontFamily: o.font ?? this.d.body, fontSize: size, fontWeight: String(o.weight ?? 700),
      align: o.align ?? "start", color: o.color ?? this.d.ink,
    } satisfies TextElement);
  }
  head(x: number, y: number, w: number, h: number, text: string, o: Parameters<B["text"]>[5] = {}) {
    this.text(x, y, w, h, text, { font: this.d.head, weight: 900, ...o });
  }
  img(x: number, y: number, w: number, h: number, url: string, fit: ImageElement["objectFit"] = "contain") {
    this.els.push({ id: this.id("i"), kind: "image", x, y, w, h, url, objectFit: fit } satisfies ImageElement);
  }
  art(key: string, x: number, y: number, s: number) { this.img(x, y, s, s, artRef(key, this.d.key)); }
  card(x: number, y: number, w: number, h: number, color: string) { this.img(x, y, w, h, cardRef(this.d.key, w, h, color), "fill"); }
  band(x: number, y: number, w: number, h: number, color: string, bandH: number) { this.img(x, y, w, h, bandRef(this.d.key, w, h, color, bandH), "fill"); }
  pill(x: number, y: number, w: number, h: number, color: string) { this.img(x, y, w, h, pillRef(this.d.key, w, h, color), "fill"); }
  disc(x: number, y: number, s: number, color: string) { this.img(x, y, s, s, discRef(this.d.key, s, color), "fill"); }
  /** The slide's photo when it has one (rounded, cover-fit), otherwise the matching illustration. */
  visual(key: string, x: number, y: number, s: number, ph?: { w: number; h: number }) {
    if (this.photo) {
      const w = ph?.w ?? s, h = ph?.h ?? s;
      this.els.push({ id: this.id("p"), kind: "image", x: x + (s - w) / 2, y: y + (s - h) / 2, w, h, url: this.photo, objectFit: "cover", imageBorderRadius: 28 } satisfies ImageElement);
    } else this.art(key, x, y, s);
  }
  glow(x: number, y: number, w: number, h: number) { this.img(x, y, w, h, glowRef(this.d.key, w, h), "fill"); }
  /** ordinal digit in the deck's own numerals */
  digit(i: number) { return (this.lang === "ar" ? ["١", "٢", "٣", "٤", "٥"] : ["1", "2", "3", "4", "5"])[i] ?? String(i + 1); }
  acc(i: number) { return this.d.accents[((i % 4) + 4) % 4]; }
  /** white text on dark accents, ink on light ones (chalk accents are light) */
  onAcc() { return this.d.dark ? "#10241F" : "#FFFFFF"; }
}

function frameFirst(b: B, kind: "cover" | "content", n: number) {
  b.els.push({ id: `${b.seed}-frame`, kind: "image", x: 0, y: 0, w: W, h: H, url: frameRef(b.d.key, kind, n), objectFit: "fill" } satisfies ImageElement);
}

function header(b: B, card: OutlineCard, kind: string) {
  const eb = (b.lang === "ar" ? KIND_AR : KIND_EN)[kind] ?? "";
  const accent = b.acc(0);
  if (eb) {
    const w = Math.max(120, eb.length * 20 + 56);
    b.pill(SAFE_R - w, 128, w, 40, accent);
    b.text(SAFE_R - w, 132, w, 34, eb, { size: 20, weight: 800, color: b.onAcc(), align: "center", font: b.d.head });
  }
  b.head(SAFE_L + 20, 168, SAFE_W - 40, 84, clip(card.title, 70), { fit: [54, 34], color: b.d.heading, mid: false });
  if (card.subtitle) b.text(SAFE_L + 20, 246, SAFE_W - 40, 40, clip(card.subtitle, 100), { size: 24, weight: 600, color: b.d.muted, mid: false });
}

const pts = (card: OutlineCard) => card.talkingPoints.map(stripBullet).filter(Boolean);

/* ── 1 · cover ── */
function cover(b: B, card: OutlineCard) {
  const key = pickArtKey([card.visualDirection.icon, card.title, card.subtitle], 0);
  if (!b.photo) b.glow(80, 150, 420, 420);
  b.visual(key, 110, 180, 360, { w: 400, h: 420 });
  const eb = b.lang === "ar" ? "عرض تعليمي" : "Lesson";
  const titleText = clip(card.title, 60);
  const tSize = fitSize(titleText, 650, 230, 92, 44, 900);
  const lines = Math.max(1, Math.min(3, Math.ceil((titleText.length * tSize * 0.6) / 650)));
  const th = Math.round(lines * tSize * 1.25) + 8;
  const ty = 214;
  b.head(540, 150, 640, 44, eb, { size: 30, weight: 800, color: b.acc(1), mid: false });
  b.head(540, ty, 650, th, titleText, { size: tSize, weight: 900, color: b.d.heading, mid: false });
  const ry = ty + th + 18;
  b.pill(540, ry, 360, 10, b.acc(2));
  if (card.subtitle) b.text(540, ry + 30, 650, 90, clip(card.subtitle, 110), { fit: [34, 22], weight: 700, color: b.d.ink, mid: false });
}

/* ── 2 · objectives ── */
function objectives(b: B, card: OutlineCard) {
  header(b, card, "objectives");
  const items = pts(card).slice(0, 4);
  const n = Math.max(1, items.length);
  const cols = n <= 3 ? n : 2, rows = n <= 3 ? 1 : 2;
  const gap = 28, top = 300, bottom = 650;
  const cw = (SAFE_W - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rows - 1)) / rows;
  items.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = SAFE_R - cw - col * (cw + gap), y = top + row * (ch + gap);
    const color = b.acc(i);
    b.card(x, y, cw, ch, color);
    b.disc(x + cw - 84, y + 22, 62, color);
    b.head(x + cw - 84, y + 34, 62, 40, b.digit(i), { size: 30, color: b.onAcc(), align: "center" });
    const key = pickArtKey([t], i);
    b.art(key, x + 24, y + (ch - 110) / 2, 110);
    b.text(x + 150, y + 24, cw - 250 > 140 ? cw - 250 : cw - 190, ch - 48, clip(t, 220), { fit: [rows === 1 ? 32 : 28, 17], weight: 800 });
  });
}

/* ── 3 · concept card ── */
function concept(b: B, card: OutlineCard) {
  header(b, card, "concept-card");
  const p = pts(card);
  const lede = p[0] ?? card.purpose;
  const rest = p.slice(1, 6);
  const key = pickArtKey([card.visualDirection.icon, card.title, lede], card.index);
  const chars = p.reduce((n, t) => n + t.length, 0);
  if (chars > 300 || rest.length > 3) {
    /* text-heavy explanation (lecture style): picture column + one large reading panel */
    const colW = 300, x0 = SAFE_R - 40 - (SAFE_W - 40 - colW - 36);
    const textW = SAFE_W - 40 - colW - 36;
    const tx = SAFE_R - textW;
    b.card(tx, 300, textW, 360, b.acc(0));
    b.head(tx + 28, 312, textW - 56, 96, clip(lede, 240), { fit: [34, 22], weight: 900, color: b.d.heading, mid: false });
    const bullets = rest.map((t) => "◆  " + clip(t, 300)).join("\n");
    if (bullets) b.text(tx + 28, 414, textW - 56, 232, bullets, { fit: [26, 16], weight: 600, mid: false });
    if (!b.photo) b.disc(SAFE_L + 10, 320, colW, b.acc(0));
    b.visual(key, SAFE_L + 20, 330, colW - 20, { w: colW, h: 330 });
    void x0;
    return;
  }
  const artS = rest.length ? 230 : 300;
  if (!b.photo) b.disc(90, 330, artS + 20, b.acc(0));
  b.visual(key, 100, 340, artS, { w: artS + 10, h: artS + 10 });
  const x0 = 90 + artS + 70, w0 = SAFE_R - x0;
  const lh = rest.length ? 150 : 250;
  b.card(x0, 320, w0, lh, b.acc(0));
  b.head(x0 + 28, 330, w0 - 56, lh - 20, clip(lede, 260), { fit: [rest.length ? 40 : 46, 20], weight: 800, color: b.d.ink });
  rest.slice(0, 3).forEach((t, i, arr) => {
    const gw = (w0 - 24 * (arr.length - 1)) / arr.length, x = SAFE_R - gw - i * (gw + 24);
    b.card(x, 500, gw, 150, b.acc(i + 1));
    b.text(x + 22, 514, gw - 44, 122, clip(t, 200), { fit: [26, 16], weight: 700 });
  });
}

/* ── 4 · comparison ── */
function comparison(b: B, card: OutlineCard) {
  header(b, card, "comparison");
  const p = pts(card);
  const colonIdx = p.map((t, i) => (/[:：]/.test(t) ? i : -1)).filter((i) => i >= 0);
  let aT = "", bT = "", a: string[] = [], c: string[] = [];
  if (colonIdx.length >= 2) {
    const split = (arr: string[]) => { const [h = "", ...r] = arr; const [t, f] = h.split(/[:：]/, 2).map((q) => q.trim()); return { t: t ?? "", p: [f, ...r].filter(Boolean) as string[] }; };
    const A = split(p.slice(colonIdx[0], colonIdx[1])), Bb = split(p.slice(colonIdx[1]));
    aT = A.t; a = A.p; bT = Bb.t; c = Bb.p;
  }
  if (!a.length || !c.length) { const half = Math.ceil(p.length / 2); a = p.slice(0, half); c = p.slice(half); }
  const fallbackT = b.lang === "ar" ? ["الأول", "الثاني"] : ["First", "Second"];
  const cols = [{ t: aT || fallbackT[0], items: a, color: b.acc(0) }, { t: bT || fallbackT[1], items: c, color: b.acc(2) }];
  const cw = (SAFE_W - 40) / 2, top = 310, ch = 340;
  cols.forEach((col, i) => {
    const x = SAFE_R - cw - i * (cw + 40);
    b.band(x, top, cw, ch, col.color, 74);
    b.head(x + 20, top + 12, cw - 40, 54, clip(col.t, 40), { fit: [36, 24], color: b.onAcc(), align: "center" });
    const items = col.items.slice(0, 4);
    const itemH = (ch - 100) / Math.max(items.length, 1);
    items.forEach((t, j) => {
      const y = top + 90 + j * itemH;
      b.disc(x + cw - 56, y + (itemH - 38) / 2, 38, col.color);
      b.text(x + 24, y, cw - 100, itemH, clip(t, 200), { fit: [28, 16], weight: 700 });
    });
  });
}

/* ── 5 · visual hero ── */
function hero(b: B, card: OutlineCard) {
  const key = pickArtKey([card.visualDirection.icon, card.title, ...card.talkingPoints], card.index);
  if (!b.photo) b.glow(60, 130, 560, 560);
  b.visual(key, 100, 190, 460, { w: 520, h: 460 });
  const eb = b.lang === "ar" ? KIND_AR["visual-hero"] : KIND_EN["visual-hero"];
  b.head(660, 190, 540, 40, eb, { size: 28, color: b.acc(1) });
  b.head(660, 236, 540, 200, clip(card.title, 60), { fit: [70, 38], color: b.d.heading });
  const line = pts(card)[0] ?? card.subtitle ?? "";
  if (line) { b.pill(660, 456, 90, 8, b.acc(2)); b.text(660, 482, 540, 170, clip(line, 300), { fit: [34, 18], weight: 700 }); }
}

/* ── 6 · steps ── */
function steps(b: B, card: OutlineCard) {
  header(b, card, "steps");
  const items = pts(card).slice(0, 5);
  const n = Math.max(1, items.length);
  const gap = 26, top = 330, ch = 320;
  const cw = (SAFE_W - gap * (n - 1)) / n;
  b.pill(SAFE_L + 40, top - 6, SAFE_W - 80, 6, b.acc(2));
  items.forEach((t, i) => {
    const x = SAFE_R - cw - i * (cw + gap), color = b.acc(i);
    b.card(x, top + 30, cw, ch - 30, color);
    b.disc(x + cw / 2 - 36, top - 30, 72, color);
    b.head(x + cw / 2 - 36, top - 16, 72, 46, b.digit(i), { size: 34, color: b.onAcc(), align: "center" });
    b.text(x + 18, top + 70, cw - 36, ch - 80, clip(t, 220), { fit: [n > 3 ? 24 : 30, 16], weight: 700, align: "center" });
  });
}

/* ── 7 · timeline ── */
function timeline(b: B, card: OutlineCard) {
  header(b, card, "timeline");
  const items = pts(card).slice(0, 5);
  const n = Math.max(1, items.length);
  const axisY = 470;
  b.pill(SAFE_L + 20, axisY - 5, SAFE_W - 40, 10, b.acc(2));
  const step = (SAFE_W - 200) / Math.max(n - 1, 1);
  items.forEach((t, i) => {
    const cx = n === 1 ? W / 2 : SAFE_R - 100 - i * step, color = b.acc(i);
    const up = i % 2 === 0;
    b.disc(cx - 28, axisY - 28, 56, color);
    b.head(cx - 28, axisY - 20, 56, 40, b.digit(i), { size: 26, color: b.onAcc(), align: "center" });
    const bw = Math.min(250, step * 1.6), y = up ? axisY - 190 : axisY + 50;
    b.card(cx - bw / 2, y, bw, 140, color);
    b.text(cx - bw / 2 + 16, y + 12, bw - 32, 116, clip(t, 170), { fit: [24, 15], weight: 700, align: "center" });
  });
}

/* ── 8 · closure / summary ── */
function closure(b: B, card: OutlineCard) {
  header(b, card, "closure");
  const items = pts(card).slice(0, 5);
  const key = pickArtKey([card.visualDirection.icon, "medal"], 0);
  b.disc(90, 330, 250, b.acc(2));
  b.art("medal", 105, 345, 220);
  const x0 = 380, w0 = SAFE_R - x0, n = Math.max(1, items.length), gap = 16, top = 300, h = (650 - top - gap * (n - 1)) / n;
  void key;
  items.forEach((t, i) => {
    const y = top + i * (h + gap), color = b.acc(i);
    b.card(x0, y, w0, h, color);
    b.art("check", x0 + w0 - 66, y + (h - 44) / 2, 44);
    b.text(x0 + 24, y + 6, w0 - 110, h - 12, clip(t, 240), { fit: [28, 16], weight: 800 });
  });
}

/* ── 9 · formula ── */
function formula(b: B, card: OutlineCard) {
  header(b, card, "formula");
  const p = pts(card);
  const f = p[0] ?? "";
  b.card(SAFE_L + 40, 310, SAFE_W - 80, 190, b.acc(0));
  b.head(SAFE_L + 70, 322, SAFE_W - 140, 166, clip(f, 90), { fit: [78, 34], align: "center", color: b.d.heading, font: "Inter, Cairo, sans-serif" });
  const rest = p.slice(1, 4);
  rest.forEach((t, i) => {
    const gw = (SAFE_W - 80 - 24 * (rest.length - 1)) / rest.length, x = SAFE_R - 40 - gw - i * (gw + 24);
    b.card(x, 530, gw, 120, b.acc(i + 1));
    b.text(x + 18, 540, gw - 36, 100, clip(t, 170), { fit: [24, 15], weight: 700, align: "center" });
  });
}

/* ── 10 · stat ── */
function stat(b: B, card: OutlineCard) {
  header(b, card, "stat");
  const items = pts(card).slice(0, 3);
  const n = Math.max(1, items.length), gap = 28, top = 310, ch = 340;
  const cw = (SAFE_W - gap * (n - 1)) / n;
  items.forEach((raw, i) => {
    const m = raw.split(/\s*[—–\-:：]\s*/);
    const num = (m.length > 1 ? m[0] : (raw.match(/[\d٠-٩][\d٠-٩.,٫%٪]*/)?.[0] ?? raw.split(" ")[0])).trim();
    const label = (m.length > 1 ? m.slice(1).join(" — ") : raw.replace(num, "").trim()) || card.purpose;
    const x = SAFE_R - cw - i * (cw + gap), color = b.acc(i);
    b.card(x, top, cw, ch, color);
    b.head(x + 16, top + 30, cw - 32, 140, clip(num, 14), { fit: [112, 48], align: "center", color });
    b.pill(x + cw / 2 - 40, top + 180, 80, 8, color);
    b.text(x + 24, top + 206, cw - 48, ch - 224, clip(label, 200), { fit: [28, 16], weight: 700, align: "center" });
  });
}

/* ── 11 · quote ── */
function quote(b: B, card: OutlineCard) {
  const p = pts(card);
  b.card(110, 150, W - 220, 420, b.acc(0));
  b.head(W - 220, 150, 110, 120, "”", { size: 130, color: b.acc(2), align: "center" });
  b.head(190, 230, W - 420, 260, clip(p[0] ?? card.title, 200), { fit: [52, 28], weight: 800, color: b.d.ink, align: "center" });
  const who = card.subtitle ?? p[1] ?? "";
  if (who) { b.pill(W / 2 - 40, 520, 80, 8, b.acc(1)); b.text(190, 590, W - 380, 60, clip(who, 80), { size: 28, weight: 700, color: b.d.muted, align: "center" }); }
}

/* ── 12 · callout ── */
function callout(b: B, card: OutlineCard) {
  header(b, card, "callout");
  const p = pts(card);
  const key = pickArtKey([card.visualDirection.icon, card.title, ...p], card.index);
  b.card(SAFE_L + 20, 320, SAFE_W - 40, 330, b.acc(2));
  if (!b.photo) b.disc(SAFE_L + 60, 366, 230, b.acc(2));
  b.visual(key, SAFE_L + 75, 381, 200, { w: 240, h: 250 });
  const x0 = SAFE_L + 330, w0 = SAFE_R - 60 - x0;
  b.head(x0, 350, w0, 120, clip(p[0] ?? card.title, 200), { fit: [40, 22], color: b.d.heading });
  const rest = p.slice(1, 3).join("\n");
  if (rest) b.text(x0, 480, w0, 150, clip(rest, 420), { fit: [28, 16], weight: 600, color: b.d.ink });
}

/** Frame + layout for one outline card, or null when this kind has no v2 layout (interactive keeps legacy elements). */
export function materializeV2(o: MaterializeOptions, d: Design): Element[] | null {
  const { card, lang } = o;
  const seed = o.idSeed ?? `s${card.index}`;
  const b = new B(seed, d, lang, o.imageUrl);
  const kind = card.kind;
  if (kind === "interactive") return null;
  frameFirst(b, kind === "title" || kind === "visual-hero" ? "cover" : "content", card.index);
  switch (kind) {
    case "title": cover(b, card); break;
    case "objectives": objectives(b, card); break;
    case "concept-card": concept(b, card); break;
    case "comparison": comparison(b, card); break;
    case "visual-hero": hero(b, card); break;
    case "steps": steps(b, card); break;
    case "timeline": timeline(b, card); break;
    case "closure": closure(b, card); break;
    case "formula": formula(b, card); break;
    case "stat": if (pts(card).slice(0, 3).every((p) => /[\d٠-٩]/.test(p))) stat(b, card); else concept(b, card); break;
    case "quote": quote(b, card); break;
    case "callout": callout(b, card); break;
    default: concept(b, card);
  }
  if (lang === "en") {
    /* mirror horizontal positions; the frame is full-bleed so it stays put */
    for (const el of b.els) if (el.id.indexOf("-frame") < 0) el.x = W - el.x - el.w;
  }
  return b.els;
}
