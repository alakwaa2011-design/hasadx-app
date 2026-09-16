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

function SurahHeaderBox({ name }: { name: string }) {
  return (
    <div className="relative flex w-[92%] mx-auto h-[7cqw] items-center justify-center overflow-hidden rounded-sm bg-[#fdfaf6] mb-[0.5cqw]">
      {/* Background Frame */}
      <div className="absolute inset-0 border-[1.5px] border-[#1d4432] flex items-center justify-between px-2">
        <div className="absolute inset-[2.5px] border border-[#1d4432]/30" />
        <div className="w-[3.5cqw] h-[3.5cqw] border-[1.5px] border-[#1d4432] rotate-45 bg-[#fdfaf6] shadow-[0_0_0_4px_#fdfaf6] z-10" />
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#1d4432]/20" />
        <div className="w-[3.5cqw] h-[3.5cqw] border-[1.5px] border-[#1d4432] rotate-45 bg-[#fdfaf6] shadow-[0_0_0_4px_#fdfaf6] z-10" />
      </div>

      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#1d4432 1px, transparent 1px)', backgroundSize: '0.8cqw 0.8cqw' }}
      />

      {/* Surah name */}
      <div className="relative z-20 text-[#1d4432] flex items-center justify-center px-6 bg-[#fdfaf6] min-w-[20cqw]">
        <span className="text-[4.5cqw] font-bold pb-1 drop-shadow-[0_1px_1px_rgba(253,250,246,1)]">
          سُورَةُ {name}
        </span>
      </div>
    </div>
  );
}

function MushafPageDecorations({
  pageNumber,
  surahName,
  juzNumber,
  hizbNumber,
}: {
  pageNumber: number;
  surahName: string;
  juzNumber: number;
  hizbNumber: number;
}) {
  const formattedPageNumber = new Intl.NumberFormat("ar-u-nu-arab", {
    useGrouping: false,
  }).format(pageNumber);

  // Opening pages use the traditional wide central panel.
  if (pageNumber === 1 || pageNumber === 2) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-[4.5%]">
        <div className="absolute inset-[4.5%] rounded-[2.2cqw] border-[4px] border-double border-[#1d4432]/70" />
        <div className="absolute inset-[6.2%] rounded-[1.4cqw] border border-[#1d4432]/35" />
        <div className="absolute inset-x-[8%] top-[13%] bottom-[11%] rounded-t-[48%_10%] rounded-b-[48%_10%] border-[1.5px] border-[#1d4432]/45 shadow-[inset_0_0_0_3px_rgba(29,68,50,0.04)]" />
        <div className="absolute bottom-[5.2%] left-1/2 -translate-x-1/2 flex items-center justify-center w-[9cqw] h-[9cqw] bg-[#fdfaf6] border-[1.5px] border-[#1d4432] rotate-45 shadow-[0_0_0_3px_#fdfaf6]">
          <span className="-rotate-45 pt-1 text-[#1d4432] font-bold text-[3.5cqw]">{formattedPageNumber}</span>
        </div>
      </div>
    );
  }

  // Standard Madani frame for all other pages
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-[4.5%]">
      {/* Outer Border Box */}
      <div className="absolute top-[4%] bottom-[4%] left-[4.5%] right-[4.5%] border-[1.5px] border-[#1d4432]">
        <div className="absolute inset-[3px] border border-[#1d4432]/50" />
        <div className="absolute inset-[6px] border border-[#1d4432]/30" />

        {/* Decorative corner cutouts */}
        <div className="absolute -top-[4px] -right-[4px] w-[3cqw] h-[3cqw] border-[1.5px] border-[#1d4432] bg-[#fdfaf6]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
        <div className="absolute -top-[4px] -left-[4px] w-[3cqw] h-[3cqw] border-[1.5px] border-[#1d4432] bg-[#fdfaf6]" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
        <div className="absolute -bottom-[4px] -right-[4px] w-[3cqw] h-[3cqw] border-[1.5px] border-[#1d4432] bg-[#fdfaf6]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
        <div className="absolute -bottom-[4px] -left-[4px] w-[3cqw] h-[3cqw] border-[1.5px] border-[#1d4432] bg-[#fdfaf6]" style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
      </div>

      {/* Top Margin Headers */}
      <div className="absolute top-[4.5%] h-[4%] left-[6%] right-[6%] flex items-center justify-between px-[2%] text-[#1d4432]">
        {/* Right side: Surah */}
        <div className="font-bold text-[2.8cqw] bg-[#fdfaf6] px-4 border-[1.5px] border-[#1d4432]/80 rounded-full pb-0.5 shadow-[0_0_0_3px_#fdfaf6]">
          سورة {surahName}
        </div>
        {/* Left side: Juz/Hizb */}
        <div className="font-bold text-[2.8cqw] bg-[#fdfaf6] px-4 border-[1.5px] border-[#1d4432]/80 rounded-full pb-0.5 flex items-center gap-1.5 shadow-[0_0_0_3px_#fdfaf6]">
          <span>الجزء {juzNumber}</span>
          {hizbNumber > 0 && (
            <>
              <span className="opacity-50 text-[2cqw]">•</span>
              <span className="opacity-80">حزب {hizbNumber}</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Page Number Medallion */}
      <div className="absolute bottom-[1.5%] left-0 right-0 flex justify-center">
        <div className="relative flex items-center justify-center w-[9.5cqw] h-[9.5cqw] bg-[#fdfaf6] border-[1.5px] border-[#1d4432] rounded-full shadow-[0_0_0_4px_#fdfaf6]">
          <div className="absolute inset-[3px] border border-[#1d4432]/40 rounded-full border-dashed" />
          <span className="relative z-10 font-bold text-[#1d4432] text-[4cqw] leading-none pt-1">
             {formattedPageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

export function QuranMadaniPageRenderer({
  pageNumber,
  isLastVerse,
  fallbackImageUrl,
  onFallbackError,
  chapters = [],
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

  // Extract Surah name for the header based on the first verse on this page
  const headerSurahName = useMemo(() => {
    if (!data) return "";
    const firstWordWithVerse = data.lines.flatMap((l) => l.words).find((w) => w.verseKey);
    const firstSurahId = firstWordWithVerse
      ? parseInt(firstWordWithVerse.verseKey.split(":")[0], 10)
      : data.surahStarts?.[0]?.surahNumber || 1;
    const surah = chapters.find((c) => c.id === firstSurahId);
    return surah ? surah.name.replace(/^سورة\s+/, "") : "";
  }, [data, chapters]);

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
      <MushafPageDecorations
        pageNumber={pageNumber}
        surahName={headerSurahName}
        juzNumber={data.juzNumber}
        hizbNumber={data.hizbNumber || 0}
      />

      <div
        className="relative z-20 flex h-full w-full flex-col px-[8.5%] py-[9.5%]"
        style={{ fontFamily: `'${fontName}', sans-serif` }}
      >
        {rows.map((rowNum) => {
          const line = data.lines.find((l) => l.lineNumber === rowNum);
          const decoration = pageLayout.decorations.get(rowNum);

          if (decoration?.kind === "surah") {
            const surah = chapters.find((chapter) => chapter.id === decoration.surahNumber);

            return (
              <div key={rowNum} className="relative flex w-full flex-1 items-center justify-center h-[7cqw]">
                <SurahHeaderBox name={surah ? surah.name.replace(/^سورة\s+/, "") : ""} />
              </div>
            );
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
