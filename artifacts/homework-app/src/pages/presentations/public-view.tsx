import { useEffect, useState, useCallback } from "react";
import { useParams } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { getTheme, getPattern } from "@/lib/slide-themes";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Question = { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D" };
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
  question?: { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D"; explanation?: string | null } | null;
  activity?: { gameType: string; instructions?: string | null; questions: Question[] } | null;
  discussionPrompt?: string | null;
  discussionPoints?: string[] | null;
};

type Presentation = {
  id: number;
  title: string;
  subject: string | null;
  gradeLevel: string | null;
  theme: string;
  pattern?: string;
  coverEmoji: string | null;
  description: string | null;
  slides: Slide[];
  teacherName?: string | null;
};

export default function PublicPresentationView() {
  const { id } = useParams<{ id: string }>();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/presentations/public/${id}`)
      .then(async (r) => {
        if (r.status === 404 || r.status === 403) { setError("notfound"); return null; }
        if (!r.ok) { setError("error"); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        /* API returns { presentation: {...} } — handle both shapes defensively. */
        const p = (d.presentation ?? d) as Presentation;
        if (!p || !Array.isArray(p.slides)) { setError("error"); return; }
        setPres(p);
      })
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
  }, [id]);

  const next = useCallback(() => {
    if (!pres) return;
    setIdx((i) => Math.min(i + 1, pres.slides.length - 1));
  }, [pres]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
    };
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [next, prev]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }
  if (error === "notfound") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-8" dir="rtl">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">العرض غير متاح</h1>
          <p className="text-slate-300 text-sm">قد يكون هذا العرض خاصاً أو تم حذفه. تواصل مع المعلم للحصول على الإذن.</p>
          <a href="/" className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold">العودة للرئيسية</a>
        </div>
      </div>
    );
  }
  if (error === "error" || !pres) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <p className="mb-4">حدث خطأ أثناء تحميل العرض.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const theme = getTheme(pres.theme);
  const pattern = getPattern(pres.pattern);
  /* Guard against empty/invalid slides arrays. */
  if (!pres.slides || pres.slides.length === 0) {
    return (
      <div dir="rtl" className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${theme.grad} text-white p-8`}>
        <div className="max-w-md text-center">
          <div className="text-7xl mb-4">📭</div>
          <h1 className="text-2xl font-bold mb-2">{pres.title}</h1>
          <p className="opacity-80">هذا العرض فارغ — لم يتم إضافة شرائح بعد.</p>
        </div>
      </div>
    );
  }
  const safeIdx = Math.min(idx, pres.slides.length - 1);
  const slide = pres.slides[safeIdx];

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col bg-gradient-to-br ${theme.grad} text-white relative overflow-hidden`}>
      {Object.keys(pattern.style).length > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={pattern.style} />
      )}
      {/* Public watermark / brand */}
      <div className="absolute top-4 start-4 z-10 flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-xs font-bold">
        <span>🌾</span>
        <span>منصة حصاد</span>
        <span className="opacity-60">·</span>
        <span className="opacity-80">{pres.title}</span>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 end-4 z-10 p-2 rounded-lg bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/20"
        title={isFullscreen ? "خروج" : "ملء الشاشة"}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {/* Slide canvas */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-5xl">
          {slide.type === "cover" && (
            <div className="text-center">
              <div className="text-7xl sm:text-9xl mb-6 drop-shadow-lg">{slide.emoji || pres.coverEmoji || "📚"}</div>
              <h1 className="text-4xl sm:text-7xl font-black mb-4 drop-shadow">{slide.title || pres.title}</h1>
              {slide.subtitle && <p className="text-xl sm:text-2xl opacity-90">{slide.subtitle}</p>}
              {pres.teacherName && <p className="mt-8 text-base opacity-70">المعلم: {pres.teacherName}</p>}
            </div>
          )}

          {(slide.type === "content" || slide.type === "warmup") && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-5xl">{slide.emoji || (slide.type === "warmup" ? "🔥" : "📝")}</span>
                <h2 className="text-3xl sm:text-5xl font-black">{slide.title}</h2>
              </div>
              <p className="text-lg sm:text-2xl leading-relaxed opacity-95 whitespace-pre-wrap">{slide.body}</p>
            </div>
          )}

          {(slide.type === "bullets" || slide.type === "objectives" || slide.type === "summary") && (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <span className="text-5xl">{slide.emoji || (slide.type === "objectives" ? "🎯" : slide.type === "summary" ? "✅" : "📋")}</span>
                <h2 className="text-3xl sm:text-5xl font-black">{slide.title}</h2>
              </div>
              <ul className="space-y-4 text-lg sm:text-2xl">
                {(slide.bullets || []).map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`mt-2 inline-block w-3 h-3 rounded-full ${theme.accent} flex-shrink-0`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {slide.type === "quiz" && slide.question && (
            <div>
              <div className="text-yellow-300 text-xl mb-3 font-bold">❓ سؤال</div>
              <h2 className="text-2xl sm:text-4xl font-black mb-8">{slide.question.text}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {(["A","B","C","D"] as const).map((k) => {
                  const isCorrect = slide.question!.correctAnswer === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setRevealed((r) => ({ ...r, [idx]: true }))}
                      className={`p-4 rounded-xl text-start text-lg font-bold border-2 transition ${
                        revealed[idx]
                          ? isCorrect
                            ? "bg-emerald-400/30 border-emerald-300"
                            : "bg-white/10 border-white/20 opacity-60"
                          : "bg-white/10 hover:bg-white/20 border-white/20"
                      }`}
                    >
                      <span className="font-black me-2">{k}.</span>
                      {slide.question![`option${k}` as "optionA"]}
                      {revealed[idx] && isCorrect && <span className="ms-2">✓</span>}
                    </button>
                  );
                })}
              </div>
              {revealed[idx] && slide.question.explanation && (
                <div className="mt-6 p-4 rounded-xl bg-black/20 border border-white/20">
                  <span className="font-bold">💡 </span>
                  <span>{slide.question.explanation}</span>
                </div>
              )}
            </div>
          )}

          {slide.type === "activity" && slide.activity && (
            <div className="text-center">
              <div className="text-7xl mb-4">🎮</div>
              <h2 className="text-3xl sm:text-5xl font-black mb-4">{slide.title || "نشاط تفاعلي"}</h2>
              <p className="text-lg sm:text-xl opacity-90 mb-6 max-w-2xl mx-auto">{slide.activity.instructions}</p>
              <div className="inline-block px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-bold">
                لعبة: {slide.activity.gameType} · {slide.activity.questions.length} سؤال
              </div>
              <p className="mt-4 text-xs opacity-70">انضم لصفك على منصة حصاد لتلعب هذا النشاط مباشرة</p>
            </div>
          )}

          {slide.type === "discussion" && (
            <div>
              <div className="text-yellow-300 text-xl mb-3 font-bold">💬 نقاش</div>
              <h2 className="text-3xl sm:text-5xl font-black mb-6">{slide.discussionPrompt || slide.title}</h2>
              {(slide.discussionPoints || []).length > 0 && (
                <ul className="space-y-3 text-lg sm:text-xl">
                  {slide.discussionPoints!.map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-2 inline-block w-3 h-3 rounded-full ${theme.accent} flex-shrink-0`} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {slide.type === "image" && (
            <div className="text-center">
              {slide.imageUrl ? (
                <img src={slide.imageUrl} alt={slide.title || ""} className="max-h-[60vh] mx-auto rounded-2xl shadow-2xl" />
              ) : (
                <div className="text-6xl">🖼️</div>
              )}
              {slide.title && <p className="mt-4 text-xl font-bold">{slide.title}</p>}
            </div>
          )}

          {slide.type === "video" && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="text-3xl font-black mb-3">{slide.title}</h2>
              {slide.videoUrl && (
                <a href={slide.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-white/90">
                  مشاهدة الفيديو
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer / nav */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/30 backdrop-blur-md border-t border-white/10">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">
            {idx + 1} / {pres.slides.length}
          </span>
          <div className="flex gap-1">
            {pres.slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={next}
          disabled={idx === pres.slides.length - 1}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
