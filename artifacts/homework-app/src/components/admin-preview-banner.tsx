import { Link, useLocation } from "wouter";
import { Eye, ShieldCheck, GraduationCap, Users } from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

type PreviewSurface = "teacher" | "organizer";

/** Admin preview banner with a one-tap swap to the opposite surface. */
export function AdminPreviewBanner() {
  const { lang } = useI18n();
  const [location] = useLocation();
  const { data: user } = useGetCurrentTeacher();

  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  if (!isAdmin) return null;

  if (location.startsWith("/teacher/admin")) return null;

  let surface: PreviewSurface | null = null;
  if (location.startsWith("/organizer")) {
    surface = "organizer";
  } else if (location.startsWith("/teacher")) {
    surface = "teacher";
  }
  if (!surface) return null;

  const roleLabel =
    surface === "organizer"
      ? lang === "ar"
        ? "منظّم"
        : "organizer"
      : lang === "ar"
        ? "معلّم"
        : "teacher";

  const message =
    lang === "ar"
      ? `أنت تشاهد كـ${roleLabel}`
      : `You are previewing as ${roleLabel}`;

  const swapHref = surface === "teacher" ? "/organizer" : "/teacher";
  const swapLabel =
    surface === "teacher"
      ? lang === "ar"
        ? "العودة لوضع المنظّم"
        : "Back to Organizer"
      : lang === "ar"
        ? "العودة لوضع المعلّم"
        : "Back to Teacher";
  const SwapIcon = surface === "teacher" ? Users : GraduationCap;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-12 sm:top-14 z-40 w-full border-b shadow-sm"
      style={{
        background:
          "linear-gradient(90deg, rgba(20,30,25,0.96) 0%, rgba(28,42,34,0.96) 100%)",
        borderColor: "rgba(232,168,14,0.45)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-1.5 text-xs sm:text-[13px]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex items-center gap-1 font-extrabold uppercase tracking-wider whitespace-nowrap"
              style={{ color: "#E8A80E" }}
            >
              <Eye className="w-3.5 h-3.5" />
              {lang === "ar" ? "معاينة" : "Preview"}
            </span>
            <span
              className="hidden sm:inline opacity-60"
              style={{ color: "#E8A80E" }}
            >
              ·
            </span>
            <span className="font-semibold text-white/90 truncate hidden xs:inline sm:inline">
              {message}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href={swapHref}
              className="inline-flex items-center gap-1.5 font-bold rounded-full px-2.5 sm:px-3 py-1 transition-all whitespace-nowrap"
              style={{
                background:
                  "linear-gradient(135deg,#E8A80E 0%,#f5c34a 100%)",
                color: "#1a4731",
                boxShadow: "0 4px 12px -4px rgba(232,168,14,0.55)",
              }}
            >
              <SwapIcon className="w-3.5 h-3.5" />
              <span>{swapLabel}</span>
            </Link>
            <Link
              href="/teacher/admin"
              title={lang === "ar" ? "لوحة المسؤول" : "Admin home"}
              className="hidden sm:inline-flex items-center gap-1 font-bold rounded-full px-2.5 py-1 transition-all whitespace-nowrap text-[11px] border"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(232,168,14,0.35)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <ShieldCheck className="w-3 h-3" style={{ color: "#E8A80E" }} />
              <span>{lang === "ar" ? "مسؤول" : "Admin"}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
