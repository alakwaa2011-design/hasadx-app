import { useState, useEffect, ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Input, Button, Label } from "@/components/ui-elements";
import {
  Loader2, Lock, User, AlertCircle, Eye, EyeOff,
  GraduationCap, ArrowLeft, ArrowRight, Star, Zap, Trophy, Shield,
  BookOpen, BarChart2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { GoogleLogin } from "@react-oauth/google";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ─────────────────────────── StudentLoginLayout ─────────────────────────── */

function StudentLoginLayout({
  children, dir, lang,
}: { children: ReactNode; dir: "rtl" | "ltr"; lang: string }) {
  const isAr = lang === "ar";
  return (
    <div
      className="min-h-screen flex flex-col"
      dir={dir}
      style={{ background: "hsl(40 33% 98%)" }}
    >
      <header className="flex items-center justify-between px-5 sm:px-8 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt={isAr ? "حصاد" : "Hasad"}
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <span className="text-xl font-extrabold" style={{ color: "#1a4731" }}>
            {isAr ? "حصاد" : "Hasad"}
          </span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-black/5"
        >
          {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 rotate-180" />}
          {isAr ? "العودة للرئيسية" : "Back to Home"}
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground/60">
        {isAr
          ? `منصة حصاد © ${new Date().getFullYear()} — جميع الحقوق محفوظة`
          : `Hasad Platform © ${new Date().getFullYear()} — All rights reserved`}
      </footer>
    </div>
  );
}

/* ─────────────────────────── StudentSidePanel ─────────────────────────── */

function StudentSidePanel({ lang }: { lang: string }) {
  const isAr = lang === "ar";

  const highlights = isAr
    ? [
        { icon: <GraduationCap className="w-5 h-5" />, text: "تابع مسيرتك التعليمية بسهولة" },
        { icon: <Trophy className="w-5 h-5" />,        text: "نافس زملاءك في ألعاب حية مثيرة" },
        { icon: <Zap className="w-5 h-5" />,           text: "حلّ واجباتك بطريقة ممتعة وسريعة" },
        { icon: <BarChart2 className="w-5 h-5" />,     text: "شاهد تقدمك ودرجاتك لحظة بلحظة" },
        { icon: <BookOpen className="w-5 h-5" />,      text: "تعلّم بأسلوب تفاعلي مخصص لك" },
      ]
    : [
        { icon: <GraduationCap className="w-5 h-5" />, text: "Track your learning journey with ease" },
        { icon: <Trophy className="w-5 h-5" />,        text: "Compete with classmates in exciting live games" },
        { icon: <Zap className="w-5 h-5" />,           text: "Complete assignments in a fun, fast way" },
        { icon: <BarChart2 className="w-5 h-5" />,     text: "See your progress and scores in real time" },
        { icon: <BookOpen className="w-5 h-5" />,      text: "Learn with an interactive style made for you" },
      ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="hidden lg:flex flex-col justify-between p-10 xl:p-14 rounded-2xl h-full"
      style={{ background: "linear-gradient(145deg, #4c1d95 0%, #2e1065 60%, #1e1b4b 100%)" }}
    >
      <div>
        <div className="flex items-center gap-3 mb-10">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt={isAr ? "حصاد" : "Hasad"}
            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/20 shadow-lg"
          />
          <span className="text-3xl font-extrabold text-white tracking-wide">
            {isAr ? "حصاد" : "Hasad"}
          </span>
        </div>

        <h2 className="text-2xl xl:text-3xl font-black text-white leading-snug mb-3">
          {isAr ? "بوابة الطالب" : "Student Portal"}
        </h2>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          {isAr
            ? (<>تعلّم بطريقة مختلفة. نافس وتقدّم.<br />حوّل واجباتك إلى تجربة لا تُنسى.</>)
            : (<>Learn differently. Compete and grow.<br />Turn homework into an unforgettable experience.</>)}
        </p>

        <div className="space-y-4">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(167,139,250,0.18)" }}
              >
                <span style={{ color: "#a78bfa" }}>{h.icon}</span>
              </div>
              <span className="text-white/80 text-sm font-medium">{h.text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-white/30 text-xs mt-10">
        {isAr
          ? `منصة حصاد © ${new Date().getFullYear()}`
          : `Hasad Platform © ${new Date().getFullYear()}`}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────── TrustLinks ─────────────────────────── */

function TrustLinks({ lang }: { lang: string }) {
  const isAr = lang === "ar";
  return (
    <div className="mt-6 pt-5 border-t border-border/40">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground/70">
        <Link href="/privacy" className="hover:text-muted-foreground transition-colors">
          {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
        </Link>
        <span className="opacity-40">·</span>
        <Link href="/terms" className="hover:text-muted-foreground transition-colors">
          {isAr ? "الشروط والأحكام" : "Terms of Service"}
        </Link>
        <span className="opacity-40">·</span>
        <Link href="/faq" className="hover:text-muted-foreground transition-colors">
          {isAr ? "الأسئلة الشائعة" : "FAQ"}
        </Link>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3 text-xs font-medium" style={{ color: "#4c1d95", opacity: 0.7 }}>
        <Shield className="w-3.5 h-3.5" />
        <span>{isAr ? "بياناتك محمية بتشفير كامل" : "Your data is fully encrypted"}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Component ─────────────────────────── */

export default function StudentAuth() {
  const [location, setLocation] = useLocation();
  const isLogin = location === "/student/login";
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then(r => {
        if (r.ok) setLocation("/student/dashboard");
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const endpoint = isLogin ? "login" : "register";
      const body = isLogin
        ? { username, password }
        : { username, displayName, password };

      const res = await fetch(`${API_BASE}/api/student-auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || (isAr ? "حدث خطأ" : "An error occurred"));
        return;
      }

      toast.success(
        isLogin
          ? (isAr ? "تم تسجيل الدخول بنجاح" : "Logged in successfully")
          : (isAr ? "تم إنشاء الحساب بنجاح" : "Account created successfully")
      );
      setLocation("/student/dashboard");
    } catch {
      setErrorMsg(isAr ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  const iconPositionClass = isAr ? "right-4" : "left-4";
  const inputPaddingClass = isAr ? "pr-12" : "pl-12";

  if (checkingSession) {
    return (
      <StudentLoginLayout dir={dir} lang={lang}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#4c1d95" }} />
        </div>
      </StudentLoginLayout>
    );
  }

  return (
    <StudentLoginLayout dir={dir} lang={lang}>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl flex gap-8 items-stretch">

          {/* ── Side Panel (lg+) ── */}
          <div className="lg:w-[42%] xl:w-[40%] flex-shrink-0">
            <StudentSidePanel lang={lang} />
          </div>

          {/* ── Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}
            className="flex-1 w-full"
          >
            <div
              className="bg-white rounded-3xl shadow-lg border p-7 sm:p-9"
              style={{ borderColor: "hsl(40 20% 88%)" }}
            >
              {/* Card top accent bar */}
              <div className="h-1.5 -mx-7 sm:-mx-9 -mt-7 sm:-mt-9 mb-7 rounded-t-3xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400" />

              {/* Header */}
              <div className="mb-7">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                  >
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold" style={{ color: "#4c1d95" }}>
                      {isLogin
                        ? (isAr ? "أهلاً بعودتك 👋" : "Welcome back 👋")
                        : (isAr ? "انضم إلينا 🚀" : "Join us 🚀")}
                    </h1>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  {isLogin
                    ? (isAr ? "سجّل دخولك وتابع تقدمك ومسيرتك التعليمية" : "Log in and continue your learning journey")
                    : (isAr ? "أنشئ حسابك وابدأ رحلتك التعليمية معنا" : "Create your account and start learning with us")}
                </p>
              </div>

              {/* Tab Switcher */}
              <div
                className="flex items-center rounded-2xl p-1 mb-6 relative"
                style={{ background: "hsl(40 20% 92%)" }}
              >
                <motion.div
                  layout
                  layoutId="student-auth-tab"
                  className="absolute top-1 bottom-1 rounded-xl shadow-sm border"
                  style={{
                    width: "calc(50% - 4px)",
                    [isAr ? "right" : "left"]: isLogin ? "4px" : "calc(50%)",
                    background: "#fff",
                    borderColor: "hsl(40 20% 88%)",
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                />
                <Link
                  href="/student/login"
                  className={`relative z-10 flex-1 text-center py-2.5 text-sm font-bold rounded-xl transition-colors ${isLogin ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isAr ? "تسجيل الدخول" : "Login"}
                </Link>
                <Link
                  href="/student/register"
                  className={`relative z-10 flex-1 text-center py-2.5 text-sm font-bold rounded-xl transition-colors ${!isLogin ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isAr ? "حساب جديد" : "New Account"}
                </Link>
              </div>

              {/* Error */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 flex items-start gap-2.5 text-destructive"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{errorMsg}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Google Login — full-width prominent */}
              <div className="mb-2 flex flex-col items-center gap-4">
                <div className="relative w-full" style={{ height: 48 }}>
                  {/* Visual layer — custom styled full-width Google button */}
                  <div
                    className="absolute inset-0 flex items-center justify-center gap-3 rounded-xl bg-white border-2 border-gray-200 shadow-md font-semibold text-gray-700 text-sm pointer-events-none"
                    style={{ zIndex: 1 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    {isAr ? "المتابعة عبر Google" : "Continue with Google"}
                  </div>
                  {/* Click layer — invisible Google OAuth iframe that captures clicks */}
                  <div className="absolute inset-0 overflow-hidden rounded-xl" style={{ opacity: 0.01, zIndex: 2 }}>
                    <GoogleLogin
                      onSuccess={async (resp) => {
                        if (!resp.credential) {
                          toast.error(isAr ? "تعذّر الحصول على بيانات Google" : "Failed to get Google credentials");
                          return;
                        }
                        try {
                          const r = await fetch(`${API_BASE}/api/student-auth/google`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ credential: resp.credential }),
                          });
                          const data = await r.json();
                          if (!r.ok) {
                            toast.error(data.message || (isAr ? "تعذّر تسجيل الدخول" : "Login failed"));
                            return;
                          }
                          toast.success(isAr ? "تم تسجيل الدخول بنجاح" : "Logged in successfully");
                          setLocation("/student/dashboard");
                        } catch {
                          toast.error(isAr ? "خطأ في الاتصال" : "Connection error");
                        }
                      }}
                      onError={() => {
                        toast.error(isAr ? "تعذّر تسجيل الدخول عبر Google" : "Google sign-in failed");
                      }}
                      locale={isAr ? "ar" : "en"}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width="600"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-xs font-bold text-muted-foreground/70 px-2 shrink-0">أو</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              </div>

              {/* Form */}
              <AnimatePresence mode="wait">
                <motion.form
                  key={isLogin ? "login" : "register"}
                  initial={{ opacity: 0, x: isLogin ? -12 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isLogin ? 12 : -12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="username">{isAr ? "اسم المستخدم" : "Username"}</Label>
                    <div className="relative">
                      <User className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                      <Input
                        id="username"
                        type="text"
                        placeholder={isAr ? "مثال: ahmed_2024" : "e.g. ahmed_2024"}
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                        required
                        className={inputPaddingClass}
                        disabled={isLoading}
                        dir="ltr"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <Label htmlFor="displayName">{isAr ? "الاسم الظاهر" : "Display Name"}</Label>
                      <div className="relative">
                        <GraduationCap className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                        <Input
                          id="displayName"
                          type="text"
                          placeholder={isAr ? "مثال: أحمد محمد" : "e.g. Ahmed Mohammed"}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required={!isLogin}
                          className={inputPaddingClass}
                          disabled={isLoading}
                        />
                      </div>
                    </motion.div>
                  )}

                  <div>
                    <Label htmlFor="password">{isAr ? "كلمة المرور" : "Password"}</Label>
                    <div className="relative">
                      <Lock className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={isAr ? "كلمة المرور" : "Password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={4}
                        className={`${inputPaddingClass} ${isAr ? "pl-12" : "pr-12"}`}
                        disabled={isLoading}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute ${isAr ? "left-4" : "right-4"} top-3.5 text-muted-foreground hover:text-foreground transition-colors`}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3.5 text-base font-bold text-white shadow-lg border-0 mt-1"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : isLogin ? (
                      isAr ? "دخول ✨" : "Login ✨"
                    ) : (
                      isAr ? "إنشاء الحساب 🚀" : "Create Account 🚀"
                    )}
                  </Button>
                </motion.form>
              </AnimatePresence>


              {/* Switch link — full-width outlined green button */}
              <Link
                href={isLogin ? "/student/register" : "/student/login"}
                className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 font-bold text-sm transition-all hover:bg-green-50 dark:hover:bg-green-950/20 active:scale-[0.98]"
                style={{ borderColor: "#1a7a45", color: "#1a7a45" }}
              >
                {isLogin ? (
                  <>
                    <span style={{ fontSize: "1.1em" }}>✦</span>
                    {isAr ? "ليس لديك حساب؟ سجّل الآن" : "Don't have an account? Register now"}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "1.1em" }}>←</span>
                    {isAr ? "لديك حساب بالفعل؟ سجّل دخولك" : "Already have an account? Login"}
                  </>
                )}
              </Link>

              {/* Teacher login link — prominent */}
              <Link
                href="/login"
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 font-bold text-sm transition-all hover:bg-primary/5 active:scale-[0.98]"
                style={{ borderColor: "#1a7a45", color: "#1a7a45" }}
              >
                {isAr
                  ? <ArrowRight className="w-4 h-4" />
                  : <ArrowLeft className="w-4 h-4" />}
                {isAr ? "دخول كمعلم / منظّم" : "Login as Teacher / Organizer"}
              </Link>

              {/* Trust Links */}
              <TrustLinks lang={lang} />
            </div>

            {/* Fun stats row below card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex items-center justify-center gap-6 mt-5"
            >
              {[
                { icon: <Star className="w-4 h-4" />, label: isAr ? "ألعاب ممتعة" : "Fun Games" },
                { icon: <Zap className="w-4 h-4" />, label: isAr ? "تعلّم سريع" : "Fast Learning" },
                { icon: <Trophy className="w-4 h-4" />, label: isAr ? "مسابقات حية" : "Live Contests" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-muted-foreground/70 text-xs font-semibold">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </StudentLoginLayout>
  );
}
