import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, Sparkles, Star } from "lucide-react";
import { AvatarDisplay } from "@/components/avatar-display";

export interface RewardCelebrationStudent {
  id: number;
  name: string;
  avatar?: string | null;
}

export interface RewardCelebrationData {
  students: RewardCelebrationStudent[];
  points: number;
  rewardName?: string;
}

export function RewardCelebration({
  celebration,
  onComplete,
}: {
  celebration: RewardCelebrationData | null;
  onComplete: () => void;
}) {
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
    overlayRef.current?.focus();
    const timer = window.setTimeout(() => onCompleteRef.current(), reduceMotion ? 1800 : 2800);
    return () => window.clearTimeout(timer);
  }, [celebration, reduceMotion]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {celebration && (
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
          aria-label="احتفال بمنح النقاط"
          aria-live="polite"
          tabIndex={-1}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-300/60 bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-6 pb-7 pt-8 text-center shadow-2xl"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.7, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              className="absolute left-5 top-5 text-amber-500"
              animate={reduceMotion ? undefined : { rotate: [0, 18, -10, 0], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: 1 }}
            >
              <Sparkles size={28} />
            </motion.div>
            <motion.div
              className="absolute right-6 top-8 text-amber-400"
              animate={reduceMotion ? undefined : { rotate: [0, -20, 14, 0], y: [0, -8, 0] }}
              transition={{ duration: 1, repeat: 1 }}
            >
              <Star size={24} fill="currentColor" />
            </motion.div>

            <div className="mb-2 text-sm font-black text-emerald-800">إنجاز جديد في رحلة حصاد</div>
            <div className="mb-5 text-4xl font-black text-primary">+{celebration.points}</div>

            <div className="mb-5 flex min-h-32 items-end justify-center -space-x-4 space-x-reverse">
              {visibleStudents.map((student, index) => (
                <motion.div
                  key={student.id}
                  className="relative"
                  initial={reduceMotion ? false : { y: 70, opacity: 0, rotate: index % 2 ? 8 : -8 }}
                  animate={reduceMotion ? { opacity: 1 } : {
                    y: [70, -18, 4, -8, 0],
                    opacity: 1,
                    rotate: [index % 2 ? 8 : -8, 0, index % 2 ? -3 : 3, 0],
                  }}
                  transition={{ duration: 0.85, delay: index * 0.1, ease: "easeOut" }}
                >
                  <motion.div
                    animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
                    transition={{ duration: 0.65, delay: 0.9 + index * 0.08, repeat: 1 }}
                  >
                    <AvatarDisplay
                      avatar={student.avatar?.startsWith("/avatars/") ? student.avatar : "/avatars/adventurer-boy.webp"}
                      fallback={student.name.charAt(0)}
                      size="4xl"
                      className="h-28 w-28 border-4 border-white bg-amber-50 object-cover object-top shadow-xl"
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-xl font-black text-foreground">
              <Award className="text-amber-500" size={24} />
              {celebration.students.length === 1 ? celebration.students[0].name : `${celebration.students.length} طلاب متميزين`}
            </div>
            {celebration.rewardName && (
              <p className="mt-1 text-sm font-bold text-muted-foreground">{celebration.rewardName}</p>
            )}
            {remaining > 0 && (
              <p className="mt-2 text-xs font-bold text-emerald-700">ومعهم {remaining} من رفاق المغامرة</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}