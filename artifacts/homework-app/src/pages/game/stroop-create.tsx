import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Copy,
  Check,
  Brain,
  Sparkles,
  LogIn,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface StroopItem {
  word: string;
  color: string;
  options: string[];
}

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#6b7280",
  "#1f2937",
];

const ARABIC_COLORS = [
  { word: "أحمر", color: "#ef4444" },
  { word: "أزرق", color: "#3b82f6" },
  { word: "أخضر", color: "#22c55e" },
  { word: "أصفر", color: "#eab308" },
  { word: "برتقالي", color: "#f97316" },
  { word: "بنفسجي", color: "#a855f7" },
  { word: "رمادي", color: "#6b7280" },
  { word: "أسود", color: "#1f2937" },
];

const GRADE_LEVELS = [
  { value: "1-3", ar: "الصف ١-٣" },
  { value: "4-6", ar: "الصف ٤-٦" },
  { value: "7-9", ar: "الصف ٧-٩" },
  { value: "10-12", ar: "الصف ١٠-١٢" },
  { value: "uni", ar: "جامعي" },
  { value: "general", ar: "عام" },
];

function makeDefaultItem(word: string, color: string): StroopItem {
  const others = PALETTE.filter(c => c !== color).slice(0, 3);
  return { word, color, options: [color, ...others] };
}

const TEMPLATES = [
  {
    titleAr: "ألوان عربية أساسية",
    titleEn: "Basic Arabic Colors",
    items: ARABIC_COLORS.map(c => makeDefaultItem(c.word, c.color)),
  },
  {
    titleAr: "كلمات ومشاعر",
    titleEn: "Words & Emotions",
    items: [
      makeDefaultItem("سعيد", "#eab308"),
      makeDefaultItem("حزين", "#3b82f6"),
      makeDefaultItem("غاضب", "#ef4444"),
      makeDefaultItem("خائف", "#a855f7"),
      makeDefaultItem("هادئ", "#22c55e"),
      makeDefaultItem("متحمس", "#f97316"),
    ],
  },
  {
    titleAr: "طيف قوس قزح",
    titleEn: "Rainbow Spectrum",
    items: [
      makeDefaultItem("أحمر", "#ef4444"),
      makeDefaultItem("برتقالي", "#f97316"),
      makeDefaultItem("أصفر", "#eab308"),
      makeDefaultItem("أخضر", "#22c55e"),
      makeDefaultItem("أزرق", "#3b82f6"),
      makeDefaultItem("نيلي", "#6366f1"),
      makeDefaultItem("بنفسجي", "#a855f7"),
    ],
  },
];

export default function StroopCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("general");
  const [items, setItems] = useState<StroopItem[]>(
    ARABIC_COLORS.slice(0, 6).map(c => makeDefaultItem(c.word, c.color))
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ pin: string; title: string } | null>(null);
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 px-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="max-w-md w-full text-center bg-white/90 dark:bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-xl border border-orange-100 dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">
              {lang === "ar" ? "تسجيل الدخول مطلوب" : "Login Required"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {lang === "ar" ? "يجب تسجيل الدخول كمعلم لإنشاء مجموعة مخصصة" : "You must be logged in as a teacher to create custom sets"}
            </p>
            <button
              onClick={() => setLocation("/login")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-lg"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Log In"}
            </button>
            <button
              onClick={() => setLocation("/game/stroop")}
              className="w-full py-2 mt-3 text-sm text-muted-foreground hover:text-foreground"
            >
              {lang === "ar" ? "العودة للعبة ارتباك" : "Back to Stroop Game"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const addItem = () => {
    if (items.length >= 30) return;
    setItems([...items, makeDefaultItem("", "#ef4444")]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 4) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateWord = (index: number, word: string) => {
    setItems(items.map((it, i) => i === index ? { ...it, word } : it));
  };

  const updateCorrectColor = (index: number, color: string) => {
    setItems(items.map((it, i) => {
      if (i !== index) return it;
      const newOptions = it.options.includes(color)
        ? it.options
        : [color, ...it.options.slice(1)];
      return { ...it, color, options: newOptions };
    }));
  };

  const toggleOption = (index: number, color: string) => {
    setItems(items.map((it, i) => {
      if (i !== index) return it;
      const isCorrect = it.color === color;
      if (isCorrect) return it;
      const has = it.options.includes(color);
      let newOptions: string[];
      if (has) {
        if (it.options.length <= 2) return it;
        newOptions = it.options.filter(c => c !== color);
      } else {
        if (it.options.length >= 6) return it;
        newOptions = [...it.options, color];
      }
      return { ...it, options: newOptions };
    }));
  };

  const loadTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(lang === "ar" ? template.titleAr : template.titleEn);
    setItems(template.items.map(it => ({ ...it })));
    setShowTemplates(false);
  };

  const validItems = items.filter(it => it.word.trim() && it.color && it.options.length >= 2);
  const canSave = title.trim() && validItems.length >= 4;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/stroop-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          gradeLevel,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ pin: data.pin, title: data.title });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (lang === "ar" ? "حدث خطأ" : "An error occurred");
      alert(msg);
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (result) {
    const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL || "/"}game/stroop/play?pin=${result.pin}`;
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 py-8 px-4" dir={dir}>
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
              <h1 className="text-2xl font-black text-foreground mb-2">
                {lang === "ar" ? "تم إنشاء المجموعة!" : "Set Created!"}
              </h1>
              <p className="text-muted-foreground text-sm mb-6">{result.title}</p>

              <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg mb-5">
                <p className="text-xs text-muted-foreground mb-2">{lang === "ar" ? "الكود (PIN)" : "PIN Code"}</p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-5xl font-black text-orange-500 tracking-widest" dir="ltr">{result.pin}</span>
                  <button onClick={handleCopy} className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{lang === "ar" ? "شارك هذا الكود مع طلابك" : "Share this code with your students"}</p>
                <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-xl p-2">
                  <p className="text-xs font-mono text-foreground flex-1 truncate" dir="ltr">{shareUrl}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setLocation(`/game/stroop/play?pin=${result.pin}`)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2"
                >
                  <Brain className="w-5 h-5" />
                  {lang === "ar" ? "العب الآن!" : "Play Now!"}
                </button>
                <button
                  onClick={() => { setResult(null); setTitle(""); setItems(ARABIC_COLORS.slice(0, 6).map(c => makeDefaultItem(c.word, c.color))); }}
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-xl shadow-orange-500/30 mb-3">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-1">
              {lang === "ar" ? "إنشاء مجموعة ارتباك" : "Create Stroop Set"}
            </h1>
            <p className="text-muted-foreground text-xs">
              {lang === "ar" ? "أنشئ كلمات وألوان مخصصة لطلابك" : "Create custom words and colors for your students"}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-sm font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
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
                      className="w-full text-start p-3 rounded-xl bg-card border border-border/60 hover:border-orange-400/50 hover:shadow-md transition-all"
                    >
                      <p className="font-bold text-sm text-foreground">{lang === "ar" ? t.titleAr : t.titleEn}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {t.items.slice(0, 6).map(it => (
                          <span
                            key={it.word}
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ color: it.color, backgroundColor: it.color + "20" }}
                          >
                            {it.word}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <label className="text-sm font-bold text-foreground block mb-1.5">
                {lang === "ar" ? "عنوان المجموعة" : "Set Title"}
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={lang === "ar" ? "مثال: ألوان المطبخ" : "e.g. Kitchen Colors"}
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-colors"
              />
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <label className="text-sm font-bold text-foreground block mb-1.5">
                {lang === "ar" ? "المرحلة الدراسية" : "Grade Level"}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {GRADE_LEVELS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setGradeLevel(g.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      gradeLevel === g.value
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {g.ar}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-foreground">
                  {lang === "ar" ? "الكلمات والألوان" : "Words & Colors"} ({validItems.length}/{items.length})
                </label>
                <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "الحد الأقصى ٣٠" : "Max 30"}</span>
              </div>

              <div className="space-y-5">
                {items.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-border/40 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-[10px] font-black shrink-0">
                        {i + 1}
                      </div>
                      <input
                        type="text"
                        value={item.word}
                        onChange={e => updateWord(i, e.target.value)}
                        placeholder={lang === "ar" ? "الكلمة..." : "Word..."}
                        maxLength={30}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-colors"
                      />
                      <button
                        onClick={() => removeItem(i)}
                        disabled={items.length <= 4}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium mb-1.5">
                        {lang === "ar" ? "لون الحبر الصحيح (الإجابة):" : "Correct ink color (answer):"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PALETTE.map(c => (
                          <button
                            key={c}
                            onClick={() => updateCorrectColor(i, c)}
                            title={c}
                            className="w-7 h-7 rounded-full transition-all"
                            style={{
                              backgroundColor: c,
                              outline: item.color === c ? `3px solid ${c}` : "none",
                              outlineOffset: "2px",
                              opacity: item.color === c ? 1 : 0.5,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium mb-1.5">
                        {lang === "ar"
                          ? `خيارات الإجابة (اختر ٢-٦ — الصحيح مضمّن تلقائياً):`
                          : `Answer choices (pick 2-6 — correct color auto-included):`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PALETTE.map(c => {
                          const isCorrect = item.color === c;
                          const isSelected = item.options.includes(c);
                          return (
                            <button
                              key={c}
                              onClick={() => toggleOption(i, c)}
                              disabled={isCorrect}
                              title={isCorrect ? (lang === "ar" ? "الإجابة الصحيحة (مضمّنة دائماً)" : "Correct answer (always included)") : c}
                              className="relative w-7 h-7 rounded-full transition-all"
                              style={{
                                backgroundColor: c,
                                opacity: isSelected ? 1 : 0.25,
                                outline: isCorrect ? `2px solid ${c}` : "none",
                                outlineOffset: "2px",
                              }}
                            >
                              {isCorrect && (
                                <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-black">✓</span>
                              )}
                              {isSelected && !isCorrect && (
                                <X className="absolute inset-0 m-auto w-2.5 h-2.5 text-white/80" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {lang === "ar"
                          ? `${item.options.length} خيارات محددة`
                          : `${item.options.length} choices selected`}
                      </p>
                    </div>

                    <div
                      className="flex items-center justify-center h-10 rounded-xl border border-border/40"
                      style={{ backgroundColor: item.color + "15" }}
                    >
                      <span
                        className="text-xl font-black select-none"
                        style={{ color: item.options.filter(c => c !== item.color)[0] || "#6b7280" }}
                      >
                        {item.word || (lang === "ar" ? "معاينة" : "Preview")}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {items.length < 30 && (
                <button
                  onClick={addItem}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-muted-foreground text-xs font-bold hover:border-orange-400 hover:text-orange-500 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === "ar" ? "إضافة عنصر" : "Add Item"}
                </button>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                💡 {lang === "ar"
                  ? "نصيحة: لون الحبر الصحيح هو الإجابة الصحيحة للطالب. خيارات الإجابة هي الأزرار التي تظهر للاختيار منها."
                  : "Tip: The correct ink color is the answer. Answer choices are the buttons shown to pick from."}
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-base shadow-xl shadow-orange-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-2xl"
            >
              {saving ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "احفظ وأنشئ الكود" : "Save & Create PIN")}
            </button>
          </motion.div>

          <button onClick={() => setLocation("/game/stroop")} className="w-full mt-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "العودة" : "Back"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
