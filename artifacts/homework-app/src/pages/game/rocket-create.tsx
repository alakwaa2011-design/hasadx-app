import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Check, X, Loader2, FolderOpen, GraduationCap,
  Trash2, Rocket, Copy, ExternalLink, Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { GameLibraryPublishChoice } from "@/components/game/game-library-publish-choice";
import { saveGameActivity } from "@/lib/saved-game-activities";
import QRCode from "react-qr-code";
import { normalizeGameQuestion } from "@/lib/normalize-game-question";
import { useGameShareUrl } from "@/lib/use-game-share-url";

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
  imageUrl?: string | null;
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
  imageUrl?: string | null;
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
  imageUrl: bq.imageUrl || null,
});

const savedSettings = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

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
  const [step, setStep] = useState<"questions" | "settings">("questions");
  const [duration, setDuration] = useState(20);
  // Race timer: 1-15 minutes; defaults to 5. Race auto-ends when timer hits zero.
  const [gameDurationMins, setGameDurationMins] = useState(5);
  const [advanceMode, setAdvanceMode] = useState<"per_player" | "host_sync">("per_player");
  const [creating, setCreating] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [title, setTitle] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");

  // Game created state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    let active = true;
    const aid = new URLSearchParams(window.location.search).get("assignmentId");
    if (!aid) return () => { active = false; };
    const parsedId = parseInt(aid, 10);
    if (Number.isNaN(parsedId)) return () => { active = false; };
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/assignments/${parsedId}`, { credentials: "include" });
        if (!active || !r.ok) return;
        const data = await r.json();
        if (!active) return;
        const qs = ((data.questions || []) as any[])
          .flatMap(q => {
            const normalized = normalizeGameQuestion(q, {
              trueLabel: ar ? "صح" : "True",
              falseLabel: ar ? "خطأ" : "False",
              allowFillBlank: true,
            });
            return normalized ? [normalized] : [];
          })
          .slice(0, 30);
        if (qs.length > 0) {
          setQuestions(qs);
          if (data.title) setTitle(data.title);
          setStep("settings");
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من الواجب!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف أسئلة أولاً" : "Add questions first");
      return;
    }
    if (questions.some(q => !q.text.trim() || q.options.some(option => !option.trim()))) {
      toast.error(ar ? "أكمل نص كل سؤال وخياراته أولاً" : "Complete each question and its answer options first");
      return;
    }
    setCreating(true);
    try {
      await saveGameActivity({
        gameType: "rocket",
        title: title.trim() || (ar ? "سباق الصواريخ" : "Rocket Race"),
        content: { questions },
        settings: {
          duration,
          totalDurationSecs: Math.max(1, Math.min(15, gameDurationMins)) * 60,
          targetClass: targetClass || null,
          advanceMode,
        },
        source: "game-launch",
        isShared,
      });
    } catch {
      setCreating(false);
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
    const socket = getRocketSocket();
    socket.emit("rocket:create", {
      questions, duration,
      // Race timer in seconds (1-15 min selectable on this screen).
      totalDurationSecs: Math.max(1, Math.min(15, gameDurationMins)) * 60,
      targetClass: targetClass || undefined,
      title: title.trim() || undefined,
      advanceMode,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        sessionStorage.setItem(`rocket-creator-${res.pin}`, res.creatorToken);
        // Go directly to host panel — no intermediate PIN page
        setLocation(`/game/rocket/host/${res.pin}`);
      }
    });
  };

  const hasCompleteQuestions = questions.length > 0
    && !questions.some(q => !q.text.trim() || q.options.some(option => !option.trim()));

  const joinUrl = gamePin ? `${window.location.origin}/game/rocket/join/${gamePin}` : "";
  const shortLink = useGameShareUrl(joinUrl);

  const copyLink = async () => {
    if (shortLink.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(shortLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(ar ? "تم نسخ الرابط!" : "Link copied!");
    } catch {
      toast.error(ar ? "فشل النسخ" : "Copy failed");
    }
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
    setStep("settings");
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
               {ar ? "سباق الصواريخ جاهز للانطلاق!" : "Rocket Race is Ready!"}
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
                {shortLink.status === "ready" && <QRCode value={shortLink.url} size={120} />}
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
                  {shortLink.status === "ready" ? shortLink.url : shortLink.status === "pending" ? (ar ? "جارٍ تجهيز الرابط القصير…" : "Preparing short link…") : shortLink.error}
                </div>
                <button
                  onClick={copyLink}
                  disabled={shortLink.status !== "ready"}
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
                {shortLink.status === "error" && <button type="button" onClick={shortLink.retry} className="text-sm underline text-red-300">{ar ? "إعادة المحاولة" : "Retry"}</button>}
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
               {ar ? "سباق صواريخ جديد" : "New Rocket Race"}
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <GameFlowBackButton
              onBack={() => {
                if (step === "settings") {
                  setStep("questions");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return;
                }
                setLocation("/");
              }}
            />
          </div>
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
              {ar ? "كلما كانت الإجابة أسرع وأصح، ارتفع الصاروخ أكثر!" : "Faster, more accurate answers send rockets higher!"}
            </p>
          </motion.div>

          {/* Two-step progress */}
          <div className="flex items-center justify-center gap-2 mb-5" aria-label={ar ? "خطوات إعداد السباق" : "Race setup steps"}>
            <div className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black" style={{ background: step === "questions" ? BRAND_PRIMARY : `${BRAND_PRIMARY}12`, color: step === "questions" ? "#fff" : BRAND_PRIMARY }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: step === "questions" ? "rgba(255,255,255,.2)" : `${BRAND_PRIMARY}20` }}>1</span>
              {ar ? "تجهيز الأسئلة" : "Prepare questions"}
            </div>
            <div className="w-8 h-px" style={{ background: `${BRAND_PRIMARY}35` }} />
            <div className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black" style={{ background: step === "settings" ? BRAND_PRIMARY : `${BRAND_PRIMARY}12`, color: step === "settings" ? "#fff" : BRAND_PRIMARY }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: step === "settings" ? "rgba(255,255,255,.2)" : `${BRAND_PRIMARY}20` }}>2</span>
              {ar ? "إعدادات السباق" : "Race settings"}
            </div>
          </div>

          {step === "settings" && (
            <>
            {/* Compact settings panel */}
           <Card className="p-4 sm:p-5 mb-4 border-primary/15 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Rocket className="w-4 h-4" /></span>
               <div>
                 <h2 className="font-black text-base" style={{ color: BRAND_PRIMARY }}>{ar ? "تفاصيل سباق الصواريخ" : "Rocket race details"}</h2>
                 <p className="text-xs text-muted-foreground mt-0.5">{ar ? "اضبط القيم الأساسية قبل الانطلاق" : "Set the essentials before launch"}</p>
               </div>
             </div>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "اسم السباق" : "Race name"}</label>
                 <input
                   value={title}
                   onChange={e => setTitle(e.target.value)}
                   placeholder={ar ? "مثال: مراجعة الوحدة الأولى" : "e.g. Unit 1 review"}
                   className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                   maxLength={60}
                 />
                 {title && (
                   <p className="mt-2 text-xs font-bold text-white/70">
                     {questions.length} {ar ? "أسئلة من الواجب" : "assignment questions"}
                   </p>
                 )}
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" style={{ color: BRAND_PRIMARY }} />{ar ? "وقت كل سؤال" : "Time per question"}</label>
                   <select value={duration} onChange={e => setDuration(parseInt(e.target.value, 10))} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     {[10, 15, 20, 30, 45].map(seconds => <option key={seconds} value={seconds}>{seconds} {ar ? "ثانية" : "seconds"}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "مدة السباق" : "Race duration"}</label>
                   <select value={gameDurationMins} onChange={e => setGameDurationMins(parseInt(e.target.value, 10))} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     {Array.from({ length: 15 }, (_, index) => index + 1).map(minutes => <option key={minutes} value={minutes}>{minutes} {ar ? "دقيقة" : "minutes"}</option>)}
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "طريقة تقدّم الأسئلة" : "Question pacing"}</label>
                   <select value={advanceMode} onChange={e => setAdvanceMode(e.target.value as typeof advanceMode)} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     <option value="per_player">{ar ? "تلقائي — لكل طالب" : "Auto — per student"}</option>
                     <option value="host_sync">{ar ? "يدوي — سؤال واحد للجميع" : "Teacher sync — one question for all"}</option>
                   </select>
                 </div>
                  <div>
                     <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" style={{ color: BRAND_PRIMARY }} />{ar ? "الصف المستهدف" : "Target class"}</label>
                     <select value={targetClass} onChange={e => setTargetClass(e.target.value)} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                        <option value="">{ar ? "بدون صف — دخول عام بالرابط" : "No class — anyone with the link"}</option>
                       {gradeLevels.map(g => <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})</option>)}
                     </select>
                  </div>
               </div>
             </div>
           </Card>
            </>
          )}

          {step === "questions" && (
            <UnifiedQuestionSourceFlow
              gameTitle={ar ? "أنشئ سباق الصواريخ" : "Create Rocket Race"}
              gameDescription={ar ? "حضّر الأسئلة أولاً، ثم اضبط السباق وابدأ اللعب." : "Prepare questions, configure the race, then launch."}
              gameIcon={<Rocket className="h-8 w-8 text-white" />}
              accentColor={BRAND_PRIMARY}
              tugPresentation
              header={<></>}
              menuFooter={
                <button
                  type="button"
                  onClick={() => { setSavedOpen(true); loadTemplates(); }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-card text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                >
                  <FolderOpen className="h-4 w-4" />
                  {ar ? "سباقات الصواريخ المحفوظة" : "Saved Rocket Races"}
                </button>
              }
              manualEntryMode="immediate"
              minQuestions={1}
              maxQuestions={30}
            allowFillBlank
              onComplete={({ questions: prepared, sourceTitle, source, savedActivity }) => {
                setQuestions(prepared.map(question => ({ ...question, type: question.type ?? "mcq" })));
                if (sourceTitle) setTitle(sourceTitle);
                if (source === "saved" && savedActivity?.gameType === "rocket") {
                  setIsShared(savedActivity.isShared);
                  const settings = savedSettings(savedActivity.settings);
                  if (settings) {
                    if ([10, 15, 20, 30, 45].includes(settings.duration as number)) {
                      setDuration(settings.duration as number);
                    }
                    if (typeof settings.totalDurationSecs === "number"
                      && Number.isInteger(settings.totalDurationSecs / 60)
                      && settings.totalDurationSecs >= 60
                      && settings.totalDurationSecs <= 15 * 60) {
                      setGameDurationMins(settings.totalDurationSecs / 60);
                    }
                    if (typeof settings.targetClass === "string") setTargetClass(settings.targetClass);
                    if (settings.advanceMode === "per_player" || settings.advanceMode === "host_sync") {
                      setAdvanceMode(settings.advanceMode);
                    }
                  }
                }
                setStep("settings");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

           {step === "settings" && (
             <>
               <GameLibraryPublishChoice isShared={isShared} onChange={setIsShared} className="mb-4" />
               <motion.button type="button" whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }} onClick={handleCreate} disabled={creating || !hasCompleteQuestions} className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: hasCompleteQuestions ? `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)` : "#e5e7eb", boxShadow: hasCompleteQuestions ? `0 14px 28px -8px ${BRAND_PRIMARY}70` : "none", color: hasCompleteQuestions ? "#fff" : "#9ca3af" }}>{creating ? <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جارٍ الإنشاء…" : "Creating…"}</> : <><Rocket className="w-5 h-5" />{ar ? "ابدأ سباق الصواريخ" : "Start Rocket Race"}</>}</motion.button>
             </>
           )}
        </div>
      </div>

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
                  {ar ? "سباقات الصواريخ المحفوظة" : "Saved Rocket Races"}
                </h3>
                <button onClick={() => setSavedOpen(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {savedLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                {!savedLoading && savedTemplates.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد سباقات صواريخ محفوظة" : "No saved Rocket Races"}</p>
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
