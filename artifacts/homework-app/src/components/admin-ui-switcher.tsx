import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  GraduationCap,
  Users,
  ShieldCheck,
  Check,
  ChevronDown,
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
  variant?: "header" | "compact";
}

export function AdminUiSwitcher({ variant = "header" }: AdminUiSwitcherProps) {
  const { lang } = useI18n();
  const [location, setLocation] = useLocation();
  const { data: user } = useGetCurrentTeacher();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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

  const currentItem = items.find((i) => i.key === current) ?? items[0];
  const CurrentIcon = currentItem.Icon;
  const isCompact = variant === "compact";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center font-bold rounded-full transition-all whitespace-nowrap border",
          isCompact
            ? "gap-1 px-2.5 py-1 text-[10px]"
            : "gap-1.5 px-3 py-1.5 text-xs",
        )}
        style={{
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.95)",
          borderColor: "rgba(201,160,80,0.6)",
        }}
      >
        <CurrentIcon className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>
          {lang === "ar"
            ? `الدور الحالي: ${currentItem.label}`
            : `Current role: ${currentItem.label}`}
        </span>
        <ChevronDown
          className={cn(
            "transition-transform",
            isCompact ? "w-3 h-3" : "w-3.5 h-3.5",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            role="menu"
            className="absolute end-0 top-full mt-2 w-56 rounded-xl py-1.5 z-50 shadow-lg"
            style={{
              background: "#ffffff",
              border: "1px solid #C9A050",
            }}
          >
            {items.map((it) => {
              const active = it.key === current;
              const Icon = it.Icon;
              return (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAdminLastSurface(it.key);
                    setOpen(false);
                    if (!active) setLocation(it.href);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold transition-colors text-right",
                    active
                      ? "bg-[#FFF7E3] text-[#1E4D35]"
                      : "text-[#1E4D35] hover:bg-[#F7F4EC]",
                  )}
                >
                  <Icon className="w-4 h-4 text-[#C9A050]" />
                  <span className="flex-1">{it.label}</span>
                  {active && (
                    <Check className="w-4 h-4 stroke-[3] text-[#C9A050]" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
