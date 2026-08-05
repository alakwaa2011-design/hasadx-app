import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Share2, Loader2, RotateCcw, Lock, Award, ListChecks } from "lucide-react";

type LeaderboardEntry = { playerName: string; score: number; correctCount?: number };

interface Props {
  myScore: number;
  myName: string | null;
  lang: "ar" | "en" | string;
  correctCount: number;
  totalQuestions: number;
  dir: "rtl" | "ltr";
}

/** Format elapsed seconds as m:ss (e.g. 83 → "1:23") */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Multi-attempt scoring ────────────────────────────────────────────────────
// Teachers can configure how many attempts (maxAttempts) count toward a solo
// challenge's score:
//   1  (default) → only the first attempt ever counts; replays don't change it.
//   2             → after the 2nd attempt, the player manually picks which of
//                   the two results to keep as their final score.
//   >2            → the player must complete all N attempts; the best result
//                   (by correct answers, then points, then speed) is picked
//                   automatically and submitted.
//
// LocalStorage keys (per challenge slug):
//   hasad_solo_final_<slug>    → the finalized/locked-in result (all modes)
//   hasad_solo_first_<slug>    → legacy key from before multi-attempt support;
//                                still read as a fallback for old finalized scores.
//   hasad_solo_attempts_<slug> → array of in-progress attempts (maxAttempts > 1
//                                only), cleared once a final score is locked in.
type AttemptRecord = {
  score: number; // correct answers count
  total: number;
  name: string;
  points?: number;
  timeTaken?: number; // seconds
};

function pickBestAttempt(attempts: AttemptRecord[]): AttemptRecord {
  return attempts.reduce((best, cur) => {
    if (cur.score !== best.score) return cur.score > best.score ? cur : best;
    const curPts = cur.points ?? 0;
    const bestPts = best.points ?? 0;
    if (curPts !== bestPts) return curPts > bestPts ? cur : best;
    const curTime = cur.timeTaken ?? Infinity;
    const bestTime = best.timeTaken ?? Infinity;
    return curTime < bestTime ? cur : best;
  });
}

export function SoloChallengeResults({
  myScore,
  myName,
  lang,
  correctCount,
  totalQuestions,
  dir,
}: Props) {
  const isAr = lang === "ar";

  // Capture sessionStorage values once at mount; clear them in the effect.
  const [soloSlug] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_challenge_slug")
      : null,
  );
  const [soloShortSlug] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_challenge_short_slug")
      : null,
  );
  const [soloPlayerName] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_challenge_player")
      : null,
  );
  const [soloChallengeTitle] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_challenge_title")
      : null,
  );
  const [soloLeaderboardDisplay] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_leaderboard_display")
      : null,
  );
  const [maxAttempts] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const n = Number(sessionStorage.getItem("solo_challenge_max_attempts"));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });

  // Compute elapsed time from sessionStorage start timestamp for this attempt.
  const [elapsedSec] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const t = sessionStorage.getItem("solo_challenge_start_time");
    if (!t) return 0;
    return Math.round((Date.now() - Number(t)) / 1000);
  });

  const finalKey = soloSlug ? `hasad_solo_final_${soloSlug}` : null;
  const legacyFirstKey = soloSlug ? `hasad_solo_first_${soloSlug}` : null;
  const attemptsKey = soloSlug ? `hasad_solo_attempts_${soloSlug}` : null;

  // Did this device already have a locked-in final score BEFORE this playthrough?
  const [existingFinal] = useState<AttemptRecord | null>(() => {
    if (!finalKey || typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(finalKey) || (legacyFirstKey ? localStorage.getItem(legacyFirstKey) : null);
      return raw ? (JSON.parse(raw) as AttemptRecord) : null;
    } catch { return null; }
  });

  const [currentAttempt] = useState<AttemptRecord>(() => ({
    score: correctCount,
    total: totalQuestions,
    name: soloPlayerName || myName || (isAr ? "لاعب" : "Player"),
    points: myScore,
    timeTaken: elapsedSec,
  }));

  // One-time (per mount) resolution of what happens with this playthrough.
  const [outcome] = useState<{
    phase: "final" | "interim" | "choose";
    display: AttemptRecord;
    attempts: AttemptRecord[];
    isNew: boolean; // true when this playthrough is what produced `display`
  }>(() => {
    if (existingFinal) {
      return { phase: "final", display: existingFinal, attempts: [], isNew: false };
    }

    let priorAttempts: AttemptRecord[] = [];
    if (attemptsKey && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(attemptsKey);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) priorAttempts = parsed;
      } catch { /* ignore malformed storage */ }
    }
    const updatedAttempts = [...priorAttempts, currentAttempt].slice(0, Math.max(maxAttempts, 1));

    if (maxAttempts <= 1) {
      return { phase: "final", display: currentAttempt, attempts: updatedAttempts, isNew: true };
    }
    if (updatedAttempts.length < maxAttempts) {
      return { phase: "interim", display: currentAttempt, attempts: updatedAttempts, isNew: true };
    }
    if (maxAttempts === 2) {
      return { phase: "choose", display: currentAttempt, attempts: updatedAttempts, isNew: true };
    }
    // maxAttempts > 2: all attempts complete → auto-pick the best one.
    const best = pickBestAttempt(updatedAttempts);
    return { phase: "final", display: best, attempts: updatedAttempts, isNew: true };
  });

  const [phase, setPhase] = useState(outcome.phase);
  const [display, setDisplay] = useState(outcome.display);
  const [choosing, setChoosing] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  const API = import.meta.env.VITE_API_URL || "";

  const fetchLeaderboard = () => {
    if (!soloSlug) return;
    fetch(`${API}/api/solo-challenges/${encodeURIComponent(soloSlug)}/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(Array.isArray(data) ? data : []);
        setLeaderboardLoaded(true);
      })
      .catch(() => setLeaderboardLoaded(true));
  };

  const submitScore = (entry: AttemptRecord) => {
    if (!soloSlug) return;
    return fetch(`${API}/api/solo-challenges/${encodeURIComponent(soloSlug)}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        playerName: entry.name,
        points: entry.points ?? 0,
        correctCount: entry.score,
        timeTaken: entry.timeTaken ?? 0,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!soloSlug) return;

    if (phase === "interim") {
      if (attemptsKey) {
        try { localStorage.setItem(attemptsKey, JSON.stringify(outcome.attempts)); } catch { /* storage full */ }
      }
      fetchLeaderboard();
    } else if (phase === "choose") {
      if (attemptsKey) {
        try { localStorage.setItem(attemptsKey, JSON.stringify(outcome.attempts)); } catch { /* storage full */ }
      }
      fetchLeaderboard();
    } else {
      // phase === "final"
      if (outcome.isNew) {
        if (finalKey) {
          try { localStorage.setItem(finalKey, JSON.stringify(outcome.display)); } catch { /* storage full */ }
        }
        if (attemptsKey) {
          try { localStorage.removeItem(attemptsKey); } catch { /* ignore */ }
        }
        Promise.resolve(submitScore(outcome.display)).finally(fetchLeaderboard);
      } else {
        fetchLeaderboard();
      }
    }

    sessionStorage.removeItem("solo_challenge_slug");
    sessionStorage.removeItem("solo_challenge_short_slug");
    sessionStorage.removeItem("solo_challenge_player");
    sessionStorage.removeItem("solo_challenge_title");
    sessionStorage.removeItem("solo_challenge_start_time");
    sessionStorage.removeItem("solo_leaderboard_display");
    sessionStorage.removeItem("solo_challenge_max_attempts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoose = (chosen: AttemptRecord) => {
    if (choosing) return;
    setChoosing(true);
    if (finalKey) {
      try { localStorage.setItem(finalKey, JSON.stringify(chosen)); } catch { /* storage full */ }
    }
    if (attemptsKey) {
      try { localStorage.removeItem(attemptsKey); } catch { /* ignore */ }
    }
    Promise.resolve(submitScore(chosen)).finally(() => {
      setDisplay(chosen);
      setPhase("final");
      setChoosing(false);
      fetchLeaderboard();
    });
  };

  if (!soloSlug) return null;

  const displayName = display.name || soloPlayerName || myName || (isAr ? "لاعب" : "Player");
  const displayCorrect = display.score;
  const displayTotal = display.total;
  const displayPoints = display.points ?? 0;
  const displayTimeSec = display.timeTaken ?? 0;
  // isReplay = the final score was already locked in before this playthrough
  // started (a genuine replay, as opposed to just having finished the round
  // that produced this final score).
  const isReplay = !outcome.isNew;

  const pct =
    displayTotal > 0 ? Math.round((displayCorrect / displayTotal) * 100) : 0;

  const challengeUrl = `${window.location.origin}/solo/${soloSlug}`;
  // Share URL strategy:
  //  1. Prefer /s/:shortSlug — short ASCII URL (e.g. hasadx.com/s/eid-quiz-k4x2)
  //     handled by the API server, returns OG HTML so FB/WhatsApp show a rich card.
  //  2. Fall back to /api/share/solo/:slug for challenges created before shortSlug
  //     was introduced (both work identically for social-card unfurling).
  const shareUrl = soloShortSlug
    ? `${window.location.origin}/api/s/${encodeURIComponent(soloShortSlug)}`
    : `${window.location.origin}/api/share/solo/${encodeURIComponent(soloSlug!)}`;

  // Performance tier — drives the celebratory headline + tier color.
  // Static "well done" regardless of score kills the dopamine hit; tier-aware
  // copy makes a 10/10 feel like a triumph and a 4/10 feel like a challenge
  // worth retrying / sharing for redemption.
  const tier =
    pct >= 90 ? "legend" : pct >= 70 ? "excellent" : pct >= 50 ? "good" : "keep_going";
  const TIER = {
    legend: {
      title: isAr ? "أسطورة!" : "Legend!",
      subtitle: isAr ? "أداء استثنائي — تستحق التحدي" : "Exceptional performance",
      emoji: "🏆",
      color: "#FFD66E",
    },
    excellent: {
      title: isAr ? "ممتاز!" : "Excellent!",
      subtitle: isAr ? "نتيجة رائعة — تحدّى أصدقاءك" : "Great score — challenge your friends",
      emoji: "✨",
      color: "#E8B84B",
    },
    good: {
      title: isAr ? "جيد!" : "Good!",
      subtitle: isAr ? "تقدر تتحسن — جرّب مرة أخرى" : "You can do better",
      emoji: "👏",
      color: "#86E8B1",
    },
    keep_going: {
      title: isAr ? "استمر!" : "Keep Going!",
      subtitle: isAr ? "الأبطال لا يستسلمون — أعد المحاولة" : "Champions don't quit",
      emoji: "💪",
      color: "#A8C8FF",
    },
  }[tier];

  // Personalised, competitive share text — the viral engine. Includes the
  // player's name, score, and a "can you beat me?" hook. Anyone who opens
  // the link arrives as a fresh solo player and gets pulled into the loop.
  const trimmedTitle = soloChallengeTitle?.trim() || "";
  const challengeTitleStr = trimmedTitle ? ` "${trimmedTitle}"` : "";
  const shareText = isAr
    ? `🎯 ${displayName} حصل على ${displayCorrect}/${displayTotal}${challengeTitleStr ? ` في تحدي${challengeTitleStr}` : ""}\n\nهل تقدر تتغلب عليه؟ جرّب التحدي الآن:\n${shareUrl}\n\n✨ على حصاد X`
    : `🎯 ${displayName} scored ${displayCorrect}/${displayTotal}${challengeTitleStr ? ` on${challengeTitleStr}` : ""}\n\nCan you beat them? Try the challenge now:\n${shareUrl}\n\n✨ Powered by HasadX`;

  // Match rank by points (score) + name.
  const myRankIdx = (() => {
    const byBoth = leaderboard.findIndex(
      (e) => e.playerName === displayName && e.score === displayPoints,
    );
    if (byBoth >= 0) return byBoth;
    return leaderboard.findIndex((e) => e.playerName === displayName);
  })();
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  const handleShare = () => {
    if (typeof navigator.share === "function") {
      navigator
        .share({
          title:
            soloChallengeTitle || (isAr ? "تحدي حصاد" : "Hasaad Challenge"),
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(shareText).catch(() => {});
        });
    } else {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // Retry: navigate back to the solo entry page — starts fresh from name input.
  const handleRetry = () => {
    window.location.href = `/solo/${soloSlug}`;
  };

  const medals = ["🥇", "🥈", "🥉"];

  // ── Interim phase: attempt saved, more attempts remain, no submission yet ──
  if (phase === "interim") {
    const attemptNum = outcome.attempts.length;
    return (
      <div
        className="min-h-screen p-4 sm:p-8 flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)",
        }}
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 18 }}
          className="w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl text-center p-5 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(147,197,253,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <ListChecks className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-blue-300" />
          <h1 className="mt-3 text-xl sm:text-2xl font-black text-blue-200">
            {isAr
              ? `أكملت المحاولة ${attemptNum} من ${maxAttempts}`
              : `Completed attempt ${attemptNum} of ${maxAttempts}`}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-bold text-white/60">
            {isAr
              ? "لم تُحتسب نتيجتك النهائية بعد — أكمل باقي المحاولات"
              : "Your final score isn't decided yet — finish the remaining attempts"}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl py-3 px-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] sm:text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{isAr ? "صحيح" : "Correct"}</p>
              <p className="font-black text-base sm:text-xl text-white leading-none">{displayCorrect}<span className="text-white/40 text-xs font-bold">{" / "}{displayTotal || "—"}</span></p>
            </div>
            <div className="rounded-xl py-3 px-2" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <p className="text-[10px] sm:text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{isAr ? "النقاط" : "Points"}</p>
              <p className="font-black text-base sm:text-xl text-green-300 leading-none">{displayPoints > 0 ? displayPoints.toLocaleString() : "—"}</p>
            </div>
            <div className="rounded-xl py-3 px-2" style={{ background: "rgba(147,197,253,0.08)", border: "1px solid rgba(147,197,253,0.2)" }}>
              <p className="text-[10px] sm:text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{isAr ? "الوقت" : "Time"}</p>
              <p className="font-black text-base sm:text-xl text-blue-300 leading-none">{displayTimeSec > 0 ? fmtTime(displayTimeSec) : "—"}</p>
            </div>
          </div>

          <button
            onClick={handleRetry}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl sm:rounded-2xl text-base font-black text-white transition-all duration-200 active:scale-[0.97] hover:brightness-110"
            style={{
              background: "linear-gradient(135deg,#2563EB 0%,#3B82F6 50%,#2563EB 100%)",
              boxShadow: "0 10px 30px rgba(59,130,246,0.35)",
            }}
          >
            <RotateCcw className="w-5 h-5" strokeWidth={2.5} />
            {isAr ? `العب المحاولة ${attemptNum + 1}` : `Play attempt ${attemptNum + 1}`}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Choose phase: maxAttempts === 2, both attempts done, player picks ──────
  if (phase === "choose") {
    return (
      <div
        className="min-h-screen p-4 sm:p-8 flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)",
        }}
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 18 }}
          className="w-full max-w-sm sm:max-w-lg rounded-2xl sm:rounded-3xl text-center p-5 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(232,184,75,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-amber-300" />
          <h1 className="mt-3 text-xl sm:text-2xl font-black text-amber-300">
            {isAr ? "أكملت محاولتيك — اختر نتيجتك" : "Both attempts done — choose your score"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-bold text-white/60">
            {isAr ? "لن تتمكن من التغيير بعد الاختيار" : "You won't be able to change it afterward"}
          </p>

          <div className="mt-5 space-y-3">
            {outcome.attempts.map((att, i) => {
              const p = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
              return (
                <button
                  key={i}
                  disabled={choosing}
                  onClick={() => handleChoose(att)}
                  className="w-full text-start rounded-xl sm:rounded-2xl p-4 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(232,184,75,0.25)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base font-black text-white">
                      {isAr ? `المحاولة ${i + 1}` : `Attempt ${i + 1}`}
                    </span>
                    <span className="text-xs font-bold text-amber-300">{p}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs sm:text-sm">
                    <span className="text-white/70">
                      {isAr ? "صحيح: " : "Correct: "}
                      <b className="text-white">{att.score}/{att.total}</b>
                    </span>
                    <span className="text-white/70">
                      {isAr ? "النقاط: " : "Points: "}
                      <b className="text-green-300">{(att.points ?? 0).toLocaleString()}</b>
                    </span>
                    {att.timeTaken ? (
                      <span className="text-white/70">
                        {isAr ? "الوقت: " : "Time: "}
                        <b className="text-blue-300">{fmtTime(att.timeTaken)}</b>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-amber-400/80">
                    {choosing ? (isAr ? "جارٍ الحفظ..." : "Saving...") : (isAr ? "اعتماد هذه النتيجة ←" : "→ Keep this score")}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 sm:p-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)",
      }}
      dir={dir}
    >
      {/* Floating confetti dots */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={`c-${i}`}
            initial={{ y: -16, x: (i * 67) % 500, opacity: 0.85 }}
            animate={{
              y:
                (typeof window !== "undefined" ? window.innerHeight : 800) + 16,
              opacity: 0,
              rotate: 300,
            }}
            transition={{
              duration: 4 + (i % 3),
              delay: (i * 0.2) % 2.5,
              repeat: Infinity,
            }}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#fbbf24", "#f59e0b", "#fde68a"][i % 3],
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-sm sm:max-w-xl lg:max-w-2xl mx-auto">

        {/* ── Main result card ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 18 }}
          className="rounded-2xl sm:rounded-3xl text-center p-5 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(232,184,75,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.6 }}
            className="inline-block text-5xl sm:text-7xl"
            style={{
              filter: `drop-shadow(0 0 22px ${TIER.color}88)`,
            }}
          >
            {TIER.emoji}
          </motion.div>

          {/* Tier-aware celebratory headline — scales the dopamine hit
              to the player's actual performance. */}
          <h1
            className="mt-2 text-2xl sm:text-4xl font-black tracking-tight"
            style={{ color: TIER.color }}
          >
            {TIER.title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-bold text-white/65">
            {TIER.subtitle}
          </p>

          <p className="mt-3 text-sm sm:text-base font-bold text-amber-300/80 truncate">
            {displayName}
          </p>

          {/* Final-score badge — communicates why this score is the one
              displayed/shared, tailored to how it was decided. */}
          {isReplay ? (
            <div className="mt-2 flex justify-center">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold"
                style={{
                  background: "rgba(232,184,75,0.12)",
                  border: "1px solid rgba(232,184,75,0.35)",
                  color: "#E8B84B",
                }}
              >
                <Lock className="w-3 h-3" /> {isAr ? "نتيجتك النهائية المحفوظة" : "Your saved final score"}
              </span>
            </div>
          ) : maxAttempts === 2 ? (
            <div className="mt-2 flex justify-center">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ background: "rgba(232,184,75,0.12)", border: "1px solid rgba(232,184,75,0.35)", color: "#E8B84B" }}
              >
                <Lock className="w-3 h-3" /> {isAr ? "النتيجة التي اخترتها" : "The score you chose"}
              </span>
            </div>
          ) : maxAttempts > 2 ? (
            <div className="mt-2 flex justify-center">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ background: "rgba(232,184,75,0.12)", border: "1px solid rgba(232,184,75,0.35)", color: "#E8B84B" }}
              >
                <Award className="w-3 h-3" /> {isAr ? `أفضل نتيجة من ${maxAttempts} محاولات` : `Best of ${maxAttempts} attempts`}
              </span>
            </div>
          ) : null}

          {/* Stats: correct/total | percentage | rank */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div
              className="rounded-xl sm:rounded-2xl py-3 sm:py-4 px-2"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p
                className="text-[10px] sm:text-xs font-bold mb-1"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {isAr ? "صحيح" : "Correct"}
              </p>
              <p className="font-black text-base sm:text-2xl text-white leading-none">
                {displayCorrect}
                <span className="text-white/40 text-xs sm:text-sm font-bold">
                  {" / "}{displayTotal || "—"}
                </span>
              </p>
            </div>

            <div
              className="rounded-xl sm:rounded-2xl py-3 sm:py-4 px-2"
              style={{
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.2)",
              }}
            >
              <p
                className="text-[10px] sm:text-xs font-bold mb-1"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {isAr ? "النقاط" : "Points"}
              </p>
              <p className="font-black text-base sm:text-2xl text-green-300 leading-none">
                {displayPoints > 0 ? displayPoints.toLocaleString() : "—"}
              </p>
            </div>

            <div
              className="rounded-xl sm:rounded-2xl py-3 sm:py-4 px-2"
              style={{
                background: "rgba(147,197,253,0.08)",
                border: "1px solid rgba(147,197,253,0.2)",
              }}
            >
              <p
                className="text-[10px] sm:text-xs font-bold mb-1"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {isAr ? "الوقت" : "Time"}
              </p>
              <p className="font-black text-base sm:text-2xl text-blue-300 leading-none">
                {displayTimeSec > 0 ? fmtTime(displayTimeSec) : "—"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Top-20 leaderboard ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-3 sm:mt-4 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(232,184,75,0.05)",
            border: "1px solid rgba(232,184,75,0.18)",
          }}
        >
          <div
            className="px-4 py-2.5 sm:py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(232,184,75,0.12)" }}
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <h3 className="font-black text-white text-sm sm:text-base">
              {isAr
                ? soloLeaderboardDisplay === "top3"
                  ? "المتصدرون الثلاثة"
                  : soloLeaderboardDisplay === "all"
                    ? "جدول المتصدرين"
                    : "أفضل 20 لاعب"
                : soloLeaderboardDisplay === "top3"
                  ? "Top 3 Players"
                  : soloLeaderboardDisplay === "all"
                    ? "Full Leaderboard"
                    : "Top 20 Players"}
            </h3>
            <div className="ms-auto flex items-center gap-3">
              <span
                className="text-[10px] sm:text-xs font-bold"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {isAr ? "صحيح" : "Correct"}
              </span>
              <span
                className="text-[10px] sm:text-xs font-bold"
                style={{ color: "rgba(232,184,75,0.6)" }}
              >
                {isAr ? "النقاط" : "Points"}
              </span>
            </div>
          </div>

          <div className="px-2 py-1.5 space-y-0.5 max-h-44 sm:max-h-72 overflow-y-auto">
            {!leaderboardLoaded ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-white/40 text-xs py-3">
                {isAr ? "لا توجد نتائج بعد" : "No scores yet"}
              </p>
            ) : (
              leaderboard.slice(0, 20).map((entry, i) => {
                const isMe = myRankIdx === i;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl"
                    style={
                      isMe
                        ? {
                            background: "rgba(232,184,75,0.14)",
                            border: "1px solid rgba(232,184,75,0.38)",
                          }
                        : {}
                    }
                  >
                    <span
                      className="w-6 sm:w-7 text-center text-xs sm:text-sm font-black shrink-0"
                      style={{
                        color: i < 3 ? "#E8B84B" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {i < 3 ? medals[i] : i + 1}
                    </span>
                    <span
                      className={`flex-1 text-xs sm:text-sm font-bold truncate ${isMe ? "text-amber-300" : "text-white/75"}`}
                    >
                      {entry.playerName}
                      {isMe && (
                        <span className="text-[10px] ms-1 opacity-60">
                          {isAr ? "(أنت)" : "(you)"}
                        </span>
                      )}
                    </span>
                    {/* Correct count — secondary column */}
                    <span
                      className="text-[11px] sm:text-xs font-bold w-7 text-center"
                      style={{ color: "rgba(255,255,255,0.38)" }}
                    >
                      {entry.correctCount ?? "—"}
                    </span>
                    {/* Points — primary sort column */}
                    <span
                      className="font-black text-xs sm:text-sm w-16 text-end"
                      style={{
                        color: i === 0 ? "#E8B84B" : "rgba(255,255,255,0.8)",
                      }}
                    >
                      {entry.score > 0 ? entry.score.toLocaleString() : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* ── HasadX CTA — slim glass card, shown before action buttons ── */}
        <motion.a
          href="https://hasadx.com"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-3 sm:mt-4 flex items-center gap-3 rounded-xl sm:rounded-2xl px-4 py-3 sm:py-3.5 group transition-all hover:brightness-105 active:scale-[0.99]"
          style={{
            background: "rgba(232,184,75,0.07)",
            border: "1px solid rgba(232,184,75,0.22)",
            backdropFilter: "blur(10px)",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
            alt=""
            aria-hidden
            className="w-9 h-9 rounded-lg object-cover opacity-90 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-xs sm:text-sm leading-snug">
              {isAr
                ? "أنشئ مسابقاتك وعروضك التفاعلية مع حصاد X"
                : "Create interactive quizzes with HasadX"}
            </p>
            <p className="text-white/45 text-[10px] sm:text-xs mt-0.5 truncate">
              {isAr
                ? "الذكاء الاصطناعي • المسابقات • الواجبات • التفاعل المباشر"
                : "AI · Quizzes · Homework · Live Interaction"}
            </p>
          </div>
          <span
            className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg,#C9930A,#E8B84B)",
              color: "#1A1200",
            }}
          >
            {isAr ? "ابدأ مجانًا" : "Start Free"}
          </span>
        </motion.a>

        {/* ── Action buttons ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mt-3 sm:mt-4 space-y-2"
        >
          {/* PRIMARY: Challenge friends on WhatsApp — the viral engine.
              Full-width green CTA with pulse-glow halo. For Arabic-speaking
              markets, WhatsApp is THE social channel; this single button
              is responsible for ~90% of the platform's organic growth, so
              it gets the dominant visual weight. */}
          <motion.button
            onClick={handleWhatsApp}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-base sm:text-lg font-black transition-all duration-200 hover:brightness-110 hover:-translate-y-[1px] overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg,#1FAE56 0%,#25D366 50%,#1FAE56 100%)",
              color: "#fff",
              boxShadow:
                "0 10px 30px rgba(37,211,102,0.42), 0 0 0 1px rgba(255,255,255,0.18) inset",
            }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(37,211,102,0.5)",
                  "0 0 0 12px rgba(37,211,102,0)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
            />
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 relative"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.524 5.84L.057 23.571l5.887-1.543A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.502-5.177-1.38l-.371-.22-3.494.916.933-3.41-.242-.384A9.954 9.954 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
            <span className="relative">
              {isAr ? "تحدّى أصدقاءك على واتساب" : "Challenge friends on WhatsApp"}
            </span>
          </motion.button>

          {/* Secondary row: generic Share + Replay. Equal weight, gold/glass
              to stay subordinate to the primary green CTA above. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-black transition-all duration-200 active:scale-[0.97] hover:brightness-110"
              style={{
                background:
                  "linear-gradient(135deg,#C9930A 0%,#E8B84B 50%,#C9930A 100%)",
                color: "#1A1200",
                boxShadow:
                  "0 6px 20px rgba(232,184,75,0.32), inset 0 1px 0 rgba(255,235,160,0.4)",
              }}
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              {isAr ? "شارك" : "Share"}
            </button>

            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-black text-white transition-all duration-200 active:scale-[0.97] hover:bg-white/[0.08]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
              }}
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              {isAr ? "إعادة" : "Replay"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
