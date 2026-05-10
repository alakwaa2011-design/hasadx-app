import { useState, useMemo } from "react";
import { Check, ChevronDown, Lock, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AssignmentOption {
  id: number;
  title: string;
  questionCount: number;
  isOwn?: boolean;
  isPrivate?: boolean;
  ownerName?: string | null;
}

interface AssignmentPickerProps {
  assignments: AssignmentOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  lang?: "ar" | "en";
  /** Optional override for the trigger button styling (e.g. dark backgrounds). */
  triggerClassName?: string;
  /** Optional override for the dropdown panel styling. */
  panelClassName?: string;
  /** Optional placeholder when no assignment is selected. */
  placeholder?: string;
}

/**
 * Compact, searchable assignment dropdown shared across all game setup pages.
 * Replaces the bulky native <select> + optgroups (My / Shared) with a smaller-font
 * popover that includes a search box.
 */
export function AssignmentPicker({
  assignments,
  value,
  onChange,
  lang = "ar",
  triggerClassName = "",
  panelClassName = "",
  placeholder,
}: AssignmentPickerProps) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => assignments.find(a => a.id === value) ?? null,
    [assignments, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(a => {
      const hay = `${a.title} ${a.ownerName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assignments, query]);

  const mine = filtered.filter(a => a.isOwn !== false);
  const shared = filtered.filter(a => a.isOwn === false);

  const triggerLabel = selected
    ? `${selected.title} (${selected.questionCount} ${ar ? "س" : "q"})${selected.isPrivate ? " 🔒" : ""}`
    : placeholder ?? (ar ? "-- اختر واجباً --" : "-- Choose Assignment --");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-start transition-colors hover:opacity-90 ${triggerClassName}`}
          dir={ar ? "rtl" : "ltr"}
        >
          <span className="truncate flex-1 text-start">{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={`w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0 overflow-hidden ${panelClassName}`}
      >
        <div className="flex items-center gap-2 border-b px-2 py-1.5" dir={ar ? "rtl" : "ltr"}>
          <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={ar ? "ابحث عن واجب..." : "Search assignments..."}
            className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
            dir={ar ? "rtl" : "ltr"}
            autoFocus
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1" dir={ar ? "rtl" : "ltr"}>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs opacity-60">
              {ar ? "لا توجد نتائج" : "No matches"}
            </div>
          ) : (
            <>
              {mine.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase opacity-50">
                    {ar ? "واجباتي" : "My Assignments"}
                  </div>
                  {mine.map(a => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      selected={a.id === value}
                      ar={ar}
                      onSelect={() => { onChange(a.id); setOpen(false); }}
                    />
                  ))}
                </div>
              )}
              {shared.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase opacity-50">
                    {ar ? "واجبات مشتركة" : "Shared Assignments"}
                  </div>
                  {shared.map(a => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      selected={a.id === value}
                      ar={ar}
                      onSelect={() => { onChange(a.id); setOpen(false); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AssignmentRow({
  assignment,
  selected,
  ar,
  onSelect,
}: {
  assignment: AssignmentOption;
  selected: boolean;
  ar: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-start hover:bg-muted/60 transition-colors ${selected ? "bg-muted/40" : ""}`}
    >
      <Check className={`w-3 h-3 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
      <span className="flex-1 truncate">
        {assignment.title}
        <span className="opacity-60"> ({assignment.questionCount} {ar ? "س" : "q"})</span>
        {assignment.ownerName && assignment.isOwn === false ? (
          <span className="opacity-50"> · {assignment.ownerName}</span>
        ) : null}
      </span>
      {assignment.isPrivate ? <Lock className="w-3 h-3 opacity-60 shrink-0" /> : null}
    </button>
  );
}
