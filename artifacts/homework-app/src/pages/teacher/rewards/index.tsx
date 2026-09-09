import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { AvatarDisplay } from "@/components/avatar-display";
import {
  useGetClassRewards,
  useGetRewardTypes,
  useGrantRewards,
  useGetTeacherClasses
} from "./api";
import { RewardTypesSettings, IconRenderer } from "./settings";
import { RewardLedgerDialog } from "./ledger";
import { RewardRulesDialog } from "./rules";
import { StudentControlCenter } from "./student-control-center";
import { RewardCelebration, type RewardCelebrationData } from "./reward-celebration";
import {
  Settings, History, Volume2, VolumeX, Eye, EyeOff,
  Search, CheckSquare, Square, Plus, Loader2, Check, Zap, Info, Map, Sparkles, Orbit
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const formatPoints = (points: number) => new Intl.NumberFormat("ar-KW").format(points);

function AdventurePointsBadge({ points, className, animate = false }: { points: number, className?: string, animate?: boolean }) {
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
        <span className="text-[9px] font-black text-amber-50">نقطة</span>
      </div>
    </div>
  );
}

export default function RewardsPage() {
  const params = useParams<{ className?: string }>();
  const [, setLocation] = useLocation();
  const currentClass = params.className;
  
  const { data: classesList, isLoading: loadingClasses } = useGetTeacherClasses();
  
  useEffect(() => {
    if (!currentClass && classesList && classesList.length > 0) {
      setLocation(`/teacher/rewards/${encodeURIComponent(classesList[0].className || classesList[0].name)}`);
    }
  }, [currentClass, classesList, setLocation]);

  const { data: classData, isLoading: loadingStudents } = useGetClassRewards(currentClass);
  const { data: rewardTypesData } = useGetRewardTypes();
  const grantMutation = useGrantRewards();

  const grantIntentRef = useRef<{ signature: string; key: string } | null>(null);
  const bulkGrantPendingRef = useRef(false);
  const singleGrantPendingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
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
  const [displayMode, setDisplayMode] = useLocalStorage("hasaad_rewards_display_mode", false);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [customGrantOpen, setCustomGrantOpen] = useState(false);
  const [studentControlOpen, setStudentControlOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [singleGrantStudentId, setSingleGrantStudentId] = useState<number | null>(null);
  
  const [celebration, setCelebration] = useState<RewardCelebrationData | null>(null);

  const students = useMemo(() => {
    if (!classData?.students) return [];
    return classData.students.filter((s: any) => 
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [classData, search]);

  const singleGrantStudent = useMemo(
    () => classData?.students?.find((student: any) => student.id === singleGrantStudentId) ?? null,
    [classData, singleGrantStudentId],
  );

  useEffect(() => {
    setSingleGrantStudentId(null);
  }, [currentClass]);

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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  const getGrantSignature = (classN: string, studentIds: number[], typeId?: string, customReason?: string, customPoints?: number) => {
    const sorted = [...studentIds].sort((a, b) => a - b).join(",");
    return `${classN}|${sorted}|${typeId || ""}|${customReason || ""}|${customPoints || ""}`;
  };

  const handleGrant = (type?: any, customData?: { reason: string, points: number }) => {
    if (selectedIds.size === 0 || !currentClass || bulkGrantPendingRef.current || celebration) return;
    bulkGrantPendingRef.current = true;

    resumeAudioContext();

    const signature = getGrantSignature(currentClass, Array.from(selectedIds), type?.id, customData?.reason, customData?.points);
    let key: string = crypto.randomUUID();
    if (grantIntentRef.current?.signature === signature) {
      key = grantIntentRef.current.key;
    } else {
      grantIntentRef.current = { signature, key };
    }

    const payload = {
      className: currentClass,
      studentIds: Array.from(selectedIds),
      typeId: type?.id,
      customReason: customData?.reason,
      customPoints: customData?.points,
      idempotencyKey: key
    };

    grantMutation.mutate(payload, {
      onSuccess: () => {
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
        toast.success(`تم منح ${pts} نقطة لـ ${payload.studentIds.length} طالب`);
      },
      onError: (err) => {
        toast.error(err.message || "حدث خطأ أثناء منح النقاط");
      },
      onSettled: () => {
        bulkGrantPendingRef.current = false;
      },
    });
  };

  if (!currentClass) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          {loadingClasses ? <Loader2 className="animate-spin text-emerald-600" size={32} /> :
            <p className="text-emerald-900/60 font-bold">الرجاء اختيار صف للبدء</p>
          }
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <RewardCelebration
        celebration={celebration}
        onComplete={() => {
          bulkGrantPendingRef.current = false;
          setCelebration(null);
        }}
      />

      <div className={cn("max-w-6xl mx-auto space-y-6 pb-32 transition-all motion-reduce:transition-none", displayMode && "mt-2")}>

        {/* Storybook Header */}
        <div className={cn("flex flex-col sm:flex-row gap-4 items-center justify-between p-5 rounded-3xl bg-emerald-950 text-white shadow-xl relative overflow-hidden transition-all motion-reduce:transition-none", displayMode && "py-3 opacity-90 hover:opacity-100 shadow-none")}>
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_18%_25%,rgba(255,255,255,0.35)_0_1px,transparent_1.5px),radial-gradient(circle_at_78%_62%,rgba(251,191,36,0.45)_0_1.5px,transparent_2px)] [background-size:34px_34px,48px_48px] pointer-events-none" />
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-10 right-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-4 w-full sm:w-auto relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border border-amber-200/50 shrink-0 transform -rotate-3">
              <Map size={24} className="text-white fill-white/20" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-black flex items-center gap-2 tracking-wide">
                 رحلة التحفيز
                <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-amber-100 font-bold border border-white/10 backdrop-blur-sm shadow-inner">
                  {currentClass}
                </span>
              </h1>
              {!displayMode && <p className="text-sm text-emerald-200/80 font-medium hidden sm:block mt-0.5">نقاط جميلة تصنع لحظات إنجاز لا تُنسى</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 relative z-10 hide-scrollbar">
            <button
              onClick={() => setDisplayMode(!displayMode)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all motion-reduce:transition-none shadow-sm border whitespace-nowrap",
                displayMode ? "bg-amber-400 text-amber-950 border-amber-300" : "bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-md"
              )}
            >
              {displayMode ? <EyeOff size={16} /> : <Eye size={16} />}
              {displayMode ? "عرض نشط" : "عرض الأبطال"}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-md shrink-0 shadow-sm"
              title={isMuted ? "إلغاء الكتم" : "كتم الصوت"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button 
              onClick={() => setLedgerOpen(true)}
              className="p-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-md shrink-0 shadow-sm"
              title="السجل والملخص"
            >
              <History size={16} />
            </button>
            <button
              data-testid="button-open-reward-rules"
              onClick={() => setRulesOpen(true)}
              className="p-2 rounded-xl bg-white/10 border border-white/10 text-amber-300 hover:bg-white/20 hover:text-amber-200 transition-all backdrop-blur-md shrink-0 shadow-sm"
              title="قواعد التحفيز التلقائي"
            >
              <Zap size={16} className="fill-amber-400/30" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-md shrink-0 shadow-sm"
              title="إعدادات التحفيز"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {!displayMode && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-900/40 group-focus-within:text-emerald-600 transition-colors" size={18} />
              <input
                type="text"
                placeholder="ابحث عن طالب..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-11 py-3 rounded-2xl border-2 border-emerald-100 bg-white text-sm font-bold text-emerald-950 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={toggleAll}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-emerald-100 bg-white hover:bg-emerald-50 hover:border-emerald-200 text-sm font-black text-emerald-950 transition-all shrink-0 shadow-sm"
            >
              {selectedIds.size === students.length && students.length > 0 ? (
                <><CheckSquare size={18} className="text-amber-500" /> إلغاء الكل</>
              ) : (
                <><Square size={18} className="text-emerald-900/40" /> تحديد الكل</>
              )}
            </button>
          </div>
        )}

        {/* Students Grid */}
        {loadingStudents ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-800 space-y-4">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">جاري تحميل الطلاب...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {students.map((student: any) => {
              const isSelected = selectedIds.has(student.id);
              return (
                <div
                  key={student.id}
                  className={cn(
                    "group relative rounded-[2rem] border-[3px] p-4 flex flex-col items-center gap-3 overflow-hidden transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none",
                    isSelected ? "border-amber-400 bg-amber-50/80 shadow-lg shadow-amber-500/15 -translate-y-1" : "border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1"
                  )}
                >
                  <div className={cn("absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl transition-colors duration-500", isSelected ? "bg-amber-300/40" : "bg-emerald-200/40 group-hover:bg-amber-200/40")} />

                  {!displayMode && (
                    <button
                      type="button"
                      aria-label={isSelected ? `إلغاء تحديد ${student.name}` : `تحديد ${student.name} للمنح الجماعي`}
                      aria-pressed={isSelected}
                      className="absolute top-3 right-3 flex items-center gap-1 z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudent(student.id);
                      }}
                    >
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shadow-sm",
                        isSelected ? "bg-amber-400 border-amber-400 text-amber-950 scale-110" : "border-emerald-200 bg-white hover:border-amber-300 hover:scale-105"
                      )}>
                        {isSelected && <Check size={14} strokeWidth={4} />}
                      </div>
                    </button>
                  )}

                  {!displayMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveStudentId(student.id);
                        setStudentControlOpen(true);
                      }}
                      className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-white/80 hover:bg-white border-2 border-emerald-100 shadow-sm flex items-center justify-center text-emerald-900/40 hover:text-emerald-700 hover:border-emerald-300 transition-all z-20"
                      title="ملف الطالب"
                    >
                      <Info size={14} strokeWidth={2.5} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSingleGrantStudentId(student.id)}
                    className="w-full flex flex-col items-center relative rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 group/avatar mt-2"
                    aria-label={`فتح خيارات تحفيز ${student.name}`}
                  >
                    <div className="relative">
                      <AvatarDisplay
                        avatar={student.avatar}
                        fallback={student.name.charAt(0)}
                        size="4xl"
                        className={cn(
                          "shadow-md ring-[4px] ring-white relative z-10 transition-transform duration-500 group-hover/avatar:scale-105 bg-emerald-50 motion-reduce:transition-none motion-reduce:transform-none",
                          isSelected && "ring-amber-200 shadow-amber-400/30"
                        )}
                      />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                        <AdventurePointsBadge
                          points={student.points || 0}
                          className={cn(
                            "scale-90 transition-transform group-hover/avatar:scale-100 motion-reduce:transition-none",
                            isSelected && "scale-100",
                            displayMode && "scale-100",
                          )}
                        />
                      </div>
                    </div>
                    <div className="mt-5 w-full px-1 text-center">
                      <div className="truncate text-sm font-black tracking-wide text-emerald-950 transition-colors group-hover/avatar:text-emerald-700 motion-reduce:transition-none">
                      {student.name}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {students.length === 0 && !loadingStudents && (
          <div className="flex flex-col items-center justify-center py-24 text-emerald-900/40 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50" />
              <Map size={64} className="relative drop-shadow-sm" strokeWidth={1.5} />
            </div>
            <p className="font-bold text-lg">لم يتم العثور على طلاب في هذا الصف.</p>
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
               <div className="font-black text-sm text-emerald-950">طلاب محددون</div>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors">إلغاء التحديد</button>
              </div>
           </div>

           <div className="flex-1 flex items-center justify-start gap-2 overflow-x-auto hide-scrollbar px-1 py-1 w-full">
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
                <span className="text-sm">نقاط مخصصة</span>
             </button>
           </div>
        </div>
      </div>

      <RewardTypesSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RewardRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} rewardTypes={rewardTypesData || []} />
      <RewardLedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} className={currentClass} />
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
              toast.error(err.message || "حدث خطأ أثناء منح النقاط");
            },
            onSettled: () => {
              singleGrantPendingRef.current = false;
            },
          });
        }}
        loading={grantMutation.isPending}
      />
    </Layout>
  );
}

function SingleStudentGrantDialog({
  open, onOpenChange, student, rewardTypes, onGrant, loading
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  rewardTypes: any[];
  onGrant: (type?: any, customData?: { reason: string, points: number }) => void;
  loading: boolean;
}) {
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
              fallback={student.name.charAt(0)}
              size="4xl"
              className="ring-4 ring-amber-400 shadow-2xl bg-amber-50 w-28 h-28 relative z-10"
            />
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
              <AdventurePointsBadge points={student.points || 0} animate />
            </div>
          </div>
          <DialogTitle className="text-2xl font-black text-white relative z-10 tracking-wide">{student.name}</DialogTitle>
        </DialogHeader>

          <div className="max-h-[65dvh] overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
          {!customOpen ? (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-emerald-900/60 text-center tracking-wide">اختر نوع التحفيز للطالب</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {rewardTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => onGrant(type)}
                    disabled={loading}
                    className="relative group flex flex-col items-center justify-center gap-3 p-4 rounded-[1.5rem] border-2 bg-white overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-amber-400/20"
                    style={{ borderColor: type.color ? `${type.color}40` : 'rgba(16, 185, 129, 0.2)' }}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-full" style={{ color: type.color || '#10b981' }} />

                    <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-emerald-50 group-hover:scale-110 transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none" style={{ backgroundColor: type.color ? `${type.color}15` : '#ecfdf5', color: type.color || '#10b981' }}>
                      <IconRenderer name={type.icon} />
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
                  <div className="font-black text-xs">نقاط مخصصة</div>
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!reason.trim()) { toast.error("يرجى إدخال السبب"); return; }
                if (points < 1) { toast.error("يجب أن تكون النقاط 1 على الأقل"); return; }
                onGrant(undefined, { reason, points });
              }}
              className="space-y-6 max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-emerald-950 flex items-center gap-2 text-lg">
                  <Sparkles size={20} className="text-amber-500" /> نقاط مخصصة
                </h3>
                <button type="button" onClick={() => setCustomOpen(false)} className="text-xs font-bold text-emerald-900/50 hover:text-emerald-950 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm transition-colors">
                  العودة للخيارات
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-emerald-950 mb-2 block">سبب المكافأة</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="مثال: إجابة متميزة، مساعدة زميل..."
                    className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 shadow-sm transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-emerald-950 mb-2 block">عدد النقاط</label>
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
                   منح النقاط
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
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error("يرجى إدخال السبب"); return; }
    if (points < 1) { toast.error("يجب أن تكون النقاط 1 على الأقل"); return; }
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
            منح نقاط مخصصة
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="text-sm font-bold text-emerald-950 mb-2 block">السبب</label>
            <input 
              type="text" 
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: مساعدة زميل، مهمة إضافية..."
              className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 shadow-sm transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-bold text-emerald-950 mb-2 block">عدد النقاط</label>
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
            <button type="button" onClick={() => onOpenChange(false)} className="px-5 py-3 rounded-2xl text-emerald-900/60 font-bold hover:bg-emerald-50 hover:text-emerald-950 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black hover:from-amber-500 hover:to-orange-600 transition-all motion-reduce:transition-none motion-reduce:transform-none flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-white/30" />}
              تأكيد المنح
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
