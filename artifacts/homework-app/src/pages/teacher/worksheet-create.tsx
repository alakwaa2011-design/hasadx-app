import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowLeft, Printer, Download, RotateCcw, LayoutTemplate, ChevronDown, Layers, ArrowUp, ArrowDown
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
import { WorksheetPrintView, type WorksheetData } from "@/pages/teacher/worksheet-print";
import { downloadAsWord, printToPdf } from "@/lib/print-export";
import WorksheetCanvasEditor from "@/pages/teacher/worksheet-canvas-editor";
import type { CanvasLayout } from "@/pages/teacher/worksheet-canvas-types";
import type { WorksheetSettings } from "@workspace/api-zod";
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
  const { uploadURL, objectPath } = await request.json();
  const upload = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error("image-upload-failed");
  return objectPath;
}
const MAX_SOURCE_TEXT_LENGTH = 12000;

const WS_PREFS_KEY = "hasad:worksheet:prefs";

interface WsPrefs {
  contentLang?: "ar" | "en";
  aiDifficulty?: "easy" | "medium" | "hard" | "mixed";
  aiPages?: 1 | 2 | 3;
  aiCounts?: { mcq: number; true_false: number; short_answer: number; fill_blank: number; matching: number; tic_tac_toe: number };
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
  aiCounts: { mcq: 4, true_false: 2, short_answer: 2, fill_blank: 2, matching: 0, tic_tac_toe: 0 },
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
      result.aiCounts = { mcq, true_false: tf, short_answer: sa, fill_blank: fb, matching: ma, tic_tac_toe: ttt };
    }
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

type QType = "mcq" | "true_false" | "short_answer" | "fill_blank" | "matching" | "tic_tac_toe";

interface QMcq { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
interface QTF { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
interface QShort { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number }
interface QFill { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
interface QMatch { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
interface QTicTacToeCell { text: string; category: string; imageUrl?: string; imageSuggested?: boolean }
interface QTicTacToe { id: string; type: "tic_tac_toe"; prompt: string; cells: QTicTacToeCell[]; points?: number }
type Question = QMcq | QTF | QShort | QFill | QMatch | QTicTacToe;
const TIC_TAC_TOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

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
    tic_tac_toe: "تيك تاك توك",
  };
  const enMap: Record<QType, string> = {
    mcq: "Multiple Choice",
    true_false: "True / False",
    short_answer: "Short Answer",
    fill_blank: "Fill the Blank",
    matching: "Matching",
    tic_tac_toe: "Tic-Tac-Toe Choice Board",
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
  const [aiCounts, setAiCounts] = useState<{ mcq: number; true_false: number; short_answer: number; fill_blank: number; matching: number; tic_tac_toe: number }>(
    _wsPrefs.aiCounts ?? { mcq: 4, true_false: 2, short_answer: 2, fill_blank: 2, matching: 0, tic_tac_toe: 0 },
  );
  const [generating, setGenerating] = useState(false);
  const [regeneratingCell, setRegeneratingCell] = useState<{ questionId: string; cellIndex: number } | null>(null);
  const [generatingCellImage, setGeneratingCellImage] = useState<{ questionId: string; cellIndex: number } | null>(null);
  const [activeAiTab, setActiveAiTab] = useState("topic");

  const wsDidMountRef = useRef(false);
  const wsSkipNextSaveRef = useRef(false);
  useEffect(() => {
    if (!wsDidMountRef.current) { wsDidMountRef.current = true; return; }
    if (wsSkipNextSaveRef.current) { wsSkipNextSaveRef.current = false; return; }
    saveWsPrefs({ contentLang, aiDifficulty, aiPages, aiCounts });
  }, [contentLang, aiDifficulty, aiPages, aiCounts]);

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

  const totalQs = questions.length;
  const aiTotal = aiCounts.mcq + aiCounts.true_false + aiCounts.short_answer + aiCounts.fill_blank + aiCounts.matching + aiCounts.tic_tac_toe;
  const aiMaxTotal = aiPages * 30;
  const canSave = title.trim().length >= 2 && totalQs >= 1;

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(q => (q.id === id ? ({ ...q, ...patch } as Question) : q)));
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

  const generateWithAI = async () => {
    if (saveBlockedRef.current || saveInFlightRef.current || contentOperationInFlightRef.current) {
      toast.error(ar ? "أعد محاولة حفظ التوليد الحالي أولاً" : "Retry saving the current generation first");
      return;
    }
    if (!aiTopic.trim() && !sourceText.trim()) {
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
          topic: aiTopic.trim(),
          sourceText: sourceText.trim() || undefined,
          subject: subject.trim() || undefined,
          gradeLevel: gradeLevel.trim() || undefined,
          difficulty: aiDifficulty,
          pages: aiPages,
          counts: aiCounts,
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
       const nextTitle = current.title.trim() || aiTopic.trim().slice(0, 80) || sourceText.trim().split(/\r?\n/)[0].slice(0, 80);
      const lastTheme = getLastTheme();
      const chosenTheme = selectTheme(
        current.subject.trim() || null,
        current.gradeLevel.trim() || null,
        resolvedLanguage,
        generated.length,
        lastTheme,
      );
      const nextSettings = { ...current.settings, template: chosenTheme };

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
      if (!latest.questions.some(q => q.id === questionId && q.type === "tic_tac_toe")) return;
      const nextQuestions = latest.questions.map(q => {
        if (q.id !== questionId || q.type !== "tic_tac_toe") return q;
        return {
          ...q,
          cells: q.cells.map((cell, index) => index === cellIndex ? data.cell : cell),
        };
      });
      setQuestions(nextQuestions);
      latestWorksheetRef.current = { ...latest, questions: nextQuestions };
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
      fd.append("difficulty", aiDifficulty);
      fd.append("pages", String(aiPages));
      if (aiTopic.trim()) fd.append("topicHint", aiTopic.trim());
      fd.append("counts", JSON.stringify(aiCounts));

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
      const nextSettings = { ...current.settings, template: chosenThemeF };

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
      if (requestedTotal > 0 && generated.length < requestedTotal) {
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
        if (q.cells.length !== 9) return ar ? "لوحة تيك تاك توك تحتاج ٩ مربعات" : "The Tic-Tac-Toe board needs 9 cells";
        if (q.cells.some(cell => !cell.text.trim() || !cell.category.trim())) return ar ? "أكمل مهام وتصنيفات مربعات تيك تاك توك" : "Complete every Tic-Tac-Toe task and category";
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
    }
    return null;
  };

  const saveWorksheet = async (): Promise<number | null> => {
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
      questions,
      settings,
      smartGrading,
    }, false);
  };

  const saveAndPreview = async () => {
    const id = await saveWorksheet();
    if (id) setLocation(`/teacher/worksheets/${id}/print`);
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
        className="max-w-4xl mx-auto px-4 py-8 pb-56 space-y-6"
        onInput={markEditDirty}
        onChange={markEditDirty}
      >
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

        {/* 1. Worksheet Details Prominent Near Top */}
        <Card className="p-5 border border-border/60 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={ar ? "عنوان الورقة" : "Worksheet Title"} className="md:col-span-1">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={ar ? "مثال: مراجعة عامة" : "e.g., General Review"}
                className="w-full h-11 px-3 rounded-xl border bg-background font-semibold text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
              />
            </Field>
            <Field label={ar ? "المادة" : "Subject"}>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={ar ? "رياضيات، علوم..." : "Math, Science..."}
                className="w-full h-11 px-3 rounded-xl border bg-background font-medium text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
              />
            </Field>
            <Field label={ar ? "المرحلة الدراسية" : "Grade"}>
              <input
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
                placeholder={ar ? "الصف الخامس..." : "Grade 5..."}
                list="ws-grade-levels"
                className="w-full h-11 px-3 rounded-xl border bg-background font-medium text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
              />
              <datalist id="ws-grade-levels">
                {gradeLevels.map(g => <option key={g.gradeLevel} value={g.gradeLevel} />)}
              </datalist>
            </Field>
          </div>
        </Card>

        {/* 2. Smart Generator Block */}
        <Card className="border-2 border-primary/20 shadow-lg relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent">
          <div className="absolute top-0 left-0 p-8 opacity-5 pointer-events-none transform -scale-x-100">
            <Wand2 className="w-64 h-64" />
          </div>
          <div className="relative z-10 p-5 sm:p-6 border-b border-primary/10 space-y-4">
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
          </div>

          <div className="px-5 py-4 sm:px-6 bg-background/60">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 mb-2 rounded-lg hover:bg-muted text-sm font-bold text-foreground transition-colors group text-start">
                <span className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  {ar ? "إعدادات التوليد المتقدمة" : "Advanced Generation Settings"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Field label={ar ? "لغة المحتوى" : "Language"}>
                      <SegmentedControl
                         value={contentLang}
                         onChange={setContentLang as any}
                         options={[{label: ar?"العربية":"Arabic", value:"ar"}, {label: ar?"English":"English", value:"en"}]}
                      />
                   </Field>
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
                </div>

                {/* Counts row - compact */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3 bg-muted/40 rounded-xl border border-border/50">
                  <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4"/> {ar ? "توزيع الأسئلة:" : "Distribution:"}
                  </div>
                  {(["mcq", "true_false", "short_answer", "fill_blank", "matching", "tic_tac_toe"] as const).map(k => (
                    <CompactStepper
                      key={k}
                      label={typeLabel(k, ar)}
                      value={aiCounts[k]}
                      max={k === "tic_tac_toe" ? 1 : k === "matching" ? Math.min(10, aiPages * 4) : Math.min(40, aiPages * 14)}
                      onChange={v => setAiCounts(prev => ({ ...prev, [k]: v }))}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                 onClick={activeAiTab === "topic" ? generateWithAI : extractFromFile}
                 disabled={generating || extracting || autoSaveStatus === "saving" || autoSaveStatus === "error"}
                 className="flex-1 h-14 text-lg font-black rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-50 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                 {(generating || extracting) ? <><Loader2 className="w-5 h-5 animate-spin"/> {ar?"جارٍ التوليد...":"Generating..."}</> : <><Sparkles className="w-5 h-5"/> {activeAiTab === "topic" ? (ar?"توليد الأسئلة":"Generate Questions") : (ar?"استخراج الأسئلة":"Extract Questions")}</>}
              </button>
              <button
                onClick={handleWsRestoreDefaults}
                title={ar ? "استعادة الإعدادات الافتراضية" : "Restore defaults"}
                className="h-14 w-14 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors flex-shrink-0"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* 3. Settings Area (Header Info & Design/Format) */}
        <Card className="border border-border/60 shadow-sm overflow-hidden">
          <Tabs defaultValue="header" className="w-full text-start" dir={dir}>
            <div className="border-b border-border/50 bg-muted/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                   <LayoutTemplate className="w-4 h-4" />
                 </div>
                 <h3 className="font-bold text-sm text-foreground">{ar ? "تنسيق الورقة" : "Worksheet Formatting"}</h3>
               </div>
               <TabsList className="bg-muted/50 w-full sm:w-auto h-auto p-1 justify-start">
                 <TabsTrigger value="header" className="flex-1 sm:flex-none text-xs font-bold gap-1.5 py-1.5"><Building2 className="w-3.5 h-3.5"/>{ar ? "بيانات الترويسة" : "Header Data"}</TabsTrigger>
                 <TabsTrigger value="design" className="flex-1 sm:flex-none text-xs font-bold gap-1.5 py-1.5"><SettingsIcon className="w-3.5 h-3.5"/>{ar ? "التصميم" : "Design"}</TabsTrigger>
               </TabsList>
            </div>

            <TabsContent value="header" className="p-5 outline-none m-0">

<div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {ar ? "تُحفظ تلقائياً لكل أوراقك القادمة" : "Saved automatically for future sheets"}
                </p>
                {(settings.schoolName || settings.section || settings.teacherName || settings.logoUrl || (settings.customFields ?? []).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      clearTeacherProfile();
                      setSettings(s => ({ ...s, schoolName: "", section: "", teacherName: "", logoUrl: undefined, customFields: [] }));
                    }}
                    className="text-[11px] font-bold text-destructive hover:underline"
                  >
                    {ar ? "مسح المحفوظ" : "Clear saved"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={ar ? "اسم المدرسة" : "School name"}>
                  <input
                    value={settings.schoolName ?? ""}
                    onChange={e => setSettings(s => ({ ...s, schoolName: e.target.value }))}
                    placeholder={ar ? "مدرسة الأمل" : "Al-Amal School"}
                    maxLength={200}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label={ar ? "اسم المعلم" : "Teacher"}>
                  <input
                    value={settings.teacherName ?? ""}
                    onChange={e => setSettings(s => ({ ...s, teacherName: e.target.value }))}
                    placeholder={ar ? "أ. محمد" : "Mr. Ahmed"}
                    maxLength={100}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label={ar ? "القسم" : "Department"} className="sm:col-span-2">
                  <input
                    value={settings.section ?? ""}
                    onChange={e => setSettings(s => ({ ...s, section: e.target.value }))}
                    placeholder={ar ? "قسم اللغة العربية" : "English Dept"}
                    maxLength={100}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary"
                  />
                </Field>
              </div>

              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-foreground">
                    {ar ? "حقول إضافية (اختياري)" : "Extra fields"}
                  </span>
                  <button
                    onClick={() => {
                      const cur = settings.customFields ?? [];
                      if (cur.length >= MAX_CUSTOM_FIELDS) {
                        toast.error(ar ? `الحد الأقصى ${MAX_CUSTOM_FIELDS} حقول` : `Max ${MAX_CUSTOM_FIELDS} fields`);
                        return;
                      }
                      setSettings(s => ({ ...s, customFields: [...(s.customFields ?? []), { label: "", value: "" }] }));
                    }}
                    className="text-[10px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3 inline-block" /> {ar ? "إضافة" : "Add"}
                  </button>
                </div>
                {(settings.customFields ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{ar ? "مثال: العام الدراسي، الدرجة، الفصل…" : "e.g., Academic Year, Marks, Term…"}</p>
                ) : (
                  <div className="space-y-2">
                    {(settings.customFields ?? []).map((f, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={f.label}
                          onChange={e => { const next = (settings.customFields ?? []).slice(); next[i] = { ...next[i], label: e.target.value }; setSettings(s => ({ ...s, customFields: next })); }}
                          placeholder={ar ? "اسم الحقل" : "Label"}
                          maxLength={40}
                          className="w-1/3 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"
                        />
                        <input
                          value={f.value}
                          onChange={e => { const next = (settings.customFields ?? []).slice(); next[i] = { ...next[i], value: e.target.value }; setSettings(s => ({ ...s, customFields: next })); }}
                          placeholder={ar ? "القيمة" : "Value"}
                          maxLength={120}
                          className="flex-1 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"
                        />
                        <button onClick={() => { const next = (settings.customFields ?? []).filter((_, j) => j !== i); setSettings(s => ({ ...s, customFields: next })); }} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </TabsContent>

            <TabsContent value="design" className="p-5 outline-none m-0">

<div className="space-y-5">
              {/* Template Picker */}
              <div>
                <div className="text-[11px] font-bold mb-2 text-muted-foreground flex justify-between items-center">
                  <span>{ar ? "القالب المرئي" : "Visual Template"}</span>
                  <span className="font-normal text-[10px]">{ar ? "(يُختار تلقائياً أحياناً)" : "(auto-selected)"}</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => setSettings(s => ({ ...s, template: undefined }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-all",
                      !settings.template ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                    )}
                  >
                    <div className="w-full h-8 rounded flex items-center justify-center border border-dashed border-primary/40 bg-background">
                      <span className="text-[9px] font-bold text-primary">{ar ? "كلاسيك" : "Classic"}</span>
                    </div>
                  </button>
                  {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map(t => {
                    const isActive = settings.template === t.id;
                    const [c1, c2] = t.swatchColors;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSettings(s => ({ ...s, template: s.template === t.id ? undefined : t.id }))}
                        title={t.description}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-all",
                          isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                        )}
                        style={{ borderColor: isActive ? c1 : "transparent", background: isActive ? `${c1}10` : undefined }}
                      >
                        <div className="w-full h-8 rounded overflow-hidden shadow-sm" style={{ background: c1 }}>
                          <div className="h-[40%]" style={{ background: c1 }} />
                          <div className="h-[60%]" style={{ background: "white" }}>
                            <div className="mx-1 mt-0.5 h-px rounded" style={{ background: `${c1}44` }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={ar ? "الأعمدة" : "Columns"}>
                  <SegmentedControl value={settings.columns} onChange={v => setSettings(s => ({...s, columns: v}))} options={[{label: ar?"1":"1", value:1}, {label:ar?"2":"2", value:2}]} />
                </Field>
                <Field label={ar ? "نوع الخط" : "Font"}>
                  <select value={settings.fontFamily} onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value as FontFamily }))} className="w-full h-11 px-2 rounded-lg border bg-background text-xs outline-none focus:border-primary">
                    <option value="default">{ar ? "افتراضي" : "Default"}</option>
                    <option value="cairo">Cairo</option>
                    <option value="tajawal">Tajawal</option>
                    <option value="amiri">Amiri</option>
                    <option value="noto-naskh">Noto Naskh</option>
                    <option value="inter">Inter</option>
                    <option value="georgia">Georgia</option>
                  </select>
                </Field>
                <Field label={ar ? `حجم الخط (${settings.fontSizePt}pt)` : `Font size (${settings.fontSizePt}pt)`}>
                  <input type="range" min={9} max={18} step={1} value={settings.fontSizePt}
                    onChange={e => setSettings(s => ({ ...s, fontSizePt: parseInt(e.target.value, 10) }))}
                    className="w-full mt-3" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-bold mb-1.5 text-muted-foreground">{ar ? "لون الورقة" : "Accent color"}</div>
                  <div className="flex flex-wrap gap-2">
                    {THEME_PRESETS.map(p => (
                      <button
                        key={p.color}
                        title={p.label}
                        onClick={() => setSettings(s => ({ ...s, themeColor: s.themeColor === p.color ? undefined : p.color }))}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 shadow-sm"
                        style={{
                          background: p.color,
                          borderColor: settings.themeColor === p.color ? "#fff" : "transparent",
                          boxShadow: settings.themeColor === p.color ? `0 0 0 2px ${p.color}` : "none",
                        }}
                      />
                    ))}
                    <label className="w-6 h-6 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center cursor-pointer hover:scale-110 transition-all bg-background shadow-sm" title={ar ? "لون مخصص" : "Custom"}>
                      <input type="color" className="sr-only" value={settings.themeColor ?? "#225739"} onChange={e => setSettings(s => ({ ...s, themeColor: e.target.value }))} />
                      <Plus className="w-3 h-3 text-muted-foreground" />
                    </label>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold mb-1.5 text-muted-foreground">{ar ? "الشعار (اختياري)" : "Logo"}</div>
                  {settings.logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={settings.logoUrl} alt="logo" className="h-8 w-auto rounded border object-contain bg-white" />
                      <button onClick={() => setSettings(s => ({ ...s, logoUrl: undefined }))} className="text-[11px] text-destructive hover:underline">{ar ? "إزالة" : "Remove"}</button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 cursor-pointer h-8 rounded-lg border border-dashed border-border bg-background hover:bg-muted transition-colors text-xs text-muted-foreground">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{ar ? "رفع صورة (PNG/JPG)" : "Upload (PNG/JPG)"}</span>
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="sr-only"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 500 * 1024) { toast.error(ar ? "الحجم يجب أن يكون أقل من 500KB" : "Under 500KB"); return; }
                          const reader = new FileReader();
                          reader.onload = ev => setSettings(s => ({ ...s, logoUrl: ev.target?.result as string }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={ar ? "ملاحظة الترويسة" : "Header note"}>
                  <input value={settings.headerNote ?? ""} onChange={e => setSettings(s => ({ ...s, headerNote: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" maxLength={300} />
                </Field>
                <Field label={ar ? "ملاحظة التذييل" : "Footer note"}>
                  <input value={settings.footerNote ?? ""} onChange={e => setSettings(s => ({ ...s, footerNote: e.target.value }))} className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" maxLength={300} />
                </Field>
              </div>

              <Field label={ar ? "تعليمات الطالب" : "Instructions"}>
                <textarea
                  value={settings.instructions ?? ""}
                  onChange={e => setSettings(s => ({ ...s, instructions: e.target.value }))}
                  rows={2}
                  className="w-full p-2 rounded-lg border bg-background text-sm outline-none focus:border-primary"
                />
              </Field>

              <Field label={ar ? "جملة الختام" : "Closing line"}>
                 <input value={settings.goodLuck ?? ""} onChange={e => setSettings(s => ({ ...s, goodLuck: e.target.value }))} placeholder={ar ? "نتمنى لك التوفيق (الافتراضي)" : "Good luck! (default)"} className="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary" maxLength={200} />
              </Field>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                <Toggle label={ar ? "الاسم" : "Name"} value={settings.includeName} onChange={v => setSettings(s => ({ ...s, includeName: v }))} icon={<User className="w-3.5 h-3.5" />} />
                <Toggle label={ar ? "التاريخ" : "Date"} value={settings.includeDate} onChange={v => setSettings(s => ({ ...s, includeDate: v }))} />
                <Toggle label={ar ? "الصف" : "Class"} value={settings.includeClass} onChange={v => setSettings(s => ({ ...s, includeClass: v }))} icon={<GraduationCap className="w-3.5 h-3.5" />} />
                <Toggle label={ar ? "الإجابات" : "Answers"} value={settings.includeAnswerKey} onChange={v => setSettings(s => ({ ...s, includeAnswerKey: v }))} />
                <Toggle label={ar ? "علامة مائية" : "Watermark"} value={settings.showWatermark} onChange={v => setSettings(s => ({ ...s, showWatermark: v }))} />
              </div>
            </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* 4. Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border/50 shadow-sm">
            <DropdownMenu dir={dir}>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2.5 rounded-xl border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-bold flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {ar ? "إضافة سؤال" : "Add Question"}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {(["mcq", "true_false", "short_answer", "fill_blank", "matching", "tic_tac_toe"] as const).map(t => (
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

            <div className="flex items-center gap-2">
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
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Sticky Bottom Bar - PRIMARY ACTION */}
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-background/80 backdrop-blur-xl border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (!canSave) {
                  toast.error(ar ? "أكمل العنوان وأضف سؤالًا واحدًا على الأقل" : "Add a title and at least one question");
                  return;
                }
                setCanvasEditorOpen(true);
              }}
              disabled={!canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
              className="min-w-0 px-2 sm:px-4 py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap disabled:opacity-50 bg-background hover:bg-muted transition-colors text-xs sm:text-sm"
            >
              <Layers className="w-4 h-4 text-primary" />
              {ar ? "تصميم حر" : "Canvas"}
              {(settings.layout?.elements?.length ?? 0) > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {settings.layout!.elements.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (!canSave) {
                  toast.error(ar ? "أكمل العنوان وأضف سؤالًا واحدًا على الأقل" : "Add a title and at least one question");
                  return;
                }
                setPreviewing(true);
              }}
              disabled={!canSave || autoSaveStatus === "saving" || autoSaveStatus === "error"}
              className="min-w-0 px-2 sm:px-4 py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap disabled:opacity-50 bg-background hover:bg-muted transition-colors text-amber-600 border-amber-600/30 text-xs sm:text-sm"
            >
              <Eye className="w-4 h-4" />
              <span className="sm:hidden">{ar ? "معاينة" : "Preview"}</span>
              <span className="hidden sm:inline">{ar ? "معاينة بدون حفظ" : "Preview without saving"}</span>
            </button>

            <button
              onClick={() => saveWorksheet()}
              disabled={!canSave || saving || autoSaveStatus === "saving" || autoSaveStatus === "error"}
              className="min-w-0 px-2 sm:px-4 py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap disabled:opacity-50 bg-background hover:bg-muted transition-colors text-primary border-primary/30 text-xs sm:text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {ar ? "حفظ كمسودة" : "Save Draft"}
            </button>
          </div>

          <button
            onClick={saveAndPreview}
            disabled={!canSave || saving || autoSaveStatus === "saving" || autoSaveStatus === "error"}
            className="w-full sm:w-auto flex-shrink-0 h-14 px-8 md:px-14 text-lg font-black rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25 text-primary-foreground transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
            {ar ? "توليد الورقة" : "Generate Worksheet"}
          </button>
          </div>
        </div>
      </div>

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

      <AnimatePresence>
        {previewing && (
          <PreviewOverlay
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
            onClose={() => setPreviewing(false)}
          />
        )}
      </AnimatePresence>

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
  index, total, question, ar, onUpdate, onRemove, onMove, onChangeType, onRegenerateCell, regeneratingCellIndex, regenerateCreditPrice, onGenerateCellImage, generatingCellImageIndex, imageCreditPrice,
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
}) {
  const [uploadingCell, setUploadingCell] = useState<number | null>(null);
  return (
    <div className="border border-border/60 rounded-2xl p-4 space-y-4 bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-border/40">
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
              <option value="tic_tac_toe">{typeLabel("tic_tac_toe", ar)}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="w-7 h-7 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors" title={ar ? "أعلى" : "Up"}><ArrowUp className="w-3.5 h-3.5"/></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="w-7 h-7 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors" title={ar ? "أسفل" : "Down"}><ArrowDown className="w-3.5 h-3.5"/></button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive transition-colors" title={ar ? "حذف" : "Delete"}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
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

      {question.type === "tic_tac_toe" && (
        <div className="space-y-3 mt-2">
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
  );
}

function PreviewOverlay({
  ar, data: initialData, onClose,
}: { ar: boolean; data: WorksheetData; onClose: () => void }) {
  const [data, setData] = useState<WorksheetData>(initialData);

  const handleWord = () => {
    const root = document.getElementById("ws-printable-root");
    if (!root) {
      toast.error(ar ? "تعذّر إعداد الملف" : "Could not prepare file");
      return;
    }
    downloadAsWord({ element: root, title: data.title, lang: data.language });
  };

  const handleLayoutChange = (
    newQuestions: Question[],
    newPageBreaks: string[],
    questionStyles: NonNullable<WorksheetData["settings"]["questionStyles"]>,
  ) => {
    setData(prev => ({
      ...prev,
      questions: newQuestions,
      settings: { ...prev.settings, pageBreaks: newPageBreaks, questionStyles },
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] bg-neutral-200 overflow-auto"
      dir={data.language === "ar" ? "rtl" : "ltr"}
    >
      <div
        className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b shadow-sm bg-white"
      >
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 hover:bg-muted transition-colors text-primary border-primary/30"
        >
          <ArrowLeft className="w-4 h-4" />
          {ar ? "رجوع للتعديل" : "Back to edit"}
        </button>
        <div className="text-sm font-bold truncate flex-1 text-center text-primary hidden sm:block">
          {ar ? "معاينة بدون حفظ" : "Preview (not saved)"} · {data.title}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={handleWord}
            className="px-4 py-2 rounded-xl text-sm font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center gap-2"
          >
            <FileType className="w-4 h-4" /> {ar ? "وورد (Word)" : "Word"}
          </button>
          <button
            onClick={() => printToPdf(data.title)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
            title={ar ? "حفظ الورقة كملف PDF" : "Save worksheet as PDF"}
          >
            <Download className="w-4 h-4" /> {ar ? "حفظ PDF" : "Save PDF"}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 flex justify-center pb-32">
        <div className="max-w-[210mm] w-full bg-white shadow-2xl relative" style={{ minHeight: "297mm" }}>
          <WorksheetPrintView data={data} onLayoutChange={handleLayoutChange} />
        </div>
      </div>
    </motion.div>
  );
}
