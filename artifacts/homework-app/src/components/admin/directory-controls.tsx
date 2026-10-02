import { Search, ChevronLeft, ChevronRight, RotateCcw, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  isFetching?: boolean;
  onPage: (p: number) => void;
}

export function DirectoryPager({ page, totalPages, total, pageSize, isFetching, onPage }: PagerProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const Prev = ar ? ChevronRight : ChevronLeft;
  const Next = ar ? ChevronLeft : ChevronRight;
  const btn = "h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors";
  return (
    <nav className="flex items-center justify-between gap-3 mt-3 text-xs text-muted-foreground" aria-label={ar ? "التنقل بين الصفحات" : "Pagination"} data-testid="directory-pager">
      <span role="status" aria-live="polite" className="flex items-center gap-1.5">
        {isFetching && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
        {ar ? `${from}–${to} من ${total}` : `${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={isFetching || page <= 1} onClick={() => onPage(page - 1)} aria-label={ar ? "السابق" : "Previous page"} data-testid="button-page-prev"><Prev className="w-4 h-4" /></button>
        <span className="font-bold tabular-nums">{page} / {totalPages}</span>
        <button type="button" className={btn} disabled={isFetching || page >= totalPages} onClick={() => onPage(page + 1)} aria-label={ar ? "التالي" : "Next page"} data-testid="button-page-next"><Next className="w-4 h-4" /></button>
      </div>
    </nav>
  );
}

export function DirectorySearch({ value, onChange, placeholder, busy }: { value: string; onChange: (v: string) => void; placeholder: string; busy?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className={`absolute ${ar ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} aria-hidden />
      <input
        type="search"
        value={value}
        maxLength={120}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-testid="input-directory-search"
        className={`w-full h-9 rounded-lg border border-input bg-background text-sm ${ar ? "pr-9 pl-8" : "pl-9 pr-8"} focus:outline-none focus:ring-2 focus:ring-primary/40`}
      />
      {busy && <Loader2 className={`absolute ${ar ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground`} aria-hidden />}
    </div>
  );
}

interface StatusProps {
  isLoading: boolean;
  isError: boolean;
  count: number;
  onRetry: () => void;
  emptyLabel: string;
}

/** Renders skeleton / error+retry / empty states; renders nothing when rows exist and no error. */
export function DirectoryStatus({ isLoading, isError, count, onRetry, emptyLabel }: StatusProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (isError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 px-4 py-3 mb-3 text-sm" data-testid="directory-error">
        <span className="flex items-center gap-2 text-red-700 dark:text-red-300"><AlertTriangle className="w-4 h-4" aria-hidden />{ar ? "تعذّر تحميل البيانات" : "Could not load data"}</span>
        <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs font-bold hover:underline" data-testid="button-directory-retry"><RotateCcw className="w-3.5 h-3.5" />{ar ? "إعادة المحاولة" : "Retry"}</button>
      </div>
    );
  }
  if (isLoading && count === 0) {
    return (
      <div className="space-y-2" role="status" aria-busy="true" aria-label={ar ? "جاري التحميل" : "Loading"} data-testid="directory-loading">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />)}
      </div>
    );
  }
  if (!isLoading && count === 0) {
    return (
      <div className="py-10 text-center rounded-xl border border-dashed border-border text-muted-foreground" data-testid="directory-empty">
        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden />
        <p className="text-sm font-bold">{emptyLabel}</p>
      </div>
    );
  }
  return null;
}
