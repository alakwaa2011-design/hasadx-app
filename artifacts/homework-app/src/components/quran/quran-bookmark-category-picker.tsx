import {
  AlertTriangle,
  GitCompareArrows,
  MapPin,
  MessageCircleQuestion,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  QURAN_BOOKMARK_CATEGORIES,
  quranBookmarkCategoryLabel,
  type QuranBookmarkCategory,
} from "./quran-bookmark-categories";

const categoryIcons = {
  stopped_here: MapPin,
  review: RotateCcw,
  similar: GitCompareArrows,
  repeated_mistake: AlertTriangle,
  ask_teacher: MessageCircleQuestion,
} satisfies Record<QuranBookmarkCategory, typeof MapPin>;

export function QuranBookmarkCategoryPicker({
  selectedCategory,
  onSelect,
  onRemove,
  disabled = false,
  className,
}: {
  selectedCategory?: QuranBookmarkCategory | null;
  onSelect: (category: QuranBookmarkCategory) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();

  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      {QURAN_BOOKMARK_CATEGORIES.map((category) => {
        const Icon = categoryIcons[category];
        const selected = selectedCategory === category;
        return (
          <button
            key={category}
            type="button"
            disabled={disabled}
            data-testid={`bookmark-category-${category}`}
            onClick={() => onSelect(category)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-start text-[11px] font-bold transition-colors disabled:opacity-50",
              selected
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-900/10 bg-emerald-900/[0.035] text-emerald-950 hover:bg-emerald-900/[0.08] dark:border-white/10 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{quranBookmarkCategoryLabel(category, lang)}</span>
          </button>
        );
      })}
      {selectedCategory && onRemove && (
        <button
          type="button"
          disabled={disabled}
          data-testid="bookmark-category-remove"
          onClick={onRemove}
          className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-[11px] font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {lang === "ar" ? "إزالة العلامة" : "Remove bookmark"}
        </button>
      )}
    </div>
  );
}