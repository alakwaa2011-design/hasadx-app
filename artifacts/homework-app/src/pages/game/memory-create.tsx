import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Copy, Check, Brain, Sparkles, BookOpen, LogIn } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface CardPair {
  q: string;
  a: string;
}

const GRADE_LEVELS = [
  { value: "1-3", ar: "الصف ١-٣", en: "Grade 1-3" },
  { value: "4-6", ar: "الصف ٤-٦", en: "Grade 4-6" },
  { value: "7-9", ar: "الصف ٧-٩", en: "Grade 7-9" },
  { value: "10-12", ar: "الصف ١٠-١٢", en: "Grade 10-12" },
  { value: "uni", ar: "جامعي", en: "University" },
  { value: "general", ar: "عام", en: "General" },
];

const TEMPLATES = [
  {
    titleAr: "الرياضيات — الضرب",
    titleEn: "Math — Multiplication",
    pairs: [
      { q: "٣ × ٤", a: "١٢" },
      { q: "٧ × ٨", a: "٥٦" },
      { q: "٥ × ٩", a: "٤٥" },
      { q: "٦ × ٦", a: "٣٦" },
    ],
  },
  {
    titleAr: "العواصم العربية",
    titleEn: "Arab Capitals",
    pairs: [
      { q: "مصر", a: "القاهرة" },
      { q: "السعودية", a: "الرياض" },
      { q: "الأردن", a: "عمّان" },
      { q: "المغرب", a: "الرباط" },
    ],
  },
  {
    titleAr: "الإنجليزية — الحيوانات",
    titleEn: "English — Animals",
    pairs: [
      { q: "Cat", a: "قطة" },
      { q: "Dog", a: "كلب" },
      { q: "Bird", a: "عصفور" },
      { q: "Fish", a: "سمكة" },
    ],
  },
];

export default function MemoryCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("general");
  const [pairs, setPairs] = useState<CardPair[]>([{ q: "", a: "" }, { q: "", a: "" }]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ pin: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => { setIsLoggedIn(r.ok); })
      .catch(() => { setIsLoggedIn(false); });
  }, []);

  if (isLoggedIn === null) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-indigo-950/20">
          <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-indigo-950/20 px-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="max-w-md w-full text-center bg-white/90 dark:bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-xl border border-purple-100 dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">
              {lang === "ar" ? "تسجيل الدخول مطلوب" : "Login Required"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {lang === "ar" ? "يجب تسجيل الدخول كمعلم لإنشاء بطاقات مخصصة" : "You must be logged in as a teacher to create custom cards"}
            </p>
            <button
              onClick={() => setLocation("/login")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Log In"}
            </button>
            <button
              onClick={() => setLocation("/game/memory")}
              className="w-full py-2 mt-3 text-sm text-muted-foreground hover:text-foreground"
            >
              {lang === "ar" ? "العودة للعبة الذاكرة" : "Back to Memory Game"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const addPair = () => {
    if (pairs.length >= 18) return;
    setPairs([...pairs, { q: "", a: "" }]);
  };

  const removePair = (index: number) => {
    if (pairs.length <= 2) return;
    setPairs(pairs.filter((_, i) => i !== index));
  };

  const updatePair = (index: number, field: "q" | "a", value: string) => {
    setPairs(pairs.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const loadTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(lang === "ar" ? template.titleAr : template.titleEn);
    setPairs(template.pairs);
    setShowTemplates(false);
  };

  const validPairs = pairs.filter(p => p.q.trim() && p.a.trim());
  const canSave = title.trim() && validPairs.length >= 2;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/memory-card-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          gradeLevel,
          pairs: validPairs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ pin: data.pin });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (lang === "ar" ? "حدث خطأ" : "An error occurred");
      alert(msg);
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!result) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL || "/"}game/memory/play/${result.pin}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (result) {
    const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL || "/"}game/memory/play/${result.pin}`;
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 py-8 px-4" dir={dir}>
          <div className="max-w-md mx-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="text-7xl mb-4"
              >
                🎉
              </motion.div>
              <h1 className="text-2xl font-black text-foreground mb-2">{lang === "ar" ? "تم إنشاء مجموعة البطاقات!" : "Card Set Created!"}</h1>
              <p className="text-muted-foreground text-sm mb-6">{title}</p>

              <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg mb-6">
                <p className="text-xs text-muted-foreground mb-2">{lang === "ar" ? "رابط المشاركة" : "Share Link"}</p>
                <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-3">
                  <p className="text-xs font-mono text-foreground flex-1 truncate" dir="ltr">{shareUrl}</p>
                  <button onClick={handleCopy} className="p-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{lang === "ar" ? `الكود: ${result.pin}` : `PIN: ${result.pin}`}</p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setLocation(`/game/memory/play/${result.pin}`)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2"
                >
                  <Brain className="w-5 h-5" />
                  {lang === "ar" ? "العب الآن!" : "Play Now!"}
                </button>
                <button
                  onClick={() => { setResult(null); setTitle(""); setPairs([{ q: "", a: "" }, { q: "", a: "" }]); }}
                  className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {lang === "ar" ? "إنشاء مجموعة أخرى" : "Create Another Set"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-purple-500/30 mb-3">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-1">{lang === "ar" ? "إنشاء بطاقات مخصصة" : "Create Custom Cards"}</h1>
            <p className="text-muted-foreground text-xs">{lang === "ar" ? "أنشئ أزواج من الأسئلة والإجابات ليلعبها طلابك" : "Create question-answer pairs for your students to play"}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {lang === "ar" ? "استخدم قالب جاهز" : "Use a Template"}
            </button>

            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => loadTemplate(t)}
                      className="w-full text-start p-3 rounded-xl bg-card border border-border/60 hover:border-purple-400/50 hover:shadow-md transition-all"
                    >
                      <p className="font-bold text-sm text-foreground">{lang === "ar" ? t.titleAr : t.titleEn}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.pairs.length} {lang === "ar" ? "أزواج" : "pairs"}</p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <label className="text-sm font-bold text-foreground block mb-1.5">{lang === "ar" ? "عنوان المجموعة" : "Set Title"}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={lang === "ar" ? "مثال: جدول الضرب" : "e.g. Multiplication Table"}
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-colors"
              />
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <label className="text-sm font-bold text-foreground block mb-1.5">{lang === "ar" ? "المرحلة الدراسية" : "Grade Level"}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {GRADE_LEVELS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setGradeLevel(g.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      gradeLevel === g.value
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {lang === "ar" ? g.ar : g.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-foreground">{lang === "ar" ? "الأزواج" : "Pairs"} ({validPairs.length}/{pairs.length})</label>
                <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "الحد الأقصى ١٨" : "Max 18"}</span>
              </div>

              <div className="space-y-3">
                {pairs.map((pair, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-2">
                      {i + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={pair.q}
                        onChange={e => updatePair(i, "q", e.target.value)}
                        placeholder={lang === "ar" ? "السؤال / الكلمة" : "Question / Word"}
                        maxLength={50}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-colors"
                      />
                      <input
                        type="text"
                        value={pair.a}
                        onChange={e => updatePair(i, "a", e.target.value)}
                        placeholder={lang === "ar" ? "الإجابة / المطابقة" : "Answer / Match"}
                        maxLength={50}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => removePair(i)}
                      disabled={pairs.length <= 2}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 shrink-0 mt-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {pairs.length < 18 && (
                <button
                  onClick={addPair}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-muted-foreground text-xs font-bold hover:border-purple-400 hover:text-purple-500 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === "ar" ? "إضافة زوج" : "Add Pair"}
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-base shadow-xl shadow-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-2xl"
            >
              {saving ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "احفظ وأنشئ الرابط" : "Save & Create Link")}
            </button>
          </motion.div>

          <button onClick={() => setLocation("/game/memory")} className="w-full mt-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "العودة" : "Back"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
