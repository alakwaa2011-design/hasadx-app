import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Printer, ArrowLeft, Edit3, FileType } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { downloadAsWord, printToPdf } from "@/lib/print-export";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

interface QMcq { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
interface QTF { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
interface QShort { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number }
interface QFill { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
interface QMatch { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
export type Question = QMcq | QTF | QShort | QFill | QMatch;

export type FontFamily = "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia";

export interface CustomField { label: string; value: string }

export interface Settings {
  instructions?: string;
  includeName: boolean;
  includeDate: boolean;
  includeClass: boolean;
  includeAnswerKey: boolean;
  columns: 1 | 2;
  headerNote?: string;
  footerNote?: string;
  schoolName?: string;
  section?: string;
  teacherName?: string;
  /** Optional teacher-defined extra header fields (label + value). */
  customFields?: CustomField[];
  fontFamily?: FontFamily;
  fontSizePt?: number;
  showWatermark?: boolean;
  /** Custom accent color (hex). Defaults to Hasaad green. */
  themeColor?: string;
  /** Base64 or URL of school logo — shown in the header identity panel. */
  logoUrl?: string;
}

export interface WorksheetData {
  id: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  questions: Question[];
  settings: Settings;
  ownerName?: string | null;
  isOwner?: boolean;
}

// Resolve a font-family CSS string from the teacher's selection, with
// language-appropriate fallbacks so a missing font still looks reasonable.
function resolveFont(fam: FontFamily | undefined, lang: "ar" | "en"): string {
  const arFallback = `'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif`;
  const enFallback = `'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif`;
  switch (fam) {
    case "cairo": return `'Cairo', ${arFallback}`;
    case "tajawal": return `'Tajawal', ${arFallback}`;
    case "amiri": return `'Amiri', 'Scheherazade New', ${arFallback}`;
    case "noto-naskh": return `'Noto Naskh Arabic', ${arFallback}`;
    case "inter": return `'Inter', ${enFallback}`;
    case "georgia": return `Georgia, 'Times New Roman', serif`;
    default:
      return lang === "ar" ? arFallback : enFallback;
  }
}

// Heading font is chosen separately so titles always look professional
// (Cairo for Arabic — the standard for official worksheets and exams,
//  Inter for Latin) regardless of the body font.
function resolveHeadingFont(lang: "ar" | "en"): string {
  return lang === "ar"
    ? `'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif`
    : `'Inter', 'Source Sans Pro', sans-serif`;
}

// ─────────────────────────────────────────────────────────────────
// Pagination helper — splits questions across A4 pages by estimating
// their rendered height in mm. Refined via measurement after render.
// ─────────────────────────────────────────────────────────────────
function paginateByEstimate(
  questions: Question[],
  fontSizePt: number,
  columns: 1 | 2,
  firstPageAvailMm: number,
  otherPageAvailMm: number,
): Question[][] {
  if (questions.length === 0) return [[]];
  const lineH = fontSizePt * 0.352778 * 1.85; // pt → mm
  const chars = columns === 2 ? 22 : 44;
  const GAP = 5;
  const est = (q: Question): number => {
    const promptLines = Math.max(1, Math.ceil((q.prompt?.length ?? 0) / chars));
    const base = 10 + promptLines * lineH;
    switch (q.type) {
      case "mcq": return base + q.options.filter(Boolean).length * lineH * 1.3;
      case "true_false": return base + lineH * 1.1;
      case "short_answer": return base + (q.lines ?? 2) * 9;
      case "fill_blank": return base + 3;
      case "matching": return base + q.pairs.length * lineH * 1.3;
    }
  };
  const pages: Question[][] = [];
  let page: Question[] = [];
  let used = 0;
  let limit = firstPageAvailMm;
  if (columns === 2) {
    for (let i = 0; i < questions.length; i += 2) {
      const h = Math.max(est(questions[i]), i + 1 < questions.length ? est(questions[i + 1]) : 0) + GAP;
      if (page.length > 0 && used + h > limit) { pages.push(page); page = []; used = 0; limit = otherPageAvailMm; }
      page.push(questions[i]);
      if (i + 1 < questions.length) page.push(questions[i + 1]);
      used += h;
    }
  } else {
    for (const q of questions) {
      const h = est(q) + GAP;
      if (page.length > 0 && used + h > limit) { pages.push(page); page = []; used = 0; limit = otherPageAvailMm; }
      page.push(q);
      used += h;
    }
  }
  if (page.length > 0) pages.push(page);
  return pages.length > 0 ? pages : [questions];
}

/**
 * Reusable printable view. Supports automatic A4 pagination, custom
 * theme color, and school logo in the header. The wrapper element gets
 * id `ws-printable-root` so the Word exporter can grab the right subtree.
 */
export function WorksheetPrintView({ data }: { data: WorksheetData }) {
  const ar = data.language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const fontFamily = resolveFont(data.settings.fontFamily, data.language);
  const headingFont = resolveHeadingFont(data.language);
  const fontSizePt = Math.min(18, Math.max(9, data.settings.fontSizePt ?? 12));
  const showWatermark = data.settings.showWatermark !== false;
  const themeColor = data.settings.themeColor ?? BRAND_PRIMARY;
  const logoUrl = data.settings.logoUrl;

  const labels = ar
    ? { name: "الاسم", date: "التاريخ", clazz: "الصف", section: "القسم", school: "المدرسة", teacher: "المعلم", instructions: "تعليمات", answerKey: "صفحة الإجابات", question: "س", true: "صح", false: "خطأ", correct: "الإجابة:", goodLuck: "نتمنى لك التوفيق ✦" }
    : { name: "Name", date: "Date", clazz: "Class", section: "Section", school: "School", teacher: "Teacher", instructions: "Instructions", answerKey: "Answer Key", question: "Q", true: "True", false: "False", correct: "Answer:", goodLuck: "✦ Good luck!" };

  const customFields = (data.settings.customFields ?? []).filter(
    f => (f?.label?.trim() ?? "") || (f?.value?.trim() ?? ""),
  );
  const hasIdentity =
    !!data.settings.schoolName ||
    !!data.settings.section ||
    !!data.settings.teacherName ||
    !!logoUrl ||
    customFields.length > 0;

  // ── Pagination state (estimate first, refined by measurement) ──
  const cols = data.settings.columns;
  const [pages, setPages] = useState<Question[][]>(() =>
    paginateByEstimate(data.questions, fontSizePt, cols, 190, 250),
  );
  const measureRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef("");

  // After each render, measure actual heights and re-paginate
  useLayoutEffect(() => {
    const key = [
      data.questions.map(q => q.id).join(","),
      cols, fontSizePt,
      data.settings.schoolName ?? "", data.settings.section ?? "",
      data.settings.teacherName ?? "", logoUrl ? "logo" : "",
      data.settings.includeName ? "n" : "",
      data.settings.includeDate ? "d" : "",
      data.settings.includeClass ? "c" : "",
      data.settings.instructions ?? "",
    ].join("|");
    if (key === lastKeyRef.current) return;
    const root = measureRef.current;
    if (!root) return;
    const qEls = Array.from(root.querySelectorAll("[data-q-measure]")) as HTMLElement[];
    if (qEls.length !== data.questions.length) return;
    const headerEl = root.querySelector("[data-header-measure]") as HTMLElement | null;
    lastKeyRef.current = key;

    const PX_MM = 3.7795;
    const contentH = (297 - 18 - 16) * PX_MM;
    const headerH = headerEl ? headerEl.offsetHeight : 60 * PX_MM;
    const footerH = 12 * PX_MM;
    const firstPageH = Math.max(contentH - headerH - footerH, 80 * PX_MM);
    const otherPageH = Math.max(contentH - footerH - 12 * PX_MM, 150 * PX_MM);
    const GAP = 4 * PX_MM;
    const heights = qEls.map(el => el.offsetHeight + GAP);
    const newPages: Question[][] = [];
    let page: Question[] = [];
    let usedH = 0;
    let limit = firstPageH;
    if (cols === 2) {
      for (let i = 0; i < data.questions.length; i += 2) {
        const rowH = Math.max(heights[i] ?? 0, heights[i + 1] ?? 0);
        if (page.length > 0 && usedH + rowH > limit) { newPages.push(page); page = []; usedH = 0; limit = otherPageH; }
        page.push(data.questions[i]);
        if (i + 1 < data.questions.length) page.push(data.questions[i + 1]);
        usedH += rowH;
      }
    } else {
      for (let i = 0; i < data.questions.length; i++) {
        const h = heights[i];
        if (page.length > 0 && usedH + h > limit) { newPages.push(page); page = []; usedH = 0; limit = otherPageH; }
        page.push(data.questions[i]);
        usedH += h;
      }
    }
    if (page.length > 0) newPages.push(page);
    if (newPages.length > 0) setPages(newPages);
  });

  // ── Header JSX (shared between page 1 render and measurement div) ──
  const headerJsx = (
    <header className="ws-header">
      <div className={`ws-headgrid${hasIdentity ? "" : " ws-headgrid-titleonly"}`}>
        {hasIdentity && (
          <div className="ws-headside ws-headside-start">
            {logoUrl && (
              <div className="ws-logo-wrap">
                <img src={logoUrl} alt={ar ? "شعار المدرسة" : "School logo"} className="ws-logo-img" />
              </div>
            )}
            {data.settings.schoolName && (
              <IdentityCell label={labels.school} value={data.settings.schoolName} icon={<IconSchool />} />
            )}
            {data.settings.section && (
              <IdentityCell label={labels.section} value={data.settings.section} icon={<IconSection />} />
            )}
            {data.settings.teacherName && (
              <IdentityCell label={labels.teacher} value={data.settings.teacherName} icon={<IconTeacher />} />
            )}
            {customFields.map((f, i) => (
              <IdentityCell key={`cf-${i}`} label={f.label.trim() || (ar ? "حقل" : "Field")} value={f.value} icon={<IconField />} />
            ))}
          </div>
        )}
        <div className="ws-headcenter">
          <h1 className="ws-title">{data.title}</h1>
          {(data.subject || data.gradeLevel) && (
            <div className="ws-kicker-center">{[data.subject, data.gradeLevel].filter(Boolean).join(" · ")}</div>
          )}
          <DoubleDivider />
        </div>
        {hasIdentity && <div className="ws-headside ws-headside-end" aria-hidden="true" />}
      </div>
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div className="ws-fields">
          {data.settings.includeName && <FieldLine label={labels.name} icon={<IconUser />} />}
          {data.settings.includeClass && <FieldLine label={labels.clazz} icon={<IconClass />} short />}
          {data.settings.includeDate && <FieldLine label={labels.date} icon={<IconDate />} short />}
        </div>
      )}
      {data.settings.headerNote && <p className="ws-subtitle">{data.settings.headerNote}</p>}
      {data.settings.instructions && (
        <div className="ws-instructions">
          <IconLightbulb />
          <div><strong>{labels.instructions}</strong><span> {data.settings.instructions}</span></div>
        </div>
      )}
    </header>
  );

  const qColWidth = cols === 2 ? "calc((174mm - 8mm) / 2)" : "174mm";

  return (
    <>
      <PrintStyles fontFamily={fontFamily} headingFont={headingFont} fontSizePt={fontSizePt} lang={data.language} themeColor={themeColor} />

      {/* ── Hidden measurement div ───────────────────────────────── */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="print-host"
        style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden", pointerEvents: "none" }}
        dir={dir}
      >
        <div data-header-measure style={{ width: "174mm" }}>{headerJsx}</div>
        {data.questions.map((q, i) => (
          <div key={q.id} data-q-measure style={{ width: qColWidth }}>
            <QuestionView index={i + 1} q={q} ar={ar} labels={labels} />
          </div>
        ))}
      </div>

      {/* ── Visible paginated pages ──────────────────────────────── */}
      <div id="ws-printable-root" className="print-host bg-neutral-200 min-h-screen py-6 px-2 flex flex-col items-center" dir={dir}>

        {pages.map((pageQs, pi) => {
          const pageNum = pi + 1;
          const isFirst = pi === 0;
          const isLast = pi === pages.length - 1;
          return (
            <article key={pageNum} className="ws-page" lang={data.language}>
              {showWatermark && <WatermarkLayer ar={ar} />}
              <CornerOrnaments />
              <div className="ws-content">
                {isFirst ? (
                  headerJsx
                ) : (
                  /* Slim continuation header for pages 2+ */
                  <div className="ws-cont-header">
                    <span className="ws-cont-title">{data.title}</span>
                    <span className="ws-cont-page">{ar ? `صفحة ${pageNum}` : `Page ${pageNum}`}</span>
                  </div>
                )}
                <section className="ws-questions" style={{ columnCount: cols === 2 ? 2 : 1 }}>
                  {pageQs.map(q => {
                    const idx = data.questions.indexOf(q);
                    return <QuestionView key={q.id} index={idx + 1} q={q} ar={ar} labels={labels} />;
                  })}
                </section>
                <FooterStrip
                  note={isLast ? data.settings.footerNote : undefined}
                  goodLuck={isLast ? labels.goodLuck : ""}
                />
              </div>
            </article>
          );
        })}

        {/* ── Answer key page ──────────────────────────────────── */}
        {data.settings.includeAnswerKey && (
          <article className="ws-page" lang={data.language}>
            {showWatermark && <WatermarkLayer ar={ar} />}
            <CornerOrnaments />
            <div className="ws-content">
              <header className="ws-header">
                <div className="ws-headgrid ws-headgrid-titleonly">
                  <div className="ws-headcenter">
                    <h1 className="ws-title" style={{ color: BRAND_GOLD }}>{labels.answerKey}</h1>
                    <div className="ws-kicker-center" style={{ color: BRAND_GOLD, background: `${BRAND_GOLD}1f` }}>
                      {data.title}
                    </div>
                    <DoubleDivider gold />
                  </div>
                </div>
              </header>
              <section className="ws-questions" style={{ columnCount: 1 }}>
                {data.questions.map((q, i) => (
                  <AnswerView key={q.id} index={i + 1} q={q} ar={ar} labels={labels} />
                ))}
              </section>
              <FooterStrip goodLuck="" />
            </div>
          </article>
        )}
      </div>
    </>
  );
}

export default function WorksheetPrint() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { lang: uiLang } = useI18n();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<WorksheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/worksheets/${id}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then(setData)
      .catch(() => toast.error(uiLang === "ar" ? "تعذّر تحميل ورقة العمل" : "Failed to load worksheet"))
      .finally(() => setLoading(false));
  }, [id, uiLang]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_PRIMARY }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {uiLang === "ar" ? "لم يتم العثور على ورقة العمل." : "Worksheet not found."}
      </div>
    );
  }

  const dir = data.language === "ar" ? "rtl" : "ltr";

  const handleWord = () => {
    const root = document.getElementById("ws-printable-root");
    if (!root) {
      toast.error(uiLang === "ar" ? "تعذّر إعداد الملف" : "Could not prepare file");
      return;
    }
    downloadAsWord({ element: root, title: data.title, lang: data.language });
  };

  return (
    <>
      {/* Action toolbar (hidden when printing) */}
      <div
        dir={dir}
        className="no-print sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white"
      >
        <button
          onClick={() => setLocation("/teacher")}
          className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {uiLang === "ar" ? "اللوحة" : "Dashboard"}
        </button>
        <div className="text-xs font-bold truncate flex-1 text-center" style={{ color: BRAND_PRIMARY }}>
          {data.title}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {data.isOwner !== false && (
            <button
              onClick={() => setLocation(`/teacher/worksheets/create?edit=${data.id}`)}
              className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
              title={uiLang === "ar" ? "تحرير هذه الورقة" : "Edit this worksheet"}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {uiLang === "ar" ? "تحرير" : "Edit"}
            </button>
          )}
          <button
            onClick={handleWord}
            className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
            style={{ borderColor: `${BRAND_GOLD}88`, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
            title={uiLang === "ar" ? "تنزيل كملف وورد" : "Download as Word"}
          >
            <FileType className="w-3.5 h-3.5" />
            {uiLang === "ar" ? "وورد" : "Word"}
          </button>
          <button
            onClick={() => printToPdf()}
            className="px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm"
            style={{ background: BRAND_PRIMARY }}
          >
            <Printer className="w-3.5 h-3.5" />
            {uiLang === "ar" ? "PDF / طباعة" : "PDF / Print"}
          </button>
        </div>
      </div>

      <WorksheetPrintView data={data} />
    </>
  );
}

function FieldLine({ label, short, icon }: { label: string; short?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`ws-field-line ${short ? "short" : ""}`}>
      {icon && <span className="ws-field-icon">{icon}</span>}
      <span className="ws-field-label">{label}:</span>
      <span className="ws-field-rule" />
    </div>
  );
}

function IdentityCell({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="ws-school-cell">
      <span className="ws-school-icon">{icon}</span>
      <div className="ws-school-text">
        <span className="ws-school-label">{label}</span>
        <span className="ws-school-value">{value}</span>
      </div>
    </div>
  );
}

function FooterStrip({ note, goodLuck }: { note?: string; goodLuck: string }) {
  if (!note && !goodLuck) return null;
  return (
    <footer className="ws-footer">
      {goodLuck && <div className="ws-footer-cheer">{goodLuck}</div>}
      {note && <div className="ws-footer-note">{note}</div>}
    </footer>
  );
}

// Faint big "حصاد" / "Hasaad" watermark sitting behind worksheet content.
function WatermarkLayer({ ar }: { ar: boolean }) {
  const text = ar ? "حصاد" : "Hasaad";
  return (
    <div className="ws-watermark" aria-hidden="true">
      <span className="ws-watermark-word">{text}</span>
    </div>
  );
}

// Subtle gold corner ornaments — a classic textbook touch that frames the
// page without dominating it. Hidden on the answer key for visual variety.
function CornerOrnaments() {
  return (
    <>
      <span className="ws-corner ws-corner-tl" aria-hidden="true" />
      <span className="ws-corner ws-corner-tr" aria-hidden="true" />
      <span className="ws-corner ws-corner-bl" aria-hidden="true" />
      <span className="ws-corner ws-corner-br" aria-hidden="true" />
    </>
  );
}

// Decorative double line below the title — gold over green dashed.
function DoubleDivider({ gold }: { gold?: boolean }) {
  return (
    <div className={`ws-divider ${gold ? "gold" : ""}`} aria-hidden="true">
      <span className="ws-divider-thick" />
      <span className="ws-divider-thin" />
    </div>
  );
}

// Question-type icons (small, line-style, brand color via currentColor).
function IconMcq() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h6M7 17h8" />
    </svg>
  );
}
function IconTF() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h6M8 7v10M14 7h5l-5 10h5" />
    </svg>
  );
}
function IconShort() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16M4 15l11-11 4 4-11 11z" />
    </svg>
  );
}
function IconFill() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h4M16 12h4" />
      <rect x="9" y="8" width="6" height="8" rx="1" />
    </svg>
  );
}
function IconMatch() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="18" cy="17" r="2" />
      <path d="M8 7h8M8 17h8M8 8c4 4 6 4 10 8" />
    </svg>
  );
}
function IconSchool() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-5 9 5-9 5-9-5z" />
      <path d="M7 12v4c0 1 2 2 5 2s5-1 5-2v-4" />
    </svg>
  );
}
function IconSection() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v16M4 9h16" />
    </svg>
  );
}
function IconTeacher() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
    </svg>
  );
}
function IconField() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function IconClass() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 3v6M16 3v6" />
    </svg>
  );
}
function IconDate() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconLightbulb() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={BRAND_GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function questionIcon(type: Question["type"]) {
  switch (type) {
    case "mcq": return <IconMcq />;
    case "true_false": return <IconTF />;
    case "short_answer": return <IconShort />;
    case "fill_blank": return <IconFill />;
    case "matching": return <IconMatch />;
  }
}

function questionTypeLabel(type: Question["type"], ar: boolean) {
  if (ar) {
    return { mcq: "اختيار من متعدد", true_false: "صح / خطأ", short_answer: "إجابة قصيرة", fill_blank: "أكمل الفراغ", matching: "وصّل بين العمودين" }[type];
  }
  return { mcq: "Multiple choice", true_false: "True / False", short_answer: "Short answer", fill_blank: "Fill in the blank", matching: "Matching" }[type];
}

function QuestionView({
  index, q, ar, labels,
}: { index: number; q: Question; ar: boolean; labels: { question: string; true: string; false: string; correct: string } }) {
  return (
    <div className="ws-q">
      <div className="ws-q-head">
        <span className="ws-q-num" aria-label={`${labels.question} ${index}`}>{index}</span>
        <div className="ws-q-prompt-wrap">
          <div className="ws-q-typeline">
            <span className="ws-q-typebadge">{questionIcon(q.type)} <span>{questionTypeLabel(q.type, ar)}</span></span>
            {typeof q.points === "number" && q.points > 0 && (
              <span className="ws-q-points">{q.points} {ar ? "د" : "pt"}</span>
            )}
          </div>
          {q.type !== "matching" && <div className="ws-q-prompt">{q.prompt}</div>}
          {q.type === "matching" && <div className="ws-q-prompt">{q.prompt || (ar ? "صل بين العمودين بخطوط:" : "Match the columns:")}</div>}
        </div>
      </div>
      {q.type === "mcq" && (
        <ol className="ws-mcq">
          {q.options.map((opt, i) => (
            <li key={i}>
              <span className="ws-mcq-letter">{ar ? `${"أبجده"[i] || (i + 1)}` : String.fromCharCode(65 + i)})</span>
              <span className="ws-bubble" />
              <span className="ws-mcq-text">{opt}</span>
            </li>
          ))}
        </ol>
      )}
      {q.type === "true_false" && (
        <div className="ws-tf">
          <span className="ws-tf-opt"><span className="ws-bubble" /> {labels.true}</span>
          <span className="ws-tf-opt"><span className="ws-bubble" /> {labels.false}</span>
        </div>
      )}
      {q.type === "short_answer" && (
        <div className="ws-lines">
          {Array.from({ length: q.lines ?? 2 }).map((_, i) => <span key={i} className="ws-line" />)}
        </div>
      )}
      {q.type === "fill_blank" && (
        <div className="ws-fill"><span className="ws-fill-rule" /></div>
      )}
      {q.type === "matching" && (
        <div className="ws-match">
          <ul className="ws-match-col">
            {q.pairs.map((p, i) => (
              <li key={`l${i}`}>
                <span className="ws-match-bullet ws-match-num">{i + 1}</span>
                <span className="ws-match-text">{p.left}</span>
                <span className="ws-match-tab" />
              </li>
            ))}
          </ul>
          <div className="ws-match-divider" aria-hidden="true" />
          <ul className="ws-match-col">
            {matchingDisplayOrder(q.pairs.length).map((srcIdx, displayIdx) => (
              <li key={`r${displayIdx}`}>
                <span className="ws-match-tab" />
                <span className="ws-match-bullet ws-match-letter">{String.fromCharCode(65 + displayIdx)}</span>
                <span className="ws-match-text">{q.pairs[srcIdx].right}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnswerView({
  index, q, ar, labels,
}: { index: number; q: Question; ar: boolean; labels: { question: string; true: string; false: string; correct: string } }) {
  let answer = "";
  if (q.type === "mcq") {
    const letter = ar ? `${"أبجده"[q.correctIndex] || (q.correctIndex + 1)}` : String.fromCharCode(65 + q.correctIndex);
    answer = `${letter}) ${q.options[q.correctIndex] ?? ""}`;
  } else if (q.type === "true_false") {
    answer = q.correct ? labels.true : labels.false;
  } else if (q.type === "short_answer") {
    answer = q.answer?.trim() || (ar ? "—" : "—");
  } else if (q.type === "fill_blank") {
    answer = q.answer;
  } else if (q.type === "matching") {
    const order = matchingDisplayOrder(q.pairs.length);
    answer = q.pairs.map((_, i) => {
      const displayIdx = order.indexOf(i);
      return `${i + 1} → ${String.fromCharCode(65 + (displayIdx >= 0 ? displayIdx : i))}`;
    }).join("    ");
  }
  return (
    <div className="ws-q ws-answer">
      <div className="ws-q-head">
        <span className="ws-q-num">{index}</span>
        <div className="ws-q-prompt-wrap">
          <div className="ws-q-prompt">
            {q.type === "matching" ? (ar ? "أزواج التوصيل" : "Matching pairs") : q.prompt}
          </div>
        </div>
      </div>
      <div className="ws-answer-line"><strong>{labels.correct}</strong> {answer}</div>
    </div>
  );
}

// Deterministic permutation of [0..n-1] for the matching right-column.
function matchingDisplayOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let s = (n * 2654435761) >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  if (n > 1 && order.every((v, i) => v === i)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

function PrintStyles({ fontFamily, headingFont, fontSizePt, lang, themeColor }: { fontFamily: string; headingFont: string; fontSizePt: number; lang: "ar" | "en"; themeColor: string }) {
  const isAr = lang === "ar";
  const startSide = isAr ? "right" : "left";
  const endSide = isAr ? "left" : "right";
  const TC = themeColor; // shorthand
  return (
    <style>{`
      /* High-quality Arabic + Latin fonts, including elegant heading
         faces (Reem Kufi, Amiri) used for the title and section labels. */
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${fontFamily}; }
      .ws-page {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 0 auto 18px auto;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${fontSizePt}pt;
        line-height: 1.85;
        page-break-after: always;
        overflow: visible;
        border-radius: 4px;
      }
      .ws-page:last-of-type { page-break-after: auto; margin-bottom: 0; }
      .ws-content {
        position: relative;
        z-index: 1;
        padding: 18mm 18mm 16mm 18mm;
        display: flex;
        flex-direction: column;
        min-height: calc(297mm - 0px);
      }

      /* Faint Hasaad watermark behind content. */
      .ws-watermark {
        position: absolute; inset: 0; z-index: 0;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none; overflow: hidden;
      }
      .ws-watermark-word {
        font-family: ${headingFont};
        font-weight: 800;
        font-size: 200pt;
        color: ${TC};
        opacity: 0.05;
        transform: rotate(-22deg);
        white-space: nowrap;
        letter-spacing: 0.05em;
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${BRAND_GOLD};
        z-index: 0; pointer-events: none;
      }
      .ws-corner-tl { top: 8mm; left: 8mm; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
      .ws-corner-tr { top: 8mm; right: 8mm; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
      .ws-corner-bl { bottom: 8mm; left: 8mm; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
      .ws-corner-br { bottom: 8mm; right: 8mm; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

      /* Header — top-of-page grid: identity panel pinned to the START
         side, title centered in the middle column, opposite side reserved
         for symmetry so the title stays visually centered on the page. */
      .ws-header { margin-bottom: 6mm; }
      .ws-headgrid {
        display: grid;
        grid-template-columns: minmax(58mm, 1fr) minmax(0, 1.6fr) minmax(58mm, 1fr);
        gap: 6mm;
        align-items: start;
      }
      .ws-headgrid-titleonly {
        grid-template-columns: 1fr;
      }
      .ws-headside {
        display: flex; flex-direction: column; gap: 3mm;
        font-size: ${Math.max(9, fontSizePt - 1.5)}pt;
      }
      .ws-headcenter {
        display: flex; flex-direction: column; align-items: center;
        text-align: center;
        padding-top: 1mm;
      }
      .ws-kicker-center {
        display: inline-block;
        font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
        font-weight: 700;
        color: ${TC};
        background: ${TC}10;
        padding: 3px 12px;
        border-radius: 999px;
        letter-spacing: 0.02em;
        margin-top: 2mm;
      }

      .ws-title {
        font-family: ${headingFont};
        font-size: ${fontSizePt + 12}pt;
        font-weight: 800;
        color: ${TC};
        margin: 0;
        text-align: center;
        line-height: 1.2;
        letter-spacing: 0.005em;
      }
      .ws-subtitle {
        text-align: center;
        color: #5a6663;
        font-size: ${Math.max(9.5, fontSizePt - 1.5)}pt;
        margin: 3mm 0 0;
      }

      .ws-divider {
        display: flex; flex-direction: column; gap: 1.4mm;
        align-items: center; margin: 3mm auto 0;
        width: 100%;
      }
      .ws-divider-thick {
        width: 64%; height: 2px; background: ${BRAND_GOLD};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${TC} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${TC}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${BRAND_GOLD} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${TC}0d 0%, ${BRAND_GOLD}10 100%);
        border-${startSide}: 3px solid ${TC};
        padding: 5px 10px;
        border-radius: 4px;
      }
      .ws-school-icon {
        display: inline-flex; align-items: center; justify-content: center;
        color: ${TC};
        flex: 0 0 auto;
      }
      .ws-school-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
      .ws-school-label {
        font-weight: 700;
        color: ${TC};
        font-size: ${Math.max(8, fontSizePt - 3)}pt;
        letter-spacing: 0.02em;
      }
      .ws-school-value {
        color: #2a3431;
        font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .ws-fields {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 6mm;
        margin: 5mm 0 4mm;
      }
      .ws-field-line {
        display: flex; align-items: center; gap: 6px;
        border-bottom: 1px dashed ${TC}55;
        padding: 4px 4px 6px;
      }
      .ws-field-icon { color: ${TC}; flex: 0 0 auto; display: inline-flex; }
      .ws-field-label { font-weight: 700; color: ${TC}; white-space: nowrap; flex: 0 0 auto; }
      .ws-field-rule { flex: 1; height: 14px; }

      .ws-instructions {
        display: flex; gap: 8px; align-items: flex-start;
        background: linear-gradient(135deg, ${BRAND_GOLD}1a 0%, ${BRAND_GOLD}08 100%);
        border-${startSide}: 4px solid ${BRAND_GOLD};
        padding: 8px 12px;
        font-size: ${Math.max(9, fontSizePt - 1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${TC}; margin-${endSide}: 4px; }

      /* Questions */
      .ws-questions {
        column-gap: 8mm;
        flex: 1;
      }
      .ws-q {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 6mm;
        padding: 4mm 4mm 4mm 5mm;
        border-${startSide}: 3px solid ${BRAND_GOLD};
        background: linear-gradient(180deg, #ffffff 0%, ${TC}04 100%);
        border-radius: 0 6px 6px 0;
        ${isAr ? "border-radius: 6px 0 0 6px;" : ""}
      }
      .ws-q-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 3mm; }
      .ws-q-num {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px;
        background: ${TC};
        color: white;
        border-radius: 50%;
        font-weight: 800;
        font-size: ${Math.max(9.5, fontSizePt - 1)}pt;
        font-family: ${headingFont};
        box-shadow: 0 0 0 2px ${BRAND_GOLD}55;
      }
      .ws-q-prompt-wrap { flex: 1; min-width: 0; }
      .ws-q-typeline { display: flex; align-items: center; gap: 8px; margin-bottom: 1.5mm; flex-wrap: wrap; }
      .ws-q-typebadge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: ${Math.max(7.5, fontSizePt - 3.5)}pt;
        font-weight: 700;
        color: ${TC};
        background: ${TC}0e;
        padding: 1.5px 7px 1.5px 5px;
        border-radius: 999px;
        letter-spacing: 0.02em;
      }
      .ws-q-points {
        font-size: ${Math.max(7.5, fontSizePt - 3.5)}pt;
        font-weight: 800;
        color: ${BRAND_GOLD};
        background: ${BRAND_GOLD}18;
        padding: 1.5px 7px;
        border-radius: 999px;
      }
      .ws-q-prompt { font-weight: 600; color: #1a2421; line-height: 1.7; }

      .ws-mcq { list-style: none; padding-${startSide}: 36px; margin: 2mm 0 0; }
      .ws-mcq li {
        display: flex; gap: 7px; align-items: center;
        margin: 2mm 0;
        line-height: 1.6;
      }
      .ws-mcq-letter {
        display: inline-block;
        min-width: 18px;
        font-weight: 800;
        color: ${BRAND_GOLD};
        font-family: ${headingFont};
      }
      .ws-bubble {
        display: inline-block;
        width: 14px; height: 14px;
        border: 1.6px solid ${TC}88;
        border-radius: 50%;
        flex: 0 0 auto;
        background: white;
      }
      .ws-mcq-text { flex: 1; }

      .ws-tf {
        display: flex; gap: 30px;
        padding-${startSide}: 36px;
        margin-top: 2mm;
      }
      .ws-tf-opt {
        display: inline-flex; align-items: center; gap: 7px;
        font-weight: 600;
      }

      .ws-lines { padding-${startSide}: 36px; margin-top: 2mm; }
      .ws-line {
        display: block;
        border-bottom: 1px dotted ${TC}66;
        height: 8mm;
      }

      .ws-fill { padding-${startSide}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${TC};
      }

      .ws-match {
        display: grid;
        grid-template-columns: 1fr 6mm 1fr;
        gap: 6mm;
        padding-${startSide}: 36px;
        margin-top: 3mm;
        align-items: stretch;
      }
      .ws-match-col {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 2.5mm;
      }
      .ws-match-col li {
        display: flex; align-items: center; gap: 7px;
        background: white;
        border: 1px solid ${TC}22;
        border-radius: 6px;
        padding: 4px 9px;
        font-weight: 500;
      }
      .ws-match-bullet {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px;
        border-radius: 50%;
        font-weight: 800;
        font-family: ${headingFont};
        font-size: ${Math.max(8.5, fontSizePt - 2.5)}pt;
        flex: 0 0 auto;
      }
      .ws-match-num { background: ${TC}; color: white; }
      .ws-match-letter { background: ${BRAND_GOLD}; color: white; }
      .ws-match-text { flex: 1; }
      .ws-match-tab { flex: 0 0 0; }
      .ws-match-divider {
        background: repeating-linear-gradient(to bottom, ${BRAND_GOLD} 0 4px, transparent 4px 9px);
        width: 2px;
        margin: 0 auto;
      }

      /* Footer strip — brand line removed per teacher request; only the
         "good luck" cheer and optional teacher footer note remain. */
      .ws-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${TC}44;
        text-align: center;
        font-size: ${Math.max(8, fontSizePt - 2.5)}pt;
        color: #6a7370;
      }
      .ws-footer-cheer {
        font-family: ${headingFont};
        font-weight: 700;
        color: ${BRAND_GOLD};
        font-size: ${Math.max(9.5, fontSizePt - 1)}pt;
        margin-bottom: 2mm;
        letter-spacing: 0.02em;
      }
      .ws-footer-note {
        color: #555;
        font-style: italic;
      }

      /* Continuation header — slim bar on pages 2+ */
      .ws-cont-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3mm 0 4mm;
        margin-bottom: 4mm;
        border-bottom: 2px solid ${TC}22;
      }
      .ws-cont-title {
        font-family: ${headingFont};
        font-weight: 800;
        font-size: ${Math.max(10, fontSizePt)}pt;
        color: ${TC};
      }
      .ws-cont-page {
        font-size: ${Math.max(8, fontSizePt - 2)}pt;
        font-weight: 700;
        color: ${TC}88;
        background: ${TC}0d;
        padding: 2px 8px;
        border-radius: 999px;
      }

      /* School logo in the header identity panel */
      .ws-logo-wrap {
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 3mm;
      }
      .ws-logo-img {
        max-height: 18mm; max-width: 40mm;
        object-fit: contain;
      }

      /* Answer key tweaks */
      .ws-answer { margin-bottom: 4mm; padding: 3mm 4mm; }
      .ws-answer .ws-q-num { background: ${BRAND_GOLD}; box-shadow: 0 0 0 2px ${TC}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${startSide}: 36px;
        color: ${TC};
        font-size: ${Math.max(9.5, fontSizePt - 0.5)}pt;
      }
      .ws-answer-line strong { color: ${BRAND_GOLD}; margin-${endSide}: 4px; }

      @media print {
        @page { size: A4; margin: 0; }
        html, body { background: white !important; }
        .no-print { display: none !important; }
        .print-host {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: auto !important;
        }
        .ws-page {
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
        }
        .ws-watermark, .ws-watermark-word,
        .ws-corner, .ws-q, .ws-instructions, .ws-school-cell,
        .ws-q-num, .ws-q-typebadge, .ws-q-points,
        .ws-match-bullet, .ws-divider-thick, .ws-divider-thin,
        .ws-kicker-center {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>
  );
}
