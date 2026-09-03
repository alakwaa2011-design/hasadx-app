import { useId } from "react";
import { Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface GameLibraryPublishChoiceProps {
  isShared: boolean;
  onChange: (isShared: boolean) => void;
  className?: string;
}

/**
 * The final visibility decision for a teacher-authored game activity.
 * Activities remain private unless the teacher explicitly selects publishing.
 */
export function GameLibraryPublishChoice({
  isShared,
  onChange,
  className,
}: GameLibraryPublishChoiceProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const groupId = useId();
  const options = [
    {
      value: true,
      icon: Globe,
      title: ar ? "نشر في مكتبة الأنشطة" : "Publish to the Activities Library",
      description: ar
        ? "يستطيع المعلمون الآخرون استخدام النشاط والاستفادة منه"
        : "Other teachers can use and benefit from this activity",
      selectedClass: "border-primary bg-primary/5 ring-2 ring-primary/15",
      iconClass: "bg-primary text-primary-foreground",
    },
    {
      value: false,
      icon: Lock,
      title: ar ? "حفظ في مكتبتي فقط" : "Save to My Library only",
      description: ar
        ? "يبقى النشاط خاصًا بك ويمكنك تشغيله لاحقًا"
        : "The activity stays private and you can launch it later",
      selectedClass: "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/15",
      iconClass: "bg-amber-500 text-secondary-foreground",
    },
  ];

  return (
    <fieldset className={cn("rounded-2xl border border-border/70 bg-card p-4", className)}>
      <legend className="px-1 text-sm font-black text-foreground">
        {ar ? "مكان حفظ النشاط" : "Where to save this activity"}
      </legend>
      <p className="mb-3 px-1 text-xs text-muted-foreground">
        {ar ? "اختر من يمكنه الوصول إلى نشاطك بعد الحفظ." : "Choose who can access your activity after saving."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = isShared === option.value;
          const inputId = `${groupId}-${option.value ? "public" : "private"}`;
          return (
            <label
              key={inputId}
              htmlFor={inputId}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                selected ? option.selectedClass : "border-border bg-background hover:border-primary/35",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={groupId}
                value={String(option.value)}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
                data-testid={`radio-game-library-${option.value ? "public" : "private"}`}
              />
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", option.iconClass)}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}