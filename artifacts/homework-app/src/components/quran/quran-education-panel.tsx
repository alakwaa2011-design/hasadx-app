import { useEffect, useState } from "react";
import { BookOpenText, Check, Copy, EyeOff, Languages, Loader2, Lock, Share2, Unlock, X } from "lucide-react";
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
  onHide,
  locked = false,
  onToggleLock,
}: {
  selection: QuranEducationSelection;
  onClose: () => void;
  onHide: () => void;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<"translation" | "tafsir">("tafsir");
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    setTab(selection.wordPosition === null ? "tafsir" : "translation");
    setCopied(false);
  }, [selection.verseKey, selection.wordPosition]);

  const source = tab === "translation"
    ? query.data?.selectedWord?.source
    : query.data?.tafsir.source;
  const displayedText = tab === "translation"
    ? query.data?.selectedWord?.meaning
    : query.data?.tafsir.text;

  const copyDisplayedText = async () => {
    if (!displayedText) return;
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be unavailable in embedded browsers.
    }
  };

  const shareDisplayedText = async () => {
    if (!displayedText) return;
    const title = lang === "ar"
      ? `تفسير سورة ${surahNumber}، الآية ${ayahNumber}`
      : `Surah ${surahNumber}, ayah ${ayahNumber}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: displayedText });
        return;
      }
      await copyDisplayedText();
    } catch {
      // Dismissing the native share sheet is not an application error.
    }
  };

  return (
    <section
      className="relative z-30 shrink-0 border-t border-emerald-900/10 bg-white shadow-[0_-10px_30px_rgba(34,87,57,0.1)] dark:border-white/10 dark:bg-card"
      dir="rtl"
      aria-label={lang === "ar" ? "كتاب معاني القرآن" : "Quran meanings"}
    >
      <div className="mx-auto w-full max-w-5xl px-3 py-2.5 md:px-5 md:py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {lang === "ar" ? `سورة ${surahNumber}، الآية ${ayahNumber}` : `Surah ${surahNumber}, ayah ${ayahNumber}`}
            </p>
          </div>
          {selection.wordPosition !== null && (
            <button
              type="button"
              aria-pressed={tab === "translation"}
              onClick={() => setTab((current) => current === "translation" ? "tafsir" : "translation")}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-colors",
                tab === "translation"
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-border bg-muted/35 text-muted-foreground hover:bg-muted",
              )}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "ar" ? "معاني القرآن" : "Quran meanings"}
            </button>
          )}
          <button
            type="button"
            onClick={onHide}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/35 px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={lang === "ar" ? "إخفاء التفسير" : "Hide tafsir"}
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === "ar" ? "إخفاء التفسير" : "Hide tafsir"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleLock}
            aria-pressed={locked}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              locked
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-label={lang === "ar"
              ? (locked ? "فتح متابعة التفسير مع التلاوة" : "قفل التفسير الحالي")
              : (locked ? "Unlock tafsir following" : "Lock current tafsir")}
            title={lang === "ar"
              ? (locked ? "فتح المتابعة التلقائية" : "قفل التفسير الحالي")
              : (locked ? "Resume automatic following" : "Lock current tafsir")}
          >
            {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void copyDisplayedText()}
            disabled={!displayedText}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            aria-label={lang === "ar" ? "نسخ النص" : "Copy text"}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void shareDisplayedText()}
            disabled={!displayedText}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            aria-label={lang === "ar" ? "مشاركة النص" : "Share text"}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label={lang === "ar" ? "إغلاق لوحة المعاني" : "Close meanings panel"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 max-h-[22dvh] min-h-16 overflow-y-auto overscroll-contain pe-1">
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
          ) : tab === "translation" ? (
            query.data.selectedWord ? (
              <div className="rounded-xl bg-muted/35 px-3 py-2">
                <p className="mb-1 text-base font-black text-foreground">
                  {query.data.selectedWord.text}
                </p>
                <p className="text-sm leading-6 text-foreground/80">
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
            <div>
              <p className="mb-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                {lang === "ar" ? "تفسير الآية" : "Ayah tafsir"}
              </p>
              <p className="text-lg font-medium leading-9 text-foreground/90 md:text-xl md:leading-10">
                {query.data.tafsir.text}
              </p>
            </div>
          )}
        </div>

        {source && (
          <p className="mt-2 truncate border-t border-border/50 pt-1.5 text-[10px] font-medium text-muted-foreground">
            {lang === "ar" ? "المصدر" : "Source"}: {source.name}
          </p>
        )}
      </div>
    </section>
  );
}