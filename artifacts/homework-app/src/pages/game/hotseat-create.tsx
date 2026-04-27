import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Flame, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";
import QRCode from "react-qr-code";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";

const FIRE = "#FF6B2B";
const FIRE2 = "#FF9F43";
const DARK_BG = "linear-gradient(180deg, #050818 0%, #0d1230 60%, #1a0a00 100%)";
const GOLD = "#D9A521";

const SUBJECTS_AR = ["رياضيات","علوم","عربي","إنجليزي","تاريخ","جغرافيا","فيزياء","كيمياء","أحياء","دين","حاسوب","أخرى"];
const SUBJECTS_EN = ["Math","Science","Arabic","English","History","Geography","Physics","Chemistry","Biology","Religion","CS","Other"];

interface Student { uid: string; name: string; avatar: string; color: string; score: number; isOnSeat: boolean; roundsOnSeat: number; }

function FireRing() {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3 + i * 0.3, ease: "linear", delay: i * 0.2 }}
          style={{
            position: "absolute",
            width: 100 + i * 8, height: 100 + i * 8,
            borderRadius: "50%",
            border: `2px solid ${i % 2 === 0 ? FIRE : FIRE2}`,
            opacity: 0.15 + i * 0.03,
          }}
        />
      ))}
      <span style={{ fontSize: 56, position: "relative", zIndex: 2 }}>🔥</span>
    </div>
  );
}

export default function HotSeatCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  // Form state
  const [teacherName, setTeacherName] = useState("");
  const [gradeLevel, setGradeLevel] = useState<"ابتدائي"|"متوسط"|"ثانوي"|"جامعي"|"أخرى"|"">("");
  const [gradeYear, setGradeYear] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [timerDuration, setTimerDuration] = useState(30);
  const [creating, setCreating] = useState(false);

  // Game created state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [creatorToken, setCreatorToken] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [copied, setCopied] = useState(false);

  const gradeYears: Record<string, string[]> = {
    "ابتدائي": ["1","2","3","4","5","6"],
    "متوسط": ["1","2","3"],
    "ثانوي": ["1","2","3"],
    "جامعي": ["1","2","3","4","5"],
    "أخرى": [],
  };
  const sections = ["أ","ب","ج","د","هـ"];

  const gradeLabel = gradeLevel
    ? `${gradeLevel}${gradeYear ? " " + gradeYear : ""}${section ? " " + section : ""}`
    : "";

  useEffect(() => {
    if (!gamePin) return;
    const socket = getHotSeatSocket();
    socket.on("hotseat:players-updated", (data: { students: Student[] }) => {
      setStudents(data.students);
    });
    return () => { socket.off("hotseat:players-updated"); };
  }, [gamePin]);

  const handleCreate = () => {
    if (!teacherName.trim()) { toast.error(ar ? "أدخل اسمك أولاً" : "Enter your name"); return; }
    if (!subject) { toast.error(ar ? "اختر المادة" : "Choose a subject"); return; }
    setCreating(true);
    const socket = getHotSeatSocket();
    socket.emit("hotseat:create", {
      teacherName: teacherName.trim(),
      grade: gradeLabel || (ar ? "غير محدد" : "Unspecified"),
      subject,
      topic: topic.trim() || undefined,
      timerDuration,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        setGamePin(res.pin);
        setCreatorToken(res.creatorToken);
        sessionStorage.setItem(`hotseat-creator-${res.pin}`, res.creatorToken);
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

  // ── Game Created Screen (Lobby) ───────────────────────────────────────────
  if (gamePin) {
    return (
      <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
        {/* Animated fire particles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ y: [-20, -120], opacity: [0.7, 0], scale: [1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 + Math.random() * 2, delay: Math.random() * 3 }}
              style={{
                position: "absolute",
                bottom: 0, left: `${5 + Math.random() * 90}%`,
                fontSize: 12 + Math.random() * 20,
              }}
            >
              🔥
            </motion.div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "24px 16px", maxWidth: 560, marginInline: "auto" }}>
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 24 }}>
            <FireRing />
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "12px 0 4px" }}>
              {ar ? "🔥 الجلسة جاهزة!" : "🔥 Session Ready!"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: 0 }}>
              {gradeLabel && `${gradeLabel} · `}{subject}
              {topic && ` · ${topic}`}
            </p>
          </motion.div>

          {/* PIN Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(255,107,43,0.3)",
              borderRadius: 24,
              padding: 24,
              backdropFilter: "blur(12px)",
              marginBottom: 16,
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, textAlign: "center", margin: "0 0 12px", direction: "ltr" }}>
              {window.location.host}/game/hotseat/join
            </p>
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              style={{
                background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                borderRadius: 18, padding: "18px 28px",
                textAlign: "center", fontSize: 58, fontWeight: 900,
                color: "#fff", letterSpacing: "0.2em", fontFamily: "monospace",
                direction: "ltr", boxShadow: `0 12px 40px ${FIRE}60`,
                marginBottom: 18,
              }}
            >
              {gamePin}
            </motion.div>

            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 8, flexShrink: 0 }}>
                <QRCode value={joinUrl} size={110} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 8, wordBreak: "break-all", direction: "ltr" }}>
                  {joinUrl}
                </p>
                <button
                  onClick={copyLink}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12, border: "none",
                    background: copied ? "rgba(22,163,74,0.4)" : "rgba(255,255,255,0.1)",
                    color: "#fff", fontWeight: 800, fontSize: 13,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? (ar ? "تم النسخ!" : "Copied!") : (ar ? "نسخ الرابط" : "Copy Link")}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Students */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={16} color={FIRE} />
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
                {ar ? `الطلاب المنضمون (${students.length})` : `Students joined (${students.length})`}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div
                    key={s.uid}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      border: `1.5px solid ${s.color}50`,
                      color: "#fff", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <span>{s.avatar}</span>
                    <span style={{ color: s.color }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontStyle: "italic" }}>
                  {ar ? "في انتظار الطلاب..." : "Waiting for students..."}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setGamePin(null); setCreatorToken(null); setStudents([]); }}
              style={{
                flex: 1, padding: "14px", borderRadius: 16,
                border: "1.5px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 14,
                cursor: "pointer",
              }}
            >
              {ar ? "جلسة جديدة" : "New Session"}
            </button>
            <button
              onClick={startGame}
              disabled={students.length === 0}
              style={{
                flex: 2, padding: "14px", borderRadius: 16, border: "none",
                background: students.length === 0
                  ? "rgba(255,107,43,0.3)"
                  : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                color: "#fff", fontWeight: 900, fontSize: 15,
                cursor: students.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: students.length > 0 ? `0 10px 28px ${FIRE}60` : undefined,
              }}
            >
              <Flame size={18} />
              {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"}
            </button>
          </div>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,107,43,0.7)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
              {ar ? "يلزم طالب واحد على الأقل" : "At least 1 student required"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Create Form ───────────────────────────────────────────────────────────
  const subjects = ar ? SUBJECTS_AR : SUBJECTS_EN;
  const subjectsAr = SUBJECTS_AR;

  return (
    <Layout>
      <div dir={dir} className="min-h-screen py-8 px-4" style={{ background: "linear-gradient(180deg, #FCFAF8, #F4EBD9)" }}>
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`, boxShadow: `0 12px 32px ${FIRE}60` }}
            >
              <span style={{ fontSize: 40 }}>🔥</span>
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: "#1a0a00" }}>
              {ar ? "الكرسي الساخن 🔥" : "HotSeat 🔥"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "طالب على الكرسي يجيب على أسئلة زملائه — والجميع يُصوّت!"
                : "One student on the hot seat answers classmates' questions — everyone votes!"}
            </p>
          </motion.div>

          {/* Teacher name */}
          <Card className="p-4 mb-3">
            <label className="block text-sm font-bold mb-2">{ar ? "👋 اسم المعلم" : "👋 Your Name"}</label>
            <input
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              placeholder={ar ? "أدخل اسمك..." : "Enter your name..."}
              className="w-full bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/50 border-b border-border pb-1"
              maxLength={40}
            />
          </Card>

          {/* Grade level */}
          <Card className="p-4 mb-3">
            <label className="block text-sm font-bold mb-3">{ar ? "🏫 المرحلة الدراسية" : "🏫 Grade Level"}</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(["ابتدائي","متوسط","ثانوي","جامعي","أخرى"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => { setGradeLevel(level); setGradeYear(""); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                  style={{
                    background: gradeLevel === level ? FIRE : "#fff",
                    color: gradeLevel === level ? "#fff" : "#374151",
                    borderColor: gradeLevel === level ? FIRE : "#e5e7eb",
                    boxShadow: gradeLevel === level ? `0 4px 12px ${FIRE}40` : undefined,
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
            {gradeLevel && gradeYears[gradeLevel].length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {gradeYears[gradeLevel].map(y => (
                  <button
                    key={y}
                    onClick={() => setGradeYear(y)}
                    className="w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all"
                    style={{
                      background: gradeYear === y ? FIRE2 : "#fff",
                      color: gradeYear === y ? "#fff" : "#374151",
                      borderColor: gradeYear === y ? FIRE2 : "#e5e7eb",
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
            {gradeLevel && (
              <div className="flex flex-wrap gap-2">
                {sections.map(s => (
                  <button
                    key={s}
                    onClick={() => setSection(s)}
                    className="w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all"
                    style={{
                      background: section === s ? GOLD : "#fff",
                      color: section === s ? "#000" : "#374151",
                      borderColor: section === s ? GOLD : "#e5e7eb",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Subject */}
          <Card className="p-4 mb-3">
            <label className="block text-sm font-bold mb-3">{ar ? "📚 المادة" : "📚 Subject"}</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setSubject(ar ? subjectsAr[i] : s)}
                  className="px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                  style={{
                    background: subject === (ar ? subjectsAr[i] : s) ? FIRE : "#fff",
                    color: subject === (ar ? subjectsAr[i] : s) ? "#fff" : "#374151",
                    borderColor: subject === (ar ? subjectsAr[i] : s) ? FIRE : "#e5e7eb",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          {/* Topic */}
          <Card className="p-4 mb-3">
            <label className="block text-sm font-bold mb-2">
              {ar ? "💡 موضوع الجلسة (اختياري)" : "💡 Session Topic (optional)"}
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={ar ? "مثال: قوانين نيوتن، الكسور العشرية..." : "e.g. Newton's Laws, Fractions..."}
              className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/50 border-b border-border pb-1"
              maxLength={80}
            />
          </Card>

          {/* Timer */}
          <Card className="p-4 mb-6">
            <label className="block text-sm font-bold mb-3">{ar ? "⏱ مدة الإجابة" : "⏱ Answer Time"}</label>
            <div className="flex flex-wrap gap-2">
              {[15,30,45,60].map(t => (
                <button
                  key={t}
                  onClick={() => setTimerDuration(t)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                  style={{
                    background: timerDuration === t ? FIRE : "#fff",
                    color: timerDuration === t ? "#fff" : "#374151",
                    borderColor: timerDuration === t ? FIRE : "#e5e7eb",
                  }}
                >
                  {t}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all flex items-center justify-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              boxShadow: `0 12px 32px ${FIRE}60`,
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? (
              <span className="animate-spin">🔥</span>
            ) : (
              <><Flame size={22} /> {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"} <ChevronRight size={20} /></>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
