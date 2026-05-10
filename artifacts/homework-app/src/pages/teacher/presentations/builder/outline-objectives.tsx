import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const BRAND_GREEN = "#225739";

interface Props {
  objectives: string[];
  onChange: (next: string[]) => void;
}

export function OutlineObjectives({ objectives, onChange }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [draft, setDraft] = useState("");

  const update = (i: number, v: string) => {
    const next = objectives.slice();
    next[i] = v.slice(0, 140);
    onChange(next);
  };

  const remove = (i: number) => {
    if (objectives.length <= 2) return;
    onChange(objectives.filter((_, idx) => idx !== i));
  };

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (objectives.length >= 6) return;
    onChange([...objectives, v.slice(0, 140)]);
    setDraft("");
  };

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4" style={{ color: BRAND_GREEN }} />
        <h3 className="text-sm font-bold" style={{ color: BRAND_GREEN }}>
          {isAr ? "أهداف الدرس" : "Learning objectives"}
        </h3>
        <span className="text-xs text-muted-foreground">{objectives.length}/6</span>
      </div>

      <ul className="space-y-2">
        {objectives.map((obj, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: BRAND_GREEN }} />
            <Input
              value={obj}
              onChange={(e) => update(i, e.target.value)}
              maxLength={140}
              className="flex-1 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
              disabled={objectives.length <= 2}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      {objectives.length < 6 ? (
        <div className="flex gap-2 pt-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={isAr ? "أضف هدفاً ..." : "Add an objective..."}
            maxLength={140}
            className="text-sm"
          />
          <Button onClick={add} variant="outline" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            {isAr ? "إضافة" : "Add"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
