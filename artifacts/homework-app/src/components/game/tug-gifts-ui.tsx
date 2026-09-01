import { AnimatePresence, motion } from "framer-motion";
import type { MysteryGift, TeamId } from "@/lib/tug-class-engine";

export const TUG_GIFT_INFO: Record<MysteryGift, {
  icon: string;
  ar: string;
  en: string;
  resultAr: string;
  resultEn: string;
  color: string;
  background: string;
}> = {
  "power-pull": {
    icon: "💥", ar: "سحبة قوية", en: "Power Pull",
    resultAr: "السحبة الصحيحة القادمة مضاعفة!", resultEn: "Your next correct pull is doubled!",
    color: "#fbbf24", background: "linear-gradient(145deg,#78350f,#d97706)",
  },
  freeze: {
    icon: "🥶", ar: "تجميد الخصم", en: "Freeze Opponent",
    resultAr: "تم تجميد الخصم!", resultEn: "Opponent frozen!",
    color: "#67e8f9", background: "linear-gradient(145deg,#164e63,#0284c7)",
  },
  "time-boost": {
    icon: "⏱️", ar: "وقت إضافي", en: "Extra Time",
    resultAr: "حصل الفريق على ٥ ثوانٍ!", resultEn: "Team gained 5 seconds!",
    color: "#86efac", background: "linear-gradient(145deg,#14532d,#16a34a)",
  },
  shield: {
    icon: "🛡️", ar: "درع حماية", en: "Shield",
    resultAr: "الدرع جاهز لصد التجميد!", resultEn: "Shield ready to block a freeze!",
    color: "#c4b5fd", background: "linear-gradient(145deg,#4c1d95,#7c3aed)",
  },
};

const CHOICES = Object.keys(TUG_GIFT_INFO) as MysteryGift[];

export function TugMysteryBoxBar({
  boxes, shield, frozen, powerPullReady, ar, disabled, onOpen,
}: {
  boxes: number;
  shield: boolean;
  frozen: boolean;
  powerPullReady: boolean;
  ar: boolean;
  disabled?: boolean;
  onOpen: () => void;
}) {
  if (boxes < 1 && !shield && !frozen && !powerPullReady) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 py-1.5" dir={ar ? "rtl" : "ltr"}>
      {boxes > 0 && (
        <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.04 }}
          onClick={onOpen} disabled={disabled || frozen}
          className="relative inline-flex items-center gap-1.5 rounded-full border border-purple-300/70 bg-purple-500/25 px-3 py-1.5 text-xs font-black text-purple-50 shadow-[0_0_16px_rgba(168,85,247,.25)] disabled:opacity-45">
          <span className="text-base">🎁</span>{ar ? "افتح صندوق المفاجآت" : "Open Mystery Box"}
          {boxes > 1 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-300 px-1 text-[10px] text-purple-950">{boxes}</span>}
        </motion.button>
      )}
      {shield && <span className="rounded-full border border-violet-300/50 bg-violet-400/20 px-2.5 py-1 text-[11px] font-black text-violet-100">🛡️ {ar ? "درع نشط" : "Shield"}</span>}
      {powerPullReady && <span className="rounded-full border border-amber-300/50 bg-amber-400/20 px-2.5 py-1 text-[11px] font-black text-amber-100">💥 {ar ? "سحبة ×٢" : "Pull ×2"}</span>}
      {frozen && <span className="rounded-full border border-cyan-300/50 bg-cyan-400/20 px-2.5 py-1 text-[11px] font-black text-cyan-100">🥶 {ar ? "مجمّد" : "Frozen"}</span>}
    </div>
  );
}

export function TugGiftPicker({
  open, team, ar, revealed, onPick, onClose, embedded = false,
}: {
  open: boolean;
  team: TeamId;
  ar: boolean;
  revealed: number | null;
  onPick: (gift: MysteryGift, index: number) => void;
  onClose: () => void;
  /** Render inside the team's dugout instead of blocking the whole board. */
  embedded?: boolean;
}) {
  const accent = team === "blue" ? "#60a5fa" : "#f87171";
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className={embedded
            ? "absolute inset-1 z-[60] flex items-center justify-center overflow-y-auto rounded-[1.35rem] bg-slate-950/94 p-2 backdrop-blur-md sm:inset-1.5 sm:p-3"
            : "fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xl"}
          dir={ar ? "rtl" : "ltr"}>
          <motion.div initial={{ scale: 0.9, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
            className={`w-full ${embedded ? "max-w-sm rounded-2xl p-3 sm:p-4" : "max-w-md rounded-3xl p-5"} border bg-slate-950 text-white shadow-2xl`}
            style={{ borderColor: `${accent}88` }}>
            <div className={embedded ? "mb-2 text-center sm:mb-3" : "mb-4 text-center"}>
              <div className={embedded ? "text-3xl sm:text-4xl" : "text-5xl"}>🎁</div>
              <h2 className={`${embedded ? "mt-1 text-base sm:text-lg" : "mt-2 text-xl"} font-black`}>
                {revealed === null ? (ar ? "اختروا هديتكم" : "Choose your gift") : (ar ? "تم تفعيل الهدية!" : "Gift activated!")}
              </h2>
              <p className="mt-1 text-xs font-bold text-white/50">{ar ? "هدية واحدة للفريق كله" : "One gift for the whole team"}</p>
            </div>
            <div className={`grid grid-cols-2 ${embedded ? "gap-1.5 sm:gap-2" : "gap-2.5"}`}>
              {CHOICES.map((gift, index) => {
                const info = TUG_GIFT_INFO[gift];
                const chosen = revealed === index;
                return (
                  <motion.button key={gift} whileTap={revealed === null ? { scale: 0.94 } : undefined}
                    onClick={() => revealed === null && onPick(gift, index)} disabled={revealed !== null}
                    className={`relative flex ${embedded ? "min-h-20 gap-1 rounded-xl p-2 sm:min-h-24 sm:gap-1.5 sm:p-2.5" : "min-h-28 gap-1.5 rounded-2xl p-3"} flex-col items-center justify-center border text-center font-black transition-all`}
                    style={{
                      background: chosen ? info.background : "rgba(255,255,255,.06)",
                      borderColor: chosen ? info.color : "rgba(255,255,255,.14)",
                      opacity: revealed !== null && !chosen ? 0.3 : 1,
                    }}>
                    <span className={embedded ? "text-2xl sm:text-3xl" : "text-3xl"}>{info.icon}</span>
                    <span className={embedded ? "text-[11px] leading-tight sm:text-xs" : "text-sm"}>{ar ? info.ar : info.en}</span>
                  </motion.button>
                );
              })}
            </div>
            {revealed !== null && (
              <div className={embedded ? "mt-2 text-center sm:mt-3" : "mt-4 text-center"}>
                <p className="font-black" style={{ color: TUG_GIFT_INFO[CHOICES[revealed]].color }}>
                  {ar ? TUG_GIFT_INFO[CHOICES[revealed]].resultAr : TUG_GIFT_INFO[CHOICES[revealed]].resultEn}
                </p>
                <button onClick={onClose} className={`${embedded ? "mt-2 px-5 py-1.5" : "mt-3 px-6 py-2"} rounded-xl bg-white text-sm font-black text-slate-950`}>
                  {ar ? "متابعة" : "Continue"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}