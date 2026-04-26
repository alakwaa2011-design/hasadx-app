import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Play, ArrowRight, ArrowLeft, Crown, Medal,
  Star, User, BookOpen, ChevronDown, Users, UserRound, Lock,
  Plus, X, UserPlus, Swords, Database, Link2, QrCode, Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";

const API_BASE = import.meta.env.VITE_API_URL || "";

const PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const SAFE_HAVENS = new Set([4, 9]);
const CLASS_STUDENTS_KEY = "millionClassStudents";
const PLAYER_NAME_KEY = "millionPlayerName";

function formatPrize(n: number): string {
  return n.toLocaleString("en-US");
}

interface PublicAssignment {
  id: number;
  title: string;
  subject: string;
  questionCount: number;
  isShared?: boolean;
  isPrivate?: boolean;
  isOwn?: boolean;
  ownerName?: string | null;
}

interface LeaderboardEntry {
  id: number;
  playerName: string;
  score: number;
  level: number;
  assignmentTitle: string | null;
  category: string | null;
  createdAt: string;
}

export default function MillionSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem(PLAYER_NAME_KEY) || ""; } catch { return ""; }
  });
  const [questionSource, setQuestionSource] = useState<"assignment" | "bank">("assignment");
  const [bankLevel, setBankLevel] = useState<"easy" | "medium" | "hard" | "all">("all");
  const [bankCategory, setBankCategory] = useState<string>("all");
  const [playMode, setPlayMode] = useState<"solo" | "class" | "team">("solo");
  const [teamNameA, setTeamNameA] = useState(lang === "ar" ? "الفريق أ" : "Team A");
  const [teamNameB, setTeamNameB] = useState(lang === "ar" ? "الفريق ب" : "Team B");
  const [creating, setCreating] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [myAssignments, setMyAssignments] = useState<PublicAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [nameError, setNameError] = useState("");

  const [studentInput, setStudentInput] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const studentInputRef = useRef<HTMLInputElement>(null);

  const [classSessionMode, setClassSessionMode] = useState(false);
  const [broadcastInClassSession, setBroadcastInClassSession] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  // Class-mode → "two teams" sub-mode (host-controlled, no voting)
  const [classTwoTeams, setClassTwoTeams] = useState(false);
  const [teamCtlAName, setTeamCtlAName] = useState(lang === "ar" ? "الفريق أ" : "Team A");
  const [teamCtlBName, setTeamCtlBName] = useState(lang === "ar" ? "الفريق ب" : "Team B");
  const [teamAMembersInput, setTeamAMembersInput] = useState("");
  const [teamBMembersInput, setTeamBMembersInput] = useState("");
  const [teamAMembersList, setTeamAMembersList] = useState<string[]>([]);
  const [teamBMembersList, setTeamBMembersList] = useState<string[]>([]);

  function addTeamMember(side: "A" | "B") {
    const raw = (side === "A" ? teamAMembersInput : teamBMembersInput).trim();
    if (!raw) return;
    const list = side === "A" ? teamAMembersList : teamBMembersList;
    const setList = side === "A" ? setTeamAMembersList : setTeamBMembersList;
    const setInput = side === "A" ? setTeamAMembersInput : setTeamBMembersInput;
    if (list.includes(raw) || list.length >= 20) { setInput(""); return; }
    setList([...list, raw]);
    setInput("");
  }
  function removeTeamMember(side: "A" | "B", name: string) {
    const setList = side === "A" ? setTeamAMembersList : setTeamBMembersList;
    setList(prev => prev.filter(n => n !== name));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("arenaPin")) {
      setShowArenaLobby(true);
    }
    /* Allow deep-linking from a presentation-launched assignment. */
    const aid = params.get("assignmentId");
    if (aid) {
      const parsed = parseInt(aid, 10);
      if (!Number.isNaN(parsed)) {
        setSelectedAssignmentId(parsed);
        setQuestionSource("assignment");
      }
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => setIsTeacher(r.ok))
      .catch(() => setIsTeacher(false));
  }, []);

  useEffect(() => {
    if (isTeacher === false) {
      if (playMode === "class" || playMode === "team") setPlayMode("solo");
      if (questionSource === "assignment") setQuestionSource("bank");
      setBankLevel("all");
    }
  }, [isTeacher]);

  useEffect(() => {
    fetch(`${API_BASE}/api/million/scores`)
      .then(r => r.json())
      .then((data: LeaderboardEntry[]) => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (questionSource !== "assignment") return;
    setLoadingAssignments(true);

    const doFetch = async () => {
      const teacherData = await fetch(`${API_BASE}/api/assignments?include=shared`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []);

      const teacherList: PublicAssignment[] = Array.isArray(teacherData)
        ? teacherData
            .filter((a: PublicAssignment) => a.questionCount >= 5)
            .map((a: PublicAssignment) => ({ ...a, isPrivate: a.isOwn !== false && a.isShared === false }))
        : [];

      setMyAssignments(teacherList);
    };

    doFetch().finally(() => setLoadingAssignments(false));
  }, [questionSource]);

  function addStudent() {
    const name = studentInput.trim();
    if (!name) return;
    if (students.includes(name)) {
      setStudentInput("");
      return;
    }
    if (students.length >= 40) return;
    setStudents(prev => [...prev, name]);
    setStudentInput("");
    studentInputRef.current?.focus();
  }

  function removeStudent(name: string) {
    setStudents(prev => prev.filter(s => s !== name));
  }

  function addBulkStudents(text: string) {
    const names = text.split(/[\n،,]+/).map(s => s.trim()).filter(Boolean);
    setStudents(prev => {
      const existing = new Set(prev);
      const toAdd = names.filter(n => !existing.has(n)).slice(0, 40 - prev.length);
      return [...prev, ...toAdd];
    });
    setStudentInput("");
  }

  const handleStartTeam = useCallback(async () => {
    if (creating) return;

    if (questionSource === "assignment" && !selectedAssignmentId) {
      toast.error(lang === "ar" ? "يرجى اختيار واجب أولاً" : "Please select an assignment first");
      return;
    }

    setCreating(true);

    try {
      let fetchUrl: string;
      if (questionSource === "assignment" && selectedAssignmentId) {
        fetchUrl = `${API_BASE}/api/million/questions?assignmentId=${selectedAssignmentId}`;
      } else {
        const bParams = new URLSearchParams();
        if (bankCategory !== "all") bParams.set("category", bankCategory);
        fetchUrl = `${API_BASE}/api/million/bank-questions?${bParams.toString()}`;
      }

      const res = await fetch(fetchUrl, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        toast.error(err.message || (lang === "ar" ? "فشل تحميل الأسئلة" : "Failed to load questions"));
        setCreating(false);
        return;
      }
      const data = await res.json() as { questions: Array<{ id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; imageUrl: string | null }> };
      if (!data.questions || data.questions.length < 5) {
        toast.error(lang === "ar" ? "لا يوجد أسئلة كافية" : "Not enough questions");
        setCreating(false);
        return;
      }

      const socket = getSocket();
      socket.emit("million-team:create", {
        questions: data.questions,
        teamNames: {
          A: teamNameA.trim() || (lang === "ar" ? "الفريق أ" : "Team A"),
          B: teamNameB.trim() || (lang === "ar" ? "الفريق ب" : "Team B"),
        },
      }, (res2: { pin?: string; hostToken?: string; error?: string }) => {
        if (res2.error || !res2.pin || !res2.hostToken) {
          toast.error(res2.error || (lang === "ar" ? "فشل إنشاء الغرفة" : "Failed to create room"));
          setCreating(false);
          return;
        }
        try { sessionStorage.setItem(`millionTeamHostToken:${res2.pin}`, res2.hostToken); } catch { /* ignore */ }
        setLocation(`/game/million/team-host/${res2.pin}?token=${encodeURIComponent(res2.hostToken)}`);
      });
    } catch {
      toast.error(lang === "ar" ? "حدث خطأ" : "An error occurred");
      setCreating(false);
    }
  }, [creating, questionSource, selectedAssignmentId, bankCategory, teamNameA, teamNameB, lang, setLocation]);

  const handleCreateClassSession = useCallback(async () => {
    if (isCreatingSession) return;
    if (questionSource === "assignment" && !selectedAssignmentId) {
      toast.error(lang === "ar" ? "يرجى اختيار واجب أولاً" : "Please select an assignment first");
      return;
    }
    // For team-control mode, validate team setup before creating session
    const isTeamControl = playMode === "class" && classTwoTeams;
    if (isTeamControl) {
      if (!teamCtlAName.trim() || !teamCtlBName.trim()) {
        toast.error(lang === "ar" ? "أسماء الفريقين مطلوبة" : "Both team names are required");
        return;
      }
      if (teamAMembersList.length < 1 || teamBMembersList.length < 1) {
        toast.error(lang === "ar"
          ? "أضف على الأقل لاعبًا واحدًا في كل فريق"
          : "Add at least one player to each team");
        return;
      }
      if (teamAMembersList.length > 20 || teamBMembersList.length > 20) {
        toast.error(lang === "ar"
          ? "الحد الأقصى 20 لاعبًا لكل فريق"
          : "Maximum 20 players per team");
        return;
      }
    }
    setIsCreatingSession(true);
    try {
      const sessionMode: "individual" | "broadcast" | "team-control" =
        isTeamControl ? "team-control" : (broadcastInClassSession ? "broadcast" : "individual");
      const body: Record<string, unknown> = { questionSource, autoAdvance, mode: sessionMode };
      if (sessionMode === "team-control") {
        body.teamAName = teamCtlAName.trim();
        body.teamBName = teamCtlBName.trim();
        body.teamAMembers = teamAMembersList;
        body.teamBMembers = teamBMembersList;
      }
      if (questionSource === "assignment" && selectedAssignmentId) body.assignmentId = selectedAssignmentId;
      else {
        if (bankLevel !== "all") body.bankLevel = bankLevel;
        if (bankCategory !== "all") body.bankCategory = bankCategory;
      }
      const res = await fetch(`${API_BASE}/api/million/class-session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        toast.error(err.message || (lang === "ar" ? "فشل إنشاء الغرفة" : "Failed to create room"));
        return;
      }
      const data = await res.json() as { pin: string; hostToken: string };
      // Stash the host token in sessionStorage so it does not appear in the URL
      // (which is visible if the teacher mirrors their screen to a projector).
      try { sessionStorage.setItem(`millionClassHostToken:${data.pin}`, data.hostToken); } catch { /* ignore */ }
      const route = sessionMode === "team-control"
        ? `/game/million/team-control/${data.pin}`
        : sessionMode === "broadcast"
        ? `/game/million/broadcast/${data.pin}`
        : `/game/million/session/${data.pin}/host?token=${encodeURIComponent(data.hostToken)}`;
      setLocation(route);
    } catch {
      toast.error(lang === "ar" ? "حدث خطأ" : "An error occurred");
    } finally {
      setIsCreatingSession(false);
    }
  }, [
    isCreatingSession, questionSource, selectedAssignmentId, bankLevel, bankCategory,
    autoAdvance, lang, setLocation,
    // Mode toggles & team-control inputs must be in deps or stale values get captured.
    playMode, classTwoTeams, broadcastInClassSession,
    teamCtlAName, teamCtlBName, teamAMembersList, teamBMembersList,
  ]);

  function handleStart() {
    if (playMode === "team") {
      void handleStartTeam();
      return;
    }
    if (playMode === "solo" && classSessionMode) {
      void handleCreateClassSession();
      return;
    }
    // Class mode with two-teams (host-controlled) creates a real server session.
    if (playMode === "class" && classTwoTeams) {
      void handleCreateClassSession();
      return;
    }
    if (questionSource === "assignment" && !selectedAssignmentId) {
      toast.error(lang === "ar" ? "يرجى اختيار واجب أولاً" : "Please select an assignment first");
      return;
    }
    if (playMode === "solo") {
      const trimmedName = playerName.trim();
      if (!trimmedName) {
        setNameError(lang === "ar" ? "أدخل اسمك أولاً" : "Please enter your name");
        return;
      }
      setNameError("");
      try { localStorage.setItem(PLAYER_NAME_KEY, trimmedName); } catch { /* ignore */ }
      const p = new URLSearchParams({ name: trimmedName });
      if (questionSource === "assignment" && selectedAssignmentId) {
        p.set("assignmentId", String(selectedAssignmentId));
      } else if (questionSource === "bank") {
        p.set("bankLevel", bankLevel);
        p.set("bankCategory", bankCategory);
      }
      if (autoAdvance) p.set("autoAdvance", "1");
      sessionStorage.removeItem(CLASS_STUDENTS_KEY);
      setLocation(`/game/million/play?${p.toString()}`);
    } else {
      sessionStorage.setItem(CLASS_STUDENTS_KEY, JSON.stringify(students));
      const p = new URLSearchParams({ classMode: "1" });
      if (questionSource === "assignment" && selectedAssignmentId) {
        p.set("assignmentId", String(selectedAssignmentId));
      } else if (questionSource === "bank") {
        p.set("bankLevel", bankLevel);
        p.set("bankCategory", bankCategory);
      }
      if (autoAdvance) p.set("autoAdvance", "1");
      setLocation(`/game/million/play?${p.toString()}`);
    }
  }

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-slate-400" />;
    if (i === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold text-slate-500">{i + 1}</span>;
  };

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-8 px-4"
        dir={dir}
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setLocation("/games")}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
            >
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "الألعاب" : "Games"}
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              {lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?"}
            </h1>
            <p className="text-blue-300 text-sm">
              {lang === "ar"
                ? "15 سؤالاً تتصاعد صعوبةً — وساعدك بأربعة أطواق نجاة"
                : "15 escalating questions — with 4 lifelines to help you"}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl p-6 space-y-5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                {lang === "ar" ? "إعداد اللعبة" : "Game Setup"}
              </h2>

              <div>
                <label className="text-blue-300 text-sm font-medium block mb-2">
                  {lang === "ar" ? "وضع اللعب" : "Play Mode"}
                </label>
                <div className={`grid gap-2 ${isTeacher ? "grid-cols-3" : "grid-cols-1"}`}>
                  <button
                    onClick={() => setPlayMode("solo")}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                      playMode === "solo"
                        ? "bg-amber-500/20 border-amber-500 text-amber-400 border-2"
                        : "text-blue-300 border border-white/10 hover:border-white/25"
                    }`}
                  >
                    <UserRound className="w-5 h-5" />
                    {lang === "ar" ? "منفرد" : "Solo"}
                  </button>
                  {isTeacher && (
                    <button
                      onClick={() => setPlayMode("class")}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                        playMode === "class"
                          ? "bg-blue-500/20 border-blue-400 text-blue-300 border-2"
                          : "text-blue-300 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      <Users className="w-5 h-5" />
                      {lang === "ar" ? "الصف" : "Class"}
                    </button>
                  )}
                  {isTeacher && (
                    <button
                      onClick={() => setPlayMode("team")}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                        playMode === "team"
                          ? "bg-purple-500/20 border-purple-400 text-purple-300 border-2"
                          : "text-blue-300 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      <Swords className="w-5 h-5" />
                      {lang === "ar" ? "فريقين" : "Teams"}
                    </button>
                  )}
                </div>
                {!isTeacher && isTeacher !== null && (
                  <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-amber-200 text-xs leading-6 font-bold flex items-start gap-2">
                    <span aria-hidden="true">🔒</span>
                    <span>
                      {lang === "ar"
                        ? "لإدارة المسابقة وإنشائها (وضع الصف، البث، الفريقين) سجّل الدخول كمعلم."
                        : "To create & manage the contest (Class, Broadcast, Two-Teams) sign in as a teacher."}
                      {" "}
                      <a href="/login" className="underline text-amber-100 hover:text-white">
                        {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
                      </a>
                    </span>
                  </div>
                )}
              </div>

              {playMode === "solo" && (
                <div className="space-y-3">
                  {isTeacher && (
                    <div>
                      {/* Prominent class competition card */}
                      <button
                        onClick={() => setClassSessionMode(prev => !prev)}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-start font-bold transition-all ${
                          classSessionMode
                            ? "border-2 border-green-400"
                            : "border border-white/15 hover:border-white/30"
                        }`}
                        style={{
                          background: classSessionMode
                            ? "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.1))"
                            : "rgba(255,255,255,0.04)"
                        }}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${classSessionMode ? "bg-green-500" : "bg-blue-600/50"}`}>
                          <QrCode className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-base font-black ${classSessionMode ? "text-green-300" : "text-blue-200"}`}>
                            {lang === "ar" ? "🏆 منافسة صفية" : "🏆 Class Competition"}
                          </p>
                          <p className={`text-xs mt-0.5 ${classSessionMode ? "text-green-400/80" : "text-blue-400"}`}>
                            {lang === "ar" ? "رابط + باركود — لوحة تصنيف مباشرة" : "Link + QR code — live leaderboard"}
                          </p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-black shrink-0 ${classSessionMode ? "bg-green-500/30 text-green-300" : "bg-white/10 text-blue-400"}`}>
                          {classSessionMode ? (lang === "ar" ? "✓ مفعّل" : "✓ ON") : (lang === "ar" ? "اضغط للتفعيل" : "Tap to enable")}
                        </span>
                      </button>

                      {classSessionMode && (
                        <div className="mt-2 space-y-2">
                          <p className="text-green-500 text-xs flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {lang === "ar"
                              ? "ستحصل على رابط وباركود لإرساله للطلاب مع لوحة منافسة مباشرة"
                              : "Get a link & QR code to share with students + live leaderboard"}
                          </p>
                          {/* Auto-advance toggle */}
                          <button
                            onClick={() => setAutoAdvance(v => !v)}
                            disabled={broadcastInClassSession}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${autoAdvance ? "border border-amber-400/50 text-amber-300" : "border border-white/10 text-blue-400 hover:border-white/20"}`}
                            style={{ background: autoAdvance ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)" }}
                          >
                            <span>{lang === "ar" ? "⚡ انتقال تلقائي للسؤال التالي" : "⚡ Auto-advance to next question"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${autoAdvance ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-blue-500"}`}>
                              {autoAdvance ? (lang === "ar" ? "تلقائي" : "AUTO") : (lang === "ar" ? "يدوي" : "MANUAL")}
                            </span>
                          </button>

                          {/* Broadcast mode toggle */}
                          <button
                            onClick={() => setBroadcastInClassSession(v => !v)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${broadcastInClassSession ? "border border-cyan-400/50 text-cyan-300" : "border border-white/10 text-blue-400 hover:border-white/20"}`}
                            style={{ background: broadcastInClassSession ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.03)" }}
                          >
                            <span className="text-start flex-1">
                              {lang === "ar" ? "📡 وضع البثّ (المعلم يقود السؤال — لا يوجد إقصاء)" : "📡 Broadcast mode (teacher controls — no elimination)"}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black shrink-0 ${broadcastInClassSession ? "bg-cyan-500/30 text-cyan-300" : "bg-white/10 text-blue-500"}`}>
                              {broadcastInClassSession ? (lang === "ar" ? "✓ مفعّل" : "ON") : (lang === "ar" ? "إيقاف" : "OFF")}
                            </span>
                          </button>
                          {broadcastInClassSession && (
                            <p className="text-cyan-400 text-xs px-1">
                              {lang === "ar"
                                ? "كل الطلاب يرَون نفس السؤال في نفس اللحظة. الإجابة الخاطئة لا تُقصي — فقط الصحيحة تُضاف للجائزة."
                                : "All students see the same question simultaneously. Wrong answers don't eliminate — only correct ones add to the prize."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!classSessionMode && (
                    <div>
                      <label className="text-blue-300 text-sm font-medium block mb-1.5">
                        {lang === "ar" ? "اسمك" : "Your Name"}
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={e => { setPlayerName(e.target.value); setNameError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleStart()}
                        maxLength={40}
                        placeholder={lang === "ar" ? "مثال: أحمد" : "e.g. Ahmad"}
                        className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                      />
                      {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
                    </div>
                  )}
                </div>
              )}

              <AnimatePresence>
                {playMode === "team" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
                    >
                      <p className="text-purple-300 text-xs font-bold">
                        {lang === "ar" ? "🏆 أسماء الفريقين" : "🏆 Team Names"}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-blue-300 text-xs font-medium block mb-1">
                            🔵 {lang === "ar" ? "الفريق الأول" : "Team A"}
                          </label>
                          <input
                            type="text"
                            value={teamNameA}
                            onChange={e => setTeamNameA(e.target.value)}
                            maxLength={20}
                            placeholder={lang === "ar" ? "الفريق أ" : "Team A"}
                            className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center font-bold"
                            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}
                          />
                        </div>
                        <div>
                          <label className="text-red-300 text-xs font-medium block mb-1">
                            🔴 {lang === "ar" ? "الفريق الثاني" : "Team B"}
                          </label>
                          <input
                            type="text"
                            value={teamNameB}
                            onChange={e => setTeamNameB(e.target.value)}
                            maxLength={20}
                            placeholder={lang === "ar" ? "الفريق ب" : "Team B"}
                            className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder-red-500 focus:outline-none focus:ring-1 focus:ring-red-400 text-center font-bold"
                            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {playMode === "class" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
                    >
                      {/* Sub-mode toggle: individual class vs two teams */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setClassTwoTeams(false)}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${!classTwoTeams ? "bg-blue-500/30 border border-blue-400 text-blue-200" : "border border-white/10 text-blue-400 hover:border-white/25"}`}
                        >
                          {lang === "ar" ? "👥 منافسة فردية بين الطلاب" : "👥 Individual student competition"}
                        </button>
                        <button
                          onClick={() => setClassTwoTeams(true)}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${classTwoTeams ? "bg-purple-500/30 border border-purple-400 text-purple-200" : "border border-white/10 text-blue-400 hover:border-white/25"}`}
                        >
                          {lang === "ar" ? "⚔️ فريقَين بإدارة المعلم" : "⚔️ Two teams (host-controlled)"}
                        </button>
                      </div>

                      {classTwoTeams ? (
                        <div className="space-y-3">
                          <p className="text-purple-300 text-xs font-bold">
                            {lang === "ar"
                              ? "أنت المعلم تدير اللعبة بالكامل: كشف الإجابة، التحويل بين الفريقين، منح النقاط، وتفعيل المساعدات. لا يصوّت الطلاب."
                              : "You (teacher) drive the entire game: reveal answers, transfer questions, award points, and use lifelines. Students don't vote."}
                          </p>
                          {(["A", "B"] as const).map(side => {
                            const isA = side === "A";
                            const name = isA ? teamCtlAName : teamCtlBName;
                            const setName = isA ? setTeamCtlAName : setTeamCtlBName;
                            const list = isA ? teamAMembersList : teamBMembersList;
                            const input = isA ? teamAMembersInput : teamBMembersInput;
                            const setInput = isA ? setTeamAMembersInput : setTeamBMembersInput;
                            const color = isA ? "blue" : "red";
                            return (
                              <div key={side} className="rounded-lg p-3 space-y-2" style={{ background: `rgba(${isA ? "59,130,246" : "239,68,68"},0.08)`, border: `1px solid rgba(${isA ? "59,130,246" : "239,68,68"},0.25)` }}>
                                <div className="flex items-center gap-2">
                                  <span className={`text-${color}-300 text-xs font-bold`}>{isA ? "🔵" : "🔴"}</span>
                                  <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    maxLength={30}
                                    placeholder={isA ? (lang === "ar" ? "اسم الفريق الأول" : "Team A name") : (lang === "ar" ? "اسم الفريق الثاني" : "Team B name")}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-white text-sm font-bold focus:outline-none focus:ring-1"
                                    style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(${isA ? "59,130,246" : "239,68,68"},0.3)` }}
                                  />
                                  <span className={`text-${color}-400 text-xs shrink-0`}>{list.length}/20</span>
                                </div>
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTeamMember(side); } }}
                                    maxLength={40}
                                    placeholder={lang === "ar" ? "اسم اللاعب..." : "Player name..."}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs placeholder-blue-500 focus:outline-none"
                                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                                  />
                                  <button
                                    onClick={() => addTeamMember(side)}
                                    disabled={!input.trim() || list.length >= 20}
                                    className={`px-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-40`}
                                    style={{ background: `rgba(${isA ? "59,130,246" : "239,68,68"},0.45)` }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {list.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {list.map(n => (
                                      <span key={n} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: `rgba(${isA ? "59,130,246" : "239,68,68"},0.3)` }}>
                                        {n}
                                        <button onClick={() => removeTeamMember(side, n)} className="hover:text-red-300">
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                      <>
                      <div className="flex items-center justify-between">
                        <label className="text-blue-300 text-sm font-bold flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4" />
                          {lang === "ar" ? "أسماء الطلاب" : "Student Names"}
                        </label>
                        <span className="text-blue-500 text-xs">{students.length}/40</span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          ref={studentInputRef}
                          type="text"
                          value={studentInput}
                          onChange={e => setStudentInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); addStudent(); }
                            if (e.key === "," || e.key === "،") { e.preventDefault(); addStudent(); }
                          }}
                          onPaste={e => {
                            const text = e.clipboardData.getData("text");
                            if (text.includes("\n") || text.includes(",") || text.includes("،")) {
                              e.preventDefault();
                              addBulkStudents(text);
                            }
                          }}
                          maxLength={40}
                          placeholder={lang === "ar" ? "اسم الطالب..." : "Student name..."}
                          className="flex-1 px-3 py-2 rounded-lg text-white text-sm placeholder-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                        />
                        <button
                          onClick={addStudent}
                          disabled={!studentInput.trim()}
                          className="px-3 py-2 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-40 hover:scale-105"
                          style={{ background: "rgba(59,130,246,0.4)" }}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-blue-500 text-xs">
                        {lang === "ar"
                          ? "الصقْ أسماء متعددة مفصولة بفواصل أو أسطر جديدة"
                          : "Paste multiple names separated by commas or new lines"}
                      </p>

                      {students.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {students.map(name => (
                            <motion.div
                              key={name}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                              style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.4)" }}
                            >
                              <span>{name}</span>
                              <button onClick={() => removeStudent(name)} className="text-blue-300 hover:text-red-400 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {students.length === 0 && (
                        <p className="text-blue-500 text-xs text-center py-2">
                          {lang === "ar"
                            ? "يمكن البدء بدون أسماء — سيطلب النظام الاسم أثناء اللعب"
                            : "You can start without names — names will be entered during play"}
                        </p>
                      )}

                      {/* Auto-advance toggle for class mode */}
                      <button
                        onClick={() => setAutoAdvance(v => !v)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${autoAdvance ? "border border-amber-400/50 text-amber-300" : "border border-white/10 text-blue-400 hover:border-white/20"}`}
                        style={{ background: autoAdvance ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)" }}
                      >
                        <span>{lang === "ar" ? "⚡ انتقال تلقائي للسؤال التالي" : "⚡ Auto-advance to next question"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${autoAdvance ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-blue-500"}`}>
                          {autoAdvance ? (lang === "ar" ? "تلقائي" : "AUTO") : (lang === "ar" ? "يدوي" : "MANUAL")}
                        </span>
                      </button>
                      </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="text-blue-300 text-sm font-medium block mb-2">
                  {lang === "ar" ? "مصدر الأسئلة" : "Question Source"}
                </label>
                <div className={`grid gap-2 ${isTeacher ? "grid-cols-2" : "grid-cols-1"}`}>
                  {isTeacher && (
                    <button
                      onClick={() => setQuestionSource("assignment")}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                        questionSource === "assignment"
                          ? "bg-amber-500/20 border-amber-500 text-amber-400 border-2"
                          : "text-blue-300 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      <BookOpen className="w-5 h-5" />
                      {lang === "ar" ? "واجب" : "Assignment"}
                    </button>
                  )}
                  <button
                    onClick={() => setQuestionSource("bank")}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                      questionSource === "bank"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 border-2"
                        : "text-blue-300 border border-white/10 hover:border-white/25"
                    }`}
                  >
                    <Database className="w-5 h-5" />
                    {lang === "ar" ? "بنك الأسئلة" : "Question Bank"}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {questionSource === "bank" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
                    >
                      <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        {lang === "ar" ? "أكثر من 800 سؤال عربي متنوع" : "800+ curated Arabic questions"}
                      </p>
                      {isTeacher ? (
                        <div>
                          <label className="text-emerald-300 text-xs font-medium block mb-1.5">
                            {lang === "ar" ? "مستوى الصعوبة" : "Difficulty Level"}
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([["all", "الكل", "All"], ["easy", "سهل", "Easy"], ["medium", "متوسط", "Med"], ["hard", "صعب", "Hard"]] as const).map(([val, ar, en]) => (
                              <button
                                key={val}
                                onClick={() => setBankLevel(val as "all" | "easy" | "medium" | "hard")}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  bankLevel === val
                                    ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 border"
                                    : "text-blue-400 border border-white/10 hover:border-white/25"
                                }`}
                              >
                                {lang === "ar" ? ar : en}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-emerald-500 text-xs">
                          {lang === "ar" ? "🎲 الأسئلة متنوعة المستوى — تشمل سهل ومتوسط وصعب" : "🎲 Mixed difficulty — easy, medium & hard"}
                        </p>
                      )}
                      <div>
                        <label className="text-emerald-300 text-xs font-medium block mb-1.5">
                          {lang === "ar" ? "التخصص" : "Category"}
                        </label>
                        <div className="relative">
                          <select
                            value={bankCategory}
                            onChange={e => setBankCategory(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none transition-all"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                          >
                            <option value="all" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "جميع التخصصات" : "All Categories"}</option>
                            <option value="culture" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "ثقافة عامة" : "General Culture"}</option>
                            <option value="religion" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "دين وأخلاق" : "Religion & Ethics"}</option>
                            <option value="language" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "لغة وأدب" : "Language & Literature"}</option>
                            <option value="inventions" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "اختراعات وعلماء" : "Inventions & Scientists"}</option>
                            <option value="countries" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "دول وعواصم" : "Countries & Capitals"}</option>
                            <option value="technology" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "تكنولوجيا وتقنية" : "Technology"}</option>
                            <option value="science" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "علوم وطبيعة" : "Science & Nature"}</option>
                            <option value="geography" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "جغرافيا" : "Geography"}</option>
                            <option value="history" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "تاريخ" : "History"}</option>
                            <option value="sports" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "رياضة" : "Sports"}</option>
                            <option value="mathematics" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "رياضيات" : "Mathematics"}</option>
                            <option value="art" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "فنون" : "Arts"}</option>
                            <option value="space" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "فضاء وفلك" : "Space & Astronomy"}</option>
                            <option value="economics" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "اقتصاد" : "Economics"}</option>
                            <option value="animals" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "عالم الحيوان" : "Animals"}</option>
                            <option value="food" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "طعام وطبخ" : "Food & Cooking"}</option>
                            <option value="cinema" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "سينما وفنون" : "Cinema & Arts"}</option>
                            <option value="medicine" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "طب وصحة" : "Medicine & Health"}</option>
                            <option value="plants" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "نباتات" : "Plants"}</option>
                            <option value="nature" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "مناخ وطبيعة" : "Climate & Nature"}</option>
                            <option value="politics" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "سياسة" : "Politics"}</option>
                            <option value="energy" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "طاقة" : "Energy"}</option>
                            <option value="literature" style={{ background: "#0d1f3c" }}>{lang === "ar" ? "أدب وثقافة" : "Literature & Culture"}</option>
                          </select>
                          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {questionSource === "assignment" && (
                <div>
                  <label className="text-blue-300 text-sm font-medium block mb-1.5">
                    {lang === "ar" ? "اختر الواجب" : "Select Assignment"}
                  </label>
                  {loadingAssignments ? (
                    <div className="text-blue-400 text-sm py-2">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
                  ) : myAssignments.length === 0 ? (
                    <p className="text-blue-400 text-xs py-2">
                      {lang === "ar" ? "لا توجد واجبات تحتوي على 5 أسئلة أو أكثر" : "No assignments with 5+ questions available"}
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedAssignmentId ?? ""}
                        onChange={e => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-4 py-3 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none transition-all"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                      >
                        <option value="" style={{ background: "#0d1f3c" }}>
                          {lang === "ar" ? "-- اختر واجباً --" : "-- Choose Assignment --"}
                        </option>
                        <optgroup label={lang === "ar" ? "── واجباتي ──" : "── My Assignments ──"}>
                          {myAssignments.filter(a => a.isOwn !== false).map(a => (
                            <option key={a.id} value={a.id} style={{ background: "#0d1f3c" }}>
                              {a.title} ({a.questionCount} {lang === "ar" ? "سؤال" : "q"})
                              {a.isPrivate ? " 🔒" : ""}
                            </option>
                          ))}
                        </optgroup>
                        {myAssignments.some(a => a.isOwn === false) && (
                          <optgroup label={lang === "ar" ? "── واجبات مشتركة ──" : "── Shared Assignments ──"}>
                            {myAssignments.filter(a => a.isOwn === false).map(a => (
                              <option key={a.id} value={a.id} style={{ background: "#0d1f3c" }}>
                                {a.title} ({a.questionCount} {lang === "ar" ? "سؤال" : "q"}){a.ownerName ? ` (${a.ownerName})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                    </div>
                  )}
                  {myAssignments.some(a => a.isPrivate) && (
                    <p className="text-blue-400 text-xs mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {lang === "ar" ? "🔒 = واجب خاص (مرئي لك فقط)" : "🔒 = Your private assignment"}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={creating || isCreatingSession}
                className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:scale-100"
                style={{
                  background: playMode === "team"
                    ? "linear-gradient(135deg, #9333ea, #7c3aed)"
                    : playMode === "class"
                    ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                    : classSessionMode
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : "linear-gradient(135deg, #f59e0b, #d97706)",
                  boxShadow: playMode === "team"
                    ? "0 8px 30px rgba(147,51,234,0.4)"
                    : playMode === "class"
                    ? "0 8px 30px rgba(59,130,246,0.4)"
                    : classSessionMode
                    ? "0 8px 30px rgba(34,197,94,0.4)"
                    : "0 8px 30px rgba(245,158,11,0.4)",
                }}
              >
                {(creating || isCreatingSession) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : classSessionMode ? (
                  <QrCode className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {(creating || isCreatingSession)
                  ? (lang === "ar" ? "جارٍ الإنشاء..." : "Creating...")
                  : playMode === "team"
                  ? (lang === "ar" ? "ابدأ — إنشاء غرفة الفريقين" : "Start — Create Team Room")
                  : playMode === "class"
                  ? (lang === "ar" ? "ابدأ لعبة الصف" : "Start Class Game")
                  : classSessionMode
                  ? (lang === "ar" ? "إنشاء غرفة المنافسة الصفية" : "Create Class Competition Room")
                  : (lang === "ar" ? "ابدأ اللعبة" : "Start Game")}
              </button>

              {playMode === "solo" && (
                <>
                  <button
                    onClick={() => setShowArenaLobby(true)}
                    className="w-full py-3.5 mt-2 rounded-2xl text-white font-black text-base shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 6px 25px rgba(99,102,241,0.4)" }}
                  >
                    <Swords className="w-5 h-5" />
                    {lang === "ar" ? "تحدِّ صديقاً (Arena) ⚔️" : "Challenge a Friend (Arena) ⚔️"}
                  </button>
                  <AnimatePresence>
                    {showArenaLobby && (
                      <MultiplayerLobby
                        gameId="million"
                        gameTitle={lang === "ar" ? "من سيربح المليون؟" : "Who Wants to be a Millionaire?"}
                        playUrl={`/game/million/play?name=${encodeURIComponent(playerName)}&bankLevel=${bankLevel}`}
                        playerName={playerName}
                        onClose={() => setShowArenaLobby(false)}
                      />
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-4"
            >
              <div
                className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  {lang === "ar" ? "سلّم الجوائز" : "Prize Ladder"}
                </h2>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {[...PRIZE_LADDER].reverse().map((prize, ri) => {
                    const realIndex = PRIZE_LADDER.length - 1 - ri;
                    const isMillion = prize === 1_000_000;
                    const isSafe = SAFE_HAVENS.has(realIndex);
                    return (
                      <div
                        key={prize}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold ${
                          isMillion
                            ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                            : isSafe ? "bg-green-500/15 text-green-400" : "text-blue-300"
                        }`}
                      >
                        <span className="text-blue-400 opacity-60">{realIndex + 1}</span>
                        <span>{formatPrize(prize)}</span>
                        {isSafe && <span className="text-green-400 text-[10px]">{lang === "ar" ? "✓ آمن" : "✓ Safe"}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {lang === "ar" ? "أفضل اللاعبين" : "Top Players"}
                </h2>
                {leaderboard.length === 0 ? (
                  <p className="text-blue-400 text-xs">
                    {lang === "ar" ? "لا يوجد سجلات بعد — كن الأول!" : "No records yet — be the first!"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {leaderboard.slice(0, 5).map((entry, i) => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs">
                        {rankIcon(i)}
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-white font-semibold truncate">{entry.playerName}</span>
                          {(entry.category || entry.assignmentTitle) && (
                            <span className="text-blue-400/70 text-[10px] truncate">{entry.category || entry.assignmentTitle}</span>
                          )}
                        </div>
                        <span className="text-amber-400 font-bold whitespace-nowrap">{formatPrize(entry.score)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
