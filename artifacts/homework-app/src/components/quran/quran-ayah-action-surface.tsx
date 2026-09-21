import * as React from "react";
import { Bookmark, BookOpen, Copy, Layers, Play, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

interface QuranAyahActionSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verseKey: string;
  anchorRect?: AnchorRect | null;
  isBookmarked: boolean;
  onPlay: () => void;
  onCopy: () => void;
  onMultiCopy: () => void;
  onBookmark: () => void;
  onTafsir: () => void;
}

export function QuranAyahActionSurface({
  open,
  onOpenChange,
  verseKey,
  anchorRect,
  isBookmarked,
  onPlay,
  onCopy,
  onMultiCopy,
  onBookmark,
  onTafsir,
}: QuranAyahActionSurfaceProps) {
  const { lang, dir } = useI18n();
  const [copyOptionsOpen, setCopyOptionsOpen] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState({ top: 96, left: 12 });

  React.useEffect(() => {
    if (!open) setCopyOptionsOpen(false);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const card = cardRef.current;
      const width = card?.offsetWidth ?? Math.min(340, window.innerWidth - 24);
      const height = card?.offsetHeight ?? (copyOptionsOpen ? 188 : 112);
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
      const spaceBelow = window.innerHeight - anchor.bottom;
      const top = spaceBelow >= height + 16
        ? anchor.bottom + 10
        : Math.max(12, anchor.top - height - 10);
      setPosition({ top, left });
    };
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRect, copyOptionsOpen, open]);

  if (!open) return null;

  const actions = [
    { icon: Play, label: lang === "ar" ? "تلاوة" : "Play", onClick: onPlay, testId: "action-play" },
    { icon: BookOpen, label: lang === "ar" ? "تفسير" : "Tafsir", onClick: onTafsir, testId: "action-tafsir" },
    {
      icon: Bookmark,
      label: lang === "ar" ? (isBookmarked ? "إزالة" : "علامة") : (isBookmarked ? "Remove" : "Bookmark"),
      onClick: onBookmark,
      testId: "action-bookmark",
      active: isBookmarked,
    },
    {
      icon: Copy,
      label: lang === "ar" ? "نسخ" : "Copy",
      onClick: () => setCopyOptionsOpen(true),
      testId: "action-copy",
      keepOpen: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-[75]" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 bg-emerald-950/10"
        aria-label={lang === "ar" ? "إغلاق خيارات الآية" : "Close ayah actions"}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={lang === "ar" ? `خيارات الآية ${verseKey.split(":")[1]}` : `Ayah ${verseKey.split(":")[1]} actions`}
        data-testid="ayah-action-popover"
        className="fixed w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#fffdf8]/98 p-2 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-[#101411]/98"
        style={position}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
          <p className="text-xs font-black text-emerald-950 dark:text-emerald-50">
            {lang === "ar" ? `الآية ${verseKey.split(":")[1]}` : `Ayah ${verseKey.split(":")[1]}`}
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-6 w-6 place-items-center rounded-full text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/10"
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {actions.map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              onClick={() => {
                action.onClick();
                if (!action.keepOpen) onOpenChange(false);
              }}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-emerald-950 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-50 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
            >
              <div className={cn(
                "grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
                action.active && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
              )}>
                <action.icon className="h-3.5 w-3.5" />
              </div>
              <span className="line-clamp-1 text-[10px] font-bold">{action.label}</span>
            </button>
          ))}
        </div>
        {copyOptionsOpen && (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-emerald-900/10 pt-1.5 dark:border-white/10">
            <button
              type="button"
              data-testid="action-copy-current"
              onClick={() => {
                onCopy();
                onOpenChange(false);
              }}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-900/5 px-2 text-[11px] font-bold text-emerald-950 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              {lang === "ar" ? "نسخ الآية" : "Copy ayah"}
            </button>
            <button
              type="button"
              data-testid="action-copy-range"
              onClick={() => {
                onMultiCopy();
                onOpenChange(false);
              }}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-900/5 px-2 text-[11px] font-bold text-emerald-950 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10"
            >
              <Layers className="h-3.5 w-3.5" />
              {lang === "ar" ? "عدة آيات" : "Multiple ayahs"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}