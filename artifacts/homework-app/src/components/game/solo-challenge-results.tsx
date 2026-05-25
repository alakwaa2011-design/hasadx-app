import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Share2, Copy, Loader2 } from "lucide-react";

type LeaderboardEntry = { playerName: string; score: number };

interface Props {
  myScore: number;
  myName: string | null;
  lang: "ar" | "en" | string;
}

/**
 * Solo-challenge end-of-game panel.
 *
 * Lives in its own component so its hooks always run in the same order —
 * the parent <GamePlay> has many early returns above this UI, so co-locating
 * the hooks there caused a "Rendered more hooks than during the previous
 * render" violation when the phase transitioned to "finished".
 *
 * Reads the solo session info from sessionStorage once at mount, reports
 * the player's score, fetches the top-20 leaderboard, then clears the
 * session keys so a replay does not re-report.
 *
 * Returns null when the user is not in a solo-challenge session, so the
 * parent can mount this unconditionally inside the "finished" JSX.
 */
export function SoloChallengeResults({ myScore, myName, lang }: Props) {
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
    }).catch(() => {});

    fetch(
      `${API}/api/solo-challenges/${encodeURIComponent(soloSlug)}/leaderboard`,
    )
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(Array.isArray(data) ? data : []);
        setLeaderboardLoaded(true);
      })
      .catch(() => setLeaderboardLoaded(true));

    /* Clear session so replaying does not re-report. */
    sessionStorage.removeItem("solo_challenge_slug");
    sessionStorage.removeItem("solo_challenge_player");
    sessionStorage.removeItem("solo_challenge_title");
    /* Intentional: only run once on mount, captured-once values are stable. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!soloSlug) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.1 }}
      className="mb-5"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(232,184,75,0.06)",
          border: "1px solid rgba(232,184,75,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(232,184,75,0.15)" }}
        >
          <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="font-black text-white text-base">
            {lang === "ar" ? "متصدرو المسابقة" : "Challenge Leaderboard"}
          </h3>
          <span
            className="text-xs font-bold ms-auto px-2 py-0.5 rounded-full"
            style={{ background: "rgba(232,184,75,0.18)", color: "#E8B84B" }}
          >
            {lang === "ar" ? "أفضل 20" : "Top 20"}
          </span>
        </div>

        {/* Rows */}
        <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto">
          {!leaderboardLoaded ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-center text-white/50 text-sm py-3">
              {lang === "ar" ? "لا توجد نتائج بعد" : "No scores yet"}
            </p>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe = entry.playerName === (soloPlayerName || myName);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
                  style={
                    isMe
                      ? {
                          background: "rgba(232,184,75,0.18)",
                          border: "1px solid rgba(232,184,75,0.4)",
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

        {/* Share solo link */}
        <div
          className="px-5 pb-5 pt-3"
          style={{ borderTop: "1px solid rgba(232,184,75,0.12)" }}
        >
          <p
            className="text-xs font-bold mb-2 text-center"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {lang === "ar" ? "🔗 تحدَّ أصدقاءك!" : "🔗 Challenge your friends!"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/solo/${soloSlug}`;
                const text =
                  lang === "ar"
                    ? `حصلت على ${myScore} نقطة في مسابقة «${soloChallengeTitle || soloSlug}»! هل تستطيع التفوق عليّ؟ 🎯\nالعب الآن: ${url}`
                    : `I scored ${myScore} in "${soloChallengeTitle || soloSlug}"! Can you beat me? 🎯\nPlay now: ${url}`;
                if (typeof navigator.share === "function") {
                  navigator
                    .share({
                      title: soloChallengeTitle || "تحدي وميض",
                      text,
                      url,
                    })
                    .catch(() => navigator.clipboard.writeText(text));
                } else {
                  navigator.clipboard.writeText(text);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all"
              style={{
                background: "linear-gradient(135deg,#C9930A,#E8B84B)",
                color: "#1A1200",
              }}
            >
              <Share2 className="w-4 h-4" />
              {lang === "ar" ? "شارك مع الأصدقاء" : "Share Challenge"}
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/solo/${soloSlug}`;
                navigator.clipboard.writeText(url);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              <Copy className="w-4 h-4" />
              {lang === "ar" ? "الرابط" : "Link"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
