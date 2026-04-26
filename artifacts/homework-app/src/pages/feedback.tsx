import { useState } from "react";
import { Link } from "wouter";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { Loader2, MessageSquarePlus, Lightbulb, Bug, Sparkles, CheckCircle2, ArrowRight, ArrowLeft, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const FEEDBACK_TYPES = ["suggestion", "bug", "feature"] as const;

export default function FeedbackPage() {
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const [type, setType] = useState<typeof FEEDBACK_TYPES[number]>("suggestion");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mutation = useSubmitFeedback({
    mutation: {
      onSuccess: () => setSubmitted(true),
      onError: (err: any) => {
        const msg = err.message || t.feedback.errorMsg;
        setErrorMsg(msg);
        toast.error(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    mutation.mutate({
      data: {
        type,
        name,
        email: email || undefined,
        message,
      },
    });
  };

  const resetForm = () => {
    setType("suggestion");
    setName("");
    setEmail("");
    setMessage("");
    setSubmitted(false);
    setErrorMsg("");
  };

  const typeConfig = {
    suggestion: {
      icon: Lightbulb,
      label: t.feedback.typeSuggestion,
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50 border-amber-200 text-amber-700",
      activeBg: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25",
    },
    bug: {
      icon: Bug,
      label: t.feedback.typeBug,
      color: "from-red-500 to-rose-500",
      bg: "bg-red-50 border-red-200 text-red-700",
      activeBg: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25",
    },
    feature: {
      icon: Sparkles,
      label: t.feedback.typeFeature,
      color: "from-violet-500 to-purple-500",
      bg: "bg-violet-50 border-violet-200 text-violet-700",
      activeBg: "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25",
    },
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-5rem)] py-8 px-4 sm:px-6">
        <div className="container mx-auto max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <BackArrow className="w-4 h-4" />
            {t.feedback.backHome}
          </Link>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-16"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-green-500/30"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-3xl font-extrabold text-foreground mb-3">
                  {t.feedback.successTitle}
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                  {t.feedback.successMsg}
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <Button onClick={resetForm} className="px-6 py-3">
                    <MessageSquarePlus className="w-4 h-4" />
                    {t.feedback.sendAnother}
                  </Button>
                  <Link href="/">
                    <Button variant="outline" className="px-6 py-3">
                      {t.feedback.backHome}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                    <MessageSquarePlus className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl font-extrabold text-foreground mb-2">
                    {t.feedback.title}
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    {t.feedback.subtitle}
                  </p>
                </div>

                <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-primary">
                  {errorMsg && (
                    <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                      {errorMsg}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label className="mb-3 block">{t.feedback.typeSuggestion.split(" ")[0] === "اقتراح" ? "نوع الملاحظة" : "Feedback Type"}</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {FEEDBACK_TYPES.map((ft) => {
                          const cfg = typeConfig[ft];
                          const Icon = cfg.icon;
                          const isActive = type === ft;
                          return (
                            <button
                              key={ft}
                              type="button"
                              onClick={() => setType(ft)}
                              className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
                                isActive
                                  ? `${cfg.activeBg} border-transparent scale-[1.02]`
                                  : `${cfg.bg} hover:scale-[1.01]`
                              }`}
                            >
                              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                              <span className="text-xs sm:text-sm font-bold">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="fb-name">{t.feedback.name}</Label>
                      <Input
                        id="fb-name"
                        type="text"
                        placeholder={t.feedback.namePlaceholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={mutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="fb-email">{t.feedback.email}</Label>
                      <Input
                        id="fb-email"
                        type="email"
                        placeholder={t.feedback.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="text-left"
                        dir="ltr"
                        disabled={mutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="fb-message">{t.feedback.message}</Label>
                      <textarea
                        id="fb-message"
                        placeholder={t.feedback.messagePlaceholder}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={5}
                        disabled={mutation.isPending}
                        className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full py-4 text-lg gap-2"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t.feedback.sending}
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          {t.feedback.submit}
                        </>
                      )}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
