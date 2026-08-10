import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Eye, BookOpen, Target, Package, Library,
  Flame, Compass, Activity, ClipboardCheck, Flag, Home, Users,
  StickyNote, Clock, Upload, FileType, FileText,
  ArrowLeft, Printer, Link2, RotateCcw, ArrowRight, Settings as SettingsIcon,
  Calendar, CheckCircle2, Youtube, Type, TextSelect
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { LessonPlanPrintView, type PlanData } from "@/pages/teacher/lesson-plan-print";
import { downloadAsWord, printToPdf } from "@/lib/print-export";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
  fontFamily: "default",
  fontSizePt: 11.5,
  lessonDateGregorian: "",
  lessonDateHijri: "",
});

function cleanSections(s: Sections): Sections {
  const c = { ...s };
  if (!c.homework?.description?.trim()) delete c.homework;
  if (c.differentiation) {
    if (!c.differentiation.support?.trim()) delete c.differentiation.support;
    if (!c.differentiation.extension?.trim()) delete c.differentiation.extension;
    if (Object.keys(c.differentiation).length === 0) delete c.differentiation;
  }
  if (!c.notes?.trim()) delete c.notes;
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function InputCard({ label, icon: Icon, children, className = "" }: { label: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-3 sm:p-4 flex flex-col justify-center border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group ${className}`}>
      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 sm:mb-1.5">
        <Icon className="w-3.5 h-3.5 text-emerald-500" /> {label}
      </label>
      {children}
    </div>
  );
}

function SectionCard({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#15201B] rounded-3xl p-5 shadow-sm border border-emerald-50 dark:border-emerald-900/30 flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-300">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="font-black text-base">{title}</h3>
      </div>
      <div className="space-y-3 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
        checked ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white dark:bg-[#15201B] border-slate-300 dark:border-slate-700 text-transparent"
      }`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 select-none group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{label}</span>
    </label>
  );
}

function ActivityPickerModal({ open, onClose, onPick, t }: { open: boolean; onClose: () => void; onPick: (ref: ActivityRef) => void; t: any }) {
  const [tab, setTab] = useState<"assignments" | "videos">("assignments");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const endpoint = tab === "assignments" ? "/api/assignments" : "/api/video-lessons";
    fetch(`${API_BASE}${endpoint}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, tab]);

  const filtered = items.filter(x => (x.title || "").toLowerCase().includes(search.toLowerCase()));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#15201B] w-full max-w-lg rounded-3xl shadow-xl flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0B100E]/50">
          <h3 className="font-black text-slate-800 dark:text-slate-100">{t.pickActivity}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-4 h-4"/></button>
        </div>
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setTab("assignments")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === "assignments" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>{t.tabAssignments}</button>
          <button onClick={() => setTab("videos")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === "videos" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>{t.tabVideos}</button>
        </div>
        <div className="p-4 flex-1 flex flex-col min-h-0">
           <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 mb-4 border border-slate-100 dark:border-slate-800 focus-within:border-emerald-400 transition-colors shrink-0">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.pickerSearch} className="w-full bg-transparent text-sm font-bold outline-none px-2" />
           </div>
           <div className="overflow-y-auto space-y-2 flex-1">
              {loading ? (
                <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center p-6 text-sm font-bold text-slate-400">{t.pickerEmpty}</div>
              ) : (
                filtered.map(it => (
                  <button key={it.id} onClick={() => onPick({ kind: tab === "assignments" ? "assignment" : "video-lesson", id: it.id, title: it.title })} className="w-full text-start p-3 rounded-xl hover:bg-emerald-50 dark:bg-[#0B100E] dark:hover:bg-emerald-900/20 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all flex items-center gap-3 group">
                     <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#15201B] flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors border border-slate-50 dark:border-slate-700">
                        {tab === "assignments" ? <ClipboardCheck className="w-4 h-4"/> : <Youtube className="w-4 h-4"/>}
                     </div>
                     <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1 truncate">{it.title}</span>
                  </button>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function LessonPlanCreate() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const _lpPrefs = useMemo(() => loadLpPrefs(), []);
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

  const [aiTopic, setAiTopic] = useState("");
  const [aiPedagogy, setAiPedagogy] = useState<"direct" | "inquiry" | "project" | "flipped" | "mixed">(_lpPrefs.aiPedagogy ?? "mixed");
  const [aiNotes, setAiNotes] = useState(_lpPrefs.aiNotes ?? "");
  const [generating, setGenerating] = useState(false);

  const lpDidMountRef = useRef(false);
  const lpSkipNextSaveRef = useRef(false);
  useEffect(() => {
    if (!lpDidMountRef.current) { lpDidMountRef.current = true; return; }
    if (lpSkipNextSaveRef.current) { lpSkipNextSaveRef.current = false; return; }
    saveLpPrefs({ contentLang, aiPedagogy, aiNotes });
  }, [contentLang, aiPedagogy, aiNotes]);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileLimits = useMemo(() => ({
    maxFiles: isAdmin ? 25 : 5,
    maxBytes: isAdmin ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
    maxMb: isAdmin ? 200 : 50,
  }), [isAdmin]);

  /* إضافة ملفات مع تحقق الحجم ودمجها مع المختار سابقاً (بدون تكرار) */
  const addPickedFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > fileLimits.maxBytes) {
        toast.error(ar ? `الملف "${f.name}" يتجاوز ${fileLimits.maxMb} ميجا` : `"${f.name}" exceeds ${fileLimits.maxMb} MB`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;
    setPickedFiles(prev => {
      const seen = new Set(prev.map(p => `${p.name}:${p.size}`));
      const merged = [...prev];
      for (const f of valid) {
        const key = `${f.name}:${f.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(f);
      }
      if (merged.length > fileLimits.maxFiles) {
        toast.error(ar ? `الحد الأقصى ${fileLimits.maxFiles} ملفات` : `Max ${fileLimits.maxFiles} files`);
      }
      return merged.slice(0, fileLimits.maxFiles);
    });
  }, [fileLimits, ar]);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setIsAdmin(!!p.isAdmin); })
      .catch(() => { /* non-fatal */ });
  }, []);

  const [showSaved, setShowSaved] = useState(false);
  const [savedRows, setSavedRows] = useState<PlanRow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPicker, setShowPicker] = useState<{ sectionIdx: number } | null>(null);

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
      .catch(() => {});
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
    linkActivity: ar ? "ربط بنشاط حصاد" : "Link Hasaad activity",
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

  function updateActivity(idx: number, patch: Partial<ActivityBlock>) {
    const n = [...sections.activities];
    n[idx] = { ...n[idx], ...patch };
    setSections({ ...sections, activities: n });
  }

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-[100dvh] pb-32 bg-[#f4f7f5] dark:bg-[#0B100E] font-display transition-colors"
        onInput={() => { editLoadDirtyRef.current = true; }}
        onChange={() => { editLoadDirtyRef.current = true; }}
      >
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            onClick={() => setLocation("/teacher")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            aria-label={ar ? "رجوع" : "Back"}
          >
            {ar ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                {t.headline}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                {t.sub}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSaved(true)}
            className="px-4 py-2 bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
            data-testid="btn-my-saved"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t.mySaved}</span>
          </button>
        </header>

        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          {/* Metadata Card */}
          <section className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30">
            <div className="space-y-4">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.title}
                className="w-full bg-transparent border-b-2 border-transparent hover:border-emerald-100 focus:border-emerald-400 dark:hover:border-emerald-900/50 dark:focus:border-emerald-500 outline-none text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-colors pb-1.5"
                data-testid="input-title"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <InputCard label={t.subject} icon={BookOpen}>
                  <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" data-testid="input-subject" />
                </InputCard>
                <InputCard label={t.grade} icon={Users}>
                  <input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" data-testid="input-grade" />
                </InputCard>
                <InputCard label={t.duration} icon={Clock}>
                  <div className="flex items-center gap-1">
                    <input type="number" min={15} max={180} value={durationMinutes} onChange={e => setDurationMinutes(Math.max(15, Math.min(180, parseInt(e.target.value, 10) || 45)))} className="w-16 bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" data-testid="input-duration" />
                    <span className="text-xs font-bold text-slate-500">{t.minute}</span>
                  </div>
                </InputCard>
                <InputCard label={t.contentLang} icon={Flag}>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button onClick={() => setContentLang("ar")} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${contentLang === "ar" ? "bg-white dark:bg-[#15201B] text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500"}`}>AR</button>
                    <button onClick={() => setContentLang("en")} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${contentLang === "en" ? "bg-white dark:bg-[#15201B] text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500"}`}>EN</button>
                  </div>
                </InputCard>
              </div>
            </div>
          </section>

          {/* AI Generation Card */}
          <section className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/10 dark:to-teal-950/10 rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">{t.aiPanel}</h2>
              </div>
              <button onClick={handleLpRestoreDefaults} className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1" title={ar ? "استعادة الافتراضي" : "Restore defaults"}>
                <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{ar ? "إعادة ضبط" : "Reset"}</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#15201B] rounded-2xl p-2.5 border border-slate-200 dark:border-slate-800 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all">
                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={t.aiTopicPh} className="w-full bg-transparent px-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" data-testid="input-ai-topic" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputCard label={t.aiPedagogy} icon={Flame} className="bg-white dark:bg-[#15201B]">
                  <select value={aiPedagogy} onChange={e => setAiPedagogy(e.target.value as any)} className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none appearance-none cursor-pointer">
                    <option value="mixed">{t.pedMixed}</option>
                    <option value="direct">{t.pedDirect}</option>
                    <option value="inquiry">{t.pedInquiry}</option>
                    <option value="project">{t.pedProject}</option>
                    <option value="flipped">{t.pedFlipped}</option>
                  </select>
                </InputCard>
                <InputCard label={t.aiNotes} icon={StickyNote} className="bg-white dark:bg-[#15201B]">
                  <input value={aiNotes} onChange={e => setAiNotes(e.target.value)} placeholder={t.aiNotesPh} className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" />
                </InputCard>
              </div>

              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) addPickedFiles(Array.from(e.dataTransfer.files));
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${
                  isDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 scale-[1.02]" : "border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white/50 dark:bg-[#15201B]/50"
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={e => {
                    if (e.target.files?.length) addPickedFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
                <Upload className="w-6 h-6 text-emerald-500 mb-2" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {ar ? "اسحب الملفات هنا أو اضغط للاختيار" : "Drag files here or click to pick"}
                </span>
                <span className="text-xs font-bold text-slate-400 mt-1">
                  {ar ? `حد أقصى ${fileLimits.maxFiles} ملفات` : `Max ${fileLimits.maxFiles} files`}
                </span>
              </div>
              
              {pickedFiles.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {pickedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800 shadow-sm">
                        <FileType className="w-4 h-4 text-emerald-500" />
                        <span className="max-w-[140px] truncate text-xs font-bold text-slate-700 dark:text-slate-300">{f.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setPickedFiles(pf => pf.filter((_, idx) => idx !== i)); }} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2">
                <button onClick={handleGenerate} disabled={generating || extracting} className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 btn-bounce" data-testid="btn-generate">
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {t.generate}
                </button>
                
                {pickedFiles.length > 0 && (
                  <button onClick={extractFromFiles} disabled={generating || extracting} className="flex-1 py-3.5 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 btn-bounce">
                    {extracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {ar ? "استخراج من الملفات" : "Extract from files"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Sections Editor grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <SectionCard title={t.objectives} icon={<Target className="w-4 h-4 text-emerald-600" />}>
                {sections.objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-2 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-black text-emerald-600 shrink-0">{i + 1}</div>
                    <input value={obj} onChange={e => { const n = [...sections.objectives]; n[i] = e.target.value; setSections({...sections, objectives: n}); }} className="flex-1 bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" />
                    <button onClick={() => { const n=[...sections.objectives]; n.splice(i,1); setSections({...sections, objectives: n}); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setSections({...sections, objectives: [...sections.objectives, ""]})} className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-3 py-1.5 rounded-lg transition-colors w-max"><Plus className="w-3.5 h-3.5" />{t.addObj}</button>
              </SectionCard>
            </div>

            <SectionCard title={t.materials} icon={<Package className="w-4 h-4 text-emerald-600" />}>
               {sections.materials.map((mat, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-2 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-1 mr-1" />
                    <input value={mat} onChange={e => { const n = [...sections.materials]; n[i] = e.target.value; setSections({...sections, materials: n}); }} className="flex-1 bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none" />
                    <button onClick={() => { const n=[...sections.materials]; n.splice(i,1); setSections({...sections, materials: n}); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setSections({...sections, materials: [...sections.materials, ""]})} className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-3 py-1.5 rounded-lg transition-colors w-max"><Plus className="w-3.5 h-3.5" />{t.addMat}</button>
            </SectionCard>

            <SectionCard title={t.vocabulary} icon={<Library className="w-4 h-4 text-emerald-600" />}>
               {sections.vocabulary.map((v, i) => (
                  <div key={i} className="flex flex-col gap-1.5 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all relative group">
                    <button onClick={() => { const n = [...sections.vocabulary]; n.splice(i,1); setSections({...sections, vocabulary: n}); }} className="absolute top-2 end-2 p-1.5 text-slate-400 hover:text-red-500 bg-white dark:bg-[#15201B] rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5"/></button>
                    <input value={v.term} onChange={e => { const n=[...sections.vocabulary]; n[i].term=e.target.value; setSections({...sections, vocabulary: n}); }} placeholder={t.term} className="w-[85%] bg-transparent text-sm font-black text-slate-800 dark:text-slate-100 outline-none border-b border-transparent focus:border-emerald-200 pb-1" />
                    <input value={v.definition || ""} onChange={e => { const n=[...sections.vocabulary]; n[i].definition=e.target.value; setSections({...sections, vocabulary: n}); }} placeholder={t.def} className="w-full bg-transparent text-xs font-bold text-slate-600 dark:text-slate-400 outline-none mt-1" />
                  </div>
                ))}
                <button onClick={() => setSections({...sections, vocabulary: [...sections.vocabulary, {term:"", definition:""}]})} className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-3 py-1.5 rounded-lg transition-colors w-max"><Plus className="w-3.5 h-3.5" />{t.addVocab}</button>
            </SectionCard>

            <SectionCard title={t.warmUp} icon={<Flame className="w-4 h-4 text-emerald-600" />}>
              <div className="flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-2.5 border border-emerald-50 dark:border-emerald-900/30">
                <Clock className="w-4 h-4 text-emerald-500" />
                <input type="number" value={sections.warmUp.durationMinutes || ""} onChange={e => setSections({...sections, warmUp: {...sections.warmUp, durationMinutes: parseInt(e.target.value)||0}})} className="w-12 bg-transparent text-sm font-bold outline-none text-center" placeholder="5" />
                <span className="text-xs text-slate-500 font-bold">{t.minute}</span>
              </div>
              <textarea value={sections.warmUp.description} onChange={e => setSections({...sections, warmUp: {...sections.warmUp, description: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[100px]" placeholder={t.description} />
            </SectionCard>

            <SectionCard title={t.introduction} icon={<Compass className="w-4 h-4 text-emerald-600" />}>
              <div className="flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-2.5 border border-emerald-50 dark:border-emerald-900/30">
                <Clock className="w-4 h-4 text-emerald-500" />
                <input type="number" value={sections.introduction.durationMinutes || ""} onChange={e => setSections({...sections, introduction: {...sections.introduction, durationMinutes: parseInt(e.target.value)||0}})} className="w-12 bg-transparent text-sm font-bold outline-none text-center" placeholder="10" />
                <span className="text-xs text-slate-500 font-bold">{t.minute}</span>
              </div>
              <textarea value={sections.introduction.description} onChange={e => setSections({...sections, introduction: {...sections.introduction, description: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[100px]" placeholder={t.description} />
            </SectionCard>

            <div className="md:col-span-2">
              <SectionCard title={t.activities} icon={<Activity className="w-4 h-4 text-emerald-600" />}>
                {sections.activities.map((act, i) => (
                  <div key={i} className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 border border-emerald-50 dark:border-emerald-900/30 space-y-3 relative group transition-all">
                    <div className="absolute top-3 end-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { const n=[...sections.activities]; n.splice(i,1); setSections({...sections, activities: n}); }} className="p-1.5 text-red-500 bg-white dark:bg-[#15201B] rounded-lg shadow-sm hover:scale-105"><Trash2 className="w-4 h-4"/></button>
                    </div>
                    <div className="flex items-center gap-3 pr-8 rtl:pr-0 rtl:pl-8">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-sm font-black text-emerald-600 shrink-0">{i + 1}</div>
                      <input value={act.title} onChange={e => updateActivity(i, { title: e.target.value })} className="flex-1 bg-transparent text-base font-black text-slate-800 dark:text-slate-100 outline-none border-b-2 border-transparent focus:border-emerald-400 pb-1" placeholder={t.actTitle} />
                      <div className="flex items-center gap-1 text-slate-500">
                         <Clock className="w-4 h-4" />
                         <input type="number" value={act.durationMinutes || ""} onChange={e => updateActivity(i, { durationMinutes: parseInt(e.target.value)||0 })} className="w-12 bg-transparent text-sm font-bold outline-none text-center" placeholder="10" />
                         <span className="text-xs">{t.minute}</span>
                      </div>
                    </div>
                    
                    <textarea value={act.description} onChange={e => updateActivity(i, { description: e.target.value })} className="w-full bg-white dark:bg-[#15201B] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-transparent focus:border-emerald-400 transition-all min-h-[80px]" placeholder={t.description} />
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                       {act.activityRef ? (
                         <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl flex-1 border border-emerald-100 dark:border-emerald-800/50">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                               {act.activityRef.kind === "video-lesson" ? <Youtube className="w-4 h-4"/> : <ClipboardCheck className="w-4 h-4"/>}
                               <span className="text-xs font-bold truncate max-w-[200px]">{act.activityRef.title}</span>
                            </div>
                            <button onClick={() => updateActivity(i, { activityRef: undefined })} className="text-xs font-bold text-red-500 hover:underline">{t.unlink}</button>
                         </div>
                       ) : (
                         <button onClick={() => setShowPicker({ sectionIdx: i })} className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <Link2 className="w-3.5 h-3.5" />
                            {t.linkActivity}
                         </button>
                       )}
                    </div>
                  </div>
                ))}
                <button onClick={() => setSections({...sections, activities: [...sections.activities, {title: "", description: ""}]})} className="mt-2 w-full py-3 border-2 border-dashed border-emerald-100 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                  <Plus className="w-4 h-4" /> {t.addAct}
                </button>
              </SectionCard>
            </div>

            <SectionCard title={t.assessment} icon={<ClipboardCheck className="w-4 h-4 text-emerald-600" />}>
              <div className="flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-2.5 border border-emerald-50 dark:border-emerald-900/30">
                <Target className="w-4 h-4 text-emerald-500" />
                <input value={sections.assessment.method || ""} onChange={e => setSections({...sections, assessment: {...sections.assessment, method: e.target.value}})} placeholder={t.method} className="flex-1 bg-transparent text-sm font-bold outline-none" />
              </div>
              <textarea value={sections.assessment.description} onChange={e => setSections({...sections, assessment: {...sections.assessment, description: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[100px]" placeholder={t.description} />
            </SectionCard>

            <SectionCard title={t.closure} icon={<Flag className="w-4 h-4 text-emerald-600" />}>
              <textarea value={sections.closure.description} onChange={e => setSections({...sections, closure: {...sections.closure, description: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[120px]" placeholder={t.description} />
            </SectionCard>

            <SectionCard title={t.homework} icon={<Home className="w-4 h-4 text-emerald-600" />}>
              <textarea value={sections.homework?.description || ""} onChange={e => setSections({...sections, homework: { description: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[120px]" placeholder={t.description} />
            </SectionCard>

            <SectionCard title={t.differentiation} icon={<Users className="w-4 h-4 text-emerald-600" />}>
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Compass className="w-3.5 h-3.5"/> {t.support}</label>
                  <textarea value={sections.differentiation?.support || ""} onChange={e => setSections({...sections, differentiation: {...(sections.differentiation||{}), support: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[80px]" placeholder={t.support} />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Flame className="w-3.5 h-3.5"/> {t.extension}</label>
                  <textarea value={sections.differentiation?.extension || ""} onChange={e => setSections({...sections, differentiation: {...(sections.differentiation||{}), extension: e.target.value}})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-3 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-amber-400 transition-all min-h-[80px]" placeholder={t.extension} />
                </div>
              </div>
            </SectionCard>

            <div className="md:col-span-2">
              <SectionCard title={t.notes} icon={<StickyNote className="w-4 h-4 text-emerald-600" />}>
                <textarea value={sections.notes || ""} onChange={e => setSections({...sections, notes: e.target.value})} className="w-full flex-1 bg-[#f4f7f5] dark:bg-[#0B100E] rounded-xl p-4 text-sm font-bold outline-none resize-none border border-emerald-50 dark:border-emerald-900/30 focus:border-emerald-400 transition-all min-h-[120px]" placeholder={t.notes} />
              </SectionCard>
            </div>
          </section>

        </main>
        
        {/* Bottom Sticky Action Bar */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-[#111A16]/80 backdrop-blur-xl border-t border-emerald-100 dark:border-emerald-900/30 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors shadow-sm" data-testid="btn-print-settings">
              <SettingsIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">{t.settingsHead}</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewing(true)} className="px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-black text-sm transition-colors shadow-sm flex items-center gap-2" data-testid="btn-preview">
                 <Eye className="w-5 h-5"/>
                 <span className="hidden sm:inline">{t.preview}</span>
              </button>
              <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 btn-bounce" data-testid="btn-save">
                 {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                 {t.save}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Print Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-[#15201B] w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0B100E]/50">
                 <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-emerald-500" />
                    {t.settingsHead}
                 </h2>
                 <button onClick={() => setShowSettingsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm transition-all hover:scale-105">
                   <X className="w-4 h-4" />
                 </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                 <div>
                    <h3 className="text-sm font-bold text-slate-500 mb-3">الأقسام المشمولة في الطباعة</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                       <Checkbox label={t.objectives} checked={settings.includeObjectives} onChange={v => setSettings({...settings, includeObjectives: v})} />
                       <Checkbox label={t.materials} checked={settings.includeMaterials} onChange={v => setSettings({...settings, includeMaterials: v})} />
                       <Checkbox label={t.vocabulary} checked={settings.includeVocabulary} onChange={v => setSettings({...settings, includeVocabulary: v})} />
                       <Checkbox label={t.warmUp} checked={settings.includeWarmUp} onChange={v => setSettings({...settings, includeWarmUp: v})} />
                       <Checkbox label={t.introduction} checked={settings.includeIntroduction} onChange={v => setSettings({...settings, includeIntroduction: v})} />
                       <Checkbox label={t.activities} checked={settings.includeActivities} onChange={v => setSettings({...settings, includeActivities: v})} />
                       <Checkbox label={t.assessment} checked={settings.includeAssessment} onChange={v => setSettings({...settings, includeAssessment: v})} />
                       <Checkbox label={t.closure} checked={settings.includeClosure} onChange={v => setSettings({...settings, includeClosure: v})} />
                       <Checkbox label={t.homework} checked={settings.includeHomework} onChange={v => setSettings({...settings, includeHomework: v})} />
                       <Checkbox label={t.differentiation} checked={settings.includeDifferentiation} onChange={v => setSettings({...settings, includeDifferentiation: v})} />
                       <Checkbox label={t.notes} checked={settings.includeNotes} onChange={v => setSettings({...settings, includeNotes: v})} />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputCard label={t.dateGreg} icon={Calendar}>
                       <input value={settings.lessonDateGregorian || ""} onChange={e => setSettings({...settings, lessonDateGregorian: e.target.value})} placeholder={t.dateGregPh} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </InputCard>
                    <InputCard label={t.dateHijri} icon={Calendar}>
                       <input value={settings.lessonDateHijri || ""} onChange={e => setSettings({...settings, lessonDateHijri: e.target.value})} placeholder={t.dateHijriPh} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </InputCard>
                    <InputCard label={t.headerNote} icon={FileText} className="sm:col-span-2">
                       <input value={settings.headerNote || ""} onChange={e => setSettings({...settings, headerNote: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </InputCard>
                    <InputCard label={t.footerNote} icon={FileText} className="sm:col-span-2">
                       <input value={settings.footerNote || ""} onChange={e => setSettings({...settings, footerNote: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </InputCard>
                    <InputCard label={t.fontFamily} icon={Type}>
                       <select value={settings.fontFamily || "default"} onChange={e => setSettings({...settings, fontFamily: e.target.value as LpFontFamily})} className="w-full bg-transparent text-sm font-bold outline-none appearance-none cursor-pointer">
                          <option value="default">{ar ? "الافتراضي للغة" : "Language default"}</option>
                          <option value="cairo">Cairo</option>
                          <option value="tajawal">Tajawal</option>
                          <option value="amiri">Amiri</option>
                          <option value="naskh">Noto Naskh</option>
                          <option value="reem">Reem Kufi</option>
                          <option value="inter">Inter</option>
                          <option value="serif">Serif</option>
                          <option value="mono">Monospace</option>
                       </select>
                    </InputCard>
                    <InputCard label={t.fontSize} icon={TextSelect}>
                       <input type="number" step="0.5" value={settings.fontSizePt || 11.5} onChange={e => setSettings({...settings, fontSizePt: parseFloat(e.target.value) || 11.5})} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </InputCard>
                 </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B100E]/50">
                 <button onClick={() => setShowSettingsModal(false)} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-md hover:bg-emerald-700 transition-colors btn-bounce">
                    تم
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity Picker Modal */}
      <ActivityPickerModal
        open={!!showPicker}
        onClose={() => setShowPicker(null)}
        onPick={(ref) => {
          if (showPicker) {
            updateActivity(showPicker.sectionIdx, { activityRef: ref });
            setShowPicker(null);
          }
        }}
        t={t}
      />

      {/* Saved Plans Modal */}
      <AnimatePresence>
        {showSaved && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSaved(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-[#15201B] w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0B100E]/50">
                 <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-emerald-500" />
                    {t.mySaved}
                 </h2>
                 <button onClick={() => setShowSaved(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm transition-all hover:scale-105">
                   <X className="w-4 h-4" />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-[#0B100E]/30 custom-scrollbar">
                {loadingSaved ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                     <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                     <span className="text-sm font-bold text-slate-500">{ar ? "جاري التحميل..." : "Loading..."}</span>
                  </div>
                ) : savedRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-60">
                     <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FolderOpen className="w-8 h-8 text-slate-400" /></div>
                     <span className="text-sm font-bold text-slate-500">{t.noSaved}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedRows.map(row => (
                      <div key={row.id} className="bg-white dark:bg-[#15201B] rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all flex flex-col group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                           <h3 className="font-black text-slate-800 dark:text-slate-100 line-clamp-1 flex-1">{row.title}</h3>
                           {!(row.isShared && row.ownerIsAdmin) && (
                             <button onClick={() => { if(confirm(t.confirmDel)) handleDelete(row.id); }} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-50 dark:bg-slate-800 rounded-lg" data-testid={`btn-delete-plan-${row.id}`}><Trash2 className="w-3.5 h-3.5"/></button>
                           )}
                        </div>
                        <div className="flex items-center gap-2 mb-4 text-[11px] font-bold text-slate-500">
                           {row.subject && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[100px]">{row.subject}</span>}
                           {row.gradeLevel && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[80px]">{row.gradeLevel}</span>}
                        </div>
                        {row.ownerIsAdmin && <div className="mb-3 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-block w-max"><Sparkles className="inline w-3 h-3 me-1"/> {t.sharedByAdmin}</div>}
                        
                        <div className="mt-auto flex items-center gap-2">
                          <button onClick={() => loadIntoEditor(row)} className="flex-1 py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black transition-colors flex items-center justify-center gap-1.5 border border-transparent hover:border-emerald-100 dark:hover:border-emerald-800" data-testid={`btn-open-plan-${row.id}`}>
                             {t.open} {ar ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setLocation(`/teacher/lesson-plans/${row.id}/print`)} className="py-2.5 px-3 rounded-xl text-white text-xs font-black transition-transform hover:scale-105 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600" data-testid={`btn-print-plan-${row.id}`}>
                             <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Overlay */}
      <AnimatePresence>
        {previewing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col p-4 sm:p-6" onClick={() => setPreviewing(false)}>
            <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-4 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                 <button onClick={() => setPreviewing(false)} className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors">
                    {ar ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
                 </button>
                 <h2 className="text-white font-black">{t.preview}</h2>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={() => { const root = document.getElementById("lesson-plan-preview-container"); if (root) downloadAsWord({ element: root, title: draftPlanData.title, lang: draftPlanData.language }); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl shadow-sm transition-colors flex items-center gap-2 btn-bounce">
                    <FileText className="w-4 h-4" /> <span className="hidden sm:inline">{t.word}</span>
                 </button>
                 <button onClick={() => { printToPdf(); }} className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-sm font-black rounded-xl shadow-sm transition-colors flex items-center gap-2 btn-bounce">
                    <Printer className="w-4 h-4" /> <span className="hidden sm:inline">{t.pdf}</span>
                 </button>
              </div>
            </div>
            
            <div className="flex-1 w-full max-w-4xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <div id="lesson-plan-preview-container" className="h-full overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-white text-black">
                <LessonPlanPrintView data={draftPlanData} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
