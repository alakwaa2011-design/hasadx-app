import { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Gamepad2, ArrowUpRight } from "lucide-react";

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
    <section className="relative z-20 -mt-8 mb-16 px-4" dir={dir}>
      <div className="max-w-3xl mx-auto bg-card rounded-2xl md:rounded-3xl shadow-xl shadow-primary/5 border border-border p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-2xl hover:border-secondary/20 transition-all duration-500">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-7 h-7 text-secondary" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground mb-1">
              {isAr ? "لديك رمز للعبة أو مسابقة؟" : "Have a game or quiz code?"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {isAr ? "أدخل الرمز وانضم إلى التحدي الآن." : "Enter the code and join the challenge now."}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleJoin} className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder={isAr ? "أدخل الرمز (مثال: 123456)" : "Enter PIN (e.g. 123456)"}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={6}
            className="w-full sm:w-48 h-14 bg-muted/50 border border-border rounded-xl px-4 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={pin.length < 4}
            className="h-14 px-6 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {isAr ? "انضمام" : "Join"}
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </section>
  );
}
