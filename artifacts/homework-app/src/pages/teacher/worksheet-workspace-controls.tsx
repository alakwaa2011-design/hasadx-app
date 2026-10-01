import { PenLine, Eye } from "lucide-react";

const BRAND = "#225739";

export function WorksheetModeSwitch({ ar, mode, onChange, disabled }: {
  ar: boolean;
  mode: "edit" | "preview";
  onChange: (mode: "edit" | "preview") => void;
  disabled?: boolean;
}) {
  const items = [
    { id: "edit" as const, label: ar ? "تعديل الورقة" : "Edit", icon: <PenLine className="w-4 h-4" /> },
    { id: "preview" as const, label: ar ? "المعاينة النهائية" : "Final preview", icon: <Eye className="w-4 h-4" /> },
  ];
  return (
    <div
      role="group"
      aria-label={ar ? "وضع الورقة" : "Worksheet mode"}
      className="no-print inline-flex items-center gap-1 rounded-xl border p-1 bg-white"
      style={{ borderColor: `${BRAND}55` }}
      data-testid="switch-worksheet-mode"
    >
      {items.map(it => {
        const active = mode === it.id;
        return (
          <button
            key={it.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            data-testid={`button-worksheet-mode-${it.id}`}
            onClick={() => { if (!active) onChange(it.id); }}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={active ? { background: BRAND, color: "#fff" } : { color: BRAND }}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
