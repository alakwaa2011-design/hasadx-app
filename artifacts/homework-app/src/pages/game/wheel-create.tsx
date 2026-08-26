import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Play, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Gift, HelpCircle, Edit3, Check,
  Globe, BookOpen, GraduationCap, Users, FileDown, Database,
  PenLine, Settings2, Volume2, RotateCw, ListChecks, ArrowLeft, ArrowRight,
  SlidersHorizontal, Link2, Copy, Ban,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

/** Professional SVG wheel icon — mirrors the actual game wheel colours */
const WheelIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    {/* 8 coloured segments */}
    <path d="M50,50 L50,4 A46,46 0 0,1 82.5,17.5 Z" fill="#225739"/>
    <path d="M50,50 L82.5,17.5 A46,46 0 0,1 96,50 Z" fill="#D9A521"/>
    <path d="M50,50 L96,50 A46,46 0 0,1 82.5,82.5 Z" fill="#3a7a55"/>
    <path d="M50,50 L82.5,82.5 A46,46 0 0,1 50,96 Z" fill="#c47e2c"/>
    <path d="M50,50 L50,96 A46,46 0 0,1 17.5,82.5 Z" fill="#1f4d3a"/>
    <path d="M50,50 L17.5,82.5 A46,46 0 0,1 4,50 Z" fill="#e6b54f"/>
    <path d="M50,50 L4,50 A46,46 0 0,1 17.5,17.5 Z" fill="#2d6a4f"/>
    <path d="M50,50 L17.5,17.5 A46,46 0 0,1 50,4 Z" fill="#b08440"/>
    {/* Spoke dividers */}
    <line x1="50" y1="4" x2="50" y2="96" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="4" y1="50" x2="96" y2="50" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="17.5" y1="17.5" x2="82.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="82.5" y1="17.5" x2="17.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    {/* Outer ring */}
    <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.35"/>
    {/* Centre hub */}
    <circle cx="50" cy="50" r="13" fill="white"/>
    <circle cx="50" cy="50" r="8"  fill="#225739"/>
    <circle cx="50" cy="50" r="3"  fill="white"/>
    {/* Gold pointer triangle at top */}
    <polygon points="50,0 43,12 57,12" fill="#D9A521"/>
    <polygon points="50,1 44,10 56,10" fill="#FFD166"/>
  </svg>
);

const WHEEL_PALETTE = [
  "#225739", "#D9A521", "#3a7a55", "#c47e2c",
  "#1f4d3a", "#e6b54f", "#2d6a4f", "#b08440",
];

const POINT_OPTIONS = [50, 100, 200, 300, 500] as const;
const BONUS_TYPES = ["double", "skip", "swap", "lucky", "lose"] as const;

type BonusType = (typeof BONUS_TYPES)[number];
type TurnMode = "team_first" | "wheel_first";
type PointsMode = "uniform" | "varied";

interface Segment {
  id: string;
  text: string;
  answer?: string;
  explanation?: string;
  points: number;
  color?: string;
  kind: "question" | "bonus";
  bonusType?: BonusType;
  imageUrl?: string | null;
}

interface WheelConfig {
  teamCount: number;
  teamNames: string[];
  spinSeconds: number;
  soundOn: boolean;
  turnMode?: TurnMode;
  pointsMode?: PointsMode;
  uniformPoints?: number;
  bonusesEnabled?: boolean;
  bonusCount?: number;
  bonusTypes?: BonusType[];
}

interface Template {
  id: number;
  title: string;
  language: "ar" | "en";
  gradeLevel: string | null;
  subject: string | null;
  segments: Segment[];
  config: WheelConfig;
  isOwn?: boolean;
  fromAdmin?: boolean;
  ownerName?: string | null;
}

type QuestionSource = "assignment" | "ai" | "manual" | "bank";
type SetupStep = "source" | "settings";

interface BankQuestion {
  id: number;
  subject?: string | null;
  questionType?: string | null;
  text: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null;
  imageUrl?: string | null;
  allowMultipleAnswers?: boolean | null;
}

const newId = () => `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const colorize = (segs: Segment[]): Segment[] =>
  segs.map((s, i) => ({ ...s, color: s.color ?? WHEEL_PALETTE[i % WHEEL_PALETTE.length] }));

export default function WheelCreate() {
  const { lang, t, dir } = useI18n();
  const w = t.wheelCreate;
  const defaultTeamName = (index: number, language: "ar" | "en") => {
    const names = language === "ar" ? w.teamNamesAr : w.teamNamesEn;
    const fallback = language === "ar" ? w.teamFallbackAr : w.teamFallbackEn;
    return names[index] ?? fallback.replace("{count}", String(index + 1));
  };
  const bonusLabel = (bonus: BonusType, language: "ar" | "en") =>
    (language === "ar" ? w.bonusLabelsAr : w.bonusLabelsEn)[bonus];
  const [, setLocation] = useLocation();

  const [title, setTitle] = useState("");
  const [contentLang, setContentLang] = useState<"ar" | "en">(lang);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [config, setConfig] = useState<WheelConfig>({
    teamCount: 2,
    teamNames: [defaultTeamName(0, lang), defaultTeamName(1, lang)],
    spinSeconds: 5,
    soundOn: true,
    turnMode: "team_first",
    pointsMode: "varied",
    uniformPoints: 100,
    bonusesEnabled: true,
    bonusCount: 1,
    bonusTypes: [...BONUS_TYPES],
  });

  // AI panel
  const [aiOpen, setAiOpen] = useState(true);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [generating, setGenerating] = useState(false);

  // Templates
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [directPlayLink, setDirectPlayLink] = useState<string | null>(null);
  const [directLinkLoading, setDirectLinkLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("source");
  const [activeSource, setActiveSource] = useState<QuestionSource | null>(null);
  const [segmentsEditorOpen, setSegmentsEditorOpen] = useState(false);

  // Import from assignment
  const [importOpen, setImportOpen] = useState(false);
  const [importAssignments, setImportAssignments] = useState<{ id: number; title: string; subject: string | null; gradeLevel: string | null; questionCount: number }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Import from question bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelectedIds, setBankSelectedIds] = useState<Set<number>>(new Set());

  // Load grade levels
  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Keep team names array length in sync with team count
  useEffect(() => {
    setConfig(c => {
      const names = [...c.teamNames];
      while (names.length < c.teamCount) names.push(defaultTeamName(names.length, contentLang));
      while (names.length > c.teamCount) names.pop();
      return { ...c, teamNames: names };
    });
  }, [config.teamCount, contentLang]);

  const selectedBonusTypes = () => {
    const configured = config.bonusTypes?.filter(type => BONUS_TYPES.includes(type));
    return configured && configured.length > 0 ? configured : [...BONUS_TYPES];
  };

  const configuredBonusCount = () =>
    config.bonusesEnabled ? Math.min(3, Math.max(1, config.bonusCount ?? 1)) : 0;

  const createConfiguredBonus = (type: BonusType, index: number): Segment => ({
    id: newId(),
    text: bonusLabel(type, contentLang),
    points: type === "lucky" ? 100 : 0,
    kind: "bonus",
    bonusType: type,
    color: WHEEL_PALETTE[index % WHEEL_PALETTE.length],
  });

  const applyBonusSettings = (sourceSegments: Segment[]) => {
    const desiredCount = configuredBonusCount();
    const questions = sourceSegments.filter(segment => segment.kind === "question");
    if (desiredCount === 0) return questions.slice(0, 16);

    const types = selectedBonusTypes();
    const existingBonuses = sourceSegments
      .filter(segment => segment.kind === "bonus")
      .slice(0, desiredCount)
      .map((segment, index) => ({
        ...segment,
        bonusType: types.includes(segment.bonusType ?? "lucky")
          ? segment.bonusType
          : types[index % types.length],
      }));
    const missingBonuses = Array.from(
      { length: Math.max(0, desiredCount - existingBonuses.length) },
      (_, index) => createConfiguredBonus(types[(existingBonuses.length + index) % types.length], questions.length + existingBonuses.length + index),
    );
    return colorize([
      ...questions.slice(0, 16 - desiredCount),
      ...existingBonuses,
      ...missingBonuses,
    ]);
  };

  const applyPointsSettings = (
    sourceSegments: Segment[],
    mode: PointsMode = config.pointsMode ?? "varied",
    uniformPoints = config.uniformPoints ?? 100,
  ) => {
    const questionSegments = sourceSegments.filter(segment => segment.kind === "question");
    const alreadyVaried = new Set(questionSegments.map(segment => segment.points)).size > 1;
    let questionIndex = 0;
    return sourceSegments.map(segment => {
      if (segment.kind !== "question") return segment;
      const points = mode === "uniform"
        ? uniformPoints
        : alreadyVaried
          ? segment.points
          : POINT_OPTIONS[questionIndex++ % POINT_OPTIONS.length];
      return { ...segment, points };
    });
  };

  const generateAI = async () => {
    if (!aiTopic.trim()) {
      toast.error(w.enterTopic);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/wheel-templates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subject: subject.trim() || null,
          gradeLevel: gradeLevel.trim() || null,
          segmentCount: aiCount,
          language: contentLang,
          includeBonus: config.bonusesEnabled,
          bonusCount: configuredBonusCount(),
          bonusTypes: selectedBonusTypes(),
          difficulty: aiDifficulty,
        }),
      });
      if (res.status === 401) {
        toast.error(w.loginRequired);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || w.generationFailed);
        return;
      }
      const generated = (data.segments || []).map((s: Segment) => ({ ...s, id: s.id || newId() }));
      setSegments(applyPointsSettings(applyBonusSettings(generated)));
      setSegmentsEditorOpen(true);
      if (!title.trim()) setTitle(aiTopic.trim().slice(0, 80));
      toast.success(w.generatedSegments.replace("{count}", String(generated.length)));
    } catch (err) {
      console.error(err);
      toast.error(w.error);
    } finally {
      setGenerating(false);
    }
  };

  const addManualSegment = (kind: "question" | "bonus" = "question") => {
    setActiveSource("manual");
    setSegmentsEditorOpen(true);
    setSegments(prev => {
      const next: Segment = kind === "question"
        ? { id: newId(), text: "", answer: "", points: 100, kind: "question" }
        : { id: newId(), text: w.defaultBonus, points: 0, kind: "bonus", bonusType: "double" };
      return colorize([...prev, next]);
    });
  };

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSegment = (id: string) => {
    setSegments(prev => colorize(prev.filter(s => s.id !== id)));
  };

  const validate = (): string | null => {
    const finalSegments = applyBonusSettings(segments);
    if (!title.trim()) return w.enterTitle;
    if (finalSegments.length < 2) return w.minimumSegments;
    if (finalSegments.length > 16) return w.maximumSegments;
    for (const s of finalSegments) {
      if (!s.text.trim()) return w.fillSegments;
      if (s.kind === "question" && !(s.answer ?? "").trim()) return w.enterAnswers;
    }
    return null;
  };

  const buildPayload = () => ({
    title: title.trim(),
    language: contentLang,
    gradeLevel: gradeLevel.trim() || null,
    subject: subject.trim() || null,
    segments: applyPointsSettings(applyBonusSettings(segments)),
    config,
  });

  const saveTemplate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const isUpdate = editingTemplateId !== null;
      const url = isUpdate
        ? `${API_BASE}/api/wheel-templates/${editingTemplateId}`
        : `${API_BASE}/api/wheel-templates`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || w.saveFailed);
        return;
      }
      const saved = await res.json();
      setEditingTemplateId(saved.id);
      setDirectPlayLink(null);
      toast.success(w.saved);
    } catch {
      toast.error(w.error);
    } finally {
      setSaving(false);
    }
  };

  const createDirectPlayLink = async () => {
    if (editingTemplateId === null) return;
    setDirectLinkLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/wheel-templates/${editingTemplateId}/play-links`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.token !== "string") {
        toast.error(data.message || (contentLang === "ar" ? "تعذّر إنشاء رابط العرض" : "Couldn't create display link"));
        return;
      }
      const link = `${window.location.origin}/play/${data.token}`;
      setDirectPlayLink(link);
      try {
        await navigator.clipboard.writeText(link);
        toast.success(contentLang === "ar" ? "تم إنشاء الرابط ونسخه" : "Link created and copied");
      } catch {
        toast.success(contentLang === "ar" ? "تم إنشاء رابط العرض" : "Display link created");
      }
    } catch {
      toast.error(contentLang === "ar" ? "تعذّر إنشاء رابط العرض" : "Couldn't create display link");
    } finally {
      setDirectLinkLoading(false);
    }
  };

  const copyDirectPlayLink = async () => {
    if (!directPlayLink) return;
    try {
      await navigator.clipboard.writeText(directPlayLink);
      toast.success(contentLang === "ar" ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(contentLang === "ar" ? "تعذّر نسخ الرابط" : "Couldn't copy link");
    }
  };

  const cancelDirectPlayLink = async () => {
    if (editingTemplateId === null || !directPlayLink) return;
    if (!window.confirm(contentLang === "ar" ? "هل تريد إلغاء رابط العرض؟ لن يعمل الرابط بعد ذلك." : "Cancel this display link? It will stop working.")) {
      return;
    }
    setDirectLinkLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/wheel-templates/${editingTemplateId}/play-links`,
        { method: "DELETE", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || (contentLang === "ar" ? "تعذّر إلغاء رابط العرض" : "Couldn't cancel display link"));
        return;
      }
      setDirectPlayLink(null);
      toast.success(contentLang === "ar" ? "تم إلغاء رابط العرض" : "Display link cancelled");
    } catch {
      toast.error(contentLang === "ar" ? "تعذّر إلغاء رابط العرض" : "Couldn't cancel display link");
    } finally {
      setDirectLinkLoading(false);
    }
  };

  const launchPlay = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setLaunching(true);
    try {
      // Always persist before launching so the play page can fetch a stable id.
      const isUpdate = editingTemplateId !== null;
      const url = isUpdate
        ? `${API_BASE}/api/wheel-templates/${editingTemplateId}`
        : `${API_BASE}/api/wheel-templates`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || w.launchFailed);
        return;
      }
      const saved = await res.json();
      setLocation(`/game/wheel/play/${saved.id}`);
    } catch {
      toast.error(w.error);
    } finally {
      setLaunching(false);
    }
  };

  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wheel-templates`, { credentials: "include" });
      if (!res.ok) {
        toast.error(w.templatesLoadFailed);
        return;
      }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    if (savedOpen) loadTemplates();
  }, [savedOpen]);

  const applyTemplate = (t: Template) => {
    setTitle(t.title);
    setContentLang(t.language);
    setSubject(t.subject ?? "");
    setGradeLevel(t.gradeLevel ?? "");
      setSegments(applyPointsSettings(colorize(t.segments), t.config.pointsMode ?? "varied", t.config.uniformPoints ?? 100));
    setSegmentsEditorOpen(true);
    // Older templates have no turn/points mode. Keep their existing
    // wheel-first, per-segment behavior instead of silently changing a game.
    setConfig({
      ...t.config,
      turnMode: t.config.turnMode ?? "wheel_first",
      pointsMode: t.config.pointsMode ?? "varied",
      uniformPoints: t.config.uniformPoints ?? 100,
      bonusesEnabled: t.config.bonusesEnabled ?? false,
      bonusCount: t.config.bonusCount ?? 1,
      bonusTypes: t.config.bonusTypes?.length ? t.config.bonusTypes : [...BONUS_TYPES],
    });
    setEditingTemplateId(t.isOwn ? t.id : null); // shared admin templates clone, don't overwrite
    setDirectPlayLink(null);
    setSavedOpen(false);
    setAiOpen(false);
    toast.success(w.loadedTemplate.replace("{title}", t.title));
  };

  const deleteTemplate = async (id: number) => {
    if (!window.confirm(w.deleteConfirm)) return;
    try {
      await fetch(`${API_BASE}/api/wheel-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      if (editingTemplateId === id) setEditingTemplateId(null);
      if (editingTemplateId === id) setDirectPlayLink(null);
      toast.success(w.deleted);
    } catch {
      toast.error(w.deleteError);
    }
  };

  const loadAssignmentsForImport = async () => {
    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments`, { credentials: "include" });
      if (!res.ok) { toast.error(w.assignmentsLoadFailed); return; }
      const data = await res.json();
      setImportAssignments(
        (Array.isArray(data) ? data : []).map((a: any) => ({
          id: a.id,
          title: a.title,
          subject: a.subject ?? null,
          gradeLevel: a.gradeLevel ?? null,
          questionCount: a.questionCount ?? 0,
        }))
      );
    } finally {
      setImportLoading(false);
    }
  };

  const importFromAssignment = async (assignmentId: number) => {
    setImportingId(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(w.assignmentLoadFailed); return; }
      const data = await res.json();
      const qs: any[] = Array.isArray(data.questions) ? data.questions : [];
      const compatible = qs.filter(q => ["mcq", "true_false"].includes(q.questionType));
      if (compatible.length === 0) {
        toast.error(w.noCompatibleQuestions);
        return;
      }
      const mcqAnswerText = (q: any): string => {
        if (q.questionType === "mcq") {
          const map: Record<string, string> = {
            A: q.optionA ?? "", B: q.optionB ?? "",
            C: q.optionC ?? "", D: q.optionD ?? "",
          };
          return map[q.correctAnswer?.toUpperCase()] || q.correctAnswer || "";
        }
        return q.correctAnswer ?? "";
      };

      const newSegs: Segment[] = compatible.slice(0, 16 - configuredBonusCount()).map(q => ({
        id: newId(),
        text: q.text,
        answer: mcqAnswerText(q),
        explanation: q.explanation ?? "",
        points: 100,
        kind: "question" as const,
        imageUrl: q.imageUrl || null,
      }));
      setSegments(applyPointsSettings(applyBonusSettings(newSegs), config.pointsMode, config.uniformPoints));
      setActiveSource("assignment");
      setSegmentsEditorOpen(false);
      setSetupStep("source");
      // Always apply title, subject, grade from the selected assignment
      if (data.title) setTitle(data.title);
      if (data.subject) setSubject(data.subject);
      if (data.gradeLevel) setGradeLevel(data.gradeLevel);
      setImportOpen(false);
      toast.success(w.importedQuestions.replace("{count}", String(newSegs.length)));
    } catch {
      toast.error(w.error);
    } finally {
      setImportingId(null);
    }
  };

  const isSupportedBankQuestion = (question: BankQuestion) => {
    if (question.questionType === "true_false") return !!question.text && !!question.correctAnswer;
    return !!question.text && !!question.optionA && !!question.optionB
      && !!question.optionC && !!question.optionD && !!question.correctAnswer;
  };

  const answerTextFromQuestion = (question: BankQuestion) => {
    if (question.questionType !== "true_false") {
      const options: Record<string, string> = {
        A: question.optionA ?? "",
        B: question.optionB ?? "",
        C: question.optionC ?? "",
        D: question.optionD ?? "",
      };
      const answerKeys = (question.correctAnswer ?? "")
        .split(",")
        .map(key => key.trim().toUpperCase())
        .filter(Boolean);
      const answerText = answerKeys
        .map(key => options[key])
        .filter(Boolean)
        .join("، ");
      return answerText || question.correctAnswer || "";
    }
    return question.correctAnswer || "";
  };

  const loadBankForImport = async () => {
    setBankLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (response.status === 401) {
        toast.error(w.bankLoginRequired);
        setBankOpen(false);
        return;
      }
      if (!response.ok) {
        toast.error(w.bankLoadFailed);
        return;
      }
      const data = await response.json();
      setBankQuestions((Array.isArray(data) ? data : []).filter(isSupportedBankQuestion));
    } catch {
      toast.error(w.bankLoadFailed);
    } finally {
      setBankLoading(false);
    }
  };

  const openBankImport = () => {
    setBankSelectedIds(new Set());
    setBankSearch("");
    setBankOpen(true);
    loadBankForImport();
  };

  const toggleBankQuestion = (id: number) => {
    setBankSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const missingBonuses = Math.max(0, configuredBonusCount() - segments.filter(segment => segment.kind === "bonus").length);
      const availableSlots = 16 - segments.length - missingBonuses;
      if (availableSlots <= 0) {
        toast.error(w.wheelFull);
        return previous;
      }
      if (next.size >= availableSlots) {
        toast.error(w.availableQuestions.replace("{count}", String(availableSlots)));
        return previous;
      }
      next.add(id);
      return next;
    });
  };

  const importFromBank = () => {
    const selected = bankQuestions.filter(question => bankSelectedIds.has(question.id));
    if (selected.length === 0) {
      toast.error(w.selectQuestion);
      return;
    }
    const missingBonuses = Math.max(0, configuredBonusCount() - segments.filter(segment => segment.kind === "bonus").length);
    const availableSlots = 16 - segments.length - missingBonuses;
    if (availableSlots <= 0) {
      toast.error(w.wheelFull);
      return;
    }
    const newSegments = selected.slice(0, availableSlots).map(question => ({
      id: newId(),
      text: question.text,
      answer: answerTextFromQuestion(question),
      points: 100,
      kind: "question" as const,
      imageUrl: question.imageUrl || null,
    }));
    setSegments(previous => applyPointsSettings(applyBonusSettings([...previous, ...newSegments]), config.pointsMode, config.uniformPoints));
    setActiveSource("bank");
    setSegmentsEditorOpen(true);
    setBankOpen(false);
    setSetupStep("source");
    if (!title.trim()) setTitle(w.bankChallenge);
    toast.success(w.bankQuestionsAdded.replace("{count}", String(newSegments.length)));
  };

  const colorPreview = useMemo(() => colorize(segments), [segments]);
  const chooseSource = (source: QuestionSource) => {
    setActiveSource(source);
    if (source === "assignment") {
      setImportOpen(true);
      loadAssignmentsForImport();
    } else if (source === "bank") {
      openBankImport();
    } else if (source === "ai") {
      setAiOpen(true);
    } else if (segments.length === 0) {
      addManualSegment("question");
    }
  };

  const returnToQuestions = () => {
    setSegmentsEditorOpen(false);
    setSetupStep("source");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const filteredBankQuestions = bankSearch.trim()
    ? bankQuestions.filter(question =>
      question.text.includes(bankSearch)
      || (question.subject ?? "").includes(bankSearch),
    )
    : bankQuestions;
  const bonusTypesValue = selectedBonusTypes();
  const bonusPreset = bonusTypesValue.length === BONUS_TYPES.length ? "mixed" : bonusTypesValue[0];

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100dvh-4rem)] py-5 sm:py-8 px-3 sm:px-5 max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-3 mb-5 sm:mb-7">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
              <WheelIcon size={32} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">{w.title}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{w.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSavedOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-bold text-sm shrink-0">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{w.library}</span>
          </button>
        </header>

        <nav aria-label={w.setupSteps} className="grid grid-cols-2 max-w-xl mx-auto mb-6 sm:mb-8 rounded-2xl bg-muted/60 p-1.5 border border-border">
          {([
            { id: "source" as const, label: w.questionsStep, icon: ListChecks },
            { id: "settings" as const, label: w.setupStep, icon: Settings2 },
          ]).map(step => {
            const active = setupStep === step.id;
            const locked = step.id === "settings" && segments.length < 2;
            const Icon = step.icon;
            return (
              <button key={step.id} type="button" disabled={locked} onClick={() => setSetupStep(step.id)}
                className={`min-w-0 flex items-center justify-center gap-2 rounded-xl py-2.5 px-2 text-xs sm:text-sm font-black transition-all ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"} disabled:opacity-45 disabled:cursor-not-allowed`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          {setupStep === "source" ? (
            <motion.main key="source" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              {segments.length === 0 && (
                <section className="rounded-3xl overflow-hidden border border-primary/15 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}10, ${BRAND_GOLD}16)` }}>
                  <div className="p-5 sm:p-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-11 h-11 rounded-2xl bg-card shadow-sm flex items-center justify-center"><WheelIcon size={30} /></div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-foreground">{w.chooseSource}</h2>
                        <p className="text-sm text-muted-foreground">{w.chooseSourceDescription}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                      <button type="button" onClick={() => chooseSource("assignment")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><FileDown className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{w.fromAssignment}</p>
                        <p className="text-xs text-muted-foreground mt-1">{w.fromAssignmentDescription}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("ai")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-amber-500/50 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_GOLD}1f`, color: BRAND_GOLD }}><Sparkles className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{w.withAi}</p>
                        <p className="text-xs text-muted-foreground mt-1">{w.withAiDescription}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("manual")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><PenLine className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{w.addManually}</p>
                        <p className="text-xs text-muted-foreground mt-1">{w.addManuallyDescription}</p>
                      </button>
                      <button type="button" onClick={() => chooseSource("bank")} className="group text-start rounded-2xl p-4 bg-card border-2 border-transparent hover:border-primary/45 hover:-translate-y-0.5 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Database className="w-5 h-5" /></div>
                        <p className="font-black text-foreground">{w.fromQuestionBank}</p>
                        <p className="text-xs text-muted-foreground mt-1">{w.fromQuestionBankDescription}</p>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {segments.length > 0 && (
                <Card className="relative overflow-hidden p-5 sm:p-6 border-primary/20 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}0e, ${BRAND_GOLD}14)` }}>
                  <div className="absolute -top-10 -end-8 w-32 h-32 rounded-full opacity-20" style={{ background: BRAND_GOLD }} />
                  <div className="relative flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-md" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                      {segments.length}
                    </div>
                    <h2 className="mt-3 text-lg sm:text-xl font-black text-foreground">{w.questionsReady}</h2>
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-lg">{w.questionsReadyDescription}</p>
                    <div className="mt-4 grid w-full max-w-lg grid-cols-1 sm:grid-cols-2 gap-2">
                      <button type="button" onClick={() => setSegmentsEditorOpen(open => !open)} className="min-h-10 px-3.5 rounded-xl bg-card hover:bg-primary/5 text-primary text-xs sm:text-sm font-bold border border-primary/25 flex items-center justify-center gap-2 transition-colors">
                        <Edit3 className="w-4 h-4" />
                        {segmentsEditorOpen ? w.hideQuestions : w.reviewQuestions}
                      </button>
                      <button type="button" onClick={() => addManualSegment("question")} className="min-h-10 px-3.5 rounded-xl bg-card hover:bg-primary/5 text-primary text-xs sm:text-sm font-bold border border-primary/25 flex items-center justify-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" />
                        {w.addQuestion}
                      </button>
                    </div>
                    {segments.length >= 2 && (
                      <button type="button" onClick={() => setSetupStep("settings")} className="mt-4 min-h-12 w-full sm:w-60 px-6 rounded-2xl text-white text-sm sm:text-base font-black shadow-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5" style={{ background: BRAND_PRIMARY }}>
                        {w.next}{dir === "rtl" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </Card>
              )}

              <AnimatePresence initial={false}>
                {activeSource === "ai" && aiOpen && (
                  <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="p-4 sm:p-5 border-amber-500/25">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" style={{ color: BRAND_GOLD }} /><div><h2 className="font-black text-foreground">{w.generateTitle}</h2><p className="text-xs text-muted-foreground">{w.generateDescription}</p></div></div>
                        <button type="button" onClick={() => setAiOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={w.topicPlaceholder} className="sm:col-span-3 w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none" />
                        <select value={aiCount} onChange={e => setAiCount(parseInt(e.target.value, 10))} className="px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold text-sm">
                          {[6, 8, 10, 12, 14, 16].map(count => <option key={count} value={count}>{count} {w.segments}</option>)}
                        </select>
                        <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as typeof aiDifficulty)} className="px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold text-sm">
                          <option value="easy">{w.easy}</option><option value="medium">{w.medium}</option><option value="hard">{w.hard}</option><option value="mixed">{w.mixed}</option>
                        </select>
                        <button type="button" onClick={() => setConfig(current => ({ ...current, bonusesEnabled: !current.bonusesEnabled }))} className={`rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${config.bonusesEnabled ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}><Gift className="w-4 h-4" />{config.bonusesEnabled ? w.bonuses : w.bonusesDisabled}</button>
                      </div>
                      <button type="button" disabled={generating} onClick={generateAI} className="mt-3 w-full sm:w-auto sm:min-w-56 px-5 py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                        {generating ? <><Loader2 className="w-4 h-4 animate-spin" />{w.generating}</> : <><Wand2 className="w-4 h-4" />{w.generateSegments}</>}
                      </button>
                    </Card>
                  </motion.section>
                )}
              </AnimatePresence>

              {(segmentsEditorOpen || (activeSource === "manual" && segments.length === 0)) && (
                <Card className="p-3 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div><h2 className="font-black text-foreground">{(activeSource === "assignment" ? w.reviewAssignmentQuestions : w.editSegments).replace("{count}", String(segments.length))}</h2><p className="text-xs text-muted-foreground mt-1">{w.pointsAndBonusesNote}</p></div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addManualSegment("question")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-sm font-bold border border-primary/30"><Plus className="w-4 h-4" />{w.addQuestion}</button>
                      <button type="button" onClick={() => addManualSegment("bonus")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border" style={{ background: `${BRAND_GOLD}18`, color: BRAND_GOLD, borderColor: `${BRAND_GOLD}55` }}><Gift className="w-4 h-4" />{w.addBonus}</button>
                    </div>
                  </div>
                  {segments.length === 0 ? (
                    <div className="rounded-2xl py-9 text-center bg-muted/35 text-muted-foreground"><PenLine className="w-7 h-7 mx-auto mb-2 opacity-50" /><p className="font-bold text-sm">{w.addFirstQuestion}</p></div>
                  ) : (
                    <div className="space-y-2">
                      {colorPreview.map((segment, index) => (
                        <motion.div layout key={segment.id} className="rounded-2xl border bg-card p-3 sm:p-4" style={{ borderColor: `${segment.color}48` }}>
                          <div className="flex items-start gap-2.5">
                            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow" style={{ background: segment.color }}>{index + 1}</div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black px-2 py-1 rounded-full" style={segment.kind === "bonus" ? { background: `${BRAND_GOLD}20`, color: BRAND_GOLD } : { background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                                  {segment.kind === "bonus" ? <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" />{w.bonus}</span> : <span className="inline-flex items-center gap-1"><HelpCircle className="w-3 h-3" />{w.question}</span>}
                                </span>
                                <select
                                  value={segment.kind === "question" && config.pointsMode === "uniform" ? config.uniformPoints : segment.points}
                                  disabled={segment.kind === "question" && config.pointsMode === "uniform"}
                                  onChange={e => updateSegment(segment.id, { points: parseInt(e.target.value, 10) })}
                                  className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background disabled:opacity-55 disabled:cursor-not-allowed"
                                >
                                  {(segment.kind === "bonus" ? [0, 100, 200] : POINT_OPTIONS).map(points => <option key={points} value={points}>{points} {w.point}</option>)}
                                </select>
                                {segment.kind === "bonus" && <select value={segment.bonusType ?? "lucky"} onChange={e => updateSegment(segment.id, { bonusType: e.target.value as BonusType })} className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background">{BONUS_TYPES.map(type => <option key={type} value={type}>{bonusLabel(type, contentLang)}</option>)}</select>}
                                <button type="button" onClick={() => removeSegment(segment.id)} className="ms-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" aria-label={w.removeSegment}><Trash2 className="w-4 h-4" /></button>
                              </div>
                              <textarea value={segment.text} onChange={e => updateSegment(segment.id, { text: e.target.value })} rows={2} placeholder={segment.kind === "question" ? w.questionPlaceholder : w.bonusPlaceholder} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm resize-none" />
                              {segment.kind === "question" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input type="text" value={segment.answer ?? ""} onChange={e => updateSegment(segment.id, { answer: e.target.value })} placeholder={w.correctAnswer} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /><input type="text" value={segment.explanation ?? ""} onChange={e => updateSegment(segment.id, { explanation: e.target.value })} placeholder={w.explanationPlaceholder} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /></div>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

            </motion.main>
          ) : (
            <motion.main key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <section className="rounded-3xl p-4 sm:p-5 border border-primary/15" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}0d, ${BRAND_GOLD}14)` }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div><p className="text-xs font-black tracking-wide uppercase" style={{ color: BRAND_PRIMARY }}>{w.wheelReady}</p><h2 className="text-lg sm:text-xl font-black text-foreground mt-1">{title || w.addGameTitle}</h2><p className="text-xs text-muted-foreground mt-1">{w.readySummary.replace("{segments}", String(segments.length)).replace("{teams}", String(config.teamCount))}</p></div>
                  <button type="button" onClick={returnToQuestions} className="px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-card border border-border hover:border-primary/40 flex items-center gap-1.5">
                    {dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    {w.backQuestions}
                  </button>
                </div>
              </section>
              <Card className="max-w-4xl mx-auto overflow-hidden border-primary/15 shadow-sm">
                <div className="p-3 sm:p-4 space-y-2.5">
                  <details open className="group rounded-2xl border border-border bg-card overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2 min-w-0"><span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Edit3 className="w-4 h-4" /></span><div className="min-w-0"><h3 className="text-sm font-black text-foreground">{w.gameInformation}</h3><p className="text-xs text-muted-foreground truncate">{title || w.addGameTitle}</p></div></div>
                      <span className="text-xs font-bold text-muted-foreground group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <div className="border-t border-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="sm:col-span-2"><label className="block text-xs font-bold text-foreground mb-1">{w.gameTitle}</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={w.gameTitlePlaceholder} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /></div>
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.contentLanguage}</label><select value={contentLang} onChange={e => setContentLang(e.target.value as "ar" | "en")} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none font-bold text-sm"><option value="ar">{w.languageArabic}</option><option value="en">{w.languageEnglish}</option></select></div>
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.subject}</label><input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={w.optional} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" /></div>
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.grade}</label>{gradeLevels.length > 0 ? <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none font-bold text-sm"><option value="">{w.optional}</option>{gradeLevels.map(grade => <option key={grade.gradeLevel} value={grade.gradeLevel}>{grade.gradeLevel}</option>)}</select> : <input type="text" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} placeholder={w.optional} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" />}</div>
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.teamCount}</label><select value={config.teamCount} onChange={e => setConfig(current => ({ ...current, teamCount: parseInt(e.target.value, 10) }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none font-bold text-sm">{[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} {w.teams}</option>)}</select></div>
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{config.teamNames.map((name, index) => <input key={index} type="text" value={name} onChange={e => { const names = [...config.teamNames]; names[index] = e.target.value; setConfig(current => ({ ...current, teamNames: names })); }} placeholder={defaultTeamName(index, contentLang)} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm" />)}</div>
                    </div>
                  </details>

                  <details open className="group rounded-2xl border border-border bg-card overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Users className="w-4 h-4" /></span><div><h3 className="text-sm font-black text-foreground">{w.gameRules}</h3><p className="text-xs text-muted-foreground">{w.turnMode} · {w.pointsSystem}</p></div></div>
                      <span className="text-xs font-bold text-muted-foreground group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <div className="border-t border-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.turnMode}</label><select value={config.turnMode} onChange={e => setConfig(current => ({ ...current, turnMode: e.target.value as TurnMode }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm font-bold"><option value="team_first">{w.teamFirst}</option><option value="wheel_first">{w.wheelFirst}</option></select></div>
                      <div><label className="text-xs font-bold text-foreground block mb-1">{w.pointsSystem}</label><select value={config.pointsMode} onChange={e => { const mode = e.target.value as PointsMode; setConfig(current => ({ ...current, pointsMode: mode })); setSegments(previous => applyPointsSettings(previous, mode, config.uniformPoints)); }} className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm font-bold"><option value="uniform">{w.uniformPoints}</option><option value="varied">{w.variedPoints}</option></select></div>
                      {config.pointsMode === "uniform" && <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2"><label className="text-xs font-bold text-foreground">{w.pointsPerQuestion}</label><select value={config.uniformPoints} onChange={e => { const points = parseInt(e.target.value, 10); setConfig(current => ({ ...current, uniformPoints: points })); setSegments(previous => applyPointsSettings(previous, "uniform", points)); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-black">{POINT_OPTIONS.map(points => <option key={points} value={points}>{points} {w.point}</option>)}</select></div>}
                    </div>
                  </details>

                  <details open className="group rounded-2xl overflow-hidden border" style={{ borderColor: `${BRAND_GOLD}55`, background: `${BRAND_GOLD}08` }}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_GOLD}20`, color: BRAND_GOLD }}><Gift className="w-4 h-4" /></span><div><h3 className="text-sm font-black text-foreground">{w.bonusSettings}</h3><p className="text-xs text-muted-foreground">{w.bonusSettingsDescription}</p></div></div>
                      <span className="text-xs font-bold text-muted-foreground group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <div className="border-t p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5" style={{ borderColor: `${BRAND_GOLD}35` }}>
                      <button type="button" onClick={() => setConfig(current => ({ ...current, bonusesEnabled: !current.bonusesEnabled }))} className={`min-h-10 rounded-xl border px-3 text-sm font-black transition-colors ${config.bonusesEnabled ? "bg-primary/10 text-primary border-primary/35" : "bg-background text-muted-foreground border-border"}`}>{config.bonusesEnabled ? w.bonusesEnabled : w.bonusesDisabled}</button>
                      <label className="block"><span className="text-xs font-bold text-foreground block mb-1">{w.bonusCount}</span><select disabled={!config.bonusesEnabled} value={config.bonusCount} onChange={e => setConfig(current => ({ ...current, bonusCount: parseInt(e.target.value, 10) }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold disabled:opacity-50"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
                      <label className="block"><span className="text-xs font-bold text-foreground block mb-1">{w.bonusStyle}</span><select disabled={!config.bonusesEnabled} value={bonusPreset} onChange={e => setConfig(current => ({ ...current, bonusTypes: e.target.value === "mixed" ? [...BONUS_TYPES] : [e.target.value as BonusType] }))} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold disabled:opacity-50"><option value="mixed">{w.mixedBonuses}</option>{BONUS_TYPES.map(type => <option key={type} value={type}>{bonusLabel(type, contentLang)}</option>)}</select></label>
                    </div>
                  </details>

                  <details className="group rounded-2xl border border-border bg-card overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><SlidersHorizontal className="w-4 h-4" /></span><h3 className="text-sm font-black text-foreground">{w.additionalOptions}</h3></div>
                      <span className="text-xs font-bold text-muted-foreground group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <div className="border-t border-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5"><div className="flex items-center justify-between gap-2 mb-2"><label className="text-xs font-bold text-foreground flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5" style={{ color: BRAND_PRIMARY }} />{w.spinDuration}</label><span className="text-xs font-black" style={{ color: BRAND_PRIMARY }}>{w.spinDurationValue.replace("{seconds}", String(config.spinSeconds))}</span></div><input type="range" min={3} max={10} value={config.spinSeconds} onChange={e => setConfig(current => ({ ...current, spinSeconds: parseInt(e.target.value, 10) }))} className="w-full accent-primary" /></div>
                      <button type="button" onClick={() => setConfig(current => ({ ...current, soundOn: !current.soundOn }))} className={`rounded-xl border px-3 py-2.5 font-bold text-sm transition-all flex items-center justify-between gap-2 ${config.soundOn ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-muted/20 text-muted-foreground"}`}><span className="flex items-center gap-2"><Volume2 className="w-4 h-4" />{w.sound}</span><span className="text-xs">{config.soundOn ? w.on : w.off}</span></button>
                    </div>
                  </details>
                </div>
                <div className="p-4 sm:px-6 sm:py-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-2.5">
                  <button type="button" disabled={launching || segments.length < 2} onClick={launchPlay} className="flex-1 py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>{launching ? <><Loader2 className="w-4 h-4 animate-spin" />{w.launching}</> : <><Play className="w-4 h-4" />{w.startPlaying}</>}</button>
                  {editingTemplateId !== null && (
                    directPlayLink ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={copyDirectPlayLink} className="py-3 px-3.5 rounded-xl font-bold bg-card border border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 transition-all text-sm" title={contentLang === "ar" ? "نسخ رابط العرض" : "Copy display link"}><Copy className="w-4 h-4" />{contentLang === "ar" ? "نسخ الرابط" : "Copy link"}</button>
                        <button type="button" disabled={directLinkLoading} onClick={cancelDirectPlayLink} className="py-3 px-3.5 rounded-xl font-bold border border-red-500/35 text-red-600 hover:bg-red-500/5 flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-sm" title={contentLang === "ar" ? "إلغاء رابط العرض" : "Cancel display link"}>{directLinkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}{contentLang === "ar" ? "إلغاء الرابط" : "Cancel"}</button>
                      </div>
                    ) : (
                      <button type="button" disabled={directLinkLoading} onClick={createDirectPlayLink} className="sm:min-w-44 py-3 px-4 rounded-xl font-bold border border-primary/35 text-primary bg-primary/5 hover:bg-primary/10 flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-sm">{directLinkLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{contentLang === "ar" ? "جارٍ الإنشاء..." : "Creating..."}</> : <><Link2 className="w-4 h-4" />{contentLang === "ar" ? "إنشاء رابط لعب مباشر" : "Create display link"}</>}</button>
                    )
                  )}
                  <button type="button" disabled={saving} onClick={saveTemplate} className="sm:min-w-44 py-3 px-5 rounded-xl font-bold bg-card border border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-sm">{saving ? <><Loader2 className="w-4 h-4 animate-spin" />{w.saving}</> : editingTemplateId !== null ? <><Check className="w-4 h-4" />{w.updateTemplate}</> : <><Save className="w-4 h-4" />{w.saveToLibrary}</>}</button>
                </div>
              </Card>
            </motion.main>
          )}
        </AnimatePresence>

        {/* Import from assignment modal */}
        <AnimatePresence>
          {importOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              onClick={() => setImportOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                      <FileDown className="w-5 h-5" style={{ color: BRAND_PRIMARY }} />
                      {w.importAssignment}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.importAssignmentDescription}
                    </p>
                  </div>
                  <button
                    onClick={() => setImportOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {importLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                  ) : importAssignments.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto opacity-30 mb-2" />
                      <p className="font-bold">{w.noAssignments}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {importAssignments.map(a => (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => importFromAssignment(a.id)}
                          disabled={importingId !== null || a.questionCount === 0}
                          className="w-full text-start border-2 border-border rounded-xl p-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground truncate">{a.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.questionCount > 0 ? `${a.questionCount} ${w.questions}` : w.noQuestions}
                              {a.subject ? ` · ${a.subject}` : ""}
                              {a.gradeLevel ? ` · ${a.gradeLevel}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                            {importingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import from question bank modal */}
        <AnimatePresence>
          {bankOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
              onClick={() => setBankOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 12 }}
                className="bg-card rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88dvh] overflow-hidden flex flex-col border border-border"
                onClick={event => event.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}>
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{w.chooseFromBank}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.chooseFromBankDescription}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setBankOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label={w.close}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <BookOpen className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={bankSearch}
                        onChange={event => setBankSearch(event.target.value)}
                        placeholder={w.bankSearchPlaceholder}
                        className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-border bg-background focus:border-primary outline-none text-sm"
                      />
                    </div>
                    <div className="px-3 py-2.5 rounded-xl bg-muted/60 text-xs font-bold text-muted-foreground text-center">
                      {bankSelectedIds.size} / {Math.max(0, 16 - segments.length)} {w.selected}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {bankLoading ? (
                    <div className="py-16 text-center text-muted-foreground"><Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" /><p className="text-sm font-bold">{w.loadingBank}</p></div>
                  ) : filteredBankQuestions.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground"><Database className="w-12 h-12 mx-auto opacity-30 mb-3" /><p className="font-bold">{bankQuestions.length === 0 ? w.noSupportedQuestions : w.noMatchingQuestions}</p><p className="text-xs mt-1">{w.bankSupportNote}</p></div>
                  ) : (
                    <div className="space-y-2">
                      {filteredBankQuestions.map(question => {
                        const selected = bankSelectedIds.has(question.id);
                        return (
                          <button key={question.id} type="button" onClick={() => toggleBankQuestion(question.id)} className={`w-full text-start rounded-2xl border-2 p-3 sm:p-4 transition-all ${selected ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/35 hover:bg-primary/[0.02]"}`}>
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>{selected && <Check className="w-3.5 h-3.5" />}</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-foreground line-clamp-2">{question.text}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {question.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{question.subject}</span>}
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}>{question.questionType === "true_false" ? w.trueFalse : w.multipleChoice}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 bg-card">
                  <p className="text-xs text-muted-foreground hidden sm:block">{w.importEditNote}</p>
                  <button type="button" disabled={bankSelectedIds.size === 0} onClick={importFromBank} className="ms-auto px-5 py-2.5 rounded-xl font-black text-white text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}>
                    <Check className="w-4 h-4" />{w.addQuestions.replace("{count}", String(bankSelectedIds.size || ""))}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved templates modal */}
        <AnimatePresence>
          {savedOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              onClick={() => setSavedOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-lg font-black text-foreground">
                    {w.templatesTitle}
                  </h3>
                  <button
                    onClick={() => setSavedOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {savedLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                  ) : savedTemplates.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <FolderOpen className="w-12 h-12 mx-auto opacity-30 mb-2" />
                      <p className="font-bold">
                        {w.noTemplates}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedTemplates.map(t => (
                        <div key={t.id} className="border-2 border-border rounded-xl p-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-foreground truncate">{t.title}</h4>
                                {t.fromAdmin && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                                    style={{ background: `${BRAND_GOLD}20`, color: BRAND_GOLD }}>
                                    {w.fromAdmin}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.segments.length} {w.segmentUnit}
                                {t.subject ? ` · ${t.subject}` : ""}
                                {t.gradeLevel ? ` · ${t.gradeLevel}` : ""}
                                {` · ${t.language === "ar" ? w.languageArabic : w.languageEnglish}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => applyTemplate(t)}
                                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary font-bold text-xs flex items-center gap-1 border border-primary/30 transition-all"
                              >
                                <Edit3 className="w-3 h-3" /> {w.load}
                              </button>
                              {t.isOwn && (
                                <button
                                  onClick={() => deleteTemplate(t.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                                  aria-label={w.delete}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
