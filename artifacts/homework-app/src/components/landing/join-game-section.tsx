import { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export function JoinGameSection() {
  const [pin, setPin] = useState("");
  const [, setLocation] = useLocation();
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length >= 4) {
      setLocation(`/game/join/${pin.trim()}`);
    }
  };

  return (
    <section className="py-12 bg-background" dir={dir}>
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
        >
          <div className="text-center md:text-start">
            <h3 className="text-xl font-black text-foreground mb-2">
              {isAr ? "لديك رمز نشاط؟" : "Have an activity code?"}
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
              {isAr ? "أدخل الرمز وانضم إلى النشاط مباشرة." : "Enter the code and join the activity directly."}
            </p>
          </div>

          <form onSubmit={handleJoin} className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder={isAr ? "الرمز (مثال: 12345)" : "Code (e.g. 12345)"}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              maxLength={6}
              className="w-full sm:w-48 h-12 bg-card border border-border rounded-xl px-4 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={pin.length < 4}
              className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {isAr ? "انضم إلى النشاط" : "Join Activity"}
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
