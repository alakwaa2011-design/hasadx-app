import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface GameFlowBackButtonProps {
  onBack: () => void;
  label?: string;
  className?: string;
}

/**
 * Back control for game setup flows.
 *
 * Unlike the browser back button, the caller owns the previous step. This
 * keeps direct links and multi-step setup screens inside the app.
 */
export function GameFlowBackButton({
  onBack,
  label,
  className,
}: GameFlowBackButtonProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const BackIcon = ar ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={label || (ar ? "الرجوع خطوة" : "Go back one step")}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 py-2 text-sm font-bold text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20",
        className,
      )}
    >
      <BackIcon className="h-4 w-4 shrink-0" />
      <span>{label || (ar ? "رجوع خطوة" : "Back one step")}</span>
    </button>
  );
}