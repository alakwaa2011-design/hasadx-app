import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Trophy, Play, ArrowRight, ArrowLeft, BookOpen, Shuffle, ChevronDown, Users, Pencil, Hash } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";

const API_BASE = import.meta.env.VITE_API_URL || "";

type TeamId = "A" | "B";

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
  const [, setLocation] = useLocation();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);

  const [questionSource, setQuestionSource] = useState<"random" | "assignment">("random");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [creating, setCreating] = useState(false);
  const [teamNameA, setTeamNameA] = useState(lang === "ar" ? "الفريق أ" : "Team A");
  const [teamNameB, setTeamNameB] = useState(lang === "ar" ? "الفريق ب" : "Team B");

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
    if (questionSource !== "assignment" || !isTeacher) return;
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

      setAssignments(teacherList);
    };

    doFetch().finally(() => setLoadingAssignments(false));
  }, [questionSource, isTeacher]);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);

    try {
      const params = new URLSearchParams();
      if (questionSource === "assignment" && selectedAssignmentId) {
        params.set("assignmentId", String(selectedAssignmentId));
      }

      const res = await fetch(`${API_BASE}/api/million/questions?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        toast.error(err.message || (lang === "ar" ? "فشل تحميل الأسئلة" : "Failed to load questions"));
        setCreating(false);
        return;
      }
      const data = await res.json() as { questions: GameQuestion[] };
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
      }, (res: { pin?: string; hostToken?: string; error?: string }) => {
        if (res.error || !res.pin || !res.hostToken) {
          toast.error(res.error || (lang === "ar" ? "فشل إنشاء الغرفة" : "Failed to create room"));
          setCreating(false);
          return;
        }
        try { sessionStorage.setItem(`millionTeamHostToken:${res.pin}`, res.hostToken); } catch { /* ignore */ }
        setLocation(`/game/million/team-host/${res.pin}?token=${encodeURIComponent(res.hostToken)}`);
      });
    } catch {
      toast.error(lang === "ar" ? "حدث خطأ" : "An error occurred");
      setCreating(false);
    }
  }, [creating, questionSource, selectedAssignmentId, lang, setLocation, teamNameA, teamNameB]);

  const handleJoinByPin = useCallback(() => {
    const name = nameInput.trim();
    const pin = pinInput.trim();
    if (!name) { setJoinError(lang === "ar" ? "أدخل اسمك" : "Enter your name"); return; }
    if (!pin || pin.length < 4) { setJoinError(lang === "ar" ? "أدخل رمز الغرفة" : "Enter the room PIN"); return; }
    if (!selectedTeam) { setJoinError(lang === "ar" ? "اختر فريقاً" : "Choose a team"); return; }
    setJoinError("");
    setJoining(true);
    try { localStorage.setItem(STORAGE_KEY_NAME, name); } catch { /* ignore */ }
    try { localStorage.setItem(STORAGE_KEY_TEAM, selectedTeam); } catch { /* ignore */ }
    setLocation(`/game/million/team-play/${pin}`);
  }, [nameInput, pinInput, selectedTeam, lang, setLocation]);

  if (isTeacher === null) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}>
          <div className="text-blue-300 text-sm">{lang === "ar" ? "جارٍ التحقق..." : "Checking..."}</div>
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
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setLocation("/game/million")}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
            >
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "لعبة المليون" : "Million Game"}
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              <Users className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              {lang === "ar" ? "فريق ضد فريق" : "Team vs Team"}
            </h1>
            <p className="text-blue-300 text-sm">
              {lang === "ar"
                ? "المعلم ينشئ الغرفة — الطلاب يدخلون الـ PIN للانضمام"
                : "Teacher creates room — students enter PIN to join"}
            </p>
          </motion.div>

          <div className={`grid gap-6 ${isTeacher ? "md:grid-cols-2" : "grid-cols-1 max-w-md mx-auto"}`}>
            {isTeacher && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl p-5 space-y-4"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <h2 className="text-white font-black text-lg flex items-center gap-2">
                  <span className="text-amber-400">🎓</span>
                  {lang === "ar" ? "إنشاء غرفة" : "Create Room"}
                </h2>

                <div>
                  <label className="text-blue-300 text-xs font-medium block mb-2 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    {lang === "ar" ? "أسماء الفريقين" : "Team Names"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-blue-300 text-[10px] font-bold">{lang === "ar" ? "الفريق أ" : "Team A"}</span>
                      </div>
                      <input
                        type="text"
                        value={teamNameA}
                        onChange={e => setTeamNameA(e.target.value)}
                        maxLength={20}
                        placeholder={lang === "ar" ? "الفريق أ" : "Team A"}
                        className="w-full px-2 py-1.5 rounded-xl text-white text-sm font-bold placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-red-300 text-[10px] font-bold">{lang === "ar" ? "الفريق ب" : "Team B"}</span>
                      </div>
                      <input
                        type="text"
                        value={teamNameB}
                        onChange={e => setTeamNameB(e.target.value)}
                        maxLength={20}
                        placeholder={lang === "ar" ? "الفريق ب" : "Team B"}
                        className="w-full px-2 py-1.5 rounded-xl text-white text-sm font-bold placeholder-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-blue-300 text-xs font-medium block mb-1.5">
                    {lang === "ar" ? "مصدر الأسئلة" : "Question Source"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setQuestionSource("random")}
                      className={`flex items-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                        questionSource === "random"
                          ? "bg-amber-500/20 border-amber-500 text-amber-400 border-2"
                          : "text-blue-300 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {lang === "ar" ? "عشوائي" : "Random"}
                    </button>
                    <button
                      onClick={() => setQuestionSource("assignment")}
                      className={`flex items-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                        questionSource === "assignment"
                          ? "bg-amber-500/20 border-amber-500 text-amber-400 border-2"
                          : "text-blue-300 border border-white/10 hover:border-white/25"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      {lang === "ar" ? "واجب" : "Assignment"}
                    </button>
                  </div>
                </div>

                {questionSource === "assignment" && (
                  <div>
                    {loadingAssignments ? (
                      <div className="text-blue-400 text-xs py-1">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
                    ) : assignments.length === 0 ? (
                      <p className="text-blue-400 text-xs py-1">
                        {lang === "ar" ? "لا توجد واجبات تحتوي على 5 أسئلة أو أكثر" : "No assignments with 5+ questions"}
                      </p>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedAssignmentId ?? ""}
                          onChange={e => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-3 py-2 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                        >
                          <option value="" style={{ background: "#0d1f3c" }}>
                            {lang === "ar" ? "-- اختر واجباً --" : "-- Choose Assignment --"}
                          </option>
                          <optgroup label={lang === "ar" ? "── واجباتي ──" : "── My Assignments ──"}>
                            {assignments.filter(a => a.isOwn !== false).map(a => (
                              <option key={a.id} value={a.id} style={{ background: "#0d1f3c" }}>
                                {a.title} ({a.questionCount} {lang === "ar" ? "سؤال" : "q"}){a.isPrivate ? " 🔒" : ""}
                              </option>
                            ))}
                          </optgroup>
                          {assignments.some(a => a.isOwn === false) && (
                            <optgroup label={lang === "ar" ? "── واجبات مشتركة ──" : "── Shared Assignments ──"}>
                              {assignments.filter(a => a.isOwn === false).map(a => (
                                <option key={a.id} value={a.id} style={{ background: "#0d1f3c" }}>
                                  {a.title} ({a.questionCount} {lang === "ar" ? "سؤال" : "q"}){a.ownerName ? ` (${a.ownerName})` : ""}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-3 rounded-2xl text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    boxShadow: "0 8px 30px rgba(59,130,246,0.4)",
                  }}
                >
                  <Play className="w-4 h-4" />
                  {creating
                    ? (lang === "ar" ? "جارٍ الإنشاء..." : "Creating...")
                    : (lang === "ar" ? "ابدأ — إنشاء الغرفة" : "Start — Create Room")}
                </button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h2 className="text-white font-black text-lg flex items-center gap-2">
                <span>🎮</span>
                {lang === "ar" ? "انضم إلى غرفة" : "Join a Room"}
              </h2>

              <div>
                <label className="text-blue-300 text-xs font-medium block mb-1">
                  {lang === "ar" ? "اسمك" : "Your Name"}
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setJoinError(""); }}
                  maxLength={40}
                  placeholder={lang === "ar" ? "مثال: أحمد" : "e.g. Ahmad"}
                  className="w-full px-3 py-2.5 rounded-xl text-white text-sm placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                />
              </div>

              <div>
                <label className="text-blue-300 text-xs font-medium block mb-1 flex items-center gap-1.5">
                  <Hash className="w-3 h-3" />
                  {lang === "ar" ? "رمز الغرفة (PIN)" : "Room PIN"}
                </label>
                <input
                  type="text"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setJoinError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleJoinByPin()}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full px-3 py-2.5 rounded-xl text-white text-center text-xl font-black tracking-widest placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-blue-300 text-xs font-medium block mb-2">
                  {lang === "ar" ? "اختر فريقك" : "Choose Your Team"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedTeam("A")}
                    className={`py-3 rounded-xl font-bold text-sm transition-all ${
                      selectedTeam === "A" ? "border-2 border-blue-400" : "border border-white/10 hover:border-blue-400/50"
                    }`}
                    style={{ background: selectedTeam === "A" ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.08)" }}
                  >
                    <div className="text-blue-300 text-xl mb-0.5">🔵</div>
                    <div className="text-white text-xs">{lang === "ar" ? "الفريق أ" : "Team A"}</div>
                  </button>
                  <button
                    onClick={() => setSelectedTeam("B")}
                    className={`py-3 rounded-xl font-bold text-sm transition-all ${
                      selectedTeam === "B" ? "border-2 border-red-400" : "border border-white/10 hover:border-red-400/50"
                    }`}
                    style={{ background: selectedTeam === "B" ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.08)" }}
                  >
                    <div className="text-red-300 text-xl mb-0.5">🔴</div>
                    <div className="text-white text-xs">{lang === "ar" ? "الفريق ب" : "Team B"}</div>
                  </button>
                </div>
              </div>

              {joinError && <p className="text-red-400 text-xs text-center">{joinError}</p>}

              <button
                onClick={handleJoinByPin}
                disabled={joining}
                className="w-full py-3 rounded-2xl text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 30px rgba(16,185,129,0.3)" }}
              >
                <Users className="w-4 h-4" />
                {joining ? (lang === "ar" ? "جارٍ الانضمام..." : "Joining...") : (lang === "ar" ? "انضم!" : "Join!")}
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 rounded-xl p-4 text-sm text-blue-300 space-y-1.5"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
          >
            <p className="font-bold text-blue-200 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              {lang === "ar" ? "كيف تعمل اللعبة؟" : "How it works"}
            </p>
            <ul className="space-y-0.5 text-xs list-disc list-inside">
              {lang === "ar" ? (
                <>
                  <li>المعلم ينشئ الغرفة ويحصل على PIN للمشاركة</li>
                  <li>الطلاب يدخلون الـ PIN ويختارون الفريق للانضمام</li>
                  <li>كل فريق يصوّت على الإجابة — الأغلبية هي إجابة الفريق</li>
                  <li>30 ثانية لكل سؤال — المعلم يتحكم في التوقيت</li>
                  <li>الفريق الأعلى نقاطاً في نهاية الأسئلة يفوز!</li>
                </>
              ) : (
                <>
                  <li>Teacher creates room and gets a shareable PIN</li>
                  <li>Students enter PIN and choose a team to join</li>
                  <li>Each team votes — majority answer counts for the team</li>
                  <li>30 seconds per question — teacher controls the timer</li>
                  <li>Team with highest points wins!</li>
                </>
              )}
            </ul>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
