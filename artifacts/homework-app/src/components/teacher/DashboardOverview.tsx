import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ChevronDown, Swords, Lightbulb } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Share2,
  Copy,
  Check,
  Sparkles,
  Trophy,
  Users,
  BookText,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Gamepad2,
  TrendingUp,
  Crown,
  Send,
  Zap,
  Globe,
  Video,
  ArrowUpRight,
  Loader2,
  Search,
  Headphones,
  BarChart2,
  Activity,
  Calendar,
  Pencil,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WameethPreviewCard } from "@/components/teacher/WameethPreviewCard";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";

type TabId =
  | "overview"
  | "assignments"
  | "shared"
  | "competitive"
  | "tools"
  | "videos"
  | "stats"
  | "students";

interface Assignment {
  id: number;
  title: string;
  type?: string | null;
  subject?: string | null;
  questionCount: number;
  submissionCount: number;
  deadline?: string | null;
  createdAt?: string;
}

interface Props {
  user: any;
  assignments: Assignment[] | undefined;
  isLoading: boolean;
  lang: "ar" | "en";
  setLocation: (path: string) => void;
  setActiveTab: (tab: TabId) => void;
  startGame: (assignmentId: number, e?: React.MouseEvent) => void;
  creatingGameForId: number | null;
}

interface ClassInfo {
  name: string;
  studentCount: number;
}

interface TopStudent {
  id: number;
  name: string;
  className?: string | null;
  score: number;
}

const BASE = (import.meta as any).env?.VITE_API_URL || "";

// ─── colours ────────────────────────────────────────────────
const C = {
  green: "#1E4D35",
  greenMid: "#265E42",
  greenLight: "#2d7050",
  greenPale: "rgba(30,77,53,0.07)",
  greenGlow: "rgba(30,77,53,0.18)",
  gold: "#C9920A",
  goldBright: "#E8A80E",
  goldPale: "rgba(201,146,10,0.10)",
  bg: "#EFEDE8",
  surface: "#F7F5F1",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.06)",
  borderMid: "rgba(0,0,0,0.10)",
  text: "#141414",
  text2: "#3D3D3D",
  muted: "#737373",
  subtle: "#A8A8A8",
};

function timeAgo(date: string | undefined, isAr: boolean): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `قبل ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isAr ? `قبل ${days} ي` : `${days}d ago`;
}

function getSubjectEmoji(
  subject?: string | null,
  type?: string | null,
): string {
  if (type === "listening") return "🎧";
  if (!subject) return "📝";
  const s = subject.toLowerCase();
  if (s.includes("إسلام") || s.includes("قرآن") || s.includes("دين"))
    return "📖";
  if (s.includes("رياض") || s.includes("math") || s.includes("حساب"))
    return "🔢";
  if (s.includes("علوم") || s.includes("science")) return "🌍";
  if (s.includes("english") || s.includes("إنجل")) return "🔤";
  if (s.includes("عرب") || s.includes("arab")) return "✍️";
  return "📝";
}

function getSubjectBg(subject?: string | null): string {
  if (!subject) return "rgba(30,77,53,0.09)";
  const s = subject.toLowerCase();
  if (s.includes("رياض") || s.includes("math")) return "rgba(201,146,10,0.10)";
  if (s.includes("علوم") || s.includes("science"))
    return "rgba(37,99,235,0.09)";
  if (s.includes("english") || s.includes("إنجل"))
    return "rgba(239,68,68,0.09)";
  if (s.includes("إسلام") || s.includes("قرآن")) return "rgba(109,40,217,0.09)";
  return "rgba(30,77,53,0.09)";
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function DashboardOverview({
  user,
  assignments,
  isLoading,
  lang,
  setLocation,
  setActiveTab,
  startGame,
  creatingGameForId,
}: Props) {
  const isAr = lang === "ar";
  const isMobile = useIsMobile();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try {
      return localStorage.getItem("hasad_onboarding_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const { data: classes = [] } = useQuery<ClassInfo[]>({
    queryKey: ["dashboard-overview", "classes"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/classes`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data)
        ? data.map((c: any) => ({
            name: c.name,
            studentCount: c.studentCount ?? 0,
          }))
        : [];
    },
  });

  const stats = useMemo(() => {
    const list = assignments || [];
    const totalSubmissions = list.reduce(
      (acc, a) => acc + (a.submissionCount || 0),
      0,
    );
    const now = Date.now();
    const active = list.filter(
      (a) => !a.deadline || new Date(a.deadline).getTime() >= now,
    ).length;
    const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
    const avgRate =
      list.length > 0 && totalStudents > 0
        ? Math.min(
            100,
            Math.round(
              (totalSubmissions / (list.length * totalStudents)) * 100,
            ),
          )
        : 0;
    return {
      total: list.length,
      submissions: totalSubmissions,
      active,
      classes: classes.length,
      totalStudents,
      avgRate,
    };
  }, [assignments, classes]);

  const recentAssignments = useMemo(
    () =>
      [...(assignments || [])]
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 4),
    [assignments],
  );

  const upcomingAssignments = useMemo(() => {
    const now = Date.now();
    return [...(assignments || [])]
      .filter((a) => a.deadline && new Date(a.deadline).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
      )
      .slice(0, 4);
  }, [assignments]);

  const { data: topStudents = [] } = useQuery<TopStudent[]>({
    queryKey: ["dashboard-overview", "top-students"],
    enabled: !!user && !!assignments && assignments.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/stats`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data?.topStudents) ? data.topStudents : [];
    },
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (isAr) return h < 12 ? "صباح الخير" : "مساء الخير";
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [isAr]);

  const teacherName =
    user?.fullName || user?.username || (isAr ? "أستاذ" : "Teacher");
  const firstName = teacherName.split(" ")[0];

  async function copyLink(a: Assignment) {
    const url = `${window.location.origin}/student/assignment/${a.id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(a.id);
    toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── layout wrapper ──────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "inherit",
        direction: isAr ? "rtl" : "ltr",
        flex: 1,
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      {/* ══════════ MAIN ══════════ */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Content — simplified per teacher feedback:
            • Single greeting line (no big hero banner)
            • Two big primary buttons (Create activity / Start live quiz)
            • Recent assignments list directly below
            Stats / top students / quick-actions sidebar / week chart were
            removed because they duplicated views available from other tabs. */}
        <div
          style={{
            padding: isMobile ? "16px 14px" : "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 16 : 22,
            flex: 1,
            overflowX: "hidden",
            maxWidth: 980,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {/* Onboarding checklist — first-run welcome panel */}
          {(() => {
            const onboardingSteps = [
              {
                done: classes.length > 0,
                title: isAr ? "أنشئ فصلك الأول" : "Create your first class",
                desc: isAr
                  ? "نظِّم طلابك في فصول لمتابعة أسهل"
                  : "Organize your students into classes",
                cta: isAr ? "أنشئ فصلاً" : "Create class",
                onClick: () => setActiveTab("students"),
              },
              {
                done: stats.totalStudents > 0,
                locked: classes.length === 0,
                title: isAr ? "أضِف الطلاب" : "Add students",
                desc: isAr
                  ? "ادعُ طلابك بمشاركة رابط الفصل"
                  : "Invite students by sharing the class link",
                cta: isAr ? "أضِف طلاباً" : "Add students",
                onClick: () => setActiveTab("students"),
              },
              {
                done: (assignments?.length ?? 0) > 0,
                title: isAr ? "أنشئ أوّل واجب" : "Create your first assignment",
                desc: isAr
                  ? "اختر قالباً جاهزاً أو أنشئ من الصفر"
                  : "Pick a template or build from scratch",
                cta: isAr ? "أنشئ واجباً" : "Create",
                onClick: () => setLocation("/teacher/new"),
              },
            ];
            const completed = onboardingSteps.filter((s) => s.done).length;
            const total = onboardingSteps.length;
            const remaining = total - completed;
            const allDone = remaining === 0;
            const show = !allDone && !onboardingDismissed && !isLoading;
            if (!show) return null;

            const dismiss = () => {
              try {
                localStorage.setItem("hasad_onboarding_dismissed", "1");
              } catch {}
              setOnboardingDismissed(true);
            };

            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: isMobile ? 16 : 22,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(30,77,53,0.06)",
                }}
              >
                {/* gold accent corner */}
                <div
                  style={{
                    position: "absolute",
                    top: -40,
                    [isAr ? "left" : "right"]: -40,
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(232,168,14,0.18) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
                {/* header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                    position: "relative",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Sparkles
                        style={{ width: 14, height: 14, color: C.goldBright }}
                      />
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: C.gold,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {isAr ? "ابدأ رحلتك" : "Get started"}
                      </span>
                    </div>
                    <h2
                      style={{
                        fontSize: isMobile ? 18 : 20,
                        fontWeight: 800,
                        color: C.text,
                        margin: 0,
                        marginBottom: 4,
                        lineHeight: 1.25,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {isAr
                        ? `أهلاً ${firstName} في حصاد!`
                        : `Welcome to Hasad, ${firstName}!`}
                    </h2>
                    <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
                      {isAr
                        ? `أكمل ${remaining === 1 ? "خطوة واحدة" : `${remaining} خطوات`} لتفعيل لوحتك`
                        : `${remaining} step${remaining === 1 ? "" : "s"} left to activate your dashboard`}
                    </p>
                  </div>
                  <button
                    onClick={dismiss}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "6px 10px",
                      cursor: "pointer",
                      color: C.muted,
                      borderRadius: 8,
                      fontFamily: "inherit",
                      fontSize: 11.5,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    title={isAr ? "تخطّي" : "Skip"}
                  >
                    {isAr ? "تخطّي" : "Skip"}
                  </button>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    background: "rgba(0,0,0,0.05)",
                    borderRadius: 999,
                    overflow: "hidden",
                    marginBottom: 16,
                    position: "relative",
                  }}
                >
                  <motion.div
                    initial={false}
                    animate={{ width: `${(completed / total) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background:
                        "linear-gradient(90deg, #1E4D35 0%, #E8A80E 100%)",
                      borderRadius: 999,
                    }}
                  />
                </div>

                {/* Steps */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {onboardingSteps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? 10 : 12,
                        padding: isMobile ? "10px 12px" : "12px 14px",
                        background: step.done
                          ? "rgba(30,77,53,0.05)"
                          : (step as any).locked
                          ? "rgba(0,0,0,0.02)"
                          : C.surface,
                        border: `1px solid ${step.done ? "rgba(30,77,53,0.15)" : (step as any).locked ? "rgba(0,0,0,0.07)" : C.border}`,
                        borderRadius: 11,
                        opacity: step.done ? 0.7 : (step as any).locked ? 0.45 : 1,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: step.done
                            ? C.green
                            : (step as any).locked
                            ? "rgba(0,0,0,0.07)"
                            : "rgba(232,168,14,0.16)",
                          color: step.done ? "#fff" : (step as any).locked ? C.muted : C.gold,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {step.done ? (
                          <Check style={{ width: 16, height: 16 }} />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: isMobile ? 13 : 13.5,
                            fontWeight: 800,
                            color: (step as any).locked ? C.muted : C.text,
                            textDecoration: step.done ? "line-through" : "none",
                            lineHeight: 1.3,
                          }}
                        >
                          {step.title}
                        </div>
                        {!step.done && !isMobile && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: C.muted,
                              marginTop: 2,
                            }}
                          >
                            {(step as any).locked
                              ? (isAr ? "أكمل الخطوة السابقة أولاً" : "Complete the previous step first")
                              : step.desc}
                          </div>
                        )}
                      </div>
                      {!step.done && !(step as any).locked && (
                        <button
                          onClick={step.onClick}
                          style={{
                            padding: isMobile ? "7px 12px" : "8px 16px",
                            background: C.green,
                            color: "#fff",
                            border: "none",
                            borderRadius: 9,
                            fontSize: isMobile ? 11.5 : 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            boxShadow: "0 2px 6px rgba(30,77,53,0.18)",
                            transition: "transform 0.1s ease",
                          }}
                          onMouseDown={(e) =>
                            (e.currentTarget.style.transform = "scale(0.96)")
                          }
                          onMouseUp={(e) =>
                            (e.currentTarget.style.transform = "scale(1)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.transform = "scale(1)")
                          }
                        >
                          {step.cta}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}

          {/* Two big primary buttons */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? 12 : 14,
            }}
          >
            {/* ── Card 1: أنشئ نشاطاً ── */}
            {isMobile ? (
              <button
                onClick={() => setLocation("/teacher/new")}
                dir="ltr"
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  padding: 0,
                  background: `linear-gradient(135deg, ${C.greenLight} 0%, ${C.green} 55%, #14362a 100%)`,
                  border: "none",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 8px 28px rgba(30,77,53,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 108,
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(30,77,53,0.38), inset 0 1px 0 rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(30,77,53,0.30), inset 0 1px 0 rgba(255,255,255,0.08)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(0.99)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(30,77,53,0.22), inset 0 1px 0 rgba(255,255,255,0.08)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(30,77,53,0.38), inset 0 1px 0 rgba(255,255,255,0.08)";
                }}
              >
                {/* Illustration zone */}
                <div style={{
                  width: 118,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  padding: "10px 0",
                }}>
                  {/* Sparkle dots */}
                  <span style={{ position: "absolute", top: 12, left: 14, fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1 }}>✦</span>
                  <span style={{ position: "absolute", bottom: 14, right: 14, fontSize: 8, color: "rgba(255,255,255,0.40)", lineHeight: 1 }}>✦</span>
                  {/* Floating mini icon: video */}
                  <div style={{
                    position: "absolute",
                    top: 14,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}>
                    <Video style={{ width: 14, height: 14, color: "#fff" }} />
                  </div>
                  {/* Floating mini icon: book */}
                  <div style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: "rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <BookText style={{ width: 12, height: 12, color: "#fff" }} />
                  </div>
                  {/* Floating mini icon: pencil */}
                  <div style={{
                    position: "absolute",
                    bottom: 14,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: "rgba(255,255,255,0.13)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Pencil style={{ width: 12, height: 12, color: "#fff" }} />
                  </div>
                  {/* Main folder / plus icon */}
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: 17,
                    background: "rgba(255,255,255,0.20)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.20)",
                  }}>
                    <Plus style={{ width: 30, height: 30, color: "#fff", strokeWidth: 2.8 }} />
                  </div>
                </div>

                {/* Text zone */}
                <div style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "center",
                  paddingRight: 18,
                  paddingLeft: 6,
                  gap: 5,
                  direction: "rtl",
                  textAlign: "right",
                }}>
                  <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: "-0.3px" }}>
                    {isAr ? "أنشئ نشاطاً" : "Create activity"}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.78)",
                    lineHeight: 1.5,
                  }}>
                    {isAr ? "واجب، فيديو، عرض، خطة درس..." : "Assignment, video, presentation..."}
                  </span>
                </div>

                {/* Chevron affordance */}
                <div style={{
                  width: 38,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <ChevronLeft style={{ width: 15, height: 15, color: "rgba(255,255,255,0.75)" }} />
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setLocation("/teacher/new")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "18px 24px",
                  background: C.green,
                  color: "#fff",
                  border: "none",
                  borderRadius: 14,
                  fontSize: 17,
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 6px 18px rgba(30,77,53,0.22)",
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(30,77,53,0.38)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(30,77,53,0.22)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(0.99)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(30,77,53,0.18)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(30,77,53,0.38)";
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus style={{ width: 22, height: 22 }} />
                  {isAr ? "أنشئ نشاطاً" : "Create activity"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.82 }}>
                  {isAr ? "واجب، فيديو، عرض، خطة درس..." : "Assignment, video, presentation..."}
                </span>
              </button>
            )}

            {/* ── Card 2: ابدأ مسابقة مباشرة ── */}
            {isMobile ? (
              <button
                onClick={() => setActiveTab("competitive")}
                dir="ltr"
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  padding: 0,
                  background: `linear-gradient(135deg, #F5C842 0%, ${C.goldBright} 50%, ${C.gold} 100%)`,
                  border: "none",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 8px 28px rgba(201,146,10,0.36), inset 0 1px 0 rgba(255,255,255,0.30)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 120,
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(201,146,10,0.50), inset 0 1px 0 rgba(255,255,255,0.30)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(201,146,10,0.36), inset 0 1px 0 rgba(255,255,255,0.30)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(0.99)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(201,146,10,0.28), inset 0 1px 0 rgba(255,255,255,0.30)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(201,146,10,0.50), inset 0 1px 0 rgba(255,255,255,0.30)";
                }}
              >
                {/* Trophy illustration zone */}
                <div style={{
                  width: 118,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  padding: "10px 0",
                }}>
                  {/* Subtle sparkles */}
                  <span style={{ position: "absolute", top: 14, left: 12, fontSize: 10, color: "rgba(30,77,53,0.35)", lineHeight: 1 }}>✦</span>
                  <span style={{ position: "absolute", bottom: 16, right: 12, fontSize: 8, color: "rgba(30,77,53,0.25)", lineHeight: 1 }}>✦</span>
                  {/* Trophy container */}
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 66,
                      height: 66,
                      borderRadius: 20,
                      background: "rgba(201,146,10,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    }}>
                      <Trophy style={{ width: 40, height: 40, color: C.green, strokeWidth: 1.6 }} />
                    </div>
                    {/* Zap badge */}
                    <div style={{
                      position: "absolute",
                      bottom: -5,
                      right: -5,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: C.green,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(30,77,53,0.35)",
                    }}>
                      <Zap style={{ width: 13, height: 13, color: "#fff", fill: "#fff" }} />
                    </div>
                  </div>
                </div>

                {/* Text zone */}
                <div style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "center",
                  paddingRight: 18,
                  paddingLeft: 6,
                  gap: 5,
                  direction: "rtl",
                  textAlign: "right",
                }}>
                  <span style={{
                    color: C.green,
                    fontSize: 17,
                    fontWeight: 900,
                    letterSpacing: "-0.3px",
                    lineHeight: 1.3,
                  }}>
                    {isAr ? "ابدأ مسابقة مباشرة" : "Start live quiz"}
                  </span>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 400,
                    color: C.greenMid,
                    opacity: 0.85,
                    lineHeight: 1.5,
                  }}>
                    {isAr ? "اختر من مجموعة المسابقات والألعاب" : "Pick a game and play with students"}
                  </span>
                  {/* Inline CTA button */}
                  <div style={{
                    marginTop: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: C.green,
                    color: "#fff",
                    borderRadius: 22,
                    padding: "5px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    alignSelf: "flex-start",
                    boxShadow: "0 2px 10px rgba(30,77,53,0.28)",
                  }}>
                    <Play style={{ width: 11, height: 11, fill: "#fff", color: "#fff" }} />
                    {isAr ? "ابدأ الآن" : "Start now"}
                  </div>
                </div>

                {/* Chevron affordance */}
                <div style={{
                  width: 38,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(201,146,10,0.28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <ChevronLeft style={{ width: 15, height: 15, color: C.green }} />
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("competitive")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "18px 24px",
                  background: C.goldBright,
                  color: C.green,
                  border: "none",
                  borderRadius: 14,
                  fontSize: 17,
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 6px 18px rgba(232,168,14,0.32)",
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(201,146,10,0.50)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(232,168,14,0.32)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(0.99)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(201,146,10,0.24)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
                  e.currentTarget.style.boxShadow = "0 14px 36px rgba(201,146,10,0.50)";
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Play style={{ width: 22, height: 22, fill: C.green }} />
                  {isAr ? "ابدأ مسابقة مباشرة" : "Start live quiz"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.72 }}>
                  {isAr ? "اختر من مجموعة المسابقات والألعاب" : "Pick a game and play with students"}
                </span>
              </button>
            )}
          </motion.div>
          {/* Hasad Challenge — premium hero banner */}
          <motion.button
            type="button"
            onClick={() => setLocation("/game/arena")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.08 }}
            whileHover={{ y: -3, scale: 1.004 }}
            whileTap={{ scale: 0.99 }}
            style={{
              width: "100%",
              position: "relative",
              overflow: "hidden",
              borderRadius: 24,
              padding: isMobile ? "24px 20px" : "32px 38px",
              minHeight: isMobile ? 220 : 190,
              border: "1px solid rgba(201,146,10,0.32)",
              background:
                "linear-gradient(135deg, #F4F7EF 0%, #FFFDF7 48%, #FFF4D9 100%)",
              boxShadow:
                "0 20px 50px rgba(30,77,53,0.12), 0 0 0 1px rgba(255,255,255,0.75) inset",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: isMobile ? 18 : 34,
              cursor: "pointer",
              textAlign: isAr ? "right" : "left",
              fontFamily: "inherit",
            }}
          >
            {/* soft green glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 12% 55%, rgba(30,77,53,0.15), transparent 34%)",
                pointerEvents: "none",
              }}
            />

            {/* soft gold glow */}
            <div
              style={{
                position: "absolute",
                right: isAr ? 28 : "auto",
                left: isAr ? "auto" : 28,
                top: "50%",
                transform: "translateY(-50%)",
                width: isMobile ? 150 : 210,
                height: isMobile ? 150 : 210,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(232,168,14,0.30) 0%, rgba(232,168,14,0.13) 42%, transparent 72%)",
                filter: "blur(8px)",
                pointerEvents: "none",
              }}
            />

            {/* gold top line */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: isAr ? 0 : "auto",
                left: isAr ? "auto" : 0,
                width: "42%",
                height: 3,
                background:
                  "linear-gradient(90deg, transparent, rgba(232,168,14,0.85), transparent)",
                pointerEvents: "none",
              }}
            />

            {/* Text area */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: "fit-content",
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "5px 13px",
                  borderRadius: 999,
                  background: "rgba(30,77,53,0.09)",
                  color: "#0F5A32",
                  border: "1px solid rgba(30,77,53,0.10)",
                }}
              >
                {isAr ? "مميز" : "Featured"}
              </span>

              <h2
                style={{
                  margin: 0,
                  color: "#103F2B",
                  fontSize: isMobile ? 34 : 46,
                  fontWeight: 950,
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                }}
              >
                {isAr ? "تحدي حصاد" : "Hasad Challenge"}
              </h2>

              {/* Pills */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 2,
                }}
              >
                {[
                  {
                    icon: "🏆",
                    text: isAr ? "تجربة تفاعلية" : "Interactive",
                  },
                  {
                    icon: "👥",
                    text: isAr ? "للحفلات والملتقيات" : "For Events",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.78)",
                      border: "1px solid rgba(15,86,47,0.08)",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 4px 14px rgba(30,77,53,0.05)",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#254A37",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              <p
                style={{
                  margin: 0,
                  maxWidth: 620,
                  color: "#64766C",
                  fontSize: isMobile ? 14 : 16,
                  lineHeight: 1.9,
                  fontWeight: 500,
                }}
              >
                {isAr
                  ? "مسابقة جماعية مباشرة أمام الجمهور — مناسبة للحفلات والملتقيات."
                  : "A live audience competition made for events and gatherings."}
              </p>

              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "fit-content",
                  padding: "12px 24px",
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#0F5A32,#064B28)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 900,
                  boxShadow: "0 14px 28px rgba(15,86,47,0.26)",
                }}
              >
                {isAr ? "ابدأ المسابقة الآن" : "Explore now"}
              </div>
            </div>

            {/* Premium trophy */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                width: isMobile ? 108 : 180,
                height: isMobile ? 200 : 150,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 200,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 4,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255,223,132,0.75) 0%, rgba(232,168,14,0.22) 42%, transparent 72%)",
                  filter: "blur(5px)",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  width: "68%",
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(122,79,0,0.16)",
                  filter: "blur(10px)",
                }}
              />

              <span
                style={{
                  position: "relative",
                  fontSize: isMobile ? 72 : 104,
                  lineHeight: 1,
                  filter:
                    "drop-shadow(0 18px 18px rgba(122,79,0,0.22)) drop-shadow(0 3px 2px rgba(255,255,255,0.75))",
                }}
              >
                🏆
              </span>
            </div>
          </motion.button>

          {/* وميض — معاينة حية للعبة */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.12 }}
          >
            <WameethPreviewCard
              onStart={() => setLocation("/game/wameeth/create")}
            />
          </motion.div>

          {/* Recent assignments — collapsible (closed by default) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <button
              type="button"
              onClick={() => setRecentOpen((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 13,
                padding: "14px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: isAr ? "right" : "left",
              }}
              aria-expanded={recentOpen}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <BookText style={{ width: 16, height: 16, color: C.green }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                  {isAr ? "آخر الواجبات والمسابقات" : "Recent assignments"}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: C.greenPale,
                    color: C.green,
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  {stats.total}
                </span>
              </span>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: C.muted,
                  transition: "transform 0.2s ease",
                  transform: recentOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {recentOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ overflow: "hidden", marginTop: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 8,
                  }}
                >
                  <button
                    onClick={() => setActiveTab("assignments")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: C.green,
                      cursor: "pointer",
                      padding: "4px 9px",
                      borderRadius: 7,
                      border: "none",
                      background: "none",
                      fontFamily: "inherit",
                    }}
                  >
                    {isAr ? "عرض الكل" : "View all"}
                    {isAr ? (
                      <ChevronLeft style={{ width: 12, height: 12 }} />
                    ) : (
                      <ChevronRight style={{ width: 12, height: 12 }} />
                    )}
                  </button>
                </div>
                <div
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 13,
                    overflow: "hidden",
                  }}
                >
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: 68,
                          borderBottom: `1px solid ${C.border}`,
                          background: "rgba(0,0,0,0.02)",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                    ))
                  ) : recentAssignments.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 20px",
                        color: C.muted,
                      }}
                    >
                      <BookText
                        style={{
                          width: 40,
                          height: 40,
                          margin: "0 auto 12px",
                          opacity: 0.3,
                        }}
                      />
                      <p style={{ fontSize: 13, margin: "0 0 12px" }}>
                        {isAr ? "لا توجد واجبات بعد" : "No assignments yet"}
                      </p>
                      <button
                        onClick={() => setLocation("/teacher/new")}
                        style={{
                          padding: "8px 18px",
                          background: C.green,
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Plus
                          style={{
                            width: 12,
                            height: 12,
                            display: "inline",
                            marginLeft: 4,
                          }}
                        />
                        {isAr ? "إنشاء أول واجب" : "Create first"}
                      </button>
                    </div>
                  ) : (
                    recentAssignments.map((a, idx) => (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        isAr={isAr}
                        isLast={idx === recentAssignments.length - 1}
                        onPlay={() => startGame(a.id)}
                        onCopy={() => copyLink(a)}
                        onOpen={() =>
                          setLocation(`/teacher/assignment/${a.id}`)
                        }
                        isStarting={creatingGameForId === a.id}
                        copied={copiedId === a.id}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Top students + Recent activity — perfectly parallel rows on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.12 }}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? 14 : 16,
              alignItems: "stretch",
            }}
          >
            {/* Top 5 students */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <SectionHead
                icon={
                  <Crown style={{ width: 15, height: 15, color: C.gold }} />
                }
                title={isAr ? "أفضل ٥ طلاب" : "Top 5 students"}
                badge={isAr ? "آخر ٧ أيام" : "last 7 days"}
                linkLabel={isAr ? "عرض الكل" : "View all"}
                onLink={() => setActiveTab("stats")}
                isAr={isAr}
              />
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 13,
                  overflow: "hidden",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {topStudents.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "32px 18px",
                      color: C.muted,
                      minHeight: 280,
                    }}
                  >
                    <Crown
                      style={{
                        width: 32,
                        height: 32,
                        marginBottom: 10,
                        opacity: 0.3,
                      }}
                    />
                    <p
                      style={{ fontSize: 12.5, margin: 0, textAlign: "center" }}
                    >
                      {isAr
                        ? "لا يوجد ترتيب بعد — انتظر تسليمات الطلاب."
                        : "No ranking yet — waiting for submissions."}
                    </p>
                  </div>
                ) : (
                  topStudents
                    .slice(0, 5)
                    .map((s, idx, arr) => (
                      <TopStudentRow
                        key={`${s.id}-${idx}`}
                        student={s}
                        rank={idx + 1}
                        isAr={isAr}
                        isLast={idx === arr.length - 1}
                      />
                    ))
                )}
              </div>
            </div>

            {/* Recent activity */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <SectionHead
                icon={
                  <Activity style={{ width: 15, height: 15, color: C.green }} />
                }
                title={isAr ? "آخر الأنشطة" : "Recent activity"}
                linkLabel={isAr ? "عرض الكل" : "View all"}
                onLink={() => setActiveTab("assignments")}
                isAr={isAr}
              />
              <ActivityFeed isAr={isAr} assignments={assignments || []} />
            </div>
          </motion.div>

          {/* Upcoming deadlines */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.14 }}
          >
            <SectionHead
              icon={
                <Calendar style={{ width: 15, height: 15, color: C.green }} />
              }
              title={isAr ? "المواعيد القادمة" : "Upcoming deadlines"}
              badge={
                upcomingAssignments.length > 0
                  ? `${upcomingAssignments.length}`
                  : undefined
              }
              linkLabel={
                upcomingAssignments.length > 0
                  ? isAr
                    ? "عرض الكل"
                    : "View all"
                  : undefined
              }
              onLink={
                upcomingAssignments.length > 0
                  ? () => setActiveTab("assignments")
                  : undefined
              }
              isAr={isAr}
            />
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 13,
                overflow: "hidden",
              }}
            >
              {upcomingAssignments.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "28px 18px",
                    color: C.muted,
                  }}
                >
                  <Calendar
                    style={{
                      width: 32,
                      height: 32,
                      margin: "0 auto 10px",
                      opacity: 0.3,
                    }}
                  />
                  <p style={{ fontSize: 12.5, margin: 0 }}>
                    {isAr ? "لا توجد مواعيد قادمة." : "No upcoming deadlines."}
                  </p>
                </div>
              ) : (
                upcomingAssignments.map((a, idx) => (
                  <UpcomingRow
                    key={a.id}
                    assignment={a}
                    isAr={isAr}
                    isLast={idx === upcomingAssignments.length - 1}
                  />
                ))
              )}
            </div>
          </motion.div>

          {/* Simple suggestion */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: C.goldPale,
              border: `1px solid rgba(201,146,10,0.20)`,
              borderRadius: 12,
            }}
          >
            <Lightbulb
              style={{ width: 18, height: 18, color: C.gold, flexShrink: 0 }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12.5,
                color: C.text2,
                lineHeight: 1.5,
              }}
            >
              {isAr
                ? "اقتراح اليوم: جرّب نشاط الاستماع — يطوّر تركيز الطلاب أكثر من الأسئلة العادية."
                : "Tip: try a listening activity — it boosts student focus more than standard questions."}
            </div>
            <button
              onClick={() => setLocation("/teacher/new/dictation")}
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: C.green,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                padding: "4px 6px",
              }}
            >
              {isAr ? "ابدأ الآن" : "Start"}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════

function TbBtn({ icon }: { icon: React.ReactNode }) {
  return (
    <button
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        border: `1px solid ${C.borderMid}`,
        background: C.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: C.muted,
      }}
    >
      {icon}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  isPercent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "green" | "gold" | "blue" | "purple";
  isPercent?: boolean;
}) {
  const isMobile = useIsMobile();
  const TONES = {
    green: {
      iconBg: "rgba(30,77,53,0.09)",
      iconColor: C.green,
      valColor: C.text,
    },
    gold: { iconBg: C.goldPale, iconColor: C.gold, valColor: C.text },
    blue: {
      iconBg: "rgba(37,99,235,0.09)",
      iconColor: "#2563EB",
      valColor: C.text,
    },
    purple: {
      iconBg: "rgba(109,40,217,0.09)",
      iconColor: "#6D28D9",
      valColor: C.text,
    },
  };
  const t = TONES[tone];
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 13,
        padding: isMobile ? "13px 14px" : "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 10 : 14,
      }}
    >
      <div
        style={{
          width: isMobile ? 36 : 44,
          height: isMobile ? 36 : 44,
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: t.iconBg,
          color: t.iconColor,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: isMobile ? 22 : 26,
            fontWeight: 900,
            color: t.valColor,
            lineHeight: 1.1,
          }}
        >
          {value}
          {isPercent ? "%" : ""}
        </div>
        <div
          style={{
            fontSize: 10,
            color: C.subtle,
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hint}
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  icon,
  title,
  badge,
  linkLabel,
  onLink,
  isAr,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  linkLabel?: string;
  onLink?: () => void;
  isAr: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 800,
          color: C.text,
        }}
      >
        {icon}
        {title}
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: C.greenPale,
              color: C.green,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {linkLabel && onLink && (
        <button
          onClick={onLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11.5,
            fontWeight: 700,
            color: C.green,
            cursor: "pointer",
            padding: "4px 9px",
            borderRadius: 7,
            border: "none",
            background: "none",
            fontFamily: "inherit",
          }}
        >
          {linkLabel}
          {isAr ? (
            <ChevronLeft style={{ width: 12, height: 12 }} />
          ) : (
            <ChevronRight style={{ width: 12, height: 12 }} />
          )}
        </button>
      )}
    </div>
  );
}

function AssignmentRow({
  assignment: a,
  isAr,
  isLast,
  onPlay,
  onCopy,
  onOpen,
  isStarting,
  copied,
}: {
  assignment: Assignment;
  isAr: boolean;
  isLast: boolean;
  onPlay: () => void;
  onCopy: () => void;
  onOpen: () => void;
  isStarting: boolean;
  copied: boolean;
}) {
  const isMobile = useIsMobile();
  const isExpired = a.deadline && new Date(a.deadline) < new Date();
  const emoji = getSubjectEmoji(a.subject, a.type);
  const emojiBg = getSubjectBg(a.subject);
  const totalStudents = Math.max(a.submissionCount, 1);
  const pct = Math.min(
    100,
    Math.round((a.submissionCount / Math.max(totalStudents, 1)) * 100),
  );
  const barGrad = isExpired
    ? "linear-gradient(90deg,#9CA3AF,#D1D5DB)"
    : "linear-gradient(90deg,#1E4D35,#2d7050)";

  if (isMobile) {
    return (
      <div
        style={{
          padding: "13px 14px",
          borderBottom: isLast ? "none" : `1px solid ${C.border}`,
          cursor: "pointer",
        }}
        onClick={onOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
              background: emojiBg,
            }}
          >
            {emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                color: C.muted,
                marginTop: 2,
              }}
            >
              <Calendar style={{ width: 10, height: 10 }} />
              {a.deadline
                ? new Date(a.deadline).toLocaleDateString(
                    isAr ? "ar-SA" : "en-US",
                    { month: "short", day: "numeric" },
                  )
                : isAr
                  ? "بلا موعد"
                  : "No deadline"}
              <span style={{ color: C.subtle }}>·</span>
              {a.submissionCount} {isAr ? "تسليم" : "subs"}
            </div>
          </div>
        </div>
        <div
          style={{
            height: 3,
            background: "rgba(0,0,0,0.06)",
            borderRadius: 2,
            marginTop: 8,
            marginInlineStart: 49,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              width: `${pct}%`,
              background: barGrad,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 9,
            marginInlineStart: 49,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 20,
              background: isExpired
                ? "rgba(239,68,68,0.09)"
                : "rgba(16,185,129,0.10)",
              color: isExpired ? "#B91C1C" : "#047857",
            }}
          >
            {isExpired ? (isAr ? "منتهي" : "Ended") : isAr ? "نشط" : "Active"}
          </span>
          <div style={{ flex: 1 }} />
          {a.questionCount > 0 && (
            <button
              onClick={onPlay}
              disabled={isStarting}
              style={{
                height: 32,
                paddingInline: 12,
                borderRadius: 8,
                border: `1px solid ${C.goldPale}`,
                background: C.goldPale,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                color: C.gold,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              {isStarting ? (
                <Loader2
                  style={{
                    width: 12,
                    height: 12,
                    animation: "spin 1s linear infinite",
                  }}
                />
              ) : (
                <Gamepad2 style={{ width: 12, height: 12 }} />
              )}
              {isAr ? "لعبة" : "Play"}
            </button>
          )}
          <button
            onClick={onCopy}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.borderMid}`,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: copied ? C.green : C.muted,
            }}
          >
            {copied ? (
              <Check style={{ width: 13, height: 13 }} />
            ) : (
              <Copy style={{ width: 13, height: 13 }} />
            )}
          </button>
          <button
            onClick={() => {}}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.borderMid}`,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: C.muted,
            }}
          >
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 16px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
          background: emojiBg,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: C.muted,
            marginTop: 3,
          }}
        >
          <Calendar style={{ width: 10, height: 10 }} />
          {a.deadline
            ? new Date(a.deadline).toLocaleDateString(
                isAr ? "ar-SA" : "en-US",
                { month: "short", day: "numeric" },
              )
            : isAr
              ? "بلا موعد"
              : "No deadline"}
          <span style={{ color: C.subtle }}>·</span>
          <Users style={{ width: 10, height: 10 }} />
          {a.submissionCount} {isAr ? "تسليم" : "subs"}
        </div>
        <div
          style={{
            height: 3,
            background: "rgba(0,0,0,0.06)",
            borderRadius: 2,
            marginTop: 6,
            maxWidth: 150,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              width: `${pct}%`,
              background: barGrad,
            }}
          />
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 20,
            background: isExpired
              ? "rgba(239,68,68,0.09)"
              : "rgba(16,185,129,0.10)",
            color: isExpired ? "#B91C1C" : "#047857",
          }}
        >
          {isExpired ? (isAr ? "منتهي" : "Ended") : isAr ? "نشط" : "Active"}
        </span>
        {a.questionCount > 0 && (
          <button
            onClick={onPlay}
            disabled={isStarting}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: `1px solid ${C.goldPale}`,
              background: C.goldPale,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: C.gold,
            }}
            title={isAr ? "لعبة" : "Play"}
          >
            {isStarting ? (
              <Loader2
                style={{
                  width: 12,
                  height: 12,
                  animation: "spin 1s linear infinite",
                }}
              />
            ) : (
              <Gamepad2 style={{ width: 12, height: 12 }} />
            )}
          </button>
        )}
        <button
          onClick={onCopy}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${C.borderMid}`,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: copied ? C.green : C.muted,
          }}
          title={isAr ? "نسخ الرابط" : "Copy link"}
        >
          {copied ? (
            <Check style={{ width: 12, height: 12 }} />
          ) : (
            <Copy style={{ width: 12, height: 12 }} />
          )}
        </button>
        <button
          onClick={() => {}}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${C.borderMid}`,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: C.muted,
          }}
          title={isAr ? "تعديل" : "Edit"}
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

const MEDAL_COLORS = [
  {
    bg: "linear-gradient(135deg,#E8A80E,#f5cc50)",
    color: "#7a4f00",
    emoji: "🥇",
  },
  {
    bg: "linear-gradient(135deg,#9CA3AF,#D1D5DB)",
    color: "#374151",
    emoji: "🥈",
  },
  { bg: "linear-gradient(135deg,#C9920A,#E8A80E)", color: "#fff", emoji: "🥉" },
];
const AVATAR_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
const BAR_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
const PCT_COLORS = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626"];

function TopStudentRow({
  student,
  rank,
  isAr,
  isLast,
}: {
  student: TopStudent;
  rank: number;
  isAr: boolean;
  isLast: boolean;
}) {
  const isMobile = useIsMobile();
  const medal = MEDAL_COLORS[rank - 1];
  const avatarColor = AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
  const barColor = BAR_COLORS[(rank - 1) % BAR_COLORS.length];
  const pctColor = PCT_COLORS[(rank - 1) % PCT_COLORS.length];
  const initial = (student.name || "?").charAt(0);
  const displayPct =
    student.score <= 100
      ? student.score
      : Math.min(100, Math.round((student.score / 1000) * 100));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        minHeight: 52,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: medal?.bg || "rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 900,
          color: medal?.color || C.muted,
          flexShrink: 0,
        }}
      >
        {medal ? medal.emoji : `${rank}`}
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {student.name}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            {student.className || (isAr ? "طالب" : "Student")}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 5 : 8,
          flexShrink: 0,
        }}
      >
        {!isMobile && (
          <div
            style={{
              width: 70,
              height: 4,
              background: "rgba(0,0,0,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${displayPct}%`,
                height: "100%",
                background: barColor,
                borderRadius: 2,
              }}
            />
          </div>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: pctColor,
            minWidth: isMobile ? 28 : 36,
            textAlign: "end",
          }}
        >
          {student.score <= 100 ? `${student.score}%` : student.score}
        </span>
      </div>
    </div>
  );
}

function UpcomingRow({
  assignment: a,
  isAr,
  isLast,
}: {
  assignment: Assignment;
  isAr: boolean;
  isLast: boolean;
}) {
  const d = new Date(a.deadline!);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 15px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      }}
    >
      <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: C.green,
            lineHeight: 1,
          }}
        >
          {d.getDate()}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
          }}
        >
          {d.toLocaleDateString(isAr ? "ar-SA" : "en-US", { month: "short" })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.title}
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
          {a.submissionCount} {isAr ? "تسليم حتى الآن" : "submitted so far"}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 20,
          background:
            daysLeft <= 2 ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.10)",
          color: daysLeft <= 2 ? "#B45309" : "#1D4ED8",
          flexShrink: 0,
        }}
      >
        {daysLeft} {isAr ? "أيام" : "days"}
      </span>
    </div>
  );
}

function QuickCard({
  emoji,
  name,
  desc,
  bg,
  onClick,
}: {
  emoji: string;
  name: string;
  desc: string;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 13,
        padding: "14px 13px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        textAlign: "right",
        fontFamily: "inherit",
        width: "100%",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          background: bg,
        }}
      >
        {emoji}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{name}</div>
      <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.4 }}>
        {desc}
      </div>
    </button>
  );
}

function WeekChart({ isAr }: { isAr: boolean }) {
  const days = isAr
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu"];
  const heights = [55, 80, 45, 100, 65];
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 13,
        paddingTop: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 16px 8px",
          fontSize: 10,
          color: C.muted,
          fontWeight: 600,
        }}
      >
        {days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height: 40,
          padding: "0 16px 12px",
        }}
      >
        {heights.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: "3px 3px 0 0",
              background:
                i === 3 ? C.green : `rgba(30,77,53,${0.15 + i * 0.05})`,
              height: `${h}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({
  isAr,
  assignments,
}: {
  isAr: boolean;
  assignments: Assignment[];
}) {
  const COLORS = ["#10B981", "#E8A80E", "#3B82F6", "#F59E0B", "#8B5CF6"];
  const DOT_CLASSES = ["g", "y", "b", "r", "v"];

  const items = useMemo(() => {
    return assignments
      .filter((a) => a.submissionCount > 0)
      .sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0))
      .slice(0, 5)
      .map((a, i) => ({
        color: COLORS[i % COLORS.length],
        initial: (a.title || "?").charAt(0),
        text: isAr ? (
          <span>
            <strong style={{ fontWeight: 700, color: C.text }}>
              {a.title}
            </strong>{" "}
            — {a.submissionCount} تسليم
          </span>
        ) : (
          <span>
            <strong style={{ fontWeight: 700, color: C.text }}>
              {a.title}
            </strong>{" "}
            — {a.submissionCount} submissions
          </span>
        ),
        time: timeAgo(a.createdAt, isAr),
        dotColor: COLORS[i % COLORS.length],
      }));
  }, [assignments, isAr]);

  if (items.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 13,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          textAlign: "center",
          color: C.muted,
          fontSize: 12,
          minHeight: 280,
        }}
      >
        <Activity
          style={{ width: 32, height: 32, marginBottom: 10, opacity: 0.3 }}
        />
        {isAr ? "لا توجد نشاطات بعد" : "No activity yet"}
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 13,
        overflow: "hidden",
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            borderBottom:
              i === items.length - 1 ? "none" : `1px solid ${C.border}`,
            minHeight: 52,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: item.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {item.initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                color: C.text2,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.text}
            </div>
            <div style={{ fontSize: 10, color: C.subtle, marginTop: 2 }}>
              {item.time}
            </div>
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: item.dotColor,
              flexShrink: 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}
