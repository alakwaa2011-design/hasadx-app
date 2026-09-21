import * as React from "react";
import { BookOpenText, Languages, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type AnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

interface QuranWordActionPopoverProps {
  open: boolean;
  wordText: string;
  anchorRect: AnchorRect | null;
  onOpenChange: (open: boolean) => void;
  onPronounce: () => void;
  onMeaning: () => void;
  onTranslation: () => void;
}

export function QuranWordActionPopover({
  open,
  wordText,
  anchorRect,
  onOpenChange,
  onPronounce,
  onMeaning,
  onTranslation,
}: QuranWordActionPopoverProps) {
  const { lang, dir } = useI18n();
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState({ top: 96, left: 12 });

  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const width = cardRef.current?.offsetWidth ?? Math.min(310, window.innerWidth - 24);
      const height = cardRef.current?.offsetHeight ?? 92;
      const anchor = anchorRect ?? {
        top: window.innerHeight / 2,
        bottom: window.innerHeight / 2,
        left: window.innerWidth / 2,
        width: 0,
      };
      const left = Math.min(
        window.innerWidth - width - 12,
        Math.max(12, anchor.left + anchor.width / 2 - width / 2),
      );
      const top = window.innerHeight - anchor.bottom >= height + 16
        ? anchor.bottom + 8
        : Math.max(12, anchor.top - height - 8);
      setPosition({ top, left });
    };
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRect, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[76]" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 bg-emerald-950/5"
        aria-label={lang === "ar" ? "إغلاق خيارات الكلمة" : "Close word actions"}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={cardRef}
        role="dialog"
        data-testid="quran-word-action-popover"
        aria-label={lang === "ar" ? `خيارات كلمة ${wordText}` : `${wordText} actions`}
        className="fixed w-[min(310px,calc(100vw-24px))] rounded-2xl border border-emerald-900/10 bg-[#fffdf8]/98 p-3 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-[#101411]/98"
        style={position}
      >
        <p className="truncate px-2 pb-2.5 text-center text-[15px] font-black text-emerald-950 dark:text-emerald-50 border-b border-emerald-900/5 dark:border-white/5 mb-2.5">
          {wordText}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="word-action-pronounce"
            onClick={() => {
              onPronounce();
              onOpenChange(false);
            }}
            className="flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-900/5 px-2 text-emerald-950 transition-colors hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10"
          >
            <Volume2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <span className="text-xs font-bold">{lang === "ar" ? "نطق" : "Pronounce"}</span>
          </button>
          <button
            type="button"
            data-testid="word-action-meaning"
            onClick={() => {
              onMeaning();
              onOpenChange(false);
            }}
            className="flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <BookOpenText className="h-4 w-4" />
            <span className="text-xs font-bold">{lang === "ar" ? "معنى الكلمة" : "Meaning"}</span>
          </button>
          <button
            type="button"
            data-testid="word-action-translation"
            onClick={() => {
              onTranslation();
              onOpenChange(false);
            }}
            className="flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 rounded-xl bg-sky-50 px-2 text-sky-900 transition-colors hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-100"
          >
            <Languages className="h-4 w-4" />
            <span className="text-xs font-bold">{lang === "ar" ? "ترجمة" : "Translation"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}