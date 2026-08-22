import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { getWameethSetupPath } from "@/lib/wameeth-entry";
import {
  FileText,
  Gamepad2,
  Brain,
  Trophy,
  Camera,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Users,
  ClipboardList,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  LogIn,
  UserPlus,
  Play,
  Zap,
  Copy,
  Check,
  Loader2,
  Globe,
  AlertCircle,
  Bot,
  Plus,
  Calculator,
  Shuffle,
  Landmark,
  Smartphone,
  Download,
  GraduationCap,
  Crown,
  Presentation,
  BarChart3,
  ShieldCheck,
  Lightbulb,
  Puzzle,
  Swords,
  ArrowUpRight,
  MessageSquarePlus,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui-elements";
import { InstallAppButton } from "@/components/install-app-button";
import { useI18n } from "@/lib/i18n";
import { QuickChallengeModal } from "@/components/teacher/QuickChallengeModal";
import { useSeo } from "@/lib/seo";
import { hasSavedDraft } from "@/lib/guest-draft";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { getAdminLastSurfacePath } from "@/lib/admin-last-surface";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GUEST_COUNT_KEY = "guestUsageCount";

interface PublicStats {
  hidden?: boolean;
  teacherCount: number;
  assignmentCount: number;
  studentCount: number;
  submissionCount: number;
  labels?: { teacher: string | null; assignment: string | null; student: string | null; submission: string | null };
  notes?:  { teacher: string | null; assignment: string | null; student: string | null; submission: string | null };
}

interface PublicAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  targetClass: string | null;
  totalPoints: number | null;
  teacherName: string | null;
  isAdminContent?: boolean;
  questionCount: number;
  createdAt: string;
}

function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/stats/public`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);
  return stats;
}

function usePublicContent() {
  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments?contentKind=competition`)
      .then((r) => r.json())
      .catch(() => [])
      .then((a) => setAssignments(Array.isArray(a) ? a : []))
      .finally(() => setLoading(false));
  }, []);

  return { assignments, loading };
}

interface TeacherAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  questionCount: number;
  submissionCount: number;
  teacherName: string | null;
  deadline: string | null;
}

function useTeacherAssignments(teacherId: number | null) {
  const [ownAssignments, setOwnAssignments] = useState<TeacherAssignment[]>([]);
  const [ownLoading, setOwnLoading] = useState(false);
  useEffect(() => {
    if (!teacherId) return;
    setOwnLoading(true);
    fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOwnAssignments(Array.isArray(d) ? d : []))
      .catch(() => setOwnAssignments([]))
      .finally(() => setOwnLoading(false));
  }, [teacherId]);
  return { ownAssignments, ownLoading };
}

function AnimatedCounter({
  value,
  duration = 1200,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <span>{display.toLocaleString("ar-EG")}</span>;
}

function GuestGateModal({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9 }}
        className="bg-white dark:bg-card rounded-2xl p-7 max-w-sm w-full shadow-2xl text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-extrabold text-foreground mb-2">
          {lang === "ar" ? "استمر مع حساب" : "Continue with an account"}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {lang === "ar"
            ? "لقد استخدمت تجربتك المجانية. سجّل الدخول أو أنشئ حساباً مجانياً للاستمرار واستخدام كل المحتوى."
            : "You've used your free trial. Log in or create a free account to continue using all content."}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/register"
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {lang === "ar" ? "إنشاء حساب مجاني" : "Create Free Account"}
          </Link>
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {lang === "ar" ? "تسجيل الدخول" : "Login"}
          </Link>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

function WameethQuickStartModal({
  assignments,
  onClose,
}: {
  assignments: TeacherAssignment[];
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    if (selected === null || loading) return;
    onClose();
    setLocation(getWameethSetupPath(selected));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92 }}
        className="bg-gradient-to-br from-amber-950 to-orange-950 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-white/10 relative max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">
              {lang === "ar" ? "لعبة مباشرة" : "Live Game"}
            </h3>
            <p className="text-white/50 text-xs">
              {lang === "ar"
                ? "اختر مسابقة وسيُعاد توجيهك فوراً"
                : "Choose a quiz and you'll be redirected"}
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-8 text-white/50 text-sm flex-1">
            {lang === "ar"
              ? "لا توجد مسابقات بعد — أنشئ أولاً."
              : "No quizzes yet — create one first."}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2 mb-5">
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-2xl border transition-all text-start ${
                  selected === a.id
                    ? "border-amber-400/60 bg-amber-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="p-1.5 rounded-xl bg-amber-500/20 shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm line-clamp-1">
                    {a.title}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {a.subject || (lang === "ar" ? "بدون مادة" : "No subject")}{" "}
                    • {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                  </p>
                </div>
                {selected === a.id && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400 ms-auto shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs text-center mb-3">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleStart}
          disabled={selected === null || loading}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-base shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {lang === "ar" ? "جارٍ الإنشاء..." : "Creating..."}
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              {lang === "ar" ? "لعبة مباشرة!" : "Live Game!"}
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function modeLabel(
  mode: string,
  th: { modeElectronic: string; modePaper: string; modeBoth: string },
) {
  if (mode === "electronic") return th.modeElectronic;
  if (mode === "paper") return th.modePaper;
  return th.modeBoth;
}

const READY_QUIZZES_HOME_PREVIEW = 4;

function ReadyQuizzesSection({ lang, dir }: { lang: string; dir: string }) {
  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);
  const [botDialogAssignment, setBotDialogAssignment] =
    useState<PublicAssignment | null>(null);
  const [botCount, setBotCount] = useState(4);
  const [showAllReadyQuizzes, setShowAllReadyQuizzes] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments?contentKind=competition`)
      .then((r) => (r.ok ? r.json() : []))
      .then((a) => setAssignments(Array.isArray(a) ? a : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (a: PublicAssignment) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${window.location.origin}${base}/solve/${a.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(a.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleStartGame = async (
    assignmentId: number,
    withBots: boolean,
    bots: number,
  ) => {
    setBotDialogAssignment(null);
    setStartingGameId(assignmentId);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/start-wameeth/${assignmentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ withBots, botCount: bots }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في بدء اللعبة");
      setLocation(`/game/join/${data.pin}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ في بدء اللعبة";
      toast.error(message);
    } finally {
      setStartingGameId(null);
    }
  };

  const displayedReadyQuizzes = showAllReadyQuizzes
    ? assignments
    : assignments.slice(0, READY_QUIZZES_HOME_PREVIEW);
  const readyQuizOverflow = assignments.length - READY_QUIZZES_HOME_PREVIEW;

  if (!loading && assignments.length === 0) return null;

  return (
    <section className="order-8 py-12 sm:py-16" dir={dir} style={{ order: 8 }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 mb-7 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="mb-2 text-sm font-black text-[hsl(145,55%,32%)]">
              {lang === "ar" ? "لا تريد البدء من الصفر؟" : "Don't want to start from scratch?"}
            </p>
            <p className="mb-3 text-base font-bold text-muted-foreground">
              {lang === "ar" ? "ابدأ من فكرة جاهزة أو اصنع تجربتك الخاصة" : "Start with a ready idea or create your own experience"}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold mb-3 border border-amber-500/15">
              <Zap className="w-3.5 h-3.5" />
              {lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library"}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {lang === "ar" ? "أسئلة ومسابقات جاهزة" : "Ready-made Quizzes"}
            </h2>
          </div>
          <Link
            href="/public/games"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border hover:border-primary/30 text-sm font-bold text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            {lang === "ar" ? "عرض الكل" : "View All"}
            {lang === "ar" ? (
              <ArrowLeft className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </Link>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-border/40 bg-card animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedReadyQuizzes.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="bg-card border border-border/50 rounded-2xl p-5 hover:shadow-lg transition-all hover:border-amber-400/30 flex flex-col gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-foreground text-sm leading-tight mb-1 line-clamp-2">
                      {a.title}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {!a.isAdminContent && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {a.teacherName ||
                            (lang === "ar" ? "مجهول" : "Anonymous")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => setBotDialogAssignment(a)}
                    disabled={startingGameId === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60"
                  >
                    {startingGameId === a.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {startingGameId === a.id
                      ? lang === "ar"
                        ? "جارٍ..."
                        : "Starting..."
                      : lang === "ar"
                        ? "ابدأ اللعبة"
                        : "Start Game"}
                  </button>
                  <button
                    onClick={() => copyLink(a)}
                    className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-bold text-xs hover:bg-muted transition-colors"
                    title={lang === "ar" ? "نسخ الرابط" : "Copy Link"}
                  >
                    {copiedId === a.id ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && readyQuizOverflow > 0 && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={() => setShowAllReadyQuizzes((v) => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted/70 text-sm font-bold text-foreground transition-colors"
            >
              {showAllReadyQuizzes
                ? lang === "ar"
                  ? "عرض أقل"
                  : "Show less"
                : lang === "ar"
                  ? `عرض المزيد (+${readyQuizOverflow})`
                  : `Show more (+${readyQuizOverflow})`}
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${showAllReadyQuizzes ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <div className="text-center mt-8">
            <Link
              href="/public/games"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:border-amber-400/40 text-sm font-bold text-muted-foreground hover:text-foreground transition-all hover:-translate-y-0.5"
            >
              <Globe className="w-4 h-4" />
              {lang === "ar"
                ? "صفحة المسابقات — بحث وتصفح كامل"
                : "Full quizzes page — search & browse"}
            </Link>
          </div>
        )}
      </div>

      <AnimatePresence>
        {botDialogAssignment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setBotDialogAssignment(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              dir={dir}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setBotDialogAssignment(null)}
                className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center gap-1 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2 shadow-lg">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-extrabold text-foreground">
                  {lang === "ar" ? "ابدأ اللعبة" : "Start Game"}
                </h2>
                <p className="text-sm text-muted-foreground font-medium truncate max-w-[220px]">
                  {botDialogAssignment.title}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 mb-5 border border-border/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {lang === "ar"
                      ? "هل تريد منافسة لاعبين وهميين؟"
                      : "Want to compete with bot players?"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {lang === "ar"
                    ? "سيتنافس معك لاعبون وهميون ويمكنك تجميدهم أو سرقة نقاطهم!"
                    : "Bot players will compete with you — freeze them or steal their points!"}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {lang === "ar" ? "عدد الوهميين" : "Bot count"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBotCount((c) => Math.max(2, c - 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-extrabold text-foreground">
                      {botCount}
                    </span>
                    <button
                      onClick={() => setBotCount((c) => Math.min(8, c + 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    handleStartGame(botDialogAssignment.id, true, botCount)
                  }
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  {lang === "ar"
                    ? `نعم، العب مع ${botCount} لاعبين وهميين`
                    : `Yes, play with ${botCount} bots`}
                </button>
                <button
                  onClick={() =>
                    handleStartGame(botDialogAssignment.id, false, 0)
                  }
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {lang === "ar" ? "لا، العب بمفردك" : "No, play solo"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ScaledTutorialPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border-2 border-foreground/85 bg-black shadow-[0_18px_30px_rgba(40,60,45,0.25)]"
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={`${import.meta.env.BASE_URL}install-tutorial?start=2`}
        title="شرح تثبيت حصاد"
        className="absolute top-0 left-0 origin-top-left border-0"
        style={{
          width: "1280px",
          height: "720px",
          transform: `scale(${scale})`,
        }}
        loading="lazy"
        allow="autoplay"
      />
    </div>
  );
}

export default function Home() {
  const { t, lang, setLang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  useSeo(
    isRtl
      ? {
          title: "منصة حصاد | HasadX — عروض تفاعلية ومسابقات تعليمية وواجبات وأنشطة",
          description:
            "منصة حصاد (HasadX) للتعليم التفاعلي العربي: أنشئ عروضًا تفاعلية ومسابقات تعليمية وواجبات وأنشطة، وأنشئ عروضًا بالذكاء الاصطناعي. ابدأ الآن مجانًا.",
          canonicalPath: "/",
          ogImage: "/opengraph.jpg",
        }
      : {
          title: "HasadX — Interactive presentations, quizzes & AI-built lessons for Arabic classrooms",
          description:
            "HasadX is the Arabic interactive teaching platform: build live presentations, quizzes, assignments and AI-generated lessons in minutes.",
          canonicalPath: "/",
          ogImage: "/opengraph.jpg",
        },
  );
  const prefersReducedMotion = useReducedMotion();
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [slots, setSlots] = useState<string[]>(["", "", "", "", "", ""]);
  const [joinTab, setJoinTab] = useState<"pin" | "qr">("pin");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerSuccess, setScannerSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanAnimRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const digitRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const stats = usePublicStats();
  const { assignments, loading: contentLoading } = usePublicContent();
  const { data: teacherData, isLoading: teacherAuthLoading } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  const isLoggedIn: boolean | null = teacherAuthLoading
    ? null
    : teacherData
      ? true
      : false;
  const teacher = {
    isLoggedIn,
    name: teacherData?.name ?? null,
    id: teacherData?.id ?? null,
  };

  // Auto-route logged-in users by role:
  //  - admin   → last-used surface (organizer / admin / teacher) when remembered, else /teacher
  //  - organizer → /organizer (vibrant organizer dashboard)
  //  - teacher → /teacher (default classroom dashboard)
  useEffect(() => {
    if (!teacher.isLoggedIn) return;
    const isAdmin =
      Boolean(teacherData?.isAdmin) || teacherData?.role === "admin";
    if (isAdmin) {
      setLocation(getAdminLastSurfacePath() ?? "/teacher");
    } else if (teacherData?.role === "organizer") {
      setLocation("/organizer");
    } else {
      setLocation("/teacher");
    }
  }, [teacher.isLoggedIn, teacherData, setLocation]);

  // Logged-in *student account* sessions skip the public landing and go
  // straight to their dashboard. Guests / PIN-only visitors stay on the
  // home page so they can see the marketing landing and the role chooser.
  useEffect(() => {
    if (teacher.isLoggedIn !== false) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === "object" && (data as { id?: number }).id) {
          setLocation("/student/dashboard");
        }
      })
      .catch(() => {
        // ignore — guest visitor stays on home
      });
    return () => {
      cancelled = true;
    };
  }, [teacher.isLoggedIn, setLocation]);

  const { ownAssignments, ownLoading } = useTeacherAssignments(teacher.id);
  const [teacherTab, setTeacherTab] = useState<"mine" | "shared">("mine");
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [showQuickChallenge, setShowQuickChallenge] = useState(false);
  const [hasDraft] = useState(() => hasSavedDraft());
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installTab, setInstallTab] = useState<"ios" | "android" | "video">(
    "ios",
  );

  const [platformSettings, setPlatformSettings] = useState({
    guestLimit: 1,
    showFlagsGame: true,
    showColorGame: true,
    showMemoryGame: true,
    showMultiplyGame: true,
    showScrambleGame: true,
    showTugGame: false,
    showCapitalsGame: true,
    showMaraqui: false,
    showSecretGame: false,
    organizerEnabled: true,
  });
  const {
    guestLimit,
    showFlagsGame,
    showColorGame,
    showMemoryGame,
    showMultiplyGame,
    showScrambleGame,
    showTugGame,
    showCapitalsGame,
  } = platformSettings;
  const [wameethStates, setWameethStates] = useState<
    Record<
      number,
      {
        loading: boolean;
        pin: string | null;
        error: string | null;
        copied: boolean;
      }
    >
  >({});
  const [botGameLoading, setBotGameLoading] = useState<number | null>(null);
  const [showWameethQuickStart, setShowWameethQuickStart] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        setPlatformSettings((prev) => ({
          ...prev,
          ...(d?.guestLimit !== undefined ? { guestLimit: d.guestLimit } : {}),
          ...(d?.showFlagsGame !== undefined
            ? { showFlagsGame: d.showFlagsGame }
            : {}),
          ...(d?.showColorGame !== undefined
            ? { showColorGame: d.showColorGame }
            : {}),
          ...(d?.showMemoryGame !== undefined
            ? { showMemoryGame: d.showMemoryGame }
            : {}),
          ...(d?.showMultiplyGame !== undefined
            ? { showMultiplyGame: d.showMultiplyGame }
            : {}),
          ...(d?.showScrambleGame !== undefined
            ? { showScrambleGame: d.showScrambleGame }
            : {}),
          ...(d?.showTugGame !== undefined
            ? { showTugGame: d.showTugGame }
            : {}),
          ...(d?.showCapitalsGame !== undefined
            ? { showCapitalsGame: d.showCapitalsGame }
            : {}),
          ...(d?.showMaraqui !== undefined
            ? { showMaraqui: d.showMaraqui }
            : {}),
          ...(d?.showSecretGame !== undefined
            ? { showSecretGame: d.showSecretGame }
            : {}),
          ...(d?.organizerEnabled !== undefined
            ? { organizerEnabled: d.organizerEnabled }
            : {}),
        }));
      });
  }, []);

  const handleStartWameeth = async (assignmentId: number) => {
    setWameethStates((s) => ({
      ...s,
      [assignmentId]: { loading: true, pin: null, error: null, copied: false },
    }));
    try {
      const res = await fetch(
        `${API_BASE}/api/public/start-wameeth/${assignmentId}`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t.home.wameethError);
      setWameethStates((s) => ({
        ...s,
        [assignmentId]: {
          loading: false,
          pin: data.pin,
          error: null,
          copied: false,
        },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.home.wameethError;
      setWameethStates((s) => ({
        ...s,
        [assignmentId]: {
          loading: false,
          pin: null,
          error: message,
          copied: false,
        },
      }));
    }
  };

  const handleCopyWameethPin = (assignmentId: number, pinVal: string) => {
    navigator.clipboard.writeText(pinVal).then(() => {
      setWameethStates((s) => ({
        ...s,
        [assignmentId]: { ...s[assignmentId], copied: true },
      }));
      setTimeout(
        () =>
          setWameethStates((s) => ({
            ...s,
            [assignmentId]: { ...s[assignmentId], copied: false },
          })),
        2000,
      );
    });
  };

  const handleStartWithBots = (assignmentId: number) => {
    setBotGameLoading(assignmentId);
    const socket = getSocket();
    let remembered = "";
    try { remembered = localStorage.getItem("hasad:lastTargetClass") || ""; } catch {}
    socket.emit(
      "teacher:create-game",
      { assignmentId, gameMode: "solo", targetClass: remembered || undefined },
      (res: { pin?: string; error?: string }) => {
        if (res.error) {
          setBotGameLoading(null);
          disconnectSocket();
          return;
        }
        const gamePin = res.pin!;
        socket.emit("teacher:add-bots", { pin: gamePin, count: 5 }, () => {
          setBotGameLoading(null);
          setLocation(`/teacher/game/${gamePin}`);
        });
      },
    );
  };

  const hasPublicContent = assignments.length > 0;

  const stopScanner = () => {
    cancelAnimationFrame(scanAnimRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerActive(false);
  };

  const startScanner = async () => {
    setScannerError(null);
    setScannerSuccess(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        "متصفحك لا يدعم الوصول إلى الكاميرا. جرّب Chrome أو Safari على هاتفك.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      setScannerActive(true);

      const tick = () => {
        const canvas = canvasRef.current;
        if (!canvas || !video || video.readyState < video.HAVE_ENOUGH_DATA) {
          scanAnimRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          scanAnimRef.current = requestAnimationFrame(tick);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data) {
          const raw = code.data.trim();
          // Presentation QR: …/p/join#pin=123456
          const presMatch = raw.match(/\/p\/join[^#]*#pin=(\d{6})/);
          if (presMatch) {
            stopScanner();
            setScannerSuccess(true);
            setTimeout(() => setLocation(`/p/join#pin=${presMatch[1]}`), 600);
            return;
          }
          const millionMatch = raw.match(
            /\/game\/million\/join\/([a-zA-Z0-9]+)/,
          );
          const urlMatch = raw.match(
            /\/game\/(?:join|[a-z-]+\/join)\/([a-zA-Z0-9]+)/,
          );
          const extracted =
            millionMatch?.[1] ??
            urlMatch?.[1] ??
            (raw.match(/^[a-zA-Z0-9]{4,8}$/) ? raw : null);
          if (extracted) {
            stopScanner();
            setScannerSuccess(true);
            setTimeout(async () => {
              if (millionMatch) {
                setLocation(`/game/million/join/${extracted}`);
                return;
              }
              // Look up which activity this pin belongs to
              try {
                const r = await fetch(`${API_BASE}/api/pin-lookup/${extracted}`);
                if (r.ok) {
                  const d: { gameType: string } = await r.json();
                  if (d.gameType === "flags") { setLocation(`/game/flags/join/${extracted}`); return; }
                  if (d.gameType === "capitals") { setLocation(`/game/capitals/join/${extracted}`); return; }
                  if (d.gameType === "presentation") { setLocation(`/p/join#pin=${extracted}`); return; }
                }
              } catch { /* fall through */ }
              setLocation(`/game/join/${extracted}`);
            }, 600);
            return;
          }
        }
        scanAnimRef.current = requestAnimationFrame(tick);
      };
      scanAnimRef.current = requestAnimationFrame(tick);
    } catch {
      setScannerError(
        "تعذّر الوصول إلى الكاميرا. تأكد من منح الإذن وأعد المحاولة.",
      );
    }
  };

  useEffect(() => {
    if (joinTab !== "qr") stopScanner();
    return () => stopScanner();
  }, [joinTab]);

  const handlePinJoin = async () => {
    let trimmed = pin.trim();
    if (!trimmed) return;

    // Extract PIN from a pasted full URL (e.g. https://…/game/tug/join/123456)
    const urlMatch = trimmed.match(
      /\/game\/(?:[a-z-]+\/)*join\/([a-zA-Z0-9]+)/,
    );
    if (urlMatch) trimmed = urlMatch[1];

    // Must be 6 digits
    if (!/^\d{6}$/.test(trimmed)) {
      setLocation(`/game/join/${trimmed}`);
      return;
    }

    // Ask the server which activity this PIN belongs to
    try {
      const r = await fetch(`${API_BASE}/api/pin-lookup/${trimmed}`);
      if (r.ok) {
        const data: { gameType: string; assignmentId?: number } = await r.json();
        switch (data.gameType) {
          case "tug":          setLocation(`/game/tug/join/${trimmed}`); return;
          case "rocket":       setLocation(`/game/rocket/join/${trimmed}`); return;
          case "hotseat":      setLocation(`/game/hotseat/join/${trimmed}`); return;
          case "million-team": setLocation(`/game/million/team-play/${trimmed}`); return;
          case "million":      setLocation(`/game/million/join/${trimmed}`); return;
          case "scramble":     setLocation(`/game/scramble/play?pin=${trimmed}`); return;
          case "wameeth":      setLocation(`/game/join/${trimmed}`); return;
          case "flags":        setLocation(`/game/flags/join/${trimmed}`); return;
          case "capitals":     setLocation(`/game/capitals/join/${trimmed}`); return;
          case "presentation": setLocation(`/p/join#pin=${trimmed}`); return;
          case "assignment":
            if (typeof data.assignmentId === "number") {
              setLocation(`/solve/${data.assignmentId}?code=${encodeURIComponent(trimmed)}`);
              return;
            }
            break;
          default: break; // unknown — fall through to generic join
        }
      }
    } catch {
      /* ignore and fall through */
    }

    setLocation(`/game/join/${trimmed}`);
  };

  const handlePublicClick = (path: string) => {
    if (isLoggedIn) {
      setLocation(path);
      return;
    }
    if (guestLimit === 0) {
      setShowGuestGate(true);
      return;
    }
    const count = parseInt(localStorage.getItem(GUEST_COUNT_KEY) || "0", 10);
    if (count < guestLimit) {
      localStorage.setItem(GUEST_COUNT_KEY, String(count + 1));
      setLocation(path);
    } else {
      setShowGuestGate(true);
    }
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  // Note: the role-aware redirect above (using teacherData.role) handles
  // routing for logged-in users. We intentionally do NOT add a second
  // unconditional redirect here — that would override the organizer route.

  if (isLoggedIn === true) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (false) {
    const activeList = teacherTab === "mine" ? ownAssignments : assignments;
    const activeLoading = teacherTab === "mine" ? ownLoading : contentLoading;

    const AssignmentCard = ({
      a,
    }: {
      a: TeacherAssignment | PublicAssignment;
    }) => {
      const ws = wameethStates[a.id];
      return (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4 flex flex-col h-full border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5 bg-card">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="p-2 rounded-xl bg-primary/8 text-primary shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-foreground text-sm line-clamp-2 leading-snug">
                  {a.title}
                </h4>
                {a.subject && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.subject}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              {"isAdminContent" in a && !a.isAdminContent && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {"teacherName" in a && a.teacherName
                    ? a.teacherName
                    : lang === "ar"
                      ? "معلم"
                      : "Teacher"}
                </span>
              )}
              <span className="flex items-center gap-1 text-primary font-semibold">
                <Play className="w-3 h-3" />
                {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
              </span>
            </div>
            {ws?.pin && (
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-border/40">
                <div className="flex gap-2">
                  <button
                    onClick={() => setLocation(`/game/join/${ws.pin}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {lang === "ar" ? "انضم" : "Join"} — {ws.pin}
                  </button>
                  <button
                    onClick={() => handleCopyWameethPin(a.id, ws.pin!)}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold border border-secondary/50 text-secondary hover:bg-secondary/10 transition-colors"
                  >
                    {ws.copied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {ws?.error && (
                  <p className="text-xs text-destructive text-center">
                    {ws.error}
                  </p>
                )}
              </div>
            )}
          </Card>
        </motion.div>
      );
    };

    return (
      <Layout>
        <AnimatePresence>
          {showQuickChallenge && (
            <QuickChallengeModal onClose={() => setShowQuickChallenge(false)} />
          )}
          {showWameethQuickStart && (
            <WameethQuickStartModal
              assignments={ownAssignments}
              onClose={() => setShowWameethQuickStart(false)}
            />
          )}
        </AnimatePresence>

        <div className="min-h-screen bg-background overflow-x-hidden" dir={dir}>
          <div className="border-b border-border/40 bg-gradient-to-b from-primary/[0.04] to-transparent">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8 sm:py-10">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">
                    {lang === "ar" ? "مرحباً بعودتك" : "Welcome back"}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground break-words">
                    {teacher.name ? (
                      <>
                        <span className="text-muted-foreground">
                          {lang === "ar" ? "أستاذ " : ""}
                        </span>
                        <span className="text-primary">{teacher.name}</span>
                      </>
                    ) : (
                      <span className="text-primary">
                        {lang === "ar" ? "لوحة المعلم" : "Teacher Dashboard"}
                      </span>
                    )}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lang === "ar"
                      ? "اختر واجباً وابدأ مسابقة فورية أو جرّب العب بمفردك أو مع فريق"
                      : "Pick an assignment and start an instant quiz, or try playing solo or with a team"}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setShowWameethQuickStart(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-sm shadow-sm hover:-translate-y-0.5 transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    {lang === "ar" ? "لعبة مباشرة" : "Live Game"}
                  </button>
                  <Link
                    href="/teacher/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-sm hover:-translate-y-0.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {lang === "ar" ? "أنشئ مسابقتك" : "Create Quiz"}
                  </Link>
                  <Link
                    href="/teacher"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-500 text-white font-bold text-sm shadow-md shadow-amber-500/30 hover:-translate-y-0.5 transition-all border border-amber-300/60"
                  >
                    <Trophy className="w-4 h-4" />
                    {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
                  </Link>
                  <InstallAppButton variant="compact" />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl px-4 py-3 mb-7 shadow-sm"
            >
              <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {t.home.pinSectionTitle}
              </span>
              <div className="flex gap-2 items-center flex-1 min-w-0" dir="ltr">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onKeyDown={(e) => {
                    const allowed = [
                      "Backspace",
                      "Delete",
                      "ArrowLeft",
                      "ArrowRight",
                      "Tab",
                      "Enter",
                    ];
                    if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, 6);
                    setPin(text);
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPin(val);
                  }}
                  maxLength={6}
                  placeholder="000000"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-center font-bold tracking-[0.3em] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] transition-colors"
                />

                <button
                  onClick={handlePinJoin}
                  disabled={!pin.trim()}
                  className="shrink-0 px-4 py-2 sm:py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold rounded-lg text-sm transition-all"
                >
                  {t.home.pinJoinBtn}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex gap-1 bg-muted/60 rounded-xl p-1 mb-6 w-full sm:w-fit max-w-full overflow-x-auto scrollbar-hide"
            >
              {[
                {
                  id: "shared" as const,
                  label:
                    lang === "ar"
                      ? "مشتركة"
                      : "Shared",
                  fullLabel:
                    lang === "ar"
                      ? "مسابقات وواجبات مشتركة"
                      : "Shared Quizzes & Assignments",
                  icon: Globe,
                  count: assignments.length,
                },
                {
                  id: "mine" as const,
                  label: lang === "ar" ? "واجباتي" : "Mine",
                  fullLabel: lang === "ar" ? "واجباتي" : "My Assignments",
                  icon: BookOpen,
                  count: ownAssignments.length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTeacherTab(tab.id)}
                  className={`inline-flex items-center justify-center gap-2 flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    teacherTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="sm:hidden">{tab.label}</span>
                  <span className="hidden sm:inline">{tab.fullLabel}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        teacherTab === tab.id
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </motion.div>

            {activeLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-52 rounded-xl border border-border/40 bg-card animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            ) : activeList.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 flex flex-col items-center gap-4"
              >
                <div className="p-5 rounded-2xl bg-muted/50">
                  <FileText className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-bold text-foreground mb-1">
                    {teacherTab === "mine"
                      ? lang === "ar"
                        ? "لا توجد واجبات بعد"
                        : "No assignments yet"
                      : lang === "ar"
                        ? "لا توجد مسابقات مشتركة بعد"
                        : "No shared quizzes yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {teacherTab === "mine"
                      ? lang === "ar"
                        ? "أنشئ أول مسابقة وابدأ مع طلابك"
                        : "Create your first quiz and start with your students"
                      : lang === "ar"
                        ? "كن أول من يشارك مسابقة مع المجتمع"
                        : "Be the first to share a quiz with the community"}
                  </p>
                </div>
                <Link
                  href="/teacher/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-sm transition-all hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  {lang === "ar"
                    ? "أنشئ مسابقتك الأولى"
                    : "Create Your First Quiz"}
                </Link>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeList.map((a) => (
                  <AssignmentCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  const allGameCards = [
    {
      href: "/game/secret",
      icon: Eye,
      title: lang === "ar" ? "اكتشف السر" : "Discover the Secret",
      desc:
        lang === "ar"
          ? "فريقان يمسحان باركوداً سرياً ويتبادلان أسئلة نعم/لا حتى يكتشفا سر الخصم"
          : "Two teams scan secret QR codes and ask yes/no questions to discover each other's secret",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
      visible:
        Boolean(teacherData?.isAdmin) ||
        teacherData?.role === "admin" ||
        Boolean(platformSettings.showSecretGame),
    },
    {
      href: "/game/flags",
      icon: Globe,
      title: lang === "ar" ? "لعبة أعلام الدول" : "World Flags Game",
      desc:
        lang === "ar"
          ? "اختبر معلوماتك في أعلام دول العالم"
          : "Test your knowledge of world flags",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      visible: showFlagsGame,
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: lang === "ar" ? "لعبة عواصم العالم" : "World Capitals Game",
      desc:
        lang === "ar"
          ? "اختبر معلوماتك في عواصم دول العالم"
          : "Test your knowledge of world capitals",
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
      visible: showCapitalsGame,
    },
    {
      href: "/game/color",
      icon: Sparkles,
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc:
        lang === "ar"
          ? "هل عينك حادة؟ ابحث عن المربع المختلف"
          : "Find the odd square in the grid",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
      visible: showColorGame,
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      desc:
        lang === "ar"
          ? "اقلب البطاقات وابحث عن الأزواج المتطابقة"
          : "Flip cards and find matching pairs",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
      visible: showMemoryGame,
    },
    {
      href: "/game/multiply",
      icon: Calculator,
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      desc:
        lang === "ar"
          ? "اختبر سرعتك في جدول الضرب مع مضاعفات السلسلة"
          : "Test your multiplication speed with streak bonuses",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
      visible: showMultiplyGame,
    },
    {
      href: "/game/scramble",
      icon: Shuffle,
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      desc:
        lang === "ar"
          ? "رتّب الحروف المبعثرة لتكوّن الكلمة الصحيحة"
          : "Unscramble letters to form the correct word",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
      visible: showScrambleGame,
    },
    {
      href: "/game/tug/create",
      icon: Zap,
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc:
        lang === "ar"
          ? "تحدَّ خصمك في لعبة شد الحبل التعليمية"
          : "Challenge your opponent in an educational tug of war",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600",
      visible: showTugGame,
    },
    {
      href: "/game/stroop",
      icon: Brain,
      title: lang === "ar" ? "لعبة ارتباك" : "Stroop Game",
      desc:
        lang === "ar"
          ? "اضغط على لون الحبر وليس معنى الكلمة — تحدٍّ لعقلك!"
          : "Click the ink color, not the word — challenge your brain!",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
      visible: true,
    },
    {
      href: "/game/maraqui",
      icon: Landmark,
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc:
        lang === "ar"
          ? " المسابقة الأكثر حماسا وثقافة عبر مراحلها، تعرف على الصحابة    —    "
          : "Progress through stages and master the content — graded MCQ questions",
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
      visible:
        Boolean(teacherData?.isAdmin) ||
        teacherData?.role === "admin" ||
        Boolean(platformSettings.showMaraqui),
    },
    {
      href: "/game/million",
      icon: Trophy,
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc:
        lang === "ar"
          ? "15 سؤالاً تتصاعد صعوبةً حتى المليون — مع أربع وسائل مساعدة   "
          : "15 escalating questions toward a million — with 3 lifelines to help you",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      visible: true,
    },
  ];

  const gameCards = allGameCards.filter((g) => g.visible);

  const heroQuizChoices: { badge: string; label: string; correct?: boolean }[] =
    lang === "ar"
      ? [
          { badge: "أ", label: "التكاثف", correct: true },
          { badge: "ب", label: "التبخر" },
          { badge: "ج", label: "الهطول" },
          { badge: "د", label: "الجريان السطحي" },
        ]
      : [
          { badge: "A", label: "Condensation", correct: true },
          { badge: "B", label: "Evaporation" },
          { badge: "C", label: "Precipitation" },
          { badge: "D", label: "Runoff" },
        ];
  const heroFeatures = lang === "ar" ? [
    {
      title: "مسابقات مباشرة",
      desc: "سؤال، وقت، ترتيب، وتفاعل لحظي داخل الصف.",
      Icon: Trophy,
      tone: "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]",
    },
    {
      title: "واجبات واختبارات",
      desc: "إنشاء أسرع ومتابعة أوضح من واجهة واحدة.",
      Icon: ClipboardList,
      tone: "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]",
    },
    {
      title: "كود  من 6 أرقام",
      desc: "واضح وسريع ليستخدمه الطالب دائمًا دون تعقيد.",
      Icon: Users,
      tone: "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]",
    },
  ] : [
    {
      title: "Live quizzes",
      desc: "Questions, timing, rankings, and instant participation.",
      Icon: Trophy,
      tone: "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]",
    },
    {
      title: "Assignments and tests",
      desc: "Create faster and follow progress from one place.",
      Icon: ClipboardList,
      tone: "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]",
    },
    {
      title: "Six-digit join code",
      desc: "A simple, familiar way for students to enter.",
      Icon: Users,
      tone: "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]",
    },
  ];
  const tools = lang === "ar" ? [
    {
      title: "المسابقات التفاعلية",
      desc: "أسئلة حية، مؤقت، ولوحة نتائج تبقي الصف متحمسًا.",
      Icon: Trophy,
      href: "/teacher/new",
    },
    {
      title: "الأنشطة التعليمية",
      desc: "أنشطة قصيرة أو ممتدة تخدم الدرس اليومي بسهولة.",
      Icon: Sparkles,
      href: "/teacher/new",
    },
    {
      title: "الواجبات المنظمة",
      desc: "إنشاء وتسليم ومتابعة داخل تجربة أوضح للمعلم.",
      Icon: FileText,
      href: "/teacher/new/assignment",
    },
    {
      title: "الاختبارات السريعة",
      desc: "نتائج أسرع وقياس فوري للفهم والمشاركة.",
      Icon: ClipboardList,
      href: "/teacher/new",
    },
    {
      title: "الفيديو التفاعلي",
      desc: "اعرض الفيديو ثم أظهر سؤالًا مباشرًا كما يراه الطالب.",
      Icon: Camera,
      href: "/teacher/video-lesson/new",
    },
    {
      title: "مساعد الذكاء الاصطناعي",
      desc: "ولّد أسئلتك تلقائيًا من الدرس بثوانٍ وحسّن صياغتك.",
      Icon: Brain,
      href: "/teacher/new",
    },
  ] : [
    { title: "Interactive quizzes", desc: "Live questions, timers, and results that keep every class engaged.", Icon: Trophy, href: "/teacher/new" },
    { title: "Learning activities", desc: "Short or extended activities that support everyday teaching.", Icon: Sparkles, href: "/teacher/new" },
    { title: "Organized assignments", desc: "Create, assign, and follow up from a clearer teacher experience.", Icon: FileText, href: "/teacher/new/assignment" },
    { title: "Quick tests", desc: "Faster results and an immediate view of understanding and participation.", Icon: ClipboardList, href: "/teacher/new" },
    { title: "Interactive video", desc: "Show a video and place a direct question at the exact learning moment.", Icon: Camera, href: "/teacher/video-lesson/new" },
    { title: "AI assistant", desc: "Generate questions from your lesson in seconds and refine your wording.", Icon: Brain, href: "/teacher/new" },
  ];
  const videoChoices = lang === "ar" ? [
    { badge: "A", label: "عندما ترتفع حرارة الشمس" },
    { badge: "B", label: "عندما يهبط المطر إلى الأرض" },
    { badge: "C", label: "عندما يتجمّع الماء في السحب" },
    { badge: "D", label: "عندما يتسرب الماء إلى التربة" },
  ] : [
    { badge: "A", label: "When heat from the sun rises" },
    { badge: "B", label: "When rain falls to the ground" },
    { badge: "C", label: "When water gathers in clouds" },
    { badge: "D", label: "When water seeps into the soil" },
  ];
  const flowSteps = [
    {
      title: lang === "ar" ? "١. أنشئ" : "1. Create",
      desc: lang === "ar"
        ? "حوّل فكرة الدرس إلى نشاط أو واجب أو عرض جاهز للتخصيص."
        : "Turn a lesson idea into an activity, assignment, or deck you can customize.",
    },
    {
      title: lang === "ar" ? "٢. اعرض" : "2. Present",
      desc: lang === "ar"
        ? "اعرض المحتوى بطريقة تفاعلية، ثم شاركه برابط واحد."
        : "Present the content interactively, then share it with one link.",
    },
    {
      title: lang === "ar" ? "٣. تفاعل" : "3. Engage",
      desc: lang === "ar"
        ? "تابع المشاركة والنتائج والتسليمات من لوحة واضحة."
        : "Follow participation, results, and submissions from one clear dashboard.",
    },
  ];
  return (
    <Layout>
      <AnimatePresence>
        {showGuestGate && (
          <GuestGateModal onClose={() => setShowGuestGate(false)} />
        )}
        {showQuickChallenge && (
          <QuickChallengeModal onClose={() => setShowQuickChallenge(false)} />
        )}
      </AnimatePresence>

      <main
        className="flex flex-col overflow-hidden bg-background font-display"
        dir={dir}
        style={{ display: "flex", flexDirection: "column" }}
      >
        {/* -------------- NEW LANDING DESIGN -------------- */}
        <div
          dir={dir}
          className="landing-grid-bg order-1"
          style={{
            order: 1,
            paddingBottom: "clamp(24px,4vh,48px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle floating educational decorations (decorative, behind content) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
              overflow: "hidden",
            }}
          >
            {[
              {
                Icon: Brain,
                top: "8%",
                left: "6%",
                size: 56,
                color: "#1b6b3f",
                dur: 9,
                delay: 0,
              },
              {
                Icon: Lightbulb,
                top: "14%",
                left: "88%",
                size: 44,
                color: "#d7a51d",
                dur: 8,
                delay: 1,
              },
              {
                Icon: Puzzle,
                top: "44%",
                left: "4%",
                size: 50,
                color: "#1b6b3f",
                dur: 11,
                delay: 0.5,
              },
              {
                Icon: BookOpen,
                top: "58%",
                left: "92%",
                size: 48,
                color: "#1b6b3f",
                dur: 10,
                delay: 1.5,
              },
              {
                Icon: Trophy,
                top: "78%",
                left: "10%",
                size: 46,
                color: "#d7a51d",
                dur: 9,
                delay: 0.8,
              },
              {
                Icon: Sparkles,
                top: "82%",
                left: "85%",
                size: 42,
                color: "#d7a51d",
                dur: 8,
                delay: 0.3,
              },
              {
                Icon: Calculator,
                top: "30%",
                left: "94%",
                size: 38,
                color: "#1b6b3f",
                dur: 12,
                delay: 1.2,
              },
              {
                Icon: Gamepad2,
                top: "68%",
                left: "50%",
                size: 36,
                color: "#b88712",
                dur: 10,
                delay: 0.6,
              },
            ].slice(0, 3).map((d, i) => (
              /* Perf fix: dropped the infinite y-axis animation. Eight
                 background icons re-painting at 60 fps were combining
                 with the header's backdrop-blur to choke mouse moves
                 over the hero. Decorations now fade in once and stay
                 still — visually identical at rest. */
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.055 }}
                transition={{ duration: 1.2, delay: d.delay }}
                style={{
                  position: "absolute",
                  top: d.top,
                  left: d.left,
                  color: d.color,
                  transform: "translate(-50%,-50%)",
                  display: "none",
                }}
                className="md:!block"
              >
                <d.Icon
                  strokeWidth={1.4}
                  style={{ width: d.size, height: d.size }}
                />
              </motion.div>
            ))}
          </div>

          {/* Foreground content wrapper (sits above decorations) */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <motion.section
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              style={{
                position: "relative",
                maxWidth: "1320px",
                margin: "clamp(12px,2vh,24px) auto clamp(24px,2vw,32px)",
                padding: "16px 20px 0",
              }}
              className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-10"
            >
              <div className="text-center lg:text-start">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "2px solid #d3e5d6",
                  color: "#1f6c42",
                  padding: "clamp(6px,1vw,10px) clamp(14px,2vw,22px)",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.75)",
                  fontWeight: 700,
                  fontSize: "clamp(12px,1.5vw,17px)",
                  marginBottom: "clamp(14px,2vh,24px)",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#35b55d",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                {lang === "ar"
                  ? "منصة عربية متكاملة للمعلم"
                  : "An all-in-one platform for teachers"}
              </motion.div>

              {/* H1 */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.18 }}
                style={{
                  fontSize: "clamp(28px,5.5vw,64px)",
                  lineHeight: 1.25,
                  margin: "0 0 clamp(12px,2vh,18px)",
                  color: "#103d2a",
                  fontWeight: 900,
                  maxWidth: "820px",
                }}
              >
                {lang === "ar" ? "من فكرة الدرس إلى" : "From lesson idea to"}
                <br />
                <span
                  style={{
                    color: "#d7a51d",
                    position: "relative",
                    display: "inline-block",
                  }}
                >
                  {lang === "ar"
                    ? "تجربة تعليمية كاملة"
                    : "a complete learning experience"}
                  <span
                    style={{
                      position: "absolute",
                      right: 0,
                      left: 0,
                      bottom: "-6px",
                      height: "6px",
                      background: "rgba(215,165,29,0.75)",
                      borderRadius: "999px",
                    }}
                  />
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.28 }}
                style={{
                  fontSize: "clamp(13px,1.8vw,20px)",
                  color: "#1b6b3f",
                  margin: "0 auto clamp(16px,3vh,24px)",
                  fontWeight: 600,
                  maxWidth: "640px",
                  lineHeight: 1.7,
                }}
              >
                {lang === "ar"
                  ? "خطط، أنشئ، اعرض وتفاعل — من مكان واحد."
                  : "Plan, create, present, and engage — all in one place."}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.34 }}
                className="mx-auto max-w-xl text-sm leading-7 text-[#275c43] sm:text-[0.96rem]"
              >
                {lang === "ar"
                  ? "أدوات عربية تساعد المعلم على إعداد درسه وصناعة المحتوى والأنشطة والتفاعل مع المشاركين."
                  : "Practical tools that help teachers prepare lessons, create content and activities, and engage every participant."}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.42 }}
                className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
              >
                <Link
                  href="/register?role=teacher"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b4b35] px-6 py-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(11,75,53,0.24)] transition hover:-translate-y-0.5 hover:bg-[#083d2b]"
                >
                  <GraduationCap className="h-4 w-4" />
                  {lang === "ar" ? "ابدأ مجاناً كمعلم" : "Start free as a teacher"}
                  <ArrowLeft
                    className={`h-4 w-4 ${lang === "ar" ? "" : "rotate-180"}`}
                  />
                </Link>
                <a
                  href="#tools"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#0b4b35]/20 bg-white/70 px-6 py-3 text-sm font-bold text-[#0b4b35] transition hover:border-[#0b4b35]/40 hover:bg-white"
                >
                  {lang === "ar" ? "شاهد كيف تعمل الأدوات" : "See how the tools work"}
                  <ArrowLeft
                    className={`h-4 w-4 ${lang === "ar" ? "" : "rotate-180"}`}
                  />
                </a>
              </motion.div>
              </div>

              <div className="relative mx-auto hidden w-full max-w-[650px] lg:block">
                <div className="overflow-hidden rounded-[28px] border border-[hsl(145,30%,84%)] bg-white shadow-[0_28px_64px_rgba(43,83,59,0.16)]">
                  <div className="flex items-center justify-between border-b border-[hsl(145,30%,90%)] bg-[#f7faf7] px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-black text-[#1b6b3f]">
                      <Presentation className="h-4 w-4" />
                      {lang === "ar" ? "عرض تفاعلي" : "Interactive presentation"}
                    </div>
                    <span className="rounded-lg bg-[#0b4b35] px-2.5 py-1 text-[10px] font-bold text-white">
                      {lang === "ar" ? "مشاركة" : "Share"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[74px_1fr] bg-[#f5f7f4]">
                    <div className="space-y-2 border-e border-[hsl(145,30%,88%)] p-2.5">
                      {[1, 2, 3, 4].map((slide) => (
                        <div
                          key={slide}
                          className={`flex h-11 items-center justify-center rounded-lg text-[10px] font-black ${
                            slide === 1
                              ? "bg-[#0b4b35] text-white"
                              : "border border-[hsl(145,30%,84%)] bg-white text-[#6b8877]"
                          }`}
                        >
                          {slide}
                        </div>
                      ))}
                    </div>
                    <div className="p-4">
                      <div className="rounded-2xl bg-[#0b4b35] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                        <p className="text-[10px] font-bold text-[#e6c585]">
                          {lang === "ar" ? "علوم · الصف الرابع" : "Science · Grade 4"}
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-white">
                          {lang === "ar" ? "دورة الماء" : "The water cycle"}
                        </h2>
                        <p className="mt-2 text-xs text-white/70">
                          {lang === "ar"
                            ? "التبخر · التكاثف · الهطول"
                            : "Evaporation · Condensation · Precipitation"}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {heroQuizChoices.map((choice) => (
                          <div
                            key={choice.badge}
                            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-bold ${
                              choice.correct
                                ? "border-[#63ba82] bg-[#ebf8ed] text-[#0b4b35]"
                                : "border-[hsl(145,25%,86%)] bg-white text-[#486655]"
                            }`}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] shadow-sm">
                              {choice.badge}
                            </span>
                            {choice.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-px border-t border-[hsl(145,30%,88%)] bg-[hsl(145,30%,88%)]">
                    {heroFeatures.map((feature) => (
                      <div key={feature.title} className="bg-white px-3 py-3 text-center">
                        <feature.Icon className={`mx-auto h-4 w-4 ${feature.tone.split(" ")[1]}`} />
                        <p className="mt-1 text-[10px] font-black text-[#1b4b35]">{feature.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ===== JOIN CARD ===== */}
            <motion.section
              id="join"
              className="scroll-mt-24"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
              style={{
                maxWidth: "1200px",
                margin: "0 auto clamp(16px,2.5vh,24px)",
                padding: "0 clamp(12px,3vw,20px)",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: "clamp(22px,4vw,36px)",
                  padding:
                    "clamp(16px,2vw,24px) clamp(18px,4vw,36px) clamp(14px,1.8vw,20px)",
                  boxShadow: "0 18px 50px rgba(22,73,47,0.12)",
                  border: "1px solid rgba(27,107,63,0.08)",
                  position: "relative",
                }}
              >
                {/* Small QR icon button (top corner) */}
                <button
                  onClick={() => setJoinTab(joinTab === "pin" ? "qr" : "pin")}
                  aria-label={
                    joinTab === "pin"
                      ? lang === "ar"
                        ? "امسح رمز QR"
                        : "Scan a QR code"
                      : lang === "ar"
                        ? "أدخل الرمز يدوياً"
                        : "Enter a code manually"
                  }
                  title={
                    joinTab === "pin"
                      ? lang === "ar"
                        ? "امسح رمز QR"
                        : "Scan a QR code"
                      : lang === "ar"
                        ? "أدخل الرمز يدوياً"
                        : "Enter a code manually"
                  }
                  style={{
                    position: "absolute",
                    top: "clamp(14px,2vw,20px)",
                    insetInlineStart: "clamp(14px,2vw,20px)",
                    width: "clamp(36px,5vw,42px)",
                    height: "clamp(36px,5vw,42px)",
                    borderRadius: "12px",
                    border: "1.5px solid rgba(27,107,63,0.18)",
                    background: joinTab === "qr" ? "#1b6b3f" : "#f6fbf3",
                    color: joinTab === "qr" ? "#fff" : "#1b6b3f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.18s ease",
                  }}
                >
                  <Camera className="w-5 h-5" strokeWidth={2} />
                </button>

                {joinTab === "pin" ? (
                  <div className="lg:grid lg:grid-cols-[minmax(230px,0.7fr)_minmax(420px,1.3fr)] lg:items-center lg:gap-8">
                    <div className="lg:pe-6">
                    <h2
                      style={{
                        textAlign: "center",
                        fontSize: "clamp(20px,3vw,32px)",
                        margin: "0",
                        color: "#16492f",
                        fontWeight: 900,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {lang === "ar"
                        ? "لديك رمز لعبة أو مسابقة؟"
                        : "Have a game or quiz code?"}
                    </h2>
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: "clamp(12px,1.5vw,15px)",
                        color: "#1b6b3f",
                        margin: "8px 0 clamp(10px,1.5vw,12px)",
                        fontWeight: 600,
                      }}
                    >
                      {lang === "ar"
                        ? "أدخل الرمز وانضم إلى التحدي الآن."
                        : "Enter the code and join the challenge now."}
                    </p>

                    </div>
                    <div>
                    {/* 6 individual digit boxes — bigger, more prominent */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "clamp(6px,1.6vw,14px)",
                        marginBottom: "clamp(10px,1.5vw,12px)",
                        direction: "ltr",
                      }}
                    >
                      {slots.map((slotVal, i) => (
                        <input
                          key={i}
                          ref={digitRefs[i]}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={slotVal}
                          style={{
                            width: "clamp(44px,10vw,72px)",
                            height: "clamp(54px,12.5vw,84px)",
                            borderRadius: "clamp(12px,2vw,18px)",
                            border: `2.5px solid ${slotVal ? "#b88712" : "#e9c870"}`,
                            background: slotVal ? "#fff5d4" : "#fffaeb",
                            textAlign: "center",
                            fontSize: "clamp(22px,4.5vw,38px)",
                            fontWeight: 900,
                            color: "#17442f",
                            outline: "none",
                            caretColor: "#b88712",
                            transition:
                              "border-color 0.15s, box-shadow 0.15s, background 0.15s",
                            boxShadow: slotVal
                              ? "0 6px 18px rgba(184,135,18,0.28)"
                              : "0 3px 10px rgba(215,165,29,0.14)",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#b88712";
                            e.target.style.boxShadow =
                              "0 0 0 4px rgba(215,165,29,0.22)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = slotVal
                              ? "#b88712"
                              : "#e9c870";
                            e.target.style.boxShadow = slotVal
                              ? "0 6px 18px rgba(184,135,18,0.28)"
                              : "0 3px 10px rgba(215,165,29,0.14)";
                          }}
                          onChange={(e) => {
                            const val = e.target.value.slice(-1).replace(/\D/g, "");
                            const next = [...slots];
                            next[i] = val;
                            setSlots(next);
                            setPin(next.join("").trimEnd());
                            if (val && i < 5) {
                              setTimeout(
                                () => digitRefs[i + 1].current?.focus(),
                                0,
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!/^[0-9]$/.test(e.key) && !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                            }
                            if (e.key === "Backspace") {
                              if (slotVal) {
                                const next = [...slots];
                                next[i] = "";
                                setSlots(next);
                                setPin(next.join("").trimEnd());
                              } else if (i > 0) {
                                digitRefs[i - 1].current?.focus();
                              }
                            }
                            if (e.key === "Enter" && pin.trim().length >= 1)
                              handlePinJoin();
                          }}
                          onPaste={(e) => {
                            const raw = e.clipboardData.getData("text").trim();
                            const millionMatch = raw.match(
                              /\/game\/million\/join\/([a-zA-Z0-9]+)/,
                            );
                            const urlMatch = raw.match(
                              /\/game\/(?:join|[a-z]+\/join)\/([a-zA-Z0-9]+)/,
                            );
                            const code =
                              millionMatch?.[1] ?? urlMatch?.[1] ?? raw;
                            const chars = code.slice(0, 6).split("");
                            const next: string[] = ["", "", "", "", "", ""];
                            chars.forEach((c, idx) => {
                              next[idx] = c;
                            });
                            setSlots(next);
                            setPin(next.join("").trimEnd());
                            const focusIdx = Math.min(chars.length - 1, 5);
                            setTimeout(
                              () => digitRefs[focusIdx]?.current?.focus(),
                              0,
                            );
                            e.preventDefault();
                          }}
                        />
                      ))}
                    </div>

                    {/* Join Now button */}
                    <button
                      onClick={handlePinJoin}
                      disabled={!pin.trim()}
                      style={{
                        width: "min(100%, 510px)",
                        border: "none",
                        borderRadius: "clamp(14px,2.5vw,22px)",
                        padding: "clamp(13px,2.5vw,19px)",
                        fontSize: "clamp(14px,2vw,20px)",
                        fontWeight: 900,
                        cursor: pin.trim() ? "pointer" : "default",
                        background: pin.trim()
                          ? "linear-gradient(180deg, #f7c93a, #e0a91a)"
                          : "linear-gradient(180deg, #d4a827, #b8900f)",
                        color: "#143b28",
                        opacity: pin.trim() ? 1 : 0.72,
                        boxShadow: pin.trim()
                          ? "0 10px 28px rgba(215,165,29,0.42)"
                          : "0 4px 12px rgba(184,144,15,0.22)",
                        transition: "opacity 0.2s ease, box-shadow 0.2s ease",
                        direction: dir,
                        margin: "0 auto clamp(6px,1vw,8px)",
                      }}
                    >
                      {lang === "ar" ? "← انضمام الآن" : "Join now →"}
                    </button>
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: "clamp(11px,1.3vw,13.5px)",
                        color: "#1b6b3f",
                        margin: "clamp(6px,1vw,8px) 0 0",
                        fontWeight: 600,
                      }}
                    >
                      {lang === "ar"
                        ? "ليس لديك كود؟ استكشف الفعاليات أو تواصل مع المعلم"
                        : "No code? Explore activities or contact your teacher."}
                    </p>
                    </div>
                  </div>
                ) : (
                  /* QR Scanner View */
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "clamp(10px,2vw,16px)",
                      padding: "clamp(8px,2vw,12px) 0 clamp(14px,2.5vw,20px)",
                    }}
                  >
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: "clamp(12px,1.5vw,15px)",
                        color: "#1b6b3f",
                        margin: 0,
                        lineHeight: 1.5,
                        fontWeight: 500,
                      }}
                    >
                      {lang === "ar"
                        ? "وجّه الكاميرا نحو كود QR الذي يعرضه المعلم للانضمام فوراً"
                        : "Point your camera at the QR code shown by your teacher to join instantly."}
                    </p>

                    {/* Video + canvas scanner area */}
                    <div
                      style={{
                        position: "relative",
                        width: "clamp(200px,55vw,280px)",
                        height: "clamp(200px,55vw,280px)",
                        borderRadius: "clamp(16px,3vw,22px)",
                        overflow: "hidden",
                        background: "#0d2416",
                        border: `3px solid ${scannerSuccess ? "#35b55d" : "#16492f"}`,
                        boxShadow: `0 8px 24px rgba(22,73,47,0.18)`,
                        transition: "border-color 0.3s",
                      }}
                    >
                      <video
                        ref={videoRef}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: scannerActive ? "block" : "none",
                        }}
                        playsInline
                        muted
                      />
                      <canvas ref={canvasRef} style={{ display: "none" }} />

                      {/* Overlay when not active */}
                      {!scannerActive && !scannerSuccess && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            color: "#fff",
                            textAlign: "center",
                            padding: "16px",
                          }}
                        >
                          <span style={{ fontSize: "48px", lineHeight: 1 }}>
                            📷
                          </span>
                          <span
                            style={{
                              fontSize: "clamp(13px,1.6vw,15px)",
                              fontWeight: 600,
                              opacity: 0.9,
                            }}
                          >
                            {lang === "ar"
                              ? "اضغط لتشغيل الكاميرا"
                              : "Tap to start the camera"}
                          </span>
                        </div>
                      )}

                      {/* Success overlay */}
                      {scannerSuccess && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            background: "rgba(53,181,93,0.92)",
                            color: "#fff",
                            fontWeight: 900,
                            fontSize: "clamp(14px,2vw,18px)",
                            textAlign: "center",
                          }}
                        >
                          <span style={{ fontSize: "52px", lineHeight: 1 }}>
                            ✅
                          </span>
                          {lang === "ar" ? "تم! جارٍ الانضمام…" : "Done! Joining…"}
                        </div>
                      )}

                      {/* Scanner corner guides */}
                      {scannerActive && !scannerSuccess && (
                        <>
                          {[
                            {
                              top: 12,
                              left: 12,
                              borderTop: "3px solid #f2bc2d",
                              borderLeft: "3px solid #f2bc2d",
                            },
                            {
                              top: 12,
                              right: 12,
                              borderTop: "3px solid #f2bc2d",
                              borderRight: "3px solid #f2bc2d",
                            },
                            {
                              bottom: 12,
                              left: 12,
                              borderBottom: "3px solid #f2bc2d",
                              borderLeft: "3px solid #f2bc2d",
                            },
                            {
                              bottom: 12,
                              right: 12,
                              borderBottom: "3px solid #f2bc2d",
                              borderRight: "3px solid #f2bc2d",
                            },
                          ].map((style, i) => (
                            <div
                              key={i}
                              style={{
                                position: "absolute",
                                width: "24px",
                                height: "24px",
                                borderRadius: "3px",
                                ...style,
                              }}
                            />
                          ))}
                        </>
                      )}
                    </div>

                    {/* Error message */}
                    {scannerError && (
                      <p
                        style={{
                          textAlign: "center",
                          fontSize: "clamp(11px,1.4vw,13px)",
                          color: "#dc2626",
                          margin: 0,
                          maxWidth: "280px",
                        }}
                      >
                        {scannerError}
                      </p>
                    )}

                    {/* Start / Stop button */}
                    {!scannerSuccess && (
                      <button
                        onClick={scannerActive ? stopScanner : startScanner}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          padding: "clamp(10px,2vw,14px) clamp(20px,4vw,32px)",
                          fontSize: "clamp(13px,1.6vw,16px)",
                          fontWeight: 900,
                          cursor: "pointer",
                          background: scannerActive
                            ? "linear-gradient(180deg,#ef4444,#dc2626)"
                            : "linear-gradient(180deg,#f2bc2d,#d7a51d)",
                          color: scannerActive ? "#fff" : "#143b28",
                          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                          transition: "0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {scannerActive ? (
                          <>
                            <span>⏹</span>{" "}
                            {lang === "ar" ? "إيقاف الكاميرا" : "Stop camera"}
                          </>
                        ) : (
                          <>
                            <span>📷</span>{" "}
                            {lang === "ar" ? "تشغيل الكاميرا" : "Start camera"}
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        stopScanner();
                        setJoinTab("pin");
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#d7a51d",
                        fontWeight: 700,
                        fontSize: "clamp(12px,1.5vw,14px)",
                        cursor: "pointer",
                        padding: "4px 8px",
                      }}
                    >
                      {lang === "ar"
                        ? "أو أدخل الرمز يدوياً ←"
                        : "Or enter the code manually →"}
                    </button>
                  </div>
                )}
              </div>
            </motion.section>

            {/* ===== DISCOVER MORE ===== */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              dir={dir}
              style={{
                textAlign: "center",
                fontSize: "clamp(12px,1.5vw,16px)",
                color: "#1b6b3f",
                fontWeight: 600,
                margin: "clamp(8px,1.5vh,14px) 0 clamp(16px,3vh,28px)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
              onClick={() =>
                document
                  .getElementById("tools")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {lang === "ar" ? "اكتشف المزيد" : "Discover more"}
              <ChevronDown
                style={{
                  width: "1.1em",
                  height: "1.1em",
                  display: "inline-block",
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* -------------- AI INTERACTIVE PRESENTATIONS PROMO -------------- */}
        <section
          className="order-5 border-t border-border/60 bg-[#fbfcf8] py-12 sm:py-16"
          dir={dir}
          style={{ order: 5 }}
        >
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* ── Copy column ── */}
              <motion.div
                initial={{ opacity: 0, x: dir === "rtl" ? 24 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {/* Label — matches other sections */}
                <p className="text-sm font-black text-[hsl(145,55%,32%)] mb-2">
                  {lang === "ar" ? "١. أنشئ" : "1. Create"}
                </p>

                <h2 className="font-display-display text-[1.95rem] sm:text-[2.45rem] font-black text-foreground leading-tight mb-4">
                  {lang === "ar" ? (
                    <>أنشئ عرضاً كاملاً <span className="text-[hsl(145,55%,28%)]">بكلمة واحدة</span></>
                  ) : (
                    <>Create a full deck <span className="text-[hsl(145,55%,28%)]">in seconds</span></>
                  )}
                </h2>

                <p className="text-[1rem] leading-8 text-muted-foreground mb-6">
                  {lang === "ar"
                    ? "اكتب موضوع الدرس، واحصل على عرض كامل خلال ثوانٍ — شرائح، أسئلة تفاعلية، ألعاب صفية، ونقاشات. صدّره PDF أو PowerPoint وشاركه برابط واحد."
                    : "Type a topic — get a full deck in seconds with slides, quizzes, classroom games, and discussions. Export to PDF or PowerPoint and share with one link."}
                </p>

                {/* Feature chips — matches the page's chip style */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {[
                    { ar: "شرائح ذكية",              en: "Smart slides",      tone: "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]" },
                    { ar: "ألعاب مدمجة",             en: "Built-in games",    tone: "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]" },
                    { ar: "أسئلة بالذكاء الاصطناعي", en: "AI questions",      tone: "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]" },
                    { ar: "تصدير PowerPoint",        en: "PowerPoint export", tone: "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]" },
                    { ar: "مشاركة عامة",             en: "Public sharing",    tone: "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]" },
                  ].map((f) => (
                    <span
                      key={f.en}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${f.tone}`}
                    >
                      {lang === "ar" ? f.ar : f.en}
                    </span>
                  ))}
                </div>

                {/* CTAs — green primary matches site buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => isLoggedIn ? setLocation("/teacher/presentations/new") : setLocation("/login?redirect=" + encodeURIComponent("/teacher/presentations/new"))}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(43,83,59,0.22)]"
                    style={{ background: "hsl(145,55%,28%)" }}
                  >
                    <span>✦</span>
                    {lang === "ar" ? "أنشئ عرضاً الآن" : "Create a presentation"}
                  </button>
                  <button
                    onClick={() => isLoggedIn ? setLocation("/teacher/presentations") : setLocation("/login?redirect=" + encodeURIComponent("/teacher/presentations"))}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold border border-border/70 bg-white text-foreground transition-all hover:bg-muted/60"
                  >
                    {lang === "ar" ? "تصفح عروضي" : "Browse my decks"}
                  </button>
                </div>
              </motion.div>

              {/* ── Visual column — editor mock in page style ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                className="relative"
              >
                {/* Editor shell — white card matching soft-card style */}
                <div
                  className="rounded-[26px] overflow-hidden"
                  style={{
                    background: "#ffffff",
                    border: "1px solid hsl(145,30%,88%)",
                    boxShadow: "0 28px 64px rgba(43,83,59,0.12), 0 2px 8px rgba(43,83,59,0.06)",
                  }}
                >
                  {/* App toolbar */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: "hsl(145,30%,92%)", background: "#f8faf8" }}
                  >
                    <div
                      className="flex-1 rounded-lg px-3 py-1 text-[10px] text-center font-medium"
                      style={{ background: "hsl(145,30%,93%)", color: "hsl(145,40%,35%)" }}
                    >
                      {lang === "ar" ? "دورة الماء في الطبيعة · حصاد" : "Water Cycle · Hasaad"}
                    </div>
                    <div
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                      style={{ background: "hsl(145,55%,28%)", color: "#fff" }}
                    >
                      {lang === "ar" ? "مشاركة" : "Share"}
                    </div>
                  </div>

                  {/* Editor body */}
                  <div className="flex" style={{ height: 270 }}>
                    {/* Slide thumbnails */}
                    <div
                      className="flex flex-col gap-1.5 p-2 overflow-hidden"
                      style={{ width: 76, background: "#f4f6f4", borderInlineEnd: "1px solid hsl(145,30%,90%)" }}
                    >
                      {[
                        { active: true,  bg: "#1E4D35" },
                        { active: false, bg: "#e8f0e8" },
                        { active: false, bg: "#e8f0e8" },
                        { active: false, bg: "#e8f0e8" },
                      ].map((s, i) => (
                        <div
                          key={i}
                          className="rounded-lg shrink-0 flex items-center justify-center text-[9px] font-bold"
                          style={{
                            height: 46,
                            background: s.bg,
                            border: s.active ? "2px solid hsl(145,55%,28%)" : "1.5px solid hsl(145,30%,85%)",
                            color: s.active ? "#fff" : "hsl(145,30%,60%)",
                          }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* Main slide — green brand */}
                    <div
                      className="flex-1 flex flex-col items-center justify-center p-5 relative"
                      style={{ background: "#1E4D35" }}
                    >
                      <div
                        className="absolute top-0 inset-x-0 h-0.5"
                        style={{ background: "linear-gradient(90deg,transparent,#c9a14b,transparent)" }}
                      />
                      <div className="text-center relative">
                        <div className="text-[9px] font-bold tracking-widest mb-2.5 uppercase" style={{ color: "rgba(201,161,75,0.8)" }}>
                          {lang === "ar" ? "علوم · الصف الرابع" : "Science · Grade 4"}
                        </div>
                        <h3 className="font-black mb-2.5 text-white" style={{ fontSize: "clamp(13px,2.5vw,20px)", lineHeight: 1.3 }}>
                          {lang === "ar" ? "دورة الماء في الطبيعة" : "The Water Cycle"}
                        </h3>
                        <div className="mx-auto mb-2.5" style={{ width: 36, height: 2, background: "#c9a14b", borderRadius: 2 }} />
                        <p className="text-[10px] sm:text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", maxWidth: 220 }}>
                          {lang === "ar" ? "التبخر · التكاثف · الهطول · الجريان" : "Evaporation · Condensation · Precipitation"}
                        </p>
                      </div>
                      <div className="absolute bottom-2 end-3 text-[9px] font-mono" style={{ color: "rgba(201,161,75,0.45)" }}>01/12</div>
                    </div>

                    {/* Content types panel */}
                    <div
                      className="hidden sm:flex flex-col gap-1.5 p-2.5"
                      style={{ width: 106, background: "#f4f6f4", borderInlineStart: "1px solid hsl(145,30%,90%)" }}
                    >
                      <div className="text-[9px] font-black text-[hsl(145,40%,40%)] uppercase tracking-wide mb-0.5">
                        {lang === "ar" ? "أضف محتوى" : "Add content"}
                      </div>
                      {[
                        { label: lang === "ar" ? "سؤال" : "Quiz",     bg: "bg-[hsl(220,75%,95%)]", color: "text-[hsl(220,55%,42%)]" },
                        { label: lang === "ar" ? "وميض" : "Flash",    bg: "bg-[hsl(145,55%,93%)]", color: "text-[hsl(145,55%,28%)]" },
                        { label: lang === "ar" ? "نقاش" : "Discuss",  bg: "bg-[hsl(43,90%,93%)]",  color: "text-[hsl(38,75%,38%)]" },
                        { label: lang === "ar" ? "فيديو" : "Video",   bg: "bg-[hsl(280,55%,95%)]", color: "text-[hsl(280,40%,42%)]" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-bold cursor-default ${item.bg} ${item.color}`}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div
                    className="flex items-center justify-between px-4 py-2 border-t"
                    style={{ borderColor: "hsl(145,30%,92%)", background: "#f8faf8" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {["B", "I", "≡", "⊞"].map((t) => (
                        <div
                          key={t}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border border-border/60 bg-white text-muted-foreground"
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black text-white"
                      style={{ background: "hsl(145,55%,28%)", boxShadow: "0 4px 12px rgba(43,83,59,0.25)" }}
                    >
                      ✦ {lang === "ar" ? "ولّد بالذكاء الاصطناعي" : "Generate with AI"}
                    </div>
                  </div>
                </div>

                {/* Floating badge — activity */}
                <div
                  className="absolute -bottom-4 -start-4 sm:-bottom-5 sm:-start-5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white border border-border/70"
                  style={{ boxShadow: "0 14px 32px rgba(43,83,59,0.12)" }}
                >
                  <div className="w-8 h-8 rounded-xl bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)] flex items-center justify-center text-sm font-black shrink-0">⚡</div>
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? "نشاط مُولَّد" : "AI Activity"}</div>
                    <div className="text-xs font-black text-foreground">{lang === "ar" ? "وميض · ٨ أسئلة" : "Flash · 8 Questions"}</div>
                  </div>
                </div>

                {/* Floating badge — export */}
                <div
                  className="absolute -top-4 -end-4 sm:-top-5 sm:-end-5 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-border/70"
                  style={{ boxShadow: "0 14px 32px rgba(43,83,59,0.12)" }}
                >
                  <div className="w-7 h-7 rounded-lg bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)] flex items-center justify-center text-sm shrink-0">📥</div>
                  <div className="text-[10px] font-black text-foreground">PowerPoint / PDF</div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* -------------- INTERACTIVE VIDEO (text-only — visual moved to hero) -------------- */}
        <section
          className="order-6 border-t border-border/60 bg-[#fbfcf8]"
          id="present-section"
          dir={dir}
          style={{ order: 6 }}
        >
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
              <div className="relative">
                <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#e6c585] via-[#d4ad5f] to-[#c89a47] p-5 shadow-[0_30px_70px_rgba(150,108,40,0.22)]">
                  {/* Video preview card */}
                  <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#c89a47] via-[#b8893a] to-[#a87a2e]">
                    <div className="flex items-center justify-between px-5 pt-4 text-white/95">
                      <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-bold">
                        00:42
                      </span>
                      <span className="text-[11px] font-bold opacity-90">
                        {lang === "ar" ? "رحلة الماء في الطبيعة" : "The water journey"}
                      </span>
                    </div>
                    <div className="relative px-5 pb-12 pt-3 text-right text-white">
                      <p className="text-[11px] font-bold opacity-90">
                        {lang === "ar" ? "فيديو تفاعلي" : "Interactive video"}
                      </p>
                      <h3 className="mt-1 font-display-display text-[1.7rem] font-black leading-tight drop-shadow">
                        {lang === "ar" ? "دورة الماء" : "The water cycle"}
                      </h3>
                      <p className="mt-2 text-[12px] font-medium opacity-90">
                        {lang === "ar"
                          ? "شاهد المقطع ثم أجب مباشرة كما يراه الطالب داخل حصاد."
                          : "Watch the clip, then answer right inside Hasad as your students do."}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={lang === "ar" ? "تشغيل" : "Play"}
                      className="group absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm transition hover:scale-105"
                    >
                      <span
                        className="absolute inset-0 animate-ping rounded-full bg-white/20"
                        style={{ animationDuration: "2.4s" }}
                      />
                      <Play className="relative h-8 w-8 translate-x-[2px] fill-white text-white drop-shadow" />
                    </button>
                    <div className="flex items-center justify-between px-5 pb-3 text-[11px] font-bold text-white/85">
                      <span>{lang === "ar" ? "المشهد 2 من 5" : "Scene 2 of 5"}</span>
                      <span>{lang === "ar" ? "سؤال سيظهر بعد 8 ثوانٍ" : "Question in 8 seconds"}</span>
                    </div>
                  </div>

                  {/* Question + answers card (cream) */}
                  <div className="mt-4 rounded-[22px] bg-[#fdf8ec] p-5 shadow-[0_8px_20px_rgba(150,108,40,0.12)]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 min-w-[42px] items-center justify-center rounded-full bg-[#e6c585]/40 px-2 text-[11px] font-black text-[#8a6314]">
                          {lang === "ar" ? "08 ث" : "08 s"}
                      </span>
                      <div className="flex-1 text-right">
                        <p className="text-[11px] font-black text-[#a87a2e]">
                          {lang === "ar" ? "السؤال بعد الفيديو" : "Question after the video"}
                        </p>
                        <h4 className="mt-1 text-[1.05rem] font-black leading-snug text-foreground">
                          {lang === "ar"
                            ? "متى يبدأ التبخر في دورة الماء؟"
                            : "When does evaporation begin in the water cycle?"}
                        </h4>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {videoChoices.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center gap-3 rounded-2xl border border-[#e6c585]/45 bg-white px-3.5 py-3 text-right shadow-[0_2px_6px_rgba(150,108,40,0.06)]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fdf2d8] text-[12px] font-black text-[#a87a2e]">
                            {c.badge}
                          </span>
                          <span className="flex-1 text-[13.5px] font-bold text-foreground">
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-black text-[hsl(38,75%,38%)]">
                  {lang === "ar" ? "٢. اعرض" : "2. Present"}
                </p>
                <h2 className="font-display-display text-[1.95rem] font-black text-foreground sm:text-[2.45rem]">
                  {lang === "ar"
                    ? "حوّل أي درس مرئي إلى تجربة نشطة"
                    : "Turn every visual lesson into active learning"}
                </h2>
                <p className="text-[1rem] leading-8 text-muted-foreground">
                  {lang === "ar"
                    ? "أضف أسئلة على لحظات محددة من الفيديو، فيشاهد الطالب المقطع ويجيب داخل نفس الشاشة، ويصلك الأثر فورًا."
                    : "Place questions at key moments in a video, so students watch and answer on the same screen while you see the impact immediately."}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      Icon: Play,
                      t: lang === "ar" ? "يبدأ الفيديو بسؤال مدمج" : "Start the video with an embedded question",
                      c: "bg-[hsl(38,90%,94%)] text-[hsl(38,75%,38%)]",
                    },
                    {
                      Icon: CheckCircle2,
                      t: lang === "ar" ? "إجابة لحظية وتقييم تلقائي" : "Instant answers and automatic assessment",
                      c: "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]",
                    },
                    {
                      Icon: Users,
                      t: lang === "ar" ? "متابعة مشاركة كل طالب" : "Follow each student's participation",
                      c: "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]",
                    },
                    {
                      Icon: Sparkles,
                      t: lang === "ar" ? "تجربة قريبة من تجربة الطالب" : "See an experience close to the student's view",
                      c: "bg-[hsl(280,55%,95%)] text-[hsl(280,40%,42%)]",
                    },
                  ].map((b) => (
                    <div
                      key={b.t}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white p-3 shadow-sm"
                    >
                      <div className={`inline-flex shrink-0 rounded-xl p-2 ${b.c}`}>
                        <b.Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-black text-foreground">
                        {b.t}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------- HASAAD CHALLENGE (group / audience competition) -------------- */}
        <section
          className="order-7 border-t border-border/60"
          dir={dir}
          style={{
            order: 7,
            background:
              "linear-gradient(135deg,#1E4D35 0%,#265E42 55%,#2d7050 100%)",
          }}
        >
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="grid items-center gap-8 lg:grid-cols-[1fr_0.85fr] lg:gap-12"
            >
              {/* Copy + CTA */}
              <div className="text-white">
                <h2 className="font-display-display text-[2rem] sm:text-[2.6rem] font-black leading-tight">
                  <span style={{ color: "#E8A80E" }}>{lang === "ar" ? "٣. تفاعل" : "3. Interact"}</span><br/><span style={{ color: "#E8A80E", fontSize: "0.7em" }}>{lang === "ar" ? "تحدي حصاد" : "Hasad Challenge"}</span>
                  <span className="block text-white/95 mt-1">
                    {lang === "ar" ? "مسابقة جماعية بين فريقين أمام الجمهور" : "A live team competition for every audience"}
                  </span>
                </h2>
                <p className="mt-4 text-[1rem] sm:text-[1.05rem] leading-8 text-white/85 max-w-xl">
                  {lang === "ar"
                    ? "جرّب تجربة مسابقة حماسية: فريقان متنافسان، أسئلة مباشرة، ونتائج تظهر للجميع لحظة بلحظة. مناسب للحفلات المدرسية، الملتقيات العائلية، والفعاليات."
                    : "Run an energetic live competition with two teams, direct questions, and results everyone can follow in the moment. Great for school events, family gatherings, and more."}
                </p>

                {/* Feature chips */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { icon: Users, text: lang === "ar" ? "فريقان متنافسان" : "Two competing teams" },
                    { icon: Trophy, text: lang === "ar" ? "نتائج لحظية" : "Live results" },
                    { icon: Sparkles, text: lang === "ar" ? "أجواء حماسية" : "High-energy atmosphere" },
                  ].map((f) => (
                    <span
                      key={f.text}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{
                        background: "rgba(255,255,255,0.10)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      <f.icon className="w-3.5 h-3.5" style={{ color: "#E8A80E" }} />
                      {f.text}
                    </span>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/game/arena">
                    <button
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black shadow-lg transition-all hover:scale-[1.02]"
                      style={{
                        background: "#E8A80E",
                        color: "#1E4D35",
                        boxShadow: "0 10px 28px rgba(232,168,14,0.35)",
                      }}
                    >
                      <Swords className="w-5 h-5" />
                      {lang === "ar" ? "ابدأ التحدي الآن" : "Start the challenge"}
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </Link>
                  <Link href="/game/arena">
                    <button
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all hover:bg-white/10"
                      style={{
                        background: "transparent",
                        color: "#fff",
                        border: "1.5px solid rgba(255,255,255,0.35)",
                      }}
                    >
                      {lang === "ar" ? "اعرف أكثر" : "Learn more"}
                    </button>
                  </Link>
                </div>
              </div>

              {/* Visual mock — in-game screenshot style */}
              <div className="relative">
                <div
                  className="relative rounded-[22px] overflow-hidden"
                  style={{
                    background: "linear-gradient(160deg,#022c22 0%,#064e3b 55%,#0a5c45 100%)",
                    border: "1.5px solid rgba(201,161,75,0.35)",
                    boxShadow: "0 32px 72px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,161,75,0.12)",
                  }}
                >
                  {/* ── Scoreboard header ── */}
                  <div
                    className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-2"
                    style={{ background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(201,161,75,0.20)" }}
                  >
                    {/* Team A */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div
                        className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                        style={{ background: "#2563eb", color: "#fff", boxShadow: "0 0 10px #2563eb88" }}
                      >
                        🦅
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] sm:text-[10px] font-bold truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{lang === "ar" ? "الفريق الأول" : "Team one"}</div>
                        <div className="text-base sm:text-lg font-black leading-none" style={{ color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>1٬400</div>
                      </div>
                    </div>

                    {/* VS badge */}
                    <div
                      className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black"
                      style={{ background: "linear-gradient(135deg,#c9a14b,#e0bb69)", color: "#fff", boxShadow: "0 4px 12px rgba(201,161,75,0.35)" }}
                    >
                      VS
                    </div>

                    {/* Team B */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <div className="text-end min-w-0">
                        <div className="text-[9px] sm:text-[10px] font-bold truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{lang === "ar" ? "الفريق الثاني" : "Team two"}</div>
                        <div className="text-base sm:text-lg font-black leading-none" style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>800</div>
                      </div>
                      <div
                        className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                        style={{ background: "#dc2626", color: "#fff", boxShadow: "0 0 10px #dc262688" }}
                      >
                        🦁
                      </div>
                    </div>
                  </div>

                  {/* ── Turn indicator ── */}
                  <div className="px-3 pt-2 sm:pt-2.5 flex items-center justify-center gap-1.5">
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black"
                      style={{ background: "rgba(37,99,235,0.22)", color: "#93c5fd", border: "1px solid rgba(37,99,235,0.4)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                      {lang === "ar" ? "دور الفريق الأول · السؤال ٣ من ١٢" : "Team one's turn · question 3 of 12"}
                    </div>
                  </div>

                  {/* ── Question card ── */}
                  <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2.5">
                    <div
                      className="rounded-[14px] px-3 py-3 sm:px-4 sm:py-3.5 relative"
                      style={{
                        background: "#ffffff",
                        border: "1.5px solid #ebe2cd",
                        boxShadow: "0 8px 24px -8px rgba(31,77,79,0.22)",
                      }}
                    >
                      {/* Gold corner ornaments */}
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-tr-lg pointer-events-none" style={{ borderTop: "1.5px solid #c9a14b", borderRight: "1.5px solid #c9a14b" }} />
                      <div className="absolute top-2 left-2 w-4 h-4 rounded-tl-lg pointer-events-none" style={{ borderTop: "1.5px solid #c9a14b", borderLeft: "1.5px solid #c9a14b" }} />
                      <div className="absolute bottom-2 right-2 w-4 h-4 rounded-br-lg pointer-events-none" style={{ borderBottom: "1.5px solid #c9a14b", borderRight: "1.5px solid #c9a14b" }} />
                      <div className="absolute bottom-2 left-2 w-4 h-4 rounded-bl-lg pointer-events-none" style={{ borderBottom: "1.5px solid #c9a14b", borderLeft: "1.5px solid #c9a14b" }} />

                      {/* Category chip */}
                      <div className="flex justify-center mb-2">
                        <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(201,161,75,0.12)", color: "#a07f37", border: "1px solid rgba(201,161,75,0.3)" }}>
                          {lang === "ar" ? "🌍 جغرافيا وعالم · 600 نقطة" : "🌍 World geography · 600 points"}
                        </span>
                      </div>

                      <p className="text-center font-black text-[11px] sm:text-[13px] mb-3" style={{ color: "#1f2937", lineHeight: 1.5 }}>
                        {lang === "ar"
                          ? "ما عدد دول العالم المعترف بها رسمياً؟"
                          : "How many countries are officially recognized worldwide?"}
                      </p>

                      {/* Answer choices */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: lang === "ar" ? "١٩٣ دولة" : "193 countries", correct: true },
                          { label: lang === "ar" ? "٢١٥ دولة" : "215 countries", correct: false },
                          { label: lang === "ar" ? "١٧٨ دولة" : "178 countries", correct: false },
                          { label: lang === "ar" ? "٢٠٥ دول" : "205 countries", correct: false },
                        ].map((opt, i) => (
                          <div
                            key={i}
                            className="rounded-lg px-2 py-1.5 text-center text-[10px] sm:text-[11px] font-bold"
                            style={opt.correct ? {
                              background: "linear-gradient(135deg,#16a34a,#15803d)",
                              color: "#fff",
                              boxShadow: "0 0 10px rgba(22,163,74,0.5)",
                              border: "1.5px solid #4ade80",
                            } : {
                              background: "rgba(31,41,55,0.06)",
                              color: "#374151",
                              border: "1px solid rgba(31,41,55,0.12)",
                            }}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>

                      {/* Correct answer reveal strip */}
                      <div
                        className="mt-2 rounded-lg px-2.5 py-1.5 flex items-center justify-center gap-1.5"
                        style={{ background: "linear-gradient(135deg,rgba(201,161,75,0.10),rgba(201,161,75,0.04))", border: "1.5px solid #c9a14b" }}
                      >
                        <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wide" style={{ color: "#a07f37" }}>{lang === "ar" ? "✦ الإجابة الصحيحة · ١٩٣ دولة ✦" : "✦ Correct answer · 193 countries ✦"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating winner badge */}
                <div
                  className="absolute -bottom-3 -start-3 sm:-bottom-4 sm:-start-4 rounded-xl px-3 py-2 flex items-center gap-2"
                  style={{ background: "#fff", boxShadow: "0 14px 32px rgba(0,0,0,0.18)" }}
                >
                  <Trophy className="w-5 h-5" style={{ color: "#E8A80E" }} />
                  <div>
                    <div className="text-[10px] font-bold" style={{ color: "#737373" }}>{lang === "ar" ? "يتصدر الآن" : "Now leading"}</div>
                    <div className="text-xs font-black" style={{ color: "#1E4D35" }}>{lang === "ar" ? "الفريق الأول 🦅 +600" : "Team one 🦅 +600"}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* -------------- TOOLS -------------- */}
        <section
          className="order-3 border-t border-border/60 bg-[#fbfcf8]"
          id="tools"
          aria-labelledby="tools-heading"
          style={{ order: 3, scrollMarginTop: "6rem" }}
        >
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-sm font-black text-[hsl(145,55%,32%)]">
                {lang === "ar" ? "أدوات المعلم" : "Teacher tools"}
              </p>
              <h2 className="mt-2 font-display-display text-[1.95rem] font-black text-foreground sm:text-[2.45rem]">
                {lang === "ar"
                  ? "أدوات حصاد الذكية للمعلم"
                  : "Hasad's smart tools for teachers"}
              </h2>
              <p className="mt-3 text-[1rem] leading-8 text-muted-foreground">
                {lang === "ar"
                  ? "خطط لدرسك، اصنع محتواك، وشارك المتعلمين من مكان واحد."
                  : "Plan lessons, create content, and engage learners from one place."}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tools.map((tool, i) => {
                const tones = [
                  "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]",
                  "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]",
                  "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]",
                  "bg-[hsl(280,55%,95%)] text-[hsl(280,40%,42%)]",
                  "bg-[hsl(160,55%,93%)] text-[hsl(160,55%,28%)]",
                ];
                return (
                  <Link
                    href={tool.href}
                    key={tool.title}
                    className="soft-card group rounded-2xl p-4 transition hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(43,83,59,0.10)]"
                  >
                    <div
                      className={`inline-flex rounded-xl p-2.5 transition group-hover:scale-105 ${tones[i % tones.length]}`}
                    >
                      <tool.Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-[0.95rem] font-black text-foreground">
                      {tool.title}
                    </h3>
                    <p className="mt-1.5 hidden text-sm leading-6 text-muted-foreground sm:block">
                      {tool.desc}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[hsl(145,55%,32%)]">
                      {lang === "ar" ? "استكشف الأداة" : "Explore tool"}
                      <ArrowLeft className={`h-3.5 w-3.5 transition group-hover:translate-x-0.5 ${lang === "ar" ? "" : "rotate-180"}`} />
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 text-center">
              <Link
                href="/teacher/new"
                className="inline-flex items-center gap-2 rounded-xl border border-[hsl(145,30%,82%)] bg-white px-5 py-2.5 text-sm font-black text-[hsl(145,45%,24%)] transition hover:border-[hsl(145,55%,45%)] hover:bg-[hsl(145,30%,96%)]"
              >
                {lang === "ar" ? "استكشف جميع أدوات المعلم" : "Explore all teacher tools"}
                <ArrowLeft className={`h-4 w-4 ${lang === "ar" ? "" : "rotate-180"}`} />
              </Link>
            </div>
          </div>
        </section>

        <section className="order-11 hidden border-t border-border/60 bg-[#fbfcf8] py-8">
          {/* ===== FEATURES GRID ===== */}
            <motion.section
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              dir={dir}
              style={{
                maxWidth: "920px",
                margin: "clamp(28px,5vh,52px) auto clamp(16px,2.5vh,24px)",
                padding: "0 clamp(12px,3vw,20px)",
              }}
            >
          <div
            className="grid grid-cols-3 gap-2.5 sm:gap-5"
                style={{
                  background: "rgba(255,255,255,0.65)",
                  border: "1px solid rgba(27,107,63,0.10)",
                  borderRadius: "clamp(16px,3vw,26px)",
                  padding: "clamp(20px,3.5vw,28px) clamp(14px,2.5vw,22px)",
                  backdropFilter: "blur(6px)",
                }}
              >
                {[
                  {
                    Icon: ShieldCheck,
                    tint: "#1b6b3f",
                    tintBg: "rgba(27,107,63,0.10)",
                    title: lang === "ar" ? "آمن وسهل الاستخدام" : "Safe and easy to use",
                    desc: lang === "ar" ? "بيئة آمنة وبسيطة تناسب المعلمين والطلاب" : "A simple, safe environment for teachers and students",
                  },
                  {
                    Icon: BarChart3,
                    tint: "#7c3aed",
                    tintBg: "rgba(124,58,237,0.10)",
                    title: lang === "ar" ? "تقارير وتحليلات" : "Reports and insights",
                    desc: lang === "ar" ? "تابع التقدم والنتائج من خلال تقارير تفصيلية" : "Follow progress and results with clear reports",
                  },
                  {
                    Icon: Sparkles,
                    tint: "#b88712",
                    tintBg: "rgba(215,165,29,0.12)",
                    title: lang === "ar" ? "تفاعل وتحفيز" : "Engagement and motivation",
                    desc: lang === "ar" ? "تجارب تفاعلية تعزز التعلم وتحفز المشاركة" : "Interactive experiences that encourage learning and participation",
                  },
                ].map((f, idx) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                      delay: 0.08 + idx * 0.08,
                    }}
                    style={{
                      textAlign: "center",
                      padding: "clamp(8px,1.5vw,12px) 4px",
                    }}
                  >
                    <div
                      style={{
                        width: "clamp(40px,6vw,52px)",
                        height: "clamp(40px,6vw,52px)",
                        borderRadius: "14px",
                        background: f.tintBg,
                        color: f.tint,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "clamp(8px,1.5vw,12px)",
                      }}
                    >
                      <f.Icon strokeWidth={1.75} className="w-6 h-6" />
                    </div>
                    <h4
                      style={{
                        margin: "0 0 clamp(4px,0.8vw,7px)",
                        fontSize: "clamp(12px,1.5vw,15.5px)",
                        color: "#103d2a",
                        fontWeight: 900,
                      }}
                    >
                      {f.title}
                    </h4>
                    <p
                      className="hidden sm:block"
                      style={{
                        margin: 0,
                        fontSize: "clamp(10px,1.2vw,13px)",
                        lineHeight: 1.55,
                        color: "#1b6b3f",
                        fontWeight: 500,
                      }}
                    >
                      {f.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.section>

        </section>

        <section className="hidden bg-white py-6">
          {/* ===== WHO IS THIS FOR ===== */}
            <motion.section
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              dir={dir}
              style={{
                maxWidth: "900px",
                margin: "clamp(32px,5vh,56px) auto clamp(22px,3.5vh,32px)",
                padding: "0 clamp(12px,3vw,20px)",
              }}
            >
              {/* Role cards — Teacher / [Organizer] / Student.
                  When organizer is disabled: 2-column grid (teacher + student).
                  When enabled: 3-column grid including organizer. */}
              <div className={`hidden grid gap-2.5 sm:gap-5 items-stretch ${platformSettings.organizerEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
                {(() => {
                  const allRoleCards = [
                    {
                      key: "teacher",
                      href: "/register?role=teacher",
                      Icon: GraduationCap,
                      title: lang === "ar" ? "معلم" : "Teacher",
                      desc: lang === "ar" ? "أنشئ دروساً تفاعلية، واجبات،\nاختبارات وخطط بسهولة" : "Create interactive lessons,\nassignments, tests, and plans with ease",
                      extra: null as string | null,
                      cta: lang === "ar" ? "ابدأ كمعلم" : "Start as a teacher",
                      bg: "linear-gradient(180deg,#f1f9ec 0%,#e6f3dd 100%)",
                      border: "rgba(27,107,63,0.18)",
                      iconBg: "rgba(27,107,63,0.14)",
                      iconColor: "#1b6b3f",
                      titleColor: "#13502e",
                      descColor: "#3a6a4d",
                      btnBg: "linear-gradient(180deg,#1f8246,#16693a)",
                      btnShadow: "0 6px 18px -6px rgba(27,107,63,0.55)",
                      delay: 0.05,
                    },
                    {
                      key: "organizer",
                      href: "/register?role=organizer",
                      Icon: Trophy,
                      title: lang === "ar" ? "منظم فعاليات" : "Event organizer",
                      desc: lang === "ar" ? "شغّل مسابقات حماسية في أي\nتجمع أو لقاء خلال ثوانٍ" : "Run engaging competitions at any\ngathering in seconds",
                      extra: null as string | null,
                      cta: lang === "ar" ? "ابدأ مسابقة" : "Start a competition",
                      bg: "linear-gradient(180deg,#fff8e6 0%,#fff1cf 100%)",
                      border: "rgba(215,165,29,0.40)",
                      iconBg: "rgba(215,165,29,0.18)",
                      iconColor: "#b88712",
                      titleColor: "#9a6f0c",
                      descColor: "#7a5a14",
                      btnBg: "linear-gradient(180deg,#f0a929,#d18a14)",
                      btnShadow: "0 6px 18px -6px rgba(215,165,29,0.55)",
                      delay: 0.10,
                    },
                    {
                      key: "student",
                      href: "/student/login",
                      Icon: Gamepad2,
                      title: lang === "ar" ? "طالب / مشارك" : "Student / participant",
                      desc: lang === "ar" ? "العب، شارك في التحديات، واجمع\nنقاطك ونافس على الصدارة" : "Play, join challenges, collect\npoints, and compete for the lead",
                      extra: lang === "ar" ? "🏆 تصدر الترتيب بين أصدقائك" : "🏆 Lead the scoreboard with friends",
                      cta: lang === "ar" ? "ابدأ اللعب" : "Start playing",
                      bg: "linear-gradient(180deg,#eef4ff 0%,#dfeaff 100%)",
                      border: "rgba(37,99,235,0.22)",
                      iconBg: "rgba(37,99,235,0.14)",
                      iconColor: "#2563eb",
                      titleColor: "#1d4ed8",
                      descColor: "#3a4f7a",
                      btnBg: "linear-gradient(180deg,#2f6ff0,#1d50c8)",
                      btnShadow: "0 6px 18px -6px rgba(37,99,235,0.55)",
                      delay: 0.15,
                    },
                  ];
                  const roleCards = allRoleCards.filter(
                    c => c.key !== "organizer" || platformSettings.organizerEnabled
                  );
                  return roleCards.map((c) => {
                    const Icon = c.Icon;
                    return (
                      <motion.div
                        key={c.key}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.45,
                          ease: "easeOut",
                          delay: c.delay,
                        }}
                        style={{ height: "100%" }}
                      >
                        <Link
                          href={c.href}
                          className="group hover:-translate-y-1 transition-transform duration-200 flex flex-col items-center text-center h-full"
                          style={{
                            padding: "14px 10px 12px",
                            background: c.bg,
                            border: `1.5px solid ${c.border}`,
                            borderRadius: "18px",
                            textDecoration: "none",
                            boxShadow: "0 6px 20px rgba(15,55,32,0.07)",
                            gap: "8px",
                          }}
                        >
                          {/* Circle icon */}
                          <div
                            className="w-11 h-11 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: c.iconBg,
                              color: c.iconColor,
                              boxShadow: `0 4px 12px -6px ${c.iconColor}66`,
                            }}
                          >
                            <Icon
                              strokeWidth={1.75}
                              className="w-5 h-5 sm:w-8 sm:h-8 lg:w-10 lg:h-10"
                            />
                          </div>
                          {/* Title */}
                          <h4
                            className="text-[13px] sm:text-xl lg:text-2xl font-black leading-tight"
                            style={{ margin: 0, color: c.titleColor, letterSpacing: "-0.01em" }}
                          >
                            {c.title}
                          </h4>
                          {/* Description — hidden on mobile, shown on sm+ */}
                          <p
                            className="hidden sm:block text-[13px] lg:text-sm font-medium leading-relaxed"
                            style={{
                              margin: 0,
                              color: c.descColor,
                              whiteSpace: "pre-line",
                              minHeight: "3em",
                            }}
                          >
                            {c.desc}
                          </p>
                          {/* Optional extra line — hidden on mobile */}
                          {c.extra && (
                            <p
                              className="hidden sm:block text-[11px] lg:text-[13px] font-bold"
                              style={{ margin: 0, color: c.iconColor }}
                            >
                              {c.extra}
                            </p>
                          )}
                          {/* Spacer — desktop only */}
                          <span className="hidden sm:flex flex-1" />
                          {/* CTA button */}
                          <div
                            className="w-full flex items-center justify-center gap-1 sm:gap-2 group-hover:brightness-110 transition-all"
                            style={{
                              padding: "7px 6px",
                              borderRadius: "10px",
                              background: c.btnBg,
                              color: "#fff",
                              fontWeight: 900,
                              fontSize: "11px",
                              boxShadow: c.btnShadow,
                              marginTop: "auto",
                            }}
                          >
                            <Icon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" strokeWidth={2.25} />
                            <span className="sm:text-base sm:leading-none">{c.cta}</span>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </motion.section>
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-sm font-bold">
              {platformSettings.organizerEnabled && (
                <Link href="/register?role=organizer" className="text-[#0b4b35] underline-offset-4 hover:underline">
                  {lang === "ar" ? "تنظم فعالية؟ ابدأ مسابقة" : "Organizing an event? Start a competition"}
                </Link>
              )}
              <Link href="/student/login" className="text-[#0b4b35] underline-offset-4 hover:underline">
                {lang === "ar" ? "طالب؟ سجّل الدخول" : "Student? Sign in"}
              </Link>
            </div>
        </section>
        {/* -------------- READY QUIZZES (preserved) -------------- */}
        <ReadyQuizzesSection lang={lang} dir={dir} />

        {/* -------------- FLOW + LIVE STATS -------------- */}
        <section id="how-it-works" className="order-4 border-t border-border/60 bg-[#fbfcf8]" style={{ order: 4 }}>
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="soft-card rounded-[30px] p-6 sm:p-8">
                <p className="text-sm font-black text-[hsl(145,55%,32%)]">
                  {lang === "ar" ? "مسار حصاد" : "The Hasad path"}
                </p>
                <h3 className="mt-2 font-display-display text-[1.85rem] font-black text-foreground sm:text-[2.25rem]">
                  {lang === "ar" ? "أنشئ ← اعرض ← تفاعل" : "Create ← Present ← Engage"}
                </h3>
                <div className="mt-7 space-y-4">
                  {flowSteps.map((step, i) => (
                    <div
                      key={step.title}
                      className="flex gap-4 rounded-[22px] border border-border/70 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(43,83,59,0.08)]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(145,55%,93%)] text-base font-black text-[hsl(145,55%,28%)]">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-[1rem] font-black text-foreground">
                          {step.title}
                        </h4>
                        <p className="mt-1.5 text-sm leading-7 text-muted-foreground">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!stats?.hidden && stats && (
              <div className="soft-card rounded-[30px] p-6 sm:p-8">
                <p className="text-sm font-black text-[hsl(145,55%,32%)]">
                  إحصائيات نشطة
                </p>
                <h3 className="mt-2 font-display-display text-[1.85rem] font-black text-foreground sm:text-[2.25rem]">
                  حصاد ينمو مع كل صفّ جديد
                </h3>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: stats.labels?.teacher ?? "معلمًا نشطًا",
                      value: stats.teacherCount || 0,
                      note: stats.notes?.teacher ?? "ينشئون مسابقاتهم بأنفسهم",
                      w: 76,
                    },
                    {
                      label: stats.labels?.assignment ?? "نشاطًا منشورًا",
                      value: stats.assignmentCount || 0,
                      note: stats.notes?.assignment ?? "تتنوع بين المسابقات والواجبات",
                      w: 84,
                    },
                    {
                      label: stats.labels?.student ?? "طالبًا مشاركًا",
                      value: stats.studentCount || 0,
                      note: stats.notes?.student ?? "يدخلون بكود من 6 أرقام",
                      w: 70,
                    },
                    {
                      label: stats.labels?.submission ?? "تسليمًا مكتملاً",
                      value: stats.submissionCount || 0,
                      note: stats.notes?.submission ?? "تسجَّل تلقائيًا للمعلم",
                      w: 88,
                    },
                  ].map((item, i) => (
                    <article
                      key={item.label}
                      className="animated-stat rounded-[22px] border border-border/70 bg-white p-5 shadow-[0_14px_30px_rgba(43,83,59,0.06)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[1.65rem] font-black tracking-tight text-[hsl(145,55%,28%)] sm:text-[1.95rem]">
                          <AnimatedCounter value={item.value} />
                        </p>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${i % 2 === 0 ? "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]" : "bg-[hsl(43,90%,92%)] text-[hsl(38,75%,38%)]"}`}
                        >
                          مباشر
                        </span>
                      </div>
                      <h4 className="mt-2.5 text-[0.95rem] font-black text-foreground">
                        {item.label}
                      </h4>
                      <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
                        {item.note}
                      </p>
                      <div className="stat-meter mt-3.5">
                        <span style={{ width: `${item.w}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>
        </section>

        {/* -------------- GAMES -------------- */}
        <section id="games" className="order-10 border-t border-border/60 bg-[#fbfcf8]" style={{ order: 10 }}>
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-[hsl(145,55%,32%)]">
                  {lang === "ar" ? "ألعاب تعليمية" : "Learning games"}
                </p>
                <h2 className="mt-2 font-display-display text-[1.95rem] font-black text-foreground sm:text-[2.45rem]">
                  {lang === "ar" ? "العب وتعلّم — مجاناً للجميع" : "Play and learn — free for everyone"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {lang === "ar" ? "ألعاب جاهزة للاستخدام فورًا بدون تسجيل." : "Ready-to-play games with no sign-in required."}
                </p>
              </div>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 self-start rounded-xl border border-[hsl(145,30%,82%)] bg-white px-4 py-2.5 text-xs font-black text-[hsl(145,45%,24%)] hover:bg-[hsl(145,30%,96%)] sm:self-auto"
              >
                <Globe className="h-3.5 w-3.5" />
                {lang === "ar" ? "كل الألعاب" : "All games"}
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {gameCards.slice(0, 4).map((game, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.04 * i }}
                >
                  <button
                    type="button"
                    onClick={() => handlePublicClick(game.href)}
                    className="group h-full w-full rounded-2xl border border-border/70 bg-white p-5 text-right transition hover:-translate-y-1 hover:border-[hsl(145,55%,32%)]/40 hover:shadow-[0_18px_36px_rgba(43,83,59,0.10)]"
                  >
                    <div
                      className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${game.iconBg} ${game.iconColor} transition group-hover:scale-105`}
                    >
                      <game.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 text-sm font-black text-foreground">
                      {game.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
                      {game.desc}
                    </p>
                    {game.href === "/game/million" && isLoggedIn === false && (
                      <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11px] font-bold leading-5 text-amber-800">
                        {lang === "ar"
                          ? "لإدارة المسابقة وإنشائها سجّل الدخول كمعلم"
                          : "Sign in as a teacher to create & manage the contest"}
                      </p>
                    )}
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[hsl(145,55%,32%)] transition group-hover:gap-2">
                      {lang === "ar" ? "العب الآن" : "Play now"}
                      <ChevronIcon className="h-3.5 w-3.5" />
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------- FINAL CTA -------------- */}
        <section className="order-11 border-t border-border/60" style={{ order: 11 }}>
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="cta-panel rounded-[34px] p-7 text-white shadow-[0_28px_70px_rgba(26,54,40,0.22)] sm:p-10 lg:p-12">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-black text-[#a6e8c0]">
                    {lang === "ar" ? "الخطوة التالية" : "Your next step"}
                  </p>
                  <h3 className="mt-3 font-display-display text-[1.95rem] font-black leading-[1.35] sm:text-[2.6rem]">
                    {lang === "ar"
                      ? "ابدأ أول تجربة تعليمية تفاعلية لك اليوم"
                      : "Start your first interactive learning experience today"}
                  </h3>
                  <p className="mt-4 text-[0.98rem] leading-8 text-white/78">
                    {lang === "ar"
                      ? "أنشئ المحتوى، اعرضه، وشارك المتعلمين من مكان واحد."
                      : "Create the content, present it, and engage learners from one place."}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/register?role=teacher"
                    className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-base font-black text-[#1f4732] shadow-[0_18px_38px_rgba(0,0,0,0.22)] transition hover:bg-white/92"
                  >
                    <Zap className="h-5 w-5 fill-current" />
                    {lang === "ar" ? "أنشئ حسابك مجاناً" : "Create your free account"}
                  </Link>
                  <Link
                    href="/public/games"
                    className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/35 bg-transparent px-7 text-base font-black text-white transition hover:bg-white/10"
                  >
                    <Trophy className="h-5 w-5" />
                    {lang === "ar" ? "شاهد المسابقات الجاهزة" : "Browse ready quizzes"}
                  </Link>
                  <Link
                    href="/guest/create"
                    className="inline-flex w-full items-center justify-center gap-2 px-5 py-1 text-sm font-bold text-white/80 underline decoration-white/35 underline-offset-4 transition hover:text-white"
                  >
                    {lang === "ar" ? "أو ابدأ تجربة كضيف" : "Or start as a guest"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* -------------- INSTALL MODAL (preserved) -------------- */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-card"
              dir={dir}
            >
              <button
                onClick={() => setShowInstallModal(false)}
                className="absolute top-3 left-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
              <div className="border-b border-border bg-[hsl(145,45%,32%)]/5 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-[hsl(145,45%,32%)] p-2 text-white">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      {lang === "ar"
                        ? "تثبيت حصاد على هاتفك"
                        : "Install Hasaad on your phone"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === "ar"
                        ? "اتبع الخطوات حسب نوع جهازك"
                        : "Follow the steps for your device"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-b border-border bg-muted/40">
                {(["ios", "android", "video"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInstallTab(tab)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors ${
                      installTab === tab
                        ? "bg-white text-[hsl(145,45%,28%)] border-b-2 border-[hsl(145,45%,32%)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "ios" && (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-3.5 w-3.5"
                        >
                          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.49-.13-1.09.42-2.24 1.07-2.99.74-.85 2.05-1.49 3.094-1.58zm3.564 17.6c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.39 3.52-4.12 3.54-1.54.02-1.93-1-4.02-.98-2.09.01-2.52.99-4.06.97-1.74-.02-3.05-1.78-4.04-3.35-2.77-4.39-3.06-9.54-1.35-12.28 1.21-1.95 3.13-3.09 4.93-3.09 1.84 0 2.99 1 4.51 1 1.47 0 2.36-1 4.49-1 1.6 0 3.31.88 4.52 2.4-3.97 2.18-3.32 7.85.66 9.83z" />
                        </svg>
                        <span>iPhone</span>
                      </>
                    )}
                    {tab === "android" && (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-3.5 w-3.5"
                        >
                          <path d="M17.523 15.34c-.55 0-.999-.45-.999-1s.448-1 .999-1 1 .45 1 1-.449 1-1 1m-11.046 0c-.55 0-.999-.45-.999-1s.448-1 .999-1 1 .45 1 1-.449 1-1 1m11.405-6.02 1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.567.152l-2.022 3.503C15.59 8.244 13.853 7.85 12 7.85s-3.59.394-5.137 1.099L4.84 5.447a.416.416 0 00-.567-.152.416.416 0 00-.152.567l1.997 3.46C2.69 11.187.343 14.659 0 18.76h24c-.343-4.102-2.69-7.574-6.118-9.44" />
                        </svg>
                        <span>Android</span>
                      </>
                    )}
                    {tab === "video" && (
                      <>
                        <Play className="h-3.5 w-3.5" />{" "}
                        <span>{lang === "ar" ? "فيديو" : "Video"}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <div className="min-h-[220px] space-y-2.5 px-5 py-4">
                {installTab === "ios" && (
                  <>
                    {[
                      lang === "ar"
                        ? "افتح حصاد في متصفح Safari"
                        : "Open Hasaad in Safari browser",
                      lang === "ar"
                        ? "اضغط على أيقونة المشاركة ↑ في أسفل الشاشة"
                        : "Tap the Share icon ↑ at the bottom",
                      lang === "ar"
                        ? 'اختر "إضافة إلى الشاشة الرئيسية"'
                        : 'Choose "Add to Home Screen"',
                      lang === "ar" ? "اضغط إضافة ✓" : "Tap Add ✓",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(145,45%,32%)] text-xs font-black text-white">
                          {i + 1}
                        </div>
                        <p className="text-sm leading-snug text-foreground">
                          {step}
                        </p>
                      </div>
                    ))}
                  </>
                )}
                {installTab === "android" && (
                  <>
                    {[
                      lang === "ar"
                        ? "افتح حصاد في متصفح Chrome"
                        : "Open Hasaad in Chrome browser",
                      lang === "ar"
                        ? "اضغط على قائمة النقاط الثلاث ⋮ في الأعلى"
                        : "Tap the three-dot menu ⋮ at the top",
                      lang === "ar"
                        ? 'اختر "إضافة إلى الشاشة الرئيسية"'
                        : 'Choose "Add to Home Screen"',
                      lang === "ar" ? "اضغط إضافة ✓" : "Tap Add ✓",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(145,45%,32%)] text-xs font-black text-white">
                          {i + 1}
                        </div>
                        <p className="text-sm leading-snug text-foreground">
                          {step}
                        </p>
                      </div>
                    ))}
                  </>
                )}
                {installTab === "video" && (
                  <div className="space-y-3">
                    <div className="relative aspect-[9/16] max-h-[60vh] mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl bg-black shadow-lg">
                      <iframe
                        src={`${import.meta.env.BASE_URL}install-tutorial`}
                        title={
                          lang === "ar"
                            ? "شرح تثبيت حصاد"
                            : "Install Hasaad tutorial"
                        }
                        className="h-full w-full border-0"
                        allow="autoplay"
                      />
                    </div>
                    <a
                      href={`${import.meta.env.BASE_URL}install-tutorial`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(145,55%,32%)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[hsl(145,55%,28%)]"
                    >
                      {lang === "ar"
                        ? "افتح في صفحة كاملة"
                        : "Open in full page"}
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------- FOOTER -------------- */}
      <footer className="bg-[hsl(145,30%,12%)] py-10 text-white" dir={dir}>
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <img
                  src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
                  alt={lang === "ar" ? "حصاد" : "Hasad"}
                  className="h-8 w-8 rounded-lg object-cover"
                />
                <span className="text-lg font-black">{lang === "ar" ? "حصاد" : "Hasad"}</span>
              </div>
              <p className="text-sm leading-7 text-white/55">
                {lang === "ar"
                  ? "منصة تعليمية تفاعلية — مسابقات وأنشطة وواجبات واختبارات وفيديو تفاعلي."
                  : "An interactive learning platform for quizzes, activities, assignments, tests, and interactive video."}
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-black text-white/75">
                {lang === "ar" ? "روابط سريعة" : "Quick links"}
              </h4>
              <div className="flex flex-col gap-2 text-sm text-white/55">
                <Link href="/register" className="hover:text-white">
                  {lang === "ar" ? "إنشاء حساب" : "Create an account"}
                </Link>
                <Link href="/login" className="hover:text-white">
                  {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
                </Link>
                <Link href="/public/games" className="hover:text-white">
                  {lang === "ar" ? "المسابقات الجاهزة" : "Ready quizzes"}
                </Link>
                <Link href="/games" className="hover:text-white">
                  {lang === "ar" ? "الألعاب التعليمية" : "Learning games"}
                </Link>
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-black text-white/75">
                {lang === "ar" ? "المميزات" : "Features"}
              </h4>
              <div className="flex flex-col gap-2 text-sm text-white/55">
                <span>{lang === "ar" ? "إنشاء أسئلة بالذكاء الاصطناعي" : "AI question generation"}</span>
                <span>{lang === "ar" ? "فيديو تفاعلي" : "Interactive video"}</span>
                <span>{lang === "ar" ? "تصحيح بالكاميرا" : "Camera-assisted grading"}</span>
                <span>{lang === "ar" ? "إحصائيات فورية" : "Instant insights"}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <p className="text-xs text-white/35">
              © {new Date().getFullYear()} {lang === "ar" ? "حصاد — جميع الحقوق محفوظة" : "Hasad — All rights reserved"}
            </p>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/20 hover:border-white/40 text-xs font-bold transition-all"
              title={lang === "ar" ? "شاركنا اقتراحك أو ملاحظتك — سنردّ عليك" : "Share your suggestion or feedback"}
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{lang === "ar" ? "اقتراحاتكم وملاحظاتكم" : "Suggestions and feedback"}</span>
              <span className="hidden sm:inline text-[10px] opacity-80 font-medium">
                {lang === "ar" ? "· نقرأ كل رسالة ونردّ" : "· We read every message"}
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
