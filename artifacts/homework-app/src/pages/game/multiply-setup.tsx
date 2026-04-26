import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, ArrowLeft, ArrowRight, Play, Trophy, Crown, Medal, Shuffle, BookOpen, Zap, Flame, Target, Swords } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Difficulty } from "@/lib/multiply-engine";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  streak: number;
  difficulty: string;
}

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const DIFFICULTIES: { key: Difficulty; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { key: "easy", icon: <BookOpen className="w-5 h-5" />, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-500" },
  { key: "medium", icon: <Target className="w-5 h-5" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-500" },
  { key: "hard", icon: <Zap className="w-5 h-5" />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-500" },
  { key: "challenge", icon: <Flame className="w-5 h-5" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-500" },
];

export default function MultiplySetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(true);
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    setLoadingLb(true);
    fetch(`${API_BASE}/api/multiply-scores?difficulty=${difficulty}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingLb(false));
  }, [difficulty]);

  const getDiffLabel = (key: Difficulty) => {
    if (lang === "ar") {
      switch (key) {
        case "easy": return "سهل";
        case "medium": return "متوسط";
        case "hard": return "صعب";
        case "challenge": return "تحدي";
      }
    }
    switch (key) {
      case "easy": return "Easy";
      case "medium": return "Medium";
      case "hard": return "Hard";
      case "challenge": return "Challenge";
    }
  };

  const getDiffDesc = (key: Difficulty) => {
    if (lang === "ar") {
      switch (key) {
        case "easy": return "×١ إلى ×٥ • ١٥ ثانية";
        case "medium": return "×١ إلى ×٩ • ١٠ ثواني";
        case "hard": return "×١ إلى ×١٢ • ٧ ثواني";
        case "challenge": return "×١ إلى ×١٥ • وقت يتناقص!";
      }
    }
    switch (key) {
      case "easy": return "×1 to ×5 • 15s timer";
      case "medium": return "×1 to ×9 • 10s timer";
      case "hard": return "×1 to ×12 • 7s timer";
      case "challenge": return "×1 to ×15 • decreasing time!";
    }
  };

  const handleStart = () => {
    const params = new URLSearchParams();
    if (selectedTable !== null) params.set("table", String(selectedTable));
    params.set("difficulty", difficulty);
    const qs = params.toString();
    setLocation(`/game/multiply/play${qs ? `?${qs}` : ""}`);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-yellow-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-2xl shadow-orange-500/40 mb-4">
              <Calculator className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-foreground mb-1">{lang === "ar" ? "جدول الضرب" : "Multiplication Table"}</h1>
            <p className="text-muted-foreground text-sm">{lang === "ar" ? "اختر الجدول ومستوى الصعوبة وابدأ!" : "Pick a table and difficulty, then start!"}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card border border-border/60 rounded-2xl p-4 shadow-lg mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-bold text-foreground">{lang === "ar" ? "اختر جدول الضرب" : "Choose Multiplication Table"}</p>
            </div>

            <button
              onClick={() => setSelectedTable(null)}
              className={`w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all font-bold text-sm ${
                selectedTable === null
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 shadow-md"
                  : "border-border/60 bg-card text-muted-foreground hover:border-orange-300"
              }`}
            >
              <Shuffle className="w-4 h-4" />
              {lang === "ar" ? "عشوائي (كل الجداول)" : "Random (All Tables)"}
            </button>

            <div className="grid grid-cols-4 gap-2">
              {TABLES.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTable(t)}
                  className={`py-3 rounded-xl border-2 transition-all font-black text-lg ${
                    selectedTable === t
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 shadow-md scale-105"
                      : "border-border/60 bg-card text-foreground hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {selectedTable !== null && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-orange-500 font-bold mt-2">
                {lang === "ar" ? `ستتدرب على جدول ${selectedTable} فقط` : `You'll practice table ${selectedTable} only`}
              </motion.p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-border/60 rounded-2xl p-4 shadow-lg mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-bold text-foreground">{lang === "ar" ? "مستوى الصعوبة" : "Difficulty Level"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    difficulty === d.key
                      ? `${d.border} ${d.bg} ${d.color} shadow-md`
                      : "border-border/60 bg-card text-muted-foreground hover:border-orange-200"
                  }`}
                >
                  <div className={difficulty === d.key ? d.color : "text-muted-foreground/60"}>
                    {d.icon}
                  </div>
                  <span className="font-black text-sm">{getDiffLabel(d.key)}</span>
                  <span className={`text-[10px] ${difficulty === d.key ? "opacity-80" : "text-muted-foreground/60"}`}>
                    {getDiffDesc(d.key)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-5 shadow-xl shadow-orange-500/30 hover:shadow-2xl transition-all text-center mb-2 flex items-center justify-center gap-3">
            <Play className="w-6 h-6 text-white" />
            <span className="font-black text-white text-lg">{lang === "ar" ? "ابدأ اللعب" : "Start Playing"}</span>
          </motion.button>

          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowArenaLobby(true)}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all text-center mb-8 flex items-center justify-center gap-3">
            <Swords className="w-5 h-5 text-white" />
            <span className="font-black text-white">{lang === "ar" ? "تحدِّ صديقاً ⚔️" : "Challenge a Friend ⚔️"}</span>
          </motion.button>

          <AnimatePresence>
            {showArenaLobby && (
              <MultiplayerLobby
                gameId="multiply"
                gameTitle={lang === "ar" ? "جدول الضرب" : "Multiplication"}
                playUrl={`/game/multiply/play?difficulty=${difficulty}${selectedTable !== null ? `&table=${selectedTable}` : ""}`}
                playerName=""
                onClose={() => setShowArenaLobby(false)}
              />
            )}
          </AnimatePresence>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="font-black text-foreground text-base">{lang === "ar" ? "لوحة المتصدرين" : "Leaderboard"}</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                {getDiffLabel(difficulty)}
              </span>
            </div>

            {loadingLb ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 rounded-full border-3 border-orange-500/30 border-t-orange-500 animate-spin" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">{lang === "ar" ? "لا توجد نتائج بعد. كن أول متصدر!" : "No scores yet. Be the first!"}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {leaderboard.map((entry, i) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20" : i < 3 ? "bg-muted/50" : "bg-transparent"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      {i === 0 ? <Crown className="w-4 h-4" /> : i < 3 ? <Medal className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{entry.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {lang === "ar" ? `المستوى ${entry.level}` : `Level ${entry.level}`}
                        {entry.streak > 0 && (
                          <span className="text-orange-500"> • {lang === "ar" ? `سلسلة ${entry.streak}` : `Streak ${entry.streak}`}</span>
                        )}
                      </p>
                    </div>
                    <span className="font-black text-orange-600 dark:text-orange-400 text-sm">{entry.score}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <button onClick={() => setLocation("/")} className="w-full mt-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "الرئيسية" : "Home"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
