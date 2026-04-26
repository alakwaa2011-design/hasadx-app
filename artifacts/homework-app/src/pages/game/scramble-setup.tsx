import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle, Play, Trophy, Crown, Medal,
  PenLine, KeyRound, ChevronDown, Eye, Trash2, Check,
  Zap, BookOpen, Target, Flame, FolderOpen, Send, Swords
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";
import { CATEGORIES, CATEGORY_LABELS, getDifficultyLabel } from "@/lib/scramble-engine";
import type { ScrambleDifficulty } from "@/lib/scramble-engine";
import { GameSetupLayout } from "@/components/game/game-setup-layout";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  streak: number;
  difficulty: string;
}

interface SavedWordSet {
  id: number;
  title: string;
  pin: string;
  gradeLevel: string | null;
  words: { word: string; hint?: string; question?: string }[];
  createdAt: string;
}

const DIFF_OPTIONS: { key: ScrambleDifficulty; icon: React.ReactNode; color: string; activeClass: string }[] = [
  { key: "easy", icon: <BookOpen className="w-3.5 h-3.5" />, color: "text-green-600", activeClass: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-400" },
  { key: "medium", icon: <Target className="w-3.5 h-3.5" />, color: "text-blue-600", activeClass: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-400" },
  { key: "hard", icon: <Zap className="w-3.5 h-3.5" />, color: "text-orange-600", activeClass: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-400" },
  { key: "challenge", icon: <Flame className="w-3.5 h-3.5" />, color: "text-red-600", activeClass: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-400" },
];

export default function ScrambleSetup() {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();

  const [category, setCategory] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<ScrambleDifficulty>("medium");
  const [pin, setPin] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showArenaLobby, setShowArenaLobby] = useState(false);
  const [loadingLb, setLoadingLb] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [savedSets, setSavedSets] = useState<SavedWordSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    setLoadingLb(true);
    fetch(`${API_BASE}/api/scramble-scores?difficulty=${difficulty}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingLb(false));
  }, [difficulty]);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => {
        if (r.ok) {
          setIsTeacher(true);
          setLoadingSets(true);
          fetch(`${API_BASE}/api/word-sets`, { credentials: "include" })
            .then(r2 => r2.ok ? r2.json() : [])
            .then(d => setSavedSets(Array.isArray(d) ? d : []))
            .catch(() => {})
            .finally(() => setLoadingSets(false));
        }
      })
      .catch(() => {});
  }, []);

  const handleStart = () => {
    const params = new URLSearchParams();
    params.set("difficulty", difficulty);
    if (category !== "all") params.set("category", category);
    setLocation(`/game/scramble/play?${params.toString()}`);
  };

  const handlePinJoin = () => {
    const trimmed = pin.trim();
    if (trimmed.length >= 4) {
      setLocation(`/game/scramble/play?pin=${trimmed}`);
    }
  };

  const handleCopyPin = (p: string) => {
    const url = `${window.location.origin}/game/scramble/play?pin=${p}`;
    const text = lang === "ar"
      ? `🔤 الكلمات المبعثرة\n🔑 الرمز: ${p}\n🔗 ${url}`
      : `🔤 Scrambled Words\n🔑 PIN: ${p}\n🔗 ${url}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPin(p);
      setTimeout(() => setCopiedPin(null), 2000);
    }).catch(() => {});
  };

  const handleDeleteSet = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/word-sets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSavedSets(prev => prev.filter(s => s.id !== id));
      }
    } catch {}
  };

  const catLabel = category === "all"
    ? (lang === "ar" ? "الكل" : "All")
    : (lang === "ar" ? CATEGORY_LABELS[category]?.ar || category : CATEGORY_LABELS[category]?.en || category);

  return (
    <GameSetupLayout
      bgGradient="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-fuchsia-950/20"
      iconGradient="from-violet-500 via-purple-500 to-fuchsia-500"
      iconShadow="shadow-purple-500/30"
      icon={<Shuffle className="w-8 h-8 text-white" />}
      title={lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words"}
      subtitle={lang === "ar" ? "رتّب الحروف المبعثرة لتكوّن الكلمة الصحيحة!" : "Unscramble the letters to form the correct word!"}
      headerSize="sm"
    >
      {isTeacher && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex gap-2 mb-3">
          <button
            onClick={() => setLocation("/game/scramble/create")}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all">
            <PenLine className="w-4 h-4" />
            {lang === "ar" ? "أنشئ كلمات مخصصة" : "Create Custom Words"}
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200/60 dark:border-violet-800/30 rounded-2xl p-4 mb-3"
      >
        <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest text-center mb-3">
          {lang === "ar" ? "كيف تلعب؟" : "How to Play"}
        </p>
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap" dir="ltr">
          {["ك", "ت", "ا", "ب"].map((letter, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 350 }}
              className="w-10 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white font-black text-lg flex items-center justify-center shadow-lg"
              style={{ boxShadow: "0 4px 0 #6d28d9, 0 6px 15px rgba(139,92,246,0.35)" }}
            >
              {letter}
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground"
        >
          {lang === "ar" ? "← اضغط على الحروف لترتيبها وتكوين كلمة" : "Tap letters to build the correct word →"}
        </motion.div>
      </motion.div>

      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleStart}
        className="w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-xl p-3.5 shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all text-center mb-2 flex items-center justify-center gap-2">
        <Play className="w-5 h-5 text-white" />
        <span className="font-black text-white text-base">{lang === "ar" ? "ابدأ اللعب" : "Start Playing"}</span>
      </motion.button>

      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowArenaLobby(true)}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-700 rounded-xl p-3.5 shadow-lg hover:shadow-xl transition-all text-center mb-3 flex items-center justify-center gap-2">
        <Swords className="w-5 h-5 text-white" />
        <span className="font-black text-white text-base">{lang === "ar" ? "تحدِّ صديقاً ⚔️" : "Challenge a Friend ⚔️"}</span>
      </motion.button>

      <AnimatePresence>
        {showArenaLobby && (
          <MultiplayerLobby
            gameId="scramble"
            gameTitle={lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words"}
            playUrl={`/game/scramble/play?difficulty=${difficulty}${category !== "all" ? `&category=${category}` : ""}`}
            playerName=""
            onClose={() => setShowArenaLobby(false)}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card border border-border/60 rounded-xl p-3 shadow-sm mb-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
            <Shuffle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-xs font-bold text-foreground shrink-0">{lang === "ar" ? "الفئة" : "Category"}</span>
            <div className="relative flex-1">
              <button
                onClick={() => setCatOpen(!catOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-bold">
                <span>{catLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${catOpen ? "rotate-180" : ""}`} />
              </button>
              {catOpen && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { setCategory("all"); setCatOpen(false); }}
                    className={`w-full text-start px-3 py-2 text-xs font-bold transition-colors ${category === "all" ? "bg-purple-100 dark:bg-purple-950/30 text-purple-600" : "hover:bg-muted"}`}>
                    {lang === "ar" ? "الكل" : "All"}
                  </button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false); }}
                      className={`w-full text-start px-3 py-2 text-xs font-bold transition-colors ${category === cat ? "bg-purple-100 dark:bg-purple-950/30 text-purple-600" : "hover:bg-muted"}`}>
                      {lang === "ar" ? CATEGORY_LABELS[cat]?.ar || cat : CATEGORY_LABELS[cat]?.en || cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-xs font-bold text-foreground shrink-0">{lang === "ar" ? "المستوى" : "Level"}</span>
            <div className="flex gap-1">
              {DIFF_OPTIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 transition-all ${
                    difficulty === d.key ? d.activeClass : "border-border/60 text-muted-foreground hover:border-purple-200"
                  }`}
                  title={getDifficultyLabel(d.key, lang)}>
                  {d.icon}
                  <span className="hidden sm:inline">{getDifficultyLabel(d.key, lang)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="bg-card border border-border/60 rounded-xl p-3 shadow-sm mb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="text-xs font-bold text-foreground shrink-0">{lang === "ar" ? "رمز المعلم" : "Teacher PIN"}</span>
          <input
            type="text"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="PIN"
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-center font-bold tracking-widest text-sm min-w-0"
            dir="ltr"
          />
          <button
            onClick={handlePinJoin}
            disabled={pin.trim().length < 4}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-xs disabled:opacity-40 transition-all">
            {lang === "ar" ? "انضم" : "Join"}
          </button>
        </div>
      </motion.div>

      {isTeacher && savedSets.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          className="bg-card border border-border/60 rounded-xl p-3 shadow-sm mb-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-3.5 h-3.5 text-purple-500" />
            <p className="text-xs font-bold text-foreground">{lang === "ar" ? "مجموعاتك المحفوظة" : "Your Saved Sets"}</p>
            <span className="text-[10px] text-muted-foreground">({savedSets.length})</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {loadingSets ? (
              <div className="flex justify-center py-3">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
              </div>
            ) : (
              savedSets.map(set => (
                <div key={set.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-xs truncate">{set.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {set.words.length} {lang === "ar" ? "كلمة" : "words"} • PIN: {set.pin}
                      {set.gradeLevel && ` • ${set.gradeLevel}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setLocation(`/game/scramble/play?pin=${set.pin}`)}
                    className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 transition-colors"
                    title={lang === "ar" ? "العب" : "Play"}>
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setLocation(`/game/scramble/monitor?pin=${set.pin}&title=${encodeURIComponent(set.title)}`)}
                    className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition-colors"
                    title={lang === "ar" ? "مراقبة مباشرة" : "Live Monitor"}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleCopyPin(set.pin)}
                    className="p-1.5 rounded-lg bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 hover:bg-green-200 transition-colors"
                    title={lang === "ar" ? "نسخ الرابط" : "Copy Link"}>
                    {copiedPin === set.pin ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSet(set.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
                    title={lang === "ar" ? "حذف" : "Delete"}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        className="bg-card border border-border/60 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="font-black text-foreground text-sm">{lang === "ar" ? "لوحة المتصدرين" : "Leaderboard"}</h2>
          </div>
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
                  difficulty === d.key ? d.activeClass + " border" : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}>
                {getDifficultyLabel(d.key, lang)}
              </button>
            ))}
          </div>
        </div>

        {loadingLb ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-xs">{lang === "ar" ? "لا توجد نتائج بعد. كن أول متصدر!" : "No scores yet. Be the first!"}</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {leaderboard.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: isRtl ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-2 p-2 rounded-lg ${i === 0 ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20" : i < 3 ? "bg-muted/50" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"}`}>
                  {i === 0 ? <Crown className="w-3 h-3" /> : i < 3 ? <Medal className="w-3 h-3" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-xs truncate">{entry.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {lang === "ar" ? `المستوى ${entry.level}` : `Lv ${entry.level}`}
                    {entry.streak > 0 && <span className="text-purple-500"> • 🔥{entry.streak}</span>}
                  </p>
                </div>
                <span className="font-black text-purple-600 dark:text-purple-400 text-xs">{entry.score}</span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </GameSetupLayout>
  );
}
