import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  RewardRuleInput,
  RewardRuleSourceType,
  useCreateRewardRule,
  useGetRewardRules,
  useReprocessRewardRule,
  useUpdateRewardRule,
} from "./api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRewardPoints } from "./format";
import { getArabicRewardError } from "./error-message";

type RewardType = { id: number; name: string; points: number; active: boolean };
type RuleForm = Omit<RewardRuleInput, "rewardTypeId"> & { rewardTypeId: string };

const emptyRule = (rewardTypeId: number | string = ""): RuleForm => ({
  name: "",
  sourceType: "assignment_submission",
  conditionType: "completion",
  threshold: 0,
  rewardTypeId: String(rewardTypeId),
  amount: 1,
  isActive: true,
});

function rulePreview(rule: Omit<RewardRuleInput, "rewardTypeId"> & { rewardTypeId: number | string }, rewardTypes: RewardType[]) {
  const reward = rewardTypes.find((type) => type.id === Number(rule.rewardTypeId))?.name || "نوع التحفيز المختار";
  if (rule.sourceType === "kids_activity_completion") {
      return `عند إكمال الطالب لنشاط الأطفال، يُمنح ${formatRewardPoints(rule.amount)} من «${reward}».`;
  }
  if (rule.sourceType === "game_history") {
    if (rule.conditionType === "score_at_least") {
      return `عند تسجيل الطالب ${formatRewardPoints(rule.threshold)} نقطة أو أكثر في النتيجة النهائية المحفوظة للعبة وميض، يُمنح ${formatRewardPoints(rule.amount)} من «${reward}».`;
    }
    return `عند حفظ النتيجة النهائية للطالب في لعبة وميض، يُمنح ${formatRewardPoints(rule.amount)} من «${reward}».`;
  }
  if (rule.conditionType === "score_at_least") {
    return `عند حصول الطالب على ${formatRewardPoints(rule.threshold || 0)} درجة أو أكثر في الواجب، يُمنح ${formatRewardPoints(rule.amount)} من «${reward}».`;
  }
  return `عند إكمال الطالب للواجب، يُمنح ${formatRewardPoints(rule.amount)} من «${reward}».`;
}

export function RewardRulesDialog({ open, onOpenChange, rewardTypes }: { open: boolean; onOpenChange: (open: boolean) => void; rewardTypes: RewardType[] }) {
  const { data: rules = [], isLoading } = useGetRewardRules();
  const createRule = useCreateRewardRule();
  const updateRule = useUpdateRewardRule();
  const reprocessRule = useReprocessRewardRule();
  const activeTypes = useMemo(() => rewardTypes.filter((type) => type.active), [rewardTypes]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyRule());
  const [reprocessRuleId, setReprocessRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAdding(false);
      setForm(emptyRule(activeTypes[0]?.id));
    }
  }, [open, activeTypes]);

  const changeSource = (sourceType: RewardRuleSourceType) => {
    setForm((current) => ({
      ...current,
      sourceType,
      conditionType: sourceType === "kids_activity_completion" ? "completion" : current.conditionType,
      threshold: sourceType === "kids_activity_completion" ? 0 : current.threshold,
    }));
  };

  const save = (): void => {
    if (!form.name.trim()) {
      toast.error("أدخل اسمًا واضحًا للقاعدة");
      return;
    }
    if (!form.rewardTypeId) {
      toast.error("اختر نوع تحفيز نشطًا");
      return;
    }
    if (form.amount < 1) {
      toast.error("يجب أن تكون الكمية 1 على الأقل");
      return;
    }
    if (form.conditionType === "score_at_least" && (!form.threshold || form.threshold < 1 || form.threshold > 1000)) {
      toast.error("أدخل درجة بين 1 و1000");
      return;
    }
    createRule.mutate({ ...form, name: form.name.trim(), rewardTypeId: Number(form.rewardTypeId) }, {
      onSuccess: () => {
        toast.success("تمت إضافة القاعدة التلقائية");
        setAdding(false);
        setForm(emptyRule(activeTypes[0]?.id));
      },
      onError: (error) => toast.error(getArabicRewardError(error, "تعذر حفظ القاعدة")),
    });
  };

  const toggleRule = (id: string, isActive: boolean) => {
    updateRule.mutate({ id, isActive: !isActive }, {
      onSuccess: () => toast.success(isActive ? "تم إيقاف القاعدة" : "تم تفعيل القاعدة"),
      onError: (error) => toast.error(getArabicRewardError(error, "تعذر تحديث القاعدة")),
    });
  };

  const confirmReprocess = () => {
    if (!reprocessRuleId) return;
    reprocessRule.mutate(reprocessRuleId, {
      onSuccess: () => {
        setReprocessRuleId(null);
        toast.success("بدأت إعادة المعالجة بأمان");
      },
      onError: (error) => toast.error(getArabicRewardError(error, "تعذرت إعادة المعالجة")),
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0 bg-background/95 backdrop-blur-xl border-border" dir="rtl">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20">
          <button type="button" onClick={() => onOpenChange(false)} className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
            <ArrowRight size={15} /> رجوع
          </button>
          <DialogTitle className="text-lg font-bold">قواعد التحفيز التلقائي</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">اربط الإنجاز بالنقاط دون تغيير منحك اليدوي.</p>
        </DialogHeader>
        <div className="p-4 space-y-3">
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>}
          {!isLoading && rules.map((rule) => (
            <div key={rule.id} className={cn("rounded-xl border p-3 bg-card space-y-2", !rule.isActive && "opacity-60 bg-muted/30")}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rulePreview(rule, rewardTypes)}</p>
                </div>
                <span className={cn("text-xs font-bold px-2 py-1 rounded-full", rule.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {rule.isActive ? "مفعّلة" : "متوقفة"}
                </span>
              </div>
              <div className="flex gap-2">
                <button data-testid={`button-toggle-rule-${rule.id}`} onClick={() => toggleRule(rule.id, rule.isActive)} disabled={updateRule.isPending} className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted">
                  {rule.isActive ? "إيقاف" : "تفعيل"}
                </button>
                <button data-testid={`button-reprocess-rule-${rule.id}`} onClick={() => setReprocessRuleId(rule.id)} disabled={reprocessRule.isPending} className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted flex items-center gap-1">
                  {reprocessRule.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} إعادة المعالجة
                </button>
              </div>
            </div>
          ))}
          {!isLoading && !rules.length && !adding && <p className="text-sm text-center text-muted-foreground py-4">لا توجد قواعد تلقائية بعد.</p>}

          {adding ? (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
              <input data-testid="input-rule-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="اسم القاعدة، مثل: إنهاء الواجب" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <select data-testid="select-rule-source" value={form.sourceType} onChange={(event) => changeSource(event.target.value as RewardRuleSourceType)} className="rounded-lg border border-border bg-background px-2 py-2 text-xs">
                  <option value="assignment_submission">الواجبات</option>
                  <option value="kids_activity_completion">نشاط الأطفال</option>
                  <option value="game_history">لعبة وميض</option>
                </select>
                <select data-testid="select-rule-condition" value={form.conditionType} disabled={form.sourceType === "kids_activity_completion"} onChange={(event) => setForm({ ...form, conditionType: event.target.value as RewardRuleInput["conditionType"] })} className="rounded-lg border border-border bg-background px-2 py-2 text-xs disabled:opacity-50">
                  <option value="completion">الإكمال</option>
                  <option value="score_at_least">حدّ الدرجة</option>
                </select>
              </div>
              {form.conditionType === "score_at_least" && <input data-testid="input-rule-threshold" type="number" min="1" max="1000" value={form.threshold || ""} onChange={(event) => setForm({ ...form, threshold: Number(event.target.value) })} placeholder="الحد الأدنى للدرجة" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />}
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <select data-testid="select-rule-reward-type" value={form.rewardTypeId} onChange={(event) => setForm({ ...form, rewardTypeId: event.target.value })} className="rounded-lg border border-border bg-background px-2 py-2 text-xs">
                  <option value="">اختر التحفيز</option>
                  {activeTypes.map((type) => <option key={type.id} value={type.id}>{type.name} (+{formatRewardPoints(type.points)})</option>)}
                </select>
                <input data-testid="input-rule-amount" type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: Math.max(1, Number(event.target.value) || 1) })} className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-center" />
              </div>
              <p data-testid="text-rule-preview" className="rounded-lg bg-background/70 p-2 text-xs text-foreground/80 leading-5">{rulePreview(form, rewardTypes)}</p>
              <div className="flex justify-end gap-2">
                <button data-testid="button-cancel-rule" onClick={() => setAdding(false)} className="px-3 py-2 text-xs font-bold text-muted-foreground">إلغاء</button>
                <button data-testid="button-save-rule" onClick={save} disabled={createRule.isPending || !activeTypes.length} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                  {createRule.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} حفظ القاعدة
                </button>
              </div>
            </div>
          ) : (
            <button data-testid="button-add-rule" onClick={() => setAdding(true)} className="w-full rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center gap-2">
              <Plus size={16} /> إضافة قاعدة تلقائية
            </button>
          )}
          {!activeTypes.length && adding && <p className="text-xs text-destructive">فعّل نوع تحفيز واحدًا على الأقل أولًا.</p>}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={reprocessRuleId !== null} onOpenChange={(next) => !next && !reprocessRule.isPending && setReprocessRuleId(null)}>
      <AlertDialogContent dir="rtl" className="rounded-2xl border-emerald-100">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle className="text-emerald-950">إعادة فحص الإنجازات السابقة؟</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            ستراجع حصاد المصادر السابقة المطابقة لهذه القاعدة، مع الحفاظ على الحماية من تكرار منح النقاط.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={reprocessRule.isPending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmReprocess(); }} disabled={reprocessRule.isPending} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
            {reprocessRule.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            تأكيد إعادة الفحص
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}