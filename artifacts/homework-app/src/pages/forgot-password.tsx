import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Input, Button, Label } from "@/components/ui-elements";
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function ForgotPassword() {
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [identifier, setIdentifier] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const iconPositionClass = lang === "ar" ? "right-4" : "left-4";
  const inputPaddingClass = lang === "ar" ? "pr-12" : "pl-12";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const value = identifier.trim();
    if (!value) {
      setErrorMsg(t.auth.forgotPasswordEmptyError);
      return;
    }

    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: value }),
      });
    } catch {
      // Silently ignore — UX should not reveal whether identifier exists.
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)] flex items-center justify-center p-5 sm:p-8 lg:p-12 bg-background" dir={dir}>
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
            <ArrowLeft className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`} />
            {t.auth.backToLogin}
          </Link>

          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-7">
                  <h1 className="text-2xl font-extrabold text-foreground mb-1">
                    {t.auth.forgotPasswordTitle}
                  </h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t.auth.forgotPasswordDesc}
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
                    <Label htmlFor="identifier">
                      {lang === "ar" ? "البريد الإلكتروني أو رقم الهاتف" : "Email or phone number"}
                    </Label>
                    <div className="relative">
                      <Mail className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                      <Input
                        id="identifier"
                        type="text"
                        placeholder={lang === "ar" ? "example@email.com" : "example@email.com"}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        className={`${inputPaddingClass} text-left`}
                        dir="ltr"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full py-3.5 text-base mt-1" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      t.auth.forgotPasswordSubmit
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-9 h-9 text-primary" />
                </div>
                <h1 className="text-2xl font-extrabold text-foreground mb-2">
                  {t.auth.forgotPasswordSent}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-7">
                  {t.auth.forgotPasswordSentDesc}
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
