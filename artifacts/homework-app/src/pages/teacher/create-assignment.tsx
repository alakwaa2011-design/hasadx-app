import { useState, useRef, useEffect, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { useCreateAssignment } from "@workspace/api-client-react";
import type { CreateQuestionBody } from "@workspace/api-client-react";
import { mapExtractedToActivity, extractFileError, fingerprintFilesContent } from "@/lib/map-extracted-to-activity";
import { Layout } from "@/components/layout";
import { Input, Button, Label } from "@/components/ui-elements";
import {
  Plus, Trash2, Save, ArrowRight, ArrowLeft, Image, CheckCircle2, X,
  Monitor, FileText, Image as ImageIcon, Layers, Globe, Lock, GraduationCap, Copy, Star,
  Eye, EyeOff, Sparkles, Wand2, Loader2, ChevronUp, ChevronDown,
  Calendar, Database, Clock, Settings, Settings2, Brain,
  Tag, Camera, Upload, ChevronRight, GripVertical, Volume2, Play, Square,
  Share2, ExternalLink, BarChart3, PartyPopper,
  FilePenLine, ListChecks, Send as SendIcon, Check, RotateCcw, Gamepad2, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fileToBase64 } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/image-url";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import {
  creditAwareFetch,
  isInsufficientCreditsResponse,
} from "@/lib/credit-aware-fetch";
import { getSuggestions, addMultipleSuggestions, addSuggestion } from "@/lib/suggestions";
import { TEMPLATES, type AssignmentTemplate } from "@/lib/activity-templates";
import {
  getPublishBlockReason, hasAtLeastOneQuestion, DEFAULT_AI_QUESTION_COUNT,
  PUBLISH_BLOCK_MESSAGES_AR, PUBLISH_BLOCK_MESSAGES_EN,
} from "@/lib/activity-wizard";

const API_BASE = import.meta.env.VITE_API_URL || "";

const MAX_SOURCE_TEXT_LENGTH = 12000;
const ADAPTIVE_SUPPORTED_QUESTION_TYPES = ["mcq", "true_false", "fill_blank"] as const;
const isAdaptiveSupportedQuestionType = (type?: string | null) =>
  ADAPTIVE_SUPPORTED_QUESTION_TYPES.includes((type || "mcq") as typeof ADAPTIVE_SUPPORTED_QUESTION_TYPES[number]);
/** Hasaad brand — dark forest green (matches dashboard / layout), not teal/cyan */
const HASAD_GREEN = "#1E4D35";
const HASAD_GREEN_MID = "#225739";
const HASAD_GREEN_DEEP = "#17382a";
const HASAD_HEADER_GRADIENT = `linear-gradient(135deg, ${HASAD_GREEN} 0%, ${HASAD_GREEN_MID} 55%, #1a4530 100%)`;
const HASAD_CTA_GRADIENT = `linear-gradient(90deg, ${HASAD_GREEN} 0%, ${HASAD_GREEN_DEEP} 100%)`;

type SubmissionMode = "electronic" | "paper" | "both";
type AccessMode = "public" | "private";
type ExtractSourceMode = "file" | "text";
type ExtractCounts = { mcq: number; true_false: number; fill_blank: number };
type QuestionWithTts = CreateQuestionBody & {
  readAloud?: boolean;
  allowMultipleAnswers?: boolean;
  repeatQuestion?: boolean;
  correctAnswers?: string[];
  _clientId?: string;
  /** Client-only: fingerprint of the source-file set this question was
      extracted from — used for "same source again" replace/add/cancel. */
  _extractKey?: string;
};

let _qClientIdCounter = 0;
const nextClientId = () => `qcid-${++_qClientIdCounter}`;
const ensureClientIds = (qs: QuestionWithTts[]): QuestionWithTts[] =>
  qs.map(q => (q._clientId ? q : { ...q, _clientId: nextClientId() }));

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ══════════════════════════════════════════════
// القوالب — moved to src/lib/activity-templates.ts (pure, unit-tested)
// ══════════════════════════════════════════════

const MATH_GROUPS = [
  { labelAr: "أساسي", labelEn: "Basic", symbols: ["×", "÷", "≠", "≈", "≤", "≥", "±", "∞"] },
  { labelAr: "قوى", labelEn: "Powers", symbols: ["²", "³", "⁴", "⁵", "⁶", "√", "∛", "∜"] },
  { labelAr: "كسور", labelEn: "Fractions", symbols: ["½", "⅓", "¼", "¾", "⅔", "⅕", "⅖", "⅗"] },
  { labelAr: "يونانية", labelEn: "Greek", symbols: ["π", "θ", "α", "β", "γ", "δ", "λ", "μ", "σ", "Σ", "φ", "Ω", "Δ", "ω"] },
  { labelAr: "هندسة", labelEn: "Geometry", symbols: ["°", "∠", "⊥", "∥", "△", "∡", "⊿"] },
  { labelAr: "حساب", labelEn: "Calculus", symbols: ["∫", "∂", "∑", "∏", "∈", "∉", "⊂", "∪", "∩"] },
];

// Typed lookup for MCQ option fields — avoids `as any` casts throughout the component
const MCQ_OPT = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
} as const satisfies Record<string, keyof CreateQuestionBody>;

const COLOR_THEMES = [
  { id: "green", label: "أخضر", labelEn: "Green", bg: "#2d6a4f", light: "#e8f5e9" },
  { id: "blue", label: "أزرق", labelEn: "Blue", bg: "#0369a1", light: "#e0f2fe" },
  { id: "purple", label: "بنفسجي", labelEn: "Purple", bg: "#7c3aed", light: "#ede9fe" },
  { id: "gold", label: "ذهبي", labelEn: "Gold", bg: "#d97706", light: "#fef3c7" },
  { id: "rose", label: "وردي", labelEn: "Rose", bg: "#e11d48", light: "#ffe4e6" },
];

// ══════════════════════════════════════════════
// Draft auto-save (localStorage)
// ══════════════════════════════════════════════
const DRAFT_KEY = "createAssignmentDraft:v1";

export interface AdaptiveStage {
  id: string;
  name?: string;
  questionCount: number;
  passRuleType: "percent" | "correctCount";
  passThreshold: number;
  difficulties: number[];
  skills: string[];
  failureAction: "support" | "repeat" | "continue" | "finish";
  supportQuestionCount: number;
  maxRepeats: number;
  durationMinutes?: number;
}

type WizardDraft = {
  v: 1;
  wizardStep: 1 | 2 | 3;
  selectedTemplateId: string | null;
  colorTheme: string;
  title: string;
  subject: string;
  description: string;
  targetClasses: string[];
  submissionMode: SubmissionMode;
  accessMode: AccessMode;
  accessCode: string;
  showResults: boolean;
  deadline: string;
  paperTotalPoints: number;
  examMode: boolean;
  examDurationMinutes: number;
  resultsReleaseMode: "immediate" | "after_deadline" | "manual";
  allowRetry: boolean;
  modelImage: string | null;
  aiGradingInstructions: string;
  isShared: boolean;
  categoryId: number | null;
  isAdaptive: boolean;
  adaptiveMode?: "continuous" | "staged";
  adaptiveSkills: string[];
  adaptiveQuestionsPerSession: number;
  adaptiveShowImmediateFeedback?: boolean;
  adaptiveShowAnswersAfterResult?: boolean;
  adaptiveStages?: AdaptiveStage[];
  adaptiveShowStageNames?: boolean;
  questions: QuestionWithTts[];
  savedAt: number;
};

function draftHasMeaningfulContent(d: WizardDraft, paperAnswerLabel: string): boolean {
  if (d.title.trim()) return true;
  if (d.subject.trim()) return true;
  if (d.description.trim()) return true;
  if (d.targetClasses.length > 0) return true;
  if (d.aiGradingInstructions.trim()) return true;
  if (d.modelImage) return true;
  if (d.questions.some(q => (q.text || "").trim() && q.text !== paperAnswerLabel)) return true;
  if (d.questions.some(q => (q.optionA || q.optionB || q.optionC || q.optionD || "").toString().trim())) return true;
  return false;
}

function readDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    return parsed as WizardDraft;
  } catch {
    return null;
  }
}

function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════
// Sortable wrapper for question cards (drag-and-drop reordering)
// ══════════════════════════════════════════════

function SortableQuestionWrapper({
  id,
  children,
}: {
  id: string;
  children: (handleProps: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// ══════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════

/* ══ Post-publish success screen — extracted (unchanged JSX) so it can be
   unit-tested; rendered by CreateAssignment when publishedInfo is set. ══ */
export function PublishSuccessScreen({ publishedInfo, lang, setLocation }: {
  publishedInfo: { id: number | string | null; title: string; accessCode: string | null; accessMode: AccessMode };
  lang: string;
  setLocation: (path: string) => void;
}) {
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const [showShareDialog, setShowShareDialog] = useState(false);
  const shareUrl = `${window.location.origin}/solve/${publishedInfo.id}`;

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success(lang === "ar" ? "نُسخ رابط النشاط" : "Activity link copied");
  };

  return (
    <main className="max-w-2xl mx-auto px-4 pt-8 pb-16" data-testid="screen-publish-success">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="bg-white dark:bg-[#15201B] rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
          {lang === "ar" ? "تم نشر: " : "Published: "}
          <span className="text-emerald-700 dark:text-emerald-400">{publishedInfo.title}</span>
        </h2>

        {publishedInfo.accessCode && (
          <div className="rounded-3xl bg-emerald-50/70 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 p-4 space-y-3" data-testid="section-access-code">
            <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">{lang === "ar" ? "كود الدخول للطلاب" : "Student access code"}</p>
            <div className="flex justify-center gap-1.5" dir="ltr">
              {publishedInfo.accessCode.split("").map((ch, i) => (
                <div key={i} className="w-11 h-12 sm:w-12 sm:h-14 rounded-xl bg-white dark:bg-[#15201B] border-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-2xl font-black text-emerald-700 dark:text-emerald-300">{ch}</div>
              ))}
            </div>
            <button type="button" data-testid="btn-copy-code"
              onClick={() => { navigator.clipboard.writeText(publishedInfo.accessCode!); toast.success(lang === "ar" ? "نُسخ الرمز" : "Code copied"); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-all active:scale-[0.98]">
              <Copy className="w-4 h-4" />{lang === "ar" ? "نسخ الكود" : "Copy code"}
            </button>
          </div>
        )}

        <button type="button" data-testid="btn-share-link"
          onClick={() => setShowShareDialog(true)}
          className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-[0.98] ${publishedInfo.accessCode
            ? "border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
          <Share2 className="w-5 h-5 shrink-0" />
          {lang === "ar" ? "مشاركة النشاط" : "Share activity"}
        </button>

        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-center text-lg font-black text-foreground">
                {lang === "ar" ? "رابط النشاط" : "Activity link"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-center text-sm font-bold text-muted-foreground">
                {lang === "ar" ? "انسخ الرابط لمشاركته مع المشاركين" : "Copy the link to share it with participants"}
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  dir="ltr"
                  aria-label={lang === "ar" ? "رابط النشاط" : "Activity link"}
                  onFocus={event => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border-2 border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary"
                />
                <button type="button" data-testid="btn-copy-share-link" onClick={copyShareLink}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition-all hover:bg-emerald-700 active:scale-[0.98]">
                  <Copy className="h-4 w-4" />
                  {lang === "ar" ? "نسخ" : "Copy"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-center">
          <button type="button" data-testid="btn-open-activity" onClick={() => setLocation(`/teacher/assignment/${publishedInfo.id}`)}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-center">
            <ExternalLink className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "فتح النشاط" : "Open activity"}</span>
          </button>
          <button type="button" data-testid="btn-view-results" onClick={() => setLocation(`/teacher/assignment/${publishedInfo.id}?tab=results`)}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-center">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "عرض النتائج" : "View results"}</span>
          </button>
          <button type="button" data-testid="btn-live-game"
            onClick={() => setLocation(`/teacher?liveGamePicker=${publishedInfo.id}`)}
            title={lang === "ar" ? "لعبة مباشرة" : "Live game"}
            className="flex items-center justify-center gap-2.5 p-3.5 min-h-[44px] rounded-2xl text-white text-center transition-all active:scale-[0.98] hover:brightness-110 shadow-sm"
            style={{ background: "linear-gradient(180deg, #1E4D35 0%, #17382a 100%)" }}>
            <Gamepad2 className="w-5 h-5 shrink-0 opacity-95" />
            <span className="text-sm font-black">{lang === "ar" ? "لعبة مباشرة" : "Live game"}</span>
          </button>
          <button type="button" data-testid="btn-back-to-activities" onClick={() => setLocation("/teacher")}
            className="flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-center">
            <BackArrowIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "العودة إلى أنشطتي" : "Back to my activities"}</span>
          </button>
        </div>
      </motion.div>
    </main>
  );
}

export default function CreateAssignment() {
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  // Content-kind picker (task #595): the teacher chooses up-front whether
  // this is a homework activity (default) or a competition question pack.
  // Initialised from `?contest=1` so the existing "Create Contest" entry
  // still routes here, but kept as state so the form has an explicit
  // 2-option chooser independent of the URL.
  const [isContestMode, setIsContestMode] = useState(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("contest") === "1",
  );
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  // ── Wizard state ──
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [colorTheme, setColorTheme] = useState("green");

  // ── Basic info ──
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [classInput, setClassInput] = useState("");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("electronic");
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [accessCode, setAccessCode] = useState(generateAccessCode());
  const [showResults, setShowResults] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [paperTotalPoints, setPaperTotalPoints] = useState<number>(10);
  const [examMode, setExamMode] = useState(false);
  const [examDurationMinutes, setExamDurationMinutes] = useState<number>(30);
  const [resultsReleaseMode, setResultsReleaseMode] = useState<"immediate" | "after_deadline" | "manual">("immediate");
  const [allowRetry, setAllowRetry] = useState(false);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const modelImageRef = useRef<HTMLInputElement>(null);
  const [aiGradingInstructions, setAiGradingInstructions] = useState("");
  // Sharing now defaults to PUBLIC. Teachers can still flip the toggle to
  // keep an activity private — the new library auto-publishes everything
  // and admins moderate by hiding individual rows.
  const [isShared, setIsShared] = useState(true);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<{ id: number; name: string; groupName?: string | null }[]>([]);

  const emptyElectronicQuestion: QuestionWithTts = {
    text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", points: 1,
    difficulty: 2, skill: "",
    readAloud: false, allowMultipleAnswers: false, repeatQuestion: false, correctAnswers: ["A"],
  };

  const [questions, _setQuestionsRaw] = useState<QuestionWithTts[]>(() =>
    ensureClientIds([{ ...emptyElectronicQuestion }])
  );
  // Wrapped setter that auto-assigns stable _clientId to any question missing one.
  // Existing IDs are preserved so dnd-kit/React keys stay stable across reorder/edit.
  const setQuestions: React.Dispatch<React.SetStateAction<QuestionWithTts[]>> = (action) => {
    if (typeof action === "function") {
      _setQuestionsRaw(prev => ensureClientIds((action as (p: QuestionWithTts[]) => QuestionWithTts[])(prev)));
    } else {
      _setQuestionsRaw(ensureClientIds(action));
    }
  };

  // ── AI / image extract ──
  const [aiTopic, setAiTopic] = useState("");
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiCount, setAiCount] = useState(DEFAULT_AI_QUESTION_COUNT);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiWithImages, setAiWithImages] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [adaptiveGapLoading, setAdaptiveGapLoading] = useState("");
  const [aiError, setAiError] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showImageExtract, setShowImageExtract] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [extractFiles, setExtractFiles] = useState<File[]>([]);
  const [extractSourceMode, setExtractSourceMode] = useState<ExtractSourceMode>("file");
  const [extractSourceText, setExtractSourceText] = useState("");
  const [extractCounts, setExtractCounts] = useState<ExtractCounts>({ mcq: 10, true_false: 0, fill_blank: 0 });
  const [extractInstructions, setExtractInstructions] = useState("");
  const [extractLanguage, setExtractLanguage] = useState<"ar" | "en">(() => lang === "ar" ? "ar" : "en");
  const [extractSubject, setExtractSubject] = useState("");
  const [extractGradeLevel, setExtractGradeLevel] = useState("");
  const [extractRecommendation, setExtractRecommendation] = useState<{
    counts: ExtractCounts;
    difficulty: "easy" | "medium" | "hard";
    reason: string;
  } | null>(null);
  /* Credit cost/balance for the extract operation — comes from the server's
     central pricing (Pro discount applied once, server-side). */
  const [extractCredit, setExtractCredit] = useState<{
    effectiveCost: number; baseCost: number; isPro: boolean; balance: number; creditsEnabled: boolean;
  } | null>(null);
  /* Central balance source — same react-query cache as the header chip and
     the credits page. The server is the only source of truth; after any AI
     operation settles we invalidate this query instead of doing local math. */
  const refreshCreditsBalance = useRefreshCreditsBalance();
  /* Same-source duplicate guard: fingerprint of the last successful
     extraction in this editor session. */
  const lastExtractFpRef = useRef<string | null>(null);
  /* Content fingerprint of the CURRENT attempt, computed once in
     handleExtractFromSource (SHA-256 of file bytes, order-insensitive) and
     reused by runExtraction — including the replace/add dup-choice buttons. */
  const pendingExtractFpRef = useRef<string | null>(null);
  /* Synchronous attempt lock — extractLoading is async React state, so two
     rapid clicks can both pass its check while the SHA-256 hash is awaited.
     This ref is set before any await inside runExtraction. */
  const extractBusyRef = useRef(false);
  const [dupChoiceOpen, setDupChoiceOpen] = useState(false);
  const [extractDifficulty, setExtractDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const openImageExtractPanel = () => {
    setExtractCredit(null);
    setExtractError("");
    setShowImageExtract(true);
  };

  // ── Date picker ──
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Bank ──
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());
  const [bankFilterSubject, setBankFilterSubject] = useState("");

  // ── Admin / adaptive ──
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [adaptiveSkills, setAdaptiveSkills] = useState<string[]>([]);
  const [adaptiveSkillInput, setAdaptiveSkillInput] = useState("");
  const [adaptiveMode, setAdaptiveMode] = useState<"continuous" | "staged">("continuous");
  const [adaptiveStages, setAdaptiveStages] = useState<AdaptiveStage[]>([]);
  const [adaptiveShowStageNames, setAdaptiveShowStageNames] = useState(false);
  const [adaptiveQuestionsPerSession, setAdaptiveQuestionsPerSession] = useState(10);
  const [adaptiveShowImmediateFeedback, setAdaptiveShowImmediateFeedback] = useState(false);
  const [adaptiveShowAnswersAfterResult, setAdaptiveShowAnswersAfterResult] = useState(false);
  const [showAdaptiveSetup, setShowAdaptiveSetup] = useState(false);

  // ── Per-question UI ──
  const [mathToolbarFor, setMathToolbarFor] = useState<number>(-1);
  const [imagePickerFor, setImagePickerFor] = useState<number>(-1);
  const [mathOptionFor, setMathOptionFor] = useState<{ qIdx: number; opt: string } | null>(null);

  // ── Question-adding method (step 2 gate): null = show chooser ──
  const [questionMethod, setQuestionMethod] = useState<null | "manual" | "ai" | "file">(null);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  // ── Per-question tools disclosure («أدوات السؤال») keyed by _clientId ──
  const [toolsOpenFor, setToolsOpenFor] = useState<Set<string>>(new Set());
  // ── Step-3 student preview modal ──
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  // ── Post-publish success screen ──
  const [publishedInfo, setPublishedInfo] = useState<null | {
    id: number | string | null; title: string; accessCode: string | null; accessMode: AccessMode;
  }>(null);

  // ── Draft auto-save ──
  const [draftReady, setDraftReady] = useState(false);
  const [draftSnapshot, setDraftSnapshot] = useState<WizardDraft | null>(null);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  const isPaper = submissionMode === "paper";
  const isMathSubject = subject.toLowerCase().includes("رياض") || subject.toLowerCase().includes("math");
  const totalPoints = isPaper ? paperTotalPoints : questions.reduce((sum, q) => sum + (q.points || 1), 0);

  // ── Apply template ──
  const applyTemplate = (template: AssignmentTemplate) => {
    const { defaults } = template;
    setSelectedTemplateId(template.id);
    setSubmissionMode(defaults.submissionMode);
    if (defaults.examMode) { setExamMode(true); setExamDurationMinutes(defaults.examDurationMinutes); }
    if (defaults.submissionMode === "paper") {
      const total = defaults.pointsPerQuestion * defaults.questionCount;
      setPaperTotalPoints(total);
      setQuestions([{ text: t.createAssignment.paperAnswer, points: total }]);
    } else {
      const newQs: QuestionWithTts[] = Array.from({ length: defaults.questionCount }, (_, i) => {
        const qType = defaults.questionTypes?.[i] ?? defaults.questionType;
        const defaultCorrect = qType === "true_false" ? "true" : "A";
        return {
          text: "", optionA: "", optionB: "", optionC: "", optionD: "",
          correctAnswer: defaultCorrect,
          points: defaults.pointsPerQuestion, questionType: qType,
          readAloud: false, allowMultipleAnswers: false, repeatQuestion: false,
          correctAnswers: [defaultCorrect],
        };
      });
      setQuestions(newQs);
    }
    if (defaults.hasDeadline) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setDeadline(nextWeek.toISOString().slice(0, 16));
    }
    if (template.id !== "scratch") {
      toast.success(lang === "ar"
        ? "طُبّق القالب. يمكنك توليد الأسئلة أو إضافتها بنفسك."
        : "Template applied. Generate questions with AI or add them yourself.");
    }
    setQuestionMethod("manual");
    setWizardStep(2);
  };

  // ── AI generate ──
  const handleAiGenerate = async () => {
    if (!aiTopic.trim() && !aiSourceText.trim()) return;
    setAiLoading(true); setAiError("");
    try {
      const endpoint = !isAdaptive && aiWithImages && !aiSourceText.trim() ? "/api/ai/generate-questions-with-images" : "/api/ai/generate-questions";
      /* Respect the template structure: send the prepared slots' question types
         so AI generates the same mix (e.g. true/false template → true/false questions). */
      const slotTypes = questions.map(q =>
        q.questionType === "true_false" || q.questionType === "fill_blank" ? q.questionType : "mcq");
      const hasNonMcq = slotTypes.some(t => t !== "mcq");
      /* With a typed template, generate exactly the prepared slot count so the
         template structure (count + type order) is preserved 1:1. */
      const adaptiveCountOptions = [12, 18, 24, 30];
      const adaptiveCount = adaptiveCountOptions.includes(aiCount) ? aiCount : 24;
      const requestCount = isAdaptive ? adaptiveCount : (hasNonMcq ? slotTypes.length : aiCount);
      const res = await creditAwareFetch(`${API_BASE}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          topic: aiTopic,
          sourceText: aiSourceText.trim() || undefined,
          count: !isAdaptive && aiWithImages ? Math.min(requestCount, 20) : requestCount,
          difficulty: aiDifficulty,
          subject: subject || undefined,
          language: lang,
          adaptive: isAdaptive,
          adaptiveSkills: isAdaptive && adaptiveSkills.length === requestCount / 6 ? adaptiveSkills : undefined,
          questionTypes: hasNonMcq ? slotTypes.slice(0, aiWithImages ? 20 : slotTypes.length) : undefined,
        }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(t.createAssignment.connectionError); }
      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(data.message || t.createAssignment.generateError);
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error(t.createAssignment.noQuestionsGenerated);
      const generated = (data.questions as CreateQuestionBody[]).map(q => ({
        ...q,
        /* Object-storage paths (/objects/...) are only reachable via the API server at /api/objects/... */
        imageUrl: q.imageUrl ?? null, /* keep raw /objects/... path; resolveImageUrl() handles display */
      }));
      if (isAdaptive) {
        const generatedSkills = Array.isArray(data.suggestedSkills)
          ? data.suggestedSkills.filter((skill: unknown): skill is string => typeof skill === "string" && !!skill.trim())
          : [];
        if (generatedSkills.length > 0) setAdaptiveSkills(generatedSkills);
        if (adaptiveMode === "staged" && adaptiveStages.length === 0) {
          const questionsPerStage = requestCount / 3;
          setAdaptiveStages([
            {
              id: crypto.randomUUID(), name: lang === "ar" ? "الأساسيات" : "Foundations",
              questionCount: questionsPerStage, passRuleType: "percent", passThreshold: 70,
              difficulties: [1], skills: [], failureAction: "continue",
              supportQuestionCount: 0, maxRepeats: 0,
            },
            {
              id: crypto.randomUUID(), name: lang === "ar" ? "التطبيق" : "Application",
              questionCount: questionsPerStage, passRuleType: "percent", passThreshold: 70,
              difficulties: [2], skills: [], failureAction: "continue",
              supportQuestionCount: 0, maxRepeats: 0,
            },
            {
              id: crypto.randomUUID(), name: lang === "ar" ? "التحدي" : "Challenge",
              questionCount: questionsPerStage, passRuleType: "percent", passThreshold: 70,
              difficulties: [3], skills: [], failureAction: "continue",
              supportQuestionCount: 0, maxRepeats: 0,
            },
          ]);
        }
      }
      const hasRealQuestions = questions.length > 0 && questions.some(q => q.text && q.text !== t.createAssignment.paperAnswer);
      setQuestions(hasRealQuestions ? [...questions, ...generated] : generated);
       setShowAiPanel(false); setAiTopic(""); setAiSourceText("");
      toast.success(lang === "ar"
        ? `تم توليد ${generated.length} سؤال${isAdaptive ? " وتصنيفها تكيفياً" : ""} بنجاح`
        : `${generated.length} questions generated${isAdaptive ? " and adaptively classified" : ""} successfully`);
      const failedImages = Number(data.failedImages) || 0;
      if (failedImages > 0) {
        toast.warning(lang === "ar"
          ? `تعذّر توليد صور لـ ${failedImages} من الأسئلة — يمكنك إضافة صورة يدوياً من محرر السؤال`
          : `Images failed for ${failedImages} question(s) — you can add an image manually in the question editor`);
      }
    } catch (err: any) { setAiError(err.message || t.common.error); } finally {
      setAiLoading(false);
      /* AI generation charges credits server-side — refresh the shared balance. */
      refreshCreditsBalance();
    }
  };

  const handleGenerateAdaptiveGap = async (skill: string, difficulty: 1 | 2 | 3, count: number) => {
    if (count <= 0 || adaptiveGapLoading) return;
    const loadingKey = `${skill}:${difficulty}`;
    setAdaptiveGapLoading(loadingKey);
    try {
      const topic = [title.trim(), subject.trim()].filter(Boolean).join(" — ");
      if (!topic) {
        toast.error(lang === "ar" ? "أدخل عنوان النشاط أو المادة أولاً" : "Enter the activity title or subject first");
        return;
      }
      const difficultyName = difficulty === 1 ? "easy" : difficulty === 2 ? "medium" : "hard";
      const res = await creditAwareFetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic,
          sourceText: aiSourceText.trim() || undefined,
          subject: subject || undefined,
          count,
          language: lang,
          adaptive: true,
          adaptiveTargetSkill: skill,
          adaptiveTargetDifficulty: difficultyName,
        }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(t.createAssignment.connectionError); }
      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(data.message || t.createAssignment.generateError);
      }
      if (!Array.isArray(data.questions) || data.questions.length !== count) {
        throw new Error(lang === "ar" ? "لم يكتمل توليد الجزء الناقص" : "The missing batch was incomplete");
      }
      setQuestions(current => ensureClientIds([...current, ...data.questions]));
      toast.success(lang === "ar"
        ? `تمت إضافة ${count} سؤال لمهارة ${skill}`
        : `Added ${count} question${count === 1 ? "" : "s"} for ${skill}`);
    } catch (err: any) {
      toast.error(err.message || t.common.error);
    } finally {
      setAdaptiveGapLoading("");
      refreshCreditsBalance();
    }
  };

  // ── Source extract (images / PDF / DOCX / PPTX / TXT / MD) ──
  /* Mirror the server's tier limits (file-upload.ts): 5 files for
     teachers, 25 for admins. The server re-validates regardless. */
  const EXTRACT_MAX_FILES = isAdmin ? 25 : 5;

  const handleSourceFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const err = extractFileError(file.name, lang === "ar" ? "ar" : "en");
      if (err) { setExtractError(err); continue; }
      accepted.push(file);
    }
    if (accepted.length > 0) setExtractError("");
    /* File set changed → the pending fingerprint (and any open dup-choice
       dialog) no longer describes the selection. */
    pendingExtractFpRef.current = null;
    setDupChoiceOpen(false);
    setExtractFiles(prev => [...prev, ...accepted].slice(0, EXTRACT_MAX_FILES));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  /* Load the server-side price + balance whenever the extract panel opens.
     The number shown in the UI is always the server's effectiveCost — no
     client-side Pro math. */
  useEffect(() => {
    if (!showImageExtract) return;
    let cancelled = false;
    setExtractCredit(null);
    fetch(`${API_BASE}/api/credits/tool-price/extract_questions_from_source`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (
          !cancelled
          && d
          && typeof d.effectiveCost === "number"
          && typeof d.baseCost === "number"
          && typeof d.isPro === "boolean"
          && typeof d.balance === "number"
          && typeof d.creditsEnabled === "boolean"
        ) {
          setExtractCredit(d);
        }
      })
      .catch(() => {
        if (!cancelled) setExtractCredit(null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImageExtract]);

  /** Runs the actual extraction API call. `replacePrevious` removes the
      questions produced by the previous extraction of the same source. */
  const runExtraction = async (replacePrevious: boolean) => {
    const hasSource = extractSourceMode === "file" ? extractFiles.length > 0 : extractSourceText.trim().length >= 5;
    if (!hasSource || !extractCredit || extractLoading || extractBusyRef.current) return;
    extractBusyRef.current = true;
    setDupChoiceOpen(false);
    setExtractLoading(true); setExtractError("");
    /* One idempotency key per attempt: concurrent clicks / browser retries
       of this attempt share the key, so the server holds credits once. */
    const requestId = crypto.randomUUID();
    const fingerprint = pendingExtractFpRef.current ?? await fingerprintCurrentExtractSource();
    try {
      const form = new FormData();
      if (extractSourceMode === "file") {
        for (const f of extractFiles) form.append("files", f);
      } else {
        form.append("sourceText", extractSourceText.trim());
      }
      form.append("language", extractLanguage);
      form.append("difficulty", extractDifficulty);
      form.append("pages", "1");
      if (extractSubject.trim() || subject.trim()) form.append("subject", extractSubject.trim() || subject.trim());
      if (extractGradeLevel.trim()) form.append("gradeLevel", extractGradeLevel.trim());
      if (extractInstructions.trim()) form.append("topicHint", extractInstructions.trim());
      /* Activity editor supports mcq / true_false / fill_blank. */
      form.append("counts", JSON.stringify({
        ...extractCounts,
        short_answer: 0,
        matching: 0,
      }));
      const res = await creditAwareFetch(`${API_BASE}/api/worksheets/ai/extract`, {
        method: "POST", credentials: "include", body: form,
        headers: { "X-Idempotency-Key": requestId },
      });
      let data: Record<string, unknown>;
      try { data = await res.json(); } catch { throw new Error(t.createAssignment.connectionError); }
      if (isInsufficientCreditsResponse(res)) return;
      if (res.status === 409) {
        /* Terminal replay of this attempt's key — server refused to re-run.
           Each click already gets a fresh UUID, so just surface the message. */
        throw new Error((data.message as string) || (lang === "ar" ? "سبق تنفيذ هذا الطلب — أعد المحاولة." : "Duplicate request — please retry."));
      }
      if (!res.ok) throw new Error((data.message as string) || t.createAssignment.generateError);
      if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error(t.createAssignment.noQuestionsGenerated);
      const generated = mapExtractedToActivity(data.questions).map(q => ({ ...q, _extractKey: fingerprint }));
      if (generated.length === 0) throw new Error(t.createAssignment.noQuestionsGenerated);
      setQuestions(prev => {
        /* Replace-mode drops only questions from the previous extraction of
           this same source; manual and other-source questions are kept. */
        const kept = replacePrevious ? prev.filter(q => q._extractKey !== fingerprint) : prev;
        const hasReal = kept.length > 0 && kept.some(q => q.text && q.text !== t.createAssignment.paperAnswer);
        return hasReal ? [...kept, ...generated] : generated;
      });
      lastExtractFpRef.current = fingerprint;
      setShowImageExtract(false); setExtractFiles([]); setExtractSourceText("");
      toast.success(lang === "ar" ? `تم استخراج ${generated.length} سؤال من المصدر بنجاح` : `${generated.length} questions extracted from the source`);
      const requestedTotal = extractCounts.mcq + extractCounts.true_false + extractCounts.fill_blank;
      if (generated.length < requestedTotal) {
        toast.warning(lang === "ar"
          ? `تم العثور على ${generated.length} من أصل ${requestedTotal} سؤالًا مطلوبًا. قد لا يحتوي المصدر على مادة كافية.`
          : `Found ${generated.length} of ${requestedTotal} requested questions. The source may not contain enough material.`);
      }
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : t.common.error);
    } finally {
      extractBusyRef.current = false; setExtractLoading(false);
      /* Server is the source of truth: refetch the shared balance after the
         attempt settles (success = capture, failure = refund — both change
         or restore the balance). No client-side deduction math. */
      refreshCreditsBalance();
    }
  };

  const recommendExtractionSettings = () => {
    const sourceSize = extractSourceMode === "text"
      ? extractSourceText.trim().length
      : extractFiles.reduce((sum, file) => sum + file.size, 0);
    const total = sourceSize > 30_000 ? 18 : sourceSize > 8_000 ? 12 : 8;
    const mcq = Math.max(4, Math.round(total * 0.6));
    const trueFalse = Math.max(2, Math.round(total * 0.2));
    const counts = {
      mcq,
      true_false: trueFalse,
      fill_blank: Math.max(1, total - mcq - trueFalse),
    };
    setExtractRecommendation({
      counts,
      difficulty: "medium",
      reason: lang === "ar"
        ? `المصدر ${sourceSize > 30_000 ? "كبير" : sourceSize > 8_000 ? "متوسط" : "مختصر"}؛ يُفضّل تنويع الأسئلة مع تركيز أكبر على الاختيار المتعدد.`
        : `The source is ${sourceSize > 30_000 ? "large" : sourceSize > 8_000 ? "medium-sized" : "brief"}; a mixed set weighted toward multiple choice is recommended.`,
    });
  };

  const handleExtractFromSource = async () => {
    const hasSource = extractSourceMode === "file" ? extractFiles.length > 0 : extractSourceText.trim().length >= 5;
    if (!hasSource || extractLoading || extractBusyRef.current) return;
    setExtractError("");
    /* Same source extracted again while its questions are still in the
       editor → explicit replace / add / cancel choice, no silent charge. */
    const fingerprint = await fingerprintCurrentExtractSource();
    if (extractBusyRef.current) return; // another attempt started while hashing
    pendingExtractFpRef.current = fingerprint;
    const priorStillPresent = questions.some(q => q._extractKey === fingerprint);
    if (lastExtractFpRef.current === fingerprint && priorStillPresent) {
      setDupChoiceOpen(true);
      return;
    }
    void runExtraction(false);
  };

  const fingerprintCurrentExtractSource = async () => {
    if (extractSourceMode === "file") return fingerprintFilesContent(extractFiles);
    const bytes = new TextEncoder().encode(extractSourceText.trim());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return `text:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")}`;
  };

  const handleModeChange = (mode: SubmissionMode) => {
    setSubmissionMode(mode);
    if (mode === "electronic") setModelImage(null);
    if (mode === "paper") {
      setQuestions([{ text: t.createAssignment.paperAnswer, points: paperTotalPoints }]);
    } else if (mode === "electronic" || mode === "both") {
      setQuestions(questions.map(q => ({
        text: q.text === t.createAssignment.paperAnswer ? "" : q.text,
        optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
        correctAnswer: q.correctAnswer || "A", points: q.points || 1,
      })));
    }
  };

  const createMutation = useCreateAssignment({
    mutation: {
      onSuccess: (data: any) => {
        addMultipleSuggestions({ subjects: subject, classes: targetClasses.join(",") });
        questions.forEach(q => { if (q.text?.trim()) addSuggestion("questions", q.text.trim()); });
        clearDraft();
        // Success screen (instead of toast + redirect) — shows access code, share link, next actions
        setPublishedInfo({
          id: data?.id ?? null,
          title: data?.title || title,
          accessCode: data?.accessCode || null,
          accessMode: (data?.accessMode as AccessMode) || accessMode,
        });
        try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
      },
      onError: (err: any) => {
        toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء حفظ النشاط" : "Error saving activity"));
      },
    }
  });

  const handleAddQuestion = () => setQuestions([...questions, { ...emptyElectronicQuestion }]);

  // Duplicate a question (deep-ish copy, new client id assigned by setQuestions wrapper)
  const handleDuplicateQuestion = (index: number) => {
    setQuestions(prev => {
      const copy = { ...prev[index], _clientId: undefined } as QuestionWithTts;
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const toggleQuestionTools = (clientId: string | undefined) => {
    if (!clientId) return;
    setToolsOpenFor(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  };

  useEffect(() => {
    let consumedSeedOrDraft = false;
    try {
      const raw = sessionStorage.getItem("librarySeedQuestions");
      if (raw) {
        sessionStorage.removeItem("librarySeedQuestions");
        const parsed = JSON.parse(raw);
        const seed = Array.isArray(parsed?.questions) ? parsed.questions : [];
        if (seed.length > 0) {
          const seeded: QuestionWithTts[] = seed.map((q: any) => {
            const qt: "mcq" | "true_false" | "fill_blank" = q.questionType === "true_false" || q.questionType === "fill_blank" ? q.questionType : "mcq";
            let correctAnswer: string;
            if (qt === "true_false") correctAnswer = q.correctAnswer === "false" ? "false" : "true";
            else if (qt === "fill_blank") correctAnswer = typeof q.correctAnswer === "string" ? q.correctAnswer : "";
            else correctAnswer = ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A";
            return {
              text: String(q.text || ""), optionA: String(q.optionA || ""), optionB: String(q.optionB || ""),
              optionC: String(q.optionC || ""), optionD: String(q.optionD || ""), correctAnswer,
              points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
              questionType: qt, readAloud: false, allowMultipleAnswers: false, repeatQuestion: false, correctAnswers: [correctAnswer],
            };
          });
          // Library seed takes precedence over any saved draft
          clearDraft();
          setQuestions(seeded);
          setQuestionMethod("manual");
          setWizardStep(2);
          if (parsed?.subject && typeof parsed.subject === "string") setSubject(parsed.subject);
          if (parsed?.sourceFileName && typeof parsed.sourceFileName === "string") {
            const baseName = String(parsed.sourceFileName).replace(/\.[^.]+$/, "");
            setTitle(lang === "ar" ? `أسئلة من: ${baseName}` : `Questions from: ${baseName}`);
          }
          toast.success(lang === "ar" ? `تم تحميل ${seeded.length} سؤال من المكتبة` : `Loaded ${seeded.length} questions from library`);
          consumedSeedOrDraft = true;
          setDraftReady(true);
        }
      }
    } catch { /* ignore */ }

    // If no library seed, look for an auto-saved draft
    if (!consumedSeedOrDraft) {
      const draft = readDraft();
      if (draft && draftHasMeaningfulContent(draft, t.createAssignment.paperAnswer)) {
        setDraftSnapshot(draft);
        setDraftPromptOpen(true);
        // draftReady stays false until user picks Continue or Start fresh
      } else {
        if (draft) clearDraft();
        setDraftReady(true);
      }
    }

    fetch(`${API_BASE}/api/categories`, { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setAvailableCategories).catch(() => {});
    fetch(`${API_BASE}/api/teacher/classes`, { credentials: "include" }).then(r => r.ok ? r.json() : []).then((rows: { id: number; name: string; groupName?: string | null }[]) => setTeacherClasses(Array.isArray(rows) ? rows : [])).catch(() => {});
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" }).then(r => r.ok ? r.json() : null).then(data => { if (data?.isAdmin) setIsAdmin(true); }).catch(() => {});
  }, []);

  // ── Apply a saved draft snapshot back into wizard state ──
  const applyDraft = (d: WizardDraft) => {
    setWizardStep((Math.min(d.wizardStep ?? 1, 3) as 1 | 2 | 3));
    setSelectedTemplateId(d.selectedTemplateId);
    setColorTheme(d.colorTheme);
    setTitle(d.title);
    setSubject(d.subject);
    setDescription(d.description);
    setTargetClasses(d.targetClasses);
    setSubmissionMode(d.submissionMode);
    setAccessMode(d.accessMode);
    setAccessCode(/^\d{6}$/.test(d.accessCode || "") ? d.accessCode : generateAccessCode());
    setShowResults(d.showResults);
    setDeadline(d.deadline);
    setPaperTotalPoints(d.paperTotalPoints);
    setExamMode(d.examMode);
    setExamDurationMinutes(d.examDurationMinutes);
    setResultsReleaseMode(d.resultsReleaseMode);
    setAllowRetry(d.allowRetry);
    setModelImage(d.modelImage);
    setAiGradingInstructions(d.aiGradingInstructions);
    setIsShared(d.isShared);
    setCategoryId(d.categoryId);
    setIsAdaptive(d.isAdaptive);
    setAdaptiveMode(d.adaptiveMode || "continuous");
    setAdaptiveStages(d.adaptiveStages || []);
    setAdaptiveShowStageNames(d.adaptiveShowStageNames || false);
    setAdaptiveSkills(d.adaptiveSkills);
    setAdaptiveQuestionsPerSession(d.adaptiveQuestionsPerSession);
    setAdaptiveShowImmediateFeedback(d.adaptiveShowImmediateFeedback ?? false);
    setAdaptiveShowAnswersAfterResult(d.adaptiveShowAnswersAfterResult ?? false);
    if (Array.isArray(d.questions) && d.questions.length > 0) setQuestions(d.questions);
    // A resumed draft goes straight to the editor — no method chooser again
    setQuestionMethod("manual");
  };

  const handleContinueDraft = () => {
    if (draftSnapshot) applyDraft(draftSnapshot);
    setDraftPromptOpen(false);
    setDraftReady(true);
  };

  const handleStartFresh = () => {
    clearDraft();
    setDraftSnapshot(null);
    setDraftPromptOpen(false);
    setDraftReady(true);
  };

  // ── Auto-save draft on every change (after the user has resolved any existing draft) ──
  useEffect(() => {
    if (!draftReady) return;
    const draft: WizardDraft = {
      v: 1,
      wizardStep,
      selectedTemplateId,
      colorTheme,
      title,
      subject,
      description,
      targetClasses,
      submissionMode,
      accessMode,
      accessCode,
      showResults,
      deadline,
      paperTotalPoints,
      examMode,
      examDurationMinutes,
      resultsReleaseMode,
      allowRetry,
      modelImage,
      aiGradingInstructions,
      isShared,
      categoryId,
      isAdaptive,
      adaptiveMode,
      adaptiveStages,
      adaptiveShowStageNames,
      adaptiveSkills,
      adaptiveQuestionsPerSession,
      adaptiveShowImmediateFeedback,
      adaptiveShowAnswersAfterResult,
      questions,
      savedAt: Date.now(),
    };
    if (!draftHasMeaningfulContent(draft, t.createAssignment.paperAnswer)) {
      clearDraft();
      return;
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Quota exceeded or storage unavailable — silently ignore so the wizard keeps working
    }
  }, [
    draftReady,
    wizardStep, selectedTemplateId, colorTheme, title, subject, description,
    targetClasses, submissionMode, accessMode, accessCode, showResults, deadline,
    paperTotalPoints, examMode, examDurationMinutes, resultsReleaseMode, allowRetry,
    modelImage, aiGradingInstructions, isShared, categoryId, isAdaptive,
    adaptiveMode, adaptiveStages, adaptiveShowStageNames,
    adaptiveSkills, adaptiveQuestionsPerSession, adaptiveShowImmediateFeedback,
    adaptiveShowAnswersAfterResult, questions,
    t.createAssignment.paperAnswer,
  ]);

  const openBankModal = async () => {
    setShowBankModal(true); setBankLoading(true); setBankSelected(new Set());
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.ok) setBankQuestions(await res.json());
    } catch (e) { console.error(e); } finally { setBankLoading(false); }
  };

  const toggleBankQuestion = (id: number) => {
    const next = new Set(bankSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBankSelected(next);
  };

  const importBankQuestions = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    const imported: QuestionWithTts[] = selected.map(q => {
      const isMulti = !!q.allowMultipleAnswers;
      const rawCorrect: string = q.correctAnswer || "A";
      const correctAnswers: string[] = isMulti ? rawCorrect.split(",").map((s: string) => s.trim()).filter(Boolean) : [rawCorrect];
      return { text: q.text, optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "", correctAnswer: rawCorrect, correctAnswers, points: q.points || 1, imageUrl: q.imageUrl || null, readAloud: false, allowMultipleAnswers: isMulti, repeatQuestion: !!q.repeatQuestion };
    });
    if (questions.length === 1 && !questions[0].text) setQuestions(imported);
    else setQuestions([...questions, ...imported]);
    setShowBankModal(false);
    toast.success(t.questionBank.importSuccess.replace("{count}", String(imported.length)));
  };

  const handleRemoveQuestion = (index: number) => { if (questions.length > 1) setQuestions(questions.filter((_, i) => i !== index)); };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const newQs = [...questions];
    [newQs[index], newQs[newIndex]] = [newQs[newIndex], newQs[index]];
    setQuestions(newQs);
  };

  // ── Drag-and-drop reordering (dnd-kit) ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions(prev => {
      const fromIdx = prev.findIndex(q => q._clientId === active.id);
      const toIdx = prev.findIndex(q => q._clientId === over.id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      return arrayMove(prev, fromIdx, toIdx);
    });
    // Reset transient per-question UI state tied to indices
    setMathToolbarFor(-1);
    setImagePickerFor(-1);
    setMathOptionFor(null);
  };

  const handleQuestionChange = (index: number, field: keyof QuestionWithTts, value: string | number | boolean | null) => {
    setQuestions(prev => { const newQs = [...prev]; newQs[index] = { ...newQs[index], [field]: value }; return newQs; });
  };

  const handleQuestionTypeChange = (index: number, newType: "mcq" | "true_false" | "fill_blank" | "whiteboard" | "whiteboard_blank" | "dictation") => {
    setQuestions(prev => {
      const newQs = [...prev];
      const updates: Partial<CreateQuestionBody> = { questionType: newType === "whiteboard_blank" ? "whiteboard" : newType, optionA: '', optionB: '', optionC: '', optionD: '' };
      if (newType === "true_false") updates.correctAnswer = 'true';
      else if (newType === "fill_blank") updates.correctAnswer = '';
      else if (newType === "whiteboard") { updates.correctAnswer = ''; updates.optionA = 'lined'; }
      else if (newType === "whiteboard_blank") { updates.correctAnswer = ''; updates.optionA = 'blank'; }
      else if (newType === "dictation") { updates.correctAnswer = ''; updates.optionA = ''; updates.optionB = '3'; updates.optionC = 'true'; }
      else updates.correctAnswer = 'A';
      newQs[index] = { ...newQs[index], ...updates } as CreateQuestionBody;
      return newQs;
    });
  };

  const handleModelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const base64 = await fileToBase64(file); setModelImage(base64); }
  };

  const handlePublish = () => {
    if (!title.trim()) { toast.error(lang === "ar" ? "أضف عنواناً للنشاط قبل النشر" : "Activity title is required"); setWizardStep(1); return; }
    if (!isPaper) {
      const emptyQ = questions.findIndex(q => !q.text?.trim());
      if (emptyQ !== -1) {
        toast.error(lang === "ar" ? `السؤال ${emptyQ + 1} فارغ — يرجى إدخال نص السؤال` : `Question ${emptyQ + 1} is empty — please enter question text`);
        setWizardStep(2); return;
      }
    }
    if (isAdaptive && !adaptiveReadiness.isReady) {
      toast.error(lang === "ar" ? "أكمل جاهزية بنك الأسئلة التكيفي قبل النشر" : "Complete the adaptive question-bank readiness checks before publishing");
      setWizardStep(2);
      setShowAdaptiveSetup(true);
      return;
    }
    if (accessMode === "private" && !/^\d{6}$/.test(accessCode)) {
      toast.error(lang === "ar" ? "كود الدخول يجب أن يكون 6 أرقام" : "Access code must be exactly 6 digits");
      setShowAdvancedSettings(true); setWizardStep(3); return;
    }
    // Build description prefix: [theme:X][retry] — chain prefixes then user text
    let descPrefix = "";
    if (colorTheme !== "green") descPrefix += `[theme:${colorTheme}]`;
    if (allowRetry) descPrefix += `[retry]`;
    const themeDesc = descPrefix + description;
    createMutation.mutate({
      data: {
        title, subject: subject.trim() || undefined, description: themeDesc, submissionMode, accessMode,
        accessCode: accessMode === "private" ? accessCode : undefined,
        targetClass: targetClasses[0] || undefined,
        targetClasses: targetClasses.length > 0 ? targetClasses : undefined,
        showResults,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        modelImageBase64: modelImage || undefined,
        examMode: examMode || undefined,
        examDurationMinutes: examMode ? examDurationMinutes : undefined,
        resultsReleaseMode: resultsReleaseMode !== "immediate" ? resultsReleaseMode : undefined,
        aiGradingInstructions: aiGradingInstructions.trim() || undefined,
        isShared, categoryId: categoryId || undefined,
        // contentKind drives which public library the activity appears in:
        // contest mode → "مكتبة المسابقات الجاهزة", otherwise "مكتبة الأنشطة".
        contentKind: isContestMode ? "competition" : "homework",
        isAdaptive: isAdaptive || undefined,
        adaptiveConfig: (isAdaptive ? {
          mode: adaptiveMode,
          stages: adaptiveStages.map(s => ({
            ...s,
            passRule: { type: s.passRuleType, threshold: s.passThreshold }
          })),
          showStageNames: adaptiveShowStageNames,
          questionsPerSession: adaptiveQuestionsPerSession,
          skills: adaptiveSkills,
          allowRetry,
          showImmediateFeedback: adaptiveShowImmediateFeedback,
          showAnswersAfterResult: adaptiveShowAnswersAfterResult,
        } : undefined) as any,
        questions: isPaper
          ? [{ text: t.createAssignment.paperAnswer, points: paperTotalPoints }]
          : questions.map(({ allowMultipleAnswers: _a, repeatQuestion: _r, correctAnswers: _ca, _clientId: _cid, _extractKey: _ek, ...apiQ }) => ({
              ...apiQ,
              difficulty: isAdaptive ? (apiQ.difficulty ?? 2) : undefined,
              skill: isAdaptive ? (apiQ.skill ?? "") : undefined,
            })),
      }
    });
  };

  const difficultyOptions = [
    { value: "easy" as const, label: t.createAssignment.aiEasy, color: "green" },
    { value: "medium" as const, label: t.createAssignment.aiMedium, color: "yellow" },
    { value: "hard" as const, label: t.createAssignment.aiHard, color: "red" },
  ];
  const extractRequestedTotal = extractCounts.mcq + extractCounts.true_false + extractCounts.fill_blank;

  const adaptiveReadiness = (() => {
    const skills = adaptiveSkills.map(skill => ({
      skill,
      easy: 0,
      medium: 0,
      hard: 0,
    }));
    const bySkill = new Map(skills.map(row => [row.skill, row]));
    const noSkill: number[] = [];
    const undeclaredSkill: number[] = [];
    const unsupportedType: number[] = [];
    questions.forEach((question, index) => {
      // Only count valid non-empty questions
      if (!question.text?.trim()) return;
      const type = question.questionType || "mcq";
      if (!isAdaptiveSupportedQuestionType(type)) unsupportedType.push(index + 1);
      const skill = question.skill?.trim() || "";
      if (!skill) { noSkill.push(index + 1); return; }
      const row = bySkill.get(skill);
      if (!row) { undeclaredSkill.push(index + 1); return; }
      if (question.difficulty === 1) row.easy += 1;
      else if (question.difficulty === 3) row.hard += 1;
      else row.medium += 1;
    });
    const incompleteSkills = skills.filter(row => row.easy < 2 || row.medium < 2 || row.hard < 2);

    const stagedErrors: string[] = [];
    if (adaptiveMode === "staged") {
      if (adaptiveStages.length === 0) stagedErrors.push(lang === "ar" ? "أضف مرحلة واحدة على الأقل" : "Add at least one stage");
      adaptiveStages.forEach((stage, i) => {
        let requiredCount = stage.questionCount;
        if (stage.failureAction === "repeat") {
          requiredCount = stage.questionCount * (stage.maxRepeats + 1);
        } else if (stage.failureAction === "support") {
          requiredCount = stage.questionCount + stage.supportQuestionCount;
        }

        if (stage.passRuleType === "percent" && (stage.passThreshold < 0 || stage.passThreshold > 100)) {
          stagedErrors.push(lang === "ar" ? `المرحلة ${i + 1} تتطلب نسبة نجاح بين 0 و 100` : `Stage ${i + 1} requires a pass percentage between 0 and 100`);
        }
        if (stage.passRuleType === "correctCount" && (stage.passThreshold < 0 || stage.passThreshold > stage.questionCount)) {
          stagedErrors.push(lang === "ar" ? `المرحلة ${i + 1} تتطلب شرط اجتياز لا يتجاوز عدد الأسئلة (${stage.questionCount})` : `Stage ${i + 1} requires a pass threshold no greater than its question count (${stage.questionCount})`);
        }

        const matchCount = questions.filter(q => {
          if (!q.text?.trim() || !isAdaptiveSupportedQuestionType(q.questionType || "mcq")) return false;
          const s = (q.skill || "").trim();
          const d = q.difficulty || 2;
          const matchesSkill = stage.skills.length === 0 || stage.skills.includes(s);
          const matchesDiff = stage.difficulties.length === 0 || stage.difficulties.includes(d);
          return matchesSkill && matchesDiff;
        }).length;
        if (matchCount < requiredCount) {
          stagedErrors.push(lang === "ar" ? `المرحلة ${i + 1} تتطلب ${requiredCount} سؤالاً فريداً كحد أقصى، لكن يوجد ${matchCount} فقط يتطابق مع شروطها` : `Stage ${i + 1} requires a worst-case of ${requiredCount} unique questions, but only ${matchCount} match its criteria`);
        }
      });
    }

    const isReadyContinuous = skills.length > 0 && incompleteSkills.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0 && unsupportedType.length === 0;
    const isReadyStaged = stagedErrors.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0 && unsupportedType.length === 0;

    return {
      skills,
      noSkill,
      undeclaredSkill,
      unsupportedType,
      incompleteSkills,
      stagedErrors,
      isReady: adaptiveMode === "staged" ? isReadyStaged : isReadyContinuous,
    };
  })();
  const canLeaveStep2 = hasAtLeastOneQuestion(questions, isPaper) && (!isAdaptive || adaptiveReadiness.isReady);
  const publishBlock = getPublishBlockReason(title, questions, isPaper);
  const blockMessages = lang === "ar" ? PUBLISH_BLOCK_MESSAGES_AR : PUBLISH_BLOCK_MESSAGES_EN;

  const goNext = () => {
    if (wizardStep === 1 && !title.trim()) { toast.error(lang === "ar" ? "أدخل عنوان النشاط أولاً" : "Please enter an activity title"); return; }
    if (wizardStep === 2 && !canLeaveStep2) {
      toast.error(isAdaptive
        ? (lang === "ar" ? "أكمل جاهزية بنك الأسئلة التكيفي للمتابعة" : "Complete the adaptive question-bank readiness checks to continue")
        : blockMessages.no_question);
      if (isAdaptive) setShowAdaptiveSetup(true);
      return;
    }
    if (wizardStep < 3) setWizardStep(s => (s + 1) as 1 | 2 | 3);
  };
  const goPrev = () => {
    // في الخطوة الثانية وعند اختيار طريقة، يرجع إلى شاشة اختيار الطريقة أولاً
    if (wizardStep === 2 && questionMethod !== null && !isPaper) {
      setQuestionMethod(null);
      setShowAiPanel(false);
      setShowImageExtract(false);
      setAiError("");
      setExtractError("");
      setExtractFiles([]);
      pendingExtractFpRef.current = null;
      return;
    }
    if (wizardStep > 1) setWizardStep(s => (s - 1) as 1 | 2 | 3);
  };

  const STEPS = [
    { num: 1, label: lang === "ar" ? "الأساسيات" : "Basics", Icon: FilePenLine },
    { num: 2, label: lang === "ar" ? "الأسئلة" : "Questions", Icon: ListChecks },
    { num: 3, label: lang === "ar" ? "نشر" : "Publish", Icon: SendIcon },
  ];

  // ── Math toolbar panel ──
  const MathPanel = ({ onInsert }: { onInsert: (sym: string) => void }) => (
    <div className="p-2.5 bg-muted/60 rounded-lg border border-primary/20 mt-1.5">
      {MATH_GROUPS.map(group => (
        <div key={group.labelEn} className="mb-1.5">
          <span className="text-[10px] font-bold text-primary/60 uppercase tracking-wider block mb-1">
            {lang === "ar" ? group.labelAr : group.labelEn}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.symbols.map(sym => (
              <button key={sym} type="button" onClick={() => onInsert(sym)}
                className="w-8 h-8 flex items-center justify-center rounded bg-background border border-border hover:bg-primary/10 hover:border-primary/50 text-sm font-mono transition-colors">
                {sym}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Dictation question editor ──
  const DictationQuestionEditor = ({
    text, maxListens, allowErrors, lang: l,
    onTextChange, onMaxListensChange, onAllowErrorsChange,
  }: {
    text: string; maxListens: number; allowErrors: boolean; lang: string;
    onTextChange: (v: string) => void;
    onMaxListensChange: (v: number) => void;
    onAllowErrorsChange: (v: boolean) => void;
  }) => {
    const [speaking, setSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const refreshCreditsBalance = useRefreshCreditsBalance();
    const previewTts = async () => {
      if (!text.trim()) return;
      if (speaking) {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: text.trim(), voice: "nova", speed: 0.85 }),
        });
        if (!res.ok) throw new Error("TTS failed");
        refreshCreditsBalance();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
      } catch {
        setSpeaking(false);
        toast.error(l === "ar" ? "تعذّر تشغيل الصوت" : "Could not play audio");
      }
    };
    return (
      <div className="bg-[#f4f7f5] dark:bg-[#0B100E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary">
            {l === "ar" ? "نص الإملاء الصوتي" : "Dictation Text"}
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder={l === "ar" ? "اكتب الجملة أو الفقرة التي سيسمعها الطالب..." : "Write the sentence or paragraph the student will hear..."}
          rows={3}
          dir="auto"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15201B] text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all resize-none"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={previewTts}
            disabled={!text.trim()}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-40 shadow-sm ${speaking ? "bg-red-100 text-red-700 border border-red-300" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
          >
            {speaking ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {speaking ? (l === "ar" ? "إيقاف" : "Stop") : (l === "ar" ? "استمع للمعاينة" : "Preview Audio")}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{l === "ar" ? "عدد الاستماع:" : "Max listens:"}</span>
            <select
              value={maxListens}
              onChange={e => onMaxListensChange(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 text-xs font-black focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
            >
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAllowErrorsChange(!allowErrors)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${allowErrors ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${allowErrors ? (l === "ar" ? "right-0.5" : "left-[18px]") : (l === "ar" ? "left-0.5" : "left-0.5")}`} />
            </button>
            <span className="text-xs text-muted-foreground">{l === "ar" ? "قبول الأخطاء الإملائية البسيطة" : "Allow minor spelling errors"}</span>
          </div>
        </div>
        <p className="text-[10px] text-primary/75">
          🎙 {l === "ar" ? "سيسمع الطالب النص ثم يكتب ما سمعه. يُصحَّح تلقائياً." : "Student hears the text then types what they heard. Auto-graded."}
        </p>
      </div>
    );
  };

  // ── Toggle helper ──
  const Toggle = ({ on, onChange, color = "green" }: { on: boolean; onChange: () => void; color?: string }) => (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${on ? (color === "orange" ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-300 dark:bg-slate-700"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${on ? (lang === "ar" ? "right-0.5" : "left-[22px]") : (lang === "ar" ? "left-0.5" : "left-0.5")}`} />
    </button>
  );

  return (
    <Layout>
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24 font-display">
      {/* ══ Sticky Header ══ */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-2 sm:py-4 flex items-center gap-3 sm:gap-4 transition-all">
        <button
          type="button"
          onClick={() => setLocation("/teacher")}
          className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
          aria-label={lang === "ar" ? "رجوع" : "Back"}
        >
          <BackArrowIcon className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
              {isContestMode
                ? (lang === "ar" ? "أنشئ أسئلة مسابقتك" : "Create your contest questions")
                : t.createAssignment.wizardHeroTitle}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
              {isContestMode
                ? (lang === "ar"
                    ? "اكتب أسئلتك يدويًا أو ولِّدها بالذكاء الاصطناعي، ثم استخدمها في أي لعبة."
                    : "Write questions yourself or generate them with AI, then use them in any game.")
                : t.createAssignment.wizardStepProgress
                    .replace("{current}", String(wizardStep))
                    .replace("{total}", String(STEPS.length))
                    .replace("{label}", STEPS[wizardStep - 1].label)}
            </p>
          </div>
        </div>
        {!publishedInfo && (
          <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black" data-testid="chip-autosaved">
            <CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "حُفظ تلقائياً" : "Autosaved"}
          </span>
        )}
      </header>

      {publishedInfo ? (
        /* ══ Success screen — shown after publishing instead of redirecting ══ */
        <PublishSuccessScreen publishedInfo={publishedInfo} lang={lang} setLocation={setLocation} />
      ) : (
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-8">
        {/* ══ Progress Bar ══ */}
        <div className="flex items-center px-2">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => { if (step.num < wizardStep) setWizardStep(step.num as 1|2|3); }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center relative transition-all ${
                    wizardStep === step.num
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-110"
                      : wizardStep > step.num
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 cursor-pointer hover:scale-105"
                      : "bg-[#f4f7f5] text-slate-400 border border-slate-200 dark:bg-[#0B100E] dark:border-slate-800 dark:text-slate-600 cursor-not-allowed"
                  }`}
                >
                  <step.Icon className="w-5 h-5" />
                  {wizardStep > step.num && (
                    <span className="absolute -bottom-1 -end-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0B100E] flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </span>
                  )}
                </button>
                <span className={`text-[10px] font-bold mt-1.5 whitespace-nowrap ${wizardStep === step.num ? "text-slate-800 dark:text-slate-200" : "text-slate-400"}`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 -mt-4 rounded-full transition-colors ${wizardStep > step.num ? "bg-emerald-200 dark:bg-emerald-800/60" : "bg-slate-100 dark:bg-slate-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {wizardStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
              
              {/* Basic Info Form */}
              <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-5">
                <div>
                  <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    {t.createAssignment.assignmentTitle} <span className="text-red-500">*</span>
                  </Label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t.createAssignment.titlePlaceholder}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-500" />
                      {t.createAssignment.subjectLabel}
                    </Label>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder={t.createAssignment.subjectPlaceholder}
                      list="subject-suggestions"
                      className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all"
                    />
                    <datalist id="subject-suggestions">{getSuggestions("subjects").map((s, i) => <option key={i} value={s} />)}</datalist>
                    {isMathSubject && <p className="text-[10px] text-amber-600 mt-1.5 font-bold flex items-center gap-1"><Sparkles className="w-3 h-3"/> {lang === "ar" ? "سيتم تفعيل شريط الرياضيات تلقائياً" : "Math toolbar will activate automatically"}</p>}
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                      {t.createAssignment.targetClass}
                    </Label>
                    <div className="bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl p-1.5 min-h-[50px] focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all flex flex-col gap-1.5">
                      {targetClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-1 pt-0.5">
                          {targetClasses.map(c => (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-black border border-emerald-200/50 dark:border-emerald-800/50">
                              {c}
                              <button type="button" onClick={() => setTargetClasses(prev => prev.filter(x => x !== c))} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      {teacherClasses.length > 0 ? (
                        <select onChange={e => { if (e.target.value && !targetClasses.includes(e.target.value)) setTargetClasses([...targetClasses, e.target.value]); e.target.value = ""; }} className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none px-2 py-1.5 cursor-pointer">
                          <option value="">{lang === "ar" ? "اختر صفاً..." : "Select class..."}</option>
                          {teacherClasses.map(c => <option key={c.id} value={c.name}>{c.groupName ? `${c.groupName} — ${c.name}` : c.name}</option>)}
                        </select>
                      ) : (
                        <input value={classInput} onChange={e => setClassInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && classInput.trim()) { e.preventDefault(); if (!targetClasses.includes(classInput.trim())) setTargetClasses([...targetClasses, classInput.trim()]); setClassInput(""); } }} placeholder={lang === "ar" ? "اضغط Enter للإضافة" : "Press Enter to add"} className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none px-2 py-1.5" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!title.trim()}
                    data-testid="btn-wizard-next"
                    className="flex min-w-[190px] items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{lang === "ar" ? "التالي: إضافة الأسئلة" : "Next: Add Questions"}</span>
                    {lang === "ar" ? <ArrowLeft className="w-5 h-5 shrink-0" /> : <ArrowRight className="w-5 h-5 shrink-0" />}
                  </button>
                </div>

              </div>

              {/* Compact template picker */}
              <div className="px-1">
                {selectedTemplateId && selectedTemplateId !== "scratch" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-500">{lang === "ar" ? "القالب المختار:" : "Template:"}</span>
                    <span className="text-[12px] font-black text-emerald-700 dark:text-emerald-400">
                      {(() => { const tmpl = TEMPLATES.find(t => t.id === selectedTemplateId); return tmpl ? (lang === "ar" ? tmpl.title : tmpl.titleEn) : ""; })()}
                    </span>
                    <button type="button" onClick={() => setShowTemplateDialog(true)}
                      className="text-[11px] font-black text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors">
                      {lang === "ar" ? "· تغيير" : "· Change"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowTemplateDialog(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[12px] font-black text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.97]">
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    {lang === "ar"
                      ? `استخدام قالب جاهز · ${TEMPLATES.filter(t => t.id !== "scratch").length} قوالب`
                      : `Use a ready-made template · ${TEMPLATES.filter(t => t.id !== "scratch").length} templates`}
                  </button>
                )}
              </div>

              {/* Template picker Dialog */}
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
                  <DialogHeader>
                    <DialogTitle className="font-black text-slate-800 dark:text-slate-100">
                      {lang === "ar" ? "اختر قالباً جاهزاً" : "Choose a ready-made template"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {TEMPLATES.filter(tmpl => tmpl.id !== "scratch").map((tmpl) => (
                      <button key={tmpl.id} type="button"
                        onClick={() => { applyTemplate(tmpl); setShowTemplateDialog(false); }}
                        className={`group flex flex-col text-start p-4 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border-2 transition-all hover:shadow-md active:scale-[0.98] ${selectedTemplateId === tmpl.id ? "border-emerald-500 shadow-sm" : "border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}>
                        <div className="flex items-start justify-between gap-2 mb-2 w-full">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110" style={{ backgroundColor: tmpl.bgColor }}>
                            {tmpl.emoji}
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {(lang === "ar" ? tmpl.tags : tmpl.tagsEn).map(tag => (
                              <span key={tag} className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-500 shadow-sm border border-slate-100 dark:border-slate-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? tmpl.title : tmpl.titleEn}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2">{lang === "ar" ? tmpl.desc : tmpl.descEn}</p>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}
              {/* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ */}
              {wizardStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="flex flex-col gap-5">

                  {!isPaper && (
                    <>
                    <div data-testid="card-adaptive-entry" className={`order-last rounded-2xl border p-4 ${isAdaptive ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20" : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <Brain className={`mt-0.5 h-5 w-5 shrink-0 ${isAdaptive ? "text-violet-600" : "text-slate-400"}`} />
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                              {lang === "ar" ? "اختبار تكيّفي (اختياري)" : "Adaptive test (optional)"}
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                              {lang === "ar"
                                ? "يعرض لكل طالب أسئلة تناسب أداءه. فعّله فقط إذا كنت تريد إعداد المهارات ومستويات الصعوبة."
                                : "Adapts questions to each student's performance. Enable it only if you want to configure skills and difficulty levels."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid="toggle-adaptive-entry"
                          onClick={() => {
                            if (isAdaptive) {
                              setIsAdaptive(false);
                            } else {
                              setIsAdaptive(true);
                              setShowAdaptiveSetup(true);
                            }
                          }}
                          aria-pressed={isAdaptive}
                          aria-label={lang === "ar" ? "تفعيل الاختبار التكيفي" : "Enable adaptive test"}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isAdaptive ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isAdaptive ? (lang === "ar" ? "right-0.5" : "left-[22px]") : "left-0.5"}`} />
                        </button>
                      </div>
                      {isAdaptive && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-200 pt-3 text-[10px] font-bold text-violet-700 dark:border-violet-800 dark:text-violet-300">
                          <span className="rounded-full bg-violet-100 px-2 py-1 dark:bg-violet-900/30">{adaptiveQuestionsPerSession} {lang === "ar" ? "أسئلة لكل طالب" : "questions per student"}</span>
                          <span className="rounded-full bg-violet-100 px-2 py-1 dark:bg-violet-900/30">{adaptiveSkills.length} {lang === "ar" ? "مهارات" : "skills"}</span>
                          <button type="button" onClick={() => setShowAdaptiveSetup(true)} className="ms-auto rounded-lg px-2 py-1 underline-offset-2 hover:bg-violet-100 hover:underline dark:hover:bg-violet-900/30">
                            {lang === "ar" ? "تعديل الإعدادات" : "Edit settings"}
                          </button>
                        </div>
                      )}
                    </div>

                    <Dialog open={showAdaptiveSetup} onOpenChange={setShowAdaptiveSetup}>
                      <DialogContent dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-xl overflow-hidden rounded-3xl border-violet-200 p-0 dark:border-violet-800">
                        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-5 text-white">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Brain className="h-5 w-5" /></span>
                              {lang === "ar" ? "إعداد الاختبار التكيفي" : "Adaptive test settings"}
                            </DialogTitle>
                          </DialogHeader>
                          <p className="mt-2 text-xs font-medium text-white/80">
                            {lang === "ar" ? "اضبط الاختبار أولًا، ثم اختر طريقة إنشاء الأسئلة." : "Configure the test first, then choose how to create the questions."}
                          </p>
                        </div>

                        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                          <div className="flex gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => setAdaptiveMode("continuous")}
                              className={`flex-1 rounded-lg py-2 text-xs font-black transition-colors ${adaptiveMode === "continuous" ? "bg-white text-violet-700 shadow-sm dark:bg-[#15201B] dark:text-violet-300" : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                            >
                              {lang === "ar" ? "تلقائي (مستمر)" : "Continuous"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdaptiveMode("staged")}
                              className={`flex-1 rounded-lg py-2 text-xs font-black transition-colors ${adaptiveMode === "staged" ? "bg-white text-violet-700 shadow-sm dark:bg-[#15201B] dark:text-violet-300" : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                            >
                              {lang === "ar" ? "التكيفي متعدد المراحل" : "Staged Adaptive"}
                            </button>
                          </div>

                          <section className="space-y-3">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "المهارات التي يقيسها الاختبار" : "Skills measured by the test"}</h3>
                              <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "أضف المهارات، ثم اربط كل سؤال بإحدى هذه المهارات." : "Add skills, then assign each question to one of them."}</p>
                            </div>
                            <div className="flex min-h-10 flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-violet-50/60 p-2 dark:border-violet-900 dark:bg-violet-950/20">
                              {adaptiveSkills.length === 0 && <span className="p-1 text-[11px] font-bold text-muted-foreground">{lang === "ar" ? "لم تضف مهارات بعد" : "No skills added yet"}</span>}
                              {adaptiveSkills.map((skill, index) => (
                                <span key={skill} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-violet-700 shadow-sm dark:bg-[#15201B] dark:text-violet-300">
                                  {skill}
                                  <button type="button" onClick={() => setAdaptiveSkills(adaptiveSkills.filter((_, i) => i !== index))} className="rounded p-0.5 hover:bg-red-50 hover:text-red-600"><X className="h-3 w-3" /></button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={adaptiveSkillInput}
                                onChange={e => setAdaptiveSkillInput(e.target.value)}
                                placeholder={lang === "ar" ? "مثال: الجمع أو الكسور" : "e.g. Addition or fractions"}
                                className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-500 dark:border-slate-700"
                                onKeyDown={e => {
                                  if (e.key === "Enter" && adaptiveSkillInput.trim()) {
                                    e.preventDefault();
                                    if (!adaptiveSkills.includes(adaptiveSkillInput.trim())) setAdaptiveSkills([...adaptiveSkills, adaptiveSkillInput.trim()]);
                                    setAdaptiveSkillInput("");
                                  }
                                }}
                              />
                              <button type="button" onClick={() => {
                                if (adaptiveSkillInput.trim() && !adaptiveSkills.includes(adaptiveSkillInput.trim())) setAdaptiveSkills([...adaptiveSkills, adaptiveSkillInput.trim()]);
                                setAdaptiveSkillInput("");
                              }} className="rounded-xl bg-violet-600 px-4 text-white hover:bg-violet-700"><Plus className="h-4 w-4" /></button>
                            </div>
                          </section>

                          <section className={`rounded-2xl border p-4 ${adaptiveReadiness.isReady ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"}`}>
                            <div className="mb-3 flex items-center gap-2">
                              {adaptiveReadiness.isReady ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                              <div>
                                <h3 className="text-sm font-black">{lang === "ar" ? "جاهزية بنك الأسئلة" : "Question bank readiness"}</h3>
                                <p className="text-[11px] text-muted-foreground">
                                  {adaptiveMode === "staged"
                                    ? (lang === "ar" ? "يجب توفر العدد المطلوب من الأسئلة لكل مرحلة." : "Must have required number of questions per stage.")
                                    : (lang === "ar" ? "يلزم سؤالان على الأقل لكل مستوى في كل مهارة." : "At least two questions are required at every level for every skill.")}
                                </p>
                              </div>
                            </div>
                            {adaptiveMode === "continuous" && (
                              adaptiveReadiness.skills.length === 0 ? (
                                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{lang === "ar" ? "أضف مهارة واحدة على الأقل." : "Add at least one skill."}</p>
                              ) : (
                                <div className="space-y-2">
                                  {adaptiveReadiness.skills.map(row => {
                                    const complete = row.easy >= 2 && row.medium >= 2 && row.hard >= 2;
                                    return <div key={row.skill} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs dark:bg-[#15201B]/80">
                                      <span className="min-w-24 flex-1 font-black">{row.skill}</span>
                                      <span className={row.easy >= 2 ? "text-emerald-700" : "text-amber-700"}>{lang === "ar" ? "سهل" : "Easy"} {row.easy}/2</span>
                                      <span className={row.medium >= 2 ? "text-emerald-700" : "text-amber-700"}>{lang === "ar" ? "متوسط" : "Medium"} {row.medium}/2</span>
                                      <span className={row.hard >= 2 ? "text-emerald-700" : "text-amber-700"}>{lang === "ar" ? "صعب" : "Hard"} {row.hard}/2</span>
                                      {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                                      {!complete && (
                                        <div className="flex w-full flex-wrap gap-1.5 border-t border-amber-100 pt-2 dark:border-amber-900/40">
                                          {([
                                            { value: 1 as const, label: lang === "ar" ? "سهل" : "Easy", current: row.easy },
                                            { value: 2 as const, label: lang === "ar" ? "متوسط" : "Medium", current: row.medium },
                                            { value: 3 as const, label: lang === "ar" ? "صعب" : "Hard", current: row.hard },
                                          ]).filter(item => item.current < 2).map(item => {
                                            const missing = 2 - item.current;
                                            const loadingKey = `${row.skill}:${item.value}`;
                                            return (
                                              <button
                                                key={item.value}
                                                type="button"
                                                disabled={Boolean(adaptiveGapLoading)}
                                                onClick={() => handleGenerateAdaptiveGap(row.skill, item.value, missing)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2 py-1 text-[10px] font-black text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                                              >
                                                {adaptiveGapLoading === loadingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                {lang === "ar" ? `ولّد ${missing} ${item.label}` : `Generate ${missing} ${item.label}`}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>;
                                  })}
                                </div>
                              )
                            )}
                            {adaptiveMode === "staged" && adaptiveReadiness.stagedErrors.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {adaptiveReadiness.stagedErrors.map((err, i) => (
                                  <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-100/50 p-2 text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {(adaptiveReadiness.noSkill.length > 0 || adaptiveReadiness.undeclaredSkill.length > 0 || adaptiveReadiness.unsupportedType.length > 0) && (
                              <div className="mt-3 space-y-1 text-[11px] font-bold text-red-700 dark:text-red-300">
                                {adaptiveReadiness.noSkill.length > 0 && <p>{lang === "ar" ? `أسئلة بلا مهارة: ${adaptiveReadiness.noSkill.join("، ")}` : `Questions without a skill: ${adaptiveReadiness.noSkill.join(", ")}`}</p>}
                                {adaptiveReadiness.undeclaredSkill.length > 0 && <p>{lang === "ar" ? `مهارة غير معلنة في الأسئلة: ${adaptiveReadiness.undeclaredSkill.join("، ")}` : `Questions with an undeclared skill: ${adaptiveReadiness.undeclaredSkill.join(", ")}`}</p>}
                                {adaptiveReadiness.unsupportedType.length > 0 && <p>{lang === "ar" ? `أنواع غير مدعومة في الأسئلة: ${adaptiveReadiness.unsupportedType.join("، ")}` : `Unsupported question types: ${adaptiveReadiness.unsupportedType.join(", ")}`}</p>}
                              </div>
                            )}
                          </section>

                          {adaptiveMode === "continuous" ? (
                            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <h3 className="text-sm font-black">{lang === "ar" ? "عدد الأسئلة لكل طالب" : "Questions per student"}</h3>
                                  <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "يختار النظام هذا العدد من بنك الأسئلة بحسب أداء الطالب." : "The system selects this many questions based on student performance."}</p>
                                </div>
                                <input type="number" min={3} max={50} value={adaptiveQuestionsPerSession} onChange={e => setAdaptiveQuestionsPerSession(Math.max(3, Math.min(50, parseInt(e.target.value) || 10)))} className="w-20 rounded-xl border-2 border-violet-200 bg-background px-2 py-2 text-center text-lg font-black text-violet-700 outline-none focus:border-violet-500 dark:border-violet-800 dark:text-violet-300" />
                              </div>
                            </section>
                          ) : (
                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "مراحل الاختبار" : "Test Stages"}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "إظهار أسماء المراحل للطلاب" : "Show stage names to students"}</span>
                                  <Toggle on={adaptiveShowStageNames} onChange={() => setAdaptiveShowStageNames(!adaptiveShowStageNames)} color="violet" />
                                </div>
                              </div>
                              <div className="space-y-3">
                                {adaptiveStages.map((stage, stageIndex) => (
                                  <div key={stage.id} className="relative rounded-xl border border-violet-200 bg-violet-50/30 p-3 shadow-sm dark:border-violet-800 dark:bg-violet-950/10">
                                    <div className="mb-3 flex items-center justify-between gap-2 border-b border-violet-100 pb-2 dark:border-violet-900">
                                      <input
                                        value={stage.name || ""}
                                        onChange={e => {
                                          const copy = [...adaptiveStages];
                                          copy[stageIndex].name = e.target.value;
                                          setAdaptiveStages(copy);
                                        }}
                                        placeholder={lang === "ar" ? `المرحلة ${stageIndex + 1}` : `Stage ${stageIndex + 1}`}
                                        className="w-1/2 rounded bg-transparent px-1 py-0.5 text-sm font-black text-violet-700 outline-none focus:bg-white dark:text-violet-300 dark:focus:bg-[#15201B]"
                                      />
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => {
                                          if (stageIndex === 0) return;
                                          const copy = [...adaptiveStages];
                                          const temp = copy[stageIndex];
                                          copy[stageIndex] = copy[stageIndex - 1];
                                          copy[stageIndex - 1] = temp;
                                          setAdaptiveStages(copy);
                                        }} disabled={stageIndex === 0} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-300"><ChevronUp className="h-4 w-4" /></button>
                                        <button type="button" onClick={() => {
                                          if (stageIndex === adaptiveStages.length - 1) return;
                                          const copy = [...adaptiveStages];
                                          const temp = copy[stageIndex];
                                          copy[stageIndex] = copy[stageIndex + 1];
                                          copy[stageIndex + 1] = temp;
                                          setAdaptiveStages(copy);
                                        }} disabled={stageIndex === adaptiveStages.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-300"><ChevronDown className="h-4 w-4" /></button>
                                        <button type="button" onClick={() => setAdaptiveStages(adaptiveStages.filter((_, i) => i !== stageIndex))} className="rounded p-1 text-red-400 hover:bg-red-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "عدد الأسئلة" : "Question count"}</label>
                                        <input type="number" min={1} value={stage.questionCount} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].questionCount = Math.max(1, parseInt(e.target.value) || 1); setAdaptiveStages(copy); }} className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "شرط الاجتياز" : "Pass rule"}</label>
                                        <div className="flex rounded border border-slate-200 bg-background overflow-hidden focus-within:border-violet-500">
                                          <input type="number" min={0} max={stage.passRuleType === "percent" ? 100 : stage.questionCount} value={stage.passThreshold} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].passThreshold = Math.max(0, parseInt(e.target.value) || 0); setAdaptiveStages(copy); }} className="w-full bg-transparent px-2 py-1.5 font-bold outline-none" />
                                          <select value={stage.passRuleType} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].passRuleType = e.target.value as "percent" | "correctCount"; setAdaptiveStages(copy); }} className="bg-slate-100 px-1 text-[10px] font-bold outline-none dark:bg-slate-800 border-s border-slate-200 dark:border-slate-700">
                                            <option value="percent">%</option>
                                            <option value="correctCount">{lang === "ar" ? "صحيحة" : "correct"}</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "عند الرسوب" : "On fail"}</label>
                                        <select value={stage.failureAction} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].failureAction = e.target.value as any; setAdaptiveStages(copy); }} className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500">
                                          <option value="support">{lang === "ar" ? "مسار مساندة" : "Support track"}</option>
                                          <option value="repeat">{lang === "ar" ? "إعادة المرحلة" : "Repeat stage"}</option>
                                          <option value="continue">{lang === "ar" ? "تجاوز وإكمال" : "Continue anyway"}</option>
                                          <option value="finish">{lang === "ar" ? "إنهاء الاختبار" : "Finish test"}</option>
                                        </select>
                                      </div>
                                      {stage.failureAction === "repeat" && (
                                        <div className="space-y-1">
                                          <label className="font-bold">{lang === "ar" ? "أقصى تكرار" : "Max repeats"}</label>
                                          <input type="number" min={1} value={stage.maxRepeats} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].maxRepeats = Math.max(1, parseInt(e.target.value) || 1); setAdaptiveStages(copy); }} className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500" />
                                        </div>
                                      )}
                                      {stage.failureAction === "support" && (
                                        <div className="space-y-1">
                                          <label className="font-bold">{lang === "ar" ? "أسئلة المساندة" : "Support qs"}</label>
                                          <input type="number" min={1} value={stage.supportQuestionCount} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].supportQuestionCount = Math.max(1, parseInt(e.target.value) || 1); setAdaptiveStages(copy); }} className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500" />
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "المدة (دقائق)" : "Duration (min)"}</label>
                                        <input type="number" min={0} value={stage.durationMinutes || ""} onChange={e => { const copy = [...adaptiveStages]; copy[stageIndex].durationMinutes = parseInt(e.target.value) > 0 ? parseInt(e.target.value) : undefined; setAdaptiveStages(copy); }} placeholder={lang === "ar" ? "مفتوح" : "None"} className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500" />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs pt-3 border-t border-violet-100 dark:border-violet-900">
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "المهارات (اختياري)" : "Skills (opt)"}</label>
                                        <select
                                          value=""
                                          onChange={e => {
                                            const v = e.target.value;
                                            if (!v || stage.skills.includes(v)) return;
                                            const copy = [...adaptiveStages];
                                            copy[stageIndex].skills.push(v);
                                            setAdaptiveStages(copy);
                                          }}
                                          className="w-full rounded border border-slate-200 bg-background px-2 py-1.5 font-bold outline-none focus:border-violet-500"
                                        >
                                          <option value="">{lang === "ar" ? "إضافة مهارة..." : "Add skill..."}</option>
                                          {adaptiveSkills.filter(s => !stage.skills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {stage.skills.length > 0 && (
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {stage.skills.map(s => (
                                              <span key={s} className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                                                {s}
                                                <button type="button" onClick={() => { const copy = [...adaptiveStages]; copy[stageIndex].skills = copy[stageIndex].skills.filter(sk => sk !== s); setAdaptiveStages(copy); }}><X className="h-3 w-3 hover:text-red-500" /></button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1">
                                        <label className="font-bold">{lang === "ar" ? "الصعوبة (اختياري)" : "Difficulty (opt)"}</label>
                                        <div className="flex gap-1">
                                          {[
                                            { val: 1, label: lang === "ar" ? "سهل" : "Easy" },
                                            { val: 2, label: lang === "ar" ? "متوسط" : "Med" },
                                            { val: 3, label: lang === "ar" ? "صعب" : "Hard" },
                                          ].map(d => (
                                            <button
                                              key={d.val}
                                              type="button"
                                              onClick={() => {
                                                const copy = [...adaptiveStages];
                                                if (copy[stageIndex].difficulties.includes(d.val)) {
                                                  copy[stageIndex].difficulties = copy[stageIndex].difficulties.filter(v => v !== d.val);
                                                } else {
                                                  copy[stageIndex].difficulties.push(d.val);
                                                }
                                                setAdaptiveStages(copy);
                                              }}
                                              className={`flex-1 rounded border px-1 py-1 text-[10px] font-bold transition-colors ${stage.difficulties.includes(d.val) ? "border-violet-500 bg-violet-500 text-white" : "border-slate-200 bg-background text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"}`}
                                            >
                                              {d.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setAdaptiveStages([...adaptiveStages, {
                                    id: nextClientId(),
                                    name: "",
                                    questionCount: 5,
                                    passRuleType: "percent",
                                    passThreshold: 60,
                                    difficulties: [],
                                    skills: [],
                                    failureAction: "support",
                                    supportQuestionCount: 3,
                                    maxRepeats: 1,
                                  }])}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-200 py-3 text-xs font-black text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/20"
                                >
                                  <Plus className="h-4 w-4" />
                                  {lang === "ar" ? "إضافة مرحلة جديدة" : "Add new stage"}
                                </button>
                              </div>
                            </section>
                          )}

                          <section className="space-y-2">
                            <h3 className="text-sm font-black">{lang === "ar" ? "ما الذي يراه الطالب؟" : "What can the student see?"}</h3>
                            <div className="rounded-2xl border border-slate-200 px-4 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 dark:border-slate-800">
                                <div><span className="block text-xs font-black">{lang === "ar" ? "إظهار صحة الإجابة مباشرة" : "Show correctness immediately"}</span><span className="block text-[10px] text-muted-foreground">{lang === "ar" ? "بعد كل سؤال" : "After each question"}</span></div>
                                <Toggle on={adaptiveShowImmediateFeedback} onChange={() => setAdaptiveShowImmediateFeedback(!adaptiveShowImmediateFeedback)} color="green" />
                              </div>
                              <div className="flex items-center justify-between gap-3 py-3">
                                <div><span className="block text-xs font-black">{lang === "ar" ? "إظهار الإجابات بعد النتيجة" : "Show answers after results"}</span><span className="block text-[10px] text-muted-foreground">{lang === "ar" ? "إجابة الطالب والإجابة الصحيحة" : "Student and correct answers"}</span></div>
                                <Toggle on={adaptiveShowAnswersAfterResult} onChange={() => setAdaptiveShowAnswersAfterResult(!adaptiveShowAnswersAfterResult)} color="green" />
                              </div>
                            </div>
                          </section>

                          <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-black"><Clock className="h-4 w-4 text-orange-500" />{lang === "ar" ? "وقت الاختبار" : "Test timing"}</h3>
                            <div className="rounded-2xl border border-slate-200 px-4 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-3 py-3">
                                <div><span className="block text-xs font-black">{t.createAssignment.examMode}</span><span className="block text-[10px] text-muted-foreground">{t.createAssignment.examModeDesc}</span></div>
                                <Toggle on={examMode} onChange={() => setExamMode(!examMode)} color="orange" />
                              </div>
                              {examMode && (
                                <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 dark:border-slate-800">
                                  <Label className="text-xs font-bold">{t.createAssignment.examDuration}</Label>
                                  <div className="flex items-center gap-2">
                                    <input type="number" min={1} max={300} value={examDurationMinutes} onChange={e => setExamDurationMinutes(Math.max(1, Math.min(300, parseInt(e.target.value) || 30)))} className="w-20 rounded-xl border-2 border-orange-200 bg-background px-2 py-2 text-center font-black outline-none focus:border-orange-500 dark:border-orange-800" dir="ltr" />
                                    <span className="text-xs font-bold text-muted-foreground">{lang === "ar" ? "دقيقة" : "minutes"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>

                          <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-black"><Lock className="h-4 w-4 text-violet-500" />{lang === "ar" ? "الوصول والموعد" : "Access & deadline"}</h3>
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setAccessMode("public")} className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-black ${accessMode === "public" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300" : "border-slate-200 text-muted-foreground dark:border-slate-700"}`}><Globe className="me-1 inline h-3.5 w-3.5" />{t.createAssignment.public}</button>
                                <button type="button" onClick={() => { setAccessMode("private"); setIsShared(false); }} className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-black ${accessMode === "private" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300" : "border-slate-200 text-muted-foreground dark:border-slate-700"}`}><Lock className="me-1 inline h-3.5 w-3.5" />{t.createAssignment.privateCode}</button>
                              </div>
                              {accessMode === "private" && (
                                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                  <input value={accessCode} onChange={e => setAccessCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-background px-3 py-2 text-center font-mono tracking-widest dark:border-slate-700" dir="ltr" />
                                  <button type="button" onClick={() => setAccessCode(generateAccessCode())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t.createAssignment.newCode}</button>
                                </div>
                              )}
                              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <Label className="text-xs font-bold">{t.createAssignment.deadlineLabel}</Label>
                                <div className="mt-1 flex items-center gap-2">
                                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-background px-3 py-2 text-xs outline-none focus:border-violet-500 dark:border-slate-700" dir="ltr" />
                                  {deadline && <button type="button" onClick={() => setDeadline("")} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>}
                                </div>
                              </div>
                            </div>
                          </section>

                          <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-black"><Eye className="h-4 w-4 text-emerald-500" />{lang === "ar" ? "النتائج والمحاولات" : "Results & attempts"}</h3>
                            <div className="rounded-2xl border border-slate-200 px-4 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 dark:border-slate-800">
                                <div><span className="block text-xs font-black">{t.createAssignment.showResults}</span><span className="block text-[10px] text-muted-foreground">{showResults ? t.createAssignment.showResultsOn : t.createAssignment.showResultsOff}</span></div>
                                <Toggle on={showResults} onChange={() => setShowResults(!showResults)} color="green" />
                              </div>
                              {showResults && (
                                <div className="border-b border-slate-100 py-3 dark:border-slate-800">
                                  <span className="mb-2 block text-xs font-bold">{t.createAssignment.resultsRelease}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      { value: "immediate" as const, label: lang === "ar" ? "فوري" : "Immediate" },
                                      { value: "after_deadline" as const, label: lang === "ar" ? "بعد الموعد" : "After deadline" },
                                      { value: "manual" as const, label: lang === "ar" ? "يدوي" : "Manual" },
                                    ].map(option => (
                                      <button key={option.value} type="button" onClick={() => setResultsReleaseMode(option.value)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${resultsReleaseMode === option.value ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300" : "border-slate-200 text-muted-foreground dark:border-slate-700"}`}>{option.label}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-3 py-3">
                                <div><span className="block text-xs font-black">{lang === "ar" ? "السماح بإعادة المحاولة" : "Allow retry"}</span><span className="block text-[10px] text-muted-foreground">{allowRetry ? (lang === "ar" ? "يمكن للطالب إعادة الاختبار" : "Students can retake") : (lang === "ar" ? "محاولة واحدة فقط" : "One attempt only")}</span></div>
                                <Toggle on={allowRetry} onChange={() => setAllowRetry(!allowRetry)} color="green" />
                              </div>
                            </div>
                          </section>

                          {accessMode !== "private" && (
                            <section className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                              <div><span className="block text-xs font-black">{lang === "ar" ? "النشر في مكتبة الأنشطة" : "Publish in activity library"}</span><span className="block text-[10px] text-muted-foreground">{lang === "ar" ? "إتاحة النشاط للمعلمين الآخرين" : "Make the activity available to other teachers"}</span></div>
                              <Toggle on={isShared} onChange={() => setIsShared(!isShared)} color="green" />
                            </section>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-[#111916]">
                          <button type="button" onClick={() => { setIsAdaptive(false); setShowAdaptiveSetup(false); }} className="text-xs font-bold text-slate-500 hover:text-red-600">
                            {lang === "ar" ? "إلغاء الاختبار التكيفي" : "Disable adaptive test"}
                          </button>
                          <button type="button" onClick={() => setShowAdaptiveSetup(false)} className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-black text-white shadow-sm hover:bg-violet-700">
                            {lang === "ar" ? "حفظ ومتابعة" : "Save & continue"}
                          </button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </>
                  )}

                  {/* ── Method chooser gate: «كيف تريد إضافة الأسئلة؟» ── */}
                  {!isPaper && questionMethod === null ? (
                    <div className="bg-white dark:bg-[#15201B] rounded-3xl p-4 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-3 sm:space-y-4" data-testid="card-method-chooser">
                      <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 text-center">
                        {lang === "ar" ? "كيف تريد إضافة الأسئلة؟" : "How do you want to add questions?"}
                      </h2>
                      <p className="text-[11px] font-bold text-slate-500 text-center -mt-2">
                        {lang === "ar" ? "يمكنك دمج الطرق لاحقاً في المحرر نفسه" : "You can mix methods later in the same editor"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <button type="button" data-testid="btn-method-manual" onClick={() => setQuestionMethod("manual")}
                          className="flex flex-row sm:flex-col items-center gap-3 sm:gap-2 p-3 sm:p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98] text-start sm:text-center">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                          <div className="flex flex-col sm:items-center gap-0.5 sm:gap-1 min-w-0">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "إضافة يدوية" : "Write them myself"}</span>
                            <span className="text-[11px] font-bold text-slate-500 sm:text-center">{lang === "ar" ? "أضف الأسئلة والخيارات بنفسك" : "Add questions one by one"}</span>
                          </div>
                        </button>
                        <button type="button" data-testid="btn-method-ai" onClick={() => { setQuestionMethod("ai"); setShowAiPanel(true); }}
                          className="flex flex-row sm:flex-col items-center gap-3 sm:gap-2 p-3 sm:p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98] text-start sm:text-center">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                          <div className="flex flex-col sm:items-center gap-0.5 sm:gap-1 min-w-0">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "توليد بالذكاء الاصطناعي" : "Generate with AI"}</span>
                            <span className="text-[11px] font-bold text-slate-500 sm:text-center">{lang === "ar" ? "حدّد الموضوع وعدد الأسئلة ودع الذكاء الاصطناعي ينشئها لك" : "Pick topic & count, AI writes them"}</span>
                          </div>
                        </button>
                        <button type="button" data-testid="btn-method-file"
                          onClick={() => { setQuestionMethod("file"); openImageExtractPanel(); }}
                          className="flex flex-row sm:flex-col items-center gap-3 sm:gap-2 p-3 sm:p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed text-start sm:text-center">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                          <div className="flex flex-col sm:items-center gap-0.5 sm:gap-1 min-w-0">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "استخرج أسئلة من صور أو مستند" : "Extract questions from images or a document"}</span>
                            <span className="text-[11px] font-bold text-slate-500 sm:text-center">
                              {lang === "ar" ? "ارفع صوراً أو PDF أو Word أو PowerPoint" : "Upload images, PDF, Word or PowerPoint"}
                            </span>
                          </div>
                        </button>
                      </div>
                      <button type="button" data-testid="btn-method-bank" onClick={openBankModal}
                        className="w-full flex flex-row items-center gap-3 p-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98] text-start">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[13px] font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "استيراد من بنك الأسئلة" : "Import from question bank"}</span>
                          <span className="text-[10px] font-bold text-slate-500">{lang === "ar" ? "اختر أسئلة محفوظة لديك مسبقاً" : "Pick from your saved questions"}</span>
                        </div>
                      </button>
                    </div>
                  ) : (
                  <>
                  {/* Live compact summary: N سؤال · M درجة */}
                  {!isPaper && (
                    <div className="flex items-center justify-between px-1" data-testid="row-live-summary">
                      <h2 className="text-base font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "إعداد الأسئلة" : "Questions"}</h2>
                      <span className="text-[12px] font-black text-slate-500">
                        {questions.length} {lang === "ar" ? "سؤال" : "questions"} · {totalPoints} {lang === "ar" ? "درجة" : "pts"}
                      </span>
                    </div>
                  )}

                  {/* AI Generate — expanded panel (opened from chooser or «طريقة أخرى») */}
                  {!isPaper && showAiPanel && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 dark:border-emerald-800/50">
                      {(
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Wand2 className="w-4 h-4" />{t.createAssignment.aiGenerate}</h3>
                            <button type="button" onClick={() => { setShowAiPanel(false); setAiError(""); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </div>
                          <div className="relative">
                            <input
                              value={aiTopic}
                              onChange={e => setAiTopic(e.target.value)}
                              placeholder={t.createAssignment.aiTopicPlaceholder}
                              autoFocus
                              className="w-full px-4 py-3 rounded-xl border-2 border-emerald-400 dark:border-emerald-500 bg-white dark:bg-[#0B100E] text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 shadow-sm shadow-emerald-200/50 dark:shadow-none transition-all"
                            />
                            {aiTopic.trim() && (
                              <button
                                type="button"
                                onClick={() => setAiTopic("")}
                                className="absolute inset-y-0 start-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">
                              {lang === "ar" ? "النص التعليمي المصدر (اختياري)" : "Educational source text (optional)"}
                            </label>
                            <textarea
                              value={aiSourceText}
                              maxLength={MAX_SOURCE_TEXT_LENGTH}
                              onChange={e => setAiSourceText(e.target.value)}
                              placeholder={lang === "ar"
                                ? "الصق محتوى الدرس هنا؛ يبقى منفصلاً عن الموضوع والتعليمات."
                                : "Paste lesson content here; it remains separate from the topic and instructions."}
                              className="w-full min-h-24 px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#0B100E] text-sm outline-none focus:border-emerald-500"
                            />
                            <p className="text-[10px] text-muted-foreground text-end mt-1">
                              {aiSourceText.length.toLocaleString()}/{MAX_SOURCE_TEXT_LENGTH.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <select value={isAdaptive && ![12, 18, 24, 30].includes(aiCount) ? 24 : aiCount} onChange={e => setAiCount(parseInt(e.target.value))} className="flex-1 px-3 py-2 rounded-lg bg-background border-2 border-primary/20 text-sm focus:outline-none focus:border-primary">
                              {(isAdaptive ? [12, 18, 24, 30] : aiWithImages ? [5, 10, 15, 20] : [5, 10, 15, 20, 25, 30]).map(n => <option key={n} value={n}>{n} {t.createAssignment.aiQuestions}</option>)}
                            </select>
                            {!isAdaptive && <div className="flex gap-1 flex-1">
                              {difficultyOptions.map(d => (
                                <button key={d.value} type="button" onClick={() => setAiDifficulty(d.value)}
                                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-all ${aiDifficulty === d.value ? d.color === "green" ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700" : d.color === "yellow" ? "border-yellow-500 bg-yellow-100 text-yellow-700" : "border-red-500 bg-red-100 text-red-700" : "border-border bg-background text-muted-foreground"}`}>
                                  {d.label}
                                </button>
                              ))}
                            </div>}
                          </div>
                          {isAdaptive && (
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-black/10 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                              {lang === "ar"
                                ? "سيحدد الذكاء الاصطناعي المهارات ويولّد لكل مهارة سؤالين سهلين وسؤالين متوسطين وسؤالين صعبين، ثم يضع التصنيف تلقائياً."
                                : "AI will identify the skills and generate two easy, two medium, and two hard questions per skill, with classifications filled automatically."}
                            </div>
                          )}
                          {/* Image-per-question toggle — internal admin-only tool.
                              Hidden entirely for regular teachers (server enforces 403 too). */}
                          {isAdmin && !isAdaptive && (
                          <>
                          <button
                            type="button"
                            onClick={() => setAiWithImages(v => !v)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${aiWithImages ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" : "border-border bg-background text-muted-foreground hover:border-primary/30"}`}
                          >
                            <span className="text-lg leading-none">🖼️</span>
                            <span className="flex-1 text-start">
                              {lang === "ar" ? "توليد صورة لكل سؤال" : "Generate an image per question"}
                            </span>
                            <span className={`w-9 h-5 rounded-full flex items-center transition-colors ${aiWithImages ? "bg-amber-400" : "bg-muted"}`}>
                              <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${aiWithImages ? (lang === "ar" ? "-translate-x-1" : "translate-x-4") : (lang === "ar" ? "-translate-x-4" : "translate-x-1")}`} />
                            </span>
                          </button>
                          {aiWithImages && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed px-0.5">
                              {lang === "ar"
                                ? "سيُولّد الذكاء الاصطناعي صورة واضحة لكل سؤال تلقائياً — قد يستغرق التوليد دقيقة أو أكثر حسب عدد الأسئلة."
                                : "AI will generate a clear image for each question automatically — may take a minute or more depending on count."}
                            </p>
                          )}
                          </>
                          )}
                          {aiError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-2 text-xs text-red-700 dark:text-red-300">{aiError}</div>}
                          <button type="button" onClick={handleAiGenerate} disabled={aiLoading || (!aiTopic.trim() && !aiSourceText.trim())}
                            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {aiLoading
                              ? <><Loader2 className="w-4 h-4 animate-spin" />{aiWithImages ? (lang === "ar" ? "جارٍ توليد الأسئلة والصور…" : "Generating questions & images…") : t.createAssignment.aiGenerating}</>
                              : <><Sparkles className="w-4 h-4" />{t.createAssignment.aiGenerateBtn} {isAdaptive && ![12, 18, 24, 30].includes(aiCount) ? 24 : !isAdaptive && aiWithImages ? Math.min(aiCount, 20) : aiCount}{!isAdaptive && aiWithImages ? (lang === "ar" ? " بصور" : " with images") : ""}</>}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Source extract — images / PDF / DOCX / PPTX / TXT / MD */}
                  {!isPaper && showImageExtract && (
                    <div className="p-4 rounded-3xl border-2 border-primary/20 bg-primary/5">
                      {(
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Camera className="w-4 h-4" />{lang === "ar" ? "استخرج أسئلة من ملف أو نص" : "Extract questions from a file or text"}</h3>
                            <button type="button" data-testid="btn-close-extract-panel" onClick={() => { setShowImageExtract(false); setExtractError(""); setExtractFiles([]); pendingExtractFpRef.current = null; setDupChoiceOpen(false); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-1 rounded-xl bg-background/70 border border-primary/15 p-1">
                            {([
                              ["file", lang === "ar" ? "رفع ملف" : "Upload file", Upload],
                              ["text", lang === "ar" ? "لصق نص" : "Paste text", FileText],
                            ] as const).map(([mode, label, Icon]) => (
                              <button key={mode} type="button" onClick={() => { setExtractSourceMode(mode); setExtractError(""); pendingExtractFpRef.current = null; setDupChoiceOpen(false); }}
                                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-black transition-all ${extractSourceMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-primary/5"}`}>
                                <Icon className="w-4 h-4" />{label}
                              </button>
                            ))}
                          </div>
                          {extractSourceMode === "file" ? (
                            <>
                              <input ref={imageInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.pptx,.txt,.md" multiple onChange={handleSourceFiles} className="hidden" data-testid="input-extract-files" />
                              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={extractFiles.length >= EXTRACT_MAX_FILES}
                                className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-1.5 disabled:opacity-50">
                                <Upload className="w-5 h-5 text-primary" />
                                <span className="text-xs text-primary font-bold">{lang === "ar" ? `ارفع صوراً أو ملف PDF أو Word أو PowerPoint أو ملفاً نصياً (حتى ${EXTRACT_MAX_FILES})` : `Upload images, PDF, Word, PowerPoint or a text file (up to ${EXTRACT_MAX_FILES})`}</span>
                              </button>
                              <div className="flex flex-wrap gap-1.5">
                                {["PDF", "Word", "PowerPoint", lang === "ar" ? "صور" : "Images", lang === "ar" ? "نص" : "Text"].map(b => (
                                  <span key={b} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{b}</span>
                                ))}
                              </div>
                              {extractFiles.length > 0 && (
                                <div className="space-y-1.5">
                                  {extractFiles.map((f, i) => {
                                    const n = f.name.toLowerCase();
                                    const isImg = /\.(jpe?g|png|webp|gif)$/.test(n);
                                    const Icon = isImg ? ImageIcon : FileText;
                                    return (
                                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-primary/15" data-testid={`extract-file-${i}`}>
                                        <Icon className="w-4 h-4 text-primary shrink-0" />
                                        <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground" dir="ltr">{f.name}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{lang === "ar" ? "جاهز للاستخراج" : "Ready to extract"}</span>
                                        <button type="button" onClick={() => { pendingExtractFpRef.current = null; setDupChoiceOpen(false); setExtractFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                                          className="p-0.5 rounded text-muted-foreground hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="rounded-xl border border-primary/20 bg-background p-3">
                              <textarea value={extractSourceText} onChange={e => { setExtractSourceText(e.target.value); pendingExtractFpRef.current = null; setDupChoiceOpen(false); }}
                                rows={7} maxLength={MAX_SOURCE_TEXT_LENGTH} data-testid="input-extract-source-text"
                                placeholder={lang === "ar" ? "الصق هنا محتوى ورقة العمل أو الدرس أو أي نص تعليمي…" : "Paste worksheet, lesson, or other educational content here…"}
                                className="w-full resize-y bg-transparent text-sm font-medium leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60" />
                              <div className="text-end text-[10px] font-bold text-muted-foreground">{extractSourceText.length}/{MAX_SOURCE_TEXT_LENGTH}</div>
                            </div>
                          )}
                           <div className="rounded-xl border border-primary/15 bg-background/70 p-3 space-y-3">
                             <div className="flex items-start justify-between gap-3">
                               <div>
                                 <p className="text-xs font-black text-foreground">{lang === "ar" ? "إعدادات الاستخراج" : "Extraction settings"}</p>
                                 <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "راجعها قبل إنشاء الأسئلة؛ لن تُطبّق أي اختيارات مخفية." : "Review before creating questions; no hidden choices are applied."}</p>
                               </div>
                               <button
                                 type="button"
                                 onClick={recommendExtractionSettings}
                                 disabled={extractSourceMode === "file" ? extractFiles.length === 0 : extractSourceText.trim().length < 5}
                                 className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-[11px] font-black text-primary disabled:opacity-40"
                               >
                                 <Sparkles className="w-3.5 h-3.5" />
                                 {lang === "ar" ? "اقترح الإعدادات" : "Suggest settings"}
                               </button>
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                               <label className="space-y-1">
                                 <span className="block text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "لغة الأسئلة" : "Question language"}</span>
                                 <select value={extractLanguage} onChange={e => setExtractLanguage(e.target.value as "ar" | "en")}
                                   className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold outline-none focus:border-primary">
                                   <option value="ar">العربية</option>
                                   <option value="en">English</option>
                                 </select>
                               </label>
                               <label className="space-y-1">
                                 <span className="block text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "المادة (اختياري)" : "Subject (optional)"}</span>
                                 <input value={extractSubject} onChange={e => setExtractSubject(e.target.value)} maxLength={100}
                                   placeholder={subject || (lang === "ar" ? "مثال: العلوم" : "e.g. Science")}
                                   className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold outline-none focus:border-primary" />
                               </label>
                               <label className="space-y-1">
                                 <span className="block text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "الصف (اختياري)" : "Grade (optional)"}</span>
                                 <input value={extractGradeLevel} onChange={e => setExtractGradeLevel(e.target.value)} maxLength={50}
                                   placeholder={lang === "ar" ? "مثال: الصف الخامس" : "e.g. Grade 5"}
                                   className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold outline-none focus:border-primary" />
                               </label>
                             </div>
                             {extractRecommendation && (
                               <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100" data-testid="extract-settings-recommendation">
                                 <div className="flex items-start justify-between gap-3">
                                   <div>
                                     <p className="text-xs font-black">{lang === "ar" ? "توصية ذكية قابلة للمراجعة" : "Reviewable smart recommendation"}</p>
                                     <p className="mt-1 text-[10px] leading-relaxed opacity-80">{extractRecommendation.reason}</p>
                                     <p className="mt-1.5 text-[10px] font-bold">
                                       {lang === "ar"
                                         ? `${extractRecommendation.counts.mcq} اختيار متعدد، ${extractRecommendation.counts.true_false} صح أو خطأ، ${extractRecommendation.counts.fill_blank} إكمال فراغ · صعوبة متوسطة`
                                         : `${extractRecommendation.counts.mcq} multiple choice, ${extractRecommendation.counts.true_false} true/false, ${extractRecommendation.counts.fill_blank} fill blank · medium difficulty`}
                                     </p>
                                   </div>
                                   <button type="button" onClick={() => {
                                     setExtractCounts(extractRecommendation.counts);
                                     setExtractDifficulty(extractRecommendation.difficulty);
                                   }} className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-black text-white">
                                     {lang === "ar" ? "تطبيق" : "Apply"}
                                   </button>
                                 </div>
                               </div>
                             )}
                           </div>
                          <div className="rounded-xl border border-primary/15 bg-background/70 p-3 space-y-3">
                            <div>
                              <p className="text-xs font-black text-foreground">{lang === "ar" ? "عدد الأسئلة وأنواعها" : "Question count and types"}</p>
                              <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "حدّد توزيع الأسئلة المطلوبة" : "Choose the requested question distribution"}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {([
                                ["mcq", lang === "ar" ? "اختيار متعدد" : "Multiple choice"],
                                ["true_false", lang === "ar" ? "صح أو خطأ" : "True / false"],
                                ["fill_blank", lang === "ar" ? "أكمل الفراغ" : "Fill blank"],
                              ] as const).map(([key, label]) => (
                                <label key={key} className="space-y-1">
                                  <span className="block text-[10px] font-bold text-muted-foreground">{label}</span>
                                  <input type="number" min={0} max={30} value={extractCounts[key]}
                                    onChange={e => setExtractCounts(prev => ({ ...prev, [key]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))}
                                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-center text-sm font-black outline-none focus:border-primary" />
                                </label>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-muted-foreground">{lang === "ar" ? "العدد المطلوب" : "Requested total"}</span>
                              <span className="text-primary">{extractRequestedTotal}</span>
                            </div>
                          </div>
                          <label className="block space-y-1">
                            <span className="block text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "تعليمات إضافية (اختياري)" : "Additional instructions (optional)"}</span>
                            <textarea value={extractInstructions} onChange={e => setExtractInstructions(e.target.value)} maxLength={300} rows={2}
                              placeholder={lang === "ar" ? "مثال: ركّز على المفاهيم والتطبيق، وتجنب أسئلة الحفظ…" : "Example: Focus on concepts and application; avoid recall-only questions…"}
                              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium leading-relaxed outline-none focus:border-primary" />
                          </label>
                          <div className="flex gap-1">
                            {difficultyOptions.map(d => (
                              <button key={d.value} type="button" onClick={() => setExtractDifficulty(d.value)}
                                className={`flex-1 py-1.5 rounded border text-xs font-bold transition-all ${extractDifficulty === d.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                                {d.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            {lang === "ar" ? "للحصول على أفضل نتيجة من PDF المصوّر، ارفع الصفحات كصور واضحة." : "For scanned PDFs, upload the pages as clear images for best results."}
                          </p>
                          {extractCredit?.creditsEnabled && extractCredit.effectiveCost > 0 && (
                            <p className="text-xs font-bold text-primary" data-testid="text-extract-cost">
                              {lang === "ar"
                                ? (extractCredit.isPro && extractCredit.effectiveCost < extractCredit.baseCost
                                    ? `سيُستخدم ${extractCredit.effectiveCost} نقاط حصاد (خصم 20% للاحترافيين، بدلاً من ${extractCredit.baseCost}).`
                                    : `سيُستخدم ${extractCredit.effectiveCost} نقاط حصاد لإنشاء الأسئلة من هذا المصدر.`)
                                : (extractCredit.isPro && extractCredit.effectiveCost < extractCredit.baseCost
                                    ? `${extractCredit.effectiveCost} credits (20% Pro discount, instead of ${extractCredit.baseCost}).`
                                    : `${extractCredit.effectiveCost} Hasad credits will be used for this extraction.`)}
                            </p>
                          )}
                          {extractError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{extractError}</div>}
                          {dupChoiceOpen ? (
                            <div className="bg-background border-2 border-primary/25 rounded-xl p-3 space-y-2" data-testid="extract-dup-choice">
                              <p className="text-xs font-bold text-foreground">
                                {lang === "ar"
                                  ? "سبق أن استخرجت أسئلة من هذا المصدر نفسه وما زالت في المحرر. ماذا تريد؟"
                                  : "You already extracted questions from this exact source and they are still in the editor. What would you like to do?"}
                              </p>
                              <div className="flex flex-col gap-1.5">
                                <button type="button" onClick={() => void runExtraction(true)} disabled={!extractCredit || extractLoading} data-testid="btn-dup-replace"
                                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                                  {lang === "ar" ? "استبدال الأسئلة المستخرجة سابقاً" : "Replace previously extracted questions"}
                                </button>
                                <button type="button" onClick={() => void runExtraction(false)} disabled={!extractCredit || extractLoading} data-testid="btn-dup-add"
                                  className="w-full py-2 rounded-lg border border-primary/30 text-primary text-xs font-bold">
                                  {lang === "ar" ? "إضافة أسئلة جديدة على أي حال" : "Add new questions anyway"}
                                </button>
                                <button type="button" onClick={() => setDupChoiceOpen(false)} data-testid="btn-dup-cancel"
                                  className="w-full py-2 rounded-lg border border-border text-muted-foreground text-xs font-bold">
                                  {lang === "ar" ? "إلغاء" : "Cancel"}
                                </button>
                              </div>
                            </div>
                          ) : (
                          <button type="button" onClick={handleExtractFromSource}
                            disabled={!extractCredit || extractLoading || extractRequestedTotal > 30 || (extractSourceMode === "file" ? extractFiles.length === 0 : extractSourceText.trim().length < 5) || extractRequestedTotal === 0}
                            data-testid="btn-extract-source"
                            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {extractLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{lang === "ar" ? "جاري القراءة والتوليد..." : "Reading & generating..."}</> : <><Camera className="w-4 h-4" />{lang === "ar" ? "استخرج وأنشئ الأسئلة" : "Extract & create questions"}</>}
                          </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Paper mode */}
                  {isPaper ? (
                    <div className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-5">
                      <h2 className="text-base font-bold border-b border-border pb-3 flex items-center gap-2"><Star className="w-5 h-5 text-secondary" />{t.createAssignment.paperGrade}</h2>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300"><strong>{t.createAssignment.note}</strong> {t.createAssignment.paperNote}</div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t.createAssignment.totalGrade}</Label>
                        <input type="number" min="1" step="0.5" value={paperTotalPoints} onChange={e => setPaperTotalPoints(parseFloat(e.target.value) || 1)}
                          className="w-24 px-3 py-2 rounded-lg bg-secondary/10 border-2 border-secondary/30 text-center font-black text-xl text-secondary focus:outline-none focus:border-secondary transition-all" />
                        <span className="text-sm font-bold text-muted-foreground">{t.createAssignment.gradeUnit}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Question editor — only shown when method=manual OR real questions have arrived */}
                      {(questionMethod === "manual" || questions.some(q => q.text?.trim())) && (
                      <><DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
                        <SortableContext items={questions.map(q => q._clientId!)} strategy={verticalListSortingStrategy}>
                      <AnimatePresence>
                        {questions.map((q, qIndex) => (
                          <SortableQuestionWrapper key={q._clientId} id={q._clientId!}>
                            {({ attributes, listeners, isDragging }) => (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className={`bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 relative group transition-all ${isDragging ? "ring-4 ring-emerald-400/20 shadow-xl scale-[1.02]" : "hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}>
                              {/* Question header controls */}
                              <div className={`absolute top-3 ${lang === "ar" ? "left-3" : "right-3"} flex items-center gap-0.5`}>
                                {questions.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      {...attributes}
                                      {...listeners}
                                      title={lang === "ar" ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
                                      aria-label={lang === "ar" ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
                                      className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors cursor-grab active:cursor-grabbing touch-none"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleMoveQuestion(qIndex, "up")} disabled={qIndex === 0} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                    <button type="button" onClick={() => handleMoveQuestion(qIndex, "down")} disabled={qIndex === questions.length - 1} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4" /></button>
                                  </>
                                )}
                              </div>

                              <div className="mb-3">
                                {/* Type + Points */}
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <span className="text-[11px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">{t.createAssignment.questionLabel} {qIndex + 1}</span>
                                  <select value={isAdaptive && !isAdaptiveSupportedQuestionType(q.questionType) ? "unsupported" : q.questionType === "whiteboard" ? (q.optionA === "lined" ? "whiteboard" : "whiteboard_blank") : (q.questionType || "mcq")}
                                    onChange={e => {
                                    const v = e.target.value;
                                    if (v === "mcq" || v === "true_false" || v === "fill_blank" || v === "whiteboard" || v === "whiteboard_blank" || v === "dictation") handleQuestionTypeChange(qIndex, v);
                                  }}
                                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 text-[11px] font-bold focus:outline-none focus:border-emerald-400 transition-all text-slate-700 dark:text-slate-300 cursor-pointer shadow-sm">
                                    <option value="mcq">{t.createAssignment.questionTypeMcq}</option>
                                    <option value="true_false">{t.createAssignment.questionTypeTrueFalse}</option>
                                    <option value="fill_blank">{t.createAssignment.questionTypeFillBlank}</option>
                                    {isAdaptive && !isAdaptiveSupportedQuestionType(q.questionType) && <option value="unsupported" disabled>{lang === "ar" ? "نوع غير مدعوم — اختر نوعًا متاحًا" : "Unsupported type — choose an available type"}</option>}
                                    {!isAdaptive && <><option value="dictation">🎙 {lang === "ar" ? "إملاء صوتي" : "Dictation"}</option><option value="whiteboard_blank">{t.createAssignment.questionTypeWhiteboardBlank}</option><option value="whiteboard">{t.createAssignment.questionTypeWhiteboard}</option></>}
                                  </select>
                                  <div className="flex items-center gap-1.5 ml-auto rtl:mr-auto rtl:ml-0">
                                    <span className="text-[11px] font-bold text-slate-500">{t.createAssignment.gradeLabel}</span>
                                    <input type="number" min="0.5" step="0.5" value={q.points || 1} onChange={e => handleQuestionChange(qIndex, 'points', parseFloat(e.target.value) || 1)}
                                      className="w-16 px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-center text-[11px] font-black text-amber-700 dark:text-amber-400 focus:outline-none focus:border-amber-400 transition-all shadow-sm" />
                                  </div>
                                </div>

                                {/* Question text */}
                                <input required value={q.text} onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)} placeholder={t.createAssignment.questionPlaceholder} 
                                  className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all mb-2" />

                                {isAdaptive && (
                                  <div className="mb-2 grid grid-cols-1 gap-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/20 sm:grid-cols-[auto_1fr] sm:items-end">
                                    <div>
                                      <Label className="mb-1 block text-[11px] font-black text-violet-800 dark:text-violet-300">
                                        {lang === "ar" ? "مستوى السؤال" : "Question difficulty"}
                                      </Label>
                                      <div className="flex rounded-lg border border-violet-200 bg-white p-1 dark:border-violet-800 dark:bg-[#15201B]">
                                        {([
                                          { value: 1, ar: "سهل", en: "Easy" },
                                          { value: 2, ar: "متوسط", en: "Medium" },
                                          { value: 3, ar: "صعب", en: "Hard" },
                                        ] as const).map(option => (
                                          <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleQuestionChange(qIndex, "difficulty", option.value)}
                                            aria-pressed={(q.difficulty ?? 2) === option.value}
                                            className={`rounded-md px-3 py-1.5 text-[11px] font-black transition-colors ${(q.difficulty ?? 2) === option.value ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50 dark:hover:bg-violet-900/30"}`}
                                          >
                                            {lang === "ar" ? option.ar : option.en}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="mb-1 block text-[11px] font-black text-violet-800 dark:text-violet-300">
                                        {lang === "ar" ? "المهارة" : "Skill"}
                                      </Label>
                                      <select
                                        value={q.skill ?? ""}
                                        onChange={e => handleQuestionChange(qIndex, "skill", e.target.value)}
                                        className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-[#15201B]"
                                      >
                                        <option value="" disabled>{lang === "ar" ? "اختر مهارة (غير محددة)" : "Select a skill (not set)"}</option>
                                        {adaptiveSkills.map(skill => <option key={skill} value={skill} />)}
                                      </select>
                                    </div>
                                  </div>
                                )}

                                {/* Math toolbar (auto-open if math subject, or manually toggled) */}
                                {(isMathSubject || mathToolbarFor === qIndex) && (
                                  <MathPanel onInsert={sym => handleQuestionChange(qIndex, 'text', (q.text || "") + sym)} />
                                )}

                                {/* «أدوات السؤال» disclosure */}
                                <button type="button" data-testid={`btn-question-tools-${qIndex}`}
                                  onClick={() => toggleQuestionTools(q._clientId)}
                                  className={`mt-1.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border transition-colors ${toolsOpenFor.has(q._clientId!) ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800" : "text-slate-500 border-dashed border-slate-200 dark:border-slate-700 hover:text-emerald-600 hover:border-emerald-300"}`}>
                                  <Settings2 className="w-3 h-3" />{lang === "ar" ? "أدوات السؤال" : "Question tools"}
                                  <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpenFor.has(q._clientId!) ? "rotate-180" : ""}`} />
                                </button>

                                {/* Toolbar row (behind the disclosure) */}
                                {toolsOpenFor.has(q._clientId!) && (
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  {/* Image button — single button with inline picker */}
                                  {q.imageUrl ? (
                                    <div className="relative inline-block">
                                      <img src={resolveImageUrl(q.imageUrl) ?? ""} alt="" className="max-h-20 rounded border border-border object-contain" />
                                      <button type="button" onClick={() => handleQuestionChange(qIndex, 'imageUrl', null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <button type="button" onClick={() => setImagePickerFor(imagePickerFor === qIndex ? -1 : qIndex)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border border-dashed transition-colors ${imagePickerFor === qIndex ? "text-primary bg-primary/10 border-primary/50" : "text-muted-foreground hover:text-primary hover:bg-primary/10 border-border hover:border-primary/50"}`}>
                                        <Image className="w-3 h-3" />{lang === "ar" ? "صورة" : "Image"}
                                      </button>
                                      {imagePickerFor === qIndex && (
                                        <div className="absolute top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px]">
                                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
                                            <Upload className="w-4 h-4 text-primary" />{lang === "ar" ? "رفع من الجهاز" : "Upload from device"}
                                            <input type="file" accept="image/*" className="sr-only" onChange={async e => { const file = e.target.files?.[0]; if (file) { const b64 = await fileToBase64(file); handleQuestionChange(qIndex, 'imageUrl', b64); setImagePickerFor(-1); } e.target.value = ""; }} />
                                          </label>
                                          <button type="button" onClick={() => { const url = prompt(lang === "ar" ? "الصق رابط الصورة (URL):" : "Paste image URL:"); if (url?.trim()) { handleQuestionChange(qIndex, 'imageUrl', url.trim()); setImagePickerFor(-1); } }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                            🔗 {lang === "ar" ? "رابط URL" : "Paste URL"}
                                          </button>
                                          <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q.text || (lang === "ar" ? "صورة" : "image"))}`}
                                            target="_blank" rel="noopener noreferrer" onClick={() => setImagePickerFor(-1)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                            🔍 {lang === "ar" ? "بحث Google" : "Google Images"}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Math toggle (only if NOT already auto-opened) */}
                                  {!isMathSubject && (
                                    <button type="button" onClick={() => setMathToolbarFor(mathToolbarFor === qIndex ? -1 : qIndex)}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border border-dashed transition-colors ${mathToolbarFor === qIndex ? "text-primary bg-primary/10 border-primary/50" : "text-muted-foreground hover:text-primary hover:bg-primary/10 border-border hover:border-primary/40"}`}>
                                      Σ {lang === "ar" ? "رياضيات" : "Math"}
                                    </button>
                                  )}

                                  {/* Read aloud */}
                                  <button type="button" onClick={() => handleQuestionChange(qIndex, 'readAloud', !q.readAloud)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.readAloud ? "bg-primary/12 border-primary/45 text-primary" : "border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/8"}`}>
                                    🔊 {t.createAssignment.readAloud}
                                  </button>

                                  {/* Allow multiple answers (MCQ) */}
                                  {(q.questionType || "mcq") === "mcq" && (
                                    <button type="button" onClick={() => {
                                      const nextMulti = !q.allowMultipleAnswers;
                                      setQuestions(prev => prev.map((pq, pi) => {
                                        if (pi !== qIndex) return pq;
                                        if (nextMulti) {
                                          // Switching to multi — seed correctAnswers from existing single answer
                                          const seed = pq.correctAnswer && ["A","B","C","D"].includes(pq.correctAnswer) ? [pq.correctAnswer] : ["A"];
                                          return { ...pq, allowMultipleAnswers: true, correctAnswers: seed, correctAnswer: seed.join(",") };
                                        } else {
                                          // Switching to single — use first valid answer or "A"
                                          const cur = pq.correctAnswers || [];
                                          const first = cur.find(a => ["A","B","C","D"].includes(a)) || "A";
                                          return { ...pq, allowMultipleAnswers: false, correctAnswers: [first], correctAnswer: first };
                                        }
                                      }));
                                    }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.allowMultipleAnswers ? "bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-dashed border-border text-muted-foreground hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"}`}>
                                      ☑️ {t.createAssignment.multiAnswer}
                                    </button>
                                  )}

                                  {/* Repeat */}
                                  <button type="button" onClick={() => handleQuestionChange(qIndex, 'repeatQuestion', !q.repeatQuestion)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.repeatQuestion ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : "border-dashed border-border text-muted-foreground hover:text-orange-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/20"}`}>
                                    🔁 {t.createAssignment.repeat}
                                  </button>
                                </div>
                                )}
                              </div>

                              {/* MCQ options */}
                              {(q.questionType || "mcq") === "mcq" && (
                                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                  {(["A", "B", "C", "D"] as const).map(opt => {
                                    const isCorrect = q.allowMultipleAnswers
                                      ? (q.correctAnswers || []).includes(opt)
                                      : q.correctAnswer === opt;
                                    const toggleCorrect = () => {
                                      if (q.allowMultipleAnswers) {
                                        const cur: string[] = q.correctAnswers || [];
                                        const next: string[] = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
                                        setQuestions(prev => prev.map((pq, pi) =>
                                          pi === qIndex ? { ...pq, correctAnswers: next, correctAnswer: next.join(",") } : pq
                                        ));
                                      } else {
                                        setQuestions(prev => prev.map((pq, pi) =>
                                          pi === qIndex ? { ...pq, correctAnswer: opt, correctAnswers: [opt] } : pq
                                        ));
                                      }
                                    };
                                    return (
                                      <div key={opt} className="flex items-center gap-2">
                                        <button type="button" onClick={toggleCorrect}
                                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all shrink-0 ${isCorrect ? "bg-green-500 border-green-500 text-white" : "border-border text-muted-foreground hover:border-green-400 hover:bg-green-50/50"}`}>
                                          {opt}
                                        </button>
                                        <div className="flex-1 relative">
                                          <input value={q[MCQ_OPT[opt]] || ""} onChange={e => handleQuestionChange(qIndex, MCQ_OPT[opt], e.target.value)}
                                            placeholder={`${t.createAssignment.option} ${opt}`} className="text-sm pe-8" />
                                          {/* Math for option if math subject */}
                                          {isMathSubject && (
                                            <button type="button"
                                              onClick={() => setMathOptionFor(mathOptionFor?.qIdx === qIndex && mathOptionFor?.opt === opt ? null : { qIdx: qIndex, opt })}
                                              className="absolute end-2 top-1/2 -translate-y-1/2 text-purple-500 text-xs font-bold opacity-60 hover:opacity-100">Σ</button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Math panel for option */}
                                  {isMathSubject && mathOptionFor?.qIdx === qIndex && (
                                    <MathPanel onInsert={sym => {
                                      const optKey = MCQ_OPT[mathOptionFor.opt as keyof typeof MCQ_OPT];
                                      if (optKey) {
                                        const cur = q[optKey] || "";
                                        handleQuestionChange(qIndex, optKey, cur + sym);
                                      }
                                    }} />
                                  )}
                                </div>
                              )}

                              {/* True/False */}
                              {q.questionType === "true_false" && (
                                <div className="flex gap-2">
                                  {[["true", lang === "ar" ? "✅ صح" : "✅ True"], ["false", lang === "ar" ? "❌ خطأ" : "❌ False"]].map(([val, label]) => (
                                    <button key={val} type="button" onClick={() => handleQuestionChange(qIndex, 'correctAnswer', val)}
                                      className={`flex-1 py-4 rounded-2xl text-base font-black border-2 transition-all active:scale-[0.98] ${q.correctAnswer === val ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-[#f4f7f5] dark:bg-[#0B100E] text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10"}`}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Fill blank */}
                              {q.questionType === "fill_blank" && (
                                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                  <Label className="text-xs mb-1 block">{t.createAssignment.fillBlankAnswer}</Label>
                                  <div className="flex gap-2">
                                    <input required value={q.correctAnswer?.split("|")[0] || ""}
                                      onChange={e => { const parts = (q.correctAnswer || "").split("|"); parts[0] = e.target.value; handleQuestionChange(qIndex, 'correctAnswer', parts.filter(Boolean).join("|")); }}
                                      placeholder={t.createAssignment.fillBlankPlaceholder} className="text-sm flex-1" />
                                  </div>
                                  {(q.correctAnswer || "").split("|").slice(1).map((alt: string, altIdx: number) => (
                                    <div key={altIdx} className="flex gap-2 items-center">
                                      <span className="text-xs text-muted-foreground shrink-0">{lang === "ar" ? "أو:" : "or:"}</span>
                                      <input value={alt}
                                        onChange={e => { const parts = (q.correctAnswer || "").split("|"); parts[altIdx + 1] = e.target.value; handleQuestionChange(qIndex, 'correctAnswer', parts.filter((_, i) => i === 0 || Boolean(parts[i])).join("|")); }}
                                        placeholder={lang === "ar" ? "إجابة بديلة مقبولة" : "Alternative accepted answer"} className="text-sm flex-1" />
                                      <button type="button" onClick={() => { const parts = (q.correctAnswer || "").split("|"); parts.splice(altIdx + 1, 1); handleQuestionChange(qIndex, 'correctAnswer', parts.join("|")); }}
                                        className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => { const cur = q.correctAnswer || ""; handleQuestionChange(qIndex, 'correctAnswer', cur ? cur + "|" : "|"); }}
                                    className="text-xs text-primary/70 hover:text-primary flex items-center gap-1">
                                    <Plus className="w-3 h-3" />{lang === "ar" ? "أضف إجابة بديلة" : "Add alternative answer"}
                                  </button>
                                  {isMathSubject && (
                                    <MathPanel onInsert={sym => { const parts = (q.correctAnswer || "").split("|"); parts[0] = (parts[0] || "") + sym; handleQuestionChange(qIndex, 'correctAnswer', parts.join("|")); }} />
                                  )}
                                  <p className="text-[10px] text-muted-foreground/60">{lang === "ar" ? "ستُقبل أي من هذه الإجابات (غير حساسة للأحرف)" : "Any of these answers will be accepted (case-insensitive)"}</p>
                                </div>
                              )}

                              {/* Dictation question */}
                              {q.questionType === "dictation" && (
                                <DictationQuestionEditor
                                  text={q.optionA || ""}
                                  maxListens={parseInt(q.optionB || "3") || 3}
                                  allowErrors={q.optionC !== "false"}
                                  lang={lang}
                                  onTextChange={v => {
                                    handleQuestionChange(qIndex, "optionA", v);
                                    handleQuestionChange(qIndex, "correctAnswer", v);
                                  }}
                                  onMaxListensChange={v => handleQuestionChange(qIndex, "optionB", String(v))}
                                  onAllowErrorsChange={v => handleQuestionChange(qIndex, "optionC", v ? "true" : "false")}
                                />
                              )}

                              {q.questionType === "whiteboard" && (
                                <div className="bg-muted/30 p-2 rounded-lg">
                                  <span className="text-[11px] text-muted-foreground">{q.optionA === "lined" ? `📝 ${t.createAssignment.whiteboardLined}` : `🎨 ${t.createAssignment.whiteboardBlank}`}</span>
                                </div>
                              )}

                              {/* Bottom card actions: تكرار / حذف */}
                              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1.5">
                                <button type="button" data-testid={`btn-duplicate-question-${qIndex}`} onClick={() => handleDuplicateQuestion(qIndex)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                                  <Copy className="w-3.5 h-3.5" />{lang === "ar" ? "تكرار" : "Duplicate"}
                                </button>
                                {questions.length > 1 && (
                                  <button type="button" data-testid={`btn-delete-question-${qIndex}`} onClick={() => handleRemoveQuestion(qIndex)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />{lang === "ar" ? "حذف" : "Delete"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                            )}
                          </SortableQuestionWrapper>
                        ))}
                      </AnimatePresence>
                        </SortableContext>
                      </DndContext>

                      <div className="flex gap-2">
                        <button type="button" onClick={handleAddQuestion} className="flex-1 flex justify-center items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-[#f4f7f5] dark:bg-[#0B100E] hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-sm transition-all active:scale-[0.98]">
                          <Plus className="w-5 h-5" />{t.createAssignment.addQuestion}
                        </button>
                        <button type="button" onClick={openBankModal} className="flex-1 flex justify-center items-center gap-2 py-4 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/50 bg-[#f4f7f5] dark:bg-[#0B100E] hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-black text-sm transition-all active:scale-[0.98]">
                          <Database className="w-5 h-5" />{t.questionBank.selectQuestions}
                        </button>
                      </div>
                      </>)}

                      {/* «طريقة أخرى لإضافة الأسئلة» — demoted alternative methods */}
                      <div data-testid="section-other-methods">
                        <button type="button" onClick={() => setShowOtherMethods(v => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors">
                          <span className="text-[12px] font-black text-slate-600 dark:text-slate-300">{lang === "ar" ? "طريقة أخرى لإضافة الأسئلة" : "Another way to add questions"}</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showOtherMethods ? "rotate-180" : ""}`} />
                        </button>
                        {showOtherMethods && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
                            {/* يدوي — يغلق الأدوات الأخرى ويُبرز المحرر */}
                            {(showAiPanel || showImageExtract) && (
                              <button type="button" onClick={() => { setShowAiPanel(false); setShowImageExtract(false); setAiError(""); setExtractError(""); setExtractFiles([]); pendingExtractFpRef.current = null; setShowOtherMethods(false); }}
                                className="flex items-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 text-start transition-all">
                                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="block text-[13px] font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "إضافة يدوية" : "Write them myself"}</span>
                                  <span className="block text-[10px] font-bold text-slate-500 truncate">{lang === "ar" ? "أضف الأسئلة والخيارات بنفسك" : "Add questions one by one"}</span>
                                </div>
                              </button>
                            )}
                            {!showAiPanel && (
                              <button type="button" onClick={() => setShowAiPanel(true)}
                                className="flex items-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 text-start transition-all">
                                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="block text-[13px] font-black text-slate-800 dark:text-slate-100">{t.createAssignment.aiGenerate}</span>
                                  <span className="block text-[10px] font-bold text-slate-500 truncate">{t.createAssignment.aiGenerateDesc}</span>
                                </div>
                              </button>
                            )}
                            {!showImageExtract && (
                              <button type="button" data-testid="btn-open-extract-panel" onClick={openImageExtractPanel}
                                className="flex items-center gap-2.5 p-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 text-start transition-all">
                                <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="block text-[13px] font-black text-slate-800 dark:text-slate-100">{lang === "ar" ? "استخرج أسئلة من صور أو مستند" : "Extract questions from images or a document"}</span>
                                  <span className="block text-[10px] font-bold text-slate-500 truncate">
                                    {lang === "ar" ? "ارفع صوراً أو PDF أو Word أو PowerPoint" : "Upload images, PDF, Word or PowerPoint"}
                                  </span>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Grading Instructions — only when paper submission OR fill_blank/whiteboard questions exist */}
                  {!isAdaptive && (submissionMode === "paper" || submissionMode === "both" || questions.some(q => q.questionType === "fill_blank" || q.questionType === "whiteboard")) && (
                    <div className="rounded-3xl p-5 sm:p-6 shadow-sm border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                      <div className="flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-amber-600" /><h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">{t.createAssignment.aiGradingInstructions}</h2></div>
                      <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-2">{t.createAssignment.aiGradingInstructionsDesc}</p>
                      <textarea value={aiGradingInstructions} onChange={e => setAiGradingInstructions(e.target.value)} placeholder={t.createAssignment.aiGradingInstructionsPlaceholder}
                        className="w-full px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-white/50 dark:bg-black/20 text-sm font-bold resize-none focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-colors placeholder:text-amber-700/40 dark:placeholder:text-amber-300/40" rows={2} />
                    </div>
                  )}
                  </>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════ STEP 3 — معاينة ونشر ══════════════════════════════════ */}
              {wizardStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-3.5">
                  <h2 className="text-lg font-black text-foreground">{lang === "ar" ? "مراجعة قبل النشر" : "Review before publishing"}</h2>

                  {/* Summary card */}
                  <div className="p-4 bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0"
                        style={{ backgroundColor: COLOR_THEMES.find(c => c.id === colorTheme)?.light, color: COLOR_THEMES.find(c => c.id === colorTheme)?.bg }}>
                        📋
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-foreground truncate">{title || (lang === "ar" ? "بدون عنوان" : "Untitled")}</p>
                        {subject && <p className="text-sm text-muted-foreground">{subject}</p>}
                        {targetClasses.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{targetClasses.join("، ")}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{questions.length} {lang === "ar" ? "سؤال" : "questions"}</span>
                          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500" />{totalPoints} {lang === "ar" ? "درجة" : "pts"}</span>
                          <span className="flex items-center gap-1">
                            {submissionMode === "electronic" ? <Monitor className="w-3.5 h-3.5" /> : submissionMode === "paper" ? <FileText className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                            {submissionMode === "electronic" ? t.createAssignment.electronic : submissionMode === "paper" ? t.createAssignment.paper : t.createAssignment.electronicAndPaperShort}
                          </span>
                          {deadline && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{deadline.replace("T", " ")}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary actions: preview / advanced settings */}
                  <div className={`grid gap-2 ${isAdaptive ? "grid-cols-1" : "grid-cols-2"}`}>
                    <button type="button" data-testid="btn-student-preview" onClick={() => setShowStudentPreview(true)}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-300 text-sm font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98]">
                      <Eye className="w-4 h-4" />{lang === "ar" ? "معاينة" : "Preview"}
                    </button>
                    {!isAdaptive && <button type="button" data-testid="btn-advanced-settings" onClick={() => setShowAdvancedSettings(v => !v)}
                      aria-expanded={showAdvancedSettings}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-300 text-sm font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98]">
                      <Settings2 className="w-4 h-4" />{lang === "ar" ? "إعدادات متقدمة" : "Advanced settings"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
                    </button>}
                  </div>

                  {/* Student preview modal */}
                  <AnimatePresence>
                  {showStudentPreview && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowStudentPreview(false)}>
                    <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
                      className="bg-card rounded-2xl p-5 max-w-lg w-full shadow-2xl border border-border max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-black text-foreground flex items-center gap-2"><Eye className="w-4 h-4" />{lang === "ar" ? "عرض النشاط كما يراه المشارك" : "Student view"}</h3>
                        <button type="button" onClick={() => setShowStudentPreview(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                      </div>
                    <div className="space-y-3 overflow-y-auto pr-1 min-h-0">
                      {questions.map((q, i) => (
                        <div key={i} className="rounded-xl border-2 border-border p-4 bg-background">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground leading-snug">{q.text || <span className="text-muted-foreground/50">{lang === "ar" ? "نص السؤال..." : "Question text..."}</span>}</p>
                              {q.imageUrl && <img src={resolveImageUrl(q.imageUrl) ?? ""} alt="" className="mt-2 max-h-36 rounded-lg border border-border object-contain" />}
                            </div>
                            <span className="text-xs font-bold text-secondary shrink-0">{q.points || 1} {lang === "ar" ? "د" : "pt"}</span>
                          </div>
                          {(q.questionType === "mcq" || !q.questionType) && (
                            <div className="grid grid-cols-2 gap-2">
                              {(["A", "B", "C", "D"] as const).map(opt => {
                                const text = q[MCQ_OPT[opt]];
                                if (!text) return null;
                                const isCorrect = q.correctAnswer === opt || (q.correctAnswers || []).includes(opt);
                                return (
                                  <div key={opt} className={`px-3 py-2 rounded-lg text-sm font-medium border-2 ${isCorrect ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border bg-muted/20 text-foreground"}`}>
                                    <span className="font-bold text-xs text-muted-foreground mr-1">{opt}.</span>{text}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {q.questionType === "true_false" && (
                            <div className="flex gap-2">
                              {[["true", lang === "ar" ? "صح" : "True"], ["false", lang === "ar" ? "خطأ" : "False"]].map(([val, label]) => (
                                <div key={val} className={`flex-1 py-2 rounded-lg text-center text-sm font-bold border-2 ${q.correctAnswer === val ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border bg-muted/20 text-muted-foreground"}`}>{label}</div>
                              ))}
                            </div>
                          )}
                          {q.questionType === "fill_blank" && (
                            <div>
                              <div className="px-3 py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground">{lang === "ar" ? "[ اكتب إجابتك هنا ]" : "[ Type your answer here ]"}</div>
                              {q.correctAnswer && <p className="text-xs text-green-600 mt-1 font-medium">{lang === "ar" ? "الإجابة: " : "Answer: "}{q.correctAnswer.split("|").join(" / ")}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    </motion.div>
                  </motion.div>
                  )}
                  </AnimatePresence>

                  {/* Advanced settings (collapsible) */}
                  <div className="p-0 overflow-hidden">
                    <AnimatePresence>
                      {showAdvancedSettings && !isAdaptive && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-border divide-y divide-border/50">

                            {/* ── 1. التسليم والوصول ── */}
                            <div className="px-5 py-4 space-y-4">
                              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" />
                                {lang === "ar" ? "التسليم والوصول" : "Submission & Access"}
                              </p>
                              {/* Submission mode */}
                              <div>
                                <span className="text-xs font-bold text-foreground">{t.createAssignment.submissionMethod}</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {[
                                    { value: "electronic" as SubmissionMode, label: t.createAssignment.electronicOnly, icon: <Monitor className="w-3.5 h-3.5" /> },
                                    { value: "paper" as SubmissionMode, label: t.createAssignment.paperOnly, icon: <FileText className="w-3.5 h-3.5" /> },
                                    { value: "both" as SubmissionMode, label: t.createAssignment.electronicAndPaper, icon: <Layers className="w-3.5 h-3.5" /> },
                                  ].map(opt => (
                                    <button key={opt.value} type="button" onClick={() => handleModeChange(opt.value)}
                                      className={`px-3 py-2 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 transition-all ${submissionMode === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                      {opt.icon}{opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Access mode */}
                              <div>
                                <span className="text-xs font-bold text-foreground">{t.createAssignment.accessMode}</span>
                                <div className="flex gap-2 mt-2">
                                  <button type="button" onClick={() => setAccessMode("public")}
                                    className={`flex-1 px-3 py-2 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${accessMode === "public" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                    <Globe className="w-3.5 h-3.5" />{t.createAssignment.public}
                                  </button>
                                  <button type="button" onClick={() => { setAccessMode("private"); setIsShared(false); }}
                                    className={`flex-1 px-3 py-2 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${accessMode === "private" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                    <Lock className="w-3.5 h-3.5" />{t.createAssignment.privateCode}
                                  </button>
                                </div>
                                <AnimatePresence>
                                  {accessMode === "private" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                      <div className="mt-2">
                                        <Label className="text-sm">{t.createAssignment.accessCodeLabel}</Label>
                                        <div className="flex items-center gap-2 mt-1">
                                          <input value={accessCode} onChange={e => setAccessCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="font-mono tracking-widest text-center" dir="ltr" />
                                          <button type="button" onClick={() => navigator.clipboard.writeText(accessCode)} className="p-2 rounded-lg border border-border hover:bg-primary/10 transition-all" title={t.createAssignment.copyCode}><Copy className="w-4 h-4" /></button>
                                          <button type="button" onClick={() => setAccessCode(generateAccessCode())} className="p-2 rounded-lg border border-border hover:bg-primary/10 transition-all text-xs whitespace-nowrap">{t.createAssignment.newCode}</button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              {/* Deadline */}
                              <div>
                                <span className="text-xs font-bold text-foreground">{t.createAssignment.deadlineLabel}</span>
                                <div className="mt-2">
                                  {deadline ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-foreground bg-muted px-3 py-1.5 rounded-lg flex-1" dir="ltr">{deadline.replace("T", " ")}</span>
                                      <button type="button" onClick={() => { setDeadlineDraft(deadline); setShowDatePicker(true); }} className="px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10">{lang === "ar" ? "تعديل" : "Edit"}</button>
                                      <button type="button" onClick={() => setDeadline("")} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ) : (
                                    <button type="button" onClick={() => { setDeadlineDraft(""); setShowDatePicker(true); }}
                                      className="px-4 py-2 rounded-xl border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-all">
                                      {lang === "ar" ? "+ تحديد موعد التسليم" : "+ Set submission deadline"}
                                    </button>
                                  )}
                                  <AnimatePresence>
                                    {showDatePicker && (
                                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                        <div className="mt-2 bg-muted/40 rounded-lg p-3 space-y-2">
                                          <input type="datetime-local" value={deadlineDraft} onChange={e => setDeadlineDraft(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary" dir="ltr" />
                                          <div className="flex gap-2 justify-end">
                                            <button type="button" onClick={() => setShowDatePicker(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                                            <button type="button" onClick={() => { setDeadline(deadlineDraft); setShowDatePicker(false); }} className="px-4 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">{lang === "ar" ? "تم" : "OK"}</button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            </div>

                            {/* ── 2. النتائج والمحاولات ── */}
                            <div className="px-5 py-4">
                              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                                <Eye className="w-3.5 h-3.5" />
                                {lang === "ar" ? "النتائج والمحاولات" : "Results & Attempts"}
                              </p>
                              <div className="divide-y divide-border/40">
                                <div className="flex items-center justify-between py-2.5 first:pt-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {showResults ? <Eye className="w-4 h-4 text-green-500 shrink-0" /> : <EyeOff className="w-4 h-4 text-amber-500 shrink-0" />}
                                    <div>
                                      <span className="text-sm font-bold block">{t.createAssignment.showResults}</span>
                                      <span className="text-[11px] text-muted-foreground">{showResults ? t.createAssignment.showResultsOn : t.createAssignment.showResultsOff}</span>
                                    </div>
                                  </div>
                                  <Toggle on={showResults} onChange={() => setShowResults(!showResults)} color="green" />
                                </div>
                                <div className={`py-2.5 transition-opacity ${!showResults ? "opacity-40 pointer-events-none select-none" : ""}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs font-bold">{t.createAssignment.resultsRelease}</span>
                                  </div>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {[
                                      { v: "immediate", label: lang === "ar" ? "فوري" : "Immediate" },
                                      { v: "after_deadline", label: lang === "ar" ? "بعد الموعد" : "After Deadline" },
                                      { v: "manual", label: lang === "ar" ? "يدوي" : "Manual" },
                                    ].map(({ v, label }) => (
                                      <button key={v} type="button"
                                        onClick={() => { if (v === "immediate" || v === "after_deadline" || v === "manual") setResultsReleaseMode(v); }}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${resultsReleaseMode === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between py-2.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <RotateCcw className={`w-4 h-4 shrink-0 ${allowRetry ? "text-primary" : "text-muted-foreground"}`} />
                                    <div>
                                      <span className="text-sm font-bold block">{lang === "ar" ? "السماح بإعادة المحاولة" : "Allow Retry"}</span>
                                      <span className="text-[11px] text-muted-foreground">{allowRetry ? (lang === "ar" ? "يمكن للطلاب إعادة الواجب" : "Students can retake") : (lang === "ar" ? "محاولة واحدة فقط" : "One attempt only")}</span>
                                    </div>
                                  </div>
                                  <Toggle on={allowRetry} onChange={() => setAllowRetry(!allowRetry)} color="green" />
                                </div>
                              </div>
                            </div>

                            {/* ── 3. خيارات النشاط ── */}
                            <div className="px-5 py-4">
                              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                                <Settings2 className="w-3.5 h-3.5" />
                                {lang === "ar" ? "خيارات النشاط" : "Activity Options"}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {!isPaper && (
                                  <div className="p-3 rounded-xl bg-muted/30">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-1.5 min-w-0">
                                        <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${examMode ? "text-orange-500" : "text-muted-foreground"}`} />
                                        <div>
                                          <span className="text-sm font-bold block leading-tight">{t.createAssignment.examMode}</span>
                                          <span className="text-[11px] text-muted-foreground">{t.createAssignment.examModeDesc}</span>
                                        </div>
                                      </div>
                                      <Toggle on={examMode} onChange={() => setExamMode(!examMode)} color="orange" />
                                    </div>
                                    <AnimatePresence>
                                      {examMode && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                          <div className="pt-2 mt-2 border-t border-border/40">
                                            <Label className="text-xs">{t.createAssignment.examDuration}</Label>
                                            <input type="number" min="1" max="300" value={examDurationMinutes} onChange={e => setExamDurationMinutes(parseInt(e.target.value) || 30)}
                                              className="w-28 px-3 py-1.5 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary mt-1" dir="ltr" />
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── 4. المشاركة ── */}
                            {accessMode !== "private" && (
                              <div className="px-5 py-4">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                                  <Globe className="w-3.5 h-3.5" />
                                  {lang === "ar" ? "المشاركة" : "Sharing"}
                                </p>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {isShared ? <Globe className="w-4 h-4 text-primary shrink-0" /> : <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
                                    <div className="min-w-0">
                                      <span className="text-sm font-bold block">{lang === "ar" ? (isShared ? "منشور في المكتبة" : "خاص بك") : (isShared ? "Published in Library" : "Private")}</span>
                                      <span className="text-[11px] text-muted-foreground">{isShared ? (lang === "ar" ? "المعلمون الآخرون يمكنهم استيراده" : "Other teachers can import it") : (lang === "ar" ? "لن يراه أي معلم آخر" : "Not visible to other teachers")}</span>
                                    </div>
                                  </div>
                                  <Toggle on={isShared} onChange={() => setIsShared(!isShared)} color="green" />
                                </div>
                              </div>
                            )}

                            {/* ── لون الواجب ── */}
                            <div className="px-5 py-4 space-y-3">
                              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5" />
                                {lang === "ar" ? "لون الواجب" : "Assignment Color"}
                              </p>
                              <div className="flex gap-3 flex-wrap">
                                {COLOR_THEMES.map(ct => (
                                  <button key={ct.id} type="button" onClick={() => setColorTheme(ct.id)}
                                    className={`flex flex-col items-center gap-1.5 transition-all ${colorTheme === ct.id ? "scale-110" : "hover:scale-105 opacity-70 hover:opacity-100"}`}>
                                    <div className={`w-9 h-9 rounded-xl border-4 transition-all ${colorTheme === ct.id ? "border-foreground shadow-lg" : "border-transparent"}`}
                                      style={{ backgroundColor: ct.bg }} />
                                    <span className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? ct.label : ct.labelEn}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* ── التصنيف ── */}
                            {availableCategories.length > 0 && (
                              <div className="px-5 py-4 space-y-3">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                  <Tag className="w-3.5 h-3.5" />
                                  {lang === "ar" ? "التصنيف" : "Category"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => setCategoryId(null)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${!categoryId ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                                    {lang === "ar" ? "بدون" : "None"}
                                  </button>
                                  {availableCategories.map((cat: any) => {
                                    const colorMap: Record<string, string> = { teal: HASAD_GREEN, blue: "#3b82f6", violet: "#8b5cf6", green: HASAD_GREEN, orange: "#f97316", red: "#ef4444", yellow: "#eab308", pink: "#ec4899", indigo: "#6366f1", rose: "#f43f5e" };
                                    return (
                                      <button key={cat.id} type="button" onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${categoryId === cat.id ? "bg-foreground text-background border-foreground" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[cat.color] || HASAD_GREEN }} />{cat.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* ── نموذج إجابة ورقية ── */}
                            {(submissionMode === "paper" || submissionMode === "both") && (
                              <div className="px-5 py-4 space-y-3">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                  <Image className="w-3.5 h-3.5" />
                                  {t.createAssignment.modelAnswer}
                                </p>
                                <p className="text-muted-foreground text-xs">{t.createAssignment.modelAnswerDesc}</p>
                                <input type="file" accept="image/*" className="hidden" ref={modelImageRef} onChange={handleModelImageUpload} />
                                {modelImage ? (
                                  <div className="relative rounded-lg overflow-hidden border border-primary/30">
                                    <img src={modelImage} alt="" className="w-full max-h-[150px] object-contain bg-black/5" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 justify-between">
                                      <span className="text-white text-xs font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" />{t.createAssignment.modelUploaded}</span>
                                      <div className="flex gap-1">
                                        <button type="button" onClick={() => modelImageRef.current?.click()} className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-white text-[11px] font-bold hover:bg-white/30">{t.createAssignment.change}</button>
                                        <button type="button" onClick={() => setModelImage(null)} className="p-0.5 bg-red-500/80 backdrop-blur-md rounded text-white hover:bg-red-500"><X className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => modelImageRef.current?.click()} className="w-full py-4 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex flex-col items-center gap-1.5">
                                    <Image className="w-6 h-6 opacity-50" />
                                    <span className="text-xs font-bold">{t.createAssignment.uploadModel}</span>
                                    <span className="text-[10px] opacity-70">{t.createAssignment.imageFormats}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* ── الوصف ── */}
                            <div className="px-5 py-4 space-y-2">
                              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                {t.createAssignment.descriptionLabel}
                              </p>
                              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.createAssignment.descriptionPlaceholder}
                                className="w-full px-3 py-2 rounded-lg bg-background border-2 border-border text-sm resize-none focus:outline-none focus:border-primary transition-all min-h-[70px]" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>


                  {/* «بصمتك في مكتبة حصاد» — combined optional card: sharing toggle
                      + library destination (moved here from step 1). Last option
                      before publish; nothing here is required. Hidden when the
                      assignment is access-private (cannot be shared). */}
                  {accessMode !== "private" && (
                    <div className="bg-white dark:bg-[#15201B] rounded-3xl p-3.5 sm:p-4 shadow-sm border border-emerald-50 dark:border-emerald-900/30 space-y-3" data-testid="card-library-sharing">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                            {isShared ? <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-400" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 leading-tight">
                              {isShared
                                ? (lang === "ar" ? "سيُشارك هذا النشاط في مكتبة حصاد" : "This activity will be shared in the Hasad library")
                                : (lang === "ar" ? "هذا النشاط خاص بك" : "This activity is private to you")}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                              {isShared
                                ? (lang === "ar" ? "زملاؤك المعلمون يستطيعون استيراده مباشرة (اختياري)" : "Other teachers can import it directly (optional)")
                                : (lang === "ar" ? "لن يظهر لأي معلم آخر" : "It won't appear to any other teacher")}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid="btn-toggle-shared"
                          onClick={() => {
                            const next = !isShared;
                            setIsShared(next);
                            toast.success(next
                              ? (lang === "ar" ? "سيُشارك مع المعلمين" : "Will be shared with teachers")
                              : (lang === "ar" ? "تم جعله خاصًا" : "Made private"));
                          }}
                          className={`shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border-2 transition-all ${isShared ? "border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "border-emerald-500/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`}
                        >
                          {isShared
                            ? (lang === "ar" ? "اجعله خاصاً" : "Make it private")
                            : (lang === "ar" ? "مشاركته في مكتبة حصاد" : "Share it in the Hasad library")}
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {isShared && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pt-1">
                              <p className="text-[11px] font-bold text-slate-500 mb-2">
                                {lang === "ar" ? "أين يستقر في المكتبة العامة؟" : "Where does it land in the public library?"}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  data-testid="btn-library-activities"
                                  onClick={() => setIsContestMode(false)}
                                  className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-start transition-all ${!isContestMode ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/50"}`}
                                >
                                  <FileText className={`w-5 h-5 shrink-0 ${!isContestMode ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
                                  <div className="min-w-0">
                                    <div className={`text-[13px] font-black leading-tight ${!isContestMode ? "text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>{lang === "ar" ? "مكتبة الأنشطة" : "Activities Library"}</div>
                                    <div className="text-[10px] font-bold mt-0.5 text-slate-500 truncate">{lang === "ar" ? "واجب أو اختبار" : "Homework or exam"}</div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  data-testid="btn-library-competitions"
                                  onClick={() => setIsContestMode(true)}
                                  className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-start transition-all ${isContestMode ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/20" : "border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800/50"}`}
                                >
                                  <Star className={`w-5 h-5 shrink-0 ${isContestMode ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} />
                                  <div className="min-w-0">
                                    <div className={`text-[13px] font-black leading-tight ${isContestMode ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>{lang === "ar" ? "مكتبة المسابقات" : "Competitions Library"}</div>
                                    <div className="text-[10px] font-bold mt-0.5 text-slate-500 truncate">{lang === "ar" ? "أسئلة مسابقة جاهزة" : "Ready contest questions"}</div>
                                  </div>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {createMutation.isError && (
                    <p className="text-sm text-destructive text-center">{(createMutation.error as Error)?.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ══ Sticky Navigation ══ */}
            {wizardStep > 1 && <div className="sticky bottom-4 z-20 mt-6 px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {(wizardStep === 2 && !canLeaveStep2) || (wizardStep === 3 && publishBlock) ? (
                <p className="text-center text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1.5" data-testid="text-nav-block-reason">
                  {wizardStep === 2 ? blockMessages.no_question : publishBlock ? blockMessages[publishBlock] : ""}
                </p>
              ) : null}
              <div className="bg-white/90 dark:bg-[#15201B]/90 backdrop-blur-xl border border-emerald-100/50 dark:border-emerald-900/30 rounded-3xl shadow-lg shadow-emerald-900/5 p-3 flex items-center justify-between gap-3">
                <button type="button" onClick={goPrev} disabled={wizardStep === 1}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <BackArrowIcon className="w-5 h-5" />
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>

                <div className="hidden sm:flex items-center gap-1.5">
                  {STEPS.map(step => (
                    <div key={step.num} className={`h-1.5 rounded-full transition-all duration-300 ${wizardStep === step.num ? "w-8 bg-emerald-500" : wizardStep > step.num ? "w-4 bg-emerald-200 dark:bg-emerald-800" : "w-4 bg-slate-100 dark:bg-slate-800"}`} />
                  ))}
                </div>

                {wizardStep < 3 ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={goNext}
                      disabled={(wizardStep === 1 && !title.trim()) || (wizardStep === 2 && !canLeaveStep2)}
                      data-testid="btn-wizard-next"
                      className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="truncate max-w-[46vw]">
                        {wizardStep === 1
                          ? (lang === "ar" ? "التالي: إضافة الأسئلة" : "Next: Add Questions")
                          : (lang === "ar" ? "التالي: المراجعة والنشر" : "Next: Review & Publish")}
                      </span>
                      {lang === "ar" ? <ArrowLeft className="w-5 h-5 shrink-0" /> : <ArrowRight className="w-5 h-5 shrink-0" />}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={handlePublish} disabled={createMutation.isPending || !!publishBlock}
                    data-testid="btn-publish-activity"
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]">
                    {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {lang === "ar" ? "نشر النشاط" : "Publish Activity"}
                  </button>
                )}
              </div>
            </div>}
      </main>
      )}

      {/* ══ Draft Prompt Modal ══ */}
      <AnimatePresence>
        {draftPromptOpen && draftSnapshot && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">📝</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-foreground leading-snug">{t.createAssignment.draftFoundTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{(() => {
                    const ms = Date.now() - (draftSnapshot.savedAt || Date.now());
                    const mins = Math.floor(ms / 60000);
                    const hrs = Math.floor(mins / 60);
                    const days = Math.floor(hrs / 24);
                    if (days >= 1) return t.createAssignment.draftSavedDaysAgo.replace("{n}", String(days));
                    if (hrs >= 1) return t.createAssignment.draftSavedHoursAgo.replace("{n}", String(hrs));
                    if (mins >= 1) return t.createAssignment.draftSavedMinutesAgo.replace("{n}", String(mins));
                    return t.createAssignment.draftSavedJustNow;
                  })()}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t.createAssignment.draftFoundDesc}</p>
              <div className="rounded-xl border border-border bg-muted/30 p-3 mb-5 space-y-1">
                <p className="text-sm font-bold text-foreground truncate">
                  {draftSnapshot.title?.trim() || (lang === "ar" ? "بدون عنوان" : "Untitled")}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  {draftSnapshot.subject?.trim() && <span>{draftSnapshot.subject}</span>}
                  <span>{draftSnapshot.questions?.length || 0} {lang === "ar" ? "سؤال" : "questions"}</span>
                  <span>{lang === "ar" ? "الخطوة" : "Step"} {Math.min(draftSnapshot.wizardStep, 3)}/3</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleStartFresh}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
                  {t.createAssignment.startFresh}
                </button>
                <button type="button" onClick={handleContinueDraft}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {t.createAssignment.continueDraft}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Bank Modal ══ */}
      <AnimatePresence>
        {showBankModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowBankModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-border max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-black text-foreground mb-2 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-600" />{t.questionBank.selectQuestions}</h3>
              <p className="text-sm text-muted-foreground mb-4">{bankSelected.size} {t.questionBank.selectedCount}</p>
              {(() => {
                const subjects = [...new Set(bankQuestions.map((q: any) => q.subject))];
                return subjects.length > 1 ? (
                  <select value={bankFilterSubject} onChange={e => setBankFilterSubject(e.target.value)} className="mb-3 px-3 py-2 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary text-sm">
                    <option value="">{t.questionBank.allSubjects}</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : null;
              })()}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {bankLoading ? (
                  <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : bankQuestions.filter((q: any) => !bankFilterSubject || q.subject === bankFilterSubject).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{t.questionBank.noQuestions}</div>
                ) : (
                  bankQuestions.filter((q: any) => !bankFilterSubject || q.subject === bankFilterSubject).map((q: any) => (
                    <button key={q.id} type="button" onClick={() => toggleBankQuestion(q.id)} className={`w-full text-start p-3 rounded-xl border-2 transition-all ${bankSelected.has(q.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${bankSelected.has(q.id) ? "bg-primary border-primary text-white" : "border-border"}`}>
                          {bankSelected.has(q.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">{q.subject}</span>
                            <span className="text-[10px] text-muted-foreground">{q.points} {lang === "ar" ? "د" : "pts"}</span>
                          </div>
                          <p className="text-sm font-bold text-foreground leading-snug">{q.text}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                <button onClick={() => setShowBankModal(false)} type="button" className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankQuestions} type="button" disabled={bankSelected.size === 0} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-black shadow-lg hover:bg-primary/90 disabled:opacity-50">{t.questionBank.addSelected} ({bankSelected.size})</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </Layout>
  );
}
