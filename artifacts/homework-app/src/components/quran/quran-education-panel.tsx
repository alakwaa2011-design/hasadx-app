import { useState } from "react";
import { BookOpenText, Loader2, X } from "lucide-react";
import {
  getGetQuranAyahEducationQueryKey,
  useGetQuranAyahEducation,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type QuranEducationSelection = {
  verseKey: string;
  wordPosition: number | null;
  wordText: string | null;
};

export function QuranEducationPanel({
  selection,
  onClose,
}: {
  selection: QuranEducationSelection;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<"words" | "tafsir">(
    selection.wordPosition === null ? "tafsir" : "words",
  );
  const [surahNumber, ayahNumber] = selection.verseKey.split(":").map(Number);
  const query = useGetQuranAyahEducation(
    surahNumber,
    ayahNumber,
    selection.wordPosition === null ? undefined : { wordPosition: selection.wordPosition },
    {
      query: {
        queryKey: getGetQuranAyahEducationQueryKey(
          surahNumber,
          ayahNumber,
          selection.wordPosition === null ? undefined : { wordPosition: selection.wordPosition },
        ),
        staleTime: 24 * 60 * 60 * 1000,
        retry: 1,
      },
    },
  );

  const source = tab === "words"
    ? query.data?.selectedWord?.source
    : query.data?.tafsir.source;

  return (
    <section
      className="relative z-30 shrink-0 border-t border-emerald-900/10 bg-white shadow-[0_-14px_40px_rgba(34,87,57,0.12)] dark:border-white/10 dark:bg-card"
      dir="rtl"
      aria-label={lang === "ar" ? "معاني الآية وتفسيرها" : "Ayah meanings and tafsir"}
    >
      <div className="mx-auto w-full max-w-5xl px-3 pb-3 pt-2 md:px-5 md:pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {lang === "ar" ? `سورة ${surahNumber}، الآية ${ayahNumber}` : `Surah ${surahNumber}, ayah ${ayahNumber}`}
            </p>
            {selection.wordText && (
              <p className="truncate text-lg font-black text-foreground">{selection.wordText}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted"
            aria-label={lang === "ar" ? "إغلاق لوحة المعاني" : "Close meanings panel"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 flex rounded-xl bg-muted/60 p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "words"}
            disabled={selection.wordPosition === null}
            onClick={() => setTab("words")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              tab === "words" ? "bg-white text-emerald-800 shadow-sm dark:bg-background dark:text-emerald-300" : "text-muted-foreground",
            )}
          >
            {lang === "ar" ? "معاني الكلمات" : "Word meanings"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tafsir"}
            onClick={() => setTab("tafsir")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-black transition-colors",
              tab === "tafsir" ? "bg-white text-emerald-800 shadow-sm dark:bg-background dark:text-emerald-300" : "text-muted-foreground",
            )}
          >
            {lang === "ar" ? "تفسير الآية" : "Ayah tafsir"}
          </button>
        </div>

        <div className="mt-3 max-h-[28dvh] min-h-20 overflow-y-auto overscroll-contain pe-1">
          {query.isLoading ? (
            <div className="flex min-h-20 items-center justify-center text-emerald-700">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : query.isError || !query.data ? (
            <div className="flex min-h-20 items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <BookOpenText className="h-5 w-5 shrink-0" />
              {lang === "ar"
                ? "تعذر تحميل محتوى موثق الآن، لذلك لن نعرض معنى أو تفسيرًا بلا مصدر."
                : "Sourced content is unavailable, so no unsourced meaning or tafsir is shown."}
            </div>
          ) : tab === "words" ? (
            query.data.selectedWord ? (
              <div>
                <p className="mb-1 text-sm font-black text-foreground">
                  {query.data.selectedWord.text}
                </p>
                <p className="text-sm leading-7 text-foreground/85">
                  {query.data.selectedWord.meaning}
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm font-bold leading-7 text-muted-foreground">
                {lang === "ar"
                  ? "لا يورد المصدر معنى مستقلًا موثقًا لهذه الكلمة. يمكنك قراءة تفسير الآية من التبويب المجاور."
                  : "The source does not provide a separate documented meaning for this word. Read the ayah tafsir in the next tab."}
              </p>
            )
          ) : (
            <p className="text-sm leading-7 text-foreground/85">{query.data.tafsir.text}</p>
          )}
        </div>

        {source && (
          <p className="mt-3 border-t border-border/60 pt-2 text-[11px] font-bold text-muted-foreground">
            {lang === "ar" ? "المصدر" : "Source"}: {source.name} · {source.provider} · {source.version}
            {source.id !== null ? ` · #${source.id}` : ""}
          </p>
        )}
      </div>
    </section>
  );
}