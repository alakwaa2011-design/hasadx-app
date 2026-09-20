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
      onClick: onCopy,
      testId: "action-copy",
    },
    {
      icon: Layers,
      label: lang === "ar" ? "نسخ متعدد" : "Select Range",
      onClick: onMultiCopy,
      testId: "action-multi-copy",
    },
  ];

  const content = (
    <div className="grid grid-cols-3 gap-2 pb-6 pt-4 sm:grid-cols-5" dir={dir}>
      {actions.map((action, i) => (
        <button
          key={i}
          data-testid={action.testId}
          onClick={() => {
            action.onClick();
            onOpenChange(false);
          }}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-3 text-emerald-950 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-50 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
        >
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
            action.active && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
          )}>
            <action.icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-center">{action.label}</span>
        </button>
      ))}
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
