import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Gamepad2, ArrowRight, ArrowLeft, Users, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL_MS = 30_000;

interface ActiveGameInfo {
  active: boolean;
  pin?: string;
  title?: string;
  state?: "lobby" | "question" | "leaderboard" | "gift-round" | "finished";
  hackMode?: boolean;
  gameMode?: "solo" | "teams";
  playerCount?: number;
  questionCount?: number;
  currentQuestionIndex?: number;
}

export default function ActiveGameResumeBanner() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const [info, setInfo] = useState<ActiveGameInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/active-game`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setInfo(null);
          return;
        }
        const data: ActiveGameInfo = await res.json();
        if (cancelled) return;
        setInfo(data?.active ? data : null);
      } catch {
        if (!cancelled) setInfo(null);
      }
    };

    fetchInfo();
    const id = setInterval(fetchInfo, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchInfo();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!info?.active || !info.pin) return null;

  const isHack = !!info.hackMode;
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const gameLabel = isHack
    ? isAr
      ? "لعبة هاكر"
      : "Hack game"
    : isAr
      ? "لعبة وميض"
      : "Wameed game";

  const stateLabel = (() => {
    switch (info.state) {
      case "lobby":
        return isAr ? "في انتظار اللاعبين" : "Waiting in lobby";
      case "question":
        if (isHack) {
          // Hack marathon has no shared "current question" — each player is
          // racing through their own personal sequence.
          return isAr ? "السباق جارٍ" : "Marathon in progress";
        }
        return isAr
          ? `السؤال ${(info.currentQuestionIndex ?? 0) + 1} / ${info.questionCount ?? "?"}`
          : `Question ${(info.currentQuestionIndex ?? 0) + 1} / ${info.questionCount ?? "?"}`;
      case "gift-round":
        return isAr ? "جولة الهدايا" : "Gift round";
      case "leaderboard":
        return isAr ? "عرض النتائج" : "Showing results";
      default:
        return isAr ? "نشطة" : "Active";
    }
  })();

  const playerCount = info.playerCount ?? 0;
  const playersLabel = isAr
    ? `${playerCount} لاعب${playerCount === 1 ? "" : ""}`
    : `${playerCount} player${playerCount === 1 ? "" : "s"}`;

  const Icon = isHack ? Zap : Gamepad2;
  const gradientFrom = isHack ? "from-fuchsia-500" : "from-emerald-500";
  const gradientTo = isHack ? "to-violet-600" : "to-teal-600";
  const borderColor = isHack
    ? "border-fuchsia-300/60 dark:border-fuchsia-700/40"
    : "border-emerald-300/60 dark:border-emerald-700/40";
  const bgGradient = isHack
    ? "from-fuchsia-50 to-violet-50 dark:from-fuchsia-950/30 dark:to-violet-950/20"
    : "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20";

  return (
    <AnimatePresence>
      <motion.div
        key={info.pin}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`rounded-2xl border ${borderColor} bg-gradient-to-br ${bgGradient} p-4 sm:p-5 shadow-sm`}
        dir={dir}
        role="region"
        aria-label={
          isAr ? "لديك لعبة نشطة" : "You have an active game"
        }
        data-testid="banner-active-game-resume"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-md`}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-foreground text-sm sm:text-base leading-tight">
              {isAr
                ? "لديك لعبة نشطة — استأنف الآن"
                : "You have an active game — resume now"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {isAr
                ? "استمرّت لعبتك في الخادم. يمكنك العودة إليها من هنا بضغطة واحدة."
                : "Your game is still running on the server. Tap to jump back into the host page."}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="font-bold text-foreground truncate max-w-[60vw] sm:max-w-xs">
                {info.title || gameLabel}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{gameLabel}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {playersLabel}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{stateLabel}</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-mono font-bold text-foreground">
                #{info.pin}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Link
                href={`/teacher/game/${info.pin}`}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r ${gradientFrom} ${gradientTo} hover:opacity-90 text-white text-xs sm:text-sm font-bold shadow-sm transition-opacity`}
                data-testid="link-resume-active-game"
              >
                <Arrow className="w-3.5 h-3.5" />
                {isAr ? "استأنف الآن" : "Resume now"}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
