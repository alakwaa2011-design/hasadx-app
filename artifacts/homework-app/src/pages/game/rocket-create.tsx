import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, ChevronDown, ChevronUp,
  Check, X, Loader2, FileText, FolderOpen,
  GraduationCap, Trash2, BookOpen, Rocket, Copy,
  ExternalLink, Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";
import QRCode from "react-qr-code";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

type QType = "mcq" | "true_false" | "fill_blank";

interface RocketQuestion {
  text: string;
  type: QType;
  options: string[];
  correct: number;
  correctText?: string;
}

interface BankQuestion {
  id: number;
  subject: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
  tags: string | null;
}

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToRocket = (bq: BankQuestion): RocketQuestion => ({
  text: bq.text,
  type: "mcq",
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
});

function StarField() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 3,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 + s.delay, delay: s.delay }}
          style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
            boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
          }}
        />
      ))}
    </div>
  );
}

export default function RocketCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<RocketQuestion[]>([]);
  const [duration, setDuration] = useState(20);
  const [gameDurationMins, setGameDurationMins] = useState(5);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");

  // Game created state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  // Assignments
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<{ id: number; title: string; subject: string; questionCount: number }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignImporting, setAssignImporting] = useState<number | null>(null);

  // Templates
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ id: number; title: string; questions: RocketQuestion[]; duration: number; isOwn?: boolean; fromAdmin?: boolean }[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-load from presentation deep-link
  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get("assignmentId");
    if (!aid) return;
    const parsedId = parseInt(aid, 10);
    if (Number.isNaN(parsedId)) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/assignments/${parsedId}`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        type RawQ = { questionType?: string; text?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string };
        const qs = ((data.questions || []) as RawQ[])
          .filter(q => q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map(q => bankToRocket({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null,
          } as BankQuestion))
          .slice(0, 30);
        if (qs.length > 0) {
          setQuestions(qs);
          if (data.title) setTitle(data.title);
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من الواجب!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف أسئلة أولاً (من بنك الأسئلة أو من واجب)" : "Add questions first");
      return;
    }
    setCreating(true);
    const socket = getRocketSocket();
    socket.emit("rocket:create", {
      questions, duration,
      totalDurationSecs: gameDurationMins * 60,
      targetClass: targetClass || undefined,
      title: title.trim() || undefined,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        sessionStorage.setItem(`rocket-creator-${res.pin}`, res.creatorToken);
        setGamePin(res.pin);
      }
    });
  };

  const joinUrl = gamePin ? `${window.location.origin}/game/rocket/join/${gamePin}` : "";

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(ar ? "تم نسخ الرابط!" : "Link copied!");
    } catch {
      toast.error(ar ? "فشل النسخ" : "Copy failed");
    }
  };

  // Bank
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) { toast.error(ar ? "يجب تسجيل الدخول أولاً" : "Please log in first"); setBankOpen(false); return; }
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data.filter((q: BankQuestion) => q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer));
      }
    } catch { /* ignore */ } finally { setBankLoading(false); }
  }, [ar]);

  useEffect(() => {
    if (bankOpen) { loadBank(); setBankSelected(new Set()); setBankSearch(""); }
  }, [bankOpen, loadBank]);

  const importBankSelected = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    if (selected.length === 0) return;
    const merged = [...questions, ...selected.map(bankToRocket)].slice(0, 30);
    setQuestions(merged);
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${selected.length} سؤال` : `Imported ${selected.length}`);
  };

  // Assignments
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

  useEffect(() => {
    if (assignOpen) { loadAssignments(); }
  }, [assignOpen, loadAssignments]);

  const importAllFromAssignment = async (assignmentId: number, assignmentTitle: string) => {
    setAssignImporting(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const qs = (data.questions || [])
        .filter((q: { questionType?: string; optionA?: string; correctAnswer?: string }) =>
          q.questionType === "mcq" && q.optionA && q.correctAnswer)
        .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }) => bankToRocket({
          id: q.id, subject: data.subject || "", text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: 1, tags: null,
        } as BankQuestion));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار متعدد" : "No MCQ questions found"); return; }
      setQuestions(qs.slice(0, 30));
      if (data.title) setTitle(data.title);
      setAssignOpen(false);
      toast.success(ar ? `تم استيراد ${qs.length} سؤال من "${assignmentTitle}"` : `Imported ${qs.length} questions from "${assignmentTitle}"`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

  // Templates
  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rocket-templates`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "خطأ في تحميل القوالب" : "Error loading templates"); return; }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } finally { setSavedLoading(false); }
  };

  const handleLoadTemplate = (t: typeof savedTemplates[0]) => {
    setQuestions(t.questions);
    setDuration(t.duration);
    setSavedOpen(false);
    toast.success(ar ? `تم تحميل "${t.title}"` : `Loaded "${t.title}"`);
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/rocket-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch { toast.error(ar ? "خطأ في الحذف" : "Delete error"); }
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.includes(bankSearch) || q.subject.includes(bankSearch))
    : bankQuestions;

  // ── Game Created Screen ────────────────────────────────────────────────────
  if (gamePin) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100dvh",
          background: "linear-gradient(180deg, #0a0e27 0%, #1a1740 50%, #2d1b4e 100%)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
        }}
      >
        <StarField />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 520 }}
        >
          {/* Rocket icon */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <motion.div
              animate={{ y: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              style={{ display: "inline-block" }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 16px 40px -8px ${BRAND_PRIMARY}88`,
                margin: "0 auto",
              }}>
                <Rocket size={40} color="#fff" />
              </div>
            </motion.div>
            <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 22, margin: "14px 0 4px" }}>
              {ar ? "🚀 السباق جاهز للانطلاق!" : "🚀 Race is Ready!"}
            </h1>
            {title && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>{title}</p>
            )}
          </div>

          {/* PIN Card */}
          <div style={{
            background: "rgba(255,255,255,0.07)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 24,
            padding: 28,
            backdropFilter: "blur(12px)",
            marginBottom: 16,
          }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, margin: "0 0 8px", textAlign: "center" }}>
              {ar ? "للانضمام، ادخل على الموقع واكتب الكود:" : "Join at the website and enter the code:"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600, margin: "0 0 14px", textAlign: "center", direction: "ltr" }}>
              {window.location.host}/game/rocket/join
            </p>

            {/* Big PIN */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              style={{
                background: BRAND_GOLD,
                borderRadius: 20,
                padding: "20px 32px",
                textAlign: "center",
                fontSize: 64,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "0.18em",
                fontFamily: "monospace",
                direction: "ltr",
                boxShadow: `0 16px 40px -8px ${BRAND_GOLD}80`,
                marginBottom: 20,
              }}
            >
              {gamePin}
            </motion.div>

            {/* QR + info */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: 10, flexShrink: 0 }}>
                <QRCode value={joinUrl} size={120} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 12,
                  fontWeight: 600,
                  direction: "ltr",
                  wordBreak: "break-all",
                }}>
                  {joinUrl}
                </div>
                <button
                  onClick={copyLink}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "none",
                    background: copied
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)`,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s",
                    boxShadow: `0 8px 20px -4px ${BRAND_PRIMARY}60`,
                  }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? (ar ? "✓ تم النسخ!" : "✓ Copied!") : (ar ? "نسخ الرابط" : "Copy Link")}
                </button>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={13} />
                  {ar ? `${questions.length} سؤال · ${duration} ث لكل سؤال` : `${questions.length} questions · ${duration}s each`}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setGamePin(null); setQuestions([]); }}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 16,
                border: "1.5px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.8)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {ar ? "سباق جديد" : "New Race"}
            </button>
            <button
              onClick={() => setLocation(`/game/rocket/host/${gamePin}`)}
              style={{
                flex: 2,
                padding: "14px 16px",
                borderRadius: 16,
                border: "none",
                background: `linear-gradient(135deg, ${BRAND_GOLD}, #c89212)`,
                color: "#000",
                fontWeight: 900,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: `0 12px 28px -8px ${BRAND_GOLD}80`,
              }}
            >
              <ExternalLink size={18} />
              {ar ? "ابدأ بإدارة اللعبة" : "Start Game Management"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Create Screen ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-screen py-8 px-4"
        style={{ background: "linear-gradient(180deg, #FCFAF8 0%, #F4EBD9 100%)" }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #2d6a45 100%)`, boxShadow: `0 12px 32px -8px ${BRAND_PRIMARY}66` }}
            >
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: BRAND_PRIMARY }}>
              {ar ? "أنشئ سباق الصواريخ" : "Create Rocket Race"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar ? "كلما أجاب الطالب أسرع وأصح، صعد صاروخه أعلى!" : "Faster correct answers = higher rocket!"}
            </p>
          </motion.div>

          {/* Title */}
          <Card className="p-4 mb-3 flex items-center gap-3">
            <span className="text-xl">📛</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={ar ? "اسم السباق (اختياري)" : "Race title (optional)"}
              className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/60"
              maxLength={60}
            />
          </Card>

          {/* Duration per question */}
          <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
            <Clock className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
            <span className="font-bold text-sm flex-1">{ar ? "وقت كل سؤال" : "Time per question"}</span>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30, 45].map(s => (
                <button
                  key={s}
                  onClick={() => setDuration(s)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all border"
                  style={{
                    background: duration === s ? BRAND_PRIMARY : "#fff",
                    color: duration === s ? "#fff" : "#374151",
                    borderColor: duration === s ? BRAND_PRIMARY : "#e5e7eb",
                  }}
                >
                  {s}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Total game duration */}
          <Card className="p-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{ar ? "مدة اللعبة الكلية" : "Total Game Duration"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar ? "الأسئلة تتكرر حتى انتهاء الوقت، والأخطاء تُعاد أولاً" : "Questions loop until time ends, wrong answers repeat first"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGameDurationMins(m => Math.max(1, m - 1))}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center font-black text-lg hover:bg-muted transition-colors"
                  style={{ borderColor: BRAND_PRIMARY, color: BRAND_PRIMARY }}
                >
                  −
                </button>
                <span className="font-black text-xl min-w-[72px] text-center" style={{ color: BRAND_PRIMARY }}>
                  {gameDurationMins} {ar ? "دق" : "min"}
                </span>
                <button
                  onClick={() => setGameDurationMins(m => Math.min(30, m + 1))}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center font-black text-lg hover:bg-muted transition-colors"
                  style={{ borderColor: BRAND_PRIMARY, color: BRAND_PRIMARY }}
                >
                  +
                </button>
              </div>
            </div>
          </Card>

          {/* Target class */}
          {gradeLevels.length > 0 && (
            <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
              <GraduationCap className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
              <span className="font-bold text-sm flex-1">{ar ? "الصف المستهدف" : "Target class"}</span>
              <select
                value={targetClass}
                onChange={e => setTargetClass(e.target.value)}
                className="min-w-[160px] max-w-[260px] rounded-lg border bg-background px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: "#e5e7eb" }}
              >
                <option value="">{ar ? "— جميع الصفوف —" : "— All classes —"}</option>
                {gradeLevels.map(g => (
                  <option key={g.gradeLevel} value={g.gradeLevel}>
                    {g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})
                  </option>
                ))}
              </select>
            </Card>
          )}

          {/* Questions counter */}
          <AnimatePresence>
            {questions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="p-4 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white"
                      style={{ background: BRAND_PRIMARY }}
                    >
                      {questions.length}
                    </div>
                    <span className="font-bold text-sm" style={{ color: BRAND_PRIMARY }}>
                      {ar ? `سؤال محمّل` : `questions loaded`}
                    </span>
                  </div>
                  <button
                    onClick={() => setQuestions([])}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    title={ar ? "مسح الأسئلة" : "Clear questions"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import buttons */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => setBankOpen(true)}
              className="py-4 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90"
              style={{ background: BRAND_PRIMARY, boxShadow: `0 8px 20px -6px ${BRAND_PRIMARY}60` }}
            >
              <BookOpen className="w-4 h-4" />
              {ar ? "بنك الأسئلة" : "Question Bank"}
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="py-4 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90"
              style={{ background: BRAND_GOLD, boxShadow: `0 8px 20px -6px ${BRAND_GOLD}60` }}
            >
              <FileText className="w-4 h-4" />
              {ar ? "من واجب" : "From Assignment"}
            </button>
            <button
              onClick={() => { setSavedOpen(true); loadTemplates(); }}
              className="py-4 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 col-span-2 hover:opacity-80"
              style={{ background: "#fff", color: BRAND_PRIMARY, borderColor: BRAND_PRIMARY }}
            >
              <FolderOpen className="w-4 h-4" />
              {ar ? "السباقات المحفوظة" : "Saved Races"}
            </button>
          </div>

          {/* Launch button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={handleCreate}
            disabled={creating || questions.length === 0}
            className="w-full py-5 rounded-2xl font-black text-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{
              background: questions.length > 0
                ? `linear-gradient(135deg, ${BRAND_GOLD} 0%, #c89212 100%)`
                : "#e5e7eb",
              boxShadow: questions.length > 0 ? `0 16px 32px -8px ${BRAND_GOLD}80` : "none",
              color: questions.length > 0 ? "#000" : "#9ca3af",
            }}
          >
            {creating ? (
              <><Loader2 className="w-6 h-6 animate-spin" />{ar ? "جاري الإنشاء..." : "Creating..."}</>
            ) : (
              <><Rocket className="w-6 h-6" />{ar ? "أطلق السباق!" : "Launch Race!"}</>
            )}
          </motion.button>

          {questions.length === 0 && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              {ar ? "اختر مصدر الأسئلة أولاً ثم أطلق السباق" : "Select a question source first, then launch"}
            </p>
          )}
        </div>
      </div>

      {/* Bank modal */}
      <AnimatePresence>
        {bankOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBankOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
                  <BookOpen className="w-5 h-5" />
                  {ar ? "بنك الأسئلة" : "Question Bank"}
                </h3>
                <button onClick={() => setBankOpen(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4">
                <input
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  placeholder={ar ? "بحث..." : "Search..."}
                  className="w-full py-2 px-3 rounded-xl border-2 text-sm"
                  style={{ borderColor: "#e5e7eb" }}
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {bankLoading && <div className="text-center py-8 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /></div>}
                {!bankLoading && filteredBank.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد أسئلة" : "No questions"}</div>}
                {filteredBank.map(q => {
                  const checked = bankSelected.has(q.id);
                  return (
                    <div key={q.id} onClick={() => { const n = new Set(bankSelected); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); setBankSelected(n); }}
                      className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                      style={{ borderColor: checked ? BRAND_PRIMARY : "#e5e7eb", background: checked ? `${BRAND_PRIMARY}10` : "#fff" }}>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: checked ? BRAND_PRIMARY : "#d1d5db", background: checked ? BRAND_PRIMARY : "#fff" }}>
                          {checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold line-clamp-2">{q.text}</p>
                          {q.subject && <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>{q.subject}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t flex gap-2" style={{ borderColor: "#e5e7eb" }}>
                <button onClick={() => setBankOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 font-bold text-sm">{ar ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankSelected} disabled={bankSelected.size === 0}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                  style={{ background: BRAND_PRIMARY }}>
                  {ar ? `استيراد (${bankSelected.size})` : `Import (${bankSelected.size})`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assignments modal */}
      <AnimatePresence>
        {assignOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b" style={{ background: "linear-gradient(135deg, #225739, #1a4a2e)", borderColor: "#e5e7eb" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {ar ? "اختر واجباً" : "Select Assignment"}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5">{ar ? "اضغط على الواجب لاستيراد جميع أسئلته" : "Tap to import all questions"}</p>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="p-2 rounded-xl hover:bg-white/20 text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading && <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
                {!assignLoading && assignments.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد واجبات" : "No assignments"}</div>}
                {assignments.map(a => (
                  <motion.button key={a.id} whileTap={{ scale: 0.97 }}
                    onClick={() => importAllFromAssignment(a.id, a.title)}
                    disabled={assignImporting !== null}
                    className="w-full p-4 rounded-2xl border-2 flex items-center gap-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-start"
                    style={{ borderColor: BRAND_PRIMARY, background: assignImporting === a.id ? "#f0fdf4" : "#fff" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #225739, #388e3c)" }}>
                      {assignImporting === a.id
                        ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                        : <FileText className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-800 dark:text-gray-100 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                    </div>
                    <Check className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved templates modal */}
      <AnimatePresence>
        {savedOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSavedOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
                  <FolderOpen className="w-5 h-5" />
                  {ar ? "السباقات المحفوظة" : "Saved Races"}
                </h3>
                <button onClick={() => setSavedOpen(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {savedLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                {!savedLoading && savedTemplates.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد سباقات محفوظة" : "No saved races"}</p>
                )}
                {savedTemplates.map(t => (
                  <div key={t.id} className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.questions.length} {ar ? "سؤال" : "questions"}
                        {t.fromAdmin && <span className="ml-2 px-2 py-0.5 rounded" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>{ar ? "من المنصة" : "Platform"}</span>}
                      </p>
                    </div>
                    <button onClick={() => handleLoadTemplate(t)} className="px-3 py-1.5 rounded-lg text-white font-bold text-xs" style={{ background: BRAND_PRIMARY }}>
                      {ar ? "تحميل" : "Load"}
                    </button>
                    {t.isOwn && (
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
