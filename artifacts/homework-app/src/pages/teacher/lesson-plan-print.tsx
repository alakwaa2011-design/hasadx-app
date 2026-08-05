import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Printer, ArrowLeft, Edit3, FileType } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { downloadAsWord, printToPdf } from "@/lib/print-export";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

interface Block { title?: string; durationMinutes?: number; description: string }
export interface ActivityRef {
  kind: "assignment" | "video-lesson";
  id: number;
  title: string;
}
interface ActivityBlock {
  title: string;
  durationMinutes?: number;
  description: string;
  activityRef?: ActivityRef;
}
interface VocabTerm { term: string; definition?: string }

export type LpFontFamily = "default" | "cairo" | "tajawal" | "amiri" | "naskh" | "reem" | "inter" | "serif" | "mono";

export interface LessonPlanSections {
  objectives: string[];
  materials: string[];
  vocabulary: VocabTerm[];
  warmUp: Block;
  introduction: Block;
  activities: ActivityBlock[];
  assessment: { description: string; method?: string };
  closure: { description: string };
  homework?: { description: string };
  differentiation?: { support?: string; extension?: string };
  notes?: string;
}

export interface LessonPlanSettings {
  includeObjectives: boolean;
  includeMaterials: boolean;
  includeVocabulary: boolean;
  includeWarmUp: boolean;
  includeIntroduction: boolean;
  includeActivities: boolean;
  includeAssessment: boolean;
  includeClosure: boolean;
  includeHomework: boolean;
  includeDifferentiation: boolean;
  includeNotes: boolean;
  headerNote?: string;
  footerNote?: string;
  lessonDateGregorian?: string;
  lessonDateHijri?: string;
  fontFamily?: LpFontFamily;
  fontSizePt?: number;
}

export interface PlanData {
  id: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  durationMinutes: number | null;
  sections: LessonPlanSections;
  settings: LessonPlanSettings;
  ownerName?: string | null;
  isOwner?: boolean;
}

// Backwards-compat aliases used by older imports inside this file.
type Sections = LessonPlanSections;
type Settings = LessonPlanSettings;

/**
 * Reusable printable view for a lesson plan. Used by the print page
 * (loads by id) and by the create page's preview-without-save overlay
 * (in-memory draft). The wrapper id `lp-printable-root` lets the Word
 * exporter target just the printable subtree.
 */
export function LessonPlanPrintView({ data }: { data: PlanData }) {
  const ar = data.language === "ar";
  const dir = ar ? "rtl" : "ltr";

  const labels = ar
    ? {
        teacher: "المعلم", subject: "المادة", grade: "المرحلة", date: "التاريخ", duration: "المدة",
        objectives: "الأهداف التعليمية", materials: "المواد والأدوات", vocabulary: "المفردات الجديدة",
        warmUp: "التهيئة (الإحماء)", introduction: "التمهيد", activities: "الأنشطة الرئيسة",
        assessment: "التقويم", method: "أسلوب التقويم", closure: "الخاتمة",
        homework: "الواجب المنزلي", differentiation: "تنويع التعليم",
        support: "للطلاب الذين يحتاجون دعمًا", extension: "للطلاب المتقدّمين",
        notes: "ملاحظات المعلم", lessonPlan: "خطة درس", minute: "د",
        term: "المصطلح", definition: "المعنى",
      }
    : {
        teacher: "Teacher", subject: "Subject", grade: "Grade", date: "Date", duration: "Duration",
        objectives: "Learning Objectives", materials: "Materials & Tools", vocabulary: "New Vocabulary",
        warmUp: "Warm-up", introduction: "Introduction", activities: "Main Activities",
        assessment: "Assessment", method: "Method", closure: "Closure",
        homework: "Homework", differentiation: "Differentiation",
        support: "Support", extension: "Extension",
        notes: "Teacher Notes", lessonPlan: "Lesson Plan", minute: "min",
        term: "Term", definition: "Definition",
      };

  const s = data.sections;
  const cfg = data.settings;
  // Resolve teacher-chosen font; "default" picks the language-appropriate
  // stack. Heading font tracks the body font so the page looks coherent.
  const fontStack = resolveLpFont(cfg.fontFamily, data.language);
  const headingFont = resolveLpHeadingFont(cfg.fontFamily, data.language);
  const fontSizePt = clampFontSize(cfg.fontSizePt);
  const dateGreg = (cfg.lessonDateGregorian ?? "").trim();
  const dateHijri = (cfg.lessonDateHijri ?? "").trim();
  const dateLabelGreg = ar ? "التاريخ الميلادي" : "Gregorian date";
  const dateLabelHijri = ar ? "التاريخ الهجري" : "Hijri date";

  return (
    <>
      <PrintStyles lang={data.language} fontStack={fontStack} headingFont={headingFont} fontSizePt={fontSizePt} />
      <div id="lp-printable-root" className="print-host bg-gray-100 py-6 px-2 sm:px-6 min-h-screen flex justify-center">
        <article dir={dir} className="lp-page" lang={data.language}>
          <CornerOrnaments />
          <div className="lp-content">
            {/* Header — Hasaad brand mark + name removed per teacher
                request. The "lesson plan" kicker stays, centered, so the
                page still reads as an official document. */}
            <header className="lp-header">
              <div className="lp-kicker-row">
                <div className="lp-kicker">{labels.lessonPlan}</div>
              </div>
              <h1 className="lp-title" style={{ fontFamily: headingFont }}>{data.title}</h1>
              {cfg.headerNote && <p className="lp-subtitle">{cfg.headerNote}</p>}
              <div className="lp-divider" aria-hidden="true">
                <span className="lp-divider-thick" />
                <span className="lp-divider-thin" />
              </div>
              <div className="lp-meta-grid">
                <MetaCell label={labels.teacher} value={data.ownerName || "—"} icon={<IconTeacher />} />
                {data.subject && <MetaCell label={labels.subject} value={data.subject} icon={<IconSubject />} />}
                {data.gradeLevel && <MetaCell label={labels.grade} value={data.gradeLevel} icon={<IconGrade />} />}
                {data.durationMinutes && <MetaCell label={labels.duration} value={`${data.durationMinutes} ${labels.minute}`} icon={<IconClock />} />}
                {/* Date cells. If the teacher filled either the Gregorian or
                    Hijri date in print settings, show it; otherwise fall
                    back to the original underline placeholder so the
                    teacher can fill it by hand on the printout. */}
                {(dateGreg || dateHijri) ? (
                  <>
                    {dateGreg && <MetaCell label={dateLabelGreg} value={dateGreg} icon={<IconCalendar />} />}
                    {dateHijri && <MetaCell label={dateLabelHijri} value={dateHijri} icon={<IconCalendar />} />}
                  </>
                ) : (
                  <MetaCell label={labels.date} value="________________" icon={<IconCalendar />} />
                )}
              </div>
            </header>

            <div className="lp-body">
              {/* Two-column row: objectives + materials */}
              {((cfg.includeObjectives && s.objectives.length > 0) || (cfg.includeMaterials && s.materials.length > 0)) && (
                <div className="lp-row-2">
                  {cfg.includeObjectives && s.objectives.length > 0 && (
                    <Section title={labels.objectives} icon={<IconTarget />} accent="primary">
                      <ol className="lp-ol">
                        {s.objectives.map((o, i) => <li key={i}>{o}</li>)}
                      </ol>
                    </Section>
                  )}
                  {cfg.includeMaterials && s.materials.length > 0 && (
                    <Section title={labels.materials} icon={<IconBriefcase />} accent="gold">
                      <ul className="lp-checklist">
                        {s.materials.map((m, i) => (
                          <li key={i}><span className="lp-check" /> <span>{m}</span></li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              )}

              {cfg.includeVocabulary && s.vocabulary.length > 0 && (
                <Section title={labels.vocabulary} icon={<IconBook />} accent="gold">
                  <table className="lp-vocab">
                    <thead>
                      <tr>
                        <th>{labels.term}</th>
                        <th>{labels.definition}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.vocabulary.map((v, i) => (
                        <tr key={i} className={i % 2 === 0 ? "even" : "odd"}>
                          <td className="lp-vocab-term">{v.term}</td>
                          <td>{v.definition || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {cfg.includeWarmUp && (
                <Section title={labels.warmUp} duration={s.warmUp.durationMinutes} minLabel={labels.minute} icon={<IconFlame />} accent="primary">
                  <p>{s.warmUp.description}</p>
                </Section>
              )}

              {cfg.includeIntroduction && (
                <Section title={labels.introduction} duration={s.introduction.durationMinutes} minLabel={labels.minute} icon={<IconCompass />} accent="primary">
                  <p>{s.introduction.description}</p>
                </Section>
              )}

              {cfg.includeActivities && s.activities.length > 0 && (
                <Section title={labels.activities} icon={<IconActivities />} accent="gold">
                  <div className="lp-activities">
                    {s.activities.map((a, i) => (
                      <div key={i} className="lp-activity">
                        <div className="lp-activity-num">{i + 1}</div>
                        <div className="lp-activity-body">
                          <div className="lp-activity-head">
                            <span className="lp-activity-title">{a.title}</span>
                            {typeof a.durationMinutes === "number" && a.durationMinutes > 0 && (
                              <span className="lp-activity-dur">
                                <IconClockSmall /> {a.durationMinutes} {labels.minute}
                              </span>
                            )}
                          </div>
                          <p className="lp-activity-desc">{a.description}</p>
                          {a.activityRef && (
                            <div className="lp-activity-ref" aria-label={ar ? "نشاط مرتبط" : "Linked activity"}>
                              <span className="lp-activity-ref-icon" aria-hidden="true">↗</span>
                              <span className="lp-activity-ref-kind">
                                {labelForRefKind(a.activityRef.kind, ar)}:
                              </span>
                              <span className="lp-activity-ref-title">{a.activityRef.title}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {cfg.includeAssessment && (
                <Section title={labels.assessment} icon={<IconCheck />} accent="primary">
                  {s.assessment.method && (
                    <p className="lp-meta-line"><strong>{labels.method}:</strong> {s.assessment.method}</p>
                  )}
                  <p>{s.assessment.description}</p>
                </Section>
              )}

              {cfg.includeClosure && (
                <Section title={labels.closure} icon={<IconClosure />} accent="primary">
                  <p>{s.closure.description}</p>
                </Section>
              )}

              {cfg.includeHomework && s.homework?.description && (
                <Section title={labels.homework} icon={<IconHome />} accent="gold">
                  <p>{s.homework.description}</p>
                </Section>
              )}

              {cfg.includeDifferentiation && s.differentiation && (s.differentiation.support || s.differentiation.extension) && (
                <Section title={labels.differentiation} icon={<IconBranch />} accent="primary">
                  <div className="lp-diff-grid">
                    {s.differentiation.support && (
                      <div className="lp-diff-card lp-diff-support">
                        <strong>{labels.support}</strong>
                        <span>{s.differentiation.support}</span>
                      </div>
                    )}
                    {s.differentiation.extension && (
                      <div className="lp-diff-card lp-diff-extension">
                        <strong>{labels.extension}</strong>
                        <span>{s.differentiation.extension}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {cfg.includeNotes && s.notes && (
                <Section title={labels.notes} icon={<IconNote />} accent="gold">
                  <p className="lp-notes">{s.notes}</p>
                </Section>
              )}
            </div>

            {/* Footer — Hasaad brand line removed per teacher request.
                Only the optional teacher-supplied footer note remains. */}
            {cfg.footerNote && (
              <footer className="lp-footer">
                <div className="lp-footer-note">{cfg.footerNote}</div>
              </footer>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

export default function LessonPlanPrint() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { lang: uiLang } = useI18n();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/lesson-plans/${id}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then(setData)
      .catch(() => toast.error(uiLang === "ar" ? "تعذّر تحميل الخطة" : "Failed to load plan"))
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
        {uiLang === "ar" ? "لم يتم العثور على الخطة." : "Plan not found."}
      </div>
    );
  }

  const dir = data.language === "ar" ? "rtl" : "ltr";

  const handleWord = () => {
    const root = document.getElementById("lp-printable-root");
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
          className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {uiLang === "ar" ? "اللوحة" : "Dashboard"}
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {data.isOwner && (
            <button
              onClick={() => setLocation(`/teacher/lesson-plans/create?edit=${data.id}`)}
              className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {uiLang === "ar" ? "تعديل" : "Edit"}
            </button>
          )}
          <button
            onClick={handleWord}
            className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
            style={{ borderColor: `${BRAND_GOLD}88`, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
            title={uiLang === "ar" ? "تنزيل كملف وورد" : "Download as Word"}
          >
            <FileType className="w-3.5 h-3.5" />
            {uiLang === "ar" ? "وورد" : "Word"}
          </button>
          <button
            onClick={() => printToPdf()}
            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 text-white shadow min-h-[40px]"
            style={{ background: BRAND_PRIMARY }}
          >
            <Printer className="w-4 h-4" />
            {uiLang === "ar" ? "PDF / طباعة" : "PDF / Print"}
          </button>
        </div>
      </div>

      <LessonPlanPrintView data={data} />
    </>
  );
}

function CornerOrnaments() {
  return (
    <>
      <span className="lp-corner lp-corner-tl" aria-hidden="true" />
      <span className="lp-corner lp-corner-tr" aria-hidden="true" />
      <span className="lp-corner lp-corner-bl" aria-hidden="true" />
      <span className="lp-corner lp-corner-br" aria-hidden="true" />
    </>
  );
}

function MetaCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="lp-meta-cell">
      {icon && <span className="lp-meta-icon">{icon}</span>}
      <div className="lp-meta-text">
        <span className="lp-meta-label">{label}</span>
        <span className="lp-meta-value">{value}</span>
      </div>
    </div>
  );
}

function Section({
  title, duration, minLabel, children, icon, accent = "primary",
}: {
  title: string;
  duration?: number;
  minLabel?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "primary" | "gold";
}) {
  return (
    <section className={`lp-section lp-accent-${accent}`}>
      <h2 className="lp-section-title">
        <span className="lp-section-icon">{icon}</span>
        <span className="lp-section-name">{title}</span>
        {typeof duration === "number" && duration > 0 && (
          <span className="lp-section-dur">
            <IconClockSmall /> {duration} {minLabel}
          </span>
        )}
      </h2>
      <div className="lp-section-body">{children}</div>
    </section>
  );
}

/* ── Section icons (SVG, line-style, currentColor) ────────── */

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4z" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3 1-5 1-7z" />
    </svg>
  );
}
function IconCompass() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 6-6 2 2-6 6-2z" />
    </svg>
  );
}
function IconActivities() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l3-7 4 14 3-7h5" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l5 5L21 4" />
    </svg>
  );
}
function IconClosure() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z" />
    </svg>
  );
}
function IconBranch() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="20" r="2" />
      <path d="M6 8v4a4 4 0 0 0 4 4M18 8v4a4 4 0 0 1-4 4" />
    </svg>
  );
}
function IconNote() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M16 4v4h4M8 12h8M8 16h6" />
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
function IconSubject() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
function IconGrade() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-5 9 5-9 5-9-5z" />
      <path d="M7 12v4c0 1 2 2 5 2s5-1 5-2v-4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconClockSmall() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PrintStyles({ lang, fontStack, headingFont, fontSizePt }: { lang: "ar" | "en"; fontStack: string; headingFont: string; fontSizePt: number }) {
  const isAr = lang === "ar";
  const startSide = isAr ? "right" : "left";
  const endSide = isAr ? "left" : "right";
  const fontFamily = fontStack;
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${fontFamily}; }
      .lp-page {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        background: white;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${fontSizePt}pt;
        line-height: 1.85;
        box-sizing: border-box;
        border-radius: 4px;
        overflow: hidden;
      }
      .lp-content {
        position: relative; z-index: 1;
        padding: 22mm 20mm 18mm;
        display: flex; flex-direction: column;
        min-height: 297mm; box-sizing: border-box;
      }

      .lp-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${BRAND_GOLD};
        z-index: 0; pointer-events: none;
      }
      .lp-corner-tl { top: 8mm; left: 8mm; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
      .lp-corner-tr { top: 8mm; right: 8mm; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
      .lp-corner-bl { bottom: 8mm; left: 8mm; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
      .lp-corner-br { bottom: 8mm; right: 8mm; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

      .lp-header { margin-bottom: 8mm; }
      /* Kicker row — used to host the brand bar; now centers the
         "Lesson Plan" pill since the Hasaad brand mark has been removed. */
      .lp-kicker-row { display: flex; align-items: center; justify-content: center; margin-bottom: 4mm; }
      .lp-kicker {
        font-size: 9pt; letter-spacing: 1.6px; text-transform: uppercase;
        color: ${BRAND_GOLD}; font-weight: 800;
        background: ${BRAND_GOLD}1c; padding: 4px 12px; border-radius: 999px;
      }
      .lp-title {
        font-size: 24pt; font-weight: 800; color: ${BRAND_PRIMARY};
        margin: 4px 0 4px; text-align: center; line-height: 1.25;
      }
      .lp-subtitle { color: #5a6663; font-size: 10.5pt; margin: 2px 0 8px; text-align: center; }

      .lp-divider {
        display: flex; flex-direction: column; gap: 1.4mm;
        align-items: center; margin: 3mm auto 5mm; width: 100%;
      }
      .lp-divider-thick { width: 60%; height: 2px; background: ${BRAND_GOLD}; border-radius: 2px; }
      .lp-divider-thin {
        width: 38%; height: 1px;
        background: repeating-linear-gradient(to right, ${BRAND_PRIMARY} 0 6px, transparent 6px 12px);
      }

      .lp-meta-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 6px 14px; margin-top: 6mm;
      }
      .lp-meta-cell {
        display: flex; align-items: center; gap: 8px;
        font-size: 10pt; padding: 4px 8px;
        background: ${BRAND_PRIMARY}07;
        border-${startSide}: 2.5px solid ${BRAND_PRIMARY};
        border-radius: 4px;
      }
      .lp-meta-icon { color: ${BRAND_PRIMARY}; flex: 0 0 auto; display: inline-flex; }
      .lp-meta-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
      .lp-meta-label { font-weight: 700; color: ${BRAND_PRIMARY}; font-size: 8pt; letter-spacing: 0.02em; }
      .lp-meta-value { color: #2a3431; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lp-meta-line { font-size: 10.5pt; margin: 0 0 4px; color: #444; }
      .lp-meta-line strong { color: ${BRAND_PRIMARY}; margin-${endSide}: 4px; }

      .lp-body { display: flex; flex-direction: column; gap: 6mm; }
      .lp-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
      @media (max-width: 600px) { .lp-row-2 { grid-template-columns: 1fr; } }

      .lp-section {
        border: 1px solid ${BRAND_PRIMARY}1f;
        border-radius: 8px;
        padding: 10px 14px 12px;
        page-break-inside: avoid;
        background: white;
        position: relative;
        overflow: hidden;
      }
      .lp-section::before {
        content: "";
        position: absolute; top: 0; left: 0; right: 0; height: 4px;
        background: ${BRAND_PRIMARY};
      }
      .lp-accent-gold::before { background: ${BRAND_GOLD}; }

      .lp-section-title {
        display: flex; align-items: center; gap: 8px;
        font-family: ${headingFont};
        font-size: 13pt; font-weight: 800; color: ${BRAND_PRIMARY};
        margin: 2mm 0 4mm; padding-bottom: 6px;
        border-bottom: 1px dashed ${BRAND_GOLD}88;
      }
      .lp-section-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: ${BRAND_PRIMARY}11;
        color: ${BRAND_PRIMARY};
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .lp-accent-gold .lp-section-icon { background: ${BRAND_GOLD}1c; color: ${BRAND_GOLD}; }
      .lp-section-name { flex: 1; }
      .lp-section-dur {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 9.5pt; color: ${BRAND_GOLD};
        background: ${BRAND_GOLD}18;
        padding: 3px 9px; border-radius: 999px; font-weight: 700;
      }
      .lp-section-body { font-size: ${Math.max(9.5, fontSizePt - 0.5)}pt; color: #222; }
      .lp-section-body p { margin: 0 0 4px; }

      .lp-ol, .lp-ul {
        margin: 0; padding-${startSide}: 22px;
        list-style-position: outside;
      }
      .lp-ol { counter-reset: lpcnt; list-style: none; padding-${startSide}: 0; }
      .lp-ol li {
        counter-increment: lpcnt;
        position: relative;
        padding-${startSide}: 28px;
        margin: 3px 0;
      }
      .lp-ol li::before {
        content: counter(lpcnt);
        position: absolute; ${startSide}: 0; top: 2px;
        width: 20px; height: 20px;
        background: ${BRAND_PRIMARY};
        color: white;
        border-radius: 50%;
        font-weight: 800;
        font-size: 9pt;
        font-family: ${headingFont};
        display: inline-flex; align-items: center; justify-content: center;
      }

      .lp-checklist { list-style: none; margin: 0; padding: 0; }
      .lp-checklist li {
        display: flex; align-items: center; gap: 8px;
        margin: 4px 0;
      }
      .lp-check {
        display: inline-block;
        width: 12px; height: 12px;
        border: 1.6px solid ${BRAND_GOLD};
        border-radius: 3px;
        flex: 0 0 auto;
      }

      .lp-vocab {
        width: 100%; border-collapse: separate; border-spacing: 0;
        border-radius: 6px; overflow: hidden;
        border: 1px solid ${BRAND_PRIMARY}22;
      }
      .lp-vocab thead th {
        background: ${BRAND_PRIMARY};
        color: white;
        padding: 7px 12px;
        text-align: ${startSide};
        font-size: 10.5pt;
        font-weight: 800;
        font-family: ${headingFont};
      }
      .lp-vocab tbody td {
        padding: 7px 12px;
        text-align: ${startSide};
        font-size: 10.5pt;
        vertical-align: top;
        border-bottom: 1px solid ${BRAND_PRIMARY}15;
      }
      .lp-vocab tbody tr:last-child td { border-bottom: none; }
      .lp-vocab tbody tr.even { background: ${BRAND_GOLD}07; }
      .lp-vocab tbody tr.odd { background: white; }
      .lp-vocab-term {
        font-weight: 700;
        color: ${BRAND_PRIMARY};
        width: 30%;
      }

      /* Activities timeline */
      .lp-activities { display: flex; flex-direction: column; gap: 6px; position: relative; }
      .lp-activities::before {
        content: "";
        position: absolute;
        top: 18px; bottom: 18px;
        ${startSide}: 14px;
        width: 2px;
        background: repeating-linear-gradient(to bottom, ${BRAND_GOLD} 0 4px, transparent 4px 9px);
      }
      .lp-activity {
        display: flex; gap: 10px; align-items: flex-start;
        background: ${BRAND_PRIMARY}05;
        border-${startSide}: 4px solid ${BRAND_GOLD};
        padding: 8px 12px; border-radius: 4px;
        page-break-inside: avoid;
        position: relative;
      }
      .lp-activity-num {
        flex: 0 0 auto;
        width: 28px; height: 28px;
        background: ${BRAND_PRIMARY};
        color: white;
        border-radius: 50%;
        font-weight: 800; font-size: 10pt;
        font-family: ${headingFont};
        display: inline-flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 2px ${BRAND_GOLD}55;
        z-index: 1;
      }
      .lp-activity-body { flex: 1; min-width: 0; }
      .lp-activity-head {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 3px; flex-wrap: wrap;
      }
      .lp-activity-title { font-weight: 800; color: ${BRAND_PRIMARY}; flex: 1; font-size: ${Math.max(9.5, fontSizePt - 0.5)}pt; }
      .lp-activity-dur {
        display: inline-flex; align-items: center; gap: 3px;
        font-size: ${Math.max(8, fontSizePt - 2.5)}pt; color: ${BRAND_GOLD};
        background: ${BRAND_GOLD}18;
        padding: 2px 8px; border-radius: 999px; font-weight: 700;
      }
      .lp-activity-desc { font-size: ${Math.max(9.5, fontSizePt - 0.5)}pt; color: #222; margin: 0; }
      /* Linked-Hasaad-activity badge: a small, low-key inline reference
         that follows the description so the printed plan tells the
         teacher exactly which platform asset they wired this step to. */
      .lp-activity-ref {
        margin-top: 4px;
        display: inline-flex; align-items: center; gap: 5px;
        font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
        color: ${BRAND_PRIMARY};
        background: ${BRAND_GOLD}14;
        border: 1px dashed ${BRAND_GOLD}88;
        padding: 2px 8px; border-radius: 999px;
        max-width: 100%; flex-wrap: wrap;
      }
      .lp-activity-ref-icon { color: ${BRAND_GOLD}; font-weight: 800; }
      .lp-activity-ref-kind { font-weight: 800; color: ${BRAND_GOLD}; }
      .lp-activity-ref-title { color: #2a3431; font-weight: 600; }

      .lp-diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      @media (max-width: 600px) { .lp-diff-grid { grid-template-columns: 1fr; } }
      .lp-diff-card {
        padding: 8px 10px; border-radius: 6px;
        font-size: 10.5pt; line-height: 1.6;
        display: flex; flex-direction: column; gap: 3px;
      }
      .lp-diff-card strong { color: ${BRAND_PRIMARY}; font-weight: 800; }
      .lp-diff-support { background: ${BRAND_PRIMARY}0d; border-${startSide}: 3px solid ${BRAND_PRIMARY}; }
      .lp-diff-extension { background: ${BRAND_GOLD}12; border-${startSide}: 3px solid ${BRAND_GOLD}; }
      .lp-diff-extension strong { color: ${BRAND_GOLD}; }

      .lp-notes {
        white-space: pre-wrap;
        font-size: 11pt; color: #333;
        font-style: italic;
        background: ${BRAND_GOLD}08;
        padding: 8px 12px; border-radius: 4px;
        border-${startSide}: 3px solid ${BRAND_GOLD};
      }

      .lp-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${BRAND_PRIMARY}44;
        text-align: center;
        font-size: 9pt;
        color: #6a7370;
      }
      .lp-footer-note { font-style: italic; margin-bottom: 2mm; color: #555; }
      .lp-footer-brand {
        display: inline-flex; align-items: center; gap: 8px;
        font-weight: 700; color: ${BRAND_PRIMARY};
      }
      .lp-footer-dot {
        display: inline-block; width: 4px; height: 4px;
        background: ${BRAND_GOLD}; border-radius: 50%;
      }

      @page { size: A4; margin: 0; }
      @media print {
        html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        .no-print, .no-print * { display: none !important; }
        .print-host { background: white !important; padding: 0 !important; }
        .lp-page {
          box-shadow: none !important;
          border-radius: 0 !important;
          min-height: 297mm;
        }
        .lp-section, .lp-section::before,
        .lp-section-icon, .lp-section-dur,
        .lp-corner, .lp-meta-cell,
        .lp-kicker, .lp-divider-thick, .lp-divider-thin,
        .lp-vocab thead th, .lp-vocab tbody tr.even,
        .lp-activity, .lp-activity-num, .lp-activity-dur,
        .lp-activity-ref,
        .lp-ol li::before, .lp-diff-support, .lp-diff-extension,
        .lp-notes, .lp-footer-dot {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>
  );
}

/** Pluck a body-font stack from the chosen font key. "default" picks a
 *  language-appropriate stack; named choices map onto our installed Google
 *  Fonts. Unknown keys silently fall back to the default. */
export function resolveLpFont(font: LpFontFamily | undefined, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (font) {
    case "cairo":   return `'Cairo', 'Tajawal', 'Arial', sans-serif`;
    case "tajawal": return `'Tajawal', 'Cairo', 'Arial', sans-serif`;
    case "amiri":   return `'Amiri', 'Noto Naskh Arabic', serif`;
    case "naskh":   return `'Noto Naskh Arabic', 'Amiri', serif`;
    case "reem":    return `'Reem Kufi', 'Cairo', sans-serif`;
    case "inter":   return `'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif`;
    case "serif":   return ar ? `'Amiri', 'Noto Naskh Arabic', Georgia, serif` : `Georgia, 'Times New Roman', serif`;
    case "mono":    return `'JetBrains Mono', 'Courier New', monospace`;
    case "default":
    default:
      return ar
        ? `'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif`
        : `'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif`;
  }
}

/** Heading variant of the body font — bumps to a more display-style
 *  family when the body font is plain, but otherwise tracks the body. */
export function resolveLpHeadingFont(font: LpFontFamily | undefined, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  if (!font || font === "default") {
    return ar ? `'Reem Kufi', 'Amiri', 'Cairo', sans-serif` : `'Inter', 'Source Sans Pro', sans-serif`;
  }
  return resolveLpFont(font, lang);
}

/** Bound the chosen size into the same range we expose in the UI. */
export function clampFontSize(size: number | undefined): number {
  const n = typeof size === "number" && Number.isFinite(size) ? size : 11.5;
  return Math.min(18, Math.max(9, n));
}

/** Friendly Arabic / English label for the activity-ref kind enum. */
export function labelForRefKind(kind: ActivityRef["kind"], ar: boolean): string {
  if (ar) {
    if (kind === "assignment") return "واجب";
    return "درس فيديو";
  }
  if (kind === "assignment") return "Assignment";
  return "Video lesson";
}
