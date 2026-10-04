import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorksheetVisual } from "./worksheet-question-visual";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Sparkles, Plus, Trash2, Save, FolderOpen, Loader2, Camera,
  Wand2, X, Edit3, Check, Eye, FileText, ListChecks,
  CheckSquare, Pencil, Type, Shuffle, Upload, ImageIcon,
  FileType, Settings as SettingsIcon, Building2, GraduationCap, User,
  ArrowLeft, Printer, Download, RotateCcw, LayoutTemplate, ChevronDown, Layers, ArrowUp, ArrowDown,
  AlertTriangle, Clock3, Coins, Target, ClipboardCheck, Calculator, AlignLeft, Columns2
} from "lucide-react";
import {
  type ThemeId, THEMES, selectTheme, getLastTheme, setLastTheme,
} from "./worksheet-themes";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/lib/nav-history";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { createClientRequestId } from "@/lib/client-request-id";
import {
  creditAwareFetch,
  isInsufficientCreditsResponse,
} from "@/lib/credit-aware-fetch";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { WorksheetLivePaper } from "@/pages/teacher/worksheet-live-paper";
import { WorksheetFormatPanel } from "@/pages/teacher/worksheet-format-panel";
import { WorksheetModeSwitch } from "@/pages/teacher/worksheet-workspace-controls";
import { WorksheetPrintView, type WorksheetData, type LayoutSnapshot } from "@/pages/teacher/worksheet-print";
import { downloadAsWord, printToPdf, pdfExportErrorMessage } from "@/lib/print-export";
import { downloadVisualWorksheetWord, VisualWordExportError } from "@/lib/worksheet-word-visual";
import { WorksheetWordExportMenu, type WorksheetWordMode } from "./worksheet-word-export-menu";
import WorksheetCanvasEditor from "@/pages/teacher/worksheet-canvas-editor";
import type { CanvasLayout } from "@/pages/teacher/worksheet-canvas-types";
import type { WorksheetSettings, WorksheetActivity, WorksheetActivityStyle, WorksheetGenerationConstraints } from "@workspace/api-zod";
import {
  STYLE_META, WorksheetQuickSetup, autoRequestFields, appendAutoFormFields, countWorksheetPages, fitBlockMessage,
  pruneConstraints, type ExecutionMode,
} from "./worksheet-quick-setup";
import { WorksheetActivityEditor, ACTIVITY_LABELS } from "./worksheet-activity";
import { resolveImageUrl } from "@/lib/image-url";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function uploadWorksheetCellImage(file: File): Promise<string> {
  const request = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!request.ok) throw new Error("image-upload-request-failed");
  const { uploadURL, objectPath, finalizeURL, uploadTicket } = await request.json();
  const upload = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error("image-upload-failed");
  const finalize = await fetch(`${API_BASE}/api${finalizeURL || "/storage/uploads/finalize"}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectPath, uploadTicket }),
  });
  if (!finalize.ok) throw new Error("image-upload-verification-failed");
  return objectPath;
}
const MAX_SOURCE_TEXT_LENGTH = 12000;

const WS_PREFS_KEY = "hasad:worksheet:prefs";

interface WsPrefs {
  contentLang?: "ar" | "en";
  aiDifficulty?: "easy" | "medium" | "hard" | "mixed";
  aiPages?: 1 | 2 | 3;
  aiCounts?: AiCounts;
  aiLearningObjective?: string;
  aiCognitiveSkill?: "mixed" | "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  aiActivityDuration?: number;
  aiDifferentiation?: "none" | "support" | "enrichment" | "scaffolded";
  aiAssessment?: "diagnostic" | "formative" | "summative";
}

interface AiCounts {
  mcq: number;
  true_false: number;
  short_answer: number;
  fill_blank: number;
  matching: number;
  worked_problem: number;
  extended_response: number;
  error_correction: number;
  word_bank: number;
  compare: number;
  tic_tac_toe: number;
}

interface ToolCreditPrice {
  effectiveCost: number;
  baseCost: number;
  isPro: boolean;
  creditsEnabled: boolean;
}

const TIC_TAC_TOE_PRICE_REFRESH_MS = 30_000;
const WS_DEFAULT_PREFS: Required<WsPrefs> = {
  contentLang: "ar",
  aiDifficulty: "medium",
  aiPages: 1,
  aiCounts: { mcq: 4, true_false: 2, short_answer: 2, fill_blank: 2, matching: 0, worked_problem: 0, extended_response: 0, error_correction: 0, word_bank: 0, compare: 0, tic_tac_toe: 0 },
  aiLearningObjective: "",
  aiCognitiveSkill: "mixed",
  aiActivityDuration: 15,
  aiDifferentiation: "none",
  aiAssessment: "formative",
};

const WS_VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "mixed"]);
const WS_VALID_PAGES = new Set([1, 2, 3]);

function validateWsPrefs(raw: unknown): WsPrefs {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const result: WsPrefs = {};
  if (p.contentLang === "ar" || p.contentLang === "en") result.contentLang = p.contentLang;
  if (typeof p.aiDifficulty === "string" && WS_VALID_DIFFICULTIES.has(p.aiDifficulty)) {
    result.aiDifficulty = p.aiDifficulty as WsPrefs["aiDifficulty"];
  }
  if (typeof p.aiPages === "number" && WS_VALID_PAGES.has(p.aiPages)) {
    result.aiPages = p.aiPages as WsPrefs["aiPages"];
  }
  if (p.aiCounts && typeof p.aiCounts === "object") {
    const c = p.aiCounts as Record<string, unknown>;
    const safe = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 40 ? Math.round(v) : undefined;
    const mcq = safe(c.mcq); const tf = safe(c.true_false); const sa = safe(c.short_answer);
    const fb = safe(c.fill_blank); const ma = safe(c.matching); const ttt = safe(c.tic_tac_toe) ?? 0;
    if (mcq !== undefined && tf !== undefined && sa !== undefined && fb !== undefined && ma !== undefined && ttt <= 1) {
      result.aiCounts = {
        mcq, true_false: tf, short_answer: sa, fill_blank: fb, matching: ma,
        worked_problem: safe(c.worked_problem) ?? 0,
        extended_response: safe(c.extended_response) ?? 0,
        error_correction: safe(c.error_correction) ?? 0,
        word_bank: safe(c.word_bank) ?? 0,
        compare: safe(c.compare) ?? 0,
        tic_tac_toe: ttt,
      };
    }
  }
  if (typeof p.aiLearningObjective === "string") result.aiLearningObjective = p.aiLearningObjective;
  if (["mixed", "remember", "understand", "apply", "analyze", "evaluate", "create"].includes(String(p.aiCognitiveSkill))) {
    result.aiCognitiveSkill = p.aiCognitiveSkill as WsPrefs["aiCognitiveSkill"];
  }
  if (typeof p.aiActivityDuration === "number" && p.aiActivityDuration >= 5 && p.aiActivityDuration <= 90) {
    result.aiActivityDuration = Math.round(p.aiActivityDuration);
  }
  if (["none", "support", "enrichment", "scaffolded"].includes(String(p.aiDifferentiation))) {
    result.aiDifferentiation = p.aiDifferentiation as WsPrefs["aiDifferentiation"];
  }
  if (["diagnostic", "formative", "summative"].includes(String(p.aiAssessment))) {
    result.aiAssessment = p.aiAssessment as WsPrefs["aiAssessment"];
  }
  return result;
}

function loadWsPrefs(): WsPrefs {
  try {
    const raw = localStorage.getItem(WS_PREFS_KEY);
    return raw ? validateWsPrefs(JSON.parse(raw)) : {};
  } catch { return {}; }
}

function saveWsPrefs(prefs: WsPrefs) {
  try { localStorage.setItem(WS_PREFS_KEY, JSON.stringify(prefs)); } catch { }
}

function clearWsPrefs() {
  try { localStorage.removeItem(WS_PREFS_KEY); } catch { }
}

const TEACHER_PROFILE_KEY = "hasad:worksheet:teacher-profile";

interface TeacherHeaderProfile {
  schoolName?: string;
  section?: string;
  teacherName?: string;
  logoUrl?: string;
  customFields?: CustomField[];
}

function loadTeacherProfile(): TeacherHeaderProfile {
  try {
    const raw = localStorage.getItem(TEACHER_PROFILE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, unknown>;
    const profile: TeacherHeaderProfile = {};
    if (typeof p.schoolName === "string") profile.schoolName = p.schoolName.slice(0, 200);
    if (typeof p.section === "string") profile.section = p.section.slice(0, 100);
    if (typeof p.teacherName === "string") profile.teacherName = p.teacherName.slice(0, 100);
    if (typeof p.logoUrl === "string" && p.logoUrl.startsWith("data:image/")) {
      profile.logoUrl = p.logoUrl;
    }
    if (Array.isArray(p.customFields)) {
      profile.customFields = (p.customFields as unknown[])
        .filter((f): f is CustomField =>
          f !== null && typeof f === "object" &&
          typeof (f as CustomField).label === "string" &&
          typeof (f as CustomField).value === "string",
        )
        .slice(0, 6);
    }
    return profile;
  } catch { return {}; }
}

function saveTeacherProfile(profile: TeacherHeaderProfile) {
  try { localStorage.setItem(TEACHER_PROFILE_KEY, JSON.stringify(profile)); } catch { }
}

function clearTeacherProfile() {
  try { localStorage.removeItem(TEACHER_PROFILE_KEY); } catch { }
}

type QType = "mcq" | "true_false" | "short_answer" | "fill_blank" | "matching" | "worked_problem" | "extended_response" | "error_correction" | "word_bank" | "compare" | "tic_tac_toe";

interface QMcq { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
interface QTF { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
interface QShort { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number; activity?: WorksheetActivity }
interface QFill { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
interface QMatch { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
interface QWorkedProblem { id: string; type: "worked_problem"; prompt: string; steps?: number; answer: string; points?: number }
interface QExtendedResponse { id: string; type: "extended_response"; prompt: string; lines?: number; answer?: string; points?: number }
interface QErrorCorrection { id: string; type: "error_correction"; prompt: string; incorrectText: string; correction: string; explanation?: string; points?: number }
interface QWordBank { id: string; type: "word_bank"; prompt: string; items: string[]; answers: string[]; points?: number }
interface QCompare { id: string; type: "compare"; prompt: string; leftLabel: string; rightLabel: string; similarities?: string; differences?: string; points?: number }
interface QTicTacToeCell { text: string; category: string; imageUrl?: string; imageSuggested?: boolean }
interface QTicTacToe { id: string; type: "tic_tac_toe"; prompt: string; cells: QTicTacToeCell[]; points?: number }
type Question = (QMcq | QTF | QShort | QFill | QMatch | QWorkedProblem | QExtendedResponse | QErrorCorrection | QWordBank | QCompare | QTicTacToe) & { visual?: WorksheetVisual };
const TIC_TAC_TOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

interface WorksheetQualityIssue {
  id: string;
  questionId?: string;
  level: "error" | "warning";
  ar: string;
  en: string;
}

function normalizeComparableText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function inspectWorksheetQuality(
  title: string,
  questions: Question[],
  learningObjective: string,
): WorksheetQualityIssue[] {
  const issues: WorksheetQualityIssue[] = [];
  if (title.trim().length < 2) {
    issues.push({ id: "title", level: "error", ar: "أضف عنوانًا واضحًا للورقة.", en: "Add a clear worksheet title." });
  }
  if (!learningObjective.trim()) {
    issues.push({ id: "objective", level: "warning", ar: "أضف هدفًا تعليميًا لتحسين دقة التوليد.", en: "Add a learning objective to improve generation." });
  }

  const seenPrompts = new Map<string, string>();
  questions.forEach((question, index) => {
    const prompt = normalizeComparableText(question.prompt);
    if (!prompt) {
      issues.push({
        id: `empty-${question.id}`,
        questionId: question.id,
        level: "error",
        ar: `العنصر ${index + 1} يحتاج نصًا.`,
        en: `Item ${index + 1} needs text.`,
      });
    } else if (seenPrompts.has(prompt)) {
      issues.push({
        id: `duplicate-${question.id}`,
        questionId: question.id,
        level: "warning",
        ar: `العنصر ${index + 1} مكرر أو شديد التشابه.`,
        en: `Item ${index + 1} is duplicated or highly similar.`,
      });
    } else {
      seenPrompts.set(prompt, question.id);
    }

    if (question.type === "mcq") {
      const options = question.options.map(normalizeComparableText);
      if (options.some(option => !option)) {
        issues.push({ id: `mcq-empty-${question.id}`, questionId: question.id, level: "error", ar: `أكمل خيارات السؤال ${index + 1}.`, en: `Complete the options for question ${index + 1}.` });
      }
      if (new Set(options.filter(Boolean)).size < options.filter(Boolean).length) {
        issues.push({ id: `mcq-duplicate-${question.id}`, questionId: question.id, level: "warning", ar: `السؤال ${index + 1} يحتوي خيارات مكررة.`, en: `Question ${index + 1} has duplicate options.` });
      }
    }
    if (question.type === "fill_blank" && !question.prompt.includes("____")) {
      issues.push({ id: `blank-marker-${question.id}`, questionId: question.id, level: "warning", ar: `أضف علامة ____ داخل سؤال الفراغ ${index + 1}.`, en: `Add ____ inside fill-in-the-blank question ${index + 1}.` });
    }
    if (question.type === "short_answer" && !question.answer?.trim()) {
      issues.push({ id: `model-answer-${question.id}`, questionId: question.id, level: "warning", ar: `أضف إجابة نموذجية للسؤال ${index + 1}.`, en: `Add a model answer for question ${index + 1}.` });
    }
    if (question.type === "worked_problem" && !question.answer.trim()) {
      issues.push({ id: `worked-answer-${question.id}`, questionId: question.id, level: "warning", ar: `أضف الناتج النموذجي للمسألة ${index + 1}.`, en: `Add a model result for worked problem ${index + 1}.` });
    }
    if (question.type === "extended_response" && !question.answer?.trim()) {
      issues.push({ id: `extended-answer-${question.id}`, questionId: question.id, level: "warning", ar: `أضف عناصر الإجابة المتوقعة للسؤال المطول ${index + 1}.`, en: `Add expected answer points for extended response ${index + 1}.` });
    }
    if (question.type === "error_correction" && (!question.incorrectText.trim() || !question.correction.trim())) {
      issues.push({ id: `correction-fields-${question.id}`, questionId: question.id, level: "error", ar: `أكمل النص الخاطئ وتصحيحه في السؤال ${index + 1}.`, en: `Complete the incorrect text and correction for question ${index + 1}.` });
    }
    if (question.type === "word_bank" && (question.items.some(item => !item.trim()) || question.answers.some(answer => !answer.trim()))) {
      issues.push({ id: `word-bank-fields-${question.id}`, questionId: question.id, level: "error", ar: `أكمل جمل وإجابات بنك الكلمات في السؤال ${index + 1}.`, en: `Complete word-bank items and answers for question ${index + 1}.` });
    }
    if (question.type === "compare" && (!question.leftLabel.trim() || !question.rightLabel.trim())) {
      issues.push({ id: `compare-labels-${question.id}`, questionId: question.id, level: "error", ar: `حدّد طرفي المقارنة في السؤال ${index + 1}.`, en: `Set both comparison items for question ${index + 1}.` });
    }
    if (question.type === "tic_tac_toe") {
      const tasks = question.cells.map(cell => normalizeComparableText(cell.text));
      if (new Set(tasks.filter(Boolean)).size < tasks.filter(Boolean).length) {
        issues.push({ id: `board-duplicate-${question.id}`, questionId: question.id, level: "warning", ar: "لوحة الاختيار تحتوي مهام مكررة.", en: "The choice board contains duplicate tasks." });
      }
    }
  });
  return issues;
}

type FontFamily = "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia";

type Settings = WorksheetSettings;
type CustomField = NonNullable<Settings["customFields"]>[number];

const MAX_CUSTOM_FIELDS = 6;

interface WorksheetRow {
  id: number;
  teacherId: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  questions: Question[];
  settings: Settings;
  isShared: boolean;
  linkedAssignmentId?: number | null;
  createdAt: string;
  updatedAt: string;
  ownerName?: string | null;
  ownerIsAdmin?: boolean;
}

interface WorksheetSavePayload {
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  questions: Question[];
  settings: Settings;
  smartGrading: boolean;
}

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

const newId = () => `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const typeLabel = (t: QType, ar: boolean) => {
  const arMap: Record<QType, string> = {
    mcq: "اختيار من متعدد",
    true_false: "صح أو خطأ",
    short_answer: "إجابة قصيرة",
    fill_blank: "إكمال الفراغ",
    matching: "توصيل",
    worked_problem: "مسألة مع خطوات الحل",
    extended_response: "إجابة مطولة",
    error_correction: "اكتشف الخطأ وصححه",
    word_bank: "بنك كلمات",
    compare: "قارن",
    tic_tac_toe: "لوحة الاختيار (Tic-Tac-Toe)",
  };
  const enMap: Record<QType, string> = {
    mcq: "Multiple Choice",
    true_false: "True / False",
    short_answer: "Short Answer",
    fill_blank: "Fill the Blank",
    matching: "Matching",
    worked_problem: "Worked Problem",
    extended_response: "Extended Response",
    error_correction: "Find & Correct the Error",
    word_bank: "Word Bank",
    compare: "Compare",
    tic_tac_toe: "Choice Board (Tic-Tac-Toe)",
  };
  return ar ? arMap[t] : enMap[t];
};

const typeIcon = (t: QType) => {
  switch (t) {
    case "mcq": return <ListChecks className="w-4 h-4" />;
    case "true_false": return <CheckSquare className="w-4 h-4" />;
    case "short_answer": return <Pencil className="w-4 h-4" />;
    case "fill_blank": return <Type className="w-4 h-4" />;
    case "matching": return <Shuffle className="w-4 h-4" />;
    case "worked_problem": return <Calculator className="w-4 h-4" />;
    case "extended_response": return <AlignLeft className="w-4 h-4" />;
    case "error_correction": return <AlertTriangle className="w-4 h-4" />;
    case "word_bank": return <Layers className="w-4 h-4" />;
    case "compare": return <Columns2 className="w-4 h-4" />;
    case "tic_tac_toe": return <LayoutTemplate className="w-4 h-4" />;
  }
};

function makeBlank(type: QType, ar: boolean): Question {
  const id = newId();
  switch (type) {
    case "mcq":
      return { id, type, prompt: "", options: ["", "", "", ""], correctIndex: 0 };
    case "true_false":
      return { id, type, prompt: "", correct: true };
    case "short_answer":
      return { id, type, prompt: "", lines: 2, answer: "" };
    case "fill_blank":
      return { id, type, prompt: ar ? "اكتب الجملة هنا واستخدم ____ مكان الفراغ" : "Type the sentence and use ____ for the blank", answer: "" };
    case "matching":
      return { id, type, prompt: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }] };
    case "worked_problem":
      return { id, type, prompt: "", steps: 3, answer: "" };
    case "extended_response":
      return { id, type, prompt: "", lines: 8, answer: "" };
    case "error_correction":
      return { id, type, prompt: ar ? "اكتشف الخطأ ثم صححه وعلّل إجابتك." : "Find the error, correct it, and explain.", incorrectText: "", correction: "", explanation: "" };
    case "word_bank":
      return { id, type, prompt: ar ? "أكمل باستخدام الكلمات المناسبة من البنك." : "Complete using the correct words from the bank.", items: ["", "", ""], answers: ["", "", ""] };
    case "compare":
      return { id, type, prompt: ar ? "قارن بين العنصرين الآتيين." : "Compare the following two items.", leftLabel: "", rightLabel: "", similarities: "", differences: "" };
    case "tic_tac_toe":
      return {
        id,
        type,
        prompt: ar
          ? "اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام."
          : "Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",
        cells: (ar
          ? ["تذكّر", "فسّر", "طبّق", "قارن", "ارسم", "اكتب", "حلّل", "أنشئ", "تحدَّ"]
          : ["Recall", "Explain", "Apply", "Compare", "Draw", "Write", "Analyze", "Create", "Challenge"]
        ).map(category => ({ text: "", category })),
      };
  }
}

const DEFAULT_SETTINGS: Settings = {
  instructions: "",
  includeName: true,
  includeDate: true,
  includeClass: true,
  includeAnswerKey: false,
  columns: 1,
  headerNote: "",
  footerNote: "",
  goodLuck: "",
  schoolName: "",
  section: "",
  teacherName: "",
  customFields: [],
  fontFamily: "default",
  fontSizePt: 12,
  showWatermark: true,
  themeColor: undefined,
  logoUrl: undefined,
  template: undefined,
};

const THEME_PRESETS = [
  { color: "#225739", label: "أخضر حصاد" },
  { color: "#1a3a6b", label: "أزرق رسمي" },
  { color: "#5C2D0E", label: "بني دافئ" },
  { color: "#4a1a6b", label: "أرجواني" },
  { color: "#1A1A2E", label: "أسود راقٍ" },
  { color: "#7b1a1a", label: "أحمر" },
];

export default function WorksheetCreate() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const goBack = useSmartBack("/teacher");
  const [clientRequestId] = useState(createClientRequestId);
  const [ticTacToeCellCredit, setTicTacToeCellCredit] = useState<ToolCreditPrice | null>(null);
  const [ticTacToeImageCredit, setTicTacToeImageCredit] = useState<ToolCreditPrice | null>(null);
  const [worksheetCredit, setWorksheetCredit] = useState<ToolCreditPrice | null>(null);
  const [extractCredit, setExtractCredit] = useState<ToolCreditPrice | null>(null);
  const ticTacToePriceRequestRef = useRef(0);
  const ticTacToeImagePriceRequestRef = useRef(0);

  const _wsPrefs = useMemo(() => loadWsPrefs(), []);
  const _teacherProfile = useMemo(() => loadTeacherProfile(), []);

  const [contentLang, setContentLang] = useState<"ar" | "en">(_wsPrefs.contentLang ?? lang);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    schoolName: _teacherProfile.schoolName ?? DEFAULT_SETTINGS.schoolName,
    section: _teacherProfile.section ?? DEFAULT_SETTINGS.section,
    teacherName: _teacherProfile.teacherName ?? DEFAULT_SETTINGS.teacherName,
    logoUrl: _teacherProfile.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
    customFields: _teacherProfile.customFields ?? DEFAULT_SETTINGS.customFields,
  });


  const [aiTopic, setAiTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">(_wsPrefs.aiDifficulty ?? "medium");
  const [aiPages, setAiPages] = useState<1 | 2 | 3>(_wsPrefs.aiPages ?? 1);
  const [aiCounts, setAiCounts] = useState<AiCounts>(
    { ...(_wsPrefs.aiCounts ?? WS_DEFAULT_PREFS.aiCounts), tic_tac_toe: 0 },
  );
  const [activityStyle, setActivityStyle] = useState<WorksheetActivityStyle>("auto");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("individual");
  const [groupSize, setGroupSize] = useState<number | undefined>(undefined);
  const [genConstraints, setGenConstraints] = useState<WorksheetGenerationConstraints>({});
  const [aiQuestionSelection, setAiQuestionSelection] = useState<"auto" | "manual">("auto");
  const [aiLearningObjective, setAiLearningObjective] = useState(_wsPrefs.aiLearningObjective ?? WS_DEFAULT_PREFS.aiLearningObjective);
  const [aiCognitiveSkill, setAiCognitiveSkill] = useState(_wsPrefs.aiCognitiveSkill ?? WS_DEFAULT_PREFS.aiCognitiveSkill);
  const [aiActivityDuration, setAiActivityDuration] = useState(_wsPrefs.aiActivityDuration ?? WS_DEFAULT_PREFS.aiActivityDuration);
  const [aiDifferentiation, setAiDifferentiation] = useState(_wsPrefs.aiDifferentiation ?? WS_DEFAULT_PREFS.aiDifferentiation);
  const [aiAssessment, setAiAssessment] = useState(_wsPrefs.aiAssessment ?? WS_DEFAULT_PREFS.aiAssessment);
  const [showQualityReview, setShowQualityReview] = useState(false);
  const [allQuestionsExpanded, setAllQuestionsExpanded] = useState(true);
  const [choiceBoardOpen, setChoiceBoardOpen] = useState(false);
  const [lastCellRegeneration, setLastCellRegeneration] = useState<{
    questionId: string;
    cellIndex: number;
    previousCell: QTicTacToeCell;
  } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [regeneratingCell, setRegeneratingCell] = useState<{ questionId: string; cellIndex: number } | null>(null);
  const [generatingCellImage, setGeneratingCellImage] = useState<{ questionId: string; cellIndex: number } | null>(null);
  const [activeAiTab, setActiveAiTab] = useState("topic");

  const wsDidMountRef = useRef(false);
  const wsSkipNextSaveRef = useRef(false);
  useEffect(() => {
    if (!wsDidMountRef.current) { wsDidMountRef.current = true; return; }
    if (wsSkipNextSaveRef.current) { wsSkipNextSaveRef.current = false; return; }
    saveWsPrefs({ contentLang, aiDifficulty, aiPages, aiCounts: { ...aiCounts, tic_tac_toe: 0 }, aiLearningObjective, aiCognitiveSkill, aiActivityDuration, aiDifferentiation, aiAssessment });
  }, [contentLang, aiDifficulty, aiPages, aiCounts, aiLearningObjective, aiCognitiveSkill, aiActivityDuration, aiDifferentiation, aiAssessment]);

  useEffect(() => {
    if (aiQuestionSelection === "auto") return;
    setSettings(current => ({
      ...current,
      learningObjective: aiLearningObjective.trim() || undefined,
      cognitiveSkill: aiCognitiveSkill,
      activityDuration: aiActivityDuration,
      differentiation: aiDifferentiation,
      assessmentMode: aiAssessment,
      includeAnswerKey: aiAssessment === "summative" ? true : current.includeAnswerKey,
    }));
  }, [aiQuestionSelection, aiLearningObjective, aiCognitiveSkill, aiActivityDuration, aiDifferentiation, aiAssessment]);

  const profileDidMountRef = useRef(false);
  useEffect(() => {
    if (!profileDidMountRef.current) { profileDidMountRef.current = true; return; }
    saveTeacherProfile({
      schoolName: settings.schoolName,
      section: settings.section,
      teacherName: settings.teacherName,
      logoUrl: settings.logoUrl,
      customFields: settings.customFields,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.schoolName, settings.section, settings.teacherName, settings.logoUrl, settings.customFields]);

  const handleWsRestoreDefaults = useCallback(() => {
    clearWsPrefs();
    wsSkipNextSaveRef.current = true;
    setContentLang(lang as "ar" | "en");
    setAiDifficulty(WS_DEFAULT_PREFS.aiDifficulty);
    setAiPages(WS_DEFAULT_PREFS.aiPages);
    setAiCounts({ ...WS_DEFAULT_PREFS.aiCounts });
    setAiQuestionSelection("auto");
    setActivityStyle("auto");
    setExecutionMode("individual");
    setGroupSize(undefined);
    setGenConstraints({});
    setSettings(cur => ({ ...cur, activityStyle: undefined, executionMode: undefined, groupSize: undefined, targetPages: undefined, generationConstraints: undefined }));
    setAiLearningObjective(WS_DEFAULT_PREFS.aiLearningObjective);
    setAiCognitiveSkill(WS_DEFAULT_PREFS.aiCognitiveSkill);
    setAiActivityDuration(WS_DEFAULT_PREFS.aiActivityDuration);
    setAiDifferentiation(WS_DEFAULT_PREFS.aiDifferentiation);
    setAiAssessment(WS_DEFAULT_PREFS.aiAssessment);
  }, [lang]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileLimits = useMemo(() => ({
    maxFiles: isAdmin ? 25 : 5,
    maxBytes: isAdmin ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
    maxMb: isAdmin ? 200 : 50,
  }), [isAdmin]);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  const [savedOpen, setSavedOpen] = useState(false);
  const [savedRows, setSavedRows] = useState<WorksheetRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const editingIdRef = useRef<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [autoSaveError, setAutoSaveError] = useState("");
  const [smartGrading, setSmartGrading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [workspaceInitialMode, setWorkspaceInitialMode] = useState<"edit" | "preview">("edit");
  const [canvasEditorOpen, setCanvasEditorOpen] = useState(false);
  const saveInFlightRef = useRef(false);
  const saveBlockedRef = useRef(false);
  const contentOperationInFlightRef = useRef(false);
  const retryWorksheetPayloadRef = useRef<WorksheetSavePayload | null>(null);

  const latestWorksheetRef = useRef({
    title,
    contentLang,
    subject,
    gradeLevel,
    questions,
    settings,
    smartGrading,
  });
  useEffect(() => {
    latestWorksheetRef.current = {
      title,
      contentLang,
      subject,
      gradeLevel,
      questions,
      settings,
      smartGrading,
    };
  }, [title, contentLang, subject, gradeLevel, questions, settings, smartGrading]);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const editLoadDirtyRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit");
    const editId = editParam ? parseInt(editParam, 10) : NaN;
    if (!Number.isFinite(editId) || editId <= 0) return;
    fetch(`${API_BASE}/api/worksheets/${editId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((row: WorksheetRow | null) => {
        if (!row) return;
        if (editLoadDirtyRef.current) {
          setEditingId(row.id);
          return;
        }
        setTitle(row.title);
        setContentLang(row.language);
        setSubject(row.subject ?? "");
        setGradeLevel(row.gradeLevel ?? "");
        setQuestions(row.questions);
        setSettings({ ...DEFAULT_SETTINGS, ...row.settings, customFields: row.settings?.customFields ?? [] });
        setAiLearningObjective(row.settings?.learningObjective ?? "");
        setAiCognitiveSkill(row.settings?.cognitiveSkill ?? WS_DEFAULT_PREFS.aiCognitiveSkill);
        setAiActivityDuration(row.settings?.activityDuration ?? WS_DEFAULT_PREFS.aiActivityDuration);
        setAiDifferentiation(row.settings?.differentiation ?? WS_DEFAULT_PREFS.aiDifferentiation);
        setAiAssessment(row.settings?.assessmentMode ?? WS_DEFAULT_PREFS.aiAssessment);
        setActivityStyle(row.settings?.activityStyle ?? "auto");
        setExecutionMode(row.settings?.executionMode ?? "individual");
        setGroupSize(row.settings?.groupSize);
        setGenConstraints(row.settings?.generationConstraints ?? {});
        if (row.settings?.targetPages) setAiPages(row.settings.targetPages);
        setSmartGrading(!!row.linkedAssignmentId);
        setEditingId(row.id);
        toast.success(lang === "ar" ? "تم تحميل الورقة للتعديل" : "Worksheet loaded for editing");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setIsAdmin(!!p.isAdmin); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPrice = async (toolKey: string, setter: (value: ToolCreditPrice | null) => void) => {
      try {
        const response = await fetch(`${API_BASE}/api/credits/tool-price/${toolKey}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = response.ok ? await response.json() : null;
        if (!cancelled && data && typeof data.effectiveCost === "number" && typeof data.creditsEnabled === "boolean") {
          setter(data);
        }
      } catch {
        if (!cancelled) setter(null);
      }
    };
    void Promise.all([
      loadPrice("worksheet", setWorksheetCredit),
      loadPrice("extract_questions_from_source", setExtractCredit),
    ]);
    return () => { cancelled = true; };
  }, []);

  const totalQs = questions.length;
  const aiTotal = aiQuestionSelection === "auto" ? aiPages * 10 + aiCounts.tic_tac_toe : Object.values(aiCounts).reduce((sum, count) => sum + count, 0);
  const regularAiCount = aiTotal - aiCounts.tic_tac_toe;
  const aiMaxTotal = aiPages * 30;
  const canSave = title.trim().length >= 2 && totalQs >= 1;
  const qualityIssues = useMemo(
    () => inspectWorksheetQuality(title, questions, aiLearningObjective || genConstraints.learningObjective || ""),
    [title, questions, aiLearningObjective, genConstraints.learningObjective],
  );
  const errorCount = qualityIssues.filter(issue => issue.level === "error").length;
  const totalPoints = questions.reduce((sum, question) => sum + (question.points ?? 0), 0);
  const targetPages = settings.targetPages;
  const [livePageCount, setLivePageCount] = useState(0);
  useEffect(() => {
    if (!targetPages) { setLivePageCount(0); return; }
    const read = () => setLivePageCount(countWorksheetPages());
    read();
    const timer = window.setInterval(read, 700);
    return () => window.clearInterval(timer);
  }, [targetPages, questions, settings.fontSizePt, settings.columns]);
  const fitMessage = fitBlockMessage(targetPages, livePageCount, ar);
  const fitBlocked = !!fitMessage;
  const compactFit = () => setSettings(cur => ({ ...cur, fontSizePt: Math.max(10, (cur.fontSizePt ?? 12) - 1) }));
  const activeGenerationCredit = activeAiTab === "source" ? extractCredit : worksheetCredit;

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(q => (q.id === id ? ({ ...q, ...patch } as Question) : q)));
  };

  const updateQuestionRubric = (questionId: string, rubric: string) => {
    setSettings(current => {
      const styles = current.questionStyles ?? [];
      const existing = styles.find(style => style.questionId === questionId);
      const nextStyle = { ...existing, questionId, rubric: rubric.trim() || undefined };
      return {
        ...current,
        questionStyles: existing
          ? styles.map(style => style.questionId === questionId ? nextStyle : style)
          : [...styles, nextStyle],
      };
    });
  };

  const changeQuestionType = (id: string, newType: QType) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      if (q.type === newType) return q;
      const blank = makeBlank(newType, contentLang === "ar");
      const carriedPrompt = "prompt" in q && typeof (q as { prompt?: unknown }).prompt === "string"
        ? (q as { prompt: string }).prompt
        : undefined;
      const carriedPoints = (q as { points?: unknown }).points;
      return {
        ...blank,
        id: q.id,
        ...(carriedPrompt !== undefined && "prompt" in blank ? { prompt: carriedPrompt } : {}),
        ...(typeof carriedPoints === "number" ? { points: carriedPoints } : {}),
      } as Question;
    }));
  };

  const removeQuestion = (id: string) => {
    const latest = latestWorksheetRef.current;
    const nextQuestions = latest.questions.filter(q => q.id !== id);
    latestWorksheetRef.current = { ...latest, questions: nextQuestions };
    setQuestions(nextQuestions);
  };

  const addQuestion = (type: QType) => {
    setQuestions(prev => [makeBlank(type, contentLang === "ar"), ...prev]);
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    const current = latestWorksheetRef.current;
    const idx = current.questions.findIndex(q => q.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= current.questions.length) return;
    const nextQuestions = current.questions.slice();
    [nextQuestions[idx], nextQuestions[j]] = [nextQuestions[j], nextQuestions[idx]];
    latestWorksheetRef.current = { ...current, questions: nextQuestions };
    setQuestions(nextQuestions);
  };

  /* Server charges credits for AI generate/extract — refresh the shared
     balance (header chip + credits page) after each attempt settles. */
  const refreshCreditsBalance = useRefreshCreditsBalance();

  const refreshTicTacToeCellCredit = useCallback(async (): Promise<ToolCreditPrice | null> => {
    const requestId = ++ticTacToePriceRequestRef.current;
    setTicTacToeCellCredit(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/credits/tool-price/worksheet-tic-tac-toe-cell`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (
        typeof data?.effectiveCost !== "number"
        || typeof data?.baseCost !== "number"
        || typeof data?.isPro !== "boolean"
        || typeof data?.creditsEnabled !== "boolean"
      ) {
        return null;
      }
      if (requestId === ticTacToePriceRequestRef.current) {
        setTicTacToeCellCredit(data);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const refreshTicTacToeImageCredit = useCallback(async (): Promise<ToolCreditPrice | null> => {
    const requestId = ++ticTacToeImagePriceRequestRef.current;
    setTicTacToeImageCredit(null);
    try {
      const response = await fetch(`${API_BASE}/api/credits/tool-price/ai-image`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (
        typeof data?.effectiveCost !== "number"
        || typeof data?.baseCost !== "number"
        || typeof data?.isPro !== "boolean"
        || typeof data?.creditsEnabled !== "boolean"
      ) return null;
      if (requestId === ticTacToeImagePriceRequestRef.current) {
        setTicTacToeImageCredit(data);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const persistWorksheetPayload = async (
    payload: WorksheetSavePayload,
    automatic: boolean,
    retrying = false,
  ): Promise<number | null> => {
    if (saveInFlightRef.current) return null;
    if (saveBlockedRef.current && !retrying) {
      toast.error(ar ? "أعد محاولة حفظ التوليد الحالي أولاً" : "Retry saving the current generation first");
      return null;
    }
    saveInFlightRef.current = true;
    if (automatic) {
      setAutoSaveStatus("saving");
      setAutoSaveError("");
    } else {
      setSaving(true);
    }

    try {
      const currentId = editingIdRef.current;
      const url = currentId ? `${API_BASE}/api/worksheets/${currentId}` : `${API_BASE}/api/worksheets`;
      const method = currentId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, clientRequestId }),
      });
      if (!res.ok) {
        const responseError = await res.json().catch(() => ({}));
        const message = responseError.message || (ar ? "تعذّر الحفظ" : "Save failed");
        saveBlockedRef.current = true;
        retryWorksheetPayloadRef.current = payload;
        setAutoSaveStatus("error");
        setAutoSaveError(message);
        if (!automatic) toast.error(message);
        return null;
      }

      const responseData = await res.json();
      const row = Array.isArray(responseData) ? responseData[0] : responseData;
      const savedId = Number(row?.id ?? currentId);
      if (!Number.isFinite(savedId) || savedId <= 0) {
        throw new Error(ar ? "لم يُرجع الخادم معرّف الحفظ" : "The server did not return a saved id");
      }

      editingIdRef.current = savedId;
      setEditingId(savedId);
      saveBlockedRef.current = false;
      retryWorksheetPayloadRef.current = null;
      if (retrying) {
        const restored = {
          title: payload.title,
          contentLang: payload.language,
          subject: payload.subject ?? "",
          gradeLevel: payload.gradeLevel ?? "",
          questions: payload.questions,
          settings: payload.settings,
          smartGrading: !!payload.smartGrading,
        };
        setTitle(restored.title);
        setContentLang(restored.contentLang);
        setSubject(restored.subject);
        setGradeLevel(restored.gradeLevel);
        setQuestions(restored.questions);
        setSettings(restored.settings);
        setSmartGrading(restored.smartGrading);
        latestWorksheetRef.current = restored;
      }
      setAutoSaveStatus("saved");
      setAutoSaveError("");

      if (row?.gradingVersioned) {
        toast.info(ar
          ? "تم إنشاء نسخة تصحيح جديدة — نتائج الأوراق المصححة سابقاً محفوظة كما هي"
          : "A new grading version was created — previously graded results are preserved");
      }
      if (!automatic) toast.success(ar ? "تم الحفظ" : "Saved");
      return savedId;
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : (ar ? "حدث خطأ في الاتصال" : "Network error");
      saveBlockedRef.current = true;
      retryWorksheetPayloadRef.current = payload;
      setAutoSaveStatus("error");
      setAutoSaveError(message);
      if (!automatic) toast.error(message);
      return null;
    } finally {
      saveInFlightRef.current = false;
      if (!automatic) setSaving(false);
    }
  };

  const retryAutoSave = () => {
    const payload = retryWorksheetPayloadRef.current;
    if (!payload) return;
    void persistWorksheetPayload(payload, true, true);
  };

  const autoInput = {
    activityStyle, executionMode, groupSize, constraints: genConstraints,
    pages: aiPages, boardEnabled: aiCounts.tic_tac_toe === 1,
  };
  const autoFields = autoRequestFields(autoInput);
  const setupSettings = (auto: boolean): Partial<Settings> => ({
    ...(auto ? {
      learningObjective: genConstraints.learningObjective,
      cognitiveSkill: genConstraints.cognitiveSkill,
      activityDuration: genConstraints.activityDuration,
      differentiation: genConstraints.differentiation,
      assessmentMode: genConstraints.assessmentMode,
      ...(genConstraints.assessmentMode === "summative" ? { includeAnswerKey: true } : {}),
    } : { targetPages: undefined }),
    activityStyle,
    executionMode,
    groupSize: executionMode === "group" ? groupSize : undefined,
    generationConstraints: pruneConstraints(genConstraints),
    ...(auto ? { targetPages: aiPages } : {}),
  });
  const generateWithAI = async () => {
    if (saveBlockedRef.current || saveInFlightRef.current || contentOperationInFlightRef.current) {
      toast.error(ar ? "أعد محاولة حفظ التوليد الحالي أولاً" : "Retry saving the current generation first");
      return;
    }
    const generationTopic = aiTopic.trim() || (aiQuestionSelection === "auto" && subject.trim() && gradeLevel.trim() ? `${subject.trim()} — ${gradeLevel.trim()}` : "");
    if (!generationTopic && !sourceText.trim()) {
      toast.error(ar ? "اكتب موضوع الورقة أو الصق النص التعليمي" : "Add a topic or paste educational source text");
      return;
    }
    if (aiTotal === 0) {
      toast.error(ar ? "اختر نوع سؤال واحد على الأقل" : "Pick at least one question type");
      return;
    }
    if (aiTotal > aiMaxTotal) {
      toast.error(ar ? `العدد الإجمالي يتجاوز ${aiMaxTotal}` : `Total exceeds ${aiMaxTotal} questions`);
      return;
    }
    contentOperationInFlightRef.current = true;
    setGenerating(true);
    try {
      const res = await creditAwareFetch(`${API_BASE}/api/worksheets/ai/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: contentLang,
          topic: generationTopic,
          sourceText: sourceText.trim() || undefined,
          subject: subject.trim() || undefined,
          gradeLevel: gradeLevel.trim() || undefined,
          ...(aiQuestionSelection === "auto" ? autoFields : {
            difficulty: aiDifficulty,
            pages: aiPages,
            questionSelection: aiQuestionSelection,
            counts: aiCounts,
            learningObjective: aiLearningObjective.trim() || undefined,
            cognitiveSkill: aiCognitiveSkill,
            activityDuration: aiActivityDuration,
            differentiation: aiDifferentiation,
            assessmentMode: aiAssessment,
          }),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (isInsufficientCreditsResponse(res)) return;
        toast.error(err.message || (ar ? "تعذّر التوليد" : "Generation failed"));
        return;
      }
      const data = await res.json();
      const generated = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
      if (generated.length === 0) {
        toast.error(ar ? "لم يُرجع المولّد أي أسئلة" : "Generator returned no questions");
        return;
      }
      const current = latestWorksheetRef.current;
      const resolvedLanguage = data.language === "en" ? "en" : "ar";
      const nextQuestions = [...generated, ...current.questions];
       const nextTitle = current.title.trim() || generationTopic.slice(0, 80) || sourceText.trim().split(/\r?\n/)[0].slice(0, 80);
      const lastTheme = getLastTheme();
      const chosenTheme = selectTheme(
        current.subject.trim() || null,
        current.gradeLevel.trim() || null,
        resolvedLanguage,
        generated.length,
        lastTheme,
      );
      const nextSettings = {
        ...current.settings,
        template: chosenTheme,
        ...(aiQuestionSelection === "manual" ? {
          learningObjective: aiLearningObjective.trim() || undefined,
          cognitiveSkill: aiCognitiveSkill,
          activityDuration: aiActivityDuration,
          differentiation: aiDifferentiation,
          assessmentMode: aiAssessment,
        } : {}),
        ...setupSettings(aiQuestionSelection === "auto"),
      };

      setQuestions(nextQuestions);
      setContentLang(resolvedLanguage);
      if (!current.title.trim()) setTitle(nextTitle);
      setLastTheme(chosenTheme);
      setSettings(nextSettings);
      latestWorksheetRef.current = {
        ...current,
        title: nextTitle,
        contentLang: resolvedLanguage,
        questions: nextQuestions,
        settings: nextSettings,
      };
      toast.success(ar ? `تمت إضافة ${generated.length} سؤال` : `Added ${generated.length} questions`);
      await persistWorksheetPayload({
        title: nextTitle,
        language: resolvedLanguage,
        gradeLevel: current.gradeLevel.trim() || null,
        subject: current.subject.trim() || null,
        questions: nextQuestions,
        settings: nextSettings,
        smartGrading: current.smartGrading,
      }, true);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      contentOperationInFlightRef.current = false;
      setGenerating(false);
      refreshCreditsBalance();
    }
  };

  const regenerateTicTacToeCell = async (questionId: string, cellIndex: number) => {
    if (saveBlockedRef.current || saveInFlightRef.current || contentOperationInFlightRef.current) {
      toast.error(ar ? "أعد محاولة حفظ التغييرات الحالية أولاً" : "Retry saving the current changes first");
      return;
    }
    const current = latestWorksheetRef.current;
    const board = current.questions.find(q => q.id === questionId);
    if (!board || board.type !== "tic_tac_toe") return;

    contentOperationInFlightRef.current = true;
    setRegeneratingCell({ questionId, cellIndex });
    try {
      const currentPrice = await refreshTicTacToeCellCredit();
      if (!currentPrice) {
        toast.error(ar
          ? "تعذّر التحقق من تكلفة إعادة التوليد. حاول مرة أخرى."
          : "Could not verify the current regeneration cost. Please try again.");
        return;
      }
      const res = await creditAwareFetch(`${API_BASE}/api/worksheets/ai/regenerate-tic-tac-toe-cell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: current.contentLang,
          topic: aiTopic.trim() || current.title.trim() || (ar ? "لوحة تعليمية" : "Educational board"),
          sourceText: sourceText.trim() || undefined,
          subject: current.subject.trim() || undefined,
          gradeLevel: current.gradeLevel.trim() || undefined,
          difficulty: aiDifficulty,
          prompt: board.prompt,
          cells: board.cells,
          cellIndex,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (isInsufficientCreditsResponse(res)) return;
        toast.error(error.message || (ar ? "تعذّرت إعادة توليد المربع" : "Could not regenerate the square"));
        return;
      }
      const data = await res.json();
      if (!data.cell?.text || !data.cell?.category) {
        toast.error(ar ? "لم يُرجع المولّد مربعًا صالحًا" : "Generator returned an invalid square");
        return;
      }

      const latest = latestWorksheetRef.current;
      const latestBoard = latest.questions.find(q => q.id === questionId);
      if (!latestBoard || latestBoard.type !== "tic_tac_toe") return;
      const previousCell = latestBoard.cells[cellIndex];
      const nextQuestions = latest.questions.map(q => {
        if (q.id !== questionId || q.type !== "tic_tac_toe") return q;
        return {
          ...q,
          cells: q.cells.map((cell, index) => index === cellIndex ? data.cell : cell),
        };
      });
      setQuestions(nextQuestions);
      latestWorksheetRef.current = { ...latest, questions: nextQuestions };
      setLastCellRegeneration({ questionId, cellIndex, previousCell });
      toast.success(ar ? `تم تحديث المربع ${cellIndex + 1}` : `Square ${cellIndex + 1} updated`);
      await persistWorksheetPayload({
        title: latest.title,
        language: latest.contentLang,
        gradeLevel: latest.gradeLevel.trim() || null,
        subject: latest.subject.trim() || null,
        questions: nextQuestions,
        settings: latest.settings,
        smartGrading: latest.smartGrading,
      }, true);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      contentOperationInFlightRef.current = false;
      setRegeneratingCell(null);
      refreshCreditsBalance();
    }
  };

  const undoLastCellRegeneration = async () => {
    const snapshot = lastCellRegeneration;
    if (!snapshot || saveInFlightRef.current || contentOperationInFlightRef.current) return;
    const latest = latestWorksheetRef.current;
    const board = latest.questions.find(question => question.id === snapshot.questionId);
    if (!board || board.type !== "tic_tac_toe") {
      setLastCellRegeneration(null);
      return;
    }
    const nextQuestions = latest.questions.map(question => {
      if (question.id !== snapshot.questionId || question.type !== "tic_tac_toe") return question;
      return {
        ...question,
        cells: question.cells.map((cell, index) => index === snapshot.cellIndex ? snapshot.previousCell : cell),
      };
    });
    setQuestions(nextQuestions);
    latestWorksheetRef.current = { ...latest, questions: nextQuestions };
    setLastCellRegeneration(null);
    toast.success(ar ? "تم استرجاع المربع السابق" : "Previous square restored");
    await persistWorksheetPayload({
      title: latest.title,
      language: latest.contentLang,
      gradeLevel: latest.gradeLevel.trim() || null,
      subject: latest.subject.trim() || null,
      questions: nextQuestions,
      settings: latest.settings,
      smartGrading: latest.smartGrading,
    }, true);
  };

  const generateTicTacToeCellImage = async (questionId: string, cellIndex: number) => {
    if (saveBlockedRef.current || saveInFlightRef.current || contentOperationInFlightRef.current) {
      toast.error(ar ? "أعد محاولة حفظ التغييرات الحالية أولاً" : "Retry saving the current changes first");
      return;
    }
    const current = latestWorksheetRef.current;
    const board = current.questions.find(q => q.id === questionId);
    if (!board || board.type !== "tic_tac_toe") return;
    const cell = board.cells[cellIndex];
    if (!cell?.text.trim()) {
      toast.error(ar ? "اكتب مهمة المربع أولًا" : "Write the square task first");
      return;
    }

    contentOperationInFlightRef.current = true;
    setGeneratingCellImage({ questionId, cellIndex });
    try {
      const displayedPrice = ticTacToeImageCredit;
      const price = await refreshTicTacToeImageCredit();
      if (!price) {
        toast.error(ar ? "تعذّر التحقق من تكلفة الصورة" : "Could not verify image cost");
        return;
      }
      if (
        !displayedPrice
        || displayedPrice.creditsEnabled !== price.creditsEnabled
        || displayedPrice.effectiveCost !== price.effectiveCost
      ) {
        toast.info(ar
          ? "تم تحديث تكلفة الصورة. راجع التكلفة الظاهرة ثم اضغط التوليد مرة أخرى."
          : "The image cost was updated. Review the displayed cost, then generate again.");
        return;
      }
      const response = await creditAwareFetch(`${API_BASE}/api/worksheets/ai/generate-tic-tac-toe-image`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": createClientRequestId(),
        },
        body: JSON.stringify({
          cellText: cell.text,
          subject: current.subject.trim() || undefined,
          gradeLevel: current.gradeLevel.trim() || undefined,
          topic: aiTopic.trim() || current.title.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isInsufficientCreditsResponse(response)) return;
        toast.error(data.message || (ar ? "تعذّر توليد الصورة" : "Could not generate image"));
        return;
      }
      const latest = latestWorksheetRef.current;
      const nextQuestions = latest.questions.map(question => {
        if (question.id !== questionId || question.type !== "tic_tac_toe") return question;
        return {
          ...question,
          cells: question.cells.map((item, index) => index === cellIndex ? { ...item, imageUrl: data.imageUrl } : item),
        };
      });
      latestWorksheetRef.current = { ...latest, questions: nextQuestions };
      setQuestions(nextQuestions);
      toast.success(ar ? "تم توليد صورة المربع" : "Square image generated");
      await persistWorksheetPayload({
        title: latest.title,
        language: latest.contentLang,
        gradeLevel: latest.gradeLevel.trim() || null,
        subject: latest.subject.trim() || null,
        questions: nextQuestions,
        settings: latest.settings,
        smartGrading: latest.smartGrading,
      }, true);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال أثناء توليد الصورة" : "Network error while generating the image");
    } finally {
      contentOperationInFlightRef.current = false;
      setGeneratingCellImage(null);
      refreshCreditsBalance();
    }
  };

  useEffect(() => {
    if (!questions.some(question => question.type === "tic_tac_toe")) return;
    void refreshTicTacToeCellCredit();
    void refreshTicTacToeImageCredit();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshTicTacToeCellCredit();
        void refreshTicTacToeImageCredit();
      }
    }, TIC_TAC_TOE_PRICE_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshTicTacToeCellCredit();
        void refreshTicTacToeImageCredit();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [
    questions.some(question => question.type === "tic_tac_toe"),
    refreshTicTacToeCellCredit,
    refreshTicTacToeImageCredit,
  ]);

  const extractFromFile = async () => {
    if (saveBlockedRef.current || saveInFlightRef.current || contentOperationInFlightRef.current) {
      toast.error(ar ? "أعد محاولة حفظ التوليد الحالي أولاً" : "Retry saving the current generation first");
      return;
    }
    if (pickedFiles.length === 0 && !sourceText.trim()) {
      toast.error(ar ? "اختر ملفًا أو الصق نصاً تعليمياً" : "Pick a file or paste educational source text");
      return;
    }
    if (aiTotal === 0) {
      toast.error(ar ? "اختر نوع سؤال واحد على الأقل" : "Pick at least one question type");
      return;
    }
    if (aiTotal > aiMaxTotal) {
      toast.error(ar ? `العدد الإجمالي يتجاوز ${aiMaxTotal}` : `Total exceeds ${aiMaxTotal} questions`);
      return;
    }
    contentOperationInFlightRef.current = true;
    setExtracting(true);
    try {
      const fd = new FormData();
      for (const f of pickedFiles) fd.append("files", f);
      if (sourceText.trim()) fd.append("sourceText", sourceText.trim());
      fd.append("language", contentLang);
      if (subject.trim()) fd.append("subject", subject.trim());
      if (gradeLevel.trim()) fd.append("gradeLevel", gradeLevel.trim());
      if (aiTopic.trim()) fd.append("topicHint", aiTopic.trim());
      if (aiQuestionSelection === "auto") {
        appendAutoFormFields(fd, autoInput);
      } else {
        fd.append("difficulty", aiDifficulty);
        fd.append("pages", String(aiPages));
        if (aiLearningObjective.trim()) fd.append("learningObjective", aiLearningObjective.trim());
        fd.append("cognitiveSkill", aiCognitiveSkill);
        fd.append("activityDuration", String(aiActivityDuration));
        fd.append("differentiation", aiDifferentiation);
        fd.append("assessmentMode", aiAssessment);
        fd.append("questionSelection", aiQuestionSelection);
        fd.append("counts", JSON.stringify(aiCounts));
      }

      const res = await creditAwareFetch(`${API_BASE}/api/worksheets/ai/extract`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (isInsufficientCreditsResponse(res)) return;
        toast.error(err.message || (ar ? "تعذّر الاستخراج" : "Extraction failed"));
        return;
      }
      const data = await res.json();
      const generated = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
      if (generated.length === 0) {
        toast.error(ar ? "لم يستخرج المولّد أي أسئلة" : "Generator returned no questions");
        return;
      }
      const current = latestWorksheetRef.current;
      const resolvedLanguage = data.language === "en" ? "en" : "ar";
      const nextQuestions = [...generated, ...current.questions];
       const fallbackTitle = pickedFiles[0]?.name.replace(/\.[^.]+$/, "").slice(0, 80)
         || sourceText.trim().split(/\r?\n/)[0].slice(0, 80);
      const nextTitle = current.title.trim() || fallbackTitle;
      const lastThemeF = getLastTheme();
      const chosenThemeF = selectTheme(
        current.subject.trim() || null,
        current.gradeLevel.trim() || null,
        resolvedLanguage,
        generated.length,
        lastThemeF,
      );
      const nextSettings = {
        ...current.settings,
        template: chosenThemeF,
        ...(aiQuestionSelection === "manual" ? {
          learningObjective: aiLearningObjective.trim() || undefined,
          cognitiveSkill: aiCognitiveSkill,
          activityDuration: aiActivityDuration,
          differentiation: aiDifferentiation,
          assessmentMode: aiAssessment,
        } : {}),
        ...setupSettings(aiQuestionSelection === "auto"),
      };

      setQuestions(nextQuestions);
      setContentLang(resolvedLanguage);
      if (!current.title.trim()) setTitle(nextTitle);
      setLastTheme(chosenThemeF);
      setSettings(nextSettings);
      latestWorksheetRef.current = {
        ...current,
        title: nextTitle,
        contentLang: resolvedLanguage,
        questions: nextQuestions,
        settings: nextSettings,
      };
      const requestedTotal = Object.values(aiCounts).reduce((s: number, n) => s + (Number(n) || 0), 0);
      if (aiQuestionSelection === "manual" && requestedTotal > 0 && generated.length < requestedTotal) {
        toast.warning(
          ar
            ? `استُخرج ${generated.length} من أصل ${requestedTotal} سؤالاً — محتوى الملفات لم يكفِ للعدد المطلوب.`
            : `Extracted ${generated.length} of ${requestedTotal} requested questions — the files didn't contain enough content.`
        );
      } else {
        toast.success(ar ? `تمت إضافة ${generated.length} سؤال من ${pickedFiles.length} ملف` : `Added ${generated.length} questions from ${pickedFiles.length} file(s)`);
      }
      setPickedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await persistWorksheetPayload({
        title: nextTitle,
        language: resolvedLanguage,
        gradeLevel: current.gradeLevel.trim() || null,
        subject: current.subject.trim() || null,
        questions: nextQuestions,
        settings: nextSettings,
        smartGrading: current.smartGrading,
      }, true);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      contentOperationInFlightRef.current = false;
      setExtracting(false);
      refreshCreditsBalance();
    }
  };

  const validateBeforeSave = (): string | null => {
    if (title.trim().length < 2) return ar ? "العنوان قصير" : "Title is too short";
    if (questions.length === 0) return ar ? "أضف سؤالًا واحدًا على الأقل" : "Add at least one question";
    for (const q of questions) {
      if (q.type === "matching") {
        if (q.pairs.length < 2) return ar ? "كل سؤال توصيل يحتاج زوجين على الأقل" : "Matching needs at least 2 pairs";
        if (q.pairs.some(p => !p.left.trim() || !p.right.trim())) return ar ? "اكتمل أزواج التوصيل" : "Fill all matching pairs";
      } else if (q.type === "tic_tac_toe") {
        if (q.cells.length !== 9) return ar ? "لوحة الاختيار تحتاج ٩ مربعات" : "The choice board needs 9 cells";
        if (q.cells.some(cell => !cell.text.trim() || !cell.category.trim())) return ar ? "أكمل مهام وتصنيفات مربعات لوحة الاختيار" : "Complete every choice-board task and category";
        const repeatedLine = TIC_TAC_TOE_LINES.some(line =>
          new Set(line.map(index => q.cells[index].category.trim().toLocaleLowerCase())).size < 3
        );
        if (repeatedLine) return ar ? "اجعل أنواع المهام الثلاثة مختلفة في كل خط أفقي أو عمودي أو قطري" : "Use three different task types in every horizontal, vertical, and diagonal line";
      } else {
        if (!q.prompt.trim()) return ar ? "كل سؤال يحتاج نصًا" : "Every question needs a prompt";
      }
      if (q.type === "mcq") {
        if (q.options.length < 2) return ar ? "كل سؤال اختيار من متعدد يحتاج خيارين على الأقل" : "MCQ needs at least 2 options";
        if (q.options.some(o => !o.trim())) return ar ? "أكمل خيارات الاختيار من متعدد" : "Fill all MCQ options";
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return ar ? "اختر الإجابة الصحيحة" : "Pick a correct answer";
      }
      if (q.type === "fill_blank" && !q.answer.trim()) {
        return ar ? "اكتب الإجابة لسؤال الفراغ" : "Provide the answer for fill-blank";
      }
      if (q.type === "worked_problem" && !q.answer.trim()) {
        return ar ? "اكتب الإجابة النهائية للمسألة" : "Provide the final answer for the worked problem";
      }
      if (q.type === "error_correction" && (!q.incorrectText.trim() || !q.correction.trim())) {
        return ar ? "أكمل النص الخاطئ والتصحيح النموذجي" : "Complete the incorrect text and model correction";
      }
      if (q.type === "word_bank") {
        if (q.items.length < 2 || q.items.length !== q.answers.length) return ar ? "بنك الكلمات يحتاج فراغين متطابقين مع الإجابات على الأقل" : "Word bank needs at least two items aligned with answers";
        if (q.items.some(item => !item.trim()) || q.answers.some(answer => !answer.trim())) return ar ? "أكمل عناصر وإجابات بنك الكلمات" : "Complete all word-bank items and answers";
      }
      if (q.type === "compare" && (!q.leftLabel.trim() || !q.rightLabel.trim())) {
        return ar ? "حدّد العنصرين المطلوب مقارنتهما" : "Set both items to compare";
      }
    }
    return null;
  };

  const saveWorksheet = async (override?: { questions: Question[]; settings: Settings }): Promise<number | null> => {
    const err = validateBeforeSave();
    if (err) {
      toast.error(err);
      return null;
    }
    return persistWorksheetPayload({
      title: title.trim(),
      language: contentLang,
      gradeLevel: gradeLevel.trim() || null,
      subject: subject.trim() || null,
      questions: override?.questions ?? questions,
      settings: override?.settings ?? settings,
      smartGrading,
    }, false);
  };

  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [exportRequest, setExportRequest] = useState<"pdf" | "word" | "word-visual" | null>(null);
  const livePaperFlushRef = useRef<(() => LayoutSnapshot) | null>(null);
  const openWorksheet = (questionId?: string) => {
    livePaperFlushRef.current?.();
    setEditQuestionId(questionId ?? null);
    setExportRequest(null);
    setWorkspaceInitialMode("edit");
    setPreviewing(true);
  };
  const requestPreview = (exp: "pdf" | "word" | "word-visual" | null) => {
    if (!exp) { openWorksheet(); return; }
    if (fitBlocked) { toast.error(fitMessage ?? ""); return; }
    if (!canSave) {
      toast.error(ar ? "أكمل العنوان وأضف سؤالًا واحدًا على الأقل" : "Add a title and at least one question");
      return;
    }
    livePaperFlushRef.current?.();
    setExportRequest(exp);
    setWorkspaceInitialMode("preview");
    setPreviewing(true);
  };
  const livePaperData: WorksheetData = {
    id: editingId ?? 0,
    title: title.trim() || (ar ? "ورقة عمل" : "Worksheet"),
    language: contentLang,
    gradeLevel: gradeLevel.trim() || null,
    subject: subject.trim() || null,
    questions,
    settings,
  };
  const applyLivePaperSnapshot = (snap: LayoutSnapshot) => {
    setQuestions(snap.questions as Question[]);
    setSettings(cur => ({ ...cur, pageBreaks: snap.pageBreaks, questionStyles: snap.questionStyles }));
  };

  const loadSaved = async () => {
    setSavedLoading(true);
    setSavedOpen(true);
    try {
      const res = await fetch(`${API_BASE}/api/worksheets`, { credentials: "include" });
      if (!res.ok) throw new Error("load failed");
      const rows: WorksheetRow[] = await res.json();
      setSavedRows(rows);
    } catch {
      toast.error(ar ? "تعذّر تحميل الأوراق" : "Failed to load worksheets");
    } finally {
      setSavedLoading(false);
    }
  };

  const openTemplate = (row: WorksheetRow, asNew: boolean) => {
    setTitle(asNew ? (ar ? `${row.title} (نسخة)` : `${row.title} (copy)`) : row.title);
    setContentLang(row.language);
    setSubject(row.subject ?? "");
    setGradeLevel(row.gradeLevel ?? "");
    setQuestions(
      asNew
        ? row.questions.map(q => ({ ...q, id: newId() }))
        : row.questions,
    );
    setSettings({ ...DEFAULT_SETTINGS, ...row.settings, customFields: row.settings?.customFields ?? [] });
    setAiLearningObjective(row.settings?.learningObjective ?? "");
    setAiCognitiveSkill(row.settings?.cognitiveSkill ?? WS_DEFAULT_PREFS.aiCognitiveSkill);
    setAiActivityDuration(row.settings?.activityDuration ?? WS_DEFAULT_PREFS.aiActivityDuration);
    setAiDifferentiation(row.settings?.differentiation ?? WS_DEFAULT_PREFS.aiDifferentiation);
    setAiAssessment(row.settings?.assessmentMode ?? WS_DEFAULT_PREFS.aiAssessment);
    setActivityStyle(row.settings?.activityStyle ?? "auto");
    setExecutionMode(row.settings?.executionMode ?? "individual");
    setGroupSize(row.settings?.groupSize);
    setGenConstraints(row.settings?.generationConstraints ?? {});
    if (row.settings?.targetPages) setAiPages(row.settings.targetPages);
    setEditingId(asNew ? null : row.id);
    setSavedOpen(false);
    toast.success(ar ? (asNew ? "تم إنشاء نسخة" : "تم تحميل الورقة") : (asNew ? "Copy created" : "Worksheet loaded"));
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm(ar ? "هل تريد حذف هذه الورقة؟" : "Delete this worksheet?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/worksheets/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("delete failed");
      setSavedRows(prev => prev.filter(r => r.id !== id));
      if (editingId === id) setEditingId(null);
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch {
      toast.error(ar ? "تعذّر الحذف" : "Delete failed");
    }
  };

  const markEditDirty = () => { editLoadDirtyRef.current = true; };

  return (
    <Layout>
      <div
        dir={dir}
        className={cn("max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,46%)] lg:items-start", questions.length > 0 ? "pb-40" : "pb-8")}
        onInput={markEditDirty}
        onChange={markEditDirty}
      >
      <div className="min-w-0 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="w-10 h-10 rounded-xl border border-border bg-background hover:bg-muted text-primary flex items-center justify-center"
              title={ar ? "رجوع" : "Back"}
              aria-label={ar ? "رجوع" : "Back"}
            >
              <ArrowLeft className={cn("w-5 h-5", ar && "rotate-180")} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">{ar ? "بناء ورقة عمل" : "Worksheet Builder"}</h1>
              <p className="text-sm text-muted-foreground">{ar ? "أنشئ ورقة عمل احترافية للطباعة، يدويًا أو بالذكاء الاصطناعي." : "Design a print-ready worksheet, manually or with AI."}</p>
            </div>
          </div>
          <button
            onClick={loadSaved}
            className="px-4 py-2.5 rounded-xl font-bold border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap text-primary"
          >
            <FolderOpen className="w-4 h-4" />
            {ar ? "أوراقي المحفوظة" : "My Worksheets"}
          </button>
        </div>


        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-sm" aria-label={ar ? "مراحل بناء الورقة" : "Worksheet building steps"}>
          {[
            {
              id: "worksheet-details",
              arLabel: "بيانات الورقة",
              enLabel: "Worksheet details",
              done: title.trim().length >= 2 && !!subject.trim() && !!gradeLevel.trim(),
            },
            {
              id: "worksheet-generator",
              arLabel: "المحتوى والتوليد",
              enLabel: "Content & generation",
              done: questions.length > 0,
            },
            {
              id: "worksheet-questions",
              arLabel: "المراجعة والتنسيق",
              enLabel: "Review & format",
              done: questions.length > 0 && errorCount === 0,
            },
            {
              id: "worksheet-finish",
              arLabel: "المعاينة والطباعة",
              enLabel: "Preview & print",
              done: canSave && errorCount === 0,
            },
          ].map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition-colors",
                step.done ? "border-primary/25 bg-primary/5 text-primary" : "border-transparent hover:bg-muted text-muted-foreground",
              )}
            >
              <span className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black",
                step.done ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}>
                {step.done ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </span>
              <span className="text-xs font-bold">{ar ? step.arLabel : step.enLabel}</span>
            </button>
          ))}
        </nav>

        {/* 3. Settings Area (Header Info & Design/Format) */}
        {!previewing && (
        <Card id="worksheet-details" className="scroll-mt-24 border border-border/60 shadow-sm overflow-hidden">
          <div className="border-b border-border/50 bg-muted/20 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-foreground">{ar ? "الورقة" : "Worksheet"}</h3>
            <span data-testid="text-ws-title-summary" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{[title.trim(), subject.trim(), gradeLevel.trim()].filter(Boolean).join(" · ") || (ar ? "افتح بيانات الورقة لإضافة العنوان والمادة والصف" : "Open Details to add the title, subject and grade")}</span>
          </div>
          <div className="p-3" dir={dir}>
            <WorksheetFormatPanel
              ar={ar}
              showProfileNote
              gradeSuggestions={gradeLevels.map(g => g.gradeLevel)}
              settings={settings}
              onSettingsChange={setSettings}
              meta={{ title, subject, gradeLevel }}
              onMetaChange={patch => {
                if (patch.title !== undefined) setTitle(patch.title);
                if (patch.subject !== undefined) setSubject(patch.subject);
                if (patch.gradeLevel !== undefined) setGradeLevel(patch.gradeLevel);
              }}
              onClearProfile={() => {
                clearTeacherProfile();
                setSettings(s => ({ ...s, schoolName: "", section: "", teacherName: "", logoUrl: undefined, customFields: [] }));
              }}
            />
          </div>
        </Card>
        )}

        {/* 2. Smart Generator Block */}
        <Card id="worksheet-generator" className="scroll-mt-24 border-2 border-primary/20 shadow-lg relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent">
          <div className="absolute top-0 left-0 p-8 opacity-5 pointer-events-none transform -scale-x-100">
            <Wand2 className="w-64 h-64" />
          </div>
          <fieldset disabled={generating || extracting} className="relative z-10 min-w-0 p-5 sm:p-6 border-b border-primary/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary shadow-inner">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-primary">{ar ? "المولد الذكي" : "Smart Generator"}</h2>
                <p className="text-sm text-muted-foreground">{ar ? "اكتب موضوعاً أو الصق نصاً تعليمياً ليبني الذكاء الاصطناعي الورقة" : "Enter a topic or paste educational source text and AI will build the worksheet"}</p>
              </div>
            </div>

            <Tabs value={activeAiTab} onValueChange={setActiveAiTab} className="w-full text-start" dir={dir}>
              <TabsList className="mb-4 w-full justify-start">
                <TabsTrigger value="topic" className="gap-2 font-bold"><Type className="w-4 h-4"/>{ar ? "موضوع / تعليمات" : "Topic / Instruction"}</TabsTrigger>
                <TabsTrigger value="source" className="gap-2 font-bold"><Layers className="w-4 h-4"/>{ar ? "مادة علمية (نص / ملفات)" : "Source Material (Text/Files)"}</TabsTrigger>
              </TabsList>

              <TabsContent value="topic" className="space-y-4 outline-none">
                <input
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder={ar ? "عن ماذا تتحدث الورقة؟ (مثال: أركان الصلاة، ضرب الكسور...)" : "What is this worksheet about?"}
                  className="w-full text-lg px-4 py-4 rounded-xl border-2 border-border bg-background font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm outline-none text-start"
                />
              </TabsContent>

              <TabsContent value="source" className="space-y-4 outline-none">
                <div>
                  <textarea
                    value={sourceText}
                    maxLength={MAX_SOURCE_TEXT_LENGTH}
                    onChange={e => setSourceText(e.target.value)}
                    placeholder={ar
                      ? "الصق محتوى الدرس هنا؛ سيبقى منفصلاً عن موضوع/تعليمات المعلم."
                      : "Paste lesson content here; it stays separate from the teacher topic/instructions."}
                    className="w-full min-h-28 px-4 py-3 rounded-xl border-2 border-border bg-background text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-start"
                  />
                  <p className="text-xs text-muted-foreground text-end mt-1">
                    {sourceText.length.toLocaleString()}/{MAX_SOURCE_TEXT_LENGTH.toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className={cn(
                     "flex-1 h-12 px-6 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border-2",
                     pickedFiles.length > 0 ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted text-muted-foreground bg-background"
                  )}>
                     <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.pptx,.txt,.md" className="hidden"
                       onChange={e => {
                         const incoming = Array.from(e.target.files || []);
                         if (incoming.length === 0) return;
                         const merged = [...pickedFiles];
                         for (const f of incoming) {
                           if (f.size > fileLimits.maxBytes) {
                             toast.error(ar ? `الملف "${f.name}" يتجاوز ${fileLimits.maxMb} ميجا` : `"${f.name}" exceeds ${fileLimits.maxMb} MB`);
                             continue;
                           }
                           if (merged.some(m => m.name === f.name && m.size === f.size)) continue;
                           merged.push(f);
                         }
                         if (merged.length > fileLimits.maxFiles) {
                           toast.error(ar ? `الحد الأقصى ${fileLimits.maxFiles} ملفات` : `Max ${fileLimits.maxFiles} files`);
                           merged.length = fileLimits.maxFiles;
                         }
                         setPickedFiles(merged);
                         if (fileInputRef.current) fileInputRef.current.value = "";
                       }}
                     />
                     <Upload className="w-5 h-5" />
                     <span>
                       {pickedFiles.length > 0 ? (ar ? `تم اختيار ${pickedFiles.length}` : `${pickedFiles.length} selected`) : (ar ? "رفع ملف تعليمي" : "Upload Educational File")}
                     </span>
                  </label>
                </div>
                {pickedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pickedFiles.map((f, idx) => (
                      <span
                        key={`${f.name}-${f.size}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/30 bg-primary/5 text-primary text-[11px]"
                      >
                        {f.type.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> : <FileType className="w-3 h-3" />}
                        <span className="font-bold truncate max-w-[160px]">{f.name}</span>
                        <span className="opacity-60">{Math.round(f.size / 1024)} KB</span>
                        <button
                          type="button"
                          onClick={() => setPickedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="ml-1 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </fieldset>

          <fieldset disabled={generating || extracting} className="min-w-0 px-5 py-4 sm:px-6 bg-background/60">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                aria-expanded={choiceBoardOpen}
                onClick={() => setChoiceBoardOpen(open => !open)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground",
                  aiCounts.tic_tac_toe === 1 && "border-primary/30 text-primary",
                )}
              >
                <span className="grid h-4 w-4 grid-cols-3 gap-px rounded-[3px] border border-current/30 p-0.5" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => <span key={index} className={cn("rounded-[1px] bg-current/15", index === 4 && "bg-current/50")} />)}
                </span>
                <span>{ar ? "لوحة الاختيار" : "Choice Board"}</span>
                <span dir="ltr" className="font-medium opacity-70">(Tic-Tac-Toe)</span>
                {aiCounts.tic_tac_toe === 1 && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label={ar ? "مفعّلة" : "Enabled"} />}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", choiceBoardOpen && "rotate-180")} />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {choiceBoardOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-foreground">
                        {ar ? "لوحة الاختيار (Tic-Tac-Toe)" : "Choice Board (Tic-Tac-Toe)"}
                      </h3>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {ar
                          ? "استراتيجية اختيارية للمعلمين الذين يستخدمونها: يختار الطالب ثلاث مهام متصلة أفقيًا أو عموديًا أو قطريًا."
                          : "An optional strategy: students choose three connected tasks horizontally, vertically, or diagonally."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={aiCounts.tic_tac_toe === 1}
                        onClick={() => setAiCounts(prev => ({ ...prev, tic_tac_toe: prev.tic_tac_toe === 1 ? 0 : 1 }))}
                        className={cn(
                          "h-9 rounded-lg border px-3 text-[11px] font-bold transition-colors",
                          aiCounts.tic_tac_toe === 1
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-primary/30 bg-background text-primary hover:bg-primary/5",
                        )}
                      >
                        {aiCounts.tic_tac_toe === 1
                          ? (ar ? "مفعّلة في التوليد" : "Enabled")
                          : (ar ? "تضمين في التوليد" : "Include in generation")}
                      </button>
                      <button
                        type="button"
                        disabled={questions.some(question => question.type === "tic_tac_toe")}
                        onClick={() => addQuestion("tic_tac_toe")}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-[11px] font-bold text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {questions.some(question => question.type === "tic_tac_toe")
                          ? (ar ? "مضافة بالفعل" : "Already added")
                          : (ar ? "إضافة لوحة فارغة" : "Add empty board")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
                {aiQuestionSelection === "auto" && (
                  <WorksheetQuickSetup
                    ar={ar}
                    subject={subject} onSubject={setSubject}
                    gradeLevel={gradeLevel} onGrade={setGradeLevel}
                    gradeSuggestions={gradeLevels.map(g => g.gradeLevel)}
                    activityStyle={activityStyle} onStyle={setActivityStyle}
                    executionMode={executionMode} onMode={setExecutionMode}
                    groupSize={groupSize} onGroupSize={setGroupSize}
                    pages={aiPages} onPages={setAiPages}
                    constraints={genConstraints} onConstraints={setGenConstraints}
                  />
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Field label={ar ? "لغة المحتوى" : "Language"}>
                      <SegmentedControl
                         value={contentLang}
                         onChange={setContentLang as any}
                         options={[{label: ar?"العربية":"Arabic", value:"ar"}, {label: ar?"English":"English", value:"en"}]}
                      />
                   </Field>
                   {aiQuestionSelection === "manual" && (<>
                   <Field label={ar ? "مستوى الصعوبة" : "Difficulty"}>
                      <SegmentedControl
                         value={aiDifficulty}
                         onChange={setAiDifficulty as any}
                         options={[
                           {label: ar?"سهل":"Easy", value:"easy"},
                           {label: ar?"متوسط":"Med", value:"medium"},
                           {label: ar?"صعب":"Hard", value:"hard"},
                           {label: ar?"متنوّع":"Mixed", value:"mixed"}
                         ]}
                      />
                   </Field>
                   <Field label={ar ? "عدد الصفحات المستهدف" : "Pages"}>
                      <SegmentedControl
                         value={aiPages}
                         onChange={setAiPages as any}
                         options={[
                           {label: ar?"١ صفحة":"1 Page", value: 1},
                           {label: ar?"٢ صفحة":"2 Pages", value: 2},
                           {label: ar?"٣ صفحات":"3 Pages", value: 3}
                         ]}
                      />
                   </Field>
                   </>)}
                </div>

                {/* Counts row - compact */}
                <Field label={ar ? "اختيار أنواع الأسئلة" : "Question type selection"}>
                  <div data-testid="worksheet-question-selection">
                    <SegmentedControl<"auto" | "manual"> value={aiQuestionSelection} onChange={setAiQuestionSelection}
                      options={[{ label: ar ? "تلقائي — يختار النظام الأنسب" : "Automatic — choose suitable types", value: "auto" },
                        { label: ar ? "يدوي — أحدد الأنواع والأعداد" : "Manual — choose types and counts", value: "manual" }]} />
                  </div>
                </Field>
                {aiQuestionSelection === "auto" && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed text-primary" data-testid="worksheet-auto-selection-hint">
                  {ar ? "يختار حصاد الأنواع والأعداد المناسبة للمادة والفئة الدراسية والموضوع، ويضيف رسومات وأشكالًا تعليمية عند الحاجة. يمكنك مراجعة الأسئلة وتعديلها بعد التوليد، أو الانتقال للاختيار اليدوي." : "Hasaad chooses suitable types and counts for the subject, grade and topic, adding educational diagrams when useful. Review and edit the results, or switch to manual selection."}
                </p>}
                {aiQuestionSelection === "manual" && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3 bg-muted/40 rounded-xl border border-border/50">
                  <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4"/> {ar ? "توزيع الأسئلة:" : "Distribution:"}
                  </div>
                  {(["mcq", "true_false", "short_answer", "fill_blank", "matching"] as const).map(k => (
                    <CompactStepper
                      key={k}
                      label={typeLabel(k, ar)}
                      value={aiCounts[k]}
                      max={["matching", "word_bank", "compare"].includes(k) ? Math.min(10, aiPages * 4) : Math.min(40, aiPages * 14)}
                      onChange={v => setAiCounts(prev => ({ ...prev, [k]: v }))}
                    />
                  ))}
                  <Collapsible className="w-full">
                    <CollapsibleTrigger className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[11px] font-bold text-primary hover:bg-primary/5">
                      <Plus className="w-3.5 h-3.5" />
                      {ar ? "أنواع إضافية" : "More question types"}
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border/50 bg-background/70 p-3">
                      {(["worked_problem", "extended_response", "error_correction", "word_bank", "compare"] as const).map(k => (
                        <CompactStepper
                          key={k}
                          label={typeLabel(k, ar)}
                          value={aiCounts[k]}
                          max={["word_bank", "compare"].includes(k) ? Math.min(10, aiPages * 4) : Math.min(40, aiPages * 14)}
                          onChange={v => setAiCounts(prev => ({ ...prev, [k]: v }))}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                )}
                {aiQuestionSelection === "manual" && (
                <Collapsible>
                  <CollapsibleTrigger data-testid="button-generator-advanced" className="group flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-start text-sm font-bold text-foreground hover:bg-muted">
                    <span className="flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-muted-foreground" />{ar ? "إعدادات متقدمة" : "Advanced settings"}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-3">
                {/* Learning Objective & Cognitive Skill */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label={ar ? "الهدف التعليمي (اختياري)" : "Learning Objective (Optional)"}>
                    <input data-testid="worksheet-learning-objective" value={aiLearningObjective} onChange={e => setAiLearningObjective(e.target.value)} placeholder={ar ? "مثال: أن يميز الطالب بين..." : "e.g. Students will distinguish..."} className="w-full h-11 px-3 rounded-xl border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm" />
                  </Field>
                  <Field label={ar ? "المهارة المعرفية" : "Cognitive Skill"}>
                     <select value={aiCognitiveSkill} onChange={e => setAiCognitiveSkill(e.target.value as typeof aiCognitiveSkill)} className="w-full h-11 px-3 rounded-xl border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                       <option value="mixed">{ar ? "متنوعة" : "Mixed"}</option>
                       <option value="remember">{ar ? "تذكر (استرجاع)" : "Remember"}</option>
                       <option value="understand">{ar ? "فهم (تفسير)" : "Understand"}</option>
                       <option value="apply">{ar ? "تطبيق (استخدام)" : "Apply"}</option>
                       <option value="analyze">{ar ? "تحليل (تفكيك)" : "Analyze"}</option>
                       <option value="evaluate">{ar ? "تقييم (نقد)" : "Evaluate"}</option>
                       <option value="create">{ar ? "إبداع (تركيب)" : "Create"}</option>
                     </select>
                  </Field>
                  <Field label={ar ? "مدة النشاط" : "Activity Duration"}>
                     <select value={aiActivityDuration} onChange={e => setAiActivityDuration(Number(e.target.value))} className="w-full h-11 px-3 rounded-xl border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                       <option value={5}>{ar ? "5 دقائق (سريع)" : "5 minutes (Quick)"}</option>
                       <option value={15}>{ar ? "15 دقيقة (متوسط)" : "15 minutes (Medium)"}</option>
                       <option value={30}>{ar ? "30 دقيقة (طويل)" : "30 minutes (Long)"}</option>
                       <option value={45}>{ar ? "45 دقيقة (حصة كاملة)" : "45 minutes (Full class)"}</option>
                     </select>
                  </Field>
                </div>

                {/* Differentiation & Assessment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={ar ? "مراعاة الفروق الفردية (التمايز)" : "Differentiation"}>
                     <select value={aiDifferentiation} onChange={e => setAiDifferentiation(e.target.value as typeof aiDifferentiation)} className="w-full h-11 px-3 rounded-xl border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                       <option value="none">{ar ? "بدون تحديد" : "None"}</option>
                       <option value="support">{ar ? "دعم إضافي (مبسط)" : "Extra Support (Simplified)"}</option>
                       <option value="enrichment">{ar ? "إثراء وتحدٍ (متقدم)" : "Enrichment (Advanced)"}</option>
                       <option value="scaffolded">{ar ? "متدرج (يشمل كل المستويات)" : "Scaffolded (All levels)"}</option>
                     </select>
                  </Field>
                  <Field label={ar ? "نوع التقييم" : "Assessment Type"}>
                     <select value={aiAssessment} onChange={e => setAiAssessment(e.target.value as typeof aiAssessment)} className="w-full h-11 px-3 rounded-xl border bg-background text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                       <option value="formative">{ar ? "تكويني (أثناء الدرس)" : "Formative (During lesson)"}</option>
                       <option value="summative">{ar ? "ختامي (نهاية الدرس)" : "Summative (End of lesson)"}</option>
                       <option value="diagnostic">{ar ? "قبلي (قياس المعرفة السابقة)" : "Diagnostic (Prior knowledge)"}</option>
                     </select>
                  </Field>
                </div>

                  </CollapsibleContent>
                </Collapsible>
                )}
            </div>

            {(() => {
              if (aiTotal === 0) return null;
              if (activeAiTab === "topic" && !aiTopic.trim() && !(aiQuestionSelection === "auto" && subject.trim() && gradeLevel.trim())) return null;
              if (activeAiTab === "source" && !sourceText.trim() && pickedFiles.length === 0) return null;
              const difText = aiDifficulty === "easy" ? (ar ? "بسيط" : "easy") : aiDifficulty === "hard" ? (ar ? "متقدم" : "hard") : aiDifficulty === "mixed" ? (ar ? "متنوع" : "mixed") : (ar ? "متوسط" : "medium");
              const boardText = aiCounts.tic_tac_toe === 1
                ? (ar ? " ولوحة اختيار من 9 مهام" : " and one 9-task choice board")
                : "";
              const cost = activeGenerationCredit?.creditsEnabled ? activeGenerationCredit.effectiveCost : null;
              return (
                <div className="bg-primary/5 text-primary text-sm p-4 rounded-xl border border-primary/20 flex flex-col gap-2 mt-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 shrink-0" />
                      {ar ? "ملخص التوليد" : "Generation Summary"}
                    </span>
                    {cost !== null && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs">
                        <Coins className="w-3.5 h-3.5" />
                        {cost === 0
                          ? (ar ? "دون نقاط" : "No credits")
                          : (ar ? `${cost} نقاط حصاد` : `${cost} Hasad credits`)}
                      </span>
                    )}
                  </div>
                  <p className="opacity-90 leading-relaxed">
                    {aiQuestionSelection === "auto"
                      ? (ar ? `سيُنشأ نشاط بصيغة «${STYLE_META[activityStyle].ar}» ${executionMode === "group" ? "للعمل الجماعي" : "للعمل الفردي"} في ${aiPages} ${aiPages === 1 ? "صفحة" : "صفحات"} كحد أقصى، والحقول غير المحددة تُترك لتقدير النموذج.` : `An activity in the "${STYLE_META[activityStyle].en}" format for ${executionMode === "group" ? "group" : "individual"} work, within ${aiPages} page(s); unset fields are left to the model.`)
                      : ar
                      ? `سيتم بناء ${regularAiCount > 0 ? `${regularAiCount} سؤالًا` : "لوحة اختيار فقط"}${regularAiCount > 0 ? boardText : ""}، بمستوى ${difText}، لمدة ${aiActivityDuration} دقيقة، وفي نحو ${aiPages} صفحة.`
                      : `Will build ${regularAiCount > 0 ? `${regularAiCount} questions` : "a choice board only"}${regularAiCount > 0 ? boardText : ""}, at ${difText} difficulty, for ${aiActivityDuration} minutes, in about ${aiPages} page(s).`}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-background border border-primary/15 px-2.5 py-1">
                      {ar ? `الهدف: ${aiLearningObjective.trim() || "لم يُحدد بعد"}` : `Objective: ${aiLearningObjective.trim() || "Not set"}`}
                    </span>
                    <span className="rounded-full bg-background border border-primary/15 px-2.5 py-1">
                      {ar ? `التقييم: ${aiAssessment === "diagnostic" ? "قبلي" : aiAssessment === "summative" ? "ختامي" : "تكويني"}` : `Assessment: ${aiAssessment}`}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                 onClick={activeAiTab === "topic" ? generateWithAI : extractFromFile}
                 disabled={generating || extracting || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                 className="flex-1 sm:flex-none sm:px-8 h-11 text-sm font-black rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                 {(generating || extracting)
                   ? <><Loader2 className="w-5 h-5 animate-spin"/> {ar ? "جارٍ التوليد..." : "Generating..."}</>
                   : <><Sparkles className="w-5 h-5"/> {
                     activeAiTab === "source"
                       ? (ar ? "استخراج وبناء الورقة" : "Extract & Build Worksheet")
                       : aiQuestionSelection === "auto"
                         ? (ar ? "أنشئ النشاط" : "Create activity")
                       : aiCounts.tic_tac_toe === 1 && regularAiCount === 0
                         ? (ar ? "توليد لوحة الاختيار" : "Generate Choice Board")
                         : aiCounts.tic_tac_toe === 1
                           ? (ar ? "توليد الورقة" : "Generate Worksheet")
                           : (ar ? "توليد الأسئلة" : "Generate Questions")
                   }
                   {activeGenerationCredit?.creditsEnabled && (
                     <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                       {activeGenerationCredit.effectiveCost === 0
                         ? (ar ? "دون نقاط" : "No credits")
                         : (ar ? `${activeGenerationCredit.effectiveCost} نقاط` : `${activeGenerationCredit.effectiveCost} credits`)}
                     </span>
                   )}
                   </>}
              </button>
              <button
                onClick={handleWsRestoreDefaults}
                title={ar ? "استعادة الإعدادات الافتراضية" : "Restore defaults"}
                className="h-11 w-11 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors flex-shrink-0"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </fieldset>
        </Card>

        {/* 4. Questions List */}
        <div id="worksheet-questions" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border/50 shadow-sm">
            <DropdownMenu dir={dir}>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2.5 rounded-xl border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-bold flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {ar ? "إضافة سؤال" : "Add Question"}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-[70vh] overflow-y-auto">
                {(["mcq", "true_false", "short_answer", "fill_blank", "matching", "worked_problem", "extended_response", "error_correction", "word_bank", "compare"] as const).map(t => (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => addQuestion(t)}
                    className="gap-2 cursor-pointer font-medium text-start"
                  >
                    <span className="text-primary">{typeIcon(t)}</span>
                    {typeLabel(t, ar)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              {questions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setAllQuestionsExpanded(value => !value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-all text-xs font-bold h-9"
                  >
                    {allQuestionsExpanded
                      ? (ar ? "طي الكل" : "Collapse all")
                      : (ar ? "توسيع الكل" : "Expand all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQualityReview(value => !value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1.5 h-9",
                      qualityIssues.length === 0
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : errorCount > 0
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-amber-400/40 bg-amber-50 text-amber-800",
                    )}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    {ar ? "مراجعة الجودة" : "Quality review"}
                    <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px]">
                      {qualityIssues.length}
                    </span>
                  </button>
                </>
              )}
              <span className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                {ar ? `${totalQs} مضافة` : `${totalQs} added`}
              </span>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(ar ? "هل تريد حذف جميع الأسئلة؟ يمكنك إضافة أسئلة جديدة قبل الحفظ." : "Delete all questions? You can add new questions before saving.")) return;
                    setQuestions([]);
                    setSettings(current => ({ ...current, pageBreaks: [], questionStyles: [] }));
                    toast.success(ar ? "تم حذف جميع الأسئلة من المسودة" : "All questions removed from the draft");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-destructive/30 bg-background hover:bg-destructive/5 text-destructive transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm h-9"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{ar ? "حذف الكل" : "Delete all"}</span>
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showQualityReview && questions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={cn(
                  "rounded-2xl border p-4",
                  qualityIssues.length === 0
                    ? "border-primary/25 bg-primary/5"
                    : "border-amber-400/35 bg-amber-50/80 dark:bg-amber-950/20",
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-sm flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                        {qualityIssues.length === 0
                          ? (ar ? "الورقة جاهزة للمراجعة النهائية" : "Worksheet is ready for final review")
                          : (ar ? `${qualityIssues.length} ملاحظات قبل الطباعة` : `${qualityIssues.length} notes before printing`)}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? `${settings.activityDuration ? `الزمن المستهدف ${settings.activityDuration} دقيقة` : "مدة مناسبة للنشاط"} · ${totalPoints > 0 ? `${totalPoints} درجة` : "نشاط دون درجات"} · ${settings.targetPages ?? aiPages} صفحة مستهدفة`
                          : `${settings.activityDuration ? `${settings.activityDuration} target minutes` : "Activity-appropriate duration"} · ${totalPoints > 0 ? `${totalPoints} points` : "ungraded activity"} · ${settings.targetPages ?? aiPages} target page(s)`}
                      </p>
                    </div>
                    <button type="button" onClick={() => openWorksheet()} className="shrink-0 rounded-lg border bg-background px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5">
                      {ar ? "فتح الورقة" : "Open worksheet"}
                    </button>
                  </div>
                  {qualityIssues.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {qualityIssues.map(issue => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => {
                            if (issue.id === "objective") {
                              document.querySelector<HTMLInputElement>('[data-testid="worksheet-learning-objective"]')?.focus();
                              return;
                            }
                            if (issue.questionId) {
                              document.getElementById(`worksheet-question-${issue.questionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }}
                          className="flex items-start gap-2 rounded-xl border bg-background/80 p-2.5 text-start hover:border-primary/30"
                        >
                          <AlertTriangle className={cn("mt-0.5 w-4 h-4 shrink-0", issue.level === "error" ? "text-destructive" : "text-amber-600")} />
                          <span className="text-xs font-medium">{ar ? issue.ar : issue.en}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {questions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-muted/10 border-2 border-dashed border-border rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <ListChecks className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {ar ? "لا توجد أسئلة بعد" : "No questions yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {ar ? "استخدم المولد الذكي بالأعلى لبناء أسئلة فورية، أو أضف أسئلة يدوياً من الشريط." : "Use the Smart Generator above to build questions instantly, or add them manually."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <QuestionEditor
                  key={q.id}
                  index={i}
                  total={totalQs}
                  question={q}
                  ar={ar}
                  onUpdate={patch => updateQuestion(q.id, patch)}
                  onRemove={() => removeQuestion(q.id)}
                  onMove={d => moveQuestion(q.id, d)}
                  onChangeType={t => changeQuestionType(q.id, t)}
                  onRegenerateCell={cellIndex => regenerateTicTacToeCell(q.id, cellIndex)}
                  regeneratingCellIndex={regeneratingCell?.questionId === q.id ? regeneratingCell.cellIndex : null}
                  regenerateCreditPrice={ticTacToeCellCredit}
                  onGenerateCellImage={cellIndex => generateTicTacToeCellImage(q.id, cellIndex)}
                  generatingCellImageIndex={generatingCellImage?.questionId === q.id ? generatingCellImage.cellIndex : null}
                  imageCreditPrice={ticTacToeImageCredit}
                  forceExpanded={allQuestionsExpanded}
                  difficulty={aiQuestionSelection === "auto" ? genConstraints.difficulty ?? "auto" : aiDifficulty}
                  assessmentMode={aiQuestionSelection === "auto" ? genConstraints.assessmentMode ?? "formative" : aiAssessment}
                  rubric={settings.questionStyles?.find(style => style.questionId === q.id)?.rubric ?? ""}
                  onRubricChange={rubric => updateQuestionRubric(q.id, rubric)}
                  canUndoRegeneration={lastCellRegeneration?.questionId === q.id}
                  onUndoRegeneration={undoLastCellRegeneration}
                />
              ))}
            </div>
          )}
        </div>

      </div>
      <aside id="worksheet-paper" className={cn("min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-auto order-first lg:order-none")}>
        {!previewing && (
          <WorksheetLivePaper
            ar={ar}
            data={livePaperData}
            flushRef={livePaperFlushRef}
            onDraftChange={applyLivePaperSnapshot}
            onEnlarge={() => openWorksheet()}
            onRequestEdit={id => openWorksheet(id)}
          />
        )}
      </aside>
      </div>

      {/* Sticky Bottom Bar - PRIMARY ACTION */}
      {questions.length > 0 && (
      <div id="worksheet-finish" className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 bg-background/90 backdrop-blur-xl border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2">
              <input
                type="checkbox"
                checked={smartGrading}
                onChange={(e) => setSmartGrading(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded"
              />
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-1.5">
                <Camera className="w-4 h-4" />
                {ar ? "تفعيل التصحيح الورقي الذكي" : "Enable smart paper grading"}
              </span>
            </label>
            <span className="text-[11px] text-muted-foreground max-w-md">
              {ar
                ? "بعد الحفظ: صوّر أوراق الطلاب وسيقوم الذكاء الاصطناعي بتصحيحها تلقائياً"
                : "After saving: photograph student papers and AI grades them automatically"}
            </span>
            {smartGrading && editingId && (
              <button
                onClick={() => setLocation(`/teacher/worksheets/${editingId}/grade`)}
                className="px-4 py-2 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors text-sm"
              >
                <Camera className="w-4 h-4" />
                {ar ? "فتح صفحة التصحيح" : "Open grading page"}
              </button>
            )}
            {autoSaveStatus !== "idle" && (
              <div
                data-testid="status-worksheet-autosave"
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold",
                  autoSaveStatus === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                {autoSaveStatus === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
                {autoSaveStatus === "saved" && <Check className="w-4 h-4" />}
                {autoSaveStatus === "error" && <X className="w-4 h-4" />}
                <span>
                  {autoSaveStatus === "saving" && (ar ? "جارٍ حفظ التوليد تلقائياً…" : "Saving generated content…")}
                  {autoSaveStatus === "saved" && (ar ? "تم حفظ التوليد تلقائياً" : "Generated content saved")}
                  {autoSaveStatus === "error" && (autoSaveError || (ar ? "فشل الحفظ التلقائي" : "Auto-save failed"))}
                </span>
                {autoSaveStatus === "error" && (
                  <button
                    type="button"
                    onClick={retryAutoSave}
                    data-testid="button-retry-worksheet-autosave"
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-background px-2 py-1 hover:bg-destructive/5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {ar ? "إعادة المحاولة" : "Retry"}
                  </button>
                )}
              </div>
            )}
          </div>
          {targetPages && (
            <div
              role="status"
              data-testid="status-page-fit"
              className={cn("flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold",
                fitBlocked ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary")}
            >
              <span className="flex-1">
                {fitBlocked
                  ? fitMessage
                  : (ar ? `الورقة ${livePageCount} من ${targetPages} صفحات مستهدفة.` : `${livePageCount} of ${targetPages} target pages.`)}
              </span>
              {fitBlocked && (
                <>
                  <button type="button" data-testid="button-fit-compact" onClick={compactFit} className="h-8 rounded-lg border bg-background px-2.5 text-foreground">
                    {ar ? "تصغير الخط درجة" : "Shrink text one step"}
                  </button>
                  {targetPages < 3 && (
                    <button type="button" data-testid="button-fit-raise" onClick={() => { const n = (targetPages + 1) as 2 | 3; setAiPages(n); setSettings(cur => ({ ...cur, targetPages: n })); }} className="h-8 rounded-lg border bg-background px-2.5 text-foreground">
                      {ar ? `رفع المستهدف إلى ${targetPages + 1}` : `Raise target to ${targetPages + 1}`}
                    </button>
                  )}
                  <button type="button" data-testid="button-fit-release" onClick={() => setSettings(cur => ({ ...cur, targetPages: undefined }))} className="h-8 rounded-lg border bg-background px-2.5 text-foreground">
                    {ar ? "إلغاء الحد" : "Remove limit"}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2" data-testid="bar-worksheet-actions">
            <div className="flex flex-wrap items-center gap-2">
              <button
                data-testid="button-ws-preview"
                onClick={() => requestPreview(null)}
                disabled={!canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                className="h-10 px-3.5 rounded-xl font-bold border border-border bg-background hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Pencil className="w-4 h-4" />{ar ? "فتح الورقة" : "Open worksheet"}
              </button>
              <button
                data-testid="button-ws-pdf"
                onClick={() => requestPreview("pdf")}
                disabled={fitBlocked || !canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                className="h-10 px-3.5 rounded-xl font-bold border border-border bg-background hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />PDF
              </button>
              <WorksheetWordExportMenu
                ar={ar}
                testId="button-ws-word"
                onExport={mode => requestPreview(mode === "visual" ? "word-visual" : "word")}
                disabled={fitBlocked || !canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                className="h-10 px-3.5 rounded-xl font-bold border border-border bg-background hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
              />
              <button
                data-testid="button-ws-canvas"
                onClick={() => {
                  if (!canSave) {
                    toast.error(ar ? "أكمل العنوان وأضف سؤالًا واحدًا على الأقل" : "Add a title and at least one question");
                    return;
                  }
                  setCanvasEditorOpen(true);
                }}
                disabled={!canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                className="h-10 px-3.5 rounded-xl font-bold border border-border bg-background hover:bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Layers className="w-4 h-4 text-primary" />
                {ar ? "تصميم حر" : "Canvas"}
                {(settings.layout?.elements?.length ?? 0) > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    {settings.layout!.elements.length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                data-testid="button-ws-save"
                onClick={() => saveWorksheet()}
                disabled={!canSave || saving || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                className="h-10 px-5 rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {ar ? "حفظ" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      <AnimatePresence>
        {canvasEditorOpen && (
          <WorksheetCanvasEditor
            ar={ar}
            data={{
              id: editingId ?? 0,
              title: title.trim() || (ar ? "ورقة عمل" : "Worksheet"),
              language: contentLang,
              gradeLevel: gradeLevel.trim() || null,
              subject: subject.trim() || null,
              questions,
              settings,
            }}
            initialLayout={settings.layout ?? { elements: [] }}
            onSave={(layout) => setSettings(s => ({ ...s, layout }))}
            onClose={() => setCanvasEditorOpen(false)}
          />
        )}
      </AnimatePresence>

        {previewing && (
          <WorksheetWorkspaceOverlay
            ar={ar}
            data={{
              id: editingId ?? 0,
              title: title.trim() || (ar ? "ورقة عمل" : "Worksheet"),
              language: contentLang,
              gradeLevel: gradeLevel.trim() || null,
              subject: subject.trim() || null,
              questions,
              settings,
            }}
            onChange={patch => {
              if (patch.title !== undefined) setTitle(patch.title);
              if (patch.subject !== undefined) setSubject(patch.subject ?? "");
              if (patch.gradeLevel !== undefined) setGradeLevel(patch.gradeLevel ?? "");
              if (patch.questions !== undefined) setQuestions(patch.questions as Question[]);
              if (patch.settings !== undefined) setSettings(patch.settings);
            }}
            onSave={(latest) => saveWorksheet({ questions: latest.questions as Question[], settings: latest.settings })}
            saving={saving}
            initialMode={workspaceInitialMode}
            gradeSuggestions={gradeLevels.map(g => g.gradeLevel)}
            onClearProfile={() => {
              clearTeacherProfile();
              setSettings(s => ({ ...s, schoolName: "", section: "", teacherName: "", logoUrl: undefined, customFields: [] }));
            }}
            initialEditQuestionId={editQuestionId}
            autoExport={exportRequest}
            onAutoExportHandled={() => setExportRequest(null)}
            onClose={() => { setPreviewing(false); setEditQuestionId(null); }}
          />
        )}

      <AnimatePresence>
        {savedOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSavedOpen(false)}
          >
            <motion.div
              className="bg-background rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-border"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              dir={dir}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 flex items-center justify-between border-b bg-muted/20">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-primary" />
                  {ar ? "أوراق العمل المحفوظة" : "Saved Worksheets"}
                </div>
                <button onClick={() => setSavedOpen(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {savedLoading ? (
                  <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span>{ar ? "جارٍ التحميل..." : "Loading..."}</span>
                  </div>
                ) : savedRows.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {ar ? "لا توجد أوراق محفوظة بعد." : "No saved worksheets yet."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedRows.map(row => {
                      const isAdminShared = row.isShared && row.ownerIsAdmin;
                      return (
                        <div key={row.id} className="p-4 border rounded-2xl flex items-start gap-4 hover:border-primary/40 transition-colors bg-card shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <div className="font-bold text-sm truncate text-foreground">{row.title}</div>
                              {isAdminShared && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 font-bold">
                                  {ar ? "مشترك" : "Shared"}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {row.questions.length} {ar ? "سؤال" : "questions"}
                              {row.subject && ` · ${row.subject}`}
                              {row.gradeLevel && ` · ${row.gradeLevel}`}
                              {isAdminShared && row.ownerName && ` · ${row.ownerName}`}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                            {!isAdminShared && (
                              <button
                                onClick={() => openTemplate(row, false)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ar ? "تحرير" : "Edit"}</span>
                              </button>
                            )}
                            <button
                              onClick={() => openTemplate(row, true)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                            >
                              {ar ? "نسخة" : "Copy"}
                            </button>
                            <button
                              onClick={() => setLocation(`/teacher/worksheets/${row.id}/print`)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ar ? "طباعة" : "Print"}</span>
                            </button>
                            {!isAdminShared && (
                              <button
                                onClick={() => deleteTemplate(row.id)}
                                className="p-1.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                                title={ar ? "حذف" : "Delete"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-start", className)}>
      <div className="text-[11px] font-bold mb-1.5 text-muted-foreground px-1 text-start">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 justify-center transition-colors border",
        value ? "bg-primary/10 text-primary border-primary/30 shadow-sm" : "bg-background text-muted-foreground border-border hover:bg-muted"
      )}
    >
      {value && <Check className="w-3.5 h-3.5" />}
      {icon}
      {label}
    </button>
  );
}

function CompactStepper({ label, value, max, onChange }: { label: string, value: number, max: number, onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="flex items-center bg-background border border-border rounded-md overflow-hidden shadow-sm h-7">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
        >−</button>
        <span className="text-[11px] font-bold w-5 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
        >+</button>
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({ options, value, onChange }: { options: { label: string, value: T }[], value: T, onChange: (v: T) => void }) {
  return (
    <div className="flex bg-muted/60 p-1 rounded-xl w-full border border-border/50 h-11">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 text-[11px] font-bold rounded-lg transition-all truncate px-1",
            value === o.value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CollapsibleCard({ title, icon: Icon, isOpen, onToggle, summary, children }: { title: string, icon: any, isOpen: boolean, onToggle: () => void, summary?: string, children: React.ReactNode }) {
  return (
    <div className={cn("border rounded-2xl overflow-hidden transition-all bg-card", isOpen ? "border-primary/30 shadow-md" : "border-border/60 shadow-sm hover:border-primary/20")}>
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between bg-transparent transition-colors text-start">
        <div className="flex items-center gap-3">
           <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-inner", isOpen ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
             <Icon className="w-4 h-4" />
           </div>
           <div>
             <h3 className="font-bold text-sm text-foreground">{title}</h3>
             {summary && !isOpen && <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate">{summary}</p>}
           </div>
        </div>
        <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
             <div className="p-4 pt-0 border-t border-border/40 mt-2">
               {children}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionEditor({
  index, total, question, ar, onUpdate, onRemove, onMove, onChangeType, onRegenerateCell, regeneratingCellIndex, regenerateCreditPrice, onGenerateCellImage, generatingCellImageIndex, imageCreditPrice, forceExpanded, difficulty, assessmentMode, rubric, onRubricChange, canUndoRegeneration, onUndoRegeneration,
}: {
  index: number; total: number; question: Question; ar: boolean;
  onUpdate: (patch: Partial<Question>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onChangeType: (newType: QType) => void;
  onRegenerateCell: (cellIndex: number) => void;
  regeneratingCellIndex: number | null;
  regenerateCreditPrice: ToolCreditPrice | null;
  onGenerateCellImage: (cellIndex: number) => void;
  generatingCellImageIndex: number | null;
  imageCreditPrice: ToolCreditPrice | null;
  forceExpanded: boolean;
  difficulty: "auto" | "easy" | "medium" | "hard" | "mixed";
  assessmentMode: "diagnostic" | "formative" | "summative";
  rubric: string;
  onRubricChange: (rubric: string) => void;
  canUndoRegeneration: boolean;
  onUndoRegeneration: () => void;
}) {
  const [uploadingCell, setUploadingCell] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  useEffect(() => setIsExpanded(forceExpanded), [forceExpanded]);

  const difficultyLabel = difficulty === "auto"
    ? (ar ? "مستوى مناسب للصف" : "Grade-appropriate level")
    : difficulty === "easy"
    ? (ar ? "سهل" : "Easy")
    : difficulty === "hard"
      ? (ar ? "صعب" : "Hard")
      : difficulty === "mixed"
        ? (ar ? "متنوع" : "Mixed")
        : (ar ? "متوسط" : "Medium");

  return (
    <div id={`worksheet-question-${question.id}`} className={cn("scroll-mt-24 border border-border/60 rounded-2xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow", isExpanded ? "space-y-4" : "space-y-0")}>
      <div className={cn("flex items-center justify-between gap-2 flex-wrap", isExpanded ? "pb-3 border-b border-border/40" : "")}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground flex-shrink-0 shadow-sm">
            {index + 1}
          </span>
          <label className="text-xs font-bold flex items-center gap-1.5 text-primary">
            {typeIcon(question.type)}
            <select
              value={question.type}
              onChange={e => onChangeType(e.target.value as QType)}
              className="text-xs font-bold rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              title={ar ? "تغيير نوع السؤال" : "Change question type"}
            >
              <option value="mcq">{typeLabel("mcq", ar)}</option>
              <option value="true_false">{typeLabel("true_false", ar)}</option>
              <option value="short_answer">{typeLabel("short_answer", ar)}</option>
              <option value="fill_blank">{typeLabel("fill_blank", ar)}</option>
              <option value="matching">{typeLabel("matching", ar)}</option>
              <option value="worked_problem">{typeLabel("worked_problem", ar)}</option>
              <option value="extended_response">{typeLabel("extended_response", ar)}</option>
              <option value="error_correction">{typeLabel("error_correction", ar)}</option>
              <option value="word_bank">{typeLabel("word_bank", ar)}</option>
              <option value="compare">{typeLabel("compare", ar)}</option>
              <option value="tic_tac_toe">{typeLabel("tic_tac_toe", ar)}</option>
            </select>
          </label>
          <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-bold text-muted-foreground">
            {difficultyLabel}
          </span>
          {typeof question.points === "number" && question.points > 0 && (
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary">
              {question.points} {ar ? "درجة" : "pts"}
            </span>
          )}
          {!isExpanded && (
            <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
              {question.type === "tic_tac_toe" ? question.prompt : (question as any).prompt || (ar ? "سؤال فارغ" : "Empty question")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-background text-muted-foreground transition-colors" title={ar ? "طي/توسيع" : "Collapse/Expand"}>
            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="w-7 h-7 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors" title={ar ? "أعلى" : "Up"}><ArrowUp className="w-3.5 h-3.5"/></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="w-7 h-7 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors" title={ar ? "أسفل" : "Down"}><ArrowDown className="w-3.5 h-3.5"/></button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive transition-colors" title={ar ? "حذف" : "Delete"}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <Field label={assessmentMode === "formative" ? (ar ? "درجة اختيارية" : "Optional points") : (ar ? "درجة السؤال" : "Question points")}>
              <input
                type="number"
                min={0}
                max={100}
                value={question.points ?? 0}
                onChange={event => onUpdate({ points: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } as Partial<Question>)}
                className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary"
              />
            </Field>
            {(["short_answer", "extended_response", "worked_problem", "error_correction", "compare", "tic_tac_toe"] as QType[]).includes(question.type) && (
              <Field label={ar ? "معيار النجاح / سلم التقدير" : "Success criterion / rubric"}>
                <input
                  value={rubric}
                  onChange={event => onRubricChange(event.target.value)}
                  placeholder={ar ? "مثال: إجابة دقيقة مدعومة بمثال" : "e.g. Accurate answer supported by an example"}
                  maxLength={500}
                  className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary"
                />
              </Field>
            )}
          </div>
          {question.type !== "matching" && question.type !== "tic_tac_toe" && (
            <textarea
              value={question.prompt}
              onChange={e => onUpdate({ prompt: e.target.value } as any)}
              placeholder={ar ? "نص السؤال" : "Question text"}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-y min-h-[80px]"
        />
      )}

      {question.type === "mcq" && (
        <div className="space-y-2 mt-2">
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <button
                onClick={() => onUpdate({ correctIndex: i } as any)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                  question.correctIndex === i ? "border-emerald-500 bg-emerald-500 text-white shadow-sm" : "border-muted-foreground/30 bg-background text-transparent hover:border-emerald-500/50"
                )}
                title={ar ? "حدّد الإجابة الصحيحة" : "Mark correct"}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <input
                value={opt}
                onChange={e => {
                  const next = question.options.slice();
                  next[i] = e.target.value;
                  onUpdate({ options: next } as any);
                }}
                placeholder={`${ar ? "خيار" : "Option"} ${i + 1}`}
                className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
              />
              <button
                onClick={() => {
                  const next = question.options.filter((_, j) => j !== i);
                  if (next.length < 2) return;
                  const ci = question.correctIndex >= next.length ? 0 : (question.correctIndex > i ? question.correctIndex - 1 : question.correctIndex);
                  onUpdate({ options: next, correctIndex: ci } as any);
                }}
                disabled={question.options.length <= 2}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {question.options.length < 6 && (
            <button
              onClick={() => onUpdate({ options: [...question.options, ""] } as any)}
              className="text-xs font-bold flex items-center gap-1 text-primary hover:text-primary/80 transition-colors mt-1 px-1"
            >
              <Plus className="w-3.5 h-3.5" /> {ar ? "أضف خيارًا" : "Add option"}
            </button>
          )}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="flex gap-3 mt-2">
          {([true, false] as const).map(v => (
            <button
              key={String(v)}
              onClick={() => onUpdate({ correct: v } as any)}
              className={cn(
                "flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2",
                question.correct === v ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shadow-sm" : "border-border bg-background hover:bg-muted text-muted-foreground"
              )}
            >
              {v ? (ar ? "صح" : "True") : (ar ? "خطأ" : "False")}
              {question.correct === v && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}

      {question.type === "short_answer" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <Field label={ar ? "عدد الأسطر للطباعة" : "Lines for printing"}>
            <input
              type="number" min={1} max={20}
              value={question.lines ?? 2}
              onChange={e => onUpdate({ lines: Math.max(1, Math.min(20, parseInt(e.target.value || "2", 10))) } as any)}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
            />
          </Field>
          <Field label={ar ? "إجابة نموذجية (تظهر في المفتاح)" : "Model answer (key)"}>
            <input
              value={question.answer ?? ""}
              onChange={e => onUpdate({ answer: e.target.value } as any)}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
            />
          </Field>
        </div>
      )}

      {question.type === "short_answer" && question.activity && (
        <div className="mt-2 rounded-xl border p-3">
          <div className="mb-2 text-sm font-bold">{ACTIVITY_LABELS[question.activity.kind]?.[ar ? 0 : 1]}</div>
          <WorksheetActivityEditor activity={question.activity} ar={ar} onChange={activity => onUpdate({ activity } as any)} />
        </div>
      )}

      {question.type === "fill_blank" && (
        <Field label={ar ? "الإجابة الصحيحة (تظهر في صفحة الإجابات)" : "Answer (shown in answer key)"} className="mt-2">
          <input
            value={question.answer}
            onChange={e => onUpdate({ answer: e.target.value } as any)}
            placeholder={ar ? "الكلمة الصحيحة" : "Correct word/phrase"}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
          />
          <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5 px-1">
            <span className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold tracking-widest text-foreground">____</span>
            {ar ? 'تأكد من كتابة الفراغ بهذا الشكل في نص السؤال.' : 'Make sure to use this for the blank in the prompt.'}
          </div>
        </Field>
      )}

      {question.type === "matching" && (
        <div className="space-y-3 mt-2">
          <input
            value={question.prompt ?? ""}
            onChange={e => onUpdate({ prompt: e.target.value } as any)}
            placeholder={ar ? "تعليمات (اختياري)، مثل: صل بين العمودين" : "Instruction (optional), e.g., Match the columns"}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
          />
          <div className="space-y-2 bg-muted/20 p-2 rounded-xl border border-border/50">
            {question.pairs.map((pair, i) => (
              <div key={i} className="flex gap-2 items-center group">
                <input
                  value={pair.left}
                  onChange={e => {
                    const next = question.pairs.slice();
                    next[i] = { ...next[i], left: e.target.value };
                    onUpdate({ pairs: next } as any);
                  }}
                  placeholder={`${ar ? "العمود الأول" : "Left"} ${i + 1}`}
                  className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
                />
                <span className="text-muted-foreground/50 font-bold">↔</span>
                <input
                  value={pair.right}
                  onChange={e => {
                    const next = question.pairs.slice();
                    next[i] = { ...next[i], right: e.target.value };
                    onUpdate({ pairs: next } as any);
                  }}
                  placeholder={`${ar ? "العمود الثاني" : "Right"} ${i + 1}`}
                  className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none transition-all"
                />
                <button
                  onClick={() => {
                    const next = question.pairs.filter((_, j) => j !== i);
                    if (next.length < 2) return;
                    onUpdate({ pairs: next } as any);
                  }}
                  disabled={question.pairs.length <= 2}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {question.pairs.length < 10 && (
            <button
              onClick={() => onUpdate({ pairs: [...question.pairs, { left: "", right: "" }] } as any)}
              className="text-xs font-bold flex items-center gap-1 text-primary hover:text-primary/80 transition-colors px-1"
            >
              <Plus className="w-3.5 h-3.5" /> {ar ? "إضافة زوج" : "Add pair"}
            </button>
          )}
        </div>
      )}

      {question.type === "worked_problem" && (
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-3 mt-2">
          <Field label={ar ? "عدد مساحات الخطوات" : "Work steps"}>
            <input type="number" min={1} max={8} value={question.steps ?? 3} onChange={e => onUpdate({ steps: Math.max(1, Math.min(8, Number(e.target.value) || 3)) } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none" />
          </Field>
          <Field label={ar ? "الإجابة النهائية النموذجية" : "Final model answer"}>
            <input value={question.answer} onChange={e => onUpdate({ answer: e.target.value } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none" />
          </Field>
        </div>
      )}

      {question.type === "extended_response" && (
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-3 mt-2">
          <Field label={ar ? "عدد أسطر الإجابة" : "Answer lines"}>
            <input type="number" min={4} max={30} value={question.lines ?? 8} onChange={e => onUpdate({ lines: Math.max(4, Math.min(30, Number(e.target.value) || 8)) } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none" />
          </Field>
          <Field label={ar ? "إجابة نموذجية / عناصر متوقعة" : "Model answer / expected points"}>
            <textarea value={question.answer ?? ""} onChange={e => onUpdate({ answer: e.target.value } as any)} rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:border-primary outline-none resize-y" />
          </Field>
        </div>
      )}

      {question.type === "error_correction" && (
        <div className="space-y-3 mt-2">
          <Field label={ar ? "النص أو الحل الذي يحتوي الخطأ" : "Incorrect statement or solution"}>
            <textarea value={question.incorrectText} onChange={e => onUpdate({ incorrectText: e.target.value } as any)} rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:border-primary outline-none resize-y" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={ar ? "التصحيح النموذجي" : "Model correction"}>
              <input value={question.correction} onChange={e => onUpdate({ correction: e.target.value } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none" />
            </Field>
            <Field label={ar ? "التعليل النموذجي (اختياري)" : "Model explanation (optional)"}>
              <input value={question.explanation ?? ""} onChange={e => onUpdate({ explanation: e.target.value } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:border-primary outline-none" />
            </Field>
          </div>
        </div>
      )}

      {question.type === "word_bank" && (
        <div className="space-y-3 mt-2">
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
            {question.items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input value={item} onChange={e => { const items = question.items.slice(); items[i] = e.target.value; onUpdate({ items } as any); }} placeholder={`${ar ? "الجملة أو الفراغ" : "Sentence or blank"} ${i + 1}`} className="h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
                <input value={question.answers[i] ?? ""} onChange={e => { const answers = question.answers.slice(); answers[i] = e.target.value; onUpdate({ answers } as any); }} placeholder={ar ? "الكلمة الصحيحة" : "Correct word"} className="h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
                <button type="button" disabled={question.items.length <= 2} onClick={() => onUpdate({ items: question.items.filter((_, j) => j !== i), answers: question.answers.filter((_, j) => j !== i) } as any)} className="w-8 h-8 grid place-items-center rounded-lg text-destructive disabled:opacity-30"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {question.items.length < 10 && <button type="button" onClick={() => onUpdate({ items: [...question.items, ""], answers: [...question.answers, ""] } as any)} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{ar ? "إضافة فراغ" : "Add blank"}</button>}
        </div>
      )}

      {question.type === "compare" && (
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={ar ? "العنصر الأول" : "First item"}><input value={question.leftLabel} onChange={e => onUpdate({ leftLabel: e.target.value } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" /></Field>
            <Field label={ar ? "العنصر الثاني" : "Second item"}><input value={question.rightLabel} onChange={e => onUpdate({ rightLabel: e.target.value } as any)} className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={ar ? "أوجه الشبه النموذجية" : "Model similarities"}><textarea value={question.similarities ?? ""} onChange={e => onUpdate({ similarities: e.target.value } as any)} rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:border-primary" /></Field>
            <Field label={ar ? "أوجه الاختلاف النموذجية" : "Model differences"}><textarea value={question.differences ?? ""} onChange={e => onUpdate({ differences: e.target.value } as any)} rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:border-primary" /></Field>
          </div>
        </div>
      )}

      {question.type === "tic_tac_toe" && (
        <div className="space-y-3 mt-2">
          {canUndoRegeneration && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="text-xs font-bold text-primary">
                {ar ? "يمكن استرجاع المربع قبل إعادة التوليد." : "You can restore the square from before regeneration."}
              </span>
              <button type="button" onClick={onUndoRegeneration} className="shrink-0 rounded-lg border border-primary/25 bg-background px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5">
                {ar ? "تراجع" : "Undo"}
              </button>
            </div>
          )}
          <textarea
            value={question.prompt}
            onChange={e => onUpdate({ prompt: e.target.value } as any)}
            rows={2}
            className="w-full px-4 py-3 rounded-xl border bg-background text-sm focus:border-primary outline-none resize-y"
            placeholder={ar ? "تعليمات اختيار ثلاثة مربعات متصلة" : "Instructions for choosing three connected squares"}
          />
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {question.cells.map((cell, i) => (
                <div key={i} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{ar ? `المربع ${i + 1}` : `Square ${i + 1}`}</span>
                    <div className="flex items-center gap-1.5">
                      {cell.imageSuggested && !cell.imageUrl && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          {ar ? "تُفيدها صورة" : "Image suggested"}
                        </span>
                      )}
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => onRegenerateCell(i)}
                        disabled={regeneratingCellIndex !== null}
                        className="h-7 px-2 rounded-lg border bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1 text-[10px] font-bold"
                        title={ar ? "إعادة توليد هذا المربع فقط" : "Regenerate only this square"}
                      >
                        {regeneratingCellIndex === i
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                        {ar ? "إعادة توليد" : "Regenerate"}
                        {regenerateCreditPrice?.creditsEnabled && regenerateCreditPrice.effectiveCost > 0 && (
                          <span className="font-normal opacity-80">
                            ({regenerateCreditPrice.effectiveCost} {ar ? "نقطة" : "credits"})
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {ar ? "تصنيف داخلي" : "Internal category"}
                    </span>
                    <input
                      value={cell.category}
                      onChange={e => {
                        const cells = question.cells.map((item, j) => j === i ? { ...item, category: e.target.value } : item);
                        onUpdate({ cells } as any);
                      }}
                      className="min-w-0 flex-1 h-7 px-2 rounded-md border bg-muted/30 text-[10px] text-muted-foreground"
                      placeholder={ar ? "رسم، تفسير..." : "Draw, explain..."}
                    />
                  </div>
                  <textarea
                    value={cell.text}
                    onChange={e => {
                      const cells = question.cells.map((item, j) => j === i ? { ...item, text: e.target.value } : item);
                      onUpdate({ cells } as any);
                    }}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-y"
                    placeholder={ar ? "اكتب مهمة متنوعة للطالب" : "Write a varied student task"}
                  />
                  {cell.imageUrl && (
                    <div className="relative rounded-lg border bg-muted/20 p-1">
                      <img src={resolveImageUrl(cell.imageUrl) ?? ""} alt="" className="w-full h-24 object-contain rounded-md" />
                      <button
                        type="button"
                        onClick={() => {
                          const cells = question.cells.map((item, j) => j === i ? { ...item, imageUrl: undefined } : item);
                          onUpdate({ cells } as any);
                        }}
                        className="absolute top-1 end-1 w-6 h-6 rounded-full bg-background/90 border flex items-center justify-center text-destructive"
                        title={ar ? "إزالة الصورة" : "Remove image"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <label className="h-9 px-3 rounded-lg border border-dashed bg-muted/20 hover:bg-muted/40 text-xs font-bold text-primary flex items-center justify-center gap-2 cursor-pointer">
                    {uploadingCell === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {cell.imageUrl
                      ? (ar ? "استبدال الصورة" : "Replace image")
                      : (ar ? "إضافة صورة" : "Add image")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="sr-only"
                      disabled={uploadingCell !== null}
                      onChange={async event => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        setUploadingCell(i);
                        try {
                          const imageUrl = await uploadWorksheetCellImage(file);
                          const cells = question.cells.map((item, j) => j === i ? { ...item, imageUrl } : item);
                          onUpdate({ cells } as any);
                          toast.success(ar ? "تمت إضافة الصورة" : "Image added");
                        } catch {
                          toast.error(ar ? "تعذّر رفع الصورة" : "Could not upload image");
                        } finally {
                          setUploadingCell(null);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onGenerateCellImage(i)}
                    disabled={generatingCellImageIndex !== null || regeneratingCellIndex !== null || !cell.text.trim() || !imageCreditPrice}
                    className="w-full h-9 px-3 rounded-lg border bg-primary/5 hover:bg-primary/10 text-xs font-bold text-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingCellImageIndex === i
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    {cell.imageUrl
                      ? (ar ? "توليد صورة بديلة" : "Generate replacement image")
                      : (ar ? "توليد صورة مناسبة" : "Generate suitable image")}
                    {imageCreditPrice?.creditsEnabled && imageCreditPrice.effectiveCost > 0 && (
                      <span className="font-normal opacity-80">
                        ({imageCreditPrice.effectiveCost} {ar ? "نقطة" : "credits"})
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {ar ? "استخدم ٣ أنواع مهام مختلفة على الأقل. ارفع صورة تعليمية إلى أي مربع يحتاج ملاحظة أو تفسيرًا بصريًا." : "Use at least 3 task types. Upload an educational image for any visual observation or interpretation task."}
            </p>
          </div>
        </div>
      )}

        </div>
      )}
    </div>
  );
}

function WorksheetWorkspaceOverlay({
  ar, data, onChange, onClose, autoExport, onAutoExportHandled, onSave, initialEditQuestionId, initialMode = "edit", saving = false, gradeSuggestions, onClearProfile,
}: {
  /** Persists the canonical draft (called after the overlay flushes its live edits). */
  onSave?: (latest: { questions: Question[]; settings: WorksheetData["settings"] }) => Promise<number | null>;
  saving?: boolean;
  initialMode?: "edit" | "preview";
  gradeSuggestions?: string[];
  onClearProfile?: () => void;
  initialEditQuestionId?: string | null;
  autoExport?: "pdf" | "word" | "word-visual" | null;
  onAutoExportHandled?: () => void;
  ar: boolean;
  data: WorksheetData;
  onChange: (patch: Partial<Pick<WorksheetData, "title" | "subject" | "gradeLevel" | "questions" | "settings">>) => void;
  onClose: () => void;
}) {
  const flushRef = useRef<(() => LayoutSnapshot) | null>(null);
  const exportInFlightRef = useRef(false);
  const [mode, setMode] = useState<"edit" | "preview">(initialMode);
  // Always merge onto the latest settings so header edits and layout edits never clobber each other.
  const settingsRef = useRef(data.settings);
  settingsRef.current = data.settings;

  const applySnapshot = (snap: LayoutSnapshot) => {
    const next = { ...settingsRef.current, pageBreaks: snap.pageBreaks, questionStyles: snap.questionStyles };
    settingsRef.current = next;
    onChange({ questions: snap.questions, settings: next });
  };
  const flush = () => { const snap = flushRef.current?.(); if (snap) applySnapshot(snap); };
  const changeMode = (next: "edit" | "preview") => {
    if (exportInFlightRef.current) return;
    flush();
    setMode(next);
  };

  const [wordExport, setWordExport] = useState<WorksheetWordMode | null>(null);
  const [wordProgress, setWordProgress] = useState("");
  const handleWord = async (wordMode: WorksheetWordMode = "editable") => {
    if (exportInFlightRef.current || saving) return;
    const snap = flushRef.current?.();
    if (snap) applySnapshot(snap);
    const root = document.getElementById("ws-printable-root");
    if (!root) {
      toast.error(ar ? "تعذّر إعداد الملف" : "Could not prepare file");
      return;
    }
    const wordFit = fitBlockMessage(settingsRef.current.targetPages, countWorksheetPages(), ar);
    if (wordFit) { toast.error(wordFit); return; }
    exportInFlightRef.current = true;
    setExportBusy(true);
    setWordExport(wordMode);
    setWordProgress("");
    try {
      if (wordMode === "visual") {
        let worksheetId = data.id;
        if (!worksheetId && onSave) {
          // The raster renderer requires an owned saved worksheet. Persist the
          // exact flushed draft, not yesterday's preview or a stale React value.
          worksheetId = await onSave({
            questions: (snap?.questions ?? data.questions) as Question[],
            settings: settingsRef.current,
          }) ?? 0;
          if (!worksheetId) return; // Save already reports its validation/error.
        }
        if (!worksheetId) throw new Error("worksheet-save-required");
        await downloadVisualWorksheetWord({
          element: root, title: data.title, lang: data.language, worksheetId,
          onProgress: (done, total) => setWordProgress(`${done}/${total}`),
        });
      } else {
        await downloadAsWord({ element: root, title: `${data.title} - ${ar ? "قابل للتعديل" : "Editable"}`, lang: data.language });
      }
      toast.success(ar ? "تم تجهيز ملف Word للتنزيل" : "Word file ready for download");
    } catch (error) {
      toast.error(error instanceof VisualWordExportError && error.code === "busy"
        ? (ar ? "خدمة التصدير مشغولة؛ أعد المحاولة بعد قليل." : "The export service is busy. Try again shortly.")
        : error instanceof VisualWordExportError && error.code === "image"
        ? (ar ? "تعذّر تحميل إحدى الصور. لم يُصدّر ملف ناقص؛ أعد المحاولة بعد تحميل الصور." : "A design image could not load. No incomplete file was exported; try again after images load.")
        : error instanceof Error && error.message === "worksheet-save-required"
        ? (ar ? "احفظ الورقة أولًا لتصديرها كصور داخل Word." : "Save the worksheet before exporting page images to Word.")
        : (ar ? "تعذّر تصدير ملف Word. يرجى المحاولة مرة أخرى." : "Could not export the Word file. Please try again."));
    } finally {
      exportInFlightRef.current = false;
      setExportBusy(false);
      setWordExport(null);
      setWordProgress("");
    }
  };

  const close = () => {
    if (exportInFlightRef.current) return;
    flush();
    onClose();
  };

  const [exportBusy, setExportBusy] = useState(false);
  const handlersRef = useRef({ handleWord, flush, title: data.title, onSave });
  handlersRef.current = { handleWord, flush, title: data.title, onSave };
  const [pdfFailed, setPdfFailed] = useState<string | null>(null);
  const runPdf = async () => {
    if (exportInFlightRef.current || saving) return;
    const pdfFit = fitBlockMessage(settingsRef.current.targetPages, countWorksheetPages(), ar);
    if (pdfFit) { setPdfFailed(pdfFit); toast.error(pdfFit); return; }
    exportInFlightRef.current = true;
    setExportBusy(true);
    setPdfFailed(null);
    try { flush(); await printToPdf(data.title); }
    catch (error) { setPdfFailed(pdfExportErrorMessage(error, ar)); }
    finally { exportInFlightRef.current = false; setExportBusy(false); }
  };

  const runPdfRef = useRef(runPdf);
  runPdfRef.current = runPdf;

  const handleSave = () => {
    if (exportInFlightRef.current || saving) return;
    // Use the exact flushed snapshot; no timing dependency on React commits.
    const snap = flushRef.current?.();
    if (snap) applySnapshot(snap);
    void handlersRef.current.onSave?.({
      questions: (snap?.questions ?? data.questions) as Question[],
      settings: settingsRef.current,
    });
  };

  // Export only once the single renderer is mounted, its flush ref exists and
  // pagination has produced a stable set of pages (no fixed delay).
  useEffect(() => {
    if (!autoExport) return;
    const kind = autoExport;
    onAutoExportHandled?.();
    let cancelled = false;
    let frame = 0;
    const run = async () => {
      try {
        await Promise.race([
          document.fonts?.ready,
          new Promise(resolve => setTimeout(resolve, 2000)),
        ]);
      } catch { /* Exporters handle required worksheet resources themselves. */ }
      let stable = 0;
      let lastCount = -1;
      const started = performance.now();
      while (!cancelled && performance.now() - started < 5000) {
        await new Promise<void>(resolve => { frame = requestAnimationFrame(() => resolve()); });
        const root = document.getElementById("ws-printable-root");
        const pagesNow = root ? root.querySelectorAll("[data-worksheet-page]").length : 0;
        const ready = !!root && pagesNow > 0 && !!flushRef.current;
        stable = ready && pagesNow === lastCount ? stable + 1 : 0;
        lastCount = pagesNow;
        if (stable >= 3) break;
      }
      if (cancelled) return;
      if (kind === "word" || kind === "word-visual") void handlersRef.current.handleWord(kind === "word-visual" ? "visual" : "editable");
      else { void runPdfRef.current(); }
    };
    void run();
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] bg-neutral-200 overflow-auto"
      dir={data.language === "ar" ? "rtl" : "ltr"}
    >
      <div className="no-print sticky top-0 z-40 border-b shadow-sm bg-white" data-testid="toolbar-worksheet-workspace">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <button
            onClick={close}
            disabled={exportBusy}
            data-testid="button-close-preview"
            className="px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 hover:bg-muted transition-colors text-primary border-primary/30"
          >
            <ArrowLeft className="w-4 h-4" />
            {ar ? "رجوع" : "Back"}
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-primary hidden sm:block">
            {data.title}
          </div>
          <div className="order-3 flex w-full justify-center sm:order-none sm:w-auto">
            <WorksheetModeSwitch ar={ar} mode={mode} onChange={changeMode} disabled={exportBusy} />
          </div>
          <div className="ms-auto flex gap-2 flex-wrap justify-end">
            {onSave && (
              <button
                onClick={handleSave}
                disabled={exportBusy || saving}
                data-testid="button-preview-save"
                className="px-4 py-2 rounded-xl text-sm font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? (ar ? "جار الحفظ" : "Saving") : (ar ? "حفظ" : "Save")}
              </button>
            )}
            <WorksheetWordExportMenu
              ar={ar}
              onExport={mode => void handleWord(mode)}
              disabled={exportBusy || saving}
              busy={!!wordExport}
              progress={wordProgress}
              testId="button-preview-word"
              className="px-3 py-2 rounded-xl text-sm font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
            />
            <button
              onClick={() => void runPdf()}
              disabled={exportBusy || saving}
              data-testid="button-preview-pdf"
              className="px-3 py-2 rounded-xl text-sm font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
              title={ar ? "حفظ الورقة كملف PDF" : "Save worksheet as PDF"}
            >
              <Download className="w-4 h-4" /> {ar ? "حفظ PDF" : "Save PDF"}
            </button>
          </div>
        </div>
        {pdfFailed && (
          <div role="alert" className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800" data-testid="alert-preview-pdf-error">
            <span className="flex-1">{pdfFailed}</span>
            <button onClick={() => void runPdf()} disabled={exportBusy} className="px-3 py-1 rounded-md bg-white border font-bold" data-testid="button-retry-preview-pdf">{ar ? "إعادة المحاولة" : "Retry"}</button>
          </div>
        )}
      </div>
          <div inert={exportBusy || undefined} className={`no-print mx-auto max-w-7xl px-3 py-3 sm:px-5 ${mode === "preview" ? "hidden" : ""}`} dir={ar ? "rtl" : "ltr"}>
            <WorksheetFormatPanel
              ar={ar}
              showProfileNote
              gradeSuggestions={gradeSuggestions}
              onClearProfile={onClearProfile}
              settings={data.settings}
              onSettingsChange={updater => {
                const next = updater(settingsRef.current);
                settingsRef.current = next;
                onChange({ settings: next });
              }}
              meta={{ title: data.title, subject: data.subject ?? "", gradeLevel: data.gradeLevel ?? "" }}
              onMetaChange={patch => onChange({
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
                ...(patch.gradeLevel !== undefined ? { gradeLevel: patch.gradeLevel } : {}),
              })}
            />
          </div>
      <div inert={exportBusy || undefined} className="px-2 py-3 sm:px-5 sm:py-5 flex justify-center pb-16" data-worksheet-mode={mode}>
        <div className="max-w-[210mm] w-full bg-white shadow-2xl relative" style={{ minHeight: "297mm" }}>
          <WorksheetPrintView
            data={data}
            flushRef={flushRef}
            onDraftChange={applySnapshot}
            onLayoutChange={(qs, breaks, styles) => applySnapshot({ questions: qs, pageBreaks: breaks, questionStyles: styles })}
            initialEditQuestionId={initialEditQuestionId}
            editing={mode === "edit"}
            onEditingChange={editing => changeMode(editing ? "edit" : "preview")}
          />
        </div>
      </div>
    </motion.div>
  );
}
