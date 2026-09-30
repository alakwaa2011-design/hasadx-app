import { useEffect, useMemo, useState } from "react";
import { ArrowUpLeft, GitCompareArrows, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getQuranSimilarPassages, type QuranSimilarPassageCategory } from "@/data/quran/mutashabihat-relations";
import { getQuranPhraseIndex, getSharedPhrase, getWordDifferences, type QuranPhraseIndex } from "@/data/quran/mutashabihat-phrases";

type Verse = { chapter_id: number; number: number; page_id: number; content: string };
type Chapter = { id: number; name: string };
type Corpus = { verses: Map<string, Verse>; chapters: Map<number, string>; phraseIndex: QuranPhraseIndex };

type ResultFilter = "all" | "exact" | "phrase" | "variation";
const categoryLabels: Record<QuranSimilarPassageCategory, { ar: string; en: string }> = {
  repeated_verse: { ar: "نص الآية متكرر", en: "Repeated verse" },
  repeated_phrase: { ar: "عبارة مشتركة", en: "Repeated phrase" },
  lafzi: { ar: "عبارة متطابقة", en: "Shared wording" },
  word_swap: { ar: "تبديل لفظ", en: "Word variation" },
  addition_omission: { ar: "زيادة أو حذف", en: "Addition or omission" },
  ending_variation: { ar: "اختلاف الخاتمة", en: "Different ending" },
  order_change: { ar: "تغيّر الترتيب", en: "Different order" },
  pronoun_shift: { ar: "اختلاف الضمير", en: "Pronoun variation" },
  structural: { ar: "تشابه في الصياغة", en: "Similar structure" },
};

function VerseText({ text, highlighted, different }: { text: string; highlighted: Set<number>; different: Set<number> }) {
  return (
    <span className="quran-word-action-text block text-[20px] leading-[2.1] text-emerald-950 dark:text-emerald-50">
      {text.split(/\s+/).filter(Boolean).map((word, index) => (
        <span
          key={index}
          data-word-mark={highlighted.has(index) ? "shared" : different.has(index) ? "different" : undefined}
          className={highlighted.has(index)
            ? "rounded bg-amber-200/70 px-0.5 text-emerald-950 dark:bg-amber-500/30 dark:text-amber-50"
            : different.has(index)
              ? "rounded bg-sky-100 px-0.5 text-emerald-950 ring-1 ring-inset ring-sky-300/80 dark:bg-sky-500/25 dark:text-sky-50 dark:ring-sky-400/40"
              : undefined}
        >
          {word}{" "}
        </span>
      ))}
    </span>
  );
}

export function QuranMutashabihatPanel({
  verseKey,
  onClose,
  onNavigate,
}: {
  verseKey: string;
  onClose: () => void;
  onNavigate: (target: { verseKey: string; pageId: number }) => void;
}) {
  const { lang, dir } = useI18n();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [filter, setFilter] = useState<ResultFilter>("all");
  useEffect(() => { setVisibleCount(12); setFilter("all"); }, [verseKey]);
  useEffect(() => setVisibleCount(12), [filter]);
  const relations = useMemo(() => {
    if (!corpus) return [];
    return getQuranSimilarPassages(corpus.phraseIndex, verseKey);
  }, [corpus, verseKey]);
  const filterCounts = {
    all: relations.length,
    exact: relations.filter((relation) => relation.exactVerse).length,
    phrase: relations.filter((relation) => !relation.exactVerse && relation.category === "repeated_phrase").length,
    variation: relations.filter((relation) => !relation.exactVerse && relation.category !== "repeated_phrase").length,
  };
  const filteredRelations = relations.filter((relation) =>
    filter === "all"
    || (filter === "exact" && relation.exactVerse)
    || (filter === "phrase" && !relation.exactVerse && relation.category === "repeated_phrase")
    || (filter === "variation" && !relation.exactVerse && relation.category !== "repeated_phrase"),
  );
  const filters: Array<{ id: ResultFilter; ar: string; en: string; fullAr: string; fullEn: string }> = [
    { id: "all", ar: "الكل", en: "All", fullAr: "كل المتشابهات", fullEn: "All similar passages" },
    { id: "exact", ar: "مطابق", en: "Exact", fullAr: "نص مطابق", fullEn: "Exact text" },
    { id: "phrase", ar: "عبارة", en: "Phrase", fullAr: "عبارة مشتركة", fullEn: "Shared phrase" },
    { id: "variation", ar: "اختلاف", en: "Variation", fullAr: "اختلاف لفظي", fullEn: "Wording variation" },
  ];
  useEffect(() => {
    let active = true;
    Promise.all([
      import("@/data/quran/qcomplex/verses.json"),
      import("@/data/quran/qcomplex/chapters.json"),
    ]).then(([versesFile, chaptersFile]) => {
      if (!active) return;
      const verses = versesFile.default as Verse[];
      const chapters = chaptersFile.default as Chapter[];
      setCorpus({
        verses: new Map(verses.map((verse) => [`${verse.chapter_id}:${verse.number}`, verse])),
        chapters: new Map(chapters.map((chapter) => [chapter.id, chapter.name])),
        phraseIndex: getQuranPhraseIndex(verses),
      });
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const current = corpus?.verses.get(verseKey);
  const [chapterId, ayahNumber] = verseKey.split(":").map(Number);
  const heading = (key: string) => {
    const [id, number] = key.split(":").map(Number);
    return `${corpus?.chapters.get(id) ?? (lang === "ar" ? "سورة" : "Surah")} · ${number}`;
  };

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center p-3 sm:p-6" dir={dir}>
      <button type="button" aria-label={lang === "ar" ? "إغلاق المتشابهات" : "Close similarities"} className="absolute inset-0 bg-emerald-950/60 backdrop-blur-sm" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quran-mutashabihat-title"
        data-testid="quran-mutashabihat-panel"
        className="relative flex max-h-[min(88dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#fffdf8] shadow-2xl dark:border-white/10 dark:bg-[#101411]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-emerald-900/10 px-4 py-3 sm:px-6 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <GitCompareArrows className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <div>
              <h2 id="quran-mutashabihat-title" className="text-base font-bold text-emerald-950 dark:text-white">
                {lang === "ar" ? "المتشابهات اللفظية" : "Similar verses"}
              </h2>
              <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70">
                {corpus ? heading(verseKey) : `${chapterId}:${ayahNumber}`}
              </p>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-emerald-900 hover:bg-emerald-100 dark:text-white dark:hover:bg-emerald-900" aria-label={lang === "ar" ? "إغلاق" : "Close"}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" data-testid="quran-mutashabihat-results">
          {!corpus && !error && <div className="flex items-center justify-center gap-2 py-14 text-emerald-700" role="status"><Loader2 className="h-5 w-5 animate-spin" />{lang === "ar" ? "جارٍ تحميل الآيات…" : "Loading verses…"}</div>}
          {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{lang === "ar" ? "تعذر تحميل نص المصحف. أغلق اللوحة وحاول مجددًا." : "Could not load the Quran text. Close and try again."}</div>}
          {corpus && !current && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{lang === "ar" ? "الآية غير موجودة في المصحف المحلي." : "Verse not found in the local Quran."}</div>}
          {current && corpus && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-semibold text-emerald-800/80 dark:text-emerald-200/80">
                <span>{lang === "ar" ? `المواضع المتشابهة: ${filteredRelations.length}` : `Similar passages: ${filteredRelations.length}`}</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-500/40" />{lang === "ar" ? "مشترك" : "Shared"}</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-100 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/30 dark:ring-sky-400/40" />{lang === "ar" ? "مختلف" : "Different"}</span>
                </span>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-1" role="group" aria-label={lang === "ar" ? "تصفية المتشابهات" : "Filter similar verses"}>
                {filters.map(({ id, ar, en, fullAr, fullEn }) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`mutashabihat-filter-${id}`}
                    aria-pressed={filter === id}
                    aria-label={`${lang === "ar" ? fullAr : fullEn}: ${filterCounts[id]}`}
                    onClick={() => setFilter(id)}
                    className={`min-w-0 whitespace-nowrap rounded-full border px-1 py-1.5 text-[11px] font-bold transition-colors sm:text-xs ${filter === id
                      ? "border-emerald-800 bg-emerald-800 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950"
                      : "border-emerald-900/15 bg-white text-emerald-900 hover:bg-emerald-50 dark:border-white/15 dark:bg-white/5 dark:text-emerald-100 dark:hover:bg-white/10"}`}
                  >
                    {lang === "ar" ? ar : en} <span className="opacity-75">{filterCounts[id]}</span>
                  </button>
                ))}
              </div>
              {relations.length === 0 && (
                <p className="rounded-xl border border-emerald-900/10 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900 dark:border-white/10 dark:bg-emerald-900/20 dark:text-emerald-50">
                  {lang === "ar"
                    ? "لم نجد تكرارًا مطابقًا أو عبارة مشتركة من ثلاث كلمات فأكثر لهذه الآية، ولا علاقة منتقاة في الفهرس. قد توجد اختلافات لفظية أخرى غير مفهرسة."
                    : "No repeated verse, shared phrase of three or more words, or selected relation was found. Other wording variations may exist."}
                </p>
              )}
              {relations.length > 0 && filteredRelations.length === 0 && (
                <p className="rounded-xl border border-emerald-900/10 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-white/10 dark:bg-emerald-900/20 dark:text-emerald-50">
                  {lang === "ar" ? "لا توجد مواضع في هذا التصنيف. اختر «الكل» لعرض بقية النتائج." : "No passages in this category. Select All to see other results."}
                </p>
              )}
              <div className="space-y-3">
                {filteredRelations.slice(0, visibleCount).map(({ otherVerseKey, category }) => {
                  const other = corpus.verses.get(otherVerseKey);
                  if (!other) return (
                    <div key={otherVerseKey} role="alert" className="rounded-xl border border-rose-200 p-3 text-rose-800">
                      {lang === "ar" ? `تعذر العثور على الآية ${otherVerseKey}` : `Verse ${otherVerseKey} not found`}
                    </div>
                  );
                  const shared = getSharedPhrase(corpus.phraseIndex, verseKey, otherVerseKey);
                  const different = getWordDifferences(corpus.phraseIndex, verseKey, otherVerseKey);
                  return (
                    <article key={otherVerseKey} className="rounded-xl border border-emerald-900/10 bg-white p-3.5 dark:border-white/10 dark:bg-white/5" data-testid={`mutashabihat-match-${otherVerseKey}`}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-emerald-950 dark:text-emerald-50">{heading(otherVerseKey)}</h3>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                          {categoryLabels[category][lang === "ar" ? "ar" : "en"]}
                        </span>
                      </div>
                      <div className="space-y-2 rounded-lg bg-[#faf8f2] p-3 dark:bg-emerald-950/30">
                         <div><span className="text-xs font-semibold text-emerald-800/75 dark:text-emerald-200/75">{lang === "ar" ? "الآية الحالية" : "Current verse"}</span><VerseText text={current.content} highlighted={shared.first} different={different.first} /></div>
                        <button
                          type="button"
                          data-testid={`mutashabihat-navigate-${otherVerseKey}`}
                          aria-label={lang === "ar" ? `الانتقال إلى ${heading(otherVerseKey)}` : `Go to ${heading(otherVerseKey)}`}
                          onClick={() => onNavigate({ verseKey: otherVerseKey, pageId: other.page_id })}
                          className="group block w-full rounded-lg border-t border-emerald-900/10 px-1 py-2 text-start transition-colors hover:bg-emerald-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-white/10 dark:hover:bg-emerald-800/30"
                        >
                          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-800/75 dark:text-emerald-200/75">
                            <span>{heading(otherVerseKey)}</span>
                            <ArrowUpLeft className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                          </span>
                           <VerseText text={other.content} highlighted={shared.second} different={different.second} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {filteredRelations.length > visibleCount && (
                <button type="button" data-testid="mutashabihat-show-more" onClick={() => setVisibleCount((count) => count + 12)} className="mt-4 w-full rounded-xl border border-emerald-800/20 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100 dark:border-white/10 dark:bg-emerald-900/20 dark:text-emerald-50">
                  {lang === "ar" ? `عرض المزيد (${filteredRelations.length - visibleCount} متبقية)` : `Show more (${filteredRelations.length - visibleCount} remaining)`}
                </button>
              )}
              <p className="mt-5 border-t border-emerald-900/10 pt-3 text-xs leading-6 text-emerald-800/75 dark:border-white/10 dark:text-emerald-200/75">
                {lang === "ar" ? "التكرار النصي محسوب من مصحف Q-Complex المحلي. العلاقات المنتقاة للاختلافات اللفظية ليست شاملة؛ مصدرها: " : "Textual repetition is calculated from the local Q-Complex text. Selected wording variations are not exhaustive; source: "}
                <a className="underline underline-offset-2" href="https://github.com/srmdn/quran-mutashabihat" target="_blank" rel="noopener noreferrer">quran-mutashabihat</a>
                {" · "}
                <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
                {lang === "ar" ? " · اقتصرنا على العلاقات المراجعة، وحذفنا ملاحظات المصدر." : " · Curated pairs only; source notes omitted."}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}