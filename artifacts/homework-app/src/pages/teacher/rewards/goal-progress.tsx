import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Target, Pencil, ArrowRight, Save, Clock, Trophy, Archive } from "lucide-react";
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
    <div className={cn("relative overflow-hidden rounded-[2rem] border-2 border-emerald-100 bg-white p-5 shadow-sm transition-all hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-black shadow-sm", goal.targetType === "class" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
              {goal.targetType === "class" ? "هدف الصف" : "هدف الطالب"}
            </span>
            {goal.endDate && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600/70">
                <Clock size={12} />
                {new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short" }).format(new Date(goal.endDate))}
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-emerald-950 leading-tight">{goal.title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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

      <div className="mt-6">
        <div className="flex justify-between items-end mb-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{formatRewardPoints(goal.currentPoints)}</span>
            <span className="text-xs font-bold text-emerald-900/50">/ {formatRewardPoints(goal.targetPoints)} نقطة</span>
          </div>
          {isCompleted ? (
            <span className="text-xs font-black text-amber-500 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
              <Trophy size={14} /> اكتمل!
            </span>
          ) : (
            <span className="text-xs font-black text-emerald-900/60 bg-emerald-50 px-2 py-0.5 rounded-lg">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
        
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-emerald-50 border border-emerald-100/50 shadow-inner">
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
    </div>
  );
}

export interface GoalEditorData {
  title: string;
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
  const [targetType, setTargetType] = useState<GoalTargetType>(initialData?.targetType || "class");
  const [targetId, setTargetId] = useState<string | number | undefined>(initialData?.targetId);
  const [targetPoints, setTargetPoints] = useState<number>(initialData?.targetPoints || 100);
  const [endDate, setEndDate] = useState<string>(initialData?.endDate || "");

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || "");
      setTargetType(initialData?.targetType || "class");
      setTargetId(initialData?.targetId);
      setTargetPoints(initialData?.targetPoints || 100);
      setEndDate(initialData?.endDate || "");
    }
  }, [open, initialData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || targetPoints <= 0) return;
    const saved = await onSave({
      title: title.trim(),
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
