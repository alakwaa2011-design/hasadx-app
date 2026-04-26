import { isAvatarUrl } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const sizeClasses: Record<Size, { box: string; text: string }> = {
  xs:  { box: "w-5 h-5",   text: "text-xs"   },
  sm:  { box: "w-6 h-6",   text: "text-sm"   },
  md:  { box: "w-7 h-7",   text: "text-base" },
  lg:  { box: "w-8 h-8",   text: "text-lg"   },
  xl:  { box: "w-10 h-10", text: "text-xl"   },
  "2xl": { box: "w-12 h-12", text: "text-2xl" },
  "3xl": { box: "w-16 h-16", text: "text-3xl" },
  "4xl": { box: "w-20 h-20", text: "text-4xl" },
};

export function AvatarDisplay({
  avatar,
  size = "md",
  className = "",
  fallback = "🦁",
}: {
  avatar?: string | null;
  size?: Size;
  className?: string;
  fallback?: string;
}) {
  const value = avatar || fallback;
  const sz = sizeClasses[size];

  if (isAvatarUrl(value)) {
    return (
      <img
        src={value}
        alt=""
        loading="lazy"
        className={cn(
          sz.box,
          "rounded-full object-cover bg-white/10 border border-white/20 shrink-0 inline-block",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center leading-none shrink-0",
        sz.text,
        className,
      )}
    >
      {value}
    </span>
  );
}
