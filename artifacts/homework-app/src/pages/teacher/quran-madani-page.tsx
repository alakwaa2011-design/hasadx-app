import { useEffect, useState } from "react";
import { useGetQuranMadaniPage, getGetQuranMadaniPageQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface QuranMadaniPageRendererProps {
  pageNumber: number;
  isLastVerse: (chapterId: number, verseNumber: number) => boolean;
  fallbackImageUrl: string;
  onFallbackError?: () => void;
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
    const fontUrl = `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;
    const fontName = `qcf-v2-p${pageNumber}`;
    setFontState("loading");
    const fontFace = new FontFace(fontName, `url('${fontUrl}')`, {
      display: "block",
    });
    fontFace.load()
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
      className="@container relative w-full select-none bg-[#fdfaf6] text-black"
      style={{ aspectRatio: "382.677/547.086" }}
      dir="rtl"
      translate="no"
    >
      <div
        className="flex h-full w-full flex-col px-[8.5%] py-[9.5%]"
        style={{ fontFamily: `'${fontName}', sans-serif` }}
      >
        {rows.map((rowNum) => {
          const line = data.lines.find((l) => l.lineNumber === rowNum);
          if (!line || line.words.length === 0) {
            // Empty row (e.g. for Surah frames on page 1/2)
            return <div key={rowNum} className="flex-1" />;
          }

          const isEndLine = line.words.some((w) => {
            if (w.type === "end") {
              const [chapter, verse] = w.verseKey.split(":").map(Number);
              return isLastVerse(chapter, verse);
            }
            return false;
          });

          const isHeading = line.words.some(
            (w) => w.type === "surah_name" || w.type === "bismillah"
          );

          // If a line is an end line or heading, or has very few words, it is centered.
          const isCentered = isHeading || isEndLine || line.words.length <= 2;

          return (
            <div
              key={rowNum}
              className={cn(
                "flex w-full flex-1 items-center text-[5.2cqw] leading-none",
                isCentered ? "justify-center gap-1.5" : "justify-between"
              )}
            >
              {line.words.map((w, i) => (
                <span
                  key={i}
                  title={w.text}
                  aria-label={w.text}
                  className={cn(
                    "inline-block",
                    w.type === "end" && "text-[5.5cqw]",
                    (w.type === "surah_name" || w.type === "bismillah") &&
                      "text-[6.2cqw]"
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
