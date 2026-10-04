import { ChevronDown, FileType, Loader2 } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type WorksheetWordMode = "visual" | "editable";

export function WorksheetWordExportMenu({
  ar, onExport, disabled, busy, progress, testId, className,
}: {
  ar: boolean;
  onExport: (mode: WorksheetWordMode) => void;
  disabled?: boolean;
  busy?: boolean;
  progress?: string;
  testId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu dir={ar ? "rtl" : "ltr"} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} aria-busy={busy} data-testid={testId}
          onPointerDown={event => {
            // Open after pointer-up, not underneath a still-pressed pointer.
            // A collision-flipped mobile menu can otherwise select its first
            // item while the user is only trying to open the choices.
            if (event.button === 0 && !event.ctrlKey) event.preventDefault();
          }}
          onClick={() => setOpen(current => !current)}
          title={ar ? "اختر طريقة حفظ Word" : "Choose a Word version"}
          className={className}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
          {busy ? (ar ? "جارٍ التصدير" : "Exporting") : "Word"}
          {progress && <span className="text-xs" dir="ltr">{progress}</span>}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[120] w-72">
        <DropdownMenuItem onSelect={() => { setOpen(false); onExport("visual"); }} disabled={disabled}
          data-testid="word-export-visual" className="flex-col items-start gap-1 py-3">
          <span className="font-bold">{ar ? "Word كصورة — مطابق للتصميم" : "Word as images — original design"}</span>
          <span className="text-xs text-muted-foreground">{ar ? "يحفظ الصفحات والأشكال كما تظهر. النص داخل الصور غير قابل للتعديل." : "Preserves each page and its shapes. Text inside images is not editable."}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { setOpen(false); onExport("editable"); }} disabled={disabled}
          data-testid="word-export-editable" className="flex-col items-start gap-1 py-3">
          <span className="font-bold">{ar ? "Word قابل للتعديل" : "Editable Word"}</span>
          <span className="text-xs text-muted-foreground">{ar ? "نصوص وجداول قابلة للتعديل مع أقرب تنسيق ممكن؛ قد يختلف قليلًا في Word." : "Editable text and tables with close formatting; Word may render small differences."}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}