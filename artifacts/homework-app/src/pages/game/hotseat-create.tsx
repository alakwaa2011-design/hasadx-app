import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Flame, ChevronRight, Volume2, VolumeX, BookOpen, FileText, X, Search, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";
import QRCode from "react-qr-code";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";

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
      if (!topic && assignTitle) setTopic(assignTitle);
      setAssignOpen(false);
      toast.success(ar ? `✅ تم جلب ${qs.length} سؤال من "${assignTitle}"` : `✅ Loaded ${qs.length} questions`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

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
    toast.success(ar ? `✅ تم استيراد ${qs.length} سؤال` : `✅ Imported ${qs.length} questions`);
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.toLowerCase().includes(bankSearch.toLowerCase()))
    : bankQuestions;

  const handleCreate = () => {
    if (!grade.trim() && !subject.trim()) { toast.error(ar ? "أدخل الصف أو المادة" : "Enter grade or subject"); return; }
    setCreating(true);
    const socket = getHotSeatSocket();
    socket.emit("hotseat:create", {
      teacherName: "المعلم",
      grade: grade.trim() || "",
      subject: subject.trim() || "",
      topic: topic.trim() || undefined,
      timerDuration,
      seedQuestions: questions.length > 0 ? questions : undefined,
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
        ? `🔥 الكرسي الساخن${sessionInfo ? `\n📍 ${sessionInfo}` : ""}\n\n🔢 رمز الدخول:\n${gamePin}\n\n🔗 أو افتح الرابط:\n${joinUrl}`
        : `🔥 HotSeat Game${sessionInfo ? `\n📍 ${sessionInfo}` : ""}\n\n🔢 Room Code:\n${gamePin}\n\n🔗 Or open:\n${joinUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
      <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
        {/* Embers */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
          {[...Array(16)].map((_, i) => (
            <motion.div key={i}
              animate={{ y: [-20, -140], opacity: [0.7, 0] }}
              transition={{ repeat: Infinity, duration: 2 + Math.random() * 2, delay: Math.random() * 4 }}
              style={{ position: "absolute", bottom: 0, left: `${5 + Math.random() * 90}%`, fontSize: 10 + Math.random() * 14 }}
            >🔥</motion.div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "20px 16px", maxWidth: 580, marginInline: "auto" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ color: FIRE2, fontSize: 11, fontWeight: 700, margin: 0 }}>
                🔥 {ar ? "الكرسي الساخن — جلسة نشطة" : "HotSeat — Active Session"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "2px 0 0" }}>
                {sessionInfo || (ar ? "جاهز للبدء" : "Ready to start")}
              </p>
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
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: "rgba(0,0,0,0.5)", border: `2px solid ${FIRE}60`, borderRadius: 28, padding: "24px 20px", marginBottom: 14 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800, textAlign: "center", letterSpacing: "0.15em", margin: "0 0 14px" }}>
              {ar ? "🔢 رمز دخول الطلاب" : "🔢 Student Room Code"}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, direction: "ltr" }}>
              {pinDigits.map((d, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 400 }}
                  style={{
                    width: 52, height: 64, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(180deg, ${FIRE}30 0%, ${FIRE}15 100%)`,
                    border: `2px solid ${FIRE}80`, borderRadius: 14,
                    fontSize: 40, fontWeight: 900, color: "#fff", fontFamily: "monospace",
                    boxShadow: `0 4px 16px ${FIRE}30`,
                  }}>{d}</motion.div>
              ))}
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, textAlign: "center", margin: "0 0 14px", direction: "ltr", wordBreak: "break-all" }}>
              {joinUrl}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <button onClick={copyLink} style={{
                padding: "10px 8px", borderRadius: 12, border: "none",
                background: copied ? "rgba(22,163,74,0.4)" : "rgba(255,255,255,0.1)",
                color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? (ar ? "تم!" : "Copied!") : (ar ? "نسخ" : "Copy")}</span>
              </button>
              <button onClick={shareWhatsApp} style={{
                padding: "10px 8px", borderRadius: 12,
                border: "1px solid rgba(37,211,102,0.3)",
                background: "rgba(37,211,102,0.15)", color: "#25D366",
                fontWeight: 800, fontSize: 12, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 18 }}>📱</span>
                <span>{ar ? "واتساب" : "WhatsApp"}</span>
              </button>
              <div style={{ padding: "6px", borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QRCode value={joinUrl} size={56} />
              </div>
            </div>
          </motion.div>

          {/* Students */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={15} color={FIRE} />
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
                {ar ? "الطلاب المنضمون" : "Students joined"}
              </span>
              <span style={{ marginInlineStart: "auto", background: `${FIRE}30`, border: `1px solid ${FIRE}50`, color: FIRE2, fontWeight: 900, fontSize: 16, padding: "2px 12px", borderRadius: 999 }}>
                {students.length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, minHeight: 36 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div key={s.uid} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: `1.5px solid ${s.color}50` }}>
                    <span style={{ fontSize: 16 }}>{s.avatar}</span>
                    <span style={{ color: s.color, fontSize: 12, fontWeight: 800 }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <motion.p animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
                  {ar ? "شارك الرمز مع طلابك..." : "Share the code with your students..."}
                </motion.p>
              )}
            </div>
          </div>

          {/* Questions indicator */}
          {questions.length > 0 && (
            <div style={{ background: "rgba(255,107,43,0.1)", border: `1px solid ${FIRE}40`, borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} color={FIRE2} />
              <span style={{ color: FIRE2, fontSize: 13, fontWeight: 700 }}>
                {ar ? `${questions.length} سؤال جاهز للجلسة` : `${questions.length} questions loaded`}
              </span>
            </div>
          )}

          {/* Start */}
          <motion.button whileHover={students.length > 0 ? { scale: 1.02 } : undefined}
            whileTap={students.length > 0 ? { scale: 0.97 } : undefined}
            onClick={startGame} disabled={students.length === 0}
            style={{
              width: "100%", padding: "16px", borderRadius: 20, border: "none",
              background: students.length === 0 ? "rgba(255,107,43,0.2)" : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: students.length === 0 ? "rgba(255,255,255,0.4)" : "#fff",
              fontWeight: 900, fontSize: 17, cursor: students.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: students.length > 0 ? `0 12px 36px ${FIRE}50` : undefined,
            }}>
            <Flame size={22} />
            {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"}
            {students.length > 0 && (
              <span style={{ background: "rgba(0,0,0,0.25)", borderRadius: 999, padding: "2px 10px", fontSize: 13 }}>
                {students.length} {ar ? "طالب" : "students"}
              </span>
            )}
          </motion.button>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,107,43,0.6)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
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
      <div dir={dir} className="min-h-screen py-8 px-4" style={{ background: "linear-gradient(180deg, #FCFAF8, #F4EBD9)" }}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`, boxShadow: `0 12px 32px ${FIRE}60` }}>
              <span style={{ fontSize: 40 }}>🔥</span>
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: "#1a0a00" }}>
              {ar ? "الكرسي الساخن 🔥" : "HotSeat 🔥"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar ? "طالب على الكرسي يجيب على أسئلة زملائه — والجميع يُصوّت!" : "One student answers classmates' questions — everyone votes!"}
            </p>
          </motion.div>

          {/* Teacher name removed — mute button moved to toolbar */}

          {/* Grade + Subject */}
          <Card className="p-5 mb-3">
            <div className="flex justify-end mb-3">
              <button onClick={toggleMute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all"
                style={{
                  borderColor: muted ? "#ef4444" : "#e5e7eb",
                  background: muted ? "#fef2f2" : "#f9fafb",
                  color: muted ? "#ef4444" : "#6b7280",
                }}>
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {muted ? (ar ? "صامت" : "Muted") : (ar ? "صوت" : "Sound")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">
                  {ar ? "🏫 الصف (اختياري)" : "🏫 Class (optional)"}
                </label>
                <input value={grade} onChange={e => setGrade(e.target.value)}
                  placeholder={ar ? "مثال: 3 متوسط أ" : "e.g. Grade 8B"}
                  className="w-full bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/40 border-b border-border pb-1"
                  maxLength={30} />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">
                  {ar ? "📚 المادة (اختياري)" : "📚 Subject (optional)"}
                </label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder={ar ? "مثال: رياضيات" : "e.g. Science"}
                  className="w-full bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/40 border-b border-border pb-1"
                  maxLength={30} />
              </div>
            </div>
          </Card>

          {/* Topic */}
          <Card className="p-5 mb-3">
            <label className="block text-xs font-bold text-muted-foreground mb-2">
              {ar ? "💡 موضوع الجلسة (اختياري)" : "💡 Session Topic (optional)"}
            </label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder={ar ? "مثال: قوانين نيوتن، الكسور العشرية..." : "e.g. Newton's Laws..."}
              className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/40 border-b border-border pb-1"
              maxLength={80} />
          </Card>

          {/* Questions source */}
          <Card className="p-5 mb-3">
            <label className="block text-sm font-bold mb-3">
              {ar ? "📋 أسئلة للجلسة (اختياري)" : "📋 Session Questions (optional)"}
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              {ar
                ? "يمكنك جلب أسئلة من واجباتك أو بنك الأسئلة — ستُعرض كاقتراحات على المعلم أثناء الجلسة"
                : "Import questions from assignments or bank — shown as suggestions to the teacher during the session"}
            </p>

            {questions.length > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl"
                style={{ background: `${FIRE}15`, border: `1px solid ${FIRE}40` }}>
                <FileText size={14} style={{ color: FIRE2 }} />
                <span className="text-xs font-bold flex-1" style={{ color: FIRE2 }}>
                  {ar ? `${questions.length} سؤال محمّل` : `${questions.length} questions loaded`}
                </span>
                <button onClick={() => setQuestions([])}
                  className="text-xs text-red-400 hover:text-red-600 font-bold">
                  {ar ? "حذف" : "Clear"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAssignOpen(true)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all"
                style={{ borderColor: `${FIRE}60`, background: `${FIRE}10`, color: FIRE }}>
                <BookOpen size={15} />
                {ar ? "من واجب" : "From Assignment"}
              </button>
              <button onClick={() => setBankOpen(true)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all"
                style={{ borderColor: "#6366f1", background: "#eef2ff", color: "#6366f1" }}>
                <FileText size={15} />
                {ar ? "من البنك" : "Question Bank"}
              </button>
            </div>
          </Card>

          {/* Timer */}
          <Card className="p-5 mb-6">
            <label className="block text-sm font-bold mb-3">{ar ? "⏱ مدة الإجابة" : "⏱ Answer Time"}</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map(t => (
                <button key={t} onClick={() => setTimerDuration(t)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                  style={{
                    background: timerDuration === t ? FIRE : "#fff",
                    color: timerDuration === t ? "#fff" : "#374151",
                    borderColor: timerDuration === t ? FIRE : "#e5e7eb",
                    boxShadow: timerDuration === t ? `0 4px 12px ${FIRE}40` : undefined,
                  }}>
                  {t}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Create */}
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            onClick={handleCreate} disabled={creating}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              boxShadow: `0 12px 32px ${FIRE}60`,
              opacity: creating ? 0.7 : 1,
              cursor: creating ? "not-allowed" : "pointer",
            }}>
            {creating
              ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>🔥</motion.span>
              : <><Flame size={22} /> {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"} <ChevronRight size={20} /></>}
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
