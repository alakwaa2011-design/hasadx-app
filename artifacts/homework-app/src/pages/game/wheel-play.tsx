import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowLeft, RotateCw, Volume2, VolumeX, Trophy, X,
  Eye, Plus, Minus, Sparkles, Gift, RefreshCw, Maximize2, Minimize2,
  Link2, Copy, Check, Pencil,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { playVictoryFanfare, playCorrectSound, playGiftSound, playNotificationSound } from "@/lib/game-sounds";
import { resolveImageUrl } from "@/lib/image-url";
import { useWheelAudio } from "@/lib/wheel-audio";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

const WHEEL_PALETTE = [
  "#225739", "#D9A521", "#3a7a55", "#c47e2c",
  "#1f4d3a", "#e6b54f", "#2d6a4f", "#b08440",
];

type BonusType = "double" | "skip" | "swap" | "lucky" | "lose";
type TurnMode = "team_first" | "wheel_first";
type PointsMode = "uniform" | "varied";

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
  turnMode?: TurnMode;
  pointsMode?: PointsMode;
  uniformPoints?: number;
}

interface Template {
  id: number;
  title: string;
  language: "ar" | "en";
  segments: Segment[];
  config: WheelConfig;
  isOwn?: boolean;
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

export default function WheelPlay() {
  const { lang: uiLang } = useI18n();
  const params = useParams<{ id?: string; token?: string }>();
  const [, setLocation] = useLocation();
  const directToken = params.token;
  const isDirectPlay = typeof directToken === "string" && directToken.length > 0;
  const templateId = parseInt(params.id || "", 10);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<number[]>([]);
  // Local-only team names for this play session — never written back to the
  // template, so a guest opening a shared link can rename teams without
  // needing edit rights on the owner's saved wheel.
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [editingTeamIdx, setEditingTeamIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [directPlayLink, setDirectPlayLink] = useState<string | null>(null);
  const [directLinkLoading, setDirectLinkLoading] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; color: string; delay: number; dur: number; size: number; rot: number }[]>([]);

  // Pending bonus modifiers — applied to the *next* question that resolves.
  const [doubleMultiplier, setDoubleMultiplier] = useState(1);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number | null>(null);
  const [questionAwarded, setQuestionAwarded] = useState(false);
  // Teams whose next turn is skipped. Team-first mode consumes these marks
  // automatically while it advances to the next eligible team.
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
    if (!isDirectPlay && isNaN(templateId)) {
      setError(uiLang === "ar" ? "معرّف غير صالح" : "Invalid template id");
      setLoading(false);
      return;
    }
    const url = isDirectPlay
      ? `${API_BASE}/api/play/${encodeURIComponent(directToken!)}/wheel`
      : `${API_BASE}/api/wheel-templates/${templateId}`;
    fetch(url, isDirectPlay ? undefined : { credentials: "include" })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || "not found");
        return data;
      })
      .then((t: Template) => {
        const segs = (t.segments || []).map((s, i) => ({
          ...s,
          color: s.color || WHEEL_PALETTE[i % WHEEL_PALETTE.length],
        }));
        // Missing fields mean this was saved before turn/points modes existed.
        // Preserve the old UI's wheel-first, segment-specific behavior.
        const config: WheelConfig = {
          ...t.config,
          turnMode: t.config.turnMode ?? "wheel_first",
          pointsMode: t.config.pointsMode ?? "varied",
          uniformPoints: t.config.uniformPoints ?? 100,
        };
        setTemplate({ ...t, segments: segs, config });
        setScores(new Array(config.teamCount).fill(0));
        setTeamNames(config.teamNames);
        setSoundOn(config.soundOn);
        setActiveTeamIndex(config.turnMode === "team_first" ? 0 : null);
      })
      .catch((loadErr: unknown) => {
        const message = loadErr instanceof Error ? loadErr.message : "";
        setError(message && message !== "not found"
          ? message
          : (uiLang === "ar" ? "تعذّر تحميل اللعبة" : "Failed to load game"));
      })
      .finally(() => setLoading(false));
  }, [directToken, isDirectPlay, templateId, uiLang]);

  const createOrCopyDirectPlayLink = useCallback(async () => {
    if (isDirectPlay || isNaN(templateId)) return;

    if (directPlayLink) {
      try {
        await navigator.clipboard.writeText(directPlayLink);
        toast.success(ar ? "تم نسخ رابط اللعبة" : "Game link copied");
      } catch {
        toast.error(ar ? "تعذّر نسخ الرابط" : "Could not copy the link");
      }
      return;
    }

    setDirectLinkLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/wheel-templates/${templateId}/play-links`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.token !== "string") {
        toast.error(data.message || (ar ? "تعذّر إنشاء الرابط المباشر" : "Could not create the direct link"));
        return;
      }
      const link = `${window.location.origin}/play/${data.token}`;
      setDirectPlayLink(link);
      try {
        await navigator.clipboard.writeText(link);
        toast.success(ar ? "تم إنشاء الرابط ونسخه" : "Direct link created and copied");
      } catch {
        toast.success(ar ? "تم إنشاء الرابط المباشر" : "Direct link created");
      }
    } catch {
      toast.error(ar ? "تعذّر إنشاء الرابط المباشر" : "Could not create the direct link");
    } finally {
      setDirectLinkLoading(false);
    }
  }, [ar, directPlayLink, isDirectPlay, templateId]);

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

      // Keep the label's position in its own wedge, then flip only the text
      // baseline on the left side. Rotating the whole drawing context by PI
      // would move the label into the opposite wedge.
      const midAngle = start + arc / 2;
      const textFlip = Math.cos(midAngle) < 0 ? Math.PI : 0;
      const drawRadialLabel = (value: string, distance: number, offset = 0) => {
        ctx.save();
        ctx.translate(Math.cos(midAngle) * distance, Math.sin(midAngle) * distance);
        ctx.rotate(midAngle + textFlip);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value, 0, offset);
        ctx.restore();
      };

      // Keep numeric point values out of the wheel. They compete with the
      // question text and remain clearly visible in the result dialog and
      // team score cards. Bonus tiles retain a short visual marker.
      if (seg.kind === "bonus") {
        const bonusMarker = seg.bonusType === "double" ? "×2"
          : seg.bonusType === "skip" ? "→→"
          : seg.bonusType === "swap" ? "⇄"
          : seg.bonusType === "lose" ? "−½"
          : "★";
        ctx.fillStyle = used ? "#888" : "#fff";
        ctx.font = "900 20px system-ui, -apple-system, sans-serif";
        drawRadialLabel(bonusMarker, radius - 25);
      }

      // Use two balanced preview lines instead of one long, uneven strip.
      // The question itself remains fully visible in the result dialog.
      const text = seg.text || "";
      const textSize = n <= 6 ? 18 : n <= 10 ? 16 : n <= 14 ? 14 : 12;
      ctx.font = `800 ${textSize}px system-ui, -apple-system, sans-serif`;
      const maxLabelWidth = Math.max(86, Math.min(210, radius * (n <= 6 ? 0.66 : n <= 10 ? 0.58 : 0.5)));
      const words = text.trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxLabelWidth || !line) {
          line = candidate;
          continue;
        }
        lines.push(line);
        line = word;
        if (lines.length === 2) break;
      }
      if (line && lines.length < 2) lines.push(line);
      const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
      if (consumedWords < words.length && lines.length > 0) {
        let lastLine = lines[lines.length - 1];
        while (lastLine.length > 1 && ctx.measureText(`${lastLine}…`).width > maxLabelWidth) {
          lastLine = lastLine.slice(0, -1);
        }
        lines[lines.length - 1] = `${lastLine}…`;
      }
      ctx.fillStyle = used ? "#666" : "rgba(255,255,255,0.92)";
      const lineHeight = textSize * 1.12;
      lines.slice(0, 2).forEach((label, lineIndex) => {
        drawRadialLabel(label, radius * 0.56, (lineIndex - (Math.min(lines.length, 2) - 1) / 2) * lineHeight);
      });
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
    ctx.fillText(template.language === "ar" ? "حصاد" : "Hasaad", cx, cy);
  }, [template, usedIds]);

  // Initial draw + redraw on rotation/used updates
  useEffect(() => {
    drawWheel(rotation);
  }, [drawWheel, rotation]);

  /* ── Spin animation ───────────────────────────────────────── */
  const spin = useCallback(() => {
    if (!template || spinning) return;
    const turnMode = template.config.turnMode ?? "wheel_first";
    if (turnMode === "team_first" && activeTeamIndex === null) {
      toast.error(ar ? "اختر الفريق صاحب الدور أولاً" : "Choose the active team first");
      return;
    }
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
    setQuestionAwarded(false);
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
        scheduleTimeout(() => {
          setShowResult(true);
          if (soundOn) playNotificationSound();
        }, 350);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [template, spinning, usedIds, rotation, audio, scheduleTimeout, activeTeamIndex, ar]);

  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    clearAllTimeouts();
  }, [clearAllTimeouts]);

  /* ── Victory celebration ──────────────────────────────────── */
  useEffect(() => {
    if (!showFinal) return;
    if (soundOn) playVictoryFanfare();
    const COLORS = ["#D9A521", "#ffffff", "#ff4d4d", "#4dff91", "#4db8ff", "#ffb347", "#e040fb", "#225739"];
    const pieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 1.2,
      dur: 2.0 + Math.random() * 2.5,
      size: 7 + Math.random() * 10,
      rot: Math.random() * 360,
    }));
    setConfetti(pieces);
    const t = setTimeout(() => setConfetti([]), 5000);
    return () => clearTimeout(t);
  }, [showFinal]);

  /* ── Scoring helpers ──────────────────────────────────────── */
  const awardPoints = (teamIdx: number, points: number) => {
    setScores(prev => {
      const next = [...prev];
      next[teamIdx] = Math.max(0, (next[teamIdx] ?? 0) + points);
      return next;
    });
    if (soundOn && points > 0) playGiftSound();
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
    const an = teamNames[a];
    const bn = teamNames[b];
    toast.success(ar ? `تم تبادل نقاط ${an} و${bn}` : `Swapped scores between ${an} and ${bn}`);
    setSwapPicks([]);
  };

  // "skip" — mark a team to skip its next turn.
  const applySkip = (teamIdx: number) => {
    setSkippedTeams((prev) => {
      const next = new Set(prev);
      next.add(teamIdx);
      return next;
    });
  };

  // Remove a pending skip after it has been consumed or cleared manually.
  const clearSkip = (teamIdx: number) => {
    setSkippedTeams((prev) => {
      const next = new Set(prev);
      next.delete(teamIdx);
      return next;
    });
  };

  const advanceActiveTeam = () => {
    if (!template || template.config.turnMode !== "team_first") return;
    const count = template.config.teamCount;
    let next = ((activeTeamIndex ?? -1) + 1 + count) % count;
    const consumedSkips: number[] = [];
    for (let attempt = 0; attempt < count - 1 && skippedTeams.has(next); attempt += 1) {
      consumedSkips.push(next);
      next = (next + 1) % count;
    }
    if (consumedSkips.length > 0) {
      setSkippedTeams((previous) => {
        const updated = new Set(previous);
        consumedSkips.forEach((teamIdx) => updated.delete(teamIdx));
        return updated;
      });
    }
    setActiveTeamIndex(next);
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
    setQuestionAwarded(false);
    advanceActiveTeam();
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
    setQuestionAwarded(false);
    setEditingTeamIdx(null);
    setActiveTeamIndex(template?.config.turnMode === "team_first" ? 0 : null);
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
    const sideReserve = window.innerWidth >= 1024 ? 420 : 32;
    const minDim = Math.min(window.innerWidth - sideReserve, window.innerHeight - 220);
    return Math.max(280, Math.min(620, minDim));
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
          {!isDirectPlay && (
            <button
              onClick={() => setLocation("/teacher")}
              className="px-5 py-2.5 rounded-xl font-bold"
              style={{ background: BRAND_GOLD, color: "#1a1a1a" }}
            >
              {ar ? "العودة" : "Back"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentSeg = resultIndex !== null ? template.segments[resultIndex] : null;
  const segsLeft = template.segments.length - usedIds.size;
  const winnerIdx = scores.length === 0 ? -1 : scores.reduce((best, v, i) => v > scores[best] ? i : best, 0);
  const turnMode = template.config.turnMode ?? "wheel_first";
  const isTeamFirst = turnMode === "team_first";
  const pointsMode = template.config.pointsMode ?? "varied";
  const pointsForQuestion = (segment: Segment) =>
    pointsMode === "uniform" ? (template.config.uniformPoints ?? 100) : segment.points;
  const activeTeamName = activeTeamIndex === null ? null : teamNames[activeTeamIndex];

  const awardCurrentTeamQuestion = () => {
    if (!currentSeg || currentSeg.kind !== "question" || activeTeamIndex === null || questionAwarded) return;
    const awarded = awardQuestionPoints(activeTeamIndex, pointsForQuestion(currentSeg));
    setQuestionAwarded(true);
    toast.success(ar
      ? `+${awarded} لـ ${teamNames[activeTeamIndex]}`
      : `+${awarded} to ${teamNames[activeTeamIndex]}`);
  };

  const commitTeamNameEdit = (teamIdx: number) => {
    const trimmed = editingValue.trim();
    if (trimmed) {
      setTeamNames((prev) => {
        const next = [...prev];
        next[teamIdx] = trimmed;
        return next;
      });
    }
    setEditingTeamIdx(null);
  };

  const renderTeamCard = (teamIdx: number, compact = false) => {
    const name = teamNames[teamIdx];
    const score = scores[teamIdx] ?? 0;
    const color = WHEEL_PALETTE[teamIdx % WHEEL_PALETTE.length];
    const isLeader = score > 0 && teamIdx === winnerIdx;
    const isActive = isTeamFirst && activeTeamIndex === teamIdx;
    const canChooseTurn = isTeamFirst && !spinning && !showResult && !showFinal && !skippedTeams.has(teamIdx);
    return (
      <div
        key={teamIdx}
        dir={dir}
        role={canChooseTurn ? "button" : undefined}
        tabIndex={canChooseTurn ? 0 : undefined}
        onClick={() => canChooseTurn && setActiveTeamIndex(teamIdx)}
        onKeyDown={(event) => {
          if (canChooseTurn && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setActiveTeamIndex(teamIdx);
          }
        }}
        className={`rounded-2xl border-2 transition-all ${canChooseTurn ? "cursor-pointer hover:-translate-y-0.5" : ""} ${compact ? "p-3" : "p-4 sm:p-5"}`}
        style={{
          background: isActive ? `linear-gradient(145deg, ${color}45, rgba(7,21,14,0.94))` : "rgba(255,255,255,0.045)",
          borderColor: isActive ? BRAND_GOLD : (isLeader ? color : "rgba(255,255,255,0.12)"),
          borderWidth: isActive ? 3 : 2,
          boxShadow: isActive ? `0 0 0 3px ${BRAND_GOLD}55, 0 14px 30px ${BRAND_GOLD}22` : "none",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5 flex-1">
            <span className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_10px_currentColor]" style={{ color, background: color }} />
            {editingTeamIdx === teamIdx ? (
              <input
                autoFocus
                value={editingValue}
                maxLength={30}
                onChange={(event) => setEditingValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => commitTeamNameEdit(teamIdx)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") { event.preventDefault(); commitTeamNameEdit(teamIdx); }
                  if (event.key === "Escape") { event.preventDefault(); setEditingTeamIdx(null); }
                }}
                className={`font-black bg-transparent border-b outline-none min-w-0 flex-1 ${compact ? "text-sm" : "text-base sm:text-lg"}`}
                style={{ borderColor: BRAND_GOLD, color: "#fff" }}
              />
            ) : (
              <>
                <span className={`font-black truncate ${compact ? "text-sm" : "text-base sm:text-lg"}`}>{name}</span>
                {isLeader && <Sparkles className="w-4 h-4 shrink-0" style={{ color: BRAND_GOLD }} />}
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setEditingValue(name); setEditingTeamIdx(teamIdx); }}
                  className="p-1 rounded-md hover:bg-white/10 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={ar ? "تعديل اسم الفريق" : "Edit team name"}
                  title={ar ? "تعديل اسم الفريق" : "Edit team name"}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <span className={`${compact ? "text-xl" : "text-3xl sm:text-4xl"} font-black tabular-nums shrink-0`} style={{ color: isLeader || isActive ? BRAND_GOLD : "#fff" }}>{score}</span>
        </div>
        {isActive && (
          <div className="mt-3 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-black border"
            style={{ color: BRAND_GOLD, borderColor: `${BRAND_GOLD}88`, background: `${BRAND_GOLD}16` }}>
            {ar ? "الدور الآن" : "TURN NOW"}
          </div>
        )}
        {skippedTeams.has(teamIdx) && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); clearSkip(teamIdx); }}
            title={ar ? "اضغط للإلغاء" : "Click to clear"}
            className="mt-2 w-full text-[10px] font-black px-1.5 py-1 rounded-md border"
            style={{ borderColor: "#fca5a5", color: "#fca5a5", background: "rgba(239,68,68,0.12)" }}
          >
            {ar ? "تخطّي الدور ⏭" : "SKIP TURN ⏭"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      dir={dir}
      className="min-h-[100dvh] text-white relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0a1f15 0%, #0f2a1c 60%, #07150e 100%)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          {!isDirectPlay && (
            <button
              onClick={() => setLocation("/teacher")}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="back"
            >
              <ArrowLeft className={`w-5 h-5 ${ar ? "rotate-180" : ""}`} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-black text-lg truncate">{template.title}</h1>
            <p className="text-xs text-white/60">
              {ar ? `${segsLeft} متبقية من ${template.segments.length}` : `${segsLeft} of ${template.segments.length} left`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isDirectPlay && template.isOwn !== false && (
            <button
              type="button"
              onClick={createOrCopyDirectPlayLink}
              disabled={directLinkLoading}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
              style={{
                color: BRAND_GOLD,
                background: `${BRAND_GOLD}18`,
                border: `1px solid ${BRAND_GOLD}88`,
              }}
              title={ar ? "إنشاء ونسخ رابط اللعب المباشر" : "Create and copy direct play link"}
            >
              {directLinkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : directPlayLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {directLinkLoading
                  ? (ar ? "جارٍ إنشاء الرابط…" : "Creating…")
                  : directPlayLink
                    ? (ar ? "نسخ رابط اللعبة" : "Copy game link")
                    : (ar ? "رابط لعب مباشر" : "Direct link")}
              </span>
            </button>
          )}
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

      {/* Game arena: primary teams frame the wheel, extra teams stay compact below. */}
      <main className="relative max-w-[1440px] mx-auto p-3 sm:p-5">
        <div className="absolute inset-x-1/4 top-10 h-64 pointer-events-none blur-3xl opacity-30" style={{ background: `radial-gradient(circle, ${BRAND_GOLD}, transparent 68%)` }} />
        <div className="relative rounded-[2rem] border border-white/10 bg-black/10 p-3 sm:p-5 backdrop-blur-sm">
          <div className="mx-auto mb-3 max-w-xl rounded-2xl border px-4 py-3.5 text-center"
            style={{ borderColor: isTeamFirst ? `${BRAND_GOLD}99` : "rgba(255,255,255,0.14)", background: isTeamFirst ? `${BRAND_GOLD}12` : "rgba(255,255,255,0.04)" }}>
            {isTeamFirst ? (
              <p className="text-lg sm:text-xl leading-relaxed font-black">
                <span style={{ color: BRAND_GOLD }}>{ar ? "الدور الآن:" : "TURN NOW:"}</span>{" "}
                <span className="font-black">{activeTeamName ?? (ar ? "اختر فريقاً" : "Choose a team")}</span>
              </p>
            ) : (
              <p className="text-xs sm:text-sm font-bold text-white/80">{ar ? "أدر العجلة ثم اختر الفريق الذي سيجيب" : "Spin the wheel, then choose the team that answers"}</p>
            )}
          </div>

          {doubleMultiplier > 1 && (
            <div className="mx-auto mb-3 max-w-xl rounded-xl px-3 py-2 text-center text-xs font-black border-2 animate-pulse"
              style={{ background: `${BRAND_GOLD}25`, borderColor: BRAND_GOLD, color: BRAND_GOLD }}>
              ×{doubleMultiplier} {ar ? "النقاط مضاعفة في السؤال القادم" : "Points doubled on next question"}
            </div>
          )}

          <div dir="ltr" className="grid grid-cols-1 lg:grid-cols-[minmax(180px,0.72fr)_minmax(320px,2fr)_minmax(180px,0.72fr)] items-center gap-3 sm:gap-5">
            <aside className="order-2 lg:order-1">{renderTeamCard(0)}</aside>

            <section className="order-1 lg:order-2 flex flex-col items-center justify-center py-1" dir={dir}>
              <div className="relative" style={{ width: wheelSize, height: wheelSize + 40 }}>
                <div className="absolute inset-3 rounded-full pointer-events-none" style={{ boxShadow: `0 0 45px ${BRAND_GOLD}55, 0 0 100px ${BRAND_PRIMARY}55` }} />
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
                  className="relative block mt-6 rounded-full"
                  style={{ width: wheelSize, height: wheelSize }}
                />
              </div>

              <button
                type="button"
                onClick={spin}
                disabled={spinning || segsLeft === 0 || (isTeamFirst && activeTeamIndex === null)}
                className="mt-4 px-7 sm:px-10 py-3.5 rounded-2xl font-black text-lg sm:text-xl shadow-2xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
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
            </section>

            <aside className="order-3">{renderTeamCard(1)}</aside>
          </div>

          {teamNames.length > 2 && (
            <section className="mt-4 pt-4 border-t border-white/10" dir={dir}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Trophy className="w-4 h-4" style={{ color: BRAND_GOLD }} />
                <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: BRAND_GOLD }}>
                  {ar ? "الفرق الإضافية" : "Additional teams"}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {teamNames.slice(2).map((_, index) => renderTeamCard(index + 2, true))}
              </div>
            </section>
          )}
        </div>
      </main>

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
                      : `${pointsForQuestion(currentSeg)} ${ar ? "نقطة" : "points"}`}
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
                    {currentSeg.imageUrl && (
                      <div className="flex justify-center mt-2">
                        <img src={resolveImageUrl(currentSeg.imageUrl) ?? ""} alt="" className="rounded-lg object-contain" style={{ maxHeight: "clamp(90px,20vh,200px)", maxWidth: "80%" }} />
                      </div>
                    )}
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
                        onClick={() => { setShowAnswer(true); if (soundOn) playCorrectSound(); }}
                        className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-2"
                        style={{ background: BRAND_GOLD, color: "#1a1a1a" }}
                      >
                        <Eye className="w-5 h-5" />
                        {ar ? "اكشف الإجابة" : "Reveal Answer"}
                      </button>
                    )}

                    {isTeamFirst ? (
                      <div className="rounded-2xl border p-3.5" style={{ borderColor: `${BRAND_GOLD}66`, background: `${BRAND_GOLD}0d` }}>
                        <p className="text-sm font-bold text-white/80 text-center">
                          {ar ? "النقاط الصحيحة تُمنح للفريق صاحب الدور فقط:" : "Correct points go only to the active team:"}
                          {doubleMultiplier > 1 && (
                            <span className="ms-2 inline-block px-2 py-0.5 rounded-md text-[11px] font-black"
                              style={{ background: BRAND_GOLD, color: "#1a1a1a" }}>
                              ×{doubleMultiplier}
                            </span>
                          )}
                        </p>
                        <button
                          type="button"
                          disabled={activeTeamIndex === null || questionAwarded}
                          onClick={awardCurrentTeamQuestion}
                          className="mt-3 w-full rounded-xl py-3 px-4 text-base font-black border-2 disabled:opacity-55 disabled:cursor-not-allowed"
                          style={{
                            borderColor: activeTeamIndex === null ? "rgba(255,255,255,0.2)" : WHEEL_PALETTE[activeTeamIndex % WHEEL_PALETTE.length],
                            background: activeTeamIndex === null ? "rgba(255,255,255,0.06)" : `${WHEEL_PALETTE[activeTeamIndex % WHEEL_PALETTE.length]}45`,
                            color: "#fff",
                          }}
                        >
                          {questionAwarded
                            ? (ar ? `تم منح النقاط لـ ${activeTeamName}` : `Points awarded to ${activeTeamName}`)
                            : activeTeamIndex === null
                              ? (ar ? "لا يوجد فريق نشط" : "No active team")
                              : `+${pointsForQuestion(currentSeg) * doubleMultiplier} · ${activeTeamName}`}
                        </button>
                      </div>
                    ) : (
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
                          {teamNames.map((name, i) => {
                            const total = pointsForQuestion(currentSeg) * doubleMultiplier;
                            return (
                              <button
                                type="button"
                                key={i}
                                disabled={questionAwarded}
                                onClick={() => {
                                  if (questionAwarded) return;
                                  const awarded = awardQuestionPoints(i, pointsForQuestion(currentSeg));
                                  setQuestionAwarded(true);
                                  toast.success(ar ? `+${awarded} لـ ${name}` : `+${awarded} to ${name}`);
                                }}
                                className="rounded-xl py-2.5 px-3 text-sm font-bold border-2 hover:scale-[1.02] transition-transform disabled:opacity-55 disabled:cursor-not-allowed"
                                style={{
                                  borderColor: WHEEL_PALETTE[i % WHEEL_PALETTE.length],
                                  background: `${WHEEL_PALETTE[i % WHEEL_PALETTE.length]}30`,
                                  color: "#fff",
                                }}
                              >
                                {questionAwarded ? (ar ? "تم منح النقاط" : "Points awarded") : `+${total} · ${name}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black leading-relaxed">{currentSeg.text}</p>
                    {currentSeg.imageUrl && (
                      <div className="flex justify-center mt-2">
                        <img src={resolveImageUrl(currentSeg.imageUrl) ?? ""} alt="" className="rounded-lg object-contain" style={{ maxHeight: "clamp(90px,20vh,200px)", maxWidth: "80%" }} />
                      </div>
                    )}
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
                          {teamNames.map((name, i) => (
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
                          {teamNames.map((name, i) => {
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
                          {teamNames.map((name, i) => {
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
                          {teamNames.map((name, i) => {
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

      {/* Confetti particles */}
      <AnimatePresence>
        {confetti.length > 0 && (
          <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
            {confetti.map(p => (
              <motion.div
                key={p.id}
                initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: p.rot }}
                animate={{ y: "110vh", opacity: [1, 1, 0.6, 0], rotate: p.rot + 720 }}
                transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
                style={{
                  position: "absolute",
                  top: 0,
                  width: p.size,
                  height: p.size * (Math.random() > 0.5 ? 0.5 : 1.6),
                  borderRadius: Math.random() > 0.4 ? "50%" : "2px",
                  background: p.color,
                  boxShadow: `0 0 4px ${p.color}88`,
                }}
              />
            ))}
            {/* Flash/spotlight bursts */}
            {[0, 0.4, 0.9, 1.6].map((delay, i) => (
              <motion.div
                key={`flash-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.18, 0] }}
                transition={{ duration: 0.35, delay }}
                className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse at ${30 + i * 15}% 30%, #fff 0%, transparent 70%)` }}
              />
            ))}
          </div>
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
              className="rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl relative overflow-hidden"
              style={{
                background: `linear-gradient(160deg, ${BRAND_PRIMARY}, #0f2a1c)`,
                border: `3px solid ${BRAND_GOLD}`,
              }}
            >
              {/* Inner glow ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ boxShadow: `0 0 60px ${BRAND_GOLD}55 inset` }}
              />
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              >
                <Trophy className="w-20 h-20 mx-auto mb-3" style={{ color: BRAND_GOLD, filter: `drop-shadow(0 0 14px ${BRAND_GOLD})` }} />
              </motion.div>
              <h2 className="text-3xl font-black mb-1">
                {ar ? "🎉 انتهت اللعبة!" : "🎉 Game Over!"}
              </h2>
              {scores[winnerIdx] > 0 ? (
                <>
                  <p className="text-white/80 mb-4">
                    {ar ? "الفائز:" : "Winner:"}
                  </p>
                  <motion.p
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                    className="text-4xl font-black mb-2"
                    style={{ color: BRAND_GOLD, textShadow: `0 0 20px ${BRAND_GOLD}88` }}
                  >
                    {teamNames[winnerIdx]}
                  </motion.p>
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
                {!isDirectPlay && (
                  <button
                    onClick={() => setLocation("/teacher")}
                    className="w-full py-3 rounded-xl font-black border-2"
                    style={{ borderColor: BRAND_GOLD, color: BRAND_GOLD }}
                  >
                    {ar ? "العودة للوحة" : "Back to Dashboard"}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
