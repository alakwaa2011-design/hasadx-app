import { Layout } from "@/components/layout";
import { HomeLanding } from "@/components/landing/home-landing";
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
  Video,
  Pencil,
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
import { XoIcon, SelfChallengeIcon } from "@/components/game-icons";
import { XoName } from "@/components/game/xo-display";

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

type QuickLiveGame =
  | "knowledge_race"
  | "tug_of_war"
  | "xo"
  | "escape_room"
  | "rocket_race"
  | "wheel_of_fortune"
  | "hotseat"
  | "million"
  | "hack"
  | "solo_challenge";

const QUICK_LIVE_GAMES: Array<{
  key: QuickLiveGame;
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}> = [
  { key: "knowledge_race", icon: "⚡", titleAr: "وميض", titleEn: "Wameedh", descAr: "مسابقة حية سريعة للصف", descEn: "Fast live classroom quiz" },
  { key: "tug_of_war", icon: "🪢", titleAr: "شد الحبل", titleEn: "Tug of War", descAr: "فريقان يتنافسان بالإجابات", descEn: "Two teams battle with answers" },
  { key: "xo", icon: <XoIcon size={28} />, titleAr: "X O", titleEn: "X O", descAr: "أجب ثم ضع علامتك على اللوحة", descEn: "Answer, then place your mark" },
  { key: "escape_room", icon: "🔐", titleAr: "غرفة الهروب", titleEn: "Escape Room", descAr: "افتح الأقفال قبل انتهاء الوقت", descEn: "Unlock the room before time runs out" },
  { key: "rocket_race", icon: "🚀", titleAr: "سباق الصواريخ", titleEn: "Rocket Race", descAr: "السرعة والدقة ترفعان صاروخك", descEn: "Speed and accuracy launch your rocket" },
  { key: "wheel_of_fortune", icon: "🎡", titleAr: "عجلة التحدي", titleEn: "Wheel of Challenge", descAr: "أدر العجلة واختر السؤال", descEn: "Spin the wheel and pick a question" },
  { key: "hotseat", icon: "🔥", titleAr: "الكرسي الساخن", titleEn: "Hot Seat", descAr: "طالب على الكرسي والجميع يشارك", descEn: "One student takes the hot seat" },
  { key: "million", icon: "🏆", titleAr: "من سيحصد المليون؟", titleEn: "Who Wants a Million?", descAr: "أسئلة متصاعدة مع وسائل مساعدة", descEn: "Escalating questions and lifelines" },
  { key: "hack", icon: "🧩", titleAr: "لعبة الاختراق", titleEn: "Hack Game", descAr: "ماراثون تنافسي مليء بالمفاجآت", descEn: "A competitive marathon full of surprises" },
  { key: "solo_challenge", icon: <SelfChallengeIcon size={28} />, titleAr: "مسابقة ذاتية", titleEn: "Self Challenge", descAr: "أنشئ رابطًا يجيب فيه كل طالب بمفرده", descEn: "Share a link for individual play" },
];

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
  const [selectedGame, setSelectedGame] = useState<QuickLiveGame>("knowledge_race");
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    if (selectedGame === "solo_challenge") {
      onClose();
      setLocation("/teacher/solo-challenges/new");
      return;
    }
    if (selected === null) return;
    onClose();
    const assignmentId = selected;
    const paths: Partial<Record<Exclude<QuickLiveGame, "solo_challenge">, string>> = {
      knowledge_race: getWameethSetupPath(assignmentId),
      tug_of_war: `/game/tug/create?assignmentId=${assignmentId}`,
      xo: `/game/xo/create?assignmentId=${assignmentId}`,
      escape_room: `/game/escape/create?assignmentId=${assignmentId}`,
      rocket_race: `/game/rocket/create?assignmentId=${assignmentId}`,
      wheel_of_fortune: `/game/wheel/create?assignmentId=${assignmentId}`,
      hotseat: `/game/hotseat/create?assignmentId=${assignmentId}`,
      million: `/game/million?assignmentId=${assignmentId}`,
      hack: `/game/hack?assignmentId=${assignmentId}`,
    };
    setLocation(paths[selectedGame] ?? getWameethSetupPath(assignmentId));
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
        className="bg-gradient-to-br from-amber-950 to-orange-950 rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-white/10 relative max-h-[90vh] flex flex-col"
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

        <div className="mb-5">
          <p className="text-white/70 text-xs font-bold mb-2.5">
            {lang === "ar" ? "اختر نوع المسابقة" : "Choose a live game"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {QUICK_LIVE_GAMES.map((game) => {
              const active = selectedGame === game.key;
              return (
                <button
                  key={game.key}
                  type="button"
                  onClick={() => setSelectedGame(game.key)}
                  className={`text-start rounded-2xl border p-3 transition-all ${
                    active
                      ? "border-amber-300 bg-amber-400/20 shadow-lg shadow-amber-950/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="text-xl leading-none block mb-2">{game.icon}</span>
                  <span className="block text-white text-xs font-black leading-tight">
                    {game.key === "xo" ? <XoName /> : lang === "ar" ? game.titleAr : game.titleEn}
                  </span>
                  <span className="block text-white/45 text-[10px] leading-snug mt-1">
                    {lang === "ar" ? game.descAr : game.descEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedGame === "solo_challenge" ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-5 text-center mb-5">
            <div className="mb-2 flex justify-center"><SelfChallengeIcon size={56} /></div>
            <p className="text-white font-black">
              {lang === "ar" ? "مسابقة ذاتية بدون غرفة مباشرة" : "A self-paced challenge without a live room"}
            </p>
            <p className="text-white/55 text-sm mt-1">
              {lang === "ar" ? "ستنتقل إلى صفحة إنشاء المسابقة وإعداد رابط المشاركة." : "You’ll open the challenge creator to prepare a shareable link."}
            </p>
          </div>
        ) : assignments.length === 0 ? (
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
          disabled={selectedGame !== "solo_challenge" && selected === null}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-base shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" />
          {selectedGame === "solo_challenge"
            ? lang === "ar" ? "إنشاء مسابقة ذاتية" : "Create self challenge"
            : lang === "ar" ? "ابدأ المسابقة" : "Start game"}
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
  const { t } = useI18n();
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
      if (!res.ok) throw new Error(data.message || t.publicGames.startError);
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
              {lang === "ar" ? "من مكتبة الأنشطة" : "From the Activities Library"}
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
  const { t } = useI18n();
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
        title={t.install.tutorial}
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
          title: "منصة حصاد | أنشئ وشارك وتفاعل في تجربة تعليمية متكاملة",
          description:
            "منصة عربية للمعلمين لإنشاء الأنشطة والعروض التفاعلية وتنظيم المسابقات التعليمية من مكان واحد.",
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
  const [showCreateMenu, setShowCreateMenu] = useState(false);
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
        t.home.cameraUnsupported,
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
        t.home.cameraError,
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

          {/* ── 3 action cards ───────────────────────────────────────────── */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl pt-8 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* ① إنشاء نشاط */}
              <div className="relative">
                <button
                  onClick={() => setShowCreateMenu(v => !v)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
                >
                  <span className="flex items-center gap-2.5">
                    <Plus className="w-5 h-5" />
                    {lang === "ar" ? "إنشاء نشاط" : "Create Activity"}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCreateMenu ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showCreateMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
                    >
                      <Link href="/teacher/new" onClick={() => setShowCreateMenu(false)}>
                        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-colors cursor-pointer">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground">
                              {lang === "ar" ? "واجب أو مسابقة" : "Assignment / Quiz"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lang === "ar" ? "أسئلة متعددة وتقييم فوري" : "Questions & instant grading"}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <div className="h-px bg-border/50 mx-4" />
                      <Link href="/teacher/presentations/new" onClick={() => setShowCreateMenu(false)}>
                        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors cursor-pointer">
                          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600">
                            <Presentation className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground">
                              {lang === "ar" ? "عرض تفاعلي" : "Interactive Presentation"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lang === "ar" ? "شرائح + ألعاب + تصويت" : "Slides + games + polls"}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <div className="h-px bg-border/50 mx-4" />
                      <Link href="/teacher/create-video-lesson" onClick={() => setShowCreateMenu(false)}>
                        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer">
                          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600">
                            <Play className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground">
                              {lang === "ar" ? "فيديو تفاعلي" : "Interactive Video"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lang === "ar" ? "فيديو مع أسئلة مضمّنة" : "Video with embedded questions"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ② إنشاء مسابقة */}
              <Link href="/teacher">
                <motion.div
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-500 text-white font-bold text-base shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-all cursor-pointer"
                >
                  <Trophy className="w-5 h-5 shrink-0" />
                  <span>{lang === "ar" ? "إنشاء مسابقة" : "Start Competition"}</span>
                </motion.div>
              </Link>

              {/* ③ أدخل الكود */}
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border shadow-sm">
                <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex gap-2 items-center flex-1 min-w-0" dir="ltr">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onKeyDown={(e) => {
                      const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Enter"];
                      if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault();
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      setPin(text);
                    }}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    placeholder={lang === "ar" ? "أدخل الكود" : "Enter code"}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-center font-bold tracking-[0.2em] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                  <button
                    onClick={handlePinJoin}
                    disabled={!pin.trim()}
                    className="shrink-0 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold rounded-lg text-sm transition-all"
                  >
                    {t.home.pinJoinBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-4">
            {/* close create menu when clicking outside */}
            {showCreateMenu && (
              <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
            )}

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

  const tools = lang === "ar" ? [
    {
      title: "مولّد خطة الدرس",
      desc: "حوّل أهداف الدرس إلى خطة واضحة قابلة للتخصيص.",
      Icon: BookOpen,
      href: "/teacher/lesson-plans/create",
    },
    {
      title: "مولّد الخريطة الذهنية",
      desc: "حوّل أي موضوع إلى خريطة ذهنية بصرية في لحظات.",
      Icon: Brain,
      href: "/teacher/mindmap/create",
    },
    {
      title: "ورقة عمل",
      desc: "صمّم ورقة عمل احترافية للطباعة بمساعدة الذكاء الاصطناعي.",
      Icon: FileText,
      href: "/teacher/worksheets/create",
    },
    {
      title: "عرض تفاعلي",
      desc: "أنشئ عرضاً تفاعلياً يجمع الشرائح والأسئلة والأنشطة.",
      Icon: Presentation,
      href: "/teacher/presentations/new",
    },
    {
      title: "درس فيديو",
      desc: "أضف أسئلة إلى لحظات محددة داخل الفيديو.",
      Icon: Video,
      href: "/teacher/video-lesson/new",
    },
    {
      title: "السبورة الذكية",
      desc: "اطرح سؤالاً أو فكرة ودع السبورة الذكية تعرضها أمام طلابك.",
      Icon: Pencil,
      href: "/teacher/smart-board",
    },
  ] : [
    { title: "Lesson plan generator", desc: "Turn lesson goals into a clear, customizable plan.", Icon: BookOpen, href: "/teacher/lesson-plans/create" },
    { title: "Mind map generator", desc: "Turn any topic into a visual mind map in moments.", Icon: Brain, href: "/teacher/mindmap/create" },
    { title: "Worksheet", desc: "Design a polished, printable worksheet with AI support.", Icon: FileText, href: "/teacher/worksheets/create" },
    { title: "Interactive presentation", desc: "Create a deck that combines slides, questions, and activities.", Icon: Presentation, href: "/teacher/presentations/new" },
    { title: "Video lesson", desc: "Add questions at specific moments inside a video.", Icon: Video, href: "/teacher/video-lesson/new" },
    { title: "Smart board", desc: "Ask a question or share an idea on a live smart board.", Icon: Pencil, href: "/teacher/smart-board" },
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
      title: lang === "ar" ? "١. أنشئ النشاط" : "1. Create the activity",
      desc: lang === "ar"
        ? "حوّل فكرتك إلى درس أو واجب أو عرض تفاعلي جاهز للمشاركة."
        : "Turn your idea into a lesson, assignment, or interactive presentation ready to share.",
    },
    {
      title: lang === "ar" ? "٢. شارك الرابط" : "2. Share the link",
      desc: lang === "ar"
        ? "أرسل الرابط أو رمز الدخول ليصل طلابك إلى التجربة بسهولة."
        : "Send one link or access code so your students can join with ease.",
    },
    {
      title: lang === "ar" ? "٣. ابدأ التفاعل" : "3. Start engaging",
      desc: lang === "ar"
        ? "قدّم المحتوى بطريقة ممتعة وتابع مشاركة الطلاب لحظة بلحظة."
        : "Present engaging content and follow student participation in real time.",
    },
    {
      title: lang === "ar" ? "٤. راجع التقارير" : "4. Review reports",
      desc: lang === "ar"
        ? "حلّل نسبة النجاح والدرجات والتسليمات لتعرف ما يحتاج إلى تحسين."
        : "Analyze success rates, scores, and submissions to see what needs improvement.",
    },
  ];
  const hasVisibleStats = Boolean(stats && !stats.hidden);
  return (
    <Layout noHeader hideFooter>
      <AnimatePresence>
        {showGuestGate && (
          <GuestGateModal onClose={() => setShowGuestGate(false)} />
        )}
        {showQuickChallenge && (
          <QuickChallengeModal onClose={() => setShowQuickChallenge(false)} />
        )}
      </AnimatePresence>

      <HomeLanding
        lang={lang}
        setLang={setLang}
        teacherCount={hasVisibleStats ? (stats?.teacherCount ?? null) : null}
        games={{ tug: showTugGame, xo: true, rocket: true }}
        onPlayGame={handlePublicClick}
        join={{
          slots,
          setSlots,
          pin,
          setPin,
          digitRefs,
          onJoin: handlePinJoin,
          scanner: {
            active: scannerActive,
            error: scannerError,
            success: scannerSuccess,
            videoRef,
            canvasRef,
            start: startScanner,
            stop: stopScanner,
          },
        }}
      />
    </Layout>
  );
}
