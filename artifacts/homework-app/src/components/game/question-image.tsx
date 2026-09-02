import { useEffect, useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { resolveImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

interface QuestionImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

export function QuestionImage({ src, alt = "", className, style }: QuestionImageProps) {
  const { lang } = useI18n();
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveImageUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc) return null;

  if (failed) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50/95 px-3 py-2 text-center text-xs font-bold text-amber-900"
      >
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>
          {lang === "ar"
            ? "تعذّر تحميل الصورة؛ قد يمنع موقعها العرض المباشر. جرّب رفعها من الجهاز."
            : "The image could not load. Its website may block direct display; try uploading it from your device."}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={cn("object-contain", className)}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}