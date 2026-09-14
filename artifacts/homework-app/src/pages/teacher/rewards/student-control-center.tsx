import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useGetStudentProfile,
  useUpdateStudentProfile,
  useResetStudentPassword,
  useGrantRewards,
  useAdjustStudentBalance,
} from "./api";
import { AvatarDisplay } from "@/components/avatar-display";
import { ILLUSTRATED_AVATARS } from "@/lib/avatars";
import { RewardCelebration, type RewardCelebrationData } from "./reward-celebration";
import { GoalProgressCard } from "./goal-progress";
import {
  User, Shield, Key, History, FileText, Activity,
  Loader2, Save, Phone, BookOpen, GraduationCap, Eye, EyeOff, Lock,
  Map, Compass, Sparkles, Check, Orbit, Shapes, Waypoints, ChevronDown, ChevronUp, SlidersHorizontal, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRewardPoints } from "./format";
import { getArabicRewardError } from "./error-message";
import { useI18n } from "@/lib/i18n";
import { rewardText } from "./reward-i18n";

interface StudentControlCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
}

const formatPoints = formatRewardPoints;

function PointsOrb({ points, label = "نقاط المغامرة", compact = false }: { points: number; label?: string; compact?: boolean }) {
  return (
    <div className={cn("relative isolate flex items-center justify-center", compact ? "h-16 min-w-28" : "h-36 min-w-44")}>
      <div className="absolute inset-2 rounded-[2rem] bg-amber-300/35 blur-xl" />
      <div className="absolute inset-0 rounded-[2.25rem] border border-dashed border-amber-100/70 motion-safe:animate-[spin_16s_linear_infinite]" />
      <div className="absolute inset-3 rounded-[1.8rem] border border-white/25 motion-safe:animate-[spin_12s_linear_infinite_reverse]" />
      <div className={cn(
        "relative flex items-center gap-3 rounded-[1.75rem] border border-white/35 bg-white/15 text-white shadow-inner backdrop-blur-sm",
        compact ? "px-4 py-2" : "flex-col px-7 py-4",
      )}>
        <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
          <Orbit size={compact ? 24 : 30} className="text-amber-100 motion-safe:animate-[spin_5s_linear_infinite]" />
          <span className="absolute h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]" />
        </span>
        <span className={cn("font-black leading-none drop-shadow-md", compact ? "text-2xl" : "text-6xl")}>
          {formatPoints(points)}
        </span>
        <span className={cn("font-black text-amber-50", compact ? "text-[10px]" : "text-xs")}>{label}</span>
      </div>
    </div>
  );
}

function AdventureEmptyState({ icon: Icon, title, description, color = "emerald" }: { icon: any, title: string, description: string, color?: "emerald" | "amber" | "blue" | "rose" }) {
  const colors = {
    emerald: "from-emerald-100 to-emerald-50 text-emerald-700 ring-emerald-500/20 border-emerald-200",
    amber: "from-amber-100 to-amber-50 text-amber-700 ring-amber-500/20 border-amber-200",
    blue: "from-blue-100 to-blue-50 text-blue-700 ring-blue-500/20 border-blue-200",
    rose: "from-rose-100 to-rose-50 text-rose-700 ring-rose-500/20 border-rose-200",
  };
  const iconColors = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    rose: "text-rose-600",
  };
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
      <div className="relative group">
        <div className={`absolute inset-0 bg-gradient-to-br ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]} blur-xl opacity-60 rounded-full group-hover:scale-110 transition-transform duration-500 motion-reduce:transition-none motion-reduce:transform-none`} />
        <div className={`relative w-28 h-28 rounded-[2.5rem] bg-gradient-to-br ${colors[color]} ring-8 shadow-xl flex items-center justify-center rotate-3 group-hover:rotate-6 group-hover:-translate-y-2 transition-all duration-300 border-2 motion-reduce:transition-none motion-reduce:transform-none`}>
          <Icon size={48} strokeWidth={2} className={`drop-shadow-md ${iconColors[color]}`} />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center animate-bounce-subtle motion-reduce:animate-none border-2 border-white">
          <Sparkles size={18} className="text-amber-500 fill-amber-500/20" />
        </div>
      </div>
      <div className="max-w-xs space-y-2">
        <h4 className="font-black text-xl text-emerald-950 tracking-wide">{title}</h4>
        <p className="text-sm text-emerald-900/60 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function StudentControlCenter({ open, onOpenChange, studentId, className, rewardTypes }: StudentControlCenterProps) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const { data, isLoading } = useGetStudentProfile(studentId);
  
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-slate-50 border-2 border-emerald-100 rounded-[2rem] flex flex-col h-[94dvh] sm:h-[85vh] motion-reduce:animate-none">
        <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b-2 border-emerald-800 bg-emerald-950 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <DialogTitle className="text-xl font-black text-white relative z-10 flex items-center gap-3 pr-24 tracking-wide">
            {isLoading ? r("جاري فتح السجل...", "Opening profile...") : (
              <>
                <Compass className="text-amber-400" size={28} />
                {r("ملف الطالب", "Student profile")}: {data?.student?.name || r("بدون اسم", "Unnamed")}
              </>
            )}
          </DialogTitle>
          <button type="button" onClick={() => onOpenChange(false)}
            className="absolute right-4 top-1/2 z-20 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/20">
            <ArrowRight size={16} /> {r("رجوع", "Back")}
          </button>
          <DialogDescription className="sr-only">
             {r("إدارة بيانات الطالب ونقاطه وإنجازاته وواجباته ونشاطه.", "Manage the student's details, points, achievements, assignments, and activity.")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-emerald-800">
            <Loader2 className="animate-spin" size={48} />
            <p className="font-bold">{r("جاري تحميل ملف الطالب...", "Loading student profile...")}</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-emerald-900/50 font-bold">
             {r("لم يتم العثور على بيانات الطالب.", "Student data was not found.")}
          </div>
        ) : (
          <StudentControlContent
            data={data}
            studentId={studentId!}
            className={className}
            rewardTypes={rewardTypes}
            onAvatarSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentControlContent({ data, studentId, className, rewardTypes, onAvatarSaved }: {
  data: any;
  studentId: number;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
  onAvatarSaved: () => void;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  return (
      <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="px-3 sm:px-6 pt-3 sm:pt-5 border-b-2 border-emerald-100 bg-white shrink-0">
        <TabsList className="w-full flex justify-start h-auto p-1.5 bg-emerald-50/50 overflow-x-auto hide-scrollbar rounded-2xl gap-1 border border-emerald-100">
          <TabsTrigger value="overview" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><Shapes size={16} /> {r("الملخص", "Overview")}</TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><User size={16} /> {r("البيانات", "Details")}</TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><Orbit size={16} /> {r("سجل النقاط", "Points ledger")}</TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><Sparkles size={16} /> {r("الإنجازات", "Achievements")}</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><Map size={16} /> {r("الواجبات", "Assignments")}</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 py-2.5 px-4 rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm data-[state=active]:border-emerald-200 text-sm font-bold border border-transparent text-emerald-900/60 hover:text-emerald-900 transition-all motion-reduce:transition-none"><Waypoints size={16} /> {r("النشاط", "Activity")}</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <TabsContent value="overview" className="m-0 space-y-6 h-full outline-none">
          <OverviewTab data={data} studentId={studentId} className={className} rewardTypes={rewardTypes} />
        </TabsContent>
        <TabsContent value="profile" className="m-0 h-full outline-none">
          <ProfileTab student={data.student} studentId={studentId} onAvatarSaved={onAvatarSaved} />
        </TabsContent>
        <TabsContent value="ledger" className="m-0 h-full outline-none">
          <LedgerTab ledger={data.rewards?.ledger} balance={data.rewards?.balance} />
        </TabsContent>
        <TabsContent value="achievements" className="m-0 h-full outline-none">
          <AchievementsTab achievements={data.achievements} />
        </TabsContent>
        <TabsContent value="assignments" className="m-0 h-full outline-none">
          <AssignmentsTab assignments={data.assignments} />
        </TabsContent>
        <TabsContent value="activity" className="m-0 h-full outline-none">
          <ActivityTab activity={data.activity} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function OverviewTab({ data, studentId, className, rewardTypes }: {
  data: any;
  studentId: number;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const { student, rewards } = data;
  const grantMutation = useGrantRewards();
  const studentGoals = data.goal ? [{
    id: String(data.goal.id),
    title: data.goal.title,
    targetType: data.goal.studentId == null ? "class" as const : "student" as const,
    targetId: data.goal.studentId ?? undefined,
    targetPoints: Number(data.goal.targetPoints),
    currentPoints: Number(data.goal.progress ?? 0),
    endDate: data.goal.endsAt ?? null,
  }] : [];
  const [celebration, setCelebration] = useState<RewardCelebrationData | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const grantInFlightRef = useRef(false);

  const grant = (type: { id: number; name: string; points: number }) => {
    if (!className || grantInFlightRef.current || celebration) return;
    grantInFlightRef.current = true;
    grantMutation.mutate({
      className,
      studentIds: [studentId],
      typeId: type.id,
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: () => {
        setCelebration({
          students: [{ id: studentId, name: student.name, avatar: student.avatar }],
          points: type.points,
          rewardName: type.name,
        });
        toast.success(r("تم منح النقاط للطالب بنجاح", "Points awarded to the student."));
      },
      onError: (error: any) => toast.error(getArabicRewardError(error, r("تعذر منح النقاط", "Could not award points."))),
      onSettled: () => {
        grantInFlightRef.current = false;
      },
    });
  };
  
  return (
    <>
      <RewardCelebration celebration={celebration} onComplete={() => setCelebration(null)} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">

      <div className="md:col-span-1 space-y-6">
        <div className="bg-gradient-to-b from-white to-emerald-50/30 border-2 border-emerald-100 rounded-[2rem] p-8 text-center shadow-sm flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full blur-2xl" />
           <AvatarDisplay
             avatar={student.avatar}
            fallback={student.name?.charAt(0)}
             size="4xl"
             className="ring-8 ring-white shadow-xl bg-emerald-50 mb-6 w-36 h-36 relative z-10 transition-transform duration-500 hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
          />
          <h3 className="font-black text-2xl mb-2 text-emerald-950 relative z-10">{student.name}</h3>
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 bg-emerald-100/50 px-4 py-1.5 rounded-xl border border-emerald-200 relative z-10">
            <GraduationCap size={16} />
            {student.gradeLevel || r("الصف غير محدد", "Grade not set")} • {student.studentClass || r("الفصل غير محدد", "Class not set")}
          </div>
        </div>

        <div className="bg-white border-2 border-emerald-100 rounded-[2rem] p-6 space-y-4 shadow-sm relative overflow-hidden">
          <h4 className="font-black text-lg flex items-center gap-2 text-emerald-950"><Lock size={20} className="text-emerald-500" /> {r("حالة الدخول", "Login status")}</h4>
          {student.account?.linked ? (
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-sm font-black shadow-inner">
                <Shield size={18} className="text-emerald-500" /> {r("حساب البطل مرتبط", "Student account linked")}
              </div>
              <div className="text-sm">
                 <span className="text-emerald-900/60 font-bold block mb-1.5 text-xs">{r("اسم المستخدم", "Username")}</span>
                <span className="font-mono font-bold bg-slate-100 px-3 py-2 rounded-xl block border text-slate-700">{student.account.username}</span>
              </div>
              <PasswordResetDialog studentId={studentId} />
            </div>
          ) : (
            <div className="text-sm font-bold text-amber-700 bg-amber-50/50 p-4 rounded-2xl border-2 border-dashed border-amber-200 text-center">
                {r("لا يوجد حساب طالب مرتبط بهذا الملف بعد.", "No student account is linked to this profile yet.")}
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-2 space-y-6">
        {studentGoals.length > 0 && (
          <section aria-label={r("أهداف تقدم الطالب", "Student progress goals")} className="space-y-3">
            <h4 className="flex items-center gap-2 text-lg font-black text-emerald-950">
              <Compass size={20} className="text-amber-500" />
              {r("أهداف التقدم", "Progress goals")}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {studentGoals.map((goal) => <GoalProgressCard key={goal.id} goal={goal} />)}
            </div>
          </section>
        )}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
           <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 border border-amber-200 rounded-[2rem] p-4 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden flex flex-col items-center justify-center group hover:scale-[1.02] transition-transform motion-reduce:transition-none motion-reduce:transform-none">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
             <PointsOrb points={rewards?.balance || 0} />
          </div>
           <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-500 rounded-[2rem] p-6 shadow-lg shadow-emerald-700/20 text-white relative overflow-hidden flex flex-col items-center justify-center group hover:scale-[1.02] transition-transform motion-reduce:transition-none motion-reduce:transform-none">
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-400/30 rounded-full blur-2xl" />
             <Waypoints size={32} className="mb-3 text-emerald-100" />
              <div className="text-sm font-bold text-emerald-100 mb-2 tracking-wider">{r("الواجبات المنجزة", "Completed assignments")}</div>
             <div className="text-6xl font-black drop-shadow-md">{formatPoints(data.assignments?.filter((a: any) => a.submittedAt)?.length || 0)}</div>
          </div>
        </div>
        
        <div className="bg-white border-2 border-emerald-100 rounded-[2rem] p-6 shadow-sm">
          <h4 className="font-black text-lg flex items-center gap-2 mb-5 text-emerald-950"><Phone size={20} className="text-emerald-500" /> {r("بيانات التواصل", "Contact details")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <div className="text-xs font-bold text-emerald-900/50 mb-1.5">{r("ولي الأمر", "Parent/guardian")}</div>
               <div className="font-black text-emerald-950">{student.parentName || r("غير متوفر", "Not available")}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <div className="text-xs font-bold text-emerald-900/50 mb-1.5">{r("رقم الجوال", "Phone number")}</div>
               <div className="font-black text-emerald-950" dir="ltr">{student.parentPhone || r("غير متوفر", "Not available")}</div>
            </div>
            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <div className="text-xs font-bold text-emerald-900/50 mb-1.5">{r("البريد الإلكتروني", "Email")}</div>
               <div className="font-black text-emerald-950">{student.parentEmail || r("غير متوفر", "Not available")}</div>
            </div>
          </div>
        </div>

         <div className="bg-white border-2 border-emerald-100 rounded-[2rem] p-6 shadow-sm">
           <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
             <h4 className="font-black text-lg flex items-center gap-2 text-emerald-950"><Orbit size={20} className="text-amber-500" /> {r("منح نقاط الآن", "Award points now")}</h4>
             <button
               type="button"
               onClick={() => setAdjustOpen(true)}
               disabled={(rewards?.balance || 0) < 1}
               className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-black text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
             >
                <SlidersHorizontal size={16} /> {r("تعديل الرصيد", "Adjust balance")}
             </button>
           </div>
          {rewardTypes.length ? (
            <div className="flex flex-wrap gap-3">
              {rewardTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  disabled={!className || grantMutation.isPending || Boolean(celebration)}
                  onClick={() => grant(type)}
                   className="rounded-xl border-2 px-4 py-2.5 text-sm font-black transition-all hover:bg-emerald-50 hover:-translate-y-0.5 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 text-emerald-950 shadow-sm flex items-center gap-2"
                  style={{ borderColor: type.color ? `${type.color}40` : '#d1fae5' }}
                >
                  {type.name}
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-xs border border-amber-100 flex items-center gap-0.5">
                    <Orbit size={11} />+{formatPoints(type.points)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
             <p className="text-sm font-bold text-emerald-900/50">{r("أضف أنواع التحفيز من إعدادات اللوحة أولًا.", "Add reward types in board settings first.")}</p>
          )}
        </div>
         <BalanceAdjustmentDialog
           open={adjustOpen}
           onOpenChange={setAdjustOpen}
           studentId={studentId}
           studentName={student.name}
           currentBalance={rewards?.balance || 0}
         />
      </div>
    </div>
    </>
  );
}

export function BalanceAdjustmentDialog({ open, onOpenChange, studentId, studentName, currentBalance }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  currentBalance: number;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const mutation = useAdjustStudentBalance();
  const requestKeyRef = useRef<string | null>(null);

  const close = (next: boolean) => {
    if (!mutation.isPending) {
      onOpenChange(next);
      if (!next) {
        setPoints(1);
        setReason("");
        requestKeyRef.current = null;
      }
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (points < 1 || points > currentBalance) {
      toast.error(r("اختر عددًا لا يتجاوز الرصيد الحالي", "Choose an amount no greater than the current balance."));
      return;
    }
    requestKeyRef.current ||= crypto.randomUUID();
    mutation.mutate({ studentId, points, reason: reason.trim() || undefined, idempotencyKey: requestKeyRef.current }, {
      onSuccess: (result: any) => {
        toast.success(r(`تم تحديث رصيد ${studentName}. الرصيد الآن ${formatPoints(result.balance)} نقطة`, `Updated ${studentName}'s balance. New balance: ${formatPoints(result.balance)} points`));
        onOpenChange(false);
        setPoints(1);
        setReason("");
        requestKeyRef.current = null;
      },
       onError: (error: any) => toast.error(getArabicRewardError(error, r("تعذر تعديل الرصيد", "Could not adjust the balance."))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md rounded-[2rem] border-2 border-emerald-100 p-0 overflow-hidden motion-reduce:animate-none">
        <DialogHeader className="border-b border-emerald-100 bg-emerald-50/60 p-6">
          <button type="button" onClick={() => close(false)} disabled={mutation.isPending}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-50">
             <ArrowRight size={16} /> {r("رجوع", "Back")}
          </button>
          <DialogTitle className="flex items-center gap-2 font-black text-emerald-950">
             <SlidersHorizontal size={20} className="text-emerald-600" /> {r("خصم نقاط من", "Deduct points from")} {studentName}
          </DialogTitle>
          <DialogDescription className="pt-2 font-medium leading-relaxed text-emerald-900/65">
             {r("يمكنك خصم نقاط من رصيد الطالب.", "Deduct points from the student's balance.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
             <span className="text-sm font-bold text-amber-900/70">{r("الرصيد الحالي", "Current balance")}</span>
             <strong className="text-lg font-black text-amber-800">{formatPoints(currentBalance)} {r("نقطة", "points")}</strong>
          </div>
          <div>
             <label className="mb-2 block text-sm font-black text-emerald-950">{r("عدد النقاط المراد خصمها", "Points to deduct")}</label>
            <input type="number" min={1} max={currentBalance} value={points} onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
             <p className="mt-1.5 text-xs font-bold text-slate-500">{r("سيصبح الرصيد", "New balance")}: {formatPoints(Math.max(0, currentBalance - (Number.isFinite(points) ? points : 0)))} {r("نقطة", "points")}</p>
          </div>
          <div>
             <label className="mb-2 block text-sm font-black text-emerald-950">{r("سبب الخصم (اختياري)", "Reason for deduction (optional)")}</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200}
              placeholder={r("مثال: تصحيح رصيد أضيف بالخطأ", "Example: Correcting an incorrect balance addition")}
              className="w-full rounded-xl border-2 border-emerald-100 px-4 py-3 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => close(false)} disabled={mutation.isPending}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 font-black text-slate-600 hover:bg-slate-50">{r("إلغاء", "Cancel")}</button>
            <button type="submit" disabled={mutation.isPending || currentBalance < 1}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800 disabled:opacity-50">
               {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {r("تأكيد الخصم", "Confirm deduction")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordResetDialog({ studentId }: { studentId: number }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const resetMutation = useResetStudentPassword();

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(r("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters."));
      return;
    }
    
    resetMutation.mutate({ studentId, newPassword: password }, {
      onSuccess: () => {
         toast.success(r("تم إعادة تعيين كلمة المرور بنجاح", "Password reset successfully."));
        setOpen(false);
        setPassword("");
      },
      onError: (err: any) => {
         toast.error(getArabicRewardError(err, r("حدث خطأ أثناء إعادة التعيين", "Could not reset the password.")));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black rounded-xl transition-colors border border-slate-200">
          <Key size={16} /> {r("إعادة تعيين كلمة المرور", "Reset password")}
        </button>
      </DialogTrigger>
       <DialogContent className="sm:max-w-sm max-h-[92dvh] rounded-[2rem] border-2 border-emerald-100 p-0 overflow-hidden motion-reduce:animate-none">
        <DialogHeader className="p-6 bg-emerald-50/50 border-b-2 border-emerald-100">
           <DialogTitle className="text-lg font-black text-emerald-950">{r("إعادة تعيين كلمة المرور", "Reset password")}</DialogTitle>
          <DialogDescription className="font-medium text-emerald-900/60 mt-2">
             {r("أدخل كلمة مرور جديدة لحساب هذا البطل. سيحتاج إلى استخدامها في تسجيل الدخول القادم.", "Enter a new password for this student's account. They will use it at the next sign-in.")}
          </DialogDescription>
        </DialogHeader>
         <form onSubmit={handleReset} className="p-6 space-y-5 overflow-y-auto">
          <div className="relative">
             <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("كلمة المرور الجديدة", "New password")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-left font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all"
                dir="ltr"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/40 hover:text-emerald-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
             <p className="text-xs font-bold text-emerald-900/50 mt-2">{r("6 أحرف على الأقل", "At least 6 characters")}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-5 py-2.5 text-sm font-bold rounded-xl text-emerald-900/60 hover:bg-emerald-50 hover:text-emerald-950 transition-colors"
            >
               {r("إلغاء", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={resetMutation.isPending}
              className="px-6 py-2.5 text-sm font-black bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-sm transition-colors"
            >
              {resetMutation.isPending && <Loader2 size={14} className="animate-spin" />}
               {r("تأكيد التغيير", "Confirm change")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab({ student, studentId, onAvatarSaved }: {
  student: any;
  studentId: number;
  onAvatarSaved: () => void;
}) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [formData, setFormData] = useState({
    name: student.name || "",
    gradeLevel: student.gradeLevel || "",
    studentClass: student.studentClass || "",
    parentName: student.parentName || "",
    parentPhone: student.parentPhone || "",
    parentEmail: student.parentEmail || "",
    notes: student.notes || "",
    avatar: student.avatar || ""
  });
  
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const updateMutation = useUpdateStudentProfile();
  const featuredAvatars = ILLUSTRATED_AVATARS.slice(0, 8);
  const currentHiddenAvatar = ILLUSTRATED_AVATARS.find(
    (avatar) => avatar.value === formData.avatar && !featuredAvatars.some((featured) => featured.value === avatar.value),
  );
  const visibleAvatars = showAllAvatars
    ? ILLUSTRATED_AVATARS
    : currentHiddenAvatar
      ? [...featuredAvatars, currentHiddenAvatar]
      : featuredAvatars;

  const handleAvatarSelect = (avatarValue: string) => {
    setFormData(prev => ({ ...prev, avatar: avatarValue }));
    setAvatarChanged(avatarValue !== student.avatar);
  };

  const handleSaveAvatarOnly = () => {
    updateMutation.mutate({
      studentId,
      avatar: formData.avatar || null,
    }, {
      onSuccess: () => {
         toast.success(r("تم تحديث شخصية الطالب بنجاح", "Student character updated."));
        setAvatarChanged(false);
        onAvatarSaved();
      },
      onError: (err: any) => {
         toast.error(getArabicRewardError(err, r("فشل في تحديث البيانات", "Could not update the details.")));
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      studentId,
      ...formData,
      gradeLevel: formData.gradeLevel.trim() || null,
      studentClass: formData.studentClass.trim() || null,
      parentName: formData.parentName.trim() || null,
      parentPhone: formData.parentPhone.trim() || null,
      parentEmail: formData.parentEmail.trim() || null,
      notes: formData.notes.trim() || null,
      avatar: formData.avatar || null,
    }, {
      onSuccess: () => {
         toast.success(r("تم تحديث بيانات البطل بنجاح", "Student details updated."));
        setAvatarChanged(false);
      },
      onError: (err: any) => {
         toast.error(getArabicRewardError(err, r("فشل في تحديث البيانات", "Could not update the details.")));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-8">
      <div className="bg-gradient-to-b from-white to-emerald-50/30 border-2 border-emerald-100 rounded-[2rem] p-8 shadow-sm space-y-8">
        <div>
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 mb-6">
            <div>
               <h3 className="font-black text-xl mb-1.5 flex items-center gap-2 text-emerald-950"><User size={24} className="text-emerald-600" /> {r("شخصية المغامر", "Adventurer character")}</h3>
               <p className="text-sm text-emerald-900/60 font-medium">{r("اختر من الشخصيات المميزة، أو افتح المجموعة الكاملة لمزيد من التنوع.", "Choose a featured character, or open the full collection for more variety.")}</p>
            </div>
            {avatarChanged && (
              <button
                type="button"
                onClick={handleSaveAvatarOnly}
                disabled={updateMutation.isPending}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2 animate-in fade-in zoom-in duration-300 motion-reduce:animate-none motion-reduce:transition-none"
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                 {r("حفظ الشخصية", "Save character")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {visibleAvatars.map((avatar) => (
               <button
                key={avatar.value}
                type="button"
                onClick={() => handleAvatarSelect(avatar.value)}
                className={cn(
                   "group relative overflow-hidden rounded-3xl border-[3px] bg-gradient-to-b from-amber-50/50 to-emerald-50/50 p-2 text-center transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none",
                  formData.avatar === avatar.value
                    ? "border-amber-400 shadow-xl shadow-amber-500/20 ring-4 ring-amber-400/20 bg-amber-50 -translate-y-1"
                    : "border-emerald-100 hover:border-emerald-300 hover:shadow-md hover:-translate-y-1"
                )}
                aria-pressed={formData.avatar === avatar.value}
              >
                <img src={avatar.value} alt="" className="mx-auto aspect-square w-full rounded-2xl object-cover object-top bg-white/50" />
                <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-emerald-950/70 px-2 py-0.5 text-[9px] font-black text-white shadow-sm backdrop-blur-sm">
                  {avatar.category}
                </span>
                <span className="mt-2 block truncate text-xs font-black text-emerald-950">{avatar.label}</span>
                {formData.avatar === avatar.value && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                    <Check size={12} className="text-amber-950 stroke-[3]" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowAllAvatars((visible) => !visible)}
            aria-expanded={showAllAvatars}
            className="mx-auto mt-5 flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-100 bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
          >
            {showAllAvatars ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {showAllAvatars
               ? r("عرض الشخصيات المميزة فقط", "Show featured characters only")
               : r(`عرض المجموعة الكاملة (${ILLUSTRATED_AVATARS.length - featuredAvatars.length} شخصية إضافية)`, `Show full collection (${ILLUSTRATED_AVATARS.length - featuredAvatars.length} more characters)`)}
          </button>
        </div>

        <div className="space-y-5">
          <h3 className="font-black text-xl mb-3 flex items-center gap-2 border-t-2 border-emerald-100/50 pt-8 text-emerald-950"><BookOpen size={24} className="text-emerald-600" /> {r("البيانات الأساسية", "Basic details")}</h3>
          <div>
            <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("الاسم الكامل", "Full name")}</label>
             <input
               type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
               <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("الصف الدراسي", "Grade")}</label>
               <input
                 type="text"
                value={formData.gradeLevel}
                onChange={e => setFormData({ ...formData, gradeLevel: e.target.value })}
                className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm"
                 placeholder={r("مثال: الأول", "Example: Grade 1")}
              />
            </div>
            <div>
               <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("الفصل", "Class")}</label>
               <input
                 type="text"
                value={formData.studentClass}
                onChange={e => setFormData({ ...formData, studentClass: e.target.value })}
                className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm"
                 placeholder={r("مثال: 1/أ", "Example: 1/A")}
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
           <h3 className="font-black text-xl mb-3 flex items-center gap-2 border-t-2 border-emerald-100/50 pt-8 text-emerald-950"><Phone size={24} className="text-emerald-600" /> {r("بيانات التواصل", "Contact details")}</h3>
          <div>
             <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("اسم ولي الأمر", "Parent/guardian name")}</label>
             <input
               type="text"
              value={formData.parentName}
              onChange={e => setFormData({ ...formData, parentName: e.target.value })}
              className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
               <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("رقم الجوال", "Phone number")}</label>
               <input
                 type="text"
                value={formData.parentPhone}
                onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm text-left"
                dir="ltr"
              />
            </div>
            <div>
               <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("البريد الإلكتروني", "Email")}</label>
               <input
                 type="email"
                value={formData.parentEmail}
                onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t-2 border-emerald-100/50 pt-8">
          <div>
             <label className="text-sm font-bold text-emerald-950 mb-2 block">{r("ملاحظات إضافية (لا تظهر للبطل)", "Additional notes (not shown to the student)")}</label>
             <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm min-h-[120px] resize-y"
               placeholder={r("اكتب ملاحظاتك هنا...", "Write your notes here...")}
            />
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t-2 border-emerald-100/50">
           <button
             type="submit"
            disabled={updateMutation.isPending}
             className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:transform-none"
          >
            {updateMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
             {r("حفظ سجل البطل", "Save student profile")}
          </button>
        </div>
      </div>
    </form>
  );
}

function LedgerTab({ ledger, balance }: { ledger: any[], balance: number }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  if (!ledger || ledger.length === 0) {
    return <AdventureEmptyState icon={Orbit} title={r("سجل النقاط فارغ", "Points ledger is empty")} description={r("لم يحصل الطالب على نقاط حتى الآن.", "The student has not received points yet.")} color="amber" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 border border-amber-200 rounded-[2rem] p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <h3 className="font-black text-xl text-white flex items-center gap-2">
             <Orbit size={24} /> {r("رصيد نقاط المغامرة", "Adventure points balance")}
          </h3>
           <p className="text-sm font-bold text-amber-50 mt-1 tracking-wide">{r("إجمالي النقاط المتاحة للطالب الآن", "Total points currently available to the student")}</p>
        </div>
         <PointsOrb points={balance || 0} label={r("نقطة", "points")} compact />
      </div>

      <div className="bg-white border-2 border-emerald-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-emerald-50/50 text-emerald-950 border-b-2 border-emerald-100">
              <tr>
                 <th className="px-5 py-4 font-black w-32">{r("التاريخ", "Date")}</th>
                 <th className="px-5 py-4 font-black">{r("النوع", "Type")}</th>
                 <th className="px-5 py-4 font-black">{r("السبب / التفاصيل", "Reason / details")}</th>
                 <th className="px-5 py-4 font-black text-center w-32">{r("النقاط", "Points")}</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-emerald-50">
              {ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-emerald-900/60 font-bold" dir="ltr">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-5 py-4 font-black text-emerald-950">
                    {entry.kind === "grant" ? r("منح نقاط", "Points award") : entry.kind === "adjustment" ? r("تعديل الرصيد", "Balance adjustment") : entry.kind === "reversal" ? r("تراجع عن منحة", "Award reversed") : entry.kind === "redemption" ? r("استبدال", "Redemption") : entry.kind === "auto" ? r("تحفيز تلقائي", "Automatic reward") : entry.kind}
                  </td>
                  <td className="px-5 py-4 text-emerald-900/80 font-bold">
                    {entry.reason || "-"}
                  </td>
                  <td className="px-5 py-4 text-center font-black">
                    <span className={cn(
                      "inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-sm border",
                      entry.points > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      {entry.points > 0 && <Orbit size={14} />}
                      {entry.points > 0 ? "+" : ""}{formatPoints(entry.points)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AchievementsTab({ achievements }: { achievements: any[] }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  if (!achievements || achievements.length === 0) {
    return <AdventureEmptyState icon={Sparkles} title={r("رحلة الإنجازات تبدأ هنا", "The achievement journey starts here")} description={r("ستظهر لحظات الطالب المميزة هنا عندما يحققها.", "The student's standout moments will appear here as they happen.")} color="emerald" />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 max-w-5xl mx-auto">
      {achievements.map((ach) => (
        <div key={ach.id} className="group bg-gradient-to-b from-white to-amber-50/30 border-2 border-emerald-100 rounded-[2rem] p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-1 transition-all motion-reduce:transition-none motion-reduce:transform-none">
          <div className="relative w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20 border-2 border-white overflow-hidden">
            <div className="absolute inset-2 rounded-full border border-dashed border-white/60 motion-safe:animate-[spin_10s_linear_infinite]" />
            <Sparkles size={30} className="relative text-white transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:transform-none" />
          </div>
          <h4 className="font-black text-emerald-950 mb-1.5">{ach.title}</h4>
          <p className="text-xs font-bold text-emerald-900/60 mb-4">{ach.description}</p>
          <div className="text-[10px] font-bold text-emerald-900/50 mt-auto bg-slate-100 px-3 py-1.5 rounded-xl w-full border border-slate-200">
            {new Date(ach.grantedAt).toLocaleDateString('en-GB')}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentsTab({ assignments }: { assignments: any[] }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  if (!assignments || assignments.length === 0) {
    return <AdventureEmptyState icon={FileText} title={r("لا توجد مهمات", "No assignments")} description={r("لم يتم إسناد مهمات أو تحديات لهذا البطل بعد.", "No assignments or challenges have been assigned to this student yet.")} color="blue" />;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {assignments.map((assignment) => (
         <div key={assignment.id} className="bg-white border-2 border-emerald-100 rounded-[2rem] p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between shadow-sm hover:shadow-md hover:border-emerald-300 transition-all motion-reduce:transition-none">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">{assignment.subject}</span>
              {assignment.submittedAt && (
                <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Check size={12} strokeWidth={3} /> {r("تم الإنجاز", "Completed")}
                </span>
              )}
            </div>
            <h4 className="font-black text-lg text-emerald-950 mb-1">{assignment.title}</h4>
            <div className="text-xs font-bold text-emerald-900/60">
              {r("الوقت المحدد", "Due")}: <span dir="ltr">{new Date(assignment.deadline).toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          {assignment.submittedAt ? (
            <div className="flex items-center gap-5 shrink-0 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="text-center">
                <div className="text-xs font-bold text-emerald-900/50 mb-1">{r("النتيجة", "Score")}</div>
                <div className="font-black font-mono text-emerald-950 text-lg">{formatRewardPoints(assignment.score)} <span className="text-emerald-900/40 text-sm">/ {formatRewardPoints(assignment.totalPoints)}</span></div>
              </div>
              {assignment.earnedPoints > 0 && (
                <div className="text-center border-r-2 border-slate-200 pr-5">
                  <div className="text-xs font-bold text-emerald-900/50 mb-1">{r("نقاط مكتسبة", "Points earned")}</div>
                  <div className="font-black text-amber-600 flex items-center justify-center gap-1">
                    <Orbit size={14} /> +{formatPoints(assignment.earnedPoints)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-black text-slate-500 bg-slate-100 border border-slate-200 px-5 py-2.5 rounded-xl shrink-0">
              {r("بانتظار الإنجاز", "Awaiting completion")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ activity }: { activity: any[] }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  if (!activity || activity.length === 0) {
    return <AdventureEmptyState icon={Activity} title={r("لا يوجد نشاط", "No activity")} description={r("لم يتم تسجيل نشاط لهذا البطل بعد.", "No activity has been recorded for this student yet.")} color="rose" />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 relative before:absolute before:inset-0 before:ml-[50%] before:w-0.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:bg-emerald-100 pb-8 mt-4">
      {activity.map((act, i) => (
        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl border-4 border-white bg-emerald-50 text-emerald-600 shrink-0 md:order-1 md:group-odd:-ml-6 md:group-even:-mr-6 shadow-md z-10">
            {act.category === "login" ? <User size={20} /> :
             act.category === "assignment" ? <FileText size={20} /> :
             act.category === "reward" ? <Orbit size={20} className="text-amber-500" /> :
             <Activity size={20} />}
          </div>
          <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-3rem)] bg-white border-2 border-emerald-100 rounded-[2rem] p-5 shadow-sm group-hover:border-emerald-300 group-hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-emerald-700 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">{act.category}</span>
              <span className="text-xs font-bold text-emerald-900/50" dir="ltr">
                {new Date(act.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <p className="text-sm font-black text-emerald-950 leading-relaxed">{act.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
