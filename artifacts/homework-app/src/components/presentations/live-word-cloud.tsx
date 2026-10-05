import { AnimatePresence, motion } from "framer-motion";
import { Cloud } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface CloudWord { text: string; count: number }
const COLORS = [
  "#D9A521", "#60b8a0", "#7ec8e3", "#f4845f", "#b5a1dc",
  "#6bcb77", "#f9c74f", "#f8961e", "#90e0ef", "#c77dff",
];

/** Shared live result surface for the projector and the teacher's slide preview. */
export function LiveWordCloud({ words, isAr }: { words: CloudWord[]; isAr: boolean }) {
  const { t } = useI18n();
  const maxCount = Math.max(...words.map(w => w.count), 1);
  const sorted = [...words].sort((a, b) => b.count - a.count);
  return (
    <div data-testid="live-word-cloud" className="absolute inset-0 bg-black/75 p-4 sm:p-8"
      style={{ containerType: "inline-size" }}>
      {sorted.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-white/50">
          <Cloud className="w-12 h-12 opacity-40" />
          <div className="font-bold">{t.presentation.waitingWords}</div>
        </div>
      ) : (
        <div dir={isAr ? "rtl" : "ltr"}
          className="h-full overflow-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-3 content-center pb-7">
          <AnimatePresence>
            {sorted.map((word, index) => {
              const ratio = word.count / maxCount;
              const color = COLORS[index % COLORS.length];
              return (
                <motion.span key={word.text} data-testid="cloud-word" data-count={word.count}
                  initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className="max-w-full [overflow-wrap:anywhere]"
                  style={{
                    fontSize: `clamp(18px, ${4 + ratio * 9}cqw, ${Math.round(28 + ratio * 72)}px)`,
                    color, fontWeight: ratio > 0.6 ? 900 : ratio > 0.3 ? 700 : 500,
                    transform: `rotate(${((index * 37) % 21) - 10}deg)`,
                    textShadow: `0 2px 12px ${color}44`,
                    fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
                    lineHeight: 1.1, userSelect: "none", display: "inline-block",
                  }}>{word.text}</motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <div className="absolute bottom-3 right-4 text-white/50 text-xs font-bold tabular-nums">
        {new Intl.NumberFormat(isAr ? "ar" : "en").format(words.length)} {t.presentation.words}
      </div>
    </div>
  );
}
