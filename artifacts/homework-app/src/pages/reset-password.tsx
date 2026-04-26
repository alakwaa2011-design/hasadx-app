import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Input, Button, Label } from "@/components/ui-elements";
import {
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Status = "checking" | "invalid" | "ready" | "success";

export default function ResetPassword() {
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const iconPositionClass = lang === "ar" ? "right-4" : "left-4";
  const inputPaddingClass = lang === "ar" ? "pr-12" : "pl-12";

  useEffect(() => {
    let active = true;
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`,
          { credentials: "include" },
        );
        const data = await res.json().catch(() => ({ valid: false }));
        if (!active) return;
        setStatus(data?.valid ? "ready" : "invalid");
      } catch {
        if (active) setStatus("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg(t.auth.resetPasswordTooShort);
      return;
    }
    if (password !== confirmPwd) {
      setErrorMsg(t.auth.resetPasswordMismatch);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.message || t.auth.resetPasswordInvalidLink);
        if (res.status === 400 && /غير صالح|invalid|expired/i.test(data?.message || "")) {
          setStatus("invalid");
        }
        return;
      }
      setStatus("success");
      setTimeout(() => setLocation("/login"), 2500);
    } catch {
      setErrorMsg(t.auth.resetPasswordInvalidLink);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)] flex items-center justify-center p-5 sm:p-8 lg:p-12 bg-background"
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft
              className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`}
            />
            {t.auth.backToLogin}
          </Link>

          <AnimatePresence mode="wait">
            {status === "checking" && (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-10"
              >
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                <p className="text-muted-foreground text-sm">
                  {t.auth.resetPasswordChecking}
                </p>
              </motion.div>
            )}

            {status === "invalid" && (
              <motion.div
                key="invalid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
                  <AlertCircle className="w-9 h-9 text-destructive" />
                </div>
                <h1 className="text-2xl font-extrabold text-foreground mb-2">
                  {t.auth.resetPasswordInvalidLink}
                </h1>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center justify-center w-full py-3.5 px-4 mt-4 text-base font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t.auth.resetPasswordRequestNew}
                </Link>
              </motion.div>
            )}

            {status === "ready" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-7">
                  <h1 className="text-2xl font-extrabold text-foreground mb-1">
                    {t.auth.resetPasswordTitle}
                  </h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t.auth.resetPasswordDesc}
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 flex items-start gap-2.5 text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{errorMsg}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="newPassword">
                      {t.auth.resetPasswordNew}
                    </Label>
                    <div className="relative">
                      <Lock
                        className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`}
                      />
                      <Input
                        id="newPassword"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className={`${inputPaddingClass} text-left`}
                        dir="ltr"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">
                      {t.auth.resetPasswordConfirm}
                    </Label>
                    <div className="relative">
                      <Lock
                        className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`}
                      />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        required
                        minLength={6}
                        className={`${inputPaddingClass} text-left`}
                        dir="ltr"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3.5 text-base mt-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      t.auth.resetPasswordSubmit
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-9 h-9 text-primary" />
                </div>
                <h1 className="text-2xl font-extrabold text-foreground mb-2">
                  {t.auth.resetPasswordSuccess}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-7">
                  {t.auth.resetPasswordSuccessDesc}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full py-3.5 px-4 text-base font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t.auth.backToLogin}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Layout>
  );
}
