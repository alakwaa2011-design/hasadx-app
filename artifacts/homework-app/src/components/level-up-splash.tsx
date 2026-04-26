import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type LevelUpTheme = "indigo" | "violet" | "orange" | "fuchsia";

interface ThemeConfig {
  gradient: string;
  glow: string;
  ring: string;
  text: string;
  particle: string;
  shadow: string;
}

const THEMES: Record<LevelUpTheme, ThemeConfig> = {
  indigo: {
    gradient: "from-indigo-500 via-indigo-400 to-blue-500",
    glow: "from-indigo-500/40 via-indigo-400/30 to-transparent",
    ring: "ring-indigo-300/60",
    text: "text-indigo-100",
    particle: "bg-indigo-300",
    shadow: "shadow-indigo-500/50",
  },
  violet: {
    gradient: "from-violet-500 via-purple-400 to-fuchsia-500",
    glow: "from-violet-500/40 via-purple-400/30 to-transparent",
    ring: "ring-violet-300/60",
    text: "text-violet-100",
    particle: "bg-violet-300",
    shadow: "shadow-violet-500/50",
  },
  orange: {
    gradient: "from-orange-500 via-amber-400 to-yellow-500",
    glow: "from-orange-500/40 via-amber-400/30 to-transparent",
    ring: "ring-orange-300/60",
    text: "text-orange-100",
    particle: "bg-orange-300",
    shadow: "shadow-orange-500/50",
  },
  fuchsia: {
    gradient: "from-fuchsia-500 via-pink-400 to-rose-500",
    glow: "from-fuchsia-500/40 via-pink-400/30 to-transparent",
    ring: "ring-fuchsia-300/60",
    text: "text-fuchsia-100",
    particle: "bg-fuchsia-300",
    shadow: "shadow-fuchsia-500/50",
  },
};

interface LevelUpSplashProps {
  show: boolean;
  level: number;
  theme: LevelUpTheme;
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => i);

export function LevelUpSplash({ show, level, theme }: LevelUpSplashProps) {
  const { lang } = useI18n();
  const t = THEMES[theme];
  const isAr = lang === "ar";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="level-up-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden"
          aria-live="polite"
          aria-label={isAr ? `مستوى ${level}` : `Level ${level}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: [0.6, 1.15, 1] }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.55, times: [0, 0.6, 1], ease: "easeOut" }}
            className={`absolute inset-0 bg-gradient-radial bg-radial-gradient`}
            style={{
              background: `radial-gradient(circle at center, var(--tw-gradient-stops))`,
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${t.glow}`} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.7, 0], scale: [0, 4, 6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={`absolute w-40 h-40 rounded-full bg-gradient-to-br ${t.gradient} blur-3xl`}
          />

          {PARTICLES.map(i => {
            const angle = (i / PARTICLES.length) * Math.PI * 2;
            const distance = 140 + Math.random() * 80;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const delay = Math.random() * 0.15;
            const size = 6 + Math.random() * 6;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{ x, y, opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.95, delay, ease: "easeOut" }}
                className={`absolute rounded-full ${t.particle} shadow-lg`}
                style={{ width: size, height: size, boxShadow: "0 0 12px currentColor" }}
              />
            );
          })}

          <motion.div
            initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
            animate={{
              scale: [0.4, 1.18, 1],
              rotate: [-8, 4, 0],
              opacity: 1,
            }}
            exit={{ scale: 0.85, opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative flex flex-col items-center gap-3 px-2"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
              className={`absolute -inset-8 rounded-full ring-2 ${t.ring} opacity-60`}
              style={{ borderRadius: "9999px" }}
            />
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.2 }}
              >
                <Sparkles className={`w-7 h-7 ${t.text} drop-shadow-lg`} />
              </motion.div>
              <span className={`text-sm sm:text-base font-black uppercase tracking-[0.3em] ${t.text} drop-shadow-lg`}>
                {isAr ? "مستوى جديد" : "Level Up"}
              </span>
              <motion.div
                animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.2 }}
              >
                <Sparkles className={`w-7 h-7 ${t.text} drop-shadow-lg`} />
              </motion.div>
            </div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 260, damping: 14 }}
              className={`relative px-10 sm:px-14 py-4 sm:py-6 rounded-3xl bg-gradient-to-br ${t.gradient} shadow-2xl ${t.shadow} ring-4 ring-white/20`}
            >
              <div className="flex items-baseline gap-2 sm:gap-3">
                <span className="text-white/80 font-black text-2xl sm:text-3xl">
                  {isAr ? "م" : "L"}
                </span>
                <motion.span
                  key={level}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.35, type: "spring", stiffness: 300 }}
                  className="text-white font-black text-6xl sm:text-7xl tabular-nums drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                >
                  {level}
                </motion.span>
              </div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute -bottom-1 left-4 right-4 h-1 rounded-full bg-white/40 origin-center"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="flex items-center gap-1.5"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.8, delay: i * 0.1, repeat: Infinity }}
                >
                  <Star className={`w-4 h-4 ${t.text} fill-current`} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
