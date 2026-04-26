import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, X, Play, Maximize2, Minimize2, Eye, EyeOff,
  Loader2, Gamepad2, HelpCircle, MessageSquare, CheckCircle2, Target,
  Zap, ListOrdered, Type, Image as ImageIcon, Video as VideoIcon,
  Layout as LayoutIcon, Sparkles, Clock, KeyRound,
} from "lucide-react";

import { getTheme, getPattern, resolveSlideGradient, type CustomBackground } from "@/lib/slide-themes";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Question = { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D"; points?: number };
type Slide = {
  id: string;
  type: "cover"|"content"|"bullets"|"quiz"|"activity"|"discussion"|"image"|"video"|"summary"|"objectives"|"warmup";
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  bullets?: string[] | null;
  emoji?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  speakerNotes?: string | null;
  question?: { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D"; explanation?: string | null } | null;
  activity?: { gameType: "wameed"|"million"|"tug"|"memory"|"scramble"; instructions?: string | null; questions: Question[] } | null;
  discussionPrompt?: string | null;
  discussionPoints?: string[] | null;
  customBackground?: CustomBackground | null;
};

type Presentation = {
  id: number;
  title: string;
  subject: string | null;
  gradeLevel: string | null;
  theme: string;
  pattern?: string;
  coverEmoji: string | null;
  slides: Slide[];
};

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const initialIdx = (() => {
    if (typeof window === "undefined") return 0;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("from");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const [idx, setIdx] = useState(initialIdx);
  const [revealed, setRevealed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Load deck */
  useEffect(() => {
    fetch(`${API_BASE}/api/presentations/${id}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) { setLocation("/login"); return; }
        if (!r.ok) throw new Error();
        const data = await r.json();
        setPres(data.presentation);
        /* Clamp ?from= to valid range now that we know slide count */
        const total = data.presentation?.slides?.length ?? 0;
        if (total > 0 && initialIdx >= total) {
          setIdx(total - 1);
        }
      })
      .catch(() => toast.error(lang === "ar" ? "تعذّر التحميل" : "Failed to load"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Timer */
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  /* Auto-hide HUD */
  const bumpHud = () => {
    setHudVisible(true);
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHudVisible(false), 3500);
  };
  useEffect(() => {
    const onMove = () => bumpHud();
    window.addEventListener("mousemove", onMove);
    bumpHud();
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* Keyboard nav */
  useEffect(() => {
    if (!pres) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { lang === "ar" ? prev() : next(); }
      else if (e.key === "ArrowLeft") { lang === "ar" ? next() : prev(); }
      else if (e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") { setLocation(`/teacher/presentations/${id}`); }
      else if (e.key.toLowerCase() === "f") { toggleFs(); }
      else if (e.key.toLowerCase() === "n") { setShowNotes((v) => !v); }
      else if (e.key === "Home") { setIdx(0); setRevealed(false); }
      else if (e.key === "End") { setIdx(pres.slides.length - 1); setRevealed(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pres, idx, lang]);

  const next = () => {
    setRevealed(false);
    setIdx((i) => (pres && i < pres.slides.length - 1 ? i + 1 : i));
  };
  const prev = () => {
    setRevealed(false);
    setIdx((i) => Math.max(0, i - 1));
  };

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFs(true);
      } else {
        await document.exitFullscreen();
        setIsFs(false);
      }
    } catch { /* ignore */ }
  };

  const launchActivity = async () => {
    if (!pres) return;
    setLaunching(true);
    try {
      const r = await fetch(`${API_BASE}/api/presentations/${pres.id}/launch-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slideId: slide.id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      const data = await r.json();
      window.open(data.launchUrl, "_blank", "noopener,noreferrer");
      toast.success(lang === "ar" ? "تم فتح اللعبة في نافذة جديدة" : "Game opened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLaunching(false);
    }
  };

  const themeMeta = useMemo(() => getTheme(pres?.theme), [pres?.theme]);
  const patternMeta = useMemo(() => getPattern(pres?.pattern), [pres?.pattern]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }
  if (!pres || !pres.slides.length) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white text-center px-6">
        <div>
          <div className="text-5xl mb-4">📭</div>
          <p className="mb-4">{lang === "ar" ? "لا توجد شرائح في هذا العرض" : "No slides in this deck"}</p>
          <button onClick={() => setLocation(`/teacher/presentations/${id}`)} className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold">
            {lang === "ar" ? "تعديل العرض" : "Open editor"}
          </button>
        </div>
      </div>
    );
  }

  const slide = pres.slides[idx];
  const fmtTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div className="fixed inset-0 overflow-hidden text-white">
      {/* Backdrop gradient (fades between slides). For the "ai" pattern, each
          slide can carry its own per-slide gradient that overrides the theme. */}
      {(() => {
        const resolved = resolveSlideGradient({
          themeGrad: themeMeta.grad,
          themeTextOnLight: themeMeta.textOnLight,
          pattern: pres.pattern,
          customBackground: slide.customBackground,
        });
        return (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${pres.theme}-${idx}-${resolved.grad}`}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.6 }}
                transition={{ duration: 0.6 }}
                className={`absolute inset-0 bg-gradient-to-br ${resolved.grad}`}
              />
            </AnimatePresence>
            {/* Pattern overlay (skipped for the AI pattern — its visual is the
                per-slide gradient itself). */}
            {pres.pattern !== "ai" && Object.keys(patternMeta.style).length > 0 && (
              <div className="absolute inset-0 pointer-events-none" style={patternMeta.style} />
            )}
          </>
        );
      })()}
      {/* Decorative blobs */}
      <div className="absolute -top-40 -end-40 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -start-40 w-[500px] h-[500px] rounded-full bg-amber-200/10 blur-3xl pointer-events-none" />

      {/* Main slide area */}
      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="w-full max-w-6xl"
          >
            <SlideRender
              slide={slide}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
              onLaunch={launchActivity}
              launching={launching}
              accent={themeMeta.accent}
              lang={lang}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Speaker notes overlay */}
      {showNotes && slide.speakerNotes && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-24 inset-x-4 sm:inset-x-12 bg-black/85 backdrop-blur border border-white/20 rounded-2xl p-4 sm:p-5 max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1">
            <Eye className="w-3.5 h-3.5" />
            {lang === "ar" ? "ملاحظات للمعلم" : "Speaker notes"}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{slide.speakerNotes}</p>
        </motion.div>
      )}

      {/* HUD */}
      <AnimatePresence>
        {hudVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2"
          >
            {/* Left: exit */}
            <button
              onClick={() => setLocation(`/teacher/presentations/${pres.id}`)}
              className="bg-black/40 hover:bg-black/60 backdrop-blur p-2.5 rounded-full"
              title={lang === "ar" ? "خروج" : "Exit"}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Middle: nav */}
            <div className="flex-1 flex items-center justify-center gap-1.5 max-w-3xl mx-auto">
              <button onClick={prev} disabled={idx === 0} className="bg-black/40 hover:bg-black/60 backdrop-blur p-2.5 rounded-full disabled:opacity-30">
                {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              </button>
              <div className="bg-black/40 backdrop-blur px-4 py-2 rounded-full text-xs font-bold">
                {idx + 1} / {pres.slides.length}
              </div>
              <button onClick={next} disabled={idx === pres.slides.length - 1} className="bg-black/40 hover:bg-black/60 backdrop-blur p-2.5 rounded-full disabled:opacity-30">
                {lang === "ar" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Right: tools */}
            <div className="flex items-center gap-1.5">
              <div className="hidden sm:inline-flex items-center gap-1 bg-black/40 backdrop-blur px-3 py-2 rounded-full text-xs font-mono">
                <Clock className="w-3 h-3" />
                {fmtTime(elapsed)}
              </div>
              {slide.speakerNotes && (
                <button onClick={() => setShowNotes((v) => !v)} className="bg-black/40 hover:bg-black/60 backdrop-blur p-2.5 rounded-full" title={lang === "ar" ? "الملاحظات (N)" : "Notes (N)"}>
                  {showNotes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
              <button onClick={toggleFs} className="bg-black/40 hover:bg-black/60 backdrop-blur p-2.5 rounded-full" title={lang === "ar" ? "ملء الشاشة (F)" : "Fullscreen (F)"}>
                {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top progress bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-black/20">
        <div
          className={`h-full ${themeMeta.accent} transition-all`}
          style={{ width: `${((idx + 1) / pres.slides.length) * 100}%` }}
        />
      </div>

      {/* Slide-bound reveal hint for quiz */}
      {slide.type === "quiz" && !revealed && (
        <button
          onClick={() => setRevealed(true)}
          className="absolute top-4 end-4 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-transform animate-pulse"
        >
          <Sparkles className="w-3 h-3 inline me-1" />
          {lang === "ar" ? "أظهر الإجابة" : "Reveal"}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Slide renderer (large, presentation-grade)
   ───────────────────────────────────────────── */
function SlideRender({
  slide, revealed, onReveal, onLaunch, launching, accent, lang,
}: {
  slide: Slide; revealed: boolean; onReveal: () => void; onLaunch: () => void;
  launching: boolean; accent: string; lang: "ar" | "en";
}) {
  if (slide.type === "cover") {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-9xl sm:text-[10rem] mb-6 drop-shadow-2xl"
        >
          {slide.emoji || "📚"}
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-5xl sm:text-7xl font-extrabold drop-shadow-2xl mb-4"
        >
          {slide.title}
        </motion.h1>
        {slide.subtitle && (
          <motion.p
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl sm:text-2xl text-white/90"
          >
            {slide.subtitle}
          </motion.p>
        )}
      </motion.div>
    );
  }

  if (slide.type === "objectives" || slide.type === "summary" || slide.type === "bullets") {
    const isObj = slide.type === "objectives";
    const isSum = slide.type === "summary";
    const Icon = isObj ? Target : isSum ? CheckCircle2 : ListOrdered;
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <div className="text-6xl drop-shadow-lg">{slide.emoji || "📌"}</div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
              <Icon className="w-3.5 h-3.5" />
              {isObj ? (lang === "ar" ? "أهداف" : "Objectives") : isSum ? (lang === "ar" ? "خلاصة" : "Summary") : (lang === "ar" ? "نقاط" : "Points")}
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">{slide.title}</h2>
          </div>
        </div>
        <ul className="space-y-4">
          {(slide.bullets || []).map((b, i) => (
            <motion.li
              key={i}
              initial={{ x: lang === "ar" ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="flex items-start gap-4 text-2xl sm:text-3xl bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-6 py-4"
            >
              <span className={`${accent} text-slate-900 w-10 h-10 rounded-full flex items-center justify-center text-lg font-extrabold shrink-0`}>
                {i + 1}
              </span>
              <span className="leading-snug">{b}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    );
  }

  if (slide.type === "content" || slide.type === "warmup") {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <div className="text-6xl drop-shadow-lg">{slide.emoji || "💡"}</div>
          <div>
            {slide.type === "warmup" && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
                <Zap className="w-3.5 h-3.5" />
                {lang === "ar" ? "تنشيط" : "Warm-up"}
              </div>
            )}
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">{slide.title}</h2>
          </div>
        </div>
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="text-2xl sm:text-3xl leading-relaxed whitespace-pre-wrap"
        >
          {slide.body}
        </motion.p>
      </div>
    );
  }

  if (slide.type === "quiz" && slide.question) {
    return (
      <div>
        <div className="flex items-center gap-2 text-amber-200 text-sm font-bold uppercase tracking-wider mb-3">
          <HelpCircle className="w-4 h-4" />
          {lang === "ar" ? "اختبر فهمك" : "Quick check"}
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold drop-shadow-lg mb-8">{slide.question.text}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["A","B","C","D"] as const).map((k, i) => {
            const isCorrect = revealed && slide.question!.correctAnswer === k;
            const isWrong = revealed && slide.question!.correctAnswer !== k;
            return (
              <motion.div
                key={k}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}
                className={`p-5 rounded-2xl border backdrop-blur transition-all flex items-center gap-3 text-xl sm:text-2xl ${
                  isCorrect ? "bg-emerald-400/30 border-emerald-300 scale-105 shadow-2xl"
                  : isWrong ? "bg-white/5 border-white/10 opacity-50"
                  : "bg-white/15 border-white/30"
                }`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-base shrink-0 ${
                  isCorrect ? "bg-emerald-300 text-emerald-900" : "bg-white/20"
                }`}>{k}</span>
                <span className="flex-1">{slide.question![`option${k}` as "optionA"]}</span>
                {isCorrect && <CheckCircle2 className="w-7 h-7 text-emerald-200" />}
              </motion.div>
            );
          })}
        </div>
        {revealed && slide.question.explanation && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="mt-6 bg-black/30 backdrop-blur border border-white/20 rounded-2xl p-4 text-sm sm:text-base"
          >
            <div className="text-amber-200 text-xs font-bold mb-1">{lang === "ar" ? "شرح" : "Why"}</div>
            {slide.question.explanation}
          </motion.div>
        )}
        {!revealed && (
          <button
            onClick={onReveal}
            className="mt-6 inline-flex items-center gap-2 bg-amber-400 text-amber-950 px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl"
          >
            <Sparkles className="w-4 h-4" />
            {lang === "ar" ? "أظهر الإجابة الصحيحة" : "Reveal answer"}
          </button>
        )}
      </div>
    );
  }

  if (slide.type === "activity" && slide.activity) {
    const gameLabels: Record<string, string> = {
      wameed: lang === "ar" ? "وميض" : "Wameed",
      million: lang === "ar" ? "من سيربح المليون" : "Million",
      memory: lang === "ar" ? "لعبة الذاكرة" : "Memory",
      tug: lang === "ar" ? "شد الحبل" : "Tug of War",
      scramble: lang === "ar" ? "الكلمات المبعثرة" : "Scramble",
    };
    return (
      <div>
        <div className="flex items-center gap-2 text-amber-200 text-sm font-bold uppercase tracking-wider mb-3">
          <Gamepad2 className="w-4 h-4" />
          {lang === "ar" ? "نشاط جماعي" : "Class activity"}
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="text-7xl drop-shadow-lg">{slide.emoji || "🎮"}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">{slide.title}</h2>
        </div>
        {slide.activity.instructions && (
          <p className="text-xl sm:text-2xl text-white/90 mb-8 leading-relaxed">{slide.activity.instructions}</p>
        )}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6 sm:p-8 inline-flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs text-white/70 mb-1">{lang === "ar" ? "اللعبة" : "Game"}</div>
            <div className="text-2xl font-extrabold">{gameLabels[slide.activity.gameType] || slide.activity.gameType}</div>
          </div>
          <div className="border-s border-white/20 ps-6">
            <div className="text-xs text-white/70 mb-1">{lang === "ar" ? "الأسئلة" : "Questions"}</div>
            <div className="text-2xl font-extrabold">{slide.activity.questions.length}</div>
          </div>
          <button
            onClick={onLaunch}
            disabled={launching || slide.activity.questions.length === 0}
            className="ms-auto inline-flex items-center gap-2 bg-amber-400 text-amber-950 px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl disabled:opacity-50"
          >
            {launching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {lang === "ar" ? "ابدأ النشاط" : "Start activity"}
          </button>
        </div>
        <p className="text-xs text-white/70 mt-4 inline-flex items-center gap-1">
          <KeyRound className="w-3 h-3" />
          {lang === "ar"
            ? "سيتم إنشاء واجب مخفي بالأسئلة وفتحه في نافذة جديدة لتشغيل اللعبة."
            : "A hidden assignment is created and opened in a new tab to launch the game."}
        </p>
      </div>
    );
  }

  if (slide.type === "discussion") {
    return (
      <div>
        <div className="flex items-center gap-2 text-amber-200 text-sm font-bold uppercase tracking-wider mb-3">
          <MessageSquare className="w-4 h-4" />
          {lang === "ar" ? "حوار وتفكير" : "Discussion"}
        </div>
        <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg mb-8 leading-tight">{slide.discussionPrompt}</h2>
        <ul className="space-y-3 max-w-3xl">
          {(slide.discussionPoints || []).map((p, i) => (
            <motion.li
              key={i}
              initial={{ x: lang === "ar" ? 20 : -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="flex items-start gap-3 text-xl sm:text-2xl bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-5 py-3"
            >
              <span className="text-amber-200 text-2xl shrink-0">•</span>
              <span>{p}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    );
  }

  if (slide.type === "image") {
    return (
      <div className="text-center">
        {slide.imageUrl ? (
          <img src={slide.imageUrl} alt={slide.title || ""} className="mx-auto max-h-[70vh] rounded-3xl shadow-2xl" />
        ) : (
          <div className="bg-white/10 rounded-3xl p-20 text-white/60">
            <ImageIcon className="w-20 h-20 mx-auto mb-4" />
            {lang === "ar" ? "ضع رابط الصورة من المحرر" : "Set image URL in editor"}
          </div>
        )}
        {slide.title && <p className="mt-4 text-xl">{slide.title}</p>}
      </div>
    );
  }

  if (slide.type === "video") {
    const url = slide.videoUrl || "";
    let embed = url;
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) embed = `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      else if (u.hostname.includes("youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) embed = `https://www.youtube.com/embed/${v}`;
      }
    } catch { /* keep raw */ }
    return (
      <div className="w-full">
        {slide.title && <h2 className="text-3xl font-extrabold drop-shadow-lg mb-4">{slide.emoji} {slide.title}</h2>}
        {url ? (
          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
            <iframe src={embed} className="w-full h-full" allowFullScreen />
          </div>
        ) : (
          <div className="bg-white/10 rounded-3xl p-20 text-center text-white/60">
            <VideoIcon className="w-20 h-20 mx-auto mb-4" />
            {lang === "ar" ? "ضع رابط فيديو يوتيوب" : "Set YouTube URL"}
          </div>
        )}
      </div>
    );
  }

  /* fallback */
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">{slide.emoji || "📄"}</div>
      <h2 className="text-3xl font-bold">{slide.title}</h2>
      {slide.body && <p className="mt-4 text-xl">{slide.body}</p>}
    </div>
  );
}
