import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, Sparkles, Star } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";
import { formatRewardPoints } from "./format";
import { useI18n } from "@/lib/i18n";
import { rewardText } from "./reward-i18n";

export interface RewardCelebrationStudent {
  id: number;
  name: string;
  avatar?: string | null;
}

export interface RewardCelebrationData {
  students: RewardCelebrationStudent[];
  points: number;
  rewardName?: string;
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string | null;
  mode?: "full" | "live";
}

export function getRewardAvatarFallback(name: string): string {
  return Array.from(name.trim())[0] || "•";
}

export function CelebrationAvatar({
  student,
  mode,
}: {
  student: RewardCelebrationStudent;
  mode: "full" | "live";
}) {
  const isFull = mode === "full";
  return (
    <AvatarDisplay
      avatar={student.avatar}
      fallback={getRewardAvatarFallback(student.name)}
      size={isFull ? "4xl" : "lg"}
      className={isFull
        ? "h-32 w-32 rounded-full border-[6px] border-white bg-gradient-to-br from-emerald-100 to-amber-100 object-cover object-top font-black text-5xl text-emerald-900 shadow-2xl"
        : "h-12 w-12 rounded-full border-2 border-emerald-900 bg-gradient-to-br from-emerald-100 to-amber-100 font-black text-xl text-emerald-900"}
    />
  );
}

export function RewardCelebration({
  celebration,
  onComplete,
}: {
  celebration: RewardCelebrationData | null;
  onComplete: () => void;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const reduceMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const visibleStudents = celebration?.students.slice(0, 4) ?? [];
  const remaining = Math.max(0, (celebration?.students.length ?? 0) - visibleStudents.length);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!celebration) return;
    if (celebration.mode !== "live") {
      overlayRef.current?.focus();
    }
    const duration = celebration.mode === "live" ? 2200 : 2800;
    const timer = window.setTimeout(() => onCompleteRef.current(), reduceMotion ? duration - 1000 : duration);
    return () => window.clearTimeout(timer);
  }, [celebration, reduceMotion]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {celebration && celebration.mode === "live" && (
        <motion.div
          className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-[2rem] border-2 border-amber-400/50 bg-emerald-900 px-4 py-3 text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:w-auto sm:gap-4 sm:px-5"
          initial={reduceMotion ? false : { y: -50, opacity: 0, scale: 0.9 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { y: -20, opacity: 0, scale: 0.9 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
        >
          <div className="flex -space-x-3 space-x-reverse relative">
            {celebration.isGroup ? (
              <AvatarDisplay avatar={celebration.groupAvatar} fallback={celebration.groupName?.charAt(0) || "G"} size="lg" className="h-12 w-12 border-2 border-emerald-900 rounded-xl" />
            ) : (
              visibleStudents.map((s) => (
                <CelebrationAvatar key={s.id} student={s} mode="live" />
              ))
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-black text-amber-400 text-xl leading-none">+{formatRewardPoints(celebration.points)}</span>
            <span className="text-xs font-bold text-emerald-200 mt-0.5 truncate max-w-[150px]">
               {celebration.isGroup ? celebration.groupName : (visibleStudents.length === 1 ? visibleStudents[0].name : r(`${visibleStudents.length} طلاب`, `${visibleStudents.length} students`))}
            </span>
          </div>
          {celebration.rewardName && (
            <div className="bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-800/50 text-sm font-bold ml-2">
              {celebration.rewardName}
            </div>
          )}
        </motion.div>
      )}

      {celebration && celebration.mode !== "live" && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/45 p-4 backdrop-blur-sm"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          onClick={() => onCompleteRef.current()}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCompleteRef.current();
            if (event.key === "Tab") event.preventDefault();
          }}
          role="dialog"
          aria-modal="true"
           aria-label={r("احتفال بمنح النقاط", "Points award celebration")}
          aria-live="polite"
          tabIndex={-1}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-300/60 bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-6 pb-7 pt-8 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.7, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Spinning Halo Background */}
            <motion.div
              className="absolute -top-32 -left-32 w-[150%] h-[150%] opacity-20 pointer-events-none"
              style={{
                background: "conic-gradient(from 0deg, transparent 0deg, rgba(252, 211, 77, 0.4) 30deg, transparent 60deg, rgba(252, 211, 77, 0.4) 90deg, transparent 120deg, rgba(252, 211, 77, 0.4) 150deg, transparent 180deg, rgba(252, 211, 77, 0.4) 210deg, transparent 240deg, rgba(252, 211, 77, 0.4) 270deg, transparent 300deg, rgba(252, 211, 77, 0.4) 330deg, transparent 360deg)"
              }}
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />

            <motion.div
              className="absolute left-5 top-5 text-amber-500 drop-shadow-md"
              animate={reduceMotion ? undefined : { rotate: [0, 18, -10, 0], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: 1 }}
            >
              <Sparkles size={28} />
            </motion.div>
            <motion.div
              className="absolute right-6 top-8 text-amber-400 drop-shadow-md"
              animate={reduceMotion ? undefined : { rotate: [0, -20, 14, 0], y: [0, -8, 0] }}
              transition={{ duration: 1, repeat: 1 }}
            >
              <Star size={24} fill="currentColor" />
            </motion.div>

             <div className="relative z-10 mb-2 text-sm font-black text-emerald-800 tracking-wider">{r("إنجاز جديد في رحلة حصاد", "A new achievement in the Hasaad journey")}</div>
            <div className="relative z-10 mb-5 text-5xl font-black text-primary drop-shadow-sm">+{formatRewardPoints(celebration.points)}</div>

            <div className="relative z-10 mb-5 flex min-h-36 items-end justify-center -space-x-4 space-x-reverse">
              {visibleStudents.map((student, index) => (
                <motion.div
                  key={student.id}
                  className="relative"
                  initial={reduceMotion ? false : { y: 70, opacity: 0, rotate: index % 2 ? 8 : -8, scale: 0.8 }}
                  animate={reduceMotion ? { opacity: 1 } : {
                    y: [70, -18, 4, -8, 0],
                    opacity: 1,
                    scale: 1,
                    rotate: [index % 2 ? 15 : -15, 0, index % 2 ? -5 : 5, 0],
                  }}
                  transition={{ duration: 0.85, delay: index * 0.1, ease: "easeOut" }}
                >
                  <motion.div
                    animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
                    transition={{ duration: 1.2, delay: 0.9 + index * 0.15, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <CelebrationAvatar student={student} mode="full" />
                  </motion.div>
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 flex items-center justify-center gap-2 text-2xl font-black text-foreground drop-shadow-sm">
              <Award className="text-amber-500 drop-shadow-sm" size={28} />
               {celebration.students.length === 1 ? celebration.students[0].name : r(`${celebration.students.length} طلاب متميزين`, `${celebration.students.length} outstanding students`)}
            </div>
            {celebration.rewardName && (
              <p className="relative z-10 mt-1.5 text-base font-bold text-muted-foreground">{celebration.rewardName}</p>
            )}
            {remaining > 0 && (
              <p className="relative z-10 mt-3 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 py-1 px-3 rounded-full inline-block">
                 {r(`ومعهم ${remaining} من رفاق المغامرة`, `Plus ${remaining} adventure companions`)}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}