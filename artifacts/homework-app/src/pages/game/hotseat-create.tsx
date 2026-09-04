import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Flame, ChevronRight, Volume2, VolumeX, BookOpen, FileText, X, Search, ChevronDown, Hash, Smartphone, Building, Lightbulb, Timer, Share2, Play, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";
import QRCode from "react-qr-code";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { HotSeatIcon } from "@/components/game-icons";

const FIRE = "#FF6B2B";
const FIRE2 = "#FF9F43";
const DARK_BG = "linear-gradient(180deg, #050818 0%, #0d1230 60%, #1a0a00 100%)";
const API_BASE = import.meta.env.VITE_API_URL || "";

interface Student { uid: string; name: string; avatar: string; color: string; score: number; isOnSeat: boolean; roundsOnSeat: number; }

interface HotSeatQuestion {
  id: string;
  text: string;
  type: "mcq" | "truefalse" | "open";
  options?: string[];
  correct?: string;
  imageUrl?: string | null;
}

interface Assignment {
  id: number;
  title: string;
  questionCount: number;
  subject?: string;
}

interface BankQuestion {
  id: number;
  text: string;
  subject: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
}

type QuestionMode = "students" | "assignment" | "mixed";

// Mute state persisted in localStorage
function useMuteState() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("hotseat-muted") === "1"; } catch { return false; }
  });
  const toggle = () => setMuted(prev => {
    const next = !prev;
    try { localStorage.setItem("hotseat-muted", next ? "1" : "0"); } catch {}
    return next;
  });
  return { muted, toggle };
}

export default function HotSeatCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const { muted, toggle: toggleMute } = useMuteState();

  // Form state
  const [teacherName, setTeacherName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [timerDuration, setTimerDuration] = useState(30);
  const [creating, setCreating] = useState(false);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("mixed");

  // Questions to use as seed for discussion (optional)
  const [questions, setQuestions] = useState<HotSeatQuestion[]>([]);

  // Assignment picker
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignImporting, setAssignImporting] = useState<number | null>(null);

  // Bank picker
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  // Game created state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [creatorToken, setCreatorToken] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!gamePin) return;
    const socket = getHotSeatSocket();
    socket.on("hotseat:players-updated", (data: { students: Student[] }) => {
      setStudents(data.students);
    });
    return () => { socket.off("hotseat:players-updated"); };
  }, [gamePin]);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!meRes.ok) { toast.error(ar ? "يجب تسجيل الدخول" : "Please log in"); setAssignOpen(false); return; }
      const me = await meRes.json();
      const teacherId = me.teacherId || me.id;
      const res = await fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}&include=shared`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.filter((a: { questionCount: number }) => a.questionCount > 0));
      }
    } catch { /* ignore */ } finally { setAssignLoading(false); }
  }, [ar]);

  useEffect(() => { if (assignOpen) loadAssignments(); }, [assignOpen, loadAssignments]);

  const importFromAssignment = async (assignId: number, assignTitle: string) => {
    setAssignImporting(assignId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر التحميل" : "Failed to load"); return; }
      const data = await res.json();
      const effectiveTitle = assignTitle || data.title || "";
      const qs: HotSeatQuestion[] = (data.questions || []).map((q: { id: number; text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string; questionType?: string; imageUrl?: string | null }) => ({
        id: String(q.id),
        text: q.text,
        type: q.questionType === "true_false" ? "truefalse" : q.optionA ? "mcq" : "open",
        options: q.optionA ? [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[] : undefined,
        correct: q.correctAnswer,
        imageUrl: q.imageUrl || null,
      }));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة" : "No questions found"); return; }
      setQuestions(qs.slice(0, 40));
      if (!subject && data.subject) setSubject(data.subject);
      if (!topic && effectiveTitle) setTopic(effectiveTitle);
      setAssignOpen(false);
      toast.success(ar ? `تم جلب ${qs.length} سؤال${effectiveTitle ? ` من "${effectiveTitle}"` : ""}` : `Loaded ${qs.length} questions`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

  const autoImportedAssignmentRef = useRef(false);
  useEffect(() => {
    const assignmentId = Number(new URLSearchParams(window.location.search).get("assignmentId"));
    if (!Number.isInteger(assignmentId) || assignmentId <= 0 || autoImportedAssignmentRef.current) return;
    autoImportedAssignmentRef.current = true;
    setQuestionMode("mixed");
    void importFromAssignment(assignmentId, "");
  }, []);

  // Load bank
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) { toast.error(ar ? "يجب تسجيل الدخول" : "Please log in"); setBankOpen(false); return; }
      if (res.ok) { const data = await res.json(); setBankQuestions(data); }
    } catch { /* ignore */ } finally { setBankLoading(false); }
  }, [ar]);

  useEffect(() => { if (bankOpen) { loadBank(); setBankSelected(new Set()); setBankSearch(""); } }, [bankOpen, loadBank]);

  const importFromBank = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    if (selected.length === 0) return;
    const qs: HotSeatQuestion[] = selected.map(q => ({
      id: String(q.id),
      text: q.text,
      type: (q.optionA ? "mcq" : "open") as "mcq" | "open",
      options: q.optionA ? [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[] : undefined,
      correct: q.correctAnswer,
      imageUrl: (q as { imageUrl?: string | null }).imageUrl || null,
    }));
    setQuestions(prev => [...prev, ...qs].slice(0, 40));
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${qs.length} سؤال` : `Imported ${qs.length} questions`);
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.toLowerCase().includes(bankSearch.toLowerCase()))
    : bankQuestions;

  const handleCreate = () => {
    if (!grade.trim() && !subject.trim()) { toast.error(ar ? "أدخل الصف أو المادة" : "Enter grade or subject"); return; }
    if (questionMode === "assignment" && questions.length === 0) {
      toast.error(ar ? "اختر واجبًا أو أسئلة من البنك أولًا" : "Choose an assignment or question-bank items first");
      return;
    }
    setCreating(true);
    const socket = getHotSeatSocket();
    socket.emit("hotseat:create", {
      teacherName: "المعلم",
      grade: grade.trim() || "",
      subject: subject.trim() || "",
      topic: topic.trim() || undefined,
      timerDuration,
      questionMode,
      seedQuestions: questionMode !== "students" && questions.length > 0 ? questions : undefined,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        setGamePin(res.pin);
        setCreatorToken(res.creatorToken);
        sessionStorage.setItem(`hotseat-creator-${res.pin}`, res.creatorToken);
        // Store mute state
        localStorage.setItem("hotseat-muted", muted ? "1" : "0");
      }
    });
  };

  const joinUrl = gamePin ? `${window.location.origin}/game/hotseat/join/${gamePin}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(ar ? "تم نسخ الرابط!" : "Link copied!");
    } catch { toast.error(ar ? "فشل النسخ" : "Copy failed"); }
  };

  const startGame = () => {
    if (!gamePin || !creatorToken) return;
    setLocation(`/game/hotseat/host/${gamePin}`);
  };

  // ── LOBBY (after create) ──────────────────────────────────────────────────
  if (gamePin) {
    const pinDigits = gamePin.split("");
    const sessionInfo = [grade, subject, topic].filter(Boolean).join(" · ");

    const shareWhatsApp = () => {
      const text = ar
        ? `[الكرسي الساخن]${sessionInfo ? `\n${sessionInfo}` : ""}\n\nرمز الدخول:\n${gamePin}\n\nأو افتح الرابط:\n${joinUrl}`
        : `[HotSeat Game]${sessionInfo ? `\n${sessionInfo}` : ""}\n\nRoom Code:\n${gamePin}\n\nOr open:\n${joinUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
      <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden", fontFamily: "var(--font-display)" }}>
        {/* Embers */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
          {[...Array(20)].map((_, i) => (
            <motion.div key={i}
              animate={{ y: [-20, -140], opacity: [0, 0.7, 0], scale: [0.5, 1.2, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 + Math.random() * 3, delay: Math.random() * 4, ease: "easeIn" }}
              style={{
                position: "absolute", bottom: "-5%", left: `${5 + Math.random() * 90}%`,
                width: 4 + Math.random() * 6, height: 4 + Math.random() * 6,
                borderRadius: "50%",
                background: Math.random() > 0.5 ? FIRE : FIRE2,
                boxShadow: `0 0 10px ${FIRE}, 0 0 20px ${FIRE2}`
              }}
            />
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "20px 16px", maxWidth: 580, marginInline: "auto" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md">
                <Flame size={20} color={FIRE2} />
              </div>
              <div>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 800, margin: 0 }}>
                  {ar ? "الكرسي الساخن — جلسة نشطة" : "HotSeat — Active Session"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "2px 0 0" }}>
                  {sessionInfo || (ar ? "جاهز للبدء" : "Ready to start")}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Mute toggle */}
              <button onClick={toggleMute} style={{
                padding: "6px 10px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: muted ? "#ef4444" : "rgba(255,255,255,0.7)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              }}>
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button onClick={() => { setGamePin(null); setCreatorToken(null); setStudents([]); }} style={{
                padding: "6px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                {ar ? "← جلسة جديدة" : "New →"}
              </button>
            </div>
          </div>

          {/* PIN */}
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 28, padding: "32px 20px", marginBottom: 14, backdropFilter: "blur(12px)" }}>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Hash size={16} color="rgba(255,255,255,0.5)" />
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800, textAlign: "center", letterSpacing: "0.15em", margin: 0 }}>
                {ar ? "رمز دخول الطلاب" : "STUDENT ROOM CODE"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, direction: "ltr" }}>
              {pinDigits.map((d, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 400 }}
                  style={{
                    width: 56, height: 72, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid rgba(255,255,255,0.15)`, borderRadius: 16,
                    fontSize: 44, fontWeight: 900, color: "#fff", fontFamily: "monospace",
                    boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.1)`,
                  }}>{d}</motion.div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mb-6 opacity-60">
              <Smartphone size={14} color="#fff" />
              <p style={{ color: "#fff", fontSize: 11, textAlign: "center", margin: 0, direction: "ltr" }}>
                {joinUrl.replace("https://", "")}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <button onClick={copyLink} style={{
                padding: "12px 8px", borderRadius: 16, border: "none",
                background: copied ? "rgba(22,163,74,0.3)" : "rgba(255,255,255,0.06)",
                color: copied ? "#4ade80" : "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "all 0.2s"
              }}>
                {copied ? <Check size={20} /> : <Copy size={20} />}
                <span>{copied ? (ar ? "تم!" : "Copied!") : (ar ? "نسخ" : "Copy")}</span>
              </button>
              <button onClick={shareWhatsApp} style={{
                padding: "12px 8px", borderRadius: 16, border: "none",
                background: "rgba(37,211,102,0.15)", color: "#25D366",
                fontWeight: 800, fontSize: 13, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "all 0.2s"
              }}>
                <Share2 size={20} />
                <span>{ar ? "مشاركة" : "Share"}</span>
              </button>
              <div style={{ padding: "8px", borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QRCode value={joinUrl} size={64} style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          </motion.div>

          {/* Students */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "16px 20px", marginBottom: 14, backdropFilter: "blur(12px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Users size={16} color={FIRE2} />
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 700 }}>
                {ar ? "الطلاب المنضمون" : "Students joined"}
              </span>
              <span style={{ marginInlineStart: "auto", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 900, fontSize: 14, padding: "2px 10px", borderRadius: 999 }}>
                {students.length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 40 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div key={s.uid} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `1px solid ${s.color}60` }}>
                    <span style={{ fontSize: 16 }}>{s.avatar}</span>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center justify-center w-full h-10">
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0, fontWeight: 600 }}>
                    {ar ? "بانتظار انضمام الطلاب..." : "Waiting for students to join..."}
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Questions indicator */}
          {questions.length > 0 && (
            <div style={{ background: "rgba(255,159,67,0.1)", border: `1px solid rgba(255,159,67,0.3)`, borderRadius: 20, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={16} color={FIRE2} />
              <span style={{ color: FIRE2, fontSize: 13, fontWeight: 800 }}>
                {ar ? `${questions.length} سؤال جاهز للجلسة` : `${questions.length} questions loaded`}
              </span>
            </div>
          )}

          {/* Start */}
          <motion.button whileHover={students.length > 0 ? { scale: 1.02 } : undefined}
            whileTap={students.length > 0 ? { scale: 0.97 } : undefined}
            onClick={startGame} disabled={students.length === 0}
            style={{
              width: "100%", padding: "18px", borderRadius: 24, border: "none",
              background: students.length === 0 ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: students.length === 0 ? "rgba(255,255,255,0.3)" : "#fff",
              fontWeight: 900, fontSize: 18, cursor: students.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              boxShadow: students.length > 0 ? `0 12px 36px rgba(255,107,43,0.4)` : undefined,
              transition: "all 0.3s"
            }}>
            <Play size={22} fill="currentColor" />
            {ar ? "بدء الجلسة" : "Start Session"}
          </motion.button>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", marginTop: 12, fontWeight: 600 }}>
              {ar ? "انتظر حتى ينضم طالب واحد على الأقل" : "At least 1 student must join first"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── CREATE FORM ───────────────────────────────────────────────────────────
  return (
    <Layout>
      <div dir={dir} className="min-h-screen py-8 px-4 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #F8FAFC, #F1F5F9)" }}>
        {/* Decorative background blur */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-lg mx-auto relative z-10">
          <div className="mb-6">
            <GameFlowBackButton onBack={() => setLocation("/")} />
          </div>
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-5">
              <HotSeatIcon size={96} />
            </div>
            <h1 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">
              {ar ? "الكرسي الساخن" : "HotSeat"}
            </h1>
            <p className="text-sm font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
              {ar ? "طالب على الكرسي يجيب على أسئلة زملائه — والجميع يُصوّت" : "One student answers classmates' questions — everyone votes"}
            </p>
          </motion.div>

          {/* Teacher name removed — mute button moved to toolbar */}

          {/* Grade + Subject */}
          <Card className="p-6 mb-4 shadow-sm border-slate-200/60 bg-white/80 backdrop-blur-xl rounded-3xl">
            <div className="flex justify-end mb-4">
              <button onClick={toggleMute}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02]"
                style={{
                  borderColor: muted ? "#fecaca" : "#e2e8f0",
                  background: muted ? "#fef2f2" : "#f8fafc",
                  color: muted ? "#ef4444" : "#64748b",
                }}>
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {muted ? (ar ? "صامت" : "Muted") : (ar ? "صوت" : "Sound")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2.5">
                  <Building size={14} />
                  {ar ? "الصف (اختياري)" : "Class (optional)"}
                </label>
                <input value={grade} onChange={e => setGrade(e.target.value)}
                  placeholder={ar ? "مثال: 3 متوسط أ" : "e.g. Grade 8B"}
                  className="w-full bg-slate-50 outline-none text-sm font-bold placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-3 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  maxLength={30} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2.5">
                  <BookOpen size={14} />
                  {ar ? "المادة (اختياري)" : "Subject (optional)"}
                </label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder={ar ? "مثال: رياضيات" : "e.g. Science"}
                  className="w-full bg-slate-50 outline-none text-sm font-bold placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-3 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  maxLength={30} />
              </div>
            </div>
          </Card>

          {/* Topic */}
          <Card className="p-6 mb-4 shadow-sm border-slate-200/60 bg-white/80 backdrop-blur-xl rounded-3xl">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2.5">
              <Lightbulb size={14} />
              {ar ? "موضوع الجلسة (اختياري)" : "Session Topic (optional)"}
            </label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder={ar ? "مثال: قوانين نيوتن، الكسور العشرية..." : "e.g. Newton's Laws..."}
              className="w-full bg-slate-50 outline-none text-sm font-bold placeholder:text-slate-400 border border-slate-200 rounded-xl px-4 py-3 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              maxLength={80} />
          </Card>

          {/* Questions source */}
          <Card className="p-6 mb-4 shadow-sm border-slate-200/60 bg-white/80 backdrop-blur-xl rounded-3xl">
            <label className="flex items-center gap-2 text-sm font-bold mb-4 text-slate-800">
              <FileText size={16} />
              {ar ? "مصدر أسئلة الجلسة" : "Session question source"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {([
                {
                  value: "students" as const,
                  title: ar ? "الطلاب فقط" : "Students only",
                  desc: ar ? "يكتب الطلاب أسئلتهم مباشرة" : "Students submit live questions",
                },
                {
                  value: "assignment" as const,
                  title: ar ? "الواجب فقط" : "Assignment only",
                  desc: ar ? "يختار المعلم من الأسئلة المحمّلة" : "Teacher uses loaded questions",
                },
                {
                  value: "mixed" as const,
                  title: ar ? "دمج المصدرين" : "Combine both",
                  desc: ar ? "أسئلة الواجب مع أسئلة الطلاب" : "Loaded and student questions",
                },
              ]).map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setQuestionMode(option.value)}
                  className="rounded-2xl border-2 p-4 text-start transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: questionMode === option.value ? FIRE : "#e2e8f0",
                    background: questionMode === option.value ? `linear-gradient(135deg, rgba(255,107,43,0.08), rgba(255,159,67,0.08))` : "#f8fafc",
                  }}
                >
                  <span className="block text-sm font-black mb-1" style={{ color: questionMode === option.value ? FIRE : "#475569" }}>
                    {option.title}
                  </span>
                  <span className="block text-[11px] leading-relaxed" style={{ color: questionMode === option.value ? FIRE2 : "#94a3b8" }}>{option.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
              {questionMode === "students"
                ? (ar ? "لن تظهر أسئلة محمّلة؛ سيكتب الطلاب أسئلتهم أثناء الجولة." : "No loaded questions; students write questions during the round.")
                : questionMode === "assignment"
                  ? (ar ? "حمّل أسئلة من واجب أو البنك، ولن يُسمح للطلاب بإرسال أسئلة مباشرة." : "Load questions from an assignment or bank; live student submissions are disabled.")
                  : (ar ? "حمّل أسئلة من واجب أو البنك، وسيستطيع الطلاب إضافة أسئلتهم أثناء الجولة." : "Load questions and also allow students to submit live questions.")}
            </p>

            {questionMode !== "students" && questions.length > 0 && (
              <div className="flex items-center gap-3 mb-4 p-3.5 rounded-2xl bg-orange-50 border border-orange-200/60">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <FileText size={16} className="text-orange-500" />
                </div>
                <span className="text-sm font-bold flex-1 text-orange-600">
                  {ar ? `${questions.length} سؤال محمّل` : `${questions.length} questions loaded`}
                </span>
                <button onClick={() => setQuestions([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors">
                  {ar ? "حذف" : "Clear"}
                </button>
              </div>
            )}

            {questionMode !== "students" && <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setAssignOpen(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ borderColor: `rgba(255,107,43,0.3)`, background: `rgba(255,107,43,0.05)`, color: FIRE }}>
                <BookOpen size={16} />
                {ar ? "من واجب" : "From Assignment"}
              </button>
              <button onClick={() => setBankOpen(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ borderColor: "#c7d2fe", background: "#f0fdf4", color: "#6366f1" }}>
                <Search size={16} />
                {ar ? "من البنك" : "Question Bank"}
              </button>
            </div>}
          </Card>

          {/* Timer */}
          <Card className="p-6 mb-8 shadow-sm border-slate-200/60 bg-white/80 backdrop-blur-xl rounded-3xl">
            <label className="flex items-center gap-2 text-sm font-bold mb-4 text-slate-800">
              <Timer size={16} />
              {ar ? "مدة الإجابة" : "Answer Time"}
            </label>
            <div className="flex gap-3">
              {[15, 30, 45, 60].map(t => (
                <button key={t} onClick={() => setTimerDuration(t)}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold border-2 transition-all hover:scale-[1.02]"
                  style={{
                    background: timerDuration === t ? FIRE : "#f8fafc",
                    color: timerDuration === t ? "#fff" : "#475569",
                    borderColor: timerDuration === t ? FIRE : "#e2e8f0",
                    boxShadow: timerDuration === t ? `0 8px 24px rgba(255,107,43,0.3)` : undefined,
                  }}>
                  {t}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Create */}
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={handleCreate} disabled={creating}
            className="w-full py-4 rounded-3xl font-black text-lg text-white flex items-center justify-center gap-3 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`, boxShadow: `0 12px 36px rgba(255,107,43,0.35)` }}>
            {creating
              ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><Sparkles size={22} /></motion.span>
              : <><Play size={22} fill="currentColor" /> {ar ? "تجهيز الجلسة" : "Create Session"} <ChevronRight size={20} /></>}
          </motion.button>
        </div>
      </div>

      {/* ── Assignment Modal ── */}
      <AnimatePresence>
        {assignOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setAssignOpen(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px", width: "100%", maxWidth: 560, maxHeight: "75vh", overflow: "auto" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg">{ar ? "اختر واجباً" : "Choose Assignment"}</h3>
                <button onClick={() => setAssignOpen(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              {assignLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
              ) : assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {ar ? "لا توجد واجبات بأسئلة حتى الآن" : "No assignments with questions yet"}
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map(a => (
                    <button key={a.id} onClick={() => importFromAssignment(a.id, a.title)}
                      disabled={assignImporting === a.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-orange-300 hover:bg-orange-50 transition-all text-start">
                      <BookOpen size={16} style={{ color: FIRE, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.questionCount} {ar ? "سؤال" : "questions"}{a.subject && ` · ${a.subject}`}</p>
                      </div>
                      {assignImporting === a.id
                        ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        : <ChevronDown size={16} className="text-muted-foreground rotate-[-90deg]" />}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Question Bank Modal ── */}
      <AnimatePresence>
        {bankOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setBankOpen(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 0", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-lg">{ar ? "بنك الأسئلة" : "Question Bank"}</h3>
                <button onClick={() => setBankOpen(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border border-border bg-muted/40">
                <Search size={14} className="text-muted-foreground" />
                <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                  placeholder={ar ? "ابحث عن سؤال..." : "Search questions..."}
                  className="flex-1 bg-transparent outline-none text-sm" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                {bankLoading ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
                ) : filteredBank.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">{ar ? "لا توجد أسئلة" : "No questions"}</p>
                ) : filteredBank.map(q => (
                  <button key={q.id}
                    onClick={() => setBankSelected(prev => { const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
                    className="w-full flex items-start gap-3 p-3 rounded-xl border text-start transition-all"
                    style={{
                      borderColor: bankSelected.has(q.id) ? "#6366f1" : "#e5e7eb",
                      background: bankSelected.has(q.id) ? "#eef2ff" : "#fff",
                    }}>
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0"
                      style={{ borderColor: bankSelected.has(q.id) ? "#6366f1" : "#d1d5db", background: bankSelected.has(q.id) ? "#6366f1" : "#fff" }}>
                      {bankSelected.has(q.id) && <Check size={12} color="#fff" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{q.text}</p>
                      {q.subject && <p className="text-xs text-muted-foreground mt-0.5">{q.subject}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="py-3 border-t border-border">
                <button onClick={importFromBank} disabled={bankSelected.size === 0}
                  className="w-full py-3 rounded-xl font-black text-white text-sm transition-all"
                  style={{ background: bankSelected.size > 0 ? "#6366f1" : "#e5e7eb", cursor: bankSelected.size > 0 ? "pointer" : "not-allowed" }}>
                  {ar ? `استيراد ${bankSelected.size} سؤال` : `Import ${bankSelected.size} questions`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
