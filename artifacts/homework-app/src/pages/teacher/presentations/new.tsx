import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { platformHarvestBg } from "@/lib/platform-harvest-bg";
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Wand2,
  Palette,
  Settings2,
  CheckCircle2,
  Bot,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const THEMES: { key: string; labelAr: string; labelEn: string; grad: string | null }[] = [
  { key: "harvest", labelAr: "الحصاد", labelEn: "Harvest", grad: null },
  { key: "ocean", labelAr: "المحيط", labelEn: "Ocean", grad: "from-sky-500 via-blue-600 to-indigo-600" },
  { key: "sunset", labelAr: "الغروب", labelEn: "Sunset", grad: "from-amber-400 via-orange-500 to-rose-500" },
  { key: "midnight", labelAr: "منتصف الليل", labelEn: "Midnight", grad: "from-slate-700 via-indigo-900 to-purple-900" },
  { key: "rose", labelAr: "الوردي", labelEn: "Rose", grad: "from-rose-400 via-pink-500 to-fuchsia-600" },
];

const EMOJIS = ["📚", "🌱", "🧪", "🌍", "🧮", "📐", "🎨", "🎵", "📖", "🔬", "🚀", "🏛️", "💡", "✨", "🌟", "🎯", "🧩", "📊"];

const GRADES = [
  "الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس",
  "الصف السابع", "الصف الثامن", "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر",
];

export default function NewPresentationPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [outline, setOutline] = useState("");
  const [includeQuizzes, setIncludeQuizzes] = useState(true);
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeDiscussion, setIncludeDiscussion] = useState(true);

  const [theme, setTheme] = useState<string>("ai");
  const [coverEmoji, setCoverEmoji] = useState("📚");

  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [availableTiers, setAvailableTiers] = useState<("standard" | "pro")[]>(["standard"]);
  const [selectedTier, setSelectedTier] = useState<"standard" | "pro">("standard");

  useEffect(() => {
    fetch(`${API_BASE}/api/presentations/ai-options`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tiers && Array.isArray(data.tiers)) {
          const tiers = data.tiers.filter((t: string) => t === "standard" || t === "pro");
          setAvailableTiers(tiers);
          if (tiers.includes("pro")) setSelectedTier("pro");
        }
      })
      .catch(() => { /* fall back to standard */ });
  }, []);

  const canStep2 = title.trim().length >= 2;

  const handleGenerate = async () => {
    setGenerating(true);
    setStep(3);
    setStatusMsg(lang === "ar" ? "جاري التفكير في خطة الدرس…" : "Planning the lesson…");

    /* Cycle through nice status messages while waiting. */
    const messages = lang === "ar"
      ? ["جاري التفكير في خطة الدرس…", "إعداد الشرائح والأنشطة…", "تصميم الأسئلة التفاعلية…", "اللمسات الأخيرة…"]
      : ["Planning the lesson…", "Preparing slides & activities…", "Designing interactive questions…", "Final touches…"];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % messages.length;
      setStatusMsg(messages[i]);
    }, 3500);

    try {
      const r = await fetch(`${API_BASE}/api/presentations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim() || null,
          gradeLevel: gradeLevel || null,
          slideCount,
          lessonOutline: outline.trim() || null,
          includeQuizzes,
          includeActivities,
          includeDiscussion,
          language: "ar",
          tier: selectedTier,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Generation failed");
      }
      const gen = await r.json();
      setStatusMsg(lang === "ar" ? "حفظ العرض…" : "Saving…");

      // When "ai" mode: use AI-suggested theme from generation, fallback to "harvest"
      const effectiveTheme =
        theme === "ai" ? (gen.theme ?? "harvest") : theme;

      const saveRes = await fetch(`${API_BASE}/api/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim() || null,
          gradeLevel: gradeLevel || null,
          theme: effectiveTheme,
          coverEmoji: gen.coverEmoji || coverEmoji,
          description: gen.description || null,
          slides: gen.slides,
        }),
      });
      if (!saveRes.ok) throw new Error("Save failed");
      const saved = await saveRes.json();
      clearInterval(timer);
      toast.success(lang === "ar" ? "تم إنشاء العرض!" : "Created!");
      setLocation(`/teacher/presentations/${saved.presentation.id}`);
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
      setGenerating(false);
      setStep(2);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Brand strip — same identity as list & dashboard */}
        <div
          className="relative overflow-hidden rounded-2xl px-4 sm:px-5 py-3 sm:py-4 mb-6 shadow-md"
          style={{ background: platformHarvestBg(lang === "ar") }}
        >
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/12 blur-2xl pointer-events-none" />
          <div
            className="absolute -bottom-10 -end-10 w-48 h-48 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: "rgba(212, 175, 55, 0.35)" }}
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 relative z-[1] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
              <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-[10px] sm:text-xs font-bold mb-2 ring-1 ring-white/25">
                <Sparkles className="w-2.5 h-2.5" />
                {lang === "ar" ? "جديد · ذكاء اصطناعي" : "New · AI"}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight mb-1">
                {lang === "ar" ? "إنشاء عرض تفاعلي" : "Create interactive deck"}
              </h1>
              <p className="text-white/85 text-xs sm:text-sm max-w-xl leading-relaxed line-clamp-2">
                {lang === "ar"
                  ? "أدخل تفاصيل الدرس والخطوات التالية، ثم يبني الذكاء الاصطناعي العرض كاملاً."
                  : "Add your lesson details, pick a look, then AI builds the full deck."}
              </p>
            </div>
            <Link href="/teacher/presentations" className="shrink-0 self-start sm:self-center">
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white text-[#1f5a3e] hover:bg-amber-50 px-3.5 py-2 rounded-lg text-sm font-bold shadow-md shadow-black/10 transition-colors"
              >
                {lang === "ar" ? "قائمة العروض" : "All decks"}
              </button>
            </Link>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => {
            const active = step >= s;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-12 h-1 rounded ${step > s ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: details */}
        {step === 1 && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{lang === "ar" ? "تفاصيل الدرس" : "Lesson details"}</h2>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? "أخبرنا عن الدرس وسنبني العرض كاملاً" : "Tell us about the lesson"}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  {lang === "ar" ? "عنوان الدرس *" : "Lesson title *"}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={lang === "ar" ? "مثال: دورة الماء في الطبيعة" : "e.g. The water cycle"}
                  className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {lang === "ar" ? "المادة" : "Subject"}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={lang === "ar" ? "علوم، رياضيات…" : "Science, Math…"}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {lang === "ar" ? "الصف" : "Grade"}
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{lang === "ar" ? "— غير محدد —" : "— Any —"}</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  {lang === "ar" ? `عدد الشرائح: ${slideCount}` : `Slides: ${slideCount}`}
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={slideCount}
                  onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>5</span><span>10</span><span>15</span><span>20</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  {lang === "ar" ? "خطة درسك (اختياري)" : "Your outline (optional)"}
                </label>
                <textarea
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  placeholder={lang === "ar"
                    ? "اكتب أهم النقاط التي تريد تغطيتها… (اختياري)"
                    : "Key points to cover… (optional)"}
                  rows={4}
                  maxLength={2000}
                  className="w-full px-4 py-3 border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  {lang === "ar" ? "محتوى تفاعلي" : "Interactive content"}
                </div>
                {[
                  { key: "quizzes", label: lang === "ar" ? "أسئلة سريعة في العرض" : "Quick quizzes", val: includeQuizzes, set: setIncludeQuizzes, emoji: "❓" },
                  { key: "act", label: lang === "ar" ? "ألعاب جماعية (وميض، المليون…)" : "Class games", val: includeActivities, set: setIncludeActivities, emoji: "🎮" },
                  { key: "disc", label: lang === "ar" ? "أسئلة نقاش مفتوحة" : "Discussion prompts", val: includeDiscussion, set: setIncludeDiscussion, emoji: "💬" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-card">
                    <input
                      type="checkbox"
                      checked={opt.val}
                      onChange={(e) => opt.set(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={!canStep2}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:opacity-90"
              >
                {lang === "ar" ? "التالي" : "Next"}
                {lang === "ar" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: theme */}
        {step === 2 && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <Palette className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{lang === "ar" ? "اختر الهوية" : "Choose the look"}</h2>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? "لون وأسلوب العرض" : "Color and style"}
                </p>
              </div>
            </div>

            {/* Theme grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {/* AI auto-pick card */}
              <button
                onClick={() => setTheme("ai")}
                className={`relative overflow-hidden rounded-2xl h-24 group ring-2 transition-all col-span-2 sm:col-span-3 ${
                  theme === "ai" ? "ring-primary scale-[1.02]" : "ring-transparent hover:ring-border"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(255,255,255,0.12),transparent_70%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-white drop-shadow" />
                    <span className="text-white text-sm font-extrabold drop-shadow">
                      {lang === "ar" ? "ذكاء اصطناعي — يختار لك تلقائياً" : "AI — auto-picks for you"}
                    </span>
                  </div>
                  <span className="text-white/75 text-xs">
                    {lang === "ar" ? "يختار الذكاء الاصطناعي اللون المناسب للموضوع" : "AI selects the best color for your topic"}
                  </span>
                </div>
                {theme === "ai" && (
                  <div className="absolute top-2 end-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>

              {/* Manual theme options */}
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={`relative overflow-hidden rounded-2xl h-24 group ring-2 transition-all ${
                    theme === t.key ? "ring-primary scale-105" : "ring-transparent hover:ring-border"
                  }`}
                >
                  <div
                    className={cn("absolute inset-0", t.grad && `bg-gradient-to-br ${t.grad}`)}
                    style={
                      !t.grad ? { background: platformHarvestBg(lang === "ar") } : undefined
                    }
                  />
                  <div className="absolute inset-0 flex items-end justify-center pb-2">
                    <span className="text-white text-xs font-bold drop-shadow">
                      {lang === "ar" ? t.labelAr : t.labelEn}
                    </span>
                  </div>
                  {theme === t.key && (
                    <div className="absolute top-2 end-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-2">
                {lang === "ar" ? "أيقونة الغلاف" : "Cover icon"}
              </label>
              <div className="grid grid-cols-9 gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setCoverEmoji(e)}
                    className={`text-2xl p-2 rounded-xl transition-all ${
                      coverEmoji === e ? "bg-primary/10 ring-2 ring-primary scale-110" : "hover:bg-muted"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-6">
              <p className="text-xs font-bold text-muted-foreground mb-2">
                {lang === "ar" ? "معاينة الغلاف" : "Cover preview"}
              </p>
              {theme === "ai" ? (
                <div className="relative rounded-2xl h-40 flex flex-col items-center justify-center text-white shadow-xl overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.15),transparent_70%)]" />
                  <Bot className="w-8 h-8 text-white/80 mb-1 relative z-10" />
                  <div className="font-bold text-sm drop-shadow relative z-10 text-center px-4">
                    {lang === "ar"
                      ? "سيختار الذكاء الاصطناعي اللون المناسب عند الإنشاء"
                      : "AI will pick the best color when generating"}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "relative rounded-2xl h-40 flex flex-col items-center justify-center text-white shadow-xl overflow-hidden",
                    THEMES.find((t) => t.key === theme)?.grad &&
                      `bg-gradient-to-br ${THEMES.find((t) => t.key === theme)?.grad}`,
                  )}
                  style={
                    theme === "harvest"
                      ? { background: platformHarvestBg(lang === "ar") }
                      : undefined
                  }
                >
                  <div className="text-5xl mb-2">{coverEmoji}</div>
                  <div className="font-bold text-lg drop-shadow">{title || (lang==="ar"?"عنوان الدرس":"Lesson title")}</div>
                  {subject && <div className="text-xs opacity-90 mt-0.5">{subject}</div>}
                </div>
              )}
            </div>

            {/* AI tier picker (only when teacher has access to >1 tier) */}
            {availableTiers.length > 1 && (
              <div className="mt-6">
                <p className="text-xs font-bold text-muted-foreground mb-2">
                  {lang === "ar" ? "جودة الذكاء الاصطناعي" : "AI quality"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTier("standard")}
                    className={`text-start rounded-2xl border-2 p-4 transition-all ${
                      selectedTier === "standard"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-sm">
                        {lang === "ar" ? "عادي" : "Standard"}
                      </span>
                      {selectedTier === "standard" && (
                        <Check className="w-4 h-4 text-primary ms-auto" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "ar"
                        ? "أسرع وأقل تكلفة. جودة جيدة لمعظم الدروس."
                        : "Faster & cheaper. Solid quality for most lessons."}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier("pro")}
                    className={`text-start rounded-2xl border-2 p-4 transition-all relative ${
                      selectedTier === "pro"
                        ? "border-violet-500 bg-violet-50/60 dark:bg-violet-950/20"
                        : "border-border hover:border-border/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      <span className="font-bold text-sm">
                        {lang === "ar" ? "احترافي" : "Pro"}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">
                        PRO
                      </span>
                      {selectedTier === "pro" && (
                        <Check className="w-4 h-4 text-violet-600 ms-auto" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "ar"
                        ? "أعمق وأرقى. مثالي للدروس المهمة والعروض النهائية."
                        : "Deeper & richer. Ideal for important lessons."}
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 mt-6">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 bg-muted text-foreground px-5 py-3 rounded-xl font-bold hover:bg-muted/80"
              >
                {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {lang === "ar" ? "السابق" : "Back"}
              </button>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                {lang === "ar" ? "أنشئ العرض الآن" : "Generate now"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: generating */}
        {step === 3 && (
          <div className="bg-card rounded-3xl border border-border shadow-lg p-10 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-amber-400 animate-pulse opacity-40 blur-xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
                {generating ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {lang === "ar" ? "جاري إنشاء عرضك…" : "Generating your deck…"}
            </h2>
            <p className="text-muted-foreground mb-1">{statusMsg}</p>
            <p className="text-xs text-muted-foreground/80 mt-4">
              {lang === "ar" ? "قد يستغرق هذا 30-60 ثانية" : "May take 30-60 seconds"}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
