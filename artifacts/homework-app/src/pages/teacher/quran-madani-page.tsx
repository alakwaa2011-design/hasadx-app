import { useEffect, useState, useMemo } from "react";
import { useGetQuranMadaniPage, getGetQuranMadaniPageQueryKey } from "@workspace/api-client-react";
import { Bookmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface QuranMadaniPageRendererProps {
  pageNumber: number;
  isLastVerse: (chapterId: number, verseNumber: number) => boolean;
  fallbackImageUrl: string;
  onFallbackError?: () => void;
  selectedVerseKey?: string | null;
  selectedVerseRange?: { surah: number; startAyah: number; endAyah: number } | null;
  selectedWordId?: number | null;
  playingVerseKey?: string | null;
  playingWordPosition?: number | null;
  bookmarkedVerseKeys?: ReadonlySet<string>;
  isAyahConcealed?: (
    chapterId: number,
    verseNumber: number,
    wordPosition?: number | null,
  ) => boolean;
  onVerseClick?: (selection: {
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
    anchorRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  }) => void;
  onVerseAction?: (selection: {
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
    anchorRect?: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  }) => void;
}

export function QuranMadaniPageRenderer({
  pageNumber,
  isLastVerse,
  fallbackImageUrl,
  onFallbackError,
  selectedVerseKey,
  selectedVerseRange,
  selectedWordId,
  playingVerseKey,
  playingWordPosition,
  bookmarkedVerseKeys,
  isAyahConcealed,
  onVerseClick,
  onVerseAction,
}: QuranMadaniPageRendererProps) {
  const { lang } = useI18n();
  const [fontState, setFontState] = useState<"loading" | "ready" | "error">("loading");

  const { data, isLoading, isError } = useGetQuranMadaniPage(pageNumber, {
    query: {
      queryKey: getGetQuranMadaniPageQueryKey(pageNumber),
      retry: 2,
      staleTime: Infinity,
    },
  });

  useEffect(() => {
    let mounted = true;
    const fontUrls = [
      `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`,
      `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`,
    ];
    const fontName = `qcf-v2-p${pageNumber}`;
    setFontState("loading");
    const loadFont = async () => {
      let lastError: unknown;
      for (const fontUrl of fontUrls) {
        try {
          return await new FontFace(fontName, `url('${fontUrl}')`, {
            display: "block",
          }).load();
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    };
    loadFont()
      .then((loadedFont) => {
        if (!mounted) return;
        document.fonts.add(loadedFont);
        setFontState("ready");
      })
      .catch(() => {
        if (mounted) setFontState("error");
      });

    return () => {
      mounted = false;
    };
  }, [pageNumber]);

  const pageLayout = useMemo(() => {
    const decorations = new Map<number, { kind: "surah" | "bismillah"; surahNumber: number }>();
    const partialLines = new Set<number>();
    if (!data) return { decorations, partialLines };

    const occupiedLines = [...new Set(data.lines.map((line) => line.lineNumber))].sort((a, b) => a - b);
    for (const start of data.surahStarts) {
      const previousLine = occupiedLines.filter((line) => line < start.lineNumber).at(-1) ?? 0;
      const availableRows = start.lineNumber - previousLine - 1;
      const needsBismillah = start.surahNumber !== 1 && start.surahNumber !== 9;
      if (needsBismillah && availableRows === 1) {
        decorations.set(start.lineNumber - 1, {
          kind: "bismillah",
          surahNumber: start.surahNumber,
        });
        continue;
      }
      const headerRow = needsBismillah && availableRows >= 2
        ? start.lineNumber - 2
        : start.lineNumber - 1;
      if (headerRow > previousLine && !occupiedLines.includes(headerRow)) {
        decorations.set(headerRow, { kind: "surah", surahNumber: start.surahNumber });
      }
      const bismillahRow = start.lineNumber - 1;
      if (
        needsBismillah
        && bismillahRow > headerRow
        && !occupiedLines.includes(bismillahRow)
      ) {
        decorations.set(bismillahRow, { kind: "bismillah", surahNumber: start.surahNumber });
      }
      const lastContentLine = occupiedLines.filter((line) => line < headerRow).at(-1);
      if (lastContentLine) partialLines.add(lastContentLine);
    }

    for (let index = data.lines.length - 1; index >= 0; index -= 1) {
      const line = data.lines[index];
      if (line.words.length > 6) break;
      partialLines.add(line.lineNumber);
    }
    return { decorations, partialLines };
  }, [data]);

  const showFallback = isError || fontState === "error";
  const isReady = data && fontState === "ready";

  if (showFallback) {
    return (
      <img
        src={fallbackImageUrl}
        alt={lang === "ar" ? `صفحة المصحف رقم ${pageNumber}` : `Mushaf page ${pageNumber}`}
        className="block h-auto w-full select-none bg-white"
        loading="eager"
        decoding="async"
        draggable={false}
        onError={onFallbackError}
      />
    );
  }

  if (!isReady || isLoading) {
    return (
      <div className="flex aspect-[382.677/547.086] w-full flex-col items-center justify-center bg-[#fdfaf6] text-emerald-700">
        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
      </div>
    );
  }

  const rows = Array.from({ length: 15 }, (_, i) => i + 1);
  const fontName = `qcf-v2-p${pageNumber}`;
  const firstPagesContent = pageNumber <= 2
    ? data.lines.filter((line) => line.words.length > 0)
    : null;
  const firstPagesContentStartRow = firstPagesContent
    ? Math.max(1, Math.floor((rows.length - firstPagesContent.length) / 2) + 1)
    : null;
  const firstPagesBismillahRow = pageNumber === 2 && firstPagesContentStartRow
    ? firstPagesContentStartRow - 1
    : null;

  return (
    <div
      className="quran-madani-page @container relative w-full select-none overflow-hidden rounded-[2px] bg-[#fdfaf6] text-black"
      style={{ aspectRatio: "382.677/547.086" }}
      dir="rtl"
      translate="no"
    >
      <div
        className="quran-madani-page-content relative z-20 flex h-full w-full flex-col px-[8.5%] py-[9.5%]"
        style={{ fontFamily: `'${fontName}'` }}
      >
        {rows.map((rowNum) => {
          const firstPageLineIndex = firstPagesContentStartRow
            ? rowNum - firstPagesContentStartRow
            : -1;
          const line = firstPagesContent
            ? firstPagesContent[firstPageLineIndex]
            : data.lines.find((l) => l.lineNumber === rowNum);
          const decoration = firstPagesContent
            ? rowNum === firstPagesBismillahRow
              ? { kind: "bismillah" as const, surahNumber: 2 }
              : undefined
            : pageLayout.decorations.get(rowNum);

          if (decoration?.kind === "surah") {
            return <div key={rowNum} className="flex-1" aria-hidden="true" />;
          }

          if (decoration?.kind === "bismillah") {
            return (
              <div
                key={rowNum}
                className="mb-1 flex w-full flex-1 items-center justify-center"
                aria-label="بسم الله الرحمن الرحيم"
              >
                <span
                  aria-hidden="true"
                  className="quran-madani-bismillah whitespace-nowrap overflow-visible text-[5.8cqw] leading-none text-black"
                  style={{ fontFamily: "'qcf-v2-bismillah'" }}
                  translate="no"
                >
                  ﱁ ﱂ ﱃ ﱄ
                </span>
              </div>
            );
          }

          // 3. Empty physical line (spacing for Fatiha/Baqarah frames)
          if (!line || line.words.length === 0) {
            return <div key={rowNum} className="flex-1" />;
          }

          const isEndLine = line.words.some((w) => {
            if (w.type === "end") {
              const [chapter, verse] = w.verseKey.split(":").map(Number);
              return isLastVerse(chapter, verse);
            }
            return false;
          });

          // 4. Regular Verse Line
          const isCentered = pageNumber <= 2
            || isEndLine
            || pageLayout.partialLines.has(rowNum)
            || line.words.length <= 2;

          return (
            <div
              key={rowNum}
              className={cn(
                "quran-madani-line flex min-h-0 w-full flex-1 items-center overflow-visible text-[5.2cqw] leading-none",
                isCentered ? "justify-center gap-[0.2cqw]" : "justify-between"
              )}
            >
              {line.words.map((w, i) => {
                const [wChapter, wVerse] = w.verseKey.split(':').map(Number);
                const isSelected = selectedVerseKey && w.verseKey === selectedVerseKey;
                const isInSelectedRange = selectedVerseRange
                  && wChapter === selectedVerseRange.surah
                  && wVerse >= Math.min(selectedVerseRange.startAyah, selectedVerseRange.endAyah)
                  && wVerse <= Math.max(selectedVerseRange.startAyah, selectedVerseRange.endAyah);
                const isSelectedWord = selectedWordId === w.id;
                const isPlaying = playingVerseKey && w.verseKey === playingVerseKey;
                const isPlayingWord = isPlaying && playingWordPosition === w.position;
                const isBookmarkedVerse = w.type === "end" && bookmarkedVerseKeys?.has(w.verseKey);
                const concealed = isAyahConcealed?.(
                  wChapter,
                  wVerse,
                  w.type === "word" ? w.position : null,
                ) ?? false;

                return (
                  <button
                    key={w.id || i}
                    data-verse-key={w.verseKey}
                    data-quran-tour={w.type === "end" ? "ayah-action" : "word"}
                    title={w.text}
                    aria-label={
                      lang === "ar"
                        ? `${w.text}، الآية ${w.verseKey.split(":")[1]}${isBookmarkedVerse ? "، محفوظة في العلامات" : ""}`
                        : `${w.text}, ayah ${w.verseKey.split(":")[1]}${isBookmarkedVerse ? ", bookmarked" : ""}`
                    }
                    aria-pressed={Boolean(isSelected || isInSelectedRange || isPlaying)}
                    onClick={(e) => {
                      if (w.type === "end") {
                        const anchorRect = e.currentTarget.getBoundingClientRect();
                        onVerseAction?.({
                          verseKey: w.verseKey,
                          wordId: null,
                          wordPosition: null,
                          wordText: null,
                          anchorRect,
                        });
                        return;
                      }
                      onVerseClick?.({
                        verseKey: w.verseKey,
                        wordId: w.type === "word" ? w.id : null,
                        wordPosition: w.type === "word" ? w.position : null,
                        wordText: w.type === "word" ? w.text : null,
                        anchorRect: e.currentTarget.getBoundingClientRect(),
                      });
                    }}
                    type="button"
                    className={cn(
                      "relative m-0 inline-block whitespace-nowrap overflow-visible cursor-pointer appearance-none rounded-sm border-none bg-transparent p-0 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1",
                      w.type === "end" ? "quran-madani-end text-[5.2cqw]" : "",
                      // Apply standard color or highlight colors
                      isSelectedWord
                        ? "text-amber-800 bg-amber-200/70 ring-1 ring-amber-500/50"
                        : isPlayingWord
                        ? "text-emerald-800 bg-emerald-200/90 ring-1 ring-emerald-500/50"
                        : isPlaying && !playingWordPosition
                        ? "text-emerald-700 drop-shadow-[0_0_0_rgba(22,101,52,0.8)] bg-emerald-100/50"
                        : isSelected
                        ? "text-amber-700 drop-shadow-[0_0_0_rgba(180,83,9,0.8)] bg-amber-100/40"
                        : isInSelectedRange
                        ? "text-amber-800 bg-amber-100/60"
                        : w.type === "end"
                        ? "text-[#1d4432] drop-shadow-[0_0_0_rgba(29,68,50,1)] hover:text-emerald-800 hover:bg-emerald-50/50"
                        : "text-black drop-shadow-[0_0_0_rgba(0,0,0,1)] hover:text-emerald-900 hover:bg-emerald-50/50",
                      concealed ? "blur-[4px] opacity-40 hover:blur-[2px] hover:opacity-60 bg-foreground/5" : ""
                    )}
                    style={concealed ? { userSelect: 'none' } : {}}
                  >
                    {w.glyph}
                    {isBookmarkedVerse && (
                      <Bookmark
                        aria-hidden="true"
                        className="absolute -right-[0.8cqw] -top-[1.2cqw] h-[2.8cqw] w-[2.8cqw] fill-emerald-600 text-emerald-700 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
