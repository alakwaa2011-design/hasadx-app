import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Play, Plus, Trash2, Save, FolderOpen, Loader2,
  Wand2, X, Gift, HelpCircle, Edit3, Check,
  Globe, BookOpen, GraduationCap, Users, FileDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

const WHEEL_PALETTE = [
  "#225739", "#D9A521", "#3a7a55", "#c47e2c",
  "#1f4d3a", "#e6b54f", "#2d6a4f", "#b08440",
];

const POINT_OPTIONS = [50, 100, 200, 300, 500] as const;
const BONUS_TYPES = ["double", "skip", "swap", "lucky", "lose"] as const;

type BonusType = (typeof BONUS_TYPES)[number];

interface Segment {
  id: string;
  text: string;
  answer?: string;
  explanation?: string;
  points: number;
  color?: string;
  kind: "question" | "bonus";
  bonusType?: BonusType;
}

interface WheelConfig {
  teamCount: number;
  teamNames: string[];
  spinSeconds: number;
  soundOn: boolean;
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

const newId = () => `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const defaultTeamName = (i: number, lang: "ar" | "en") => {
  const ar = ["الأذكياء", "المتميزون", "الفائقون", "المبدعون", "الرائعون", "الرياديون"];
  const en = ["Champions", "Stars", "Warriors", "Innovators", "Legends", "Pioneers"];
  return (lang === "ar" ? ar : en)[i] ?? `${lang === "ar" ? "فريق" : "Team"} ${i + 1}`;
};

const bonusLabel = (b: BonusType, lang: "ar" | "en") => {
  if (lang === "ar") {
    return { double: "نقاط مضاعفة", skip: "تخطّى الدور", swap: "تبادل النقاط", lucky: "حظ سعيد", lose: "خسارة نصف النقاط" }[b];
  }
  return { double: "Double Points", skip: "Skip Turn", swap: "Swap Scores", lucky: "Lucky Bonus", lose: "Lose Half" }[b];
};

const colorize = (segs: Segment[]): Segment[] =>
  segs.map((s, i) => ({ ...s, color: s.color ?? WHEEL_PALETTE[i % WHEEL_PALETTE.length] }));

export default function WheelCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
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
  });

  // AI panel
  const [aiOpen, setAiOpen] = useState(true);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [aiBonus, setAiBonus] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Templates
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Import from assignment
  const [importOpen, setImportOpen] = useState(false);
  const [importAssignments, setImportAssignments] = useState<{ id: number; title: string; subject: string | null; gradeLevel: string | null; questionCount: number }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

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

  const generateAI = async () => {
    if (!aiTopic.trim()) {
      toast.error(ar ? "أدخل الموضوع أولاً" : "Enter a topic first");
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
          includeBonus: aiBonus,
          difficulty: aiDifficulty,
        }),
      });
      if (res.status === 401) {
        toast.error(ar ? "يجب تسجيل الدخول" : "Please log in");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || (ar ? "تعذّر التوليد" : "Generation failed"));
        return;
      }
      const generated = (data.segments || []).map((s: Segment) => ({ ...s, id: s.id || newId() }));
      setSegments(colorize(generated));
      if (!title.trim()) setTitle(aiTopic.trim().slice(0, 80));
      toast.success(ar ? `تم توليد ${generated.length} قطاع` : `Generated ${generated.length} segments`);
    } catch (err) {
      console.error(err);
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setGenerating(false);
    }
  };

  const addManualSegment = (kind: "question" | "bonus" = "question") => {
    setSegments(prev => {
      const next: Segment = kind === "question"
        ? { id: newId(), text: "", answer: "", points: 100, kind: "question" }
        : { id: newId(), text: ar ? "نقاط مضاعفة" : "Double Points", points: 0, kind: "bonus", bonusType: "double" };
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
    if (!title.trim()) return ar ? "أدخل عنوان اللعبة" : "Enter a title";
    if (segments.length < 2) return ar ? "أضف قطاعَين على الأقل" : "Add at least 2 segments";
    if (segments.length > 16) return ar ? "الحد الأقصى ١٦ قطاع" : "Max 16 segments";
    for (const s of segments) {
      if (!s.text.trim()) return ar ? "املأ نص كل القطاعات" : "Fill all segment texts";
      if (s.kind === "question" && !(s.answer ?? "").trim()) return ar ? "أدخل إجابات الأسئلة" : "Enter answers for questions";
    }
    return null;
  };

  const buildPayload = () => ({
    title: title.trim(),
    language: contentLang,
    gradeLevel: gradeLevel.trim() || null,
    subject: subject.trim() || null,
    segments: colorize(segments),
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
        toast.error(data.message || (ar ? "فشل الحفظ" : "Save failed"));
        return;
      }
      const saved = await res.json();
      setEditingTemplateId(saved.id);
      toast.success(ar ? "تم الحفظ في المكتبة" : "Saved to library");
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setSaving(false);
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
        toast.error(data.message || (ar ? "فشل الإطلاق" : "Launch failed"));
        return;
      }
      const saved = await res.json();
      setLocation(`/game/wheel/play/${saved.id}`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setLaunching(false);
    }
  };

  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wheel-templates`, { credentials: "include" });
      if (!res.ok) {
        toast.error(ar ? "تعذّر تحميل القوالب" : "Failed to load templates");
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
    setSegments(colorize(t.segments));
    setConfig(t.config);
    setEditingTemplateId(t.isOwn ? t.id : null); // shared admin templates clone, don't overwrite
    setSavedOpen(false);
    setAiOpen(false);
    toast.success(ar ? `تم تحميل "${t.title}"` : `Loaded "${t.title}"`);
  };

  const deleteTemplate = async (id: number) => {
    if (!window.confirm(ar ? "حذف هذا القالب؟" : "Delete this template?")) return;
    try {
      await fetch(`${API_BASE}/api/wheel-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      if (editingTemplateId === id) setEditingTemplateId(null);
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch {
      toast.error(ar ? "خطأ في الحذف" : "Delete error");
    }
  };

  const loadAssignmentsForImport = async () => {
    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الواجبات" : "Failed to load assignments"); return; }
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
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الواجب" : "Failed to load assignment"); return; }
      const data = await res.json();
      const qs: any[] = Array.isArray(data.questions) ? data.questions : [];
      const compatible = qs.filter(q => ["mcq", "true_false"].includes(q.questionType));
      if (compatible.length === 0) {
        toast.error(ar ? "لا توجد أسئلة اختيار متعدد أو صح/خطأ في هذا الواجب" : "No MCQ or True/False questions found");
        return;
      }
      const newSegs: Segment[] = compatible.slice(0, 16).map(q => ({
        id: newId(),
        text: q.text,
        answer: q.correctAnswer ?? "",
        explanation: q.explanation ?? "",
        points: 100,
        kind: "question" as const,
      }));
      setSegments(colorize(newSegs));
      if (!title.trim() && data.title) setTitle(data.title);
      if (!subject.trim() && data.subject) setSubject(data.subject);
      if (!gradeLevel && data.gradeLevel) setGradeLevel(data.gradeLevel);
      setImportOpen(false);
      toast.success(ar ? `تم استيراد ${newSegs.length} سؤال` : `Imported ${newSegs.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
    } finally {
      setImportingId(null);
    }
  };

  const colorPreview = useMemo(() => colorize(segments), [segments]);

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100dvh-4rem)] py-6 px-3 sm:px-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})`,
              }}
            >
              <span className="text-3xl">🎡</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                {ar ? "عجلة الحظ" : "Wheel of Fortune"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {ar
                  ? "أدر العجلة على شاشة الفصل، اقرأ السؤال، ومنح النقاط للفرق."
                  : "Spin the wheel on the class display, read the question, and award points to teams."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setImportOpen(true); loadAssignmentsForImport(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-bold text-sm"
            >
              <FileDown className="w-4 h-4" />
              {ar ? "استيراد من واجب" : "Import from Assignment"}
            </button>
            <button
              onClick={() => setSavedOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-bold text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              {ar ? "قوالبي" : "My Templates"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT — Setup column (lg=2) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basics card */}
            <Card className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {ar ? "عنوان اللعبة" : "Game Title"}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={ar ? "مثال: مراجعة الفصل الأول" : "e.g. Chapter 1 Review"}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    {ar ? "لغة المحتوى" : "Content language"}
                  </label>
                  <div className="flex gap-2">
                    {(["ar", "en"] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setContentLang(l)}
                        className={`flex-1 py-2.5 rounded-xl font-bold border-2 transition-all ${contentLang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}
                      >
                        {l === "ar" ? "العربية" : "English"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    {ar ? "المادة (اختياري)" : "Subject (optional)"}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder={ar ? "مثال: العلوم" : "e.g. Science"}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    {ar ? "الصف (اختياري)" : "Grade (optional)"}
                  </label>
                  {gradeLevels.length > 0 ? (
                    <select
                      value={gradeLevel}
                      onChange={e => setGradeLevel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold"
                    >
                      <option value="">{ar ? "بدون تحديد" : "Any grade"}</option>
                      {gradeLevels.map(g => (
                        <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={gradeLevel}
                      onChange={e => setGradeLevel(e.target.value)}
                      placeholder={ar ? "مثال: الصف الخامس" : "e.g. Grade 5"}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none"
                    />
                  )}
                </div>
              </div>
            </Card>

            {/* AI generate card */}
            <Card className="p-5">
              <button
                type="button"
                onClick={() => setAiOpen(o => !o)}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: BRAND_GOLD }} />
                  <h3 className="text-lg font-black text-foreground">
                    {ar ? "توليد الأسئلة بالذكاء الاصطناعي" : "AI Question Generation"}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-bold">
                  {aiOpen ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {aiOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-1.5">
                          {ar ? "الموضوع" : "Topic"}
                        </label>
                        <input
                          type="text"
                          value={aiTopic}
                          onChange={e => setAiTopic(e.target.value)}
                          placeholder={ar ? "مثال: الكسور والأعداد العشرية" : "e.g. Fractions and decimals"}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-foreground mb-1.5">
                            {ar ? "عدد القطاعات" : "Segments"}
                          </label>
                          <select
                            value={aiCount}
                            onChange={e => setAiCount(parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold"
                          >
                            {[6, 8, 10, 12, 14, 16].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-foreground mb-1.5">
                            {ar ? "الصعوبة" : "Difficulty"}
                          </label>
                          <select
                            value={aiDifficulty}
                            onChange={e => setAiDifficulty(e.target.value as typeof aiDifficulty)}
                            className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-background focus:border-primary outline-none font-bold"
                          >
                            <option value="easy">{ar ? "سهل" : "Easy"}</option>
                            <option value="medium">{ar ? "متوسط" : "Medium"}</option>
                            <option value="hard">{ar ? "صعب" : "Hard"}</option>
                            <option value="mixed">{ar ? "مختلط" : "Mixed"}</option>
                          </select>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-bold text-foreground mb-1.5">
                            {ar ? "قطاعات مكافآت" : "Bonus tiles"}
                          </label>
                          <button
                            type="button"
                            onClick={() => setAiBonus(b => !b)}
                            className={`w-full py-2.5 rounded-xl border-2 font-bold transition-all ${aiBonus ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
                          >
                            {aiBonus ? (ar ? "مفعّل" : "On") : (ar ? "متوقّف" : "Off")}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={generating}
                        onClick={generateAI}
                        className="w-full py-3 rounded-xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}
                      >
                        {generating
                          ? <><Loader2 className="w-5 h-5 animate-spin" /> {ar ? "جارٍ التوليد…" : "Generating…"}</>
                          : <><Wand2 className="w-5 h-5" /> {ar ? "ولّد القطاعات" : "Generate Segments"}</>}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Segments editor */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-foreground">
                  {ar ? `القطاعات (${segments.length})` : `Segments (${segments.length})`}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addManualSegment("question")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-sm font-bold border border-primary/30 transition-all"
                  >
                    <Plus className="w-4 h-4" /> {ar ? "سؤال" : "Question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => addManualSegment("bonus")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-all"
                    style={{ background: `${BRAND_GOLD}20`, color: BRAND_GOLD, borderColor: `${BRAND_GOLD}66` }}
                  >
                    <Gift className="w-4 h-4" /> {ar ? "مكافأة" : "Bonus"}
                  </button>
                </div>
              </div>

              {segments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <span className="text-4xl block mb-3">🎡</span>
                  <p className="font-bold mb-1">
                    {ar ? "لا توجد قطاعات بعد" : "No segments yet"}
                  </p>
                  <p className="text-sm">
                    {ar ? "ولّدها بالذكاء الاصطناعي أو أضفها يدوياً." : "Generate with AI or add them manually."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {colorPreview.map((s, idx) => (
                    <div
                      key={s.id}
                      className="rounded-xl border-2 bg-card p-3 sm:p-4"
                      style={{ borderColor: `${s.color}40` }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
                          style={{ background: s.color }}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full"
                              style={s.kind === "bonus"
                                ? { background: `${BRAND_GOLD}20`, color: BRAND_GOLD }
                                : { background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}>
                              {s.kind === "bonus"
                                ? <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" /> {ar ? "مكافأة" : "Bonus"}</span>
                                : <span className="inline-flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {ar ? "سؤال" : "Question"}</span>}
                            </span>
                            <select
                              value={s.points}
                              onChange={e => updateSegment(s.id, { points: parseInt(e.target.value, 10) })}
                              className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background"
                            >
                              {(s.kind === "bonus" ? [0, 100, 200] : POINT_OPTIONS).map(p => (
                                <option key={p} value={p}>{p} {ar ? "نقطة" : "pts"}</option>
                              ))}
                            </select>
                            {s.kind === "bonus" && (
                              <select
                                value={s.bonusType ?? "lucky"}
                                onChange={e => updateSegment(s.id, { bonusType: e.target.value as BonusType })}
                                className="text-xs font-bold rounded-lg px-2 py-1 border border-border bg-background"
                              >
                                {BONUS_TYPES.map(b => (
                                  <option key={b} value={b}>{bonusLabel(b, contentLang)}</option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSegment(s.id)}
                              className="ms-auto text-muted-foreground hover:text-red-500 transition-colors"
                              aria-label="remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={s.text}
                            onChange={e => updateSegment(s.id, { text: e.target.value })}
                            rows={2}
                            placeholder={s.kind === "question"
                              ? (ar ? "نص السؤال…" : "Question text…")
                              : (ar ? "عنوان المكافأة…" : "Bonus label…")}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary outline-none text-sm resize-none"
                          />
                          {s.kind === "question" && (
                            <>
                              <input
                                type="text"
                                value={s.answer ?? ""}
                                onChange={e => updateSegment(s.id, { answer: e.target.value })}
                                placeholder={ar ? "الإجابة الصحيحة…" : "Correct answer…"}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary outline-none text-sm"
                              />
                              <input
                                type="text"
                                value={s.explanation ?? ""}
                                onChange={e => updateSegment(s.id, { explanation: e.target.value })}
                                placeholder={ar ? "شرح موجز (اختياري)" : "Brief explanation (optional)"}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary outline-none text-xs text-muted-foreground"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT — Game settings + actions */}
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-lg font-black text-foreground mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: BRAND_PRIMARY }} />
                {ar ? "إعدادات الفرق" : "Team Settings"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    {ar ? "عدد الفرق" : "Number of teams"}
                  </label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfig(c => ({ ...c, teamCount: n }))}
                        className={`flex-1 h-10 rounded-xl font-black text-base border-2 transition-all ${config.teamCount === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    {ar ? "أسماء الفرق" : "Team names"}
                  </label>
                  <div className="space-y-2">
                    {config.teamNames.map((name, i) => (
                      <input
                        key={i}
                        type="text"
                        value={name}
                        onChange={e => {
                          const next = [...config.teamNames];
                          next[i] = e.target.value;
                          setConfig(c => ({ ...c, teamNames: next }));
                        }}
                        placeholder={defaultTeamName(i, contentLang)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary outline-none text-sm"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-black text-foreground mb-3">
                {ar ? "إعدادات الدوران" : "Spin Settings"}
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-foreground">
                      {ar ? "مدة الدوران" : "Spin duration"}
                    </label>
                    <span className="text-sm font-black" style={{ color: BRAND_PRIMARY }}>
                      {config.spinSeconds}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={config.spinSeconds}
                    onChange={e => setConfig(c => ({ ...c, spinSeconds: parseInt(e.target.value, 10) }))}
                    className="w-full accent-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, soundOn: !c.soundOn }))}
                  className={`w-full py-2.5 rounded-xl font-bold border-2 transition-all ${config.soundOn ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"}`}
                >
                  {config.soundOn
                    ? (ar ? "🔊 الصوت مفعّل" : "🔊 Sound on")
                    : (ar ? "🔇 الصوت متوقّف" : "🔇 Sound off")}
                </button>
              </div>
            </Card>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={launching || segments.length < 2}
                onClick={launchPlay}
                className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-xl"
                style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_GOLD})` }}
              >
                {launching
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> {ar ? "جارٍ الإطلاق…" : "Launching…"}</>
                  : <><Play className="w-5 h-5" /> {ar ? "ابدأ اللعب" : "Start Playing"}</>}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveTemplate}
                className="w-full py-2.5 rounded-xl font-bold bg-card border-2 border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {ar ? "جارٍ الحفظ…" : "Saving…"}</>
                  : editingTemplateId !== null
                    ? <><Check className="w-4 h-4" /> {ar ? "تحديث القالب" : "Update Template"}</>
                    : <><Save className="w-4 h-4" /> {ar ? "احفظ في المكتبة" : "Save to Library"}</>}
              </button>
            </div>
          </div>
        </div>

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
                      {ar ? "استيراد من واجب" : "Import from Assignment"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ar ? "اختر واجباً لاستيراد أسئلته (اختيار متعدد وصح/خطأ)" : "Select an assignment to import MCQ & True/False questions"}
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
                      <p className="font-bold">{ar ? "لا توجد واجبات" : "No assignments found"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {importAssignments.map(a => (
                        <div
                          key={a.id}
                          className="border-2 border-border rounded-xl p-3 hover:border-primary/40 hover:bg-primary/[0.02] transition-all flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground truncate">{a.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.questionCount > 0 ? `${a.questionCount} ${ar ? "سؤال" : "questions"}` : ar ? "بدون أسئلة" : "no questions"}
                              {a.subject ? ` · ${a.subject}` : ""}
                              {a.gradeLevel ? ` · ${a.gradeLevel}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => importFromAssignment(a.id)}
                            disabled={importingId === a.id || a.questionCount === 0}
                            className="shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY, borderColor: `${BRAND_PRIMARY}40` }}
                          >
                            {importingId === a.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <FileDown className="w-3.5 h-3.5" />}
                            {ar ? "استيراد" : "Import"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    {ar ? "قوالب عجلة الحظ" : "Wheel Templates"}
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
                        {ar ? "لا توجد قوالب محفوظة بعد" : "No saved templates yet"}
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
                                    {ar ? "من الإدارة" : "From admin"}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.segments.length} {ar ? "قطاع" : "segments"}
                                {t.subject ? ` · ${t.subject}` : ""}
                                {t.gradeLevel ? ` · ${t.gradeLevel}` : ""}
                                {` · ${t.language === "ar" ? "العربية" : "English"}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => applyTemplate(t)}
                                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary font-bold text-xs flex items-center gap-1 border border-primary/30 transition-all"
                              >
                                <Edit3 className="w-3 h-3" /> {ar ? "تحميل" : "Load"}
                              </button>
                              {t.isOwn && (
                                <button
                                  onClick={() => deleteTemplate(t.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                                  aria-label="delete"
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
