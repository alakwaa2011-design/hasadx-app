import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Target, Pencil, ArrowRight, Save, Clock, Trophy, Archive, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRewardPoints } from "./format";

export type GoalTargetType = "class" | "student";

export interface RewardGoal {
  id: string;
  title: string;
  targetType: GoalTargetType;
  targetId?: string | number; // class name or student id
  targetPoints: number;
  currentPoints: number;
  endDate?: string | null;
}

export interface GoalProgressCardProps {
  goal: RewardGoal;
  onEdit?: () => void;
  onArchive?: () => void;
  className?: string;
}

export function GoalProgressCard({ goal, onEdit, onArchive, className }: GoalProgressCardProps) {
  const reduceMotion = useReducedMotion();
  const percentage = Math.min(100, Math.max(0, (goal.currentPoints / goal.targetPoints) * 100));
  const isCompleted = percentage >= 100;

  return (
    <motion.article
      animate={isCompleted && !reduceMotion ? { y: [0, -5, 0], scale: [1, 1.018, 1] } : undefined}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-[2rem] border-2 p-5 transition-all",
        isCompleted
          ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-[0_18px_46px_-22px_rgba(217,165,33,0.55)] ring-2 ring-amber-200/45"
          : "border-emerald-100 bg-white shadow-sm hover:shadow-md",
        className,
      )}
    >
      {isCompleted && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.32),transparent_68%)]" />
          <motion.div
            aria-hidden="true"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.4, rotate: -18 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 14, delay: 0.12 }}
            className="absolute -left-4 -top-4 flex h-20 w-20 items-end justify-end rounded-full bg-amber-300/20 p-4 text-amber-500"
          >
            <Sparkles size={28} />
          </motion.div>
          {!reduceMotion && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {[
                ["right-[12%]", "top-4", "bg-amber-400"],
                ["right-[28%]", "top-9", "bg-emerald-400"],
                ["left-[28%]", "top-5", "bg-sky-400"],
                ["left-[12%]", "top-14", "bg-rose-400"],
              ].map(([x, y, color], index) => (
                <motion.span
                  key={index}
                  className={cn("absolute h-2 w-2 rounded-sm", x, y, color)}
                  initial={{ opacity: 0, y: -14, rotate: 0 }}
                  animate={{ opacity: [0, 1, 0], y: [-14, 34], rotate: 180 }}
                  transition={{ duration: 1.5, delay: index * 0.12, repeat: 1, repeatDelay: 0.3 }}
                />
              ))}
            </div>
          )}
        </>
      )}
      {isCompleted && (
        <motion.div
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.35, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: [1, 1.08, 1], y: 0, rotate: [0, -4, 4, 0] }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 13, delay: 0.1 }}
          className="relative z-10 mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border-4 border-white bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-[0_16px_34px_-14px_rgba(217,165,33,0.8)] ring-4 ring-amber-200/70"
        >
          <Trophy size={38} strokeWidth={2.4} />
          <motion.span
            className="absolute -right-2 -top-2 text-amber-500"
            animate={reduceMotion ? undefined : { scale: [0.75, 1.2, 0.75], rotate: [0, 18, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            <Sparkles size={24} />
          </motion.span>
        </motion.div>
      )}
      <div className={cn("flex items-start justify-between gap-4", isCompleted && "relative z-10 flex-col items-center text-center")}>
        <div className={cn("flex-1", isCompleted && "w-full")}>
          <div className={cn("mb-1.5 flex items-center gap-2", isCompleted && "justify-center")}>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-black shadow-sm",
              isCompleted
                ? "border border-amber-300 bg-amber-400 text-amber-950"
                : goal.targetType === "class" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800",
            )}>
              {isCompleted && <Crown size={13} />}
              {isCompleted ? "هدف مكتمل" : goal.targetType === "class" ? "هدف الصف" : "هدف الطالب"}
            </span>
            {goal.endDate && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600/70">
                <Clock size={12} />
                {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short" }).format(new Date(goal.endDate))}
              </span>
            )}
          </div>
          <h3 className={cn("font-black leading-tight text-emerald-950", isCompleted ? "mx-auto max-w-lg text-2xl" : "text-lg")}>{goal.title}</h3>
          {isCompleted && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mx-auto mt-3 inline-flex max-w-md items-center justify-center rounded-2xl border border-amber-200 bg-white/85 px-4 py-2.5 text-center text-sm font-black leading-relaxed text-amber-800 shadow-sm"
            >
              {goal.targetType === "class"
                ? "أحسنتم! حقق الصف الهدف واستحق الفوز"
                : "رائع! تحقق الهدف واستحق الطالب الاحتفاء"}
            </motion.div>
          )}
        </div>
        <div className={cn("flex shrink-0 items-center gap-1", isCompleted && "absolute left-0 top-0")}>
          {onEdit && (
            <button onClick={onEdit} className="rounded-xl p-2.5 text-emerald-900/40 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-400/20" aria-label="تعديل الهدف">
              <Pencil size={16} />
            </button>
          )}
          {onArchive && (
            <button onClick={onArchive} className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-300/30" aria-label="أرشفة الهدف">
              <Archive size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={cn("mt-6", isCompleted && "relative z-10 mt-5")}>
        <div className={cn("mb-2.5 flex items-end justify-between", isCompleted && "justify-center gap-4")}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{formatRewardPoints(goal.currentPoints)}</span>
            <span className="text-xs font-bold text-emerald-900/50">/ {formatRewardPoints(goal.targetPoints)} نقطة</span>
          </div>
          {isCompleted ? (
            <span className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950 shadow-sm">
              <Trophy size={14} /> فوز مستحق
            </span>
          ) : (
            <span className="text-xs font-black text-emerald-900/60 bg-emerald-50 px-2 py-0.5 rounded-lg">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
        
        <div className={cn(
          "relative h-4 w-full overflow-hidden rounded-full border shadow-inner",
          isCompleted ? "border-amber-200 bg-amber-100" : "border-emerald-100/50 bg-emerald-50",
        )}>
          <motion.div
            className={cn("absolute bottom-0 right-0 top-0 h-full rounded-full shadow-sm", isCompleted ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-emerald-400 to-emerald-500")}
            initial={reduceMotion ? { width: `${percentage}%` } : { width: "0%" }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          {!reduceMotion && !isCompleted && percentage > 0 && (
             <motion.div
               className="absolute top-0 bottom-0 w-16 bg-white/30 blur-[4px]"
               initial={{ right: "-20%" }}
               animate={{ right: "120%" }}
               transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
             />
          )}
        </div>
      </div>
    </motion.article>
  );
}

export interface GoalEditorData {
  title: string;
  skill: string;
  targetType: GoalTargetType;
  targetId?: string | number;
  targetPoints: number;
  endDate?: string | null;
}

export interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: GoalEditorData | null;
  onSave: (data: GoalEditorData) => Promise<boolean | void> | boolean | void;
  students?: { id: number; name: string }[];
  saving?: boolean;
}

export function GoalDialog({ open, onOpenChange, initialData, onSave, students = [], saving = false }: GoalDialogProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [skill, setSkill] = useState(initialData?.skill || "");
  const [targetType, setTargetType] = useState<GoalTargetType>(initialData?.targetType || "class");
  const [targetId, setTargetId] = useState<string | number | undefined>(initialData?.targetId);
  const [targetPoints, setTargetPoints] = useState<number>(initialData?.targetPoints || 100);
  const [endDate, setEndDate] = useState<string>(initialData?.endDate || "");

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || "");
      setSkill(initialData?.skill || "");
      setTargetType(initialData?.targetType || "class");
      setTargetId(initialData?.targetId);
      setTargetPoints(initialData?.targetPoints || 100);
      setEndDate(initialData?.endDate || "");
    }
  }, [open, initialData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !skill.trim() || targetPoints <= 0) return;
    const saved = await onSave({
      title: title.trim(),
      skill: skill.trim(),
      targetType,
      targetId: targetType === "student" ? targetId : undefined,
      targetPoints,
      endDate: endDate || null,
    });
    if (saved !== false) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-2 border-emerald-100 p-0 overflow-hidden motion-reduce:animate-none shadow-2xl">
        <div className="bg-emerald-950 px-7 py-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/15 rounded-full blur-[40px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[30px] pointer-events-none" />
          
          <div className="relative z-10">
            <button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="absolute left-0 top-1 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:ring-4 focus:ring-amber-400/20 outline-none disabled:opacity-50">
              <ArrowRight size={16} /> رجوع
            </button>
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-2.5 mt-1">
              <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-300/30">
                <Target className="text-amber-400" size={20} />
              </span>
              {initialData ? "تعديل الهدف" : "هدف جديد"}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-emerald-100/80 mt-3 pr-1">
              ضع هدفاً ملهماً يشجع الأبطال على التقدم المستمر.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-7 space-y-6 bg-white">
          <div>
            <label className="mb-2 block text-sm font-black text-emerald-950">عنوان الهدف</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="مثال: إكمال قراءة 10 قصص"
              className="w-full rounded-2xl border-2 border-emerald-100 px-4 py-3.5 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 transition-all text-emerald-950 shadow-sm"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-emerald-950">المهارة أو عادة التعلّم</label>
            <input
              value={skill}
              onChange={e => setSkill(e.target.value)}
              placeholder="مثال: القراءة اليومية أو المشاركة بثقة"
              className="w-full rounded-2xl border-2 border-emerald-100 px-4 py-3.5 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 transition-all text-emerald-950 shadow-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setTargetType("class")} className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-sm font-black transition-all outline-none focus:ring-4", targetType === "class" ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm focus:ring-emerald-400/20" : "border-slate-100 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50 focus:ring-slate-200")}>
              هدف للصف
            </button>
            <button type="button" onClick={() => setTargetType("student")} className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-sm font-black transition-all outline-none focus:ring-4", targetType === "student" ? "border-sky-500 bg-sky-50 text-sky-800 shadow-sm focus:ring-sky-400/20" : "border-slate-100 text-slate-500 hover:border-sky-200 hover:bg-sky-50/50 focus:ring-slate-200")}>
              هدف لطالب
            </button>
          </div>

          {targetType === "student" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <label className="mb-2 block text-sm font-black text-emerald-950">اختر الطالب</label>
              <div className="relative">
                <select 
                  value={targetId || ""} 
                  onChange={e => setTargetId(Number(e.target.value))}
                  className="w-full rounded-2xl border-2 border-emerald-100 px-4 py-3.5 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 appearance-none bg-white text-emerald-950 shadow-sm"
                  required
                >
                  <option value="" disabled>اختر طالباً...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-900/40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-black text-emerald-950">النقاط المستهدفة</label>
              <input 
                type="number"
                min="1"
                value={targetPoints} 
                onChange={e => setTargetPoints(Number(e.target.value))} 
                className="w-full rounded-2xl border-2 border-emerald-100 px-4 py-3.5 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 text-emerald-950 shadow-sm text-left"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black text-emerald-950">تاريخ الانتهاء</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-900/40 pointer-events-none" size={16} />
                <input 
                  type="date"
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full rounded-2xl border-2 border-emerald-100 py-3.5 pr-11 pl-4 font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15 text-sm text-emerald-950 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/15 transition-all hover:bg-emerald-800 hover:-translate-y-0.5 focus:ring-4 focus:ring-emerald-400/30 outline-none disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={18} />
              {initialData ? "حفظ التعديلات" : "إنشاء الهدف"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
