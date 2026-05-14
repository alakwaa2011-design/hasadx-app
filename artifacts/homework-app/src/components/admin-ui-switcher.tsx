import { useLocation } from "wouter";
import {
  Crown,
  GraduationCap,
  Users,
  ShieldCheck,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  setAdminLastSurface,
  type AdminSurface as Surface,
} from "@/lib/admin-last-surface";

interface AdminUiSwitcherProps {
  /**
   * `header` (default) renders a compact pill row designed to live inside the
   * top navigation bar. `compact` is the same idea but shrinks the labels for
   * tight mobile headers.
   */
  variant?: "header" | "compact";
}

/**
 * Admin-only quick switcher between the three main UI surfaces
 * (teacher dashboard / organizer dashboard / admin view). Renders nothing for
 * non-admins. The active surface is auto-detected from the current URL so
 * callers don't need to thread a `current` prop through every page.
 *
 * Designed to be mounted inside the top header of the shared Layout.
 */
export function AdminUiSwitcher({ variant = "header" }: AdminUiSwitcherProps) {
  const { lang } = useI18n();
  const [location, setLocation] = useLocation();
  const { data: user } = useGetCurrentTeacher();

  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  if (!isAdmin) return null;

  const current: Surface = location.startsWith("/organizer")
    ? "organizer"
    : location.startsWith("/teacher/admin")
      ? "admin"
      : "teacher";

  const items: {
    key: Surface;
    label: string;
    href: string;
    Icon: LucideIcon;
  }[] = [
    {
      key: "teacher",
      label: lang === "ar" ? "معلّم" : "Teacher",
      href: "/teacher",
      Icon: GraduationCap,
    },
    {
      key: "organizer",
      label: lang === "ar" ? "منظّم" : "Organizer",
      href: "/organizer",
      Icon: Users,
    },
    {
      key: "admin",
      label: lang === "ar" ? "مسؤول" : "Admin",
      href: "/teacher/admin",
      Icon: ShieldCheck,
    },
  ];

  const isCompact = variant === "compact";

  return (
    <div
      role="toolbar"
      aria-label={lang === "ar" ? "بدّل الواجهة (مسؤول)" : "Switch UI (admin)"}
      className={cn(
        "flex items-center",
        isCompact ? "gap-1" : "gap-1.5",
      )}
    >
      <Crown
        className={cn("text-[#E8A80E]", isCompact ? "w-3 h-3" : "w-3.5 h-3.5")}
      />
      {items.map((it) => {
        const active = it.key === current;
        const Icon = it.Icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => {
              setAdminLastSurface(it.key);
              if (!active) setLocation(it.href);
            }}
            aria-pressed={active}
            title={it.label}
            className={cn(
              "inline-flex items-center font-bold rounded-full transition-all whitespace-nowrap border",
              isCompact
                ? "gap-1 px-2.5 py-1 text-[10px]"
                : "gap-1.5 px-3 py-1 text-xs",
            )}
            style={{
              background: active
                ? "linear-gradient(135deg,#E8A80E 0%,#f5c34a 100%)"
                : "transparent",
              color: active ? "#1a4731" : "rgba(255,255,255,0.92)",
              borderColor: active
                ? "transparent"
                : "rgba(232,168,14,0.55)",
              boxShadow: active
                ? "0 4px 12px -4px rgba(232,168,14,0.55)"
                : "none",
            }}
          >
            <Icon className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            <span>{it.label}</span>
            {active && (
              <Check
                className={cn(
                  "stroke-[3]",
                  isCompact ? "w-2.5 h-2.5" : "w-3 h-3",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
