import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";
import {
  GameSetupLayout,
  HowToPlayCard,
  GameStartButton,
  ChallengeFriendButton,
  LeaderboardCard,
  type BasicLeaderboardEntry,
} from "@/components/game/game-setup-layout";

const API_BASE = import.meta.env.VITE_API_URL || "";

const DEMO_CARDS = [
  { emoji: "🌟", matched: false, flipped: true },
  { emoji: "🎯", matched: false, flipped: false },
  { emoji: "🚀", matched: true, flipped: true },
  { emoji: "🌟", matched: false, flipped: false },
  { emoji: "🚀", matched: true, flipped: true },
  { emoji: "🎯", matched: false, flipped: false },
];

function DemoCard({ card, index }: { card: typeof DEMO_CARDS[0]; index: number }) {
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{
        rotateY: card.flipped ? 0 : 180,
        scale: card.matched ? 0.95 : 1,
      }}
      transition={{ delay: index * 0.15 + 0.3, duration: 0.5, type: "spring" }}
      className="relative w-12 h-14 sm:w-14 sm:h-16"
      style={{ perspective: "600px", transformStyle: "preserve-3d" }}
    >
      <div
        className={`absolute inset-0 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 ${
          card.matched
            ? "bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300/50"
            : card.flipped
              ? "bg-gradient-to-br from-violet-400 to-purple-500 shadow-lg shadow-violet-500/30"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md"
        }`}
        style={{ backfaceVisibility: "hidden" }}
      >
        {card.flipped || card.matched ? (
          <span className="drop-shadow-md">{card.emoji}</span>
        ) : (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white/60 text-xs font-black">?</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function MemorySetup() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const [leaderboard, setLeaderboard] = useState<BasicLeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/memory-scores`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingLb(false));
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => { setIsTeacher(r.ok); })
      .catch(() => {});
  }, []);

  return (
    <GameSetupLayout
      bgGradient="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20"
      iconGradient="from-indigo-500 via-purple-500 to-pink-500"
      iconShadow="shadow-purple-500/40"
      icon={<Brain className="w-10 h-10 text-white" />}
      title={lang === "ar" ? "لعبة الذاكرة" : "Memory Match"}
      subtitle={lang === "ar" ? "اقلب البطاقات وابحث عن الأزواج المتطابقة!" : "Flip cards and find matching pairs!"}
      showSparkle
    >
      <HowToPlayCard accentColor="text-purple-500">
        <div className="flex items-start gap-4">
          <div className="grid grid-cols-3 gap-1.5 shrink-0">
            {DEMO_CARDS.map((card, i) => (
              <DemoCard key={i} card={card} index={i} />
            ))}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
            <p>{lang === "ar" ? "🃏 اقلب بطاقتين في كل دور" : "🃏 Flip two cards each turn"}</p>
            <p>{lang === "ar" ? "✨ إذا تطابقتا تبقيان مكشوفتين" : "✨ If they match, they stay revealed"}</p>
            <p>{lang === "ar" ? "❌ إذا لم تتطابقا تُقلبان — لديك ٣ أرواح" : "❌ If not, they flip back — you have 3 lives"}</p>
            <p>{lang === "ar" ? "🏆 كل مستوى يزداد صعوبة — بطاقات أكثر!" : "🏆 Each level gets harder — more cards!"}</p>
          </div>
        </div>
      </HowToPlayCard>

      <GameStartButton
        onClick={() => setLocation("/game/memory/play")}
        gradient="from-indigo-500 via-purple-500 to-pink-500"
        shadow="shadow-purple-500/30"
        label={lang === "ar" ? "ابدأ اللعب" : "Start Playing"}
      />

      <ChallengeFriendButton onClick={() => setShowArenaLobby(true)} />

      <AnimatePresence>
        {showArenaLobby && (
          <MultiplayerLobby
            gameId="memory"
            gameTitle={lang === "ar" ? "لعبة الذاكرة" : "Memory Game"}
            playUrl="/game/memory/play"
            playerName=""
            onClose={() => setShowArenaLobby(false)}
          />
        )}
      </AnimatePresence>

      {isTeacher && (
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/game/memory/create")}
          className="w-full bg-card border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-purple-400 transition-all text-center mb-8 flex items-center justify-center gap-3 group"
        >
          <PenLine className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">{lang === "ar" ? "أنشئ بطاقات مخصصة (للمعلمين)" : "Create Custom Cards (Teachers)"}</span>
        </motion.button>
      )}

      <LeaderboardCard
        entries={leaderboard}
        loading={loadingLb}
        scoreColor="text-purple-600 dark:text-purple-400"
        spinnerColor="border-purple-500/30 border-t-purple-500"
      />
    </GameSetupLayout>
  );
}
