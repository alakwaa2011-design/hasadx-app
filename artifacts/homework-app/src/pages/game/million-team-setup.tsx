import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Play, ArrowRight, ArrowLeft, BookOpen, Shuffle,
  Users, Pencil, Hash, Swords, LogIn, CheckCircle2,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";

const API_BASE = import.meta.env.VITE_API_URL || "";

type TeamId = "A" | "B";
type Tab = "create" | "join";

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

const STORAGE_KEY_NAME = "millionPlayerName";
const STORAGE_KEY_TEAM = "millionPlayerTeam";

export default function MillionTeamSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [tab, setTab] = useState<Tab>("create");
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);

  // Teacher create
  const [questionSource, setQuestionSource] = useState<"random" | "assignment">("random");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<PublicAssignment | null>(null);
  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [creating, setCreating] = useState(false);
  const [teamNameA, setTeamNameA] = useState(ar ? "الفريق أ" : "Team A");
  const [teamNameB, setTeamNameB] = useState(ar ? "الفريق ب" : "Team B");

  // Student join
  const [pinInput, setPinInput] = useState("");
  const [nameInput, setNameInput] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_NAME) || ""; } catch { return ""; }
  });
  const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(() => {
    try { return (localStorage.getItem(STORAGE_KEY_TEAM) as TeamId | null); } catch { return null; }
  });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => setIsTeacher(r.ok))
      .catch(() => setIsTeacher(false));
  }, []);

  useEffect(() => {
    if (!isTeacher) return;
    if (questionSource !== "assignment") return;
    setLoadingAssignments(true);
    fetch(`${API_BASE}/api/assignments?include=shared`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: PublicAssignment[]) => {
        const list = Array.isArray(data)
          ? data
              .filter(a => a.questionCount >= 5)
              .map(a => ({ ...a, isPrivate: a.isOwn !== false && a.isShared === false }))
          : [];
        setAssignments(list);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));
  }, [questionSource, isTeacher]);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const params = new URLSearchParams();
      if (questionSource === "assignment" && selectedAssignmentId) {
        params.set("assignmentId", String(selectedAssignmentId));
      }
      const res = await fetch(`${API_BASE}/api/million/questions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        toast.error(err.message || (ar ? "فشل تحميل الأسئلة" : "Failed to load questions"));
        setCreating(false);
        return;
      }
      const data = await res.json() as { questions: GameQuestion[] };
      if (!data.questions || data.questions.length < 5) {
        toast.error(ar ? "لا يوجد أسئلة كافية (الحد الأدنى 5)" : "Not enough questions (min 5)");
        setCreating(false);
        return;
      }
      const socket = getSocket();
      socket.emit("million-team:create", {
        questions: data.questions,
        teamNames: {
          A: teamNameA.trim() || (ar ? "الفريق أ" : "Team A"),
          B: teamNameB.trim() || (ar ? "الفريق ب" : "Team B"),
        },
      }, (res: { pin?: string; hostToken?: string; error?: string }) => {
        if (res.error || !res.pin || !res.hostToken) {
          toast.error(res.error || (ar ? "فشل إنشاء الغرفة" : "Failed to create room"));
          setCreating(false);
          return;
        }
        try { sessionStorage.setItem(`millionTeamHostToken:${res.pin}`, res.hostToken); } catch { /* ignore */ }
        setLocation(`/game/million/team-host/${res.pin}?token=${encodeURIComponent(res.hostToken)}`);
      });
    } catch {
      toast.error(ar ? "حدث خطأ" : "An error occurred");
      setCreating(false);
    }
  }, [creating, questionSource, selectedAssignmentId, ar, setLocation, teamNameA, teamNameB]);

  const handleJoin = useCallback(() => {
    const name = nameInput.trim();
    const pin = pinInput.trim();
    if (!name) { setJoinError(ar ? "أدخل اسمك" : "Enter your name"); return; }
    if (!pin || pin.length < 4) { setJoinError(ar ? "أدخل رمز الغرفة" : "Enter room PIN"); return; }
    if (!selectedTeam) { setJoinError(ar ? "اختر فريقاً" : "Choose a team"); return; }
    setJoinError("");
    setJoining(true);
    try { localStorage.setItem(STORAGE_KEY_NAME, name); } catch { /* ignore */ }
    try { localStorage.setItem(STORAGE_KEY_TEAM, selectedTeam); } catch { /* ignore */ }
    setLocation(`/game/million/team-play/${pin}`);
  }, [nameInput, pinInput, selectedTeam, ar, setLocation]);

  if (isTeacher === null) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)" }}>
          <div className="text-blue-300 text-sm">{ar ? "جارٍ التحقق..." : "Checking..."}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-8 px-4"
        dir={dir}
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}
      >
        <div className="max-w-xl mx-auto">

          {/* Back */}
          <div className="mb-6">
            <button
              onClick={() => setLocation("/game/million")}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
            >
              <BackIcon className="w-4 h-4" />
              {ar ? "لعبة المليون" : "Million Game"}
            </button>
          </div>

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              <Swords className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">
              {ar ? "فريق ضد فريق" : "Team vs Team"}
            </h1>
            <p className="text-blue-300 text-sm">
              {ar ? "المعلم يُنشئ الغرفة — الطلاب يدخلون بالـ PIN" : "Teacher creates room — students join with PIN"}
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex rounded-2xl overflow-hidden mb-6 border border-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setTab("create")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black transition-all ${
                tab === "create"
                  ? "text-white"
                  : "text-blue-300/60 hover:text-blue-200"
              }`}
              style={tab === "create" ? { background: "linear-gradient(135deg, #1d4ed8, #2563eb)" } : {}}
            >
              <Users className="w-4 h-4" />
              {ar ? "🎓 إنشاء غرفة" : "🎓 Create Room"}
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black transition-all ${
                tab === "join"
                  ? "text-white"
                  : "text-blue-300/60 hover:text-blue-200"
              }`}
              style={tab === "join" ? { background: "linear-gradient(135deg, #059669, #10b981)" } : {}}
            >
              <LogIn className="w-4 h-4" />
              {ar ? "🎮 انضم إلى غرفة" : "🎮 Join Room"}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* ── CREATE TAB ── */}
            {tab === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {!isTeacher ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="text-4xl mb-3">🔒</div>
                    <p className="text-blue-300 text-sm">{ar ? "إنشاء الغرفة متاح للمعلمين فقط" : "Room creation is for teachers only"}</p>
                  </div>
                ) : (
                  <>
                    {/* Team Names */}
                    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Pencil className="w-4 h-4 text-amber-400" />
                        <h3 className="text-white font-black text-sm">{ar ? "أسماء الفريقين" : "Team Names"}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-3 h-3 rounded-full bg-blue-400" />
                            <span className="text-blue-300 text-xs font-bold">{ar ? "الفريق الأول" : "Team A"}</span>
                          </div>
                          <input
                            type="text"
                            value={teamNameA}
                            onChange={e => setTeamNameA(e.target.value)}
                            maxLength={20}
                            placeholder={ar ? "الفريق أ" : "Team A"}
                            className="w-full px-3 py-2 rounded-xl text-white text-sm font-bold placeholder-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            style={{ background: "rgba(59,130,246,0.12)", border: "1.5px solid rgba(59,130,246,0.4)" }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <span className="text-red-300 text-xs font-bold">{ar ? "الفريق الثاني" : "Team B"}</span>
                          </div>
                          <input
                            type="text"
                            value={teamNameB}
                            onChange={e => setTeamNameB(e.target.value)}
                            maxLength={20}
                            placeholder={ar ? "الفريق ب" : "Team B"}
                            className="w-full px-3 py-2 rounded-xl text-white text-sm font-bold placeholder-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                            style={{ background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.4)" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Question Source */}
                    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <h3 className="text-white font-black text-sm">{ar ? "مصدر الأسئلة" : "Question Source"}</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                          onClick={() => { setQuestionSource("random"); setSelectedAssignmentId(null); setSelectedAssignment(null); }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                            questionSource === "random"
                              ? "text-amber-300 border-2 border-amber-400"
                              : "text-blue-300 border border-white/15 hover:border-white/30"
                          }`}
                          style={questionSource === "random" ? { background: "rgba(251,191,36,0.15)" } : {}}
                        >
                          <Shuffle className="w-4 h-4" />
                          {ar ? "عشوائي" : "Random"}
                          {questionSource === "random" && <CheckCircle2 className="w-3.5 h-3.5 ms-auto" />}
                        </button>
                        <button
                          onClick={() => setQuestionSource("assignment")}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                            questionSource === "assignment"
                              ? "text-amber-300 border-2 border-amber-400"
                              : "text-blue-300 border border-white/15 hover:border-white/30"
                          }`}
                          style={questionSource === "assignment" ? { background: "rgba(251,191,36,0.15)" } : {}}
                        >
                          <BookOpen className="w-4 h-4" />
                          {ar ? "من واجب" : "Assignment"}
                          {questionSource === "assignment" && <CheckCircle2 className="w-3.5 h-3.5 ms-auto" />}
                        </button>
                      </div>

                      {questionSource === "assignment" && (
                        <AnimatePresence>
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            {loadingAssignments ? (
                              <div className="text-blue-400 text-xs py-2 text-center">{ar ? "جارٍ تحميل الواجبات..." : "Loading..."}</div>
                            ) : assignments.length === 0 ? (
                              <p className="text-blue-400 text-xs py-2 text-center">
                                {ar ? "لا توجد واجبات (5 أسئلة أو أكثر)" : "No assignments with 5+ questions"}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {assignments.map(a => (
                                  <button
                                    key={a.id}
                                    onClick={() => { setSelectedAssignmentId(a.id); setSelectedAssignment(a); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all text-start ${
                                      selectedAssignmentId === a.id
                                        ? "border-2 border-amber-400 text-amber-200"
                                        : "border border-white/15 text-blue-300 hover:border-white/30"
                                    }`}
                                    style={selectedAssignmentId === a.id ? { background: "rgba(251,191,36,0.12)" } : { background: "rgba(255,255,255,0.04)" }}
                                  >
                                    <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                                      <span className="font-bold truncate w-full">{a.title}</span>
                                      <span className="text-xs opacity-60">{a.questionCount} {ar ? "سؤال" : "questions"}{a.isPrivate ? " 🔒" : ""}</span>
                                    </div>
                                    {selectedAssignmentId === a.id && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 ms-2" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      )}

                      {selectedAssignment && questionSource === "assignment" && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-300" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                          <CheckCircle2 className="w-4 h-4" />
                          {selectedAssignment.title} — {selectedAssignment.questionCount} {ar ? "سؤال" : "questions"}
                        </div>
                      )}
                    </div>

                    {/* Scoring Info */}
                    <div className="rounded-2xl p-4" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                      <p className="text-amber-300 font-black text-xs mb-2 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" />
                        {ar ? "نظام النقاط المتصاعد" : "Tiered Scoring System"}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[
                          { label: ar ? "الجولة الأولى" : "Early", pts: "100", color: "#60a5fa" },
                          { label: ar ? "الجولة الوسطى" : "Mid", pts: "200", color: "#f59e0b" },
                          { label: ar ? "الجولة الأخيرة" : "Final", pts: "300", color: "#f87171" },
                        ].map(t => (
                          <div key={t.label} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="font-black mb-0.5" style={{ color: t.color }}>{t.pts} pts</div>
                            <div className="text-white/50">{t.label}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-amber-300/70 text-[10px] mt-2 text-center">
                        {ar ? "⚡ كل سؤال 5 = نقاط مضاعفة ×2" : "⚡ Every 5th question = double points ×2"}
                      </p>
                    </div>

                    {/* Create Button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ scale: 1.01 }}
                      onClick={handleCreate}
                      disabled={creating || (questionSource === "assignment" && !selectedAssignmentId)}
                      className="w-full py-4 rounded-2xl text-white font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 8px 30px rgba(59,130,246,0.4)" }}
                    >
                      <Play className="w-5 h-5" />
                      {creating
                        ? (ar ? "جارٍ الإنشاء..." : "Creating...")
                        : (ar ? "إنشاء الغرفة وابدأ" : "Create Room & Start")}
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}

            {/* ── JOIN TAB ── */}
            {tab === "join" && (
              <motion.div
                key="join"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>

                  {/* Name */}
                  <div>
                    <label className="text-blue-300 text-xs font-bold block mb-1.5">{ar ? "اسمك" : "Your Name"}</label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => { setNameInput(e.target.value); setJoinError(""); }}
                      maxLength={40}
                      placeholder={ar ? "أدخل اسمك..." : "Enter your name..."}
                      className="w-full px-3 py-3 rounded-xl text-white text-sm font-bold placeholder-blue-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)" }}
                    />
                  </div>

                  {/* PIN */}
                  <div>
                    <label className="text-blue-300 text-xs font-bold block mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3 h-3" />
                      {ar ? "رمز الغرفة (PIN)" : "Room PIN"}
                    </label>
                    <input
                      type="text"
                      value={pinInput}
                      onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setJoinError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleJoin()}
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="123456"
                      className="w-full px-3 py-3 rounded-xl text-white text-center text-2xl font-black tracking-widest placeholder-blue-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)" }}
                      dir="ltr"
                    />
                  </div>

                  {/* Team Choice */}
                  <div>
                    <label className="text-blue-300 text-xs font-bold block mb-2">{ar ? "اختر فريقك" : "Choose Your Team"}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedTeam("A")}
                        className={`py-4 rounded-xl font-black text-sm transition-all ${
                          selectedTeam === "A" ? "border-2 border-blue-400" : "border border-white/15 hover:border-blue-400/50"
                        }`}
                        style={selectedTeam === "A"
                          ? { background: "rgba(59,130,246,0.25)" }
                          : { background: "rgba(59,130,246,0.08)" }}
                      >
                        <div className="text-2xl mb-1">🔵</div>
                        <div className="text-white text-xs">{ar ? "الفريق أ" : "Team A"}</div>
                        {selectedTeam === "A" && <div className="text-blue-300 text-[10px] mt-1">✓ {ar ? "محدد" : "Selected"}</div>}
                      </button>
                      <button
                        onClick={() => setSelectedTeam("B")}
                        className={`py-4 rounded-xl font-black text-sm transition-all ${
                          selectedTeam === "B" ? "border-2 border-red-400" : "border border-white/15 hover:border-red-400/50"
                        }`}
                        style={selectedTeam === "B"
                          ? { background: "rgba(239,68,68,0.25)" }
                          : { background: "rgba(239,68,68,0.08)" }}
                      >
                        <div className="text-2xl mb-1">🔴</div>
                        <div className="text-white text-xs">{ar ? "الفريق ب" : "Team B"}</div>
                        {selectedTeam === "B" && <div className="text-red-300 text-[10px] mt-1">✓ {ar ? "محدد" : "Selected"}</div>}
                      </button>
                    </div>
                  </div>

                  {joinError && (
                    <p className="text-red-400 text-xs text-center font-bold">{joinError}</p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-4 rounded-2xl text-white font-black text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 8px 30px rgba(16,185,129,0.3)" }}
                  >
                    <Users className="w-5 h-5" />
                    {joining ? (ar ? "جارٍ الانضمام..." : "Joining...") : (ar ? "انضم الآن!" : "Join Now!")}
                  </motion.button>
                </div>

                {/* How it works */}
                <div className="rounded-2xl p-4" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <p className="font-black text-blue-200 flex items-center gap-2 text-xs mb-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {ar ? "كيف تعمل اللعبة؟" : "How it works"}
                  </p>
                  <ul className="space-y-1 text-xs text-blue-300 list-disc list-inside">
                    {ar ? (
                      <>
                        <li>المعلم ينشئ الغرفة ويحصل على PIN للمشاركة</li>
                        <li>الطلاب يدخلون الـ PIN ويختارون الفريق</li>
                        <li>كل فريق يصوّت — الأغلبية هي إجابة الفريق</li>
                        <li>النقاط تتصاعد في كل مرحلة (100 → 200 → 300)</li>
                        <li>كل سؤال 5 = نقاط مضاعفة ×2!</li>
                      </>
                    ) : (
                      <>
                        <li>Teacher creates room and shares the PIN</li>
                        <li>Students enter PIN and choose a team</li>
                        <li>Each team votes — majority answer counts</li>
                        <li>Points escalate each phase (100 → 200 → 300)</li>
                        <li>Every 5th question = double points ×2!</li>
                      </>
                    )}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
