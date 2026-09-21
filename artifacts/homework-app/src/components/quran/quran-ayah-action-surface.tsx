import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/lib/i18n";
import { Play, Copy, BookOpen, Layers, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuranAyahActionSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verseKey: string;
  isBookmarked: boolean;
  onPlay: () => void;
  onCopy: () => void;
  onMultiCopy: () => void;
  onBookmark: () => void;
  onTafsir: () => void;
}

export function QuranAyahActionSurface({
  open,
  onOpenChange,
  verseKey,
  isBookmarked,
  onPlay,
  onCopy,
  onMultiCopy,
  onBookmark,
  onTafsir,
}: QuranAyahActionSurfaceProps) {
  const isMobile = useIsMobile();
  const { lang, dir } = useI18n();
  const [copyOptionsOpen, setCopyOptionsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopyOptionsOpen(false);
  }, [open]);

  const title = lang === "ar"
    ? `خيارات الآية ${verseKey.split(":")[1]}`
    : `Ayah ${verseKey.split(":")[1]} Options`;

  const actions = [
    {
      icon: Play,
      label: lang === "ar" ? "تلاوة" : "Play",
      onClick: onPlay,
      testId: "action-play",
    },
    {
      icon: BookOpen,
      label: lang === "ar" ? "تفسير" : "Tafsir",
      onClick: onTafsir,
      testId: "action-tafsir",
    },
    {
      icon: Bookmark,
      label: lang === "ar" ? (isBookmarked ? "إزالة العلامة" : "علامة") : (isBookmarked ? "Remove Bookmark" : "Bookmark"),
      onClick: onBookmark,
      testId: "action-bookmark",
      active: isBookmarked,
    },
    {
      icon: Copy,
      label: lang === "ar" ? "نسخ" : "Copy",
      onClick: () => setCopyOptionsOpen(true),
      testId: "action-copy",
      keepOpen: true,
    },
  ];

  const content = (
    <div className="pb-3 pt-2" dir={dir}>
      <div className="grid grid-cols-4 gap-1">
        {actions.map((action, i) => (
          <button
            key={i}
            data-testid={action.testId}
            onClick={() => {
              action.onClick();
              if (!action.keepOpen) onOpenChange(false);
            }}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-emerald-950 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-50 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
          >
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
              action.active && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
            )}>
              <action.icon className="h-4 w-4" />
            </div>
            <span className="line-clamp-1 text-center text-[11px] font-bold">{action.label}</span>
          </button>
        ))}
      </div>
      {copyOptionsOpen && (
        <div className="mt-3 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-2 dark:border-white/10 dark:bg-emerald-950/30">
          <p className="px-2 pb-2 text-xs font-black text-emerald-950 dark:text-emerald-50">
            {lang === "ar" ? "ماذا تريد أن تنسخ؟" : "What would you like to copy?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="action-copy-current"
              onClick={() => {
                onCopy();
                onOpenChange(false);
              }}
              className="flex min-h-16 items-center gap-2 rounded-xl bg-white px-3 py-2 text-start text-xs font-bold text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10"
            >
              <Copy className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              {lang === "ar" ? "نسخ الآية الحالية" : "Copy this ayah"}
            </button>
            <button
              type="button"
              data-testid="action-copy-range"
              onClick={() => {
                onMultiCopy();
                onOpenChange(false);
              }}
              className="flex min-h-16 items-center gap-2 rounded-xl bg-white px-3 py-2 text-start text-xs font-bold text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100 dark:bg-white/5 dark:text-emerald-50 dark:hover:bg-white/10"
            >
              <Layers className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              {lang === "ar" ? "تحديد عدة آيات" : "Select multiple ayahs"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-center">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {lang === "ar"
                ? "اختر إجراءً للآية المحددة"
                : "Choose an action for the selected ayah"}
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {lang === "ar"
              ? "اختر إجراءً للآية المحددة"
              : "Choose an action for the selected ayah"}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
