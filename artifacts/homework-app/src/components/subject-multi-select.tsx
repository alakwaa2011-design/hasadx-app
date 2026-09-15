import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const TEACHER_SUBJECTS = [
  { value: "اللغة العربية", ar: "اللغة العربية", en: "Arabic" },
  { value: "الرياضيات", ar: "الرياضيات", en: "Mathematics" },
  { value: "العلوم", ar: "العلوم", en: "Science" },
  { value: "اللغة الإنجليزية", ar: "اللغة الإنجليزية", en: "English" },
  { value: "التربية الإسلامية", ar: "التربية الإسلامية", en: "Islamic studies" },
  { value: "الدراسات الاجتماعية", ar: "الدراسات الاجتماعية", en: "Social studies" },
  { value: "الحاسوب والتقنية", ar: "الحاسوب والتقنية", en: "Computing & technology" },
  { value: "التربية الفنية", ar: "التربية الفنية", en: "Art" },
  { value: "التربية الرياضية", ar: "التربية الرياضية", en: "Physical education" },
  { value: "فعاليات وتدريب", ar: "فعاليات وتدريب", en: "Events & training" },
] as const;

export function SubjectMultiSelect({
  value,
  onChange,
  lang,
  disabled,
  required,
}: {
  value: string[];
  onChange: (subjects: string[]) => void;
  lang: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const toggle = (subject: string) => {
    onChange(value.includes(subject)
      ? value.filter((item) => item !== subject)
      : [...value, subject]);
  };

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      role="group"
      aria-label={lang === "ar" ? "اختر المواد التي تدرّسها" : "Choose the subjects you teach"}
      aria-required={required}
    >
      {TEACHER_SUBJECTS.map((subject) => {
        const selected = value.includes(subject.value);
        return (
          <button
            key={subject.value}
            type="button"
            data-testid={`button-subject-${subject.value}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => toggle(subject.value)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs font-bold transition-colors disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background text-foreground hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <span className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}>
              {selected && <Check className="h-3 w-3" />}
            </span>
            <span>{lang === "ar" ? subject.ar : subject.en}</span>
          </button>
        );
      })}
    </div>
  );
}