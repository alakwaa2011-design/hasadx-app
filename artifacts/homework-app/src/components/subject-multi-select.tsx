import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

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

  const selectedSummary = value.length === 0
    ? (lang === "ar" ? "اختر التخصص أو المواد" : "Choose specialty or subjects")
    : value.length === 1
      ? value[0]
      : lang === "ar"
        ? `${value[0]} و${value.length - 1} أخرى`
        : `${value[0]} +${value.length - 1} more`;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="button-open-subjects"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-start text-sm font-bold outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-primary" : "border-input",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", value.length === 0 ? "text-muted-foreground" : "text-foreground")}>
          {selectedSummary}
        </span>
        {value.length > 0 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[10px] font-black text-primary">
            {value.length}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={lang === "ar" ? "إغلاق قائمة المواد" : "Close subjects list"}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={lang === "ar" ? "اختر المواد التي تدرّسها" : "Choose the subjects you teach"}
            aria-multiselectable="true"
            className="absolute inset-x-0 top-[calc(100%+.35rem)] z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-input bg-background p-1.5 shadow-2xl"
          >
            {TEACHER_SUBJECTS.map((subject) => {
              const selected = value.includes(subject.value);
              return (
                <button
                  key={subject.value}
                  type="button"
                  role="option"
                  data-testid={`button-subject-${subject.value}`}
                  aria-selected={selected}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => toggle(subject.value)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-bold transition-colors disabled:opacity-50",
                    selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
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
                role="option"
                data-testid={`button-subject-custom-${subject}`}
                aria-selected="true"
                aria-pressed="true"
                disabled={disabled}
                onClick={() => toggle(subject)}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-start text-xs font-bold text-primary transition-colors disabled:opacity-50"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1 truncate">{subject}</span>
                <X className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
              </button>
            ))}

            <div className="my-1.5 border-t border-border" />
            <div className="flex gap-1.5">
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
                placeholder={lang === "ar" ? "مادة أخرى..." : "Other subject..."}
                aria-label={lang === "ar" ? "اسم المادة المخصصة" : "Custom subject name"}
                data-testid="input-custom-subject"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={addCustomSubject}
                disabled={!canAddCustomSubject}
                data-testid="button-add-custom-subject"
                aria-label={lang === "ar" ? "إضافة المادة" : "Add subject"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
              {customSubjectError ||
                (lang === "ar"
                  ? `حتى ${MAX_TEACHER_SUBJECTS} مواد`
                  : `Up to ${MAX_TEACHER_SUBJECTS} subjects`)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}