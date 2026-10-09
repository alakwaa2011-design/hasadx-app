/* Design identities for the v2 slide templates.
   An identity is a complete visual language — page art, cards, colours and fonts — not just a
   colour wash. A teacher (or the AI director, by subject) picks one; every slide layout then
   renders in that identity, so a science deck, a literature deck and a kids' deck do not look alike.
   All art is generated SVG so it scales, exports to PowerPoint and needs no hosted files. */

import type { ArtColors } from "./art";

export const W = 1280;
export const H = 720;

export interface Design {
  key: string;
  labelAr: string;
  labelEn: string;
  /** one line that tells the teacher when to use it */
  descAr: string;
  /** subject words the AI uses to choose this identity */
  fitsAr: string;
  dark: boolean;
  paper: string;
  ink: string;
  muted: string;
  /** colour of big headings */
  heading: string;
  /** four accent colours used round-robin for cards */
  accents: [string, string, string, string];
  art: ArtColors;
  head: string;
  body: string;
  frame: (kind: "cover" | "content", n: number) => string;
  card: (w: number, h: number, color: string) => string;
  /** card with a coloured title band */
  bandCard: (w: number, h: number, color: string, bandH: number) => string;
  pill: (w: number, h: number, color: string) => string;
  disc: (s: number, color: string) => string;
}

const svg = (w: number, h: number, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const SHADOW = (id: string, dy = 8, blur = 9, op = 0.2) =>
  `<filter id="${id}" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="#000" flood-opacity="${op}"/></filter>`;

function star8(cx: number, cy: number, r: number, fill: string): string {
  let d = "";
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2, rr = i % 2 ? r * 0.55 : r;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
}

/* ── generic building blocks ── */
function roundCard(w: number, h: number, o: { r: number; fill: string; stroke?: string; sw?: number; inner?: string; shadow?: boolean; dash?: string; bar?: string }): string {
  const sh = o.shadow ? ` filter="url(#s)"` : "";
  return svg(w, h, `<defs>${SHADOW("s")}</defs>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}" fill="${o.fill}"${sh}/>
  ${o.bar ? `<clipPath id="cb"><rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}"/></clipPath><rect x="6" y="6" width="14" height="${h - 12}" fill="${o.bar}" clip-path="url(#cb)"/>` : ""}
  ${o.stroke ? `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}" fill="none" stroke="${o.stroke}" stroke-width="${o.sw ?? 5}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ""}/>` : ""}
  ${o.inner ?? ""}`);
}
function bandedCard(w: number, h: number, band: number, o: { r: number; fill: string; color: string; stroke?: string; sw?: number; pattern?: boolean; shadow?: boolean }): string {
  let pat = "";
  if (o.pattern) for (let x = 20; x < w; x += 42) pat += star8(x, band / 2 + 6, 11, "rgba(255,255,255,0.22)");
  return svg(w, h, `<defs>${SHADOW("s")}<clipPath id="c"><rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}"/></clipPath></defs>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}" fill="${o.fill}"${o.shadow ? ' filter="url(#s)"' : ""}/>
  <g clip-path="url(#c)"><rect x="6" y="6" width="${w - 12}" height="${band}" fill="${o.color}"/>${pat}</g>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${o.r}" fill="none" stroke="${o.stroke ?? o.color}" stroke-width="${o.sw ?? 5}"/>`);
}
const pillShape = (w: number, h: number, fill: string, stroke?: string) => svg(w, h, `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="${(h - 6) / 2}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="4"` : ""}/>`);
const discShape = (s: number, fill: string, ring: string, shadow = true) => svg(s, s, `<defs>${SHADOW("s", 5, 6, 0.25)}</defs><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 6}" fill="${fill}"${shadow ? ' filter="url(#s)"' : ""}/><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 12}" fill="none" stroke="${ring}" stroke-opacity=".7" stroke-width="3"/>`);

/* ───────────────────────── 1 · textbook ───────────────────────── */
const textbook: Design = {
  key: "d_textbook", labelAr: "كتاب مدرسي", labelEn: "Textbook",
  descAr: "هوية الكتب المدرسية: شريط مزخرف وبطاقات بإطار مزدوج", fitsAr: "الفقه، التربية الإسلامية، اللغة العربية، الدراسات",
  dark: false, paper: "#FFFCF4", ink: "#2A1631", muted: "#6B5A70", heading: "#8B1E3F",
  accents: ["#4B2A7B", "#5CAB3C", "#F2922E", "#119C96"],
  art: { p: "#4B2A7B", s: "#119C96", a: "#F2B33D", i: "#2A1631" },
  head: "Cairo, Tajawal, sans-serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    let pat = "";
    for (let y = 0; y < H + 90; y += 90) for (let x = 0; x < W + 90; x += 90) pat += star8(x + ((y / 90) % 2) * 45, y, 22, "rgba(217,96,92,0.07)");
    const bandH = kind === "cover" ? 70 : 58;
    let wave = `M0 0H${W}V${bandH}`;
    for (let x = W; x > 0; x -= 240) wave += `C${x - 60} ${bandH + 50} ${x - 180} ${bandH + 50} ${Math.max(0, x - 240)} ${bandH}`;
    wave += "Z";
    let bp = "";
    for (let y = 0; y < 150; y += 46) for (let x = 0; x < W + 46; x += 46) bp += star8(x + ((y / 46) % 2) * 23, y, 13, "rgba(255,255,255,0.28)");
    const dome = (x: number) => `<g transform="translate(${x} ${H})"><path d="M-70 0C-70 -40 -40 -50 -30 -70L-12 -112L0 -150L12 -112L30 -70C40 -50 70 -40 70 0Z" fill="#D9605C" opacity=".95"/></g>`;
    return svg(W, H, `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#FBF2E2"/></linearGradient>
    <linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E77F78"/><stop offset=".55" stop-color="#D9605C"/><stop offset="1" stop-color="#B5413D"/></linearGradient>
    <clipPath id="cw"><path d="${wave}"/></clipPath>${SHADOW("sh", 5, 7, 0.25)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>${pat}
    <g filter="url(#sh)"><path d="${wave}" fill="url(#cb)"/></g><g clip-path="url(#cw)">${bp}</g>
    ${kind === "content" ? dome(46) + dome(W - 46) : dome(46) + dome(W - 46)}`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 28, fill: "#FFFCF4", stroke: c, sw: 6, shadow: true, inner: `<rect x="17" y="17" width="${w - 34}" height="${h - 34}" rx="20" fill="none" stroke="${c}" stroke-opacity=".3" stroke-width="2"/>` }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 28, fill: "#FFFCF4", color: c, pattern: true, shadow: true }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#fff"),
};

/* ───────────────────────── 2 · lab ───────────────────────── */
const lab: Design = {
  key: "d_lab", labelAr: "مختبر علمي", labelEn: "Science lab",
  descAr: "ورق مربعات وألوان زرقاء باردة للتجارب والقوانين", fitsAr: "العلوم، الفيزياء، الكيمياء، الأحياء، الرياضيات، التقنية",
  dark: false, paper: "#F3F8FC", ink: "#0F2A3A", muted: "#4E6A7C", heading: "#0B4F6C",
  accents: ["#0B7285", "#3B82F6", "#F59E0B", "#7C3AED"],
  art: { p: "#0B7285", s: "#38BDF8", a: "#F59E0B", i: "#0F2A3A" },
  head: "Cairo, Tajawal, sans-serif", body: "IBM Plex Sans Arabic, Tajawal, sans-serif",
  frame: (kind, n) => {
    let grid = "";
    for (let x = 0; x <= W; x += 40) grid += `<path d="M${x} 0V${H}" stroke="#9CC3D9" stroke-opacity="${x % 200 === 0 ? 0.35 : 0.18}" stroke-width="${x % 200 === 0 ? 1.6 : 1}"/>`;
    for (let y = 0; y <= H; y += 40) grid += `<path d="M0 ${y}H${W}" stroke="#9CC3D9" stroke-opacity="${y % 200 === 0 ? 0.35 : 0.18}" stroke-width="${y % 200 === 0 ? 1.6 : 1}"/>`;
    const hex = (cx: number, cy: number, r: number, f: string) => `<path d="M${cx + r} ${cy}L${cx + r / 2} ${cy + r * 0.87}L${cx - r / 2} ${cy + r * 0.87}L${cx - r} ${cy}L${cx - r / 2} ${cy - r * 0.87}L${cx + r / 2} ${cy - r * 0.87}Z" fill="${f}"/>`;
    const side = n % 2 === 0;
    const bar = side ? `<rect x="${W - 34}" y="0" width="34" height="${H}" fill="#0B7285"/>${[...Array(18)].map((_, k) => `<rect x="${W - 34}" y="${30 + k * 38}" width="${k % 3 === 0 ? 22 : 12}" height="3" fill="#fff" fill-opacity=".7"/>`).join("")}` : `<rect x="0" y="0" width="34" height="${H}" fill="#0B7285"/>${[...Array(18)].map((_, k) => `<rect x="0" y="${30 + k * 38}" width="${k % 3 === 0 ? 22 : 12}" height="3" fill="#fff" fill-opacity=".7"/>`).join("")}`;
    const mol = kind === "cover"
      ? hex(side ? 150 : W - 150, 140, 70, "#3B82F6") + hex(side ? 230 : W - 230, 180, 46, "#F59E0B") + hex(side ? 90 : W - 90, 232, 36, "#0B7285")
      : hex(side ? 110 : W - 110, 70, 40, "#BFE3F5") + hex(side ? 170 : W - 170, 100, 24, "#F9D58A");
    return svg(W, H, `<rect width="${W}" height="${H}" fill="#F3F8FC"/>${grid}${bar}${mol}<rect x="0" y="${H - 8}" width="${W}" height="8" fill="#0B7285" fill-opacity=".18"/>`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 16, fill: "#FFFFFF", stroke: "#CFE3EE", sw: 3, shadow: true, bar: c }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 16, fill: "#FFFFFF", color: c, stroke: c, sw: 4, shadow: true }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#fff"),
};

/* ───────────────────────── 3 · modern ───────────────────────── */
const modern: Design = {
  key: "d_modern", labelAr: "عصري بسيط", labelEn: "Modern minimal",
  descAr: "مساحات بيضاء وخطوط كبيرة وألوان جريئة، مناسب لكل المواد", fitsAr: "أي مادة، عروض عامة، المرحلة الثانوية والجامعة",
  dark: false, paper: "#FFFFFF", ink: "#111827", muted: "#6B7280", heading: "#111827",
  accents: ["#2563EB", "#10B981", "#F43F5E", "#F59E0B"],
  art: { p: "#2563EB", s: "#93C5FD", a: "#F43F5E", i: "#111827" },
  head: "Readex Pro, Cairo, sans-serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    const corner = n % 2 === 0;
    const cx = corner ? W : 0;
    const dots = [...Array(5)].map((_, r) => [...Array(5)].map((__, q) => `<circle cx="${(corner ? 60 : W - 60) + (corner ? 1 : -1) * q * 20}" cy="${H - 60 - r * 20}" r="3" fill="#2563EB" fill-opacity=".35"/>`).join("")).join("");
    return svg(W, H, `<rect width="${W}" height="${H}" fill="#fff"/>
    <circle cx="${cx}" cy="0" r="${kind === "cover" ? 330 : 210}" fill="#2563EB"/>
    <circle cx="${cx}" cy="0" r="${kind === "cover" ? 250 : 150}" fill="#F43F5E" fill-opacity=".9"/>
    <circle cx="${cx}" cy="0" r="${kind === "cover" ? 170 : 90}" fill="#F59E0B"/>
    ${dots}<rect x="${corner ? W - 360 : 60}" y="${H - 22}" width="300" height="6" rx="3" fill="#111827"/>`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 30, fill: "#F5F7FB", inner: `<rect x="6" y="6" width="14" height="${h - 12}" rx="7" fill="${c}"/>` }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 30, fill: "#F5F7FB", color: c, stroke: "#F5F7FB", sw: 1 }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#fff", false),
};

/* ───────────────────────── 4 · kids ───────────────────────── */
const kids: Design = {
  key: "d_kids", labelAr: "مرح للصغار", labelEn: "Playful kids",
  descAr: "ألوان زاهية وأشكال مرحة للصفوف الأولى", fitsAr: "الصفوف الأولى والتمهيدي، القصص، الحروف والأرقام",
  dark: false, paper: "#FFF8E1", ink: "#3B2F63", muted: "#6E6396", heading: "#6C5CE7",
  accents: ["#FF6B6B", "#4ECDC4", "#FFB703", "#6C5CE7"],
  art: { p: "#6C5CE7", s: "#4ECDC4", a: "#FFB703", i: "#3B2F63" },
  head: "Cairo, Tajawal, sans-serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    const blobs = [["#FF6B6B", 90, 90, 120], ["#4ECDC4", W - 70, 60, 90], ["#FFB703", W - 60, H - 90, 110], ["#6C5CE7", 70, H - 70, 80]];
    const conf = [...Array(26)].map((_, k) => `<circle cx="${(k * 197) % W}" cy="${(k * 113) % H}" r="${4 + (k % 3) * 2}" fill="${["#FF6B6B", "#4ECDC4", "#FFB703", "#6C5CE7"][k % 4]}" fill-opacity=".35"/>`).join("");
    let wave = `M0 ${H - 40}`;
    for (let x = 0; x < W; x += 120) wave += `Q${x + 30} ${H - 70} ${x + 60} ${H - 40}T${x + 120} ${H - 40}`;
    wave += `V${H}H0Z`;
    return svg(W, H, `<rect width="${W}" height="${H}" fill="#FFF8E1"/>${conf}
    ${blobs.map((b) => `<circle cx="${b[1]}" cy="${b[2]}" r="${kind === "cover" ? (b[3] as number) * 1.3 : (b[3] as number) * 0.8}" fill="${b[0]}" fill-opacity=".9"/>`).join("")}
    <path d="${wave}" fill="#4ECDC4" fill-opacity=".55"/>
    ${star8(W - 190, 60, 26, "#FFB703")}${star8(190, H - 50, 20, "#FF6B6B")}`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 38, fill: "#FFFFFF", stroke: c, sw: 8, shadow: true }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 38, fill: "#FFFFFF", color: c, sw: 7, shadow: true }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#fff"),
};

/* ───────────────────────── 5 · academic ───────────────────────── */
const academic: Design = {
  key: "d_academic", labelAr: "أكاديمي رسمي", labelEn: "Academic formal",
  descAr: "إطار مذهّب وألوان كحلية للمحاضرات والتاريخ والقانون", fitsAr: "التاريخ، الأدب، القانون، الفلسفة، المرحلة الجامعية، المؤتمرات",
  dark: false, paper: "#FBF8F0", ink: "#1B2433", muted: "#5B6475", heading: "#0B2A55",
  accents: ["#0B2A55", "#8C6D1F", "#7A1F2B", "#2F5D50"],
  art: { p: "#0B2A55", s: "#5B7DB1", a: "#C9A227", i: "#1B2433" },
  head: "Amiri, Cairo, serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    const corner = (x: number, y: number, sx: number, sy: number) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})"><path d="M0 0H64M0 0V64" stroke="#C9A227" stroke-width="4" fill="none"/><path d="M12 12H40M12 12V40" stroke="#0B2A55" stroke-width="3" fill="none"/><circle cx="52" cy="52" r="5" fill="#C9A227"/><path d="M0 28C20 28 28 20 28 0" stroke="#C9A227" stroke-width="2.5" fill="none"/></g>`;
    return svg(W, H, `<rect width="${W}" height="${H}" fill="#FBF8F0"/>
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="#0B2A55" stroke-width="4"/>
    <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="#C9A227" stroke-width="2"/>
    ${corner(34, 34, 1, 1)}${corner(W - 34, 34, -1, 1)}${corner(34, H - 34, 1, -1)}${corner(W - 34, H - 34, -1, -1)}
    ${kind === "cover" ? `<rect x="${W / 2 - 160}" y="${H - 96}" width="320" height="4" fill="#C9A227"/>${star8(W / 2, H - 94, 12, "#0B2A55")}` : ""}`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 8, fill: "#FFFFFF", stroke: c, sw: 3, inner: `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="3" fill="none" stroke="#C9A227" stroke-width="1.5"/>` }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 8, fill: "#FFFFFF", color: c, stroke: c, sw: 3 }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#C9A227", false),
};

/* ───────────────────────── 6 · nature ───────────────────────── */
const nature: Design = {
  key: "d_nature", labelAr: "طبيعة", labelEn: "Nature",
  descAr: "أوراق وتلال خضراء للبيئة والأحياء والجغرافيا", fitsAr: "الأحياء، البيئة، الجغرافيا، الزراعة، العلوم للصغار",
  dark: false, paper: "#F4F9EE", ink: "#1E3A2B", muted: "#55705F", heading: "#1F5E3B",
  accents: ["#2E7D32", "#8BC34A", "#F59E0B", "#00897B"],
  art: { p: "#2E7D32", s: "#8BC34A", a: "#F59E0B", i: "#1E3A2B" },
  head: "Cairo, Tajawal, sans-serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    const leaf = (x: number, y: number, r: number, rot: number, f: string) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${r / 100})" d="M0 0C-40 -60 -20 -150 0 -170C20 -150 40 -60 0 0Z" fill="${f}"/>`;
    const hills = `<path d="M0 ${H - 90}C220 ${H - 150} 420 ${H - 40} 700 ${H - 100}S1100 ${H - 150} ${W} ${H - 80}V${H}H0Z" fill="#A5D6A7" fill-opacity=".7"/><path d="M0 ${H - 50}C260 ${H - 100} 520 ${H - 20} 800 ${H - 60}S1120 ${H - 90} ${W} ${H - 40}V${H}H0Z" fill="#66BB6A" fill-opacity=".8"/>`;
    const k = kind === "cover" ? 1.5 : 1;
    return svg(W, H, `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F9EE"/><stop offset="1" stop-color="#E6F2DB"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#b)"/>${hills}
    ${leaf(W - 40, 20, 90 * k, 160, "#2E7D32")}${leaf(W - 90, 10, 70 * k, 190, "#8BC34A")}${leaf(W - 10, 80, 60 * k, 130, "#00897B")}
    ${leaf(36, H - 70, 80 * k, 15, "#2E7D32")}${leaf(76, H - 56, 60 * k, -15, "#8BC34A")}
    <circle cx="150" cy="70" r="${kind === "cover" ? 52 : 34}" fill="#F59E0B" fill-opacity=".9"/>`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 30, fill: "#FFFFFF", stroke: c, sw: 4, shadow: true }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 30, fill: "#FFFFFF", color: c, sw: 4, shadow: true }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#fff"),
};

/* ───────────────────────── 7 · chalkboard ───────────────────────── */
const chalk: Design = {
  key: "d_chalk", labelAr: "سبورة طباشير", labelEn: "Chalkboard",
  descAr: "سبورة خضراء داكنة بخط الطباشير للرياضيات والشرح", fitsAr: "الرياضيات، الفيزياء، النحو والإملاء، الحصص التفاعلية",
  dark: true, paper: "#1F3A34", ink: "#F5F5F0", muted: "#BFD3CC", heading: "#FFE29A",
  accents: ["#FFD166", "#7BDFF2", "#F7A8B8", "#B8F2A5"],
  art: { p: "#7BDFF2", s: "#B8F2A5", a: "#FFD166", i: "#10241F" },
  head: "Cairo, Tajawal, sans-serif", body: "Tajawal, Cairo, sans-serif",
  frame: (kind, n) => {
    const smudge = [...Array(14)].map((_, k) => `<ellipse cx="${(k * 211) % W}" cy="${(k * 127 + 60) % H}" rx="${90 + (k % 4) * 30}" ry="${14 + (k % 3) * 8}" fill="#fff" fill-opacity=".035" transform="rotate(${(k * 23) % 40 - 20} ${(k * 211) % W} ${(k * 127 + 60) % H})"/>`).join("");
    const eq = kind === "cover" ? `<text x="170" y="${H - 80}" font-family="Inter,Arial" font-size="46" fill="#fff" fill-opacity=".14">E = mc² · a² + b² = c²</text>` : `<text x="${W - 60}" y="${H - 54}" text-anchor="end" font-family="Inter,Arial" font-size="30" fill="#fff" fill-opacity=".1">π ≈ 3.14 · Σ · √x</text>`;
    return svg(W, H, `<defs><radialGradient id="g" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#2A4A42"/><stop offset="1" stop-color="#1B332D"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${smudge}${eq}
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#B07C45" stroke-width="22"/>
    <rect x="11" y="11" width="${W - 22}" height="${H - 22}" fill="none" stroke="#8A5D2E" stroke-width="3"/>
    <rect x="${W - 330}" y="${H - 34}" width="90" height="14" rx="4" fill="#fff" fill-opacity=".85"/><rect x="${W - 220}" y="${H - 34}" width="60" height="14" rx="4" fill="#FFD166"/>`);
  },
  card: (w, h, c) => roundCard(w, h, { r: 18, fill: "rgba(255,255,255,0.07)", stroke: c, sw: 4, dash: "14 8" }),
  bandCard: (w, h, c, b) => bandedCard(w, h, b, { r: 18, fill: "rgba(255,255,255,0.07)", color: c, stroke: c, sw: 3 }),
  pill: (w, h, c) => pillShape(w, h, c),
  disc: (s, c) => discShape(s, c, "#10241F", false),
};

export const DESIGNS: Record<string, Design> = Object.fromEntries([textbook, lab, modern, kids, academic, nature, chalk].map((d) => [d.key, d]));
export const DESIGN_KEYS = Object.keys(DESIGNS);
export function designFor(key: string | null | undefined): Design | null {
  return key && DESIGNS[key] ? DESIGNS[key] : null;
}
