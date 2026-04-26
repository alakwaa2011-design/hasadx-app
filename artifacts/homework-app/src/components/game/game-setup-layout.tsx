import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Play, Swords, Trophy, Crown, Medal, Eye, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface GameSetupLayoutProps {
  bgGradient: string;
  iconGradient: string;
  iconShadow?: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  showSparkle?: boolean;
  maxWidth?: "lg" | "xl";
  headerSize?: "sm" | "md";
  children: ReactNode;
}

export function GameSetupLayout({
  bgGradient,
  iconGradient,
  iconShadow = "shadow-purple-500/40",
  icon,
  title,
  subtitle,
  showSparkle = false,
  maxWidth = "lg",
  headerSize = "md",
  children,
}: GameSetupLayoutProps) {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const isSmall = headerSize === "sm";
  const iconBox = isSmall ? "w-16 h-16 rounded-2xl" : "w-20 h-20 rounded-3xl";
  const iconShadowSize = isSmall ? "shadow-xl" : "shadow-2xl";
  const titleClass = isSmall ? "text-2xl mb-0.5" : "text-3xl mb-1";
  const subtitleClass = isSmall ? "text-xs" : "text-sm";
  const headerMargin = isSmall ? "mb-4" : "mb-8";
  const containerPad = isSmall ? "py-6" : "py-8";

  return (
    <Layout>
      <div className={`min-h-screen ${bgGradient} ${containerPad} px-4`} dir={dir}>
        <div className={`${maxWidth === "xl" ? "max-w-xl" : "max-w-lg"} mx-auto`}>
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className={`text-center ${headerMargin}`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className={`inline-flex items-center justify-center ${iconBox} bg-gradient-to-br ${iconGradient} ${iconShadowSize} ${iconShadow} mb-4 relative`}
            >
              {icon}
              {showSparkle && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center shadow-lg"
                >
                  <Sparkles className="w-3 h-3 text-amber-800" />
                </motion.div>
              )}
            </motion.div>
            <h1 className={`${titleClass} font-black text-foreground`}>{title}</h1>
            <p className={`text-muted-foreground ${subtitleClass} max-w-xs mx-auto`}>{subtitle}</p>
          </motion.div>

          {children}

          <button
            onClick={() => setLocation("/")}
            className="w-full mt-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "الرئيسية" : "Home"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

interface HowToPlayCardProps {
  accentColor?: string;
  title?: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function HowToPlayCard({
  accentColor = "text-purple-500",
  title,
  children,
  delay = 0.05,
  className = "",
}: HowToPlayCardProps) {
  const { lang } = useI18n();
  const heading = title ?? (lang === "ar" ? "كيف تلعب؟" : "How to play?");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-card border border-border/60 rounded-2xl p-4 shadow-lg mb-6 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Eye className={`w-4 h-4 ${accentColor}`} />
        <p className="text-sm font-bold text-foreground">{heading}</p>
      </div>
      {children}
    </motion.div>
  );
}

interface GameStartButtonProps {
  onClick: () => void;
  gradient: string;
  shadow?: string;
  label: string;
  delay?: number;
  size?: "md" | "lg";
  className?: string;
}

export function GameStartButton({
  onClick,
  gradient,
  shadow = "shadow-purple-500/30",
  label,
  delay = 0.1,
  size = "lg",
  className = "",
}: GameStartButtonProps) {
  const isLg = size === "lg";
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-full bg-gradient-to-r ${gradient} rounded-2xl ${isLg ? "p-5" : "p-3.5"} shadow-xl ${shadow} hover:shadow-2xl transition-all text-center mb-2 flex items-center justify-center gap-3 group ${className}`}
    >
      <Play className={`${isLg ? "w-6 h-6" : "w-5 h-5"} text-white group-hover:scale-110 transition-transform`} />
      <span className={`font-black text-white ${isLg ? "text-lg" : "text-base"}`}>{label}</span>
    </motion.button>
  );
}

interface ChallengeFriendButtonProps {
  onClick: () => void;
  gradient?: string;
  delay?: number;
  className?: string;
  label?: string;
}

export function ChallengeFriendButton({
  onClick,
  gradient = "from-indigo-500 to-purple-700",
  delay = 0.12,
  className = "mb-4",
  label,
}: ChallengeFriendButtonProps) {
  const { lang } = useI18n();
  const text = label ?? (lang === "ar" ? "تحدِّ صديقاً ⚔️" : "Challenge a Friend ⚔️");
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-full bg-gradient-to-r ${gradient} rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all text-center flex items-center justify-center gap-3 ${className}`}
    >
      <Swords className="w-5 h-5 text-white" />
      <span className="font-black text-white">{text}</span>
    </motion.button>
  );
}

export interface BasicLeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
}

interface LeaderboardCardProps<T extends BasicLeaderboardEntry> {
  entries: T[];
  loading: boolean;
  scoreColor?: string;
  spinnerColor?: string;
  delay?: number;
  headerExtra?: ReactNode;
  renderMeta?: (entry: T) => ReactNode;
}

export function LeaderboardCard<T extends BasicLeaderboardEntry>({
  entries,
  loading,
  scoreColor = "text-purple-600 dark:text-purple-400",
  spinnerColor = "border-purple-500/30 border-t-purple-500",
  delay = 0.2,
  headerExtra,
  renderMeta,
}: LeaderboardCardProps<T>) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-black text-foreground text-base">{lang === "ar" ? "لوحة المتصدرين" : "Leaderboard"}</h2>
        </div>
        {headerExtra}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className={`w-6 h-6 rounded-full border-3 ${spinnerColor} animate-spin`} />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-sm">{lang === "ar" ? "لا توجد نتائج بعد. كن أول متصدر!" : "No scores yet. Be the first!"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 10).map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-2.5 rounded-xl ${
                i === 0
                  ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20"
                  : i < 3
                    ? "bg-muted/50"
                    : "bg-transparent"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                  i === 0
                    ? "bg-amber-500 text-white"
                    : i === 1
                      ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                      : i === 2
                        ? "bg-orange-600 text-white"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {i === 0 ? <Crown className="w-4 h-4" /> : i < 3 ? <Medal className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{entry.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {renderMeta ? renderMeta(entry) : (lang === "ar" ? `المستوى ${entry.level}` : `Level ${entry.level}`)}
                </p>
              </div>
              <span className={`font-black ${scoreColor} text-sm`}>{entry.score}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
