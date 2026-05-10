import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  PresentationBrief,
  PresentationAiLimits,
  PresentationBriefPresentationKind,
  PresentationBriefLanguage,
  PresentationBriefDurationMinutes,
  PresentationBriefLanguageLevel,
  PresentationBriefDensity,
  BriefPreferences,
} from "@workspace/api-client-react";
import {
  useGetBriefPreferences,
  useUpdateBriefPreferences,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Lock, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const BRAND_GREEN = "#225739";
const PREFS_KEY = "hasad:brief:prefs";
const DEBOUNCE_MS = 1500;

interface SavedPrefs {
  language?: PresentationBriefLanguage;
  presentationKind?: PresentationBriefPresentationKind;
  slideCount?: number;
  durationMinutes?: PresentationBriefDurationMinutes;
  languageLevel?: PresentationBriefLanguageLevel;
  density?: PresentationBriefDensity;
  activities?: boolean;
  questions?: boolean;
  poll?: boolean;
  quiz?: boolean;
  notes?: string;
}

function loadLocalPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as SavedPrefs) : {};
  } catch {
    return {};
  }
}

function saveLocalPrefs(prefs: SavedPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

function clearLocalPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // ignore
  }
}

export interface BriefFormHandle {
  submit: () => void;
}

interface Props {
  limits: PresentationAiLimits | undefined;
  loading: boolean;
  onSubmit: (brief: PresentationBrief) => void;
  initial?: Partial<PresentationBrief>;
  onValidityChange?: (valid: boolean, noBudget: boolean) => void;
}

const KIND_OPTIONS: PresentationBrief["presentationKind"][] = [
  "explain", "review", "interactive", "quick", "contest",
];

const DURATIONS = [15, 30, 45, 60] as const;

const DEFAULT_PREFS: Required<SavedPrefs> = {
  language: "ar",
  presentationKind: "explain",
  slideCount: 8,
  durationMinutes: 45,
  languageLevel: "medium",
  density: "balanced",
  activities: false,
  questions: false,
  poll: false,
  quiz: false,
  notes: "",
};

export const BriefForm = forwardRef<BriefFormHandle, Props>(function BriefForm(
  { limits, loading, onSubmit, initial, onValidityChange },
  ref,
) {
  const { lang, t } = useI18n();
  const isAr = lang === "ar";
  type AiBuilderStrings = {
    kinds?: Record<string, string>;
    densities?: Record<string, string>;
    densityHints?: Record<string, string>;
  } & Partial<Record<string, string>>;
  const tx: AiBuilderStrings = (t as unknown as { aiBuilder?: AiBuilderStrings }).aiBuilder ?? {};

  const defaultLang: PresentationBriefLanguage = isAr ? "ar" : "en";

  // Load local prefs as the initial fallback (used before server prefs arrive)
  const localPrefs = loadLocalPrefs();

  const [language, setLanguage] = useState<PresentationBriefLanguage>(
    (initial?.language as PresentationBriefLanguage) ??
    (localPrefs.language as PresentationBriefLanguage) ??
    defaultLang,
  );
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(initial?.gradeLevel ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [presentationKind, setPresentationKind] = useState<PresentationBriefPresentationKind>(
    (initial?.presentationKind as PresentationBriefPresentationKind) ??
    (localPrefs.presentationKind as PresentationBriefPresentationKind) ??
    "explain",
  );
  const maxSlidesAllowed = limits?.maxSlides ?? 10;
  const [slideCount, setSlideCount] = useState<number>(
    Math.min(
      initial?.slideCount ?? localPrefs.slideCount ?? 8,
      maxSlidesAllowed,
    ),
  );
  const [durationMinutes, setDurationMinutes] = useState<PresentationBriefDurationMinutes>(
    (initial?.durationMinutes as PresentationBriefDurationMinutes) ??
    (localPrefs.durationMinutes as PresentationBriefDurationMinutes) ??
    45,
  );
  const [languageLevel, setLanguageLevel] = useState<PresentationBriefLanguageLevel>(
    (initial?.languageLevel as PresentationBriefLanguageLevel) ??
    (localPrefs.languageLevel as PresentationBriefLanguageLevel) ??
    "medium",
  );
  const [density, setDensity] = useState<PresentationBriefDensity>(
    (initial?.density as PresentationBriefDensity) ??
    (localPrefs.density as PresentationBriefDensity) ??
    "balanced",
  );
  const [activities, setActivities] = useState(
    initial?.toggles?.activities ?? localPrefs.activities ?? false,
  );
  const [questions, setQuestions] = useState(
    initial?.toggles?.questions ?? localPrefs.questions ?? false,
  );
  const [poll, setPoll] = useState(
    initial?.toggles?.poll ?? localPrefs.poll ?? false,
  );
  const [quiz, setQuiz] = useState(
    initial?.toggles?.quiz ?? localPrefs.quiz ?? false,
  );
  const [notes, setNotes] = useState(
    initial?.notes ?? localPrefs.notes ?? "",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Track whether the server prefs have been applied yet (one-time hydration)
  const serverHydratedRef = useRef(false);
  // Prevents the persistence effect from firing on initial mount — only user-driven changes should write.
  const didMountRef = useRef(false);
  // When true, the next persistence effect run is skipped (used by restore defaults).
  const skipNextSaveRef = useRef(false);

  // Fetch server-side preferences
  const { data: serverPrefs } = useGetBriefPreferences({
    query: { retry: false, staleTime: 5 * 60 * 1000 } as any,
  });

  // Mutate server-side preferences
  const { mutate: syncToServer } = useUpdateBriefPreferences({
    mutation: {
      onError: () => {
        // Server sync failed silently — localStorage already has the changes
      },
    },
  });

  // Hydrate from server prefs once they arrive (only if no `initial` prop overrides + not yet applied)
  useEffect(() => {
    if (!serverPrefs || serverHydratedRef.current) return;
    serverHydratedRef.current = true;

    // Don't overwrite fields already set via `initial` prop
    if (!initial?.language && serverPrefs.language) {
      setLanguage(serverPrefs.language as PresentationBriefLanguage);
    }
    if (!initial?.presentationKind && serverPrefs.presentationKind) {
      setPresentationKind(serverPrefs.presentationKind as PresentationBriefPresentationKind);
    }
    if (initial?.slideCount === undefined && serverPrefs.slideCount !== undefined) {
      setSlideCount(Math.min(serverPrefs.slideCount, maxSlidesAllowed));
    }
    if (!initial?.durationMinutes && serverPrefs.durationMinutes !== undefined) {
      setDurationMinutes(serverPrefs.durationMinutes as PresentationBriefDurationMinutes);
    }
    if (!initial?.languageLevel && serverPrefs.languageLevel) {
      setLanguageLevel(serverPrefs.languageLevel as PresentationBriefLanguageLevel);
    }
    if (!initial?.density && serverPrefs.density) {
      setDensity(serverPrefs.density as PresentationBriefDensity);
    }
    if (initial?.toggles?.activities === undefined && serverPrefs.activities !== undefined) {
      setActivities(serverPrefs.activities);
    }
    if (initial?.toggles?.questions === undefined && serverPrefs.questions !== undefined) {
      setQuestions(serverPrefs.questions);
    }
    if (initial?.toggles?.poll === undefined && serverPrefs.poll !== undefined) {
      setPoll(serverPrefs.poll);
    }
    if (initial?.toggles?.quiz === undefined && serverPrefs.quiz !== undefined) {
      setQuiz(serverPrefs.quiz);
    }
    if (!initial?.notes && serverPrefs.notes !== undefined) {
      setNotes(serverPrefs.notes);
    }

    // Sync server prefs into localStorage as well
    saveLocalPrefs(serverPrefs as SavedPrefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPrefs]);

  // Debounced sync-to-server ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist advanced prefs to localStorage and debounce-sync to server whenever they change.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const prefs: SavedPrefs = {
      language,
      presentationKind,
      slideCount,
      durationMinutes,
      languageLevel,
      density,
      activities,
      questions,
      poll,
      quiz,
      notes,
    };
    // Always write locally (instant, offline-safe)
    saveLocalPrefs(prefs);

    // Debounce the server sync
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      syncToServer({ data: prefs as BriefPreferences });
    }, DEBOUNCE_MS);
  }, [language, presentationKind, slideCount, durationMinutes, languageLevel, density, activities, questions, poll, quiz, notes, syncToServer]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (limits && slideCount > limits.maxSlides) setSlideCount(limits.maxSlides);
    if (limits && !limits.allowedDensities.includes(density)) {
      setDensity(limits.allowedDensities[0] ?? "balanced");
    }
  }, [limits, slideCount, density]);

  const handleRestoreDefaults = useCallback(() => {
    // Clear local storage first, then flag the save effect to skip one run so that
    // the state resets don't re-populate localStorage with the default values.
    clearLocalPrefs();
    skipNextSaveRef.current = true;
    setLanguage(defaultLang);
    setPresentationKind(DEFAULT_PREFS.presentationKind);
    setSlideCount(Math.min(DEFAULT_PREFS.slideCount, maxSlidesAllowed));
    setDurationMinutes(DEFAULT_PREFS.durationMinutes);
    setLanguageLevel(DEFAULT_PREFS.languageLevel);
    setDensity(DEFAULT_PREFS.density);
    setActivities(DEFAULT_PREFS.activities);
    setQuestions(DEFAULT_PREFS.questions);
    setPoll(DEFAULT_PREFS.poll);
    setQuiz(DEFAULT_PREFS.quiz);
    setNotes(DEFAULT_PREFS.notes);

    // Sync cleared prefs to server immediately
    syncToServer({ data: {} as BriefPreferences });
  }, [defaultLang, maxSlidesAllowed, syncToServer]);

  const allowedDensities = limits?.allowedDensities ?? ["balanced"];
  const isDensityLocked = (d: "minimal" | "balanced" | "detailed") =>
    !allowedDensities.includes(d);

  const remaining = limits?.remaining ?? 0;
  const noBudget = limits ? remaining <= 0 : false;
  const isFormValid = !!(subject.trim() && gradeLevel.trim() && topic.trim()) && !noBudget;

  const submit = useCallback(() => {
    if (!subject.trim() || !gradeLevel.trim() || !topic.trim()) return;
    onSubmit({
      language,
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim(),
      topic: topic.trim(),
      presentationKind,
      slideCount,
      durationMinutes,
      languageLevel,
      density,
      toggles: { activities, questions, poll, quiz },
      notes: notes.trim() || undefined,
    });
  }, [
    subject, gradeLevel, topic, language, presentationKind, slideCount,
    durationMinutes, languageLevel, density, activities, questions, poll, quiz, notes, onSubmit,
  ]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  useEffect(() => {
    onValidityChange?.(isFormValid, noBudget);
  }, [isFormValid, noBudget, onValidityChange]);

  /* Suppress exhaustive-deps lint: loading is used by the parent button, not here. */
  void loading;

  return (
    <div className="space-y-5" dir={isAr ? "rtl" : "ltr"}>
      {/* Tier / daily quota strip */}
      {limits ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {isAr
              ? `الخطة: ${limits.tier === "claude" ? "Premium" : limits.tier === "pro" ? "Pro" : "Free"} · ${limits.used}/${limits.dailyOutlines} مخطط اليوم`
              : `Plan: ${limits.tier === "claude" ? "Premium" : limits.tier === "pro" ? "Pro" : "Free"} · ${limits.used}/${limits.dailyOutlines} outlines today`}
          </span>
          <span className="font-medium" style={{ color: BRAND_GREEN }}>
            {isAr ? `الحد الأقصى ${limits.maxSlides} شريحة` : `Up to ${limits.maxSlides} slides`}
          </span>
        </div>
      ) : null}

      {noBudget && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          {isAr
            ? `وصلت للحد اليومي (${limits!.dailyOutlines}). جرّب غداً أو ارفع خطتك.`
            : `Daily limit reached (${limits!.dailyOutlines}). Try again tomorrow or upgrade.`}
        </div>
      )}

      {/* ── Required fields ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{tx.subject ?? (isAr ? "المادة" : "Subject")} <span className="text-destructive">*</span></Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>{tx.gradeLevel ?? (isAr ? "الصف" : "Grade level")} <span className="text-destructive">*</span></Label>
          <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} maxLength={50} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{tx.topic ?? (isAr ? "موضوع الدرس" : "Lesson topic")} <span className="text-destructive">*</span></Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} />
      </div>

      {/* ── Advanced options toggle ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: BRAND_GREEN }}
        >
          {showAdvanced
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
          {isAr
            ? (showAdvanced ? "إخفاء الخيارات المتقدمة" : "خيارات متقدمة")
            : (showAdvanced ? "Hide advanced options" : "Advanced options")}
        </button>
        {showAdvanced && (
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {isAr ? "استعادة الافتراضي" : "Restore defaults"}
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="space-y-5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tx.kind ?? (isAr ? "نوع العرض" : "Presentation kind")}</Label>
              <Select value={presentationKind} onValueChange={(v) => setPresentationKind(v as PresentationBriefPresentationKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {(tx.kinds && tx.kinds[k]) ?? k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tx.duration ?? (isAr ? "مدة الحصة" : "Period length")}</Label>
              <Select value={String(durationMinutes)} onValueChange={(v) => setDurationMinutes(Number(v) as PresentationBriefDurationMinutes)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {isAr ? `${d} دقيقة` : `${d} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{tx.slideCount ?? (isAr ? "عدد الشرائح" : "Slide count")}</Label>
              <span className="text-sm font-semibold" style={{ color: BRAND_GREEN }}>{slideCount}</span>
            </div>
            <input
              type="range"
              min={5}
              max={maxSlidesAllowed}
              step={1}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>{maxSlidesAllowed}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tx.languageLevel ?? (isAr ? "مستوى اللغة" : "Language level")}</Label>
              <Select value={languageLevel} onValueChange={(v) => setLanguageLevel(v as PresentationBriefLanguageLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">{isAr ? "بسيط" : "Simple"}</SelectItem>
                  <SelectItem value="medium">{isAr ? "متوسط" : "Intermediate"}</SelectItem>
                  <SelectItem value="advanced">{isAr ? "متقدّم" : "Advanced"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tx.outputLanguage ?? (isAr ? "لغة المخطط" : "Outline language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as PresentationBriefLanguage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tx.density ?? (isAr ? "كثافة المحتوى" : "Content density")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["minimal", "balanced", "detailed"] as const).map((d) => {
                const locked = isDensityLocked(d);
                const active = density === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && setDensity(d)}
                    className={`relative rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all text-start ${
                      active ? "border-current" : "border-muted hover:border-muted-foreground/40"
                    } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    style={active ? { borderColor: BRAND_GREEN, color: BRAND_GREEN, background: "#22573912" } : undefined}
                  >
                    {locked ? <Lock className="absolute top-1.5 end-1.5 h-3 w-3 text-muted-foreground" /> : null}
                    <div>{(tx.densities && tx.densities[d]) ?? d}</div>
                    <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                      {(tx.densityHints && tx.densityHints[d]) ?? ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tx.toggles ?? (isAr ? "اقتراحات تفاعل (لن تُدرج تلقائياً)" : "Interaction hints (never auto-inserted)")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow label={isAr ? "أنشطة" : "Activities"} value={activities} onChange={setActivities} />
              <ToggleRow label={isAr ? "أسئلة" : "Questions"} value={questions} onChange={setQuestions} />
              <ToggleRow label={isAr ? "استطلاع" : "Poll"} value={poll} onChange={setPoll} />
              <ToggleRow label={isAr ? "اختبار سريع" : "Quick quiz"} value={quiz} onChange={setQuiz} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{tx.notes ?? (isAr ? "ملاحظات إضافية" : "Extra notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder={isAr ? "اختياري — مثال: ركّز على الأمثلة الحسية" : "Optional — e.g. emphasise hands-on examples"}
            />
            <div className="text-end text-xs text-muted-foreground">{notes.length}/200</div>
          </div>
        </div>
      )}
    </div>
  );
});

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}
