import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface WheelScoreEditorProps {
  score: number;
  teamName: string;
  ar: boolean;
  compact: boolean;
  color: string;
  onSave: (score: number) => void;
}

export function WheelScoreEditor({ score, teamName, ar, compact, color, onSave }: WheelScoreEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editingRef = useRef(false);
  const sizeClass = compact ? "text-xl" : "text-3xl sm:text-4xl";

  // A game award/reset must not be overwritten by an older unfinished edit.
  useEffect(() => {
    editingRef.current = false;
    setEditing(false);
  }, [score]);

  const finish = (save: boolean) => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    if (!save) return;
    const normalized = draft.trim()
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
    const next = Number(normalized);
    if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(next)) {
      toast.error(ar ? "أدخل درجة صحيحة تساوي صفرًا أو أكثر" : "Enter a whole score of zero or more");
      return;
    }
    onSave(next);
  };

  return editing ? (
    <input
      autoFocus
      type="text"
      inputMode="numeric"
      dir="ltr"
      aria-label={ar ? `درجة: ${teamName}` : `Score: ${teamName}`}
      value={draft}
      onFocus={event => event.currentTarget.select()}
      onChange={event => setDraft(event.target.value)}
      onClick={event => event.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Enter") { event.preventDefault(); finish(true); }
        if (event.key === "Escape") { event.preventDefault(); finish(false); }
      }}
      className={`${sizeClass} w-[5ch] min-w-0 shrink-0 rounded-md border-b bg-white/10 text-center font-black tabular-nums outline-none focus:ring-2 focus:ring-amber-400`}
      style={{ color, borderColor: "#D9A521" }}
    />
  ) : (
    <button
      type="button"
      aria-label={ar ? `تعديل الدرجة: ${teamName}` : `Edit score: ${teamName}`}
      title={ar ? `تعديل الدرجة: ${score}` : `Edit score: ${score}`}
      onClick={event => {
        event.stopPropagation();
        setDraft(String(score));
        editingRef.current = true;
        setEditing(true);
      }}
      onKeyDown={event => event.stopPropagation()}
      className="group inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      style={{ color }}
    >
      <span className={`${sizeClass} max-w-[5ch] truncate font-black tabular-nums`}>{score}</span>
      <Pencil aria-hidden="true" className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
    </button>
  );
}