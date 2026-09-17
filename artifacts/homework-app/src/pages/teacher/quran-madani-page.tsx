import { useEffect, useState, useMemo } from "react";
import { useGetQuranMadaniPage, getGetQuranMadaniPageQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
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
  isAyahConcealed?: (chapterId: number, verseNumber: number) => boolean;
  onVerseClick?: (selection: {
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
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
  isAyahConcealed,
  onVerseClick,
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

  return (
    <div
      className="@container relative w-full select-none bg-[#fdfaf6] text-black overflow-hidden rounded-[2px]"
      style={{ aspectRatio: "382.677/547.086" }}
      dir="rtl"
      translate="no"
    >
      <div
        className="relative z-20 flex h-full w-full flex-col px-[8.5%] py-[9.5%]"
        style={{ fontFamily: `'${fontName}', sans-serif` }}
      >
        {rows.map((rowNum) => {
          const line = data.lines.find((l) => l.lineNumber === rowNum);
          const decoration = pageLayout.decorations.get(rowNum);

          if (decoration?.kind === "surah") {
            return <div key={rowNum} className="flex-1" aria-hidden="true" />;
          }

          if (decoration?.kind === "bismillah") {
            return (
              <div
                key={rowNum}
                className="flex w-full flex-1 items-center justify-center text-[5.5cqw] leading-none mb-1 text-[#1d4432]"
                aria-label="بسم الله الرحمن الرحيم"
              >
                <span className="font-serif text-[6cqw] pb-1" translate="no">
                  ﷽
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
                "flex w-full flex-1 items-center text-[5.2cqw] leading-none",
                isCentered ? "justify-center gap-[1.5cqw]" : "justify-between"
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
                const concealed = isAyahConcealed?.(wChapter, wVerse) ?? false;

                return (
                  <button
                    key={w.id || i}
                    title={w.text}
                    aria-label={
                      lang === "ar"
                        ? `${w.text}، الآية ${w.verseKey.split(":")[1]}`
                        : `${w.text}, ayah ${w.verseKey.split(":")[1]}`
                    }
                    aria-pressed={Boolean(isSelected || isInSelectedRange || isPlaying)}
                    onClick={() => onVerseClick?.({
                      verseKey: w.verseKey,
                      wordId: w.type === "word" ? w.id : null,
                      wordPosition: w.type === "word" ? w.position : null,
                      wordText: w.type === "word" ? w.text : null,
                    })}
                    type="button"
                    className={cn(
                      "relative m-0 inline-block whitespace-nowrap cursor-pointer appearance-none rounded-sm border-none bg-transparent p-0 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1",
                      w.type === "end" ? "text-[5.6cqw]" : "",
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
