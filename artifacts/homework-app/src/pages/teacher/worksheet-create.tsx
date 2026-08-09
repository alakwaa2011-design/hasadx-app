import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Edit3, Check, Eye, FileText, ListChecks,
  CheckSquare, Pencil, Type, Shuffle, Upload, ImageIcon,
  FileType, Settings as SettingsIcon, Building2, GraduationCap, User,
  ArrowLeft, Printer, RotateCcw, Palette, LayoutTemplate, ChevronDown, Layers,
} from "lucide-react";
import {
  type ThemeId, THEMES, selectTheme, getLastTheme, setLastTheme,
} from "./worksheet-themes";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { WorksheetPrintView, type WorksheetData } from "@/pages/teacher/worksheet-print";
import { downloadAsWord, printToPdf } from "@/lib/print-export";
import WorksheetCanvasEditor from "@/pages/teacher/worksheet-canvas-editor";
import type { CanvasLayout } from "@/pages/teacher/worksheet-canvas-types";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

const WS_PREFS_KEY = "hasad:worksheet:prefs";

interface WsPrefs {
  contentLang?: "ar" | "en";
  aiDifficulty?: "easy" | "medium" | "hard" | "mixed";
  aiPages?: 1 | 2 | 3;
  aiCounts?: { mcq: number; true_false: number; short_answer: number; fill_blank: number; matching: number };
}

const WS_DEFAULT_PREFS: Required<WsPrefs> = {
  contentLang: "ar",
  aiDifficulty: "medium",
  aiPages: 1,
  aiCounts: { mcq: 4, true_false: 2, short_answer: 2, fill_blank: 2, matching: 0 },
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
    const fb = safe(c.fill_blank); const ma = safe(c.matching);
    if (mcq !== undefined && tf !== undefined && sa !== undefined && fb !== undefined && ma !== undefined) {
      result.aiCounts = { mcq, true_false: tf, short_answer: sa, fill_blank: fb, matching: ma };
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

// ── Teacher header profile (persists across worksheets) ───────────────────
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
    // logoUrl is a base64 data URI — validate prefix to avoid garbage
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

type QType = "mcq" | "true_false" | "short_answer" | "fill_blank" | "matching";

interface QMcq { id: string; type: "mcq"; prompt: string; options: string[]; correctIndex: number; points?: number }
interface QTF { id: string; type: "true_false"; prompt: string; correct: boolean; points?: number }
interface QShort { id: string; type: "short_answer"; prompt: string; lines?: number; answer?: string; points?: number }
interface QFill { id: string; type: "fill_blank"; prompt: string; answer: string; points?: number }
interface QMatch { id: string; type: "matching"; prompt?: string; pairs: Array<{ left: string; right: string }>; points?: number }
type Question = QMcq | QTF | QShort | QFill | QMatch;

type FontFamily = "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia";

interface CustomField { label: string; value: string }

interface Settings {
  instructions?: string;

  includeName: boolean;

  includeDate: boolean;

  includeClass: boolean;

  includeAnswerKey: boolean;

  columns: 1 | 2;

  headerNote?: string;

  footerNote?: string;
  /** Custom closing line shown at the bottom of the last page (e.g. "نتمنى لك التوفيق"). Empty string = use default. */
  goodLuck?: string;
  // Header identity fields, typography, and Hasaad watermark control.

  schoolName?: string;

  section?: string;

  teacherName?: string;
  // Teacher-defined extra header fields (label + value pairs). These render
  // alongside school/section/teacher in the printable header.

  customFields?: CustomField[];

  fontFamily: FontFamily;

  fontSizePt: number;

  showWatermark: boolean;
  /** Custom accent color (hex). Defaults to Hasaad green. */

  themeColor?: string;
  /** Base64 school logo shown in the header. */

  logoUrl?: string;
  /** Design template ID — auto-selected by AI, overrideable by teacher. */
  /** Question IDs that have a forced page break inserted before them. */

  template?: ThemeId;
  /** Free-form canvas overlay elements (text, shapes). */

  layout?: CanvasLayout;

  pageBreaks?: string[];
}

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
  createdAt: string;
  updatedAt: string;
  ownerName?: string | null;
  ownerIsAdmin?: boolean;
}

const newId = () => `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const typeLabel = (t: QType, ar: boolean) => {
  const arMap: Record<QType, string> = {
    mcq: "اختيار من متعدد",
    true_false: "صح أو خطأ",
    short_answer: "إجابة قصيرة",
    fill_blank: "إكمال الفراغ",
    matching: "توصيل",
  };
  const enMap: Record<QType, string> = {
    mcq: "Multiple Choice",
    true_false: "True / False",
    short_answer: "Short Answer",
    fill_blank: "Fill the Blank",
    matching: "Matching",
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
      // `prompt` is intentionally included (even though the matching UI
      // doesn't currently surface it) so changeQuestionType can carry the
      // prompt across when converting to/from this type without data loss.
      return { id, type, prompt: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }] };
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

  // Load saved AI prefs once at mount time.
  const _wsPrefs = useMemo(() => loadWsPrefs(), []);
  const _teacherProfile = useMemo(() => loadTeacherProfile(), []);

  const [contentLang, setContentLang] = useState<"ar" | "en">(_wsPrefs.contentLang ?? lang);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const [questions, setQuestions] = useState<Question[]>([]);
  // Pre-fill header identity fields from saved teacher profile on NEW worksheets.
  // When loading an existing worksheet, the setSettings call in the edit-load
  // effect (below) will overwrite these with the worksheet's own values.
  const [settings, setSettings] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    schoolName: _teacherProfile.schoolName ?? DEFAULT_SETTINGS.schoolName,
    section: _teacherProfile.section ?? DEFAULT_SETTINGS.section,
    teacherName: _teacherProfile.teacherName ?? DEFAULT_SETTINGS.teacherName,
    logoUrl: _teacherProfile.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
    customFields: _teacherProfile.customFields ?? DEFAULT_SETTINGS.customFields,
  });

  // AI panel state
  const [aiOpen, setAiOpen] = useState(true);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">(_wsPrefs.aiDifficulty ?? "medium");
  const [aiPages, setAiPages] = useState<1 | 2 | 3>(_wsPrefs.aiPages ?? 1);
  const [aiCounts, setAiCounts] = useState<{ mcq: number; true_false: number; short_answer: number; fill_blank: number; matching: number }>(
    _wsPrefs.aiCounts ?? { mcq: 4, true_false: 2, short_answer: 2, fill_blank: 2, matching: 0 },
  );
  const [generating, setGenerating] = useState(false);

  // Persist AI prefs to localStorage whenever they change (skip initial mount).
  const wsDidMountRef = useRef(false);
  const wsSkipNextSaveRef = useRef(false);
  useEffect(() => {
    if (!wsDidMountRef.current) { wsDidMountRef.current = true; return; }
    if (wsSkipNextSaveRef.current) { wsSkipNextSaveRef.current = false; return; }
    saveWsPrefs({ contentLang, aiDifficulty, aiPages, aiCounts });
  }, [contentLang, aiDifficulty, aiPages, aiCounts]);

  // Auto-save teacher header profile whenever identity fields change.
  // This fills new worksheets automatically so the teacher doesn't re-type.
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

  // File extraction (multi-file: 5 max for teachers, 25 max for admins).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileLimits = useMemo(() => ({
    maxFiles: isAdmin ? 25 : 5,
    maxBytes: isAdmin ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
    maxMb: isAdmin ? 200 : 50,
  }), [isAdmin]);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  // Saved worksheets modal
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedRows, setSavedRows] = useState<WorksheetRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);

  // Preview-without-save: when true, renders a full-screen overlay using
  // <WorksheetPrintView /> with the current draft. The teacher can return
  // to editing or export to Word/PDF without persisting anything.
  const [previewing, setPreviewing] = useState(false);

  // Canvas editor overlay — free-form text/shape placement.
  const [canvasEditorOpen, setCanvasEditorOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // If the URL contains ?edit=<id>, fetch that worksheet and populate the
  // form so the teacher can edit it (change question types, prompts,
  // correct answers, settings, etc.). The print page links here.
  //
  // Race-safety: if the teacher starts typing/clicking before the fetch
  // resolves, we must NOT overwrite their in-progress edits. We track
  // whether any local mutation has happened since mount in a ref, and
  // bail out of the population step if so.
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
          // Teacher already started editing — bind the id only, keep their work.
          setEditingId(row.id);
          return;
        }
        setTitle(row.title);
        setContentLang(row.language);
        setSubject(row.subject ?? "");
        setGradeLevel(row.gradeLevel ?? "");
        setQuestions(row.questions);
        setSettings({ ...DEFAULT_SETTINGS, ...row.settings, customFields: row.settings?.customFields ?? [] });
        setEditingId(row.id);
        toast.success(lang === "ar" ? "تم تحميل الورقة للتعديل" : "Worksheet loaded for editing");
      })
      .catch(() => { /* silent — teacher can still create a new one */ });
    // Run only on first mount; intentionally omit deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch admin flag so the file picker can show the right limits and
  // accept up to 25 files / 200 MB per file for admins.
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setIsAdmin(!!p.isAdmin); })
      .catch(() => { /* non-fatal */ });
  }, []);

  const totalQs = questions.length;
  const aiTotal = aiCounts.mcq + aiCounts.true_false + aiCounts.short_answer + aiCounts.fill_blank + aiCounts.matching;
  const aiMaxTotal = aiPages * 30;
  const canSave = title.trim().length >= 2 && totalQs >= 1;

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(q => (q.id === id ? ({ ...q, ...patch } as Question) : q)));
  };

  // Replace a question with a fresh blank of a different type, preserving
  // its id (so list ordering and React keys stay stable). Carries over the
  // prompt + points so the teacher doesn't lose what they already wrote
  // when only the type was wrong.
  const changeQuestionType = (id: string, newType: QType) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      if (q.type === newType) return q;
      const blank = makeBlank(newType, contentLang === "ar");
      // Preserve id, prompt, and points across the type swap. We must NOT
      // gate on truthiness — an empty-string prompt is still a deliberate
      // choice the teacher may have made (e.g. they're about to write
      // it). All current blanks include a `prompt` slot, so the
      // assignment is always safe.
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
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // New questions go to the TOP of the list per the teacher's request —
  // they tend to add a few quick items and want them visible without
  // scrolling past a long pre-existing list.
  const addQuestion = (type: QType) => {
    setQuestions(prev => [makeBlank(type, contentLang === "ar"), ...prev]);
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setQuestions(prev => {
      const idx = prev.findIndex(q => q.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) {
      toast.error(ar ? "اكتب موضوع الورقة" : "Add a topic first");
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
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/worksheets/ai/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: contentLang,
          topic: aiTopic.trim(),
          subject: subject.trim() || undefined,
          gradeLevel: gradeLevel.trim() || undefined,
          difficulty: aiDifficulty,
          pages: aiPages,
          counts: aiCounts,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || (ar ? "تعذّر التوليد" : "Generation failed"));
        return;
      }
      const data = await res.json();
      const generated = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
      if (generated.length === 0) {
        toast.error(ar ? "لم يُرجع المولّد أي أسئلة" : "Generator returned no questions");
        return;
      }
      // Prepend AI questions to the top so the teacher sees the result
      // immediately without scrolling.
      setQuestions(prev => [...generated, ...prev]);
      if (!title.trim()) setTitle(aiTopic.trim().slice(0, 80));
      // Auto-select an appropriate design template based on subject/grade
      const lastTheme = getLastTheme();
      const chosenTheme = selectTheme(
        subject.trim() || null,
        gradeLevel.trim() || null,
        contentLang as "ar" | "en",
        generated.length,
        lastTheme,
      );
      setLastTheme(chosenTheme);
      setSettings(s => ({ ...s, template: chosenTheme }));
      toast.success(ar ? `تمت إضافة ${generated.length} سؤال` : `Added ${generated.length} questions`);
      setAiOpen(false);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      setGenerating(false);
    }
  };

  const extractFromFile = async () => {
    if (pickedFiles.length === 0) {
      toast.error(ar ? "اختر ملفًا واحدًا على الأقل" : "Pick at least one file");
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
    setExtracting(true);
    try {
      const fd = new FormData();
      // Send each file under the same field name "files" — the server's
      // multer is configured with .array("files", N).
      for (const f of pickedFiles) fd.append("files", f);
      fd.append("language", contentLang);
      if (subject.trim()) fd.append("subject", subject.trim());
      if (gradeLevel.trim()) fd.append("gradeLevel", gradeLevel.trim());
      fd.append("difficulty", aiDifficulty);
      fd.append("pages", String(aiPages));
      if (aiTopic.trim()) fd.append("topicHint", aiTopic.trim());
      fd.append("counts", JSON.stringify(aiCounts));

      const res = await fetch(`${API_BASE}/api/worksheets/ai/extract`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || (ar ? "تعذّر الاستخراج" : "Extraction failed"));
        return;
      }
      const data = await res.json();
      const generated = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
      if (generated.length === 0) {
        toast.error(ar ? "لم يستخرج المولّد أي أسئلة" : "Generator returned no questions");
        return;
      }
      setQuestions(prev => [...generated, ...prev]);
      if (!title.trim()) {
        const baseName = pickedFiles[0].name.replace(/\.[^.]+$/, "").slice(0, 80);
        setTitle(baseName);
      }
      // Auto-select design template for file-extracted worksheets too
      const lastThemeF = getLastTheme();
      const chosenThemeF = selectTheme(
        subject.trim() || null,
        gradeLevel.trim() || null,
        contentLang as "ar" | "en",
        generated.length,
        lastThemeF,
      );
      setLastTheme(chosenThemeF);
      setSettings(s => ({ ...s, template: chosenThemeF }));
      toast.success(ar ? `تمت إضافة ${generated.length} سؤال من ${pickedFiles.length} ملف` : `Added ${generated.length} questions from ${pickedFiles.length} file(s)`);
      setPickedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAiOpen(false);
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      setExtracting(false);
    }
  };

  const validateBeforeSave = (): string | null => {
    if (title.trim().length < 2) return ar ? "العنوان قصير" : "Title is too short";
    if (questions.length === 0) return ar ? "أضف سؤالًا واحدًا على الأقل" : "Add at least one question";
    for (const q of questions) {
      if (q.type === "matching") {
        if (q.pairs.length < 2) return ar ? "كل سؤال توصيل يحتاج زوجين على الأقل" : "Matching needs at least 2 pairs";
        if (q.pairs.some(p => !p.left.trim() || !p.right.trim())) return ar ? "اكتمل أزواج التوصيل" : "Fill all matching pairs";
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
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        language: contentLang,
        gradeLevel: gradeLevel.trim() || null,
        subject: subject.trim() || null,
        questions,
        settings,
      };
      const url = editingId ? `${API_BASE}/api/worksheets/${editingId}` : `${API_BASE}/api/worksheets`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e.message || (ar ? "تعذّر الحفظ" : "Save failed"));
        return null;
      }
      const row = await res.json();
      setEditingId(row.id);
      toast.success(ar ? "تم الحفظ" : "Saved");
      return row.id as number;
    } catch {
      toast.error(ar ? "حدث خطأ في الاتصال" : "Network error");
      return null;
    } finally {
      setSaving(false);
    }
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
    // Merge with defaults so older saves (missing new fields) still load.
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

  const blankCount = useMemo(
    () => ({
      mcq: questions.filter(q => q.type === "mcq").length,
      true_false: questions.filter(q => q.type === "true_false").length,
      short_answer: questions.filter(q => q.type === "short_answer").length,
      fill_blank: questions.filter(q => q.type === "fill_blank").length,
      matching: questions.filter(q => q.type === "matching").length,
    }),
    [questions],
  );

  // Mark the form dirty as soon as the teacher interacts. Used by the
  // ?edit=<id> useEffect above to avoid clobbering in-progress edits if
  // the fetch for the existing worksheet resolves late. React event
  // delegation catches input/change events from any descendant control
  // (text fields, selects, checkboxes, file pickers).
  const markEditDirty = () => { editLoadDirtyRef.current = true; };

  return (
    <Layout>
      <div
        dir={dir}
        className="max-w-5xl mx-auto px-4 py-6 space-y-5"
        onInput={markEditDirty}
        onChange={markEditDirty}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `${BRAND_PRIMARY}1a`, color: BRAND_PRIMARY }}
          >
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-extrabold" style={{ color: BRAND_PRIMARY }}>
              {ar ? "مولّد ورقة العمل" : "Worksheet Generator"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "صمّم ورقة عمل احترافية للطباعة، يدويًا أو بمساعدة الذكاء الاصطناعي."
                : "Design a print-ready worksheet, manually or with AI help."}
            </p>
          </div>
          <button
            onClick={loadSaved}
            className="px-3 py-2 rounded-xl text-sm font-bold border flex items-center gap-2"
            style={{ borderColor: `${BRAND_PRIMARY}33`, color: BRAND_PRIMARY }}
          >
            <FolderOpen className="w-4 h-4" />
            {ar ? "أوراقي" : "My Worksheets"}
          </button>
        </div>

        {/* ── Main meta card — title always visible ── */}
        <Card className="p-4 space-y-4">
          {/* Title — prominent */}
          <Field label={ar ? "عنوان الورقة" : "Worksheet Title"}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={ar ? "مثال: مراجعة الكسور" : "e.g., Fractions Review"}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-base font-semibold"
            />
          </Field>

          {/* Subject + Grade — smaller row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "المادة" : "Subject"}>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={ar ? "رياضيات، علوم، عربي…" : "Math, Science…"}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </Field>
            <Field label={ar ? "المرحلة" : "Grade"}>
              <input
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
                placeholder={ar ? "الصف الخامس…" : "Grade 5…"}
                list="ws-grade-levels"
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
              <datalist id="ws-grade-levels">
                {gradeLevels.map(g => <option key={g.gradeLevel} value={g.gradeLevel} />)}
              </datalist>
            </Field>
          </div>

          {/* ── Collapsible: Header identity ── */}
          <div className="border-t" style={{ borderColor: `${BRAND_PRIMARY}18` }}>
            <button
              onClick={() => setHeaderOpen(o => !o)}
              className="w-full flex items-center justify-between pt-3 pb-1 gap-2 text-start"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
                <span className="text-xs font-bold" style={{ color: BRAND_PRIMARY }}>
                  {ar ? "بيانات الترويسة" : "Header info"}
                </span>
                {/* Summary pill when closed */}
                {!headerOpen && (settings.schoolName || settings.teacherName || (settings.customFields ?? []).length > 0) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                    {[settings.schoolName, settings.teacherName].filter(Boolean).join(" · ")}
                    {(settings.customFields ?? []).length > 0 && ` +${(settings.customFields ?? []).length}`}
                  </span>
                )}
              </div>
              <ChevronDown
                className="w-4 h-4 transition-transform flex-shrink-0"
                style={{ color: BRAND_PRIMARY, transform: headerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <AnimatePresence initial={false}>
              {headerOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3 pb-1">
                    {/* Profile auto-save notice */}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Save className="w-3 h-3" />
                        {ar
                          ? "تُحفظ هذه البيانات تلقائياً وتُملأ في كل ورقة جديدة"
                          : "Saved automatically and pre-filled on every new worksheet"}
                      </p>
                      {(settings.schoolName || settings.section || settings.teacherName || settings.logoUrl || (settings.customFields ?? []).length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            clearTeacherProfile();
                            setSettings(s => ({ ...s, schoolName: "", section: "", teacherName: "", logoUrl: undefined, customFields: [] }));
                          }}
                          className="text-[11px] text-red-500 hover:underline flex-shrink-0"
                        >
                          {ar ? "مسح المحفوظ" : "Clear saved"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label={ar ? "اسم المدرسة" : "School name"}>
                        <input
                          value={settings.schoolName ?? ""}
                          onChange={e => setSettings(s => ({ ...s, schoolName: e.target.value }))}
                          placeholder={ar ? "مدرسة الأمل" : "Al-Amal School"}
                          maxLength={200}
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                      </Field>
                      <Field label={ar ? "القسم" : "Department"}>
                        <input
                          value={settings.section ?? ""}
                          onChange={e => setSettings(s => ({ ...s, section: e.target.value }))}
                          placeholder={ar ? "قسم اللغة العربية" : "English Dept"}
                          maxLength={100}
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                      </Field>
                      <Field label={ar ? "اسم المعلم" : "Teacher"}>
                        <input
                          value={settings.teacherName ?? ""}
                          onChange={e => setSettings(s => ({ ...s, teacherName: e.target.value }))}
                          placeholder={ar ? "أ. محمد" : "Mr. Ahmed"}
                          maxLength={100}
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                      </Field>
                    </div>
                    {/* Custom fields */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold" style={{ color: BRAND_PRIMARY }}>
                          {ar ? "حقول إضافية (اختياري)" : "Extra fields (optional)"}
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
                          className="text-[11px] font-bold px-2 py-1 rounded border flex items-center gap-1"
                          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
                        >
                          <Plus className="w-3 h-3" />
                          {ar ? "أضف" : "Add"}
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
                                className="w-1/3 px-2 py-1.5 rounded border bg-background text-sm"
                              />
                              <input
                                value={f.value}
                                onChange={e => { const next = (settings.customFields ?? []).slice(); next[i] = { ...next[i], value: e.target.value }; setSettings(s => ({ ...s, customFields: next })); }}
                                placeholder={ar ? "القيمة" : "Value"}
                                maxLength={120}
                                className="flex-1 px-2 py-1.5 rounded border bg-background text-sm"
                              />
                              <button onClick={() => { const next = (settings.customFields ?? []).filter((_, j) => j !== i); setSettings(s => ({ ...s, customFields: next })); }} className="p-1.5 rounded text-red-500 hover:bg-red-50" title={ar ? "حذف" : "Remove"}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Collapsible: Design ── */}
          <div className="border-t" style={{ borderColor: `${BRAND_PRIMARY}18` }}>
            <button
              onClick={() => setDesignOpen(o => !o)}
              className="w-full flex items-center justify-between pt-3 pb-1 gap-2 text-start"
            >
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
                <span className="text-xs font-bold" style={{ color: BRAND_PRIMARY }}>
                  {ar ? "تصميم الورقة" : "Worksheet Design"}
                </span>
                {!designOpen && settings.template && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${THEMES[settings.template].swatchColors[0]}20`, color: THEMES[settings.template].swatchColors[0] }}>
                    {ar ? THEMES[settings.template].nameAr : THEMES[settings.template].nameEn}
                  </span>
                )}
                {!designOpen && settings.themeColor && (
                  <span className="w-4 h-4 rounded-full border border-white shadow-sm inline-block" style={{ background: settings.themeColor }} />
                )}
              </div>
              <ChevronDown
                className="w-4 h-4 transition-transform flex-shrink-0"
                style={{ color: BRAND_PRIMARY, transform: designOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <AnimatePresence initial={false}>
              {designOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-5 pb-1">
                    {/* Template picker */}
                    <div>
                      <div className="text-xs font-bold mb-2" style={{ color: BRAND_PRIMARY }}>
                        {ar ? "قالب التصميم" : "Design Template"}
                        <span className="ms-2 font-normal text-muted-foreground text-[10px]">
                          {ar ? "يُختار تلقائيًا عند التوليد بالذكاء الاصطناعي" : "auto-selected on AI generation"}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 gap-2 mb-2">
                        {/* No template */}
                        <button
                          onClick={() => setSettings(s => ({ ...s, template: undefined }))}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all"
                          style={{
                            borderColor: !settings.template ? BRAND_PRIMARY : "transparent",
                            background: !settings.template ? `${BRAND_PRIMARY}0d` : "var(--muted)",
                          }}
                        >
                          <div className="w-full h-8 rounded flex items-center justify-center border border-dashed" style={{ borderColor: `${BRAND_PRIMARY}44` }}>
                            <span className="text-[8px] font-bold" style={{ color: BRAND_PRIMARY }}>{ar ? "افتراضي" : "Default"}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{ar ? "كلاسيك" : "Classic"}</span>
                        </button>
                        {/* Theme cards */}
                        {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map(t => {
                          const isActive = settings.template === t.id;
                          const [c1, c2] = t.swatchColors;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setSettings(s => ({ ...s, template: s.template === t.id ? undefined : t.id }))}
                              title={t.description}
                              className="flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all"
                              style={{
                                borderColor: isActive ? c1 : "transparent",
                                background: isActive ? `${c1}0d` : "var(--muted)",
                              }}
                            >
                              <div className="w-full h-8 rounded overflow-hidden" style={{ background: c1 }}>
                                <div className="h-[40%]" style={{ background: c1 }} />
                                <div className="h-[60%]" style={{ background: "white" }}>
                                  <div className="mx-1 mt-0.5 h-px rounded" style={{ background: `${c1}44` }} />
                                </div>
                              </div>
                              <span className="text-[9px] font-semibold truncate w-full text-center" style={{ color: isActive ? c1 : undefined }}>
                                {ar ? t.nameAr : t.nameEn}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Accent color */}
                      <div>
                        <label className="block text-xs font-bold mb-2" style={{ color: BRAND_PRIMARY }}>
                          {ar ? "لون الورقة" : "Accent color"}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-1">
                          {THEME_PRESETS.map(p => (
                            <button
                              key={p.color}
                              title={p.label}
                              onClick={() => setSettings(s => ({ ...s, themeColor: s.themeColor === p.color ? undefined : p.color }))}
                              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                              style={{
                                background: p.color,
                                borderColor: settings.themeColor === p.color ? "#fff" : "transparent",
                                boxShadow: settings.themeColor === p.color ? `0 0 0 2px ${p.color}` : "none",
                              }}
                            />
                          ))}
                          <label className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" style={{ borderColor: `${BRAND_PRIMARY}55` }} title={ar ? "لون مخصص" : "Custom"}>
                            <input type="color" className="sr-only" value={settings.themeColor ?? BRAND_PRIMARY} onChange={e => setSettings(s => ({ ...s, themeColor: e.target.value }))} />
                            <span className="text-[10px] font-bold" style={{ color: BRAND_PRIMARY }}>+</span>
                          </label>
                        </div>
                        {settings.themeColor && (
                          <button onClick={() => setSettings(s => ({ ...s, themeColor: undefined }))} className="text-[11px] text-muted-foreground hover:text-destructive">
                            {ar ? "إعادة الافتراضي" : "Reset"}
                          </button>
                        )}
                      </div>

                      {/* Logo upload */}
                      <div>
                        <label className="block text-xs font-bold mb-2" style={{ color: BRAND_PRIMARY }}>
                          {ar ? "شعار المدرسة (اختياري)" : "School logo (optional)"}
                        </label>
                        {settings.logoUrl ? (
                          <div className="flex items-center gap-3">
                            <img src={settings.logoUrl} alt="logo" className="h-10 w-auto rounded border object-contain" />
                            <button onClick={() => setSettings(s => ({ ...s, logoUrl: undefined }))} className="text-[11px] text-red-500 hover:underline">{ar ? "حذف" : "Remove"}</button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 transition-colors" style={{ borderColor: `${BRAND_PRIMARY}44` }}>
                            <ImageIcon className="w-4 h-4 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
                            <span className="text-xs">{ar ? "رفع الشعار (PNG/JPG)" : "Upload logo (PNG/JPG)"}</span>
                            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="sr-only"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 500 * 1024) { toast.error(ar ? "حجم الشعار يجب أن يكون أقل من 500 كيلوبايت" : "Logo must be under 500 KB"); return; }
                                const reader = new FileReader();
                                reader.onload = ev => setSettings(s => ({ ...s, logoUrl: ev.target?.result as string }));
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Collapsible: Layout & Formatting ── */}
          <div className="border-t" style={{ borderColor: `${BRAND_PRIMARY}18` }}>
            <button
              onClick={() => setLayoutOpen(o => !o)}
              className="w-full flex items-center justify-between pt-3 pb-1 gap-2 text-start"
            >
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
                <span className="text-xs font-bold" style={{ color: BRAND_PRIMARY }}>
                  {ar ? "إعدادات التنسيق" : "Formatting"}
                </span>
                {!layoutOpen && (
                  <span className="text-[10px] text-muted-foreground">
                    {ar
                      ? `${settings.columns === 2 ? "عمودان" : "عمود واحد"} · ${settings.fontSizePt}pt${settings.includeAnswerKey ? " · نموذج الإجابات" : ""}`
                      : `${settings.columns === 2 ? "2 cols" : "1 col"} · ${settings.fontSizePt}pt${settings.includeAnswerKey ? " · Answer key" : ""}`}
                  </span>
                )}
              </div>
              <ChevronDown
                className="w-4 h-4 transition-transform flex-shrink-0"
                style={{ color: BRAND_PRIMARY, transform: layoutOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <AnimatePresence initial={false}>
              {layoutOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3 pb-1">
                    <Field label={ar ? "تعليمات الطالب (اختياري)" : "Student instructions (optional)"}>
                      <textarea
                        value={settings.instructions ?? ""}
                        onChange={e => setSettings(s => ({ ...s, instructions: e.target.value }))}
                        rows={2}
                        placeholder={ar ? "اقرأ كل سؤال بعناية قبل الإجابة." : "Read each question carefully before answering."}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                      />
                    </Field>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Toggle label={ar ? "خانة الاسم" : "Name field"} value={settings.includeName} onChange={v => setSettings(s => ({ ...s, includeName: v }))} icon={<User className="w-3 h-3" />} />
                      <Toggle label={ar ? "خانة التاريخ" : "Date field"} value={settings.includeDate} onChange={v => setSettings(s => ({ ...s, includeDate: v }))} />
                      <Toggle label={ar ? "خانة الصف" : "Class field"} value={settings.includeClass} onChange={v => setSettings(s => ({ ...s, includeClass: v }))} icon={<GraduationCap className="w-3 h-3" />} />
                      <Toggle label={ar ? "نموذج الإجابات" : "Answer key"} value={settings.includeAnswerKey} onChange={v => setSettings(s => ({ ...s, includeAnswerKey: v }))} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label={ar ? "عدد الأعمدة" : "Columns"}>
                        <div className="flex gap-2">
                          {([1, 2] as const).map(c => (
                            <button key={c} onClick={() => setSettings(s => ({ ...s, columns: c }))}
                              className="flex-1 px-3 py-2 rounded-lg border text-sm font-bold"
                              style={{ background: settings.columns === c ? BRAND_PRIMARY : "transparent", color: settings.columns === c ? "#fff" : BRAND_PRIMARY, borderColor: `${BRAND_PRIMARY}55` }}>
                              {c === 1 ? (ar ? "عمود" : "1 col") : (ar ? "عمودان" : "2 cols")}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label={ar ? "نوع الخط" : "Font"}>
                        <select value={settings.fontFamily} onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value as FontFamily }))} className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
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
                          className="w-full" style={{ accentColor: BRAND_PRIMARY }} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label={ar ? "ملاحظة في الترويسة" : "Header note"}>
                        <input value={settings.headerNote ?? ""} onChange={e => setSettings(s => ({ ...s, headerNote: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" maxLength={300} />
                      </Field>
                      <Field label={ar ? "ملاحظة في التذييل" : "Footer note"}>
                        <input value={settings.footerNote ?? ""} onChange={e => setSettings(s => ({ ...s, footerNote: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" maxLength={300} />
                      </Field>
                    </div>
                    <Field label={ar ? "جملة التشجيع في نهاية الورقة" : "Closing encouragement line"}>
                      <input
                        value={settings.goodLuck ?? ""}
                        onChange={e => setSettings(s => ({ ...s, goodLuck: e.target.value }))}
                        placeholder={ar ? "نتمنى لك التوفيق ✦  (الافتراضي)" : "✦ Good luck!  (default)"}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        maxLength={200}
                      />
                    </Field>
                    <div className="rounded-lg p-3 border flex items-center gap-3 flex-wrap" style={{ borderColor: `${BRAND_GOLD}55`, background: `${BRAND_GOLD}0c` }}>
                      <div className="flex-1 min-w-[160px]">
                        <div className="text-xs font-bold mb-0.5" style={{ color: BRAND_PRIMARY }}>{ar ? "علامة حصاد المائية" : "Hasaad watermark"}</div>
                        <div className="text-[11px] text-muted-foreground">{ar ? "كلمة «حصاد» بخط كبير وخافت خلف الأسئلة" : "Faded «Hasaad» word behind the questions"}</div>
                      </div>
                      <Toggle label={settings.showWatermark ? (ar ? "تظهر" : "On") : (ar ? "مخفية" : "Off")} value={settings.showWatermark} onChange={v => setSettings(s => ({ ...s, showWatermark: v }))} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        {/* AI panel */}
        <Card className="p-4">
          <button
            onClick={() => setAiOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${BRAND_GOLD}22`, color: BRAND_GOLD }}
              >
                <Wand2 className="w-4 h-4" />
              </div>
              <div className="text-start">
                <div className="text-sm font-bold" style={{ color: BRAND_PRIMARY }}>
                  {ar ? "توليد بالذكاء الاصطناعي" : "Generate with AI"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {ar ? "اكتب موضوعًا أو ارفع صورة/PDF/Word ليستخرج الذكاء الاصطناعي الأسئلة" : "Pick a topic, or upload an image/PDF/Word and let AI extract questions"}
                </div>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{aiOpen ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}</span>
          </button>
          <AnimatePresence initial={false}>
            {aiOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  <Field label={ar ? "موضوع الأسئلة (أو ملاحظة عند رفع ملف)" : "Topic (or note when uploading a file)"}>
                    <input
                      value={aiTopic}
                      onChange={e => setAiTopic(e.target.value)}
                      placeholder={ar ? "مثال: جمع وطرح الكسور" : "e.g., Adding and subtracting fractions"}
                      className="w-full px-3 py-2 rounded-lg border bg-background"
                    />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label={ar ? "الصعوبة" : "Difficulty"}>
                      <div className="flex gap-2 flex-wrap">
                        {(["easy", "medium", "hard", "mixed"] as const).map(d => {
                          const labels = ar
                            ? { easy: "سهل", medium: "متوسط", hard: "صعب", mixed: "متنوّع" }
                            : { easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Mixed" };
                          const active = aiDifficulty === d;
                          return (
                            <button
                              key={d}
                              onClick={() => setAiDifficulty(d)}
                              className="px-3 py-1.5 rounded-lg border text-xs font-bold"
                              style={{
                                background: active ? BRAND_PRIMARY : "transparent",
                                color: active ? "#fff" : BRAND_PRIMARY,
                                borderColor: `${BRAND_PRIMARY}55`,
                              }}
                            >
                              {labels[d]}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label={ar ? "حجم الورقة (عدد الصفحات المستهدف)" : "Worksheet size (target pages)"}>
                      <div className="flex gap-2">
                        {([1, 2, 3] as const).map(p => {
                          const active = aiPages === p;
                          return (
                            <button
                              key={p}
                              onClick={() => setAiPages(p)}
                              className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-bold"
                              style={{
                                background: active ? BRAND_PRIMARY : "transparent",
                                color: active ? "#fff" : BRAND_PRIMARY,
                                borderColor: `${BRAND_PRIMARY}55`,
                              }}
                            >
                              {ar ? `${p} ${p === 1 ? "صفحة" : "صفحات"}` : `${p} page${p > 1 ? "s" : ""}`}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </div>
                  <div>
                    <div className="text-xs font-bold mb-2" style={{ color: BRAND_PRIMARY }}>
                      {ar ? "عدد الأسئلة لكل نوع" : "Counts per type"}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {(["mcq", "true_false", "short_answer", "fill_blank", "matching"] as const).map(k => (
                        <CountStepper
                          key={k}
                          label={typeLabel(k, ar)}
                          value={aiCounts[k]}
                          max={k === "matching" ? Math.min(10, aiPages * 4) : Math.min(40, aiPages * 14)}
                          onChange={v => setAiCounts(prev => ({ ...prev, [k]: v }))}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      {ar ? "الإجمالي" : "Total"}: {aiTotal} / {aiMaxTotal}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={generateWithAI}
                      disabled={generating || extracting}
                      className="flex-1 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: BRAND_GOLD }}
                    >
                      {generating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {ar ? "جارٍ التوليد..." : "Generating..."}</>
                        : <><Sparkles className="w-4 h-4" /> {ar ? "توليد الأسئلة من النص" : "Generate Questions from Topic"}</>}
                    </button>
                    <button
                      onClick={handleWsRestoreDefaults}
                      title={ar ? "استعادة الإعدادات الافتراضية" : "Restore defaults"}
                      className="px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
                      style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {ar ? "إعادة ضبط" : "Reset"}
                    </button>
                  </div>

                  {/* File extraction sub-panel — multi-file (up to 5 for
                      teachers, 25 for admins). Each file ≤ 50 MB (teacher)
                      or ≤ 200 MB (admin). Selected files appear as chips
                      with a remove button. */}
                  <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
                    <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: BRAND_PRIMARY }}>
                      <Upload className="w-3.5 h-3.5" />
                      {ar
                        ? `أو ارفع ملفات (صور / PDF / Word) لاستخراج الأسئلة — حتى ${fileLimits.maxFiles} ملفات${isAdmin ? " (مسؤول)" : ""}`
                        : `Or upload files (images / PDF / Word) to extract questions — up to ${fileLimits.maxFiles} files${isAdmin ? " (admin)" : ""}`}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <label
                          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/40 transition-colors text-xs"
                          style={{ borderColor: `${BRAND_PRIMARY}55`, color: pickedFiles.length > 0 ? BRAND_PRIMARY : "#666" }}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                            onChange={e => {
                              const incoming = Array.from(e.target.files || []);
                              if (incoming.length === 0) return;
                              // Merge with anything already selected, dedupe by
                              // (name + size) so re-picking the same file doesn't
                              // double up. Enforce the per-tier caps client-side
                              // for instant feedback; the server is authoritative.
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
                          <Upload className="w-4 h-4" />
                          {pickedFiles.length > 0
                            ? (ar
                                ? `اضغط لإضافة المزيد (${pickedFiles.length}/${fileLimits.maxFiles})`
                                : `Click to add more (${pickedFiles.length}/${fileLimits.maxFiles})`)
                            : (ar
                                ? `اضغط لاختيار الملفات — حتى ${fileLimits.maxMb} ميجا للملف`
                                : `Click to pick files — up to ${fileLimits.maxMb} MB each`)}
                        </label>
                        <button
                          onClick={extractFromFile}
                          disabled={pickedFiles.length === 0 || extracting || generating}
                          className="px-4 py-2 rounded-lg font-bold text-white text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{ background: BRAND_PRIMARY }}
                        >
                          {extracting
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ar ? "جارٍ القراءة..." : "Extracting..."}</>
                            : <><Sparkles className="w-3.5 h-3.5" /> {ar ? `استخرج الأسئلة (${pickedFiles.length})` : `Extract Questions (${pickedFiles.length})`}</>}
                        </button>
                      </div>
                      {pickedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {pickedFiles.map((f, idx) => (
                            <span
                              key={`${f.name}-${f.size}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-white text-[11px]"
                              style={{ borderColor: `${BRAND_PRIMARY}44`, color: BRAND_PRIMARY }}
                            >
                              {f.type.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> : <FileType className="w-3 h-3" />}
                              <span className="font-bold truncate max-w-[160px]">{f.name}</span>
                              <span className="opacity-60">{Math.round(f.size / 1024)} KB</span>
                              <button
                                type="button"
                                onClick={() => setPickedFiles(prev => prev.filter((_, i) => i !== idx))}
                                aria-label={ar ? "إزالة" : "Remove"}
                                className="ml-0.5 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Questions list */}
        <Card className="p-4 space-y-3">
          <div className="text-sm font-bold flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
            {ar ? "الأسئلة" : "Questions"} <span className="text-muted-foreground">({totalQs})</span>
          </div>

          {/* Add-question toolbar — moved to top with text labels and a
              hint so teachers know they can keep adding. New items are
              prepended to the top of the list (per teacher request). */}
          <div className="rounded-xl p-3 border-2 border-dashed" style={{ borderColor: `${BRAND_GOLD}66`, background: `${BRAND_GOLD}0a` }}>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold" style={{ color: BRAND_PRIMARY }}>
              <Plus className="w-3.5 h-3.5" />
              {ar ? "أضف سؤالًا يدويًا — اختر النوع، وستظهر الإضافة في الأعلى:" : "Add a question manually — pick a type and it appears at the top:"}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["mcq", "true_false", "short_answer", "fill_blank", "matching"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => addQuestion(t)}
                  className="px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 hover:bg-white transition-colors"
                  style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY, background: "rgba(255,255,255,0.7)" }}
                  title={typeLabel(t, ar)}
                >
                  {typeIcon(t)}
                  <span>{typeLabel(t, ar)}</span>
                </button>
              ))}
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {ar ? "لا توجد أسئلة بعد. ولّد بالذكاء الاصطناعي أو ارفع ملفًا أو أضف يدويًا." : "No questions yet. Generate with AI, upload a file, or add manually."}
            </div>
          ) : (
            <div className="space-y-3">
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
                />
              ))}
            </div>
          )}

          {totalQs > 0 && (
            <div className="text-[11px] text-muted-foreground pt-2 border-t">
              {ar
                ? `${blankCount.mcq} اختيار من متعدد · ${blankCount.true_false} صح/خطأ · ${blankCount.short_answer} إجابة قصيرة · ${blankCount.fill_blank} فراغ · ${blankCount.matching} توصيل`
                : `${blankCount.mcq} MCQ · ${blankCount.true_false} T/F · ${blankCount.short_answer} short · ${blankCount.fill_blank} fill · ${blankCount.matching} matching`}
            </div>
          )}
        </Card>


        {/* Action bar */}
        <div className="sticky bottom-3 flex flex-wrap gap-2 justify-end p-3 rounded-2xl border shadow-lg backdrop-blur"
          style={{ background: "rgba(255,255,255,0.92)", borderColor: `${BRAND_PRIMARY}22` }}>

          {/* Canvas editor button — opens the free-form overlay editor */}
          <button
            onClick={() => {
              if (!canSave) {
                toast.error(ar ? "أكمل العنوان وأضف سؤالًا واحدًا على الأقل" : "Add a title and at least one question");
                return;
              }
              setCanvasEditorOpen(true);
            }}
            disabled={!canSave}
            className="px-4 py-2.5 rounded-xl font-bold border flex items-center gap-2 disabled:opacity-50"
            style={{
              borderColor: settings.layout?.elements?.length
                ? `${BRAND_PRIMARY}88`
                : `${BRAND_PRIMARY}44`,
              color: BRAND_PRIMARY,
              background: settings.layout?.elements?.length ? `${BRAND_PRIMARY}12` : "transparent",
            }}
            title={ar ? "محرر التصميم الحر (نصوص وأشكال)" : "Canvas editor (text & shapes)"}
          >
            <Layers className="w-4 h-4" />
            {ar ? "تصميم حر" : "Canvas"}
            {(settings.layout?.elements?.length ?? 0) > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: BRAND_PRIMARY, color: "white" }}
              >
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
            disabled={!canSave}
            className="px-4 py-2.5 rounded-xl font-bold border flex items-center gap-2 disabled:opacity-50"
            style={{ borderColor: `${BRAND_GOLD}88`, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
            title={ar ? "معاينة بدون حفظ" : "Preview without saving"}
          >
            <Eye className="w-4 h-4" />
            {ar ? "معاينة بدون حفظ" : "Preview"}
          </button>
          <button
            onClick={() => saveWorksheet()}
            disabled={!canSave || saving}
            className="px-4 py-2.5 rounded-xl font-bold border flex items-center gap-2 disabled:opacity-50"
            style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {ar ? "حفظ" : "Save"}
          </button>
          <button
            onClick={saveAndPreview}
            disabled={!canSave || saving}
            className="px-5 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 disabled:opacity-50"
            style={{ background: BRAND_PRIMARY }}
          >
            <Save className="w-4 h-4" />
            {ar ? "حفظ وفتح صفحة الطباعة" : "Save & Open Print Page"}
          </button>
        </div>
      </div>

      {/* Canvas editor overlay — free-form text and shapes */}
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

      {/* Preview-without-save overlay. Renders the same WorksheetPrintView
          the print page uses, fed by the in-memory draft, so the teacher
          sees exactly what will print. The "back" button returns to the
          editor; PDF + Word buttons let them export without saving. */}
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

      {/* Saved templates modal */}
      <AnimatePresence>
        {savedOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSavedOpen(false)}
          >
            <motion.div
              className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              dir={dir}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 flex items-center justify-between border-b" style={{ background: `${BRAND_PRIMARY}0a` }}>
                <div className="text-sm font-bold" style={{ color: BRAND_PRIMARY }}>
                  {ar ? "أوراق العمل المحفوظة" : "Saved Worksheets"}
                </div>
                <button onClick={() => setSavedOpen(false)} className="p-1 rounded hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {savedLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {ar ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : savedRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {ar ? "لا توجد أوراق محفوظة بعد." : "No saved worksheets yet."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedRows.map(row => {
                      const isAdminShared = row.isShared && row.ownerIsAdmin;
                      return (
                        <div key={row.id} className="p-3 border rounded-xl flex items-start gap-3" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-bold text-sm truncate" style={{ color: BRAND_PRIMARY }}>{row.title}</div>
                              {isAdminShared && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${BRAND_GOLD}22`, color: BRAND_GOLD }}>
                                  {ar ? "مشترك" : "Shared"}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {row.questions.length} {ar ? "سؤال" : "questions"}
                              {row.subject && ` · ${row.subject}`}
                              {row.gradeLevel && ` · ${row.gradeLevel}`}
                              {isAdminShared && row.ownerName && ` · ${row.ownerName}`}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {!isAdminShared && (
                              <button
                                onClick={() => openTemplate(row, false)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                                style={{ background: BRAND_PRIMARY, color: "#fff" }}
                              >
                                <Edit3 className="w-3 h-3" /> {ar ? "تحرير" : "Edit"}
                              </button>
                            )}
                            <button
                              onClick={() => openTemplate(row, true)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
                            >
                              {ar ? "نسخة" : "Copy"}
                            </button>
                            <button
                              onClick={() => setLocation(`/teacher/worksheets/${row.id}/print`)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1"
                              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
                            >
                              <Eye className="w-3 h-3" /> {ar ? "طباعة" : "Print"}
                            </button>
                            {!isAdminShared && (
                              <button
                                onClick={() => deleteTemplate(row.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                                style={{ borderColor: "#dc262655", color: "#dc2626" }}
                              >
                                <Trash2 className="w-3 h-3" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-bold mb-1" style={{ color: BRAND_PRIMARY }}>{label}</div>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 justify-center"
      style={{
        background: value ? `${BRAND_PRIMARY}11` : "transparent",
        color: value ? BRAND_PRIMARY : "#666",
        borderColor: value ? `${BRAND_PRIMARY}55` : "#ddd",
      }}
    >
      {value ? <Check className="w-3 h-3" /> : null}
      {icon}
      {label}
    </button>
  );
}

function CountStepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="border rounded-lg p-2" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
      <div className="text-[10px] font-bold mb-1 truncate" style={{ color: BRAND_PRIMARY }}>{label}</div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-6 h-6 rounded border text-sm flex items-center justify-center"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >−</button>
        <div className="flex-1 text-center text-sm font-bold">{value}</div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-6 h-6 rounded border text-sm flex items-center justify-center"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >+</button>
      </div>
    </div>
  );
}

function QuestionEditor({
  index, total, question, ar, onUpdate, onRemove, onMove, onChangeType,
}: {
  index: number; total: number; question: Question; ar: boolean;
  onUpdate: (patch: Partial<Question>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onChangeType: (newType: QType) => void;
}) {
  return (
    <div className="border rounded-xl p-3 space-y-2" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: BRAND_PRIMARY }}>
            {index + 1}
          </span>
          {/* Change-type dropdown — converts this question to a fresh
              blank of the chosen type (preserving prompt + points). */}
          <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: BRAND_PRIMARY }}>
            {typeIcon(question.type)}
            <select
              value={question.type}
              onChange={e => onChangeType(e.target.value as QType)}
              className="text-[11px] font-bold rounded border bg-white px-1.5 py-0.5"
              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
              title={ar ? "تغيير نوع السؤال" : "Change question type"}
            >
              <option value="mcq">{typeLabel("mcq", ar)}</option>
              <option value="true_false">{typeLabel("true_false", ar)}</option>
              <option value="short_answer">{typeLabel("short_answer", ar)}</option>
              <option value="fill_blank">{typeLabel("fill_blank", ar)}</option>
              <option value="matching">{typeLabel("matching", ar)}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="px-1.5 text-xs disabled:opacity-30" title={ar ? "أعلى" : "Up"}>↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="px-1.5 text-xs disabled:opacity-30" title={ar ? "أسفل" : "Down"}>↓</button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-red-500" title={ar ? "حذف" : "Delete"}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {question.type !== "matching" && (
        <textarea
          value={question.prompt}
          onChange={e => onUpdate({ prompt: e.target.value } as any)}
          placeholder={ar ? "نص السؤال" : "Question text"}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
        />
      )}

      {question.type === "mcq" && (
        <div className="space-y-1.5">
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => onUpdate({ correctIndex: i } as any)}
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  borderColor: question.correctIndex === i ? BRAND_PRIMARY : "#ccc",
                  background: question.correctIndex === i ? BRAND_PRIMARY : "transparent",
                  color: question.correctIndex === i ? "#fff" : "#888",
                }}
                title={ar ? "حدّد الإجابة الصحيحة" : "Mark correct"}
              >
                {question.correctIndex === i ? "✓" : ""}
              </button>
              <input
                value={opt}
                onChange={e => {
                  const next = question.options.slice();
                  next[i] = e.target.value;
                  onUpdate({ options: next } as any);
                }}
                placeholder={`${ar ? "خيار" : "Option"} ${i + 1}`}
                className="flex-1 px-2 py-1.5 rounded border bg-background text-sm"
              />
              <button
                onClick={() => {
                  const next = question.options.filter((_, j) => j !== i);
                  if (next.length < 2) return;
                  const ci = question.correctIndex >= next.length ? 0 : (question.correctIndex > i ? question.correctIndex - 1 : question.correctIndex);
                  onUpdate({ options: next, correctIndex: ci } as any);
                }}
                disabled={question.options.length <= 2}
                className="text-red-400 disabled:opacity-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {question.options.length < 6 && (
            <button
              onClick={() => onUpdate({ options: [...question.options, ""] } as any)}
              className="text-[11px] font-bold flex items-center gap-1"
              style={{ color: BRAND_PRIMARY }}
            >
              <Plus className="w-3 h-3" /> {ar ? "أضف خيارًا" : "Add option"}
            </button>
          )}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="flex gap-2">
          {([true, false] as const).map(v => (
            <button
              key={String(v)}
              onClick={() => onUpdate({ correct: v } as any)}
              className="flex-1 py-2 rounded-lg border text-sm font-bold"
              style={{
                background: question.correct === v ? BRAND_PRIMARY : "transparent",
                color: question.correct === v ? "#fff" : BRAND_PRIMARY,
                borderColor: `${BRAND_PRIMARY}55`,
              }}
            >
              {v ? (ar ? "صح ✓" : "True ✓") : (ar ? "خطأ ✗" : "False ✗")}
            </button>
          ))}
        </div>
      )}

      {question.type === "short_answer" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={ar ? "عدد الأسطر" : "Lines"}>
            <input
              type="number" min={1} max={20}
              value={question.lines ?? 2}
              onChange={e => onUpdate({ lines: Math.max(1, Math.min(20, parseInt(e.target.value || "2", 10))) } as any)}
              className="w-full px-2 py-1.5 rounded border bg-background text-sm"
            />
          </Field>
          <Field label={ar ? "إجابة نموذجية (اختياري)" : "Model answer (optional)"}>
            <input
              value={question.answer ?? ""}
              onChange={e => onUpdate({ answer: e.target.value } as any)}
              className="w-full px-2 py-1.5 rounded border bg-background text-sm"
            />
          </Field>
        </div>
      )}

      {question.type === "fill_blank" && (
        <Field label={ar ? "الإجابة الصحيحة (تظهر في صفحة الإجابات)" : "Answer (shown in answer key)"}>
          <input
            value={question.answer}
            onChange={e => onUpdate({ answer: e.target.value } as any)}
            placeholder={ar ? "الكلمة الصحيحة" : "Correct word/phrase"}
            className="w-full px-3 py-2 rounded border bg-background text-sm"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            {ar ? 'تأكد من وجود "____" في نص السؤال مكان الفراغ.' : 'Make sure "____" appears in the prompt where the blank goes.'}
          </div>
        </Field>
      )}

      {question.type === "matching" && (
        <div className="space-y-2">
          <input
            value={question.prompt ?? ""}
            onChange={e => onUpdate({ prompt: e.target.value } as any)}
            placeholder={ar ? "تعليمات (اختياري)، مثل: صل بين العمودين" : "Instruction (optional), e.g., Match the columns"}
            className="w-full px-3 py-2 rounded border bg-background text-sm"
          />
          {question.pairs.map((pair, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={pair.left}
                onChange={e => {
                  const next = question.pairs.slice();
                  next[i] = { ...next[i], left: e.target.value };
                  onUpdate({ pairs: next } as any);
                }}
                placeholder={`${ar ? "العمود الأول" : "Left"} ${i + 1}`}
                className="flex-1 px-2 py-1.5 rounded border bg-background text-sm"
              />
              <span className="text-muted-foreground">↔</span>
              <input
                value={pair.right}
                onChange={e => {
                  const next = question.pairs.slice();
                  next[i] = { ...next[i], right: e.target.value };
                  onUpdate({ pairs: next } as any);
                }}
                placeholder={`${ar ? "العمود الثاني" : "Right"} ${i + 1}`}
                className="flex-1 px-2 py-1.5 rounded border bg-background text-sm"
              />
              <button
                onClick={() => {
                  const next = question.pairs.filter((_, j) => j !== i);
                  if (next.length < 2) return;
                  onUpdate({ pairs: next } as any);
                }}
                disabled={question.pairs.length <= 2}
                className="text-red-400 disabled:opacity-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {question.pairs.length < 10 && (
            <button
              onClick={() => onUpdate({ pairs: [...question.pairs, { left: "", right: "" }] } as any)}
              className="text-[11px] font-bold flex items-center gap-1"
              style={{ color: BRAND_PRIMARY }}
            >
              <Plus className="w-3 h-3" /> {ar ? "أضف زوجًا" : "Add pair"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Full-screen preview overlay used by the "معاينة بدون حفظ" / Preview
 * button. Renders the canonical `<WorksheetPrintView />` against an
 * in-memory draft (no save, no fetch) so the teacher can see exactly
 * what the printable looks like, then either return to editing, print
 * to PDF, or download as Word — all without persisting anything.
 *
 * The page layout panel is also available here: all changes stay
 * in-memory (they are not saved until the teacher explicitly clicks
 * "Save & Open Print Page" from the editor).
 */
function PreviewOverlay({
  ar, data: initialData, onClose,
}: { ar: boolean; data: WorksheetData; onClose: () => void }) {
  // Local data state so the page-layout panel can reorder questions
  // and set manual breaks without touching the saved worksheet.
  const [data, setData] = useState<WorksheetData>(initialData);

  const handleWord = () => {
    const root = document.getElementById("ws-printable-root");
    if (!root) {
      toast.error(ar ? "تعذّر إعداد الملف" : "Could not prepare file");
      return;
    }
    downloadAsWord({ element: root, title: data.title, lang: data.language });
  };

  const handleLayoutChange = (newQuestions: Question[], newPageBreaks: string[]) => {
    setData(prev => ({
      ...prev,
      questions: newQuestions,
      settings: { ...prev.settings, pageBreaks: newPageBreaks },
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-neutral-200 overflow-auto"
      dir={data.language === "ar" ? "rtl" : "ltr"}
    >
      <div
        className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white"
      >
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {ar ? "رجوع للتعديل" : "Back to edit"}
        </button>
        <div className="text-xs font-bold truncate flex-1 text-center" style={{ color: BRAND_PRIMARY }}>
          {ar ? "معاينة بدون حفظ" : "Preview (not saved)"} · {data.title}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <button
            onClick={handleWord}
            className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
            style={{ borderColor: `${BRAND_GOLD}88`, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
            title={ar ? "تنزيل كملف وورد" : "Download as Word"}
          >
            <FileType className="w-3.5 h-3.5" />
            {ar ? "وورد" : "Word"}
          </button>
          <button
            onClick={() => printToPdf()}
            className="px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm"
            style={{ background: BRAND_PRIMARY }}
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? "PDF / طباعة" : "PDF / Print"}
          </button>
        </div>
      </div>
      <WorksheetPrintView data={data} onLayoutChange={handleLayoutChange} />
    </motion.div>
  );
}
