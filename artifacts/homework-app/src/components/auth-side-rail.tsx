import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, X } from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DISMISS_KEY = "auth_rail_dismissed_v1";

const HIDE_PATHS = [
  /^\/login/,
  /^\/register/,
  /^\/student\/(login|register)/,
  /^\/auth/,
  /^\/install/,
  /^\/game\//,
];

export function AuthSideRail() {
  return null;
  const [location] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const { data: user, isLoading: tLoading } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });
  const [student, setStudent] = useState<{ id: number } | null>(null);
  const [sLoading, setSLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStudent(d))
      .catch(() => {})
      .finally(() => setSLoading(false));
  }, []);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  if (tLoading || sLoading) return null;
  if (user || student) return null;
  if (dismissed) return null;
  if (HIDE_PATHS.some((re) => re.test(location))) return null;

  return (
    <>
      {/* DESKTOP: vertical fixed rail on the start edge */}
      <motion.aside
        initial={{ opacity: 0, x: isAr ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 240, damping: 28 }}
        className="hidden lg:flex fixed top-1/2 -translate-y-1/2 start-0 z-40 flex-col items-stretch gap-2 rounded-e-2xl bg-white/95 backdrop-blur-md border border-s-0 border-[hsl(145,20%,82%)] shadow-xl shadow-black/10 p-2.5 w-[68px]"
        aria-label={isAr ? "تسجيل الدخول أو إنشاء حساب" : "Login or sign up"}
      >
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
          aria-label={isAr ? "إخفاء" : "Dismiss"}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <Link
          href="/register"
          className="group flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl bg-[hsl(145,45%,32%)] hover:bg-[hsl(145,45%,27%)] text-white transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-tight text-center">
            {isAr ? "ابدأ مجاناً" : "Start Free"}
          </span>
        </Link>

        <Link
          href="/login"
          className="group flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl border border-[hsl(145,20%,82%)] bg-white hover:bg-[hsl(145,40%,28%)]/8 text-[hsl(145,40%,28%)] transition-colors"
        >
          <LogIn className="w-5 h-5" />
          <span className="text-[10px] font-bold leading-tight text-center">
            {isAr ? "دخول" : "Login"}
          </span>
        </Link>
      </motion.aside>

      {/* MOBILE / TABLET: single FAB → opens compact action sheet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 240, damping: 28 }}
        className="lg:hidden fixed bottom-4 start-4 z-40"
      >
        <div className="relative">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-full bg-[hsl(145,45%,32%)] hover:bg-[hsl(145,45%,27%)] text-white shadow-xl shadow-black/20 flex items-center justify-center transition-colors"
            aria-label={
              isAr ? "تسجيل الدخول أو إنشاء حساب" : "Login or sign up"
            }
            style={{ height: 56, width: 56 }}
          >
            <UserPlus className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={isAr ? "إخفاء" : "Dismiss"}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-3"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="bg-white dark:bg-card rounded-3xl p-5 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              dir={isAr ? "rtl" : "ltr"}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-rail-sheet-title"
            >
              <h3
                id="auth-rail-sheet-title"
                className="text-base font-black text-foreground mb-3 text-center"
              >
                {isAr ? "ابدأ مع حصاد" : "Get started with Hasad"}
              </h3>
              <div className="flex flex-col gap-2">
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 px-4 rounded-xl bg-[hsl(145,45%,32%)] hover:bg-[hsl(145,45%,27%)] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {isAr ? "ابدأ مجاناً" : "Start Free"}
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 px-4 rounded-xl border border-border hover:bg-muted text-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  {isAr ? "تسجيل الدخول" : "Login"}
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 py-1"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
