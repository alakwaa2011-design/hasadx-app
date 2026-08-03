/**
 * /verify-account
 * Standalone OTP verification page — works whether or not the user is logged in.
 * Linked from the verification nudge banner shown to legacy accounts.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, RotateCcw, Loader2, AlertCircle, Phone, CheckCircle2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui-elements";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentTeacherQueryKey } from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function VerifyAccountPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const queryClient = useQueryClient();

  const { data: teacher, isLoading: teacherLoading } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // If the banner already sent the OTP before navigating here, skip straight to entry
  const [otpSent, setOtpSent] = useState(() =>
    new URLSearchParams(window.location.search).get("sent") === "1"
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!teacherLoading && !teacher) setLocation("/login");
  }, [teacher, teacherLoading, setLocation]);

  // Redirect if already verified
  useEffect(() => {
    if (teacher && (teacher as any).emailVerified) {
      const role = (teacher as any).role;
      setLocation(role === "organizer" ? "/organizer" : "/teacher");
    }
  }, [teacher, setLocation]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (teacherLoading || !teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1a4731" }} />
      </div>
    );
  }

  const identifier = (teacher as any).email || (teacher as any).phone || "";
  const channel: "email" | "sms" = (teacher as any).email ? "email" : "sms";

  const maskedIdentifier = channel === "email"
    ? identifier.replace(/(.{2})(.+)(@.+)/, (_: string, a: string, _b: string, c: string) => `${a}***${c}`)
    : identifier.replace(/(\+\d{3})\d+(\d{4})/, "$1***$2");

  const sendOtp = async () => {
    if (sending || countdown > 0) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || (lang === "ar" ? "تعذّر إرسال الرمز" : "Failed to send code"));
        return;
      }
      setOtpSent(true);
      setCountdown(60);
    } catch {
      setError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || (lang === "ar" ? "رمز غير صحيح" : "Invalid code"));
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Invalidate the teacher query so the banner disappears
      queryClient.invalidateQueries({ queryKey: getGetCurrentTeacherQueryKey() });
      setTimeout(() => {
        const role = data.teacher?.role ?? (teacher as any).role;
        setLocation(role === "organizer" ? "/organizer" : "/teacher");
      }, 2000);
    } catch {
      setError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir={dir}
      style={{ background: "linear-gradient(160deg,#f0f9f4 0%,#faf8f0 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-lg border p-8"
        style={{ borderColor: "rgba(215,165,29,0.25)" }}
      >
        {success ? (
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-black mb-2" style={{ color: "#14532d" }}>
              {lang === "ar" ? "تم التحقق بنجاح! 🎉" : "Verified successfully! 🎉"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "جاري التوجيه…" : "Redirecting…"}
            </p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#1e5238,#2a6647)", boxShadow: "0 6px 20px -6px rgba(30,82,56,0.45)" }}
              >
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-center mb-1.5" style={{ color: "#1a4731" }}>
              {lang === "ar" ? "تحقق من حسابك" : "Verify your account"}
            </h1>
            <p className="text-sm text-center text-muted-foreground mb-4 leading-relaxed">
              {lang === "ar"
                ? "تحقق من حسابك للاحتفاظ ببياناتك وتفعيل استعادة كلمة المرور"
                : "Verify your account to keep your data and enable password recovery"}
            </p>

            {!otpSent ? (
              <>
                <div
                  className="rounded-xl p-4 mb-5 text-sm leading-relaxed"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#78350f" }}
                >
                  {lang === "ar"
                    ? `سنرسل رمزاً للتحقق إلى`
                    : `We'll send a verification code to`}{" "}
                  <span className="font-bold" dir="ltr">
                    {channel === "sms" && <Phone className="w-3 h-3 inline me-0.5" />}
                    {maskedIdentifier}
                  </span>
                </div>

                <Button
                  type="button"
                  className="w-full h-11 font-black text-sm rounded-xl"
                  onClick={sendOtp}
                  disabled={sending}
                  style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "إرسال الرمز" : "Send code")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-center mb-4" style={{ color: "#3a6a4d" }}>
                  {lang === "ar" ? "تم إرسال الرمز إلى" : "Code sent to"}{" "}
                  <span className="font-bold" dir="ltr">{maskedIdentifier}</span>
                </p>

                {/* OTP Input */}
                <div className="flex justify-center mb-4" dir="ltr">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} onComplete={handleVerify}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg font-black" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-3 rounded-xl bg-destructive/8 border border-destructive/20 flex items-center gap-2 text-destructive text-sm"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="button"
                  className="w-full h-11 font-black text-sm rounded-xl mb-3"
                  disabled={otp.length !== 6 || loading}
                  onClick={handleVerify}
                  style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "تحقق وادخل" : "Verify & continue")}
                </Button>

                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={countdown > 0 || sending}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-xl disabled:opacity-50"
                  style={{ color: countdown > 0 ? "#9ca3af" : "#1a4731" }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {countdown > 0
                    ? (lang === "ar" ? `إعادة الإرسال بعد ${countdown}ث` : `Resend in ${countdown}s`)
                    : (lang === "ar" ? "إعادة إرسال الرمز" : "Resend code")}
                </button>

                {/* "Didn't receive the code?" help panel */}
                <div
                  className="mt-3 rounded-xl p-3.5 text-xs leading-relaxed"
                  style={{ background: "rgba(26,71,49,0.05)", border: "1px solid rgba(26,71,49,0.12)" }}
                >
                  <p className="font-bold mb-1.5" style={{ color: "#1a4731" }}>
                    {lang === "ar" ? "لم يصلك الرمز؟" : "Didn't receive the code?"}
                  </p>
                  <ul className="space-y-1 text-muted-foreground" style={{ listStyleType: "disc", paddingInlineStart: "1.2rem" }}>
                    {channel === "email" && (
                      <li>{lang === "ar" ? "تحقق من مجلد البريد غير المرغوب (Spam / Junk)" : "Check your spam or junk folder"}</li>
                    )}
                    <li>
                      {lang === "ar"
                        ? `الرمز صالح لمدة ${channel === "email" ? "30" : "10"} دقيقة — انتظر قليلاً ثم تحقق مجدداً`
                        : `The code is valid for ${channel === "email" ? "30" : "10"} minutes — wait a moment then check again`}
                    </li>
                    <li>
                      {lang === "ar" ? (
                        <>
                          تحتاج مساعدة؟{" "}
                          <a href="mailto:support@hasadx.com" className="underline font-semibold" style={{ color: "#1a4731" }}>
                            تواصل مع الدعم
                          </a>
                        </>
                      ) : (
                        <>
                          Need help?{" "}
                          <a href="mailto:support@hasadx.com" className="underline font-semibold" style={{ color: "#1a4731" }}>
                            Contact support
                          </a>
                        </>
                      )}
                    </li>
                  </ul>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setLocation((teacher as any).role === "organizer" ? "/organizer" : "/teacher")}
              className="mt-4 w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "ar" ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
