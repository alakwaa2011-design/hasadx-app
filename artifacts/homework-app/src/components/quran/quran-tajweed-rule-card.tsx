import * as React from "react";
import { BookMarked, Loader2, Volume2, X } from "lucide-react";
import type { QuranTajweedRule } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useQuranWordAudio } from "./use-quran-word-audio";

interface QuranTajweedRuleCardProps {
  open: boolean;
  wordText: string;
  surahNumber: number;
  ayahNumber: number;
  wordPosition: number;
  rules: QuranTajweedRule[];
  sourceName: string;
  onClose: () => void;
}

/**
 * Mobile-friendly card shown when a reader taps the "الحكم" word action. It
 * only ever renders rules that were already verified against the official
 * Quran Foundation Tajweed data (see `getQuranFoundationWordTajweed`) — this
 * component never invents a rule name or explanation on its own. The listed
 * color swatch always matches the shared Mushaf Tajweed color legend, and the
 * optional audio button reuses the same trusted word-pronunciation source as
 * the existing "نطق" action, so it is only ever heard, never fabricated.
 */
export function QuranTajweedRuleCard({
  open,
  wordText,
  surahNumber,
  ayahNumber,
  wordPosition,
  rules,
  sourceName,
  onClose,
}: QuranTajweedRuleCardProps) {
  const { lang, dir } = useI18n();
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const { activeWordKey, loadingWordKey, playWord } = useQuranWordAudio();
  const wordKey = `${surahNumber}:${ayahNumber}:${wordPosition}`;
  const isPlaying = activeWordKey === wordKey;
  const isLoadingAudio = loadingWordKey === wordKey;

  React.useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || rules.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[78] flex items-end justify-center sm:items-center sm:p-4" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 bg-emerald-950/30 backdrop-blur-[1px]"
        aria-label={lang === "ar" ? "إغلاق بطاقة الحكم" : "Close Tajweed rule card"}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="quran-tajweed-rule-card"
        aria-label={lang === "ar" ? `أحكام التجويد لكلمة ${wordText}` : `Tajweed rules for ${wordText}`}
        className="relative w-full max-w-md rounded-t-3xl border border-emerald-900/10 bg-[#fffdf8] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl shadow-emerald-950/25 dark:border-white/10 dark:bg-[#101411] sm:rounded-3xl sm:pb-4"
      >
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-emerald-900/10 pb-2.5 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2">
            <BookMarked className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <p className="quran-word-action-text truncate text-lg font-black text-emerald-950 dark:text-emerald-50">
              {wordText}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            data-testid="tajweed-card-close"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={lang === "ar" ? "إغلاق بطاقة الحكم" : "Close Tajweed rule card"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[50dvh] space-y-2.5 overflow-y-auto overscroll-contain pe-1">
          {rules.map((rule, index) => (
            <div
              key={`${rule.class}-${index}`}
              data-testid="tajweed-rule-entry"
              className="rounded-2xl bg-emerald-50/70 p-3 dark:bg-emerald-950/30"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span
                  data-testid="tajweed-rule-color-swatch"
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                  style={{ backgroundColor: rule.color }}
                  aria-hidden="true"
                />
                <p className="text-sm font-black text-emerald-950 dark:text-emerald-100">{rule.nameAr}</p>
                <span className="text-xs font-bold text-muted-foreground">({rule.colorNameAr})</span>
              </div>
              <p className="break-words text-sm font-semibold leading-7 text-foreground/80">
                {rule.descriptionAr}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          data-testid="tajweed-card-listen"
          onClick={() => playWord(surahNumber, ayahNumber, wordPosition)}
          className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isLoadingAudio ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )}
          <span>
            {isPlaying
              ? (lang === "ar" ? "إيقاف الاستماع" : "Stop listening")
              : (lang === "ar" ? "استمع لنطق الكلمة" : "Listen to the word")}
          </span>
        </button>

        <p className="mt-2.5 truncate text-[10px] font-medium text-muted-foreground">
          {lang === "ar" ? "المصدر" : "Source"}: {sourceName}
        </p>
      </div>
    </div>
  );
}
