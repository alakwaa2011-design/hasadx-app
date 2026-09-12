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

  const awardStudent = (student: BoardStudent) => {
    if (grantStudent.isPending) return;
    const points = defaultReward?.points || 1;
    const rewardName = defaultReward?.name || "مشاركة سريعة";
    grantStudent.mutate({
      className,
      studentIds: [student.id],
      typeId: defaultReward?.id,
      customReason: defaultReward?.id ? undefined : rewardName,
      customPoints: defaultReward?.id ? undefined : points,
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: () => onCelebrate({ students: [student], points, rewardName, mode: "live" }),
      onError: (error: Error) => toast.error(getArabicRewardError(error, "تعذر منح نقاط الطالب")),
    });
  };

  const awardGroup = (group: BoardGroup) => {
    if (grantGroup.isPending) return;
    const points = defaultReward?.points || 1;
    const rewardName = defaultReward?.name || "عمل جماعي";
    grantGroup.mutate({ className, groupId: group.id, points, idempotencyKey: crypto.randomUUID() }, {
      onSuccess: () => onCelebrate({
        students: [], isGroup: true, groupName: group.name, groupAvatar: group.avatar,
        points, rewardName, mode: "live",
      }),
      onError: (error: Error) => toast.error(getArabicRewardError(error, "تعذر منح نقاط المجموعة")),
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
    <div className="fixed inset-0 z-[100] flex min-h-dvh min-w-0 max-w-[100vw] flex-col overflow-x-hidden bg-[#F8FAFC] text-slate-900 font-sans" dir="rtl" data-testid="live-board">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-300/15 blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-amber-300/15 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex min-w-0 items-center justify-between gap-2 border-b border-white/60 bg-white/70 px-2 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button type="button" data-testid="button-exit-live-board" aria-label="الخروج من لوحة التحفيز المباشرة" onClick={onExit} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-100 bg-white text-slate-600 shadow-sm transition-colors motion-reduce:transition-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 sm:h-12 sm:w-12 sm:rounded-2xl">
            <ArrowRight size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-sm font-black text-emerald-950 sm:text-xl">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
              لوحة التحفيز المباشرة: {className}
            </h1>
            <p className="mt-0.5 hidden text-sm font-bold text-slate-500 sm:block">امنح النقاط وشاهد ترتيب الطلاب والفرق لحظة بلحظة</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button 
            onClick={triggerFairnessCue} 
             type="button"
             aria-label="اختيار طالب عشوائيًا"
             title="اختيار اسم عشوائي من طلاب الصف"
             data-testid="button-fairness-cue"
             disabled={isSpinning || students.length === 0}
             className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-2 text-amber-950 font-black shadow-lg shadow-amber-500/25 transition-all motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/40 focus:outline-none focus:ring-4 focus:ring-amber-400/40 disabled:transform-none disabled:opacity-50 disabled:shadow-none sm:h-auto sm:w-auto sm:rounded-2xl sm:px-6 sm:py-3"
          >
            <Shuffle size={18} />
            <span className="hidden sm:inline">اختيار طالب عشوائيًا</span>
          </button>
          
           <button type="button" data-testid="button-toggle-fullscreen" aria-label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"} onClick={toggleFullscreen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-100 bg-white text-slate-600 shadow-sm transition-colors motion-reduce:transition-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 sm:h-12 sm:w-12 sm:rounded-2xl">
            {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
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
              <p className="relative text-sm font-black text-amber-700">تم اختيار الطالب</p>
              <h2 className="relative mt-2 text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">
                {selectedStudent.name}
              </h2>
              <p className="relative mt-3 text-sm font-bold text-slate-600">
                مبروك! أنت المختار في هذه الجولة
              </p>
              <button
                type="button"
                onClick={() => setFairnessHighlight(null)}
                className="relative mt-6 min-h-11 rounded-2xl bg-emerald-800 px-6 py-2.5 text-sm font-black text-white shadow-lg transition-colors hover:bg-emerald-700"
              >
                متابعة
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
       <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-2 sm:p-6 lg:flex-row lg:gap-6 lg:overflow-hidden">
        
        {/* Right Panel: Goals & Groups */}
        <aside className="flex h-auto w-full shrink-0 flex-col gap-4 overflow-visible pb-0 lg:h-full lg:w-[340px] lg:gap-6 lg:overflow-y-auto">
          {goal && (
            <div className="shrink-0">
              <h2 className="text-xs font-black text-emerald-900/50 mb-3 uppercase tracking-wider flex items-center gap-2 px-1">
                <Target size={14} /> هدف الإنجاز
              </h2>
              <GoalProgressCard goal={goal} className="border-white/80 bg-white/80 backdrop-blur-xl shadow-lg shadow-emerald-900/5" />
            </div>
          )}

          {groupScores.length > 0 && (
            <div className="flex flex-1 flex-col lg:min-h-[300px]">
              <h2 className="text-xs font-black text-emerald-900/50 mb-3 uppercase tracking-wider flex items-center gap-2 px-1">
                <Users size={14} /> الفرق المتنافسة
              </h2>
               <div className="relative flex flex-1 gap-3 overflow-x-auto rounded-[2rem] border-2 border-white/80 bg-white/60 p-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl lg:flex-col lg:overflow-y-auto lg:rounded-[2.5rem] lg:p-4">
                {groupScores.map((group, index) => (
                  <button
                    key={group.id}
                    onClick={() => awardGroup(group)}
                     type="button"
                     data-testid={`button-group-reward-${group.id}`}
                     aria-label={`منح نقاط للمجموعة ${group.name}`}
                     className="group relative min-w-[13rem] flex-1 rounded-[1.5rem] text-right outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/20 lg:min-w-0 lg:flex-none lg:w-full"
                  >
                    <div className="absolute inset-0 rounded-[1.5rem] bg-white opacity-40 transition-opacity group-hover:opacity-100 shadow-sm" />
                    <div className="relative flex items-center gap-3 p-3 rounded-[1.5rem] border-2 border-transparent transition-all group-hover:border-emerald-100/50">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] shrink-0 bg-white border-2 border-white" style={{ borderColor: `${group.color}30` }}>
                        {group.avatar ? (
                          <AvatarDisplay avatar={group.avatar} size="sm" />
                        ) : (
                          <span className="font-black text-lg" style={{ color: group.color }}>{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-slate-800 truncate">{group.name}</div>
                        <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mt-1">
                          <Trophy size={11} style={{ color: group.color }} />
                          <span style={{ color: group.color }}>{formatRewardPoints(group.score)} نقطة</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-slate-300 opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-x-1">
                        <ArrowRight size={18} className="rotate-180" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Left Panel: Students Grid */}
        <main className="relative flex min-h-[420px] flex-1 flex-col overflow-y-auto rounded-[2rem] border-2 border-white/80 bg-white/60 p-3 shadow-xl shadow-emerald-900/5 backdrop-blur-xl sm:rounded-[3rem] sm:p-6 lg:min-h-0">
          <div className="grid auto-rows-max grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            <AnimatePresence>
              {students.map((student) => {
                const isHighlighted = fairnessHighlight === student.id;
                const studentGroups = groups.filter((group) => student.groupIds?.includes(group.id));
                const group = studentGroups[0];
                
                return (
                  <motion.button
                    key={student.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isHighlighted ? 1.05 : 1,
                      zIndex: isHighlighted ? 10 : 1
                    }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.3 }}
                     type="button"
                     data-testid={`button-student-reward-${student.id}`}
                     aria-label={`منح نقاط للطالب ${student.name}`}
                    onClick={() => awardStudent(student)}
                    className={cn(
                       "group relative flex flex-col items-center gap-3 rounded-[1.75rem] border-2 p-3 transition-all motion-reduce:transition-none outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/20 sm:gap-4 sm:rounded-[2.5rem] sm:p-5",
                      isHighlighted 
                        ? "bg-gradient-to-b from-amber-50 to-white border-amber-300 shadow-2xl shadow-amber-300/40" 
                        : "bg-white border-white/80 shadow-md hover:border-emerald-200 hover:shadow-lg hover:bg-emerald-50/50"
                    )}
                  >
                    {isHighlighted && (
                        <motion.div
                         layoutId={reduceMotion ? undefined : "fairness-glow"}
                        className="absolute inset-0 rounded-[2.5rem] shadow-[0_0_40px_rgba(251,191,36,0.4)] pointer-events-none"
                      />
                    )}
                    
                    <div className="relative mt-2">
                      <AvatarDisplay 
                        avatar={student.avatar} 
                        fallback={student.name.charAt(0)}
                        size="xl"
                        className={cn(
                           "h-20 w-20 shadow-lg ring-4 transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-110 sm:h-24 sm:w-24",
                          isHighlighted ? "ring-amber-300" : "ring-white"
                        )}
                        style={group ? { backgroundColor: `${group.color}15` } : undefined}
                      />
                      {group && (
                        <div 
                          className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white shadow-lg z-10"
                          style={{ backgroundColor: group.color }}
                          title={studentGroups.map((item) => item.name).join("، ")}
                        >
                          <span className="text-xs font-black">{formatRewardPoints(studentGroups.length)}</span>
                        </div>
                      )}
                      {isHighlighted && (
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 15 }}
                          className="absolute -top-4 -left-4 text-amber-500 drop-shadow-xl z-20"
                        >
                          <Sparkles size={32} />
                        </motion.div>
                      )}
                    </div>

                    <div className="text-center w-full min-w-0 mt-1 mb-1">
                      <div className="text-sm font-black text-emerald-950 truncate mb-2.5 px-1">{student.name}</div>
                      <div className={cn(
                        "inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-black transition-colors shadow-inner border-2",
                        isHighlighted 
                          ? "bg-amber-100 text-amber-900 border-amber-200" 
                          : "bg-slate-50 text-slate-700 border-slate-100/50 group-hover:bg-emerald-100 group-hover:text-emerald-900 group-hover:border-emerald-200"
                      )}>
                        <Star size={16} className={cn(isHighlighted ? "fill-amber-400 text-amber-400" : "text-slate-400 group-hover:text-emerald-500 group-hover:fill-emerald-500/20")} />
                        {formatRewardPoints(student.points)}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
          
          {students.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 opacity-60">
              <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mb-5 shadow-inner">
                <UserRound size={56} className="text-slate-300" />
              </div>
              <p className="text-xl font-black text-slate-500">لا يوجد أبطال في هذا الصف بعد</p>
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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const activeSuggestions = useMemo(
    () => suggestions.filter((suggestion: RewardSuggestion) => !dismissed.has(suggestion.id)),
    [suggestions, dismissed],
  );
  if (activeSuggestions.length === 0) {
    if (!isError) return null;
    return <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-xs font-bold text-amber-900 shadow-xl sm:inset-x-auto sm:left-6" data-testid="status-suggestions-error">تعذر تحديث الاقتراحات الأكاديمية الآن</div>;
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
      onError: (error: Error) => toast.error(getArabicRewardError(error, "تعذر اعتماد الاقتراح")),
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
                <p className="text-sm font-black text-emerald-950"><span className="text-amber-700">{suggestion.studentName}</span> يستحق التحفيز</p>
                <p className="mt-1.5 truncate text-xs font-bold text-emerald-800">{suggestion.reason}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-600">{suggestion.evidenceDetail}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => approve(suggestion)} disabled={approveSuggestion.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-sm font-black text-emerald-950 disabled:cursor-wait disabled:opacity-60" data-testid={`approve-suggestion-${suggestion.id}`}><Check size={16} />موافق (+{suggestion.points})</button>
              <button type="button" onClick={() => setDismissed((previous) => new Set(previous).add(suggestion.id))} className="rounded-xl bg-slate-100 p-2.5 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="تجاهل الاقتراح" data-testid={`reject-suggestion-${suggestion.id}`}><X size={18} /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
