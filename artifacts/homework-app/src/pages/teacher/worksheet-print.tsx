import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { useParams, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/lib/nav-history";
import { toast } from "@/components/ui/sonner";
import { downloadAsWord, printToPdf, pdfExportErrorMessage } from "@/lib/print-export";
import { downloadVisualWorksheetWord, VisualWordExportError } from "@/lib/worksheet-word-visual";
import { WorksheetWordExportMenu } from "./worksheet-word-export-menu";
import { useWorksheetPreview } from "@/lib/use-worksheet-preview";
import { worksheetLogoUrl } from "@/lib/worksheet-logo";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  type ThemeId, type ThemeSpec, THEMES, THEME_BACKGROUNDS,
  resolveThemeHeadingFont,
  TabularHeader, ArabesqueHeader, BandHeader,
  PlayfulHeader, ClipboardHeader, MastheadHeader,
  type HeaderProps,
} from "./worksheet-themes";
import { CanvasLayerRenderer, type CanvasLayout } from "@/pages/teacher/worksheet-canvas-types";
import type { WorksheetSettings } from "@workspace/api-zod";
import { resolveImageUrl } from "@/lib/image-url";
import { WorksheetFormatPanel } from "./worksheet-format-panel";
import { WorksheetModeSwitch } from "./worksheet-workspace-controls";
import { MathText } from "@/components/math-text";
import { WorksheetActivityView, activityHeightMm } from "./worksheet-activity";
import { countWorksheetPages, fitBlockMessage } from "./worksheet-quick-setup";
import type { WorksheetActivity } from "@workspace/api-zod";
import { WorksheetQuestionVisual, type WorksheetVisual } from "./worksheet-question-visual";
import { contentDirection } from "@/lib/content-direction";
import QRCode from "react-qr-code";
import { Loader2, Download, ArrowLeft, FileType, Layout, Save, Scissors, PenLine, CheckCheck, Camera as CameraIcon, Minus, Plus, RotateCcw, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

interface QMcq { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
interface QTF { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
interface QShort { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number; activity?: WorksheetActivity }
interface QFill { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
interface QMatch { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
interface QTicTacToe { id: string; type: "tic_tac_toe"; prompt: string; cells: Array<{ text: string; category: string; imageUrl?: string }>; points?: number }
interface QWorkedProblem {
  id: string; type: "worked_problem"; prompt: string; points?: number;
  steps?: number; answer: string;
}
interface QExtendedResponse {
  id: string; type: "extended_response"; prompt: string; points?: number;
  lines?: number; answer?: string;
}
interface QErrorCorrection {
  id: string; type: "error_correction"; prompt: string; points?: number;
  incorrectText: string; correction: string; explanation?: string;
}
interface QWordBank {
  id: string; type: "word_bank"; prompt: string; points?: number;
  items: string[]; answers: string[];
}
interface QCompare {
  id: string; type: "compare"; prompt: string; points?: number;
  leftLabel: string; rightLabel: string;
  similarities?: string; differences?: string;
}
export type Question = (
  | QMcq | QTF | QShort | QFill | QMatch | QTicTacToe
  | QWorkedProblem | QExtendedResponse | QErrorCorrection | QWordBank | QCompare) & { visual?: WorksheetVisual };
type QuestionType = Question["type"];

interface AnswerItem {
  id: string;
  question: Question;
  questionLabel: string;
  text: string;
  continuation: boolean;
}
export type Settings = WorksheetSettings;
type QuestionStyle = NonNullable<Settings["questionStyles"]>[number];
type FieldStyle = NonNullable<QuestionStyle["fields"]>[number];
type FieldAlign = NonNullable<FieldStyle["align"]>;
type SelectedField = { questionId: string; key: string };
export type FontFamily = Settings["fontFamily"];
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
  linkedAssignmentId?: number | null;
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
  manualBreaks?: ReadonlySet<string>,
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
      case "short_answer": return base + (q.activity ? activityHeightMm(q.activity) : (q.lines ?? 2) * 9);
      case "fill_blank": return base + 3;
      case "matching": return base + q.pairs.length * lineH * 1.3;
      case "tic_tac_toe": return Math.max(185, base + 165);
      case "worked_problem": return base + Math.max(4, q.steps ?? 4) * 8 + 12;
      case "extended_response": return base + Math.max(3, q.lines ?? 6) * 8;
      case "error_correction": return base + 2 * 8 + 2 * 8 + 12;
      case "word_bank": return base + 18;
      case "compare": return base + 42;
    }
  };
  const pages: Question[][] = [];
  let page: Question[] = [];
  let used = 0;
  let limit = firstPageAvailMm;
  if (columns === 2) {
    for (let i = 0; i < questions.length; i += 2) {
      const forceBreak = manualBreaks?.has(questions[i].id) || (i + 1 < questions.length && manualBreaks?.has(questions[i + 1].id));
      const h = Math.max(est(questions[i]), i + 1 < questions.length ? est(questions[i + 1]) : 0) + GAP;
      if (page.length > 0 && (forceBreak || used + h > limit)) { pages.push(page); page = []; used = 0; limit = otherPageAvailMm; }
      page.push(questions[i]);
      if (i + 1 < questions.length) page.push(questions[i + 1]);
      used += h;
    }
  } else {
    for (const q of questions) {
      const forceBreak = manualBreaks?.has(q.id);
      const h = est(q) + GAP;
      if (page.length > 0 && (forceBreak || used + h > limit)) { pages.push(page); page = []; used = 0; limit = otherPageAvailMm; }
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
/** Inject a theme's CSS overrides after the base PrintStyles. */
function ThemeStyles({ theme, TC, GOLD, BG, fontFamily, headingFont, fontSizePt, lang }: {
  theme: ThemeSpec; TC: string; GOLD: string; BG: string;
  fontFamily: string; headingFont: string; fontSizePt: number; lang: "ar" | "en";
}) {
  const isAr = lang === "ar";
  const startSide = isAr ? "right" : "left" as const;
  const endSide = isAr ? "left" : "right" as const;
  return <style>{theme.css({ TC, GOLD, BG, fontFamily, headingFont, fontSizePt, isAr, startSide, endSide })}</style>;
}

/** Build the themed header element given a resolved theme or fall back to classic. */
function ThemedHeader({
  theme, data, labels, TC, GOLD, ar, hasIdentity, customFields, classicFallback,
}: {
  theme: ThemeSpec | undefined;
  data: WorksheetData;
  labels: Record<string, string>;
  TC: string; GOLD: string; ar: boolean;
  hasIdentity: boolean;
  customFields: Array<{ label: string; value: string }>;
  classicFallback: React.ReactNode;
}): React.ReactNode {
  if (!theme) return classicFallback;
  const props: HeaderProps = {
    data, labels, TC, GOLD, ar, hasIdentity, customFields,
    IdentityCell: () => null, FieldLine: () => null, DoubleDivider: () => null,
    IconUser: () => null, IconClass: () => null, IconDate: () => null,
    IconLightbulb: () => null, IconSchool: () => null, IconSection: () => null,
    IconTeacher: () => null, IconField: () => null,
  };
  switch (theme.headerLayout) {
    case "tabular":   return <TabularHeader {...props} />;
    case "arabesque": return <ArabesqueHeader {...props} />;
    case "band":      return <BandHeader {...props} />;
    case "playful":   return <PlayfulHeader {...props} />;
    case "clipboard": return <ClipboardHeader {...props} />;
    case "masthead":  return <MastheadHeader {...props} />;
    default:          return classicFallback;
  }
}

/**
 * Reusable printable view. Supports automatic A4 pagination, custom
 * theme color, design themes, and school logo in the header. The wrapper
 * element gets id `ws-printable-root` so the Word exporter can grab the
 * right subtree.
 *
 * Pass `onLayoutChange` to enable the "Page Layout" editing panel that
 * lets teachers redistribute questions across pages and add manual page
 * breaks. When the teacher saves layout changes this callback fires with
 * the updated questions array and page-break IDs.
 */
export interface LayoutSnapshot { questions: Question[]; pageBreaks: string[]; questionStyles: QuestionStyle[] }
const EMPTY_STYLES: QuestionStyle[] = [];

export function WorksheetPrintView({
  data,
  onLayoutChange,
  onDraftChange,
  flushRef,
  onRequestSave,
  onRequestDiscard,
  onRequestEdit,
  initialEditQuestionId,
  editing,
  onEditingChange,
}: {
  data: WorksheetData;
  /** Controlled edit mode. When defined the parent owns edit/preview and the internal toggle is hidden. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** Read-only embeddings: shows a per-question edit pencil that hands editing to the owner (e.g. the full editor). */
  onRequestEdit?: (questionId: string) => void;
  /** Opens directly in edit mode with this question selected. */
  initialEditQuestionId?: string | null;
  /** When set, internal Save buttons persist through the owner instead of just committing a draft. */
  onRequestSave?: () => void;
  /** When set, internal Discard restores the owner's saved baseline. */
  onRequestDiscard?: () => void;
  onLayoutChange?: (newQuestions: Question[], newPageBreaks: string[], questionStyles: QuestionStyle[]) => void;
  /** Fires on every committed question/style/break edit so the parent holds the canonical live data. */
  onDraftChange?: (snapshot: LayoutSnapshot) => void;
  /** Receives a function that commits any in-progress inline edit and returns the latest snapshot synchronously. */
  flushRef?: { current: (() => LayoutSnapshot) | null };
}) {
  const ar = data.language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const fontFamily = resolveFont(data.settings.fontFamily, data.language);
  const baseHeadingFont = resolveHeadingFont(data.language);

  // ── Resolve active design theme ──
  const themeId = data.settings.template;
  const theme = themeId ? THEMES[themeId] : undefined;
  const themeBg = themeId ? (THEME_BACKGROUNDS[themeId] ?? "white") : "white";

  // Theme can override heading font (e.g. Amiri for Arabic Ink)
  const headingFont = resolveThemeHeadingFont(themeId, baseHeadingFont);

  const fontSizePt = Math.min(18, Math.max(9, data.settings.fontSizePt ?? 12));
  const showWatermark = data.settings.showWatermark !== false;
  // Teacher's manual color always wins; theme provides a default; fallback to brand green
  const themeColor = data.settings.themeColor ?? theme?.defaultColor ?? BRAND_PRIMARY;
  const logoUrl = worksheetLogoUrl(data.settings.logoUrl);

  // ── Local layout-editing state ─────────────────────────────────────────
  const [localQs, setLocalQs] = useState<Question[]>(data.questions);
  const localQsRef = useRef<Question[]>(data.questions);
  const [localBreaks, setLocalBreaksState] = useState<Set<string>>(
    () => new Set(data.settings.pageBreaks ?? []),
  );
  const localBreaksRef = useRef<Set<string>>(localBreaks);
  const setLocalBreaks = useCallback((next: Set<string> | ((p: Set<string>) => Set<string>)) => {
    const value = typeof next === "function" ? next(localBreaksRef.current) : next;
    localBreaksRef.current = value;
    setLocalBreaksState(value);
  }, []);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const snapshot = useCallback((): LayoutSnapshot => ({
    questions: localQsRef.current,
    pageBreaks: [...localBreaksRef.current],
    questionStyles: localQuestionStylesRef.current,
  }), []);
  const notifyDraft = useCallback(() => { onDraftChangeRef.current?.(snapshot()); }, [snapshot]);
  if (flushRef) {
    flushRef.current = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && active.closest("#ws-printable-root")) active.blur();
      return snapshot();
    };
  }
  const [localQuestionStyles, setLocalQuestionStyles] = useState<QuestionStyle[]>(
    () => data.settings.questionStyles ?? [],
  );
  const localQuestionStylesRef = useRef<QuestionStyle[]>(data.settings.questionStyles ?? []);
  const [selectedField, setSelectedField] = useState<SelectedField | null>(
    initialEditQuestionId && onLayoutChange ? { questionId: initialEditQuestionId, key: "prompt" } : null,
  );
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem("hasad:ws:edit-hint-seen") === "1"; } catch { return true; }
  });
  const dismissHint = useCallback(() => {
    setHintSeen(true);
    try { localStorage.setItem("hasad:ws:edit-hint-seen", "1"); } catch { /* ignore */ }
  }, []);
  const startEditingQuestion = useCallback((questionId: string) => {
    if (onLayoutChange) {
      setEditMode(true);
      setSelectedField({ questionId, key: "prompt" });
      dismissHint();
    } else {
      onRequestEdit?.(questionId);
    }
  }, [onLayoutChange, onRequestEdit, dismissHint]);

  // IDs of questions that are the first in a consecutive run of the same type.
  // These get a one-time section instruction printed above them.
  const firstOfTypeSet = useMemo(() => {
    const set = new Set<string>();
    let prev: Question["type"] | null = null;
    for (const q of localQs) {
      if (q.type !== prev) { set.add(q.id); prev = q.type; }
    }
    return set;
  }, [localQs]);
  const [showPanel, setShowPanel] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  // ── Inline text-editing state ──────────────────────────────────────────
  const controlled = editing !== undefined;
  const [editModeState, setEditModeState] = useState(!!initialEditQuestionId && !!onLayoutChange);
  const editMode = controlled ? !!editing : editModeState;
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  const setEditMode = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(editModeRef.current) : next;
    editModeRef.current = value;
    setEditModeState(value);
    onEditingChangeRef.current?.(value);
  }, []);
  useEffect(() => { if (!editMode) setSelectedField(null); }, [editMode]);
  const [dragQId, setDragQId] = useState<string | null>(null);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);

  // Sync from the parent only when the parent genuinely replaced questions /
  // styles / breaks. Header, theme and other settings edits, and the echo of
  // our own draft notifications, must never reset uncommitted local edits.
  const prevQsPropRef = useRef(data.questions);
  const prevStylesPropRef = useRef(data.settings.questionStyles ?? EMPTY_STYLES);
  const prevBreaksPropRef = useRef((data.settings.pageBreaks ?? []).join(","));
  useEffect(() => {
    const nextStyles = data.settings.questionStyles ?? EMPTY_STYLES;
    const nextBreaksKey = (data.settings.pageBreaks ?? []).join(",");
    let changed = false;
    if (prevQsPropRef.current !== data.questions) {
      prevQsPropRef.current = data.questions;
      if (data.questions !== localQsRef.current) {
        localQsRef.current = data.questions;
        setLocalQs(data.questions);
        changed = true;
      }
    }
    if (prevStylesPropRef.current !== nextStyles) {
      prevStylesPropRef.current = nextStyles;
      if (nextStyles !== localQuestionStylesRef.current) {
        localQuestionStylesRef.current = nextStyles;
        setLocalQuestionStyles(nextStyles);
        changed = true;
      }
    }
    if (prevBreaksPropRef.current !== nextBreaksKey) {
      prevBreaksPropRef.current = nextBreaksKey;
      if ([...localBreaksRef.current].join(",") !== nextBreaksKey) {
        setLocalBreaks(new Set(data.settings.pageBreaks ?? []));
        changed = true;
      }
    }
    if (changed) { setSelectedField(null); setLayoutDirty(false); }
  }, [data, setLocalBreaks]);

  const addBreak = useCallback((qId: string) => {
    setLocalBreaks(prev => { const n = new Set(prev); n.add(qId); return n; });
    setLayoutDirty(true);
    notifyDraft();
  }, [notifyDraft, setLocalBreaks]);

  const removeBreak = useCallback((qId: string) => {
    setLocalBreaks(prev => { const n = new Set(prev); n.delete(qId); return n; });
    setLayoutDirty(true);
    notifyDraft();
  }, [notifyDraft, setLocalBreaks]);

  const saveLayout = useCallback(() => {
    if (onRequestSave) { onRequestSave(); return; }
    onLayoutChange?.(localQsRef.current, [...localBreaksRef.current], localQuestionStylesRef.current);
    setLayoutDirty(false);
  }, [onLayoutChange, onRequestSave]);

  const discardLayoutChanges = useCallback(() => {
    if (onRequestDiscard) {
      onRequestDiscard();
      setSelectedField(null);
      setLayoutDirty(false);
      if (!controlled) setEditMode(false);
      return;
    }
    localQsRef.current = data.questions;
    setLocalQs(data.questions);
    setLocalBreaks(new Set(data.settings.pageBreaks ?? []));
    const nextQuestionStyles = data.settings.questionStyles ?? [];
    localQuestionStylesRef.current = nextQuestionStyles;
    setLocalQuestionStyles(nextQuestionStyles);
    setSelectedField(null);
    setLayoutDirty(false);
    if (!controlled) setEditMode(false);
  }, [data, onRequestDiscard, controlled, setEditMode]);

  // Update a single question in-place (called by QuestionView on text blur)
  const onEditQuestion = useCallback((updated: Question) => {
    const nextQuestions = localQsRef.current.map(q => q.id === updated.id ? updated : q);
    localQsRef.current = nextQuestions;
    setLocalQs(nextQuestions);
    setLocalBreaks(new Set());
    setLayoutDirty(true);
    notifyDraft();
  }, [notifyDraft, setLocalBreaks]);

  const updateQuestionStyle = useCallback((questionId: string, update: (current: QuestionStyle) => QuestionStyle) => {
    const currentStyles = localQuestionStylesRef.current;
    const current = currentStyles.find(style => style.questionId === questionId) ?? { questionId };
    const next = update(current);
    const nextStyles = [...currentStyles.filter(style => style.questionId !== questionId), next];
    localQuestionStylesRef.current = nextStyles;
    setLocalQuestionStyles(nextStyles);
    setLocalBreaks(new Set());
    setLayoutDirty(true);
    notifyDraft();
  }, [notifyDraft, setLocalBreaks]);

  const updateFieldStyle = useCallback((questionId: string, key: string, patch: Partial<Omit<FieldStyle, "key">>) => {
    updateQuestionStyle(questionId, current => {
      const fields = current.fields ?? [];
      const existing = fields.find(field => field.key === key) ?? { key };
      return {
        ...current,
        fields: [...fields.filter(field => field.key !== key), { ...existing, ...patch }],
      };
    });
  }, [updateQuestionStyle]);

  const resetSelectedStyle = useCallback(() => {
    if (!selectedField) return;
    updateQuestionStyle(selectedField.questionId, current => ({
      ...current,
      fields: (current.fields ?? []).filter(field => field.key !== selectedField.key),
    }));
  }, [selectedField, updateQuestionStyle]);

  const handleDropOnPage = useCallback((targetPageIndex: number) => {
    if (!dragQId) return;
    setDragOverPage(null);
    setDragQId(null);
    const previousQuestions = localQsRef.current;
    const currentPages = paginateByEstimate(previousQuestions, fontSizePt, data.settings.columns, 190, 250, localBreaks);
    const targetPage = currentPages[targetPageIndex];
    if (!targetPage || targetPage.length === 0) return;
    const targetFirstQId = targetPage[0].id;
    if (targetFirstQId === dragQId) return;
    const questionToMove = previousQuestions.find(q => q.id === dragQId);
    if (!questionToMove) return;
    const without = previousQuestions.filter(q => q.id !== dragQId);
    const insertIndex = without.findIndex(q => q.id === targetFirstQId);
    const nextQuestions = insertIndex === -1
      ? [...without, questionToMove]
      : [...without.slice(0, insertIndex), questionToMove, ...without.slice(insertIndex)];
    localQsRef.current = nextQuestions;
    setLocalQs(nextQuestions);
    setLayoutDirty(true);
    notifyDraft();
  }, [dragQId, fontSizePt, data.settings.columns, localBreaks, notifyDraft]);

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
  const answerItems = buildAnswerItems(localQs, ar, labels);
  const [answerPages, setAnswerPages] = useState<AnswerItem[][]>(() => [answerItems]);
  const measureRef = useRef<HTMLDivElement>(null);
  const previewRef = useWorksheetPreview();
  const lastKeyRef = useRef("");

  // Font readiness: a late-loading body/heading font changes text metrics, so
  // bump an epoch that invalidates the measurement key and re-runs the
  // rendered-overflow guards once fonts settle (pagination algorithm unchanged).
  const [fontEpoch, setFontEpoch] = useState(0);
  const fontSignature = `${fontFamily}|${headingFont}`;
  useEffect(() => {
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) return;
    let alive = true;
    const bump = () => { if (alive) setFontEpoch(n => n + 1); };
    void fonts.ready.then(bump).catch(() => undefined);
    fonts.addEventListener?.("loadingdone", bump);
    return () => { alive = false; fonts.removeEventListener?.("loadingdone", bump); };
  }, [fontSignature]);

  // After each render, measure actual heights and re-paginate
  useLayoutEffect(() => {
    const key = [
      JSON.stringify(localQs),
      data.title, data.subject ?? "", data.gradeLevel ?? "",
      cols, fontSizePt,
      data.settings.schoolName ?? "", data.settings.section ?? "",
      data.settings.teacherName ?? "", logoUrl ? "logo" : "",
      data.settings.includeName ? "n" : "",
      data.settings.includeDate ? "d" : "",
      data.settings.includeClass ? "c" : "",
      data.settings.instructions ?? "",
      data.settings.headerNote ?? "", data.settings.footerNote ?? "",
      data.settings.goodLuck ?? "", JSON.stringify(customFields),
      data.settings.learningObjective ?? "", data.settings.activityDuration ?? "",
      themeId ?? "",
      [...localBreaks].sort().join(","),
      JSON.stringify(localQuestionStyles),
      fontSignature, fontEpoch,
    ].join("|");
    if (key === lastKeyRef.current) return;
    const root = measureRef.current;
    if (!root) return;
    const qEls = Array.from(root.querySelectorAll("[data-q-measure]")) as HTMLElement[];
    if (qEls.length !== localQs.length) return;
    const headerEl = root.querySelector("[data-header-measure]") as HTMLElement | null;
    const continuationEl = root.querySelector("[data-continuation-measure]") as HTMLElement | null;
    const footerEl = root.querySelector("[data-footer-measure]") as HTMLElement | null;
    const answerEls = Array.from(root.querySelectorAll("[data-answer-measure]")) as HTMLElement[];
    const answerHeaderEl = root.querySelector("[data-answer-header-measure]") as HTMLElement | null;
    const answerContinuationEl = root.querySelector("[data-answer-continuation-measure]") as HTMLElement | null;
    lastKeyRef.current = key;

    const PX_MM = 3.7795;
    const contentH = (297 - 18 - 16) * PX_MM;
    const headerH = headerEl ? headerEl.offsetHeight : 60 * PX_MM;
    const continuationH = continuationEl ? continuationEl.offsetHeight : 12 * PX_MM;
    const footerH = footerEl ? footerEl.offsetHeight : 18 * PX_MM;
    // هامش أمان: القوالب تضيف هوامش/إطارات لا تدخل في القياس، وأي تجاوز
    // ولو ببكسلات يقسم الصفحة المطبوعة إلى صفحتين (شريحة مكررة).
    const SAFETY_FIRST = 12 * PX_MM;
    const SAFETY_OTHER = 8 * PX_MM;
    const firstPageH = Math.max(contentH - headerH - footerH - SAFETY_FIRST, 80 * PX_MM);
    const otherPageH = Math.max(contentH - footerH - continuationH - SAFETY_OTHER, 150 * PX_MM);
    const GAP = 4 * PX_MM;
    const heights = qEls.map(el => el.offsetHeight + GAP);
    const newPages: Question[][] = [];
    let page: Question[] = [];
    let usedH = 0;
    let limit = firstPageH;
    if (cols === 2) {
      for (let i = 0; i < localQs.length; i += 2) {
        const rowH = Math.max(heights[i] ?? 0, heights[i + 1] ?? 0);
        const forceBreak = localBreaks.has(localQs[i].id) || (i + 1 < localQs.length && localBreaks.has(localQs[i + 1].id));
        if (page.length > 0 && (forceBreak || usedH + rowH > limit)) { newPages.push(page); page = []; usedH = 0; limit = otherPageH; }
        page.push(localQs[i]);
        if (i + 1 < localQs.length) page.push(localQs[i + 1]);
        usedH += rowH;
      }
    } else {
      for (let i = 0; i < localQs.length; i++) {
        const h = heights[i];
        if (page.length > 0 && (localBreaks.has(localQs[i].id) || usedH + h > limit)) { newPages.push(page); page = []; usedH = 0; limit = otherPageH; }
        page.push(localQs[i]);
        usedH += h;
      }
    }
    if (page.length > 0) newPages.push(page);
    if (newPages.length > 0) setPages(newPages);

    if (answerEls.length === answerItems.length && answerItems.length > 0) {
      const answerHeaderH = answerHeaderEl ? answerHeaderEl.offsetHeight : 38 * PX_MM;
      const answerContinuationH = answerContinuationEl ? answerContinuationEl.offsetHeight : 12 * PX_MM;
      // Answer rows are simpler than worksheet questions and the final visible
      // page guard below catches any remaining font/theme variance. A smaller
      // reserve keeps compact keys on one sheet as they were before pagination.
      const ANSWER_SAFETY_FIRST = 4 * PX_MM;
      const ANSWER_SAFETY_OTHER = 3 * PX_MM;
      const answerFirstH = Math.max(contentH - answerHeaderH - footerH - ANSWER_SAFETY_FIRST, 80 * PX_MM);
      const answerOtherH = Math.max(contentH - answerContinuationH - footerH - ANSWER_SAFETY_OTHER, 150 * PX_MM);
      const nextAnswerPages: AnswerItem[][] = [];
      let answerPage: AnswerItem[] = [];
      let answerUsedH = 0;
      let answerLimit = answerFirstH;

      const measureAnswerPart = (template: HTMLElement, text: string, continuation: boolean) => {
        const clone = template.cloneNode(true) as HTMLElement;
        const line = clone.querySelector<HTMLElement>(".ws-answer-line");
        const prompt = clone.querySelector<HTMLElement>(".ws-q-prompt");
        if (line) line.textContent = `${continuation ? (ar ? "تابع الإجابة:" : "Answer continued:") : labels.correct} ${text}`;
        if (continuation && prompt) prompt.append(` (${ar ? "تابع" : "continued"})`);
        root.appendChild(clone);
        const height = clone.offsetHeight + GAP;
        clone.remove();
        return height;
      };

      const fittingPrefixLength = (
        template: HTMLElement,
        text: string,
        continuation: boolean,
        maxHeight: number,
      ) => {
        let low = 1;
        let high = text.length;
        let best = 0;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          if (measureAnswerPart(template, text.slice(0, middle), continuation) <= maxHeight) {
            best = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
        if (best <= 0) return 0;
        const whitespace = Math.max(
          text.lastIndexOf(" ", best),
          text.lastIndexOf("\n", best),
          text.lastIndexOf("\t", best),
        );
        let splitAt = whitespace >= Math.floor(best * 0.6) ? whitespace : best;
        // Do not split a UTF-16 surrogate pair when forced to break a long token.
        if (splitAt > 0 && /[\uD800-\uDBFF]/.test(text[splitAt - 1] ?? "")) splitAt -= 1;
        return Math.max(1, splitAt);
      };

      for (let i = 0; i < answerItems.length; i++) {
        const baseItem = answerItems[i];
        const template = answerEls[i];
        let remaining = baseItem.text;
        let partIndex = 0;
        while (remaining) {
          const continuation = baseItem.continuation || partIndex > 0;
          const item: AnswerItem = {
            ...baseItem,
            id: `${baseItem.id}:${partIndex}`,
            text: remaining,
            continuation,
          };
          const h = measureAnswerPart(template, remaining, continuation);
          if (answerUsedH + h <= answerLimit) {
            answerPage.push(item);
            answerUsedH += h;
            break;
          }
          if (answerPage.length > 0) {
            nextAnswerPages.push(answerPage);
            answerPage = [];
            answerUsedH = 0;
            answerLimit = answerOtherH;
            continue;
          }

          const prefixLength = fittingPrefixLength(template, remaining, continuation, answerLimit);
          if (prefixLength <= 0 || prefixLength >= remaining.length) {
            // The visible-page guard will continue bisecting if an unexpected
            // theme/font discrepancy still leaves this measured item too tall.
            answerPage.push(item);
            answerUsedH = h;
            break;
          }
          const prefix = remaining.slice(0, prefixLength).trimEnd();
          answerPage.push({ ...item, text: prefix });
          nextAnswerPages.push(answerPage);
          answerPage = [];
          answerUsedH = 0;
          answerLimit = answerOtherH;
          remaining = remaining.slice(prefixLength).trimStart();
          partIndex += 1;
        }
      }
      if (answerPage.length > 0) nextAnswerPages.push(answerPage);
      setAnswerPages(nextAnswerPages);
    } else if (localQs.length === 0) {
      setAnswerPages([[]]);
    }
  });

  // Final rendered-height guard. Font loading and theme selectors can make the
  // visible page taller than the hidden estimate. Move one trailing question
  // at a time until every worksheet article fits a physical A4 sheet.
  useLayoutEffect(() => {
    const root = document.getElementById("ws-printable-root");
    if (!root) return;
    const pageEls = Array.from(root.querySelectorAll<HTMLElement>("[data-worksheet-page]"));
    const a4HeightPx = (297 / 25.4) * 96;
    // offsetHeight is the unscaled layout height, including on a fitted phone preview.
    const overflowIndex = pageEls.findIndex((page) => page.offsetHeight > a4HeightPx + 2);
    if (overflowIndex < 0) return;
    // A complete identity header and one large question may each fit A4,
    // but not together. Keep the header as a real first page instead of
    // letting the browser create an uncounted physical page. Never keep
    // moving an oversized continuation singleton: that would loop forever.
    const firstPageSingleton = overflowIndex === 0 && pages[0]?.length === 1;
    if ((pages[overflowIndex]?.length ?? 0) <= 1 && !firstPageSingleton) return;

    setPages(prev => {
      const next = prev.map(page => [...page]);
      const moved = next[overflowIndex].pop();
      if (!moved) return prev;
      if (next[overflowIndex + 1]) next[overflowIndex + 1].unshift(moved);
      else next.push([moved]);
      return next;
    });
  }, [pages, fontEpoch, fontSignature]);

  // Answer keys need the same rendered-height protection as worksheet pages:
  // a long answer or a late-loading font must never make Chromium create an
  // unrepresented physical PDF page.
  useLayoutEffect(() => {
    if (!data.settings.includeAnswerKey) return;
    const root = document.getElementById("ws-printable-root");
    if (!root) return;
    const pageEls = Array.from(root.querySelectorAll<HTMLElement>("[data-answer-key-page]"));
    const a4HeightPx = (297 / 25.4) * 96;
    const overflowIndex = pageEls.findIndex((page) => page.offsetHeight > a4HeightPx + 2);
    if (overflowIndex < 0) return;

    setAnswerPages(prev => {
      const next = prev.map(page => [...page]);
      if (next[overflowIndex].length === 1) {
        const split = splitAnswerItemHalf(next[overflowIndex][0]);
        if (!split) return prev;
        next[overflowIndex] = [split[0]];
        if (next[overflowIndex + 1]) next[overflowIndex + 1].unshift(split[1]);
        else next.push([split[1]]);
        return next;
      }
      const moved = next[overflowIndex].pop();
      if (!moved) return prev;
      if (next[overflowIndex + 1]) next[overflowIndex + 1].unshift(moved);
      else next.push([moved]);
      return next;
    });
  }, [answerPages, data.settings.includeAnswerKey, fontEpoch, fontSignature]);

  // ── Classic (default) header — used when no theme is active ──
  const classicHeader = (
    <header className="ws-header">
      {/* Three-column row: identity (right) | title (center) | logo (left).
          Both side columns are fixed width so the title stays truly centered
          and the logo faces the identity text at exactly the same height.
          dir is forced so the flex order is right→center→left in Arabic. */}
      <div
        className={`ws-headrow${!logoUrl && !data.settings.schoolName && !data.settings.section && !data.settings.teacherName && customFields.length === 0 ? " ws-headrow-title-only" : ""}`}
        dir={ar ? "rtl" : "ltr"}
      >
        {/* START side (right in Arabic): teacher-written identity info */}
        <div className="ws-headstart">
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
        {/* CENTER: worksheet title */}
        <div className="ws-headcenter">
          <h1 className="ws-title">{data.title}</h1>
          {(data.subject || data.gradeLevel) && (
            <div className="ws-kicker-center">{[data.subject, data.gradeLevel].filter(Boolean).join(" · ")}</div>
          )}
          <DoubleDivider />
        </div>
        {/* END side (left in Arabic): school logo — mirrors the identity column */}
        <div className="ws-headend">
          {logoUrl && (
            <img src={logoUrl} alt={ar ? "شعار المدرسة" : "School logo"} className="ws-logo-img" />
          )}
        </div>
      </div>
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div className="ws-fields">
          {data.settings.includeName && <FieldLine label={labels.name} icon={<IconUser />} />}
          {data.settings.includeClass && <FieldLine label={labels.clazz} icon={<IconClass />} short />}
          {data.settings.includeDate && <FieldLine label={labels.date} icon={<IconDate />} short />}
        </div>
      )}
      {data.settings.headerNote && <p className="ws-subtitle">{data.settings.headerNote}</p>}
      {data.settings.learningObjective && (
        <div className="ws-learning-objective">
          <strong>{ar ? "هدف الورقة:" : "Learning objective:"}</strong>
          <span>{data.settings.learningObjective}</span>
          {data.settings.activityDuration && (
            <small>{ar ? `${data.settings.activityDuration} دقيقة` : `${data.settings.activityDuration} min`}</small>
          )}
        </div>
      )}
      {data.settings.instructions && (
        <div className="ws-instructions">
          <IconLightbulb />
          <div><strong>{labels.instructions}</strong><span> {data.settings.instructions}</span></div>
        </div>
      )}
    </header>
  );

  // ── Resolve the correct header for page 1 ──
  const page1Header = (
    <ThemedHeader
      theme={theme}
      data={data}
      labels={labels}
      TC={themeColor}
      GOLD={BRAND_GOLD}
      ar={ar}
      hasIdentity={hasIdentity}
      customFields={customFields}
      classicFallback={classicHeader}
    />
  );

  const qColWidth = cols === 2 ? "calc((174mm - 8mm) / 2)" : "174mm";
  // The page class includes the theme modifier when a theme is active
  const pageClass = `ws-page${themeId ? ` ws-theme-${themeId}` : ""}`;
  // Use theme background for the screen wrapper tint
  const hostBg = "bg-neutral-200";
  const selectedQuestion = selectedField ? localQs.find(q => q.id === selectedField.questionId) : undefined;
  const selectedQuestionStyle = selectedField
    ? localQuestionStyles.find(style => style.questionId === selectedField.questionId)
    : undefined;
  const selectedTextStyle = selectedField
    ? selectedQuestionStyle?.fields?.find(field => field.key === selectedField.key)
    : undefined;

  useEffect(() => {
    if (!selectedField) return;
    const frame = window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 640px)").matches) return;
      const activeField = document.activeElement;
      const toolbar = document.querySelector<HTMLElement>(".ws-format-toolbar");
      if (!(activeField instanceof HTMLElement) || !activeField.matches(".ws-editable") || !toolbar) return;
      const fieldRect = activeField.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const scrollOffset = mobileToolbarScrollOffset(fieldRect.bottom, toolbarRect.top);
      if (scrollOffset > 0) {
        window.scrollBy({ top: scrollOffset, behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedField]);

  return (
    <>
      <PrintStyles fontFamily={fontFamily} headingFont={headingFont} fontSizePt={fontSizePt} lang={data.language} themeColor={themeColor} />
      <EditorChromeStyles TC={themeColor} />
      {/* Theme-specific CSS overrides injected after the base styles */}
      {theme && (
        <ThemeStyles
          theme={theme}
          TC={themeColor}
          GOLD={BRAND_GOLD}
          BG={themeBg}
          fontFamily={fontFamily}
          headingFont={headingFont}
          fontSizePt={fontSizePt}
          lang={data.language}
        />
      )}

      {/* ── Hidden measurement div ───────────────────────────────── */}
      <div
        ref={measureRef}
        aria-hidden="true"
        // فئة القالب ضرورية هنا: بدونها تُقاس الأسئلة بالتنسيق الافتراضي
        // بينما تُعرض ببطاقات القالب الأكبر، فتمتلئ الصفحة أكثر من طاقتها
        // وتنقسم عند الطباعة إلى صفحات مكررة.
        className={`no-print print-host${themeId ? ` ws-theme-${themeId}` : ""}`}
        style={{ position: "fixed", left: 0, top: 0, width: "210mm", height: 0, overflow: "hidden", visibility: "hidden", pointerEvents: "none" }}
        dir={dir}
      >
        <div data-header-measure style={{ width: "174mm" }}>{page1Header}</div>
        <div data-continuation-measure style={{ width: "174mm" }}>
          <div className="ws-cont-header">
            <span className="ws-cont-title">{data.title}</span>
            <span className="ws-cont-page">{ar ? "صفحة 2" : "Page 2"}</span>
          </div>
        </div>
        {localQs.map((q, i) => (
          <div key={q.id} data-q-measure style={{ width: qColWidth }}>
            <QuestionView
              index={String(i + 1)}
              q={q}
              ar={ar}
              labels={labels}
              showTypeHeader={firstOfTypeSet.has(q.id)}
              questionStyle={localQuestionStyles.find(style => style.questionId === q.id)}
            />
          </div>
        ))}
        <div data-footer-measure style={{ width: "174mm" }}>
          <FooterStrip
            note={data.settings.footerNote}
            goodLuck={data.settings.goodLuck?.trim() || labels.goodLuck}
          />
        </div>
        <div data-answer-header-measure style={{ width: "174mm" }}>
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
        </div>
        <div data-answer-continuation-measure style={{ width: "174mm" }}>
          <div className="ws-cont-header">
            <span className="ws-cont-title">{labels.answerKey} · {data.title}</span>
            <span className="ws-cont-page">{ar ? "صفحة متابعة" : "Continued"}</span>
          </div>
        </div>
        {answerItems.map(item => (
          <div key={`answer-${item.id}`} data-answer-measure style={{ width: "174mm" }}>
            <AnswerView item={item} ar={ar} labels={labels} />
          </div>
        ))}
      </div>

      {/* ── Edit strip: one in-flow control row (no floating pill) ── */}
      {onLayoutChange && (!controlled || editMode) && (
        <div
          className="no-print ws-edit-strip"
          dir={dir}
          role="group"
          aria-label={ar ? "أدوات التعديل" : "Edit tools"}
          data-testid="strip-worksheet-edit"
        >
          {!controlled && (
          <button
              type="button"
              className={`ws-strip-btn ${editMode ? "is-primary" : ""}`}
              data-testid="button-toggle-edit-mode"
              aria-pressed={editMode}
              onClick={() => {
                setEditMode(v => {
                  if (v) setSelectedField(null);
                  return !v;
                });
                dismissHint();
              }}
            >
              <PenLine style={{ width: 14, height: 14 }} />
              {editMode
                ? (ar ? "إنهاء التعديل" : "Done editing")
                : (ar ? "تحرير الورقة" : "Edit worksheet")}
            </button>
          )}
          {editMode && layoutDirty && (
            <button
              type="button"
              className="ws-strip-btn"
              onClick={discardLayoutChanges}
              data-testid="button-strip-discard"
              title={ar ? "إلغاء تعديلات هذه الجلسة والعودة إلى آخر نسخة محفوظة" : "Discard this session's changes"}
            >
              {ar ? "تجاهل التعديلات" : "Discard"}
            </button>
          )}
          {editMode && localBreaks.size > 0 && (
            <button
              type="button"
              className="ws-strip-btn"
              data-testid="button-auto-layout"
              onClick={() => {
                setLocalBreaks(new Set());
                setLayoutDirty(true);
                notifyDraft();
              }}
              title={ar ? "إزالة فواصل الصفحات اليدوية وإعادة توزيع الأسئلة" : "Remove manual page breaks and repaginate"}
            >
              {ar ? "توزيع تلقائي" : "Auto layout"}
            </button>
          )}
          {!hintSeen && (controlled ? editMode : !editMode) && (
            <span className="ws-edit-hint" role="note" data-testid="hint-edit-first-use">
              {ar ? "انقر على أي نص في الورقة لتعديله مباشرة، أو على القلم بجانب السؤال." : "Click any text on the paper to edit it, or use the pencil beside a question."}
              <button type="button" onClick={dismissHint} aria-label={ar ? "إخفاء التلميح" : "Dismiss hint"} data-testid="button-dismiss-edit-hint">
                {ar ? "فهمت" : "Got it"}
              </button>
            </span>
          )}
        </div>
      )}

      {editMode && selectedField && selectedQuestion && (
        <QuestionFormattingToolbar
          ar={ar}
          question={selectedQuestion}
          questionNumber={localQs.findIndex(question => question.id === selectedQuestion.id) + 1}
          questionStyle={selectedQuestionStyle}
          fieldStyle={selectedTextStyle}
          onFieldChange={patch => updateFieldStyle(selectedField.questionId, selectedField.key, patch)}
          onQuestionChange={patch => updateQuestionStyle(selectedField.questionId, current => ({ ...current, ...patch }))}
          onQuestionTypeChange={type => {
            const nextQuestions = localQsRef.current.map(question =>
              question.id === selectedField.questionId
                ? convertQuestionType(question, type, ar)
                : question,
            );
            localQsRef.current = nextQuestions;
            setLocalQs(nextQuestions);
            setLocalBreaks(new Set());
            setSelectedField({ questionId: selectedField.questionId, key: "prompt" });
            setLayoutDirty(true);
            notifyDraft();
          }}
          onQuestionEdit={onEditQuestion}
          onResetField={resetSelectedStyle}
          onResetQuestion={() => {
            const nextStyles = localQuestionStylesRef.current.filter(style => style.questionId !== selectedField.questionId);
            localQuestionStylesRef.current = nextStyles;
            setLocalQuestionStyles(nextStyles);
            setLayoutDirty(true);
            notifyDraft();
          }}
        />
      )}

      {/* ── Visible paginated pages ──────────────────────────────── */}
      <div
        id="ws-printable-root"
        ref={previewRef}
        data-responsive-preview
        className={`print-host ${editMode && selectedField ? "ws-format-toolbar-open " : ""}${hostBg} min-h-screen py-6 px-2 flex flex-col items-center`}
        dir={dir}
        style={editMode ? { outline: "none" } : undefined}
      >
        {pages.map((pageQs, pi) => {
          const pageNum = pi + 1;
          const isFirst = pi === 0;
          const isLast = pi === pages.length - 1;
          return (
            <article data-worksheet-page key={pageNum} className={pageClass} lang={data.language} style={{ background: themeBg }}>
              {showWatermark && <WatermarkLayer ar={ar} />}
              {/* Classic corner ornaments only for no-theme or themes that keep them */}
              {!themeId && <CornerOrnaments />}
              {themeId === "arabic_ink" && <CornerOrnaments />}
              {/* Canvas overlay elements (text, shapes placed via the canvas editor) */}
              {isFirst && <CanvasLayerRenderer layout={data.settings.layout} />}
              <div className="ws-content">
                {isFirst ? (
                  page1Header
                ) : (
                  <div className="ws-cont-header">
                    <span className="ws-cont-title">{data.title}</span>
                    <span className="ws-cont-page">{ar ? `صفحة ${pageNum}` : `Page ${pageNum}`}</span>
                  </div>
                )}
                <section className="ws-questions" style={{ columnCount: cols === 2 ? 2 : 1 }}>
                  {pageQs.map(q => {
                    const lq = localQs.find(x => x.id === q.id) ?? q;
                    const idx = localQs.findIndex(x => x.id === q.id);
                    return (
                      <QuestionView
                        key={q.id}
                        index={String(idx + 1)}
                        q={lq}
                        ar={ar}
                        labels={labels}
                        editMode={editMode}
                        showPencil={controlled && editMode}
                        onEdit={onEditQuestion}
                        showTypeHeader={firstOfTypeSet.has(q.id)}
                        questionStyle={localQuestionStyles.find(style => style.questionId === q.id)}
                        onSelectField={key => setSelectedField({ questionId: q.id, key })}
                        selected={editMode && selectedField?.questionId === q.id}
                        onStartEdit={(onLayoutChange || onRequestEdit) && !(controlled && !editMode) ? () => startEditingQuestion(q.id) : undefined}
                        onSelectQuestion={() => setSelectedField({ questionId: q.id, key: "prompt" })}
                        onMatchingWidthChange={matchingLeftWidth => {
                          updateQuestionStyle(q.id, current => ({ ...current, matchingLeftWidth }));
                          setSelectedField({ questionId: q.id, key: "prompt" });
                        }}
                        onQuestionStyleChange={patch => {
                          updateQuestionStyle(q.id, current => ({ ...current, ...patch }));
                          setSelectedField({ questionId: q.id, key: "prompt" });
                        }}
                      />
                    );
                  })}
                </section>
                <FooterStrip
                  note={isLast ? data.settings.footerNote : undefined}
                  goodLuck={isLast ? (data.settings.goodLuck?.trim() || labels.goodLuck) : ""}
                />
              </div>
              {/* QR التصحيح الذكي — يفتح صفحة تصحيح هذه الورقة مباشرة (رابط فقط، بلا إجابات) */}
              {data.linkedAssignmentId != null && (
                <GradeQrBadge
                  worksheetId={data.id}
                  page={pageNum}
                  total={pages.length}
                  ar={ar}
                />
              )}
            </article>
          );
        })}

        {/* ── Answer key page ──────────────────────────────────── */}
        {data.settings.includeAnswerKey && answerPages.map((answerPageQs, answerPageIndex) => {
          const physicalPageNum = pages.length + answerPageIndex + 1;
          return (
            <article
              data-answer-key-page
              data-answer-key-page-number={answerPageIndex + 1}
              key={`answer-page-${answerPageIndex + 1}`}
              className={pageClass}
              lang={data.language}
              style={{ background: themeBg }}
            >
              {showWatermark && <WatermarkLayer ar={ar} />}
              {!themeId && <CornerOrnaments />}
              {themeId === "arabic_ink" && <CornerOrnaments />}
              <div className="ws-content">
                {answerPageIndex === 0 ? (
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
                ) : (
                  <div className="ws-cont-header" data-answer-key-continuation>
                    <span className="ws-cont-title">{labels.answerKey} · {data.title}</span>
                    <span className="ws-cont-page">
                      {ar ? `صفحة ${physicalPageNum}` : `Page ${physicalPageNum}`}
                    </span>
                  </div>
                )}
                <section className="ws-questions" style={{ columnCount: 1 }}>
                  {answerPageQs.map(item => (
                    <AnswerView key={item.id} item={item} ar={ar} labels={labels} />
                  ))}
                </section>
                <FooterStrip goodLuck="" />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function WorksheetPrint() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { lang: uiLang } = useI18n();
  const [, setLocation] = useLocation();
  const goBack = useSmartBack("/teacher/worksheets/create");
  const [data, setDataState] = useState<WorksheetData | null>(null);
  const dataRef = useRef<WorksheetData | null>(null);
  const setData = useCallback((next: WorksheetData | null | ((p: WorksheetData | null) => WorksheetData | null)) => {
    const value = typeof next === "function" ? next(dataRef.current) : next;
    dataRef.current = value;
    setDataState(value);
  }, []);
  const baselineRef = useRef<{ meta: string; questions: string } | null>(null);
  const baselineDataRef = useRef<WorksheetData | null>(null);
  const leaveTokenRef = useRef(0);
  const flushRef = useRef<(() => LayoutSnapshot) | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordExport, setWordExport] = useState<"visual" | "editable" | null>(null);
  const [wordProgress, setWordProgress] = useState("");
  const exportInFlightRef = useRef(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exporting = pdfBusy || wordExport !== null;
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const [, bump] = useState(0);

  const metaKey = (d: WorksheetData) => JSON.stringify({ t: d.title, s: d.subject, g: d.gradeLevel, st: { ...d.settings, pageBreaks: d.settings.pageBreaks ?? [], questionStyles: d.settings.questionStyles ?? [] } });
  const questionsKey = (d: WorksheetData) => JSON.stringify(d.questions);
  const uiLangRef = useRef(uiLang);
  uiLangRef.current = uiLang;

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}/api/worksheets/${id}`, { credentials: "include", signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d: WorksheetData) => {
        if (controller.signal.aborted) return;
        baselineRef.current = { meta: metaKey(d), questions: questionsKey(d) };
        baselineDataRef.current = d;
        setData(d);
      })
      .catch(() => {
        if (!controller.signal.aborted) toast.error(uiLangRef.current === "ar" ? "تعذّر تحميل ورقة العمل" : "Failed to load worksheet");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, setData]);

  const isOwner = data?.isOwner !== false;
  const dirty = !!(data && baselineRef.current && isOwner &&
    (metaKey(data) !== baselineRef.current.meta || questionsKey(data) !== baselineRef.current.questions));

  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const current = dataRef.current;
      const baseline = baselineRef.current;
      const snapshot = flushRef.current?.();
      const latest = current && snapshot ? {
        ...current, questions: snapshot.questions,
        settings: { ...current.settings, pageBreaks: snapshot.pageBreaks, questionStyles: snapshot.questionStyles },
      } : current;
      const pending = latest && baseline && latest.isOwner !== false
        && (metaKey(latest) !== baseline.meta || questionsKey(latest) !== baseline.questions);
      if (dirtyRef.current || pending) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const applySnapshot = useCallback((snap: LayoutSnapshot) => {
    setData(prev => prev ? { ...prev, questions: snap.questions, settings: { ...prev.settings, pageBreaks: snap.pageBreaks, questionStyles: snap.questionStyles } } : prev);
  }, [setData]);

  /** Commit in-progress inline edits and return the latest canonical worksheet. */
  const flushLatest = useCallback((): WorksheetData | null => {
    const snap = flushRef.current?.();
    if (snap) applySnapshot(snap);
    const cur = dataRef.current;
    if (!cur || !snap) return cur;
    return { ...cur, questions: snap.questions, settings: { ...cur.settings, pageBreaks: snap.pageBreaks, questionStyles: snap.questionStyles } };
  }, [applySnapshot]);
  const runSavedPdf = async () => {
    if (exportInFlightRef.current || savingRef.current) return;
    exportInFlightRef.current = true;
    setPdfBusy(true);
    setPdfError(null);
    try {
      flushLatest();
      const fitIssue = fitBlockMessage(dataRef.current?.settings.targetPages, countWorksheetPages(), uiLang === "ar");
      if (fitIssue) { toast.error(fitIssue); return; }
      await printToPdf(dataRef.current?.title ?? "");
    } catch (error) {
      setPdfError(pdfExportErrorMessage(error, uiLang === "ar"));
    } finally {
      exportInFlightRef.current = false;
      setPdfBusy(false);
    }
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || exportInFlightRef.current) return false;
    const latest = flushLatest();
    const base = baselineRef.current;
    if (!latest || !base || latest.isOwner === false) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const contentChanged = questionsKey(latest) !== base.questions;
    const payload: Record<string, unknown> = {
      title: latest.title,
      language: latest.language,
      gradeLevel: latest.gradeLevel,
      subject: latest.subject,
      questions: latest.questions,
      settings: latest.settings,
    };
    // Linked graded worksheets only re-sync assignment questions when smartGrading is sent.
    if (contentChanged && latest.linkedAssignmentId != null) payload.smartGrading = true;
    try {
      const res = await fetch(`${API_BASE}/api/worksheets/${latest.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "save failed");
      }
      const row = await res.json().catch(() => null);
      const server = (Array.isArray(row) ? row[0] : row) as Partial<WorksheetData> & { gradingVersioned?: boolean } | null;
      baselineRef.current = { meta: metaKey(latest), questions: questionsKey(latest) };
      baselineDataRef.current = latest;
      setData(prev => prev ? {
        ...prev,
        linkedAssignmentId: server && "linkedAssignmentId" in server ? (server.linkedAssignmentId ?? null) : prev.linkedAssignmentId,
      } : prev);
      // Keep baseline aligned with merged metadata (linked id is not part of the meta key).
      toast.success(server?.gradingVersioned
        ? (uiLang === "ar" ? "تم الحفظ وإنشاء نسخة جديدة للتصحيح" : "Saved; grading version updated")
        : (uiLang === "ar" ? "تم حفظ تعديلات الورقة" : "Worksheet changes saved"));
      return true;
    } catch (e) {
      const msg = (e instanceof Error && e.message !== "save failed" ? e.message : "") || (uiLang === "ar" ? "تعذّر الحفظ. تعديلاتك محفوظة هنا؛ أعد المحاولة." : "Save failed. Your edits are kept here; retry.");
      setSaveError(msg);
      toast.error(msg);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
      bump(n => n + 1);
    }
  }, [flushLatest, setData, uiLang]);

  const discard = useCallback(() => {
    const base = baselineDataRef.current;
    if (!base) return;
    setSaveError("");
    setData(prev => prev ? { ...base, linkedAssignmentId: prev.linkedAssignmentId, isOwner: prev.isOwner } : base);
  }, [setData]);
  const savePersist = useCallback(() => { void save(); }, [save]);

  const guard = useCallback((action: () => void) => {
    if (exportInFlightRef.current) return;
    flushLatest();
    // Allow the flushed state to settle before deciding.
    leaveTokenRef.current += 1;
    queueMicrotask(() => { if (dirtyRef.current || (dataRef.current && baselineRef.current && dataRef.current.isOwner !== false && (metaKey(dataRef.current) !== baselineRef.current.meta || questionsKey(dataRef.current) !== baselineRef.current.questions))) setLeaveAction(() => action); else action(); });
  }, [flushLatest]);

  const patchMeta = useCallback((patch: { title?: string; subject?: string; gradeLevel?: string }) => {
    setData(prev => prev ? {
      ...prev,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject.trim() ? patch.subject : null } : {}),
      ...(patch.gradeLevel !== undefined ? { gradeLevel: patch.gradeLevel.trim() ? patch.gradeLevel : null } : {}),
    } : prev);
  }, [setData]);
  const patchSettings = useCallback((updater: (s: Settings) => Settings) => {
    setData(prev => prev ? { ...prev, settings: updater(prev.settings) } : prev);
  }, [setData]);

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

  const changeMode = (next: "edit" | "preview") => {
    if (next === mode || exportInFlightRef.current) return;
    flushLatest();
    setMode(next);
  };

  const handleWord = async (mode: "visual" | "editable") => {
    if (exportInFlightRef.current || savingRef.current) return;
    flushLatest();
    const fitIssue = fitBlockMessage(dataRef.current?.settings.targetPages, countWorksheetPages(), uiLang === "ar");
    if (fitIssue) { toast.error(fitIssue); return; }
    const root = document.getElementById("ws-printable-root");
    if (!root) {
      toast.error(uiLang === "ar" ? "تعذّر إعداد الملف" : "Could not prepare file");
      return;
    }
    exportInFlightRef.current = true;
    setWordExport(mode);
    setWordProgress("");
    try {
      if (mode === "visual") {
        await downloadVisualWorksheetWord({
          element: root, title: data.title, lang: data.language, worksheetId: data.id,
          onProgress: (done, total) => setWordProgress(`${done}/${total}`),
        });
      } else {
        await downloadAsWord({
          element: root,
          title: `${data.title} - ${uiLang === "ar" ? "قابل للتحرير" : "Editable"}`,
          lang: data.language,
        });
      }
      toast.success(uiLang === "ar" ? "تم تجهيز ملف Word للتنزيل" : "Word file ready for download");
    } catch (error) {
      const imageFailed = error instanceof VisualWordExportError && error.code === "image";
      const busy = error instanceof VisualWordExportError && error.code === "busy";
      toast.error(busy
        ? (uiLang === "ar" ? "خدمة التصدير مشغولة الآن؛ أعد المحاولة بعد قليل." : "The export service is busy. Please retry shortly.")
        : imageFailed
        ? (uiLang === "ar" ? "تعذّر تحميل إحدى صور التصميم. لم يُصدّر ملف ناقص؛ أعد المحاولة بعد اكتمال تحميل الصور." : "A design image could not be loaded. No incomplete file was exported; retry after images finish loading.")
        : (uiLang === "ar" ? "تعذّر تصدير ملف Word. يرجى المحاولة مرة أخرى." : "Could not export the Word file. Please try again."));
    } finally {
      exportInFlightRef.current = false;
      setWordExport(null);
      setWordProgress("");
    }
  };

  return (
    <>
      {/* Action toolbar (hidden when printing) */}
      <div
        dir={dir}
        className="no-print ws-action-toolbar sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white"
      >
        <button
          onClick={() => guard(goBack)}
          disabled={exporting}
          className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {uiLang === "ar" ? "رجوع" : "Back"}
        </button>
        <div className="text-xs font-bold truncate flex-1 text-center" style={{ color: BRAND_PRIMARY }}>
          {data.title}
        </div>
        {isOwner && (
          <WorksheetModeSwitch ar={uiLang === "ar"} mode={mode} onChange={changeMode} disabled={exporting} />
        )}
        <div className="ws-actions flex gap-1.5 flex-wrap justify-end">
          {data.isOwner !== false && data.linkedAssignmentId != null && (
            <button
              onClick={() => guard(() => setLocation(`/teacher/worksheets/${data.id}/grade`))}
              disabled={exporting}
              className="px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm"
              style={{ background: "#2f684d" }}
              title={uiLang === "ar" ? "تصحيح الأوراق بالكاميرا" : "Grade papers with camera"}
              data-testid="btn-open-grading"
            >
              <CameraIcon className="w-3.5 h-3.5" />
              {uiLang === "ar" ? "تصحيح" : "Grade"}
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => void save()}
                disabled={saving || exporting || !dirty}
                className="px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm disabled:opacity-50"
                style={{ background: dirty ? BRAND_PRIMARY : "#2f684d" }}
                data-testid="btn-save-worksheet"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? (uiLang === "ar" ? "جار الحفظ" : "Saving") : dirty ? (uiLang === "ar" ? "حفظ التعديلات" : "Save changes") : (uiLang === "ar" ? "محفوظ" : "Saved")}
              </button>
            </>
          )}
          <WorksheetWordExportMenu ar={uiLang === "ar"}
            onExport={mode => void handleWord(mode)}
            disabled={exporting || saving} busy={wordExport !== null} progress={wordProgress}
            testId="btn-word-export"
            className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-sm font-bold flex items-center gap-1.5 disabled:opacity-60" />
          <button
            onClick={() => void runSavedPdf()}
            disabled={exporting || saving}
            aria-busy={pdfBusy}
            className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
            style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
            data-testid="btn-pdf-export"
            title={uiLang === "ar" ? "حفظ الورقة كملف PDF" : "Save worksheet as PDF"}
          >
            {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {pdfBusy ? (uiLang === "ar" ? "جار تجهيز PDF" : "Preparing PDF") : (uiLang === "ar" ? "حفظ PDF" : "Save PDF")}
          </button>
        </div>
      </div>

      {pdfError && (
        <div role="alert" dir={dir} className="no-print mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800" data-testid="alert-pdf-error">
          <span className="flex-1">{pdfError}</span>
          <button onClick={() => void runSavedPdf()} disabled={exporting || saving} className="px-3 py-1 rounded-md bg-white border font-bold" data-testid="btn-retry-pdf">{uiLang === "ar" ? "إعادة المحاولة" : "Retry"}</button>
        </div>
      )}

      {isOwner && (
        <div inert={exporting || undefined} dir={dir} hidden={mode === "preview" && !saveError && !dirty} className="no-print border-b bg-white px-4 py-3" data-testid="region-live-edit">
          {(saveError || dirty) && (
            <div role={saveError ? "alert" : "status"} className={`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${saveError ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
              <span className="flex-1">{saveError || (uiLang === "ar" ? "لديك تعديلات غير محفوظة. الطباعة والتصدير يستخدمان آخر تعديلاتك." : "You have unsaved edits. Print and export use your latest edits.")}</span>
              {saveError && (
                <button onClick={() => void save()} disabled={saving} className="px-3 py-1 rounded-md bg-white border font-bold" data-testid="btn-retry-save">
                  {uiLang === "ar" ? "إعادة المحاولة" : "Retry"}
                </button>
              )}
            </div>
          )}
          {(
            <div hidden={mode !== "edit"}>
            <WorksheetFormatPanel
              ar={uiLang === "ar"}
              settings={data.settings}
              onSettingsChange={patchSettings}
              meta={{ title: data.title, subject: data.subject ?? "", gradeLevel: data.gradeLevel ?? "" }}
              onMetaChange={patchMeta}
            />
            </div>
          )}
        </div>
      )}

      <div inert={exporting || undefined} aria-busy={exporting}>
      <WorksheetPrintView
        data={data}
        flushRef={flushRef}
        editing={isOwner ? mode === "edit" : undefined}
        onEditingChange={isOwner ? (e: boolean) => setMode(e ? "edit" : "preview") : undefined}
        onRequestSave={isOwner ? savePersist : undefined}
        onRequestDiscard={isOwner ? discard : undefined}
        onDraftChange={isOwner ? applySnapshot : undefined}
        onLayoutChange={isOwner ? (qs, breaks, styles) => applySnapshot({ questions: qs, pageBreaks: breaks, questionStyles: styles }) : undefined}
      />
      </div>

      {leaveAction && (
        <div className="no-print fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" dir={dir}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="leave-title" className="font-bold text-base mb-1">{uiLang === "ar" ? "تعديلات غير محفوظة" : "Unsaved changes"}</h2>
            <p className="text-sm text-muted-foreground mb-4">{uiLang === "ar" ? "احفظ تعديلاتك قبل المغادرة أو تجاهلها." : "Save your edits before leaving, or discard them."}</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button className="px-3 py-1.5 rounded-lg border text-sm font-bold" onClick={() => { leaveTokenRef.current += 1; setLeaveAction(null); }}>{uiLang === "ar" ? "البقاء" : "Stay"}</button>
              <button className="px-3 py-1.5 rounded-lg border text-sm font-bold text-red-700" data-testid="btn-discard-leave" disabled={saving} onClick={() => { const a = leaveAction; dirtyRef.current = false; leaveTokenRef.current += 1; setLeaveAction(null); a(); }}>{uiLang === "ar" ? "تجاهل وخروج" : "Discard & leave"}</button>
              <button className="px-3 py-1.5 rounded-lg text-sm font-bold text-white" style={{ background: BRAND_PRIMARY }} data-testid="btn-save-leave" disabled={saving} onClick={async () => {
                const a = leaveAction;
                const token = ++leaveTokenRef.current;
                const ok = await save();
                if (token !== leaveTokenRef.current) return;
                const cur = dataRef.current; const base = baselineRef.current;
                const stillDirty = !!(cur && base && (metaKey(cur) !== base.meta || questionsKey(cur) !== base.questions));
                setLeaveAction(null);
                if (ok && !stillDirty) { dirtyRef.current = false; a(); }
              }}>{uiLang === "ar" ? "حفظ وخروج" : "Save & leave"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PageLayoutPanel({
  ar, pages, allQuestions, localBreaks, layoutDirty, dragQId, dragOverPage,
  themeColor, onAddBreak, onRemoveBreak, onSave,
  onDragStart, onDragEnd, onDragOverPage, onDropOnPage,
}: {
  ar: boolean;
  pages: Question[][];
  allQuestions: Question[];
  localBreaks: ReadonlySet<string>;
  layoutDirty: boolean;
  dragQId: string | null;
  dragOverPage: number | null;
  themeColor: string;
  onAddBreak: (id: string) => void;
  onRemoveBreak: (id: string) => void;
  onSave: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverPage: (pi: number) => void;
  onDropOnPage: (pi: number) => void;
}) {
  const qTypeIcon: Record<Question["type"], string> = {
    mcq: "⊙", true_false: "✓✗", short_answer: "✎", fill_blank: "░", matching: "⇔", tic_tac_toe: "▦",
    worked_problem: "∑", extended_response: "¶", error_correction: "⌫", word_bank: "▤", compare: "⇄",
  };

  return (
    <div
      className="no-print ws-layout-panel"
      dir={ar ? "rtl" : "ltr"}
      style={{ borderColor: `${themeColor}33` }}
    >
      {/* Panel header */}
      <div className="ws-layout-panel-head" style={{ borderColor: `${themeColor}22` }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: themeColor }}>
          {ar ? "توزيع الصفحات — اسحب الأسئلة بين الصفحات" : "Page layout — drag questions between pages"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#888" }}>
            {ar
              ? "اسحب السؤال إلى صفحة أخرى · ✂ لإضافة فاصل صفحة"
              : "Drag a question chip to another page · ✂ to add a break"}
          </div>
          {layoutDirty && (
            <button
              onClick={onSave}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: themeColor, color: "white",
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >
              <Save size={13} />
              {ar ? "حفظ التوزيع" : "Save layout"}
            </button>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="ws-layout-thumbs">
        {pages.map((pageQs, pi) => {
          const isDragTarget = dragOverPage === pi && dragQId !== null;
          return (
            <div
              key={pi}
              className="ws-layout-thumb"
              style={{
                borderColor: isDragTarget ? themeColor : `${themeColor}33`,
                boxShadow: isDragTarget ? `0 0 0 2px ${themeColor}66` : "none",
                background: isDragTarget ? `${themeColor}08` : "white",
              }}
              onDragOver={e => { e.preventDefault(); onDragOverPage(pi); }}
              onDragLeave={() => {}}
              onDrop={e => { e.preventDefault(); onDropOnPage(pi); }}
            >
              {/* Page badge */}
              <div className="ws-layout-thumb-badge" style={{ background: themeColor }}>
                {ar ? `ص ${pi + 1}` : `P${pi + 1}`}
              </div>

              {/* Question chips */}
              <div className="ws-layout-thumb-qs">
                {pageQs.map(q => {
                  const globalIdx = allQuestions.indexOf(q) + 1;
                  const hasBreak = localBreaks.has(q.id);
                  const isDragging = dragQId === q.id;
                  return (
                    <div
                      key={q.id}
                      className="ws-layout-chip"
                      draggable
                      style={{
                        opacity: isDragging ? 0.4 : 1,
                        borderColor: hasBreak ? "#dc2626" : `${themeColor}55`,
                        background: hasBreak ? "#fef2f2" : `${themeColor}0a`,
                        cursor: "grab",
                      }}
                      onDragStart={e => {
                        e.dataTransfer.setData("text/plain", q.id);
                        e.dataTransfer.effectAllowed = "move";
                        onDragStart(q.id);
                      }}
                      onDragEnd={onDragEnd}
                    >
                      {/* Break indicator */}
                      {hasBreak && (
                        <span style={{ color: "#dc2626", fontSize: 9, fontWeight: 700 }}>↵</span>
                      )}
                      {/* Question number + type icon */}
                      <span className="ws-layout-chip-num" style={{ background: themeColor }}>
                        {globalIdx}
                      </span>
                      <span className="ws-layout-chip-icon">{qTypeIcon[q.type]}</span>
                      <span className="ws-layout-chip-text">
                        {(q.type === "matching" ? (q.prompt ?? "") : q.prompt ?? "").slice(0, 28) || "…"}
                      </span>
                      {/* Break toggle button */}
                      <button
                        className="ws-layout-break-btn"
                        title={hasBreak
                          ? (ar ? "إزالة فاصل الصفحة" : "Remove break")
                          : (ar ? "كسر الصفحة قبله" : "Break before")}
                        onClick={e => { e.stopPropagation(); hasBreak ? onRemoveBreak(q.id) : onAddBreak(q.id); }}
                        style={{ color: hasBreak ? "#dc2626" : "#aaa" }}
                      >
                        ✂
                      </button>
                    </div>
                  );
                })}
                {/* Drop hint when dragging */}
                {isDragTarget && (
                  <div className="ws-layout-drop-hint" style={{ borderColor: themeColor, color: themeColor }}>
                    {ar ? "افلت هنا" : "Drop here"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

// Subtle "حصاد" / "Hasaad" watermark behind the worksheet content.
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
    case "tic_tac_toe": return <IconLightbulb />;
    case "worked_problem":
    case "extended_response":
    case "error_correction":
    case "word_bank":
    case "compare":
      return <IconShort />;
  }
}

function questionTypeLabel(type: Question["type"], ar: boolean) {
  if (ar) {
    return { mcq: "اختيار من متعدد", true_false: "صح / خطأ", short_answer: "إجابة قصيرة", fill_blank: "أكمل الفراغ", matching: "وصّل بين العمودين", tic_tac_toe: "لوحة الاختيار (Tic-Tac-Toe)", worked_problem: "مسألة مع خطوات الحل", extended_response: "إجابة مطولة", error_correction: "اكتشف الخطأ وصححه", word_bank: "بنك الكلمات", compare: "قارن" }[type];
  }
  return { mcq: "Multiple choice", true_false: "True / False", short_answer: "Short answer", fill_blank: "Fill in the blank", matching: "Matching", tic_tac_toe: "Choice Board (Tic-Tac-Toe)", worked_problem: "Worked problem", extended_response: "Extended response", error_correction: "Find & correct the error", word_bank: "Word bank", compare: "Compare" }[type];
}

/** Instruction shown once before the first question of each type group. */
function sectionInstruction(type: Question["type"], ar: boolean, questionStyle?: QuestionStyle): string {
  if (ar) {
    return ({
      mcq:          "اختر الإجابة الصحيحة من الاختيارات التالية:",
      true_false:   (questionStyle?.trueFalseLayout ?? "choices") === "mark"
        ? "ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:"
        : "اختر «صح» أو «خطأ» لكل عبارة مما يلي:",
      short_answer: "أجب عن الأسئلة التالية إجابةً قصيرة:",
      fill_blank:   "أكمل الفراغات التالية بالكلمة المناسبة:",
      matching:     "صل كل عبارة بما يناسبها من العمود الثاني:",
      tic_tac_toe:  (questionStyle?.ticTacToeStrategy ?? "any_three") === "corners"
        ? "اختر الأركان الأربعة ونفّذ مهامها:"
        : (questionStyle?.ticTacToeStrategy === "full_board")
          ? "نفّذ جميع المهام في اللوحة التالية:"
          : "اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا:",
      worked_problem: "حل المسألة موضحًا خطوات العمل، ثم اكتب الإجابة النهائية:",
      extended_response: "اكتب إجابة موسعة تدعمها بالتفاصيل والأدلة:",
      error_correction: "حدّد الخطأ، ثم اكتب التصحيح واشرح سبب التعديل:",
      word_bank: "استخدم الكلمات في الصندوق لإكمال البنود التالية:",
      compare: "قارن بين العنصرين، موضحًا أوجه التشابه والاختلاف:",
    } as Record<Question["type"], string>)[type];
  }
  return ({
    mcq:          "Choose the correct answer from the following:",
    true_false:   (questionStyle?.trueFalseLayout ?? "choices") === "mark"
      ? "Put a tick (✓) before each true statement and a cross (✗) before each false statement:"
      : "Choose True or False for each statement:",
    short_answer: "Answer the following questions briefly:",
    fill_blank:   "Fill in the blanks with the appropriate word:",
    matching:     "Match each item with its corresponding choice in the second column:",
    tic_tac_toe:  (questionStyle?.ticTacToeStrategy ?? "any_three") === "corners"
      ? "Choose the four corners and complete the tasks:"
      : (questionStyle?.ticTacToeStrategy === "full_board")
        ? "Complete all tasks in the board:"
        : "Choose three connected squares horizontally, vertically, or diagonally:",
    worked_problem: "Solve the problem, showing each step, then give the final answer:",
    extended_response: "Write an extended response supported with details and evidence:",
    error_correction: "Identify the error, write the correction, and explain your reasoning:",
    word_bank: "Use the words in the box to complete the following items:",
    compare: "Compare the two items, including their similarities and differences:",
  } as Record<Question["type"], string>)[type];
}

function fieldStyleToCss(style?: FieldStyle): CSSProperties | undefined {
  if (!style) return undefined;
  return {
    fontSize: style.fontSizePt ? `${style.fontSizePt}pt` : undefined,
    fontWeight: style.bold ? 800 : undefined,
    textAlign: style.align === "start" ? "start" : style.align === "end" ? "end" : style.align,
    display: style.align ? "inline-block" : undefined,
    width: style.align ? "100%" : undefined,
  };
}

export function QuestionFormattingToolbar({
  ar, question, questionNumber, questionStyle, fieldStyle, onFieldChange, onQuestionChange, onQuestionTypeChange, onQuestionEdit, onResetField, onResetQuestion,
}: {
  ar: boolean;
  question: Question;
  questionNumber: number;
  questionStyle?: QuestionStyle;
  fieldStyle?: FieldStyle;
  onFieldChange: (patch: Partial<Omit<FieldStyle, "key">>) => void;
  onQuestionChange: (patch: Partial<Omit<QuestionStyle, "questionId" | "fields">>) => void;
  onQuestionTypeChange: (type: QuestionType) => void;
  onQuestionEdit: (question: Question) => void;
  onResetField: () => void;
  onResetQuestion: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [anchor, setAnchor] = useState<CSSProperties | undefined>(undefined);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const target = document.querySelector<HTMLElement>("[data-question-selected]");
      const bar = toolbarRef.current;
      if (!target || !bar || window.innerWidth < 768) { setAnchor(undefined); return; }
      const rect = target.getBoundingClientRect();
      const barW = Math.min(620, window.innerWidth - 24);
      const barH = bar.offsetHeight || 48;
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - barW / 2), window.innerWidth - barW - 12);
      const below = rect.bottom + 8;
      const top = below + barH <= window.innerHeight - 8 ? below : Math.max(8, Math.min(rect.top - barH - 8, window.innerHeight - barH - 8));
      setAnchor({ position: "fixed", top, left, bottom: "auto", transform: "none", width: barW });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [questionNumber, detailsOpen]);
  const fontSize = fieldStyle?.fontSizePt ?? 12;
  const alignments: Array<{ value: FieldAlign; Icon: typeof AlignLeft }> = [
    { value: "start", Icon: ar ? AlignRight : AlignLeft },
    { value: "center", Icon: AlignCenter },
    { value: "end", Icon: ar ? AlignLeft : AlignRight },
  ];
  const alignmentLabels: Record<FieldAlign, string> = ar
    ? { start: "محاذاة للبداية", center: "توسيط", end: "محاذاة للنهاية" }
    : { start: "Align to start", center: "Center align", end: "Align to end" };
  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled)"),
    );
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (currentIndex < 0 || controls.length === 0) return;
    event.preventDefault();
    const isForward = event.key === (ar ? "ArrowLeft" : "ArrowRight");
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? controls.length - 1
        : (currentIndex + (isForward ? 1 : -1) + controls.length) % controls.length;
    controls[nextIndex]?.focus();
  };
  return (
    <div
      ref={toolbarRef}
      style={anchor}
      className="no-print ws-format-toolbar"
      dir={ar ? "rtl" : "ltr"}
      role="toolbar"
      aria-label={ar ? "تنسيق النص والسؤال المحددين" : "Selected text and question formatting"}
      onKeyDown={handleToolbarKeyDown}
      data-testid="toolbar-question-formatting"
    >
      <div className="ws-format-selection" aria-live="polite">
        {ar ? `تعديل السؤال ${questionNumber}` : `Editing question ${questionNumber}`}
      </div>
      <button
        type="button"
        className={`ws-format-details-toggle${detailsOpen ? " is-active" : ""}`}
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen(o => !o)}
        data-testid="button-toggle-question-details"
      >
        {ar ? "تفاصيل السؤال" : "Question details"}
      </button>
      <div className="ws-format-group">
        <span className="ws-format-label">{ar ? "النص" : "Text"}</span>
        <button type="button" onClick={() => onFieldChange({ fontSizePt: Math.max(8, fontSize - 1) })} aria-label={ar ? "تصغير الخط" : "Decrease font size"} data-testid="button-decrease-font-size">
          <Minus />
        </button>
        <span className="ws-format-value" aria-live="polite" data-testid="text-font-size">{fontSize}</span>
        <button type="button" onClick={() => onFieldChange({ fontSizePt: Math.min(24, fontSize + 1) })} aria-label={ar ? "تكبير الخط" : "Increase font size"} data-testid="button-increase-font-size">
          <Plus />
        </button>
        <button type="button" className={fieldStyle?.bold ? "is-active" : ""} onClick={() => onFieldChange({ bold: !fieldStyle?.bold })} aria-label={ar ? "نص عريض" : "Bold text"} aria-pressed={Boolean(fieldStyle?.bold)} data-testid="button-toggle-bold">
          <strong>ب</strong>
        </button>
        {alignments.map(({ value, Icon }) => (
          <button type="button" key={value} className={fieldStyle?.align === value ? "is-active" : ""} onClick={() => onFieldChange({ align: value })} aria-label={alignmentLabels[value]} aria-pressed={fieldStyle?.align === value} data-testid={`button-align-${value}`}>
            <Icon />
          </button>
        ))}
        <button type="button" onClick={onResetField} aria-label={ar ? "إعادة تنسيق النص" : "Reset text formatting"} data-testid="button-reset-text-formatting">
          <RotateCcw />
        </button>
      </div>
      {detailsOpen && (
      <div className="ws-format-group ws-format-details">
        <span className="ws-format-label">{ar ? "السؤال" : "Question"}</span>
        <label className="ws-format-type">
          <span>{ar ? "نوعه" : "Type"}</span>
          <select
            value={question.type}
            onChange={event => onQuestionTypeChange(event.target.value as QuestionType)}
            aria-label={ar ? "تغيير نوع السؤال" : "Change question type"}
          >
            {(["true_false", "mcq", "matching", "short_answer", "fill_blank"] as const).map(type => (
              <option key={type} value={type}>{questionTypeLabel(type, ar)}</option>
            ))}
          </select>
        </label>
        {question.type === "true_false" && (
          <>
            <span className="ws-format-label">{ar ? "طريقة الإجابة" : "Answer layout"}</span>
            {(["mark", "choices"] as const).map(value => (
              <button
                type="button"
                key={value}
                className={(questionStyle?.trueFalseLayout ?? "choices") === value ? "is-active ws-format-text-btn" : "ws-format-text-btn"}
                onClick={() => onQuestionChange({ trueFalseLayout: value })}
              >
                {ar
                  ? (value === "mark" ? "قوس للعلامة" : "خيارا صح وخطأ")
                  : (value === "mark" ? "Mark parentheses" : "True / False choices")}
              </button>
            ))}
            <label className="ws-format-type">
              <span>{ar ? "الإجابة" : "Answer"}</span>
              <select
                value={question.correct ? "true" : "false"}
                onChange={event => onQuestionEdit({ ...question, correct: event.target.value === "true" })}
                aria-label={ar ? "الإجابة الصحيحة" : "Correct answer"}
              >
                <option value="true">{ar ? "صح" : "True"}</option>
                <option value="false">{ar ? "خطأ" : "False"}</option>
              </select>
            </label>
          </>
        )}

        {question.type === "tic_tac_toe" && (
          <>
            <div className="ws-format-control ws-format-radio" data-testid="select-tic-strategy">
              <span className="ws-format-label">{ar ? "الاستراتيجية" : "Strategy"}</span>
              {(["any_three", "corners", "full_board"] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  className={(questionStyle?.ticTacToeStrategy ?? "any_three") === value ? "is-active ws-format-text-btn" : "ws-format-text-btn"}
                  onClick={() => onQuestionChange({ ticTacToeStrategy: value })}
                >
                  {ar
                    ? (value === "any_three" ? "3 متصلة" : value === "corners" ? "الأركان" : "كامل اللوحة")
                    : (value === "any_three" ? "Any 3" : value === "corners" ? "Corners" : "Full board")}
                </button>
              ))}
            </div>
            <div className="ws-format-control ws-format-radio" data-testid="select-tic-response">
              <span className="ws-format-label">{ar ? "أسطر الإجابة" : "Response Lines"}</span>
              {([0, 3, 5, 8, 12] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  className={(questionStyle?.ticTacToeResponseLines ?? 0) === value ? "is-active ws-format-text-btn" : "ws-format-text-btn"}
                  onClick={() => onQuestionChange({ ticTacToeResponseLines: value })}
                >
                  {value === 0 ? (ar ? "بدون" : "None") : value}
                </button>
              ))}
            </div>
          </>
        )}

        {question.type === "mcq" && (
          <label className="ws-format-type">
            <span>{ar ? "الإجابة الصحيحة" : "Correct answer"}</span>
            <select
              value={question.correctIndex}
              onChange={event => onQuestionEdit({ ...question, correctIndex: Number(event.target.value) })}
              aria-label={ar ? "اختيار الإجابة الصحيحة" : "Choose the correct answer"}
            >
              {question.options.map((option, index) => (
                <option key={index} value={index}>
                  ({optionLabel(index, ar)}) {option}
                </option>
              ))}
            </select>
          </label>
        )}
        {question.type === "error_correction" && (
          <>
            <label className="ws-format-type ws-format-control">
              <span>{ar ? "أسطر التصحيح" : "Correction lines"}</span>
              <select
                value={questionStyle?.errorCorrectionCorrectionLines ?? 2}
                onChange={event => onQuestionChange({ errorCorrectionCorrectionLines: Number(event.target.value) })}
                aria-label={ar ? "عدد أسطر التصحيح" : "Number of correction lines"}
                data-testid="select-error-correction-lines"
              >
                {[0, 1, 2, 3, 4, 6, 8].map(value => (
                  <option key={value} value={value}>{value === 0 ? (ar ? "بدون أسطر" : "No lines") : value}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={(questionStyle?.errorCorrectionShowExplanation ?? true) ? "is-active ws-format-text-btn" : "ws-format-text-btn"}
              onClick={() => onQuestionChange({ errorCorrectionShowExplanation: !(questionStyle?.errorCorrectionShowExplanation ?? true) })}
              aria-pressed={questionStyle?.errorCorrectionShowExplanation ?? true}
              data-testid="button-toggle-error-explanation"
            >
              {(questionStyle?.errorCorrectionShowExplanation ?? true)
                ? (ar ? "إخفاء الشرح" : "Hide explanation")
                : (ar ? "إظهار الشرح" : "Show explanation")}
            </button>
            {(questionStyle?.errorCorrectionShowExplanation ?? true) && (
              <label className="ws-format-type ws-format-control">
                <span>{ar ? "أسطر الشرح" : "Explanation lines"}</span>
                <select
                  value={questionStyle?.errorCorrectionExplanationLines ?? 2}
                  onChange={event => onQuestionChange({ errorCorrectionExplanationLines: Number(event.target.value) })}
                  aria-label={ar ? "عدد أسطر الشرح" : "Number of explanation lines"}
                  data-testid="select-error-explanation-lines"
                >
                  {[0, 1, 2, 3, 4, 6, 8].map(value => (
                    <option key={value} value={value}>{value === 0 ? (ar ? "بدون أسطر" : "No lines") : value}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {question.type === "compare" && (
          <>
            <label className="ws-format-type ws-format-control">
              <span>{ar ? "عنوان التشابه" : "Similarities heading"}</span>
              <input
                value={questionStyle?.compareSimilaritiesLabel ?? (ar ? "أوجه التشابه" : "Similarities")}
                onChange={event => onQuestionChange({ compareSimilaritiesLabel: event.target.value })}
                aria-label={ar ? "عنوان أوجه التشابه" : "Similarities heading"}
                data-testid="input-compare-similarities-label"
              />
            </label>
            <label className="ws-format-type ws-format-control">
              <span>{ar ? "عنوان الاختلاف" : "Differences heading"}</span>
              <input
                value={questionStyle?.compareDifferencesLabel ?? (ar ? "خصائص واختلافات" : "Traits and differences")}
                onChange={event => onQuestionChange({ compareDifferencesLabel: event.target.value })}
                aria-label={ar ? "عنوان الخصائص والاختلافات" : "Traits and differences heading"}
                data-testid="input-compare-differences-label"
              />
            </label>
          </>
        )}
        {(question.type === "short_answer" || question.type === "fill_blank") && (
          <label className="ws-format-type">
            <span>{ar ? "الإجابة النموذجية" : "Model answer"}</span>
            <input
              value={question.answer ?? ""}
              onChange={event => onQuestionEdit({ ...question, answer: event.target.value })}
              aria-label={ar ? "الإجابة النموذجية" : "Model answer"}
            />
          </label>
        )}
        <label className="ws-format-type ws-format-control">
          <span>{ar ? "مسافة السؤال" : "Question spacing"}</span>
          <select
            value={questionStyle?.spacing ?? "normal"}
            onChange={event => onQuestionChange({ spacing: event.target.value as QuestionStyle["spacing"] })}
            aria-label={ar ? "مسافة السؤال" : "Question spacing"}
            data-testid="select-question-spacing"
          >
            <option value="compact">{ar ? "مضغوط" : "Compact"}</option>
            <option value="normal">{ar ? "عادي" : "Normal"}</option>
            <option value="relaxed">{ar ? "واسع" : "Wide"}</option>
          </select>
        </label>
        {question.type === "mcq" && (
          <label className="ws-format-type ws-format-control">
            <span>{ar ? "ترتيب الخيارات" : "Option layout"}</span>
            <select
              value={questionStyle?.choiceColumns ?? 2}
              onChange={event => onQuestionChange({ choiceColumns: Number(event.target.value) as 1 | 2 })}
              aria-label={ar ? "ترتيب خيارات السؤال" : "Question option layout"}
              data-testid="select-choice-columns"
            >
              <option value={1}>{ar ? "عمودي" : "Vertical"}</option>
              <option value={2}>{ar ? "خياران في سطر" : "Two per row"}</option>
            </select>
          </label>
        )}
        <button type="button" onClick={onResetQuestion} aria-label={ar ? "إعادة إعدادات السؤال" : "Reset question settings"} data-testid="button-reset-question-formatting">
          <RotateCcw />
        </button>
      </div>
      )}
    </div>
  );
}

/** Editable span — shows a yellow highlight in edit mode, plain in view mode */
function EditSpan({
  text, editMode, className, onCommit, placeholder, style, onSelect,
}: {
  text: string;
  editMode: boolean;
  className?: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  style?: FieldStyle;
  onSelect?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // Keep DOM in sync when external value changes (e.g. after save)
  useEffect(() => {
    if (ref.current && !editMode) {
      ref.current.textContent = text;
    }
  }, [text, editMode]);

  const visualStyle = fieldStyleToCss(style);
  if (!editMode) {
    return (
      <MathText
        text={text || placeholder}
        className={className}
        fallbackDirection="rtl"
        style={visualStyle}
      />
    );
  }

  return (
    <span
      ref={ref}
      className={`ws-editable${className ? ` ${className}` : ""}`}
      style={{ ...visualStyle, unicodeBidi: "plaintext" }}
      contentEditable
      suppressContentEditableWarning
      onFocus={e => {
        onSelect?.();
        // Initialise if empty
        if (!e.currentTarget.textContent) e.currentTarget.textContent = text;
      }}
      onBlur={e => {
        const val = e.currentTarget.textContent?.trim() ?? "";
        onCommit(val || text);
      }}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
      spellCheck={false}
      dir={contentDirection(text, "rtl")}
    >
      {text || placeholder}
    </span>
  );
}

function QuestionView({
  index, q, ar, labels, editMode, showPencil, onEdit, showTypeHeader, questionStyle, onSelectField, selected, onStartEdit, onSelectQuestion, onMatchingWidthChange, onQuestionStyleChange,
}: {
  index: string;
  q: Question;
  ar: boolean;
  labels: { question: string; true: string; false: string; correct: string };
  editMode?: boolean;
  showPencil?: boolean;
  onEdit?: (updated: Question) => void;
  showTypeHeader?: boolean;
  questionStyle?: QuestionStyle;
  onSelectField?: (key: string) => void;
  selected?: boolean;
  onStartEdit?: () => void;
  onSelectQuestion?: () => void;
  onMatchingWidthChange?: (leftWidth: number) => void;
  onQuestionStyleChange?: (patch: Partial<Omit<QuestionStyle, "questionId" | "fields">>) => void;
}) {
  const em = editMode ?? false;
  const edit = onEdit ?? (() => {});
  const matchingRef = useRef<HTMLDivElement>(null);
  const automaticMatchingFractions = q.type === "matching" ? matchingColumnFractions(q.pairs) : null;
  const manualMatchingLeft = questionStyle?.matchingLeftWidth;
  const matchingFractions = manualMatchingLeft
    ? { left: manualMatchingLeft / 100, right: (100 - manualMatchingLeft) / 100 }
    : automaticMatchingFractions;
  const updateMatchingWidthFromPointer = (clientX: number) => {
    const rect = matchingRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const raw = ar ? (rect.right - clientX) / rect.width : (clientX - rect.left) / rect.width;
    onMatchingWidthChange?.(Math.round(Math.min(0.65, Math.max(0.35, raw)) * 100));
  };

  return (
    <div
      className={`ws-question-block ws-q-spacing-${questionStyle?.spacing ?? "normal"}${em ? " ws-q-editable" : ""}${selected ? " ws-q-selected" : ""}`}
      onClick={event => {
        const target = event.target as HTMLElement;
        if (!em) {
          // Direct entry: tapping the question or its text starts editing it.
          if (!onStartEdit || target.closest("button, a, input, select, textarea, [contenteditable='true']")) return;
          const selection = typeof window !== "undefined" ? window.getSelection() : null;
          if (selection && !selection.isCollapsed) return;
          onStartEdit();
          return;
        }
        if (target.closest(".ws-editable")) return;
        onSelectQuestion?.();
      }}
      data-question-selected={selected || undefined}
    >
      {onStartEdit && (!em || showPencil) && (
        <button
          type="button"
          className="no-print ws-q-pencil"
          onClick={event => { event.stopPropagation(); onStartEdit(); }}
          aria-label={ar ? `تعديل السؤال ${index}` : `Edit question ${index}`}
          data-testid={`button-edit-question-${index}`}
        >
          <PenLine />
        </button>
      )}
      {showTypeHeader && (
        <div className="ws-section-instr">{sectionInstruction(q.type, ar, questionStyle)}</div>
      )}
      {q.type === "word_bank" && (
        <div className="ws-word-bank" aria-label={ar ? "بنك الكلمات" : "Word bank"}>
          <strong>{ar ? "بنك الكلمات" : "Word bank"}</strong>
          <div>
            {Array.from(new Set(q.items.filter(Boolean))).map((word, i) => (
              <MathText key={i} text={word} fallbackDirection={ar ? "rtl" : "ltr"} />
            ))}
          </div>
        </div>
      )}
      <div className="ws-q">
        <div className="ws-q-head">
          <span className="ws-q-num" aria-label={`${labels.question} ${index}`}>{index}</span>
          <div className="ws-q-prompt-wrap">
            {typeof q.points === "number" && q.points > 0 && (
              <div className="ws-q-typeline">
                <span className="ws-q-points">{q.points} {ar ? "د" : "pt"}</span>
              </div>
            )}
            <div className="ws-q-prompt">
            <EditSpan
              text={q.prompt ?? (q.type === "matching" ? (ar ? "صل بين العمودين بخطوط:" : "Match the columns:") : "")}
              editMode={em}
              style={questionStyle?.fields?.find(field => field.key === "prompt")}
              onSelect={() => onSelectField?.("prompt")}
              onCommit={val => edit({ ...q, prompt: val })}
            />
            {q.type === "true_false" && (questionStyle?.trueFalseLayout ?? "choices") === "mark" && (
              <span className="ws-tf-mark" aria-hidden="true">(　　)</span>
            )}
          </div>
        </div>
      </div>
      <WorksheetQuestionVisual visual={q.visual} />
      {q.type === "mcq" && (
        <ol
          className="ws-mcq"
          data-choice-columns={questionStyle?.choiceColumns ?? 2}
          style={{ gridTemplateColumns: `repeat(${questionStyle?.choiceColumns ?? 2}, minmax(0, 1fr))` }}
        >
          {q.options.map((opt, i) => (
            <li key={i}>
              <span className="ws-mcq-letter">({optionLabel(i, ar)})</span>
              <span className="ws-mcq-text">
                <EditSpan
                  text={opt}
                  editMode={em}
                  style={questionStyle?.fields?.find(field => field.key === `option:${i}`)}
                  onSelect={() => onSelectField?.(`option:${i}`)}
                  onCommit={val => {
                    const opts = q.options.slice();
                    opts[i] = val;
                    edit({ ...q, options: opts });
                  }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
      {q.type === "true_false" && (questionStyle?.trueFalseLayout ?? "choices") === "choices" && (
        <div className="ws-tf-choices">
          <span className="ws-tf-choice"><span className="ws-tf-box" aria-hidden="true" />{labels.true}</span>
          <span className="ws-tf-choice"><span className="ws-tf-box" aria-hidden="true" />{labels.false}</span>
        </div>
      )}
      {q.type === "short_answer" && q.activity && <WorksheetActivityView activity={q.activity} seed={q.id} />}
      {q.type === "short_answer" && !q.activity && (
        <div className="ws-lines">
          {Array.from({ length: q.lines ?? 2 }).map((_, i) => <span key={i} className="ws-line" />)}
        </div>
      )}
      {q.type === "fill_blank" && (
        <div className="ws-fill"><span className="ws-fill-rule" /></div>
      )}
      {q.type === "matching" && (
        <div
          className="ws-match"
          ref={matchingRef}
          style={{
            gridTemplateColumns: `minmax(0, ${matchingFractions!.left}fr) 6mm minmax(0, ${matchingFractions!.right}fr)`,
          }}
          data-matching-left-share={matchingFractions!.left}
          data-matching-right-share={matchingFractions!.right}
        >
          <ul className="ws-match-col">
            {q.pairs.map((p, i) => (
              <li key={`l${i}`} className="ws-match-pair">
                <span className="ws-match-bullet ws-match-num">{i + 1}.</span>
                <span className="ws-match-text">
                  <EditSpan
                    text={p.left}
                    editMode={em}
                    style={questionStyle?.fields?.find(field => field.key === `match-left:${i}`)}
                    onSelect={() => onSelectField?.(`match-left:${i}`)}
                    onCommit={val => {
                      const pairs = q.pairs.map((pr, j) => j === i ? { ...pr, left: val } : pr);
                      edit({ ...q, pairs });
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <div
            className={`ws-match-divider${em ? " is-editable" : ""}`}
            role={em ? "separator" : undefined}
            aria-label={em ? (ar ? "اسحب لتغيير عرض عمودي التوصيل" : "Drag to resize matching columns") : undefined}
            aria-orientation={em ? "vertical" : undefined}
            aria-valuemin={em ? 35 : undefined}
            aria-valuemax={em ? 65 : undefined}
            aria-valuenow={em ? Math.round(matchingFractions!.left * 100) : undefined}
            tabIndex={em ? 0 : undefined}
            onPointerDown={event => {
              if (!em) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              updateMatchingWidthFromPointer(event.clientX);
            }}
            onPointerMove={event => {
              if (!em || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
              updateMatchingWidthFromPointer(event.clientX);
            }}
            onKeyDown={event => {
              if (!em || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
              event.preventDefault();
              event.stopPropagation();
              const visualDelta = event.key === "ArrowRight" ? 2 : -2;
              const delta = ar ? -visualDelta : visualDelta;
              const current = Math.round(matchingFractions!.left * 100);
              onMatchingWidthChange?.(Math.min(65, Math.max(35, current + delta)));
            }}
          >
            {em && <span className="ws-match-divider-handle" aria-hidden="true">↔</span>}
          </div>
          <ul className="ws-match-col">
            {matchingDisplayOrder(q.pairs.length).map((srcIdx, displayIdx) => (
              <li key={`r${displayIdx}`} className="ws-match-pair">
                <span className="ws-match-bullet ws-match-letter">({optionLabel(displayIdx, ar)})</span>
                <span className="ws-match-text">
                  <EditSpan
                    text={q.pairs[srcIdx].right}
                    editMode={em}
                    style={questionStyle?.fields?.find(field => field.key === `match-right:${srcIdx}`)}
                    onSelect={() => onSelectField?.(`match-right:${srcIdx}`)}
                    onCommit={val => {
                      const pairs = q.pairs.map((pr, j) => j === srcIdx ? { ...pr, right: val } : pr);
                      edit({ ...q, pairs });
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.type === "tic_tac_toe" && (
        <div className="ws-tic-board" role="group" aria-label={ar ? "لوحة الاختيار — ثلاثة على خط" : "Three-in-a-row choice board"}>
          {q.cells.map((cell, i) => (
            <div className="ws-tic-cell" key={i}>
              <span className="ws-tic-check" aria-hidden="true" />
              {cell.imageUrl && <img className="ws-tic-image" src={resolveImageUrl(cell.imageUrl) ?? ""} alt="" />}
              <span className="ws-tic-text">
                <EditSpan
                  text={cell.text}
                  editMode={em}
                  style={questionStyle?.fields?.find(field => field.key === `tic-cell:${i}`)}
                  onSelect={() => onSelectField?.(`tic-cell:${i}`)}
                  onCommit={value => {
                    const cells = q.cells.map((item, index) => index === i ? { ...item, text: value } : item);
                    edit({ ...q, cells });
                  }}
                />
              </span>
              <span className="ws-tic-writing" aria-hidden="true">
                <span /><span /><span />
              </span>
            </div>
          ))}
        </div>
      )}
      {q.type === "tic_tac_toe" && (questionStyle?.ticTacToeResponseLines ?? 0) > 0 && (
        <div className="ws-short-lines mt-4" aria-hidden="true">
          {Array.from({ length: questionStyle?.ticTacToeResponseLines ?? 0 }).map((_, idx) => (
            <div key={idx} className="ws-short-line" />
          ))}
        </div>
      )}
      {q.type === "worked_problem" && (
        <div className="ws-worked-problem">
          <div className="ws-response-label">{ar ? "خطوات الحل / مساحة العمل" : "Steps / Work area"}</div>
          <div className="ws-work-steps">
            {Array.from({
              length: Math.max(3, q.steps ?? 4),
            }).map((_, i) => (
              <div className="ws-work-step" key={i}>
                <span className="ws-work-step-num">{i + 1}</span>
                <span className="ws-work-step-line" />
              </div>
            ))}
          </div>
          <div className="ws-final-answer">
            <strong>{ar ? "الإجابة النهائية" : "Final answer"}</strong>
            <span />
          </div>
        </div>
      )}
      {q.type === "extended_response" && (
        <div className="ws-extended-response" aria-label={ar ? "مساحة الإجابة الموسعة" : "Extended response writing area"}>
          {Array.from({ length: Math.max(3, q.lines ?? 6) }).map((_, i) => <span className="ws-line" key={i} />)}
        </div>
      )}
      {q.type === "error_correction" && (
        <div className="ws-error-correction">
          <div className="ws-incorrect-box">
            <strong>{ar ? "النص غير الصحيح:" : "Incorrect text:"}</strong>
            <MathText text={q.incorrectText} fallbackDirection={ar ? "rtl" : "ltr"} />
          </div>
          <div className="ws-correction-area">
            <div className="ws-response-label">{ar ? "التصحيح" : "Correction"}</div>
            {Array.from({ length: questionStyle?.errorCorrectionCorrectionLines ?? 2 }).map((_, i) => <span className="ws-line" key={i} />)}
          </div>
          {(questionStyle?.errorCorrectionShowExplanation ?? true) && (
            <div className="ws-explanation-area">
              <div className="ws-response-label">{ar ? "التفسير" : "Explanation"}</div>
              {Array.from({ length: questionStyle?.errorCorrectionExplanationLines ?? 2 }).map((_, i) => <span className="ws-line" key={i} />)}
            </div>
          )}
        </div>
      )}
      {q.type === "compare" && (
        <div className="ws-compare-organizer">
          <div className="ws-compare-panel">
            <strong>
              <EditSpan
                text={q.leftLabel}
                editMode={em}
                onSelect={() => onSelectField?.("prompt")}
                onCommit={value => edit({ ...q, leftLabel: value })}
              />
            </strong>
            <span className="ws-compare-subtitle">
              <EditSpan
                text={questionStyle?.compareDifferencesLabel ?? (ar ? "خصائص واختلافات" : "Traits and differences")}
                editMode={em}
                onSelect={() => onSelectField?.("prompt")}
                onCommit={value => onQuestionStyleChange?.({ compareDifferencesLabel: value })}
              />
            </span>
            {Array.from({ length: 3 }).map((_, i) => <span className="ws-compare-line" key={i} />)}
          </div>
          <div className="ws-compare-panel ws-compare-similarities">
            <strong>
              <EditSpan
                text={questionStyle?.compareSimilaritiesLabel ?? (ar ? "أوجه التشابه" : "Similarities")}
                editMode={em}
                onSelect={() => onSelectField?.("prompt")}
                onCommit={value => onQuestionStyleChange?.({ compareSimilaritiesLabel: value })}
              />
            </strong>
            {Array.from({ length: 3 }).map((_, i) => <span className="ws-compare-line" key={i} />)}
          </div>
          <div className="ws-compare-panel">
            <strong>
              <EditSpan
                text={q.rightLabel}
                editMode={em}
                onSelect={() => onSelectField?.("prompt")}
                onCommit={value => edit({ ...q, rightLabel: value })}
              />
            </strong>
            <span className="ws-compare-subtitle">
              <EditSpan
                text={questionStyle?.compareDifferencesLabel ?? (ar ? "خصائص واختلافات" : "Traits and differences")}
                editMode={em}
                onSelect={() => onSelectField?.("prompt")}
                onCommit={value => onQuestionStyleChange?.({ compareDifferencesLabel: value })}
              />
            </span>
            {Array.from({ length: 3 }).map((_, i) => <span className="ws-compare-line" key={i} />)}
          </div>
        </div>
      )}
      {(q.type === "short_answer" || q.type === "tic_tac_toe") && questionStyle?.rubric && (
        <div className="ws-rubric">
          <strong>{ar ? "معيار النجاح:" : "Success criterion:"}</strong>
          <MathText text={questionStyle.rubric} fallbackDirection={ar ? "rtl" : "ltr"} />
        </div>
      )}
    </div>
    </div>
  );
}

function AnswerView({
  item, ar, labels,
}: { item: AnswerItem; ar: boolean; labels: { question: string; true: string; false: string; correct: string } }) {
  const { question: q, questionLabel, text, continuation } = item;
  return (
    <div className="ws-q ws-answer" data-answer-continuation={continuation || undefined}>
      <div className="ws-q-head">
        <span className="ws-q-num">{questionLabel}</span>
        <div className="ws-q-prompt-wrap">
          <div className="ws-q-prompt">
            <MathText
              text={q.type === "matching" ? (ar ? "أزواج التوصيل" : "Matching pairs") : q.prompt}
              fallbackDirection={ar ? "rtl" : "ltr"}
            />
            {continuation && <span className="ws-answer-cont-label"> ({ar ? "تابع" : "continued"})</span>}
          </div>
        </div>
      </div>
      <div className="ws-answer-line">
        <strong>{continuation ? (ar ? "تابع الإجابة:" : "Answer continued:") : labels.correct}</strong>{" "}
        <MathText text={text} fallbackDirection={ar ? "rtl" : "ltr"} />
      </div>
    </div>
  );
}

const ARABIC_OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"];
export function optionLabel(index: number, ar: boolean): string {
  return ar ? (ARABIC_OPTION_LABELS[index] ?? String(index + 1)) : String.fromCharCode(65 + index);
}

export function mobileToolbarScrollOffset(fieldBottom: number, toolbarTop: number, gap = 16): number {
  return Math.max(0, fieldBottom - (toolbarTop - gap));
}
export function convertQuestionType(question: Question, type: QuestionType, ar: boolean): Question {
  if (question.type === type) return question;
  const base = {
    id: question.id,
    prompt: question.prompt ?? "",
    ...(question.points !== undefined ? { points: question.points } : {}),
  };
  const existingAnswer =
    question.type === "mcq" ? (question.options[question.correctIndex] ?? "") :
    question.type === "true_false" ? (question.correct ? (ar ? "صح" : "True") : (ar ? "خطأ" : "False")) :
    question.type === "short_answer" || question.type === "fill_blank" ||
    question.type === "worked_problem" || question.type === "extended_response"
      ? (question.answer ?? "")
      : question.type === "error_correction" ? question.correction
      : "";

  if (type === "true_false") return { ...base, type, correct: true };
  if (type === "short_answer") return { ...base, type, lines: 2, answer: existingAnswer };
  if (type === "fill_blank") return { ...base, type, answer: existingAnswer };
  if (type === "worked_problem") return { ...base, type, steps: 4, answer: existingAnswer };
  if (type === "extended_response") return { ...base, type, lines: 6, answer: existingAnswer };
  if (type === "error_correction") return { ...base, type, incorrectText: base.prompt, correction: existingAnswer, explanation: "" };
  if (type === "word_bank") return { ...base, type, items: [], answers: [] };
  if (type === "compare") return {
    ...base, type,
    leftLabel: ar ? "العنصر الأول" : "Item A",
    rightLabel: ar ? "العنصر الثاني" : "Item B",
    similarities: "", differences: "",
  };
  if (type === "mcq") {
    const options = question.type === "matching"
      ? question.pairs.map(pair => pair.right).filter(Boolean).slice(0, 4)
      : [];
    while (options.length < 4) options.push(ar ? `الخيار ${options.length + 1}` : `Option ${options.length + 1}`);
    return { ...base, type, options, correctIndex: 0 };
  }
  if (type === "tic_tac_toe") {
    const categories = ar
      ? ["تذكّر", "فسّر", "طبّق", "قارن", "ارسم", "اكتب", "حلّل", "أنشئ", "تحدَّ"]
      : ["Recall", "Explain", "Apply", "Compare", "Draw", "Write", "Analyze", "Create", "Challenge"];
    return {
      ...base,
      type,
      prompt: ar
        ? "اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام."
        : "Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",
      cells: categories.map(category => ({ category, text: "" })),
    };
  }
  const sourceOptions = question.type === "mcq" ? question.options : [];
  const pairs = Array.from({ length: Math.max(3, Math.min(4, sourceOptions.length)) }, (_, index) => ({
    left: ar ? `العبارة ${index + 1}` : `Item ${index + 1}`,
    right: sourceOptions[index] || (ar ? `الإجابة ${index + 1}` : `Answer ${index + 1}`),
  }));
  return { ...base, type, pairs };
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

export function matchingColumnFractions(pairs: Array<{ left: string; right: string }>): { left: number; right: number } {
  const score = (values: string[]) => {
    if (values.length === 0) return 1;
    const lengths = values.map(value => value.trim().length);
    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    return average + Math.max(...lengths) * 0.5;
  };
  const leftScore = score(pairs.map(pair => pair.left));
  const rightScore = score(pairs.map(pair => pair.right));
  const rawLeft = leftScore / (leftScore + rightScore);
  const left = Math.round(Math.min(0.65, Math.max(0.35, rawLeft)) * 100) / 100;
  return { left, right: Math.round((1 - left) * 100) / 100 };
}

/** Screen-only editor chrome (strip, pencil, lighter selection, compact tools). Never affects print. */
function EditorChromeStyles({ TC }: { TC: string }) {
  return <style>{`
    @media screen {
      .ws-edit-strip { position: sticky; top: 52px; z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; padding: 6px 12px; background: #fbfaf5; border-bottom: 1px solid ${TC}22; }
      .ws-strip-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 10px; border: 1px solid ${TC}44; background: #fff; color: ${TC}; font-size: 12px; font-weight: 800; cursor: pointer; }
      .ws-strip-btn:hover { background: ${TC}0f; }
      .ws-strip-btn.is-primary { background: ${TC}; color: #fff; border-color: ${TC}; }
      .ws-edit-hint { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #4b5a53; }
      .ws-edit-hint button { border: 0; background: transparent; color: ${TC}; font-weight: 800; text-decoration: underline; cursor: pointer; }
      .ws-question-block { position: relative; }
      .ws-q-pencil { position: absolute; top: 2px; inset-inline-end: -4px; z-index: 5; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; border: 1px solid ${TC}44; background: #fff; color: ${TC}; cursor: pointer; opacity: 0; transition: opacity 120ms ease; }
      .ws-q-pencil svg { width: 14px; height: 14px; }
      .ws-question-block:hover .ws-q-pencil, .ws-q-pencil:focus-visible { opacity: 1; }
      .ws-q-pencil { width: calc(28px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(28px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); }
      @media (hover: none) { .ws-q-pencil { opacity: 1; width: calc(44px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(44px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); top: -4px; } .ws-q-pencil svg { width: calc(20px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(20px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); } }
      .ws-q-selected { outline: 1px solid ${TC}77 !important; outline-offset: 3px; background: ${TC}07 !important; }
      .ws-format-toolbar { padding: 6px 8px !important; border-width: 1px !important; gap: 5px 8px !important; box-shadow: 0 6px 20px rgba(20,40,32,0.2) !important; }
      .ws-format-details-toggle { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid ${TC}44; background: #fff; color: ${TC}; font-size: 11px; font-weight: 800; cursor: pointer; }
      .ws-format-details-toggle.is-active { background: ${TC}14; }
    }
  `}</style>;
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
      @media screen {
        .print-host[data-responsive-preview] {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow-x: clip;
        }
        .print-host[data-responsive-preview] > .ws-page {
          zoom: var(--ws-preview-scale, 1);
          flex-shrink: 0;
        }
      }
      @media screen and (max-width: 640px) {
        .ws-action-toolbar {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          gap: 8px;
          padding: 10px 12px;
        }
        .ws-action-toolbar > .ws-actions {
          grid-column: 1 / -1;
          justify-content: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .ws-action-toolbar button {
          min-height: 40px;
          justify-content: center;
        }
        .ws-actions > button {
          flex: 1 1 auto;
          padding: 8px 10px;
          white-space: nowrap;
        }
        .ws-edit-tools {
          max-width: calc(100vw - 32px);
          box-sizing: border-box;
          flex-wrap: wrap;
          justify-content: center;
          border-radius: 16px !important;
          bottom: max(16px, env(safe-area-inset-bottom)) !important;
        }
      }
      .ws-page {
        position: relative;
        box-sizing: border-box;
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 0 auto 18px auto;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${fontSizePt}pt;
        line-height: 1.85;
        page-break-after: always;
        break-after: page;
        break-inside: avoid;
        overflow: visible;
        border-radius: 4px;
      }
      .ws-page:last-of-type {
        page-break-after: auto;
        break-after: auto;
        margin-bottom: 0;
      }
      .ws-content {
        position: relative;
        z-index: 1;
        box-sizing: border-box;
        padding: 18mm 18mm 16mm 18mm;
        display: flex;
        flex-direction: column;
        /* Include the 34mm vertical padding inside the A4 height. Without
           border-box Chromium fragments every worksheet article and can
           repeat the first-looking fragment in Save as PDF. */
        min-height: calc(297mm - var(--ws-frame, 0px));
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
        font-size: 112pt;
        color: ${TC};
        opacity: 0.022;
        transform: rotate(-16deg);
        white-space: nowrap;
        letter-spacing: ${isAr ? "0" : "0.035em"};
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

      /* ── Header layout ───────────────────────────────────────────
         Three fixed columns: identity (right) | title (center) | logo (left).
         Both side columns are the same width so the title is always truly
         centered and the logo sits exactly opposite the identity text. */
      .ws-header { margin-bottom: 6mm; }
      .ws-headrow {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 5mm;
      }
      .ws-headstart {
        flex: 0 0 52mm;
        display: flex; flex-direction: column; gap: 3mm;
        font-size: ${Math.max(9, fontSizePt - 1.5)}pt;
      }
      .ws-headend {
        flex: 0 0 52mm;
        display: flex;
        align-items: flex-start;
        justify-content: center;
      }
      .ws-headrow-title-only .ws-headstart,
      .ws-headrow-title-only .ws-headend {
        display: none;
      }
      .ws-headrow-title-only .ws-headcenter {
        flex: 1;
        min-width: 0;
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
      .ws-learning-objective {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 3mm;
        padding: 2.2mm 3mm;
        border: 0.35mm solid ${TC}33;
        border-radius: 2.2mm;
        background: ${TC}0D;
        font-size: 9.5pt;
      }
      .ws-learning-objective strong { color: ${TC}; white-space: nowrap; }
      .ws-learning-objective small {
        margin-${startSide}: auto;
        white-space: nowrap;
        color: #566;
        font-weight: 700;
      }
      .ws-rubric {
        display: flex;
        gap: 1.5mm;
        margin-top: 2mm;
        padding: 1.5mm 2mm;
        border-${startSide}: 0.9mm solid ${TC};
        background: ${TC}0D;
        font-size: 8.5pt;
        line-height: 1.45;
      }
      .ws-rubric strong { color: ${TC}; white-space: nowrap; }

      /* Questions */
      .ws-questions {
        column-gap: 8mm;
        flex: 1;
      }
      .ws-q {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 5mm;
        padding: 2.5mm 0 3mm;
        border-bottom: 1px solid ${TC}18;
        background: transparent;
        border-radius: 0;
      }
      .ws-question-block {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 5mm;
      }
      .ws-question-block > .ws-q { margin-bottom: 0; }
      .ws-question-block.ws-q-spacing-compact {
        margin-bottom: 2mm;
      }
      .ws-question-block.ws-q-spacing-compact > .ws-q {
        padding-top: 1.5mm;
        padding-bottom: 1.5mm;
      }
      .ws-question-block.ws-q-spacing-relaxed {
        margin-bottom: 9mm;
      }
      .ws-question-block.ws-q-spacing-relaxed > .ws-q {
        padding-top: 4mm;
        padding-bottom: 5mm;
      }
      .ws-q-editable {
        cursor: pointer;
        border-radius: 8px;
        transition: outline-color 120ms ease, background-color 120ms ease;
      }
      .ws-q-editable:hover { background: ${TC}08; outline: 1px dashed ${TC}55; }
      .ws-q-selected {
        background: ${TC}0d;
        outline: 2px solid ${TC};
        outline-offset: 3px;
      }
      .ws-q-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 3mm; }
      .ws-q-num {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px;
        background: white;
        color: ${TC};
        border: 1.5px solid ${TC};
        border-radius: 2px;
        font-weight: 800;
        font-size: ${Math.max(9.5, fontSizePt - 1)}pt;
        font-family: ${headingFont};
        box-shadow: none;
      }
      .ws-q-prompt-wrap { flex: 1; min-width: 0; }
      /* Section instruction — shown once before the first question of each type group */
      .ws-section-instr {
        font-size: ${Math.max(9, fontSizePt - 1.5)}pt;
        font-weight: 700;
        color: ${TC};
        border-${startSide}: 3px solid ${TC};
        padding: 2mm 4mm;
        margin: 3mm 0 2mm;
        background: ${TC}08;
        border-radius: 0 4px 4px 0;
        break-inside: avoid;
      }
      /* Points badge — still shown per-question when points are assigned */
      .ws-q-typeline { display: flex; align-items: center; gap: 8px; margin-bottom: 1mm; }
      .ws-q-points {
        font-size: ${Math.max(7.5, fontSizePt - 3.5)}pt;
        font-weight: 800;
        color: ${BRAND_GOLD};
        background: ${BRAND_GOLD}18;
        padding: 1.5px 7px;
        border-radius: 999px;
      }
      .ws-q-prompt { font-weight: 600; color: #1a2421; line-height: 1.7; }

      /* ── Inline text editing ────────────────────────────────── */
      .ws-editable {
        outline: none;
        cursor: text;
        border-radius: 3px;
        transition: background 0.12s, box-shadow 0.12s;
        white-space: pre-wrap;
        word-break: break-word;
        display: inline;
        background: rgba(217, 165, 33, 0.10);
        box-shadow: 0 0 0 1.5px rgba(217, 165, 33, 0.35);
        padding: 0 2px;
      }
      .ws-editable:hover {
        background: rgba(217, 165, 33, 0.18);
        box-shadow: 0 0 0 2px rgba(217, 165, 33, 0.5);
      }
      .ws-editable:focus {
        background: white;
        box-shadow: 0 0 0 2px #D9A521, 0 2px 8px rgba(217, 165, 33, 0.25);
      }
      @media print { .ws-editable { background: none !important; box-shadow: none !important; } }

      .ws-mcq { list-style: none; padding-${startSide}: 34px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr; gap: 2mm 16px; }
      .ws-mcq li {
        display: flex; gap: 8px; align-items: baseline;
        line-height: 1.6;
        min-height: 6mm;
        border-bottom: 1px dotted ${TC}24;
        padding-bottom: 1mm;
      }
      .ws-mcq-letter {
        display: inline-block;
        min-width: 24px;
        font-weight: 700;
        color: ${TC};
        font-family: ${headingFont};
      }
      .ws-mcq-text { flex: 1; }

      .ws-tf-mark {
        display: inline-block;
        direction: ltr;
        white-space: nowrap;
        min-width: 17mm;
        margin-inline-start: 2mm;
        font-family: Arial, sans-serif;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .ws-tf-choices {
        display: flex;
        align-items: center;
        gap: 14mm;
        padding-${startSide}: 34px;
        margin-top: 2mm;
      }
      .ws-tf-choice {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-weight: 700;
      }
      .ws-tf-box {
        display: inline-block;
        width: 15px;
        height: 15px;
        border: 1.5px solid ${TC};
        border-radius: 2px;
        background: white;
      }

      .ws-lines { padding-${startSide}: 36px; margin-top: 2mm; }
      .ws-line {
        display: block;
        border-bottom: 1px dotted ${TC}66;
        height: 8mm;
      }
      .ws-response-label {
        color: ${TC};
        font-weight: 800;
        font-size: ${Math.max(8.5, fontSizePt - 2)}pt;
        margin-bottom: 1mm;
      }
      .ws-worked-problem, .ws-extended-response, .ws-error-correction,
      .ws-compare-organizer {
        margin-top: 2mm;
        margin-inline-start: 9mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ws-work-steps { display: flex; flex-direction: column; gap: 1mm; }
      .ws-work-step { display: flex; align-items: flex-end; gap: 2mm; min-height: 7mm; }
      .ws-work-step-num {
        color: ${TC}; font-weight: 700; font-size: 8pt;
        width: 5mm; flex: 0 0 5mm; text-align: center;
      }
      .ws-work-step-line, .ws-final-answer > span, .ws-word-bank-blank {
        flex: 1; min-width: 12mm; border-bottom: 0.3mm dotted ${TC}77;
      }
      .ws-final-answer {
        display: flex; align-items: flex-end; gap: 3mm;
        margin-top: 3mm; padding: 2mm 3mm;
        border: 0.4mm solid ${TC}; border-radius: 1.5mm;
      }
      .ws-final-answer strong { color: ${TC}; white-space: nowrap; }
      .ws-extended-response { display: flex; flex-direction: column; }
      .ws-incorrect-box {
        padding: 2.5mm 3mm; border: 0.35mm solid #9f3434;
        border-inline-start-width: 1mm; background: #fff8f7;
        display: flex; gap: 2mm; align-items: baseline;
      }
      .ws-incorrect-box strong { color: #8b2e2e; white-space: nowrap; }
      .ws-correction-area, .ws-explanation-area { margin-top: 2.5mm; }
      .ws-word-bank {
        border: 0.4mm solid ${TC}; border-radius: 2mm;
        padding: 2mm 3mm; text-align: center; background: ${TC}08;
        margin: 2mm 0 3mm;
        margin-inline-start: 9mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ws-word-bank > strong { display: block; color: ${TC}; font-size: 8.5pt; margin-bottom: 1mm; }
      .ws-word-bank > div { display: flex; flex-wrap: wrap; justify-content: center; gap: 1mm 4mm; }
      .ws-word-bank > div > span { white-space: nowrap; font-weight: 700; }
      .ws-compare-organizer {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .8fr) minmax(0, 1fr);
        border: 0.4mm solid ${TC}; border-radius: 2mm; overflow: hidden;
      }
      .ws-compare-panel {
        min-width: 0; min-height: 35mm; padding: 3mm;
        display: flex; flex-direction: column; gap: 2mm;
        border-inline-end: 0.3mm solid ${TC}66;
      }
      .ws-compare-panel:last-child { border-inline-end: 0; }
      .ws-compare-panel > strong { color: ${TC}; text-align: center; line-height: 1.35; }
      .ws-compare-similarities { background: ${TC}0A; }
      .ws-compare-subtitle { color: #5a6663; font-size: 8pt; text-align: center; }
      .ws-compare-line { display: block; flex: 1 1 6mm; min-height: 5mm; border-bottom: 0.25mm dotted ${TC}66; }

      .ws-fill { padding-${startSide}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${TC};
      }

      .ws-match {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr);
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
        display: flex; align-items: baseline; gap: 7px;
        background: transparent;
        border: 0;
        border-bottom: 1px dotted ${TC}33;
        border-radius: 0;
        padding: 3px 2px 5px;
        font-weight: 500;
        min-height: 7mm;
      }
      .ws-match-bullet {
        display: inline-flex; align-items: center; justify-content: flex-start;
        min-width: 22px;
        font-weight: 700;
        font-family: ${headingFont};
        font-size: ${Math.max(9, fontSizePt - 1.5)}pt;
        flex: 0 0 auto;
      }
      .ws-match-num { background: transparent; color: ${TC}; }
      .ws-match-letter { background: transparent; color: ${TC}; }
      .ws-match-text { flex: 1; }
      .ws-tic-board {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border: 0.5mm solid ${TC};
        border-radius: 3mm;
        overflow: hidden;
        margin-top: 3mm;
        break-inside: avoid;
      }
      .ws-tic-cell {
        position: relative;
        min-height: 55mm;
        padding: 7mm 4mm 3.5mm;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 2.5mm;
        text-align: start;
        border-inline-end: 0.3mm solid color-mix(in srgb, ${TC} 45%, transparent);
        border-bottom: 0.3mm solid color-mix(in srgb, ${TC} 45%, transparent);
      }
      .ws-tic-cell:nth-child(3n) { border-inline-end: 0; }
      .ws-tic-cell:nth-child(n+7) { border-bottom: 0; }
      .ws-tic-check {
        position: absolute;
        top: 2.5mm;
        inset-inline-start: 2.5mm;
        width: 4mm;
        height: 4mm;
        border: 0.35mm solid ${TC};
        border-radius: 1mm;
      }
      .ws-tic-image {
        width: 100%;
        max-height: 22mm;
        object-fit: contain;
        border-radius: 1.5mm;
      }
      .ws-tic-text {
        font-size: 9.5pt;
        line-height: 1.65;
        font-weight: 700;
        text-wrap: pretty;
      }
      .ws-tic-writing {
        display: flex;
        flex: 1 1 auto;
        min-height: 17mm;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6mm;
        margin-top: auto;
      }
      .ws-tic-writing > span {
        display: block;
        height: 0;
        border-bottom: 0.25mm dotted ${TC}66;
      }
      .ws-match-tab { flex: 0 0 0; }
      .ws-match-divider {
        background: ${TC}22;
        width: 1px;
        margin: 0 auto;
        position: relative;
      }
      .ws-match-divider.is-editable {
        width: 6mm;
        background: transparent;
        cursor: col-resize;
        touch-action: none;
      }
      .ws-match-divider.is-editable::before {
        content: "";
        position: absolute;
        inset-block: 0;
        left: 50%;
        width: 2px;
        transform: translateX(-50%);
        background: ${TC};
      }
      .ws-match-divider-handle {
        position: sticky;
        top: 50%;
        transform: translate(-50%, -50%);
        left: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: ${TC};
        color: white;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(20,40,32,0.25);
        font-size: 12px;
        font-weight: 900;
      }

      .ws-format-toolbar {
        position: fixed;
        left: 50%;
        bottom: 68px;
        transform: translateX(-50%);
        z-index: 50;
        width: min(760px, calc(100vw - 24px));
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 7px 12px;
        padding: 9px 12px;
        background: linear-gradient(135deg, #edf7f2 0%, #f7fbf9 100%);
        color: #22312c;
        border: 2px solid ${TC};
        border-radius: 14px;
        box-shadow: 0 12px 34px rgba(20,40,32,0.28);
        font-family: ${headingFont};
      }
      .ws-format-selection {
        flex: 0 0 auto;
        padding: 6px 10px;
        border-radius: 8px;
        background: ${TC};
        color: white;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }
      .ws-format-group {
        display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center;
        padding: 5px 7px;
        background: rgba(255,255,255,0.82);
        border: 1px solid ${TC}24;
        border-radius: 9px;
      }
      .ws-format-label { font-size: 10px; font-weight: 800; color: ${TC}; margin-inline: 2px; }
      .ws-format-toolbar button {
        min-width: 30px; height: 30px;
        border: 1px solid ${TC}28;
        border-radius: 7px;
        background: white;
        color: ${TC};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }
      .ws-format-toolbar button:hover, .ws-format-toolbar button.is-active {
        background: ${TC};
        color: white;
        border-color: ${TC};
      }
      .ws-format-toolbar button:focus-visible,
      .ws-format-toolbar input:focus-visible,
      .ws-format-toolbar select:focus-visible {
        outline: 3px solid ${BRAND_GOLD};
        outline-offset: 2px;
      }
      .ws-format-toolbar button svg { width: 14px; height: 14px; }
      .ws-format-text-btn { padding-inline: 8px; }
      .ws-format-value { min-width: 22px; text-align: center; font-size: 11px; font-weight: 800; }
      .ws-format-range { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${TC}; }
      .ws-format-range input { width: 86px; accent-color: ${TC}; }
      .ws-format-type { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: ${TC}; }
      .ws-format-control { flex: 0 0 auto; white-space: nowrap; }
      .ws-format-type select, .ws-format-type input {
        height: 30px;
        max-width: 155px;
        border: 1px solid ${TC}38;
        border-radius: 7px;
        background: white;
        color: ${TC};
        padding-inline: 8px;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }
      @media (max-width: 640px) {
        .ws-format-toolbar {
          bottom: max(8px, env(safe-area-inset-bottom));
          width: calc(100vw - 16px);
          max-height: min(42vh, 250px);
          justify-content: flex-start;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 8px;
          gap: 6px;
        }
        .ws-format-group {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          justify-content: flex-start;
          flex-wrap: wrap;
          overflow-x: visible;
          padding: 3px 2px;
          gap: 6px;
        }
        .ws-format-toolbar button {
          min-width: 38px;
          height: 38px;
          flex: 0 0 auto;
        }
        .ws-format-text-btn {
          min-width: 0 !important;
          max-width: 100%;
          height: auto !important;
          min-height: 38px;
          white-space: normal;
          padding-block: 6px;
        }
        .ws-format-type { min-width: 0; max-width: 100%; flex-wrap: wrap; }
        .ws-format-control { max-width: 100%; white-space: normal; }
        .ws-format-toolbar-open {
          padding-bottom: min(46vh, 270px) !important;
        }
        .ws-editable { scroll-margin-bottom: min(46vh, 270px); }
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

      /* School logo — sits in ws-headend, which mirrors ws-headstart width */
      .ws-logo-img {
        max-height: 22mm; max-width: 44mm;
        width: auto; height: auto;
        object-fit: contain;
        display: block;
      }

      /* Answer key tweaks */
      .ws-answer { margin-bottom: 4mm; padding: 3mm 4mm; }
      .ws-answer .ws-q-num { background: ${BRAND_GOLD}; box-shadow: 0 0 0 2px ${TC}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${startSide}: 36px;
        color: ${TC};
        font-size: ${Math.max(9.5, fontSizePt - 0.5)}pt;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ws-answer-line strong { color: ${BRAND_GOLD}; margin-${endSide}: 4px; }
      .ws-answer-cont-label { color: ${TC}88; font-size: 0.9em; }

      /* ── Page layout panel (no-print) ─────────────────────────── */
      .ws-layout-panel {
        position: sticky;
        top: 0;
        z-index: 30;
        background: #f8f9f8;
        border-bottom: 1px solid;
        padding: 10px 16px 12px;
        font-family: ${headingFont};
      }
      .ws-layout-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .ws-layout-thumbs {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .ws-layout-thumb {
        flex: 0 0 auto;
        min-width: 140px;
        max-width: 200px;
        border: 2px solid;
        border-radius: 8px;
        padding: 8px;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .ws-layout-thumb-badge {
        color: white;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 999px;
        display: inline-block;
        margin-bottom: 7px;
        letter-spacing: 0.03em;
      }
      .ws-layout-thumb-qs {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ws-layout-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 6px 3px 4px;
        border-radius: 6px;
        border: 1px solid;
        font-size: 11px;
        cursor: grab;
        user-select: none;
        transition: opacity 0.15s;
      }
      .ws-layout-chip:active { cursor: grabbing; }
      .ws-layout-chip-num {
        color: white;
        font-weight: 800;
        font-size: 10px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ws-layout-chip-icon {
        font-size: 10px;
        color: #888;
        flex-shrink: 0;
      }
      .ws-layout-chip-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10.5px;
        color: #333;
      }
      .ws-layout-break-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        padding: 0 2px;
        line-height: 1;
        flex-shrink: 0;
        opacity: 0.6;
        transition: opacity 0.12s;
      }
      .ws-layout-break-btn:hover { opacity: 1; }
      .ws-layout-drop-hint {
        border: 2px dashed;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        text-align: center;
        padding: 4px;
        letter-spacing: 0.03em;
      }

      /* ── Break-before overlay button (appears on each question
           in the printed view when the panel is open) ────────── */
      .ws-q-wrapper { position: relative; }
      .ws-break-btn {
        position: absolute;
        top: -1px;
        ${isAr ? "right" : "left"}: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px 2px 5px;
        border-radius: 0 0 6px 0;
        border: 1px solid currentColor;
        background: white;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s;
        font-family: ${headingFont};
        white-space: nowrap;
      }
      .ws-q-wrapper:hover .ws-break-btn { opacity: 0.9; }
      .ws-break-btn:hover { opacity: 1 !important; }

      /* ── Panel toggle floating button ────────────────────────── */
      .ws-panel-toggle {
        position: fixed;
        bottom: 20px;
        ${isAr ? "left" : "right"}: 20px;
        z-index: 35;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 999px;
        border: 2px solid;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        transition: background 0.15s, color 0.15s;
        font-family: ${headingFont};
      }
      .ws-panel-toggle-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #f59e0b;
        flex-shrink: 0;
      }

      @media print {
        @page { size: A4; margin: 0; }
        html, body, #root {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        .no-print { display: none !important; }
        .print-host {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: auto !important;
          display: block !important;
          width: 100% !important;
        }
        .ws-page {
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          page-break-after: always !important;
          break-after: page !important;
          break-inside: avoid !important;
        }
        .ws-page:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        /* عند الطباعة نترك بضع بكسلات احتياطاً — أي صفحة يتجاوز ارتفاعها
           297mm ولو بكسراً واحداً تنقسم في PDF إلى صفحة + شريحة مكررة. */
        .ws-content {
          box-sizing: border-box !important;
          min-height: calc(297mm - var(--ws-frame, 0px) - 10px) !important;
          /* Keep the unscaled A4 box inside its page when a long header and
             near-full-page question leave only a pixel-scale safety margin. */
          padding-bottom: calc(16mm - 4px) !important;
        }
        /* Core base elements */
        .ws-watermark, .ws-watermark-word,
        .ws-corner, .ws-q, .ws-instructions, .ws-school-cell,
        .ws-q-num, .ws-q-typebadge, .ws-q-points,
        .ws-match-bullet, .ws-divider-thick, .ws-divider-thin,
        .ws-kicker-center,
        /* Theme-specific colored elements */
        .ws-band-top, .ws-play-banner, .ws-tab-sub, .ws-tab-header,
        .ws-clip-badge, .ws-clip-badge-sec,
        .ws-arb-diamond, .ws-arb-diamond-sm,
        .ws-mast-rule-thick, .ws-mast-rule-mid,
        .ws-exam-header {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>
  );
}

// ─────────────────────────────────────────────────────────────────
// شارة QR للتصحيح الذكي — تُطبع في أسفل كل صفحة عند تفعيل التصحيح.
// تحتوي رابط صفحة التصحيح فقط (+ رقم الصفحة) — لا إجابات ولا بيانات حساسة.
function GradeQrBadge({ worksheetId, page, total, ar }: {
  worksheetId: number; page: number; total: number; ar: boolean;
}) {
  const url = `${window.location.origin}/teacher/worksheets/${worksheetId}/grade?p=${page}&of=${total}`;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "6mm",
        insetInlineStart: "8mm",
        display: "flex",
        alignItems: "center",
        gap: "2mm",
        zIndex: 5,
      }}
    >
      <div style={{ background: "white", padding: "1mm", border: "0.4mm solid #d4d4d4", borderRadius: "1mm", lineHeight: 0 }}>
        <QRCode value={url} size={52} style={{ width: "13mm", height: "13mm" }} />
      </div>
      <div style={{ fontSize: "7pt", color: "#8a8a8a", lineHeight: 1.5, fontWeight: 600 }}>
        <div>{ar ? "امسح للتصحيح الذكي" : "Scan to grade"}</div>
        {total > 1 && <div style={{ fontWeight: 800, color: "#5a5a5a" }}>{ar ? `صفحة ${page} / ${total}` : `Page ${page} / ${total}`}</div>}
      </div>
    </div>
  );
}
export function buildAnswerItems(
  questions: Question[],
  ar: boolean,
  labels: { true: string; false: string },
): AnswerItem[] {
  return questions.map((question, index) => {
    return {
      id: `${question.id}:answer`,
      question,
      questionLabel: String(index + 1),
      text: answerText(question, ar, labels),
      continuation: false,
    };
  });
}

function splitAnswerItemHalf(item: AnswerItem): [AnswerItem, AnswerItem] | null {
  if (item.text.length < 2) return null;
  const midpoint = Math.floor(item.text.length / 2);
  const before = item.text.lastIndexOf(" ", midpoint);
  const after = item.text.indexOf(" ", midpoint);
  const splitAt = before > midpoint * 0.6 ? before : after > 0 ? after : midpoint;
  const firstText = item.text.slice(0, splitAt).trimEnd();
  const secondText = item.text.slice(splitAt).trimStart();
  if (!firstText || !secondText) return null;
  return [
    { ...item, id: `${item.id}:a`, text: firstText },
    { ...item, id: `${item.id}:b`, text: secondText, continuation: true },
  ];
}
export function answerText(q: Question, ar: boolean, labels: { true: string; false: string }): string {
  if (q.type === "mcq") {
    return `(${optionLabel(q.correctIndex, ar)}) ${q.options[q.correctIndex] ?? ""}`;
  }
  if (q.type === "true_false") return q.correct ? labels.true : labels.false;
  if (q.type === "short_answer") return q.answer?.trim() || "—";
  if (q.type === "fill_blank") return q.answer;
  if (q.type === "worked_problem" || q.type === "extended_response") {
    return q.answer?.trim() || "—";
  }
  if (q.type === "error_correction") {
    const correction = q.correction.trim() || "—";
    const explanation = q.explanation?.trim();
    return explanation
      ? `${ar ? "التصحيح:" : "Correction:"} ${correction} — ${ar ? "التفسير:" : "Explanation:"} ${explanation}`
      : `${ar ? "التصحيح:" : "Correction:"} ${correction}`;
  }
  if (q.type === "word_bank") {
    return q.items.map((item, index) => {
      const answer = q.answers[index];
      return `${index + 1}. ${answer?.trim() || "—"}`;
    }).join("    ");
  }
  if (q.type === "compare") {
    const similarities = q.similarities;
    const differences = q.differences;
    const parts = [
      similarities?.trim() ? `${ar ? "أوجه التشابه:" : "Similarities:"} ${similarities.trim()}` : "",
      differences?.trim() ? `${ar ? "أوجه الاختلاف:" : "Differences:"} ${differences.trim()}` : "",
    ].filter(Boolean);
    return parts.join(" — ") || "—";
  }
  if (q.type === "tic_tac_toe") return ar
    ? "تُقيّم المهام الثلاث المتصلة التي اختارها الطالب"
    : "Grade the three connected tasks selected by the student";
  const order = matchingDisplayOrder(q.pairs.length);
  return q.pairs.map((_, i) => {
    const displayIdx = order.indexOf(i);
    return `${i + 1} ← ${optionLabel(displayIdx >= 0 ? displayIdx : i, ar)}`;
  }).join("    ");
}
