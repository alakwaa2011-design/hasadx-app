import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Share2, Loader2 } from "lucide-react";

type LeaderboardEntry = { playerName: string; score: number };

interface Props {
  myScore: number;
  myName: string | null;
  lang: "ar" | "en" | string;
  correctCount: number;
  totalQuestions: number;
  dir: "rtl" | "ltr";
}

/**
 * Solo-challenge end-of-game page.
 *
 * Lives in its own component so its hooks always run in the same order —
 * the parent <GamePlay> has many early returns above this UI, so co-locating
 * the hooks there caused a "Rendered more hooks than during the previous
 * render" violation when the phase transitioned to "finished".
 *
 * Owns the entire finished screen for solo (no podium / no "all players" /
 * no PIN share / no "wait for teacher"). Reads the solo session info from
 * sessionStorage once at mount, reports the player's score, fetches the
 * top-20 leaderboard, then clears the session keys so a replay does not
 * re-report.
 */
export function SoloChallengeResults({
  myScore,
  myName,
  lang,
  correctCount,
  totalQuestions,
  dir,
}: Props) {
  /* Lazy-init from sessionStorage so the values are captured once at mount
     and stay stable even after we clear sessionStorage in the effect. */
  const [soloSlug] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("solo_challenge_slug")
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

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  useEffect(() => {
    if (!soloSlug) return;

    const API = import.meta.env.VITE_API_URL || "";

    fetch(`${API}/api/solo-challenges/${encodeURIComponent(soloSlug)}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        playerName: soloPlayerName || myName || "لاعب",
        score: myScore,
      }),
    })
      .catch(() => {})
      .finally(() => {
        /* Re-fetch leaderboard after our score is recorded so the player
           sees their own row in the top 20 immediately. */
        fetch(
          `${API}/api/solo-challenges/${encodeURIComponent(soloSlug)}/leaderboard`,
        )
          .then((r) => r.json())
          .then((data) => {
            setLeaderboard(Array.isArray(data) ? data : []);
            setLeaderboardLoaded(true);
          })
          .catch(() => setLeaderboardLoaded(true));
      });

    /* Clear session so replaying does not re-report. */
    sessionStorage.removeItem("solo_challenge_slug");
    sessionStorage.removeItem("solo_challenge_player");
    sessionStorage.removeItem("solo_challenge_title");
    /* Intentional: only run once on mount, captured-once values are stable. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!soloSlug) return null;

  const displayName = soloPlayerName || myName || (lang === "ar" ? "لاعب" : "Player");

  /* Find current player's rank using the recorded score. Match by name
     AND score so an older identical name with a lower score doesn't claim
     the new row. Fallback to name-only when the score isn't found yet. */
  const myRankIdx = (() => {
    const byBoth = leaderboard.findIndex(
      (e) => e.playerName === displayName && e.score === myScore,
    );
    if (byBoth >= 0) return byBoth;
    return leaderboard.findIndex((e) => e.playerName === displayName);
  })();
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  const handleShare = () => {
    const url = `${window.location.origin}/solo/${soloSlug}`;
    const text =
      lang === "ar"
        ? `حصلت على ${myScore} نقطة في مسابقة «${soloChallengeTitle || soloSlug}»! هل تستطيع التفوق عليّ؟ 🎯\nالعب الآن: ${url}`
        : `I scored ${myScore} in "${soloChallengeTitle || soloSlug}"! Can you beat me? 🎯\nPlay now: ${url}`;
    if (typeof navigator.share === "function") {
      navigator
        .share({
          title: soloChallengeTitle || (lang === "ar" ? "تحدي وميض" : "Wameeth Challenge"),
          text,
          url,
        })
        .catch(() => {
          /* User cancelled or share unsupported on this gesture → fall back to copy. */
          navigator.clipboard.writeText(text).catch(() => {});
        });
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div
      className="min-h-screen p-4 sm:p-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)",
      }}
      dir={dir}
    >
      {/* Subtle confetti */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div
            key={`c-${i}`}
            initial={{
              y: -20,
              x:
                (i * 53) %
                (typeof window !== "undefined" ? window.innerWidth : 500),
              opacity: 1,
            }}
            animate={{
              y:
                (typeof window !== "undefined" ? window.innerHeight : 800) +
                20,
              opacity: 0,
              rotate: 360,
            }}
            transition={{
              duration: 3.5 + (i % 3),
              delay: (i * 0.18) % 2,
              repeat: Infinity,
            }}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#fbbf24", "#f59e0b", "#fde68a", "#E8B84B"][
                i % 4
              ],
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-md mx-auto">
        {/* ── Main result card ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="rounded-3xl overflow-hidden text-center p-7"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(232,184,75,0.35)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          }}
        >
          <motion.div
            animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2.4 }}
          >
            <Trophy className="w-16 h-16 mx-auto text-amber-400 drop-shadow-[0_0_24px_rgba(232,184,75,0.55)]" />
          </motion.div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-black text-white">
            {lang === "ar" ? "أحسنت! انتهت اللعبة" : "Well done! Game Over"}
          </h1>

          <p className="mt-1 text-base font-bold text-amber-300/90 truncate">
            {displayName}
          </p>

          {/* Big score */}
          <div className="mt-5">
            <p
              className="text-xs font-bold mb-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {lang === "ar" ? "الدرجة النهائية" : "Final Score"}
            </p>
            <p
              className="font-black leading-none"
              style={{
                fontSize: "56px",
                color: "#E8B84B",
                textShadow: "0 4px 24px rgba(232,184,75,0.35)",
              }}
            >
              {myScore}
            </p>
          </div>

          {/* Stat row: correct/total + rank */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl py-3 px-2"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p
                className="text-[11px] font-bold mb-0.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {lang === "ar" ? "الإجابات الصحيحة" : "Correct"}
              </p>
              <p className="font-black text-xl text-white">
                {correctCount}
                <span className="text-white/45 text-base font-bold">
                  {" / "}
                  {totalQuestions || "—"}
                </span>
              </p>
            </div>
            <div
              className="rounded-2xl py-3 px-2"
              style={{
                background: "rgba(232,184,75,0.10)",
                border: "1px solid rgba(232,184,75,0.25)",
              }}
            >
              <p
                className="text-[11px] font-bold mb-0.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {lang === "ar" ? "ترتيبك" : "Your Rank"}
              </p>
              <p className="font-black text-xl text-amber-300">
                {!leaderboardLoaded
                  ? "…"
                  : myRank
                    ? `#${myRank}`
                    : "—"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Top-20 leaderboard ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(232,184,75,0.06)",
            border: "1px solid rgba(232,184,75,0.22)",
          }}
        >
          <div
            className="px-5 py-3.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(232,184,75,0.15)" }}
          >
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="font-black text-white text-base">
              {lang === "ar" ? "أفضل 20 لاعب" : "Top 20 Players"}
            </h3>
          </div>

          <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
            {!leaderboardLoaded ? (
              <div className="flex justify-center py-5">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-white/50 text-sm py-4">
                {lang === "ar" ? "لا توجد نتائج بعد" : "No scores yet"}
              </p>
            ) : (
              leaderboard.slice(0, 20).map((entry, i) => {
                const isMe = myRankIdx === i;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={
                      isMe
                        ? {
                            background: "rgba(232,184,75,0.18)",
                            border: "1px solid rgba(232,184,75,0.45)",
                          }
                        : { background: "rgba(255,255,255,0.04)" }
                    }
                  >
                    <span
                      className="w-7 text-center text-sm font-black shrink-0"
                      style={{
                        color: i < 3 ? "#E8B84B" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {i < 3 ? medals[i] : i + 1}
                    </span>
                    <span
                      className={`flex-1 text-sm font-bold truncate ${isMe ? "text-amber-300" : "text-white/85"}`}
                    >
                      {entry.playerName}
                      {isMe && (
                        <span className="text-xs ms-1 opacity-70">
                          {lang === "ar" ? "(أنت)" : "(you)"}
                        </span>
                      )}
                    </span>
                    <span
                      className="font-black text-sm"
                      style={{
                        color: i === 0 ? "#E8B84B" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {entry.score}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* ── Share button only (no long URL displayed) ───── */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleShare}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-black"
          style={{
            background: "linear-gradient(135deg,#C9930A 0%,#E8B84B 50%,#C9930A 100%)",
            color: "#1A1200",
            boxShadow: "0 4px 24px rgba(232,184,75,0.35)",
          }}
        >
          <Share2 className="w-5 h-5" />
          {lang === "ar" ? "شارك التحدي" : "Share Challenge"}
        </motion.button>
      </div>
    </div>
  );
}
