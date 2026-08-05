/**
 * worksheet-themes.tsx
 * ─────────────────────────────────────────────────────────────────
 * Worksheet design-template system.
 *
 * Seven genuinely distinct visual identities — each with a different
 * header layout, page frame, question-item style, typography, and
 * decorations — so every AI-generated worksheet feels handcrafted
 * by a different experienced teacher.
 *
 * Architecture
 * ────────────
 * • A ThemeSpec object defines the CSS overrides and header layout type.
 * • WorksheetPrintView adds `ws-theme-{id}` to each .ws-page element and
 *   renders the appropriate header component based on headerLayout.
 * • selectTheme() picks intelligently from subject/grade/language, never
 *   repeating the same design consecutively.
 */

import type React from "react";

// ─── Types ───────────────────────────────────────────────────────

export type ThemeId =
  | "geometric"    // Math / Physics — grid, squares, navy blue
  | "arabic_ink"   // Arabic Language — arabesque, cream, Amiri
  | "modern_band"  // English / General — vivid top band, clean cards
  | "exam_paper"   // High School — formal tabular, minimal
  | "kids_play"    // Kindergarten — playful, stars, rounded
  | "science_lab"  // Science — teal, graph paper, clipboard
  | "editorial";   // Literature / History / Islamic — serif masthead

export type HeaderLayout =
  | "classic"    // 3-column: identity | title | spacer (base default)
  | "band"       // Full-width colored top band, white title inside
  | "arabesque"  // Centered, SVG ornament above/below title
  | "tabular"    // Formal single-row: school | title | meta
  | "playful"    // Large rounded banner with star decorations
  | "clipboard"  // Subject badge tab + title below
  | "masthead";  // Newspaper: thick/thin rules + serif title

export interface ThemeSpec {
  id: ThemeId;
  nameAr: string;
  nameEn: string;
  description: string;
  headerLayout: HeaderLayout;
  /** Default accent color for this theme (overridden by settings.themeColor) */
  defaultColor: string;
  /** Decorative swatch pair for the picker UI */
  swatchColors: [string, string];
  /** Override heading font CSS string (undefined = use global heading font) */
  headingFontOverride?: string;
  /** Build the CSS override block — injected after base PrintStyles */
  css(p: ThemeCssParams): string;
}

export interface ThemeCssParams {
  TC: string;           // accent color (hex)
  GOLD: string;         // gold accent
  BG: string;           // page background
  fontFamily: string;
  headingFont: string;
  fontSizePt: number;
  isAr: boolean;
  startSide: "right" | "left";
  endSide: "right" | "left";
}

// ─── Header component prop-set ────────────────────────────────────

export interface HeaderProps {
  data: {
    title: string;
    subject: string | null;
    gradeLevel: string | null;
    language: "ar" | "en";
    settings: {
      schoolName?: string;
      section?: string;
      teacherName?: string;
      includeName?: boolean;
      includeDate?: boolean;
      includeClass?: boolean;
      headerNote?: string;
      instructions?: string;
      customFields?: Array<{ label: string; value: string }>;
      logoUrl?: string;
    };
  };
  labels: Record<string, string>;
  TC: string;
  GOLD: string;
  ar: boolean;
  hasIdentity: boolean;
  customFields: Array<{ label: string; value: string }>;
  // sub-components passed in from the print view so we don't duplicate them
  IdentityCell: React.FC<{ label: string; value: string; icon?: React.ReactNode }>;
  FieldLine: React.FC<{ label: string; short?: boolean; icon?: React.ReactNode }>;
  DoubleDivider: React.FC<{ gold?: boolean }>;
  IconUser: React.FC;
  IconClass: React.FC;
  IconDate: React.FC;
  IconLightbulb: React.FC;
  IconSchool: React.FC;
  IconSection: React.FC;
  IconTeacher: React.FC;
  IconField: React.FC;
}

// ─── The 7 themes ────────────────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeSpec> = {

  // ── 1. Geometric (Math / Physics) ──────────────────────────────
  geometric: {
    id: "geometric",
    nameAr: "هندسي",
    nameEn: "Geometric",
    description: "هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",
    headerLayout: "tabular",
    defaultColor: "#1B2D6B",
    swatchColors: ["#1B2D6B", "#E07B20"],
    css({ TC, GOLD, fontSizePt, isAr, startSide }) {
      return `
        .ws-theme-geometric.ws-page {
          background: white;
          border: 2.5px solid ${TC};
          border-radius: 0;
          box-shadow: 4px 4px 0 ${TC}22;
        }
        .ws-theme-geometric .ws-content {
          padding: 14mm 16mm 13mm;
        }
        /* No classic corner ornaments — replaced by the border frame */
        .ws-theme-geometric .ws-corner { display: none; }
        /* Watermark: very faint, rotated */
        .ws-theme-geometric .ws-watermark-word { opacity: 0.03; color: ${TC}; }
        /* Square number badges — geometric feel */
        .ws-theme-geometric .ws-q-num {
          border-radius: 3px;
          box-shadow: none;
          background: ${TC};
          width: 24px; height: 24px;
        }
        /* Questions: clean bottom-rule style, no left bar */
        .ws-theme-geometric .ws-q {
          border-${startSide}: 0;
          border-bottom: 1.5px solid ${TC}20;
          border-radius: 0;
          background: none;
          padding: 3mm 0 4mm;
          margin-bottom: 4mm;
        }
        .ws-theme-geometric .ws-q:last-child { border-bottom: 0; }
        /* Accent lines for fill/short answer */
        .ws-theme-geometric .ws-line { border-bottom-color: ${TC}44; }
        .ws-theme-geometric .ws-fill-rule { border-bottom-color: ${TC}; border-bottom-style: solid; }
        /* MCQ bullets: square */
        .ws-theme-geometric .ws-bubble {
          border-radius: 2px;
          border-color: ${TC}66;
        }
        /* Footer */
        .ws-theme-geometric .ws-footer { border-top-color: ${TC}44; }
        /* Match column items */
        .ws-theme-geometric .ws-match-col li { border-radius: 2px; border-color: ${TC}33; }
        /* Tabular header styles */
        .ws-tab-header { border-top: 3px solid ${TC}; border-bottom: 2px solid ${TC}; padding: 4mm 0; margin-bottom: 5mm; }
        .ws-tab-toprow {
          display: grid;
          grid-template-columns: 1fr 1.6fr 1fr;
          align-items: center;
          gap: 4mm;
          margin-bottom: 3mm;
        }
        .ws-tab-school {
          font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
          font-weight: 700;
          color: ${TC};
          line-height: 1.4;
        }
        .ws-tab-title {
          text-align: center;
          font-size: ${fontSizePt + 10}pt;
          font-weight: 900;
          color: ${TC};
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .ws-tab-meta {
          text-align: ${isAr ? "left" : "right"};
          font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
          color: ${TC}cc;
          font-weight: 600;
          line-height: 1.4;
        }
        .ws-tab-sub {
          display: inline-block;
          background: ${TC};
          color: white;
          font-size: ${Math.max(8, fontSizePt - 3)}pt;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 2px;
          margin-bottom: 2mm;
        }
        .ws-tab-inner-rule { height: 1px; background: ${TC}33; margin: 2mm 0; }
        /* Cont header */
        .ws-theme-geometric .ws-cont-header { border-bottom-color: ${TC}44; }
      `;
    },
  },

  // ── 2. Arabic Ink (Arabic Language) ────────────────────────────
  arabic_ink: {
    id: "arabic_ink",
    nameAr: "خط عربي",
    nameEn: "Arabic Ink",
    description: "أناقة كلاسيكية، خلفية كريمية، زخارف عربية",
    headerLayout: "arabesque",
    defaultColor: "#1B4D3E",
    swatchColors: ["#1B4D3E", "#C9972A"],
    headingFontOverride: `'Amiri', 'Scheherazade New', 'Cairo', serif`,
    css({ TC, GOLD, BG, fontSizePt, isAr, startSide }) {
      return `
        .ws-theme-arabic_ink.ws-page {
          background: ${BG};
          border: 1.5px solid ${TC}33;
          border-radius: 4px;
        }
        .ws-theme-arabic_ink .ws-content {
          padding: 16mm 18mm 14mm;
        }
        /* Double page border using content padding + inner rule */
        .ws-theme-arabic_ink.ws-page::before {
          content: '';
          position: absolute;
          inset: 5mm;
          border: 1px solid ${GOLD}55;
          pointer-events: none;
          z-index: 0;
          border-radius: 2px;
        }
        .ws-theme-arabic_ink .ws-corner { border-color: ${GOLD}; }
        /* Questions: right-side thick gold bar, no box, generous spacing */
        .ws-theme-arabic_ink .ws-q {
          border-${startSide}: 3.5px solid ${GOLD};
          background: none;
          border-radius: 0;
          padding: 3mm ${isAr ? "12px" : "4mm"} 4mm ${isAr ? "4mm" : "12px"};
          margin-bottom: 6mm;
        }
        /* Circle badge in teal */
        .ws-theme-arabic_ink .ws-q-num { background: ${TC}; box-shadow: 0 0 0 2px ${GOLD}55; }
        /* Larger question text for Arabic readability */
        .ws-theme-arabic_ink .ws-q-prompt {
          font-size: ${fontSizePt + 0.5}pt;
          line-height: 2;
          letter-spacing: 0.01em;
        }
        /* Answer lines */
        .ws-theme-arabic_ink .ws-line { border-bottom: 1px solid ${TC}33; height: 9mm; }
        .ws-theme-arabic_ink .ws-fill-rule { border-bottom-color: ${TC}66; }
        /* Footer */
        .ws-theme-arabic_ink .ws-footer { border-top: 1px solid ${GOLD}55; color: #4a3a28; }
        .ws-theme-arabic_ink .ws-footer-cheer { color: ${GOLD}; }
        /* Match */
        .ws-theme-arabic_ink .ws-match-col li { border-color: ${GOLD}33; border-radius: 3px; background: ${BG}; }
        /* Arabesque header CSS */
        .ws-arb-header { text-align: center; margin-bottom: 6mm; }
        .ws-arb-ornament {
          display: flex; align-items: center; justify-content: center;
          gap: 3mm; margin: 0 auto 3mm;
        }
        .ws-arb-ornament-line {
          flex: 1; height: 1.5px;
          background: linear-gradient(to ${isAr ? "left" : "right"}, transparent, ${GOLD}, transparent);
          max-width: 60mm;
        }
        .ws-arb-diamond {
          width: 8px; height: 8px;
          background: ${GOLD};
          transform: rotate(45deg);
          flex: 0 0 auto;
        }
        .ws-arb-diamond-sm {
          width: 5px; height: 5px;
          border: 1.5px solid ${GOLD};
          transform: rotate(45deg);
          flex: 0 0 auto;
        }
        .ws-arb-title {
          font-size: ${fontSizePt + 13}pt;
          font-weight: 700;
          color: ${TC};
          line-height: 1.3;
          letter-spacing: 0.03em;
          margin: 2mm 0;
        }
        .ws-arb-kicker {
          font-size: ${Math.max(9, fontSizePt - 1)}pt;
          color: ${GOLD};
          font-weight: 600;
          margin: 1mm 0 3mm;
        }
        .ws-arb-identity {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 4mm;
          margin-top: 4mm;
          padding-top: 3mm;
          border-top: 1px dotted ${TC}33;
        }
        .ws-arb-cell {
          display: flex; align-items: center; gap: 5px;
          font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
          font-weight: 600;
          color: ${TC};
        }
        .ws-arb-cell-label { color: ${TC}88; font-weight: 500; }
        .ws-cont-header { border-bottom-color: ${GOLD}55; }
      `;
    },
  },

  // ── 3. Modern Band (English / General) ─────────────────────────
  modern_band: {
    id: "modern_band",
    nameAr: "شريط عصري",
    nameEn: "Modern Band",
    description: "شريط لوني علوي، بطاقات بيضاء، تصميم ناشر حديث",
    headerLayout: "band",
    defaultColor: "#1D4ED8",
    swatchColors: ["#1D4ED8", "#ffffff"],
    css({ TC, GOLD, fontSizePt, isAr, startSide }) {
      return `
        .ws-theme-modern_band.ws-page {
          background: white;
          border-radius: 4px;
        }
        .ws-theme-modern_band .ws-content { padding: 0 0 13mm; }
        /* No corner ornaments */
        .ws-theme-modern_band .ws-corner { display: none; }
        /* Questions: floating card style */
        .ws-theme-modern_band .ws-q {
          border-${startSide}: 0;
          border-radius: 6px;
          border: 1px solid ${TC}18;
          box-shadow: 0 1px 4px ${TC}12;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
        }
        .ws-theme-modern_band .ws-q-num {
          background: ${TC};
          box-shadow: none;
          border-radius: 50%;
        }
        .ws-theme-modern_band .ws-line { border-bottom-color: ${TC}33; }
        .ws-theme-modern_band .ws-fill-rule { border-bottom-color: ${TC}55; }
        .ws-theme-modern_band .ws-bubble { border-color: ${TC}55; }
        .ws-theme-modern_band .ws-footer { border-top-color: ${TC}22; }
        .ws-theme-modern_band .ws-match-col li { border-color: ${TC}22; }
        /* Band header CSS — negative margins break out of ws-content padding */
        .ws-band-top {
          background: ${TC};
          padding: 8mm 18mm 6mm;
          margin: -18mm -18mm 5mm;
          position: relative;
          overflow: hidden;
        }
        .ws-band-top::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 60mm; height: 100%;
          background: white;
          opacity: 0.04;
          transform: skewX(${isAr ? "" : "-"}15deg) translateX(${isAr ? "-" : ""}10mm);
        }
        .ws-band-title {
          color: white;
          font-size: ${fontSizePt + 12}pt;
          font-weight: 800;
          margin: 0 0 2mm;
          line-height: 1.2;
          position: relative;
        }
        .ws-band-sub {
          color: rgba(255,255,255,0.8);
          font-size: ${Math.max(9, fontSizePt - 1)}pt;
          font-weight: 600;
          position: relative;
        }
        .ws-band-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 3mm;
          position: relative;
        }
        .ws-band-chip {
          background: rgba(255,255,255,0.2);
          color: white;
          font-size: ${Math.max(7.5, fontSizePt - 3.5)}pt;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .ws-band-body { padding: 0 18mm; }
        .ws-band-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin: 0 0 4mm;
        }
        .ws-band-instr {
          margin-bottom: 4mm;
          background: ${TC}08;
          border-${startSide}: 4px solid ${TC};
          padding: 6px 10px;
          font-size: ${Math.max(9, fontSizePt - 1)}pt;
          border-radius: 4px;
        }
        .ws-band-instr strong { color: ${TC}; margin-${startSide === "right" ? "left" : "right"}: 4px; }
        .ws-questions-band { padding: 0 18mm; }
        .ws-theme-modern_band .ws-questions { column-gap: 6mm; }
        .ws-theme-modern_band .ws-footer { padding: 5mm 18mm 0; border-top: 1px solid ${TC}22; }
        .ws-theme-modern_band .ws-cont-header { margin: 0 18mm 4mm; }
      `;
    },
  },

  // ── 4. Exam Paper (High School / Official) ──────────────────────
  exam_paper: {
    id: "exam_paper",
    nameAr: "ورقة امتحان",
    nameEn: "Exam Paper",
    description: "رسمي، جدول منظم، أسلوب امتحانات وزارية",
    headerLayout: "tabular",
    defaultColor: "#1A1A1A",
    swatchColors: ["#1A1A1A", "#888888"],
    css({ TC, GOLD, fontSizePt, isAr, startSide }) {
      return `
        .ws-theme-exam_paper.ws-page {
          background: white;
          border-radius: 0;
          border: none;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10);
        }
        .ws-theme-exam_paper .ws-content { padding: 15mm 18mm 14mm; }
        .ws-theme-exam_paper .ws-corner { display: none; }
        .ws-theme-exam_paper .ws-watermark-word { opacity: 0.025; color: ${TC}; }
        /* Questions: plain numbered list — no boxes */
        .ws-theme-exam_paper .ws-q {
          border-${startSide}: 0;
          background: none;
          border-radius: 0;
          padding: 3mm 0 3mm;
          margin-bottom: 3mm;
          border-bottom: 1px solid #1A1A1A18;
        }
        .ws-theme-exam_paper .ws-q:last-child { border-bottom: 0; }
        /* Plain text number badge */
        .ws-theme-exam_paper .ws-q-num {
          background: none;
          color: ${TC};
          border: 1.5px solid ${TC};
          border-radius: 0;
          width: 22px; height: 22px;
          font-weight: 900;
          box-shadow: none;
        }
        .ws-theme-exam_paper .ws-line { border-bottom: 1px solid #1A1A1A44; height: 8mm; }
        .ws-theme-exam_paper .ws-fill-rule { border-bottom: 2px solid ${TC}; }
        .ws-theme-exam_paper .ws-bubble { border-color: ${TC}66; }
        .ws-theme-exam_paper .ws-footer { border-top: 2px solid ${TC}22; }
        .ws-theme-exam_paper .ws-footer-cheer { color: ${TC}; }
        .ws-theme-exam_paper .ws-match-col li { border-color: ${TC}22; border-radius: 2px; }
        /* Exam tabular header */
        .ws-exam-header {
          border-top: 3px solid ${TC};
          padding: 3mm 0 4mm;
          border-bottom: 1px solid ${TC}33;
          margin-bottom: 5mm;
        }
        .ws-exam-toprow {
          display: grid;
          grid-template-columns: 1fr 1.8fr 1fr;
          align-items: center;
          gap: 3mm;
          margin-bottom: 3mm;
        }
        .ws-exam-school {
          font-size: ${Math.max(8, fontSizePt - 2.5)}pt;
          font-weight: 700;
          color: ${TC};
          line-height: 1.4;
        }
        .ws-exam-title {
          font-size: ${fontSizePt + 9}pt;
          font-weight: 900;
          color: ${TC};
          text-align: center;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .ws-exam-meta {
          text-align: ${isAr ? "left" : "right"};
          font-size: ${Math.max(8, fontSizePt - 2.5)}pt;
          color: ${TC}99;
          font-weight: 600;
          line-height: 1.5;
        }
        .ws-exam-divider { height: 1px; background: ${TC}22; margin: 2mm 0; }
        .ws-exam-fields-row {
          display: flex; gap: 6mm; align-items: center; flex-wrap: wrap;
          margin-top: 3mm;
          padding-top: 2mm;
          border-top: 1px solid ${TC}22;
        }
        .ws-exam-field {
          display: flex; align-items: center; gap: 5px;
          font-size: ${Math.max(9, fontSizePt - 1)}pt;
          font-weight: 700;
          color: ${TC};
          flex: 1;
          min-width: 50mm;
          border-bottom: 1.5px solid ${TC}55;
          padding-bottom: 3mm;
        }
        .ws-exam-field-rule { flex: 1; }
        .ws-theme-exam_paper .ws-cont-header { border-bottom-color: ${TC}44; }
      `;
    },
  },

  // ── 5. Kids Play (Kindergarten) ─────────────────────────────────
  kids_play: {
    id: "kids_play",
    nameAr: "مرح الأطفال",
    nameEn: "Kids Play",
    description: "ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",
    headerLayout: "playful",
    defaultColor: "#E84393",
    swatchColors: ["#E84393", "#FFC107"],
    css({ TC, GOLD, fontSizePt, isAr, startSide }) {
      const SECOND = "#2196F3";
      const THIRD = "#4CAF50";
      return `
        .ws-theme-kids_play.ws-page {
          background: #FFFBF0;
          border: 3px dashed ${TC};
          border-radius: 16px;
          box-shadow: 0 4px 20px ${TC}22;
        }
        .ws-theme-kids_play .ws-content { padding: 14mm 16mm 14mm; }
        .ws-theme-kids_play .ws-corner { display: none; }
        .ws-theme-kids_play .ws-watermark-word { opacity: 0.04; color: ${GOLD}; }
        /* Large rounded question cards */
        .ws-theme-kids_play .ws-q {
          border-${startSide}: 0;
          border-radius: 12px;
          border: 2.5px solid ${TC}33;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
          box-shadow: 0 2px 6px ${TC}14;
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+1) { border-color: ${TC}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) { border-color: ${SECOND}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${THIRD}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12, fontSizePt + 1)}pt;
          background: ${TC};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${SECOND}; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) .ws-q-num { background: ${THIRD}; }
        /* Large text throughout */
        .ws-theme-kids_play .ws-q-prompt {
          font-size: ${fontSizePt + 1.5}pt;
          line-height: 2;
          font-weight: 700;
        }
        .ws-theme-kids_play .ws-line { height: 10mm; border-bottom: 2px dotted ${TC}44; }
        .ws-theme-kids_play .ws-fill-rule { border-bottom: 3px dashed ${TC}; }
        .ws-theme-kids_play .ws-bubble { width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${TC}88; }
        .ws-theme-kids_play .ws-footer { border-top: 2px dashed ${TC}44; }
        .ws-theme-kids_play .ws-footer-cheer { color: ${TC}; font-size: ${fontSizePt + 2}pt; }
        .ws-theme-kids_play .ws-match-col li { border-radius: 8px; border: 2px solid ${GOLD}55; }
        /* Playful header CSS */
        .ws-play-header { text-align: center; margin-bottom: 6mm; }
        .ws-play-banner {
          background: linear-gradient(135deg, ${TC} 0%, ${TC}cc 100%);
          border-radius: 12px 12px 12px 12px;
          padding: 6mm 18mm;
          margin: -16mm -18mm 5mm;
          position: relative;
          overflow: hidden;
        }
        .ws-play-banner::before {
          content: '★   ☆   ★   ☆   ★   ☆   ★   ☆   ★';
          position: absolute;
          top: 2mm; left: 0; right: 0;
          text-align: center;
          font-size: 7pt;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.3em;
        }
        .ws-play-title {
          color: white;
          font-size: ${fontSizePt + 14}pt;
          font-weight: 900;
          margin: 0;
          line-height: 1.2;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
        }
        .ws-play-sub {
          color: rgba(255,255,255,0.85);
          font-size: ${fontSizePt + 1}pt;
          font-weight: 700;
          margin-top: 2mm;
          position: relative;
        }
        .ws-play-stars {
          color: ${GOLD};
          font-size: 16pt;
          letter-spacing: 5px;
          margin-bottom: 2mm;
          position: relative;
        }
        .ws-play-chips {
          display: flex; flex-wrap: wrap; gap: 5px;
          justify-content: center; margin-top: 2mm;
          position: relative;
        }
        .ws-play-chip {
          background: rgba(255,255,255,0.25);
          color: white;
          font-size: ${Math.max(8, fontSizePt - 2)}pt;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 999px;
        }
        .ws-play-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-bottom: 4mm;
        }
        .ws-play-field {
          display: flex; align-items: center; gap: 5px;
          border-bottom: 2px dashed ${TC}55;
          padding-bottom: 4mm;
          font-size: ${fontSizePt + 0.5}pt;
          font-weight: 700;
          color: ${TC};
        }
        .ws-play-field-rule { flex: 1; }
        .ws-theme-kids_play .ws-cont-header { border-bottom: 2px dashed ${TC}44; }
      `;
    },
  },

  // ── 6. Science Lab ──────────────────────────────────────────────
  science_lab: {
    id: "science_lab",
    nameAr: "مختبر علوم",
    nameEn: "Science Lab",
    description: "ورق مربعات خفيف، شارة المادة، أسلوب مفكرة العالم",
    headerLayout: "clipboard",
    defaultColor: "#0A6B6B",
    swatchColors: ["#0A6B6B", "#4FC3F7"],
    css({ TC, GOLD, fontSizePt, isAr, startSide }) {
      const ACCENT2 = "#4FC3F7";
      return `
        .ws-theme-science_lab.ws-page {
          background: white;
          /* Graph-paper grid watermark via CSS gradients */
          background-image:
            linear-gradient(${TC}09 1px, transparent 1px),
            linear-gradient(90deg, ${TC}09 1px, transparent 1px);
          background-size: 6mm 6mm;
          border: 1.5px solid ${TC}44;
          border-radius: 3px;
          border-${startSide}: 4mm solid ${TC};
          box-shadow: 0 3px 14px ${TC}18;
        }
        .ws-theme-science_lab .ws-content { padding: 14mm 16mm 13mm; }
        .ws-theme-science_lab .ws-corner { display: none; }
        .ws-theme-science_lab .ws-watermark-word { opacity: 0.03; }
        /* Lab-notebook question boxes */
        .ws-theme-science_lab .ws-q {
          border-${startSide}: 0;
          border: 1.5px solid ${TC}33;
          border-radius: 3px;
          background: rgba(255,255,255,0.85);
          padding: 3mm 4mm;
          margin-bottom: 5mm;
          box-shadow: 1px 1px 0 ${TC}18;
        }
        /* Hexagonal-ish number badges — just square with slight clip */
        .ws-theme-science_lab .ws-q-num {
          border-radius: 4px;
          background: ${TC};
          box-shadow: none;
          width: 24px; height: 24px;
        }
        .ws-theme-science_lab .ws-line { border-bottom: 1px solid ${TC}33; height: 8mm; }
        .ws-theme-science_lab .ws-fill-rule { border-bottom: 2px solid ${TC}; }
        .ws-theme-science_lab .ws-bubble { border-radius: 3px; border-color: ${TC}66; }
        .ws-theme-science_lab .ws-footer { border-top: 1px solid ${TC}33; background: rgba(255,255,255,0.7); padding-top: 4mm; }
        .ws-theme-science_lab .ws-match-col li { border-color: ${TC}33; border-radius: 2px; background: rgba(255,255,255,0.9); }
        /* Clipboard / tab header */
        .ws-clip-header { margin-bottom: 6mm; }
        .ws-clip-badges {
          display: flex; gap: 3mm; align-items: center; margin-bottom: 4mm;
          flex-wrap: wrap;
        }
        .ws-clip-badge {
          background: ${TC};
          color: white;
          font-size: ${Math.max(8, fontSizePt - 2.5)}pt;
          font-weight: 700;
          padding: 3px 10px 3px 8px;
          border-radius: 3px 3px 0 0;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .ws-clip-badge-sec {
          background: ${ACCENT2};
          color: #003344;
          font-size: ${Math.max(8, fontSizePt - 2.5)}pt;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 3px 3px 0 0;
        }
        .ws-clip-title-row {
          display: flex; align-items: baseline; gap: 4mm;
          border-bottom: 3px solid ${TC};
          padding-bottom: 3mm;
          margin-bottom: 4mm;
        }
        .ws-clip-title {
          font-size: ${fontSizePt + 10}pt;
          font-weight: 900;
          color: ${TC};
          margin: 0;
          line-height: 1.2;
          flex: 1;
        }
        .ws-clip-identity {
          display: flex; flex-direction: column; gap: 2mm;
          font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
        }
        .ws-clip-id-row {
          display: flex; gap: 4px; align-items: center;
          font-weight: 600; color: ${TC}cc;
        }
        .ws-clip-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-bottom: 3mm;
        }
        .ws-theme-science_lab .ws-cont-header { border-bottom: 2px solid ${TC}33; }
      `;
    },
  },

  // ── 7. Editorial (Literature / History / Islamic) ───────────────
  editorial: {
    id: "editorial",
    nameAr: "أسلوب تحريري",
    nameEn: "Editorial",
    description: "رأسية صحفية، خط سيريف، لإسلاميات والأدب والتاريخ",
    headerLayout: "masthead",
    defaultColor: "#4A1042",
    swatchColors: ["#4A1042", "#C8952A"],
    headingFontOverride: `'Amiri', 'Georgia', 'Times New Roman', serif`,
    css({ TC, GOLD, BG, fontSizePt, isAr, startSide }) {
      return `
        .ws-theme-editorial.ws-page {
          background: ${BG};
          border: none;
          border-top: 4px solid ${TC};
          border-bottom: 4px solid ${TC};
          border-radius: 0;
          box-shadow: 0 2px 16px rgba(74,16,66,0.10);
        }
        .ws-theme-editorial .ws-content { padding: 15mm 18mm 14mm; }
        .ws-theme-editorial .ws-corner { display: none; }
        /* Questions: editorial paragraph style */
        .ws-theme-editorial .ws-q {
          border-${startSide}: 0;
          background: none;
          border-radius: 0;
          border-bottom: 1px solid ${TC}1a;
          padding: 3mm 0 4mm;
          margin-bottom: 4mm;
        }
        .ws-theme-editorial .ws-q:last-child { border-bottom: 0; }
        /* Drop-cap style number — italic serif */
        .ws-theme-editorial .ws-q-num {
          background: none;
          color: ${TC};
          border: 0;
          font-style: italic;
          font-size: ${fontSizePt + 5}pt;
          font-weight: 700;
          width: auto;
          height: auto;
          box-shadow: none;
          border-radius: 0;
          line-height: 1;
          min-width: 20px;
          padding: 0 3px;
        }
        .ws-theme-editorial .ws-q-prompt {
          font-size: ${fontSizePt + 0.5}pt;
          line-height: 2;
          color: #1a1010;
        }
        .ws-theme-editorial .ws-line { border-bottom: 1px solid ${TC}33; height: 9mm; }
        .ws-theme-editorial .ws-fill-rule { border-bottom: 1.5px solid ${TC}; }
        .ws-theme-editorial .ws-bubble { border-color: ${TC}55; }
        .ws-theme-editorial .ws-footer { border-top: 1px solid ${TC}33; }
        .ws-theme-editorial .ws-footer-cheer { color: ${TC}; font-style: italic; }
        .ws-theme-editorial .ws-match-col li { border-color: ${TC}22; background: ${BG}; }
        /* Masthead header */
        .ws-mast-header { text-align: center; margin-bottom: 6mm; }
        .ws-mast-rule-thick {
          height: 4px; background: ${TC};
          margin-bottom: 1.5mm;
        }
        .ws-mast-rule-mid {
          height: 1.5px; background: ${TC};
          margin-bottom: 3mm;
        }
        .ws-mast-title {
          font-size: ${fontSizePt + 13}pt;
          font-weight: 700;
          color: ${TC};
          margin: 0 0 2mm;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .ws-mast-meta {
          font-size: ${Math.max(9, fontSizePt - 1)}pt;
          color: ${TC}99;
          font-weight: 600;
          letter-spacing: 0.04em;
          margin-bottom: 3mm;
        }
        .ws-mast-rule-thin {
          height: 1px; background: ${TC}44;
          margin: 3mm 0;
        }
        .ws-mast-identity {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 6mm;
          font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
          color: ${TC}cc;
          font-weight: 600;
        }
        .ws-mast-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-top: 4mm;
        }
        .ws-theme-editorial .ws-cont-header { border-bottom: 1px solid ${TC}44; }
      `;
    },
  },
};

// ─── Theme selection logic ────────────────────────────────────────

const LAST_THEME_KEY = "ws_last_theme";

/** Load the last-used theme from localStorage (safe for SSR). */
export function getLastTheme(): ThemeId | null {
  try { return (localStorage.getItem(LAST_THEME_KEY) as ThemeId) ?? null; }
  catch { return null; }
}

/** Persist the last-used theme. */
export function setLastTheme(id: ThemeId) {
  try { localStorage.setItem(LAST_THEME_KEY, id); } catch { /* ignore */ }
}

/**
 * Pick the most appropriate theme for a worksheet.
 * Never returns the same ID as `lastThemeId` unless there is no other
 * viable option (i.e. only one theme matches the subject).
 */
export function selectTheme(
  subject: string | null,
  gradeLevel: string | null,
  _language: "ar" | "en",
  questionCount: number,
  lastThemeId?: ThemeId | null,
): ThemeId {
  const s = (subject ?? "").trim().toLowerCase();
  const g = (gradeLevel ?? "").trim().toLowerCase();

  // ── Kindergarten / Grade 1-2 ──
  if (/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(g)) {
    return "kids_play";
  }

  // ── Subject-based primary match ──
  const subjectMap: [RegExp, ThemeId][] = [
    [/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/, "geometric"],
    [/فيزياء|physics/, "science_lab"],
    [/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/, "science_lab"],
    [/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/, "arabic_ink"],
    [/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/, "editorial"],
    [/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/, "modern_band"],
    [/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/, "editorial"],
    [/أدب|literature|poetry|قصة|رواية|شعر|نثر/, "editorial"],
    [/تقنية|حاسوب|حاسب|technology|computer|ict/, "modern_band"],
  ];

  for (const [re, themeId] of subjectMap) {
    if (re.test(s)) {
      // Avoid consecutive repeat by choosing the runner-up
      if (themeId === lastThemeId) {
        // Return a sensible alternative
        const alts: Record<ThemeId, ThemeId> = {
          geometric: "science_lab",
          science_lab: "geometric",
          arabic_ink: "editorial",
          editorial: "arabic_ink",
          modern_band: "exam_paper",
          exam_paper: "modern_band",
          kids_play: "modern_band",
        };
        return alts[themeId];
      }
      return themeId;
    }
  }

  // ── High school (grades 10-12) → exam_paper or editorial ──
  if (/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(g)) {
    const opts: ThemeId[] = ["exam_paper", "editorial", "modern_band"];
    const available = opts.filter(t => t !== lastThemeId);
    return available[questionCount % available.length];
  }

  // ── General — rotate through the non-specialised themes ──
  const general: ThemeId[] = ["geometric", "modern_band", "editorial", "exam_paper", "science_lab"];
  const available = general.filter(t => t !== lastThemeId);
  // Use questionCount as a deterministic but varied seed
  return available[questionCount % available.length];
}

// ─── Page background per theme ───────────────────────────────────

export const THEME_BACKGROUNDS: Record<ThemeId, string> = {
  geometric:    "white",
  arabic_ink:   "#FDFAF4",
  modern_band:  "white",
  exam_paper:   "white",
  kids_play:    "#FFFBF0",
  science_lab:  "white",
  editorial:    "#FDF8F5",
};

// ─── Header layout renderers ─────────────────────────────────────

export function TabularHeader({ data, labels, TC, ar, hasIdentity, customFields }: HeaderProps & { fontSize?: number }) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const identityLines = [
    data.settings.schoolName,
    data.settings.teacherName && `${labels.teacher}: ${data.settings.teacherName}`,
    data.settings.section && `${labels.section}: ${data.settings.section}`,
    ...customFields.map(f => `${f.label}: ${f.value}`),
  ].filter(Boolean);

  return (
    <div className="ws-tab-header">
      {data.settings.logoUrl && (
        <div className="ws-logo-wrap" style={{ marginBottom: "3mm", justifyContent: ar ? "flex-end" : "flex-start" }}>
          <img src={data.settings.logoUrl} alt="" className="ws-logo-img" />
        </div>
      )}
      <div className="ws-tab-toprow">
        <div className={ar ? "" : ""} style={{ textAlign: ar ? "right" : "left" }}>
          {identityLines.map((l, i) => (
            <div key={i} className="ws-tab-school">{l}</div>
          ))}
        </div>
        <h1 className="ws-tab-title" lang={data.language}>{data.title}</h1>
        <div className="ws-tab-meta">
          {meta && <div>{meta}</div>}
        </div>
      </div>
      <div className="ws-tab-inner-rule" />
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <TabularFields data={data} labels={labels} TC={TC} />
      )}
      {data.settings.headerNote && (
        <p style={{ textAlign: "center", fontSize: "90%", color: "#555", margin: "2mm 0 0", fontStyle: "italic" }}>
          {data.settings.headerNote}
        </p>
      )}
      {data.settings.instructions && (
        <div style={{ marginTop: "3mm", padding: "5px 10px", background: `${TC}08`, borderInlineStart: `4px solid ${TC}`, fontSize: "90%", lineHeight: 1.6 }}>
          <strong style={{ color: TC, marginInlineEnd: "4px" }}>{labels.instructions}:</strong>
          {data.settings.instructions}
        </div>
      )}
    </div>
  );
}

// Tabular field line
function TabularFields({ data, labels, TC }: Pick<HeaderProps, "data" | "labels" | "TC">) {
  const fields = [
    data.settings.includeName && { label: labels.name, flex: 2 },
    data.settings.includeClass && { label: labels.clazz, flex: 1 },
    data.settings.includeDate && { label: labels.date, flex: 1 },
  ].filter(Boolean) as Array<{ label: string; flex: number }>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: fields.map(f => `${f.flex}fr`).join(" "), gap: "5mm", marginTop: "3mm" }}>
      {fields.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px", borderBottom: `1.5px solid ${TC}55`, paddingBottom: "3mm", fontWeight: 700, color: TC, fontSize: "90%" }}>
          {f.label}
          <span style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}

export function ArabesqueHeader({ data, labels, TC, GOLD, ar, hasIdentity, customFields }: HeaderProps) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const identityItems = [
    data.settings.schoolName && { label: labels.school, value: data.settings.schoolName },
    data.settings.teacherName && { label: labels.teacher, value: data.settings.teacherName },
    data.settings.section && { label: labels.section, value: data.settings.section },
    ...customFields.map(f => ({ label: f.label.trim(), value: f.value })),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="ws-arb-header">
      {data.settings.logoUrl && (
        <div className="ws-logo-wrap" style={{ marginBottom: "4mm" }}>
          <img src={data.settings.logoUrl} alt="" className="ws-logo-img" />
        </div>
      )}
      <ArabesqueOrnament GOLD={GOLD} />
      {meta && <div className="ws-arb-kicker">{meta}</div>}
      <h1 className="ws-arb-title" lang={data.language}>{data.title}</h1>
      <ArabesqueOrnament GOLD={GOLD} />
      {identityItems.length > 0 && (
        <div className="ws-arb-identity">
          {identityItems.map((item, i) => (
            <div key={i} className="ws-arb-cell">
              <span className="ws-arb-cell-label">{item.label}:</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "5mm", marginTop: "4mm" }}>
          {data.settings.includeName && <ArbField label={labels.name} TC={TC} GOLD={GOLD} />}
          {data.settings.includeClass && <ArbField label={labels.clazz} TC={TC} GOLD={GOLD} />}
          {data.settings.includeDate && <ArbField label={labels.date} TC={TC} GOLD={GOLD} />}
        </div>
      )}
      {data.settings.headerNote && (
        <p style={{ textAlign: "center", fontSize: "90%", color: "#6a5c3a", margin: "3mm 0 0", fontStyle: "italic" }}>
          {data.settings.headerNote}
        </p>
      )}
      {data.settings.instructions && (
        <div style={{ marginTop: "3mm", padding: "5px 10px", background: `${GOLD}12`, borderInlineStart: `4px solid ${GOLD}`, fontSize: "90%", lineHeight: 1.7, borderRadius: "4px" }}>
          <strong style={{ color: TC, marginInlineEnd: "4px" }}>{labels.instructions}:</strong>
          {data.settings.instructions}
        </div>
      )}
    </div>
  );
}

function ArabesqueOrnament({ GOLD }: { GOLD: string }) {
  return (
    <div className="ws-arb-ornament">
      <div className="ws-arb-ornament-line" />
      <div className="ws-arb-diamond-sm" style={{ background: GOLD, borderColor: GOLD }} />
      <div className="ws-arb-diamond" style={{ background: GOLD }} />
      <div className="ws-arb-diamond-sm" style={{ background: GOLD, borderColor: GOLD }} />
      <div className="ws-arb-ornament-line" />
    </div>
  );
}

function ArbField({ label, TC, GOLD }: { label: string; TC: string; GOLD: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", borderBottom: `1px dashed ${GOLD}88`, paddingBottom: "3mm", fontWeight: 700, color: TC, fontSize: "90%" }}>
      {label}<span style={{ flex: 1 }} />
    </div>
  );
}

export function BandHeader({ data, labels, TC, GOLD, ar, hasIdentity, customFields }: HeaderProps) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const chips = [
    data.settings.schoolName,
    data.settings.teacherName && `${labels.teacher}: ${data.settings.teacherName}`,
    data.settings.section && `${labels.section}: ${data.settings.section}`,
    ...customFields.map(f => `${f.label}: ${f.value}`),
  ].filter(Boolean);

  return (
    <div className="ws-band-header">
      <div className="ws-band-top">
        {data.settings.logoUrl && (
          <div style={{ position: "absolute", top: "4mm", [ar ? "left" : "right"]: "16mm" }}>
            <img src={data.settings.logoUrl} alt="" style={{ height: "12mm", width: "auto", objectFit: "contain", filter: "brightness(10)" }} />
          </div>
        )}
        {chips.length > 0 && (
          <div className="ws-band-chips">
            {chips.map((c, i) => <span key={i} className="ws-band-chip">{c}</span>)}
          </div>
        )}
        <h1 className="ws-band-title" lang={data.language}>{data.title}</h1>
        {meta && <div className="ws-band-sub">{meta}</div>}
      </div>
      <div className="ws-band-body">
        {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
          <div className="ws-band-fields">
            {data.settings.includeName && <BandField label={labels.name} TC={TC} flex={2} />}
            {data.settings.includeClass && <BandField label={labels.clazz} TC={TC} flex={1} />}
            {data.settings.includeDate && <BandField label={labels.date} TC={TC} flex={1} />}
          </div>
        )}
        {data.settings.headerNote && (
          <p style={{ fontSize: "90%", color: "#555", margin: "0 0 3mm", fontStyle: "italic" }}>
            {data.settings.headerNote}
          </p>
        )}
        {data.settings.instructions && (
          <div className="ws-band-instr">
            <strong>{labels.instructions}:</strong> {data.settings.instructions}
          </div>
        )}
      </div>
    </div>
  );
}

function BandField({ label, TC, flex }: { label: string; TC: string; flex: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", borderBottom: `1.5px solid ${TC}44`, paddingBottom: "3mm", fontWeight: 700, color: TC, fontSize: "90%", flex }}>
      {label}<span style={{ flex: 1 }} />
    </div>
  );
}

export function PlayfulHeader({ data, labels, TC, GOLD, ar, hasIdentity, customFields }: HeaderProps) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const chips = [
    data.settings.schoolName,
    data.settings.teacherName,
    data.settings.section,
    ...customFields.map(f => f.value),
  ].filter(Boolean);

  return (
    <div className="ws-play-header">
      <div className="ws-play-banner">
        <div className="ws-play-stars">★ ☆ ★</div>
        <h1 className="ws-play-title" lang={data.language}>{data.title}</h1>
        {meta && <div className="ws-play-sub">{meta}</div>}
        {chips.length > 0 && (
          <div className="ws-play-chips">
            {chips.map((c, i) => <span key={i} className="ws-play-chip">{c}</span>)}
          </div>
        )}
      </div>
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div className="ws-play-fields">
          {data.settings.includeName && <PlayField label={labels.name} TC={TC} />}
          {data.settings.includeClass && <PlayField label={labels.clazz} TC={TC} />}
          {data.settings.includeDate && <PlayField label={labels.date} TC={TC} />}
        </div>
      )}
      {data.settings.headerNote && (
        <p style={{ textAlign: "center", fontWeight: 700, color: TC, margin: "2mm 0", fontSize: "105%" }}>
          {data.settings.headerNote}
        </p>
      )}
      {data.settings.instructions && (
        <div style={{ background: `${TC}12`, borderRadius: "10px", padding: "6px 12px", fontSize: "95%", fontWeight: 700, color: TC, marginBottom: "4mm" }}>
          ⭐ {data.settings.instructions}
        </div>
      )}
    </div>
  );
}

function PlayField({ label, TC }: { label: string; TC: string }) {
  return (
    <div className="ws-play-field">
      {label}<span className="ws-play-field-rule" />
    </div>
  );
}

export function ClipboardHeader({ data, labels, TC, GOLD, ar, hasIdentity, customFields }: HeaderProps) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const identityLines = [
    data.settings.schoolName && `${labels.school}: ${data.settings.schoolName}`,
    data.settings.teacherName && `${labels.teacher}: ${data.settings.teacherName}`,
    data.settings.section && `${labels.section}: ${data.settings.section}`,
    ...customFields.map(f => `${f.label}: ${f.value}`),
  ].filter(Boolean);

  return (
    <div className="ws-clip-header">
      <div className="ws-clip-badges">
        {data.settings.logoUrl && (
          <img src={data.settings.logoUrl} alt="" style={{ height: "10mm", width: "auto", objectFit: "contain" }} />
        )}
        {data.subject && <span className="ws-clip-badge">{data.subject}</span>}
        {data.gradeLevel && <span className="ws-clip-badge-sec">{data.gradeLevel}</span>}
      </div>
      <div className="ws-clip-title-row">
        <h1 className="ws-clip-title" lang={data.language}>{data.title}</h1>
        {identityLines.length > 0 && (
          <div className="ws-clip-identity">
            {identityLines.map((l, i) => <div key={i} className="ws-clip-id-row">{l}</div>)}
          </div>
        )}
      </div>
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div className="ws-clip-fields">
          {data.settings.includeName && <ClipField label={labels.name} TC={TC} />}
          {data.settings.includeClass && <ClipField label={labels.clazz} TC={TC} />}
          {data.settings.includeDate && <ClipField label={labels.date} TC={TC} />}
        </div>
      )}
      {data.settings.headerNote && (
        <p style={{ fontSize: "88%", color: "#4a7a7a", margin: "2mm 0 0" }}>{data.settings.headerNote}</p>
      )}
      {data.settings.instructions && (
        <div style={{ marginTop: "3mm", padding: "4px 9px", background: `${TC}08`, border: `1.5px solid ${TC}33`, borderRadius: "3px", fontSize: "88%", lineHeight: 1.6 }}>
          <strong style={{ color: TC, marginInlineEnd: "4px" }}>{labels.instructions}:</strong>
          {data.settings.instructions}
        </div>
      )}
    </div>
  );
}

function ClipField({ label, TC }: { label: string; TC: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", borderBottom: `1.5px solid ${TC}55`, paddingBottom: "3mm", fontWeight: 700, color: TC, fontSize: "88%" }}>
      {label}<span style={{ flex: 1 }} />
    </div>
  );
}

export function MastheadHeader({ data, labels, TC, GOLD, ar, hasIdentity, customFields }: HeaderProps) {
  const meta = [data.subject, data.gradeLevel].filter(Boolean).join(" · ");
  const identityParts = [
    data.settings.schoolName,
    data.settings.teacherName && `${labels.teacher}: ${data.settings.teacherName}`,
    data.settings.section && `${labels.section}: ${data.settings.section}`,
    ...customFields.map(f => `${f.label}: ${f.value}`),
  ].filter(Boolean);

  return (
    <div className="ws-mast-header">
      <div className="ws-mast-rule-thick" />
      <div className="ws-mast-rule-mid" />
      {data.settings.logoUrl && (
        <div className="ws-logo-wrap" style={{ margin: "2mm auto" }}>
          <img src={data.settings.logoUrl} alt="" className="ws-logo-img" />
        </div>
      )}
      <h1 className="ws-mast-title" lang={data.language}>{data.title}</h1>
      {meta && <div className="ws-mast-meta">{meta}</div>}
      {identityParts.length > 0 && (
        <div className="ws-mast-identity">
          {identityParts.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      )}
      <div className="ws-mast-rule-thin" />
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div className="ws-mast-fields">
          {data.settings.includeName && <MastField label={labels.name} TC={TC} GOLD={GOLD} />}
          {data.settings.includeClass && <MastField label={labels.clazz} TC={TC} GOLD={GOLD} />}
          {data.settings.includeDate && <MastField label={labels.date} TC={TC} GOLD={GOLD} />}
        </div>
      )}
      {data.settings.headerNote && (
        <p style={{ textAlign: "center", fontSize: "88%", color: "#6a4a5a", margin: "2mm 0 0", fontStyle: "italic" }}>
          {data.settings.headerNote}
        </p>
      )}
      {data.settings.instructions && (
        <div style={{ marginTop: "3mm", padding: "5px 10px", background: `${TC}08`, borderInlineStart: `3px solid ${GOLD}`, fontSize: "88%", lineHeight: 1.7 }}>
          <strong style={{ color: TC, marginInlineEnd: "4px" }}>{labels.instructions}:</strong>
          {data.settings.instructions}
        </div>
      )}
    </div>
  );
}

function MastField({ label, TC, GOLD }: { label: string; TC: string; GOLD: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", borderBottom: `1px solid ${TC}44`, paddingBottom: "3mm", fontWeight: 700, color: TC, fontSize: "88%" }}>
      {label}<span style={{ flex: 1 }} />
    </div>
  );
}

// ─── Helper to resolve heading font for a theme ───────────────────

export function resolveThemeHeadingFont(themeId: ThemeId | undefined, baseLangFont: string): string {
  if (!themeId) return baseLangFont;
  const override = THEMES[themeId]?.headingFontOverride;
  return override ?? baseLangFont;
}
