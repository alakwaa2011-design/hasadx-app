/**
 * Five extra printable themes. Artwork is authored inline SVG encoded as
 * CSS background images, placed at page margins only (no layout height).
 */
import type { ThemeSpec, ThemeCssParams, HeaderLayout } from "./worksheet-themes";

export const svgUrl = (svg: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;

/** Header-layout class rules of a base theme (rules not scoped to ws-theme-*). */
function headerCss(baseThemes: Record<string, ThemeSpec>, layout: HeaderLayout, p: ThemeCssParams): string {
  const base = { band: "modern_band", playful: "kids_play", clipboard: "science_lab", arabesque: "arabic_ink", tabular: "geometric", masthead: "editorial", classic: "geometric" }[layout];
  const src = baseThemes[base].css(p);
  return src.split("}").filter(r => r.includes("{") && !r.includes(".ws-theme-")).map(r => r + "}").join("\n");
}

const corner = (c1: string, c2: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><path d='M0 0H70L0 70Z' fill='${c1}' opacity='.14'/><path d='M0 0H40L0 40Z' fill='${c1}'/><path d='M12 56L56 12' stroke='${c2}' stroke-width='3'/><circle cx='76' cy='14' r='4' fill='${c2}'/></svg>`);
const leaf = (c1: string, c2: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><path d='M4 146C4 80 40 30 100 6' stroke='${c1}' stroke-width='3' fill='none'/><g fill='${c1}' opacity='.75'><path d='M16 110c-14-6-18-22-14-32 14 2 24 14 14 32z'/><path d='M30 78c-14-8-14-26-8-36 14 4 22 18 8 36z'/><path d='M54 50c-8-14-2-28 8-34 8 12 4 28-8 34z'/></g><g fill='${c2}'><circle cx='84' cy='22' r='6'/><circle cx='96' cy='34' r='5' opacity='.7'/><circle cx='72' cy='34' r='5' opacity='.7'/><circle cx='84' cy='46' r='5' opacity='.7'/><circle cx='84' cy='34' r='4' fill='#FFE9A8'/></g></svg>`);
const space = (c1: string, c2: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='170' height='150' viewBox='0 0 170 150'><circle cx='122' cy='56' r='26' fill='${c1}'/><ellipse cx='122' cy='56' rx='42' ry='9' fill='none' stroke='${c2}' stroke-width='4' transform='rotate(-18 122 56)'/><circle cx='112' cy='46' r='5' fill='#fff' opacity='.35'/><g fill='${c2}'><path d='M28 20l3 8 8 3-8 3-3 8-3-8-8-3 8-3z'/><path d='M70 100l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/><circle cx='60' cy='30' r='2'/><circle cx='150' cy='120' r='2.5'/><circle cx='20' cy='80' r='2'/></g></svg>`);
const cloud = (c1: string, c2: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='80' viewBox='0 0 300 80'><path d='M0 80V52C40 30 80 62 130 44S230 24 300 50V80Z' fill='${c1}' opacity='.28'/><path d='M0 80V64C50 48 100 74 160 60S250 50 300 66V80Z' fill='${c1}' opacity='.5'/><g fill='${c2}'><path d='M214 22a9 9 0 0 1 17-3 8 8 0 0 1 2 16h-26a8.500 8.500 0 0 1 7-13z' opacity='.8'/></g></svg>`);
const ruler = (c1: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='26' viewBox='0 0 200 26'><rect width='200' height='26' fill='${c1}' opacity='.12'/><g stroke='${c1}' stroke-width='2'>${Array.from({ length: 21 }, (_, i) => `<path d='M${i * 10 + 1} 0v${i % 5 === 0 ? 16 : 9}'/>`).join("")}</g></svg>`);
const gridTile = (c: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='19' height='19'><path d='M19 0H0V19' fill='none' stroke='${c}' stroke-opacity='.16' stroke-width='1'/></svg>`);

/** Decoration images exported for the design-styles module. */
export const MOTIFS = {
  botanical: (c1: string, c2: string) => leaf(c1, c2),
  space: (c1: string, c2: string) => space(c1, c2),
  confetti: (c1: string, c2: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='150' height='110' viewBox='0 0 150 110'><g><rect x='12' y='14' width='14' height='5' rx='2' fill='${c1}' transform='rotate(25 12 14)'/><circle cx='56' cy='20' r='5' fill='${c2}'/><path d='M96 10l6 10h-12z' fill='${c1}'/><rect x='120' y='34' width='12' height='5' rx='2' fill='${c2}' transform='rotate(-30 120 34)'/><circle cx='30' cy='56' r='4' fill='${c1}'/><path d='M74 52q6-8 12 0t12 0' stroke='${c2}' stroke-width='3' fill='none'/><circle cx='128' cy='78' r='5' fill='${c1}'/></g></svg>`),
};

const mk = (
  baseThemes: Record<string, ThemeSpec>,
  id: string, nameAr: string, nameEn: string, description: string, headerLayout: HeaderLayout,
  defaultColor: string, second: string, bg: string,
  body: (p: ThemeCssParams, s: string) => string,
): ThemeSpec => ({
  id: id as ThemeSpec["id"], nameAr, nameEn, description, headerLayout, defaultColor,
  swatchColors: [defaultColor, second],
  css(p) {
    const s = `.ws-theme-${id}`;
     return `${headerCss(baseThemes, headerLayout, p)}
      ${s} .ws-corner, ${s} .ws-watermark-word { }
      ${s} .ws-corner { display: none; }
      ${s}.ws-page { --ws-frame: 0px; background-color: ${p.BG && p.BG !== "white" ? p.BG : bg}; background-repeat: no-repeat; }
       ${body(p, s).replaceAll(second, p.GOLD).replaceAll(encodeURIComponent(second), encodeURIComponent(p.GOLD))}`;
  },
});

export function createExtraThemes(baseThemes: Record<string, ThemeSpec>): Record<"studio_pro" | "pastel_garden" | "space_journey" | "storybook" | "math_grid", ThemeSpec> {
return {
  studio_pro: mk(baseThemes, "studio_pro", "ستوديو احترافي", "Studio Pro", "أنيق ومنظم بخطوط ذهبية رفيعة للاستخدام الرسمي", "band", "#1F3A5F", "#C58B2A", "#FFFFFF",
    ({ TC, startSide }, s) => `
       ${s}.ws-page { --ws-frame: 2px; background-image: ${corner(TC, "#C58B2A")}; background-position: top ${startSide === "right" ? "left" : "right"}; background-size: 22mm 22mm; border: 1px solid ${TC}33; }
       ${s} .ws-content { padding: 18mm 18mm 13mm; }
       ${s} .ws-q { border: 0; border-bottom: 1px solid ${TC}22; border-radius: 0; background: none; padding: 3mm 4mm; margin-bottom: 2mm; }
      ${s} .ws-q-num { background: ${TC}; border-radius: 4px; box-shadow: 0 0 0 2px #C58B2A55; }
      ${s} .ws-line { border-bottom: 1px solid ${TC}40; }
      ${s} .ws-fill-rule { border-bottom-color: #C58B2A; }
      ${s} .ws-bubble { border-color: ${TC}88; }
       ${s} .ws-footer { border-top: 1px solid #C58B2A66; padding: 4mm 0 0; }
       ${s} .ws-cont-header { margin: 0 0 4mm; border-bottom-color: ${TC}44; }`),
  pastel_garden: mk(baseThemes, "pastel_garden", "حديقة باستيل", "Pastel Garden", "أوراق وزهور ناعمة وألوان هادئة محببة للصغار", "playful", "#D9708F", "#7DBE9A", "#FFF9F6",
    ({ TC, fontSizePt }, s) => `
       ${s}.ws-page { --ws-frame: 6px; background-image: ${leaf("#7DBE9A", TC)}, ${leaf("#7DBE9A", "#F3B54A")}; background-position: left bottom, right top; background-size: 30mm 30mm, 24mm 24mm; border: 3px solid ${TC}44; border-radius: 18px; }
      ${s}.ws-page .ws-content { padding: 14mm 18mm; }
       ${s} .ws-play-banner { margin: -14mm -18mm 5mm; }
      ${s} .ws-q { border: 2px solid #7DBE9A66; border-radius: 16px; background: #ffffffcc; padding: 4mm 5mm; margin-bottom: 5mm; }
      ${s} .ws-q:nth-child(even) { border-color: ${TC}55; }
      ${s} .ws-q-num { background: ${TC}; border-radius: 50%; width: 30px; height: 30px; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #7DBE9A88; }
      ${s} .ws-q-prompt { font-size: ${fontSizePt + 1}pt; line-height: 1.9; font-weight: 700; }
      ${s} .ws-line { height: 10mm; border-bottom: 2px dotted #7DBE9A; }
      ${s} .ws-fill-rule { border-bottom: 2px dashed ${TC}; }
      ${s} .ws-bubble { width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${TC}99; }
      ${s} .ws-footer { border-top: 2px dotted #7DBE9A; }`),
  space_journey: mk(baseThemes, "space_journey", "رحلة فضائية", "Space Journey", "كواكب ونجوم في الزوايا لرحلة تعلم ممتعة", "clipboard", "#4B3FA0", "#F2A93B", "#F7F6FF",
    ({ TC, fontSizePt }, s) => `
       ${s}.ws-page { --ws-frame: 4px; background-image: ${space(TC, "#F2A93B")}, ${space("#F2A93B", TC)}; background-position: right top, left bottom; background-size: 36mm 32mm, 28mm 25mm; border: 2px solid ${TC}55; border-radius: 10px; }
      ${s} .ws-content { padding: 14mm 18mm; }
      ${s} .ws-q { border: 2px solid ${TC}30; border-radius: 12px; background: #ffffffd9; padding: 3.500mm 5mm; margin-bottom: 5mm; }
      ${s} .ws-q-num { background: ${TC}; border-radius: 50%; box-shadow: 0 0 0 3px #F2A93B; }
      ${s} .ws-q-prompt { font-size: ${fontSizePt + 0.5}pt; }
      ${s} .ws-line { border-bottom: 1.5px dashed ${TC}55; height: 9mm; }
      ${s} .ws-fill-rule { border-bottom: 2px solid #F2A93B; }
      ${s} .ws-bubble { border-radius: 50%; border-color: ${TC}; }
      ${s} .ws-footer { border-top: 2px dashed ${TC}44; }`),
  storybook: mk(baseThemes, "storybook", "كتاب حكايات", "Storybook", "تلال وسحب دافئة على ورق كريمي كصفحات القصص", "arabesque", "#A8552B", "#E9B44C", "#FFF8EA",
    ({ TC, fontSizePt, startSide }, s) => `
       ${s}.ws-page { --ws-frame: 3px; background-image: ${cloud("#E9B44C", TC)}; background-position: center bottom; background-size: 100% 24mm; border: 1.5px solid ${TC}44; border-radius: 6px; }
      ${s} .ws-content { padding: 15mm 18mm 20mm; }
      ${s} .ws-q { border: 0; border-${startSide}: 4px solid #E9B44C; border-radius: 0 10px 10px 0; background: #fff6; padding: 3mm 5mm; margin-bottom: 5mm; }
      ${s} .ws-q-num { background: ${TC}; border-radius: 50% 50% 50% 8px; }
      ${s} .ws-q-prompt { font-size: ${fontSizePt + 0.5}pt; line-height: 1.9; }
      ${s} .ws-line { border-bottom: 1px solid ${TC}44; height: 9mm; }
      ${s} .ws-fill-rule { border-bottom: 1.5px solid ${TC}; }
      ${s} .ws-footer { border-top: 1px solid #E9B44C; }`),
  math_grid: mk(baseThemes, "math_grid", "شبكة الرياضيات", "Math Grid", "ورق مربعات وشريط مسطرة، واضح لمسائل الحساب", "tabular", "#0F7B6C", "#E8743B", "#FFFFFF",
    ({ TC, startSide }, s) => `
       ${s}.ws-page { --ws-frame: 4px; background-image: ${ruler(TC)}, ${gridTile(TC)}; background-repeat: no-repeat, repeat; background-position: left top, 0 0; background-size: 100% 6mm, 5mm 5mm; border: 2px solid ${TC}; border-radius: 2px; }
      ${s} .ws-content { padding: 16mm 17mm 13mm; }
      ${s} .ws-q { border: 1.5px solid ${TC}55; border-${startSide}: 5px solid #E8743B; border-radius: 2px; background: #ffffffee; padding: 3mm 4mm; margin-bottom: 4.500mm; }
      ${s} .ws-q-num { background: ${TC}; border-radius: 2px; width: 24px; height: 24px; box-shadow: none; }
      ${s} .ws-line { border-bottom: 1px solid ${TC}55; height: 8mm; }
      ${s} .ws-fill-rule { border-bottom: 2px solid ${TC}; }
      ${s} .ws-bubble { border-radius: 2px; border-color: ${TC}; }
      ${s} .ws-footer { border-top: 1px solid ${TC}55; background: #ffffffd9; }`),
};
}

export const EXTRA_BACKGROUNDS: Record<keyof ReturnType<typeof createExtraThemes>, string> = {
  studio_pro: "#FFFFFF", pastel_garden: "#FFF9F6", space_journey: "#F7F6FF", storybook: "#FFF8EA", math_grid: "#FFFFFF",
};
