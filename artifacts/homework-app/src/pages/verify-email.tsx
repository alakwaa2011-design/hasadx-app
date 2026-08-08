/**
 * /verify-email?token=...
 * Handles the one-click email verification link sent in the OTP email.
 * Works whether or not the user has an active session — the token is the credential.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentTeacherQueryKey } from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

type State =
  | { kind: "loading" }
  | { kind: "success"; role: string; name: string }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "error" };

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const queryClient = useQueryClient();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [state, setState] = useState<State>({ kind: "loading" });

  // Resend state (for expired case)
  const [identifier, setIdentifier] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          { credentials: "include" },
        );
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          // Invalidate cached teacher so the session is picked up everywhere
          queryClient.invalidateQueries({ queryKey: getGetCurrentTeacherQueryKey() });
          setState({ kind: "success", role: data.teacher?.role ?? "teacher", name: data.teacher?.name ?? "" });
          // Redirect after 2.5s
          setTimeout(() => {
            const role = data.teacher?.role ?? "teacher";
            setLocation(role === "organizer" ? "/organizer" : "/teacher");
          }, 2500);
        } else if (res.status === 410 || data.expired) {
          setState({ kind: "expired" });
        } else {
          setState({ kind: "invalid" });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async () => {
    if (!identifier.trim() || resending) return;
    setResending(true);
    setResendError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (res.status === 429) {
        setResendError(lang === "ar" ? "يرجى الانتظار دقيقة قبل إعادة الإرسال" : "Wait a minute before resending");
        return;
      }
      setResent(true);
      // After resend, redirect to OTP entry page after 2s
      setTimeout(() => setLocation(`/verify-account?sent=1`), 2000);
    } catch {
      setResendError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
    } finally {
      setResending(false);
    }
  };

  const cardContent = () => {
    if (state.kind === "loading") {
      return (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: "#1a4731" }} />
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "جارٍ التحقق من الرابط…" : "Verifying link…"}
          </p>
        </div>
      );
    }

    if (state.kind === "success") {
      return (
        <div className="text-center py-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: "#14532d" }}>
            {lang === "ar" ? "تم تأكيد بريدك الإلكتروني بنجاح 🎉" : "Email verified successfully! 🎉"}
          </h1>
          {state.name && (
            <p className="text-sm text-muted-foreground mb-1">
              {lang === "ar" ? `مرحباً ${state.name}` : `Welcome, ${state.name}`}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "جاري التوجيه إلى لوحة التحكم…" : "Redirecting to dashboard…"}
          </p>
        </div>
      );
    }

    if (state.kind === "expired") {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#b45309,#d97706)" }}>
              <MailCheck className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-black mb-2" style={{ color: "#92400e" }}>
            {lang === "ar" ? "انتهت صلاحية الرابط" : "Link has expired"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {lang === "ar"
              ? "رابط التحقق صالح لمدة 30 دقيقة فقط. أدخل بريدك الإلكتروني لإرسال رابط جديد."
              : "Verification links are valid for 30 minutes only. Enter your email to get a new one."}
          </p>

          {resent ? (
            <div className="rounded-xl p-4 text-sm"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#14532d" }}>
              {lang === "ar" ? "✅ تم إرسال رابط جديد — تحقق من بريدك" : "✅ New link sent — check your inbox"}
            </div>
          ) : (
            <>
              <input
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResend()}
                placeholder={lang === "ar" ? "البريد الإلكتروني" : "Email address"}
                dir="ltr"
                className="w-full border rounded-xl px-4 py-2.5 text-sm mb-3 outline-none focus:ring-2"
                style={{ borderColor: "rgba(180,83,9,0.3)", direction: "ltr" }}
              />
              {resendError && (
                <p className="text-xs text-destructive mb-3">{resendError}</p>
              )}
              <Button
                type="button"
                onClick={handleResend}
                disabled={!identifier.trim() || resending}
                className="w-full h-11 font-black text-sm rounded-xl"
                style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
              >
                {resending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      {lang === "ar" ? "إرسال رابط جديد" : "Send new link"}
                    </span>
                  )}
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setLocation("/verify-account")}
            className="mt-4 w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {lang === "ar" ? "استخدام رمز OTP بدلاً من ذلك" : "Use OTP code instead"}
          </button>
        </div>
      );
    }

    // invalid or error
    return (
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
            <XCircle className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-black mb-2" style={{ color: "#7f1d1d" }}>
          {lang === "ar" ? "رابط غير صالح" : "Invalid link"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {lang === "ar"
            ? "هذا الرابط غير صالح أو تم استخدامه مسبقاً. يمكنك تسجيل الدخول بكلمة المرور مباشرة."
            : "This link is invalid or has already been used. You can sign in with your password directly."}
        </p>
        <Button
          type="button"
          onClick={() => setLocation("/login")}
          className="w-full h-11 font-black text-sm rounded-xl"
          style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
        >
          {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
        </Button>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ background: "linear-gradient(160deg,#f0f9f4 0%,#faf8f0 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-lg border p-8"
        style={{ borderColor: "rgba(215,165,29,0.25)" }}
      >
        {/* Header */}
        <div className="flex justify-center mb-6">
          <span className="text-lg font-black" style={{ color: "#1a4731" }}>منصة حصاد</span>
        </div>
        {cardContent()}
      </motion.div>
    </div>
  );
}
