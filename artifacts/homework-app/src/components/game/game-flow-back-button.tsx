import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface GameFlowBackButtonProps {
  onBack: () => void;
  label?: string;
  className?: string;
  testId?: string;
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
  testId,
}: GameFlowBackButtonProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const BackIcon = ar ? ChevronRight : ChevronLeft;
  const accessibleLabel = label || (ar ? "رجوع" : "Back");

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onBack}
      aria-label={accessibleLabel}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 touch-manipulation",
        className,
      )}
    >
      <BackIcon className="h-4 w-4 shrink-0" />
    </button>
  );
}