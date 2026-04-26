import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Copy, Check, Shuffle, BookOpen, LogIn, Eye, Send, MessageSquare, Type } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface WordEntry {
  word: string;
  hint: string;
  question: string;
}

const GRADE_LEVELS = [
  { value: "1-3", ar: "الصف ١-٣", en: "Grade 1-3" },
  { value: "4-6", ar: "الصف ٤-٦", en: "Grade 4-6" },
  { value: "7-9", ar: "الصف ٧-٩", en: "Grade 7-9" },
  { value: "10-12", ar: "الصف ١٠-١٢", en: "Grade 10-12" },
  { value: "general", ar: "عام", en: "General" },
];

const WORD_COUNT_OPTIONS = [
  { value: 1, ar: "كلمة واحدة", en: "Single Word" },
  { value: 2, ar: "كلمتين", en: "Two Words" },
  { value: 3, ar: "ثلاث كلمات", en: "Three Words" },
  { value: 4, ar: "أربع كلمات", en: "Four Words" },
];

const TEMPLATES = [
  {
    titleAr: "حيوانات سهلة",
    titleEn: "Easy Animals",
    words: [
      { word: "قطة", hint: "حيوان أليف يموء", question: "" },
      { word: "كلب", hint: "حيوان أليف وفيّ", question: "" },
      { word: "أسد", hint: "ملك الغابة", question: "" },
      { word: "فيل", hint: "أكبر حيوان بري", question: "" },
      { word: "بقرة", hint: "تعطينا الحليب", question: "" },
    ],
  },
  {
    titleAr: "فواكه وخضروات",
    titleEn: "Fruits & Vegetables",
    words: [
      { word: "تفاح", hint: "فاكهة حمراء", question: "" },
      { word: "موز", hint: "فاكهة صفراء منحنية", question: "" },
      { word: "عنب", hint: "في عناقيد", question: "" },
      { word: "جزر", hint: "خضار برتقالي", question: "" },
      { word: "خيار", hint: "خضار أخضر طويل", question: "" },
    ],
  },
  {
    titleAr: "دول عربية",
    titleEn: "Arab Countries",
    words: [
      { word: "مصر", hint: "أرض الأهرامات", question: "" },
      { word: "لبنان", hint: "بلد الأرز", question: "" },
      { word: "الأردن", hint: "فيها البتراء", question: "" },
      { word: "العراق", hint: "بلاد الرافدين", question: "" },
      { word: "تونس", hint: "الخضراء", question: "" },
    ],
  },
];

export default function ScrambleCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("general");
  const [wordCount, setWordCount] = useState(1);
  const [words, setWords] = useState<WordEntry[]>([
    { word: "", hint: "", question: "" },
    { word: "", hint: "", question: "" },
    { word: "", hint: "", question: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ pin: string; id: number } | null>(null);
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-fuchsia-50 to-violet-50 dark:from-purple-950/20 dark:via-fuchsia-950/20 dark:to-violet-950/20">
          <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-fuchsia-50 to-violet-50 dark:from-purple-950/20 dark:via-fuchsia-950/20 dark:to-violet-950/20 px-4" dir={dir}>
          <div className="max-w-md w-full text-center bg-white/90 dark:bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-xl border border-purple-100 dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">
              {lang === "ar" ? "تسجيل الدخول مطلوب" : "Login Required"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {lang === "ar" ? "يجب تسجيل الدخول كمعلم لإنشاء كلمات مخصصة" : "You must be logged in as a teacher to create custom words"}
            </p>
            <button
              onClick={() => setLocation("/login")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-lg">
              {lang === "ar" ? "تسجيل الدخول" : "Login"}
            </button>
            <button
              onClick={() => setLocation("/game/scramble")}
              className="w-full mt-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              {lang === "ar" ? "العودة للعبة" : "Back to game"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const updateWord = (index: number, field: keyof WordEntry, value: string) => {
    setWords(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  };

  const addWord = () => {
    if (words.length < 30) setWords(prev => [...prev, { word: "", hint: "", question: "" }]);
  };

  const removeWord = (index: number) => {
    if (words.length > 3) setWords(prev => prev.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(lang === "ar" ? template.titleAr : template.titleEn);
    setWords(template.words.map(w => ({ ...w })));
    setShowTemplates(false);
  };

  const validWords = words.filter(w => w.word.trim().length >= 2);
  const canSave = title.trim().length > 0 && validWords.length >= 3;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/word-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          gradeLevel,
          wordCount,
          words: validWords.map(w => ({
            word: w.word.trim(),
            hint: w.hint.trim(),
            question: w.question.trim() || undefined,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ pin: data.pin, id: data.id });
      }
    } catch {}
    setSaving(false);
  };

  const handleCopy = () => {
    if (!result) return;
    const url = `${window.location.origin}/game/scramble/play?pin=${result.pin}`;
    const text = lang === "ar"
      ? `🔤 الكلمات المبعثرة — ${title}\n🔑 الرمز: ${result.pin}\n🔗 ${url}`
      : `🔤 Scrambled Words — ${title}\n🔑 PIN: ${result.pin}\n🔗 ${url}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  if (result) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-violet-50 dark:from-purple-950/20 dark:via-fuchsia-950/20 dark:to-violet-950/20 py-8 px-4" dir={dir}>
          <div className="max-w-md mx-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border/60 rounded-3xl p-8 shadow-2xl text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-black text-foreground mb-2">
                {lang === "ar" ? "تم إنشاء الكلمات!" : "Words Created!"}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">{title}</p>

              <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 mb-6">
                <p className="text-white/70 text-xs font-bold mb-1">{lang === "ar" ? "رمز PIN" : "PIN Code"}</p>
                <p className="text-4xl font-black text-white tracking-[0.3em]" dir="ltr">{result.pin}</p>
              </div>

              <div className="space-y-2">
                <button onClick={handleCopy}
                  className="w-full py-3 rounded-xl bg-card border-2 border-purple-300 dark:border-purple-700 font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-2 transition-all hover:bg-purple-50 dark:hover:bg-purple-950/20">
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? (lang === "ar" ? "تم النسخ!" : "Copied!") : (lang === "ar" ? "نسخ الرابط والرمز" : "Copy link & PIN")}
                </button>

                <button
                  onClick={() => setLocation(`/game/scramble/monitor?pin=${result.pin}&title=${encodeURIComponent(title)}`)}
                  className="w-full py-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-300 dark:border-blue-700 font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 transition-all hover:bg-blue-100">
                  <Eye className="w-5 h-5" />
                  {lang === "ar" ? "مراقبة الطلاب مباشرة" : "Monitor Students Live"}
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => { setResult(null); setTitle(""); setWords([{ word: "", hint: "", question: "" }, { word: "", hint: "", question: "" }, { word: "", hint: "", question: "" }]); }}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm">
                  {lang === "ar" ? "إنشاء مجموعة أخرى" : "Create Another"}
                </button>
                <button onClick={() => setLocation("/game/scramble")}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm">
                  {lang === "ar" ? "العودة للعبة" : "Back to Game"}
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-violet-50 dark:from-purple-950/20 dark:via-fuchsia-950/20 dark:to-violet-950/20 py-6 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setLocation("/game/scramble")}
              className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
              <BackArrow className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-black text-foreground">{lang === "ar" ? "إنشاء كلمات مخصصة" : "Create Custom Words"}</h1>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "أضف كلمات خاصة بك وشاركها مع طلابك" : "Add your own words and share with students"}</p>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-3 shadow-sm mb-3">
            <label className="text-xs font-bold text-foreground mb-1 block">
              {lang === "ar" ? "عنوان المجموعة" : "Set Title"}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={lang === "ar" ? "مثال: كلمات الدرس الأول" : "e.g. Lesson 1 Vocabulary"}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
              maxLength={100}
            />
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-card border border-border/60 rounded-xl p-3 shadow-sm">
              <label className="text-xs font-bold text-foreground mb-1 block">
                {lang === "ar" ? "المرحلة" : "Grade"}
              </label>
              <select
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-bold">
                {GRADE_LEVELS.map(g => (
                  <option key={g.value} value={g.value}>{lang === "ar" ? g.ar : g.en}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 bg-card border border-border/60 rounded-xl p-3 shadow-sm">
              <label className="text-xs font-bold text-foreground mb-1 block flex items-center gap-1">
                <Type className="w-3 h-3" />
                {lang === "ar" ? "عدد الكلمات" : "Word Count"}
              </label>
              <select
                value={wordCount}
                onChange={e => setWordCount(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-bold">
                {WORD_COUNT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground">
              {lang === "ar" ? `الكلمات (${validWords.length} صالحة)` : `Words (${validWords.length} valid)`}
            </p>
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {lang === "ar" ? "قوالب جاهزة" : "Templates"}
            </button>
          </div>

          <AnimatePresence>
            {showTemplates && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-3">
                <div className="grid grid-cols-1 gap-1.5">
                  {TEMPLATES.map((t, i) => (
                    <button key={i} onClick={() => applyTemplate(t)}
                      className="bg-card border border-border/60 rounded-lg p-2.5 text-start hover:border-purple-300 transition-all">
                      <p className="font-bold text-xs text-foreground">{lang === "ar" ? t.titleAr : t.titleEn}</p>
                      <p className="text-[9px] text-muted-foreground">{t.words.map(w => w.word).join(" • ")}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2 mb-3">
            {words.map((w, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border/60 rounded-xl p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground mt-2 w-4 shrink-0 text-center">{i + 1}</span>
                  <div className="flex-1 space-y-1.5">
                    {w.question !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-blue-500 shrink-0" />
                        <input
                          type="text"
                          value={w.question}
                          onChange={e => updateWord(i, "question", e.target.value)}
                          placeholder={lang === "ar" ? "السؤال (اختياري) — يظهر قبل الكلمة" : "Question (optional) — shown before the word"}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-foreground text-xs"
                          maxLength={150}
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={w.word}
                      onChange={e => updateWord(i, "word", e.target.value)}
                      placeholder={wordCount > 1
                        ? (lang === "ar" ? `الجملة (${wordCount} كلمات)` : `Phrase (${wordCount} words)`)
                        : (lang === "ar" ? "الكلمة" : "Word")}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm font-bold"
                      maxLength={50}
                    />
                    <input
                      type="text"
                      value={w.hint}
                      onChange={e => updateWord(i, "hint", e.target.value)}
                      placeholder={lang === "ar" ? "التلميح (اختياري)" : "Hint (optional)"}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[11px]"
                      maxLength={100}
                    />
                  </div>
                  {words.length > 3 && (
                    <button onClick={() => removeWord(i)} className="p-1 text-red-400 hover:text-red-600 mt-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {words.length < 30 && (
            <button onClick={addWord}
              className="w-full py-2 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center gap-1.5 mb-4 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all">
              <Plus className="w-3.5 h-3.5" />
              {lang === "ar" ? "إضافة كلمة" : "Add Word"}
            </button>
          )}

          <button onClick={handleSave} disabled={!canSave || saving}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black text-base shadow-lg shadow-purple-500/25 disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
            <Save className="w-5 h-5" />
            {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ ومشاركة" : "Save & Share")}
          </button>
        </div>
      </div>
    </Layout>
  );
}
