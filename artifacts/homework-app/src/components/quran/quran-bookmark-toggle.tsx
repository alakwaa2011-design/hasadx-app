import { Bookmark } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { QuranBookmarkCategoryPicker } from './quran-bookmark-category-picker';
import type { QuranBookmarkCategory } from './quran-bookmark-categories';

interface QuranBookmarkToggleProps {
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  isBookmarked: boolean;
  category?: QuranBookmarkCategory | null;
  onToggle: (surahNumber: number, ayahNumber: number, pageNumber: number, isBookmarked: boolean, category?: QuranBookmarkCategory) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function QuranBookmarkToggle({
  surahNumber,
  ayahNumber,
  pageNumber,
  isBookmarked,
  category,
  onToggle,
  disabled = false,
  className,
  showLabel = false,
}: QuranBookmarkToggleProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 p-2 rounded-xl transition-all duration-200 outline-none",
        isBookmarked
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900"
          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={
        isBookmarked
          ? (lang === 'ar' ? 'إزالة العلامة المرجعية' : 'Remove bookmark')
          : (lang === 'ar' ? 'إضافة علامة مرجعية' : 'Add bookmark')
      }
      title={
        isBookmarked
          ? (lang === 'ar' ? 'إزالة العلامة المرجعية' : 'Remove bookmark')
          : (lang === 'ar' ? 'إضافة علامة مرجعية' : 'Add bookmark')
      }
    >
      <Bookmark
        className={cn("w-5 h-5", isBookmarked && "fill-current")}
      />
      {showLabel && (
        <span className="text-xs font-bold md:text-sm">
          {isBookmarked
            ? (lang === 'ar' ? 'محفوظة' : 'Saved')
            : (lang === 'ar' ? 'حفظ العلامة' : 'Save Bookmark')}
        </span>
      )}
    </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-emerald-900/10 bg-[#fffdf8]/98 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#101411]/98">
          <QuranBookmarkCategoryPicker
            selectedCategory={category}
            disabled={disabled}
            onSelect={(nextCategory) => {
              onToggle(surahNumber, ayahNumber, pageNumber, isBookmarked, nextCategory);
              setOpen(false);
            }}
            onRemove={isBookmarked ? () => {
              onToggle(surahNumber, ayahNumber, pageNumber, true);
              setOpen(false);
            } : undefined}
          />
        </div>
      )}
    </div>
  );
}
