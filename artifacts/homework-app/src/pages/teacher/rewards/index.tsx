import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { classNameFromPath } from "./class-route";
import { Layout } from "@/components/layout";
import { AvatarDisplay } from "@/components/avatar-display";
import {
  useGetClassRewards,
  useGetRewardTypes,
  useGrantRewards,
  useGetTeacherClasses,
  useGetRewardGroups,
  useGetRewardSummary,
  useGetRewardGoals,
  useCreateRewardGoal,
  useUpdateRewardGoal,
  useArchiveRewardGoal,
  useGetRewardBoard,
  useAdjustStudentBalances,
  useGetClassRewardBalance,
  useAdjustClassRewardBalance,
  useReverseRewardBatch,
  type ClassroomRewardGoal,
} from "./api";
import { RewardTypesSettings, IconRenderer } from "./settings";
import { RewardLedgerDialog } from "./ledger";
import { RewardRulesDialog } from "./rules";
import { BalanceAdjustmentDialog, StudentControlCenter } from "./student-control-center";
import { RewardGroupsDialog, GroupAwardDialog, GroupDetailDialog } from "./groups";
import { RewardCelebration, type RewardCelebrationData } from "./reward-celebration";
import { GoalDialog, GoalProgressCard, type GoalEditorData } from "./goal-progress";
import { LiveBoard } from "./live-board";
import {
  Settings, History, Volume2, VolumeX,
  Search, CheckSquare, Square, Plus, Loader2, Check, Zap, UserRound, Map, Sparkles, Orbit, SlidersHorizontal, UsersRound, ArrowRight, Target, ChevronDown,
  Minus, School, MoreVertical
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getArabicRewardError } from "./error-message";
import { trackProjectAnalyticsEvent } from "@/lib/analytics";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRewardPoints, getRewardStudentFirstName } from "./format";
import { useI18n } from "@/lib/i18n";
import { rewardText, type RewardLang } from "./reward-i18n";
import "./rewards-pavilion.css";

function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  };
  return [storedValue, setValue];
}

const formatPoints = formatRewardPoints;
const INITIAL_VISIBLE_GOALS = 2;
type TeacherClassOption = { className?: string | null; name?: string | null };

function AdventurePointsBadge({ points, className, animate = false, lang = "ar" }: { points: number, className?: string, animate?: boolean; lang?: RewardLang }) {
  return (
    <div className={cn(
      "relative flex items-center justify-center group/badge",
      animate && "animate-float-slow motion-reduce:animate-none",
      className
    )}>
      <div className="absolute -inset-1 rounded-full bg-amber-400/50 blur-md transition-opacity duration-500 group-hover/badge:opacity-80 motion-reduce:transition-none" />
      <div className="relative flex min-w-[4.5rem] items-center justify-center gap-1.5 rounded-2xl border-2 border-white/90 bg-gradient-to-br from-amber-300 via-orange-400 to-amber-600 px-2.5 py-1 shadow-lg shadow-amber-600/25 transition-transform duration-300 group-hover/badge:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
        <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
          <Orbit size={16} className="text-white/90 motion-safe:animate-[spin_4s_linear_infinite]" />
          <span className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        </span>
        <span className="text-base font-black leading-none text-white drop-shadow-md">{formatPoints(points)}</span>
        <span className="text-xs font-black text-amber-50">{rewardText(lang, "نقطة", "points")}</span>
      </div>
    </div>
  );
}

export default function RewardsPage({ embedded = false }: { embedded?: boolean }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const params = useParams<{ className?: string }>();
  const [, setLocation] = useLocation();
  const [embeddedClass, setEmbeddedClass] = useState<string>();
  const currentClass = params.className
    ? classNameFromPath(typeof window === "undefined" ? "" : window.location.pathname, params.className)
    : embeddedClass;

  const { data: classesList, isLoading: loadingClasses, isError: classesError, refetch: refetchClasses } = useGetTeacherClasses();
  const classOptions = useMemo(
    () => ((classesList ?? []) as TeacherClassOption[])
      .map((item) => item.className || item.name)
      .filter((name): name is string => Boolean(name)),
    [classesList],
  );

  const { data: classData, isLoading: loadingStudents, isError: studentsError, refetch: refetchStudents } = useGetClassRewards(currentClass);
  const { data: groupsData } = useGetRewardGroups(currentClass);
  const { data: rewardTypesData } = useGetRewardTypes();
  const { data: weeklySummary, isLoading: weeklySummaryLoading, isError: weeklySummaryError } = useGetRewardSummary(currentClass, "week");
  const { data: goalsData, isLoading: goalsLoading } = useGetRewardGoals(currentClass);
  const { data: classBalanceData, isLoading: classBalanceLoading } = useGetClassRewardBalance(currentClass);
  const grantMutation = useGrantRewards();
  const reverseBatchMutation = useReverseRewardBatch();
  const createGoalMutation = useCreateRewardGoal();
  const updateGoalMutation = useUpdateRewardGoal();
  const archiveGoalMutation = useArchiveRewardGoal();

  const grantIntentRef = useRef<{ signature: string; key: string } | null>(null);
  const bulkGrantPendingRef = useRef(false);
  const singleGrantPendingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rewardSoundBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}audio/rewards/hasaad-coin-celebration.mp3`)
      .then((response) => {
        if (!response.ok) throw new Error(`Reward sound failed to load (${response.status})`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        if (!cancelled) rewardSoundBufferRef.current = buffer;
      })
      .catch((error) => console.warn("[Rewards] Premium celebration sound unavailable", error));
    return () => {
      cancelled = true;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const resumeAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isMuted, setIsMuted] = useLocalStorage("hasaad_rewards_muted", false);
  const [viewMode, setViewMode] = useLocalStorage<"students" | "groups">("hasaad_rewards_view_mode", "students");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [customGrantOpen, setCustomGrantOpen] = useState(false);
  const [studentControlOpen, setStudentControlOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [singleGrantStudentId, setSingleGrantStudentId] = useState<number | null>(null);
  const [balanceAdjustmentStudentId, setBalanceAdjustmentStudentId] = useState<number | null>(null);
  const [bulkBalanceAdjustmentOpen, setBulkBalanceAdjustmentOpen] = useState(false);
  const [classBalanceOpen, setClassBalanceOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupManagerTargetId, setGroupManagerTargetId] = useState<number | "new">("new");
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupsDetailOpen, setGroupsDetailOpen] = useState(false);
  const [groupGrantOpen, setGroupGrantOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ClassroomRewardGoal | null>(null);
  const [goalsManagerOpen, setGoalsManagerOpen] = useState(false);
  const [liveBoardOpen, setLiveBoardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: boardData, isLoading: boardLoading } = useGetRewardBoard(currentClass, liveBoardOpen);

  useEffect(() => {
    setGoalsManagerOpen(false);
  }, [currentClass]);

  const [celebration, setCelebration] = useState<RewardCelebrationData | null>(null);

  const students = useMemo(() => {
    if (!classData?.students) return [];
    const activeGroup = groupsData?.groups?.find((group) => group.id === activeGroupId);
    const memberIds = activeGroup ? new Set(activeGroup.members.map((member) => member.studentId)) : null;
    return classData.students.filter((s: any) =>
      (!memberIds || memberIds.has(s.id)) && s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeGroupId, classData, groupsData, search]);

  const activeGroup = groupsData?.groups?.find((group) => group.id === activeGroupId) ?? null;
  const weeklyStats = useMemo(() => {
    const summaries = weeklySummary?.studentSummaries ?? [];
    const rosterIds = new Set((classData?.students ?? []).map((student: any) => Number(student.id)));
    const recognizedStudentIds = new Set(
      ((weeklySummary as any)?.metrics?.recognizedStudentIds ?? [])
        .map((studentId: unknown) => Number(studentId))
        .filter((studentId: number) => rosterIds.has(studentId)),
    );
    const topType = [...(weeklySummary?.typeSummaries ?? [])]
      .filter((type: any) => Number(type.count) > 0)
      .sort((a: any, b: any) => Number(b.count) - Number(a.count))[0];
    return {
      totalPoints: Number((weeklySummary as any)?.metrics?.totalGrantedPoints ?? 0),
      recognizedCount: recognizedStudentIds.size,
      awaitingRecognition: Math.max(0, (classData?.students?.length ?? 0) - recognizedStudentIds.size),
      topTypeName: topType?.typeName || r("لا يوجد بعد", "Not yet"),
    };
  }, [classData, lang, weeklySummary]);

  const singleGrantStudent = useMemo(
    () => classData?.students?.find((student: any) => student.id === singleGrantStudentId) ?? null,
    [classData, singleGrantStudentId],
  );
  const balanceAdjustmentStudent = useMemo(
    () => classData?.students?.find((student: any) => student.id === balanceAdjustmentStudentId) ?? null,
    [classData, balanceAdjustmentStudentId],
  );

  useEffect(() => {
    setSingleGrantStudentId(null);
    setActiveGroupId(null);
    setSelectedIds(new Set());
  }, [currentClass]);

  useEffect(() => {
    if (activeGroupId !== null && !groupsData?.groups?.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(null);
    }
  }, [activeGroupId, groupsData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeGroupId]);

  useEffect(() => {
    const eligibleIds = new Set(
      activeGroup
        ? activeGroup.members.map((member) => member.studentId)
        : (classData?.students ?? []).map((student: any) => student.id),
    );
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => eligibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [activeGroup, classData]);

  const activeRewardTypes = useMemo(() => {
    if (!rewardTypesData) return [];
    return rewardTypesData.filter((t: any) => t.active).sort((a: any, b: any) => a.order - b.order);
  }, [rewardTypesData]);

  const toggleStudent = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === students.length && students.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s: any) => s.id)));
    }
  };

  const playSound = () => {
    if (isMuted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const buffer = rewardSoundBufferRef.current;
      if (buffer) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = 0.82;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        return;
      }

      // Polished lightweight fallback while the premium audio finishes loading.
      [0, 0.09, 0.19].forEach((delay, index) => {
        const start = ctx.currentTime + delay;
        const gain = ctx.createGain();
        const fundamental = ctx.createOscillator();
        const shimmer = ctx.createOscillator();
        fundamental.type = "sine";
        shimmer.type = "sine";
        fundamental.frequency.value = [880, 1108, 1320][index];
        shimmer.frequency.value = fundamental.frequency.value * 2.01;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        fundamental.connect(gain);
        shimmer.connect(gain);
        gain.connect(ctx.destination);
        fundamental.start(start);
        shimmer.start(start);
        fundamental.stop(start + 0.43);
        shimmer.stop(start + 0.43);
      });
    } catch (error) {
      console.warn("[Rewards] Could not play celebration sound", error);
    }
  };

  const playFairnessTick = (isFinal = false) => {
    if (isMuted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const start = ctx.currentTime;
      const notes = isFinal
        ? [
            { delay: 0, frequency: 784, duration: 0.2, volume: 0.12 },
            { delay: 0.11, frequency: 988, duration: 0.25, volume: 0.14 },
            { delay: 0.23, frequency: 1319, duration: 0.5, volume: 0.18 },
          ]
        : [{ delay: 0, frequency: 650, duration: 0.105, volume: 0.05 }];

      notes.forEach(({ delay, frequency, duration, volume }) => {
        const noteStart = start + delay;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = isFinal ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        if (!isFinal) {
          oscillator.frequency.exponentialRampToValueAtTime(790, noteStart + duration * 0.7);
        }
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(volume, noteStart + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.01);
      });
    } catch (error) {
      console.warn("[Rewards] Could not play fairness cue", error);
    }
  };

  const getGrantSignature = (classN: string, studentIds: number[], typeId?: string, customReason?: string, customPoints?: number) => {
    const sorted = [...studentIds].sort((a, b) => a - b).join(",");
    return `${classN}|${sorted}|${typeId || ""}|${customReason || ""}|${customPoints || ""}`;
  };

  const handleGrant = (type?: any, customData?: { reason: string, points: number }) => {
    if (selectedIds.size === 0 || !currentClass || bulkGrantPendingRef.current || celebration) return;
    const eligibleIds = new Set(
      activeGroup
        ? activeGroup.members.map((member) => member.studentId)
        : (classData?.students ?? []).map((student: any) => student.id),
    );
    const validSelectedIds = [...selectedIds].filter((id) => eligibleIds.has(id));
    if (!validSelectedIds.length) {
      toast.error(r("لم يعد هناك طلاب صالحون ضمن هذا الاختيار", "There are no eligible students in this selection."));
      setSelectedIds(new Set());
      return;
    }
    bulkGrantPendingRef.current = true;

    resumeAudioContext();

    const signature = getGrantSignature(currentClass, validSelectedIds, type?.id, customData?.reason, customData?.points);
    let key: string = crypto.randomUUID();
    if (grantIntentRef.current?.signature === signature) {
      key = grantIntentRef.current.key;
    } else {
      grantIntentRef.current = { signature, key };
    }

    const payload = {
      className: currentClass,
      studentIds: validSelectedIds,
      typeId: type?.id,
      customReason: customData?.reason,
      customPoints: customData?.points,
      optimisticPoints: type?.points ?? customData?.points ?? 0,
      idempotencyKey: key
    };

    grantMutation.mutate(payload, {
      onSuccess: (result: any) => {
        playSound();
        const awardedStudents = (classData?.students ?? [])
          .filter((student: any) => payload.studentIds.includes(student.id))
          .map((student: any) => ({ id: student.id, name: student.name, avatar: student.avatar }));
        setCelebration({
          students: awardedStudents,
          points: type?.points || customData?.points || 0,
          rewardName: type?.name || customData?.reason,
        });
        grantIntentRef.current = null;
        setSelectedIds(new Set());
        setCustomGrantOpen(false);
        const pts = type?.points || customData?.points;
        const batchId = result?.grants?.[0]?.batch_id ? String(result.grants[0].batch_id) : null;
        const reversalKey = crypto.randomUUID();
        let undoStarted = false;
        toast.success(r(`تم منح ${formatPoints(pts)} نقطة لـ ${formatPoints(payload.studentIds.length)} طالب`, `Granted ${formatPoints(pts)} points to ${formatPoints(payload.studentIds.length)} students`), {
          duration: 8000,
          action: batchId ? {
            label: r("تراجع", "Undo"),
            onClick: async () => {
              if (undoStarted) return;
              undoStarted = true;
              try {
                await reverseBatchMutation.mutateAsync({ batchId, idempotencyKey: reversalKey });
                setCelebration(null);
                toast.success(r("تم التراجع عن منح النقاط", "The points award was undone."));
              } catch (error: any) {
                undoStarted = false;
                toast.error(getArabicRewardError(error, r("تعذر التراجع عن منح النقاط", "Could not undo the points award.")));
              }
            },
          } : undefined,
        });
      },
      onError: (err) => {
        toast.error(getArabicRewardError(err, r("حدث خطأ أثناء منح النقاط", "Could not award the points.")));
      },
      onSettled: () => {
        bulkGrantPendingRef.current = false;
      },
    });
  };

  const handleSaveGoal = async (data: GoalEditorData) => {
    if (!currentClass) return false;
    try {
      if (editingGoal) {
        await updateGoalMutation.mutateAsync({
          className: currentClass,
          goalId: editingGoal.id,
          title: data.title,
          skill: data.skill,
          targetType: data.targetType,
          targetId: data.targetType === "student" ? Number(data.targetId) : null,
          targetPoints: data.targetPoints,
          endDate: data.endDate,
        });
      toast.success(r("تم تحديث الهدف", "Goal updated."));
      } else {
        await createGoalMutation.mutateAsync({
          className: currentClass,
          title: data.title,
          skill: data.skill,
          targetType: data.targetType,
          targetId: data.targetType === "student" ? Number(data.targetId) : undefined,
          targetPoints: data.targetPoints,
          endDate: data.endDate,
        });
      toast.success(r("تم إنشاء الهدف", "Goal created."));
      }
      setEditingGoal(null);
      return true;
    } catch (error: any) {
    toast.error(getArabicRewardError(error, r("تعذر حفظ الهدف", "Could not save the goal.")));
      return false;
    }
  };

  const handleArchiveGoal = async (goal: ClassroomRewardGoal) => {
    if (!currentClass || archiveGoalMutation.isPending) return;
    try {
      await archiveGoalMutation.mutateAsync({ className: currentClass, goalId: goal.id });
      toast.success(r("تمت أرشفة الهدف", "Goal archived."), {
        action: {
          label: r("تراجع", "Undo"),
          onClick: () => updateGoalMutation.mutate(
            { className: currentClass, goalId: goal.id, status: "active" },
            { onSuccess: () => toast.success(r("تمت إعادة الهدف", "Goal restored.")), onError: (error) => toast.error(getArabicRewardError(error, r("تعذرت إعادة الهدف", "Could not restore the goal."))) },
          ),
        },
      });
    } catch (error: any) {
      toast.error(getArabicRewardError(error, r("تعذرت أرشفة الهدف", "Could not archive the goal.")));
    }
  };

  if (!currentClass) {
    return (
      <PageContainer embedded={embedded}>
        <div className="mx-auto flex min-h-[62vh] max-w-4xl items-center justify-center px-3 py-8 sm:px-6">
          {loadingClasses ? (
            <div className="flex flex-col items-center gap-3 text-emerald-800">
              <Loader2 className="animate-spin" size={34} />
              <p className="font-bold">{r("نجهّز صفوفك…", "Preparing your classes…")}</p>
            </div>
          ) : classesError && !classesList ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center font-bold text-rose-800">
              <p>{r("تعذر تحميل الصفوف. لم تُحذف صفوفك؛ حاول التحديث.", "Could not load classes. Your classes have not been deleted.")}</p>
              <button type="button" onClick={() => void refetchClasses()} className="mt-4 rounded-xl bg-emerald-800 px-5 py-2 text-white">
                {r("إعادة المحاولة", "Try again")}
              </button>
            </div>
          ) : classOptions.length > 0 ? (
            <section className="relative w-full overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-amber-50 p-6 text-center shadow-sm sm:p-10">
              <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-200/35 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-amber-200/45 blur-3xl" />
              <button
                type="button"
                onClick={() => setLocation("/teacher/students")}
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/85 px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40 sm:right-6 sm:top-6"
                aria-label={r("العودة إلى صفوفي وطلابي", "Back to my classes and students")}
              >
                <ArrowRight size={16} /> {r("رجوع", "Back")}
              </button>
              <div className="relative">
                <div className="mx-auto mb-5 flex w-fit items-end justify-center -space-x-3 space-x-reverse" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-md sm:h-20 sm:w-20",
                        index === 0 && "bg-amber-100 text-amber-600",
                        index === 1 && "z-10 bg-emerald-100 text-emerald-700",
                        index === 2 && "bg-sky-100 text-sky-600",
                      )}
                    >
                      <UserRound size={index === 1 ? 34 : 28} strokeWidth={2.4} />
                    </span>
                  ))}
                </div>
                <p className="mb-2 text-xs font-black tracking-wide text-emerald-700">{r("لوحة التحفيز", "Rewards board")}</p>
                <h1 className="text-2xl font-black text-emerald-950 sm:text-3xl">{r("أي صف سنحفّز اليوم؟", "Which class will we motivate today?")}</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-emerald-900/60 sm:text-base">
                  {r("اختر صفًا لعرض طلابه ومجموعاته ونقاط مغامرتهم.", "Choose a class to view its students, groups, and adventure points.")}
                </p>
                <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
                  {classOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        if (embedded) setEmbeddedClass(name);
                        else setLocation(`/teacher/rewards/${encodeURIComponent(name)}`);
                      }}
                      className="group flex min-h-16 items-center gap-3 rounded-2xl border-2 border-emerald-100 bg-white px-4 py-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40 motion-reduce:transform-none"
                      aria-label={r(`فتح لوحة تحفيز صف ${name}`, `Open the rewards board for ${name}`)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-amber-300">
                        <UsersRound size={20} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-base font-black text-emerald-950">{name}</span>
                      <span className="text-xl font-black text-amber-500 transition-transform group-hover:-translate-x-1" aria-hidden="true">←</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="w-full rounded-[2rem] border-2 border-dashed border-emerald-200 bg-gradient-to-b from-white to-emerald-50/50 p-7 text-center sm:p-12">
              <div className="mx-auto mb-5 flex h-24 w-36 items-end justify-center gap-1 opacity-35" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <span key={index} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-slate-400 shadow-sm">
                    <UserRound size={28} />
                  </span>
                ))}
              </div>
              <h1 className="text-2xl font-black text-emerald-950">{r("أضف صفك الأول لتبدأ التحفيز", "Add your first class to start motivating students")}</h1>
              <p className="mx-auto mt-3 max-w-md font-bold leading-7 text-emerald-900/55">
                {r("بعد إضافة الصف والطلاب ستظهر هنا بطاقات التحفيز والمجموعات ونقاط المغامرة.", "After you add a class and students, reward cards, groups, and adventure points will appear here.")}
              </p>
              <button
                type="button"
                onClick={() => setLocation("/teacher/students")}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-6 py-3 font-black text-white shadow-lg shadow-emerald-950/15 transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
              >
                <Plus size={19} />
                {r("إضافة صف وطلاب", "Add class and students")}
              </button>
            </section>
          )}
        </div>
      </PageContainer>
    );
  }

  if (studentsError && !classData) {
    return (
      <PageContainer embedded={embedded}>
        <div role="alert" className="mx-auto mt-12 max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center font-bold text-rose-800">
          <p>{r("تعذر تحميل طلاب هذا الصف. حاول التحديث.", "Could not load the students in this class.")}</p>
          <button type="button" onClick={() => void refetchStudents()} className="mt-4 rounded-xl bg-emerald-800 px-5 py-2 text-white">
            {r("إعادة المحاولة", "Try again")}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer embedded={embedded}>
      <RewardCelebration
        celebration={celebration}
        onComplete={() => {
          bulkGrantPendingRef.current = false;
          setCelebration(null);
        }}
      />
      {liveBoardOpen && (
        boardData ? (
          <LiveBoard
            className={boardData.className}
            goal={boardData.goals.find((goal) => goal.targetType === "class" && !goal.completed) ?? boardData.goals[0]}
            students={boardData.students.map((student) => ({
              ...student,
              groupIds: boardData.groups.filter((group) => group.memberIds.includes(student.id)).map((group) => group.id),
            }))}
            groups={boardData.groups}
            onExit={() => setLiveBoardOpen(false)}
            onFairnessTick={playFairnessTick}
            onCelebrate={(data) => {
              playSound();
              setCelebration(data);
            }}
          />
        ) : (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex flex-col items-center gap-3 font-black text-emerald-900">
              <Loader2 className="animate-spin" size={34} />
              {boardLoading ? r("نجهّز لوحة التحفيز المباشرة…", "Preparing the live rewards board…") : r("تعذر تحميل لوحة التحفيز المباشرة", "Could not load the live rewards board")}
              <button type="button" onClick={() => setLiveBoardOpen(false)} className="mt-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm">{r("رجوع", "Back")}</button>
            </div>
          </div>
        )
      )}

      <div className="rewards-pavilion max-w-6xl mx-auto space-y-3 pb-32 transition-all motion-reduce:transition-none sm:space-y-4">
        <div className="rewards-pavilion-lights" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>


        {/* Storybook Header */}
        <header className="rewards-pavilion-header relative mx-auto w-full pt-2">
          <div className="flex flex-col justify-between gap-2.5 rounded-[1.5rem] border-2 border-emerald-50 bg-white/95 p-2 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:rounded-[2rem] sm:p-2.5 sm:pr-4">
            {/* Right (RTL): Back & Class Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (embedded) setEmbeddedClass(undefined);
                  else setLocation("/teacher/rewards");
                }}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-all hover:bg-emerald-100 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 sm:h-11 sm:w-11 sm:rounded-2xl"
                aria-label={r("الرجوع إلى اختيار الصف", "Back to class selection")}
              >
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" />
              </button>

              <div className="flex flex-col min-w-0 justify-center">
                 <div className="group relative flex items-center gap-1.5">
                    <label htmlFor="rewards-class-selector" className="sr-only">{r("اختر صف لوحة التحفيز", "Choose a rewards board class")}</label>
                   <select
                     id="rewards-class-selector"
                     value={currentClass}
                     onChange={(e) => {
                       if (e.target.value) {
                         if (embedded) setEmbeddedClass(e.target.value);
                         else setLocation(`/teacher/rewards/${encodeURIComponent(e.target.value)}`);
                       }
                     }}
                     className="appearance-none bg-transparent text-lg font-black text-emerald-950 focus:outline-none cursor-pointer pr-1 truncate max-w-[10rem] sm:max-w-[16rem]"
                   >
                     {classOptions.map((name) => (
                       <option key={name} value={name} className="font-bold text-emerald-950">
                         {name}
                       </option>
                     ))}
                   </select>
                   <ChevronDown size={16} className="text-emerald-700/60 group-hover:text-emerald-700 transition-colors pointer-events-none" />
                 </div>
              </div>

              <span className="flex items-center justify-center rounded-lg bg-emerald-100/80 px-2 py-0.5 text-[11px] font-black text-emerald-800 shrink-0 shadow-inner">
                {classData?.students?.length ?? 0} {r("طالب", "students")}
              </span>
            </div>

            {/* Left (RTL): Main Actions */}
            <div className="flex w-full justify-center sm:w-auto sm:justify-start">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resumeAudioContext();
                    setLiveBoardOpen(true);
                  }}
                  className="group relative flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2 font-black text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 sm:rounded-2xl sm:px-5 sm:py-2.5"
                  data-testid="button-live-board"
                >
                  <Target size={18} className="text-amber-300 transition-transform group-hover:rotate-12" />
                  <span className="text-sm">{r("اللوحة المباشرة", "Live board")}</span>
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 border border-white/50" />
                  </span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 sm:h-11 sm:w-11 sm:rounded-2xl"
                    aria-label={r("خيارات إضافية", "More options")}
                    aria-expanded={menuOpen}
                    aria-controls="reward-dashboard-more-menu"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div id="reward-dashboard-more-menu" className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-emerald-100 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 sm:w-52 sm:rounded-2xl sm:p-2">
                        <button type="button" onClick={() => { setLedgerOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-50 focus:bg-emerald-50 outline-none">
                          <History size={17} className="text-emerald-600" /> {r("سجل النقاط", "Points ledger")}
                        </button>
                        <button type="button" data-testid="button-open-reward-rules" onClick={() => { setRulesOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-50 focus:bg-emerald-50 outline-none">
                          <Zap size={17} className="text-amber-500" /> {r("قواعد التحفيز", "Reward rules")}
                        </button>
                        <button type="button" onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-50 focus:bg-emerald-50 outline-none">
                          <Settings size={17} className="text-emerald-600" /> {r("الإعدادات", "Settings")}
                        </button>
                        <div className="my-1 border-t border-emerald-50" />
                        <button type="button" onClick={() => { setIsMuted(!isMuted); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-50 focus:bg-emerald-50 outline-none">
                          {isMuted ? <VolumeX size={17} className="text-slate-500" /> : <Volume2 size={17} className="text-emerald-600" />}
                          {isMuted ? r("إلغاء الكتم", "Unmute") : r("كتم الصوت", "Mute sound")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Lightweight Dashboard Strip */}
        <section aria-label={r("ملخص التحفيز الأسبوعي", "Weekly rewards summary")} className="flex flex-nowrap items-stretch gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-3 sm:pb-3">
          {/* Class Points */}
          <button
            type="button"
            onClick={() => setClassBalanceOpen(true)}
            className="group flex min-w-[128px] shrink-0 items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2 shadow-sm transition-all text-right hover:border-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40 sm:min-w-[145px] sm:gap-3 sm:rounded-2xl sm:p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 shadow-inner transition-transform group-hover:scale-105 sm:h-11 sm:w-11 sm:rounded-xl">
              <School size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-900/60 mb-0.5">{r("نقاط الصف", "Class points")}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-950">{classBalanceLoading ? "—" : formatPoints(classBalanceData?.balance ?? 0)}</span>
              </div>
            </div>
          </button>

          {/* Weekly Stats */}
          <div className="flex min-w-[128px] shrink-0 items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2 shadow-sm text-right sm:min-w-[145px] sm:gap-3 sm:rounded-2xl sm:p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shadow-inner sm:h-11 sm:w-11 sm:rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-900/60 mb-0.5">{r("نقاط الأسبوع", "Weekly points")}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-950">{weeklySummaryLoading || weeklySummaryError ? "—" : formatPoints(weeklyStats.totalPoints)}</span>
              </div>
            </div>
          </div>

          {/* Active Goals */}
          {!goalsLoading && (goalsData?.goals?.length ?? 0) === 0 && (
            <button
              type="button"
              onClick={() => { setEditingGoal(null); setGoalDialogOpen(true); }}
              className="group flex min-w-[128px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-2 shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/40 sm:min-w-[145px] sm:gap-3 sm:rounded-2xl sm:p-3"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/60 text-emerald-600 group-hover:scale-105 transition-transform">
                <Plus size={22} />
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-emerald-800">{r("إضافة هدف", "Add goal")}</p>
                <p className="text-[10px] font-bold text-emerald-900/50 mt-0.5">{r("جديد للصف", "New for class")}</p>
              </div>
            </button>
          )}

          {goalsData?.goals?.slice(0, INITIAL_VISIBLE_GOALS).map(goal => {
            const percentage = Math.min(100, Math.max(0, (goal.currentPoints / goal.targetPoints) * 100));
            const isCompleted = percentage >= 100;
            return (
              <button
                type="button"
                key={goal.id}
                onClick={() => { setEditingGoal(goal); setGoalDialogOpen(true); }}
                className={cn("group flex min-w-[145px] max-w-[190px] shrink-0 items-center gap-2 rounded-xl border bg-white p-2 shadow-sm transition-all text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 sm:min-w-[160px] sm:gap-3 sm:rounded-2xl sm:p-3", isCompleted ? "border-amber-200 hover:border-amber-300" : "border-emerald-100 hover:border-sky-200 hover:shadow-md")}
              >
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl group-hover:scale-105 transition-transform shadow-inner", isCompleted ? "bg-amber-100 text-amber-600" : "bg-sky-50 text-sky-600")}>
                  <Target size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-emerald-900/60 mb-1.5 truncate" title={goal.title}>{goal.title}</p>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-1.5 flex-1 rounded-full overflow-hidden", isCompleted ? "bg-amber-200/50" : "bg-slate-100")}>
                      <div className={cn("h-full rounded-full", isCompleted ? "bg-amber-500" : "bg-sky-500")} style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-950 shrink-0">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              </button>
            );
          })}

          {(goalsData?.goals?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setGoalsManagerOpen(true)}
              className="flex min-h-[56px] shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 text-[11px] font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/40 sm:min-h-[70px] sm:rounded-2xl sm:px-4"
            >
              <SlidersHorizontal size={15} />
              {r("إدارة الأهداف", "Manage goals")}
            </button>
          )}
        </section>

        {/* Toolbar */}
        <div className="rewards-pavilion-toolbar pb-2 pt-1">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-emerald-100 rounded-xl p-1 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("students");
                    setActiveGroupId(null);
                  }}
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-black transition-colors", viewMode === "students" ? "bg-emerald-700 text-white shadow" : "text-emerald-800 hover:bg-emerald-50")}
                >
                  {r("الطلاب", "Students")}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("groups")}
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-black transition-colors", viewMode === "groups" ? "bg-emerald-700 text-white shadow" : "text-emerald-800 hover:bg-emerald-50")}
                >
                  {r("المجموعات", "Groups")}
                </button>
              </div>

            </div>

            {viewMode === "students" ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64 group">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-900/40 group-focus-within:text-emerald-600 transition-colors" size={16} />
                  <input
                    type="text"
                    placeholder={r("ابحث عن طالب...", "Search for a student...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-emerald-100 bg-white py-2 pl-3 pr-9 text-sm font-bold text-emerald-950 shadow-sm outline-none transition-all placeholder:text-emerald-900/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10"
                  />
                </div>
                {activeGroup && (
                  <button type="button" onClick={() => setSelectedIds(new Set(activeGroup.members.map((member) => member.studentId)))}
                    className="hidden shrink-0 items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black text-white shadow-sm sm:flex hover:opacity-90"
                    style={{ backgroundColor: activeGroup.color, borderColor: activeGroup.color }}>
                     <UsersRound size={16} /> {r("تحديد المجموعة", "Select group")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-xl border border-emerald-100 bg-white hover:bg-emerald-50 hover:border-emerald-200 text-sm font-black text-emerald-950 transition-all shadow-sm"
                >
                  {selectedIds.size === students.length && students.length > 0 ? (
                     <><CheckSquare size={16} className="text-amber-500" /> <span className="hidden sm:inline">{r("إلغاء", "Clear")}</span></>
                  ) : (
                     <><Square size={16} className="text-emerald-900/40" /> <span className="hidden sm:inline">{activeGroup ? r("المجموعة", "Group") : r("الكل", "All")}</span></>
                  )}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => {
                setGroupManagerTargetId("new");
                setGroupsOpen(true);
              }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-900 shadow-sm hover:border-emerald-400 hover:bg-emerald-50">
                <Plus size={16} className="text-emerald-600" /> {r("مجموعة جديدة", "New group")}
              </button>
            )}
          </div>
        </div>

        {/* Groups / Students Grid */}
        {viewMode === "groups" ? (
          <div className="rewards-pavilion-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {(groupsData?.groups ?? []).map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveGroupId(group.id);
                  setGroupGrantOpen(true);
                }}
                className={cn(
                  "rewards-pavilion-card group relative flex w-full flex-col items-center gap-1.5 overflow-hidden rounded-[1.5rem] border-[3px] p-3 text-center transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none sm:gap-3 sm:rounded-[2rem] sm:p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30",
                  "border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1"
                )}
                style={{ borderColor: `${group.color}40` }}
              >
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl transition-colors duration-500 opacity-30 group-hover:opacity-50 pointer-events-none"
                  style={{ backgroundColor: group.color }}
                />

                <div className="relative mt-2 sm:mt-4">
                  <AvatarDisplay
                    avatar={group.avatar}
                    fallback={group.name.charAt(0)}
                    size="4xl"
                    className={cn(
                      "relative z-10 h-24 w-24 bg-white shadow-md ring-[4px] transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none sm:h-28 sm:w-28",
                    )}
                    style={{ color: group.color, borderColor: `${group.color}40`, outlineColor: group.color }}
                  />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                    <AdventurePointsBadge
                      points={group.score || 0}
                      className="scale-90 transition-transform group-hover:scale-100 motion-reduce:transition-none"
                    />
                  </div>
                </div>
                <div className="mt-4 w-full px-1">
                  <div className="truncate text-sm font-black tracking-wide text-emerald-950 transition-colors group-hover:text-emerald-700 motion-reduce:transition-none">
                    {group.name}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-emerald-900/50">
                    {group.members.length} {r("أعضاء", "members")}
                  </div>
                </div>
              </button>
            ))}
            {(groupsData?.groups ?? []).length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-emerald-900/40 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50" />
                  <UsersRound size={64} className="relative drop-shadow-sm" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-lg">{r("لم يتم العثور على مجموعات.", "No groups found.")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setGroupManagerTargetId("new");
                    setGroupsOpen(true);
                  }}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors"
                >
                  {r("إنشاء مجموعة جديدة", "Create a new group")}
                </button>
              </div>
            )}
          </div>
        ) : loadingStudents ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-800 space-y-4">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">{r("جاري تحميل الطلاب...", "Loading students...")}</p>
          </div>
        ) : (
          <div className="rewards-pavilion-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6 xl:grid-cols-7">
            {students.map((student: any) => {
              const isSelected = selectedIds.has(student.id);
              const daysSinceReward = student.lastRewardAt ? Math.floor((Date.now() - new Date(student.lastRewardAt).getTime()) / 86400000) : null;
              const goalPercent = student.goal ? Math.min(100, Math.round((Number(student.goal.progress || 0) / Number(student.goal.targetPoints || 1)) * 100)) : 0;
              return (
                <div
                  key={student.id}
                  className={cn(
                    "rewards-pavilion-card group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-[1.5rem] border-[3px] p-3 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none sm:gap-3 sm:rounded-[2rem] sm:p-4",
                    isSelected ? "border-amber-400 bg-amber-50/80 shadow-lg shadow-amber-500/15 -translate-y-1" : "border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1"
                  )}
                >
                  <div className={cn("absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl transition-colors duration-500", isSelected ? "bg-amber-300/40" : "bg-emerald-200/40 group-hover:bg-amber-200/40")} />

                    <button
                      type="button"
                      aria-label={isSelected ? `إلغاء تحديد ${student.name}` : `تحديد ${student.name} للمنح الجماعي`}
                      aria-pressed={isSelected}
                      title={isSelected ? r("إلغاء التحديد", "Clear selection") : r("تحديد الطالب", "Select student")}
                      className={cn(
                        "absolute right-2.5 top-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 p-0 text-[10px] font-black shadow-md transition-all sm:right-3 sm:top-3",
                        isSelected
                          ? "border-amber-500 bg-amber-400 text-amber-950"
                          : "border-emerald-200 bg-white text-emerald-800 hover:border-amber-400 hover:bg-amber-50",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudent(student.id);
                      }}
                    >
                      <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all",
                        isSelected ? "border-amber-950/25 bg-white/50" : "border-emerald-300 bg-emerald-50"
                      )}>
                        {isSelected && <Check size={14} strokeWidth={4} />}
                      </div>
                    </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveStudentId(student.id);
                      setStudentControlOpen(true);
                    }}
                    className="absolute left-2.5 top-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-200 bg-white p-0 text-[10px] font-black text-emerald-800 shadow-md transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-lg sm:left-3 sm:top-3"
                    title={r("فتح ملف الطالب", "Open student profile")}
                    aria-label={r(`فتح ملف الطالب ${student.name}`, `Open student profile for ${student.name}`)}
                  >
                    <UserRound size={13} strokeWidth={2.7} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSingleGrantStudentId(student.id)}
                    className="relative mt-8 flex w-full flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 group/avatar sm:mt-10"
                    aria-label={r(`فتح خيارات تحفيز ${student.name}`, `Open reward options for ${student.name}`)}
                  >
                    <div className="relative">
                      <AvatarDisplay
                        avatar={student.avatar}
                        fallback={getRewardStudentFirstName(student.name)}
                        size="4xl"
                        className={cn(
                          "relative z-10 h-24 w-24 bg-emerald-50 px-2 text-base font-black leading-tight text-center shadow-md ring-[4px] ring-white transition-transform duration-500 group-hover/avatar:scale-105 motion-reduce:transition-none motion-reduce:transform-none sm:h-28 sm:w-28 sm:text-lg",
                          isSelected && "ring-amber-200 shadow-amber-400/30"
                        )}
                      />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                        <AdventurePointsBadge
                          points={student.points || 0}
                          className={cn(
                            "scale-90 transition-transform group-hover/avatar:scale-100 motion-reduce:transition-none",
                            isSelected && "scale-100"
                          )}
                        />
                      </div>
                    </div>
                    <div className="mt-5 w-full px-1 text-center">
                      <div className="truncate text-sm font-black tracking-wide text-emerald-950 transition-colors group-hover/avatar:text-emerald-700 motion-reduce:transition-none">
                      {student.name}
                      </div>
                      <div className="mt-1.5 flex min-h-5 flex-wrap items-center justify-center gap-1">
                        {(groupsData?.groups ?? [])
                          .filter((group) => group.members.some((member) => member.studentId === student.id))
                          .slice(0, 2)
                          .map((group) => (
                            <span key={group.id} className="max-w-full truncate rounded-md border px-1.5 py-0.5 text-xs font-black"
                              style={{ borderColor: `${group.color}55`, backgroundColor: `${group.color}12`, color: group.color }}>
                              {group.name}
                            </span>
                          ))}
                      </div>
                      {student.goal && (
                        <div className="mt-2 w-full rounded-xl border border-emerald-100 bg-white/80 p-2 text-right">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-black text-emerald-900">
                            <span className="truncate">{student.goal.skill || student.goal.title}</span>
                            <span>{goalPercent}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${goalPercent}%` }} />
                          </div>
                          <div className="mt-1 text-[9px] font-bold text-emerald-900/55">{r(`متبقّي ${student.goal.remaining} نقطة`, `${student.goal.remaining} points remaining`)}</div>
                        </div>
                      )}
                      {(daysSinceReward === null || daysSinceReward >= 7) && (
                        <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">
                          {daysSinceReward === null ? r("لم يُحفّز بعد", "Not recognized yet") : r(`منذ آخر تحفيز ${daysSinceReward} أيام`, `${daysSinceReward} days since last recognition`)}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "students" && students.length === 0 && !loadingStudents && (
          <div className="flex flex-col items-center justify-center py-24 text-emerald-900/40 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50" />
              <Map size={64} className="relative drop-shadow-sm" strokeWidth={1.5} />
            </div>
            <p className="font-bold text-lg">{r("لم يتم العثور على طلاب في هذا الصف.", "No students found in this class.")}</p>
          </div>
        )}

      </div>

      {/* Action Bar (Sticky Bottom) - Magical Inventory Style */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-white/95 backdrop-blur-xl border-2 border-emerald-100 shadow-[0_20px_60px_rgba(4,47,28,0.15)] z-40 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none w-[95%] sm:w-auto max-w-4xl",
        selectedIds.size > 0 ? "translate-y-0 opacity-100 scale-100" : "translate-y-16 opacity-0 scale-95 pointer-events-none"
      )}>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
           <div className="flex items-center gap-3 pl-4 sm:border-l-2 border-emerald-100 shrink-0 w-full sm:w-auto justify-center sm:justify-start pb-2 sm:pb-0 border-b-2 sm:border-b-0 border-dashed">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-black text-xl shadow-inner border border-emerald-400">
                {selectedIds.size}
              </div>
              <div className="text-right">
               <div className="font-black text-sm text-emerald-950">{r("طلاب محددون", "Selected students")}</div>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors">{r("إلغاء التحديد", "Clear selection")}</button>
              </div>
           </div>

           <div className="flex-1 flex items-center justify-start gap-2 overflow-x-auto px-1 py-1.5 w-full [scrollbar-width:thin] sm:[scrollbar-width:none]">
             {activeRewardTypes.map((type: any) => (
               <button
                 key={type.id}
                 onClick={() => handleGrant(type)}
                 disabled={grantMutation.isPending || Boolean(celebration)}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-b from-white to-emerald-50 border-2 hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:transform-none shrink-0 disabled:opacity-50"
                 style={{ borderColor: type.color ? `${type.color}40` : '#d1fae5' }}
               >
                  <div className="p-1 rounded-lg bg-white shadow-sm border border-emerald-50 group-hover:scale-110 transition-transform motion-reduce:transition-none motion-reduce:transform-none">
                   <IconRenderer name={type.icon} className="w-4 h-4" style={{ color: type.color }} />
                 </div>
                 <span className="font-black text-sm text-emerald-950">{type.name}</span>
                 <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200/50 flex items-center gap-0.5">
                    <Orbit size={11} />
                    +{formatPoints(type.points)}
                 </span>
               </button>
             ))}

             <button
               onClick={() => setCustomGrantOpen(true)}
               disabled={Boolean(celebration)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-200 bg-white hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition-all motion-reduce:transition-none motion-reduce:transform-none shrink-0 text-emerald-900/60 font-bold active:scale-95"
             >
               <Plus size={18} strokeWidth={2.5} />
                <span className="text-sm">{r("نقاط مخصصة", "Custom points")}</span>
             </button>
              {selectedIds.size > 1 && (
                <button
                  onClick={() => setBulkBalanceAdjustmentOpen(true)}
                  disabled={Boolean(celebration)}
                  className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 shrink-0"
                >
                  <SlidersHorizontal size={17} />
                  {r("تعديل الأرصدة", "Adjust balances")}
                </button>
              )}
           </div>
        </div>
      </div>

      <Dialog open={goalsManagerOpen} onOpenChange={setGoalsManagerOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-3xl" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-950">
              <Target size={20} className="text-emerald-700" />
              {r("إدارة أهداف التقدم", "Manage progress goals")}
            </DialogTitle>
            <DialogDescription>
              {r("أنشئ هدفًا جديدًا أو عدّل الأهداف الحالية وأرشف ما لم تعد تحتاجه.", "Create a new goal, edit current goals, or archive goals you no longer need.")}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => {
              setGoalsManagerOpen(false);
              setEditingGoal(null);
              setGoalDialogOpen(true);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/40"
          >
            <Plus size={17} />
            {r("هدف جديد", "New goal")}
          </button>
          <div className="grid gap-3 md:grid-cols-2">
            {(goalsData?.goals ?? []).map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                onEdit={() => {
                  setGoalsManagerOpen(false);
                  setEditingGoal(goal);
                  setGoalDialogOpen(true);
                }}
                onArchive={() => handleArchiveGoal(goal)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <RewardTypesSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RewardRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} rewardTypes={rewardTypesData || []} />
      <RewardLedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} className={currentClass} />
      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={(next) => {
          setGoalDialogOpen(next);
          if (!next) setEditingGoal(null);
        }}
        initialData={editingGoal ? {
          title: editingGoal.title,
          skill: editingGoal.skill || editingGoal.title,
          targetType: editingGoal.targetType,
          targetId: editingGoal.targetId,
          targetPoints: editingGoal.targetPoints,
          endDate: editingGoal.endDate,
        } : null}
        students={classData?.students ?? []}
        saving={createGoalMutation.isPending || updateGoalMutation.isPending}
        onSave={handleSaveGoal}
      />
      <StudentControlCenter
        open={studentControlOpen}
        onOpenChange={(v) => { setStudentControlOpen(v); if (!v) setActiveStudentId(null); }}
        studentId={activeStudentId}
        className={currentClass}
        rewardTypes={activeRewardTypes}
      />
      <CustomGrantDialog
        open={customGrantOpen}
        onOpenChange={setCustomGrantOpen}
        onGrant={(data) => handleGrant(undefined, data)}
        loading={grantMutation.isPending}
      />
      <SingleStudentGrantDialog
        open={singleGrantStudentId !== null && Boolean(singleGrantStudent)}
        onOpenChange={(v) => { if (!v) setSingleGrantStudentId(null); }}
        student={singleGrantStudent}
        rewardTypes={activeRewardTypes}
        onAdjustBalance={() => {
          if (!singleGrantStudent) return;
          setBalanceAdjustmentStudentId(singleGrantStudent.id);
          setSingleGrantStudentId(null);
        }}
        onGrant={(type, customData) => {
          if (!singleGrantStudent || !currentClass || singleGrantPendingRef.current) return;
          singleGrantPendingRef.current = true;
          resumeAudioContext();

          const signature = getGrantSignature(currentClass, [singleGrantStudent.id], type?.id, customData?.reason, customData?.points);
          let key: string = crypto.randomUUID();
          if (grantIntentRef.current?.signature === signature) {
            key = grantIntentRef.current.key;
          } else {
            grantIntentRef.current = { signature, key };
          }

          grantMutation.mutate({
            className: currentClass,
            studentIds: [singleGrantStudent.id],
            typeId: type?.id,
            customReason: customData?.reason,
            customPoints: customData?.points,
            optimisticPoints: type?.points ?? customData?.points ?? 0,
            idempotencyKey: key
          }, {
            onSuccess: () => {
              playSound();
              setCelebration({
                students: [{ id: singleGrantStudent.id, name: singleGrantStudent.name, avatar: singleGrantStudent.avatar }],
                points: type?.points || customData?.points || 0,
                rewardName: type?.name || customData?.reason,
              });
              grantIntentRef.current = null;
              setSingleGrantStudentId(null);
            },
            onError: (err) => {
              singleGrantPendingRef.current = false;
              toast.error(getArabicRewardError(err, rewardText(lang, "حدث خطأ أثناء منح النقاط", "Could not award the points.")));
            },
            onSettled: () => {
              singleGrantPendingRef.current = false;
            },
          });
        }}
        loading={grantMutation.isPending}
        pendingTypeId={grantMutation.variables?.typeId}
      />
      {balanceAdjustmentStudent && (
        <BalanceAdjustmentDialog
          open={balanceAdjustmentStudentId !== null}
          onOpenChange={(next) => { if (!next) setBalanceAdjustmentStudentId(null); }}
          studentId={balanceAdjustmentStudent.id}
          studentName={balanceAdjustmentStudent.name}
          currentBalance={balanceAdjustmentStudent.points || 0}
        />
      )}
      <RewardGroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        className={currentClass}
        students={classData?.students ?? []}
        initialGroupId={groupManagerTargetId}
      />
      <GroupAwardDialog
        open={groupGrantOpen}
        onOpenChange={setGroupGrantOpen}
        group={groupsData?.groups?.find(g => g.id === activeGroupId) ?? null}
        className={currentClass}
        onDetailsClick={() => setGroupsDetailOpen(true)}
        onManageClick={() => {
          if (activeGroupId === null) return;
          setGroupManagerTargetId(activeGroupId);
          setGroupsOpen(true);
        }}
        onAward={() => {
          playSound();
        }}
      />

      <GroupDetailDialog
        open={groupsDetailOpen}
        onOpenChange={setGroupsDetailOpen}
        group={groupsData?.groups?.find(g => g.id === activeGroupId) ?? null}
        className={currentClass}
        onBack={() => {
          setGroupsDetailOpen(false);
          setGroupGrantOpen(true);
        }}
        onAward={() => {
          playSound();
        }}
      />

      <BulkBalanceAdjustmentDialog
        open={bulkBalanceAdjustmentOpen}
        onOpenChange={setBulkBalanceAdjustmentOpen}
        className={currentClass}
        students={(classData?.students ?? []).filter((student: any) => selectedIds.has(student.id))}
        onComplete={() => setSelectedIds(new Set())}
      />
      <ClassBalanceDialog
        open={classBalanceOpen}
        onOpenChange={setClassBalanceOpen}
        className={currentClass}
        balance={classBalanceData?.balance ?? 0}
        history={classBalanceData?.history ?? []}
      />
    </PageContainer>
  );
}

function PageContainer({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  return embedded ? <>{children}</> : <Layout>{children}</Layout>;
}

function SingleStudentGrantDialog({
  open, onOpenChange, student, rewardTypes, onGrant, onAdjustBalance, loading, pendingTypeId
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  rewardTypes: any[];
  onGrant: (type?: any, customData?: { reason: string, points: number }) => void;
  onAdjustBalance: () => void;
  loading: boolean;
  pendingTypeId?: number;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [customOpen, setCustomOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);

  useEffect(() => {
    if (open) {
      setCustomOpen(false);
      setReason("");
      setPoints(1);
    }
  }, [open]);

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white border-2 border-emerald-100 rounded-[2rem] shadow-2xl motion-reduce:animate-none">
        <DialogHeader className="p-8 pb-6 border-b-2 border-emerald-800 bg-emerald-950 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.3),transparent_70%)]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

          <div className="relative mb-4">
            <AvatarDisplay
              avatar={student.avatar}
              fallback={getRewardStudentFirstName(student.name)}
              size="4xl"
              className="relative z-10 h-28 w-28 bg-amber-50 px-2 text-lg font-black leading-tight text-center ring-4 ring-amber-400 shadow-2xl sm:text-xl"
            />
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
              <AdventurePointsBadge points={student.points || 0} animate lang={lang} />
            </div>
          </div>
          <DialogTitle className="text-2xl font-black text-white relative z-10 tracking-wide">{student.name}</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <ArrowRight size={16} /> {r("رجوع", "Back")}
          </button>
        </DialogHeader>

          <div className="max-h-[65dvh] overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
          {!customOpen ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black tracking-wide text-emerald-900/60">{r("اختر نوع التحفيز للطالب", "Choose a reward for this student")}</h3>
                <button
                  type="button"
                  onClick={onAdjustBalance}
                  disabled={loading || (student.points || 0) < 1}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={r(`خصم نقاط من رصيد ${student.name}`, `Deduct points from ${student.name}'s balance`)}
                >
                  <SlidersHorizontal size={13} />
                  {r("خصم", "Deduct")}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {rewardTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => onGrant(type)}
                    disabled={loading}
                    aria-busy={loading && pendingTypeId === type.id}
                    className="relative group flex flex-col items-center justify-center gap-3 p-4 rounded-[1.5rem] border-2 bg-white overflow-hidden hover:-translate-y-1 hover:shadow-lg active:scale-[0.97] transition-all duration-150 motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-amber-400/20"
                    style={{ borderColor: type.color ? `${type.color}40` : 'rgba(16, 185, 129, 0.2)' }}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-full" style={{ color: type.color || '#10b981' }} />

                    <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-emerald-50 group-hover:scale-110 transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none" style={{ backgroundColor: type.color ? `${type.color}15` : '#ecfdf5', color: type.color || '#10b981' }}>
                      {loading && pendingTypeId === type.id
                        ? <Loader2 size={22} className="animate-spin motion-reduce:animate-none" />
                        : <IconRenderer name={type.icon} />}
                    </div>

                    <div className="text-center z-10 w-full">
                      <div className="font-black text-xs text-emerald-950 mb-1.5 truncate px-1">{type.name}</div>
                      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-black border border-amber-200/50">
                        <Orbit size={11} />
                        +{formatPoints(type.points)}
                      </div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => setCustomOpen(true)}
                  disabled={loading}
                  className="relative group flex flex-col items-center justify-center gap-3 p-4 rounded-[1.5rem] border-2 border-dashed border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-amber-400 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 text-emerald-900/60 hover:text-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-400/20"
                >
                  <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm border border-emerald-100 group-hover:border-amber-200 group-hover:scale-110 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none">
                    <Plus size={24} strokeWidth={2.5} />
                  </div>
                  <div className="font-black text-xs">{r("نقاط مخصصة", "Custom points")}</div>
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!reason.trim()) { toast.error(r("يرجى إدخال السبب", "Please enter a reason.")); return; }
                if (points < 1) { toast.error(r("يجب أن تكون النقاط 1 على الأقل", "Points must be at least 1.")); return; }
                onGrant(undefined, { reason, points });
              }}
              className="space-y-6 max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-emerald-950 flex items-center gap-2 text-lg">
                  <Sparkles size={20} className="text-amber-500" /> {r("نقاط مخصصة", "Custom points")}
                </h3>
                <button type="button" onClick={() => setCustomOpen(false)} className="text-xs font-bold text-emerald-900/50 hover:text-emerald-950 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm transition-colors">
                  {r("العودة للخيارات", "Back to options")}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("سبب المكافأة", "Reward reason")}</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={r("مثال: إجابة متميزة، مساعدة زميل...", "Example: excellent answer, helping a classmate...")}
                    className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 shadow-sm transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("عدد النقاط", "Points")}</label>
                  <div className="relative">
                    <Zap size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 fill-amber-500/20" />
                    <input
                      type="number"
                      min="1"
                      value={points}
                      onChange={e => setPoints(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border-2 border-emerald-100 rounded-2xl pr-12 pl-4 py-3 text-lg focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 text-center font-black shadow-sm transition-all text-amber-600"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-lg hover:from-amber-500 hover:to-orange-600 transition-all motion-reduce:transition-none motion-reduce:transform-none flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} className="fill-white/30" />}
                   {r("منح النقاط", "Award points")}
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomGrantDialog({ open, onOpenChange, onGrant, loading }: { open: boolean, onOpenChange: (v: boolean) => void, onGrant: (data: any) => void, loading: boolean }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error(r("يرجى إدخال السبب", "Please enter a reason.")); return; }
    if (points < 1) { toast.error(r("يجب أن تكون النقاط 1 على الأقل", "Points must be at least 1.")); return; }
    onGrant({ reason, points });
  };

  useEffect(() => {
    if (open) {
      setReason("");
      setPoints(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92dvh] p-0 overflow-hidden bg-white border-2 border-emerald-100 rounded-[2rem] shadow-2xl motion-reduce:animate-none">
        <DialogHeader className="p-6 border-b-2 border-emerald-50 bg-emerald-50/50">
          <DialogTitle className="text-xl font-black text-emerald-950 flex items-center gap-2">
            <Sparkles size={24} className="text-amber-500" />
            {r("منح نقاط مخصصة", "Award custom points")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("السبب", "Reason")}</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={r("مثال: مساعدة زميل، مهمة إضافية...", "Example: helping a classmate, an extra task...")}
              className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 shadow-sm transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("عدد النقاط", "Points")}</label>
            <div className="relative">
              <Zap size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 fill-amber-500/20" />
              <input
                type="number"
                min="1"
                value={points}
                onChange={e => setPoints(parseInt(e.target.value) || 1)}
                className="w-full bg-white border-2 border-emerald-100 rounded-2xl pr-12 pl-4 py-3 text-lg focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 text-center font-black shadow-sm transition-all text-amber-600"
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => onOpenChange(false)} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-emerald-900/60 font-bold hover:bg-emerald-50 hover:text-emerald-950 transition-colors">
              <ArrowRight size={17} /> {r("رجوع", "Back")}
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black hover:from-amber-500 hover:to-orange-600 transition-all motion-reduce:transition-none motion-reduce:transform-none flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-white/30" />}
              {r("تأكيد المنح", "Confirm award")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkBalanceAdjustmentDialog({
  open,
  onOpenChange,
  className,
  students,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  students: Array<{ id: number; name: string; points?: number }>;
  onComplete: () => void;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const mutation = useAdjustStudentBalances();
  const requestKeyRef = useRef<string | null>(null);
  const previewTrackedRef = useRef(false);
  const eligible = students.filter((student) => (student.points || 0) >= points);
  const excluded = students.filter((student) => (student.points || 0) < points);

  useEffect(() => {
    if (!open) {
      previewTrackedRef.current = false;
      return;
    }
    if (previewTrackedRef.current) return;

    previewTrackedRef.current = true;
    trackProjectAnalyticsEvent("bulk_balance_preview_opened", {
      eligible_count: eligible.length,
      excluded_count: excluded.length,
    });
  }, [open, eligible.length, excluded.length]);

  const close = (next: boolean) => {
    if (mutation.isPending) return;
    onOpenChange(next);
    if (!next) {
      setPoints(1);
      setReason("");
      requestKeyRef.current = null;
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      toast.error(r("اختر مقدارًا صحيحًا بين 1 و1000", "Choose a whole number between 1 and 1,000."));
      return;
    }
    if (eligible.length === 0) {
      toast.error(r("لا يوجد طالب برصيد كافٍ لهذا التعديل", "No student has enough points for this adjustment."));
      return;
    }
    requestKeyRef.current ||= crypto.randomUUID();
    mutation.mutate({
      className,
      studentIds: students.map((student) => student.id),
      points,
      reason: reason.trim() || undefined,
      idempotencyKey: requestKeyRef.current,
    }, {
      onSuccess: (result) => {
        trackProjectAnalyticsEvent("bulk_balance_adjustment_completed", {
          eligible_count: result.adjusted.length,
          excluded_count: result.excluded.length,
        });
        toast.success(r(`تم تعديل رصيد ${result.adjusted.length} طالب${result.excluded.length ? ` واستبعاد ${result.excluded.length}` : ""}`, `Adjusted ${result.adjusted.length} student balances${result.excluded.length ? ` and excluded ${result.excluded.length}` : ""}`));
        onOpenChange(false);
        onComplete();
        setPoints(1);
        setReason("");
        requestKeyRef.current = null;
      },
       onError: (error: any) => toast.error(getArabicRewardError(error, r("تعذر تعديل أرصدة الطلاب", "Could not adjust student balances."))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-hidden rounded-[2rem] border-2 border-emerald-100 p-0 sm:max-w-xl motion-reduce:animate-none">
        <DialogHeader className="border-b border-emerald-100 bg-emerald-50/70 p-6">
          <button type="button" onClick={() => close(false)} disabled={mutation.isPending}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-50">
             <ArrowRight size={16} /> {r("رجوع", "Back")}
          </button>
          <DialogTitle className="flex items-center gap-2 font-black text-emerald-950">
            <SlidersHorizontal size={20} className="text-emerald-700" />
             {r(`تعديل أرصدة ${students.length} طلاب`, `Adjust balances for ${students.length} students`)}
          </DialogTitle>
          <DialogDescription className="pt-2 font-medium leading-relaxed text-emerald-900/65">
             {r("سيُطبّق المقدار نفسه على أصحاب الرصيد الكافي فقط، ويمكن ترك السبب فارغًا. راجع المعاينة قبل التأكيد.", "The same amount applies only to students with enough points; the reason may be left blank. Review the preview before confirming.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex max-h-[calc(92dvh-9rem)] flex-col">
          <div className="space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                 <label className="mb-2 block text-sm font-black text-emerald-950">{r("مقدار التعديل", "Adjustment amount")}</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={points}
                  onChange={(event) => setPoints(Number(event.target.value))}
                  className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15"
                />
              </div>
              <div>
                 <label className="mb-2 block text-sm font-black text-emerald-950">{r("سبب الخصم (اختياري)", "Deduction reason (optional)")}</label>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={200}
                   placeholder={r("مثال: تصحيح رصيد أضيف بالخطأ", "Example: correct an accidental balance award")}
                  className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                 <strong className="text-sm font-black text-slate-800">{r("المعاينة", "Preview")}</strong>
                 <span className="text-xs font-bold text-emerald-700">{r(`${eligible.length} سيُعدّل · ${excluded.length} سيُستبعد`, `${eligible.length} will be adjusted · ${excluded.length} will be excluded`)}</span>
              </div>
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {students.map((student) => {
                  const current = student.points || 0;
                  const canAdjust = current >= points;
                  return (
                    <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-800">{student.name}</div>
                        {!canAdjust && <div className="text-xs font-bold text-rose-600">{r("مستبعد: الرصيد الحالي لا يكفي", "Excluded: current balance is too low")}</div>}
                      </div>
                      <div className={cn("shrink-0 text-sm font-black", canAdjust ? "text-emerald-700" : "text-slate-400")}>
                        {formatPoints(current)} ← {canAdjust ? formatPoints(current - points) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t border-slate-100 bg-white p-5">
            <button type="button" onClick={() => close(false)} disabled={mutation.isPending}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 font-black text-slate-600 hover:bg-slate-50">
               {r("إلغاء", "Cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending || eligible.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800 disabled:opacity-50">
              {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
               {r(`تأكيد تعديل ${eligible.length}`, `Confirm adjustment for ${eligible.length}`)}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassBalanceDialog({
  open,
  onOpenChange,
  className,
  balance,
  history,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  balance: number;
  history: Array<{ id: number; operation: "award" | "deduct"; amount: number; resultingBalance: number; reason?: string | null; createdAt: string }>;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [operation, setOperation] = useState<"award" | "deduct">("award");
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const mutation = useAdjustClassRewardBalance();
  const requestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setOperation("award");
      setPoints(1);
      setReason("");
      requestKeyRef.current = null;
    }
  }, [open]);

  const close = (next: boolean) => {
    if (!mutation.isPending) onOpenChange(next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      toast.error(r("اختر عددًا صحيحًا بين 1 و1000", "Choose a whole number between 1 and 1,000."));
      return;
    }
    if (operation === "deduct" && points > balance) {
      toast.error(r("لا يمكن خصم أكثر من رصيد الصف الحالي", "You cannot deduct more than the current class balance."));
      return;
    }
    requestKeyRef.current ||= crypto.randomUUID();
    mutation.mutate({
      className,
      operation,
      points,
      reason: reason.trim() || undefined,
      idempotencyKey: requestKeyRef.current,
    }, {
      onSuccess: (result: any) => {
        toast.success(operation === "award"
          ? r(`تمت إضافة ${formatPoints(points)} نقطة للصف`, `Added ${formatPoints(points)} points to the class`)
          : r(`تم خصم ${formatPoints(points)} نقطة من الصف`, `Deducted ${formatPoints(points)} points from the class`));
        requestKeyRef.current = null;
        onOpenChange(false);
      },
      onError: (error: any) => toast.error(getArabicRewardError(error, r("تعذر تعديل نقاط الصف", "Could not adjust class points."))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-hidden rounded-[2rem] border-2 border-emerald-100 p-0 sm:max-w-lg motion-reduce:animate-none">
        <DialogHeader className="border-b border-emerald-100 bg-gradient-to-l from-emerald-950 to-[#225739] p-6 text-white">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
            <School size={23} className="text-amber-300" />
            {r(`نقاط صف ${className}`, `${className} class points`)}
          </DialogTitle>
          <DialogDescription className="pt-2 font-bold text-emerald-100/75">
            {r("هذا الرصيد مستقل ولا يغيّر نقاط أي طالب.", "This balance is separate and does not change any student's points.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="max-h-[calc(92dvh-8rem)] space-y-5 overflow-y-auto p-6">
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-sm font-black text-amber-900/70">{r("رصيد الصف الحالي", "Current class balance")}</span>
            <strong className="text-xl font-black text-amber-800">{formatPoints(balance)} {r("نقطة", "points")}</strong>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button type="button" onClick={() => { setOperation("award"); requestKeyRef.current = null; }}
              className={cn("flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition", operation === "award" ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white")}>
              <Plus size={17} /> {r("إضافة نقاط", "Add points")}
            </button>
            <button type="button" onClick={() => { setOperation("deduct"); requestKeyRef.current = null; }}
              disabled={balance < 1}
              className={cn("flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition disabled:opacity-40", operation === "deduct" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:bg-white")}>
              <Minus size={17} /> {r("خصم نقاط", "Deduct points")}
            </button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-emerald-950">{r("عدد النقاط", "Points")}</label>
            <input type="number" min={1} max={operation === "deduct" ? Math.min(1000, balance) : 1000} value={points}
              onChange={(event) => { setPoints(Number(event.target.value)); requestKeyRef.current = null; }}
              className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 text-center text-lg font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
            <p className="mt-1.5 text-xs font-bold text-slate-500">
              {r("سيصبح رصيد الصف", "New class balance")}: {formatPoints(Math.max(0, balance + (operation === "award" ? points : -points)))}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-emerald-950">
              {operation === "deduct" ? r("سبب الخصم (اختياري)", "Deduction reason (optional)") : r("سبب الإضافة (اختياري)", "Award reason (optional)")}
            </label>
            <input value={reason} onChange={(event) => { setReason(event.target.value); requestKeyRef.current = null; }} maxLength={200}
              placeholder={operation === "deduct" ? r("يمكن تركه فارغًا", "You may leave this blank") : r("مثال: تعاون الفصل في النشاط", "Example: class teamwork")}
              className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
          </div>

          {history.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-xs font-black text-slate-600">{r("آخر العمليات", "Recent activity")}</h3>
              <div className="space-y-2">
                {history.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <strong className={entry.amount > 0 ? "text-emerald-700" : "text-rose-600"}>
                        {entry.amount > 0 ? "+" : ""}{formatPoints(entry.amount)}
                      </strong>
                      <span className="mr-2 font-bold text-slate-500">{entry.reason || r("بدون سبب", "No reason")}</span>
                    </div>
                    <span className="shrink-0 font-black text-slate-700">{formatPoints(entry.resultingBalance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => close(false)} disabled={mutation.isPending}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 font-black text-slate-600 hover:bg-slate-50">
              {r("إلغاء", "Cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending || (operation === "deduct" && balance < 1)}
              className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-black text-white disabled:opacity-50", operation === "award" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700")}>
              {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : operation === "award" ? <Plus size={18} /> : <Minus size={18} />}
              {operation === "award" ? r("تأكيد الإضافة", "Confirm award") : r("تأكيد الخصم", "Confirm deduction")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
