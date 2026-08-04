import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetCurrentTeacher,
  useLogoutTeacher,
} from "@workspace/api-client-react";
import {
  LogOut,
  User,
  Loader2,
  Gamepad2,
  Languages,
  MessageSquarePlus,
  MessageSquare,
  Menu,
  X,
  Home,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Zap,
  Star,
  Search,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "./notification-bell";
import { DirectMessageDrawer, useDmUnreadCount } from "./direct-message-drawer";
import { XpToastListener } from "./xp-toast-listener";
import { XpPill } from "./xp-pill";
import { AuthSideRail } from "./auth-side-rail";
import { AdminUiSwitcher } from "./admin-ui-switcher";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-provider";
import { useDarkMode } from "@/lib/dark-mode";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ── Verification nudge banner ──────────────────────────────────────────── */
function VerificationNudgeBanner({
  user,
  lang,
}: {
  user: { email?: string | null; phone?: string | null; name?: string };
  lang: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (dismissed) return null;

  const identifier = user.email || user.phone || "";

  const handleSend = async () => {
    if (!identifier || sending || sent) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setSendError(lang === "ar" ? "تعذّر إرسال الرمز، حاول مجدداً" : "Failed to send code, please try again");
      }
    } catch {
      setSendError(lang === "ar" ? "تعذّر إرسال الرمز، حاول مجدداً" : "Failed to send code, please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "linear-gradient(135deg,#7c3aed08,#f59e0b10)",
          borderBottom: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: "#d97706" }} />
          <p className="text-[13px] font-medium leading-snug" style={{ color: sendError ? "#dc2626" : "#78350f" }}>
            {sendError
              ? sendError
              : sent
              ? (lang === "ar"
                  ? "✅ تم إرسال رمز التحقق — تحقق من بريدك أو هاتفك وأدخل الرمز لتفعيل حسابك"
                  : "✅ Verification code sent — check your email or phone to activate your account")
              : (lang === "ar"
                  ? `حسابك بحاجة للتحقق للاحتفاظ ببياناتك واستعادة كلمة المرور مستقبلاً`
                  : `Your account needs verification to keep your data and enable password recovery`)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!sent && identifier && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                color: "#fff",
                boxShadow: "0 2px 8px -4px rgba(245,158,11,0.6)",
              }}
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {lang === "ar" ? "تحقق الآن" : "Verify now"}
            </button>
          )}
          {sent && (
            <a
              href="/verify-account?sent=1"
              className="px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition-all"
              style={{ background: "rgba(245,158,11,0.15)", color: "#92400e" }}
            >
              {lang === "ar" ? "أدخل الرمز" : "Enter code"}
            </a>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "#92400e" }}
            aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface StudentSession {
  id: number;
  username: string;
  displayName: string;
}

function useStudentSession() {
  const [student, setStudent] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setStudent({
            id: data.id,
            username: data.username,
            displayName: data.displayName,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { student, loading };
}

interface LayoutProps {
  children: ReactNode;
  noHeader?: boolean;
}

export function Layout({ children, noHeader }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, lang, setLang, dir } = useI18n();
  const theme = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { data: user, isLoading: teacherLoading } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });
  const { student, loading: studentLoading } = useStudentSession();
  const isLoading = teacherLoading || studentLoading;

  const logoutMutation = useLogoutTeacher({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/";
      },
    },
  });

  const isTeacherAdmin = Boolean((user as any)?.isAdmin) || (user as any)?.role === "admin";
  const dmUnreadCount = useDmUnreadCount(!!user && !isTeacherAdmin);
  const { colorScheme, setColorScheme } = useDarkMode();
  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");
  const cycleColorScheme = () => {
    const next: Record<string, "dark" | "system" | "light"> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setColorScheme(next[colorScheme]);
  };
  const DarkModeIcon =
    colorScheme === "dark" ? Moon : colorScheme === "light" ? Sun : Monitor;
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchString = location.includes("?") ? location.split("?")[1] : "";
  const isEmbed = new URLSearchParams(searchString).get("embed") === "1";

  return (
    <div
      className="min-h-screen flex flex-col bg-background selection:bg-primary/20"
      dir={dir}
    >
      {user && <XpToastListener />}

      {/* ── Verification nudge banner for legacy/unverified accounts ─────── */}
      {user && !(user as any).emailVerified && <VerificationNudgeBanner user={user as any} lang={lang} />}

      {!noHeader && !isEmbed && (
        <header
          className={cn(
            "sticky top-0 z-50 w-full border-b shadow-sm",
            user
              ? "text-white [--header-muted:rgba(255,255,255,0.75)]"
              : "border-border/60 bg-card",
          )}
          style={
            user
              ? { background: "#1E4D35", borderBottomColor: "#C9A050" }
              : undefined
          }
        >
          <div
            className={cn(
              user
                ? "w-full ps-2 pe-3 sm:pe-4 lg:pe-6"
                : "container mx-auto px-4 sm:px-6 lg:px-8",
            )}
          >
            <div className="flex items-center justify-between h-12 sm:h-14">
              {/* Compact brand: logo + name only. The subtitle was removed
                  to free vertical space on dashboards where every pixel
                  counts; the name itself anchors the brand. */}
              <Link
                href="/"
                className="flex items-center group rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-muted/50 transition-colors"
                style={{ gap: 8 }}
              >
                {theme.logoUrl ? (
                  <img
                    src={theme.logoUrl}
                    alt="logo"
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-border/60"
                  />
                ) : (
                  <img
                    src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`}
                    alt="حصاد"
                    className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                  />
                )}
                <span className="flex flex-col leading-none items-center" style={{ gap: 1 }}>
                  <span
                    className="block font-extrabold text-sm sm:text-base text-center"
                    style={{ color: "#C9A050" }}
                  >
                    حــصــاد
                  </span>
                  <span
                    className="block font-black text-[11px] sm:text-[12px] uppercase w-full text-center"
                    style={{ color: "#C9A050", letterSpacing: "0.38em", marginInlineEnd: "-0.38em" }}
                  >
                    HASAAD
                  </span>
                </span>
              </Link>

              {user && (
                <div className="hidden md:flex flex-1 justify-center px-10">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-white/55 pointer-events-none" />
                    <input
                      type="search"
                      placeholder={lang === "ar" ? "ابحث في حصاد…" : "Search Hasad…"}
                      className="w-full h-9 ps-9 pe-3 rounded-full text-sm text-white placeholder:text-white/55 bg-black/20 border border-white/10 focus:outline-none focus:bg-black/25 focus:border-[#C9A050]/70 transition-colors"
                    />
                  </div>
                </div>
              )}

              <nav className="hidden md:flex items-center gap-2.5">
                <button
                  onClick={toggleLang}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors",
                    user
                      ? "text-white/75 hover:text-white hover:bg-white/10"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Languages className="w-3.5 h-3.5" />
                  {lang === "ar" ? "EN" : "عربي"}
                </button>

                {isLoading ? (
                  <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                ) : user ? (
                  <div className="flex items-center gap-2">
                    {/* Role switcher dropdown (admins only). Hasad logo on
                        the start side already serves as the home/dashboard
                        link so an explicit "Dashboard" button would be
                        redundant. */}
                    <AdminUiSwitcher />
                    <XpPill />
                    {!isTeacherAdmin && (
                      <button
                        onClick={() => setDmOpen(true)}
                        className="relative p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors"
                        title={lang === "ar" ? "رسائل المسؤول" : "Admin messages"}
                      >
                        <MessageSquare className="w-5 h-5" />
                        {dmUnreadCount > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#C9A050] text-[#1E4D35] text-[9px] font-black rounded-full flex items-center justify-center shadow-sm"
                          >
                            {dmUnreadCount > 9 ? "9+" : dmUnreadCount}
                          </motion.span>
                        )}
                      </button>
                    )}
                    <NotificationBell onDirectMessageClick={() => {
                      if (isTeacherAdmin) {
                        setLocation("/teacher/admin?tab=messages");
                      } else {
                        setDmOpen(true);
                      }
                    }} />
                    <div className="h-5 w-px bg-white/20 mx-1" />

                    <div className="relative" ref={userMenuRef}>
                      <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors rounded-full px-2 py-1 hover:bg-white/10 border border-[#C9A050]/60"
                      >
                        <div className="w-7 h-7 rounded-full bg-[hsl(146,44%,24%)] text-white font-bold flex items-center justify-center ring-2 ring-[#C9A050]">
                          {user.name?.[0] ?? <User className="w-3.5 h-3.5" />}
                        </div>
                        <span className="hidden lg:inline">{user.name}</span>
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 text-[#C9A050] transition-transform",
                            userMenuOpen && "rotate-180",
                          )}
                        />
                      </button>

                      <AnimatePresence>
                        {userMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.12 }}
                            className="absolute end-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg py-1.5 z-50"
                          >
                            <Link
                              href="/teacher/settings"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full"
                            >
                              <Settings className="w-4 h-4 text-muted-foreground" />
                              {lang === "ar" ? "الإعدادات والحساب" : "Settings & Account"}
                            </Link>
                            <button
                              onClick={() => {
                                cycleColorScheme();
                              }}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full"
                            >
                              <DarkModeIcon className="w-4 h-4 text-muted-foreground" />
                              {colorScheme === "dark"
                                ? lang === "ar"
                                  ? "وضع داكن"
                                  : "Dark mode"
                                : colorScheme === "light"
                                  ? lang === "ar"
                                    ? "وضع فاتح"
                                    : "Light mode"
                                  : lang === "ar"
                                    ? "تلقائي"
                                    : "System"}
                            </button>
                            <div className="border-t border-border/60 my-1" />
                            <button
                              onClick={() => {
                                logoutMutation.mutate();
                                setUserMenuOpen(false);
                              }}
                              disabled={logoutMutation.isPending}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 w-full transition-colors"
                            >
                              {logoutMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <LogOut className="w-4 h-4" />
                              )}
                              {t.nav.logout}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : student ? (
                  <div className="flex items-center gap-1.5">
                    <Link
                      href="/student/dashboard"
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md transition-colors",
                        location.startsWith("/student/")
                          ? "bg-blue-500/10 text-blue-600"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      {lang === "ar" ? "لوحتي" : "My Dashboard"}
                    </Link>
                    <Link
                      href="/game/join"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <Gamepad2 className="w-4 h-4" />
                      {t.nav.joinGame}
                    </Link>
                    <div className="h-5 w-px bg-border mx-1" />
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
                        <GraduationCap className="w-3.5 h-3.5" />
                      </div>
                      <span className="hidden lg:inline font-medium">
                        {student.displayName}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`${API_BASE}/api/student-auth/logout`, {
                          method: "POST",
                          credentials: "include",
                        });
                        queryClient.clear();
                        window.location.href = "/";
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <Link
                      href="/"
                      className={cn(
                        "px-3 py-1.5 text-sm font-semibold rounded-md transition-colors",
                        location === "/"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {lang === "ar" ? "الرئيسية" : "Home"}
                    </Link>
                    <a
                      href="/#games"
                      className="px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {lang === "ar" ? "الألعاب" : "Games"}
                    </a>
                    <a
                      href="/public/games"
                      className="px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {lang === "ar" ? "مسابقات ثقافية" : "Cultural Quizzes"}
                    </a>
                    <a
                      href="/#how-it-works"
                      className="px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {lang === "ar" ? "كيف تعمل؟" : "How it works?"}
                    </a>
                    <div className="h-5 w-px bg-border mx-1.5" />
                    <div className="flex gap-2 flex-row-reverse">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-base font-bold bg-[hsl(145,45%,32%)] text-white rounded-lg hover:bg-[hsl(145,45%,27%)] transition-colors shadow-sm"
                      >
                        <LogIn className="w-4 h-4" />
                        {lang === "ar" ? "تسجيل الدخول" : "Login"}
                      </Link>
                    </div>
                  </div>
                )}
              </nav>

              <div className="flex md:hidden items-center gap-1.5">
                {/* When the teacher is on /teacher* the mobile header is intentionally
                    minimal: only the brand (left) + teacher name + notifications bell.
                    Tab switching lives in the fixed bottom nav, so back/home/lang/menu
                    chrome would just create duplication and clutter. */}
                {user &&
                (location.startsWith("/teacher") ||
                  location.startsWith("/organizer")) ? (
                  <>
                    <button
                      onClick={toggleLang}
                      className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      aria-label={lang === "ar" ? "English" : "العربية"}
                      title={lang === "ar" ? "English" : "العربية"}
                    >
                      <Languages className="w-4 h-4" />
                    </button>
                    <NotificationBell />
                    <button
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="p-2.5 text-white hover:bg-white/10 rounded-lg transition-colors"
                      aria-label={lang === "ar" ? "القائمة" : "Menu"}
                    >
                      <motion.div
                        key={mobileMenuOpen ? "close" : "menu"}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {mobileMenuOpen ? (
                          <X className="w-5 h-5" />
                        ) : (
                          <Menu className="w-5 h-5" />
                        )}
                      </motion.div>
                    </button>
                  </>
                ) : (
                  <>
                    {location !== "/" && (
                      <>
                        <button
                          onClick={() => window.history.back()}
                          title={lang === "ar" ? "رجوع" : "Back"}
                          className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <ChevronRight
                            className={cn("w-5 h-5", lang !== "ar" && "rotate-180")}
                          />
                        </button>
                        <Link
                          href="/"
                          title={lang === "ar" ? "الرئيسية" : "Home"}
                          className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <Home className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={toggleLang}
                          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Languages className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {user && <NotificationBell />}
                    {!isLoading && !user && !student && (
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-[hsl(145,45%,32%)] text-white rounded-lg hover:bg-[hsl(145,45%,27%)] transition-colors shadow-sm"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        {lang === "ar" ? "تسجيل الدخول" : "Login"}
                      </Link>
                    )}
                    <button
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="p-2.5 text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <motion.div
                        key={mobileMenuOpen ? "close" : "menu"}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {mobileMenuOpen ? (
                          <X className="w-5 h-5" />
                        ) : (
                          <Menu className="w-5 h-5" />
                        )}
                      </motion.div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden overflow-hidden border-t border-border/40 bg-background"
              >
                <div className="container mx-auto px-4 py-3 space-y-1">
                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : user ? (
                    <>
                      <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-muted/40 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email || user.phone}
                          </p>
                        </div>
                      </div>
                      {/* Role switcher — only renders for multi-role accounts */}
                      <div className="px-1">
                        <AdminUiSwitcher variant="menu" />
                      </div>
                      <button
                        onClick={() => cycleColorScheme()}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted active:bg-muted/80 w-full transition-colors"
                      >
                        <DarkModeIcon className="w-5 h-5" />
                        {colorScheme === "dark"
                          ? lang === "ar"
                            ? "وضع داكن"
                            : "Dark mode"
                          : colorScheme === "light"
                            ? lang === "ar"
                              ? "وضع فاتح"
                              : "Light mode"
                            : lang === "ar"
                              ? "تلقائي"
                              : "System"}
                      </button>
                      <Link
                        href="/teacher/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted active:bg-muted/80 w-full transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                        {lang === "ar" ? "الإعدادات والحساب" : "Settings & Account"}
                      </Link>
                      <div className="border-t border-border/40 my-1" />
                      <button
                        onClick={() => {
                          logoutMutation.mutate();
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 active:bg-destructive/10 w-full transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        {t.nav.logout}
                      </button>
                    </>
                  ) : student ? (
                    <>
                      <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-blue-500/5 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {student.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{student.username}
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/student/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                          location.startsWith("/student/")
                            ? "bg-blue-500/10 text-blue-600"
                            : "text-foreground hover:bg-muted active:bg-muted/80",
                        )}
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        {lang === "ar" ? "لوحتي" : "My Dashboard"}
                      </Link>
                      <Link
                        href="/game/join"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-bold bg-purple-600 text-white active:bg-purple-700 transition-colors"
                      >
                        <Gamepad2 className="w-5 h-5" />
                        {t.nav.joinGame}
                      </Link>
                      <div className="border-t border-border/40 my-1" />
                      <button
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/student-auth/logout`, {
                            method: "POST",
                            credentials: "include",
                          });
                          setMobileMenuOpen(false);
                          queryClient.clear();
                          window.location.href = "/";
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 active:bg-destructive/10 w-full transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        {t.nav.logout}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                          location === "/"
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Home className="w-5 h-5" />
                        {lang === "ar" ? "الرئيسية" : "Home"}
                      </Link>
                      <a
                        href="/#games"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Gamepad2 className="w-5 h-5" />
                        {lang === "ar" ? "الألعاب" : "Games"}
                      </a>
                      <a
                        href="/#games"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Star className="w-5 h-5" />
                        {lang === "ar" ? "مسابقات ثقافية" : "Cultural Quizzes"}
                      </a>
                      <a
                        href="/#how-it-works"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Sparkles className="w-5 h-5" />
                        {lang === "ar" ? "كيف تعمل؟" : "How it works?"}
                      </a>
                      <div className="border-t border-border/40 my-1" />
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors"
                      >
                        <LogIn className="w-5 h-5" />
                        {lang === "ar" ? "تسجيل الدخول" : "Login"}
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground active:bg-primary/90 transition-colors shadow-sm"
                      >
                        {lang === "ar" ? "ابدأ مجاناً" : "Start Free"}
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      {/* AdminPreviewBanner intentionally removed: the role switcher pills
          in the header already make the current surface clear and the
          banner created an awkward stripe between the green header and the
          green sidebar. */}

      <main className="flex-1">{children}</main>

      <AuthSideRail />

      <footer className="border-t border-border/40 bg-muted/30 mt-auto">
        <div className="container mx-auto px-4 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
                alt="حصاد"
                className="w-5 h-5 rounded object-cover opacity-70"
              />
              <span className="flex flex-col leading-none items-center" style={{ gap: 1 }}>
                <span className="block font-bold text-xs text-center" style={{ color: "#C9A050", opacity: 0.75 }}>حــصــاد</span>
                <span className="block font-black text-[8px] uppercase w-full text-center" style={{ color: "#C9A050", opacity: 0.8, letterSpacing: "0.38em", marginInlineEnd: "-0.38em" }}>HASAAD</span>
              </span>
            </div>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 hover:border-primary/40 text-xs font-bold transition-all shadow-sm hover:shadow min-h-[44px] sm:min-h-0"
              title={t.footer.feedbackHint}
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{t.footer.feedback}</span>
              <span className="hidden sm:inline text-[10px] font-medium opacity-75">· {t.footer.feedbackHint}</span>
            </Link>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {t.footer.copyright}
            </p>
          </div>
        </div>
      </footer>
      {/* Hasad Guide is now mounted globally in App.tsx (<GlobalAiAssistant />)
          so it appears on every teacher/organizer page, including those that
          don't use this Layout (mobile flows hit those a lot). */}
    </div>
  );
}

export function StudentLoginLayout({ children }: LayoutProps) {
  const { lang, setLang, dir } = useI18n();
  const theme = useTheme();
  const { colorScheme, setColorScheme } = useDarkMode();
  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");
  const cycleColorScheme = () => {
    const next: Record<string, "dark" | "system" | "light"> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setColorScheme(next[colorScheme]);
  };
  const DarkModeIcon =
    colorScheme === "dark" ? Moon : colorScheme === "light" ? Sun : Monitor;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <header className="absolute top-0 inset-x-0 z-50 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link href="/" className="flex items-center gap-2">
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt="logo"
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
                  alt="حصاد"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover"
                />
              )}
              {!theme.logoUrl && (
                <span className="flex flex-col leading-none items-center" style={{ gap: 2 }}>
                  <span className="block font-extrabold text-base text-center" style={{ color: "#C9A050" }}>حــصــاد</span>
                  <span className="block font-black text-[10px] uppercase w-full text-center" style={{ color: "#C9A050", letterSpacing: "0.38em", marginInlineEnd: "-0.38em" }}>HASAAD</span>
                </span>
              )}
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:text-white rounded-md transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                {lang === "ar" ? "EN" : "عربي"}
              </button>
              <button
                onClick={cycleColorScheme}
                className="p-1.5 rounded-md text-white/80 hover:text-white transition-colors"
                title={colorScheme}
              >
                <DarkModeIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {user && !isTeacherAdmin && (
        <DirectMessageDrawer open={dmOpen} onClose={() => setDmOpen(false)} />
      )}
    </div>
  );
}
