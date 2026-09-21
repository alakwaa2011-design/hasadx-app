import { Bookmark, ChevronLeft, ChevronRight, Hand, Layers3, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type TargetRect = Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height">;

export function QuranReaderTips({
  lang,
  onDismiss,
  onStepChange,
}: {
  lang: "ar" | "en";
  onDismiss: () => void;
  onStepChange?: (step: number) => void;
}) {
  const steps = useMemo(() => lang === "ar"
    ? [
        {
          icon: Sparkles,
          title: "خيارات الآية",
          body: "اضغط على رقم الآية لفتح التلاوة والتفسير والنسخ وإضافة علامة.",
          selector: '[data-quran-tour="ayah-action"]',
        },
        {
          icon: Layers3,
          title: "حفظني",
          body: "ابدأ رحلة مرتبة: استماع، قراءة، إخفاء، تسميع ثم تقييم.",
          selector: '[data-testid="button-memo-session"], [data-testid="button-mobile-memo-session"]',
        },
        {
          icon: Hand,
          title: "نطق الكلمة",
          body: "اضغط مطولًا على أي كلمة ثم ارفع إصبعك لسماع نطقها. يمكنك السحب بأمان للتنقل.",
          selector: '[data-quran-tour="word"]',
        },
        {
          icon: Bookmark,
          title: "علاماتك داخل المصحف",
          body: "احفظ موضعك وافتح كل العلامات من هنا للعودة إليه مباشرة.",
          selector: '[data-testid="button-mobile-open-bookmarks"], [data-testid="button-bookmark-actions"]',
        },
      ]
    : [
        {
          icon: Sparkles,
          title: "Ayah actions",
          body: "Tap an ayah number for recitation, tafsir, copying, and bookmarks.",
          selector: '[data-quran-tour="ayah-action"]',
        },
        {
          icon: Layers3,
          title: "Memorize me",
          body: "Follow a clear path: listen, read, hide, recite, then review.",
          selector: '[data-testid="button-memo-session"], [data-testid="button-mobile-memo-session"]',
        },
        {
          icon: Hand,
          title: "Word pronunciation",
          body: "Press and hold a word, then release to hear it. Swiping remains safe.",
          selector: '[data-quran-tour="word"]',
        },
        {
          icon: Bookmark,
          title: "Bookmarks in the reader",
          body: "Save your place and open all bookmarks here to return instantly.",
          selector: '[data-testid="button-mobile-open-bookmarks"], [data-testid="button-bookmark-actions"]',
        },
      ], [lang]);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const onStepChangeRef = useRef(onStepChange);

  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  }, [onStepChange]);

  useEffect(() => {
    onStepChangeRef.current?.(step);
    let target: HTMLElement | undefined;
    const updateTargetRect = () => {
      if (target) setTargetRect(target.getBoundingClientRect());
    };
    const findTarget = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(steps[step].selector));
      target = candidates.find((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      if (!target) {
        setTargetRect(null);
        return;
      }
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      window.setTimeout(updateTargetRect, 180);
    };
    const timer = window.setTimeout(findTarget, 80);
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [step, steps]);

  const current = steps[step];
  const Icon = current.icon;
  const cardWidth = Math.min(336, window.innerWidth - 24);
  const cardLeft = targetRect
    ? Math.min(window.innerWidth - cardWidth - 12, Math.max(12, targetRect.left + targetRect.width / 2 - cardWidth / 2))
    : Math.max(12, (window.innerWidth - cardWidth) / 2);
  const cardTop = targetRect
    ? (targetRect.bottom + 190 < window.innerHeight
        ? targetRect.bottom + 14
        : Math.max(12, targetRect.top - 190))
    : Math.max(16, window.innerHeight / 2 - 90);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-emerald-950/15 backdrop-blur-[1px]" />
      {targetRect && (
        <div
          className="pointer-events-none fixed rounded-xl ring-4 ring-amber-400 ring-offset-4 ring-offset-[#fffdf8] transition-all duration-200 dark:ring-offset-[#101411]"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}
      <aside
        className="pointer-events-auto fixed overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#fffdf8] shadow-2xl shadow-emerald-950/20 dark:border-white/10 dark:bg-[#101411]"
        style={{ top: cardTop, left: cardLeft, width: cardWidth }}
        aria-live="polite"
      >
        <div className="flex items-start gap-2.5 p-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                  {lang === "ar" ? `${step + 1} من ${steps.length}` : `${step + 1} of ${steps.length}`}
                </p>
                <h2 className="mt-0.5 text-sm font-black text-emerald-950 dark:text-emerald-50">{current.title}</h2>
              </div>
              <button type="button" onClick={onDismiss} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/10" aria-label={lang === "ar" ? "تخطي التعليمات" : "Skip tour"}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-[1.15rem] text-emerald-900/70 dark:text-emerald-100/70">{current.body}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-emerald-900/10 px-3 py-2 dark:border-white/10">
          <button type="button" onClick={onDismiss} className="text-xs font-bold text-emerald-800/65 dark:text-emerald-200/65">
            {lang === "ar" ? "تخطي" : "Skip"}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((currentStep) => currentStep - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/10">
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                {lang === "ar" ? "السابق" : "Back"}
              </button>
            )}
            <button
              type="button"
              onClick={() => step === steps.length - 1 ? onDismiss() : setStep((currentStep) => currentStep + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white hover:bg-emerald-800"
            >
              {step === steps.length - 1
                ? (lang === "ar" ? "ابدأ القراءة" : "Start reading")
                : (lang === "ar" ? "التالي" : "Next")}
              {step < steps.length - 1 && <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}