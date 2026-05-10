import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowLeft, RotateCw, Volume2, VolumeX, Trophy, X,
  Eye, Plus, Minus, Sparkles, Gift, RefreshCw, Maximize2, Minimize2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

const WHEEL_PALETTE = [
  "#225739", "#D9A521", "#3a7a55", "#c47e2c",
  "#1f4d3a", "#e6b54f", "#2d6a4f", "#b08440",
];

type BonusType = "double" | "skip" | "swap" | "lucky" | "lose";

interface Segment {
  id: string;
  text: string;
  answer?: string;
  explanation?: string;
  points: number;
  color?: string;
  kind: "question" | "bonus";
  bonusType?: BonusType;
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
  segments: Segment[];
  config: WheelConfig;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

const bonusInfo = (b: BonusType, lang: "ar" | "en") => {
  const map = {
    double: {
      ar: { title: "النقاط المضاعفة", desc: "الفريق التالي سيحصل على ضعف نقاط السؤال القادم." },
      en: { title: "Double Points", desc: "The next team to answer earns double points." },
    },
    skip: {
      ar: { title: "تخطّى الدور", desc: "الفريق المختار يخسر دوره القادم." },
      en: { title: "Skip Turn", desc: "The chosen team loses their next turn." },
    },
    swap: {
      ar: { title: "تبادل النقاط", desc: "اختر فريقَين وستُتبادل نقاطهما." },
      en: { title: "Swap Scores", desc: "Pick two teams — their scores swap." },
    },
    lucky: {
      ar: { title: "حظ سعيد!", desc: "نقاط مجانية لأي فريق تختاره." },
      en: { title: "Lucky Bonus!", desc: "Award the points to any team you choose." },
    },
    lose: {
      ar: { title: "خسارة", desc: "الفريق المختار يخسر نصف نقاطه." },
      en: { title: "Lose Half", desc: "The chosen team loses half their points." },
    },
  };
  return map[b][lang];
};

/* ── Audio helper: synthesizes ticks + win chime via Web Audio API. ── */
function useWheelAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCtx = () => {
    if (!ctxRef.current && typeof window !== "undefined") {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = W.AudioContext || W.webkitAudioContext;
      if (Ctor) ctxRef.current = new Ctor();
    }
    if (ctxRef.current?.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  };

  const playTick = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }, [enabled]);

  const startTicking = useCallback((durationMs: number) => {
    if (!enabled) return;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    let elapsed = 0;
    let interval = 80;
    const step = () => {
      playTick();
      elapsed += interval;
      // Slow down the ticks as the wheel slows.
      const progress = Math.min(1, elapsed / durationMs);
      interval = 80 + progress * 200;
      if (elapsed < durationMs) {
        tickIntervalRef.current = setTimeout(step, interval);
      }
    };
    step();
  }, [enabled, playTick]);

  const stopTicking = useCallback(() => {
    if (tickIntervalRef.current) {
      clearTimeout(tickIntervalRef.current as unknown as number);
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const playWin = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const start = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = start + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }, [enabled]);

  useEffect(() => () => {
    stopTicking();
    void ctxRef.current?.close();
  }, [stopTicking]);

  return { startTicking, stopTicking, playWin };
}

export default function WheelPlay() {
  const { lang: uiLang } = useI18n();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const templateId = parseInt(params.id || "", 10);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<number[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFinal, setShowFinal] = useState(false);

  // Pending bonus modifiers — applied to the *next* question that resolves.
  const [doubleMultiplier, setDoubleMultiplier] = useState(1);
  // Teams whose next turn is skipped — purely informational; the teacher
  // sees a visible badge and remembers not to call on them.
  const [skippedTeams, setSkippedTeams] = useState<Set<number>>(new Set());
  // Two-team selection state for the swap bonus.
  const [swapPicks, setSwapPicks] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  // Pending setTimeouts so we can cancel them on unmount or reset.
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current.clear();
  }, []);

  // Use template language for in-game labels (Arabic content gets Arabic chrome).
  const lang = template?.language ?? uiLang;
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  const audio = useWheelAudio(soundOn);

  /* ── Load template ────────────────────────────────────────── */
  useEffect(() => {
    if (isNaN(templateId)) {
      setError(ar ? "معرّف غير صالح" : "Invalid template id");
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/wheel-templates/${templateId}`, { credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((t: Template) => {
        const segs = (t.segments || []).map((s, i) => ({
          ...s,
          color: s.color || WHEEL_PALETTE[i % WHEEL_PALETTE.length],
        }));
        setTemplate({ ...t, segments: segs });
        setScores(new Array(t.config.teamCount).fill(0));
        setSoundOn(t.config.soundOn);
      })
      .catch(() => setError(ar ? "تعذّر تحميل اللعبة" : "Failed to load game"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  /* ── Draw the wheel on canvas ─────────────────────────────── */
  const drawWheel = useCallback((rot: number) => {
    if (!template || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 12;
    const segs = template.segments;
    const n = segs.length;
    const arc = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, w, h);

    // Outer ring (gold)
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = BRAND_GOLD;
    ctx.fill();

    // Inner shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);

    segs.forEach((seg, i) => {
      const start = i * arc - Math.PI / 2 - arc / 2;
      const end = start + arc;
      const used = usedIds.has(seg.id);

      // Wedge fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = used ? "#3a3a3a" : (seg.color || WHEEL_PALETTE[i % WHEEL_PALETTE.length]);
      ctx.fill();

      // Wedge separator
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.stroke();

      // Wedge label (rotated to align with the wedge)
      ctx.save();
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = used ? "#888" : "#fff";
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";

      // Points on outer
      const pointsLabel = seg.kind === "bonus"
        ? (seg.bonusType === "double" ? "×2"
          : seg.bonusType === "skip" ? "→→"
          : seg.bonusType === "swap" ? "⇄"
          : seg.bonusType === "lose" ? "−½"
          : "★")
        : `${seg.points}`;
      ctx.fillText(pointsLabel, radius - 18, 0);

      // Truncated text on inner
      const text = seg.text || "";
      const maxLen = 22;
      const display = text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = used ? "#666" : "rgba(255,255,255,0.92)";
      ctx.fillText(display, radius - 70, 0);

      ctx.restore();
    });
    ctx.restore();

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy, 42);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.6, BRAND_GOLD);
    grad.addColorStop(1, "#8a6418");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = BRAND_PRIMARY;
    ctx.stroke();

    // Hub label — bilingual based on template language.
    ctx.fillStyle = BRAND_PRIMARY;
    ctx.font = "900 16px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(template.language === "ar" ? "حصاد" : "Hasad", cx, cy);
  }, [template, usedIds]);

  // Initial draw + redraw on rotation/used updates
  useEffect(() => {
    drawWheel(rotation);
  }, [drawWheel, rotation]);

  /* ── Spin animation ───────────────────────────────────────── */
  const spin = useCallback(() => {
    if (!template || spinning) return;
    const segs = template.segments;
    const available = segs.map((s, i) => i).filter(i => !usedIds.has(segs[i].id));
    if (available.length === 0) {
      setShowFinal(true);
      audio.playWin();
      return;
    }
    const targetIdx = available[Math.floor(Math.random() * available.length)];
    const arcDeg = 360 / segs.length;

    // Land target wedge under the top pointer (-90° in canvas).
    // Each wedge centre i sits at i*arcDeg from the top after a 0° rotation.
    // We want final rotation R such that (i*arcDeg + R) ≡ 0 (mod 360).
    const baseFinal = (360 - targetIdx * arcDeg) % 360;
    const fullSpins = 6 + Math.floor(Math.random() * 3); // 6..8 turns
    const start = rotation;
    const startNorm = ((start % 360) + 360) % 360;
    const finalAbsolute = start + (360 - startNorm) + fullSpins * 360 + baseFinal;

    const durationMs = (template.config.spinSeconds || 5) * 1000;
    const t0 = performance.now();
    setSpinning(true);
    setShowResult(false);
    setShowAnswer(false);
    setResultIndex(null);
    audio.startTicking(durationMs);

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = easeOutQuart(t);
      const current = start + (finalAbsolute - start) * eased;
      setRotation(current);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        audio.stopTicking();
        setResultIndex(targetIdx);
        setSwapPicks([]);
        setShowAnswer(false);
        // Slight delay so the wheel visibly settles before the modal opens.
        scheduleTimeout(() => setShowResult(true), 350);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [template, spinning, usedIds, rotation, audio, scheduleTimeout]);

  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    clearAllTimeouts();
  }, [clearAllTimeouts]);

  /* ── Scoring helpers ──────────────────────────────────────── */
  const awardPoints = (teamIdx: number, points: number) => {
    setScores(prev => {
      const next = [...prev];
      next[teamIdx] = Math.max(0, (next[teamIdx] ?? 0) + points);
      return next;
    });
  };

  // Apply the "double" multiplier to a question's payout, then reset it.
  const awardQuestionPoints = (teamIdx: number, basePoints: number) => {
    const total = basePoints * doubleMultiplier;
    awardPoints(teamIdx, total);
    if (doubleMultiplier !== 1) setDoubleMultiplier(1);
    return total;
  };

  // "lose" — chosen team loses half their score (rounded down).
  const applyLoseHalf = (teamIdx: number) => {
    const current = scores[teamIdx] ?? 0;
    const lost = Math.floor(current / 2);
    awardPoints(teamIdx, -lost);
    return lost;
  };

  // "swap" — pick exactly two teams, then swap their scores.
  const handleSwapPick = (teamIdx: number) => {
    setSwapPicks((prev) => {
      if (prev.includes(teamIdx)) return prev.filter((i) => i !== teamIdx);
      if (prev.length >= 2) return [prev[1], teamIdx];
      return [...prev, teamIdx];
    });
  };

  const applySwap = () => {
    if (swapPicks.length !== 2 || !template) return;
    const [a, b] = swapPicks;
    setScores((prev) => {
      const next = [...prev];
      const tmp = next[a];
      next[a] = next[b];
      next[b] = tmp;
      return next;
    });
    const an = template.config.teamNames[a];
    const bn = template.config.teamNames[b];
    toast.success(ar ? `تم تبادل نقاط ${an} و${bn}` : `Swapped scores between ${an} and ${bn}`);
    setSwapPicks([]);
  };

  // "skip" — mark a team to skip its next turn (visual badge only).
  const applySkip = (teamIdx: number) => {
    setSkippedTeams((prev) => {
      const next = new Set(prev);
      next.add(teamIdx);
      return next;
    });
  };

  // Clear a team's skip badge once the teacher acknowledges it has passed.
  const clearSkip = (teamIdx: number) => {
    setSkippedTeams((prev) => {
      const next = new Set(prev);
      next.delete(teamIdx);
      return next;
    });
  };

  const resolveAndClose = () => {
    if (resultIndex !== null && template) {
      const seg = template.segments[resultIndex];
      // Activate "double" *after* the bonus tile is consumed so it applies
      // to the next question, not this one.
      if (seg.kind === "bonus" && seg.bonusType === "double") {
        setDoubleMultiplier(2);
        toast.success(ar ? "النقاط مضاعفة في السؤال القادم!" : "Double points on the next question!");
      }
      setUsedIds(prev => {
        const next = new Set(prev);
        next.add(seg.id);
        return next;
      });
    }
    setShowResult(false);
    setShowAnswer(false);
    setResultIndex(null);
    setSwapPicks([]);
    // Auto-show end-of-game when no segments remain.
    if (template && usedIds.size + 1 >= template.segments.length) {
      scheduleTimeout(() => {
        setShowFinal(true);
        audio.playWin();
      }, 400);
    }
  };

  const resetGame = () => {
    if (!window.confirm(ar ? "إعادة بدء اللعبة؟ ستُمحى النقاط." : "Restart the game? Scores will reset.")) return;
    clearAllTimeouts();
    setScores(new Array(template?.config.teamCount ?? 2).fill(0));
    setUsedIds(new Set());
    setShowFinal(false);
    setShowResult(false);
    setResultIndex(null);
    setRotation(0);
    setDoubleMultiplier(1);
    setSkippedTeams(new Set());
    setSwapPicks([]);
  };

  /* ── Fullscreen ───────────────────────────────────────────── */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ── Sizing: square canvas that fits the column ───────────── */
  const wheelSize = useMemo(() => {
    if (typeof window === "undefined") return 560;
    const minDim = Math.min(window.innerWidth - 32, window.innerHeight - 240);
    return Math.max(320, Math.min(640, minDim));
  }, []);

  /* ── Renders ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div dir={dir} className="min-h-[100dvh] flex items-center justify-center text-white"
        style={{ background: "linear-gradient(180deg, #0a1f15 0%, #0f2a1c 100%)" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: BRAND_GOLD }} />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div dir={dir} className="min-h-[100dvh] flex items-center justify-center text-white p-6"
        style={{ background: "linear-gradient(180deg, #0a1f15 0%, #0f2a1c 100%)" }}>
        <div className="text-center">
          <p className="text-xl font-black mb-4">{error || (ar ? "غير موجود" : "Not found")}</p>
          <button
            onClick={() => setLocation("/teacher/dashboard")}
            className="px-5 py-2.5 rounded-xl font-bold"
            style={{ background: BRAND_GOLD, color: "#1a1a1a" }}
          >
            {ar ? "العودة" : "Back"}
          </button>
        </div>
      </div>
    );
  }

  const currentSeg = resultIndex !== null ? template.segments[resultIndex] : null;
  const segsLeft = template.segments.length - usedIds.size;
  const winnerIdx = scores.length === 0 ? -1 : scores.reduce((best, v, i) => v > scores[best] ? i : best, 0);

  return (
    <div
      dir={dir}
      className="min-h-[100dvh] text-white relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0a1f15 0%, #0f2a1c 60%, #07150e 100%)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setLocation("/teacher/dashboard")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="back"
          >
            <ArrowLeft className={`w-5 h-5 ${ar ? "rotate-180" : ""}`} />
          </button>
          <div className="min-w-0">
            <h1 className="font-black text-lg truncate">{template.title}</h1>
            <p className="text-xs text-white/60">
              {ar ? `${segsLeft} متبقية من ${template.segments.length}` : `${segsLeft} of ${template.segments.length} left`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundOn(s => !s)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="sound"
          >
            {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={resetGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="reset"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-4 p-4 max-w-7xl mx-auto">
        {/* Wheel column */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative" style={{ width: wheelSize, height: wheelSize + 40 }}>
            {/* Pointer */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 pointer-events-none">
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "18px solid transparent",
                  borderRight: "18px solid transparent",
                  borderTop: `30px solid ${BRAND_GOLD}`,
                  filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
                }}
              />
            </div>
            <canvas
              ref={canvasRef}
              width={wheelSize}
              height={wheelSize}
              className="block mt-6"
              style={{ width: wheelSize, height: wheelSize }}
            />
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={spinning || segsLeft === 0}
            className="mt-4 px-10 py-4 rounded-2xl font-black text-xl shadow-2xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})`,
              color: "#fff",
              border: `2px solid ${BRAND_GOLD}`,
            }}
          >
            {spinning
              ? <><Loader2 className="w-6 h-6 animate-spin" /> {ar ? "تدور…" : "Spinning…"}</>
              : segsLeft === 0
                ? <><Trophy className="w-6 h-6" /> {ar ? "انتهت اللعبة" : "Game Over"}</>
                : <><RotateCw className="w-6 h-6" /> {ar ? "أدر العجلة" : "Spin the Wheel"}</>}
          </button>
        </div>

        {/* Scoreboard column */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-4 self-start">
          <h2 className="text-sm font-black uppercase tracking-wider mb-3 flex items-center gap-2"
            style={{ color: BRAND_GOLD }}>
            <Trophy className="w-4 h-4" />
            {ar ? "النتائج" : "Scoreboard"}
          </h2>
          {doubleMultiplier > 1 && (
            <div
              className="mb-3 rounded-lg px-3 py-2 text-center text-xs font-black border-2 animate-pulse"
              style={{ background: `${BRAND_GOLD}25`, borderColor: BRAND_GOLD, color: BRAND_GOLD }}
            >
              ×{doubleMultiplier} {ar ? "النقاط مضاعفة في السؤال القادم" : "Points doubled on next question"}
            </div>
          )}
          <div className="space-y-2">
            {template.config.teamNames.map((name, i) => {
              const score = scores[i] ?? 0;
              const isLeader = score > 0 && i === winnerIdx;
              const color = WHEEL_PALETTE[i % WHEEL_PALETTE.length];
              return (
                <div
                  key={i}
                  className="rounded-xl p-3 border-2 transition-all"
                  style={{
                    background: isLeader ? `${color}30` : "rgba(255,255,255,0.04)",
                    borderColor: isLeader ? color : "rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                      <span className="font-black truncate">{name}</span>
                      {isLeader && <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: BRAND_GOLD }} />}
                      {skippedTeams.has(i) && (
                        <button
                          type="button"
                          onClick={() => clearSkip(i)}
                          title={ar ? "اضغط للإلغاء" : "Click to clear"}
                          className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md border"
                          style={{ borderColor: "#fca5a5", color: "#fca5a5", background: "rgba(239,68,68,0.12)" }}
                        >
                          {ar ? "تخطّي ⏭" : "Skip ⏭"}
                        </button>
                      )}
                    </div>
                    <span className="text-2xl font-black tabular-nums" style={{ color: isLeader ? BRAND_GOLD : "#fff" }}>
                      {score}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[50, 100, 200, -50].map(p => (
                      <button
                        key={p}
                        onClick={() => awardPoints(i, p)}
                        className="flex-1 text-[11px] font-bold py-1 rounded-md transition-colors"
                        style={{
                          background: p > 0 ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.15)",
                          color: p > 0 ? "#fff" : "#fca5a5",
                        }}
                      >
                        {p > 0 ? `+${p}` : p}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Result modal — shown after spin lands */}
      <AnimatePresence>
        {showResult && currentSeg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
              style={{ background: "#0f2a1c", border: `2px solid ${currentSeg.color || BRAND_GOLD}` }}
            >
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ background: currentSeg.color }}
              >
                <div className="flex items-center gap-3">
                  {currentSeg.kind === "bonus"
                    ? <Gift className="w-6 h-6 text-white" />
                    : <Sparkles className="w-6 h-6 text-white" />}
                  <span className="font-black text-white text-lg">
                    {currentSeg.kind === "bonus"
                      ? (ar ? "قطاع مكافأة!" : "Bonus Segment!")
                      : `${currentSeg.points} ${ar ? "نقطة" : "points"}`}
                  </span>
                </div>
                <button
                  onClick={resolveAndClose}
                  className="p-2 rounded-lg hover:bg-black/20 text-white"
                  aria-label="close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-white">
                {currentSeg.kind === "question" ? (
                  <>
                    <p className="text-2xl font-black leading-relaxed">{currentSeg.text}</p>
                    {showAnswer ? (
                      <div className="rounded-xl p-4 border-2"
                        style={{ background: `${BRAND_GOLD}15`, borderColor: `${BRAND_GOLD}66` }}>
                        <p className="text-xs font-black uppercase tracking-wider mb-1.5"
                          style={{ color: BRAND_GOLD }}>
                          {ar ? "الإجابة" : "Answer"}
                        </p>
                        <p className="text-xl font-black">{currentSeg.answer || "—"}</p>
                        {currentSeg.explanation && (
                          <p className="text-sm mt-2 text-white/80 leading-relaxed">
                            {currentSeg.explanation}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-2"
                        style={{ background: BRAND_GOLD, color: "#1a1a1a" }}
                      >
                        <Eye className="w-5 h-5" />
                        {ar ? "اكشف الإجابة" : "Reveal Answer"}
                      </button>
                    )}

                    <div>
                      <p className="text-sm font-bold mb-2 text-white/70">
                        {ar ? "امنح النقاط لأحد الفرق:" : "Award points to a team:"}
                        {doubleMultiplier > 1 && (
                          <span className="ms-2 inline-block px-2 py-0.5 rounded-md text-[11px] font-black"
                            style={{ background: BRAND_GOLD, color: "#1a1a1a" }}>
                            ×{doubleMultiplier}
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {template.config.teamNames.map((name, i) => {
                          const total = currentSeg.points * doubleMultiplier;
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                const awarded = awardQuestionPoints(i, currentSeg.points);
                                toast.success(ar ? `+${awarded} لـ ${name}` : `+${awarded} to ${name}`);
                              }}
                              className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform"
                              style={{
                                borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                background: `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                color: "#fff",
                              }}
                            >
                              +{total} · {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black leading-relaxed">{currentSeg.text}</p>
                    {currentSeg.bonusType && (
                      <div className="rounded-xl p-4 border-2"
                        style={{ background: `${BRAND_GOLD}15`, borderColor: `${BRAND_GOLD}66` }}>
                        <p className="text-base font-black mb-1" style={{ color: BRAND_GOLD }}>
                          {bonusInfo(currentSeg.bonusType, lang).title}
                        </p>
                        <p className="text-sm text-white/85 leading-relaxed">
                          {bonusInfo(currentSeg.bonusType, lang).desc}
                        </p>
                      </div>
                    )}

                    {/* lucky → straight bonus points to a chosen team */}
                    {currentSeg.bonusType === "lucky" && currentSeg.points > 0 && (
                      <div>
                        <p className="text-sm font-bold mb-2 text-white/70">
                          {ar ? "اختر الفريق المحظوظ:" : "Pick the lucky team:"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {template.config.teamNames.map((name, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                awardPoints(i, currentSeg.points);
                                toast.success(ar ? `+${currentSeg.points} لـ ${name}` : `+${currentSeg.points} to ${name}`);
                              }}
                              className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform"
                              style={{
                                borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                background: `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                color: "#fff",
                              }}
                            >
                              <Plus className="inline w-3 h-3 mb-0.5" />
                              {currentSeg.points} · {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* lose → always available regardless of points */}
                    {currentSeg.bonusType === "lose" && (
                      <div>
                        <p className="text-sm font-bold mb-2 text-white/70">
                          {ar ? "اختر الفريق الذي يخسر نصف نقاطه:" : "Pick the team that loses half:"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {template.config.teamNames.map((name, i) => {
                            const lostPreview = Math.floor((scores[i] ?? 0) / 2);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const lost = applyLoseHalf(i);
                                  toast.success(ar ? `−${lost} من ${name}` : `−${lost} from ${name}`);
                                }}
                                className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform"
                                style={{
                                  borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                  background: `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                  color: "#fff",
                                }}
                              >
                                <Minus className="inline w-3 h-3 mb-0.5" />
                                {lostPreview} · {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* skip → mark a team to lose its next turn (visual badge) */}
                    {currentSeg.bonusType === "skip" && (
                      <div>
                        <p className="text-sm font-bold mb-2 text-white/70">
                          {ar ? "اختر الفريق الذي يخسر دوره القادم:" : "Pick the team that skips its next turn:"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {template.config.teamNames.map((name, i) => {
                            const isMarked = skippedTeams.has(i);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  applySkip(i);
                                  toast.success(ar ? `سيُتخطّى دور ${name}` : `${name}'s turn will be skipped`);
                                }}
                                disabled={isMarked}
                                className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                  background: `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                  color: "#fff",
                                }}
                              >
                                ⏭ {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* swap → pick exactly two teams, confirm to swap their scores */}
                    {currentSeg.bonusType === "swap" && (
                      <div>
                        <p className="text-sm font-bold mb-2 text-white/70">
                          {ar
                            ? `اختر فريقين لتبادل نقاطهما (${swapPicks.length}/2):`
                            : `Pick two teams whose scores will swap (${swapPicks.length}/2):`}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {template.config.teamNames.map((name, i) => {
                            const picked = swapPicks.includes(i);
                            return (
                              <button
                                key={i}
                                onClick={() => handleSwapPick(i)}
                                className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform"
                                style={{
                                  borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                  background: picked
                                    ? WHEEL_PALETTE[i % WHEEL_PALETTE.length]
                                    : `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                  color: "#fff",
                                  outline: picked ? `3px solid ${BRAND_GOLD}` : "none",
                                }}
                              >
                                {picked ? "✓ " : ""}{name} · {scores[i] ?? 0}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={applySwap}
                          disabled={swapPicks.length !== 2}
                          className="w-full mt-3 py-2.5 rounded-xl font-black border-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD, background: `${BRAND_GOLD}15` }}
                        >
                          ⇄ {ar ? "نفّذ التبادل" : "Swap Now"}
                        </button>
                      </div>
                    )}

                    {/* double → no team picker; multiplier activates on close */}
                    {currentSeg.bonusType === "double" && (
                      <div className="rounded-xl p-3 border text-center text-sm"
                        style={{ borderColor: `${BRAND_GOLD}66`, background: `${BRAND_GOLD}10`, color: "#fff" }}>
                        {ar
                          ? "ستُفعَّل المضاعفة تلقائياً عند المتابعة."
                          : "The multiplier will activate automatically when you continue."}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={resolveAndClose}
                  className="w-full py-3 rounded-xl font-black border-2"
                  style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }}
                >
                  {ar ? "متابعة ←" : "Continue →"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End-of-game modal */}
      <AnimatePresence>
        {showFinal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl"
              style={{
                background: `linear-gradient(160deg, ${BRAND_PRIMARY}, #0f2a1c)`,
                border: `3px solid ${BRAND_GOLD}`,
              }}
            >
              <Trophy className="w-20 h-20 mx-auto mb-3" style={{ color: BRAND_GOLD }} />
              <h2 className="text-3xl font-black mb-1">
                {ar ? "انتهت اللعبة!" : "Game Over!"}
              </h2>
              {scores[winnerIdx] > 0 ? (
                <>
                  <p className="text-white/80 mb-4">
                    {ar ? "الفائز:" : "Winner:"}
                  </p>
                  <p className="text-4xl font-black mb-2" style={{ color: BRAND_GOLD }}>
                    {template.config.teamNames[winnerIdx]}
                  </p>
                  <p className="text-2xl font-black mb-6">
                    {scores[winnerIdx]} {ar ? "نقطة" : "points"}
                  </p>
                </>
              ) : (
                <p className="text-white/80 mb-6">
                  {ar ? "لم يحرز أي فريق نقاطاً." : "No team scored any points."}
                </p>
              )}
              <div className="space-y-2">
                <button
                  onClick={() => { setShowFinal(false); resetGame(); }}
                  className="w-full py-3 rounded-xl font-black"
                  style={{ background: BRAND_GOLD, color: "#1a1a1a" }}
                >
                  {ar ? "العب مجدّداً" : "Play Again"}
                </button>
                <button
                  onClick={() => setLocation("/teacher/dashboard")}
                  className="w-full py-3 rounded-xl font-black border-2"
                  style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }}
                >
                  {ar ? "العودة للوحة" : "Back to Dashboard"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
