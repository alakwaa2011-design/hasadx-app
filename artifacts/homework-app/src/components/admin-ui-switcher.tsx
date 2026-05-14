import { useLocation } from "wouter";
import { Crown, Users, ShieldCheck, type LucideIcon } from "lucide-react";
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

  const current: Surface | null = location.startsWith("/organizer")
    ? "organizer"
    : location.startsWith("/teacher/admin")
      ? "admin"
      : null;

  const items: {
    key: Surface;
    label: string;
    href: string;
    Icon: LucideIcon;
  }[] = [
    {
      key: "organizer",
      label: lang === "ar" ? "كمنظّم" : "As organizer",
      href: "/organizer",
      Icon: Users,
    },
    {
      key: "admin",
      label: lang === "ar" ? "كمسؤول" : "As admin",
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
        "flex items-center rounded-full border shadow-sm",
        isCompact ? "gap-0.5 px-1 py-0.5" : "gap-1 px-1.5 py-1",
      )}
      style={{
        background: "rgba(20, 30, 25, 0.92)",
        borderColor: "rgba(232,168,14,0.45)",
      }}
    >
      <span
        className={cn(
          "flex items-center font-extrabold uppercase tracking-wider select-none",
          isCompact ? "px-1.5 text-[9px] gap-0.5" : "px-2 text-[10px] gap-1",
        )}
        style={{ color: "#E8A80E" }}
      >
        <Crown className="w-3 h-3" />
        {!isCompact && (lang === "ar" ? "مسؤول" : "Admin")}
      </span>
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
              "inline-flex items-center font-bold rounded-full transition-all whitespace-nowrap",
              isCompact
                ? "gap-1 px-2 py-1 text-[10px]"
                : "gap-1.5 px-2.5 py-1 text-xs",
            )}
            style={{
              background: active
                ? "linear-gradient(135deg,#E8A80E 0%,#f5c34a 100%)"
                : "transparent",
              color: active ? "#1a4731" : "rgba(255,255,255,0.85)",
              boxShadow: active
                ? "0 4px 12px -4px rgba(232,168,14,0.55)"
                : "none",
            }}
          >
            <Icon className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
