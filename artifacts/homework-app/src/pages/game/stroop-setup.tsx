import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Brain, Hash, Medal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import {
  GameSetupLayout,
  GameStartButton,
  ChallengeFriendButton,
} from "@/components/game/game-setup-layout";

const API_BASE = import.meta.env.VITE_API_URL || "";

const ARABIC_COLORS = [
  { word: "أحمر", color: "#ef4444" },
  { word: "أزرق", color: "#3b82f6" },
  { word: "أخضر", color: "#22c55e" },
  { word: "أصفر", color: "#eab308" },
  { word: "برتقالي", color: "#f97316" },
  { word: "بنفسجي", color: "#a855f7" },
  { word: "رمادي", color: "#6b7280" },
  { word: "أسود", color: "#1f2937" },
];

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  correctCount: number;
  wrongCount: number;
  createdAt: string;
}

export default function StroopSetup() {
  const { lang, t } = useI18n();
  const [, setLocation] = useLocation();

  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/stroop-scores`)
      .then(r => r.ok ? r.json() : [])
      .then((data: LeaderboardEntry[]) => setLeaderboard(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const handlePlayWithPin = async () => {
    const pin = pinInput.trim();
    if (!pin) return;
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch(`${API_BASE}/api/stroop-sets/${pin}`);
      if (!res.ok) {
        setPinError(t.stroop.pinNotFound);
        return;
      }
      setLocation(`/game/stroop/play?pin=${pin}`);
    } catch {
      setPinError(t.stroop.connectionError);
    } finally {
      setPinLoading(false);
    }
  };

  const rankIcon = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `${i + 1}.`;
  };

  return (
    <GameSetupLayout
      bgGradient="bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20"
      iconGradient="from-red-500 via-orange-500 to-yellow-500"
      iconShadow="shadow-orange-500/40"
      icon={<Brain className="w-10 h-10 text-white" />}
      title={t.stroop.title}
      subtitle={t.stroop.subtitle}
      maxWidth="xl"
      backAction={<GameFlowBackButton onBack={() => setLocation("/")} />}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-2 mb-8"
      >
        {ARABIC_COLORS.map((c, i) => (
          <motion.div
            key={c.word}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            className="h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-sm border border-white/40"
            style={{
              backgroundColor: ARABIC_COLORS[(i + 3) % ARABIC_COLORS.length].color + "20",
              color: c.color,
            }}
          >
            {c.word}
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-4 mb-6"
      >
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
          <h3 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            {t.stroop.howToPlay}
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center text-xs font-black shrink-0">١</span>
              {t.stroop.stepOne}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center text-xs font-black shrink-0">٢</span>
              {t.stroop.stepTwo}
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center text-xs font-black shrink-0">٣</span>
              {t.stroop.stepThree}
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-foreground">{t.stroop.scoreCombo}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.stroop.chainChallenges}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
            <Brain className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-foreground">{t.stroop.lives}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.stroop.noMistakes}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
            <Zap className="w-5 h-5 text-orange-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-foreground">{t.stroop.circleTimer}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.stroop.speedsUp}</p>
          </div>
        </div>
      </motion.div>

      <GameStartButton
        onClick={() => setLocation("/game/stroop/play")}
        gradient="from-red-500 via-orange-500 to-yellow-500"
        shadow="shadow-orange-500/30"
        label={t.stroop.start}
      />

      <ChallengeFriendButton
        onClick={() => setShowArenaLobby(true)}
        gradient="from-indigo-500 to-purple-600"
        className="mb-3"
      />

      <AnimatePresence>
        {showArenaLobby && (
          <MultiplayerLobby
            gameId="stroop"
            gameTitle={t.stroop.title}
            playUrl="/game/stroop/play"
            playerName=""
            onClose={() => setShowArenaLobby(false)}
          />
        )}
      </AnimatePresence>

      <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm mb-3">
        <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" />
          {t.stroop.customSet}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pinInput}
            onChange={e => { setPinInput(e.target.value); setPinError(""); }}
            onKeyDown={e => e.key === "Enter" && handlePlayWithPin()}
            placeholder={t.stroop.enterPin}
            aria-label={t.stroop.customSet}
            maxLength={10}
            dir="ltr"
            className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-colors"
          />
          <button
            onClick={handlePlayWithPin}
            disabled={pinLoading || !pinInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {pinLoading ? "..." : t.stroop.join}
          </button>
        </div>
        {pinError && (
          <p className="text-xs text-destructive mt-1.5">{pinError}</p>
        )}
      </div>

      <button
        onClick={() => setLocation("/game/stroop/create")}
        className="w-full py-3 mb-6 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 font-bold text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center gap-2"
      >
        <Brain className="w-4 h-4" />
        {t.stroop.createCustomSet}
      </button>

      {!lbLoading && leaderboard.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
            <Medal className="w-4 h-4 text-yellow-500" />
            {t.stroop.topPlayers}
          </h2>
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">{rankIcon(i)}</span>
                  <span className="font-bold text-sm text-foreground truncate max-w-[140px]">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{t.stroop.levelShort}{entry.level}</span>
                  <span className="font-black text-sm text-orange-600">{entry.score.toLocaleString(lang === "ar" ? "ar-EG" : "en")}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </GameSetupLayout>
  );
}
