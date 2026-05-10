import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Eye, BookOpen, Target, Package, Library,
  Flame, Compass, Activity, ClipboardCheck, Flag, Home, Users,
  StickyNote, Clock, Upload, FileType, ImageIcon, FileText,
  ArrowLeft, Printer, Link2, RotateCcw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { LessonPlanPrintView, type PlanData } from "@/pages/teacher/lesson-plan-print";
import { downloadAsWord, printToPdf } from "@/lib/print-export";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

const LP_PREFS_KEY = "hasad:lessonplan:prefs";
const LP_META_KEY = "hasad:lessonplan:meta";

interface LpPrefs {
  contentLang?: "ar" | "en";
  aiPedagogy?: "direct" | "inquiry" | "project" | "flipped" | "mixed";
  aiNotes?: string;
}

interface LpMeta {
  subject?: string;
  gradeLevel?: string;
  durationMinutes?: number;
}

const LP_DEFAULT_PREFS: Required<LpPrefs> = {
  contentLang: "ar",
  aiPedagogy: "mixed",
  aiNotes: "",
};

const LP_VALID_PEDAGOGIES = new Set(["direct", "inquiry", "project", "flipped", "mixed"]);

function validateLpPrefs(raw: unknown): LpPrefs {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const result: LpPrefs = {};
  if (p.contentLang === "ar" || p.contentLang === "en") result.contentLang = p.contentLang;
  if (typeof p.aiPedagogy === "string" && LP_VALID_PEDAGOGIES.has(p.aiPedagogy)) {
    result.aiPedagogy = p.aiPedagogy as LpPrefs["aiPedagogy"];
  }
  if (typeof p.aiNotes === "string") result.aiNotes = p.aiNotes.slice(0, 2000);
  return result;
}

function validateLpMeta(raw: unknown): LpMeta {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const result: LpMeta = {};
  if (typeof p.subject === "string") result.subject = p.subject.slice(0, 200);
  if (typeof p.gradeLevel === "string") result.gradeLevel = p.gradeLevel.slice(0, 200);
  if (typeof p.durationMinutes === "number" && p.durationMinutes >= 15 && p.durationMinutes <= 180) {
    result.durationMinutes = p.durationMinutes;
  }
  return result;
}

function loadLpPrefs(): LpPrefs {
  try {
    const raw = localStorage.getItem(LP_PREFS_KEY);
    return raw ? validateLpPrefs(JSON.parse(raw)) : {};
  } catch { return {}; }
}

function loadLpMeta(): LpMeta {
  try {
    const raw = localStorage.getItem(LP_META_KEY);
    return raw ? validateLpMeta(JSON.parse(raw)) : {};
  } catch { return {}; }
}

function saveLpPrefs(prefs: LpPrefs) {
  try { localStorage.setItem(LP_PREFS_KEY, JSON.stringify(prefs)); } catch { }
}

function saveLpMeta(meta: LpMeta) {
  try { localStorage.setItem(LP_META_KEY, JSON.stringify(meta)); } catch { }
}

function clearLpPrefs() {
  try { localStorage.removeItem(LP_PREFS_KEY); } catch { }
}

interface Block { title?: string; durationMinutes?: number; description: string }
/** Optional reference linking this lesson-plan activity to an existing
 *  Hasad activity (assignment or interactive video).
 *  Stored alongside the activity so the teacher can deep-link from the
 *  printable plan back to the actual platform asset. */
interface ActivityRef {
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

type LpFontFamily = "default" | "cairo" | "tajawal" | "amiri" | "naskh" | "reem" | "inter" | "serif" | "mono";

interface Sections {
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

interface Settings {
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

interface PlanRow {
  id: number;
  teacherId: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  durationMinutes: number | null;
  sections: Sections;
  settings: Settings;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  ownerName?: string | null;
  ownerIsAdmin?: boolean;
}

const blankSections = (): Sections => ({
  objectives: [],
  materials: [],
  vocabulary: [],
  warmUp: { description: "", durationMinutes: 5 },
  introduction: { description: "", durationMinutes: 7 },
  activities: [],
  assessment: { description: "" },
  closure: { description: "" },
});

const blankSettings = (): Settings => ({
  includeObjectives: true,
  includeMaterials: true,
  includeVocabulary: true,
  includeWarmUp: true,
  includeIntroduction: true,
  includeActivities: true,
  includeAssessment: true,
  includeClosure: true,
  includeHomework: true,
  includeDifferentiation: true,
  includeNotes: true,
  // Font + date controls — left undefined so the print view's resolver
  // applies the language-appropriate defaults until the teacher picks.
  fontFamily: "default",
  fontSizePt: 11.5,
  lessonDateGregorian: "",
  lessonDateHijri: "",
});

export default function LessonPlanCreate() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  // Load saved AI prefs once at mount time.
  const _lpPrefs = useMemo(() => loadLpPrefs(), []);

  // Load saved meta (subject/grade/duration) only when NOT opening an existing plan for editing.
  const _isEditMode = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get("edit");
    return !!v && Number.isFinite(Number(v)) && Number(v) > 0;
  }, []);
  const _lpMeta = useMemo(() => (_isEditMode ? {} : loadLpMeta()), [_isEditMode]);

  const [contentLang, setContentLang] = useState<"ar" | "en">(_lpPrefs.contentLang ?? lang);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(_lpMeta.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(_lpMeta.gradeLevel ?? "");
  const [durationMinutes, setDurationMinutes] = useState<number>(_lpMeta.durationMinutes ?? 45);

  const [sections, setSections] = useState<Sections>(blankSections());
  const [settings, setSettings] = useState<Settings>(blankSettings());

  // AI panel state
  const [aiTopic, setAiTopic] = useState("");
  const [aiPedagogy, setAiPedagogy] = useState<"direct" | "inquiry" | "project" | "flipped" | "mixed">(_lpPrefs.aiPedagogy ?? "mixed");
  const [aiNotes, setAiNotes] = useState(_lpPrefs.aiNotes ?? "");
  const [generating, setGenerating] = useState(false);

  // Persist AI prefs to localStorage whenever they change (skip initial mount).
  const lpDidMountRef = useRef(false);
  const lpSkipNextSaveRef = useRef(false);
  useEffect(() => {
    if (!lpDidMountRef.current) { lpDidMountRef.current = true; return; }
    if (lpSkipNextSaveRef.current) { lpSkipNextSaveRef.current = false; return; }
    saveLpPrefs({ contentLang, aiPedagogy, aiNotes });
  }, [contentLang, aiPedagogy, aiNotes]);

  // Persist lesson meta (subject / grade / duration) whenever they change (skip initial mount).
  const lpMetaDidMountRef = useRef(false);
  useEffect(() => {
    if (!lpMetaDidMountRef.current) { lpMetaDidMountRef.current = true; return; }
    saveLpMeta({ subject, gradeLevel, durationMinutes });
  }, [subject, gradeLevel, durationMinutes]);

  const handleLpRestoreDefaults = useCallback(() => {
    clearLpPrefs();
    lpSkipNextSaveRef.current = true;
    setContentLang(lang as "ar" | "en");
    setAiPedagogy(LP_DEFAULT_PREFS.aiPedagogy);
    setAiNotes(LP_DEFAULT_PREFS.aiNotes);
  }, [lang]);

  // File extraction (multi-file: 5 max for teachers, 25 max for admins).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileLimits = useMemo(() => ({
    maxFiles: isAdmin ? 25 : 5,
    maxBytes: isAdmin ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
    maxMb: isAdmin ? 200 : 50,
  }), [isAdmin]);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setIsAdmin(!!p.isAdmin); })
      .catch(() => { /* non-fatal */ });
  }, []);

  // Saved templates modal
  const [showSaved, setShowSaved] = useState(false);
  const [savedRows, setSavedRows] = useState<PlanRow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [saving, setSaving] = useState(false);

  // editingId !== null → save will PUT (update) instead of POST (create).
  // Set when the page is opened with ?edit=<id> or via "Open" in the
  // saved-plans modal. Wired into handleSave below.
  const [editingId, setEditingId] = useState<number | null>(null);

  // Preview-without-save overlay state. Lets the teacher see the printable
  // page in-place using the current draft and bounce back without losing
  // their edits — fulfils requirement #5 for lesson plans.
  const [previewing, setPreviewing] = useState(false);

  // If the URL contains ?edit=<id>, fetch that lesson plan and populate
  // the editor on mount. Mirrors the worksheet edit flow so the teacher
  // can land here from the print page's "Edit" button.
  //
  // Race-safety: if the teacher starts typing before the fetch resolves
  // we must not overwrite their in-progress edits. The ref below is
  // flipped by every onChange handler that mutates draft state.
  const editLoadDirtyRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit");
    const idNum = editParam ? Number(editParam) : NaN;
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    fetch(`${API_BASE}/api/lesson-plans/${idNum}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((row: PlanRow | null) => {
        if (!row) return;
        if (editLoadDirtyRef.current) {
          // Teacher already started editing — bind id only, keep their work.
          setEditingId(row.id);
          return;
        }
        setEditingId(row.id);
        setTitle(row.title ?? "");
        setSubject(row.subject ?? "");
        setGradeLevel(row.gradeLevel ?? "");
        setDurationMinutes(row.durationMinutes ?? 45);
        setContentLang(row.language);
        setSections({ ...blankSections(), ...row.sections });
        setSettings({ ...blankSettings(), ...row.settings });
      })
      .catch(() => { /* silent — user can re-open from the dashboard */ });
  }, []);

  const t = useMemo(() => ({
    headline: ar ? "مولّد خطط الدروس" : "Lesson Plan Generator",
    sub: ar ? "خطّط حصّة كاملة بمساعدة الذكاء الاصطناعي" : "Plan a full class period with AI assistance",
    title: ar ? "عنوان الدرس" : "Lesson title",
    subject: ar ? "المادة" : "Subject",
    grade: ar ? "المرحلة" : "Grade level",
    duration: ar ? "مدة الحصة (بالدقائق)" : "Period length (minutes)",
    contentLang: ar ? "لغة المحتوى" : "Content language",
    aiPanel: ar ? "توليد بالذكاء الاصطناعي" : "Generate with AI",
    aiTopic: ar ? "موضوع الدرس" : "Lesson topic",
    aiTopicPh: ar ? "مثال: كسور بسيطة، الجمل الاسمية، دورة الماء" : "e.g. simple fractions, water cycle",
    aiPedagogy: ar ? "المنهجية" : "Pedagogy",
    aiNotes: ar ? "ملاحظات إضافية (اختياري)" : "Extra notes (optional)",
    aiNotesPh: ar ? "أي تركيز خاص أو متطلبات تربوية" : "Any focus area or special needs",
    generate: ar ? "توليد" : "Generate",
    sectionsHead: ar ? "أقسام الخطة" : "Plan sections",
    objectives: ar ? "الأهداف" : "Objectives",
    materials: ar ? "المواد والأدوات" : "Materials",
    vocabulary: ar ? "المفردات" : "Vocabulary",
    warmUp: ar ? "التهيئة (الإحماء)" : "Warm-up",
    introduction: ar ? "التمهيد" : "Introduction",
    activities: ar ? "الأنشطة" : "Activities",
    assessment: ar ? "التقويم" : "Assessment",
    closure: ar ? "الخاتمة" : "Closure",
    homework: ar ? "الواجب المنزلي" : "Homework",
    differentiation: ar ? "تنويع التعليم" : "Differentiation",
    notes: ar ? "ملاحظات المعلم" : "Teacher notes",
    settingsHead: ar ? "إعدادات الطباعة" : "Print settings",
    headerNote: ar ? "ملاحظة الترويسة" : "Header note",
    footerNote: ar ? "ملاحظة الذيل" : "Footer note",
    fontFamily: ar ? "نوع الخط" : "Font family",
    fontSize: ar ? "حجم الخط" : "Font size",
    dateGreg: ar ? "التاريخ الميلادي" : "Gregorian date",
    dateHijri: ar ? "التاريخ الهجري" : "Hijri date",
    dateGregPh: ar ? "مثال: 2026/05/15" : "e.g. 2026-05-15",
    dateHijriPh: ar ? "مثال: 1447/11/27" : "e.g. 1447-11-27",
    linkActivity: ar ? "ربط بنشاط حصاد" : "Link Hasad activity",
    linkedActivity: ar ? "النشاط المرتبط" : "Linked activity",
    unlink: ar ? "إلغاء الربط" : "Unlink",
    pickActivity: ar ? "اختر نشاطًا" : "Pick an activity",
    pickerEmpty: ar ? "لا توجد عناصر." : "No items.",
    pickerLoading: ar ? "جاري التحميل..." : "Loading...",
    pickerSearch: ar ? "بحث..." : "Search...",
    tabAssignments: ar ? "الواجبات" : "Assignments",
    tabVideos: ar ? "دروس الفيديو" : "Video lessons",
    save: ar ? "حفظ" : "Save",
    preview: ar ? "معاينة بدون حفظ" : "Preview without saving",
    backToEdit: ar ? "رجوع للتعديل" : "Back to edit",
    word: ar ? "وورد" : "Word",
    pdf: ar ? "PDF / طباعة" : "PDF / Print",
    mySaved: ar ? "خططي" : "My Plans",
    saved: ar ? "تم الحفظ" : "Saved",
    minute: ar ? "د" : "min",
    add: ar ? "إضافة" : "Add",
    addObj: ar ? "أضف هدفًا" : "Add objective",
    addMat: ar ? "أضف مادة" : "Add material",
    addVocab: ar ? "أضف مصطلحًا" : "Add term",
    addAct: ar ? "أضف نشاطًا" : "Add activity",
    actTitle: ar ? "عنوان النشاط" : "Activity title",
    description: ar ? "الوصف" : "Description",
    method: ar ? "أسلوب التقويم" : "Method",
    support: ar ? "للطلاب الذين يحتاجون دعمًا" : "Support",
    extension: ar ? "للطلاب المتقدّمين" : "Extension",
    term: ar ? "المصطلح" : "Term",
    def: ar ? "التعريف" : "Definition",
    pedDirect: ar ? "تعليم مباشر" : "Direct instruction",
    pedInquiry: ar ? "استقصائي" : "Inquiry",
    pedProject: ar ? "بالمشاريع" : "Project-based",
    pedFlipped: ar ? "صف معكوس" : "Flipped",
    pedMixed: ar ? "متنوّع" : "Mixed",
    confirmDel: ar ? "حذف؟" : "Delete?",
    delete: ar ? "حذف" : "Delete",
    open: ar ? "فتح" : "Open",
    noSaved: ar ? "لا توجد خطط محفوظة بعد." : "No saved plans yet.",
    sharedByAdmin: ar ? "مُشارك من مكتبة الإدارة" : "Shared by admin",
    saveError: ar ? "تعذّر الحفظ" : "Save failed",
    aiError: ar ? "تعذّر التوليد" : "Generation failed",
    titleRequired: ar ? "أدخل عنوان الدرس أولًا" : "Please enter a lesson title first",
    topicRequired: ar ? "أدخل موضوع الدرس" : "Please enter a topic",
  }), [ar]);

  function loadSaved() {
    setLoadingSaved(true);
    fetch(`${API_BASE}/api/lesson-plans`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(rows => setSavedRows(Array.isArray(rows) ? rows : []))
      .finally(() => setLoadingSaved(false));
  }

  useEffect(() => { if (showSaved) loadSaved(); }, [showSaved]);

  async function handleGenerate() {
    if (!aiTopic.trim()) {
      toast.error(t.topicRequired);
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch(`${API_BASE}/api/lesson-plans/ai/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: contentLang,
          topic: aiTopic.trim(),
          subject: subject || undefined,
          gradeLevel: gradeLevel || undefined,
          durationMinutes,
          pedagogy: aiPedagogy,
          notes: aiNotes.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data?.message || t.aiError);
        return;
      }
      if (data?.sections) {
        setSections(data.sections);
        toast.success(ar ? "تم توليد الخطة" : "Plan generated");
      }
    } catch {
      toast.error(t.aiError);
    } finally {
      setGenerating(false);
    }
  }

  /* Generate the lesson plan from one or more uploaded source files.
     Mirrors the worksheet `/ai/extract` flow — multipart POST with all
     files under the "files" field plus the topic / pedagogy / notes
     metadata. Per-tier limits are enforced both client-side (instant
     feedback) and server-side (authoritative). */
  async function extractFromFiles() {
    if (pickedFiles.length === 0) {
      toast.error(ar ? "اختر ملفًا واحدًا على الأقل" : "Pick at least one file");
      return;
    }
    setExtracting(true);
    try {
      const fd = new FormData();
      for (const f of pickedFiles) fd.append("files", f);
      fd.append("language", contentLang);
      if (aiTopic.trim()) fd.append("topic", aiTopic.trim());
      if (subject.trim()) fd.append("subject", subject.trim());
      if (gradeLevel.trim()) fd.append("gradeLevel", gradeLevel.trim());
      fd.append("durationMinutes", String(durationMinutes));
      fd.append("pedagogy", aiPedagogy);
      if (aiNotes.trim()) fd.append("notes", aiNotes.trim());

      const res = await fetch(`${API_BASE}/api/lesson-plans/ai/extract`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || t.aiError);
        return;
      }
      if (data?.sections) {
        setSections(data.sections);
        if (!title.trim()) {
          const baseName = pickedFiles[0].name.replace(/\.[^.]+$/, "").slice(0, 80);
          setTitle(baseName);
        }
        toast.success(ar ? `تم توليد الخطة من ${pickedFiles.length} ملف` : `Plan generated from ${pickedFiles.length} file(s)`);
        setPickedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      toast.error(t.aiError);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || title.trim().length < 2) {
      toast.error(t.titleRequired);
      return;
    }
    setSaving(true);
    try {
      // Strip empty optional sub-objects so Zod doesn't reject them.
      const payload = {
        title: title.trim(),
        language: contentLang,
        subject: subject.trim() || null,
        gradeLevel: gradeLevel.trim() || null,
        durationMinutes,
        sections: cleanSections(sections),
        settings,
      };
      const url = editingId
        ? `${API_BASE}/api/lesson-plans/${editingId}`
        : `${API_BASE}/api/lesson-plans`;
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data?.message || t.saveError);
        return;
      }
      toast.success(t.saved);
      const savedId = editingId ?? data.id;
      setLocation(`/teacher/lesson-plans/${savedId}/print`);
    } catch {
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const r = await fetch(`${API_BASE}/api/lesson-plans/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      setSavedRows(rows => rows.filter(x => x.id !== id));
      toast.success(ar ? "تم الحذف" : "Deleted");
    }
  }

  function loadIntoEditor(row: PlanRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setSubject(row.subject ?? "");
    setGradeLevel(row.gradeLevel ?? "");
    setDurationMinutes(row.durationMinutes ?? 45);
    setContentLang(row.language);
    setSections({ ...blankSections(), ...row.sections });
    setSettings({ ...blankSettings(), ...row.settings });
    setShowSaved(false);
  }

  // Build a PlanData snapshot of the current draft for the in-page
  // preview overlay. ownerName is left blank since we don't need it on
  // the printable surface (the brand line is already gone).
  const draftPlanData: PlanData = useMemo(() => ({
    id: editingId ?? 0,
    title: title.trim() || (ar ? "خطة درس" : "Lesson Plan"),
    language: contentLang,
    gradeLevel: gradeLevel.trim() || null,
    subject: subject.trim() || null,
    durationMinutes,
    sections: cleanSections(sections),
    settings,
    ownerName: "",
    isOwner: true,
  }), [editingId, title, contentLang, gradeLevel, subject, durationMinutes, sections, settings, ar]);

  // ──────────────────────────────────────────────────── render
  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-screen pb-32"
        style={{ background: `linear-gradient(180deg, ${BRAND_PRIMARY}06 0%, transparent 200px)` }}
        onInput={() => { editLoadDirtyRef.current = true; }}
        onChange={() => { editLoadDirtyRef.current = true; }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
                <BookOpen className="w-7 h-7" style={{ color: BRAND_GOLD }} />
                {t.headline}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t.sub}</p>
            </div>
            <button
              onClick={() => setShowSaved(true)}
              className="px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 min-h-[44px]"
              style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY, background: "white" }}
            >
              <FolderOpen className="w-4 h-4" />
              {t.mySaved}
            </button>
          </div>

          {/* Meta */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t.title}>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm font-bold min-h-[44px]"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                  placeholder={ar ? "مثال: درس الكسور" : "e.g. Lesson on fractions"}
                />
              </Field>
              <Field label={t.duration}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Math.max(15, Math.min(180, parseInt(e.target.value, 10) || 45)))}
                    className="w-24 px-3 py-2.5 border rounded-xl text-sm font-bold min-h-[44px]"
                    style={{ borderColor: `${BRAND_PRIMARY}33` }}
                  />
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t.minute}</span>
                </div>
              </Field>
              <Field label={t.subject}>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm min-h-[44px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              </Field>
              <Field label={t.grade}>
                <input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm min-h-[44px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              </Field>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-muted-foreground">{t.contentLang}:</span>
              <button onClick={() => setContentLang("ar")} className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] ${contentLang === "ar" ? "text-white" : ""}`} style={{ background: contentLang === "ar" ? BRAND_PRIMARY : `${BRAND_PRIMARY}11`, color: contentLang === "ar" ? "white" : BRAND_PRIMARY }}>العربية</button>
              <button onClick={() => setContentLang("en")} className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] ${contentLang === "en" ? "text-white" : ""}`} style={{ background: contentLang === "en" ? BRAND_PRIMARY : `${BRAND_PRIMARY}11`, color: contentLang === "en" ? "white" : BRAND_PRIMARY }}>English</button>
            </div>
          </Card>

          {/* AI panel */}
          <Card className="p-4 sm:p-5" style={{ background: `linear-gradient(135deg, ${BRAND_GOLD}11 0%, ${BRAND_PRIMARY}08 100%)` }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" style={{ color: BRAND_GOLD }} />
              <h2 className="font-extrabold text-lg" style={{ color: BRAND_PRIMARY }}>{t.aiPanel}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t.aiTopic}>
                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={t.aiTopicPh} className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white min-h-[44px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              </Field>
              <Field label={t.aiPedagogy}>
                <select value={aiPedagogy} onChange={e => setAiPedagogy(e.target.value as any)} className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white min-h-[44px]" style={{ borderColor: `${BRAND_PRIMARY}33` }}>
                  <option value="mixed">{t.pedMixed}</option>
                  <option value="direct">{t.pedDirect}</option>
                  <option value="inquiry">{t.pedInquiry}</option>
                  <option value="project">{t.pedProject}</option>
                  <option value="flipped">{t.pedFlipped}</option>
                </select>
              </Field>
            </div>
            <Field label={t.aiNotes} className="mt-3">
              <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)} placeholder={t.aiNotesPh} rows={2} className="w-full px-3 py-2 border rounded-xl text-sm bg-white" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
            </Field>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleLpRestoreDefaults}
                title={ar ? "استعادة الإعدادات الافتراضية" : "Restore defaults"}
                className="px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
                style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {ar ? "إعادة ضبط" : "Reset"}
              </button>
              <button onClick={handleGenerate} disabled={generating || extracting} className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 text-white shadow-md disabled:opacity-60 min-h-[44px]" style={{ background: BRAND_PRIMARY }}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {t.generate}
              </button>
            </div>

            {/* File extraction sub-panel — multi-file (up to 5 for
                teachers, 25 for admins). Generates a complete plan from
                the uploaded source content. */}
            <div className="pt-3 mt-3 border-t" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
              <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: BRAND_PRIMARY }}>
                <Upload className="w-3.5 h-3.5" />
                {ar
                  ? `أو ارفع ملفات (صور / PDF / Word) لتوليد الخطة منها — حتى ${fileLimits.maxFiles} ملفات${isAdmin ? " (مسؤول)" : ""}`
                  : `Or upload files (images / PDF / Word) to generate the plan — up to ${fileLimits.maxFiles} files${isAdmin ? " (admin)" : ""}`}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <label
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/40 transition-colors text-xs bg-white"
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
                      ? (ar ? `اضغط لإضافة المزيد (${pickedFiles.length}/${fileLimits.maxFiles})` : `Click to add more (${pickedFiles.length}/${fileLimits.maxFiles})`)
                      : (ar ? `اضغط لاختيار الملفات — حتى ${fileLimits.maxMb} ميجا للملف` : `Click to pick files — up to ${fileLimits.maxMb} MB each`)}
                  </label>
                  <button
                    onClick={extractFromFiles}
                    disabled={pickedFiles.length === 0 || extracting || generating}
                    className="px-4 py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
                    style={{ background: BRAND_PRIMARY }}
                  >
                    {extracting
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ar ? "جارٍ القراءة..." : "Extracting..."}</>
                      : <><FileText className="w-3.5 h-3.5" /> {ar ? `ولّد من الملفات (${pickedFiles.length})` : `Generate from files (${pickedFiles.length})`}</>}
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
          </Card>

          {/* Sections editor */}
          <h2 className="text-lg font-extrabold mt-2" style={{ color: BRAND_PRIMARY }}>{t.sectionsHead}</h2>

          <ListSection
            title={t.objectives} icon={<Target className="w-4 h-4" />}
            items={sections.objectives} setItems={(v) => setSections(s => ({ ...s, objectives: v }))}
            placeholder={ar ? "سيكون الطالب قادرًا على ..." : "Students will be able to ..."}
            addLabel={t.addObj} ar={ar}
          />

          <ListSection
            title={t.materials} icon={<Package className="w-4 h-4" />}
            items={sections.materials} setItems={(v) => setSections(s => ({ ...s, materials: v }))}
            placeholder={ar ? "مثال: السبورة، أوراق عمل" : "e.g. whiteboard, worksheets"}
            addLabel={t.addMat} ar={ar}
          />

          <VocabularySection
            title={t.vocabulary} icon={<Library className="w-4 h-4" />}
            items={sections.vocabulary} setItems={(v) => setSections(s => ({ ...s, vocabulary: v }))}
            ar={ar} t={t}
          />

          <BlockSection
            title={t.warmUp} icon={<Flame className="w-4 h-4" />}
            block={sections.warmUp} setBlock={(b) => setSections(s => ({ ...s, warmUp: b }))}
            ar={ar} t={t}
          />

          <BlockSection
            title={t.introduction} icon={<Compass className="w-4 h-4" />}
            block={sections.introduction} setBlock={(b) => setSections(s => ({ ...s, introduction: b }))}
            ar={ar} t={t}
          />

          <ActivitiesSection
            title={t.activities} icon={<Activity className="w-4 h-4" />}
            items={sections.activities} setItems={(v) => setSections(s => ({ ...s, activities: v }))}
            ar={ar} t={t}
          />

          <SimpleBlockSection
            title={t.assessment} icon={<ClipboardCheck className="w-4 h-4" />}
            description={sections.assessment.description}
            setDescription={(v) => setSections(s => ({ ...s, assessment: { ...s.assessment, description: v } }))}
            extra={
              <Field label={t.method}>
                <input
                  value={sections.assessment.method ?? ""}
                  onChange={e => setSections(s => ({ ...s, assessment: { ...s.assessment, method: e.target.value } }))}
                  placeholder={ar ? "مثال: ورقة قصيرة، أسئلة شفهية" : "e.g. exit ticket, oral questioning"}
                  className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
              </Field>
            }
          />

          <SimpleBlockSection
            title={t.closure} icon={<Flag className="w-4 h-4" />}
            description={sections.closure.description}
            setDescription={(v) => setSections(s => ({ ...s, closure: { description: v } }))}
          />

          <SimpleBlockSection
            title={t.homework} icon={<Home className="w-4 h-4" />}
            description={sections.homework?.description ?? ""}
            setDescription={(v) => setSections(s => ({ ...s, homework: v ? { description: v } : undefined }))}
          />

          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: BRAND_GOLD }} />
              <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{t.differentiation}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t.support}>
                <textarea
                  value={sections.differentiation?.support ?? ""}
                  onChange={e => setSections(s => ({
                    ...s,
                    differentiation: cleanDiff({ ...s.differentiation, support: e.target.value }),
                  }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
              </Field>
              <Field label={t.extension}>
                <textarea
                  value={sections.differentiation?.extension ?? ""}
                  onChange={e => setSections(s => ({
                    ...s,
                    differentiation: cleanDiff({ ...s.differentiation, extension: e.target.value }),
                  }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4" style={{ color: BRAND_GOLD }} />
              <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{t.notes}</h3>
            </div>
            <textarea
              value={sections.notes ?? ""}
              onChange={e => setSections(s => ({ ...s, notes: e.target.value || undefined }))}
              rows={3}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              style={{ borderColor: `${BRAND_PRIMARY}33` }}
              placeholder={ar ? "ملاحظات سريعة لنفسك أثناء الحصة" : "Quick reminders for yourself during the lesson"}
            />
          </Card>

          {/* Print settings */}
          <Card className="p-4 sm:p-5 space-y-3">
            <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{t.settingsHead}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                ["includeObjectives", t.objectives],
                ["includeMaterials", t.materials],
                ["includeVocabulary", t.vocabulary],
                ["includeWarmUp", t.warmUp],
                ["includeIntroduction", t.introduction],
                ["includeActivities", t.activities],
                ["includeAssessment", t.assessment],
                ["includeClosure", t.closure],
                ["includeHomework", t.homework],
                ["includeDifferentiation", t.differentiation],
                ["includeNotes", t.notes],
              ] as Array<[keyof Settings, string]>).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-muted/30 min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={!!settings[key]}
                    onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Field label={t.headerNote}>
                <input value={settings.headerNote ?? ""} onChange={e => setSettings(s => ({ ...s, headerNote: e.target.value }))} className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              </Field>
              <Field label={t.footerNote}>
                <input value={settings.footerNote ?? ""} onChange={e => setSettings(s => ({ ...s, footerNote: e.target.value }))} className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              </Field>
              {/* Date pair — Gregorian + Hijri. Both are free-text so the
                  teacher can paste from her school calendar without us
                  hard-coding a Hijri converter (they vary by region). */}
              <Field label={t.dateGreg}>
                <input
                  value={settings.lessonDateGregorian ?? ""}
                  onChange={e => setSettings(s => ({ ...s, lessonDateGregorian: e.target.value }))}
                  placeholder={t.dateGregPh}
                  className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
              </Field>
              <Field label={t.dateHijri}>
                <input
                  value={settings.lessonDateHijri ?? ""}
                  onChange={e => setSettings(s => ({ ...s, lessonDateHijri: e.target.value }))}
                  placeholder={t.dateHijriPh}
                  className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
              </Field>
              {/* Font family + size — applies to the printable plan only.
                  Mirrors the worksheet font controls; "default" means the
                  print view picks the language-appropriate stack. */}
              <Field label={t.fontFamily}>
                <select
                  value={settings.fontFamily ?? "default"}
                  onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value as LpFontFamily }))}
                  className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px] bg-white"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                >
                  <option value="default">{ar ? "افتراضي" : "Default"}</option>
                  <option value="cairo">Cairo</option>
                  <option value="tajawal">Tajawal</option>
                  <option value="amiri">Amiri</option>
                  <option value="naskh">Noto Naskh Arabic</option>
                  <option value="reem">Reem Kufi</option>
                  <option value="inter">Inter</option>
                  <option value="serif">{ar ? "خط مذيّل" : "Serif"}</option>
                  <option value="mono">{ar ? "خط ثابت العرض" : "Monospace"}</option>
                </select>
              </Field>
              <Field label={`${t.fontSize}: ${(settings.fontSizePt ?? 11.5).toFixed(1)} pt`}>
                <input
                  type="range"
                  min={9}
                  max={18}
                  step={0.5}
                  value={settings.fontSizePt ?? 11.5}
                  onChange={e => setSettings(s => ({ ...s, fontSizePt: parseFloat(e.target.value) }))}
                  className="w-full accent-[#225739]"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* Sticky action bar — Preview-without-save (gold, secondary) +
            Save (green, primary). Save now respects editingId so editing
            an existing plan updates in place rather than creating a copy. */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t p-3 z-40 lg:pb-3 pb-24" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
          <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setPreviewing(true)}
              className="px-4 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 shadow-md min-h-[48px] border-2"
              style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
            >
              <Eye className="w-4 h-4" />
              {t.preview}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 text-white shadow-lg disabled:opacity-60 min-h-[48px]" style={{ background: BRAND_PRIMARY }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t.save}
            </button>
          </div>
        </div>

        {/* Preview-without-save overlay. Renders the same printable view
            used by the dedicated print page, so the teacher can see
            exactly what they'll get before committing. The toolbar offers
            Back-to-edit, Word download, and PDF/print. */}
        <AnimatePresence>
          {previewing && (
            <motion.div
              key="lp-preview"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white z-[60] overflow-auto"
            >
              <div
                dir={dir}
                className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white"
              >
                <button
                  onClick={() => setPreviewing(false)}
                  className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
                  style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.backToEdit}
                </button>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => {
                      const root = document.getElementById("lp-printable-root");
                      if (!root) {
                        toast.error(ar ? "تعذّر إعداد الملف" : "Could not prepare file");
                        return;
                      }
                      downloadAsWord({ element: root, title: draftPlanData.title, lang: draftPlanData.language });
                    }}
                    className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
                    style={{ borderColor: `${BRAND_GOLD}88`, color: BRAND_GOLD, background: `${BRAND_GOLD}10` }}
                  >
                    <FileType className="w-3.5 h-3.5" />
                    {t.word}
                  </button>
                  <button
                    onClick={() => printToPdf()}
                    className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 text-white shadow min-h-[40px]"
                    style={{ background: BRAND_PRIMARY }}
                  >
                    <Printer className="w-4 h-4" />
                    {t.pdf}
                  </button>
                </div>
              </div>
              <LessonPlanPrintView data={draftPlanData} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved templates modal */}
        <AnimatePresence>
          {showSaved && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setShowSaved(false)}
            >
              <motion.div
                initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }}
                onClick={e => e.stopPropagation()}
                dir={dir}
                className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-lg" style={{ color: BRAND_PRIMARY }}>{t.mySaved}</h3>
                  <button onClick={() => setShowSaved(false)} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px]"><X className="w-5 h-5" /></button>
                </div>
                {loadingSaved ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND_PRIMARY }} /></div>
                ) : savedRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">{t.noSaved}</div>
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
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${BRAND_GOLD}22`, color: BRAND_GOLD }}>{t.sharedByAdmin}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[row.subject, row.gradeLevel, row.durationMinutes ? `${row.durationMinutes} ${t.minute}` : ""].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <button onClick={() => loadIntoEditor(row)} className="px-3 py-2 rounded-lg text-xs font-bold border min-h-[36px]" style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}>
                            {t.open}
                          </button>
                          <button onClick={() => setLocation(`/teacher/lesson-plans/${row.id}/print`)} className="px-3 py-2 rounded-lg text-xs font-bold text-white min-h-[36px]" style={{ background: BRAND_PRIMARY }}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isAdminShared && (
                            <button onClick={() => { if (confirm(t.confirmDel)) handleDelete(row.id); }} className="px-2 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 min-h-[36px] min-w-[36px]">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

// ────────────────────────────────────────────────── helpers + sub-components

function cleanDiff(d: { support?: string; extension?: string } | undefined) {
  if (!d) return undefined;
  const support = (d.support ?? "").trim();
  const extension = (d.extension ?? "").trim();
  if (!support && !extension) return undefined;
  return { support: support || undefined, extension: extension || undefined };
}

function cleanSections(s: Sections): Sections {
  const out: Sections = {
    objectives: s.objectives.map(o => o.trim()).filter(Boolean),
    materials: s.materials.map(o => o.trim()).filter(Boolean),
    vocabulary: s.vocabulary
      .map(v => ({ term: (v.term ?? "").trim(), definition: (v.definition ?? "").trim() || undefined }))
      .filter(v => v.term),
    warmUp: { ...s.warmUp, description: s.warmUp.description.trim() || "—" },
    introduction: { ...s.introduction, description: s.introduction.description.trim() || "—" },
    activities: s.activities
      .map(a => ({ ...a, title: a.title.trim(), description: a.description.trim() }))
      .filter(a => a.title && a.description),
    assessment: { description: s.assessment.description.trim() || "—", method: (s.assessment.method ?? "").trim() || undefined },
    closure: { description: s.closure.description.trim() || "—" },
  };
  if (s.homework?.description?.trim()) out.homework = { description: s.homework.description.trim() };
  if (s.differentiation) out.differentiation = cleanDiff(s.differentiation);
  if (s.notes?.trim()) out.notes = s.notes.trim();
  return out;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-bold mb-1 block" style={{ color: BRAND_PRIMARY }}>{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({ title, icon, right }: { title: string; icon: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <span style={{ color: BRAND_GOLD }}>{icon}</span>
        <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{title}</h3>
      </div>
      {right}
    </div>
  );
}

function ListSection({
  title, icon, items, setItems, placeholder, addLabel, ar,
}: {
  title: string; icon: React.ReactNode;
  items: string[]; setItems: (v: string[]) => void;
  placeholder: string; addLabel: string; ar: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader title={title} icon={icon} right={
        <button onClick={() => setItems([...items, ""])} className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 min-h-[36px]" style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}>
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      } />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{ar ? "لا يوجد عناصر بعد." : "No items yet."}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold mt-2.5" style={{ color: BRAND_GOLD }}>{i + 1}.</span>
              <input
                value={item}
                onChange={e => { const next = [...items]; next[i] = e.target.value; setItems(next); }}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border rounded-xl text-sm min-h-[40px]"
                style={{ borderColor: `${BRAND_PRIMARY}33` }}
              />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-[40px] min-w-[40px]">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function VocabularySection({
  title, icon, items, setItems, ar, t,
}: {
  title: string; icon: React.ReactNode;
  items: VocabTerm[]; setItems: (v: VocabTerm[]) => void;
  ar: boolean; t: any;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader title={title} icon={icon} right={
        <button onClick={() => setItems([...items, { term: "", definition: "" }])} className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 min-h-[36px]" style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}>
          <Plus className="w-3.5 h-3.5" /> {t.addVocab}
        </button>
      } />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{ar ? "لا توجد مفردات بعد." : "No vocabulary yet."}</p>
      ) : (
        <div className="space-y-2">
          {items.map((v, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-center">
              <input value={v.term} onChange={e => { const next = [...items]; next[i] = { ...v, term: e.target.value }; setItems(next); }} placeholder={t.term} className="px-3 py-2 border rounded-xl text-sm font-bold min-h-[40px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              <input value={v.definition ?? ""} onChange={e => { const next = [...items]; next[i] = { ...v, definition: e.target.value }; setItems(next); }} placeholder={t.def} className="px-3 py-2 border rounded-xl text-sm min-h-[40px]" style={{ borderColor: `${BRAND_PRIMARY}33` }} />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg justify-self-end min-h-[40px] min-w-[40px]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BlockSection({
  title, icon, block, setBlock, ar, t,
}: {
  title: string; icon: React.ReactNode;
  block: Block; setBlock: (b: Block) => void;
  ar: boolean; t: any;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader title={title} icon={icon} right={
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="number"
            min={0}
            max={120}
            value={block.durationMinutes ?? 0}
            onChange={e => setBlock({ ...block, durationMinutes: Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)) })}
            className="w-16 px-2 py-1 border rounded text-xs"
            style={{ borderColor: `${BRAND_PRIMARY}33` }}
          />
          <span className="text-xs text-muted-foreground">{t.minute}</span>
        </div>
      } />
      <textarea
        value={block.description}
        onChange={e => setBlock({ ...block, description: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 border rounded-xl text-sm"
        style={{ borderColor: `${BRAND_PRIMARY}33` }}
        placeholder={ar ? "صف ما سيقوم به المعلم والطلاب" : "Describe what the teacher and students will do"}
      />
    </Card>
  );
}

function SimpleBlockSection({
  title, icon, description, setDescription, extra,
}: {
  title: string; icon: React.ReactNode;
  description: string; setDescription: (v: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span style={{ color: BRAND_GOLD }}>{icon}</span>
        <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{title}</h3>
      </div>
      {extra}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border rounded-xl text-sm"
        style={{ borderColor: `${BRAND_PRIMARY}33` }}
      />
    </Card>
  );
}

function ActivitiesSection({
  title, icon, items, setItems, ar, t,
}: {
  title: string; icon: React.ReactNode;
  items: ActivityBlock[]; setItems: (v: ActivityBlock[]) => void;
  ar: boolean; t: any;
}) {
  // Index of the activity that currently has the link-picker modal open,
  // or null when no picker is open. Lifted to the section so we can reuse
  // a single picker UI rather than render one per activity.
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader title={title} icon={icon} right={
        <button onClick={() => setItems([...items, { title: "", description: "", durationMinutes: 10 }])} className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 min-h-[36px]" style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}>
          <Plus className="w-3.5 h-3.5" /> {t.addAct}
        </button>
      } />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{ar ? "لا توجد أنشطة بعد." : "No activities yet."}</p>
      ) : (
        <div className="space-y-3">
          {items.map((a, i) => (
            <div key={i} className="p-3 border rounded-xl space-y-2" style={{ borderColor: `${BRAND_PRIMARY}22`, background: `${BRAND_PRIMARY}05` }}>
              <div className="flex items-start gap-2">
                <span className="text-sm font-extrabold mt-1.5" style={{ color: BRAND_GOLD }}>{i + 1}.</span>
                <input
                  value={a.title}
                  onChange={e => { const next = [...items]; next[i] = { ...a, title: e.target.value }; setItems(next); }}
                  placeholder={t.actTitle}
                  className="flex-1 px-3 py-2 border rounded-xl text-sm font-bold min-h-[40px] bg-white"
                  style={{ borderColor: `${BRAND_PRIMARY}33` }}
                />
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={a.durationMinutes ?? 0}
                    onChange={e => { const next = [...items]; next[i] = { ...a, durationMinutes: Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)) }; setItems(next); }}
                    className="w-16 px-2 py-1 border rounded text-xs bg-white"
                    style={{ borderColor: `${BRAND_PRIMARY}33` }}
                  />
                  <span className="text-xs text-muted-foreground">{t.minute}</span>
                </div>
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-[40px] min-w-[40px]">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={a.description}
                onChange={e => { const next = [...items]; next[i] = { ...a, description: e.target.value }; setItems(next); }}
                rows={3}
                placeholder={t.description}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                style={{ borderColor: `${BRAND_PRIMARY}33` }}
              />
              {/* Linked-Hasad-activity row. Either shows the current ref
                  with an unlink button, or a "Link" button that opens the
                  picker modal scoped to this activity index. */}
              {a.activityRef ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-xs flex-wrap"
                  style={{ borderColor: `${BRAND_GOLD}88`, background: `${BRAND_GOLD}10` }}
                >
                  <Link2 className="w-3.5 h-3.5" style={{ color: BRAND_GOLD }} />
                  <span className="font-extrabold" style={{ color: BRAND_GOLD }}>
                    {a.activityRef.kind === "assignment" ? (ar ? "واجب" : "Assignment")
                      : (ar ? "درس فيديو" : "Video lesson")}:
                  </span>
                  <span className="flex-1 truncate font-bold" style={{ color: BRAND_PRIMARY }}>
                    {a.activityRef.title}
                  </span>
                  <button
                    onClick={() => { const next = [...items]; next[i] = { ...a, activityRef: undefined }; setItems(next); }}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    {t.unlink}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPickerIndex(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-dashed flex items-center gap-1.5 min-h-[36px]"
                  style={{ borderColor: `${BRAND_GOLD}77`, color: BRAND_GOLD, background: `${BRAND_GOLD}08` }}
                >
                  <Link2 className="w-3.5 h-3.5" /> {t.linkActivity}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {pickerIndex !== null && (
        <ActivityRefPicker
          ar={ar}
          t={t}
          onClose={() => setPickerIndex(null)}
          onPick={(ref) => {
            const next = [...items];
            const idx = pickerIndex;
            if (idx !== null && next[idx]) {
              next[idx] = { ...next[idx], activityRef: ref };
              setItems(next);
            }
            setPickerIndex(null);
          }}
        />
      )}
    </Card>
  );
}

/** Modal that lets the teacher pick an existing Hasad activity to link
 *  to a lesson-plan step. Loads from three list endpoints lazily — only
 *  the active tab's data is fetched. The selected ref is returned via
 *  onPick as a compact { kind, id, title } shape that survives JSON
 *  round-trips through the lesson-plans API. */
function ActivityRefPicker({
  ar, t, onClose, onPick,
}: {
  ar: boolean;
  t: any;
  onClose: () => void;
  onPick: (ref: ActivityRef) => void;
}) {
  type Tab = "assignment" | "video-lesson";
  const [tab, setTab] = useState<Tab>("assignment");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Record<Tab, Array<{ id: number; title: string }> | null>>({
    "assignment": null, "video-lesson": null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (items[tab] !== null) return; // cached
    let cancelled = false;
    setLoading(true);
    const url =
      tab === "assignment" ? `${API_BASE}/api/assignments`
      : `${API_BASE}/api/video-lessons`;
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        // Each endpoint returns a slightly different shape; normalize to
        // { id, title }. assignments → array, video-lessons → { lessons: [] }.
        let list: Array<{ id: number; title: string }> = [];
        if (Array.isArray(data)) {
          list = data
            .filter((r: any) => r && typeof r.id === "number" && typeof r.title === "string")
            .map((r: any) => ({ id: r.id, title: r.title }));
        } else if (data && Array.isArray(data.lessons)) {
          list = data.lessons
            .filter((r: any) => r && typeof r.id === "number" && typeof r.title === "string")
            .map((r: any) => ({ id: r.id, title: r.title }));
        }
        setItems(prev => ({ ...prev, [tab]: list }));
      })
      .catch(() => {
        if (!cancelled) setItems(prev => ({ ...prev, [tab]: [] }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  const list = items[tab];
  const filtered = (list ?? []).filter(r =>
    !search.trim() || r.title.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: `${BRAND_PRIMARY}22` }}>
          <h3 className="font-extrabold text-base" style={{ color: BRAND_PRIMARY }}>{t.pickActivity}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/30 text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Source tabs */}
        <div className="flex gap-1 px-3 pt-3" role="tablist">
          {([
            ["assignment", t.tabAssignments],
            ["video-lesson", t.tabVideos],
          ] as Array<[Tab, string]>).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className="px-3 py-1.5 rounded-t-lg text-xs font-bold border-b-2"
              style={{
                borderColor: tab === k ? BRAND_PRIMARY : "transparent",
                color: tab === k ? BRAND_PRIMARY : "#6a7370",
                background: tab === k ? `${BRAND_PRIMARY}0c` : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="px-3 pt-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.pickerSearch}
            className="w-full px-3 py-2 border rounded-xl text-sm min-h-[40px]"
            style={{ borderColor: `${BRAND_PRIMARY}33` }}
          />
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-6">{t.pickerLoading}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6 italic">{t.pickerEmpty}</p>
          ) : (
            filtered.map(r => (
              <button
                key={`${tab}-${r.id}`}
                onClick={() => onPick({ kind: tab, id: r.id, title: r.title })}
                className="w-full text-start px-3 py-2 rounded-xl border text-sm hover:shadow-md transition min-h-[44px]"
                style={{ borderColor: `${BRAND_PRIMARY}22`, background: "white" }}
                dir={ar ? "rtl" : "ltr"}
              >
                <span className="font-bold" style={{ color: BRAND_PRIMARY }}>{r.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
