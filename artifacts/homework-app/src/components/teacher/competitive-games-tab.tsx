/**
 * ألعاب تنافسية — واجهة منصة تعليمية فاخرة (UI فقط، نفس المنطق والروابط).
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Swords,
  Terminal,
  Trophy,
  X as XIcon,
  Gamepad2,
  Plus,
  Loader2,
  ChevronLeft,
  Medal,
  Search,
  User,
  Radio,
  Users,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui-elements";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL || "";

const BRAND = {
  cream: "#FCFAF8",
  creamDeep: "#F5F0E8",
  green: "#1E4D35",
  greenMid: "#225739",
  gold: "#D9A521",
  goldSoft: "rgba(217, 165, 33, 0.14)",
};

type GameCatalogItem = {
  icon: string;
  title: string;
  desc: string;
  color: string;
  type: string;
  available?: boolean;
  pill?: string;
  _gated?: "maraqui";
};

export interface CompetitiveGamesTabProps {
  t: Record<string, any>;
  lang: string;
  setLocation: (path: string) => void;
  user: { name?: string; isAdmin?: boolean; role?: string } | null | undefined;
  mcqAssignments: Array<{
    id: number;
    title: string;
    subject?: string;
    questionCount?: number;
  }>;
  creatingGameForId: number | null;
  startGame: (assignmentId: number) => void;
  initialOpenWameeth?: boolean;
  onConsumeWameethDeepLink?: () => void;
}

function AmbientBackdrop() {
  return (
    <motion.div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-24 start-[-10%] h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(30,77,53,0.12) 0%, transparent 70%)" }}
      />
      <motion.div
        className="absolute top-[18%] end-[-5%] h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(217,165,33,0.15) 0%, transparent 70%)" }}
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" preserveAspectRatio="none">
        <path
          d="M0 120 Q 280 40 640 100 T 1280 80"
          fill="none"
          stroke="rgba(30,77,53,0.08)"
          strokeWidth="1"
        />
        <path
          d="M0 420 Q 400 360 900 400 T 1400 380"
          fill="none"
          stroke="rgba(217,165,33,0.1)"
          strokeWidth="0.85"
        />
      </svg>
      {[12, 28, 72, 88].map((top, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-[#D9A521]/50"
          style={{ top: `${top}%`, left: `${15 + i * 18}%` }}
          animate={{ opacity: [0.2, 0.7, 0.2], y: [0, -6, 0] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </motion.div>
  );
}

function CompetitivePageHeader({
  isAr,
  user,
}: {
  isAr: boolean;
  user: CompetitiveGamesTabProps["user"];
}) {
  const [query, setQuery] = useState("");

  return (
    <header
      className="sticky top-0 z-30 -mx-4 mb-6 border-b px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14"
      style={{
        background: "rgba(252, 250, 248, 0.88)",
        borderColor: "rgba(30, 77, 53, 0.08)",
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4" dir={isAr ? "rtl" : "ltr"}>
        {/* يمين: شعار */}
        <div className="flex shrink-0 items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt={isAr ? "حصاد" : "Hasad"}
            className="h-9 w-9 rounded-xl object-cover ring-2 ring-[#D9A521]/25 shadow-sm"
          />
          <motion.div className="hidden sm:block">
            <p className="text-sm font-black leading-tight" style={{ color: BRAND.green }}>
              {isAr ? "حصاد" : "Hasad"}
            </p>
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#6b7c72]">HASADX</p>
          </motion.div>
        </div>

        {/* وسط: بحث */}
        <div className="relative min-w-0 flex-1 max-w-xl mx-auto">
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9a90] start-3.5" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? "ابحث عن لعبة أو مسابقة..." : "Search games or quizzes..."}
            className="w-full rounded-2xl border bg-white/80 py-2.5 text-sm font-medium text-[#1a2e24] shadow-sm outline-none transition-all placeholder:text-[#9aab9f] focus:border-[#1E4D35]/25 focus:ring-2 focus:ring-[#1E4D35]/10 ps-10 pe-4"
            style={{ borderColor: "rgba(30, 77, 53, 0.1)" }}
          />
        </div>

        {/* يسار: مستخدم */}
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <motion.div
            className="flex items-center gap-2 rounded-2xl border bg-white/80 py-1.5 ps-1.5 pe-3 shadow-sm"
            style={{ borderColor: "rgba(30, 77, 53, 0.1)" }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white"
              style={{ background: BRAND.green }}
            >
              {user?.name?.charAt(0) ?? <User className="h-4 w-4" />}
            </div>
            <span className="hidden max-w-[88px] truncate text-xs font-bold text-[#1a2e24] md:inline">
              {user?.name ?? (isAr ? "معلّم" : "Teacher")}
            </span>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

function HeroTopCard({
  isAr,
  variant,
  title,
  desc,
  cta,
  badge,
  icon,
  onClick,
}: {
  isAr: boolean;
  variant: "arena" | "public";
  title: string;
  desc: string;
  cta: string;
  badge?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const isArena = variant === "arena";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-[22px] border p-4 text-start shadow-[0_8px_32px_-12px_rgba(30,77,53,0.12)] transition-shadow hover:shadow-[0_16px_40px_-14px_rgba(30,77,53,0.18)] sm:p-5",
        isArena
          ? "border-[#1E4D35]/15 bg-gradient-to-br from-white via-[#f8fbf9] to-[#eef6f0]"
          : "border-[#D9A521]/20 bg-gradient-to-br from-white via-[#fffcf5] to-[#faf5e8]",
      )}
    >
      <div
        className="pointer-events-none absolute -end-8 -top-8 h-32 w-32 rounded-full opacity-50 blur-2xl"
        style={{
          background: isArena
            ? "radial-gradient(circle, rgba(30,77,53,0.12) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(217,165,33,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg ring-1",
            isArena
              ? "bg-gradient-to-br from-[#1E4D35] to-[#2d6b4a] text-white ring-[#D9A521]/20"
              : "bg-gradient-to-br from-[#D9A521] to-[#c4921a] text-white ring-[#D9A521]/30",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <motion.div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-[#1a2e24] sm:text-lg">{title}</h3>
            {badge && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: isArena ? "rgba(30,77,53,0.1)" : BRAND.goldSoft,
                  color: isArena ? BRAND.green : "#8a6d1f",
                }}
              >
                {badge}
              </span>
            )}
          </motion.div>
          <p className="line-clamp-2 text-xs leading-relaxed text-[#5f6f66] sm:text-sm">{desc}</p>
          <span
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold transition-colors group-hover:gap-2"
            style={{ color: BRAND.green }}
          >
            {cta}
            <ChevronLeft className={cn("h-3.5 w-3.5", isAr ? "" : "rotate-180")} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function PageTitleBlock({ isAr }: { isAr: boolean }) {
  const badges = [
    { icon: Radio, ar: "مباشر", en: "Live" },
    { icon: Users, ar: "متعدد اللاعبين", en: "Multiplayer" },
    { icon: Sparkles, ar: "تفاعلي", en: "Interactive" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 text-center sm:mb-10"
    >
      <h1 className="text-2xl font-black tracking-tight text-[#1a2e24] sm:text-3xl">
        {isAr ? "ألعاب تنافسية" : "Competitive learning games"}
      </h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[#5f6f66] sm:text-base">
        {isAr
          ? "مكتبة ألعاب تعليمية تفاعلية ومسابقات مباشرة للطلاب."
          : "A library of interactive educational games and live quizzes for your students."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {badges.map((b) => (
          <span
            key={b.ar}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-3 py-1 text-[11px] font-bold text-[#3d5248] shadow-sm"
            style={{ borderColor: "rgba(30, 77, 53, 0.1)" }}
          >
            <b.icon className="h-3.5 w-3.5 text-[#1E4D35]" strokeWidth={2} />
            {isAr ? b.ar : b.en}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function WameethSilhouettes() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 end-0 h-28 w-40 opacity-[0.07]"
      viewBox="0 0 160 112"
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse
          key={i}
          cx={24 + i * 28}
          cy={28 + (i % 2) * 4}
          rx={10}
          ry={12}
          fill={BRAND.green}
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={`b-${i}`}
          d={`M${14 + i * 28} 42 Q${24 + i * 28} 36 ${34 + i * 28} 42 L${38 + i * 28} 108 H${10 + i * 28} Z`}
          fill={BRAND.green}
        />
      ))}
    </svg>
  );
}

function WameethFeaturedCard({
  isAr,
  onStart,
}: {
  isAr: boolean;
  onStart: () => void;
}) {
  const badges = [
    { ar: "مباشر", en: "Live" },
    { ar: "سريع", en: "Fast" },
    { ar: "متعدد اللاعبين", en: "Multiplayer" },
    { ar: "تفاعلي", en: "Interactive" },
  ];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative col-span-1 overflow-hidden rounded-[26px] border shadow-[0_12px_48px_-16px_rgba(30,77,53,0.15)] sm:col-span-2 lg:col-span-3"
      style={{
        borderColor: "rgba(217, 165, 33, 0.22)",
        background: "linear-gradient(135deg, #ffffff 0%, #f9fbf9 45%, #f5f9f6 100%)",
      }}
    >
      <WameethSilhouettes />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 85% 20%, rgba(217,165,33,0.1) 0%, transparent 55%), radial-gradient(ellipse 40% 40% at 10% 90%, rgba(30,77,53,0.06) 0%, transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7 lg:p-8">
        <div className="flex shrink-0 flex-col items-center sm:items-start">
          <span
            className="mb-3 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={{ background: BRAND.goldSoft, color: "#7a5f12" }}
          >
            {isAr ? "موصى به" : "Recommended"}
          </span>
          <motion.div
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(217,165,33,0.2)",
                "0 0 0 12px rgba(217,165,33,0)",
                "0 0 0 0 rgba(217,165,33,0)",
              ],
            }}
            transition={{ duration: 2.8, repeat: Infinity }}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-2 text-3xl shadow-lg sm:h-20 sm:w-20"
            style={{
              borderColor: "rgba(217, 165, 33, 0.35)",
              background: "linear-gradient(145deg, #fffef9, #f5f9f6)",
            }}
          >
            <Zap className="h-9 w-9 text-[#D9A521]" strokeWidth={2} fill="rgba(217,165,33,0.15)" />
          </motion.div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-start">
          <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-xl font-black text-[#1a2e24] sm:text-2xl">{isAr ? "وميض" : "Wameeth"}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: BRAND.green }}
            >
              {isAr ? "جديد" : "New"}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#5f6f66] sm:text-[15px]">
            {isAr
              ? "لعبة جماعية مباشرة بأسئلة سريعة وتنافس حي بين الطلاب"
              : "A live group game with fast questions and real-time competition among students"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {badges.map((b) => (
              <span
                key={b.ar}
                className="rounded-full border bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-[#3d5248]"
                style={{ borderColor: "rgba(30, 77, 53, 0.1)" }}
              >
                {isAr ? b.ar : b.en}
              </span>
            ))}
          </div>
        </div>

        <motion.button
          type="button"
          onClick={onStart}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="group flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-[0_10px_28px_-10px_rgba(30,77,53,0.45)] sm:w-auto"
          style={{
            background: `linear-gradient(180deg, ${BRAND.greenMid} 0%, ${BRAND.green} 100%)`,
            boxShadow: "0 10px 28px -10px rgba(30,77,53,0.4), 0 0 0 1px rgba(217,165,33,0.15)",
          }}
        >
          {isAr ? "اختر وابدأ" : "Choose & start"}
          <motion.span
            animate={{ x: isAr ? [-2, 2, -2] : [2, -2, 2] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowLeft className={cn("h-4 w-4", isAr ? "" : "rotate-180")} />
          </motion.span>
        </motion.button>
      </div>
    </motion.article>
  );
}

function GameCard({
  game,
  isAr,
  index,
  variant = "default",
  onOpen,
}: {
  game: GameCatalogItem;
  isAr: boolean;
  index: number;
  variant?: "default" | "hack";
  onOpen: () => void;
}) {
  const isHack = variant === "hack" || game.type === "hack";

  const cta =
    game.type === "knowledge_race"
      ? isAr
        ? "اختر واجباً وابدأ"
        : "Pick assignment & start"
      : game.type === "tug_of_war" ||
          game.type === "video_lesson" ||
          game.type === "rocket_race" ||
          game.type === "hotseat"
        ? isAr
          ? "إنشاء غرفة"
          : "Create session"
        : isAr
          ? "فتح اللعبة"
          : "Open game";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group relative flex h-full w-full flex-col rounded-[22px] border p-4 text-start transition-all duration-300 sm:p-5",
          "hover:-translate-y-1 hover:shadow-[0_16px_40px_-14px_rgba(30,77,53,0.14)]",
          isHack
            ? "border-[#1E4D35]/25 bg-gradient-to-br from-[#eef5f0] via-[#e8f2ec] to-[#e2ede6] hover:border-emerald-700/30"
            : "border-[rgba(30,77,53,0.08)] bg-white hover:border-[#1E4D35]/18",
        )}
        style={{
          boxShadow: isHack
            ? "0 8px 28px -12px rgba(30,77,53,0.12), inset 0 1px 0 rgba(255,255,255,0.5)"
            : "0 6px 24px -12px rgba(30,77,53,0.08)",
        }}
      >
        {isHack && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[22px] opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(30,77,53,0.5) 18px, rgba(30,77,53,0.5) 19px), repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(30,77,53,0.5) 18px, rgba(30,77,53,0.5) 19px)",
            }}
          />
        )}
        <div className="relative flex flex-1 flex-col">
          {game.pill && (
            <span
              className={cn(
                "mb-3 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold",
                isHack ? "bg-[#1E4D35]/12 text-[#1E4D35]" : "bg-[#f3f7f4] text-[#4a5f54]",
              )}
            >
              {game.pill}
            </span>
          )}
          <motion.div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-md ring-1",
              isHack
                ? "bg-gradient-to-br from-[#1a3d2c] to-[#2d5c42] text-[#7dffb8] ring-emerald-600/20"
                : `bg-gradient-to-br ${game.color} text-white ring-black/5`,
            )}
          >
            {isHack ? <Terminal className="h-7 w-7" strokeWidth={1.75} /> : game.icon}
          </motion.div>
          <h4 className="text-base font-black leading-snug text-[#1a2e24]">{game.title}</h4>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-[#5f6f66] line-clamp-3 sm:text-sm">
            {game.desc}
          </p>
          <div
            className="mt-4 flex items-center justify-between border-t pt-3"
            style={{ borderColor: "rgba(30, 77, 53, 0.08)" }}
          >
            <span className="text-xs font-bold" style={{ color: BRAND.green }}>
              {cta}
            </span>
            <Gamepad2 className="h-4 w-4 text-[#8a9a90] transition-colors group-hover:text-[#1E4D35]" />
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      <h2 className="text-lg font-black text-[#1a2e24] sm:text-xl">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#5f6f66]">{subtitle}</p>
    </div>
  );
}

export function CompetitiveGamesTab({
  t,
  lang,
  setLocation,
  user,
  mcqAssignments,
  creatingGameForId,
  startGame,
  initialOpenWameeth,
  onConsumeWameethDeepLink,
}: CompetitiveGamesTabProps) {
  const [showWameethModal, setShowWameethModal] = useState(false);
  const [showMaraquiPublic, setShowMaraquiPublic] = useState(false);
  const wameethPickerRef = useRef<HTMLDivElement | null>(null);
  const isAr = lang === "ar";

  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  const maraquiVisible = isAdmin || showMaraquiPublic;

  useEffect(() => {
    fetch(`${BASE}/api/public/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (d?.showMaraqui !== undefined) setShowMaraquiPublic(Boolean(d.showMaraqui));
      });
  }, []);

  useEffect(() => {
    if (!initialOpenWameeth) return;
    setShowWameethModal(true);
    onConsumeWameethDeepLink?.();
  }, [initialOpenWameeth, onConsumeWameethDeepLink]);

  const openGameFromCatalog = (game: { type: string; available?: boolean }) => {
    if (game.available === false) return;
    const { type } = game;
    if (type === "knowledge_race") {
      setShowWameethModal(true);
      return;
    }
    if (type === "tug_of_war") setLocation("/game/tug/create");
    else if (type === "rocket_race") setLocation("/game/rocket/create");
    else if (type === "wheel_of_fortune") setLocation("/game/wheel/create");
    else if (type === "hotseat") setLocation("/game/hotseat/create");
    else if (type === "video_lesson") setLocation("/teacher/video-lesson/new");
    else if (type === "flag_quiz") setLocation("/game/flags");
    else if (type === "capitals") setLocation("/game/capitals");
    else if (type === "color_game") setLocation("/game/color");
    else if (type === "memory_match") setLocation("/game/memory");
    else if (type === "multiplication") setLocation("/game/multiply");
    else if (type === "scramble_words") setLocation("/game/scramble");
    else if (type === "stroop") setLocation("/game/stroop/create");
    else if (type === "maraqui") setLocation("/game/maraqui");
    else if (type === "million") setLocation("/game/million");
    else if (type === "million_team") setLocation("/game/million/team-setup");
    else if (type === "hack") setLocation("/game/hack");
    else if (type === "letrly") setLocation("/game/letrly");
    else if (type === "arena") setLocation("/game/arena");
  };

  const arenaGame = {
    icon: "⚔️",
    title: isAr ? "تحدّي حصاد" : "Hasad Arena",
    desc: isAr
      ? "مسابقة فريقين على شاشة كبيرة — فئات، بطاقات، ووسائل مساعدة استراتيجية."
      : "Two-team big-screen quiz with categories, cards, and strategic helpers.",
    type: "arena",
    available: true,
    pill: isAr ? "شاشة كبيرة" : "Big screen",
  };

  const liveGames: GameCatalogItem[] = [
    {
      icon: "⚡",
      title: t.competitiveGames?.knowledgeRaceTitle || (isAr ? "وميض" : "Wameeth"),
      desc:
        t.competitiveGames?.knowledgeRaceDesc ||
        (isAr
          ? "مسابقة حية على الشاشة — الطلاب يجيبون من هواتفهم."
          : "Live on-screen quiz — students answer on their phones."),
      color: "from-[#1E4D35] to-[#2d6b4a]",
      type: "knowledge_race",
      available: true,
    },
    {
      icon: "🪢",
      title: isAr ? "شد الحبل" : "Tug of War",
      desc: isAr
        ? "فريقان يتنافسان بأسئلة؛ الحبل يتحرك مع كل إجابة صحيحة."
        : "Two teams compete with MCQs; the rope moves with correct answers.",
      color: "from-blue-500 to-indigo-600",
      type: "tug_of_war",
      available: true,
      pill: isAr ? "جماعي" : "Teams",
    },
    {
      icon: "🎡",
      title: isAr ? "عجلة الحظ" : "Wheel of Fortune",
      desc: isAr
        ? "أدر العجلة على شاشة الفصل ومنح النقاط للفرق."
        : "Spin the wheel in class and award team points.",
      color: "from-emerald-600 to-amber-500",
      type: "wheel_of_fortune",
      available: true,
      pill: isAr ? "عرض صفّي" : "Class display",
    },
    {
      icon: "🚀",
      title: isAr ? "سباق الصواريخ" : "Rocket Race",
      desc: isAr ? "كل طالب صاروخ — السرعة والدقة ترتّب المنافسة." : "Each student is a rocket — speed and accuracy climb the ranks.",
      color: "from-violet-500 to-fuchsia-500",
      type: "rocket_race",
      available: true,
      pill: isAr ? "سباق حي" : "Live race",
    },
    {
      icon: "🔥",
      title: isAr ? "الكرسي الساخن" : "Hot Seat",
      desc: isAr
        ? "طالب على الكرسي يجيب ويصوّت الجميع على إجابته."
        : "One student answers while classmates vote on responses.",
      color: "from-orange-500 to-red-500",
      type: "hotseat",
      available: true,
      pill: isAr ? "حوار" : "Dialogue",
    },
    {
      icon: "🏆",
      title: isAr ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc: isAr ? "أسئلة متصاعدة مع أطواق نجاة — مناسبة للسبورة." : "Escalating ladder with lifelines — great for the board.",
      color: "from-amber-500 to-yellow-500",
      type: "million",
      available: true,
      pill: isAr ? "عرض صفّي" : "Display",
    },
    {
      icon: "💻",
      title: isAr ? "لعبة الاختراق" : "Hack Game",
      desc: isAr
        ? "كلمات سر وصناديق ونقاط — تحدٍ تقني مناسب للصف."
        : "Passwords, loot boxes, and points — classroom-friendly tech challenge.",
      color: "from-green-700 to-emerald-800",
      type: "hack",
      available: true,
      pill: isAr ? "تقني" : "Tech",
    },
    {
      icon: "🆚",
      title: isAr ? "مليون — فريق ضد فريق" : "Million — Team vs Team",
      desc: isAr ? "فريقان يصوتان على الأسئلة في الوقت الفعلي." : "Two teams vote on questions in real time.",
      color: "from-blue-500 to-purple-600",
      type: "million_team",
      available: true,
      pill: isAr ? "تصويت" : "Voting",
    },
    {
      icon: "🎬",
      title: isAr ? "فيديو تفاعلي" : "Interactive Video",
      desc: isAr ? "درس فيديو يتوقف عند الأسئلة لقياس الفهم." : "Video pauses for questions to check understanding.",
      color: "from-rose-500 to-red-500",
      type: "video_lesson",
      available: true,
      pill: isAr ? "مرئي" : "Video",
    },
  ];

  const soloGamesAll: GameCatalogItem[] = [
    {
      icon: "🪜",
      title: isAr ? "مَراقي" : "Maraqui",
      desc: isAr ? "مسابقة ثقافية بمراحل متدرجة." : "Progressive cultural quiz ladder.",
      color: "from-teal-500 to-emerald-600",
      type: "maraqui",
      available: true,
      pill: isAr ? "مراحل" : "Stages",
      _gated: "maraqui",
    },
    {
      icon: "🎨",
      title: isAr ? "لعبة الألوان" : "Color Game",
      desc: isAr ? "اعثر على المربع المختلف بسرعة." : "Spot the odd square quickly.",
      color: "from-violet-500 to-fuchsia-500",
      type: "color_game",
      available: true,
      pill: isAr ? "تركيز" : "Focus",
    },
    {
      icon: "🏁",
      title: isAr ? "أعلام الدول" : "Flag Quiz",
      desc: isAr ? "اربط الدول بأعلامها." : "Match countries to flags.",
      color: "from-sky-500 to-indigo-600",
      type: "flag_quiz",
      available: true,
      pill: isAr ? "جغرافيا" : "Geo",
    },
    {
      icon: "🌍",
      title: isAr ? "عواصم البلدان" : "World Capitals",
      desc: isAr ? "حدّد عواصم دول العالم." : "Name world capitals.",
      color: "from-teal-500 to-cyan-600",
      type: "capitals",
      available: true,
      pill: isAr ? "جغرافيا" : "Geo",
    },
    {
      icon: "🧠",
      title: isAr ? "لعبة الذاكرة" : "Memory Match",
      desc: isAr ? "اقلب البطاقات وطابق الأزواج." : "Flip cards and find pairs.",
      color: "from-indigo-500 to-pink-500",
      type: "memory_match",
      available: true,
      pill: isAr ? "ذاكرة" : "Memory",
    },
    {
      icon: "✖️",
      title: isAr ? "جدول الضرب" : "Multiplication",
      desc: isAr ? "سلسلة أسئلة ضرب سريعة." : "Quick multiplication drills.",
      color: "from-orange-500 to-amber-500",
      type: "multiplication",
      available: true,
      pill: isAr ? "رياضيات" : "Math",
    },
    {
      icon: "🧠",
      title: isAr ? "لعبة ارتباك" : "Stroop Game",
      desc: isAr ? "اضغط لون الحبر لا معنى الكلمة." : "Tap ink color, not word meaning.",
      color: "from-red-500 to-orange-500",
      type: "stroop",
      available: true,
      pill: isAr ? "دماغ" : "Brain",
    },
    {
      icon: "🔤",
      title: isAr ? "الكلمات المبعثرة" : "Scrambled Words",
      desc: isAr ? "رتّب الحروف لتكوين الكلمات." : "Unscramble letters into words.",
      color: "from-violet-500 to-fuchsia-500",
      type: "scramble_words",
      available: true,
      pill: isAr ? "إملاء" : "Spelling",
    },
    {
      icon: "🔡",
      title: isAr ? "تحدي الكلمة" : "Word Challenge",
      desc: isAr ? "Wordle بالعربية — كلمة سرّية ومحاولات محدودة." : "Wordle-style Arabic word challenge.",
      color: "from-emerald-500 to-teal-600",
      type: "letrly",
      available: true,
      pill: isAr ? "كلمة" : "Word",
    },
  ];

  const soloGames = soloGamesAll.filter((g) => !g._gated || g._gated !== "maraqui" || maraquiVisible);

  const liveWithoutWameeth = liveGames.filter((g) => g.type !== "knowledge_race");
  const hackGame = liveWithoutWameeth.find((g) => g.type === "hack");
  const liveGridGames = liveWithoutWameeth.filter((g) => g.type !== "hack");

  return (
    <div
      className="relative min-h-full pb-10"
      dir={isAr ? "rtl" : "ltr"}
      style={{ background: BRAND.cream }}
    >
      <AmbientBackdrop />

      <div className="relative">
        <CompetitivePageHeader isAr={isAr} user={user} />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <HeroTopCard
            isAr={isAr}
            variant="arena"
            title={arenaGame.title}
            desc={arenaGame.desc}
            cta={isAr ? "ابدأ التحدي" : "Start challenge"}
            badge={isAr ? "متاح حالياً" : "Available now"}
            icon={<Swords className="h-7 w-7 text-white" strokeWidth={1.75} />}
            onClick={() => openGameFromCatalog(arenaGame)}
          />
          <HeroTopCard
            isAr={isAr}
            variant="public"
            title={isAr ? "مسابقات عامة" : "Public quizzes"}
            desc={
              isAr
                ? "مكتبة مسابقات جاهزة للزوار والطلاب — شاركها برابط أو رمز."
                : "Ready quizzes for visitors and students — share by link or PIN."
            }
            cta={isAr ? "استكشف المكتبة" : "Explore library"}
            icon={<Trophy className="h-7 w-7 text-white" strokeWidth={1.75} />}
            onClick={() => setLocation("/islamic")}
          />
        </motion.div>

        <PageTitleBlock isAr={isAr} />

        {/* مسابقات حية مع الصف */}
        <section className="mb-12 sm:mb-14">
          <SectionHeading
            title={isAr ? "مسابقات حية مع الصفّ" : "Live classroom games"}
            subtitle={
              isAr
                ? "ألعاب جماعية بوقت حقيقي — اربط واجباتك أو أنشئ غرفة وشارك الرمز مع الطلاب."
                : "Real-time group play — tie to assignments or create a room and share the PIN."
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            <WameethFeaturedCard isAr={isAr} onStart={() => setShowWameethModal(true)} />

            {liveGridGames.map((game, i) => (
              <GameCard
                key={game.type}
                game={game}
                isAr={isAr}
                index={i + 1}
                onOpen={() => openGameFromCatalog(game)}
              />
            ))}

            {hackGame && (
              <GameCard
                game={hackGame}
                isAr={isAr}
                index={liveGridGames.length + 1}
                variant="hack"
                onOpen={() => openGameFromCatalog(hackGame)}
              />
            )}
          </div>
        </section>

        {/* تحديات ذكاء فردية */}
        <section className="mb-8">
          <SectionHeading
            title={isAr ? "تحديات ذكاء فردية" : "Solo brain challenges"}
            subtitle={
              isAr
                ? "تمارين تركيز وذاكرة ولغة — للتمرّن الذاتي أو مسابقات الزوار."
                : "Focus, memory, and language drills for solo practice or visitor quizzes."
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {soloGames.map((game, i) => (
              <GameCard
                key={game.type}
                game={game}
                isAr={isAr}
                index={i}
                onOpen={() => openGameFromCatalog(game)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Modal: وميض */}
      <AnimatePresence>
        {showWameethModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setShowWameethModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border bg-[#FCFAF8] shadow-2xl sm:max-w-2xl sm:rounded-2xl"
              style={{ borderColor: "rgba(30, 77, 53, 0.12)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex shrink-0 items-center justify-between gap-3 border-b p-5"
                style={{
                  borderColor: "rgba(30, 77, 53, 0.1)",
                  background: "linear-gradient(90deg, rgba(30,77,53,0.06), rgba(217,165,33,0.08))",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm"
                    style={{ borderColor: "rgba(217,165,33,0.3)", background: "white" }}
                  >
                    <Zap className="h-6 w-6 text-[#D9A521]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#1a2e24]">
                      {isAr ? "وميض — ابدأ مسابقة حية" : "Wameeth — Start live quiz"}
                    </h3>
                    <p className="text-xs text-[#5f6f66]">
                      {isAr ? "اختر الواجب الذي تريد استخدام أسئلته" : "Pick an assignment to power your room"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWameethModal(false)}
                  className="rounded-xl p-2 text-[#5f6f66] transition-colors hover:bg-black/5"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {mcqAssignments.length === 0 ? (
                  <motion.div className="py-12 text-center">
                    <Gamepad2 className="mx-auto mb-4 h-12 w-12 text-[#8a9a90]/40" />
                    <h4 className="mb-2 font-bold text-[#1a2e24]">
                      {isAr ? "لا توجد واجبات بأسئلة" : "No assignments with questions"}
                    </h4>
                    <p className="mb-4 text-sm text-[#5f6f66]">
                      {isAr ? "أنشئ واجباً بأسئلة اختيار من متعدد أولاً" : "Create an MCQ assignment first"}
                    </p>
                    <Button
                      onClick={() => {
                        setShowWameethModal(false);
                        setLocation("/teacher/new");
                      }}
                      className="gap-2 font-bold"
                    >
                      <Plus className="h-4 w-4" />
                      {isAr ? "إنشاء واجب" : "Create assignment"}
                    </Button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {mcqAssignments.map((assignment) => (
                      <button
                        key={assignment.id}
                        type="button"
                        onClick={() => {
                          setShowWameethModal(false);
                          startGame(assignment.id);
                        }}
                        disabled={creatingGameForId === assignment.id}
                        className="group rounded-2xl border bg-white p-4 text-start transition-all hover:border-[#1E4D35]/25 hover:shadow-md disabled:opacity-60"
                        style={{ borderColor: "rgba(30, 77, 53, 0.1)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E4D35]/8">
                            <Gamepad2 className="h-5 w-5 text-[#1E4D35]" />
                          </div>
                          <motion.div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#1a2e24] group-hover:text-[#1E4D35]">
                              {assignment.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#5f6f66]">
                              {assignment.subject} · {assignment.questionCount}{" "}
                              {isAr ? "سؤال" : "questions"}
                            </p>
                          </motion.div>
                          <ChevronLeft
                            className={cn(
                              "h-4 w-4 shrink-0 text-[#8a9a90]",
                              isAr ? "" : "rotate-180",
                            )}
                          />
                        </div>
                        {creatingGameForId === assignment.id && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-medium text-[#1E4D35]">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {isAr ? "جاري الإنشاء..." : "Creating..."}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-2 shrink-0 sm:h-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={wameethPickerRef} id="wameeth-assignment-picker" className="scroll-mt-28" />
    </div>
  );
}

