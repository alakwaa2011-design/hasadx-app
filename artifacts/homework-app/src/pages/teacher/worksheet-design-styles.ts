import type { WorksheetSettings } from "@workspace/api-zod";
import { MOTIFS } from "./worksheet-extra-themes";
import { THEMES } from "./worksheet-themes";

export type WorksheetDesign = NonNullable<WorksheetSettings["design"]>;

export const getDesign = (s: WorksheetSettings): WorksheetDesign =>
  s.design ?? {};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Print-safe overrides scoped to .ws-page.ws-designed. Never changes box heights via decoration. */
export function worksheetDesignCss(settings: WorksheetSettings, accentColor: string): string {
  const d = getDesign(settings);
  const P = ".ws-page.ws-designed";
  const sec = d.secondaryColor && HEX.test(d.secondaryColor) ? d.secondaryColor
    : settings.template ? THEMES[settings.template]?.swatchColors[1] ?? accentColor : "#c9972a";
  const r: string[] = [];
  if (d.density === "compact") r.push(`.ws-designed .ws-q { padding-top: 2mm; padding-bottom: 2mm; margin-bottom: 2.5mm; } .ws-designed .ws-line { height: 7mm; }`);
  if (d.density === "comfortable") r.push(`.ws-designed .ws-q { padding-top: 4mm; padding-bottom: 4mm; margin-bottom: 5mm; } .ws-designed .ws-line { height: 10mm; }`);
  if (d.pageFrame && d.pageFrame !== "none") {
    const st = d.pageFrame === "double" ? "3px double" : "1.5px solid";
    r.push(`${P} { outline: ${st} ${sec}; outline-offset: -4mm; ${d.pageFrame === "rounded" ? "border-radius: 14px;" : ""} }`);
  }
  if (d.pageFrame === "none") r.push(`${P} { outline: none; border-color: transparent; }`);
  if (d.questionFrame === "none") r.push(`.ws-designed .ws-q { border: 0 !important; box-shadow: none !important; background: none !important; }`);
  if (d.questionFrame === "outline") r.push(`.ws-designed .ws-q { border: 1.5px solid ${sec} !important; border-radius: 8px; background: none !important; box-shadow: none !important; }`);
  if (d.questionFrame === "soft") r.push(`.ws-designed .ws-q { border: 0 !important; border-radius: 10px; background: ${sec}14 !important; box-shadow: none !important; }`);
  if (d.numbering === "plain") r.push(`.ws-designed .ws-q-num { background: none !important; color: ${sec} !important; box-shadow: none !important; border: 0 !important; font-weight: 900; }`);
  if (d.numbering === "circle") r.push(`.ws-designed .ws-q-num { border-radius: 50% !important; background: ${sec} !important; color: #fff !important; }`);
  if (d.numbering === "square") r.push(`.ws-designed .ws-q-num { border-radius: 3px !important; background: ${sec} !important; color: #fff !important; }`);
  if (d.numbering === "badge") r.push(`.ws-designed .ws-q-num { min-width: 22px; min-height: 22px; padding: 2px 6px; border-radius: 7px !important; background: ${sec} !important; color: #fff !important; box-shadow: none !important; font-style: normal; }`);
  if (d.answerPattern === "lines") r.push(`.ws-designed .ws-line { border-bottom: 1px solid ${sec}55 !important; background-image: none !important; } .ws-designed .ws-fill-rule { border-bottom-style: solid !important; }`);
  if (d.answerPattern === "dotted") r.push(`.ws-designed .ws-line, .ws-designed .ws-fill-rule { border-bottom-style: dotted !important; border-bottom-width: 2px !important; }`);
  if (d.answerPattern === "blank") r.push(`.ws-designed .ws-line { border-bottom-color: transparent !important; }`);
  if (d.answerPattern === "grid") r.push(`.ws-designed .ws-line { border-bottom: 1px solid ${sec}55 !important; background-image: linear-gradient(0deg, ${sec}33 1px, transparent 1px), linear-gradient(90deg, ${sec}33 1px, transparent 1px); background-size: 5mm 5mm; }`);
  if (d.decoration === "none") r.push(`${P} { background-image: none !important; } ${P}::after, ${P} .ws-corner, ${P} .ws-play-stars { display: none !important; }`);
  if (d.decoration && d.decoration !== "none") {
    const img = MOTIFS[d.decoration](accentColor, sec);
    r.push(`${P}::after { content: ""; position: absolute; bottom: 16mm; inset-inline-end: 2mm; width: 15mm; height: 24mm; background: ${img} no-repeat center / contain; pointer-events: none; z-index: 0; }`);
  }
  if (d.printMode === "ink_saver") r.push(`${P} { background: #fff !important; background-image: none !important; box-shadow: none !important; } ${P}::before, ${P}::after { display: none !important; } .ws-designed .ws-q, .ws-designed .ws-band-top, .ws-designed .ws-play-banner { box-shadow: none !important; background: #fff !important; background-image: none !important; } .ws-designed .ws-band-top *, .ws-designed .ws-play-banner * { color: ${accentColor} !important; text-shadow: none !important; } .ws-designed .ws-q-num { background: #fff !important; color: ${accentColor} !important; border: 1px solid ${accentColor} !important; box-shadow: none !important; }`);
  if (d.printMode === "mono") r.push(`${P} { filter: grayscale(1) contrast(1.05); -webkit-print-color-adjust: exact; print-color-adjust: exact; }`);
  return r.join("\n");
}
