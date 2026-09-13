import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetRewardLedger, useGetRewardSummary, useReverseReward } from "./api";
import { Loader2, RotateCcw, Clock, Users, Filter, AlertTriangle, ArrowRight } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { getArabicRewardError } from "./error-message";
import { cn } from "@/lib/utils";
import { formatRewardPoints } from "./format";
import { useI18n } from "@/lib/i18n";
import { rewardText } from "./reward-i18n";

export function RewardLedgerDialog({ open, onOpenChange, className }: { open: boolean, onOpenChange: (v: boolean) => void, className: string }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const [tab, setTab] = useState<"ledger" | "summary">("ledger");
  const [period, setPeriod] = useState<"today" | "week" | "all">("today");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[85vh] sm:h-[80vh] flex flex-col p-0 bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader className="p-4 border-b border-border/50 shrink-0">
          <button type="button" onClick={() => onOpenChange(false)} className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
            <ArrowRight size={15} /> {r("رجوع", "Back")}
          </button>
          <DialogTitle className="text-lg font-bold flex items-center justify-between">
            <span>{r("سجل التحفيز والملخص", "Rewards ledger and summary")}</span>
            <div className="flex bg-muted rounded-lg p-1">
              <button 
                onClick={() => setTab("ledger")}
                className={cn("px-3 py-1 text-xs font-bold rounded-md transition-colors", tab === "ledger" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {r("السجل", "Ledger")}
              </button>
              <button 
                onClick={() => setTab("summary")}
                className={cn("px-3 py-1 text-xs font-bold rounded-md transition-colors", tab === "summary" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {r("الملخص", "Summary")}
              </button>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <Filter size={14} className="text-muted-foreground" />
            <div className="flex gap-1">
              {(["today", "week", "all"] as const).map(p => (
                <button 
                  key={p} 
                  onClick={() => setPeriod(p)}
                  className={cn("px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors border", 
                    period === p ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p === "today" ? r("اليوم", "Today") : p === "week" ? r("هذا الأسبوع", "This week") : r("الكل", "All")}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "ledger" ? <LedgerView className={className} period={period} /> : <SummaryView className={className} period={period} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LedgerView({ className, period }: { className: string, period: string }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const { data: ledger, isLoading } = useGetRewardLedger(className, undefined, period);
  const reverseMutation = useReverseReward();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const reverseKeysRef = useRef<Record<string, string>>({});

  const getReverseKey = (id: string) => {
    if (!reverseKeysRef.current[id]) {
      reverseKeysRef.current[id] = crypto.randomUUID();
    }
    return reverseKeysRef.current[id];
  };

  const handleReverse = (id: string) => {
    setReversingId(id);
    reverseMutation.mutate({ id, idempotencyKey: getReverseKey(id) }, {
      onSuccess: () => {
        delete reverseKeysRef.current[id];
        setReversingId(null);
      },
      onError: (err) => {
        setReversingId(null);
        toast.error(getArabicRewardError(err, r("تعذر التراجع عن حركة التحفيز", "Could not reverse this reward entry.")));
      }
    });
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!ledger || ledger.length === 0) return <EmptyState text={r("لا يوجد حركات تحفيز في هذه الفترة", "No reward activity in this period.")} />;
  const sourceLabel = (sourceType?: string) => {
    if (sourceType === "assignment_submission") return r("تسليم واجب", "Assignment submission");
    if (sourceType === "kids_activity_completion") return r("إكمال نشاط أطفال", "Kids activity completion");
    if (sourceType === "game_history") return r("لعبة وميض", "Wameeth game");
    return sourceType || "";
  };
  const formatEvidenceSummary = (sourceType: string | undefined, evidence: unknown): string => {
    if (typeof evidence === "string") return evidence;
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return "";
    const value = evidence as Record<string, unknown>;
    const text = (...keys: string[]) => {
      const found = keys.map((key) => value[key]).find((item) => item !== undefined && item !== null && item !== "");
      return found === undefined ? "" : String(found);
    };
    if (sourceType === "assignment_submission") {
      const effective = text("effectivePoints", "earnedPoints", "points");
      const total = text("totalPoints", "maxPoints");
      return effective || total ? r(`نقاط الواجب: ${effective || "0"}${total ? ` / ${total}` : ""}`, `Assignment points: ${effective || "0"}${total ? ` / ${total}` : ""}`) : r("تم توثيق نتيجة الواجب", "Assignment result recorded");
    }
    if (sourceType === "game_history") {
      const parts = [
        text("score", "points") && r(`النتيجة: ${text("score", "points")}`, `Score: ${text("score", "points")}`),
        text("rank", "position") && r(`الترتيب: ${text("rank", "position")}`, `Rank: ${text("rank", "position")}`),
        text("correct", "correctCount") && r(`الصحيح: ${text("correct", "correctCount")}`, `Correct: ${text("correct", "correctCount")}`),
      ].filter(Boolean);
      return parts.join(" • ") || r("تم توثيق نتيجة اللعبة", "Game result recorded");
    }
    if (sourceType === "kids_activity_completion") {
      const activity = text("activity", "activityName", "title", "name");
      const score = text("score", "points");
      return [activity && r(`النشاط: ${activity}`, `Activity: ${activity}`), score && r(`النتيجة: ${score}`, `Score: ${score}`)].filter(Boolean).join(" • ") || r("تم توثيق إكمال النشاط", "Activity completion recorded");
    }
    return r("تم توثيق نتيجة المصدر", "Source result recorded");
  };

  return (
    <div className="space-y-3">
      {ledger.map((item: any) => {
        const date = new Date(item.createdAt);
        const dateLabel = isToday(date) ? r("اليوم", "Today") : isYesterday(date) ? r("أمس", "Yesterday") : format(date, "d MMM", { locale: lang === "ar" ? ar : undefined });
        const timeLabel = format(date, "h:mm a", { locale: lang === "ar" ? ar : undefined });
        const evidenceText = formatEvidenceSummary(item.sourceType, item.evidenceSummary);
        
        return (
          <div key={item.id} className={cn("p-3 rounded-xl border flex items-center gap-3 transition-colors", item.isReversed ? "bg-slate-50 border-dashed border-slate-300" : "bg-card border-border shadow-sm")}>
            <div className="w-10 text-center shrink-0">
              <span className={cn("text-sm font-black block", item.isReversed ? "text-slate-500 line-through" : item.points > 0 ? "text-primary" : "text-destructive")}>
                {item.points > 0 ? "+" : ""}{formatRewardPoints(item.points)}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{item.studentName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="font-medium text-foreground/80">{item.reason}</span>
                <span>•</span>
                <Clock size={10} />
                <span>{dateLabel} {timeLabel}</span>
              </div>
                {(item.sourceType || item.ruleName || evidenceText || item.sourceId) && (
                  <div data-testid={`text-ledger-evidence-${item.id}`} className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    {item.sourceType && <span className="rounded bg-muted px-1.5 py-0.5 font-bold">{sourceLabel(item.sourceType)}</span>}
                    {item.ruleName && <span>{r("قاعدة", "Rule")}: {item.ruleName}</span>}
                    {evidenceText && <span>• {evidenceText}</span>}
                    {item.sourceId && <span className="font-mono opacity-70">#{item.sourceId}</span>}
                  </div>
                )}
            </div>

            {!item.isReversed && (
              <button 
                onClick={() => handleReverse(item.id)}
                disabled={reversingId === item.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                title={r("تراجع", "Reverse")}
              >
                {reversingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              </button>
            )}
            {item.isReversed && (
              <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-600">{r("ملغاة ولا تدخل في الرصيد", "Reversed and excluded from balance")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryView({ className, period }: { className: string, period: string }) {
  const { lang } = useI18n();
  const r = (arabic: string, english: string) => rewardText(lang, arabic, english);
  const { data: summary, isLoading } = useGetRewardSummary(className, period);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!summary || summary.studentSummaries.length === 0) return <EmptyState text={r("لا يوجد بيانات ملخص لهذه الفترة", "No summary data for this period.")} />;

  const students = [...summary.studentSummaries].sort((a: any, b: any) => 
    (a.studentName || "").localeCompare(b.studentName || "")
  );
  const types = [...(summary.typeSummaries || [])].sort((a: any, b: any) => b.count - a.count);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-primary">
          <Users size={16} /> {r("ملخص الطلاب", "Student summary")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {students.map((s: any) => (
            <div key={s.studentId} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex-1 font-semibold text-sm truncate">{s.studentName}</div>
              <div className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">{formatRewardPoints(s.points)}</div>
            </div>
          ))}
        </div>
      </section>

      {types.length > 0 && (
        <section>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-primary">
            {r("توزيع التحفيز", "Reward distribution")}
          </h3>
          <div className="space-y-2">
            {types.map((t: any) => (
              <div key={t.typeId} className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card">
                <span className="font-semibold text-sm">{t.typeName}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{t.count} {r("مرة", "times")}</span>
                  <span className="font-bold text-foreground px-2 py-0.5 rounded-md bg-muted">{formatRewardPoints(t.points)} {r("نقطة", "points")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-60">
      <AlertTriangle size={32} className="mb-3" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}