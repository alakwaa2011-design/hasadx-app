import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

export type QuranVerseRef = { surah: number; ayah: number };
export type QuranPersonalPlan = { start: QuranVerseRef; end: QuranVerseRef; dailyGoal: number };
export type QuranReviewItem = { surah: number; ayah: number; dueDate: string; intervalDays: number };

export function QuranPersonalPlanPanel({
  open,
  onClose,
  lang,
  chapters,
  current,
  plan,
  due,
  next,
  completedToday,
  storageError,
  hasSession,
  onSavePlan,
  onStart,
  onResume,
  onDeletePlan,
}: {
  open: boolean;
  onClose: () => void;
  lang: "ar" | "en";
  chapters: Array<{ id: number; name: string; verse_count: number }>;
  current: QuranVerseRef;
  plan: QuranPersonalPlan | null;
  due: QuranReviewItem[];
  next: QuranVerseRef | null;
  completedToday: number;
  storageError: boolean;
  hasSession: boolean;
  onSavePlan: (plan: QuranPersonalPlan) => boolean;
  onStart: (verse: QuranVerseRef) => void;
  onResume: () => void;
  onDeletePlan: () => boolean;
}) {
  const ar = lang === "ar";
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [editing, setEditing] = useState(!plan);
  const [start, setStart] = useState<QuranVerseRef>(plan?.start ?? current);
  const [end, setEnd] = useState<QuranVerseRef>(plan?.end ?? current);
  const [goal, setGoal] = useState(plan?.dailyGoal ?? 3);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const chapterFor = (id: number) => chapters.find((chapter) => chapter.id === id);
  const verseLabel = (ref: QuranVerseRef) => {
    const chapter = chapterFor(ref.surah);
    return ar
      ? `سورة ${chapter?.name ?? ref.surah} · الآية ${ref.ayah}`
      : `${chapter?.name ?? `Surah ${ref.surah}`} · Ayah ${ref.ayah}`;
  };
  const inputClass =
    "h-11 w-full min-w-0 rounded-xl border border-emerald-900/15 bg-[#fffdf8] px-3 text-sm font-bold text-[#173a28] outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:border-white/15 dark:bg-[#10251d] dark:text-emerald-50 dark:focus:border-emerald-300";
  const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#10251d]";

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStart(plan?.start ?? current);
      setEnd(plan?.end ?? current);
      setGoal(plan?.dailyGoal ?? 3);
      setEditing(!plan);
      setError("");
      setConfirmDelete(false);
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => closeRef.current?.focus());
    }
    if (!open && wasOpenRef.current) previousFocusRef.current?.focus();
    wasOpenRef.current = open;
  }, [open, plan, current]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const updateSurah = (ref: QuranVerseRef, surah: number, setter: (value: QuranVerseRef) => void) => {
    setter({ surah, ayah: Math.min(ref.ayah, chapterFor(surah)?.verse_count ?? 1) });
    setError("");
  };

  const save = () => {
    const validRef = (ref: QuranVerseRef) =>
      Number.isInteger(ref.surah) &&
      Number.isInteger(ref.ayah) &&
      !!chapterFor(ref.surah) &&
      ref.ayah >= 1 &&
      ref.ayah <= (chapterFor(ref.surah)?.verse_count ?? 0);
    if (!validRef(start) || !validRef(end)) {
      setError(ar ? "اختر سورة وآية صحيحتين لبداية الخطة ونهايتها." : "Choose valid surahs and ayahs for both ends of the plan.");
      return;
    }
    if (start.surah > end.surah || (start.surah === end.surah && start.ayah > end.ayah)) {
      setError(ar ? "يجب أن تكون آية النهاية بعد آية البداية أو مساوية لها." : "The end ayah must be the same as or after the start ayah.");
      return;
    }
    if (!Number.isInteger(goal) || goal < 1 || goal > 20) {
      setError(ar ? "حدد هدفًا يوميًا بين آية واحدة و٢٠ آية." : "Set a daily goal between 1 and 20 ayahs.");
      return;
    }
    try {
      if (!onSavePlan({ start, end, dailyGoal: goal })) {
        setError(ar ? "تعذر حفظ الخطة. حاول مرة أخرى." : "The plan could not be saved. Please try again.");
        return;
      }
      setError("");
      setEditing(false);
    } catch {
      setError(ar ? "تعذر حفظ الخطة. حاول مرة أخرى." : "The plan could not be saved. Please try again.");
    }
  };

  const dateLabel = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(ar ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" dir={ar ? "rtl" : "ltr"}>
      <button
        type="button"
        data-testid="button-dismiss-personal-plan"
        tabIndex={-1}
        className="absolute inset-0 bg-[#071c13]/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label={ar ? "إغلاق الخطة الشخصية" : "Close personal plan"}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="quran-personal-plan-panel"
        className="relative flex max-h-[min(90dvh,780px)] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-emerald-900/10 bg-[#fffdf8] shadow-[0_24px_80px_rgba(11,75,53,0.24)] dark:border-emerald-300/10 dark:bg-[#10251d] sm:max-w-[470px] sm:rounded-[1.75rem]"
      >
        <div className="shrink-0 border-b border-emerald-900/10 bg-[#f5f6ed] px-5 pb-4 pt-5 dark:border-white/10 dark:bg-[#162e22] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black tracking-wide text-amber-700 dark:text-amber-400">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>{ar ? "رحلتك مع القرآن" : "YOUR QURAN JOURNEY"}</span>
              </div>
              <h2 id={titleId} className="mt-1 text-xl font-black text-[#0B4B35] dark:text-emerald-100">
                {ar ? "خطة الحفظ الشخصية" : "Personal memorization plan"}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              data-testid="button-close-personal-plan"
              onClick={onClose}
              aria-label={ar ? "إغلاق الخطة الشخصية" : "Close personal plan"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-emerald-900 hover:bg-emerald-900/10 dark:text-emerald-100 dark:hover:bg-white/10 ${focusClass}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p id={descriptionId} className="mt-2 text-xs leading-5 text-emerald-900/65 dark:text-emerald-100/65">
            {ar
              ? "مساحتك الخاصة للحفظ والمراجعة، محفوظة على هذا الجهاز فقط. لا تغيّر الأوراد المكلّفة أو التقدّم المعتمد."
              : "Your own space to memorize and review, saved on this device only. It does not change assigned wards or verified progress."}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          {storageError && (
            <p role="alert" data-testid="error-personal-plan-storage" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {ar ? "تعذر قراءة الخطة المحفوظة أو حفظ التغييرات على هذا الجهاز. تحقق من مساحة التخزين وإعدادات المتصفح قبل المتابعة." : "Saved plan could not be read or changes could not be stored on this device. Check browser storage before continuing."}
            </p>
          )}
          {editing ? (
            <form
              data-testid="form-personal-plan"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#0B4B35] dark:text-emerald-100">
                  {plan ? (ar ? "تعديل نطاق الحفظ" : "Edit your range") : (ar ? "ابدأ بخطة تناسبك" : "Set your own pace")}
                </h3>
                <span className="rounded-full bg-emerald-900/5 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-white/10 dark:text-emerald-200">
                  {ar ? "دون تسجيل دخول" : "No sign-in needed"}
                </span>
              </div>
              {([
                { label: ar ? "من الآية" : "Start at", value: start, setter: setStart, key: "start" },
                { label: ar ? "إلى الآية" : "End at", value: end, setter: setEnd, key: "end" },
              ] as const).map(({ label, value, setter, key }) => (
                <fieldset key={key} className="rounded-2xl border border-emerald-900/10 bg-emerald-50/60 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                  <legend className="px-1 text-xs font-black text-[#0B4B35] dark:text-emerald-100">{label}</legend>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
                    <label className="min-w-0 text-[11px] font-bold text-emerald-900/70 dark:text-emerald-100/70">
                      {ar ? "السورة" : "Surah"}
                      <select
                        data-testid={`select-personal-plan-${key}-surah`}
                        value={value.surah}
                        onChange={(event) => updateSurah(value, Number(event.target.value), setter)}
                        className={`mt-1 block ${inputClass}`}
                      >
                        {chapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>{chapter.id}. {chapter.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 text-[11px] font-bold text-emerald-900/70 dark:text-emerald-100/70">
                      {ar ? "الآية" : "Ayah"}
                      <select
                        data-testid={`select-personal-plan-${key}-ayah`}
                        value={value.ayah}
                        onChange={(event) => { setter({ ...value, ayah: Number(event.target.value) }); setError(""); }}
                        className={`mt-1 block ${inputClass}`}
                      >
                        {Array.from({ length: chapterFor(value.surah)?.verse_count ?? 0 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>{index + 1}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
              ))}
              <label className="block text-xs font-black text-[#0B4B35] dark:text-emerald-100">
                {ar ? "الهدف اليومي" : "Daily goal"}
                <span className="mt-1 block text-[11px] font-normal text-emerald-900/65 dark:text-emerald-100/65">
                  {ar ? "من ١ إلى ٢٠ آية في اليوم" : "1 to 20 ayahs per day"}
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    data-testid="input-personal-plan-daily-goal"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    inputMode="numeric"
                    value={goal}
                    onChange={(event) => { setGoal(event.target.value === "" ? 0 : Number(event.target.value)); setError(""); }}
                    className={`max-w-28 ${inputClass}`}
                    dir="ltr"
                  />
                  <span className="text-xs font-medium text-emerald-900/70 dark:text-emerald-100/70">
                    {ar ? "آيات يوميًا" : "ayahs each day"}
                  </span>
                </div>
              </label>
              {error && <p id={errorId} role="alert" data-testid="error-personal-plan-save" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" data-testid="button-save-personal-plan" aria-describedby={error ? errorId : undefined} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B4B35] px-4 text-sm font-black text-[#fffdf8] hover:bg-[#083d2c] ${focusClass}`}>
                  <Check className="h-4 w-4" aria-hidden="true" />{ar ? "حفظ الخطة" : "Save plan"}
                </button>
                {plan && <button type="button" data-testid="button-cancel-personal-plan-edit" onClick={() => { setEditing(false); setError(""); }} className={`min-h-11 rounded-xl border border-emerald-900/15 px-4 text-xs font-bold text-[#0B4B35] hover:bg-emerald-50 dark:border-white/15 dark:text-emerald-100 dark:hover:bg-white/5 ${focusClass}`}>{ar ? "إلغاء" : "Cancel"}</button>}
              </div>
            </form>
          ) : plan ? (
            <>
              <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/60 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black text-amber-700 dark:text-amber-400">{ar ? "مسارك الحالي" : "YOUR RANGE"}</p>
                  <button type="button" data-testid="button-edit-personal-plan" onClick={() => { setStart(plan.start); setEnd(plan.end); setGoal(plan.dailyGoal); setEditing(true); setConfirmDelete(false); }} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#0B4B35] hover:bg-emerald-900/10 dark:text-emerald-100 dark:hover:bg-white/10 ${focusClass}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{ar ? "تعديل" : "Edit"}</button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-black text-[#0B4B35] dark:text-emerald-100">
                  <span data-testid="text-personal-plan-start">{verseLabel(plan.start)}</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-amber-600 ${ar ? "rotate-180" : ""}`} aria-hidden="true" />
                  <span data-testid="text-personal-plan-end">{verseLabel(plan.end)}</span>
                </div>
                <div className="mt-4 border-t border-emerald-900/10 pt-3 dark:border-white/10">
                  <div className="flex justify-between text-xs font-bold text-emerald-900/70 dark:text-emerald-100/70">
                    <span>{ar ? "إنجاز اليوم" : "Today's progress"}</span>
                    <span data-testid="text-personal-plan-progress" dir="ltr">{completedToday} / {plan.dailyGoal}</span>
                  </div>
                  {completedToday >= plan.dailyGoal && next && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-900/70 dark:text-emerald-100/70">
                      {ar ? "حققت هدف اليوم. يمكنك متابعة الحفظ متى شئت." : "Today's goal reached. You can keep memorizing if you like."}
                    </p>
                  )}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-900/10 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={plan.dailyGoal} aria-valuenow={Math.min(Math.max(0, completedToday), plan.dailyGoal)} aria-label={ar ? "إنجاز الهدف اليومي" : "Daily goal progress"}>
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, completedToday / plan.dailyGoal * 100))}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black text-[#0B4B35] dark:text-emerald-100">{ar ? "تابع رحلتك" : "Continue your journey"}</p>
                {hasSession && (
                  <button type="button" data-testid="button-resume-personal-session" onClick={onResume} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-900 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30 ${focusClass}`}>
                    <span className="flex items-center gap-2"><RotateCcw className="h-4 w-4" aria-hidden="true" />{ar ? "استئناف جلسة الحفظ" : "Resume your session"}</span>
                    <ArrowRight className={`h-4 w-4 ${ar ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                )}
                {next ? (
                  <button type="button" data-testid="button-start-next-personal-ayah" onClick={() => onStart(next)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-[#0B4B35] px-4 text-[#fffdf8] hover:bg-[#083d2c] ${focusClass}`}>
                    <span className="flex min-w-0 items-center gap-2.5 text-start">
                      <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
                      <span><span className="block text-sm font-black">{ar ? "احفظ الآية التالية" : "Memorize next ayah"}</span><span className="block text-[11px] opacity-75">{verseLabel(next)}</span></span>
                    </span>
                    <ArrowRight className={`h-4 w-4 shrink-0 ${ar ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                ) : <p data-testid="text-personal-plan-complete" className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 dark:bg-white/5 dark:text-emerald-100">{ar ? "أتممت نطاق الحفظ المحدد. يمكنك تعديل خطتك لمتابعة الحفظ." : "You have reached the end of this range. Edit your plan to continue."}</p>}
              </div>

              <div className="border-t border-emerald-900/10 pt-4 dark:border-white/10">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0B4B35] dark:text-emerald-100">{ar ? "المراجعة المستحقة" : "Due for review"}</h3>
                  <span data-testid="text-personal-plan-due-count" className="text-xs font-bold text-emerald-900/60 dark:text-emerald-100/60">{due.length}</span>
                </div>
                {due.length ? (
                  <ul data-testid="list-personal-plan-due" className="mt-3 space-y-2">
                    {due.map((item, index) => (
                      <li key={`${item.surah}-${item.ayah}-${item.dueDate}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-900/10 bg-[#fbfaf6] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.035]">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#0B4B35] dark:text-emerald-100">{verseLabel(item)}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-900/60 dark:text-emerald-100/60"><CalendarDays className="h-3 w-3" aria-hidden="true" />{dateLabel(item.dueDate)} <span aria-hidden="true">·</span> {ar ? `فاصل ${item.intervalDays} يوم` : `${item.intervalDays}-day interval`}</p>
                        </div>
                        <button type="button" data-testid={`button-review-personal-ayah-${item.surah}-${item.ayah}-${index}`} onClick={() => onStart({ surah: item.surah, ayah: item.ayah })} aria-label={ar ? `مراجعة ${verseLabel(item)}` : `Review ${verseLabel(item)}`} className={`shrink-0 rounded-lg bg-emerald-900/5 px-3 py-2 text-xs font-black text-[#0B4B35] hover:bg-emerald-900/10 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/15 ${focusClass}`}>{ar ? "راجع" : "Review"}</button>
                      </li>
                    ))}
                  </ul>
                ) : <p data-testid="text-personal-plan-no-due" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-900/70 dark:bg-white/5 dark:text-emerald-100/70">{ar ? "لا توجد آيات للمراجعة الآن. عد حين يحين موعدها." : "Nothing due right now. Return when it is time to review."}</p>}
              </div>

              <div className="border-t border-emerald-900/10 pt-4 dark:border-white/10">
                {confirmDelete ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30">
                    <p className="text-xs font-bold text-rose-900 dark:text-rose-200">{ar ? "حذف خطتك الشخصية؟ لن يؤثر ذلك على الأوراد المكلّفة أو التقدّم المعتمد." : "Delete your personal plan? Assigned wards and verified progress will not be affected."}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" data-testid="button-confirm-delete-personal-plan" onClick={() => {
                        if (onDeletePlan()) {
                          setConfirmDelete(false);
                          setEditing(true);
                        } else {
                          setError(ar ? "تعذر حذف الخطة. حاول مرة أخرى." : "Could not delete the plan. Please try again.");
                        }
                      }} className={`min-h-10 rounded-lg bg-rose-700 px-3 text-xs font-black text-[#fffdf8] hover:bg-rose-800 ${focusClass}`}>{ar ? "نعم، احذف الخطة" : "Yes, delete plan"}</button>
                      <button type="button" data-testid="button-cancel-delete-personal-plan" onClick={() => setConfirmDelete(false)} className={`min-h-10 rounded-lg px-3 text-xs font-bold text-rose-900 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-white/5 ${focusClass}`}>{ar ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                ) : <button type="button" data-testid="button-delete-personal-plan" onClick={() => setConfirmDelete(true)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30 ${focusClass}`}><Trash2 className="h-4 w-4" aria-hidden="true" />{ar ? "حذف الخطة الشخصية" : "Delete personal plan"}</button>}
              </div>
            </>
          ) : null}
          {!plan && due.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-200">{ar ? "مراجعاتك المستحقة" : "Your due reviews"} ({due.length})</h3>
              <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-200/70">{ar ? "تبقى مراجعاتك محفوظة حتى دون خطة نشطة." : "Your reviews remain saved without an active plan."}</p>
              <div className="mt-3 space-y-2">
                {due.map((item) => (
                  <button key={`${item.surah}:${item.ayah}`} type="button" data-testid={`button-review-personal-ayah-${item.surah}-${item.ayah}`} onClick={() => onStart(item)} className={`flex min-h-11 w-full items-center justify-between rounded-xl bg-white px-3 text-xs font-bold text-amber-950 dark:bg-amber-900/30 dark:text-amber-100 ${focusClass}`}>
                    <span>{verseLabel(item)}</span><Play className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {!plan && hasSession && (
            <button type="button" data-testid="button-resume-personal-session" onClick={onResume} className={`min-h-11 w-full rounded-xl bg-[#0B4B35] px-3 text-sm font-bold text-white ${focusClass}`}>
              {ar ? "استئناف جلسة الحفظ" : "Resume memorization session"}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}