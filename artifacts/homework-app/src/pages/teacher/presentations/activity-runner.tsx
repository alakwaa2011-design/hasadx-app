import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, Trophy, X } from "lucide-react";
import { getTheme, resolveSlideGradient } from "@/lib/slide-themes";
import { useI18n } from "@/lib/i18n";
import { ar as arLocale } from "@/locales/ar";
import { en as enLocale } from "@/locales/en";

type Question = { prompt: string; options: string[]; correctIndex: number };
type Payload = {
  gameKind: string;
  gameLabel?: string;
  prompt?: string;
  questions: Question[];
  themeKey?: string | null;
  /** the deck's own language, so a Arabic deck stays Arabic whatever the UI locale is */
  language?: "ar" | "en";
};

export default function ActivityRunner() {
  const ui = useI18n();
  const params = useParams<{ seedId: string }>();
  const seedId = params?.seedId ?? "";
  const [payload, setPayload] = useState<Payload | null>(null);
  const lang: "ar" | "en" = payload?.language ?? ui.lang;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const copy = (lang === "ar" ? arLocale : enLocale).activityRunner;
  const [missing, setMissing] = useState(false);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* The launcher (editor inspector) writes the payload to localStorage
       just before opening this tab with `noopener`. localStorage is the
       only shared channel that survives a noopener window.open. We read
       it once and immediately drop the key so it doesn't accumulate. */
    try {
      const key = `hasad:activity:${seedId}`;
      const raw = localStorage.getItem(key);
      if (!raw) { setMissing(true); return; }
      const parsed = JSON.parse(raw) as Payload & { expiresAt?: number };
      if (!parsed?.questions?.length) { setMissing(true); return; }
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        localStorage.removeItem(key);
        setMissing(true);
        return;
      }
      setPayload(parsed);
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    } catch {
      setMissing(true);
    }
  }, [seedId]);

  const theme = useMemo(() => getTheme(payload?.themeKey ?? null), [payload?.themeKey]);
  const bg = useMemo(
    () => resolveSlideGradient({
      themeGrad: theme.grad,
      themeCssGrad: theme.cssGrad,
      themeAccentHex: theme.accentHex,
      themeTextOnLight: theme.textOnLight,
      pattern: "solid",
      customBackground: null,
      customStyle: null,
    }),
    [theme],
  );

  if (missing) {
    return (
      <div dir={dir} className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-2xl font-bold">{copy.missingTitle}</div>
          <div className="text-sm text-white/70">
            {copy.missingBody}
          </div>
          <Button onClick={() => window.close()} variant="outline">
            <X className="w-4 h-4 me-1" /> {copy.close}
          </Button>
        </div>
      </div>
    );
  }
  if (!payload) {
    return (
      <div dir={dir} className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-sm text-white/70" role="status">{copy.loading}</div>
      </div>
    );
  }

  const q = payload.questions[idx];
  const total = payload.questions.length;
  const isLast = idx >= total - 1;
  const gameLabels: Record<string, string> = {
    ...copy.gameLabels,
    "flag-quiz": copy.gameLabels.flagQuiz,
  };
  const gameLabel = payload.gameLabel ?? gameLabels[payload.gameKind] ?? copy.activity;
  const textColor = bg.textOnLight ? "#1f2937" : "#f8fafc";
  const subtle = bg.textOnLight ? "rgba(31,41,55,0.65)" : "rgba(248,250,252,0.75)";
  const accent = bg.accentColor ?? "#d4af37";

  function pick(i: number) {
    if (revealed || done) return;
    setPicked(i);
    setRevealed(true);
    if (i === q.correctIndex) setScore((s) => s + 1);
  }
  function next() {
    if (isLast) { setDone(true); return; }
    setIdx((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  }
  function restart() {
    setIdx(0); setPicked(null); setRevealed(false); setScore(0); setDone(false);
  }

  return (
    <div
      dir={dir}
      className="min-h-screen w-full flex flex-col items-stretch"
      style={bg.cssBackground ? { background: bg.cssBackground, color: textColor } : { color: textColor }}
    >
      <style>{`
        @keyframes goldPulse {
          0%   { box-shadow: 0 0 0 0 rgba(217,165,33,0.55); }
          60%  { box-shadow: 0 0 0 8px rgba(217,165,33,0); }
          100% { box-shadow: 0 0 0 0 rgba(217,165,33,0); }
        }
        .btn-reveal-ready {
          animation: goldPulse 1.4s ease-out 1;
        }
      `}</style>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: `${textColor}20` }}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: `${accent}30`, color: accent, border: `1px solid ${accent}55` }}
          >
            {gameLabel}
          </div>
          {payload.prompt && (
            <div className="text-sm truncate" style={{ color: subtle }}>{payload.prompt}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold tabular-nums" style={{ color: subtle }}>
            {done ? `${score} / ${total}` : copy.questionProgress.replace("{current}", String(idx + 1)).replace("{total}", String(total))}
          </div>
          <Button size="sm" variant="outline" onClick={() => window.close()} aria-label={copy.close}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        {done ? (
          <div className="w-full max-w-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full"
                 style={{ background: `${accent}30`, color: accent }}>
              <Trophy className="w-10 h-10" />
            </div>
            <div className="text-3xl font-extrabold">{copy.complete}</div>
            <div className="text-2xl font-bold tabular-nums">
              {copy.result.replace("{score}", String(score)).replace("{total}", String(total))}
            </div>
            <div className="text-sm" style={{ color: subtle }}>
              {score === total
                ? copy.perfect
                : score >= Math.ceil(total / 2)
                  ? copy.good
                  : copy.retryHint}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button onClick={restart} style={{ background: accent, color: "#1c1003" }} className="font-bold">
                {copy.retry}
              </Button>
              <Button onClick={() => window.close()} variant="outline">
                {copy.close}
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-6">
            {/* Progress */}
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: `${textColor}15` }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${((idx + (revealed ? 1 : 0)) / total) * 100}%`, background: accent }}
              />
            </div>
            {/* Question */}
            <div className="text-2xl md:text-3xl font-bold leading-relaxed">{q.prompt}</div>
            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correctIndex;
                const isPicked = picked === i;
                const showAsCorrect = revealed && isCorrect;
                const showAsWrong = revealed && isPicked && !isCorrect;
                const base = bg.textOnLight ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.08)";
                const border = bg.textOnLight ? "rgba(31,41,55,0.18)" : "rgba(255,255,255,0.20)";
                let style: React.CSSProperties = { background: base, borderColor: border, color: textColor };
                if (showAsCorrect) style = {
                  background: "#16a34a", borderColor: "#16a34a", color: "white",
                  boxShadow: "0 0 18px rgba(22,163,74,0.45)",
                };
                else if (showAsWrong) style = {
                  background: bg.textOnLight ? "rgba(185,28,28,0.12)" : "rgba(185,28,28,0.25)",
                  borderColor: "rgba(185,28,28,0.4)",
                  color: textColor,
                  opacity: 0.45,
                  filter: "saturate(0.5)",
                };
                else if (revealed) style = {
                  background: base, borderColor: border, color: textColor,
                  opacity: 0.45,
                  filter: "saturate(0.5)",
                };
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={revealed}
                    aria-label={copy.answerOption.replace("{label}", lang === "ar" ? String.fromCharCode(0x0623 + i) : String.fromCharCode(65 + i))}
                    className="text-start rounded-xl px-4 py-4 border-2 flex items-center gap-3 transition-all duration-300 hover:scale-[1.01] disabled:cursor-default disabled:hover:scale-100"
                    style={style}
                  >
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-base shrink-0"
                      style={{ background: showAsCorrect || showAsWrong ? "rgba(255,255,255,0.25)" : `${accent}40`, color: showAsCorrect || showAsWrong ? "white" : accent }}
                    >
                      {lang === "ar" ? String.fromCharCode(0x0623 + i) : String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 text-base md:text-lg font-medium">{opt}</span>
                    {showAsCorrect && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                );
              })}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm font-bold tabular-nums" style={{ color: subtle }}>
                {copy.currentResult.replace("{score}", String(score)).replace("{total}", String(total))}
              </div>
              {!revealed ? (
                <div className="text-sm" style={{ color: subtle }}>
                  <Eye className="w-4 h-4 inline-block me-1" />
                  {copy.chooseAnswer}
                </div>
              ) : (
                <Button
                  onClick={next}
                  style={{ background: accent, color: "#1c1003" }}
                  className="font-bold btn-reveal-ready"
                >
                  {isLast ? copy.finish : copy.nextQuestion}
                  {dir === "rtl" ? <ChevronLeft className="w-4 h-4 ms-1" /> : <ChevronRight className="w-4 h-4 ms-1" />}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom progress dots */}
      {!done && (
        <div className="flex items-center justify-center gap-1.5 pb-6">
          {payload.questions.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i === idx ? accent : `${textColor}30` }}
            />
          ))}
          <ChevronRight className="w-0 h-0 opacity-0" />
        </div>
      )}
    </div>
  );
}
