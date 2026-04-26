import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Globe, ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function FlagsJoin() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const params = useParams<{ pin?: string }>();

  const [pin, setPin] = useState(params.pin || "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    const trimmedName = name.trim();
    const trimmedPin = pin.trim();
    if (!trimmedPin || trimmedPin.length !== 6) {
      setError(lang === "ar" ? "أدخل رمز اللعبة (٦ أرقام)" : "Enter game code (6 digits)");
      return;
    }
    if (!trimmedName || trimmedName.length < 2) {
      setError(lang === "ar" ? "أدخل اسمك (حرفين على الأقل)" : "Enter your name (at least 2 chars)");
      return;
    }
    setLocation(`/game/flags/multi?pin=${trimmedPin}&name=${encodeURIComponent(trimmedName)}`);
  };

  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/20 dark:via-blue-950/20 dark:to-indigo-950/20 flex items-center justify-center py-8 px-4" dir={dir}>
        <div className="max-w-md w-full">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-2xl shadow-sky-500/40 mb-4">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-foreground mb-1">{lang === "ar" ? "انضم للعبة" : "Join Game"}</h1>
            <p className="text-muted-foreground text-sm">{lang === "ar" ? "أعلام الدول - لعبة تنافسية" : "Flag Quiz - Competitive Game"}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">{lang === "ar" ? "رمز اللعبة" : "Game Code"}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 px-4 rounded-xl bg-background border-2 border-border focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 focus:outline-none transition-colors text-foreground"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">{lang === "ar" ? "اسمك" : "Your Name"}</label>
                <input
                  type="text"
                  maxLength={20}
                  value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                  className="w-full text-lg font-bold py-3.5 px-4 rounded-xl bg-background border-2 border-border focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 focus:outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                />
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm text-center font-medium">
                  {error}
                </motion.p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleJoin}
                disabled={!pin || !name.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-lg shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-6 h-6" />
                {lang === "ar" ? "انضم للعبة" : "Join Game"}
              </motion.button>
            </div>
          </motion.div>

          <button onClick={() => setLocation("/game/flags")} className="w-full mt-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "العودة" : "Back"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
