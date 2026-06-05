import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  useListAssignments,
  useGetCurrentTeacher,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import {
  ClassSelector,
  getRememberedTargetClass,
} from "@/components/teacher/class-selector";
import {
  Zap,
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  Search,
  Plus,
  Sparkles,
} from "lucide-react";

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  subject?: string | null;
  targetClass?: string | null;
}

// Wameedh is the canonical live-quiz flow on the site: pick an assignment,
// kick off a classic teacher game, and jump straight into the host screen.
// This page is the standalone entry point so the organizer never has to land
// on the teacher dashboard just to launch it.
export default function WameethCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  const { data: user } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { data: assignments, isLoading } = useListAssignments(
    user ? { teacherId: user.id, include: "shared" } : undefined,
    { query: { enabled: !!user } as any },
  );

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<number | null>(null);
  const [targetClass, setTargetClass] = useState<string>(() =>
    getRememberedTargetClass(),
  );

  const filtered = (assignments || []).filter((a: Assignment) => {
    if ((a.questionCount ?? 0) === 0) return false;
    if (!search.trim()) return true;
    return a.title.toLowerCase().includes(search.toLowerCase());
  });

  const startWameeth = (assignmentId: number) => {
    if (creating !== null) return;
    setCreating(assignmentId);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId, gameMode: "classic", targetClass: targetClass || undefined },
      (res: { pin?: string; error?: string }) => {
        setCreating(null);
        if (res?.error || !res?.pin) {
          toast.error(
            res?.error ||
              (ar ? "تعذّر بدء اللعبة" : "Failed to start the game"),
          );
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      },
    );
  };

  // If the organizer is not logged in, send them to the login page with a
  // post-login redirect back here so they don't lose their place.
  useEffect(() => {
    if (!user && !isLoading) {
      // useGetCurrentTeacher returned undefined and finished loading → no
      // session. Bounce to login and come back afterwards.
      const backTo = encodeURIComponent("/game/wameeth/create");
      setLocation(`/login?redirect=${backTo}`);
    }
  }, [user, isLoading, setLocation]);

  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-[calc(100vh-4rem)] py-8 sm:py-12"
        style={{
          background:
            "linear-gradient(180deg, #000503 0%, #010907 38%, #02140c 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-3xl">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-bold mb-5 transition-colors"
          >
            <BackIcon className="w-4 h-4" />
            {ar ? "لوحة المنظّم" : "Organizer dashboard"}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,58,34,0.9) 0%, rgba(4,30,18,0.95) 60%, rgba(2,14,9,1) 100%)",
              border: "1px solid rgba(212,166,58,0.35)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,166,58,0.08) inset",
            }}
          >
            {/* Gold glow orb */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: -80,
                [dir === "rtl" ? "left" : "right"]: -80,
                width: 260,
                height: 260,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(212,166,58,0.18) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(212,166,58,0.15)",
                  border: "1px solid rgba(212,166,58,0.45)",
                  boxShadow: "0 0 20px rgba(212,166,58,0.12)",
                }}
              >
                <Zap className="w-7 h-7" style={{ color: "#f4c95d" }} />
              </div>
              <div className="flex-1">
                <div
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full mb-2"
                  style={{
                    background: "rgba(212,166,58,0.12)",
                    border: "1px solid rgba(212,166,58,0.35)",
                  }}
                >
                  <Sparkles className="w-3 h-3" style={{ color: "#f4c95d" }} />
                  <span
                    className="text-[10px] font-bold tracking-wide"
                    style={{ color: "#f4c95d" }}
                  >
                    {ar ? "اللعبة الافتراضية" : "Default game"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {ar ? "وميض — لعبة مباشرة" : "Wameedh — Live Game"}
                </h1>
                <p className="text-white/75 text-sm mt-2 leading-relaxed">
                  {ar
                    ? "اختر مسابقة وسنفتح غرفة فورية برمز PIN، يدخل عليه طلابك ويبدأ اللعب."
                    : "Pick a quiz and we'll open an instant room with a PIN. Your students join and play."}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Class selector */}
          <div className="mb-4">
            <ClassSelector
              value={targetClass}
              onChange={setTargetClass}
              accent="#f4c95d"
            />
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              style={{ [dir === "rtl" ? "right" : "left"]: 14 } as React.CSSProperties}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ar ? "ابحث في مسابقاتك…" : "Search your quizzes…"}
              className="w-full rounded-2xl py-3 text-sm font-medium text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
              style={{
                background: "rgba(10,58,34,0.35)",
                border: "1px solid rgba(212,166,58,0.18)",
                paddingInlineStart: 40,
                paddingInlineEnd: 16,
              }}
            />
          </div>

          {/* Assignments list */}
          {isLoading ? (
            <div className="rounded-2xl p-10 flex items-center justify-center text-white/70">
              <Loader2 className="w-5 h-5 animate-spin me-2" />
              {ar ? "جاري التحميل…" : "Loading…"}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                background: "rgba(10,58,34,0.2)",
                border: "1px dashed rgba(212,166,58,0.25)",
              }}
            >
              <p className="text-white/75 text-sm mb-4">
                {assignments && assignments.length > 0
                  ? ar
                    ? "لا توجد نتائج مطابقة لبحثك."
                    : "No results match your search."
                  : ar
                    ? "ليس لديك مسابقات بعد. أنشئ مسابقتك الأولى الآن."
                    : "You don't have any quizzes yet. Create your first one."}
              </p>
              <Link
                href="/teacher/new/assignment?contest=1"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-sm"
                style={{
                  background: "linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)",
                  color: "#1a1008",
                }}
              >
                <Plus className="w-4 h-4" />
                {ar ? "إنشاء مسابقة" : "Create a quiz"}
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((a: Assignment) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={creating !== null}
                  onClick={() => startWameeth(a.id)}
                  className="w-full text-start flex items-center gap-3 p-4 rounded-2xl transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(10,58,34,0.55) 0%, rgba(2,14,9,0.80) 100%)",
                    border: "1px solid rgba(212,166,58,0.22)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(212,166,58,0.12)",
                      border: "1px solid rgba(212,166,58,0.30)",
                    }}
                  >
                    <FileText className="w-4 h-4" style={{ color: "#f4c95d" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-extrabold text-sm leading-snug truncate">
                      {a.title}
                    </p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {a.questionCount}{" "}
                      {ar ? "سؤال" : "questions"}
                      {a.subject ? ` · ${a.subject}` : ""}
                    </p>
                  </div>
                  {creating === a.id ? (
                    <Loader2
                      className="w-5 h-5 animate-spin"
                      style={{ color: "#f4c95d" }}
                    />
                  ) : (
                    <span
                      className="text-xs font-extrabold px-3 py-1.5 rounded-lg shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)",
                        color: "#1a1008",
                      }}
                    >
                      {ar ? "ابدأ" : "Start"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
