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
  variant?: "header" | "compact" | "menu";
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

  if (!user) return null;

  const isAdmin = Boolean(user.isAdmin) || user.role === "admin";
  const isOrganizer = isAdmin || user.role === "organizer";

  const current: Surface = location.startsWith("/organizer")
    ? "organizer"
    : location.startsWith("/teacher/admin")
      ? "admin"
      : "teacher";

  const allItems: {
    key: Surface;
    label: string;
    href: string;
    Icon: LucideIcon;
    visible: boolean;
  }[] = [
    {
      key: "teacher",
      label: lang === "ar" ? "معلّم" : "Teacher",
      href: "/teacher",
      Icon: GraduationCap,
      visible: true,
    },
    {
      key: "organizer",
      label: lang === "ar" ? "منظّم" : "Organizer",
      href: "/organizer",
      Icon: Users,
      visible: isOrganizer,
    },
    {
      key: "admin",
      label: lang === "ar" ? "مسؤول" : "Admin",
      href: "/teacher/admin",
      Icon: ShieldCheck,
      visible: isAdmin,
    },
  ];
  const items = allItems.filter((i) => i.visible);
  if (items.length < 2) return null;

  const currentItem = items.find((i) => i.key === current) ?? items[0];
  const CurrentIcon = currentItem.Icon;
  const isCompact = variant === "compact";
  const isMenu = variant === "menu";

  // "menu" variant: full-width row inside the mobile hamburger menu
  if (isMenu) {
    return (
      <div ref={ref} className="relative mb-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted active:bg-muted/80 transition-colors"
        >
          <CurrentIcon className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 text-start">
            {lang === "ar"
              ? `الدور الحالي: ${currentItem.label}`
              : `Current role: ${currentItem.label}`}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
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
              className="mt-1 rounded-xl overflow-hidden border border-border shadow-md bg-background"
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
                      "w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 text-start">{it.label}</span>
                    {active && <Check className="w-4 h-4 stroke-[3] text-primary" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

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
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.95)",
          borderColor: "#C9A050",
          borderWidth: 1,
        }}
      >
        <CurrentIcon
          className={cn(
            "text-[#C9A050]",
            isCompact ? "w-3 h-3" : "w-3.5 h-3.5",
          )}
        />
        <span>
          {lang === "ar"
            ? `الدور الحالي: ${currentItem.label}`
            : `Current role: ${currentItem.label}`}
        </span>
        <ChevronDown
          className={cn(
            "text-[#C9A050] transition-transform",
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
