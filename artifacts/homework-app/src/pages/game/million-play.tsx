import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import {
  Trophy, HelpCircle, Phone, Users, Loader2, CheckCircle,
  Shield, ArrowRight, ArrowLeft, Eye, Crown, Medal, Save,
  Volume2, VolumeX, Shuffle, Star, RefreshCw, Clock, Zap, AlertTriangle,
} from "lucide-react";
import { useGameAudio } from "./useGameAudio";
import { ConfettiBurst } from "@/components/confetti-burst";
import { CoinRain } from "@/components/coin-rain";
import { ShareButtons } from "@/components/share-buttons";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";

const API_BASE = import.meta.env.VITE_API_URL || "";
const CLASS_STUDENTS_KEY = "millionClassStudents";

const FULL_PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const SAFE_HAVEN_INDICES = [4, 9];

type Phase = "loading" | "playing" | "class_selected" | "selected" | "correct" | "wrong" | "wrong_reveal" | "won" | "quit" | "class_reveal";
type OptionKey = "A" | "B" | "C" | "D";

interface GameQuestion {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl: string | null;
}

interface ScoreEntry {
  id: number;
  playerName: string;
  score: number;
  level: number;
  assignmentTitle: string | null;
  category: string | null;
  createdAt: string;
}

const BANK_CATEGORY_LABELS_AR: Record<string, string> = {
  culture: "ثقافة عامة", religion: "دين وأخلاق", language: "لغة وأدب",
  inventions: "اختراعات وعلماء", countries: "دول وعواصم", technology: "تكنولوجيا",
  science: "علوم", geography: "جغرافيا", history: "تاريخ", sports: "رياضة",
  mathematics: "رياضيات", art: "فن", space: "فضاء", economics: "اقتصاد",
  animals: "حيوانات", food: "طعام", cinema: "سينما", medicine: "طب",
  plants: "نباتات", nature: "طبيعة", politics: "سياسة", energy: "طاقة", literature: "أدب",
};
const BANK_LEVEL_LABELS_AR: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const BANK_CATEGORY_LABELS_EN: Record<string, string> = {
  culture: "General Culture", religion: "Religion & Ethics", language: "Language",
  inventions: "Inventions", countries: "Countries", technology: "Technology",
  science: "Science", geography: "Geography", history: "History", sports: "Sports",
  mathematics: "Mathematics", art: "Art", space: "Space", economics: "Economics",
  animals: "Animals", food: "Food", cinema: "Cinema", medicine: "Medicine",
  plants: "Plants", nature: "Nature", politics: "Politics", energy: "Energy", literature: "Literature",
};
const BANK_LEVEL_LABELS_EN: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

interface ClassStudent {
  name: string;
  correct: number;
  wrong: number;
  skipped: number;
}

function formatPrize(n: number): string {
  return n.toLocaleString("en-US");
}

function getSafeScore(currentIndex: number, prizeList: number[]): number {
  let safeScore = 0;
  for (const si of SAFE_HAVEN_INDICES) {
    if (si < prizeList.length && currentIndex > si) safeScore = prizeList[si];
  }
  return safeScore;
}

const OPTION_LABELS: OptionKey[] = ["A", "B", "C", "D"];
const ARABIC_OPTION_LABELS: Record<OptionKey, string> = { A: "أ", B: "ب", C: "ج", D: "د" };

const PRAISE_PHRASES = [
  "أحسنت! ⭐", "ممتاز! 🌟", "رائع! 🎉", "بارك الله فيك! ✨",
  "أجبت إجابة صحيحة! 🏆", "تفوقت! 🥇", "عبقري! 🧠",
];

function downloadClassCSV(students: ClassStudent[], totalQ: number) {
  const header = "الاسم,صحيح,خطأ,مُمرَّر,الإجمالي\n";
  const rows = students.map(s => {
    const total = s.correct + s.wrong + s.skipped;
    return `${s.name},${s.correct},${s.wrong},${s.skipped},${total}`;
  }).join("\n");
  const summary = `\n\nإجمالي الأسئلة,${totalQ}`;
  const blob = new Blob(["\uFEFF" + header + rows + summary], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "نتائج-الصف.csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MillionPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("million");

  const urlParams = new URLSearchParams(search);
  const playerName = urlParams.get("name") || (lang === "ar" ? "مجهول" : "Anonymous");
  const assignmentId = urlParams.get("assignmentId");
  const bankLevel = urlParams.get("bankLevel");
  const bankCategory = urlParams.get("bankCategory");
  const isClassMode = urlParams.get("classMode") === "1";
  const classPin = urlParams.get("classPin") || null;
  const playerToken = urlParams.get("playerToken") || null;
  const autoAdvance = urlParams.get("autoAdvance") === "1";
  const broadcastMode = urlParams.get("broadcast") === "1";

  // When the student is in a class session, "try again" should return to the same room
  const rejoinUrl = classPin ? `/game/million/join/${classPin}` : "/game/million";

  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [prizeList, setPrizeList] = useState<number[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<OptionKey>>(new Set());
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [audienceVotes, setAudienceVotes] = useState<Record<OptionKey, number> | null>(null);
  const [lifelines, setLifelines] = useState({ fifty: true, phone: true, audience: true, swap: true });
  const [lifelineLoading, setLifelineLoading] = useState<string | null>(null);

  const [finalScore, setFinalScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lifelinesUsedCount, setLifelinesUsedCount] = useState(0);
  const [topScores, setTopScores] = useState<ScoreEntry[]>([]);
  const [saveName, setSaveName] = useState(playerName);
  const [isSaving, setIsSaving] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);
  const [showMobileLadder, setShowMobileLadder] = useState(false);
  const [isPhoneRinging, setIsPhoneRinging] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const questionStartTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [surpriseDoubleActive, setSurpriseDoubleActive] = useState(false);
  const [showSurpriseBanner, setShowSurpriseBanner] = useState(false);
  const countdownBeepedRef = useRef<number>(-1);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session-level question source (populated from class-session response)
  const [sessionAssignmentId, setSessionAssignmentId] = useState<number | null>(null);
  const [sessionBankLevel, setSessionBankLevel] = useState<string | null>(null);
  const [sessionBankCategory, setSessionBankCategory] = useState<string | null>(null);

  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [pickedStudentIdx, setPickedStudentIdx] = useState<number | null>(null);
  const [flashingName, setFlashingName] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [showClassResults, setShowClassResults] = useState(false);
  const [manualStudentInput, setManualStudentInput] = useState("");
  const [timerExpiredInClass, setTimerExpiredInClass] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isVotingMode, setIsVotingMode] = useState(false);
  const [votingMap, setVotingMap] = useState<Map<number, OptionKey>>(new Map());
  const [votingPickerStudent, setVotingPickerStudent] = useState<number | null>(null);
  const pickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audio = useGameAudio();
  const bgStartedRef = useRef(false);
  const prevPhaseRef = useRef<Phase>("loading");
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode && prizeList.length > 0) updateScore(prizeList[currentIndex - 1] || 0); }, [currentIndex]);
  useEffect(() => {
    if (isArenaMode && (phase === "won" || phase === "wrong" || phase === "quit") && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(phase === "won" ? (prizeList[prizeList.length - 1] || 1000000) : finalScore);
    }
  }, [phase]);
  const wrongRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classPinRef = useRef(classPin);
  const playerTokenRef = useRef(playerToken);
  const correctCountRef = useRef(0);
  // In broadcast mode, accumulate prizes the same way the server does
  // (sum of PRIZE_LADDER for each correct answer; no client multipliers).
  const broadcastEarnedRef = useRef(0);

  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const currentQuestion = questions[currentIndex] as GameQuestion | undefined;

  useEffect(() => {
    if (isClassMode) {
      const stored = sessionStorage.getItem(CLASS_STUDENTS_KEY);
      if (stored) {
        try {
          const names = JSON.parse(stored) as string[];
          setClassStudents(names.map(n => ({ name: n, correct: 0, wrong: 0, skipped: 0 })));
        } catch { /* ignore */ }
      }
    }
    return () => {
      if (pickIntervalRef.current) clearInterval(pickIntervalRef.current);
      if (wrongRevealTimeoutRef.current) clearTimeout(wrongRevealTimeoutRef.current);
    };
  }, [isClassMode]);

  useEffect(() => {
    if (!classPin || !playerToken) return;
    const socket = getSocket();
    socket.emit("million-class:player-rejoin", { pin: classPin, playerToken }, () => {});
  }, [classPin, playerToken]);

  // Broadcast mode: late joiners must start at whatever question the host is on.
  // The join callback returns currentQuestionIdx; we honor it once questions load.
  const initialBroadcastIdxRef = useRef<number | null>(
    broadcastMode ? Number(urlParams.get("startIdx") || "0") : null
  );
  useEffect(() => {
    if (!broadcastMode) return;
    const startIdx = initialBroadcastIdxRef.current;
    if (startIdx == null || startIdx <= 0) return;
    if (questions.length === 0) return;
    if (startIdx >= questions.length) return;
    if (currentIndex !== 0) return; // already advanced
    setCurrentIndex(startIdx);
    questionStartTimeRef.current = Date.now();
    initialBroadcastIdxRef.current = null;
  }, [broadcastMode, questions.length, currentIndex]);

  // Broadcast mode: server controls the current question index for everyone.
  useEffect(() => {
    if (!broadcastMode || !classPin) return;
    const socket = getSocket();
    const onQuestionChanged = (data: { currentQuestionIdx: number }) => {
      const idx = data.currentQuestionIdx;
      if (idx < 0) return;
      if (idx >= questions.length && questions.length > 0) {
        // Broadcast game finished — show summary with the server-aligned
        // accumulated prize (sum of PRIZE_LADDER per correct answer). This
        // is NOT a "won the million" screen; even players who got every
        // question wrong will land here.
        if (wrongRevealTimeoutRef.current) clearTimeout(wrongRevealTimeoutRef.current);
        setFinalScore(broadcastEarnedRef.current);
        setPhase("won");
        return;
      }
      // Advance to next question (server-driven; no auto-advance)
      if (wrongRevealTimeoutRef.current) clearTimeout(wrongRevealTimeoutRef.current);
      setCurrentIndex(idx);
      setSelectedOption(null);
      setEliminatedOptions(new Set());
      setPhoneHint(null);
      setAudienceVotes(null);
      questionStartTimeRef.current = Date.now();
      setPhase("playing");
    };
    socket.on("million-class:question-changed", onQuestionChanged);
    return () => { socket.off("million-class:question-changed", onQuestionChanged); };
  }, [broadcastMode, classPin, questions.length, totalPoints]);

  useEffect(() => {
    if (!classPin || !playerToken) return;
    // In broadcast mode the server is authoritative for prize totals — never let
    // the client overwrite the accumulated prize via "finish".
    if (broadcastMode) return;
    if (phase === "wrong" || phase === "won" || phase === "quit") {
      const status = phase === "won" ? "won" : phase === "quit" ? "quit" : "wrong";
      // For "won", prize is the top prize; for "wrong"/"quit", use finalScore (safe-haven or current earned)
      const earnedPrize = phase === "won"
        ? (prizeList[prizeList.length - 1] ?? 0)
        : finalScore;
      const socket = getSocket();
      socket.emit("million-class:finish", {
        pin: classPin,
        playerToken,
        level: phase === "won" ? prizeList.length : currentIndex + 1,
        prize: earnedPrize,
        correctCount: correctCountRef.current,
        status,
        totalTimeMs: gameStartTimeRef.current ? Date.now() - gameStartTimeRef.current : 0,
        lifelinesUsed: lifelinesUsedCount,
      });
    }
  }, [phase, classPin, playerToken, currentIndex, prizeList, finalScore, broadcastMode]);

  function getOptionText(key: OptionKey): string {
    if (!currentQuestion) return "";
    const map: Record<OptionKey, string> = {
      A: currentQuestion.optionA, B: currentQuestion.optionB,
      C: currentQuestion.optionC, D: currentQuestion.optionD,
    };
    return map[key];
  }

  function getCorrectKey(): OptionKey | null {
    if (!currentQuestion) return null;
    const answer = currentQuestion.correctAnswer.toUpperCase();
    if ((["A", "B", "C", "D"] as OptionKey[]).includes(answer as OptionKey)) return answer as OptionKey;
    return null;
  }

  useEffect(() => {
    let url: string;
    if (classPin) {
      // Class session mode: use session-scoped questions endpoint.
      // This bypasses ownership checks on private assignments, as the teacher
      // already authorized access when creating the session.
      url = `${API_BASE}/api/million/class-session/${encodeURIComponent(classPin)}/questions`;
    } else if (bankLevel || bankCategory) {
      const p = new URLSearchParams();
      if (bankLevel && bankLevel !== "all") p.set("level", bankLevel);
      if (bankCategory && bankCategory !== "all") p.set("category", bankCategory);
      // Load previously seen question IDs from localStorage to avoid repeats
      // Key is scoped by player name + filter so different players don't share history
      const playerKey = playerName.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40);
      const seenKey = `millionSeenIds_${playerKey}_${bankLevel || "all"}_${bankCategory || "all"}`;
      const seenRaw = localStorage.getItem(seenKey);
      let seenIds: number[] = [];
      try { seenIds = seenRaw ? JSON.parse(seenRaw) : []; } catch { seenIds = []; }
      if (seenIds.length > 0) p.set("excludeIds", seenIds.join(","));
      url = `${API_BASE}/api/million/bank-questions${p.toString() ? "?" + p.toString() : ""}`;
    } else if (assignmentId) {
      url = `${API_BASE}/api/million/questions?assignmentId=${assignmentId}`;
    } else {
      url = `${API_BASE}/api/million/questions`;
    }
    fetch(url, { credentials: "include" })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.message || (lang === "ar" ? "لا توجد أسئلة كافية" : "Not enough questions"));
          setLocation(rejoinUrl);
          return;
        }
        return data;
      })
      .then((data?: { questions: GameQuestion[]; assignmentTitle: string; historyReset?: boolean; questionSource?: string; assignmentId?: number; bankLevel?: string; bankCategory?: string }) => {
        if (!data) return;
        if (!data.questions || data.questions.length === 0) {
          toast.error(lang === "ar" ? "لا توجد أسئلة كافية" : "Not enough questions");
          setLocation(rejoinUrl);
          return;
        }
        // For class sessions, store the session's question source so swap-question uses the right source
        if (classPin && data.questionSource === "assignment" && data.assignmentId) {
          setSessionAssignmentId(data.assignmentId);
        } else if (classPin && data.questionSource === "bank") {
          setSessionBankLevel(data.bankLevel ?? null);
          setSessionBankCategory(data.bankCategory ?? null);
        }
        // Record these question IDs as seen so they won't repeat next time
        if (bankLevel || bankCategory) {
          const playerKey = playerName.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40);
          const seenKey = `millionSeenIds_${playerKey}_${bankLevel || "all"}_${bankCategory || "all"}`;
          // If server reset history (pool exhausted), start fresh cycle with only current batch
          const prevSeen: number[] = data.historyReset ? [] : (() => {
            try { const raw = localStorage.getItem(seenKey); return raw ? JSON.parse(raw) : []; }
            catch { return []; }
          })();
          const newIds = data.questions.map(q => q.id);
          const merged = Array.from(new Set([...prevSeen, ...newIds]));
          localStorage.setItem(seenKey, JSON.stringify(merged));
        }
        setQuestions(data.questions);
        setPrizeList(FULL_PRIZE_LADDER.slice(0, data.questions.length));
        setAssignmentTitle(data.assignmentTitle || "");
        gameStartTimeRef.current = Date.now();
        setPhase("playing");
      })
      .catch(() => {
        toast.error(lang === "ar" ? "فشل تحميل الأسئلة" : "Failed to load questions");
        setLocation(rejoinUrl);
      });
  }, [assignmentId, bankLevel, bankCategory, lang, setLocation, rejoinUrl]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === "playing" && !bgStartedRef.current) {
      bgStartedRef.current = true;
      audio.startBg();
      questionStartTimeRef.current = Date.now();
    }
    if (phase === "selected") {
      audio.stopBg();
      bgStartedRef.current = false;
      if (prev === "playing") audio.playSuspense();
    }
    if (phase === "correct") {
      if (SAFE_HAVEN_INDICES.includes(currentIndex)) audio.playSafeHaven();
      else audio.playCorrect();
    }
    if (phase === "wrong" || phase === "wrong_reveal") { audio.stopBg(); bgStartedRef.current = false; if (phase === "wrong_reveal") audio.playWrong(); }
    if (phase === "won") { audio.stopBg(); bgStartedRef.current = false; audio.playMillion(); }
    if (phase === "quit") { audio.stopBg(); bgStartedRef.current = false; audio.playWalkAway(); }
  }, [phase, currentIndex, audio]);

  const totalQuestions = questions.length;

  function fetchTopScores() {
    fetch(`${API_BASE}/api/million/scores`)
      .then(r => r.json())
      .then((data: ScoreEntry[]) => setTopScores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    if (phase === "wrong" || phase === "quit" || phase === "won" || phase === "wrong_reveal") fetchTopScores();
  }, [phase]);

  useEffect(() => {
    const shouldCelebrate =
      phase === "correct" ||
      (phase === "class_reveal" && !!selectedOption && selectedOption === getCorrectKey());

    if (!shouldCelebrate) return;
    setShowCelebration(true);
    const t = setTimeout(() => setShowCelebration(false), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    setTimerSeconds(30);
    countdownBeepedRef.current = -1;
    const surpriseIdx = totalQuestions > 1 ? Math.floor(totalQuestions / 2) : -1;
    if (currentIndex === surpriseIdx && !isClassMode) {
      setSurpriseDoubleActive(true);
      setShowSurpriseBanner(true);
      const t = setTimeout(() => setShowSurpriseBanner(false), 4000);
      return () => clearTimeout(t);
    }
    setSurpriseDoubleActive(false);
    setShowSurpriseBanner(false);
    return undefined;
  }, [currentIndex, totalQuestions, isClassMode]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (timerSeconds >= 1 && timerSeconds <= 5 && countdownBeepedRef.current !== timerSeconds) {
      countdownBeepedRef.current = timerSeconds;
      audio.playCountdownBeep(timerSeconds);
    }
  }, [timerSeconds, phase, audio]);

  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (phase !== "playing") return;
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          if (isClassMode) {
            setTimerExpiredInClass(true);
            return 0;
          }
          setPhase(p => {
            if (p !== "playing") return p;
            const safeScore = getSafeScore(currentIndex, prizeList);
            setFinalScore(safeScore);
            return "wrong_reveal";
          });
          wrongRevealTimeoutRef.current = setTimeout(() => setPhase(p => p === "wrong_reveal" ? "wrong" : p), 2500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [phase, currentIndex, prizeList, isClassMode, timerKey]);

  const gameCategoryLabel = (() => {
    if (!bankCategory && !bankLevel) return null;
    const catLabels = lang === "ar" ? BANK_CATEGORY_LABELS_AR : BANK_CATEGORY_LABELS_EN;
    const lvlLabels = lang === "ar" ? BANK_LEVEL_LABELS_AR : BANK_LEVEL_LABELS_EN;
    const catLabel = bankCategory && bankCategory !== "all" ? (catLabels[bankCategory] ?? bankCategory) : (lang === "ar" ? "جميع التخصصات" : "All Categories");
    const lvlLabel = bankLevel && bankLevel !== "all" ? (lvlLabels[bankLevel] ?? bankLevel) : null;
    return lvlLabel ? `${catLabel} — ${lvlLabel}` : catLabel;
  })();

  const handleManualSave = useCallback(async (score: number, level: number) => {
    if (isSaving || manualSaved) return;
    const name = saveName.trim();
    if (!name) { toast.error(lang === "ar" ? "أدخل اسمك" : "Enter your name"); return; }
    setIsSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/million/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: name,
          score,
          level,
          assignmentTitle: assignmentTitle || undefined,
          category: gameCategoryLabel || undefined,
        }),
      });
      if (!r.ok) throw new Error("server error");
      setManualSaved(true);
      toast.success(lang === "ar" ? "تم حفظ النتيجة!" : "Score saved!");
      fetchTopScores();
    } catch { toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed"); }
    finally { setIsSaving(false); }
  }, [isSaving, manualSaved, saveName, assignmentTitle, gameCategoryLabel, lang]);

  const handlePickRandom = useCallback(() => {
    if (isPicking) return;
    const pool = classStudents.length > 0 ? classStudents : null;
    if (!pool && !manualStudentInput) return;

    if (!pool) {
      setPickedStudentIdx(null);
      return;
    }

    setIsPicking(true);
    audio.playPickStudent();

    let elapsed = 0;
    const TOTAL = 1800;
    const INTERVAL = 90;

    pickIntervalRef.current = setInterval(() => {
      const rIdx = Math.floor(Math.random() * pool.length);
      setFlashingName(pool[rIdx]?.name ?? "");
      elapsed += INTERVAL;
      if (elapsed >= TOTAL) {
        if (pickIntervalRef.current) clearInterval(pickIntervalRef.current);
        const finalIdx = Math.floor(Math.random() * pool.length);
        setPickedStudentIdx(finalIdx);
        setFlashingName(null);
        setIsPicking(false);
      }
    }, INTERVAL);
  }, [isPicking, classStudents, audio, manualStudentInput]);

  const currentPickedName = flashingName
    ?? (pickedStudentIdx !== null && classStudents.length > 0
        ? classStudents[pickedStudentIdx]?.name ?? null
        : null)
    ?? (manualStudentInput || null);

  const handleSelectOption = useCallback((key: OptionKey) => {
    if (eliminatedOptions.has(key)) return;
    audio.playSelect();
    if (isClassMode) {
      if (phase !== "playing") return;
      setSelectedOption(key);
      setTimerExpiredInClass(false);
      setPhase("class_selected");
      return;
    }
    if (phase !== "playing") return;
    setSelectedOption(key);
    setPhase("selected");
    setTimeout(() => {
      const correctKey = getCorrectKey();
      if (key === correctKey) {
        correctCountRef.current += 1;
        const prize = prizeList[currentIndex] ?? 0;
        const elapsedSec = questionStartTimeRef.current
          ? Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000)
          : 20;
        const speedMultiplier = Math.max(0.5, 1 - elapsedSec * 0.05);
        const surpriseBonus = surpriseDoubleActive ? 2 : 1;
        const questionPts = Math.round(prize * speedMultiplier * surpriseBonus);
        setTotalPoints(p => p + questionPts);
        // In broadcast mode the server is authoritative — only emit the
        // single, server-validated `answer` event (not the legacy progress event).
        if (broadcastMode) {
          broadcastEarnedRef.current += prize;
        }
        if (broadcastMode && classPin && playerToken) {
          getSocket().emit("million-class:answer", {
            pin: classPin,
            playerToken,
            questionIdx: currentIndex,
            answer: key,
            totalTimeMs: gameStartTimeRef.current ? Date.now() - gameStartTimeRef.current : 0,
          });
        } else if (classPin && playerToken) {
          getSocket().emit("million-class:update-progress", {
            pin: classPin,
            playerToken,
            level: currentIndex + 1,
            prize,
            correctCount: correctCountRef.current,
            totalTimeMs: gameStartTimeRef.current ? Date.now() - gameStartTimeRef.current : 0,
            lifelinesUsed: lifelinesUsedCount,
          });
        }
        if (currentIndex === totalQuestions - 1) {
          setFinalScore(prizeList[currentIndex] ?? 0);
          setPhase(broadcastMode ? "correct" : "won");
        } else setPhase("correct");
      } else {
        // Broadcast mode: wrong does NOT eliminate. Show reveal then wait for host to advance.
        if (broadcastMode && classPin && playerToken) {
          getSocket().emit("million-class:answer", {
            pin: classPin,
            playerToken,
            questionIdx: currentIndex,
            answer: key,
            isCorrect: false,
            prizeForQuestion: 0,
            totalTimeMs: gameStartTimeRef.current ? Date.now() - gameStartTimeRef.current : 0,
          });
          setPhase("wrong_reveal");
          // Note: no transition to terminal "wrong" — we wait for host's question-changed event
          return;
        }
        setFinalScore(getSafeScore(currentIndex, prizeList));
        setPhase("wrong_reveal");
        wrongRevealTimeoutRef.current = setTimeout(() => setPhase(p => p === "wrong_reveal" ? "wrong" : p), 2500);
      }
    }, 1200);
  }, [phase, eliminatedOptions, currentIndex, totalQuestions, prizeList, isClassMode, classPin, playerToken, audio, broadcastMode, surpriseDoubleActive, lifelinesUsedCount]);

  const handleClassReveal = useCallback(() => {
    if (phase !== "playing" && phase !== "class_selected") return;
    const correctKey = getCorrectKey();
    const isCorrect = selectedOption && selectedOption === correctKey;

    if (isCorrect) audio.playCorrect();
    else if (selectedOption) audio.playWrong();

    if (pickedStudentIdx !== null && classStudents.length > 0) {
      setClassStudents(prev => prev.map((s, i) => {
        if (i !== pickedStudentIdx) return s;
        return {
          ...s,
          correct: isCorrect ? s.correct + 1 : s.correct,
          wrong: !isCorrect && selectedOption ? s.wrong + 1 : s.wrong,
          skipped: !selectedOption ? s.skipped + 1 : s.skipped,
        };
      }));
    }
    setPhase("class_reveal");
  }, [phase, selectedOption, audio, pickedStudentIdx, classStudents]);

  const handleVotingConfirm = useCallback(() => {
    if (votingMap.size === 0) return;
    const correctKey = getCorrectKey();
    let anyCorrect = false;
    setClassStudents(prev => prev.map((s, i) => {
      const vote = votingMap.get(i);
      if (!vote) return s;
      const correct = vote === correctKey;
      if (correct) anyCorrect = true;
      return { ...s, correct: correct ? s.correct + 1 : s.correct, wrong: !correct ? s.wrong + 1 : s.wrong };
    }));
    if (anyCorrect) audio.playCorrect();
    else audio.playWrong();
    setIsVotingMode(false);
    setVotingMap(new Map());
    setVotingPickerStudent(null);
    setSelectedOption(null);
    setPhase("class_reveal");
  }, [votingMap, audio]);

  const handleNextQuestion = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (isClassMode && nextIdx >= totalQuestions) {
      audio.stopBg();
      bgStartedRef.current = false;
      if (classStudents.length > 0) {
        setShowClassResults(true);
      } else {
        setLocation("/game/million");
      }
      return;
    }
    setCurrentIndex(nextIdx);
    setSelectedOption(null);
    setEliminatedOptions(new Set());
    setPhoneHint(null);
    setAudienceVotes(null);
    setPickedStudentIdx(null);
    setManualStudentInput("");
    setTimerExpiredInClass(false);
    setIsVotingMode(false);
    setVotingMap(new Map());
    setVotingPickerStudent(null);
    setPhase("playing");
  }, [currentIndex, totalQuestions, isClassMode, classStudents, audio, setLocation]);

  // Auto-advance to next question after answer — no manual "Next" tap needed.
  // Class mode: after class_reveal (so the host/students see the result first).
  // Solo & arena: as soon as the answer is locked in correct.
  useEffect(() => {
    // Broadcast mode is host-driven: NEVER auto-advance locally — wait for the
    // server's million-class:question-changed event.
    if (broadcastMode) return;
    const shouldAdvance =
      phase === "class_reveal" ||
      (!isClassMode && phase === "correct");
    if (!shouldAdvance) return;
    const delay = isClassMode ? 2200 : 900;
    const t = setTimeout(() => handleNextQuestion(), delay);
    return () => clearTimeout(t);
  }, [phase, isClassMode, handleNextQuestion]);

  const handleQuit = useCallback(() => {
    const score = currentIndex > 0 ? (prizeList[currentIndex - 1] ?? 0) : 0;
    const quitScore = Math.max(score, getSafeScore(currentIndex, prizeList));
    setFinalScore(quitScore);
    setShowQuitConfirm(false);
    setPhase("quit");
  }, [currentIndex, prizeList]);

  const quitPrize = currentIndex > 0 ? (prizeList[currentIndex - 1] ?? 0) : 0;
  const quitAmount = Math.max(quitPrize, getSafeScore(currentIndex, prizeList));

  const useLifeline50 = useCallback(() => {
    if (!lifelines.fifty || !currentQuestion || phase !== "playing") return;
    audio.playFiftyFifty();
    setLifelines(l => ({ ...l, fifty: false }));
    setLifelinesUsedCount(c => c + 1);
    setTotalPoints(p => Math.max(0, p - Math.round((prizeList[currentIndex] ?? 0) * 0.05)));
    const correctKey = getCorrectKey();
    if (!correctKey) return;
    const others = OPTION_LABELS.filter(k => k !== correctKey);
    setEliminatedOptions(new Set(others.sort(() => Math.random() - 0.5).slice(0, 2)));
  }, [lifelines.fifty, currentQuestion, phase, audio]);

  const useLifelinePhone = useCallback(async () => {
    if (!lifelines.phone || !currentQuestion || phase !== "playing") return;
    setLifelines(l => ({ ...l, phone: false }));
    setLifelinesUsedCount(c => c + 1);
    setTotalPoints(p => Math.max(0, p - Math.round((prizeList[currentIndex] ?? 0) * 0.05)));
    setLifelineLoading("phone");
    setIsPhoneRinging(true);
    audio.playPhoneRing();
    setPhoneHint(lang === "ar" ? "جارٍ الاتصال بالصديق..." : "Calling friend...");
    setTimeout(() => setIsPhoneRinging(false), 3500);
    try {
      const r = await fetch(`${API_BASE}/api/million/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: currentQuestion.text,
          optionA: currentQuestion.optionA, optionB: currentQuestion.optionB,
          optionC: currentQuestion.optionC, optionD: currentQuestion.optionD,
        }),
      });
      const data = await r.json() as { hint: string };
      setPhoneHint(data.hint || (lang === "ar" ? "لا يتوفر تلميح." : "No hint available."));
    } catch { setPhoneHint(lang === "ar" ? "تعذّر الاتصال." : "Could not connect."); }
    finally { setLifelineLoading(null); setIsPhoneRinging(false); }
  }, [lifelines.phone, currentQuestion, phase, lang, audio]);

  const useLifelineAudience = useCallback(() => {
    if (!lifelines.audience || !currentQuestion || phase !== "playing") return;
    audio.playAudience();
    setLifelines(l => ({ ...l, audience: false }));
    setLifelinesUsedCount(c => c + 1);
    setTotalPoints(p => Math.max(0, p - Math.round((prizeList[currentIndex] ?? 0) * 0.05)));
    const correctKey = getCorrectKey();
    const votes: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
    const activeOptions = OPTION_LABELS.filter(k => !eliminatedOptions.has(k));
    let remaining = 100;
    const correctShare = Math.floor(40 + Math.random() * 35);
    if (correctKey && activeOptions.includes(correctKey)) { votes[correctKey] = correctShare; remaining -= correctShare; }
    const others = activeOptions.filter(k => k !== correctKey);
    others.forEach((k, i) => {
      const share = i === others.length - 1 ? remaining : Math.floor(remaining / others.length);
      votes[k] = share; remaining -= share;
    });
    setAudienceVotes(votes);
  }, [lifelines.audience, currentQuestion, phase, eliminatedOptions, audio]);

  const useLifelineSwap = useCallback(async () => {
    if (!lifelines.swap || !currentQuestion || phase !== "playing") return;
    setLifelines(l => ({ ...l, swap: false }));
    setLifelineLoading("swap");
    audio.playFiftyFifty();
    const penalty = Math.round((prizeList[currentIndex] ?? 0) * 0.05);
    try {
      const usedIds = questions.map(q => q.id);
      const swapBody: Record<string, unknown> = { usedIds };
      // Resolve the correct source: class-session takes priority, then URL params
      const effectiveAssignmentId = classPin ? sessionAssignmentId : (assignmentId ? Number(assignmentId) : null);
      const effectiveBankLevel = classPin ? sessionBankLevel : bankLevel;
      const effectiveBankCategory = classPin ? sessionBankCategory : bankCategory;

      if (effectiveAssignmentId) {
        swapBody.assignmentId = effectiveAssignmentId;
        // Pass classPin so the server can verify the student is in an active session
        // using this assignment — required for non-public assignments
        if (classPin) swapBody.classPin = classPin;
      } else if (effectiveBankLevel || effectiveBankCategory) {
        if (effectiveBankLevel && effectiveBankLevel !== "all") swapBody.bankLevel = effectiveBankLevel;
        if (effectiveBankCategory && effectiveBankCategory !== "all") swapBody.bankCategory = effectiveBankCategory;
        if (!swapBody.bankLevel && !swapBody.bankCategory) swapBody.bankLevel = "all";
      } else if (!classPin && (bankLevel || bankCategory)) {
        if (bankLevel && bankLevel !== "all") swapBody.bankLevel = bankLevel;
        if (bankCategory && bankCategory !== "all") swapBody.bankCategory = bankCategory;
        if (!swapBody.bankLevel && !swapBody.bankCategory) swapBody.bankLevel = "all";
      }
      const r = await fetch(`${API_BASE}/api/million/swap-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(swapBody),
      });
      if (!r.ok) {
        const err = await r.json() as { message?: string };
        toast.error(err.message || (lang === "ar" ? "لا يوجد سؤال بديل" : "No replacement available"));
        setLifelines(l => ({ ...l, swap: true }));
        return;
      }
      const newQ = await r.json() as GameQuestion;
      setLifelinesUsedCount(c => c + 1);
      setTotalPoints(p => Math.max(0, p - penalty));
      setQuestions(prev => {
        const next = [...prev];
        next[currentIndex] = newQ;
        return next;
      });
      setEliminatedOptions(new Set());
      setSelectedOption(null);
      setPhoneHint(null);
      setAudienceVotes(null);
      questionStartTimeRef.current = Date.now();
    } catch {
      toast.error(lang === "ar" ? "فشل تبديل السؤال" : "Failed to swap question");
      setLifelines(l => ({ ...l, swap: true }));
    } finally { setLifelineLoading(null); }
  }, [lifelines.swap, currentQuestion, phase, questions, currentIndex, assignmentId, bankLevel, bankCategory, classPin, sessionAssignmentId, sessionBankLevel, sessionBankCategory, lang, audio]);

  function getOptionStyle(key: OptionKey): { bg: string; border: string; textColor: string } {
    const isEliminated = eliminatedOptions.has(key);
    const correctKey = getCorrectKey();
    const isCorrect = key === correctKey;
    const isSelected = key === selectedOption;
    if (isEliminated) return { bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.05)", textColor: "text-slate-600" };
    if ((phase === "selected" || phase === "class_selected") && isSelected)
      return { bg: "#1e3a7b", border: "#3b82f6", textColor: "text-blue-200" };
    if ((phase === "correct" || phase === "wrong" || phase === "wrong_reveal" || phase === "won" || phase === "class_reveal") && isCorrect)
      return { bg: "#065f46", border: "#10b981", textColor: "text-green-300" };
    if ((phase === "wrong" || phase === "wrong_reveal" || phase === "class_reveal") && isSelected && !isCorrect)
      return { bg: "#7f1d1d", border: "#ef4444", textColor: "text-red-300" };
    return { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.2)", textColor: "text-white" };
  }

  const currentPrize = prizeList[currentIndex] ?? 0;
  const isSafeHaven = SAFE_HAVEN_INDICES.includes(currentIndex) && currentIndex < prizeList.length;

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-amber-400" />
          <p className="text-blue-300">{lang === "ar" ? "جارٍ تحميل الأسئلة..." : "Loading questions..."}</p>
        </div>
      </div>
    );
  }

  if (showClassResults && classStudents.length > 0) {
    const sorted = [...classStudents].sort((a, b) => b.correct - a.correct || a.wrong - b.wrong);
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir={dir} style={{ background: "#0a1628" }}>
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h1 className="text-3xl font-black text-amber-400 mb-1">
              {lang === "ar" ? "نتائج الصف" : "Class Results"}
            </h1>
            <p className="text-blue-300 text-sm">
              {lang === "ar" ? `${totalQuestions} سؤال — ${classStudents.length} طالب` : `${totalQuestions} questions — ${classStudents.length} students`}
            </p>
          </div>

          <div
            className="rounded-2xl p-4 mb-5 space-y-2"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {sorted.map((student, i) => {
              const total = student.correct + student.wrong + student.skipped;
              const pct = total > 0 ? Math.round((student.correct / total) * 100) : 0;
              return (
                <motion.div
                  key={student.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: i === 0 ? "rgba(245,158,11,0.15)" : i === 1 ? "rgba(255,255,255,0.07)" : i === 2 ? "rgba(205,127,50,0.1)" : "rgba(255,255,255,0.04)",
                    border: i === 0 ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="w-7 text-center">
                    {i === 0 ? <Crown className="w-5 h-5 text-yellow-400 mx-auto" /> :
                     i === 1 ? <Medal className="w-5 h-5 text-slate-400 mx-auto" /> :
                     i === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto" /> :
                     <span className="text-blue-500 text-sm font-bold">{i + 1}</span>}
                  </div>
                  <span className="text-white font-bold flex-1 truncate">{student.name}</span>
                  <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                    <span className="text-green-400">✓ {student.correct}</span>
                    <span className="text-red-400">✗ {student.wrong}</span>
                    <span className="text-blue-400 opacity-60 w-10 text-right">{pct}%</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => downloadClassCSV(classStudents, totalQuestions)}
              className="w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              <Save className="w-4 h-4" />
              {lang === "ar" ? "💾 حفظ النتائج (CSV)" : "💾 Save Results (CSV)"}
            </button>
            <button
              onClick={() => setLocation("/game/million")}
              className="w-full py-3.5 rounded-2xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              {lang === "ar" ? "العب مجدداً" : "Play Again"}
            </button>
            <button
              onClick={() => setLocation("/games")}
              className="w-full py-3 rounded-2xl font-medium text-blue-300 border border-blue-500/30"
            >
              {lang === "ar" ? "العودة للألعاب" : "Back to Games"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "won" || phase === "wrong" || phase === "quit") {
    // In broadcast mode, "won" only means the host advanced past the last
    // question — it is NOT a million-prize victory. The score is the
    // accumulated server-aligned prize, and the heading reflects "game over".
    const broadcastFinish = phase === "won" && broadcastMode;
    const wonGame = phase === "won" && !broadcastMode;
    const score = wonGame
      ? (prizeList[prizeList.length - 1] ?? 1_000_000)
      : finalScore;
    const level = wonGame ? totalQuestions : currentIndex + 1;
    const elapsedMs = gameStartTimeRef.current ? Date.now() - gameStartTimeRef.current : 0;
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
    const elapsedStr = `${elapsedMin}:${String(elapsedSec).padStart(2, "0")}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir={dir} style={{ background: "#0a1628" }}>
        {wonGame && <ConfettiBurst active />}
        {wonGame && <CoinRain count={70} durationSec={6} />}
        {wonGame && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
            {["🎈", "🌸", "🎊", "🌟", "🎉", "💛", "🎈", "🌺", "⭐", "🎊", "🌟", "🎉"].map((emoji, i) => (
              <motion.span
                key={i}
                className="absolute text-3xl"
                style={{ left: `${(i * 8.3) % 100}%`, top: "-10%" }}
                animate={{ y: ["-10%", "110vh"], x: [0, (i % 2 === 0 ? 30 : -30)], rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)] }}
                transition={{ duration: 2.5 + (i % 4) * 0.5, delay: i * 0.15, ease: "easeIn" }}
              >
                {emoji}
              </motion.span>
            ))}
          </div>
        )}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md relative z-20">
          {wonGame && (
            <motion.div className="text-center mb-2">
              {["🌟", "💛", "🌟", "⭐", "🌟", "💛", "🌟"].map((em, i) => (
                <motion.span key={i} className="inline-block text-2xl mx-0.5"
                  initial={{ opacity: 0, scale: 0, y: -30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.08, type: "spring", bounce: 0.6 }}>
                  {em}
                </motion.span>
              ))}
            </motion.div>
          )}
          <div className="text-center mb-6">
            <motion.div className="text-7xl mb-3"
              animate={wonGame ? { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.3, 1.1] } : {}}
              transition={{ duration: 1, delay: 0.3 }}>
              {wonGame ? "🏆" : broadcastFinish ? "🎯" : phase === "wrong" ? "😔" : "👋"}
            </motion.div>
            {wonGame && (
              <motion.div className="text-center mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                {["👏", "👏", "👏", "👏", "👏"].map((em, i) => (
                  <motion.span key={i} className="inline-block text-2xl mx-1"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: 3, duration: 0.4, delay: 0.8 + i * 0.08 }}>
                    {em}
                  </motion.span>
                ))}
              </motion.div>
            )}
            <h1 className={`text-3xl font-black mb-2 ${wonGame ? "text-amber-400" : broadcastFinish ? "text-cyan-300" : phase === "wrong" ? "text-red-400" : "text-blue-300"}`}>
              {wonGame ? (lang === "ar" ? "مبروك! لقد حصدت المليون!" : "Congratulations! You won a Million!")
                : broadcastFinish ? (lang === "ar" ? "انتهت اللعبة!" : "Game Over!")
                : phase === "wrong" ? (lang === "ar" ? "إجابة خاطئة!" : "Wrong Answer!")
                : (lang === "ar" ? "خرجت من اللعبة" : "You walked away")}
            </h1>
            <p className="text-white font-bold text-lg mb-1">{lang === "ar" ? "حصيلتك النهائية:" : "Your final prize:"}</p>
            <motion.p className="text-amber-400 font-black text-5xl"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, type: "spring" }}>
              {formatPrize(score)}
            </motion.p>
          </div>

          {!isClassMode && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-white font-black text-base">{totalPoints.toLocaleString("en-US")}</p>
                <p className="text-blue-400 text-[10px] font-medium">{lang === "ar" ? "نقاطك" : "Points"}</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-white font-black text-base">{elapsedStr}</p>
                <p className="text-blue-400 text-[10px] font-medium">{lang === "ar" ? "الوقت" : "Time"}</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Shield className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <p className="text-white font-black text-base">{lifelinesUsedCount}/4</p>
                <p className="text-blue-400 text-[10px] font-medium">{lang === "ar" ? "أطواق استُخدمت" : "Lifelines used"}</p>
              </div>
            </div>
          )}

          {score > 0 && (
            <div className="mb-4">
              <ShareButtons
                text={lang === "ar"
                  ? `🏆${saveName.trim() ? ` ${saveName.trim()} -` : ""} حصلت على ${formatPrize(score)} في لعبة "من سيحصد المليون؟"!\nجرّب تتغلب عليّ!`
                  : `🏆${saveName.trim() ? ` ${saveName.trim()} -` : ""} I won ${formatPrize(score)} in "Who Wins a Million?"!\nTry to beat me!`}
                url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/million"}
              />
            </div>
          )}

          {!isClassMode && score > 0 && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-blue-300 text-sm font-bold mb-2 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {lang === "ar" ? "احفظ نتيجتك في لوحة الشرف" : "Save your score to leaderboard"}
              </p>
              <div className="flex gap-2">
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} maxLength={40}
                  placeholder={lang === "ar" ? "اسمك" : "Your name"}
                  className="flex-1 px-3 py-2 rounded-xl text-white text-sm placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
                <button onClick={() => void handleManualSave(score, level)} disabled={isSaving || manualSaved}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "حفظ" : "Save")}
                </button>
              </div>
              {gameCategoryLabel && (
                <p className="text-blue-400/60 text-[10px] mt-1">
                  {lang === "ar" ? "المجال:" : "Category:"} {gameCategoryLabel}
                </p>
              )}
              {manualSaved && (
                <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />{lang === "ar" ? "تم الحفظ!" : "Saved!"}
                </p>
              )}
            </div>
          )}

          {topScores.length > 0 && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-blue-300 text-xs font-bold mb-2 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />{lang === "ar" ? "أفضل اللاعبين" : "Top Players"}
              </p>
              <div className="space-y-1">
                {topScores.slice(0, 5).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    {i === 0 ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> :
                     i === 1 ? <Medal className="w-3.5 h-3.5 text-slate-400" /> :
                     i === 2 ? <Medal className="w-3.5 h-3.5 text-amber-600" /> :
                     <span className="w-3.5 text-slate-500 font-bold">{i + 1}</span>}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-white font-semibold truncate">{s.playerName}</span>
                      {(s.category || s.assignmentTitle) && (
                        <span className="text-blue-400/70 text-[10px] truncate">{s.category || s.assignmentTitle}</span>
                      )}
                    </div>
                    <span className="text-amber-400 font-bold whitespace-nowrap">{formatPrize(s.score)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={() => setLocation(rejoinUrl)}
              className="w-full py-3.5 rounded-2xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              {lang === "ar" ? (classPin ? "أعد الدخول للغرفة" : "حاول مجدداً") : (classPin ? "Rejoin Room" : "Try Again")}
            </button>
            <button onClick={() => setLocation("/games")}
              className="w-full py-3 rounded-2xl font-medium text-blue-300 border border-blue-500/30">
              {lang === "ar" ? "العودة للألعاب" : "Back to Games"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const randomPraise = PRAISE_PHRASES[Math.floor(Date.now() / 1000) % PRAISE_PHRASES.length] ?? PRAISE_PHRASES[0]!;

  return (
    <div className="min-h-screen" dir={dir} style={{ background: "linear-gradient(180deg, #0a1628 0%, #0d1f3c 100%)" }}>
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, x: dir === "rtl" ? -60 : 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir === "rtl" ? -60 : 60 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`fixed top-4 z-[80] pointer-events-none flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl ${dir === "rtl" ? "left-4" : "right-4"}`}
            style={{ background: "linear-gradient(135deg, #065f46, #047857)", border: "2px solid #10b981" }}
          >
            <span className="text-2xl">⭐</span>
            <p className="text-white font-black text-base">{randomPraise}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl p-6 w-full max-w-sm text-center"
            style={{ background: "#0d1f3c", border: "2px solid rgba(245,158,11,0.4)" }}>
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-white font-black text-xl mb-1">
              {lang === "ar" ? "تأكيد الانسحاب" : "Confirm Walk Away"}
            </h2>
            <p className="text-blue-300 text-sm mb-4">
              {lang === "ar"
                ? `ستأخذ ${formatPrize(quitAmount)} وتنهي اللعبة`
                : `You will take ${formatPrize(quitAmount)} and end the game`}
            </p>
            <p className="text-amber-400 font-black text-3xl mb-5">{formatPrize(quitAmount)}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-blue-300 border border-blue-500/30 text-sm hover:border-blue-400/50 transition-colors">
                {lang === "ar" ? "تراجع" : "Cancel"}
              </button>
              <button onClick={handleQuit}
                className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                {lang === "ar" ? "خذ الجائزة" : "Take Prize"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-3 py-4 flex flex-col gap-4">
        {isArenaMode && (
          <div className="max-w-md mx-auto w-full">
            <ArenaBar myName={myName} myScore={currentIndex > 0 ? (prizeList[currentIndex - 1] ?? 0) : 0} opponents={opponents} results={results} isRtl={lang === "ar"} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setLocation("/game/million")}
            className="flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 transition-colors">
            <BackIcon className="w-4 h-4" />{lang === "ar" ? "خروج" : "Exit"}
          </button>
          <div className="flex items-center gap-2">
            {isClassMode && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                🏫 {lang === "ar" ? "وضع الصف" : "Class Mode"}
              </span>
            )}
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-bold text-sm">{formatPrize(currentPrize)}</span>
            {isSafeHaven && (
              <span className="text-green-400 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/10">
                {lang === "ar" ? "✓ نقطة أمان" : "✓ Safe"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {phase === "playing" && (
              <div className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-black transition-all ${
                    timerSeconds <= 5
                      ? "bg-red-500/25 border border-red-500/50 text-red-400"
                      : timerSeconds <= 10
                      ? "bg-amber-500/25 border border-amber-500/50 text-amber-400"
                      : "bg-blue-500/15 border border-blue-500/30 text-blue-300"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{timerSeconds}</span>
                </div>
                {isClassMode && (
                  <button
                    onClick={() => {
                      setTimerSeconds(t => t + 30);
                      setTimerExpiredInClass(false);
                      setTimerKey(k => k + 1);
                    }}
                    className="px-2 py-1 rounded-full text-xs font-bold text-green-400 border border-green-500/30 hover:border-green-400/50 transition-colors"
                    title={lang === "ar" ? "تمديد +30 ثانية" : "Extend +30s"}
                  >
                    +30
                  </button>
                )}
              </div>
            )}
            <button onClick={audio.toggleMute}
              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-200 border border-blue-500/20 hover:border-blue-400/40 transition-colors"
              title={audio.muted ? (lang === "ar" ? "تشغيل الصوت" : "Unmute") : (lang === "ar" ? "كتم الصوت" : "Mute")}>
              {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {!isClassMode && (
              <button onClick={() => setShowMobileLadder(v => !v)}
                className="lg:hidden text-blue-300 hover:text-blue-200 text-xs font-bold px-2 py-1 rounded-lg border border-blue-500/20 transition-colors">
                {showMobileLadder ? "▲" : "▼"} {lang === "ar" ? "السلّم" : "Ladder"}
              </button>
            )}
            <span className="text-blue-300 text-sm font-bold">{currentIndex + 1}/{totalQuestions}</span>
          </div>
        </div>

        <AnimatePresence>
          {showMobileLadder && !isClassMode && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="p-3 grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                {[...prizeList].reverse().map((prize, ri) => {
                  const realIndex = prizeList.length - 1 - ri;
                  const isCurrent = realIndex === currentIndex;
                  const isPast = realIndex < currentIndex;
                  const isSafe = SAFE_HAVEN_INDICES.includes(realIndex);
                  return (
                    <div key={prize}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-bold ${isCurrent ? "scale-105" : ""}`}
                      style={{
                        background: isCurrent ? "rgba(245,158,11,0.25)" : isSafe && !isPast ? "rgba(16,185,129,0.1)" : "transparent",
                        border: isCurrent ? "1px solid rgba(245,158,11,0.5)" : "1px solid transparent",
                      }}>
                      <span className="text-blue-500 opacity-60">{realIndex + 1}</span>
                      <span className={isPast ? "text-green-400 line-through opacity-50" : isCurrent ? "text-amber-300 font-black" : isSafe ? "text-green-400" : "text-blue-300 opacity-60"}>
                        {formatPrize(prize)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-4">

            <AnimatePresence>
              {isClassMode && timerExpiredInClass && (phase === "playing" || phase === "class_selected") && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl px-4 py-3 flex items-center gap-3 font-bold text-amber-300"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)" }}
                >
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>⏰</motion.span>
                  <span>{lang === "ar" ? "انتهى الوقت — اختر طالباً للإجابة أو اكشف الجواب" : "Time's up — pick a student or reveal the answer"}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {isClassMode && (
              <div
                className="rounded-2xl p-4 flex items-center gap-3 flex-wrap"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-blue-400 text-xs font-bold mb-1">
                    {lang === "ar" ? "الطالب المجيب:" : "Student answering:"}
                  </p>
                  <AnimatePresence mode="wait">
                    {currentPickedName ? (
                      <motion.div
                        key={currentPickedName + String(isPicking)}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <span className={`font-black text-xl ${isPicking ? "text-blue-300" : "text-white"}`}>
                          {isPicking ? flashingName : currentPickedName}
                        </span>
                        {!isPicking && pickedStudentIdx !== null && (
                          <Star className="w-4 h-4 text-amber-400 animate-pulse" />
                        )}
                      </motion.div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={manualStudentInput}
                          onChange={e => setManualStudentInput(e.target.value)}
                          placeholder={lang === "ar" ? "اكتب اسم الطالب..." : "Type student name..."}
                          className="px-3 py-1.5 rounded-lg text-white text-sm placeholder-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {classStudents.length > 0 && (
                  <button
                    onClick={handlePickRandom}
                    disabled={isPicking}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
                    style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                  >
                    <Shuffle className={`w-4 h-4 ${isPicking ? "animate-spin" : ""}`} />
                    {lang === "ar" ? "اختر طالباً 🎲" : "Pick Student 🎲"}
                  </button>
                )}
              </div>
            )}

            {currentQuestion && (
              <motion.div key={currentIndex} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-5 sm:p-6"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>

                {currentQuestion.imageUrl && (
                  <img src={currentQuestion.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl mb-4" />
                )}
                {surpriseDoubleActive && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-4 px-4 py-2.5 rounded-xl text-center font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(239,68,68,0.2))", border: "2px solid rgba(245,158,11,0.6)", color: "#fbbf24" }}
                  >
                    <span className="text-xl">⚡</span>
                    {lang === "ar" ? "سؤال المفاجأة! النقاط مضاعفة ×2 🎉" : "Surprise Question! Double Points ×2 🎉"}
                    <span className="text-xl">⚡</span>
                  </motion.div>
                )}
                <p className="text-white font-bold text-2xl sm:text-3xl text-center leading-relaxed mb-6">
                  {currentQuestion.text}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OPTION_LABELS.map(key => {
                    const isEliminated = eliminatedOptions.has(key);
                    const style = getOptionStyle(key);
                    const label = lang === "ar" ? ARABIC_OPTION_LABELS[key] : key;
                    const canClick = !isEliminated && (phase === "playing" || (isClassMode && phase === "class_selected"));
                    const isCorrectKey = key === getCorrectKey();
                    const isSelectedKey = key === selectedOption;
                    const fbAnim = (phase === "correct" && isSelectedKey && isCorrectKey)
                      ? "fb-correct"
                      : (phase === "wrong_reveal" && isSelectedKey && !isCorrectKey)
                        ? "fb-wrong"
                        : ((phase === "wrong_reveal" || phase === "class_reveal") && isCorrectKey && !isSelectedKey)
                          ? "fb-revealed"
                          : "";
                    return (
                      <motion.button key={key}
                        onClick={() => canClick && handleSelectOption(key)}
                        disabled={!canClick}
                        whileHover={canClick ? { scale: 1.02 } : {}}
                        whileTap={canClick ? { scale: 0.96 } : {}}
                        className={`flex items-center gap-3 px-4 py-4 rounded-xl text-right transition-all duration-500 ${fbAnim} ${
                          isEliminated ? "opacity-0 pointer-events-none" : canClick ? "cursor-pointer" : "cursor-default"
                        }`}
                        style={{ background: style.bg, border: `2px solid ${style.border}` }}>
                        <span className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black shrink-0 text-white"
                          style={{ background: style.border }}>
                          {label}
                        </span>
                        <span className={`font-bold text-base flex-1 ${style.textColor}`}>{getOptionText(key)}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {phase === "wrong_reveal" && (
                  <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 flex flex-col items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-base"
                      style={{ background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.5)", color: "#fca5a5" }}
                    >
                      <span className="text-2xl">❌</span>
                      {lang === "ar" ? "إجابة خاطئة — الإجابة الصحيحة موضّحة باللون الأخضر" : "Wrong! The correct answer is highlighted in green"}
                    </motion.div>
                  </motion.div>
                )}

                {phase === "correct" && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-green-400 font-black text-xl">
                      <CheckCircle className="w-6 h-6" />
                      {lang === "ar" ? "إجابة صحيحة! 🎉" : "Correct! 🎉"}
                    </div>
                    <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring" }}
                      className="px-6 py-2 rounded-full font-black text-2xl"
                      style={{ background: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.5)", color: "#f59e0b" }}>
                      💰 {formatPrize(currentPrize)}
                    </motion.div>
                    {SAFE_HAVEN_INDICES.includes(currentIndex) && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-center"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }}>
                        <Shield className="w-4 h-4 shrink-0" />
                        {lang === "ar"
                          ? `🛡️ نقطة أمان! إذا انسحبت لاحقاً ستحصل على ${formatPrize(currentPrize)} على الأقل`
                          : `🛡️ Safe Haven! If you walk away later you keep at least ${formatPrize(currentPrize)}`}
                      </motion.div>
                    )}
                    {broadcastMode ? (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        {lang === "ar" ? "انتظر المعلم للانتقال للسؤال التالي…" : "Waiting for teacher to advance…"}
                      </motion.div>
                    ) : (
                      <button onClick={handleNextQuestion}
                        className="px-8 py-3 rounded-xl font-bold text-white text-sm"
                        style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                        {currentIndex === totalQuestions - 2
                          ? (lang === "ar" ? "السؤال الأخير — للمليون! 🏆" : "Final Question — For a Million! 🏆")
                          : SAFE_HAVEN_INDICES.includes(currentIndex)
                            ? (lang === "ar" ? "واصل! ←" : "Continue! →")
                            : (lang === "ar" ? "السؤال التالي ←" : "Next Question →")}
                      </button>
                    )}
                  </motion.div>
                )}

                {phase === "class_reveal" && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 flex flex-col items-center gap-3">
                    <div className={`flex items-center gap-2 font-black text-xl ${selectedOption === getCorrectKey() ? "text-green-400" : selectedOption ? "text-red-400" : "text-blue-300"}`}>
                      {selectedOption === getCorrectKey()
                        ? <><CheckCircle className="w-6 h-6" />{currentPickedName ? `${currentPickedName} أصاب! ✓` : (lang === "ar" ? "إجابة صحيحة! ✓" : "Correct! ✓")}</>
                        : selectedOption
                        ? <><span className="text-2xl">✗</span>{currentPickedName ? `${currentPickedName} أخطأ` : (lang === "ar" ? "إجابة خاطئة" : "Wrong Answer")}</>
                        : <>{lang === "ar" ? "الإجابة الصحيحة ✓" : "Correct Answer ✓"}</>
                      }
                    </div>
                    <button
                      onClick={handleNextQuestion}
                      className="px-8 py-3 rounded-xl font-bold text-white text-sm"
                      style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                      {currentIndex < totalQuestions - 1
                        ? (lang === "ar" ? "السؤال التالي ←" : "Next Question →")
                        : (lang === "ar" ? "نتائج الصف 🏆" : "Class Results 🏆")}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {isClassMode && isVotingMode && classStudents.length > 0 && phase === "playing" && (
              <div className="rounded-xl p-3" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-indigo-300 text-xs font-bold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />{lang === "ar" ? "التصويت الجماعي" : "Group Vote"}
                    <span className="text-white font-black mr-1">{votingMap.size}/{classStudents.length}</span>
                  </p>
                  {votingMap.size > 0 && (
                    <button onClick={handleVotingConfirm}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                      {lang === "ar" ? "تأكيد التصويت ✓" : "Confirm Votes ✓"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {OPTION_LABELS.map(key => {
                    const count = Array.from(votingMap.values()).filter(v => v === key).length;
                    const label = lang === "ar" ? ARABIC_OPTION_LABELS[key] : key;
                    return (
                      <div key={key} className="text-center px-2 py-1.5 rounded-lg"
                        style={{ background: count > 0 ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}>
                        <div className="text-indigo-300 text-xs font-bold">{label}</div>
                        <div className="text-white text-base font-black">{count}</div>
                      </div>
                    );
                  })}
                </div>
                {votingPickerStudent !== null && (
                  <div className="mt-2">
                    <p className="text-blue-300 text-xs font-bold mb-1">
                      {lang === "ar" ? `اختر إجابة ${classStudents[votingPickerStudent]?.name ?? ""}:` : `Answer for ${classStudents[votingPickerStudent]?.name ?? ""}:`}
                    </p>
                    <div className="flex gap-1">
                      {OPTION_LABELS.filter(k => !eliminatedOptions.has(k)).map(key => {
                        const label = lang === "ar" ? ARABIC_OPTION_LABELS[key] : key;
                        const isSelected = votingMap.get(votingPickerStudent) === key;
                        return (
                          <button key={key} onClick={() => {
                            setVotingMap(m => { const n = new Map(m); n.set(votingPickerStudent, key); return n; });
                            setVotingPickerStudent(null);
                          }}
                            className="flex-1 py-2 rounded-lg text-sm font-black transition-all"
                            style={{ background: isSelected ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.2)", border: `1px solid ${isSelected ? "#6366f1" : "rgba(99,102,241,0.4)"}`, color: "#e0e7ff" }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              {isClassMode ? (
                <div className="flex gap-2 flex-wrap">
                  {(phase === "playing" || phase === "class_selected") && (
                    <>
                      <button onClick={handleClassReveal}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                        <Eye className="w-4 h-4" />
                        {lang === "ar" ? "اكشف الإجابة" : "Reveal Answer"}
                      </button>
                      {classStudents.length > 0 && (
                        <button onClick={() => { setIsVotingMode(v => !v); setVotingPickerStudent(null); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
                          style={{ background: isVotingMode ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.5)", color: isVotingMode ? "#fff" : "#a5b4fc" }}>
                          <Users className="w-4 h-4" />
                          {lang === "ar" ? "تصويت جماعي 🗳️" : "Group Vote 🗳️"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <LifelineButton available={lifelines.fifty} loading={false} onClick={useLifeline50}
                    icon={<HelpCircle className="w-5 h-5" />} label="50/50" color="amber" />
                  <LifelineButton available={lifelines.audience} loading={false} onClick={useLifelineAudience}
                    icon={<Users className="w-5 h-5" />}
                    label={lang === "ar" ? "الجمهور" : "Audience"} color="purple" />
                  <LifelineButton available={lifelines.swap} loading={lifelineLoading === "swap"}
                    onClick={() => { void useLifelineSwap(); }}
                    icon={<RefreshCw className="w-5 h-5" />}
                    label={lang === "ar" ? "استبدل السؤال" : "Swap"} color="green" />
                  <LifelineButton available={lifelines.phone} loading={lifelineLoading === "phone"}
                    onClick={() => { void useLifelinePhone(); }}
                    icon={
                      <div className="relative">
                        <Phone className={`w-5 h-5 ${isPhoneRinging ? "animate-bounce" : ""}`} />
                        {isPhoneRinging && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400 animate-ping" />}
                      </div>
                    }
                    label={lang === "ar" ? "اتصل بصديق" : "Call Friend"} color="blue" />
                </div>
              )}
              {phase === "playing" && !isClassMode && (
                <button onClick={() => setShowQuitConfirm(true)}
                  className="px-4 py-2 rounded-xl text-amber-400 text-sm font-bold border border-amber-500/30 hover:border-amber-400/50 transition-colors">
                  {lang === "ar" ? "انسحب بالذي معك" : "Walk Away"}
                </button>
              )}
            </div>

            <AnimatePresence>
              {phoneHint && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}>
                  <div className="relative shrink-0 mt-0.5">
                    <Phone className={`w-5 h-5 text-blue-400 ${isPhoneRinging ? "animate-bounce" : ""}`} />
                    {isPhoneRinging && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-blue-300 text-xs font-bold mb-1">
                      {isPhoneRinging ? (lang === "ar" ? "📞 جارٍ الرنين..." : "📞 Ringing...") : (lang === "ar" ? "تلميح الصديق:" : "Friend's Hint:")}
                    </p>
                    <p className="text-white text-sm leading-relaxed mb-2">{phoneHint}</p>
                    {!isPhoneRinging && getCorrectKey() && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.5)" }}
                      >
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-green-300 text-sm font-black">
                          {lang === "ar"
                            ? `الجواب الصحيح: ${ARABIC_OPTION_LABELS[getCorrectKey()!]} — ${getOptionText(getCorrectKey()!)}`
                            : `Correct Answer: ${getCorrectKey()} — ${getOptionText(getCorrectKey()!)}`
                          }
                        </span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {audienceVotes && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-4"
                  style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <p className="text-purple-300 text-xs font-bold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />{lang === "ar" ? "تصويت الجمهور:" : "Audience Vote:"}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {OPTION_LABELS.map(key => {
                      const pct = audienceVotes[key] ?? 0;
                      const label = lang === "ar" ? ARABIC_OPTION_LABELS[key] : key;
                      return (
                        <div key={key} className="text-center">
                          <div className="text-purple-300 font-bold text-sm mb-1">{label}</div>
                          <div className="h-20 bg-white/5 rounded-lg relative flex items-end overflow-hidden">
                            <motion.div initial={{ height: 0 }} animate={{ height: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }} className="w-full rounded-b-lg"
                              style={{ background: "rgba(139,92,246,0.6)" }} />
                          </div>
                          <div className="text-white text-xs font-bold mt-1">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden lg:flex flex-col w-52 xl:w-64 shrink-0">
            {isClassMode && classStudents.length > 0 ? (
              <div className="rounded-2xl p-3 sticky top-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-blue-400 text-xs font-bold mb-2 text-center flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5" />{lang === "ar" ? "الطلاب" : "Students"}
                </p>
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[75vh]">
                  {classStudents.map((student, i) => {
                    const isPicked = i === pickedStudentIdx;
                    const hasVote = votingMap.has(i);
                    const vote = votingMap.get(i);
                    const isVotePicker = votingPickerStudent === i;
                    return (
                      <motion.div
                        key={student.name}
                        animate={isPicked ? { scale: 1.04 } : { scale: 1 }}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        style={{
                          background: isVotePicker ? "rgba(99,102,241,0.4)" : isPicked ? "rgba(99,102,241,0.3)" : hasVote ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                          border: isVotePicker ? "1px solid rgba(99,102,241,0.8)" : isPicked ? "1px solid rgba(99,102,241,0.6)" : hasVote ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.05)",
                        }}
                        onClick={() => {
                          if (isVotingMode && phase === "playing") {
                            setVotingPickerStudent(isVotePicker ? null : i);
                          } else if (!isPicking) {
                            setPickedStudentIdx(i);
                            setTimerExpiredInClass(false);
                          }
                        }}
                        title={isVotingMode ? (lang === "ar" ? "انقر لتعيين الإجابة" : "Click to assign answer") : (lang === "ar" ? "انقر لاختيار هذا الطالب" : "Click to select this student")}
                      >
                        <span className={`truncate flex-1 ml-1 ${isPicked || isVotePicker ? "text-white font-black" : "text-blue-200"}`}>
                          {student.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 text-[10px]">
                          {vote && <span className="text-indigo-300 font-black">{lang === "ar" ? ARABIC_OPTION_LABELS[vote] : vote}</span>}
                          {student.correct > 0 && <span className="text-green-400">✓{student.correct}</span>}
                          {student.wrong > 0 && <span className="text-red-400">✗{student.wrong}</span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-blue-400 text-xs font-bold mb-2 text-center">{lang === "ar" ? "سلّم الجوائز" : "Prize Ladder"}</p>
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[75vh]">
                  {[...prizeList].reverse().map((prize, ri) => {
                    const realIndex = prizeList.length - 1 - ri;
                    const isCurrent = realIndex === currentIndex;
                    const isPast = realIndex < currentIndex;
                    const isSafe = SAFE_HAVEN_INDICES.includes(realIndex);
                    const isTop = realIndex === prizeList.length - 1;
                    return (
                      <div key={prize}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isCurrent ? "scale-105" : ""}`}
                        style={{
                          background: isCurrent ? "rgba(245,158,11,0.25)" : isTop ? "rgba(245,158,11,0.1)" : isSafe && !isPast ? "rgba(16,185,129,0.1)" : "transparent",
                          border: isCurrent ? "1px solid rgba(245,158,11,0.5)" : isSafe && !isPast ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                        }}>
                        <span className={isPast ? "text-green-500" : isCurrent ? "text-amber-300" : "text-blue-500 opacity-50"}>{realIndex + 1}</span>
                        <span className={isPast ? "text-green-400 line-through opacity-60" : isCurrent ? "text-amber-300 font-black" : isTop ? "text-amber-500" : isSafe ? "text-green-400" : "text-blue-300 opacity-60"}>
                          {formatPrize(prize)}
                        </span>
                        {isSafe && !isPast && <Shield className="w-3 h-3 text-green-400" />}
                        {isCurrent && <span className="text-amber-400 text-[10px]">◄</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LifelineButtonProps {
  available: boolean; loading: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; color: "amber" | "blue" | "purple" | "green";
}

function LifelineButton({ available, loading, onClick, icon, label, color }: LifelineButtonProps) {
  const colorMap = {
    amber: { active: "rgba(245,158,11,0.2)", border: "rgba(245,158,11,0.5)", text: "text-amber-400" },
    blue: { active: "rgba(59,130,246,0.2)", border: "rgba(59,130,246,0.5)", text: "text-blue-400" },
    purple: { active: "rgba(139,92,246,0.2)", border: "rgba(139,92,246,0.5)", text: "text-purple-400" },
    green: { active: "rgba(16,185,129,0.2)", border: "rgba(16,185,129,0.5)", text: "text-emerald-400" },
  };
  const c = colorMap[color];
  return (
    <button onClick={onClick} disabled={!available || loading}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${available ? `${c.text} hover:scale-105` : "opacity-30 cursor-not-allowed text-slate-500"}`}
      style={{ background: available ? c.active : "rgba(255,255,255,0.03)", border: `1px solid ${available ? c.border : "rgba(255,255,255,0.05)"}` }}
      title={label}>
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
