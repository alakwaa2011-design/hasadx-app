import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AiPresentationBuilder } from "./builder";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  Sparkles, Loader2, ArrowLeft, ArrowRight, Zap, Settings2,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Play, Pencil,
  MessageSquare, HelpCircle, BarChart2, Type, Target, Image as ImageIcon, File, Presentation,
  UploadCloud, FileText, X, Trash2, Plus, Check, Search, BookOpen
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ── Educational strategy data ─────────────────────────────────────── */
type EducationalStrategy =
  | "none"
  | "active_learning"
  | "cooperative_learning"
  | "flipped_classroom"
  | "brainstorming"
  | "think_pair_share"
  | "problem_based"
  | "project_based"
  | "inquiry"
  | "scamper"
  | "six_thinking_hats"
  | "21st_century_skills"
  | "gamification"
  | "differentiated"
  | "concept_maps"
  | "kwl"
  | "5e_model";

interface StrategyMeta { label: string; desc: string }

const STRATEGIES_AR: Record<EducationalStrategy, StrategyMeta> = {
  none:                  { label: "بدون استراتيجية محددة",          desc: "الذكاء الاصطناعي يختار البنية المناسبة بحرية." },
  active_learning:       { label: "التعلم النشط",                    desc: "إشراك الطلاب بأسئلة وأنشطة قصيرة ومتنوعة أثناء العرض." },
  cooperative_learning:  { label: "التعلم التعاوني",                  desc: "أنشطة جماعية ونقاش بين المجموعات مع تقييم مشترك." },
  flipped_classroom:     { label: "الصف المقلوب",                    desc: "التطبيق في الفصل — المحتوى للمنزل. أغلب الشرائح تفاعلية." },
  brainstorming:         { label: "العصف الذهني",                    desc: "توليد أفكار إبداعية عبر أسئلة مفتوحة وتصنيف الأفكار." },
  think_pair_share:      { label: "فكر - زاوج - شارك",               desc: "دورات ثلاثية: سؤال فردي → نقاش ثنائي → مشاركة جماعية." },
  problem_based:         { label: "التعلم القائم على المشكلات",       desc: "يبدأ العرض بمشكلة واقعية: تحليل → فرضيات → حل → تقييم." },
  project_based:         { label: "التعلم القائم على المشاريع",       desc: "تعريف مشروع → خطة → بحث → نشاط إبداعي → عرض النتائج." },
  inquiry:               { label: "الاستقصاء",                       desc: "يثير الفضول بسؤال → ملاحظة أدلة → فرضيات → استنتاجات." },
  scamper:               { label: "سكامبر SCAMPER",                  desc: "يساعد الطلاب على توليد أفكار عبر: استبدل، اجمع، عدّل، استخدم، احذف، اعكس." },
  six_thinking_hats:     { label: "قبعات التفكير الست",               desc: "ست زوايا تفكير: حقائق، مشاعر، نقد، إيجابيات، إبداع، تلخيص." },
  "21st_century_skills": { label: "مهارات القرن 21",                  desc: "التفكير النقدي والإبداع والتواصل والتعاون مدمجة في الأنشطة." },
  gamification:          { label: "التلعيب",                         desc: "تحديات، نقاط، جولات تنافسية، وأسئلة سريعة — ≥40% تفاعلي." },
  differentiated:        { label: "التعليم المتمايز",                 desc: "تشخيص مسبق + مستويات متعددة للمحتوى وأنشطة متدرجة." },
  concept_maps:          { label: "خرائط المفاهيم",                  desc: "تنظيم المعرفة بصريًا: مفهوم رئيسي → علاقات → تطبيق." },
  kwl:                   { label: "KWL",                             desc: "ماذا أعرف؟ → ماذا أريد أن أعرف؟ → محتوى → ماذا تعلمت؟" },
  "5e_model":            { label: "نموذج 5E",                        desc: "Engage → Explore → Explain → Elaborate → Evaluate (دورة كاملة)." },
};

const STRATEGY_ORDER: EducationalStrategy[] = [
  "none", "active_learning", "cooperative_learning", "flipped_classroom",
  "brainstorming", "think_pair_share", "problem_based", "project_based",
  "inquiry", "scamper", "six_thinking_hats", "21st_century_skills",
  "gamification", "differentiated", "concept_maps", "kwl", "5e_model",
];

const GRADES = [
  "الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع",
  "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن",
  "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر",
];

type Mode = null | "quick" | "pro" | "import";
type QuickPhase = "form" | "generating" | "preview" | "error";
type ImportPhase = "dropzone" | "uploading" | "review" | "preview" | "error";

interface McqQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  slideTitle?: string;
}

interface ImportResult {
  presentationId: number;
  title: string;
  slideCount: number;
  aiGenerated: boolean;
  warning?: string;
  pendingMcqQuestions?: McqQuestion[];
}

function inferQuickSlideCount(topic: string, subject: string, grade: string): number {
  const text = `${topic} ${subject} ${grade}`.toLowerCase();
  if (/وحدة|مشروع|مراجعة شاملة|اختبار|نهائي|unit|project|comprehensive|exam|final/.test(text)) return 12;
  if (/مقدمة|تعريف|مدخل|نشاط|quick|intro|overview|starter/.test(text)) return 6;
  return 9;
}

const IMPORT_ACCEPT = ".pdf,.pptx,.ppt,.docx,.doc,.jpg,.jpeg,.png,.webp";
const IMPORT_ACCEPT_LABEL_AR = "PDF، PPTX، Word، صور (JPG / PNG)";
const IMPORT_ACCEPT_LABEL_EN = "PDF, PPTX, Word, images (JPG / PNG)";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── MCQ Review Panel ────────────────────────────────────────────────── */

interface McqReviewPanelProps {
  isAr: boolean;
  questions: McqQuestion[];
  saving: boolean;
  onConfirm: (questions: McqQuestion[]) => void;
  onSkip: () => void;
}

function McqReviewPanel({ isAr, questions: initial, saving, onConfirm, onSkip }: McqReviewPanelProps) {
  const [questions, setQuestions] = useState<McqQuestion[]>(initial);

  const updateQuestion = (idx: number, patch: Partial<McqQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) }
          : q,
      ),
    );
  };

  const deleteQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx && q.options.length < 6
          ? { ...q, options: [...q.options, ""] }
          : q,
      ),
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOptions = q.options.filter((_, j) => j !== oIdx);
        const newCorrect =
          q.correctIndex === oIdx
            ? 0
            : q.correctIndex > oIdx
              ? q.correctIndex - 1
              : q.correctIndex;
        return { ...q, options: newOptions, correctIndex: newCorrect };
      }),
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
          <HelpCircle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-1">
            {isAr ? "راجع الأسئلة التلقائية" : "Review AI-generated questions"}
          </h2>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr
              ? "الذكاء الاصطناعي اقترح هذه الأسئلة بناءً على محتوى ملفك. عدّل أو احذف ما تريد ثم احفظ."
              : "AI suggested these questions based on your file's content. Edit or delete as needed, then save."}
          </p>
        </div>
      </div>

      {/* Question cards */}
      <div className="flex flex-col gap-4 mb-7">
        {questions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm font-bold bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl border border-dashed border-emerald-100 dark:border-emerald-900/30">
            {isAr ? "لا توجد أسئلة — سيتم تخطّيها." : "No questions left — they'll be skipped."}
          </div>
        ) : (
          <AnimatePresence>
            {questions.map((q, qIdx) => (
              <motion.div
                key={qIdx}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, padding: 0, overflow: 'hidden' }}
                className="rounded-2xl border border-emerald-50 dark:border-emerald-900/30 bg-[#f4f7f5] dark:bg-[#0B100E] p-5 flex flex-col gap-4 shadow-sm"
              >
                {/* Question header */}
                <div className="flex items-center justify-between gap-2 border-b border-emerald-100 dark:border-emerald-900/30 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                      {qIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {isAr ? "السؤال" : "Question"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(qIdx)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1.5 rounded-lg transition-colors"
                    title={isAr ? "حذف السؤال" : "Delete question"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isAr ? "حذف" : "Delete"}
                  </button>
                </div>

                {/* Prompt */}
                <div>
                  <textarea
                    dir={isAr ? "rtl" : "ltr"}
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                    rows={2}
                    className="w-full bg-transparent border-b-2 border-transparent hover:border-emerald-100 focus:border-emerald-400 dark:hover:border-emerald-900/50 dark:focus:border-emerald-500 outline-none text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-colors pb-2 resize-none"
                    placeholder={isAr ? "نص السؤال..." : "Question text..."}
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-[11px] font-bold mb-3 text-slate-500 dark:text-slate-400">
                    {isAr ? "الخيارات (اضغط على الخيار الصحيح)" : "Options (click to mark as correct)"}
                  </label>
                  <div className="flex flex-col gap-2.5">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-3 bg-white dark:bg-[#15201B] p-2 pr-3 rounded-xl border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-300 dark:focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 dark:focus-within:ring-emerald-900/20 transition-all shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                          className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                            q.correctIndex === oIdx
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                              : "border-slate-200 dark:border-slate-700 hover:border-emerald-300"
                          }`}
                          title={isAr ? "تعيين كإجابة صحيحة" : "Mark as correct"}
                        >
                          {q.correctIndex === oIdx && <Check className="w-4 h-4" />}
                        </button>
                        <input
                          type="text"
                          dir={isAr ? "rtl" : "ltr"}
                          value={opt}
                          onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                          placeholder={isAr ? `الخيار ${oIdx + 1}` : `Option ${oIdx + 1}`}
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIdx, oIdx)}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title={isAr ? "حذف الخيار" : "Remove option"}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => addOption(qIdx)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {isAr ? "إضافة خيار" : "Add option"}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-emerald-50 dark:border-emerald-900/30">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
        >
          {isAr ? "تخطّي الأسئلة" : "Skip questions"}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(questions)}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {isAr
            ? `حفظ ${questions.length > 0 ? `${questions.length} أسئلة` : ""}`.trim()
            : `Save${questions.length > 0 ? ` ${questions.length} question${questions.length !== 1 ? "s" : ""}` : ""}`}
        </button>
      </div>
    </motion.div>
  );
}

export default function NewPresentationPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const isAr = lang === "ar";

  // Auth guard — this page is AI-only, visitors must log in
  const { data: currentUser, isLoading: authLoading, error: authError } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  useEffect(() => {
    if (!authLoading && (authError || !currentUser)) {
      setLocation("/login?redirect=" + encodeURIComponent("/teacher/presentations/new"));
    }
  }, [authLoading, authError, currentUser, setLocation]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/teacher/presentations");
  }, [setLocation]);

  const [mode, setMode] = useState<Mode>(null);
  const [quickPhase, setQuickPhase] = useState<QuickPhase>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [educationalStrategy, setEducationalStrategy] = useState<EducationalStrategy>("none");

  const [generatedPresentationId, setGeneratedPresentationId] = useState<number | null>(null);
  const [generatedSlides, setGeneratedSlides] = useState<
    Array<{ title: string; kind: string; interactionHint: string | null }>
  >([]);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [proBuilderOpen, setProBuilderOpen] = useState(false);

  /* ── Import mode state ── */
  const [importPhase, setImportPhase] = useState<ImportPhase>("dropzone");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importErrorMsg, setImportErrorMsg] = useState("");
  const [importDragOver, setImportDragOver] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  /* ── Inline rename state (shown after import success) ── */
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameConfirmed, setRenameConfirmed] = useState(false);

  /* ── Inline rename state (shown after Quick Mode success) ── */
  const [quickRenameValue, setQuickRenameValue] = useState("");
  const [quickRenameSaving, setQuickRenameSaving] = useState(false);
  const [quickRenameConfirmed, setQuickRenameConfirmed] = useState(false);

  /* ── MCQ review state ── */
  const [reviewQuestions, setReviewQuestions] = useState<McqQuestion[]>([]);
  const [reviewSaving, setReviewSaving] = useState(false);

  useEffect(() => {
    if (mode === "pro") setProBuilderOpen(true);
  }, [mode]);

  const canGenerate = topic.trim().length >= 2;

  const handleQuickGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setQuickPhase("generating");
    setErrorMsg("");

    const msgs = isAr
      ? [
          "جاري التفكير في خطة الدرس…",
          "توليد المخطط التفصيلي…",
          "بناء الشرائح…",
          "إضافة الأنشطة التفاعلية…",
          "اللمسات الأخيرة…",
        ]
      : [
          "Planning the lesson…",
          "Generating detailed outline…",
          "Building slides…",
          "Adding interactive activities…",
          "Final touches…",
        ];
    let mi = 0;
    setStatusMsg(msgs[0]);
    const t = setInterval(() => {
      mi = (mi + 1) % msgs.length;
      setStatusMsg(msgs[mi]);
    }, 3500);

    try {
      const r1 = await fetch(`${API_BASE}/api/presentations/ai/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          language: "ar",
          subject: subject.trim() || topic.trim(),
          gradeLevel: grade || "غير محدد",
          topic: topic.trim(),
          presentationKind: "quick",
          slideCount: inferQuickSlideCount(topic.trim(), subject.trim(), grade),
          durationMinutes: 30,
          languageLevel: "medium",
          density: "balanced",
          toggles: { activities: true, questions: true, poll: true, quiz: true },
          educationalStrategy,
        }),
      });
      if (!r1.ok) {
        const e = await r1.json().catch(() => ({}));
        throw new Error(
          (e as { message?: string }).message ||
            (isAr ? "فشل توليد المخطط" : "Outline generation failed"),
        );
      }
      const draft = await r1.json() as { id: number };
      const draftId = draft.id;

      const r2 = await fetch(`${API_BASE}/api/presentations/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "outline_ready" }),
      });
      if (!r2.ok) {
        throw new Error(isAr ? "فشل اعتماد المخطط" : "Outline approval failed");
      }

      setStatusMsg(isAr ? "بناء الشرائح…" : "Building slides…");
      const r3 = await fetch(`${API_BASE}/api/presentations/ai/build/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ coverEmoji: "📚" }),
      });
      if (!r3.ok) {
        const e = await r3.json().catch(() => ({}));
        throw new Error(
          (e as { message?: string }).message ||
            (isAr ? "فشل بناء الشرائح" : "Build failed"),
        );
      }

      let presId: number | null = null;
      type DraftOutlineSlide = { title: string; kind: string; interactionHint?: string | null };
      type DraftPoll = { status: string; presentationId?: number; errorMessage?: string; outline?: { slides?: DraftOutlineSlide[] } };
      for (let i = 0; i < 120; i++) {
        await sleep(800);
        const rp = await fetch(`${API_BASE}/api/presentations/drafts/${draftId}`, {
          credentials: "include",
        });
        if (!rp.ok) continue;
        const pd = await rp.json() as DraftPoll;
        if (pd.status === "built" && pd.presentationId) {
          presId = pd.presentationId;
          /* Capture up to 6 outline slide cards for thumbnail preview. */
          if (pd.outline?.slides?.length) {
            setGeneratedSlides(
              pd.outline.slides.slice(0, 6).map((s) => ({
                title: s.title,
                kind: s.kind,
                interactionHint: s.interactionHint ?? null,
              })),
            );
          }
          break;
        }
        if (pd.status === "failed") {
          throw new Error(
            pd.errorMessage || (isAr ? "فشل الإنشاء" : "Build failed"),
          );
        }
      }

      clearInterval(t);
      if (!presId) {
        throw new Error(
          isAr ? "انتهت المهلة، حاول مجدداً" : "Timed out, please retry",
        );
      }

      setGeneratedPresentationId(presId);

      /* Fetch the actual AI-generated title; fall back to the raw topic. */
      let aiTitle = topic.trim();
      try {
        const presRes = await fetch(`${API_BASE}/api/presentations/${presId}`, {
          credentials: "include",
        });
        if (presRes.ok) {
          const presData = await presRes.json();
          if (presData?.title) aiTitle = presData.title;
        }
      } catch {
        /* ignore – fall back to topic */
      }

      setQuickRenameValue(aiTitle);
      setQuickRenameConfirmed(false);
      setQuickPhase("preview");
    } catch (err) {
      clearInterval(t);
      const msg =
        err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error";
      setErrorMsg(msg);
      setQuickPhase("error");
      toast.error(msg);
    }
  }, [topic, grade, subject, educationalStrategy, isAr, canGenerate]);

  const resetQuick = () => {
    setQuickPhase("form");
    setTopic("");
    setGrade("");
    setSubject("");
    setEducationalStrategy("none");
    setGeneratedPresentationId(null);
    setGeneratedSlides([]);
    setErrorMsg("");
    setQuickRenameValue("");
    setQuickRenameSaving(false);
    setQuickRenameConfirmed(false);
  };

  /* Transition to the next phase after an import response.
     Always initialises the rename fields so the preview panel is ready
     whether we go through the MCQ review step or skip it. */
  const handleImportResult = useCallback((result: ImportResult) => {
    setImportResult(result);
    setRenameValue(result.title);
    setRenameConfirmed(false);
    if (result.pendingMcqQuestions && result.pendingMcqQuestions.length > 0) {
      setReviewQuestions(result.pendingMcqQuestions);
      setImportPhase("review");
    } else {
      setImportPhase("preview");
    }
  }, []);

  /* Upload a file to the import endpoint and handle the result. */
  const handleImportFile = useCallback(async (file: File) => {
    setImportPhase("uploading");
    setImportErrorMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API_BASE}/api/presentations/import-file`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          (j as { message?: string }).message ??
            (isAr ? "فشل استيراد الملف" : "File import failed"),
        );
      }
      handleImportResult(j as ImportResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error";
      setImportErrorMsg(msg);
      setImportPhase("error");
      toast.error(msg);
    }
  }, [isAr, handleImportResult]);

  const resetImport = () => {
    setImportPhase("dropzone");
    setImportResult(null);
    setImportErrorMsg("");
    setImportDragOver(false);
    setImportUrl("");
    setRenameValue("");
    setRenameSaving(false);
    setRenameConfirmed(false);
    setReviewQuestions([]);
  };

  /* Save a new title for the just-imported presentation. */
  const handleRename = useCallback(async () => {
    if (!importResult) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === importResult.title) {
      setRenameConfirmed(true);
      return;
    }
    setRenameSaving(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${importResult.presentationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: trimmed }),
        },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as { message?: string }).message ?? (isAr ? "فشل حفظ الاسم" : "Failed to save title"));
      }
      setImportResult((prev) => prev ? { ...prev, title: trimmed } : prev);
      setRenameConfirmed(true);
      toast.success(isAr ? "تم حفظ الاسم" : "Title saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error");
    } finally {
      setRenameSaving(false);
    }
  }, [importResult, renameValue, isAr]);

  /* Save a new title for the just-generated (Quick Mode) presentation. */
  const handleQuickRename = useCallback(async () => {
    if (!generatedPresentationId) return;
    const trimmed = quickRenameValue.trim();
    if (!trimmed) {
      setQuickRenameConfirmed(true);
      return;
    }
    setQuickRenameSaving(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${generatedPresentationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: trimmed }),
        },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as { message?: string }).message ?? (isAr ? "فشل حفظ الاسم" : "Failed to save title"));
      }
      setQuickRenameConfirmed(true);
      toast.success(isAr ? "تم حفظ الاسم" : "Title saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error");
    } finally {
      setQuickRenameSaving(false);
    }
  }, [generatedPresentationId, quickRenameValue, isAr]);

  /* Submit a URL (Google Slides) to the import-url endpoint. */
  const handleImportUrl = useCallback(async () => {
    const trimmed = importUrl.trim();
    if (!trimmed) return;
    setImportPhase("uploading");
    setImportErrorMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/presentations/import-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          (j as { message?: string }).message ??
            (isAr ? "فشل استيراد الرابط" : "URL import failed"),
        );
      }
      handleImportResult(j as ImportResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error";
      setImportErrorMsg(msg);
      setImportPhase("error");
      toast.error(msg);
    }
  }, [importUrl, isAr, handleImportResult]);

  /* Confirm reviewed questions — append accepted ones then go to preview. */
  const handleReviewConfirm = useCallback(async (questions: McqQuestion[]) => {
    if (!importResult) return;
    setReviewSaving(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${importResult.presentationId}/append-mcq`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions }),
        },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error((e as { message?: string }).message ?? (isAr ? "فشل حفظ الأسئلة" : "Failed to save questions"));
      } else {
        const j = await r.json() as { slideCount?: number };
        setImportResult((prev) =>
          prev ? { ...prev, slideCount: j.slideCount ?? prev.slideCount } : prev,
        );
      }
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setReviewSaving(false);
      setImportPhase("preview");
    }
  }, [importResult, isAr]);

  /* Creates a live session for the generated deck and jumps to the
     control panel — this is the distinct "launch now" path, separate
     from "edit in Pro Studio" which opens the editor. */
  const handleLaunchNow = useCallback(async () => {
    if (!generatedPresentationId) return;
    setLaunchLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${generatedPresentationId}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ targetClass: null }),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(
          (j as { message?: string }).message ??
            (isAr ? "تعذّر بدء الجلسة" : "Failed to start session"),
        );
        return;
      }
      setLocation(`/p/control/${(j as { sessionId: string }).sessionId}`);
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setLaunchLoading(false);
    }
  }, [generatedPresentationId, isAr, setLocation]);

  // Show nothing (redirect is in-flight) while auth resolves
  if (authLoading || !currentUser) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#225739]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-24 transition-colors ${mode === null ? "px-4 sm:px-6 py-6 sm:py-10" : "px-0"}`}>
        
        {/* Sticky Header when mode is active */}
        {mode !== null && (
          <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all mb-6">
            <button
              type="button"
              onClick={goBack}
              className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            >
              {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {mode === "quick"
                    ? isAr ? "الإنشاء السريع" : "Quick Mode"
                    : mode === "pro"
                      ? isAr ? "استوديو المحترف" : "Pro Studio"
                      : isAr ? "استيراد ملف" : "Import File"}
                </h1>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                  {mode === "quick"
                    ? isAr ? "ابنِ حصتك كاملة في أقل من دقيقة باستخدام الذكاء الاصطناعي" : "Build your full lesson in under a minute with AI"
                    : mode === "pro"
                      ? isAr ? "تحكم كامل في المخطط والشرائح والأنشطة" : "Full control over outline, slides, and activities"
                      : isAr ? "ارفع ملفاً وحوّله تلقائياً إلى عرض تفاعلي" : "Upload a file to convert it into an interactive deck"}
                </p>
              </div>
            </div>
            <Link href="/teacher/presentations" className="shrink-0">
              <button type="button" className="px-4 py-2 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 shadow-sm hover:shadow-md transition-all">
                {isAr ? "عروضي" : "My Decks"}
              </button>
            </Link>
          </header>
        )}

        <div className={`max-w-3xl mx-auto px-4 sm:px-6 ${mode === null ? "max-w-5xl" : ""}`}>
          
          {/* ── HERO HEADER FOR MODE PICKER ── */}
          {mode === null && (
            <div className="mb-8 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {isAr ? "رجوع" : "Back"}
                </button>
                <Link href="/teacher/presentations">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl"
                  >
                    {isAr ? "قائمة العروض" : "All decks"}
                  </button>
                </Link>
              </div>
              <div className="relative overflow-hidden rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B]">
                <div className="absolute top-0 start-1/2 -translate-x-1/2 w-[30rem] h-32 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center text-center gap-4 px-6 sm:px-10 py-10 sm:py-12">
                  <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800 rounded-full px-4 py-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-300 text-xs font-black tracking-wide">
                      {isAr ? "مدعوم بالذكاء الاصطناعي" : "AI-Powered"}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                    {isAr ? "إنشاء عرض تفاعلي جديد" : "Create Interactive Deck"}
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-md font-bold leading-relaxed">
                    {isAr
                      ? "اختر الوضع المناسب ودع الذكاء الاصطناعي يبني حصتك التعليمية كاملة في ثوانٍ."
                      : "Choose your mode and let AI build your complete lesson in seconds."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── MODE PICKER ── */}
          {mode === null && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Quick Mode */}
                <button
                  onClick={() => setMode("quick")}
                  className="group relative overflow-hidden rounded-3xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 p-6 sm:p-8 text-start transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="absolute top-0 start-0 w-32 h-32 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none transition-all group-hover:bg-emerald-400/20" />
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Zap className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
                      </div>
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/50">
                        {isAr ? "الأسرع" : "Fastest"}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-100 text-xl font-black mb-2">
                      {isAr ? "إنشاء سريع" : "Quick Mode"}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed mb-6 flex-1">
                      {isAr
                        ? "اكتب الموضوع فقط والذكاء الاصطناعي يبني الحصة كاملةً في ثوانٍ معدودة."
                        : "Write your topic only and AI builds the full lesson in seconds."}
                    </div>
                    <div className="flex flex-col gap-2.5 mb-6">
                      {(isAr
                        ? ["شرائح محتوى تلقائية", "أسئلة MCQ تفاعلية جاهزة", "استطلاع + جدار أفكار"]
                        : ["Auto-generated content slides", "Ready MCQ interactive questions", "Poll + word wall included"]
                      ).map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
                            <Check className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] text-emerald-600 dark:text-emerald-400 text-sm font-black px-5 py-3 rounded-xl group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 group-hover:gap-3 transition-all duration-200 self-start border border-emerald-100 dark:border-emerald-800/50">
                      {isAr ? "ابدأ الآن" : "Get started"}
                      {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Pro Studio */}
                <button
                  onClick={() => setMode("pro")}
                  className="group relative overflow-hidden rounded-3xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 p-6 sm:p-8 text-start transition-all duration-300 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="absolute top-0 start-0 w-32 h-32 rounded-full bg-slate-400/10 blur-3xl pointer-events-none transition-all group-hover:bg-slate-400/20" />
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Settings2 className="w-6 h-6 text-slate-600 dark:text-slate-400" strokeWidth={2} />
                      </div>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        {isAr ? "تحكم كامل" : "Full control"}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-100 text-xl font-black mb-2">
                      {isAr ? "استوديو المحترف" : "Pro Studio"}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed mb-6 flex-1">
                      {isAr
                        ? "راجع المخطط وعدّله قبل بناء الشرائح، مع محرر احترافي متقدم."
                        : "Review outline before building, with an advanced professional editor."}
                    </div>
                    <div className="flex flex-col gap-2.5 mb-6">
                      {(isAr
                        ? ["مراجعة المخطط قبل البناء", "تخصيص كامل للشرائح", "دعم المحتوى المتقدم"]
                        : ["Review outline before build", "Full slide customization", "Advanced content support"]
                      ).map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            <Check className="w-2.5 h-2.5 text-slate-500" strokeWidth={3} />
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#f4f7f5] dark:bg-[#0B100E] text-slate-600 dark:text-slate-300 text-sm font-black px-5 py-3 rounded-xl group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:gap-3 transition-all duration-200 self-start border border-slate-200 dark:border-slate-700/50">
                      {isAr ? "فتح الاستوديو" : "Open Studio"}
                      {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </div>
                  </div>
                </button>
              </div>

              {/* Import File */}
              <button
                onClick={() => setMode("import")}
                className="group w-full relative overflow-hidden rounded-3xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 p-5 sm:p-6 text-start transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-lg active:scale-[0.99]"
              >
                <div className="absolute inset-0 bg-emerald-50/50 dark:bg-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] flex items-center justify-center shrink-0 group-hover:scale-105 transition-all border border-emerald-100 dark:border-emerald-800/50">
                    <UploadCloud className="w-6 h-6 text-emerald-500" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-lg text-slate-800 dark:text-slate-100 mb-1">
                      {isAr ? "استيراد ملف أو رابط" : "Import File or Link"}
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isAr
                        ? `ارفع ${IMPORT_ACCEPT_LABEL_AR} ليتحول تلقائياً إلى عرض`
                        : `Upload ${IMPORT_ACCEPT_LABEL_EN} to convert it instantly`}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-sm font-black text-emerald-600 dark:text-emerald-400 group-hover:gap-2.5 transition-all duration-200">
                    {isAr ? "ابدأ" : "Start"}
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── QUICK MODE: FORM ── */}
          {mode === "quick" && quickPhase === "form" && (
            <motion.div 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                  <Sparkles className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {isAr ? "أخبرنا عن الدرس" : "Tell us about the lesson"}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                    {isAr
                      ? "سنبني المحتوى ونضيف الأنشطة التفاعلية نيابة عنك"
                      : "We'll build the content and add interactive activities for you"}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all">
                  <label className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400 mb-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    {isAr ? "موضوع الدرس *" : "Lesson topic *"}
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canGenerate) handleQuickGenerate();
                    }}
                    placeholder={
                      isAr
                        ? "مثال: دورة الماء في الطبيعة، الجهاز التنفسي..."
                        : "e.g. The water cycle, Solar system..."
                    }
                    className="w-full bg-transparent outline-none text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    maxLength={120}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all relative">
                    <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                      {isAr ? "الصف (اختياري)" : "Grade (optional)"}
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-slate-100 appearance-none cursor-pointer"
                    >
                      <option value="">
                        {isAr ? "— اختر الصف —" : "— Any grade —"}
                      </option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute end-4 bottom-4 pointer-events-none" />
                  </div>

                  <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all">
                    <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                      {isAr ? "المادة (اختياري)" : "Subject (optional)"}
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={isAr ? "علوم، رياضيات…" : "Science, Math…"}
                      className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Educational strategy selector */}
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-4 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all relative">
                  <label className="block text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
                    {isAr ? "الاستراتيجية التعليمية (اختياري)" : "Educational strategy (optional)"}
                  </label>
                  <select
                    value={educationalStrategy}
                    onChange={(e) => setEducationalStrategy(e.target.value as EducationalStrategy)}
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-slate-100 appearance-none cursor-pointer"
                    dir={isAr ? "rtl" : "ltr"}
                  >
                    {STRATEGY_ORDER.map((key) => (
                      <option key={key} value={key}>
                        {STRATEGIES_AR[key].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute end-4 top-10 pointer-events-none" />
                  
                  <AnimatePresence>
                    {educationalStrategy !== "none" && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="flex items-start gap-2 pt-3 border-t border-emerald-100 dark:border-emerald-900/50"
                      >
                        <Target className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                          {STRATEGIES_AR[educationalStrategy].desc}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* What you'll get */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-emerald-700/80 dark:text-emerald-400/80 justify-center">
                    {(isAr
                      ? [
                          "محتوى منظم تلقائيًا",
                          "أسئلة تفاعلية جاهزة",
                          "استطلاع وجدار أفكار",
                        ]
                      : [
                          "Auto-structured content",
                          "Interactive questions",
                          "Poll and word wall",
                        ]
                    ).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#15201B] rounded-xl shadow-sm border border-emerald-50 dark:border-emerald-900/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleQuickGenerate}
                  disabled={!canGenerate}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shadow-emerald-500/20 text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {isAr ? "أنشئ الحصة الآن" : "Generate lesson now"}
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

        {/* ── QUICK MODE: GENERATING ── */}
        {mode === "quick" && quickPhase === "generating" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-10 text-center"
          >
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 dark:bg-emerald-500/20 animate-pulse blur-xl" />
              <div className="relative w-28 h-28 rounded-full bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mb-3">
              {isAr ? "جارٍ بناء حصتك…" : "Building your lesson…"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold mb-2">{statusMsg}</p>
            <p className="text-xs font-bold text-slate-400 mt-6">
              {isAr
                ? "قد يستغرق هذا 30-60 ثانية"
                : "May take 30-60 seconds"}
            </p>
          </motion.div>
        )}

        {/* ── QUICK MODE: PREVIEW / DONE ── */}
        {mode === "quick" &&
          quickPhase === "preview" &&
          generatedPresentationId && (
            <motion.div 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-8 text-center"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mb-3">
                {isAr ? "حصتك جاهزة!" : "Your lesson is ready!"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-4">
                {isAr
                  ? "تم إنشاء عرض تفاعلي يتضمن أسئلة وأنشطة جاهزة."
                  : "Created an interactive deck with questions and ready-to-use activities."}
              </p>
              
              {educationalStrategy !== "none" && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 mb-5">
                  <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                  {STRATEGIES_AR[educationalStrategy].label}
                </div>
              )}
              
              <p className="text-xs font-bold text-slate-400 mb-6">
                {isAr
                  ? "يمكنك إطلاق الحصة مباشرةً أو تعديلها في المحرر المتقدم"
                  : "You can launch immediately or fine-tune in the advanced editor"}
              </p>

              {/* ── Inline rename prompt ── */}
              {!quickRenameConfirmed ? (
                <div className="mb-8 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-6 py-5 text-start shadow-sm">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">
                    {isAr ? "اسم العرض" : "Deck title"}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      type="text"
                      dir="auto"
                      value={quickRenameValue}
                      onChange={(e) => setQuickRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleQuickRename(); }}
                      disabled={quickRenameSaving}
                      className="flex-1 min-w-0 rounded-xl border border-emerald-100 dark:border-emerald-800/50 bg-white dark:bg-[#15201B] px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-400/10 focus:border-emerald-400 transition-all disabled:opacity-60"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleQuickRename()}
                        disabled={quickRenameSaving || !quickRenameValue.trim()}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20"
                      >
                        {quickRenameSaving
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Check className="w-4 h-4" />}
                        {isAr ? "حفظ" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickRenameConfirmed(true)}
                        disabled={quickRenameSaving}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 transition-all"
                      >
                        {isAr ? "تخطي" : "Skip"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-3 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-6 py-4 mb-8 shadow-sm">
                  <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-base font-black text-slate-800 dark:text-slate-100 truncate max-w-[280px] sm:max-w-md">{quickRenameValue || topic.trim()}</p>
                </div>
              )}

              {/* ── Slide thumbnail strip ── */}
              {generatedSlides.length > 0 && (
                <div className="mb-8">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-4 text-start">
                    {isAr ? "معاينة الشرائح المولّدة" : "Generated slides preview"}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {generatedSlides.map((sl, idx) => {
                      type IconMeta = { Icon: React.ElementType; bg: string; text: string };
                      const meta: Record<string, IconMeta> = {
                        poll:        { Icon: BarChart2,     bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30",    text: "text-blue-600 dark:text-blue-400" },
                        quiz:        { Icon: HelpCircle,    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30",  text: "text-amber-600 dark:text-amber-400" },
                        discussion:  { Icon: MessageSquare, bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
                        activity:    { Icon: Type,          bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
                      };
                      const { Icon, bg, text } = meta[sl.interactionHint ?? ""] ??
                        { Icon: Sparkles, bg: "bg-[#f4f7f5] dark:bg-[#0B100E] border-slate-200 dark:border-slate-800", text: "text-slate-500 dark:text-slate-400" };
                      return (
                        <div
                          key={idx}
                          className={`rounded-2xl border p-4 text-start flex flex-col items-start gap-3 shadow-sm ${bg}`}
                        >
                          <div className={`w-8 h-8 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center shrink-0`}>
                            <Icon className={`w-4 h-4 ${text}`} />
                          </div>
                          <div className="min-w-0 w-full">
                            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate leading-tight mb-1">{sl.title}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize">
                              {sl.interactionHint
                                ? (isAr
                                    ? { poll: "تصويت", quiz: "اختبار", discussion: "نقاش", activity: "نشاط" }[sl.interactionHint] ?? sl.interactionHint
                                    : sl.interactionHint)
                                : (isAr ? "محتوى" : sl.kind)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-emerald-50 dark:border-emerald-900/30">
                <button
                  onClick={handleLaunchNow}
                  disabled={launchLoading}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {launchLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Play className="w-5 h-5" />}
                  {isAr ? "إطلاق الحصة الآن" : "Launch lesson now"}
                </button>
                <button
                  onClick={() =>
                    setLocation(
                      `/teacher/presentations/${generatedPresentationId}`,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm active:scale-[0.98] transition-all"
                >
                  <Pencil className="w-4 h-4 text-slate-500" />
                  {isAr ? "تعديل في المحرر" : "Edit in Pro Studio"}
                </button>
              </div>

              <button
                onClick={() => {
                  setMode(null);
                  resetQuick();
                }}
                className="mt-6 text-xs font-bold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {isAr ? "إنشاء عرض آخر" : "Create another deck"}
              </button>
            </motion.div>
          )}

        {/* ── QUICK MODE: ERROR ── */}
        {mode === "quick" && quickPhase === "error" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm p-10 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black mb-3 text-slate-800 dark:text-slate-100">
              {isAr ? "حدث خطأ أثناء الإنشاء" : "Something went wrong"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mb-8 max-w-md mx-auto">{errorMsg}</p>
            <button
              onClick={() => setQuickPhase("form")}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm transition-all"
            >
              {isAr ? "المحاولة مرة أخرى" : "Try again"}
            </button>
          </motion.div>
        )}

        {/* ── IMPORT MODE: DROPZONE ── */}
        {mode === "import" && importPhase === "dropzone" && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
                <UploadCloud className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                  {isAr ? "ارفع ملفاً" : "Upload a file"}
                </h2>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                  {isAr ? IMPORT_ACCEPT_LABEL_AR : IMPORT_ACCEPT_LABEL_EN}
                </p>
              </div>
            </div>

            {/* Drag-and-drop zone */}
            <label
              htmlFor="import-file-input"
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImportDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleImportFile(file);
              }}
              className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-3xl p-10 cursor-pointer transition-all ${
                importDragOver
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 scale-[1.01]"
                  : "border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 bg-[#f4f7f5] dark:bg-[#0B100E]"
              }`}
            >
              <input
                id="import-file-input"
                type="file"
                accept={IMPORT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = "";
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 shadow-sm flex items-center justify-center">
                <UploadCloud className="w-8 h-8 text-emerald-500" strokeWidth={2} />
              </div>
              <div className="text-center">
                <p className="font-black text-base text-slate-800 dark:text-slate-100 mb-1">
                  {isAr
                    ? "اسحب الملف هنا أو انقر للاختيار"
                    : "Drag file here or click to browse"}
                </p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {isAr
                    ? IMPORT_ACCEPT_LABEL_AR
                    : IMPORT_ACCEPT_LABEL_EN}
                </p>
              </div>
            </label>

            {/* Format chips */}
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {[
                { icon: <FileText className="w-3.5 h-3.5" />, label: "PDF" },
                { icon: <Presentation className="w-3.5 h-3.5" />, label: "PPTX" },
                { icon: <File className="w-3.5 h-3.5" />, label: "DOCX" },
                { icon: <ImageIcon className="w-3.5 h-3.5" />, label: isAr ? "صور" : "Images" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-white dark:bg-[#15201B] text-slate-600 dark:text-slate-300 border border-emerald-50 dark:border-emerald-900/30 shadow-sm"
                >
                  {icon} {label}
                </span>
              ))}
            </div>

            {/* ── URL import separator ── */}
            <div className="flex items-center gap-3 mt-8 mb-6">
              <div className="flex-1 h-px bg-emerald-50 dark:bg-emerald-900/30" />
              <span className="text-xs text-slate-400 font-black px-1">
                {isAr ? "أو استورد من رابط" : "or import from a link"}
              </span>
              <div className="flex-1 h-px bg-emerald-50 dark:bg-emerald-900/30" />
            </div>

            {/* ── Google Slides URL input ── */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 transition-all rounded-2xl px-4 relative">
                   <input
                    type="url"
                    dir="ltr"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleImportUrl(); }}
                    placeholder="https://docs.google.com/presentation/d/..."
                    className="w-full py-3 bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  disabled={!importUrl.trim()}
                  onClick={handleImportUrl}
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20"
                >
                  {isAr ? "استيراد" : "Import"}
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-400 text-center">
                {isAr
                  ? "Google Slides العامة فقط — تأكد من تعيين المشاركة على «أي شخص لديه الرابط»"
                  : "Public Google Slides only — make sure sharing is set to \"Anyone with the link\""}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── IMPORT MODE: UPLOADING ── */}
        {mode === "import" && importPhase === "uploading" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-10 text-center"
          >
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 dark:bg-emerald-500/20 animate-pulse blur-xl" />
              <div className="relative w-28 h-28 rounded-full bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mb-3">
              {isAr ? "جارٍ قراءة المحتوى…" : "Reading content…"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold mb-2">
              {isAr
                ? "يتم استخراج النصوص والشرائح من ملفك"
                : "Extracting text and slides from your file"}
            </p>
            <p className="text-xs font-bold text-slate-400 mt-6">
              {isAr ? "قد يستغرق ذلك 15–60 ثانية" : "May take 15–60 seconds"}
            </p>
          </motion.div>
        )}

        {/* ── IMPORT MODE: MCQ REVIEW ── */}
        {mode === "import" && importPhase === "review" && importResult && (
          <McqReviewPanel
            isAr={isAr}
            questions={reviewQuestions}
            saving={reviewSaving}
            onConfirm={handleReviewConfirm}
            onSkip={() => handleReviewConfirm([])}
          />
        )}

        {/* ── IMPORT MODE: PREVIEW / DONE ── */}
        {mode === "import" && importPhase === "preview" && importResult && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-8 text-center"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 mb-6">
              {isAr ? "تم الاستيراد!" : "Import complete!"}
            </h2>

            {/* ── Inline rename prompt ── */}
            {!renameConfirmed ? (
              <div className="mb-8 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-6 py-5 text-start shadow-sm">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">
                  {isAr ? "اسم العرض" : "Deck title"}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input
                    type="text"
                    dir="auto"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleRename(); }}
                    disabled={renameSaving}
                    className="flex-1 min-w-0 rounded-xl border border-emerald-100 dark:border-emerald-800/50 bg-white dark:bg-[#15201B] px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-400/10 focus:border-emerald-400 transition-all disabled:opacity-60"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRename()}
                      disabled={renameSaving || !renameValue.trim()}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20"
                    >
                      {renameSaving
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Check className="w-4 h-4" />}
                      {isAr ? "حفظ" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameConfirmed(true)}
                      disabled={renameSaving}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 transition-all"
                    >
                      {isAr ? "تخطي" : "Skip"}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-2">
                  {isAr
                    ? "يمكنك تغيير الاسم الآن أو تخطي هذه الخطوة"
                    : "Rename it now or skip — you can always change it later"}
                </p>
              </div>
            ) : (
              /* After rename confirmed — show the final title */
              <div className="inline-flex items-center justify-center gap-3 bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-2xl px-6 py-4 mt-2 mb-8 shadow-sm">
                <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                <div className="text-start min-w-0">
                  <p className="text-base font-black text-slate-800 dark:text-slate-100 truncate max-w-[280px] sm:max-w-md mb-0.5">{importResult.title}</p>
                  {importResult.aiGenerated && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      {isAr ? "بتحسين AI" : "AI enriched"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {importResult.warning === "content_extraction_failed" && (
              <div className="mb-6 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-xl px-5 py-4 text-start text-sm text-amber-700 dark:text-amber-300 font-bold shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  {isAr
                    ? "تعذّر استخراج المحتوى تلقائياً — تم إنشاء عرض فارغ يمكنك تعديله في المحرر."
                    : "Content could not be extracted automatically — a blank deck was created. Edit it in the editor."}
                </span>
              </div>
            )}

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-8">
              {isAr
                ? "راجع وعدّل الشرائح في Pro Studio قبل الإطلاق"
                : "Review and edit slides in Pro Studio before launching"}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setLocation(`/teacher/presentations/${importResult.presentationId}`)}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-white shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                <Pencil className="w-5 h-5" />
                {isAr ? "تعديل في Pro Studio" : "Edit in Pro Studio"}
              </button>
            </div>

            <button
              onClick={() => { setMode(null); resetImport(); }}
              className="mt-6 text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors"
            >
              {isAr ? "استيراد ملف آخر" : "Import another file"}
            </button>
          </motion.div>
        )}

        {/* ── IMPORT MODE: ERROR ── */}
        {mode === "import" && importPhase === "error" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm p-10 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 flex items-center justify-center">
              <X className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black mb-3 text-slate-800 dark:text-slate-100">
              {isAr ? "فشل الاستيراد" : "Import failed"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mb-8 max-w-md mx-auto">{importErrorMsg}</p>
            <button
              onClick={resetImport}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm transition-all"
            >
              {isAr ? "المحاولة مرة أخرى" : "Try again"}
            </button>
          </motion.div>
        )}

        {/* ── PRO STUDIO — builder dialog ── */}
        {mode === "pro" && !proBuilderOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#15201B] rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm p-8 text-center"
          >
            <p className="text-slate-500 dark:text-slate-400 font-bold mb-6">
              {isAr
                ? "أغلق الحوار للعودة إلى قائمة الوضعَين"
                : "Close the dialog to return to mode selection"}
            </p>
            <button
              onClick={() => setProBuilderOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-white transition-all bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-[0.98]"
            >
              <Settings2 className="w-5 h-5" />
              {isAr ? "إعادة فتح الاستوديو" : "Reopen Studio"}
            </button>
          </motion.div>
        )}

        {mode === "pro" && (
          <AiPresentationBuilder
            open={proBuilderOpen}
            onOpenChange={(open) => {
              setProBuilderOpen(open);
              if (!open) setMode(null);
            }}
          />
        )}
        </div>
      </div>
    </Layout>
  );
}
