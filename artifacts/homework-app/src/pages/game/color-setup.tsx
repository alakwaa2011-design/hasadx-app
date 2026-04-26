import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";
import { generateLevel, getBaseColor, getDiffColor } from "@/lib/color-engine";
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

export default function ColorSetup() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const [leaderboard, setLeaderboard] = useState<BasicLeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(true);
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/color-scores`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingLb(false));
  }, []);

  const demo = generateLevel(1);

  return (
    <GameSetupLayout
      bgGradient="bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 dark:from-violet-950/20 dark:via-fuchsia-950/20 dark:to-pink-950/20"
      iconGradient="from-violet-500 to-fuchsia-600"
      iconShadow="shadow-violet-500/40"
      icon={<Palette className="w-10 h-10 text-white" />}
      title={lang === "ar" ? "لعبة الألوان" : "Find the Different Color"}
      subtitle={lang === "ar" ? "هل عينك حادة بما يكفي؟ لعبة الألوان !" : "Is your eye sharp enough? Find the odd square!"}
    >
      <HowToPlayCard accentColor="text-violet-500">
        <div className="flex items-center gap-4">
          <div
            className="grid gap-1 shrink-0"
            style={{
              gridTemplateColumns: `repeat(${demo.gridSize}, 1fr)`,
              width: demo.gridSize * 36,
            }}
          >
            {Array.from({ length: demo.gridSize * demo.gridSize }).map((_, i) => (
              <div
                key={i}
                className={`rounded aspect-square ${i === demo.diffIndex ? "ring-2 ring-violet-400 shadow-md" : ""}`}
                style={{ backgroundColor: i === demo.diffIndex ? getDiffColor(demo) : getBaseColor(demo) }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lang === "ar"
              ? "ابحث عن المربع المختلف في اللون! كل مستوى يزداد صعوبة — الشبكة أكبر والفرق أصغر."
              : "Find the square with a slightly different color! Each level gets harder — bigger grid, smaller difference."}
          </p>
        </div>
      </HowToPlayCard>

      <GameStartButton
        onClick={() => setLocation("/game/color/play")}
        gradient="from-violet-500 to-fuchsia-600"
        shadow="shadow-violet-500/30"
        label={lang === "ar" ? "ابدأ اللعب" : "Start Playing"}
      />

      <ChallengeFriendButton
        onClick={() => setShowArenaLobby(true)}
        gradient="from-indigo-500 to-purple-600"
        className="mb-8"
      />

      <AnimatePresence>
        {showArenaLobby && (
          <MultiplayerLobby
            gameId="color"
            gameTitle={lang === "ar" ? "لعبة الألوان" : "Color Game"}
            playUrl="/game/color/play"
            playerName=""
            onClose={() => setShowArenaLobby(false)}
          />
        )}
      </AnimatePresence>

      <LeaderboardCard
        entries={leaderboard}
        loading={loadingLb}
        scoreColor="text-violet-600 dark:text-violet-400"
        spinnerColor="border-violet-500/30 border-t-violet-500"
      />
    </GameSetupLayout>
  );
}
