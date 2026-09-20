import type { Ref } from "react";
import {
  BookOpenCheck,
  ChevronRight,
  CheckCircle2,
  EyeOff,
  Headphones,
  Mic2,
  Link2,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type GuidedMemorizationStage = 0 | 1 | 2 | 3 | 4 | 5;

interface QuranGuidedMemorizationPanelProps {
  panelRef?: Ref<HTMLElement>;
  open: boolean;
  stage: GuidedMemorizationStage;
  surahName: string;
  ayahNumber: number;
  isPlaying: boolean;
  repeatScope: "ayah" | "range";
  repeatCount: number | "continuous";
  rangeStart: number;
  rangeEnd: number;
  recitationRevealed: boolean;
  onClose: () => void;
  onStageChange: (stage: GuidedMemorizationStage) => void;
  onRepeatScopeChange: (scope: "ayah" | "range") => void;
  onRepeatCountChange: (count: number | "continuous") => void;
  onReplay: () => void;
  onRevealRecitation: () => void;
  onAssess: (result: "mastered" | "review") => void;
  isAssessing?: boolean;
  lang: "ar" | "en";
}

const STAGES = [
  { icon: Headphones, ar: "استمع", en: "Listen" },
  { icon: BookOpenCheck, ar: "اقرأ", en: "Read" },
  { icon: EyeOff, ar: "إخفاء جزئي", en: "Partial hide" },
  { icon: Mic2, ar: "سمّع", en: "Recite" },
  { icon: Link2, ar: "اربط", en: "Link" },
  { icon: CheckCircle2, ar: "قيّم", en: "Assess" },
] as const;

export function QuranGuidedMemorizationPanel({
  panelRef,
  open,
  stage,
  surahName,
  ayahNumber,
  isPlaying,
  repeatScope,
  repeatCount,
  rangeStart,
  rangeEnd,
  recitationRevealed,
  onClose,
  onStageChange,
  onRepeatScopeChange,
  onRepeatCountChange,
  onReplay,
  onRevealRecitation,
  onAssess,
  isAssessing,
  lang,
}: QuranGuidedMemorizationPanelProps) {
  if (!open) return null;
  const ar = lang === "ar";
  const ActiveIcon = STAGES[stage].icon;

  return (
    <aside
      ref={panelRef}
      data-testid="quran-guided-memorization-panel"
      className="fixed inset-x-3 bottom-[calc(0.75rem+var(--quran-safe-area-bottom,env(safe-area-inset-bottom,0px)))] z-[70] mx-auto max-h-[min(52dvh,31rem)] w-auto max-w-md overflow-y-auto rounded-[1.75rem] border border-emerald-900/10 bg-[#fffdf8]/95 p-4 shadow-[0_24px_80px_rgba(11,75,53,0.24)] backdrop-blur-xl dark:border-emerald-300/10 dark:bg-[#10251d]/95 sm:inset-x-auto sm:bottom-[calc(1.25rem+var(--quran-safe-area-bottom,env(safe-area-inset-bottom,0px)))] sm:end-5 sm:w-[390px] sm:p-5"
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "جلسة الحفظ التدريجي" : "Guided memorization session"}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">
            {ar ? "الحفظ التدريجي" : "Guided memorization"}
          </p>
          <h2 className="mt-1 text-base font-black text-[#0B4B35] dark:text-emerald-100">
            {ar ? `سورة ${surahName} · الآية ${ayahNumber}` : `${surahName} · Ayah ${ayahNumber}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          aria-label={ar ? "إغلاق جلسة الحفظ" : "Close memorization session"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1" aria-label={ar ? "مراحل الجلسة" : "Session stages"}>
        {STAGES.map((item, index) => {
          const Icon = item.icon;
          const active = index === stage;
          const complete = index < stage;
          return (
            <div key={item.en} className="min-w-0 text-center">
              <div
                className={cn(
                  "mx-auto grid h-8 w-8 place-items-center rounded-full border transition-colors",
                  active && "border-[#0B4B35] bg-[#0B4B35] text-white",
                  complete && "border-emerald-200 bg-emerald-100 text-emerald-800",
                  !active && !complete && "border-border/70 bg-white/70 text-muted-foreground dark:bg-white/5",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn("mt-1 block truncate text-[9px] font-bold", active ? "text-[#0B4B35] dark:text-emerald-200" : "text-muted-foreground")}>
                {ar ? item.ar : item.en}
              </span>
            </div>
          );
        })}
      </div>

      <div className="my-4 h-px bg-emerald-900/10 dark:bg-white/10" />

      <div className="rounded-2xl bg-emerald-50/70 p-4 text-center dark:bg-emerald-950/40">
        <ActiveIcon className="mx-auto h-7 w-7 text-[#0B4B35] dark:text-emerald-300" />
        <h3 className="mt-2 text-sm font-black text-[#0B4B35] dark:text-emerald-100">
          {stage === 0 && (ar
            ? `استمع ${repeatCount === "continuous" ? "بتكرار مستمر" : `${repeatCount} مرات`}`
            : `Listen ${repeatCount === "continuous" ? "continuously" : `${repeatCount} times`}`)}
          {stage === 1 && (ar ? "اقرأ الآية بصوت واضح" : "Read the ayah aloud")}
          {stage === 2 && (ar ? "أكمل الكلمات المخفية" : "Complete the hidden words")}
          {stage === 3 && (ar ? "سمّع الآية دون النظر" : "Recite without looking")}
          {stage === 4 && (ar ? "اربط الآيات معًا" : "Link the ayahs together")}
          {stage === 5 && (ar ? "كيف كان تسميعك؟" : "How was your recitation?")}
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
          {stage === 0 && (ar ? "ستتكرر التلاوة تلقائيًا، وركز على مخارج الكلمات وترتيبها." : "The recitation repeats automatically. Focus on pronunciation and order.")}
          {stage === 1 && (ar ? "اقرأ معها من المصحف مرة أو مرتين حتى يثبت إيقاع الآية." : "Read along once or twice until the rhythm feels familiar.")}
          {stage === 2 && (ar ? "اضغط على أي كلمة مخفية إذا احتجت تلميحًا." : "Tap a hidden word whenever you need a hint.")}
          {stage === 3 && (ar ? "بعد التسميع اكشف الآية وقارن ما قرأته بالنص." : "After reciting, reveal the ayah and compare it with the text.")}
          {stage === 4 && (ar ? "اقرأ نهاية كل آية مع بداية التي تليها، ثم أعد النطاق كاملًا دون توقف." : "Join each ayah ending to the next beginning, then repeat the full range.")}
          {stage === 5 && (ar ? "اختر تقييمًا صادقًا لنحدد الخطوة التالية." : "Choose an honest assessment to set the next step.")}
        </p>
      </div>

      <div className="mt-4">
        {stage === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/[0.035] p-1 dark:bg-white/[0.06]">
              <button type="button" onClick={() => onRepeatScopeChange("ayah")} className={cn("min-h-10 rounded-lg px-2 text-xs font-black", repeatScope === "ayah" ? "bg-white text-[#0B4B35] shadow-sm dark:bg-emerald-900/60 dark:text-emerald-100" : "text-muted-foreground")}>
                {ar ? "تكرار الآية" : "Repeat ayah"}
              </button>
              <button type="button" disabled={rangeStart === rangeEnd} onClick={() => onRepeatScopeChange("range")} className={cn("min-h-10 rounded-lg px-2 text-xs font-black disabled:opacity-40", repeatScope === "range" ? "bg-white text-[#0B4B35] shadow-sm dark:bg-emerald-900/60 dark:text-emerald-100" : "text-muted-foreground")}>
                {ar ? `تكرار النطاق ${rangeStart}–${rangeEnd}` : `Repeat range ${rangeStart}–${rangeEnd}`}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-muted-foreground">{ar ? "عدد التكرار" : "Repeat count"}</span>
              <div className="flex items-center rounded-xl bg-black/[0.035] p-1 dark:bg-white/[0.06]" dir="ltr">
                {[1, 3, 5, 10, "continuous" as const].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onRepeatCountChange(count)}
                    className={cn(
                      "min-h-8 min-w-8 rounded-lg px-2 text-[11px] font-black",
                      repeatCount === count
                        ? "bg-white text-[#0B4B35] shadow-sm dark:bg-emerald-900/60 dark:text-emerald-100"
                        : "text-muted-foreground",
                    )}
                  >
                    {count === "continuous" ? "∞" : count}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onReplay} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-3 text-xs font-black text-[#0B4B35] hover:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100">
                <RotateCcw className="h-4 w-4" />
                {ar ? (isPlaying ? "ابدأ من جديد" : "إعادة التلاوة") : (isPlaying ? "Restart" : "Replay")}
              </button>
              <button type="button" onClick={() => onStageChange(1)} className="min-h-11 rounded-xl bg-[#0B4B35] px-4 text-xs font-black text-white shadow-sm hover:bg-[#083d2c]">
                {ar ? "استمعت جيدًا" : "I listened"}
              </button>
            </div>
          </div>
        )}
        {stage === 1 && (
          <button type="button" onClick={() => onStageChange(2)} className="min-h-11 w-full rounded-xl bg-[#0B4B35] px-4 text-sm font-black text-white shadow-sm hover:bg-[#083d2c]">
            {ar ? "انتقل إلى الإخفاء الجزئي" : "Start partial hiding"}
          </button>
        )}
        {stage === 2 && (
          <button type="button" onClick={() => onStageChange(3)} className="min-h-11 w-full rounded-xl bg-[#0B4B35] px-4 text-sm font-black text-white shadow-sm hover:bg-[#083d2c]">
            {ar ? "جاهز للتسميع" : "Ready to recite"}
          </button>
        )}
        {stage === 3 && (
          <button type="button" onClick={recitationRevealed ? () => onStageChange(4) : onRevealRecitation} className="min-h-11 w-full rounded-xl bg-amber-500 px-4 text-sm font-black text-[#0B4B35] shadow-sm hover:bg-amber-400">
            {recitationRevealed ? (ar ? "انتقل إلى ربط الآيات" : "Link the ayahs") : (ar ? "اكشف الآية للمقارنة" : "Reveal and compare")}
          </button>
        )}
        {stage === 4 && (
          <button type="button" onClick={() => onStageChange(5)} className="min-h-11 w-full rounded-xl bg-[#0B4B35] px-4 text-sm font-black text-white shadow-sm hover:bg-[#083d2c]">
            {ar ? "أتممت ربط الآيات" : "I linked the ayahs"}
          </button>
        )}
        {stage === 5 && (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={isAssessing} type="button" onClick={() => onAssess("review")} className="min-h-12 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-200">
              {ar ? "أحتاج مراجعة" : "Needs review"}
            </button>
            <button disabled={isAssessing} type="button" onClick={() => onAssess("mastered")} className="min-h-12 rounded-xl bg-[#0B4B35] px-3 text-xs font-black text-white shadow-sm hover:bg-[#083d2c] disabled:opacity-50 flex items-center justify-center gap-2">
              {isAssessing && <RotateCcw className="w-3.5 h-3.5 animate-spin" />}
              {ar ? "أتقنتها" : "Mastered"}
            </button>
          </div>
        )}
        {stage > 0 && (
          <button type="button" onClick={() => onStageChange((stage - 1) as GuidedMemorizationStage)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-black text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10">
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            {ar ? "الرجوع إلى الخطوة السابقة" : "Back to previous step"}
          </button>
        )}
      </div>
    </aside>
  );
}