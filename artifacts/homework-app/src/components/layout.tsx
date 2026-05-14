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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "./notification-bell";
import { XpToastListener } from "./xp-toast-listener";
import { AuthSideRail } from "./auth-side-rail";
import { AdminUiSwitcher } from "./admin-ui-switcher";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-provider";
import { useDarkMode } from "@/lib/dark-mode";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
      {!noHeader && !isEmbed && (
        <header
          className={cn(
            "sticky top-0 z-50 w-full border-b shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
            user
              ? "border-[rgba(232,168,14,0.25)] text-white [--header-muted:rgba(255,255,255,0.75)]"
              : "border-border/60 bg-card",
          )}
          style={
            user
              ? { background: "hsl(145,45%,32%)" }
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
                href={
                  user
                    ? location.startsWith("/organizer")
                      ? "/organizer"
                      : "/teacher"
                    : "/"
                }
                className="flex items-center gap-2 group rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-muted/50 transition-colors"
              >
                {theme.logoUrl ? (
                  <img
                    src={theme.logoUrl}
                    alt="logo"
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-border/60"
                  />
                ) : (
                  <img
                    src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                    alt="حصاد"
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover"
                  />
                )}
                <span
                  className={cn(
                    "text-sm sm:text-base font-extrabold tracking-tight",
                    user ? "text-white" : "text-foreground",
                  )}
                >
                  {lang === "ar" ? "حصاد" : "Hasad"}
                </span>
              </Link>

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
                  <div className="flex items-center gap-1.5">
                    {/* Context-aware Dashboard link.
                        On /organizer*, the button stays on the organizer
                        dashboard so it doesn't kick the user back to the
                        teacher screen. A separate "as Teacher" link lets
                        them jump to the teacher view on demand. */}
                    {/* Dashboard link only — switching between teacher /
                        organizer / admin surfaces is reserved for the
                        AdminUiSwitcher pills below so an organizer can never
                        slip into the teacher view by accident. */}
                    {location.startsWith("/organizer") ? (
                      <Link
                        href="/organizer"
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md transition-colors",
                          location === "/organizer"
                            ? "bg-[#E8A80E]/15 text-[#E8A80E]"
                            : "text-white/75 hover:text-white hover:bg-white/10",
                        )}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        {lang === "ar" ? "لوحة المنظّم" : "Organizer Dashboard"}
                      </Link>
                    ) : (
                      <Link
                        href="/teacher"
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md transition-colors",
                          location === "/teacher" ||
                            location.startsWith("/teacher/")
                            ? "bg-[#E8A80E]/15 text-[#E8A80E]"
                            : "text-white/75 hover:text-white hover:bg-white/10",
                        )}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
                      </Link>
                    )}
                    <AdminUiSwitcher />
                    <NotificationBell />
                    <div className="h-5 w-px bg-white/20 mx-1" />

                    <div className="relative" ref={userMenuRef}>
                      <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-1.5 text-sm font-medium text-white/85 hover:text-white transition-colors rounded-full px-2 py-1 hover:bg-white/10 border border-white/15"
                      >
                        <div className="w-7 h-7 rounded-full bg-[hsl(146,44%,24%)] text-white font-bold flex items-center justify-center">
                          {user.name?.[0] ?? <User className="w-3.5 h-3.5" />}
                        </div>
                        <span className="hidden lg:inline">{user.name}</span>
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 transition-transform",
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
                    <span className="text-sm font-extrabold text-white max-w-[34vw] truncate">
                      {user.name}
                    </span>
                    <AdminUiSwitcher variant="compact" />
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
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt="حصاد"
                className="w-5 h-5 rounded object-cover opacity-70"
              />
              <span className="font-semibold text-sm opacity-70">حصاد</span>
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
                  src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                  alt="حصاد"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover"
                />
              )}
              {!theme.logoUrl && (
                <span className="font-bold text-lg text-white drop-shadow-sm">
                  حصاد
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
    </div>
  );
}
