import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SearchChapter {
  id: number;
  name: string;
}

interface SearchVerse {
  id: number;
  number: number;
  content: string;
  chapter_id: number;
  page_id: number;
}

export interface QuranSearchSelection {
  chapterId: number;
  ayah: number;
  pageId: number;
}

const MAX_VISIBLE_RESULTS = 60;

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function QuranSearchDialog({
  onSelect,
}: {
  onSelect: (selection: QuranSearchSelection) => void;
}) {
  const { lang, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chapters, setChapters] = useState<SearchChapter[]>([]);
  const [verses, setVerses] = useState<SearchVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(MAX_VISIBLE_RESULTS);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!open || verses.length > 0) return;

    let mounted = true;
    setLoading(true);
    setLoadError(false);

    Promise.all([
      import("@/data/quran/qcomplex/chapters.json"),
      import("@/data/quran/qcomplex/verses.json"),
    ])
      .then(([chapterData, verseData]) => {
        if (!mounted) return;
        setChapters(chapterData.default as SearchChapter[]);
        setVerses(verseData.default as SearchVerse[]);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadAttempt, open, verses.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const normalizedQuery = normalizeArabic(deferredQuery);
  useEffect(() => {
    setVisibleLimit(MAX_VISIBLE_RESULTS);
  }, [normalizedQuery]);

  const matches = useMemo(() => {
    if (!normalizedQuery) return [];
    return verses.filter((verse) =>
      normalizeArabic(verse.content).includes(normalizedQuery),
    );
  }, [normalizedQuery, verses]);

  const chapterNames = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter.name])),
    [chapters],
  );

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-900/10 bg-white/55 p-0 text-emerald-900 transition-colors hover:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100 dark:hover:bg-emerald-950/50 md:h-auto md:w-auto md:gap-2 md:border-0 md:bg-transparent md:p-2 md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground md:dark:bg-transparent md:px-3"
        aria-label={lang === "ar" ? "البحث في القرآن" : "Search the Quran"}
      >
        <Search className="h-4.5 w-4.5 md:h-5 md:w-5" />
        <span className="hidden text-sm font-bold xl:inline">
          {lang === "ar" ? "بحث" : "Search"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 p-3 pt-[8vh] backdrop-blur-sm md:p-6 md:pt-[10vh]"
          dir={dir}
          role="dialog"
          aria-modal="true"
          aria-label={lang === "ar" ? "البحث في القرآن" : "Search the Quran"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl dark:bg-card">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 md:px-5">
              <div>
                <h2 className="text-base font-black text-foreground md:text-lg">
                  {lang === "ar" ? "البحث في آيات القرآن" : "Search Quran verses"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "يمكنك الكتابة بالتشكيل أو بدونه"
                    : "Search with or without Arabic diacritics"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 md:p-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    lang === "ar"
                      ? "اكتب كلمة مثل: الرحمن"
                      : "Type an Arabic word, e.g. الرحمن"
                  }
                  className="h-12 w-full rounded-2xl border-2 border-border bg-muted/30 pe-4 ps-12 text-base font-bold text-foreground outline-none transition-colors placeholder:font-medium focus:border-emerald-600"
                />
              </label>
            </div>

            <div className="min-h-32 flex-1 overflow-y-auto border-t border-border/60">
              {loading && (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
                </div>
              )}

              {!loading && loadError && (
                <div className="flex h-40 flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="text-sm font-bold text-destructive">
                    {lang === "ar"
                      ? "تعذر تحميل فهرس الآيات"
                      : "The verse index could not be loaded"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadError(false);
                      setLoadAttempt((attempt) => attempt + 1);
                    }}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    {lang === "ar" ? "إعادة المحاولة" : "Try again"}
                  </button>
                </div>
              )}

              {!loading && !loadError && !normalizedQuery && (
                <div className="flex h-40 items-center justify-center px-6 text-center text-sm font-medium text-muted-foreground">
                  {lang === "ar"
                    ? "اكتب كلمة لعرض جميع الآيات التي وردت فيها"
                    : "Enter a word to see every verse containing it"}
                </div>
              )}

              {!loading && !loadError && normalizedQuery && matches.length === 0 && (
                <div className="flex h-40 items-center justify-center px-6 text-center text-sm font-bold text-muted-foreground">
                  {lang === "ar"
                    ? "لم يتم العثور على آيات مطابقة"
                    : "No matching verses found"}
                </div>
              )}

              {!loading && !loadError && matches.length > 0 && (
                <>
                  <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/95 px-4 py-2 text-xs font-bold text-muted-foreground backdrop-blur md:px-5">
                    {lang === "ar"
                      ? `${matches.length} نتيجة`
                      : `${matches.length} results`}
                  </div>
                  <div className="divide-y divide-border/60">
                    {matches.slice(0, visibleLimit).map((verse) => (
                      <button
                        key={verse.id}
                        type="button"
                        onClick={() => {
                          onSelect({
                            chapterId: verse.chapter_id,
                            ayah: verse.number,
                            pageId: verse.page_id,
                          });
                          close();
                        }}
                        className="block w-full px-4 py-4 text-start transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 md:px-5"
                      >
                        <span className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
                          <span>
                            {lang === "ar"
                              ? `سورة ${chapterNames.get(verse.chapter_id) ?? verse.chapter_id}`
                              : `Surah ${chapterNames.get(verse.chapter_id) ?? verse.chapter_id}`}
                          </span>
                          <span className="text-muted-foreground">
                            {lang === "ar"
                              ? `الآية ${verse.number} · الصفحة ${verse.page_id}`
                              : `Ayah ${verse.number} · Page ${verse.page_id}`}
                          </span>
                        </span>
                        <span
                          className="block text-lg font-bold leading-[2.1] text-foreground md:text-xl"
                          style={{
                            fontFamily:
                              "'KFGQPC Uthman Taha Naskh', 'Amiri', 'Traditional Arabic', serif",
                            direction: "rtl",
                          }}
                        >
                          {verse.content}
                        </span>
                      </button>
                    ))}
                  </div>
                  {visibleLimit < matches.length && (
                    <div className="border-t border-border p-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLimit((limit) =>
                            Math.min(limit + MAX_VISIBLE_RESULTS, matches.length),
                          )
                        }
                        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
                      >
                        {lang === "ar"
                          ? `عرض نتائج إضافية (${matches.length - visibleLimit} متبقية)`
                          : `Show more (${matches.length - visibleLimit} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}