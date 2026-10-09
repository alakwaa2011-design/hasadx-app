import { DESIGNS, DESIGN_KEYS, resolveDesignAsset } from "@workspace/slide-templates";
import { cn } from "@/lib/utils";

/* Choose the deck's visual identity before the slides are built.
   "Auto" lets the AI pick one by subject and grade; the others force a specific identity.
   Each card previews the identity's own page art. */
export function DesignPicker({
  value, onChange, isAr,
}: { value: string; onChange: (key: string) => void; isAr: boolean }) {
  return (
    <section className="mb-4" aria-label={isAr ? "هوية العرض" : "Deck identity"}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold">{isAr ? "هوية العرض" : "Deck identity"}</h3>
        <span className="text-xs text-muted-foreground">
          {isAr ? "تلقائي = يختارها الذكاء الاصطناعي بحسب المادة والصف" : "Auto = chosen by the AI from subject and grade"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center text-sm font-bold transition",
            value === "" ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300",
          )}
        >
          <span aria-hidden className="text-xl">✨</span>
          {isAr ? "تلقائي" : "Auto"}
        </button>
        {DESIGN_KEYS.map((key) => {
          const d = DESIGNS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              title={d.descAr}
              className={cn(
                "overflow-hidden rounded-xl border-2 text-start transition",
                value === key ? "border-amber-500 shadow-md" : "border-border hover:border-amber-300",
              )}
            >
              <img
                src={resolveDesignAsset(`hd://frame/${key}/cover/0`)}
                alt=""
                className="aspect-video w-full object-cover"
                draggable={false}
              />
              <span className="block px-2 py-1 text-xs font-bold">{isAr ? d.labelAr : d.labelEn}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
