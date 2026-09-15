import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const SUBJECT_MAX_LENGTH = 100;
export const MAX_TEACHER_SUBJECTS = 10;

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

function normalizeSubject(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function subjectKey(value: string) {
  return normalizeSubject(value).toLocaleLowerCase();
}

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
  const [customSubject, setCustomSubject] = useState("");
  const [customSubjectError, setCustomSubjectError] = useState("");

  const toggle = (subject: string) => {
    onChange(value.includes(subject)
      ? value.filter((item) => item !== subject)
      : [...value, subject]);
  };

  const knownSubjectKeys = new Set(TEACHER_SUBJECTS.map((subject) => subjectKey(subject.value)));
  const customSubjects = value.filter((subject) => !knownSubjectKeys.has(subjectKey(subject)));
  const normalizedCustomSubject = normalizeSubject(customSubject);
  const isDuplicate = value.some((subject) => subjectKey(subject) === subjectKey(normalizedCustomSubject));
  const canAddCustomSubject =
    !disabled &&
    value.length < MAX_TEACHER_SUBJECTS &&
    normalizedCustomSubject.length > 0 &&
    normalizedCustomSubject.length <= SUBJECT_MAX_LENGTH &&
    !isDuplicate;

  const addCustomSubject = () => {
    if (!normalizedCustomSubject) {
      setCustomSubjectError(lang === "ar" ? "اكتب اسم المادة أولًا" : "Enter a subject name first");
      return;
    }
    if (normalizedCustomSubject.length > SUBJECT_MAX_LENGTH) {
      setCustomSubjectError(
        lang === "ar"
          ? `اسم المادة يجب ألا يتجاوز ${SUBJECT_MAX_LENGTH} حرفًا`
          : `Subject names must be ${SUBJECT_MAX_LENGTH} characters or fewer`,
      );
      return;
    }
    if (value.length >= MAX_TEACHER_SUBJECTS) {
      setCustomSubjectError(
        lang === "ar"
          ? `يمكنك اختيار ${MAX_TEACHER_SUBJECTS} مواد كحد أقصى`
          : `You can choose up to ${MAX_TEACHER_SUBJECTS} subjects`,
      );
      return;
    }
    if (isDuplicate) {
      setCustomSubjectError(lang === "ar" ? "هذه المادة مضافة بالفعل" : "This subject is already selected");
      return;
    }

    onChange([...value, normalizedCustomSubject]);
    setCustomSubject("");
    setCustomSubjectError("");
  };

  return (
    <div className="space-y-3">
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
        {customSubjects.map((subject) => (
          <button
            key={subject}
            type="button"
            data-testid={`button-subject-custom-${subject}`}
            aria-pressed="true"
            disabled={disabled}
            onClick={() => toggle(subject)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-start text-xs font-bold text-primary transition-colors disabled:opacity-50"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1 truncate">{subject}</span>
            <X className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={customSubject}
          onChange={(event) => {
            setCustomSubject(event.target.value);
            setCustomSubjectError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomSubject();
            }
          }}
          maxLength={SUBJECT_MAX_LENGTH}
          disabled={disabled || value.length >= MAX_TEACHER_SUBJECTS}
          placeholder={lang === "ar" ? "أضف مادة أخرى" : "Add another subject"}
          aria-label={lang === "ar" ? "اسم المادة المخصصة" : "Custom subject name"}
          data-testid="input-custom-subject"
          className="min-w-0 flex-1 rounded-xl border-2 border-dashed border-primary/25 bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={addCustomSubject}
          disabled={!canAddCustomSubject}
          data-testid="button-add-custom-subject"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {lang === "ar" ? "إضافة" : "Add"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {customSubjectError ||
          (lang === "ar"
            ? `حتى ${SUBJECT_MAX_LENGTH} حرفًا، وبحد أقصى ${MAX_TEACHER_SUBJECTS} مواد`
            : `Up to ${SUBJECT_MAX_LENGTH} characters and ${MAX_TEACHER_SUBJECTS} subjects`)}
      </p>
    </div>
  );
}