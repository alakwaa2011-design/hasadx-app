import type { ReactNode } from "react";

/** Keep an activity and its controls together, including at projector widths. */
export function ActivityControlRow({
  label,
  detail,
  active = false,
  children,
}: {
  label: string;
  detail?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
        active ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="min-w-0 sm:max-w-md">
        <div className="break-words text-sm font-bold leading-relaxed text-white">{label}</div>
        {detail && <div className="mt-1 text-xs text-amber-200/90">{detail}</div>}
      </div>
      <div
        role="group"
        aria-label={label}
        className="flex shrink-0 flex-wrap items-center gap-2 sm:shrink [&_button]:min-h-11 [&_button]:shrink-0 [&_button]:rounded-lg [&_button]:text-sm [&_button]:font-bold"
      >
        {children}
      </div>
    </div>
  );
}
