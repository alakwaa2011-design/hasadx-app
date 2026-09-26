import * as React from "react";
import { Bookmark, BookOpen, Copy, GitCompareArrows, Layers, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { QuranBookmarkCategoryPicker } from "./quran-bookmark-category-picker";
import type { QuranBookmarkCategory } from "./quran-bookmark-categories";

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
  bookmarkCategory?: QuranBookmarkCategory | null;
  onPlay: () => void;
  onCopy: () => void;
  onMultiCopy: () => void;
  onBookmark: (category?: QuranBookmarkCategory) => void;
  onTafsir: () => void;
  onSimilar?: () => void;
}

export function QuranAyahActionSurface({
  open,
  onOpenChange,
  verseKey,
  anchorRect,
  isBookmarked,
  bookmarkCategory,
  onPlay,
  onCopy,
  onMultiCopy,
  onBookmark,
  onTafsir,
  onSimilar,
}: QuranAyahActionSurfaceProps) {
  const { lang, dir } = useI18n();
  const [copyOptionsOpen, setCopyOptionsOpen] = React.useState(false);
  const [bookmarkOptionsOpen, setBookmarkOptionsOpen] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState({ top: 96, left: 12 });

  React.useEffect(() => {
    if (!open) {
      setCopyOptionsOpen(false);
      setBookmarkOptionsOpen(false);
    }
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const card = cardRef.current;
      const width = card?.offsetWidth ?? Math.min(340, window.innerWidth - 24);
      const height = card?.offsetHeight ?? ((copyOptionsOpen || bookmarkOptionsOpen) ? 280 : 112);
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
  }, [anchorRect, bookmarkOptionsOpen, copyOptionsOpen, open]);

  if (!open) return null;

  const actions = [
    { icon: Play, label: lang === "ar" ? "تلاوة" : "Play", onClick: onPlay, testId: "action-play" },
    { icon: BookOpen, label: lang === "ar" ? "تفسير" : "Tafsir", onClick: onTafsir, testId: "action-tafsir" },
    {
      icon: Bookmark,
      label: lang === "ar" ? (isBookmarked ? "إزالة" : "علامة") : (isBookmarked ? "Remove" : "Bookmark"),
      onClick: () => {
        setCopyOptionsOpen(false);
        setBookmarkOptionsOpen(true);
      },
      testId: "action-bookmark",
      active: isBookmarked,
      keepOpen: true,
    },
    {
      icon: Copy,
      label: lang === "ar" ? "نسخ" : "Copy",
      onClick: () => {
        setBookmarkOptionsOpen(false);
        setCopyOptionsOpen(true);
      },
      testId: "action-copy",
      keepOpen: true,
    },
    ...(onSimilar ? [{
      icon: GitCompareArrows,
      label: lang === "ar" ? "متشابهات" : "Similar",
      onClick: onSimilar,
      testId: "action-mutashabihat",
    }] : []),
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
        <div className={cn("grid gap-1", onSimilar ? "grid-cols-5" : "grid-cols-4")}>
          {actions.map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              aria-label={action.testId === "action-mutashabihat" ? (lang === "ar" ? "المتشابهات اللفظية" : "Similar verses") : undefined}
              onClick={() => {
                action.onClick();
                if (!action.keepOpen) onOpenChange(false);
              }}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-emerald-950 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-50 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
            >
              <div className={cn(
                "grid h-9 w-9 place-items-center rounded-full bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
                action.active && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
                action.testId === "action-mutashabihat" && "bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              )}>
                <action.icon className="h-4 w-4" />
              </div>
              <span className="whitespace-nowrap text-[10px] font-bold leading-4 sm:text-[11px]">{action.label}</span>
            </button>
          ))}
        </div>
        {copyOptionsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-emerald-900/5 pt-2 dark:border-white/5">
            <button
              type="button"
              data-testid="action-copy-current"
              onClick={() => {
                onCopy();
                onOpenChange(false);
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-900/5 px-3 text-[11px] font-bold text-emerald-950 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10 transition-colors"
            >
              <Copy className="h-4 w-4" />
              {lang === "ar" ? "نسخ الآية" : "Copy ayah"}
            </button>
            <button
              type="button"
              data-testid="action-copy-range"
              onClick={() => {
                onMultiCopy();
                onOpenChange(false);
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-900/5 px-3 text-[11px] font-bold text-emerald-950 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10 transition-colors"
            >
              <Layers className="h-4 w-4" />
              {lang === "ar" ? "عدة آيات" : "Multiple ayahs"}
            </button>
          </div>
        )}
        {bookmarkOptionsOpen && (
          <div className="mt-2 border-t border-emerald-900/5 pt-2 dark:border-white/5">
            <p className="mb-2 px-1 text-[11px] font-bold text-muted-foreground">
              {lang === "ar" ? "اختر نوع العلامة" : "Choose bookmark type"}
            </p>
            <QuranBookmarkCategoryPicker
              selectedCategory={bookmarkCategory}
              onSelect={(category) => {
                onBookmark(category);
                onOpenChange(false);
              }}
              onRemove={isBookmarked ? () => {
                onBookmark();
                onOpenChange(false);
              } : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}