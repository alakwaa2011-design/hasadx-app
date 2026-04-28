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
    // Split PIN into individual digits for large display
    const pinDigits = gamePin.split("");

    const shareWhatsApp = () => {
      const text = ar
        ? `🔥 الكرسي الساخن\n📍 ${gradeLabel || ""} · ${subject}${topic ? ` · ${topic}` : ""}\n\n🔢 رمز الدخول:\n${gamePin}\n\n🔗 أو افتح الرابط:\n${joinUrl}`
        : `🔥 HotSeat Game\n📍 ${gradeLabel || ""} · ${subject}${topic ? ` · ${topic}` : ""}\n\n🔢 Room Code:\n${gamePin}\n\n🔗 Or open:\n${joinUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
      <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
        {/* Fire embers */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
          {[...Array(16)].map((_, i) => (
            <motion.div key={i}
              animate={{ y: [-20, -140], opacity: [0.7, 0], scale: [1, 0.2] }}
              transition={{ repeat: Infinity, duration: 2 + Math.random() * 2, delay: Math.random() * 4 }}
              style={{ position: "absolute", bottom: 0, left: `${5 + Math.random() * 90}%`, fontSize: 10 + Math.random() * 14 }}
            >🔥</motion.div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "20px 16px", maxWidth: 580, marginInline: "auto" }}>

          {/* Session info bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ color: FIRE2, fontSize: 11, fontWeight: 700, margin: 0 }}>
                🔥 {ar ? "الكرسي الساخن — جلسة نشطة" : "HotSeat — Active Session"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "2px 0 0" }}>
                {gradeLabel && `${gradeLabel} · `}{subject}{topic && ` · ${topic}`}
              </p>
            </div>
            <button
              onClick={() => { setGamePin(null); setCreatorToken(null); setStudents([]); }}
              style={{
                padding: "6px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {ar ? "← جلسة جديدة" : "New Session →"}
            </button>
          </div>

          {/* ━━━━━ BIG PIN DISPLAY ━━━━━ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: "rgba(0,0,0,0.5)",
              border: `2px solid ${FIRE}60`,
              borderRadius: 28,
              padding: "24px 20px",
              backdropFilter: "blur(16px)",
              marginBottom: 14,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            {/* Label */}
            <p style={{
              color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800,
              textAlign: "center", letterSpacing: "0.15em", textTransform: "uppercase",
              margin: "0 0 14px",
            }}>
              {ar ? "🔢 رمز دخول الطلاب" : "🔢 Student Room Code"}
            </p>

            {/* Giant digits */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, direction: "ltr" }}>
              {pinDigits.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 400 }}
                  style={{
                    width: 52, height: 64,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(180deg, ${FIRE}30 0%, ${FIRE}15 100%)`,
                    border: `2px solid ${FIRE}80`,
                    borderRadius: 14,
                    fontSize: 40, fontWeight: 900, color: "#fff",
                    fontFamily: "monospace",
                    boxShadow: `0 4px 16px ${FIRE}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
                  }}
                >
                  {d}
                </motion.div>
              ))}
            </div>

            {/* Join URL small */}
            <p style={{
              color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center",
              margin: "0 0 14px", direction: "ltr", wordBreak: "break-all",
            }}>
              {joinUrl}
            </p>

            {/* Share buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <button
                onClick={copyLink}
                style={{
                  padding: "10px 8px", borderRadius: 12, border: "none",
                  background: copied ? "rgba(22,163,74,0.4)" : "rgba(255,255,255,0.1)",
                  color: "#fff", fontWeight: 800, fontSize: 12,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? (ar ? "تم!" : "Copied!") : (ar ? "نسخ" : "Copy")}</span>
              </button>
              <button
                onClick={shareWhatsApp}
                style={{
                  padding: "10px 8px", borderRadius: 12, border: "none",
                  background: "rgba(37,211,102,0.2)",
                  border: "1px solid rgba(37,211,102,0.3)",
                  color: "#25D366", fontWeight: 800, fontSize: 12,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                } as React.CSSProperties}
              >
                <span style={{ fontSize: 18 }}>📱</span>
                <span>{ar ? "واتساب" : "WhatsApp"}</span>
              </button>
              <div style={{
                padding: "6px", borderRadius: 12,
                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <QRCode value={joinUrl} size={56} />
              </div>
            </div>
          </motion.div>

          {/* ━━━━━ STUDENTS LIST ━━━━━ */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={15} color={FIRE} />
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
                {ar ? `الطلاب المنضمون` : `Students joined`}
              </span>
              <span style={{
                marginInlineStart: "auto",
                background: `${FIRE}30`, border: `1px solid ${FIRE}50`,
                color: FIRE2, fontWeight: 900, fontSize: 16,
                padding: "2px 12px", borderRadius: 999,
              }}>
                {students.length}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, minHeight: 36 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div
                    key={s.uid}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 999,
                      background: "rgba(255,255,255,0.07)",
                      border: `1.5px solid ${s.color}50`,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{s.avatar}</span>
                    <span style={{ color: s.color, fontSize: 12, fontWeight: 800 }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ fontSize: 18 }}
                  >⏳</motion.div>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
                    {ar ? "شارك الرمز مع طلابك..." : "Share the code with your students..."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ━━━━━ START BUTTON ━━━━━ */}
          <motion.button
            whileHover={students.length > 0 ? { scale: 1.02 } : undefined}
            whileTap={students.length > 0 ? { scale: 0.97 } : undefined}
            onClick={startGame}
            disabled={students.length === 0}
            style={{
              width: "100%", padding: "16px", borderRadius: 20, border: "none",
              background: students.length === 0
                ? "rgba(255,107,43,0.2)"
                : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: students.length === 0 ? "rgba(255,255,255,0.4)" : "#fff",
              fontWeight: 900, fontSize: 17,
              cursor: students.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: students.length > 0 ? `0 12px 36px ${FIRE}50` : undefined,
            }}
          >
            <Flame size={22} />
            {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"}
            {students.length > 0 && (
              <span style={{
                background: "rgba(0,0,0,0.25)", borderRadius: 999,
                padding: "2px 10px", fontSize: 13, fontWeight: 800,
              }}>
                {students.length} {ar ? "طالب" : "students"}
              </span>
            )}
          </motion.button>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,107,43,0.6)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
              {ar ? "انتظر حتى ينضم طالب واحد على الأقل" : "Wait for at least 1 student to join"}
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
