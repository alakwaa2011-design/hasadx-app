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
  Star, Settings, History, Volume2, VolumeX, Eye, EyeOff, 
  Search, CheckSquare, Square, Plus, Trophy, Loader2, Check, Zap, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Simple local storage hook
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

export default function RewardsPage() {
  const params = useParams<{ className?: string }>();
  const [, setLocation] = useLocation();
  
  // Decoding the class name from URL if present
  const currentClass = params.className;
  
  const { data: classesList, isLoading: loadingClasses } = useGetTeacherClasses();
  
  // If no class is selected and we have classes, auto-redirect to the first one
  useEffect(() => {
    if (!currentClass && classesList && classesList.length > 0) {
      setLocation(`/teacher/rewards/${encodeURIComponent(classesList[0].className || classesList[0].name)}`);
    }
  }, [currentClass, classesList, setLocation]);

  const { data: classData, isLoading: loadingStudents } = useGetClassRewards(currentClass);
  const { data: rewardTypesData } = useGetRewardTypes();
  const grantMutation = useGrantRewards();

  const grantIntentRef = useRef<{ signature: string; key: string } | null>(null);
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
    } catch (e) {
      // Ignore if blocked by browser policy
    }
  };

  const getGrantSignature = (classN: string, studentIds: number[], typeId?: string, customReason?: string, customPoints?: number) => {
    const sorted = [...studentIds].sort((a, b) => a - b).join(",");
    return `${classN}|${sorted}|${typeId || ""}|${customReason || ""}|${customPoints || ""}`;
  };

  const handleGrant = (type?: any, customData?: { reason: string, points: number }) => {
    if (selectedIds.size === 0 || !currentClass) return;

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
      onError: (err) => toast.error(err.message || "حدث خطأ أثناء منح النقاط")
    });
  };

  if (!currentClass) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          {loadingClasses ? <Loader2 className="animate-spin text-primary" size={32} /> : 
            <p className="text-muted-foreground">الرجاء اختيار صف</p>
          }
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <RewardCelebration celebration={celebration} onComplete={() => setCelebration(null)} />
      
      <div className={cn("max-w-5xl mx-auto space-y-4 pb-32 transition-all motion-reduce:transition-none", displayMode && "mt-2")}>
        {/* Header Bar */}
        <div className={cn("flex flex-col sm:flex-row gap-3 items-center justify-between p-3 rounded-2xl bg-card border border-border shadow-sm transition-all motion-reduce:transition-none", displayMode && "py-2 px-4 shadow-none opacity-80 hover:opacity-100")}>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Star size={20} className={cn(!displayMode && "fill-current")} />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                لوحة التحفيز
                <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold border border-border/50">
                  {currentClass}
                </span>
              </h1>
              {!displayMode && <p className="text-xs text-muted-foreground font-medium hidden sm:block">كافئ طلابك وعزز مشاركتهم</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setDisplayMode(!displayMode)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors motion-reduce:transition-none border whitespace-nowrap", 
                displayMode ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-muted border-border"
              )}
            >
              {displayMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {displayMode ? "عرض صفي نشط" : "عرض صفي"}
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
              title={isMuted ? "إلغاء الكتم" : "كتم الصوت"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button 
              onClick={() => setLedgerOpen(true)}
              className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
              title="السجل والملخص"
            >
              <History size={16} />
            </button>
            <button
              data-testid="button-open-reward-rules"
              onClick={() => setRulesOpen(true)}
              className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
              title="قواعد التحفيز التلقائي"
            >
              <Zap size={16} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
              title="إعدادات التحفيز"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search and Select All */}
        {!displayMode && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
              <input
                type="text"
                placeholder="ابحث عن طالب..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button 
              onClick={toggleAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-bold text-foreground transition-colors shrink-0"
            >
              {selectedIds.size === students.length && students.length > 0 ? (
                <><CheckSquare size={16} className="text-primary" /> إلغاء الكل</>
              ) : (
                <><Square size={16} className="text-muted-foreground" /> تحديد الكل</>
              )}
            </button>
          </div>
        )}

        {/* Students Grid */}
        {loadingStudents ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {students.map((student: any) => {
              const isSelected = selectedIds.has(student.id);
              return (
                <div
                  key={student.id}
                  className={cn(
                    "relative rounded-2xl border-2 transition-all motion-reduce:transition-none motion-reduce:transform-none p-3 flex flex-col items-center gap-2 overflow-hidden",
                    isSelected ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                  )}
                >
                  {!displayMode && (
                    <button
                      type="button"
                      aria-label={isSelected ? `إلغاء تحديد ${student.name}` : `تحديد ${student.name} للمنح الجماعي`}
                      aria-pressed={isSelected}
                      className="absolute top-2 right-2 flex items-center gap-1 z-10 p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudent(student.id);
                      }}
                    >
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors motion-reduce:transition-none bg-background",
                        isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/30 bg-background/80 hover:border-primary/50"
                      )}>
                        {isSelected && <Check size={12} strokeWidth={4} />}
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
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-background/80 hover:bg-background border border-border/50 shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary transition-colors z-10"
                      title="ملف الطالب"
                    >
                      <Info size={14} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSingleGrantStudentId(student.id)}
                    className="group flex w-full flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`فتح خيارات تحفيز ${student.name}`}
                  >
                    <AvatarDisplay
                      avatar={student.avatar}
                      fallback={student.name.charAt(0)}
                      size="2xl"
                      className={cn(
                        "shadow-sm ring-4 transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none",
                        isSelected ? "ring-primary/20" : "ring-transparent",
                        displayMode && "w-16 h-16",
                      )}
                    />

                    <div className="text-center w-full">
                      <div className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                        {student.name}
                      </div>
                      {!displayMode && (
                        <div className="inline-flex items-center justify-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black">
                          {student.points || 0}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {students.length === 0 && !loadingStudents && (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy size={48} className="mx-auto mb-4 opacity-20" />
            <p>لا يوجد طلاب في هذا الصف.</p>
          </div>
        )}

      </div>

      {/* Action Bar (Sticky Bottom) */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 p-4 border-t bg-background/90 backdrop-blur-xl transition-all motion-reduce:transition-none motion-reduce:transform-none duration-300 transform z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]",
        selectedIds.size > 0 ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      )}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto border-b sm:border-b-0 sm:border-l border-border pb-3 sm:pb-0 sm:pl-4 border-l-0">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-lg shadow-inner">
              {selectedIds.size}
            </div>
            <div>
              <div className="font-bold text-sm">تم تحديد الطلاب</div>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-red-500 font-medium transition-colors">إلغاء التحديد</button>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0 hide-scrollbar">
            {activeRewardTypes.map((type: any) => (
              <button
                key={type.id}
                onClick={() => handleGrant(type)}
                disabled={grantMutation.isPending || Boolean(celebration)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all motion-reduce:transition-none motion-reduce:transform-none shrink-0 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                style={{ borderColor: `${type.color}40` }}
              >
                <IconRenderer name={type.icon} className="w-4 h-4" style={{ color: type.color }} />
                <span className="font-bold text-sm">{type.name}</span>
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-muted">+{type.points}</span>
              </button>
            ))}
            
            <button
              onClick={() => setCustomGrantOpen(true)}
              disabled={Boolean(celebration)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/50 hover:bg-muted transition-all motion-reduce:transition-none motion-reduce:transform-none shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus size={16} />
              <span className="font-bold text-sm">تخصيص...</span>
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
          if (!singleGrantStudent || !currentClass) return;
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
            onError: (err) => toast.error(err.message || "حدث خطأ أثناء منح النقاط")
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
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-card border-border motion-reduce:animate-none">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-b from-amber-50 to-background flex flex-col items-center justify-center relative">
          <div className="relative mb-3">
            <AvatarDisplay
              avatar={student.avatar}
              fallback={student.name.charAt(0)}
              size="4xl"
              className="ring-4 ring-white shadow-xl bg-white w-24 h-24"
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-lg border-2 border-white text-xs">
              <Star size={14} className="fill-current" />
            </div>
          </div>
          <DialogTitle className="text-xl font-black">{student.name}</DialogTitle>
          <div className="text-sm font-bold text-muted-foreground mt-1">الرصيد الحالي: <span className="text-primary font-black">{student.points || 0}</span> نقطة</div>
        </DialogHeader>

        <div className="p-6">
          {!customOpen ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground text-center">اختر المكافأة التي تود منحها للطالب</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rewardTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => onGrant(type)}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-0.5 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:transform-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    style={{ borderColor: type.color ? `${type.color}40` : undefined }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-background shadow-sm border border-border">
                      <IconRenderer name={type.icon} style={{ color: type.color }} />
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-sm text-foreground">{type.name}</div>
                      <div className="text-xs font-black text-primary mt-0.5">+{type.points}</div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => setCustomOpen(true)}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-0.5 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:transform-none text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                    <Plus size={20} />
                  </div>
                  <div className="font-bold text-sm">مكافأة مخصصة</div>
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
              className="space-y-5"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Star size={16} className="text-amber-500" /> مكافأة مخصصة
                </h3>
                <button type="button" onClick={() => setCustomOpen(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                  العودة للخيارات
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">سبب المكافأة</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="مثال: إجابة متميزة، مساعدة زميل..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">عدد النقاط</label>
                <input
                  type="number"
                  min="1"
                  value={points}
                  onChange={e => setPoints(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-center font-mono font-bold text-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm">
                  {loading && <Loader2 size={16} className="animate-spin" />}
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-lg font-bold">منح نقاط مخصصة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">السبب</label>
            <input 
              type="text" 
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: مساعدة زميل، واجب إضافي..."
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">عدد النقاط</label>
            <input 
              type="number" 
              min="1"
              value={points}
              onChange={e => setPoints(parseInt(e.target.value) || 1)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-center font-mono font-bold text-lg"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl text-muted-foreground font-bold hover:bg-muted transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              تأكيد المنح
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}