import { useState, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { platformHarvestBg } from "@/lib/platform-harvest-bg";
import { AiPresentationBuilder } from "./builder";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  Sparkles, Loader2, ArrowLeft, ArrowRight, Zap, Settings2,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Play, Pencil,
  MessageSquare, HelpCircle, BarChart2, Type,
  UploadCloud, FileText, X, Trash2, Plus, Check,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";

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
    <div className="bg-card rounded-3xl border border-border shadow-lg p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-0.5">
            {isAr ? "راجع الأسئلة التلقائية" : "Review AI-generated questions"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "الذكاء الاصطناعي اقترح هذه الأسئلة بناءً على محتوى ملفك. عدّل أو احذف ما تريد ثم احفظ."
              : "AI suggested these questions based on your file's content. Edit or delete as needed, then save."}
          </p>
        </div>
      </div>

      {/* Question cards */}
      <div className="flex flex-col gap-5 mb-7">
        {questions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isAr ? "لا توجد أسئلة — سيتم تخطّيها." : "No questions left — they'll be skipped."}
          </div>
        ) : (
          questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="rounded-2xl border border-border bg-muted/20 p-4 flex flex-col gap-3"
            >
              {/* Question header */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {isAr ? `السؤال ${qIdx + 1}` : `Question ${qIdx + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => deleteQuestion(qIdx)}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                  title={isAr ? "حذف السؤال" : "Delete question"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isAr ? "حذف" : "Delete"}
                </button>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted-foreground">
                  {isAr ? "نص السؤال" : "Question text"}
                </label>
                <textarea
                  dir={isAr ? "rtl" : "ltr"}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground">
                  {isAr ? "الخيارات (اضغط على الخيار الصحيح)" : "Options (click to mark as correct)"}
                </label>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          q.correctIndex === oIdx
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border hover:border-emerald-400"
                        }`}
                        title={isAr ? "تعيين كإجابة صحيحة" : "Mark as correct"}
                      >
                        {q.correctIndex === oIdx && <Check className="w-3 h-3" />}
                      </button>
                      <input
                        type="text"
                        dir={isAr ? "rtl" : "ltr"}
                        value={opt}
                        onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                        placeholder={isAr ? `الخيار ${oIdx + 1}` : `Option ${oIdx + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(qIdx, oIdx)}
                          className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
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
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAr ? "إضافة خيار" : "Add option"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50 disabled:opacity-50 transition-all"
        >
          {isAr ? "تخطّي الأسئلة" : "Skip questions"}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(questions)}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold text-white shadow disabled:opacity-60 hover:opacity-90 active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(135deg, #225739 0%, #2d7a4f 100%)" }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isAr
            ? `حفظ ${questions.length > 0 ? `${questions.length} أسئلة` : ""}`.trim()
            : `Save${questions.length > 0 ? ` ${questions.length} question${questions.length !== 1 ? "s" : ""}` : ""}`}
        </button>
      </div>
    </div>
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
      <div className={mode === null ? "max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10" : "max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10"}>
        {/* ── HERO HEADER ── */}
        {mode === null ? (
          /* Full hero for mode picker */
          <div className="mb-8 space-y-3">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {isAr ? "رجوع" : "Back"}
            </button>
            <div
              className="relative overflow-hidden rounded-3xl shadow-2xl"
              style={{ background: platformHarvestBg(isAr) }}
            >
              {/* Decorative blobs */}
              <div className="absolute -top-16 -start-16 w-64 h-64 rounded-full bg-white/8 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -end-16 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: "rgba(212,175,55,0.28)" }} />
              <div className="absolute top-0 start-1/2 -translate-x-1/2 w-96 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-white/15 pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 sm:px-10 py-8 sm:py-10">
                <div className="text-center sm:text-start [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
                  <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-3 py-1 mb-4">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-white/90 text-xs font-bold tracking-wide">
                      {isAr ? "مدعوم بالذكاء الاصطناعي" : "AI-Powered"}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-2">
                    {isAr ? "إنشاء عرض تفاعلي" : "Create Interactive Deck"}
                  </h1>
                  <p className="text-white/75 text-sm sm:text-base max-w-sm leading-relaxed">
                    {isAr
                      ? "اختر الوضع المناسب وسيبني الذكاء الاصطناعي حصتك كاملةً."
                      : "Choose your mode and AI will build your complete lesson."}
                  </p>
                </div>
                <Link href="/teacher/presentations" className="shrink-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-colors backdrop-blur-sm"
                  >
                    {isAr ? "قائمة العروض" : "All decks"}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Compact strip for sub-modes */
          <div
            className="relative overflow-hidden rounded-2xl px-4 sm:px-5 py-3 sm:py-4 mb-6 shadow-md"
            style={{ background: platformHarvestBg(isAr) }}
          >
            <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/12 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -end-10 w-48 h-48 rounded-full blur-2xl pointer-events-none" style={{ backgroundColor: "rgba(212,175,55,0.35)" }} />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1 relative z-[1] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
                <button
                  onClick={() => { setMode(null); setQuickPhase("form"); setProBuilderOpen(false); resetImport(); }}
                  className="inline-flex items-center gap-1.5 text-white/80 text-xs font-bold mb-2 hover:text-white transition-colors"
                >
                  {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  {isAr ? "اختيار الوضع" : "Choose mode"}
                </button>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight mb-1">
                  {mode === "quick"
                    ? isAr ? "⚡ الإنشاء السريع" : "⚡ Quick Mode"
                    : mode === "pro"
                      ? isAr ? "🎛 استوديو المحترف" : "🎛 Pro Studio"
                      : isAr ? "📂 استيراد ملف" : "📂 Import File"}
                </h1>
                <p className="text-white/85 text-xs sm:text-sm max-w-xl leading-relaxed line-clamp-2">
                  {mode === "quick"
                    ? isAr ? "ثلاث خطوات فقط — اكتب الموضوع واضغط أنشئ، والذكاء الاصطناعي يبني الحصة كاملةً." : "Three steps only — write your topic and hit generate, AI builds the full lesson."
                    : mode === "pro"
                      ? isAr ? "المحرر المتقدم — تحكم كامل في المخطط والشرائح والأنشطة." : "Advanced editor — full control over outline, slides, and activities."
                      : isAr ? "ارفع ملفاً وحوّله تلقائياً إلى عرض تفاعلي جاهز للإطلاق." : "Upload a file and convert it into a ready-to-launch interactive deck."}
                </p>
              </div>
              <Link href="/teacher/presentations" className="shrink-0 self-start sm:self-center">
                <button type="button" className="inline-flex items-center gap-2 bg-white text-[#1f5a3e] hover:bg-amber-50 px-3.5 py-2 rounded-lg text-sm font-bold shadow-md shadow-black/10 transition-colors">
                  {isAr ? "قائمة العروض" : "All decks"}
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── MODE PICKER ── */}
        {mode === null && (
          <div className="space-y-4">
            {/* Two primary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Quick Mode */}
              <button
                onClick={() => setMode("quick")}
                className="group relative overflow-hidden rounded-3xl border-2 border-transparent p-7 sm:p-9 text-start transition-all duration-300 hover:border-emerald-400/50 hover:shadow-2xl hover:shadow-emerald-900/25 hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                style={{ background: "linear-gradient(150deg, #12382a 0%, #1a4d38 40%, #225739 70%, #2d7a50 100%)" }}
              >
                {/* Shine overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_15%,rgba(255,255,255,0.11),transparent_60%)] pointer-events-none" />
                <div className="absolute bottom-0 start-0 w-48 h-48 rounded-full bg-amber-400/8 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mb-5 group-hover:bg-amber-400/30 group-hover:scale-105 transition-all duration-300">
                    <Zap className="w-7 h-7 text-amber-300" strokeWidth={2.5} />
                  </div>
                  {/* Badge */}
                  <div className="inline-flex self-start items-center gap-1.5 bg-amber-400/20 border border-amber-400/30 rounded-full px-2.5 py-0.5 mb-3">
                    <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      {isAr ? "الأسرع" : "Fastest"}
                    </span>
                  </div>
                  <div className="text-white text-2xl font-extrabold mb-2 leading-tight">
                    {isAr ? "إنشاء سريع" : "Quick Mode"}
                    <span className="ms-2 text-xl">⚡</span>
                  </div>
                  <div className="text-white/70 text-sm leading-relaxed mb-6 flex-1">
                    {isAr
                      ? "اكتب الموضوع فقط → الذكاء الاصطناعي يبني الحصة كاملةً في أقل من دقيقة"
                      : "Write your topic only → AI builds the full lesson in under a minute"}
                  </div>
                  <div className="flex flex-col gap-2 mb-7">
                    {(isAr
                      ? ["شرائح محتوى تلقائية", "أسئلة MCQ تفاعلية جاهزة", "استطلاع + جدار أفكار", "جاهز للإطلاق فوراً"]
                      : ["Auto-generated content slides", "Ready MCQ interactive questions", "Poll + word wall included", "Launch-ready instantly"]
                    ).map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-400/30 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-300" strokeWidth={3} />
                        </div>
                        <span className="text-[12px] text-white/70 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 bg-amber-400 text-[#1a4731] text-sm font-extrabold px-5 py-2.5 rounded-2xl group-hover:bg-amber-300 group-hover:gap-3 transition-all duration-200 self-start">
                    {isAr ? "ابدأ الآن" : "Get started"}
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Pro Studio */}
              <button
                onClick={() => setMode("pro")}
                className="group relative overflow-hidden rounded-3xl border-2 border-transparent p-7 sm:p-9 text-start transition-all duration-300 hover:border-slate-400/40 hover:shadow-2xl hover:shadow-slate-900/30 hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-400"
                style={{ background: "linear-gradient(150deg, #0f172a 0%, #1e293b 40%, #2d3748 75%, #374151 100%)" }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_15%,rgba(217,165,33,0.14),transparent_60%)] pointer-events-none" />
                <div className="absolute bottom-0 end-0 w-48 h-48 rounded-full bg-amber-400/6 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5 group-hover:bg-white/18 group-hover:scale-105 transition-all duration-300">
                    <Settings2 className="w-7 h-7 text-amber-400" strokeWidth={2} />
                  </div>
                  <div className="inline-flex self-start items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 mb-3">
                    <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
                      {isAr ? "تحكم كامل" : "Full control"}
                    </span>
                  </div>
                  <div className="text-white text-2xl font-extrabold mb-2 leading-tight">
                    {isAr ? "استوديو المحترف" : "Pro Studio"}
                    <span className="ms-2 text-xl">🎛</span>
                  </div>
                  <div className="text-white/70 text-sm leading-relaxed mb-6 flex-1">
                    {isAr
                      ? "تحكم كامل — راجع المخطط وعدّله قبل بناء الشرائح، مع محرر احترافي متقدم"
                      : "Full control — review and edit the outline before building, with an advanced editor"}
                  </div>
                  <div className="flex flex-col gap-2 mb-7">
                    {(isAr
                      ? ["مراجعة المخطط قبل البناء", "تخصيص كامل للشرائح", "محرر متقدم بعد البناء", "دعم المحتوى المتقدم"]
                      : ["Review outline before build", "Full slide customization", "Advanced editor post-build", "Advanced content support"]
                    ).map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-amber-400/25 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-amber-300" strokeWidth={3} />
                        </div>
                        <span className="text-[12px] text-white/70 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 bg-white/12 border border-white/20 text-white text-sm font-extrabold px-5 py-2.5 rounded-2xl group-hover:bg-white/20 group-hover:gap-3 transition-all duration-200 self-start">
                    {isAr ? "فتح الاستوديو" : "Open Studio"}
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </div>
                </div>
              </button>
            </div>

            {/* Import File — full-width accent card */}
            <button
              onClick={() => setMode("import")}
              className="group w-full relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-card hover:bg-muted/40 p-5 sm:p-6 text-start transition-all duration-200 hover:shadow-lg hover:border-blue-400/50 active:scale-[0.995] focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(59,130,246,0.05),transparent_70%)] pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity" />
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center shrink-0 group-hover:bg-blue-200/80 group-hover:scale-105 transition-all duration-300 border border-blue-200/50 dark:border-blue-800/50">
                  <UploadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-base mb-0.5 flex items-center gap-2">
                    {isAr ? "استيراد ملف" : "Import File"}
                    <span className="text-base">📂</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {isAr
                      ? `ارفع ${IMPORT_ACCEPT_LABEL_AR} — يُحوَّل تلقائياً إلى عرض تفاعلي كامل`
                      : `Upload ${IMPORT_ACCEPT_LABEL_EN} — auto-converted to a full interactive deck`}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:gap-2.5 transition-all duration-200">
                  {isAr ? "ابدأ" : "Start"}
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── QUICK MODE: FORM ── */}
        {mode === "quick" && quickPhase === "form" && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isAr ? "أخبرنا عن الدرس" : "Tell us about the lesson"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "ثلاثة حقول فقط — الباقي على الذكاء الاصطناعي"
                    : "Three fields only — the rest is on AI"}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
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
                      ? "مثال: دورة الماء في الطبيعة"
                      : "e.g. The water cycle"
                  }
                  className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30 text-base"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {isAr ? "الصف (اختياري)" : "Grade (optional)"}
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">
                      {isAr ? "— اختر الصف —" : "— Any grade —"}
                    </option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {isAr ? "المادة (اختياري)" : "Subject (optional)"}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isAr ? "علوم، رياضيات…" : "Science, Math…"}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* ── Educational strategy selector ── */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  {isAr ? "الاستراتيجية التعليمية (اختياري)" : "Educational strategy (optional)"}
                </label>
                <select
                  value={educationalStrategy}
                  onChange={(e) => setEducationalStrategy(e.target.value as EducationalStrategy)}
                  className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  dir={isAr ? "rtl" : "ltr"}
                >
                  {STRATEGY_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {STRATEGIES_AR[key].label}
                    </option>
                  ))}
                </select>
                {educationalStrategy !== "none" && (
                  <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/50 dark:border-emerald-800/40">
                    <span className="mt-0.5 text-emerald-600 dark:text-emerald-400 text-base leading-none shrink-0">🎯</span>
                    <p className="text-[12px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      {STRATEGIES_AR[educationalStrategy].desc}
                    </p>
                  </div>
                )}
              </div>

              {/* What you'll get */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-2xl p-4">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  {isAr ? "ستحصل على:" : "You'll get:"}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {(isAr
                    ? [
                        "محتوى منظم تلقائيًا",
                        "أسئلة MCQ تفاعلية",
                        "استطلاع + جدار أفكار",
                        "جاهز للإطلاق فوراً",
                      ]
                    : [
                        "Auto-structured content",
                        "MCQ interactive questions",
                        "Poll + word wall",
                        "Launch-ready instantly",
                      ]
                  ).map((item, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-emerald-500">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleQuickGenerate}
              disabled={!canGenerate}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-lg disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg text-white"
              style={{
                background: canGenerate
                  ? `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7a4f 100%)`
                  : "#94a3b8",
              }}
            >
              <Sparkles className="w-5 h-5" />
              {isAr ? "أنشئ الحصة الآن" : "Generate lesson now"}
            </button>
          </div>
        )}

        {/* ── QUICK MODE: GENERATING ── */}
        {mode === "quick" && quickPhase === "generating" && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-10 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-amber-400 animate-pulse opacity-40 blur-xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {isAr ? "جارٍ بناء حصتك…" : "Building your lesson…"}
            </h2>
            <p className="text-muted-foreground mb-1">{statusMsg}</p>
            <p className="text-xs text-muted-foreground/70 mt-4">
              {isAr
                ? "قد يستغرق هذا 30-60 ثانية"
                : "May take 30-60 seconds"}
            </p>
          </div>
        )}

        {/* ── QUICK MODE: PREVIEW / DONE ── */}
        {mode === "quick" &&
          quickPhase === "preview" &&
          generatedPresentationId && (
            <div className="bg-card rounded-3xl border border-border shadow-lg p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {isAr ? "حصتك جاهزة! 🎉" : "Your lesson is ready! 🎉"}
              </h2>
              <p className="text-muted-foreground text-sm mb-2">
                {isAr
                  ? "تم إنشاء عرض تفاعلي يتضمن أسئلة وأنشطة جاهزة."
                  : "Created an interactive deck with questions and ready-to-use activities."}
              </p>
              {educationalStrategy !== "none" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
                     style={{ background: "rgba(34,87,57,0.1)", color: BRAND_GREEN }}>
                  🎯 {STRATEGIES_AR[educationalStrategy].label}
                </div>
              )}
              <p className="text-xs text-muted-foreground/70 mb-4">
                {isAr
                  ? "يمكنك إطلاق الحصة مباشرةً أو تعديلها في المحرر المتقدم"
                  : "You can launch immediately or fine-tune in the advanced editor"}
              </p>

              {/* ── Inline rename prompt ── */}
              {!quickRenameConfirmed ? (
                <div className="mb-6 bg-muted/40 border border-border rounded-2xl px-5 py-4 text-start">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {isAr ? "اسم العرض" : "Deck title"}
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      dir="auto"
                      value={quickRenameValue}
                      onChange={(e) => setQuickRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleQuickRename(); }}
                      disabled={quickRenameSaving}
                      className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all disabled:opacity-60"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleQuickRename()}
                      disabled={quickRenameSaving || !quickRenameValue.trim()}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50 disabled:opacity-40 transition-all"
                    >
                      {isAr ? "تخطي" : "Skip"}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                    {isAr
                      ? "يمكنك تغيير الاسم الآن أو تخطي هذه الخطوة"
                      : "Rename it now or skip — you can always change it later"}
                  </p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-3 bg-muted/40 border border-border rounded-2xl px-5 py-3 mb-6">
                  <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm font-bold truncate max-w-[220px]">{quickRenameValue || topic.trim()}</p>
                </div>
              )}

              {/* ── Slide thumbnail strip ── */}
              {generatedSlides.length > 0 && (
                <div className="mb-8">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 text-start">
                    {isAr ? "معاينة الشرائح المولّدة" : "Generated slides preview"}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {generatedSlides.map((sl, idx) => {
                      /* Pick icon + colour by interaction type */
                      type IconMeta = { Icon: React.ElementType; bg: string; text: string };
                      const meta: Record<string, IconMeta> = {
                        poll:        { Icon: BarChart2,     bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-600" },
                        quiz:        { Icon: HelpCircle,    bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-600" },
                        discussion:  { Icon: MessageSquare, bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600" },
                        activity:    { Icon: Type,          bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600" },
                      };
                      const { Icon, bg, text } = meta[sl.interactionHint ?? ""] ??
                        { Icon: Sparkles, bg: "bg-muted/30", text: "text-muted-foreground" };
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border border-border p-3 text-start flex items-start gap-2 ${bg}`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${text}`} />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold truncate leading-tight">{sl.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
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

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* PRIMARY: creates a live session and opens the control panel.
                    Distinct from "Edit" — the two buttons lead to different routes. */}
                <button
                  onClick={handleLaunchNow}
                  disabled={launchLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-extrabold text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7a4f 100%)`,
                  }}
                >
                  {launchLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Play className="w-5 h-5" />}
                  {isAr ? "إطلاق الحصة الآن" : "Launch lesson now"}
                </button>
                {/* SECONDARY: opens the full editor (Pro Studio) for tweaks. */}
                <button
                  onClick={() =>
                    setLocation(
                      `/teacher/presentations/${generatedPresentationId}`,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold border border-border hover:bg-muted/50 active:scale-[0.98] transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  {isAr ? "تعديل في Pro Studio 🎛" : "Edit in Pro Studio 🎛"}
                </button>
              </div>

              <button
                onClick={() => {
                  setMode(null);
                  resetQuick();
                }}
                className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isAr ? "إنشاء عرض آخر" : "Create another deck"}
              </button>
            </div>
          )}

        {/* ── QUICK MODE: ERROR ── */}
        {mode === "quick" && quickPhase === "error" && (
          <div className="bg-card rounded-3xl border border-red-200 dark:border-red-900/50 shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-red-700 dark:text-red-400">
              {isAr ? "حدث خطأ" : "Something went wrong"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>
            <button
              onClick={() => setQuickPhase("form")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border border-border hover:bg-muted/50 transition-all"
            >
              {isAr ? "حاول مجدداً" : "Try again"}
            </button>
          </div>
        )}

        {/* ── IMPORT MODE: DROPZONE ── */}
        {mode === "import" && importPhase === "dropzone" && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isAr ? "ارفع ملفاً" : "Upload a file"}
                </h2>
                <p className="text-xs text-muted-foreground">
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
              className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
                importDragOver
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
                  : "border-border hover:border-blue-400/70 hover:bg-blue-50/20 dark:hover:bg-blue-950/10"
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
              <div className="w-16 h-16 rounded-2xl bg-blue-100/80 dark:bg-blue-950/50 flex items-center justify-center">
                <UploadCloud className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-bold text-base mb-1">
                  {isAr
                    ? "اسحب الملف هنا أو انقر للاختيار"
                    : "Drag file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? IMPORT_ACCEPT_LABEL_AR
                    : IMPORT_ACCEPT_LABEL_EN}
                </p>
              </div>
            </label>

            {/* Format chips */}
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {[
                { icon: "📄", label: "PDF" },
                { icon: "📊", label: "PPTX" },
                { icon: "📝", label: "DOCX" },
                { icon: "🖼️", label: isAr ? "صور" : "Images" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground border border-border"
                >
                  {icon} {label}
                </span>
              ))}
            </div>

            {/* ── URL import separator ── */}
            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium px-1">
                {isAr ? "أو استورد من رابط" : "or import from a link"}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* ── Google Slides URL input ── */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleImportUrl(); }}
                  placeholder="https://docs.google.com/presentation/d/..."
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  disabled={!importUrl.trim()}
                  onClick={handleImportUrl}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isAr ? "استيراد" : "Import"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/70 text-center">
                {isAr
                  ? "Google Slides العامة فقط — تأكد من تعيين المشاركة على «أي شخص لديه الرابط»"
                  : "Public Google Slides only — make sure sharing is set to \"Anyone with the link\""}
              </p>
            </div>
          </div>
        )}

        {/* ── IMPORT MODE: UPLOADING ── */}
        {mode === "import" && importPhase === "uploading" && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-10 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 animate-pulse opacity-40 blur-xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {isAr ? "جارٍ قراءة المحتوى…" : "Reading content…"}
            </h2>
            <p className="text-muted-foreground text-sm mb-1">
              {isAr
                ? "يتم استخراج النصوص والشرائح من ملفك"
                : "Extracting text and slides from your file"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-4">
              {isAr ? "قد يستغرق ذلك 15–60 ثانية" : "May take 15–60 seconds"}
            </p>
          </div>
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
          <div className="bg-card rounded-3xl border border-border shadow-lg p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {isAr ? "تم الاستيراد! 🎉" : "Import complete! 🎉"}
            </h2>

            {/* ── Inline rename prompt ── */}
            {!renameConfirmed ? (
              <div className="mt-4 mb-5 bg-muted/40 border border-border rounded-2xl px-5 py-4 text-start">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {isAr ? "اسم العرض" : "Deck title"}
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    dir="auto"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleRename(); }}
                    disabled={renameSaving}
                    className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all disabled:opacity-60"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename()}
                    disabled={renameSaving || !renameValue.trim()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50 disabled:opacity-40 transition-all"
                  >
                    {isAr ? "تخطي" : "Skip"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                  {isAr
                    ? "يمكنك تغيير الاسم الآن أو تخطي هذه الخطوة"
                    : "Rename it now or skip — you can always change it later"}
                </p>
              </div>
            ) : (
              /* After rename confirmed — show the final title */
              <div className="inline-flex items-center gap-3 bg-muted/40 border border-border rounded-2xl px-5 py-3 mt-4 mb-5">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="text-start min-w-0">
                  <p className="text-sm font-bold truncate max-w-[220px]">{importResult.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {importResult.aiGenerated && (
                      <span className="ms-2 inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Sparkles className="w-3 h-3" />
                        {isAr ? "بتحسين AI" : "AI enriched"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {importResult.warning === "content_extraction_failed" && (
              <div className="mb-5 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-xl px-4 py-3 text-start text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {isAr
                    ? "تعذّر استخراج المحتوى تلقائياً — تم إنشاء عرض فارغ يمكنك تعديله في المحرر."
                    : "Content could not be extracted automatically — a blank deck was created. Edit it in the editor."}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground/70 mb-8">
              {isAr
                ? "راجع وعدّل الشرائح في Pro Studio قبل الإطلاق"
                : "Review and edit slides in Pro Studio before launching"}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setLocation(`/teacher/presentations/${importResult.presentationId}`)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-extrabold text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
                style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7a4f 100%)` }}
              >
                <Pencil className="w-4 h-4" />
                {isAr ? "تعديل في Pro Studio 🎛" : "Edit in Pro Studio 🎛"}
              </button>
            </div>

            <button
              onClick={() => { setMode(null); resetImport(); }}
              className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isAr ? "استيراد ملف آخر" : "Import another file"}
            </button>
          </div>
        )}

        {/* ── IMPORT MODE: ERROR ── */}
        {mode === "import" && importPhase === "error" && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-red-700 dark:text-red-400">
              {isAr ? "فشل الاستيراد" : "Import failed"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">{importErrorMsg}</p>
            <button
              onClick={resetImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border border-border hover:bg-muted/50 transition-all"
            >
              {isAr ? "حاول مجدداً" : "Try again"}
            </button>
          </div>
        )}

        {/* ── PRO STUDIO — builder dialog ── */}
        {mode === "pro" && !proBuilderOpen && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {isAr
                ? "أغلق الحوار للعودة إلى قائمة الوضعَين"
                : "Close the dialog to return to mode selection"}
            </p>
            <button
              onClick={() => setProBuilderOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all hover:opacity-90"
              style={{ background: BRAND_GREEN }}
            >
              <Settings2 className="w-4 h-4" />
              {isAr ? "إعادة فتح الاستوديو" : "Reopen Studio"}
            </button>
          </div>
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
    </Layout>
  );
}
