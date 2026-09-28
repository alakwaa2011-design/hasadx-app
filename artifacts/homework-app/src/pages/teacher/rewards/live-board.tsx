import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Maximize, Minimize, Shuffle, Users, Star, Trophy, Sparkles, UserRound, ArrowRight, Target, Check, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarDisplay } from "@/components/avatar-display";
import { formatRewardPoints } from "./format";
import { GoalProgressCard, type RewardGoal } from "./goal-progress";
import {
  useApproveRewardSuggestion,
  useGetRewardSuggestions,
  useGetRewardTypes,
  useGrantGroupReward,
  useGrantRewards,
  type RewardSuggestion,
} from "./api";
import type { RewardCelebrationData } from "./reward-celebration";
import { toast } from "sonner";
import { getArabicRewardError } from "./error-message";
import { useI18n } from "@/lib/i18n";
import { rewardText } from "./reward-i18n";

export interface BoardStudent {
  id: number;
  name: string;
  avatar?: string | null;
  points: number;
  groupIds?: number[];
  recognizedThisWeek?: boolean;
}

export interface BoardGroup {
  id: number;
  name: string;
  color: string;
  avatar?: string | null;
  score: number;
}

export interface LiveBoardProps {
  className?: string; // Class name label
  goal?: RewardGoal;
  students: BoardStudent[];
  groups: BoardGroup[];
  onStudentClick?: (studentId: number) => void;
  onGroupClick?: (groupId: number) => void;
  onExit?: () => void;
  onFairnessSelect?: (studentId: number) => void;
  onFairnessTick?: (isFinal?: boolean) => void;
  onCelebrate: (data: RewardCelebrationData) => void;
}

export function LiveBoard({
  className = "الصف",
  goal,
  students,
  groups,
  onStudentClick,
  onGroupClick,
  onExit,
  onFairnessSelect,
  onFairnessTick,
  onCelebrate,
}: LiveBoardProps) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const reduceMotion = useReducedMotion();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fairnessHighlight, setFairnessHighlight] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: suggestionsData, isError: suggestionsError } = useGetRewardSuggestions(className, { refetchInterval: 10000 });
  const { data: rewardTypesData } = useGetRewardTypes();
  const grantStudent = useGrantRewards();
  const grantGroup = useGrantGroupReward();
  const approveSuggestion = useApproveRewardSuggestion();
  const defaultReward = useMemo(() => {
    const active = (rewardTypesData || []).filter((type: any) => type.active && type.points > 0).sort((a: any, b: any) => a.order - b.order);
    return active[0];
  }, [rewardTypesData]);
  const onePointReward = useMemo(
    () => (rewardTypesData || [])
      .filter((type: any) => type.active && Number(type.points) === 1)
      .sort((a: any, b: any) => a.order - b.order)[0],
    [rewardTypesData],
  );

  const awardStudent = (student: BoardStudent) => {
    if (grantStudent.isPending) return;
    const points = 1;
    const rewardName = onePointReward?.name || r("مشاركة سريعة", "Quick participation");
    grantStudent.mutate({
      className,
      studentIds: [student.id],
      typeId: onePointReward?.id,
      customReason: onePointReward?.id ? undefined : rewardName,
      customPoints: onePointReward?.id ? undefined : points,
      optimisticPoints: points,
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: () => onCelebrate({ students: [student], points, rewardName, mode: "live" }),
      onError: (error: Error) => toast.error(getArabicRewardError(error, r("تعذر منح نقاط الطالب", "Could not award student points."))),
    });
  };

  const awardGroup = (group: BoardGroup) => {
    if (grantGroup.isPending) return;
    const points = defaultReward?.points || 1;
    const rewardName = defaultReward?.name || r("عمل جماعي", "Teamwork");
    grantGroup.mutate({ className, groupId: group.id, points, idempotencyKey: crypto.randomUUID() }, {
      onSuccess: () => onCelebrate({
        students: [], isGroup: true, groupName: group.name, groupAvatar: group.avatar,
        points, rewardName, mode: "live",
      }),
      onError: (error: Error) => toast.error(getArabicRewardError(error, r("تعذر منح نقاط المجموعة", "Could not award group points."))),
    });
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (spinTimerRef.current) {
        clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = null;
      }
    };
  }, []);

  const toggleFullscreen = async () => {
    // Fullscreen is not available in some embedded browsers and jsdom. The
    // board must remain usable rather than throwing when the API is absent.
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        if (typeof document.documentElement?.requestFullscreen === "function") {
          await document.documentElement.requestFullscreen();
        }
      } else if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen permission can be denied; the inline board is still usable.
    }
  };

  const triggerFairnessCue = () => {
    if (students.length === 0 || isSpinning) return;
    if (spinTimerRef.current) {
      clearInterval(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    setIsSpinning(true);
    setFairnessHighlight(null);
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
    
    // This control is intentionally a simple random classroom picker.
    const chosen = students[Math.floor(Math.random() * students.length)];
    if (!chosen) {
      setIsSpinning(false);
      return;
    }
    
    if (reduceMotion) {
      setFairnessHighlight(chosen.id);
      setIsSpinning(false);
      onFairnessTick?.(true);
      onFairnessSelect?.(chosen.id);
      selectionTimerRef.current = setTimeout(() => setFairnessHighlight(null), 4500);
      return;
    }

    let spins = 0;
    const maxSpins = 24;
    spinTimerRef.current = setInterval(() => {
      const rand = students[Math.floor(Math.random() * students.length)];
      setFairnessHighlight(rand.id);
      spins++;
      onFairnessTick?.(spins >= maxSpins);
      if (spins >= maxSpins) {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
        setFairnessHighlight(chosen.id);
        setIsSpinning(false);
        onFairnessSelect?.(chosen.id);
        selectionTimerRef.current = setTimeout(() => setFairnessHighlight(null), 4500);
      }
    }, 90);
  };

  const groupScores = [...groups].sort((a,b) => b.score - a.score);
  const selectedStudent = !isSpinning
    ? students.find((student) => student.id === fairnessHighlight)
    : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh min-w-0 max-w-[100vw] flex-col overflow-hidden bg-[#F5F4EC] text-[#153C31]" dir={lang === "ar" ? "rtl" : "ltr"} data-testid="live-board">

      {/* Header */}
      <header className="relative z-10 flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[#DDE5D9] bg-[#FCFBF5] px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button type="button" data-testid="button-exit-live-board" aria-label={r("الخروج من لوحة التحفيز المباشرة", "Exit the live rewards board")} onClick={onExit} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4DFD4] bg-[#F3F6EE] text-[#285344] transition-colors motion-reduce:transition-none hover:bg-[#E6EEE2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C39439] sm:h-11 sm:w-11">
            <ArrowRight size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black tracking-tight text-[#153C31] sm:text-xl" data-testid="text-live-board-class">
              <span className="sm:hidden">{r("مباشر", "Live")}</span><span className="hidden sm:inline">{r("اللوحة المباشرة", "Live board")}</span> <span className="mx-0.5 text-[#B48635]">—</span> {className}
            </h1>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#60786C] sm:text-sm">{r("اضغط على الطالب لمنحه نقطة مباشرة", "Tap a student to award a point instantly")}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button 
            onClick={triggerFairnessCue} 
             type="button"
             aria-label={r("اختيار طالب عشوائيًا", "Choose a random student")}
             title={r("اختيار اسم عشوائي من طلاب الصف", "Choose a random name from the class")}
             data-testid="button-fairness-cue"
             disabled={isSpinning || students.length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#EAC36C] px-2 text-[#422F12] font-bold transition-colors motion-reduce:transition-none hover:bg-[#F2D38D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92621E] disabled:opacity-50 sm:h-11 sm:w-auto sm:px-4"
          >
             <Shuffle size={17} />
              <span className="hidden sm:inline">{r("اختيار عشوائي", "Random pick")}</span>
          </button>
          
             <button type="button" data-testid="button-toggle-fullscreen" aria-label={isFullscreen ? r("إنهاء ملء الشاشة", "Exit fullscreen") : r("ملء الشاشة", "Fullscreen")} onClick={toggleFullscreen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4DFD4] bg-[#F3F6EE] text-[#285344] transition-colors motion-reduce:transition-none hover:bg-[#E6EEE2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C39439] sm:h-11 sm:w-11">
             {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-emerald-950/45 p-5 backdrop-blur-sm"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFairnessHighlight(null)}
            role="dialog"
            aria-label={`تم اختيار الطالب ${selectedStudent.name}`}
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.55, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 230, damping: 18 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border-4 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-emerald-50 px-6 py-8 text-center shadow-[0_30px_100px_rgba(15,118,86,0.4)]"
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_68%)]"
                animate={reduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
              <Sparkles className="absolute right-7 top-7 text-amber-500" size={32} />
              <Sparkles className="absolute bottom-16 left-7 text-emerald-500" size={25} />
              <div className="relative mx-auto mb-5 w-fit">
                <div className="absolute -inset-4 rounded-full bg-amber-300/35 blur-xl" />
                <AvatarDisplay
                  avatar={selectedStudent.avatar}
                  fallback={selectedStudent.name.charAt(0)}
                  size="xl"
                  className="relative h-32 w-32 border-4 border-white shadow-2xl ring-4 ring-amber-300 sm:h-40 sm:w-40"
                />
                <div className="absolute -bottom-2 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-amber-400 text-amber-950 shadow-lg">
                  <Trophy size={22} />
                </div>
              </div>
              <p className="relative text-sm font-black text-amber-700">{r("تم اختيار الطالب", "Student selected")}</p>
              <h2 className="relative mt-2 text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">
                {selectedStudent.name}
              </h2>
              <p className="relative mt-3 text-sm font-bold text-slate-600">
                {r("مبروك! أنت المختار في هذه الجولة", "Congratulations! You were chosen for this round.")}
              </p>
              <button
                type="button"
                onClick={() => setFairnessHighlight(null)}
                className="relative mt-6 min-h-11 rounded-2xl bg-emerald-800 px-6 py-2.5 text-sm font-black text-white shadow-lg transition-colors hover:bg-emerald-700"
              >
                {r("متابعة", "Continue")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A full-width classroom canvas: utilities sit above the roster, never beside it. */}
      <div className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-8 pt-4 sm:px-6 lg:px-8">
        {(goal || groupScores.length > 0) && (
          <aside className="mb-5 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch" aria-label={r("هدف الصف والمجموعات", "Class goal and teams")}>
            {goal && (
              <div className="min-w-0 lg:w-[310px] lg:shrink-0">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black text-[#537063]">
                  <Target size={15} /> {r("هدف الإنجاز", "Progress goal")}
                </h2>
                <GoalProgressCard goal={goal} className="h-[calc(100%-1.5rem)] border-[#DCE8DA] bg-[#FCFBF5] shadow-none" />
              </div>
            )}
            {groupScores.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-black text-[#537063]">
                  <Users size={15} /> {r("الفرق المتنافسة", "Competing teams")}
                </h2>
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto rounded-2xl border border-[#DCE8DA] bg-[#EAEFE4] p-2">
                  {groupScores.map((group, index) => (
                    <button
                      key={group.id}
                      onClick={() => awardGroup(group)}
                      type="button"
                      data-testid={`button-group-reward-${group.id}`}
                      aria-label={`منح نقاط للمجموعة ${group.name}`}
                      className="group flex min-h-[72px] min-w-[175px] max-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-[#E1E9DF] bg-[#FCFBF5] p-2.5 text-start shadow-sm transition-colors motion-reduce:transition-none hover:border-[#C8A356] hover:bg-[#FFFAEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C39439]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-[#F5F4EC]" style={{ borderColor: `${group.color}50` }}>
                        {group.avatar ? <AvatarDisplay avatar={group.avatar} size="sm" /> : <span className="text-base font-black" style={{ color: group.color }}>{index + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#173D32]" data-testid={`text-group-name-${group.id}`}>{group.name}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-bold text-[#876223]">
                          <Trophy size={12} />
                          <span data-testid={`text-group-score-${group.id}`}>{formatRewardPoints(group.score)} {r("نقطة", "points")}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        <main className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#173D32] sm:text-base">
              <Users size={18} className="text-[#B48635]" /> {r("طلاب الصف", "Class students")}
            </h2>
            <span className="rounded-full border border-[#DCE8DA] bg-[#EAEFE4] px-3 py-1 text-xs font-bold text-[#37604B]" data-testid="text-live-board-student-count">
              {formatRewardPoints(students.length)} {r("طالب", "students")}
            </span>
          </div>
          <div className="grid auto-rows-max grid-cols-[repeat(auto-fill,minmax(min(100%,155px),1fr))] gap-2.5 sm:gap-3">
            <AnimatePresence>
              {students.map((student) => {
                const isHighlighted = fairnessHighlight === student.id;
                const studentGroups = groups.filter((group) => student.groupIds?.includes(group.id));
                const group = studentGroups[0];
                
                return (
                  <motion.button
                    key={student.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isHighlighted ? 1.035 : 1,
                      zIndex: isHighlighted ? 10 : 1
                    }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
                     type="button"
                     data-testid={`button-student-reward-${student.id}`}
                      aria-label={r(`منح نقاط للطالب ${student.name}`, `Award points to ${student.name}`)}
                    onClick={() => awardStudent(student)}
                    className={cn(
                       "group relative flex min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-3 text-center transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-[#B48635] sm:min-h-[170px] sm:p-3.5",
                      isHighlighted 
                         ? "border-[#D6A549] bg-[#FFF2D4] shadow-[0_8px_22px_rgba(146,98,30,0.16)]"
                         : "border-[#E0E8DB] bg-[#FCFBF6] shadow-[0_2px_8px_rgba(24,65,49,0.05)] hover:border-[#C8A356] hover:bg-[#FFFAEC]"
                    )}
                  >
                    {isHighlighted && (
                        <motion.div
                         layoutId={reduceMotion ? undefined : "fairness-glow"}
                         className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-[#D6A549]"
                      />
                    )}
                    
                     <div className="relative">
                      <AvatarDisplay 
                        avatar={student.avatar} 
                        fallback={student.name.charAt(0)}
                        size="xl"
                        className={cn(
                            "h-16 w-16 ring-[3px] transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-105 sm:h-[72px] sm:w-[72px]",
                           isHighlighted ? "ring-[#D9AA50]" : "ring-[#E9EDE3]"
                        )}
                        style={group ? { backgroundColor: `${group.color}15` } : undefined}
                      />
                      {group && (
                        <div 
                           className="absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#FCFBF6] text-white shadow-sm"
                          style={{ backgroundColor: group.color }}
                          title={studentGroups.map((item) => item.name).join("، ")}
                        >
                           <span className="text-[10px] font-black">{formatRewardPoints(studentGroups.length)}</span>
                        </div>
                      )}
                      {isHighlighted && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 15 }}
                           className="absolute -top-2 -left-3 z-20 text-[#BD8D31]"
                        >
                           <Sparkles size={22} />
                        </motion.div>
                      )}
                    </div>

                     <div className="w-full min-w-0 text-center">
                       <div className="mb-1.5 truncate px-1 text-sm font-black text-[#153C31]" data-testid={`text-student-name-${student.id}`}>{student.name}</div>
                      <div className={cn(
                         "inline-flex min-w-[62px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-black transition-colors",
                        isHighlighted 
                           ? "border-[#D9AA50] bg-[#FFE7A9] text-[#765015]"
                           : "border-[#F1DFAF] bg-[#FFF4D8] text-[#895F1E] group-hover:bg-[#FFE9B5]"
                       )} data-testid={`text-student-score-${student.id}`}>
                         <Star size={14} className="fill-[#DBA842] text-[#DBA842]" />
                        {formatRewardPoints(student.points)}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
          
          {students.length === 0 && (
             <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#C9D9C8] bg-[#FCFBF6] text-center">
               <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#EAEFE4]">
                 <UserRound size={38} className="text-[#60816E]" />
              </div>
               <p className="px-4 text-base font-black text-[#416B55]">{r("لا يوجد أبطال في هذا الصف بعد", "There are no students in this class yet")}</p>
            </div>
          )}
        </main>
      </div>

      <SuggestionsOverlay
        className={className}
        suggestions={suggestionsData?.suggestions || []}
        onCelebrate={onCelebrate}
        approveSuggestion={approveSuggestion}
        reduceMotion={reduceMotion}
        isError={suggestionsError}
      />

      <style dangerouslySetInnerHTML={{__html: `
        .hidden-scrollbar::-webkit-scrollbar {
          width: 0px;
          height: 0px;
          background: transparent;
        }
      `}} />
    </div>
  );
}

function SuggestionsOverlay({ className, suggestions, onCelebrate, approveSuggestion, reduceMotion, isError }: any) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const activeSuggestions = useMemo(
    () => suggestions.filter((suggestion: RewardSuggestion) => !dismissed.has(suggestion.id)),
    [suggestions, dismissed],
  );
  if (activeSuggestions.length === 0) {
    if (!isError) return null;
    return <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-xs font-bold text-amber-900 shadow-xl sm:inset-x-auto sm:left-6" data-testid="status-suggestions-error">{r("تعذر تحديث الاقتراحات الأكاديمية الآن", "Could not update academic suggestions right now")}</div>;
  }
  const approve = (suggestion: RewardSuggestion) => {
    approveSuggestion.mutate({ className, submissionId: suggestion.submissionId }, {
      onSuccess: () => {
        onCelebrate({
          students: [{ id: suggestion.studentId, name: suggestion.studentName, avatar: suggestion.studentAvatar }],
          points: suggestion.points, rewardName: suggestion.rewardTypeName || suggestion.reason, mode: "live",
        });
        setDismissed((previous) => new Set(previous).add(suggestion.id));
      },
      onError: (error: Error) => toast.error(getArabicRewardError(error, r("تعذر اعتماد الاقتراح", "Could not approve the suggestion."))),
    });
  };
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex max-w-80 flex-col gap-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-80">
      <AnimatePresence>
        {activeSuggestions.slice(0, 3).map((suggestion: RewardSuggestion) => (
            <motion.div key={suggestion.id} layout={!reduceMotion} initial={reduceMotion ? false : { opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? { duration: 0 } : undefined} className="pointer-events-auto rounded-3xl border border-emerald-100 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-600"><Lightbulb size={22} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-emerald-950"><span className="text-amber-700">{suggestion.studentName}</span> {r("يستحق التحفيز", "deserves recognition")}</p>
                <p className="mt-1.5 truncate text-xs font-bold text-emerald-800">{suggestion.reason}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-600">{suggestion.evidenceDetail}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => approve(suggestion)} disabled={approveSuggestion.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-sm font-black text-emerald-950 disabled:cursor-wait disabled:opacity-60" data-testid={`approve-suggestion-${suggestion.id}`}><Check size={16} />{r("موافق", "Approve")} (+{suggestion.points})</button>
              <button type="button" onClick={() => setDismissed((previous) => new Set(previous).add(suggestion.id))} className="rounded-xl bg-slate-100 p-2.5 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={r("تجاهل الاقتراح", "Dismiss suggestion")} data-testid={`reject-suggestion-${suggestion.id}`}><X size={18} /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
