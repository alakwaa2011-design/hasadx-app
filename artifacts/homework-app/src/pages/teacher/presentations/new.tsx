import { useState, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { platformHarvestBg } from "@/lib/platform-harvest-bg";
import { AiPresentationBuilder } from "./builder";
import {
  Sparkles, Loader2, ArrowLeft, ArrowRight, Zap, Settings2,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Play, Pencil,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";

const GRADES = [
  "الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع",
  "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن",
  "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر",
];

type Mode = null | "quick" | "pro";
type QuickPhase = "form" | "generating" | "preview" | "error";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function NewPresentationPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const isAr = lang === "ar";

  const [mode, setMode] = useState<Mode>(null);
  const [quickPhase, setQuickPhase] = useState<QuickPhase>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [slideCount, setSlideCount] = useState(10);

  const [generatedPresentationId, setGeneratedPresentationId] = useState<number | null>(null);
  const [proBuilderOpen, setProBuilderOpen] = useState(false);

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
          slideCount,
          durationMinutes: 30,
          languageLevel: "medium",
          density: "balanced",
          toggles: { activities: true, questions: true, poll: true, quiz: true },
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
        body: JSON.stringify({ theme: "harvest", coverEmoji: "📚" }),
      });
      if (!r3.ok) {
        const e = await r3.json().catch(() => ({}));
        throw new Error(
          (e as { message?: string }).message ||
            (isAr ? "فشل بناء الشرائح" : "Build failed"),
        );
      }

      let presId: number | null = null;
      for (let i = 0; i < 120; i++) {
        await sleep(800);
        const rp = await fetch(`${API_BASE}/api/presentations/drafts/${draftId}`, {
          credentials: "include",
        });
        if (!rp.ok) continue;
        const pd = await rp.json() as { status: string; presentationId?: number; errorMessage?: string };
        if (pd.status === "built" && pd.presentationId) {
          presId = pd.presentationId;
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
      setQuickPhase("preview");
    } catch (err) {
      clearInterval(t);
      const msg =
        err instanceof Error ? err.message : isAr ? "حدث خطأ" : "Error";
      setErrorMsg(msg);
      setQuickPhase("error");
      toast.error(msg);
    }
  }, [topic, grade, subject, slideCount, isAr, canGenerate]);

  const resetQuick = () => {
    setQuickPhase("form");
    setTopic("");
    setGrade("");
    setSubject("");
    setSlideCount(10);
    setGeneratedPresentationId(null);
    setErrorMsg("");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Brand strip */}
        <div
          className="relative overflow-hidden rounded-2xl px-4 sm:px-5 py-3 sm:py-4 mb-6 shadow-md"
          style={{ background: platformHarvestBg(isAr) }}
        >
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/12 blur-2xl pointer-events-none" />
          <div
            className="absolute -bottom-10 -end-10 w-48 h-48 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: "rgba(212,175,55,0.35)" }}
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 relative z-[1] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
              {mode !== null && (
                <button
                  onClick={() => {
                    setMode(null);
                    setQuickPhase("form");
                    setProBuilderOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-white/80 text-xs font-bold mb-2 hover:text-white transition-colors"
                >
                  {isAr ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  )}
                  {isAr ? "اختيار الوضع" : "Choose mode"}
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight mb-1">
                {mode === "quick"
                  ? isAr
                    ? "⚡ الإنشاء السريع"
                    : "⚡ Quick Mode"
                  : mode === "pro"
                    ? isAr
                      ? "🎛 استوديو المحترف"
                      : "🎛 Pro Studio"
                    : isAr
                      ? "إنشاء عرض تفاعلي"
                      : "Create interactive deck"}
              </h1>
              <p className="text-white/85 text-xs sm:text-sm max-w-xl leading-relaxed line-clamp-2">
                {mode === "quick"
                  ? isAr
                    ? "ثلاث خطوات فقط — اكتب الموضوع واضغط أنشئ، والذكاء الاصطناعي يبني الحصة كاملةً."
                    : "Three steps only — write your topic and hit generate, AI builds the full lesson."
                  : mode === "pro"
                    ? isAr
                      ? "المحرر المتقدم — تحكم كامل في المخطط والشرائح والأنشطة."
                      : "Advanced editor — full control over outline, slides, and activities."
                    : isAr
                      ? "اختر الوضع المناسب وسيبني الذكاء الاصطناعي حصتك كاملةً."
                      : "Choose your mode and AI will build your complete lesson."}
              </p>
            </div>
            <Link
              href="/teacher/presentations"
              className="shrink-0 self-start sm:self-center"
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white text-[#1f5a3e] hover:bg-amber-50 px-3.5 py-2 rounded-lg text-sm font-bold shadow-md shadow-black/10 transition-colors"
              >
                {isAr ? "قائمة العروض" : "All decks"}
              </button>
            </Link>
          </div>
        </div>

        {/* ── MODE PICKER ── */}
        {mode === null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quick Mode */}
            <button
              onClick={() => setMode("quick")}
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent p-6 text-start transition-all hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-900/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400"
              style={{
                background:
                  "linear-gradient(135deg, #1a4731 0%, #225739 55%, #2d7a4f 100%)",
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(255,255,255,0.09),transparent_65%)] pointer-events-none" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-4 group-hover:bg-white/22 transition-colors">
                  <Zap className="w-6 h-6 text-amber-300" strokeWidth={2.5} />
                </div>
                <div className="text-white text-xl font-extrabold mb-1.5">
                  {isAr ? "إنشاء سريع ⚡" : "Quick Mode ⚡"}
                </div>
                <div className="text-white/75 text-sm leading-relaxed mb-4">
                  {isAr
                    ? "اكتب الموضوع فقط → الذكاء الاصطناعي يبني الحصة كاملةً في أقل من دقيقة"
                    : "Write your topic → AI builds the full lesson in under a minute"}
                </div>
                <div className="flex flex-col gap-1.5 mb-5">
                  {(isAr
                    ? [
                        "✓ شرائح محتوى تلقائية",
                        "✓ أسئلة MCQ تفاعلية جاهزة",
                        "✓ استطلاع + جدار أفكار",
                        "✓ جاهز للإطلاق فوراً",
                      ]
                    : [
                        "✓ Auto-generated content slides",
                        "✓ Ready MCQ interactive questions",
                        "✓ Poll + word wall included",
                        "✓ Launch-ready instantly",
                      ]
                  ).map((item) => (
                    <span key={item} className="text-[11px] text-white/65 font-medium">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 bg-amber-400 text-[#1a4731] text-sm font-extrabold px-4 py-2 rounded-xl group-hover:bg-amber-300 transition-colors">
                  {isAr ? "ابدأ الآن" : "Get started"}
                  {isAr ? (
                    <ArrowLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </button>

            {/* Pro Studio */}
            <button
              onClick={() => setMode("pro")}
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent p-6 text-start transition-all hover:border-slate-400/60 hover:shadow-xl hover:shadow-slate-900/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400"
              style={{
                background:
                  "linear-gradient(135deg, #1e293b 0%, #2d3748 55%, #374151 100%)",
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(217,165,33,0.13),transparent_65%)] pointer-events-none" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4 group-hover:bg-white/16 transition-colors">
                  <Settings2 className="w-6 h-6 text-amber-400" strokeWidth={2} />
                </div>
                <div className="text-white text-xl font-extrabold mb-1.5">
                  {isAr ? "استوديو المحترف 🎛" : "Pro Studio 🎛"}
                </div>
                <div className="text-white/75 text-sm leading-relaxed mb-4">
                  {isAr
                    ? "تحكم كامل — راجع المخطط وعدّله قبل بناء الشرائح، مع محرر احترافي"
                    : "Full control — review and edit the outline before building, with an advanced editor"}
                </div>
                <div className="flex flex-col gap-1.5 mb-5">
                  {(isAr
                    ? [
                        "✓ مراجعة المخطط قبل البناء",
                        "✓ تخصيص كامل للشرائح",
                        "✓ محرر متقدم بعد البناء",
                        "✓ دعم المحتوى المتقدم",
                      ]
                    : [
                        "✓ Review outline before build",
                        "✓ Full slide customization",
                        "✓ Advanced editor post-build",
                        "✓ Advanced content support",
                      ]
                  ).map((item) => (
                    <span key={item} className="text-[11px] text-white/65 font-medium">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-sm font-extrabold px-4 py-2 rounded-xl group-hover:bg-white/18 transition-colors">
                  {isAr ? "فتح الاستوديو" : "Open Studio"}
                  {isAr ? (
                    <ArrowLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
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

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  {isAr
                    ? `عدد الشرائح: ${slideCount}`
                    : `Slides: ${slideCount}`}
                </label>
                <input
                  type="range"
                  min={5}
                  max={15}
                  value={slideCount}
                  onChange={(e) =>
                    setSlideCount(parseInt(e.target.value, 10))
                  }
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>5</span>
                  <span>10</span>
                  <span>15</span>
                </div>
              </div>

              {/* What you'll get */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-2xl p-4">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  {isAr ? "ستحصل على:" : "You'll get:"}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {(isAr
                    ? [
                        `${slideCount} شريحة`,
                        "أسئلة MCQ تفاعلية",
                        "استطلاع + جدار أفكار",
                        "جاهز للإطلاق فوراً",
                      ]
                    : [
                        `${slideCount} slides`,
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
                  ? `تم إنشاء عرض تفاعلي بـ ${slideCount} شريحة تتضمن أسئلة وأنشطة جاهزة.`
                  : `Created an interactive ${slideCount}-slide deck with questions and ready-to-use activities.`}
              </p>
              <p className="text-xs text-muted-foreground/70 mb-8">
                {isAr
                  ? "يمكنك إطلاق الحصة مباشرةً أو تعديلها في المحرر المتقدم"
                  : "You can launch immediately or fine-tune in the advanced editor"}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() =>
                    setLocation(
                      `/teacher/presentations/${generatedPresentationId}`,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-extrabold text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #2d7a4f 100%)`,
                  }}
                >
                  <Play className="w-5 h-5" />
                  {isAr ? "إطلاق الحصة الآن" : "Launch lesson now"}
                </button>
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
