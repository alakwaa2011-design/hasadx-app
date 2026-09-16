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
  chapters?: { id: number; name: string }[];
}

export function QuranMadaniPageRenderer({
  pageNumber,
  isLastVerse,
  fallbackImageUrl,
  onFallbackError,
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
              {line.words.map((w, i) => (
                <span
                  key={w.id || i}
                  title={w.text}
                  aria-label={w.text}
                  className={cn(
                    "inline-block drop-shadow-[0_0_0_rgba(0,0,0,1)]",
                    w.type === "end" && "text-[5.6cqw] text-[#1d4432] drop-shadow-[0_0_0_rgba(29,68,50,1)]"
                  )}
                >
                  {w.glyph}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
