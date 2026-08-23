import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Play, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Gift, HelpCircle, Edit3, Check,
  Globe, BookOpen, GraduationCap, Users, FileDown, Database,
  PenLine, Settings2, Volume2, RotateCw, ListChecks, ArrowLeft, ArrowRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

/** Professional SVG wheel icon — mirrors the actual game wheel colours */
const WheelIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    {/* 8 coloured segments */}
    <path d="M50,50 L50,4 A46,46 0 0,1 82.5,17.5 Z" fill="#225739"/>
    <path d="M50,50 L82.5,17.5 A46,46 0 0,1 96,50 Z" fill="#D9A521"/>
    <path d="M50,50 L96,50 A46,46 0 0,1 82.5,82.5 Z" fill="#3a7a55"/>
    <path d="M50,50 L82.5,82.5 A46,46 0 0,1 50,96 Z" fill="#c47e2c"/>
    <path d="M50,50 L50,96 A46,46 0 0,1 17.5,82.5 Z" fill="#1f4d3a"/>
    <path d="M50,50 L17.5,82.5 A46,46 0 0,1 4,50 Z" fill="#e6b54f"/>
    <path d="M50,50 L4,50 A46,46 0 0,1 17.5,17.5 Z" fill="#2d6a4f"/>
    <path d="M50,50 L17.5,17.5 A46,46 0 0,1 50,4 Z" fill="#b08440"/>
    {/* Spoke dividers */}
    <line x1="50" y1="4" x2="50" y2="96" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="4" y1="50" x2="96" y2="50" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="17.5" y1="17.5" x2="82.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="82.5" y1="17.5" x2="17.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    {/* Outer ring */}
    <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.35"/>
    {/* Centre hub */}
    <circle cx="50" cy="50" r="13" fill="white"/>
    <circle cx="50" cy="50" r="8"  fill="#225739"/>
    <circle cx="50" cy="50" r="3"  fill="white"/>
    {/* Gold pointer triangle at top */}
    <polygon points="50,0 43,12 57,12" fill="#D9A521"/>
    <polygon points="50,1 44,10 56,10" fill="#FFD166"/>
  </svg>
);

const WHEEL_PALETTE = [
  "#225739", "#D9A521", "#3a7a55", "#c47e2c",
  "#1f4d3a", "#e6b54f", "#2d6a4f", "#b08440",
];

const POINT_OPTIONS = [50, 100, 200, 300, 500] as const;
const BONUS_TYPES = ["double", "skip", "swap", "lucky", "lose"] as const;

type BonusType = (typeof BONUS_TYPES)[number];

interface Segment {
  id: string;
  text: string;
  answer?: string;
  explanation?: string;
  points: number;
  color?: string;
  kind: "question" | "bonus";
  bonusType?: BonusType;
  imageUrl?: string | null;
}

interface WheelConfig {
  teamCount: number;
  teamNames: string[];
  spinSeconds: number;
  soundOn: boolean;
}

interface Template {
  id: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  segments: Segment[];
  config: WheelConfig;
  isOwn?: boolean;
  fromAdmin?: boolean;
  ownerName?: string | null;
}

type QuestionSource = "assignment" | "ai" | "manual" | "bank";
type SetupStep = "source" | "settings";

interface BankQuestion {
  id: number;
  subject?: string | null;
  questionType?: string | null;
  text: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null;
  imageUrl?: string | null;
  allowMultipleAnswers?: boolean | null;
}

const newId = () => `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const defaultTeamName = (i: number, lang: "ar" | "en") => {
  const ar = ["الأذكياء", "المتميزون", "الفائقون", "المبدعون", "الرائعون", "الرياديون"];
  const en = ["Champions", "Stars", "Warriors", "Innovators", "Legends", "Pioneers"];
  return (lang === "ar" ? ar : en)[i] ?? `${lang === "ar" ? "فريق" : "Team"} ${i + 1}`;
};

const bonusLabel = (b: BonusType, lang: "ar" | "en") => {
  if (lang === "ar") {
    return { double: "نقاط مضاعفة", skip: "تخطّى الدور", swap: "تبادل النقاط", lucky: "حظ سعيد", lose: "خسارة نصف النقاط" }[b];
  }
  return { double: "Double Points", skip: "Skip Turn", swap: "Swap Scores", lucky: "Lucky Bonus", lose: "Lose Half" }[b];
};

const colorize = (segs: Segment[]): Segment[] =>
  segs.map((s, i) => ({ ...s, color: s.color ?? WHEEL_PALETTE[i % WHEEL_PALETTE.length] }));

export default function WheelCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [title, setTitle] = useState("");
  const [contentLang, setContentLang] = useState<"ar" | "en">(lang);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [config, setConfig] = useState<WheelConfig>({
    teamCount: 2,
    teamNames: [defaultTeamName(0, lang), defaultTeamName(1, lang)],
    spinSeconds: 5,
    soundOn: true,
  });

  // AI panel
  const [aiOpen, setAiOpen] = useState(true);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [aiBonus, setAiBonus] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Templates
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("source");
  const [activeSource, setActiveSource] = useState<QuestionSource | null>(null);
  const [segmentsEditorOpen, setSegmentsEditorOpen] = useState(false);

  // Import from assignment
  const [importOpen, setImportOpen] = useState(false);
  const [importAssignments, setImportAssignments] = useState<{ id: number; title: string; subject: string | null; gradeLevel: string | null; questionCount: number }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Import from question bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelectedIds, setBankSelectedIds] = useState<Set<number>>(new Set());

  // Load grade levels
  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Keep team names array length in sync with team count
  useEffect(() => {
    setConfig(c => {
      const names = [...c.teamNames];
      while (names.length < c.teamCount) names.push(defaultTeamName(names.length, contentLang));
      while (names.length > c.teamCount) names.pop();
      return { ...c, teamNames: names };
    });
  }, [config.teamCount, contentLang]);

  const generateAI = async () => {
    if (!aiTopic.trim()) {
      toast.error(ar ? "أدخل الموضوع أولاً" : "Enter a topic first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/wheel-templates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subject: subject.trim() || null,
          gradeLevel: gradeLevel.trim() || null,
          segmentCount: aiCount,
          language: contentLang,
          includeBonus: aiBonus,
          difficulty: aiDifficulty,
        }),
      });
      if (res.status === 401) {
        toast.error(ar ? "يجب تسجيل الدخول" : "Please log in");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || (ar ? "تعذّر التوليد" : "Generation failed"));
        return;
      }
      const generated = (data.segments || []).map((s: Segment) => ({ ...s, id: s.id || newId() }));
      setSegments(colorize(generated));
      setSegmentsEditorOpen(true);
      if (!title.trim()) setTitle(aiTopic.trim().slice(0, 80));
      toast.success(ar ? `تم توليد ${generated.length} قطاع` : `Generated ${generated.length} segments`);
    } catch (err) {
      console.error(err);
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setGenerating(false);
    }
  };

  const addManualSegment = (kind: "question" | "bonus" = "question") => {
    setActiveSource("manual");
    setSegmentsEditorOpen(true);
    setSegments(prev => {
      const next: Segment = kind === "question"
        ? { id: newId(), text: "", answer: "", points: 100, kind: "question" }
        : { id: newId(), text: ar ? "نقاط مضاعفة" : "Double Points", points: 0, kind: "bonus", bonusType: "double" };
      return colorize([...prev, next]);
    });
  };

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSegment = (id: string) => {
    setSegments(prev => colorize(prev.filter(s => s.id !== id)));
  };

  const validate = (): string | null => {
    if (!title.trim()) return ar ? "أدخل عنوان اللعبة" : "Enter a title";
    if (segments.length < 2) return ar ? "أضف قطاعَين على الأقل" : "Add at least 2 segments";
    if (segments.length > 16) return ar ? "الحد الأقصى ١٦ قطاع" : "Max 16 segments";
    for (const s of segments) {
      if (!s.text.trim()) return ar ? "املأ نص كل القطاعات" : "Fill all segment texts";
      if (s.kind === "question" && !(s.answer ?? "").trim()) return ar ? "أدخل إجابات الأسئلة" : "Enter answers for questions";
    }
    return null;
  };

  const buildPayload = () => ({
    title: title.trim(),
    language: contentLang,
    gradeLevel: gradeLevel.trim() || null,
    subject: subject.trim() || null,
    segments: colorize(segments),
    config,
  });

  const saveTemplate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const isUpdate = editingTemplateId !== null;
      const url = isUpdate
        ? `${API_BASE}/api/wheel-templates/${editingTemplateId}`
        : `${API_BASE}/api/wheel-templates`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || (ar ? "فشل الحفظ" : "Save failed"));
        return;
      }
      const saved = await res.json();
      setEditingTemplateId(saved.id);
      toast.success(ar ? "تم الحفظ في المكتبة" : "Saved to library");
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setSaving(false);
    }
  };

  const launchPlay = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setLaunching(true);
    try {
      // Always persist before launching so the play page can fetch a stable id.
      const isUpdate = editingTemplateId !== null;
      const url = isUpdate
        ? `${API_BASE}/api/wheel-templates/${editingTemplateId}`
        : `${API_BASE}/api/wheel-templates`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || (ar ? "فشل الإطلاق" : "Launch failed"));
        return;
      }
      const saved = await res.json();
      setLocation(`/game/wheel/play/${saved.id}`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setLaunching(false);
    }
  };

  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wheel-templates`, { credentials: "include" });
      if (!res.ok) {
        toast.error(ar ? "تعذّر تحميل القوالب" : "Failed to load templates");
        return;
      }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    if (savedOpen) loadTemplates();
  }, [savedOpen]);

  const applyTemplate = (t: Template) => {
    setTitle(t.title);
    setContentLang(t.language);
    setSubject(t.subject ?? "");
    setGradeLevel(t.gradeLevel ?? "");
    setSegments(colorize(t.segments));
    setSegmentsEditorOpen(true);
    setConfig(t.config);
    setEditingTemplateId(t.isOwn ? t.id : null); // shared admin templates clone, don't overwrite
    setSavedOpen(false);
    setAiOpen(false);
    toast.success(ar ? `تم تحميل "${t.title}"` : `Loaded "${t.title}"`);
  };

  const deleteTemplate = async (id: number) => {
    if (!window.confirm(ar ? "حذف هذا القالب؟" : "Delete this template?")) return;
    try {
      await fetch(`${API_BASE}/api/wheel-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      if (editingTemplateId === id) setEditingTemplateId(null);
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch {
      toast.error(ar ? "خطأ في الحذف" : "Delete error");
    }
  };

  const loadAssignmentsForImport = async () => {
    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الواجبات" : "Failed to load assignments"); return; }
      const data = await res.json();
      setImportAssignments(
        (Array.isArray(data) ? data : []).map((a: any) => ({
          id: a.id,
          title: a.title,
          subject: a.subject ?? null,
          gradeLevel: a.gradeLevel ?? null,
          questionCount: a.questionCount ?? 0,
        }))
      );
    } finally {
      setImportLoading(false);
    }
  };

  const importFromAssignment = async (assignmentId: number) => {
    setImportingId(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الواجب" : "Failed to load assignment"); return; }
      const data = await res.json();
      const qs: any[] = Array.isArray(data.questions) ? data.questions : [];
      const compatible = qs.filter(q => ["mcq", "true_false"].includes(q.questionType));
      if (compatible.length === 0) {
        toast.error(ar ? "لا توجد أسئلة اختيار متعدد أو صح/خطأ في هذا الواجب" : "No MCQ or True/False questions found");
        return;
      }
      const mcqAnswerText = (q: any): string => {
        if (q.questionType === "mcq") {
          const map: Record<string, string> = {
            A: q.optionA ?? "", B: q.optionB ?? "",
            C: q.optionC ?? "", D: q.optionD ?? "",
          };
          return map[q.correctAnswer?.toUpperCase()] || q.correctAnswer || "";
        }
        return q.correctAnswer ?? "";
      };

      const newSegs: Segment[] = compatible.slice(0, 16).map(q => ({
        id: newId(),
        text: q.text,
        answer: mcqAnswerText(q),
        explanation: q.explanation ?? "",
        points: 100,
        kind: "question" as const,
        imageUrl: q.imageUrl || null,
      }));
      setSegments(colorize(newSegs));
      setActiveSource("assignment");
      setSegmentsEditorOpen(false);
      setSetupStep("source");
      // Always apply title, subject, grade from the selected assignment
      if (data.title) setTitle(data.title);
      if (data.subject) setSubject(data.subject);
      if (data.gradeLevel) setGradeLevel(data.gradeLevel);
      setImportOpen(false);
      toast.success(ar ? `تم استيراد ${newSegs.length} سؤال` : `Imported ${newSegs.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setImportingId(null);
    }
  };

  const isSupportedBankQuestion = (question: BankQuestion) => {
    if (question.questionType === "true_false") return !!question.text && !!question.correctAnswer;
    return !!question.text && !!question.optionA && !!question.optionB
      && !!question.optionC && !!question.optionD && !!question.correctAnswer;
  };

  const answerTextFromQuestion = (question: BankQuestion) => {
    if (question.questionType !== "true_false") {
      const options: Record<string, string> = {
        A: question.optionA ?? "",
        B: question.optionB ?? "",
        C: question.optionC ?? "",
        D: question.optionD ?? "",
      };
      const answerKeys = (question.correctAnswer ?? "")
        .split(",")
        .map(key => key.trim().toUpperCase())
        .filter(Boolean);
      const answerText = answerKeys
        .map(key => options[key])
        .filter(Boolean)
        .join("، ");
      return answerText || question.correctAnswer || "";
    }
    return question.correctAnswer || "";
  };

  const loadBankForImport = async () => {
    setBankLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (response.status === 401) {
        toast.error(ar ? "سجّل الدخول لعرض بنك الأسئلة" : "Sign in to view the question bank");
        setBankOpen(false);
        return;
      }
      if (!response.ok) {
        toast.error(ar ? "تعذّر تحميل بنك الأسئلة" : "Failed to load question bank");
        return;
      }
      const data = await response.json();
      setBankQuestions((Array.isArray(data) ? data : []).filter(isSupportedBankQuestion));
    } catch {
      toast.error(ar ? "تعذّر تحميل بنك الأسئلة" : "Failed to load question bank");
    } finally {
      setBankLoading(false);
    }
  };

  const openBankImport = () => {
    setBankSelectedIds(new Set());
    setBankSearch("");
    setBankOpen(true);
    loadBankForImport();
  };

  const toggleBankQuestion = (id: number) => {
    setBankSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const availableSlots = 16 - segments.length;
      if (availableSlots <= 0) {
        toast.error(ar ? "اكتملت العجلة بـ١٦ قطاعاً. احذف قطاعاً لإضافة سؤال من البنك." : "The wheel already has 16 segments. Remove one to add a bank question.");
        return previous;
      }
      if (next.size >= availableSlots) {
        toast.error(ar ? `يمكنك إضافة ${availableSlots} سؤالاً فقط إلى العجلة الحالية` : `You can add ${availableSlots} questions to the current wheel`);
        return previous;
      }
      next.add(id);
      return next;
    });
  };

  const importFromBank = () => {
    const selected = bankQuestions.filter(question => bankSelectedIds.has(question.id));
    if (selected.length === 0) {
      toast.error(ar ? "اختر سؤالاً واحداً على الأقل" : "Select at least one question");
      return;
    }
    const availableSlots = 16 - segments.length;
    if (availableSlots <= 0) {
      toast.error(ar ? "اكتملت العجلة بـ١٦ قطاعاً. احذف قطاعاً لإضافة سؤال من البنك." : "The wheel already has 16 segments. Remove one to add a bank question.");
      return;
    }
    const newSegments = selected.slice(0, availableSlots).map(question => ({
      id: newId(),
      text: question.text,
      answer: answerTextFromQuestion(question),
      points: 100,
      kind: "question" as const,
      imageUrl: question.imageUrl || null,
    }));
    setSegments(previous => colorize([...previous, ...newSegments]));
    setActiveSource("bank");
    setSegmentsEditorOpen(true);
    setBankOpen(false);
    setSetupStep("source");
    if (!title.trim()) setTitle(ar ? "تحدي من بنك الأسئلة" : "Question Bank Challenge");
    toast.success(ar ? `تمت إضافة ${newSegments.length} سؤال من بنك الأسئلة` : `Added ${newSegments.length} questions from the question bank`);
  };

  const colorPreview = useMemo(() => colorize(segments), [segments]);
  const sourceLabel = activeSource === "assignment"
    ? (ar ? "من واجب موجود" : "From an assignment")
    : activeSource === "ai"
      ? (ar ? "بالذكاء الاصطناعي" : "With AI")
      : activeSource === "bank"
        ? (ar ? "من بنك الأسئلة" : "From question bank")
        : activeSource === "manual"
          ? (ar ? "إضافة يدوية" : "Added manually")
          : null;

  const chooseSource = (source: QuestionSource) => {
    setActiveSource(source);
    if (source === "assignment") {
      setImportOpen(true);
      loadAssignmentsForImport();
    } else if (source === "bank") {
      openBankImport();
    } else if (source === "ai") {
      setAiOpen(true);
    } else if (segments.length === 0) {
      addManualSegment("question");
    }
  };

  const returnToQuestions = () => {
    setSegmentsEditorOpen(false);
    setSetupStep("source");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const filteredBankQuestions = bankSearch.trim()
    ? bankQuestions.filter(question =>
      question.text.includes(bankSearch)
      || (question.subject ?? "").includes(bankSearch),
    )
    : bankQuestions;

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100dvh-4rem)] py-5 sm:py-8 px-3 sm:px-5 max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-3 mb-5 sm:mb-7">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
              <WheelIcon size={32} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">{ar ? "عجلة التحدي" : "Wheel of Challenge"}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{ar ? "جهّز الأسئلة ثم أدر العجلة مع فريقك" : "Prepare questions, then spin with your teams"}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSavedOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-bold text-sm shrink-0">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{ar ? "مكتبتي" : "Library"}</span>
          </button>
        </header>

        <nav aria-label={ar ? "مراحل الإعداد" : "Setup steps"} className="grid grid-cols-2 max-w-xl mx-auto mb-6 sm:mb-8 rounded-2xl bg-muted/60 p-1.5 border border-border">
          {([
            { id: "source" as const, label: ar ? "١. اختر الأسئلة" : "1. Questions", icon: ListChecks },
            { id: "settings" as const, label: ar ? "٢. الإعداد والبدء" : "2. Setup & start", icon: Settings2 },
          ]).map(step => {
            const active = setupStep === step.id;
            const locked = step.id === "settings" && segments.length < 2;
            const Icon = step.icon;
            return (
              <button key={step.id} type="button" disabled={locked} onClick={() => setSetupStep(step.id)}
                className={`min-w-0 flex items-center justify-center gap-2 rounded-xl py-2.5 px-2 text-xs sm:text-sm font-black transition-all ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"} disabled:opacity-45 disabled:cursor-not-allowed`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          {setupStep === "source" ? (
            <motion.main key="source" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              {segments.length === 0 && (
                <section className="rounded-3xl overflow-hidden border border-primary/15 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}10, ${BRAND_GOLD}16)` }}>
                  <div className="p-5 sm:p-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-11 h-11 rounded-2xl bg-card shadow-sm flex items-center justify-center"><WheelIcon size={30} /></div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-foreground">{ar ? "كيف تريد تجهيز العجلة؟" : "How would you like to prepare the wheel?"}</h2>
                        <p className="text-sm text-muted-foreground">{ar ? "اختر مصدراً للأسئلة، ويمكنك تعديل القطاعات بعدها." : "Choose a question source. You can always edit the segments next."}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                      <button type="button" onClick={() => chooseSource("assignment")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><FileDown className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{ar ? "من واجب موجود" : "From an assignment"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ar ? "استورد أسئلة واجبك في ثوانٍ" : "Bring in questions from an existing assignment"}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("ai")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_GOLD}1f`, color: BRAND_GOLD }}><Sparkles className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{ar ? "بالذكاء الاصطناعي" : "With AI"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ar ? "أنشئ أسئلة مناسبة لموضوعك" : "Generate questions for your topic"}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("manual")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><PenLine className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{ar ? "إضافة يدوية" : "Add manually"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ar ? "اكتب أسئلتك ومكافآتك بنفسك" : "Write your own questions and bonuses"}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("bank")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Database className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{ar ? "من بنك الأسئلة" : "From question bank"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ar ? "اختر من أسئلتك المحفوظة" : "Pick from your saved questions"}</p>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {segments.length > 0 && (
                <Card className="relative overflow-hidden p-5 sm:p-7 border-primary/20 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}0e, ${BRAND_GOLD}14)` }}>
                  <div className="absolute -top-10 -end-8 w-36 h-36 rounded-full opacity-20" style={{ background: BRAND_GOLD }} />
                  <div className="relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-xl shadow-md" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                      {segments.length}
                    </div>
                    <h2 className="mt-3 text-xl sm:text-2xl font-black text-foreground">{ar ? "أسئلة العجلة جاهزة" : "Wheel questions are ready"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-lg">{ar ? "أسئلتك محفوظة وجاهزة للعب. يمكنك معاينتها وتعديلها عند الحاجة." : "Your questions are saved and ready to play. Review or edit them whenever you need."}</p>
                    <div className="mt-5 grid w-full max-w-xl grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button type="button" onClick={() => setSegmentsEditorOpen(open => !open)} className="min-h-12 px-4 rounded-xl bg-card hover:bg-primary/5 text-primary text-sm font-black border border-primary/30 flex items-center justify-center gap-2 transition-colors">
                        <Edit3 className="w-4 h-4" />
                        {segmentsEditorOpen ? (ar ? "إخفاء الأسئلة" : "Hide questions") : (ar ? "معاينة وتعديل الأسئلة" : "Review & edit questions")}
                      </button>
                      <button type="button" onClick={() => addManualSegment("question")} className="min-h-12 px-4 rounded-xl bg-card hover:bg-primary/5 text-primary text-sm font-black border border-primary/30 flex items-center justify-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" />
                        {ar ? "إضافة سؤال" : "Add question"}
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              <AnimatePresence initial={false}>
                {activeSource === "ai" && aiOpen && (
                  <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="p-4 sm:p-5 border-amber-500/25">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" style={{ color: BRAND_GOLD }} /><div><h2 className="font-black text-foreground">{ar ? "توليد أسئلة للعجلة" : "Generate wheel questions"}</h2><p className="text-xs text-muted-foreground">{ar ? "سيتم استبدال القطاعات الحالية بالنتيجة الجديدة." : "The generated set replaces the current segments."}</p></div></div>
                        <button type="button" onClick={() => setAiOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={ar ? "الموضوع — مثال: الكسور" : "Topic — e.g. fractions"} className="sm:col-span-3 w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none" />
                        <select value={aiCount} onChange={e => setAiCount(parseInt(e.target.value, 10))} className="px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold text-sm">
                          {[6, 8, 10, 12, 14, 16].map(count => <option key={count} value={count}>{count} {ar ? "قطاعاً" : "segments"}</option>)}
                        </select>
                        <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as typeof aiDifficulty)} className="px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold text-sm">
                          <option value="easy">{ar ? "سهل" : "Easy"}</option><option value="medium">{ar ? "متوسط" : "Medium"}</option><option value="hard">{ar ? "صعب" : "Hard"}</option><option value="mixed">{ar ? "مختلط" : "Mixed"}</option>
                        </select>
                        <button type="button" onClick={() => setAiBonus(value => !value)} className={`rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${aiBonus ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}><Gift className="w-4 h-4" />{ar ? "مكافآت" : "Bonuses"}</button>
                      </div>
                      <button type="button" disabled={generating} onClick={generateAI} className="mt-3 w-full sm:w-auto sm:min-w-56 px-5 py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                        {generating ? <><Loader2 className="w-4 h-4 animate-spin" />{ar ? "جارٍ التوليد…" : "Generating…"}</> : <><Wand2 className="w-4 h-4" />{ar ? "ولّد القطاعات" : "Generate segments"}</>}
                      </button>
                    </Card>
                  </motion.section>
                )}
              </AnimatePresence>

              {(segmentsEditorOpen || (activeSource === "manual" && segments.length === 0)) && (
                <Card className="p-3 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div><h2 className="font-black text-foreground">{activeSource === "assignment" ? (ar ? `معاينة وتعديل أسئلة الواجب (${segments.length})` : `Review & edit assignment questions (${segments.length})`) : (ar ? `تحرير القطاعات (${segments.length})` : `Edit segments (${segments.length})`)}</h2><p className="text-xs text-muted-foreground mt-1">{ar ? "تظل النقاط والمكافآت جزءاً من اللعبة كما هي." : "Points and bonuses remain part of the game."}</p></div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addManualSegment("question")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-sm font-bold border border-primary/30"><Plus className="w-4 h-4" />{ar ? "إضافة سؤال" : "Add question"}</button>
                      <button type="button" onClick={() => addManualSegment("bonus")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border" style={{ background: `${BRAND_GOLD}18`, color: BRAND_GOLD, borderColor: `${BRAND_GOLD}55` }}><Gift className="w-4 h-4" />{ar ? "إضافة مكافأة" : "Add bonus"}</button>
                    </div>
                  </div>
                  {segments.length === 0 ? (
                    <div className="rounded-2xl py-9 text-center bg-muted/35 text-muted-foreground"><PenLine className="w-7 h-7 mx-auto mb-2 opacity-50" /><p className="font-bold text-sm">{ar ? "أضف أول سؤال يدوياً" : "Add your first question manually"}</p></div>
                  ) : (
                    <div className="space-y-2">
                      {colorPreview.map((segment, index) => (
                        <motion.div layout key={segment.id} className="rounded-2xl border bg-card p-3 sm:p-4" style={{ borderColor: `${segment.color}48` }}>
                          <div className="flex items-start gap-2.5">
                            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow" style={{ background: segment.color }}>{index + 1}</div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black px-2 py-1 rounded-full" style={segment.kind === "bonus" ? { background: `${BRAND_GOLD}20`, color: BRAND_GOLD } : { background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                                  {segment.kind === "bonus" ? <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" />{ar ? "مكافأة" : "Bonus"}</span> : <span className="inline-flex items-center gap-1"><HelpCircle className="w-3 h-3" />{ar ? "سؤال" : "Question"}</span>}
                                </span>
                                <select value={segment.points} onChange={e => updateSegment(segment.id, { points: parseInt(e.target.value, 10) })} className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background">
                                  {(segment.kind === "bonus" ? [0, 100, 200] : POINT_OPTIONS).map(points => <option key={points} value={points}>{points} {ar ? "نقطة" : "pt"}</option>)}
                                </select>
                                {segment.kind === "bonus" && <select value={segment.bonusType ?? "lucky"} onChange={e => updateSegment(segment.id, { bonusType: e.target.value as BonusType })} className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background">{BONUS_TYPES.map(type => <option key={type} value={type}>{bonusLabel(type, contentLang)}</option>)}</select>}
                                <button type="button" onClick={() => removeSegment(segment.id)} className="ms-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" aria-label={ar ? "حذف القطاع" : "Remove segment"}><Trash2 className="w-4 h-4" /></button>
                              </div>
                              <textarea value={segment.text} onChange={e => updateSegment(segment.id, { text: e.target.value })} rows={2} placeholder={segment.kind === "question" ? (ar ? "نص السؤال…" : "Question text…") : (ar ? "عنوان المكافأة…" : "Bonus label…")} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm resize-none" />
                              {segment.kind === "question" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input type="text" value={segment.answer ?? ""} onChange={e => updateSegment(segment.id, { answer: e.target.value })} placeholder={ar ? "الإجابة الصحيحة" : "Correct answer"} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /><input type="text" value={segment.explanation ?? ""} onChange={e => updateSegment(segment.id, { explanation: e.target.value })} placeholder={ar ? "شرح (اختياري)" : "Explanation (optional)"} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /></div>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {segments.length >= 2 && (
                <div className="flex justify-end pt-1">
                  <button type="button" onClick={() => setSetupStep("settings")} className="px-8 py-3.5 rounded-2xl text-white text-base font-black shadow-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5" style={{ background: BRAND_PRIMARY }}>
                    {ar ? "التالي" : "Next"}{ar ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </motion.main>
          ) : (
            <motion.main key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <section className="rounded-3xl p-5 sm:p-7 border border-primary/15" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}0d, ${BRAND_GOLD}14)` }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div><p className="text-xs font-black tracking-wide uppercase" style={{ color: BRAND_PRIMARY }}>{ar ? "العجلة جاهزة" : "Wheel ready"}</p><h2 className="text-xl sm:text-2xl font-black text-foreground mt-1">{title || (ar ? "أضف عنواناً للعبة" : "Add a game title")}</h2><p className="text-sm text-muted-foreground mt-1">{ar ? `${segments.length} قطاعات · ${config.teamCount} فرق` : `${segments.length} segments · ${config.teamCount} teams`}</p></div>
                  <button type="button" onClick={returnToQuestions} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-card border border-border hover:border-primary/40 flex items-center gap-1.5">
                    {ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    {ar ? "السابق: الأسئلة" : "Back: questions"}
                  </button>
                </div>
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-4">
                  <Card className="p-4 sm:p-5">
                    <h3 className="font-black text-foreground mb-4 flex items-center gap-2"><Edit3 className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />{ar ? "تفاصيل اللعبة" : "Game details"}</h3>
                    <div className="space-y-3">
                      <div><label className="block text-sm font-bold text-foreground mb-1.5">{ar ? "عنوان اللعبة" : "Game title"}</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={ar ? "مثال: مراجعة الفصل الأول" : "e.g. Chapter 1 review"} className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background focus:border-primary outline-none text-base" /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-xs font-bold text-foreground block mb-1.5">{ar ? "لغة المحتوى" : "Content language"}</label><select value={contentLang} onChange={e => setContentLang(e.target.value as "ar" | "en")} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none font-bold text-sm"><option value="ar">العربية</option><option value="en">English</option></select></div><div><label className="text-xs font-bold text-foreground block mb-1.5">{ar ? "المادة" : "Subject"}</label><input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={ar ? "اختياري" : "Optional"} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /></div></div>
                      <div><label className="text-xs font-bold text-foreground block mb-1.5">{ar ? "الصف" : "Grade"}</label>{gradeLevels.length > 0 ? <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none font-bold text-sm"><option value="">{ar ? "اختياري" : "Optional"}</option>{gradeLevels.map(grade => <option key={grade.gradeLevel} value={grade.gradeLevel}>{grade.gradeLevel}</option>)}</select> : <input type="text" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} placeholder={ar ? "اختياري" : "Optional"} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" />}</div>
                    </div>
                  </Card>
                  <Card className="p-4 sm:p-5">
                    <h3 className="font-black text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />{ar ? "الفرق" : "Teams"}</h3>
                    <div className="flex gap-1.5 mb-3">{[2, 3, 4, 5, 6].map(count => <button key={count} type="button" onClick={() => setConfig(current => ({ ...current, teamCount: count }))} className={`flex-1 h-10 rounded-xl font-black text-sm border-2 transition-all ${config.teamCount === count ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}>{count}</button>)}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{config.teamNames.map((name, index) => <input key={index} type="text" value={name} onChange={e => { const names = [...config.teamNames]; names[index] = e.target.value; setConfig(current => ({ ...current, teamNames: names })); }} placeholder={defaultTeamName(index, contentLang)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" />)}</div>
                  </Card>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <Card className="p-4 sm:p-5">
                    <button type="button" onClick={() => setAdvancedOpen(open => !open)} className="w-full flex items-center justify-between"><span className="font-black text-foreground flex items-center gap-2"><Settings2 className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />{ar ? "إعدادات العجلة" : "Wheel settings"}</span><span className="text-xs text-muted-foreground">{advancedOpen ? "▲" : "▼"}</span></button>
                    <AnimatePresence initial={false}>{advancedOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="pt-4 space-y-4"><div><div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-foreground flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5" />{ar ? "مدة الدوران" : "Spin duration"}</label><span className="text-xs font-black" style={{ color: BRAND_PRIMARY }}>{config.spinSeconds}s</span></div><input type="range" min={3} max={10} value={config.spinSeconds} onChange={e => setConfig(current => ({ ...current, spinSeconds: parseInt(e.target.value, 10) }))} className="w-full accent-primary" /></div><button type="button" onClick={() => setConfig(current => ({ ...current, soundOn: !current.soundOn }))} className={`w-full py-2.5 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 ${config.soundOn ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}><Volume2 className="w-4 h-4" />{config.soundOn ? (ar ? "الصوت مفعّل" : "Sound on") : (ar ? "الصوت متوقّف" : "Sound off")}</button></div></motion.div>}</AnimatePresence>
                  </Card>
                  <div className="rounded-2xl p-4 border border-primary/15" style={{ background: `${BRAND_PRIMARY}09` }}><p className="text-sm font-black text-foreground">{ar ? "كل شيء جاهز للانطلاق" : "Everything is ready"}</p><p className="text-xs text-muted-foreground mt-1">{ar ? "احفظ قالبك أو ابدأ اللعب مباشرة." : "Save this setup or start playing now."}</p></div>
                  <button type="button" disabled={launching || segments.length < 2} onClick={launchPlay} className="w-full py-3.5 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>{launching ? <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جارٍ الإطلاق…" : "Launching…"}</> : <><Play className="w-5 h-5" />{ar ? "ابدأ اللعب" : "Start playing"}</>}</button>
                  <button type="button" disabled={saving} onClick={saveTemplate} className="w-full py-2.5 rounded-xl font-bold bg-card border-2 border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-sm">{saving ? <><Loader2 className="w-4 h-4 animate-spin" />{ar ? "جارٍ الحفظ…" : "Saving…"}</> : editingTemplateId !== null ? <><Check className="w-4 h-4" />{ar ? "تحديث القالب" : "Update template"}</> : <><Save className="w-4 h-4" />{ar ? "احفظ في المكتبة" : "Save to library"}</>}</button>
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>

        {/* Import from assignment modal */}
        <AnimatePresence>
          {importOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              onClick={() => setImportOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                      <FileDown className="w-5 h-5" style={{ color: BRAND_PRIMARY }} />
                      {ar ? "استيراد من واجب" : "Import from Assignment"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ar ? "اضغط على الواجب ليتم اختياره مباشرةً (اختيار متعدد وصح/خطأ)" : "Select an assignment directly to import its MCQ & True/False questions"}
                    </p>
                  </div>
                  <button
                    onClick={() => setImportOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {importLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                  ) : importAssignments.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto opacity-30 mb-2" />
                      <p className="font-bold">{ar ? "لا توجد واجبات" : "No assignments found"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {importAssignments.map(a => (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => importFromAssignment(a.id)}
                          disabled={importingId !== null || a.questionCount === 0}
                          className="w-full text-start border-2 border-border rounded-xl p-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground truncate">{a.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.questionCount > 0 ? `${a.questionCount} ${ar ? "سؤال" : "questions"}` : ar ? "بدون أسئلة" : "no questions"}
                              {a.subject ? ` · ${a.subject}` : ""}
                              {a.gradeLevel ? ` · ${a.gradeLevel}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                            {importingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import from question bank modal */}
        <AnimatePresence>
          {bankOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
              onClick={() => setBankOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                className="bg-card rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88dvh] overflow-hidden flex flex-col border border-border"
                onClick={event => event.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}>
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{ar ? "اختر من بنك الأسئلة" : "Choose from question bank"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{ar ? "اختر الأسئلة التي تريد تحويلها إلى قطاعات في العجلة." : "Select questions to add as wheel segments."}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setBankOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label={ar ? "إغلاق" : "Close"}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <BookOpen className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={bankSearch}
                        onChange={event => setBankSearch(event.target.value)}
                        placeholder={ar ? "ابحث في أسئلتك أو المادة…" : "Search your questions or subject…"}
                        className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm"
                      />
                    </div>
                    <div className="px-3 py-2.5 rounded-xl bg-muted/60 text-xs font-bold text-muted-foreground text-center">
                      {bankSelectedIds.size} / {Math.max(0, 16 - segments.length)} {ar ? "محددة" : "selected"}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {bankLoading ? (
                    <div className="py-16 text-center text-muted-foreground"><Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" /><p className="text-sm font-bold">{ar ? "جارٍ تحميل بنك الأسئلة…" : "Loading question bank…"}</p></div>
                  ) : filteredBankQuestions.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground"><Database className="w-12 h-12 mx-auto opacity-30 mb-3" /><p className="font-bold">{bankQuestions.length === 0 ? (ar ? "لا توجد أسئلة مدعومة في بنك الأسئلة" : "No supported questions in your question bank") : (ar ? "لا توجد نتائج مطابقة" : "No matching questions")}</p><p className="text-xs mt-1">{ar ? "تحتاج العجلة إلى أسئلة اختيار متعدد أو صح وخطأ." : "The wheel supports multiple-choice and true/false questions."}</p></div>
                  ) : (
                    <div className="space-y-2">
                      {filteredBankQuestions.map(question => {
                        const selected = bankSelectedIds.has(question.id);
                        return (
                          <button key={question.id} type="button" onClick={() => toggleBankQuestion(question.id)} className={`w-full text-start rounded-2xl border-2 p-3 sm:p-4 transition-all ${selected ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/35 hover:bg-primary/[0.02]"}`}>
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>{selected && <Check className="w-3.5 h-3.5" />}</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-foreground line-clamp-2">{question.text}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {question.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{question.subject}</span>}
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}>{question.questionType === "true_false" ? (ar ? "صح وخطأ" : "True / false") : (ar ? "اختيار متعدد" : "Multiple choice")}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 bg-card">
                  <p className="text-xs text-muted-foreground hidden sm:block">{ar ? "يمكنك تعديل الأسئلة والنقاط بعد إضافتها." : "You can edit questions and points after importing."}</p>
                  <button type="button" disabled={bankSelectedIds.size === 0} onClick={importFromBank} className="ms-auto px-5 py-2.5 rounded-xl font-black text-white text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                    <Check className="w-4 h-4" />{ar ? `أضف ${bankSelectedIds.size || ""} سؤالاً` : `Add ${bankSelectedIds.size || ""} questions`}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved templates modal */}
        <AnimatePresence>
          {savedOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              onClick={() => setSavedOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-lg font-black text-foreground">
                    {ar ? "قوالب عجلة التحدي" : "Wheel Templates"}
                  </h3>
                  <button
                    onClick={() => setSavedOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {savedLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                  ) : savedTemplates.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <FolderOpen className="w-12 h-12 mx-auto opacity-30 mb-2" />
                      <p className="font-bold">
                        {ar ? "لا توجد قوالب محفوظة بعد" : "No saved templates yet"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedTemplates.map(t => (
                        <div key={t.id} className="border-2 border-border rounded-xl p-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-foreground truncate">{t.title}</h4>
                                {t.fromAdmin && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                                    style={{ background: `${BRAND_GOLD}20`, color: BRAND_GOLD }}>
                                    {ar ? "من الإدارة" : "From admin"}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.segments.length} {ar ? "قطاع" : "segments"}
                                {t.subject ? ` · ${t.subject}` : ""}
                                {t.gradeLevel ? ` · ${t.gradeLevel}` : ""}
                                {` · ${t.language === "ar" ? "العربية" : "English"}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => applyTemplate(t)}
                                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary font-bold text-xs flex items-center gap-1 border border-primary/30 transition-all"
                              >
                                <Edit3 className="w-3 h-3" /> {ar ? "تحميل" : "Load"}
                              </button>
                              {t.isOwn && (
                                <button
                                  onClick={() => deleteTemplate(t.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                                  aria-label="delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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
      </div>
    </Layout>
  );
}
