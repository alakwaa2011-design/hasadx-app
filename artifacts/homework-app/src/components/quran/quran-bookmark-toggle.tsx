import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface QuranBookmarkToggleProps {
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  isBookmarked: boolean;
  onToggle: (surahNumber: number, ayahNumber: number, pageNumber: number, isBookmarked: boolean) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function QuranBookmarkToggle({
  surahNumber,
  ayahNumber,
  pageNumber,
  isBookmarked,
  onToggle,
  disabled = false,
  className,
  showLabel = false,
}: QuranBookmarkToggleProps) {
  const { lang } = useI18n();

  return (
    <button
      onClick={() => onToggle(surahNumber, ayahNumber, pageNumber, isBookmarked)}
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
  );
}
