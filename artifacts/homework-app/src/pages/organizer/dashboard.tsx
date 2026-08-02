import { ArrowUpRight } from "lucide-react";
import {
  WameethIcon,
  HackIcon,
  MemoryIcon,
  LetrlyIcon,
  ScrambleIcon,
  StroopIcon,
  ArenaIcon,
  RocketIcon,
  MillionIcon,
  HotSeatIcon,
  PublicQuizIcon,
  VideoIcon,
  MultiplyIcon,
  FlagQuizIcon,
  CapitalsIcon,
  ColorGameIcon,
  TugWarIcon,
  WheelIcon,
  EscapeVaultIcon,
} from "@/components/game-icons";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentTeacher,
  getGetCurrentTeacherQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  Loader2,
  Trophy,
  Swords,
  Brain,
  Gamepad2,
  Coins,
  BookOpen,
  Wrench,
  ChevronDown,
  ArrowRight,
  Plus,
  Home as HomeIcon,
  History,
  Settings as SettingsIcon,
  Flame,
  Terminal,
  Zap,
  Users,
  Sparkles,
  Play,
  FileText,
  User,
  Rocket,
  Disc3,
  Shuffle,
  Hash,
  Type,
  Eye,
  Palette,
  Calculator,
  MapPin,
  PartyPopper,
  Lightbulb,
  Library,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";

interface OrganizerCard {
  href: string;
  title: string;
  subtitle: string;
  Icon: typeof Trophy;
  /** Optional rich SVG icon — replaces the simple Lucide Icon when provided. */
  svgIcon?: ReactNode;
  /** Hex accent for the icon badge and hover border. */
  accent: string;
  /** Small eyebrow label rendered at the bottom of the card. */
  tag: string;
}

interface SharedAssignment {
  id: number;
  title: string;
  type: string;
  questionCount: number;
  isShared: boolean;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function OrganizerDashboard() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  // The generated `query` option requires `queryKey`; provide it explicitly
  // via the generated helper so we can override `retry` without `any`.
  const { data: teacher, isLoading, error } = useGetCurrentTeacher({
    query: {
      queryKey: getGetCurrentTeacherQueryKey(),
      retry: false,
    },
  });
  const [showExtras, setShowExtras] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  // Shared contests pulled from `/api/assignments/shared` so the organizer can
  // launch a ready-made set of questions in any game without first opening
  // the shared-content page.
  const [sharedContests, setSharedContests] = useState<SharedAssignment[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  // Sidebar tab for the right-side quick-launch panel
  const [sideTab, setSideTab] = useState<"events" | "brain" | "library">("events");

  useEffect(() => {
    if (error) setLocation("/login");
  }, [error, setLocation]);

  // Live connected-participants counter, polled every 15s.
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/public/active-games-count`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setLiveCount(typeof data?.count === "number" ? data.count : 0);
      } catch {
        // ignore network errors silently
      }
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Fetch shared contests once. We only show items with at least one question
  // so the organizer never sees something that can't actually launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Organizer dashboard surfaces "ready-to-play contests" only —
        // ask the server to filter to contentKind='competition' so we
        // don't accidentally render homework activities here.
        const r = await fetch(`${API_BASE}/api/assignments/shared?kind=competition`, {
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as SharedAssignment[];
        if (!cancelled) {
          setSharedContests(
            (Array.isArray(data) ? data : []).filter(
              (a) => (a.questionCount ?? 0) > 0,
            ),
          );
        }
      } catch {
        /* network errors are non-fatal here */
      } finally {
        if (!cancelled) setSharedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Launch a shared contest as a generic solo game and jump the organizer
  // straight into the live host screen. Mirrors the helper used on the
  // SharedContent page so behaviour stays consistent.
  const launchSharedContest = (assignmentId: number) => {
    if (launchingId !== null) return;
    setLaunchingId(assignmentId);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId, gameMode: "solo" },
      (res: { pin?: string; error?: string }) => {
        setLaunchingId(null);
        if (res?.error || !res?.pin) {
          toast.error(
            res?.error ||
              (lang === "ar" ? "تعذّر بدء المسابقة" : "Failed to start"),
          );
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      },
    );
  };

  // Secondary game tiles. The hero arena card is rendered separately above.
  const liveGames: OrganizerCard[] = useMemo(
    () => [
      {
        href: "/game/secret",
        title: lang === "ar" ? "اكتشف السر 🔍" : "Discover the Secret",
        subtitle:
          lang === "ar"
            ? "أظهر صورة تدريجياً — الفريق الأول الذي يعرف السر يفوز"
            : "Reveal an image tile by tile — first team to name the secret wins",
        Icon: Eye,
        accent: "#7c3aed",
        tag: lang === "ar" ? "بث مباشر · صور" : "Live · Images",
      },
      {
        href: "/game/wameeth/create",
        title: lang === "ar" ? "وميض" : "Wameedh",
        subtitle:
          lang === "ar"
            ? "غرفة مباشرة برمز PIN، يدخلها طلابك ويبدأ السباق على الإجابات"
            : "Live PIN room your students join and race to answer",
        Icon: Zap,
        svgIcon: <WameethIcon height={44} />,
        accent: "#E8A80E",
        tag: lang === "ar" ? "اللعبة الافتراضية · بث مباشر" : "Default · Live",
      },
      {
        href: "/game/rocket/create",
        title: lang === "ar" ? "سباق الصواريخ" : "Rocket Race",
        subtitle:
          lang === "ar"
            ? "مغامرة الفضاء — أسئلة سريعة وصواريخ تتسابق نحو الفوز"
            : "Space adventure — fast questions, rockets race to win",
        Icon: Rocket,
        svgIcon: <RocketIcon size={52} />,
        accent: "#60a5fa",
        tag: lang === "ar" ? "بث مباشر · سرعة" : "Live · Speed",
      },
      {
        href: "/game/hotseat/create",
        title: lang === "ar" ? "الكرسي الساخن" : "Hot Seat",
        subtitle:
          lang === "ar"
            ? "طالب واحد في المقعد، أسئلة مباشرة، الكل يتابع"
            : "One student in the seat, live questions, everyone watching",
        Icon: Flame,
        svgIcon: <HotSeatIcon size={52} />,
        accent: "#fb7185",
        tag: lang === "ar" ? "بث مباشر · فردي" : "Live · Solo spotlight",
      },
      {
        href: "/game/million",
        title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wins a Million?",
        subtitle:
          lang === "ar"
            ? "مسابقة منوّعة على الطريقة التلفزيونية"
            : "TV-style elimination contest",
        Icon: Coins,
        svgIcon: <MillionIcon size={52} />,
        accent: "#a78bfa",
        tag: lang === "ar" ? "تلفزيوني · إقصائي" : "TV · Elimination",
      },
      {
        href: "/game/hack",
        title: lang === "ar" ? "لعبة الاختراق" : "Infiltration",
        subtitle:
          lang === "ar"
            ? "اقتحم الأسئلة، اسرق نقاط الخصوم، وفُكّ الأكواد"
            : "Crack questions, steal opponents' points, and break codes",
        Icon: Terminal,
        svgIcon: <HackIcon size={52} />,
        accent: "#818cf8",
        tag: lang === "ar" ? "بث مباشر · استراتيجي" : "Live · Strategic",
      },
      {
        href: "/game/tug/create",
        title: lang === "ar" ? "شد الحبل" : "Tug of War",
        subtitle:
          lang === "ar"
            ? "فريقان وجهاً لوجه — كل إجابة صحيحة تشد الحبل لطرفك"
            : "Two teams face-off — every right answer pulls the rope",
        Icon: Users,
        svgIcon: <TugWarIcon size={52} />,
        accent: "#94a3b8",
        tag: lang === "ar" ? "بث مباشر · فريقان" : "Live · Two teams",
      },
      {
        href: "/game/escape/create",
        title: lang === "ar" ? "غرفة الهروب" : "Escape Room",
        subtitle:
          lang === "ar"
            ? "غرفة هروب تعليمية — فكّكوا الأقفال بالإجابات واهربوا قبل انتهاء الوقت"
            : "Educational escape room — break the locks with answers and escape in time",
        Icon: Lock,
        svgIcon: <EscapeVaultIcon size={52} />,
        accent: "#f7c948",
        tag: lang === "ar" ? "تعاوني · صف أو أجهزة" : "Co-op · Class or devices",
      },
      {
        href: "/game/wheel/create",
        title: lang === "ar" ? "عجلة الحظ" : "Wheel of Fortune",
        subtitle:
          lang === "ar"
            ? "أدِر العجلة لاختيار الفائز، السؤال أو الجائزة"
            : "Spin the wheel to pick a winner, question, or prize",
        Icon: Disc3,
        svgIcon: <WheelIcon size={52} />,
        accent: "#f472b6",
        tag: lang === "ar" ? "ترفيهي · حظ" : "Casual · Luck",
      },
    ],
    [lang],
  );

  // Solo brain games rendered as a single contained box (group of mini
  // competitions) instead of a generic "Solo Brain" tile, per the organizer
  // spec. Each entry jumps to its dedicated setup page.
  const soloBrainGames = useMemo(
    () => [
      {
        href: "/game/letrly",
        title: lang === "ar" ? "حروفي" : "Letrly",
        Icon: Type,
        svgIcon: <LetrlyIcon size={44} />,
        tint: "#a78bfa",
      },
      {
        href: "/game/scramble",
        title: lang === "ar" ? "خلط الحروف" : "Word Scramble",
        Icon: Shuffle,
        svgIcon: <ScrambleIcon size={44} />,
        tint: "#34d399",
      },
      {
        href: "/game/memory",
        title: lang === "ar" ? "ذاكرة" : "Memory",
        Icon: Brain,
        svgIcon: <MemoryIcon size={44} />,
        tint: "#f472b6",
      },
      {
        href: "/game/multiply",
        title: lang === "ar" ? "جدول الضرب" : "Times Tables",
        Icon: Calculator,
        svgIcon: <MultiplyIcon size={44} />,
        tint: "#60a5fa",
      },
      {
        href: "/game/stroop",
        title: lang === "ar" ? "ستروب" : "Stroop",
        Icon: Eye,
        svgIcon: <StroopIcon size={44} />,
        tint: "#fb923c",
      },
      {
        href: "/game/color",
        title: lang === "ar" ? "الألوان" : "Colors",
        Icon: Palette,
        svgIcon: <ColorGameIcon size={44} />,
        tint: "#22d3ee",
      },
      {
        href: "/game/maraqui",
        title: lang === "ar" ? "مراقي" : "Maraqui",
        Icon: Hash,
        tint: "#facc15",
      },
      {
        href: "/game/capitals",
        title: lang === "ar" ? "عواصم" : "Capitals",
        Icon: MapPin,
        svgIcon: <CapitalsIcon height={36} />,
        tint: "#0ea5e9",
      },
    ],
    [lang],
  );

  // Games for gatherings, events, visits — shown in sidebar tab 1
  const gatheringsGames = useMemo(
    () => [
      {
        href: "/game/arena",
        title: lang === "ar" ? "تحدّي حصاد 🏆" : "Hasad Arena 🏆",
        subtitle:
          lang === "ar"
            ? "تحدٍّ بين فريقين أو أكثر — ٦ فئات، أسئلة بقيم متصاعدة ومساعدات استراتيجية. مثالي للحفلات والتجمعات والزيارات."
            : "Multi-team challenge — 6 categories, escalating values. Built for events and gatherings.",
        Icon: Swords,
        svgIcon: <ArenaIcon size={44} />,
        accent: "#1f8246",
        btnLabel: lang === "ar" ? "ابدأ التحدّي" : "Start challenge",
      },
      {
        href: "/islamic",
        title: lang === "ar" ? "مسابقات عامة 📚" : "General Quizzes 📚",
        subtitle:
          lang === "ar"
            ? "بنك أسئلة متنوّعة جاهزة للتجمعات والزيارات والمناسبات — انطلق فوراً بلا تحضير."
            : "Ready question bank for visits, gatherings, and school events — start instantly.",
        Icon: BookOpen,
        svgIcon: <PublicQuizIcon size={44} />,
        accent: "#0e7490",
        btnLabel: lang === "ar" ? "ابدأ" : "Start",
      },
    ],
    [lang],
  );

  // Simplified desktop sidebar items per spec
  const sidebarItems = [
    {
      href: "/organizer",
      label: lang === "ar" ? "الرئيسية" : "Home",
      Icon: HomeIcon,
    },
    {
      href: "/teacher/solo-challenges",
      label: lang === "ar" ? "مسابقة ذاتية" : "Self Challenge",
      Icon: Zap,
    },
    {
      href: "/teacher/sessions",
      label: lang === "ar" ? "مسابقاتي السابقة" : "Past Contests",
      Icon: History,
    },
    {
      href: "/teacher/settings",
      label: lang === "ar" ? "الإعدادات" : "Settings",
      Icon: SettingsIcon,
    },
  ];

  // Mobile bottom-nav items per spec. The "Start" tab now opens the
  // assignment-only creation flow (with `?contest=1`) instead of the generic
  // "what do you want to create?" picker.
  const mobileNav = [
    { href: "/organizer", label: lang === "ar" ? "الرئيسية" : "Home", Icon: HomeIcon },
    { href: "/teacher/new/assignment?contest=1", label: lang === "ar" ? "ابدأ مسابقة" : "Start", Icon: Plus, primary: true },
    { href: "/teacher/solo-challenges", label: lang === "ar" ? "مسابقة ذاتية" : "Self Challenge", Icon: Zap },
    { href: "/teacher/sessions", label: lang === "ar" ? "السابقة" : "Past", Icon: History },
  ];

  // Teacher tools shown collapsed under "أدوات إضافية"
  const extras = [
    {
      href: "/teacher",
      label: lang === "ar" ? "لوحة المعلّم" : "Teacher Dashboard",
    },
    {
      href: "/teacher/students",
      label: lang === "ar" ? "صفوفي وطلابي" : "My Classes & Students",
    },
    {
      href: "/teacher/library",
      label: lang === "ar" ? "مكتبتي" : "My Library",
    },
    {
      href: "/teacher/question-bank",
      label: lang === "ar" ? "بنك الأسئلة" : "Question Bank",
    },
    {
      href: "/teacher/categories",
      label: lang === "ar" ? "الفئات" : "Categories",
    },
    {
      href: "/teacher/collections",
      label: lang === "ar" ? "المجموعات" : "Collections",
    },
    {
      href: "/teacher/library/homework",
      label: lang === "ar" ? "مكتبة الأنشطة" : "Activities Library",
    },
    {
      href: "/teacher/library/competitions",
      label: lang === "ar" ? "مكتبة المسابقات" : "Competitions Library",
    },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#E8A80E" }} />
        </div>
      </Layout>
    );
  }

  if (!teacher) return null;

  const formattedLive =
    liveCount === null
      ? "…"
      : (liveCount as number).toLocaleString(lang === "ar" ? "ar-EG" : "en");

  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-[calc(100vh-5rem)] pb-24 lg:pb-10 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg,#f4fbef 0%,#fff8e3 45%,#eaf6ff 100%)",
        }}
      >
        {/* Playful floating background blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute"
            style={{
              top: -120,
              [dir === "rtl" ? "left" : "right"]: -100,
              width: 380,
              height: 380,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(215,165,29,0.30) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
          <div
            className="absolute"
            style={{
              top: 200,
              [dir === "rtl" ? "right" : "left"]: -120,
              width: 340,
              height: 340,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: 150,
              [dir === "rtl" ? "left" : "right"]: 80,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(96,165,250,0.20) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </div>

        {/* ── Desktop layout: flex row. In RTL the first child is on the RIGHT ── */}
        <div className="lg:flex lg:min-h-screen relative">

          {/* ══════════ RIGHT SIDEBAR (desktop only) ════════════════════════════
               In RTL flex the first child is placed at flex-start = RIGHT side.
               Three tabs: (1) games for gatherings, (2) brain games, (3) library */}
          <aside
            className="hidden lg:flex flex-col w-[296px] shrink-0 sticky top-0 h-screen overflow-y-auto"
            style={{
              background: "rgba(255,255,255,0.76)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              borderInlineEnd: "1.5px solid rgba(215,165,29,0.22)",
              boxShadow: "4px 0 24px -12px rgba(15,55,32,0.10)",
            }}
          >
            {/* Sidebar header */}
            <div
              className="px-4 pt-5 pb-3 border-b"
              style={{ borderColor: "rgba(215,165,29,0.18)" }}
            >
              <>
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-1"
                  style={{ color: "rgba(27,107,63,0.55)" }}
                >
                  {lang === "ar" ? "لوحة التشغيل السريع" : "Quick Launch"}
                </p>
                <p className="text-sm font-extrabold" style={{ color: "#103d2a" }}>
                  {lang === "ar" ? "اختر وانطلق 🚀" : "Pick & go 🚀"}
                </p>
              </>
            </div>

            {/* Tab selector */}
            <div
              className="flex border-b"
              style={{ borderColor: "rgba(215,165,29,0.18)" }}
            >
              {(
                [
                  { id: "events", icon: <PartyPopper className="w-3.5 h-3.5" />, label: lang === "ar" ? "فعاليات" : "Events" },
                  { id: "brain",  icon: <Lightbulb className="w-3.5 h-3.5" />,  label: lang === "ar" ? "تحدي وذكاء" : "Brain" },
                  { id: "library",icon: <Library className="w-3.5 h-3.5" />,    label: lang === "ar" ? "المكتبة" : "Library" },
                ] as const
              ).map((tab) => {
                const active = sideTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSideTab(tab.id)}
                    className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-extrabold transition-all"
                    style={
                      active
                        ? {
                            color: "#1b6b3f",
                            borderBottom: "2.5px solid #d7a51d",
                            background: "rgba(215,165,29,0.07)",
                          }
                        : { color: "rgba(27,107,63,0.45)", borderBottom: "2.5px solid transparent" }
                    }
                  >
                    <span style={{ color: active ? "#d7a51d" : "inherit" }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab 1: ألعاب للقاءات والجمعات والزيارات ── */}
            {sideTab === "events" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: "rgba(27,107,63,0.55)" }}
                >
                  {lang === "ar" ? "ألعاب للقاءات والجمعات والزيارات" : "Games for Gatherings & Events"}
                </p>
                {gatheringsGames.map((g) => (
                  <Link key={g.href} href={g.href}>
                    <div
                      className="group rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(160deg,#ffffff 0%,${g.accent}0d 100%)`,
                        border: `1.5px solid ${g.accent}40`,
                        boxShadow: `0 6px 18px -10px ${g.accent}50`,
                      }}
                    >
                      <div
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{
                          top: -30,
                          [dir === "rtl" ? "left" : "right"]: -30,
                          width: 90,
                          height: 90,
                          borderRadius: "50%",
                          background: `radial-gradient(circle,${g.accent}28 0%,transparent 70%)`,
                        }}
                      />
                      <div className="relative flex items-start gap-3 mb-3">
                        <div
                          className="shrink-0 flex items-center justify-center transition-transform group-hover:scale-110"
                          style={g.svgIcon ? {
                            filter: `drop-shadow(0 3px 8px ${g.accent}66)`,
                          } : {
                            width: 40, height: 40,
                            borderRadius: 12,
                            background: `linear-gradient(135deg,${g.accent}28 0%,${g.accent}14 100%)`,
                            border: `1.5px solid ${g.accent}55`,
                            color: g.accent,
                            boxShadow: `0 4px 12px -6px ${g.accent}70`,
                          }}
                        >
                          {g.svgIcon ?? <g.Icon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="text-[14px] font-black leading-snug tracking-tight"
                            style={{ color: "#103d2a" }}
                          >
                            {g.title}
                          </h3>
                        </div>
                      </div>
                      <p
                        className="relative text-[12px] leading-relaxed mb-3"
                        style={{ color: "#3a6a4d" }}
                      >
                        {g.subtitle}
                      </p>
                      <span
                        className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold transition-all group-hover:brightness-110"
                        style={{
                          background: `linear-gradient(135deg,${g.accent}22 0%,${g.accent}14 100%)`,
                          color: g.accent,
                          border: `1.5px solid ${g.accent}45`,
                        }}
                      >
                        <Play className="w-3 h-3" />
                        {g.btnLabel}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* ── Tab 2: ألعاب تحدي وذكاء ── */}
            {sideTab === "brain" && (
              <div className="flex-1 overflow-y-auto p-4">
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: "rgba(27,107,63,0.55)" }}
                >
                  {lang === "ar" ? "ألعاب تحدي وذكاء" : "Challenge & Brain Games"}
                </p>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
                >
                  {soloBrainGames.map((g) => (
                    <Link key={g.href} href={g.href}>
                      <div
                        className="group flex flex-col items-center justify-center gap-2 px-2 py-3.5 rounded-xl transition-all hover:-translate-y-1 cursor-pointer"
                        style={{
                          background: `linear-gradient(180deg,#ffffff 0%,${g.tint}0e 100%)`,
                          border: `1.5px solid ${g.tint}40`,
                          boxShadow: `0 4px 10px -6px ${g.tint}40`,
                        }}
                      >
                        <div
                          className="flex items-center justify-center transition-transform group-hover:scale-110"
                          style={g.svgIcon ? {
                            filter: `drop-shadow(0 3px 8px ${g.tint}66)`,
                          } : {
                            width: 40, height: 40,
                            borderRadius: 12,
                            background: `linear-gradient(135deg,${g.tint}26 0%,${g.tint}14 100%)`,
                            border: `1.5px solid ${g.tint}55`,
                            color: g.tint,
                            boxShadow: `0 4px 10px -6px ${g.tint}66`,
                          }}
                        >
                          {g.svgIcon ?? <g.Icon className="w-5 h-5" />}
                        </div>
                        <span
                          className="text-[12px] font-extrabold text-center leading-tight"
                          style={{ color: "#103d2a" }}
                        >
                          {g.title}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/games"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
                  style={{
                    color: "#6d28d9",
                    background: "rgba(167,139,250,0.14)",
                    border: "1px solid rgba(167,139,250,0.32)",
                  }}
                >
                  {lang === "ar" ? "كل الألعاب" : "All games"}
                  <ArrowRight
                    className="w-3 h-3"
                    style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }}
                  />
                </Link>
              </div>
            )}

            {/* ── Tab 3: مكتبة + عروض ── */}
            {sideTab === "library" && (
              <div className="flex-1 overflow-y-auto p-4">
                {/* 3 direct-navigation shortcut links */}
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: "rgba(27,107,63,0.55)" }}
                >
                  {lang === "ar" ? "المكتبات والعروض" : "Libraries & Presentations"}
                </p>
                <div className="space-y-1.5 mb-4">
                  {(
                    [
                      {
                        href: "/teacher/library/competitions",
                        title: lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library",
                        Icon: Library,
                        accent: "#0e7490",
                        bg: "rgba(34,211,238,0.10)",
                      },
                      {
                        href: "/teacher/library/homework",
                        title: lang === "ar" ? "مكتبة الأنشطة" : "Activities Library",
                        Icon: BookOpen,
                        accent: "#1b6b3f",
                        bg: "rgba(27,107,63,0.09)",
                      },
                      {
                        href: "/teacher/presentations",
                        title: lang === "ar" ? "العروض التفاعلية" : "Interactive Presentations",
                        Icon: Play,
                        accent: "#7c3aed",
                        bg: "rgba(124,58,237,0.08)",
                      },
                    ] as const
                  ).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-extrabold text-start transition-all hover:-translate-y-0.5"
                      style={{
                        background: "#fff",
                        border: "1.5px solid rgba(215,165,29,0.20)",
                        color: "#103d2a",
                        boxShadow: "0 2px 8px -4px rgba(15,55,32,0.08)",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: item.bg, color: item.accent }}
                      >
                        <item.Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="flex-1 leading-tight">{item.title}</span>
                    </Link>
                  ))}
                </div>

                {/* Divider */}
                <div
                  className="border-t mb-3"
                  style={{ borderColor: "rgba(215,165,29,0.18)" }}
                />

                {/* Quick-launch competition cards */}
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: "rgba(27,107,63,0.55)" }}
                >
                  {lang === "ar" ? "تشغيل سريع" : "Quick launch"}
                </p>
                {sharedLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#0e7490" }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold">{lang === "ar" ? "جاري التحميل…" : "Loading…"}</span>
                  </div>
                ) : sharedContests.length === 0 ? (
                  <p className="text-center text-xs py-8" style={{ color: "#6b7280" }}>
                    {lang === "ar" ? "لا توجد مسابقات حتى الآن" : "No competitions yet"}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {sharedContests.map((c) => (
                      <div
                        key={c.id}
                        className="group rounded-xl p-3 flex flex-col gap-2.5 relative overflow-hidden"
                        style={{
                          background: "linear-gradient(180deg,#ffffff 0%,#fffaeb 100%)",
                          border: "1.5px solid rgba(215,165,29,0.28)",
                          boxShadow: "0 4px 12px -8px rgba(215,165,29,0.28)",
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              background: "rgba(215,165,29,0.14)",
                              border: "1.5px solid rgba(215,165,29,0.35)",
                              color: "#b88712",
                            }}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-[13px] font-black leading-snug line-clamp-2 tracking-tight"
                              style={{ color: "#103d2a" }}
                            >
                              {c.title}
                            </h3>
                            <div
                              className="flex items-center gap-2 mt-1 text-[10px] font-semibold"
                              style={{ color: "#6b7280" }}
                            >
                              <span className="inline-flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {c.questionCount} {lang === "ar" ? "سؤال" : "Qs"}
                              </span>
                              {c.teacherName && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <User className="w-3 h-3" />
                                  <span className="truncate">{c.teacherName}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={launchingId !== null}
                          onClick={() => launchSharedContest(c.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-extrabold transition-all hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            background: "linear-gradient(135deg,#f0a929 0%,#d7a51d 100%)",
                            color: "#143b28",
                            boxShadow: "0 6px 14px -6px rgba(215,165,29,0.55)",
                          }}
                        >
                          {launchingId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          {lang === "ar" ? "ابدأها الآن" : "Launch now"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ══════════ MAIN CONTENT ════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0">

        <div className="container mx-auto px-4 py-10 max-w-5xl relative">
          {/* Editorial top bar: welcome + live-counter chip. */}
          <motion.section
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8 sm:mb-10"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-4 border-b"
              style={{ borderColor: "rgba(215,165,29,0.32)" }}
            >
              <div className="min-w-0">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-2 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(215,165,29,0.14)",
                    color: "#9a6f0c",
                    border: "1px solid rgba(215,165,29,0.30)",
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  {lang === "ar" ? "لوحة المنظّم" : "Organizer"}
                </div>
                <h1
                  className="text-2xl sm:text-3xl font-black leading-tight tracking-tight truncate"
                  style={{ color: "#103d2a" }}
                >
                  {lang === "ar"
                    ? `أهلاً ${teacher.name} 👋`
                    : `Welcome, ${teacher.name} 👋`}
                </h1>
                <p className="text-sm mt-1.5" style={{ color: "#1b6b3f" }}>
                  {lang === "ar"
                    ? "اختر تجربة ممتعة وابدأ الحماس في ثوانٍ ✨"
                    : "Pick a fun experience and start the hype in seconds ✨"}
                </p>
              </div>
              <div
                className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-2 self-start sm:self-auto shrink-0"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(34,197,94,0.30)",
                  boxShadow: "0 6px 18px -8px rgba(34,197,94,0.30)",
                }}
              >
                <span className="relative inline-flex w-2 h-2 rounded-full"
                  style={{
                    background: "#16a34a",
                    boxShadow: "0 0 0 3px rgba(34,197,94,0.22)",
                  }}
                >
                  <span className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: "rgba(34,197,94,0.55)" }}
                  />
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#15803d" }}
                >
                  {lang === "ar" ? "متّصلون" : "Live"}
                </span>
                <span
                  className="text-sm font-extrabold tabular-nums leading-none"
                  style={{ color: "#103d2a" }}
                >
                  {formattedLive}
                </span>
              </div>
            </div>
          </motion.section>

          {/* Desktop quick nav. */}
          <nav
            className="hidden lg:flex items-center gap-1.5 mb-8 flex-wrap"
            aria-label={lang === "ar" ? "تنقّل المنظّم" : "Organizer nav"}
          >
            {sidebarItems.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(27,107,63,0.18)",
                  color: "#1b6b3f",
                  boxShadow: "0 4px 12px -6px rgba(27,107,63,0.18)",
                }}
              >
                <it.Icon className="w-3.5 h-3.5" style={{ color: "#d7a51d" }} />
                {it.label}
              </Link>
            ))}
            <span className="flex-1" />
            {/* Primary CTA. */}
            <Link
              href="/teacher/new/assignment?contest=1"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-extrabold transition-all hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background:
                  "linear-gradient(135deg,#f0a929 0%,#f5c34a 50%,#d7a51d 100%)",
                color: "#143b28",
                boxShadow: "0 12px 28px -10px rgba(215,165,29,0.60)",
              }}
            >
              {lang === "ar" ? "إنشاء أسئلة جديدة" : "Create new questions"}
              <Plus className="w-4 h-4" />
            </Link>
          </nav>

          {/* ─────────────────────────────────────────────
               Section: منافسات بأسئلة جاهزة
               (تحدّي حصاد + مسابقات عامة — no assignment needed)
          ───────────────────────────────────────────── */}
          <section className="mb-10">
            {/* Section header */}
            <div className="mb-4 flex items-end gap-3">
              <div>
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(215,165,29,0.14)",
                    color: "#9a6f0c",
                    border: "1px solid rgba(215,165,29,0.28)",
                  }}
                >
                  <Trophy className="w-3 h-3" />
                  {lang === "ar" ? "جاهزة للانطلاق" : "Ready to play"}
                </div>
                <h2
                  className="text-xl sm:text-2xl font-black tracking-tight"
                  style={{ color: "#103d2a" }}
                >
                  {lang === "ar"
                    ? "منافسات بأسئلة جاهزة 🏆"
                    : "Ready-question contests 🏆"}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "#3a6a4d" }}>
                  {lang === "ar"
                    ? "لا تحتاج إلى إضافة واجب — الأسئلة جاهزة مسبقاً"
                    : "No assignment needed — questions are pre-loaded"}
                </p>
              </div>
              <span
                className="hidden sm:block flex-1 h-px self-end mb-2 mx-4"
                style={{
                  background:
                    "linear-gradient(90deg,transparent,rgba(215,165,29,0.35),transparent)",
                }}
              />
            </div>

            {/* Two-card grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              {/* Card 1 — تحدّي حصاد */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link href="/game/arena">
                  <div
                    className="group relative h-full rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg,#eaf2e6 0%,#dde9d620 100%)",
                      border: "1.5px solid rgba(155,180,140,0.40)",
                      minHeight: 180,
                      boxShadow:
                        "0 8px 24px -10px rgba(80,110,75,0.30), 0 2px 6px rgba(15,55,32,0.05)",
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute pointer-events-none"
                      style={{
                        top: -40,
                        [dir === "rtl" ? "left" : "right"]: -40,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, rgba(245,225,180,0.40) 0%, transparent 70%)",
                      }}
                    />
                    <div className="relative flex flex-col h-full">
                      <div
                        className="self-start mb-4 transition-transform duration-200 group-hover:scale-110"
                        style={{
                          filter:
                            "drop-shadow(0 4px 10px rgba(200,154,58,0.50))",
                        }}
                      >
                        <ArenaIcon size={52} />
                      </div>
                      <h3
                        className="text-[17px] font-black leading-tight mb-1.5 tracking-tight"
                        style={{ color: "#103d2a" }}
                      >
                        {lang === "ar" ? "تحدّي حصاد" : "Hasad Arena"}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "#3a6a4d" }}
                      >
                        {lang === "ar"
                          ? "مسابقة جماعية بين فريقين أمام الجمهور — مناسبة للحفلات والملتقيات"
                          : "Team vs team in front of an audience — perfect for events"}
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center text-[10px] font-bold tracking-[0.10em] uppercase"
                          style={{ color: "#1f8246" }}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full me-2 shrink-0"
                            style={{ background: "#1f8246" }}
                          />
                          {lang === "ar" ? "منافسة جماعية" : "Team contest"}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[12px] font-extrabold px-2.5 py-1 rounded-full transition-all"
                          style={{
                            background: "rgba(31,130,70,0.12)",
                            color: "#1f8246",
                          }}
                        >
                          {lang === "ar" ? "ابدأ" : "Start"}
                          <ArrowRight
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                dir === "rtl" ? "rotate(180deg)" : "none",
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* Card 2 — مسابقات عامة */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.3 }}
              >
                <Link href="/islamic">
                  <div
                    className="group relative h-full rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg,#ffffff 0%,#22d3ee0a 100%)",
                      border: "1.5px solid rgba(34,211,238,0.32)",
                      minHeight: 180,
                      boxShadow:
                        "0 8px 24px -10px rgba(34,211,238,0.30), 0 2px 6px rgba(15,55,32,0.05)",
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute pointer-events-none"
                      style={{
                        top: -40,
                        [dir === "rtl" ? "left" : "right"]: -40,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, rgba(34,211,238,0.20) 0%, transparent 70%)",
                      }}
                    />
                    <div className="relative flex flex-col h-full">
                      <div
                        className="self-start mb-4 transition-transform duration-200 group-hover:scale-110"
                        style={{
                          filter:
                            "drop-shadow(0 4px 10px rgba(34,211,238,0.45))",
                        }}
                      >
                        <PublicQuizIcon size={52} />
                      </div>
                      <h3
                        className="text-[17px] font-black leading-tight mb-1.5 tracking-tight"
                        style={{ color: "#103d2a" }}
                      >
                        {lang === "ar" ? "مسابقات عامة" : "General Quizzes"}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "#3a6a4d" }}
                      >
                        {lang === "ar"
                          ? "بنك أسئلة جاهز للحفلات والفعاليات — بدون إعداد مسبق"
                          : "Ready question bank for events — no prep needed"}
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center text-[10px] font-bold tracking-[0.10em] uppercase"
                          style={{ color: "#22d3ee" }}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full me-2 shrink-0"
                            style={{ background: "#22d3ee" }}
                          />
                          {lang === "ar" ? "بنك أسئلة" : "Question bank"}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[12px] font-extrabold px-2.5 py-1 rounded-full transition-all"
                          style={{
                            background: "rgba(34,211,238,0.12)",
                            color: "#0e7490",
                          }}
                        >
                          {lang === "ar" ? "ابدأ" : "Start"}
                          <ArrowRight
                            className="w-3.5 h-3.5"
                            style={{
                              transform:
                                dir === "rtl" ? "rotate(180deg)" : "none",
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────
               Section: مسابقة ذاتية
          ───────────────────────────────────────────── */}
          <section className="mb-10">
            <div className="mb-4 flex items-end gap-3">
              <div>
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(245,158,11,0.14)",
                    color: "#92400e",
                    border: "1px solid rgba(245,158,11,0.28)",
                  }}
                >
                  <Zap className="w-3 h-3" />
                  {lang === "ar" ? "مسابقة مستقلة" : "Self-paced"}
                </div>
                <h2
                  className="text-xl sm:text-2xl font-black tracking-tight"
                  style={{ color: "#103d2a" }}
                >
                  {lang === "ar" ? "مسابقة ذاتية ⚡" : "Solo Challenge ⚡"}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "#3a6a4d" }}>
                  {lang === "ar"
                    ? "مسابقات مفتوحة بدون جلسة — يتنافس المشاركون في وقتهم ويظهرون في قائمة المتصدرين"
                    : "Open without a session — participants compete at their own pace with a leaderboard"}
                </p>
              </div>
              <span
                className="hidden sm:block flex-1 h-px self-end mb-2 mx-4"
                style={{
                  background:
                    "linear-gradient(90deg,transparent,rgba(245,158,11,0.35),transparent)",
                }}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.3 }}
            >
              <Link href="/teacher/solo-challenges">
                <div
                  className="group relative rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#fffbeb 0%,#fef3c730 100%)",
                    border: "1.5px solid rgba(245,158,11,0.35)",
                    boxShadow: "0 8px 24px -10px rgba(245,158,11,0.30), 0 2px 6px rgba(15,55,32,0.05)",
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{
                      top: -40,
                      [dir === "rtl" ? "left" : "right"]: -40,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "radial-gradient(circle,rgba(245,158,11,0.22) 0%,transparent 70%)",
                    }}
                  />
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                    <div
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                      style={{
                        background: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
                        boxShadow: "0 6px 16px -6px rgba(245,158,11,0.60)",
                      }}
                    >
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[17px] font-black leading-tight mb-1 tracking-tight"
                        style={{ color: "#103d2a" }}
                      >
                        {lang === "ar" ? "إدارة المسابقات الذاتية" : "Manage Solo Challenges"}
                      </h3>
                      <p className="text-[13px] leading-relaxed" style={{ color: "#3a6a4d" }}>
                        {lang === "ar"
                          ? "أنشئ مسابقة، شارك الرابط مع المشاركين، وتابع ترتيبهم في لوحة المتصدرين"
                          : "Create a challenge, share the link with participants, and track their rankings"}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        href="/teacher/solo-challenges/new"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-extrabold transition-all hover:brightness-110"
                        style={{
                          background: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
                          color: "#fff",
                          boxShadow: "0 4px 12px -4px rgba(245,158,11,0.55)",
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {lang === "ar" ? "مسابقة جديدة" : "New challenge"}
                      </Link>
                      <span
                        className="inline-flex items-center gap-1 text-[12px] font-extrabold px-2.5 py-2 rounded-xl transition-all"
                        style={{
                          background: "rgba(245,158,11,0.12)",
                          color: "#92400e",
                          border: "1px solid rgba(245,158,11,0.25)",
                        }}
                      >
                        {lang === "ar" ? "عرض الكل" : "View all"}
                        <ArrowRight
                          className="w-3.5 h-3.5"
                          style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </section>

          {/* Section: live games. */}
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(215,165,29,0.14)",
                  color: "#9a6f0c",
                  border: "1px solid rgba(215,165,29,0.28)",
                }}
              >
                <Zap className="w-3 h-3" />
                {lang === "ar" ? "ألعاب جماعية" : "Live games"}
              </div>
              <h2
                className="text-xl sm:text-2xl font-black tracking-tight"
                style={{ color: "#103d2a" }}
              >
                {lang === "ar" ? "اختر تجربتك 🎮" : "Choose an experience 🎮"}
              </h2>
            </div>
            <span
              className="hidden sm:block flex-1 h-px self-end mb-2 mx-4"
              style={{
                background:
                  "linear-gradient(90deg,transparent,rgba(215,165,29,0.35),transparent)",
              }}
            />
            <span
              className="hidden sm:inline-block text-xs font-extrabold tabular-nums px-2 py-0.5 rounded-full"
              style={{
                color: "#1b6b3f",
                background: "rgba(27,107,63,0.10)",
              }}
            >
              {String(liveGames.length).padStart(2, "0")}
            </span>
          </div>

          {/* Vibrant card grid. */}
          <div
            className="grid gap-3 sm:gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {liveGames.map((c, i) => (
              <motion.div
                key={c.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
              >
                <Link href={c.href}>
                  <div
                    className="organizer-card group relative h-full rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                    style={{
                      background: `linear-gradient(180deg,#ffffff 0%,${c.accent}0a 100%)`,
                      border: `1.5px solid ${c.accent}38`,
                      minHeight: 196,
                      boxShadow: `0 8px 24px -10px ${c.accent}40, 0 2px 6px rgba(15,55,32,0.05)`,
                      ["--accent" as string]: c.accent,
                    }}
                  >
                    {/* Corner sparkle */}
                    <div
                      aria-hidden
                      className="absolute pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{
                        top: -40,
                        [dir === "rtl" ? "left" : "right"]: -40,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${c.accent}30 0%, transparent 70%)`,
                      }}
                    />
                    <div className="relative flex flex-col h-full">
                      <div
                        className="flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 self-start"
                        style={c.svgIcon ? {
                          filter: `drop-shadow(0 4px 12px ${c.accent}55)`,
                        } : {
                          width: 48, height: 48,
                          borderRadius: 12,
                          background: `linear-gradient(135deg,${c.accent}26 0%,${c.accent}14 100%)`,
                          border: `1.5px solid ${c.accent}55`,
                          color: c.accent,
                          boxShadow: `0 6px 18px -8px ${c.accent}80`,
                        }}
                      >
                        {c.svgIcon ?? <c.Icon className="w-5 h-5" />}
                      </div>
                      <h3
                        className="text-[17px] font-black leading-tight mb-1.5 tracking-tight"
                        style={{ color: "#103d2a" }}
                      >
                        {c.title}
                      </h3>
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "#3a6a4d" }}
                      >
                        {c.subtitle}
                      </p>
                      <div className="mt-auto pt-5 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center text-[10px] font-bold tracking-[0.10em] uppercase truncate"
                          style={{ color: c.accent }}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full me-2 shrink-0"
                            style={{ background: c.accent }}
                          />
                          {c.tag}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[12px] font-extrabold transition-all shrink-0 px-2.5 py-1 rounded-full"
                          style={{
                            background: `${c.accent}18`,
                            color: c.accent,
                          }}
                        >
                          {lang === "ar" ? "ابدأ" : "Start"}
                          <ArrowRight
                            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                            style={{
                              transform:
                                dir === "rtl" ? "rotate(180deg)" : "none",
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Section: solo brain games — always visible */}
          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(167,139,250,0.16)",
                    color: "#6d28d9",
                    border: "1px solid rgba(167,139,250,0.32)",
                  }}
                >
                  <Brain className="w-3 h-3" />
                  {lang === "ar" ? "فردي · ذكاء" : "Solo · Brain"}
                </div>
                <h2
                  className="text-xl sm:text-2xl font-black tracking-tight"
                  style={{ color: "#103d2a" }}
                >
                  {lang === "ar" ? "ألعاب الذكاء الفردية 🧠" : "Solo brain games 🧠"}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "#3a6a4d" }}>
                  {lang === "ar"
                    ? "العبها لوحدك أو تحدَّ أصحابك — بدون انتظار"
                    : "Play alone or challenge friends — no waiting"}
                </p>
              </div>
              <span
                className="hidden sm:block flex-1 h-px self-end mb-2 mx-4"
                style={{
                  background:
                    "linear-gradient(90deg,transparent,rgba(167,139,250,0.35),transparent)",
                }}
              />
              <Link
                href="/games"
                className="inline-flex items-center gap-2 text-sm font-extrabold transition-all hover:-translate-y-0.5 shrink-0 px-4 py-2 rounded-xl"
                style={{
                  color: "#fff",
                  background: "linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)",
                  boxShadow: "0 8px 20px -8px rgba(124,58,237,0.55)",
                }}
              >
                <Gamepad2 className="w-4 h-4" />
                {lang === "ar" ? "كل الألعاب" : "All games"}
                <ArrowRight
                  className="w-4 h-4"
                  style={{
                    transform: dir === "rtl" ? "rotate(180deg)" : "none",
                  }}
                />
              </Link>
            </div>
            <div
              className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(160deg,#ffffff 0%,#faf5ff 60%,#f0f9ff 100%)",
                border: "1.5px solid rgba(167,139,250,0.25)",
                boxShadow: "0 12px 32px -16px rgba(167,139,250,0.30)",
              }}
            >
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  top: -60,
                  [dir === "rtl" ? "left" : "right"]: -60,
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(167,139,250,0.20) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex items-center gap-3 mb-5 pb-4 border-b"
                style={{ borderColor: "rgba(167,139,250,0.18)" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg,#a78bfa26 0%,#a78bfa14 100%)",
                    border: "1.5px solid rgba(167,139,250,0.45)",
                    color: "#7c3aed",
                    boxShadow: "0 6px 18px -8px rgba(167,139,250,0.55)",
                  }}
                >
                  <Brain className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-sm font-black leading-tight"
                    style={{ color: "#103d2a" }}
                  >
                    {lang === "ar"
                      ? "تجربة فردية للطلاب"
                      : "Solo experience for students"}
                  </div>
                  <div
                    className="text-[12px] mt-0.5"
                    style={{ color: "#6b7280" }}
                  >
                    {lang === "ar"
                      ? "ألعاب فردية متنوّعة — العبها لوحدك أو تحدَّ أصحابك"
                      : "Individual mini-games — play alone or challenge friends"}
                  </div>
                </div>
              </div>
              <div
                className="relative grid gap-2 sm:gap-2.5"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                }}
              >
                {soloBrainGames.map((g) => (
                  <Link
                    key={g.href}
                    href={g.href}
                    className="group flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl transition-all hover:-translate-y-1"
                    style={{
                      background: `linear-gradient(180deg,#ffffff 0%,${g.tint}0d 100%)`,
                      border: `1.5px solid ${g.tint}40`,
                      boxShadow: `0 4px 12px -6px ${g.tint}40`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center transition-transform group-hover:scale-110"
                      style={g.svgIcon ? {
                        filter: `drop-shadow(0 3px 8px ${g.tint}66)`,
                      } : {
                        width: 44, height: 44,
                        borderRadius: 12,
                        background: `linear-gradient(135deg,${g.tint}26 0%,${g.tint}14 100%)`,
                        border: `1.5px solid ${g.tint}55`,
                        color: g.tint,
                        boxShadow: `0 6px 14px -6px ${g.tint}66`,
                      }}
                    >
                      {g.svgIcon ?? <g.Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className="text-[13px] font-extrabold text-center leading-tight"
                      style={{ color: "#103d2a" }}
                    >
                      {g.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ── Shared contests — visible on mobile only; desktop uses sidebar */}
          {(sharedLoading || sharedContests.length > 0) && (
            <section className="mt-12 lg:hidden">
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <div
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: "rgba(34,211,238,0.16)",
                      color: "#0e7490",
                      border: "1px solid rgba(34,211,238,0.32)",
                    }}
                  >
                    <BookOpen className="w-3 h-3" />
                    {lang === "ar" ? "بنك مشترك" : "Shared library"}
                  </div>
                  <h2
                    className="text-xl sm:text-2xl font-black tracking-tight"
                    style={{ color: "#103d2a" }}
                  >
                    {lang === "ar"
                      ? "مسابقات جاهزة للاستخدام 🚀"
                      : "Contests ready to launch 🚀"}
                  </h2>
                </div>
                <span
                  className="hidden sm:block flex-1 h-px self-end mb-2 mx-4"
                  style={{
                    background:
                      "linear-gradient(90deg,transparent,rgba(34,211,238,0.35),transparent)",
                  }}
                />
                <Link
                  href="/teacher/library/competitions"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-extrabold transition-all hover:-translate-y-0.5 shrink-0 px-3 py-1.5 rounded-full"
                  style={{
                    color: "#0e7490",
                    background: "rgba(34,211,238,0.14)",
                    border: "1px solid rgba(34,211,238,0.32)",
                  }}
                >
                  {lang === "ar" ? "عرض الكل" : "View all"}
                  <ArrowRight
                    className="w-3.5 h-3.5"
                    style={{
                      transform: dir === "rtl" ? "rotate(180deg)" : "none",
                    }}
                  />
                </Link>
              </div>

              {sharedLoading ? (
                <div
                  className="rounded-2xl p-6 flex items-center justify-center gap-3"
                  style={{
                    background: "#fff",
                    border: "1.5px solid rgba(34,211,238,0.22)",
                    color: "#0e7490",
                  }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-bold">
                    {lang === "ar" ? "جاري التحميل…" : "Loading…"}
                  </span>
                </div>
              ) : (
                <div
                  className="grid gap-3 sm:gap-4"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(260px, 1fr))",
                  }}
                >
                  {sharedContests.slice(0, 6).map((c) => (
                    <div
                      key={c.id}
                      className="organizer-card group rounded-2xl p-5 flex flex-col gap-4 transition-all hover:-translate-y-1 relative overflow-hidden"
                      style={{
                        background:
                          "linear-gradient(180deg,#ffffff 0%,#fffaeb 100%)",
                        border: "1.5px solid rgba(215,165,29,0.32)",
                        boxShadow:
                          "0 8px 24px -10px rgba(215,165,29,0.30), 0 2px 6px rgba(15,55,32,0.05)",
                        ["--accent" as string]: "#d7a51d",
                      }}
                    >
                      <div
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{
                          top: -40,
                          [dir === "rtl" ? "left" : "right"]: -40,
                          width: 120,
                          height: 120,
                          borderRadius: "50%",
                          background:
                            "radial-gradient(circle, rgba(215,165,29,0.22) 0%, transparent 70%)",
                        }}
                      />
                      <div className="relative flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg,#d7a51d26 0%,#d7a51d14 100%)",
                            border: "1.5px solid rgba(215,165,29,0.45)",
                            color: "#b88712",
                            boxShadow: "0 6px 14px -6px rgba(215,165,29,0.55)",
                          }}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="text-[15px] font-black leading-snug line-clamp-2 tracking-tight"
                            style={{ color: "#103d2a" }}
                          >
                            {c.title}
                          </h3>
                          <div
                            className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold"
                            style={{ color: "#6b7280" }}
                          >
                            <span className="inline-flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {c.questionCount}{" "}
                              {lang === "ar" ? "سؤال" : "Qs"}
                            </span>
                            {c.teacherName && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <User className="w-3 h-3" />
                                <span className="truncate">
                                  {c.teacherName}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={launchingId !== null}
                        onClick={() => launchSharedContest(c.id)}
                        className="relative mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-extrabold transition-all hover:brightness-110 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background:
                            "linear-gradient(135deg,#f0a929 0%,#d7a51d 100%)",
                          color: "#143b28",
                          boxShadow:
                            "0 8px 20px -8px rgba(215,165,29,0.55)",
                        }}
                      >
                        {launchingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {lang === "ar" ? "ابدأها الآن" : "Launch now"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 sm:hidden">
                <Link
                  href="/teacher/library/competitions"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: "rgba(34,211,238,0.14)",
                    border: "1px solid rgba(34,211,238,0.35)",
                    color: "#0e7490",
                  }}
                >
                  {lang === "ar" ? "عرض الكل" : "View all"}
                  <ArrowRight
                    className="w-3.5 h-3.5"
                    style={{
                      transform: dir === "rtl" ? "rotate(180deg)" : "none",
                    }}
                  />
                </Link>
              </div>
            </section>
          )}

          {/* Collapsible extras for teacher tools */}
          <div className="mt-12">
            <button
              type="button"
              onClick={() => setShowExtras((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl transition-all hover:-translate-y-0.5"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(27,107,63,0.18)",
                color: "#103d2a",
                boxShadow: "0 6px 16px -8px rgba(27,107,63,0.20)",
              }}
            >
              <span className="flex items-center gap-2.5 font-extrabold text-sm">
                <Wrench className="w-4 h-4" style={{ color: "#d7a51d" }} />
                {lang === "ar" ? "أدوات إضافية" : "Additional Tools"}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(215,165,29,0.16)",
                    color: "#9a6f0c",
                    border: "1px solid rgba(215,165,29,0.30)",
                  }}
                >
                  {lang === "ar" ? "للمعلّمين" : "Teacher tools"}
                </span>
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  color: "#1b6b3f",
                  transform: showExtras ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <AnimatePresence initial={false}>
              {showExtras && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                    {extras.map((e) => (
                        <Link
                          key={e.href}
                          href={e.href}
                          className="px-4 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                          style={{
                            background: "#fff",
                            border: "1.5px solid rgba(27,107,63,0.14)",
                            color: "#1b6b3f",
                            boxShadow: "0 4px 12px -6px rgba(27,107,63,0.14)",
                          }}
                        >
                          {e.label}
                        </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>{/* end container */}
          </div>{/* end main content flex-1 */}
        </div>{/* end lg:flex wrapper */}

        {/* Mobile bottom navigation per spec — fixed bar visible only on small screens */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
          aria-label={lang === "ar" ? "تنقّل المنظّم (جوال)" : "Organizer mobile nav"}
          dir={dir}
          style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(10px)",
            borderTop: "1.5px solid rgba(215,165,29,0.30)",
            boxShadow: "0 -8px 24px -8px rgba(15,55,32,0.12)",
          }}
        >
          <div className="container mx-auto max-w-6xl px-2">
            <div className="grid grid-cols-3 gap-1 py-2">
              {mobileNav.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-extrabold transition-all hover:-translate-y-0.5"
                  style={{
                    color: it.primary ? "#143b28" : "#1b6b3f",
                    background: it.primary
                      ? "linear-gradient(135deg,#f5c34a,#d7a51d)"
                      : "transparent",
                    boxShadow: it.primary
                      ? "0 10px 24px -8px rgba(215,165,29,0.60)"
                      : undefined,
                  }}
                >
                  <it.Icon className="w-5 h-5" />
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </Layout>
  );
}
