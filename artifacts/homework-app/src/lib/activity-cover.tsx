/**
 * غلاف النشاط — يختار الهوية عبر getActivityCoverTheme ثم يعرض غلافاً مولّداً.
 */
import { cn } from "@/lib/utils";
import {
  getActivityCoverTheme,
  resolveCoverKindLegacy,
  resolveSubjectTheme,
  type ActivityCoverInput,
  type ActivityCoverKind,
  type SubjectTheme,
} from "@/lib/activity-cover-theme";
import { ThemedEducationCover } from "@/lib/themed-education-cover";

export type { ActivityCoverKind, SubjectTheme, ActivityCoverInput };
export {
  getActivityCoverTheme,
  resolveCoverKindLegacy as resolveCoverKind,
  resolveSubjectTheme,
  resolveSubjectThemeId,
} from "@/lib/activity-cover-theme";

export function sanitizeCoverImageUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (/arabic-food/i.test(u)) return undefined;
  if (u.startsWith("/arena-covers/") || u.startsWith("/uploads/") || u.startsWith("/assets/")) return u;
  if (u.startsWith("data:image/")) return u;
  return undefined;
}

export function formatUseCount(n: number | undefined | null, unavailable?: boolean): string {
  if (unavailable) return "";
  if (n == null || Number.isNaN(n)) return "";
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export interface ActivityCoverProps {
  kind: ActivityCoverKind;
  subject?: string | null;
  title?: string;
  type?: string | null;
  tags?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  className?: string;
  aspect?: "video" | "photo" | "thumb";
  premium?: boolean;
  livePulse?: boolean;
  children?: React.ReactNode;
}

function toActivityInput(props: ActivityCoverProps): ActivityCoverInput {
  const activityKind =
    props.kind === "video"
      ? "video"
      : props.kind === "interactive"
        ? "question"
        : "assignment";
  return {
    subject: props.subject,
    title: props.title,
    type: props.type,
    tags: props.tags,
    activityKind,
    featuredLive: props.livePulse && (props.kind === "live" || props.kind === "featured-live"),
  };
}

export function ActivityCover({
  kind,
  subject,
  title,
  type,
  tags,
  imageUrl,
  thumbnailUrl,
  className,
  aspect = "video",
  premium = false,
  livePulse = false,
  children,
}: ActivityCoverProps) {
  const safeImage = sanitizeCoverImageUrl(imageUrl);
  const hasCustomImage = !!(thumbnailUrl || safeImage);

  const coverTheme = getActivityCoverTheme({
    ...toActivityInput({
      kind,
      subject,
      title,
      type,
      tags,
      imageUrl,
      thumbnailUrl,
      className,
      aspect,
      premium,
      livePulse,
      children,
    }),
    featuredLive: livePulse && (kind === "live" || kind === "featured-live"),
  });

  if (hasCustomImage) {
    return (
      <LegacyImageCover
        src={thumbnailUrl || safeImage!}
        aspect={aspect}
        className={className}
        premium={premium}
        livePulse={livePulse}
        kind={kind}
      >
        {children}
      </LegacyImageCover>
    );
  }

  return (
    <ThemedEducationCover
      theme={coverTheme}
      aspect={aspect}
      premium={premium}
      livePulse={livePulse}
      className={className}
    >
      {children}
    </ThemedEducationCover>
  );
}

/** صورة مرفوعة / مصغّرة فقط — نادراً */
function LegacyImageCover({
  src,
  aspect,
  className,
  premium,
  livePulse,
  kind,
  children,
}: {
  src: string;
  aspect: "video" | "photo" | "thumb";
  className?: string;
  premium?: boolean;
  livePulse?: boolean;
  kind: ActivityCoverKind;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#1f2d24]",
        aspect === "video" && "aspect-video",
        aspect === "photo" && "aspect-[4/3]",
        aspect === "thumb" && "aspect-square",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(0,0,0,0.4) 0%, transparent 55%)",
        }}
      />
      {premium && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
      )}
      {livePulse && (
        <div
          className="pointer-events-none absolute right-[20%] top-[25%] h-20 w-20 rounded-full bg-amber-200/20 blur-2xl"
          style={{ animation: "activity-cover-pulse 4.5s ease-in-out infinite" }}
        />
      )}
      {children}
    </div>
  );
}
