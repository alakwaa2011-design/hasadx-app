import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowRight, Send, Copy, Check, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  normalizeArabic,
  type LetrlyCategory,
} from "@/lib/letrly-engine";

const BASE = import.meta.env.VITE_API_URL || "";

const CATEGORIES: LetrlyCategory[] = ["general", "animals", "fruits", "cities", "science", "islamic"];

export default function LetrlyCreate({ embedded = false }: { embedded?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [category, setCategory] = useState<LetrlyCategory>("general");
  const [submitting, setSubmitting] = useState(false);
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const normalized = useMemo(() => normalizeArabic(word), [word]);
  const length = normalized.length;
  const isArabicOnly = useMemo(() => /^[\u0600-\u06FF\s]*$/.test(word), [word]);
  const validLength = length >= 3 && length <= 7;

  const shareUrl = createdPin
    ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/game/letrly/play?pin=${createdPin}`
    : "";

  const submit = async () => {
    if (!word.trim()) { toast.error("أدخل الكلمة أولاً"); return; }
    if (!isArabicOnly) { toast.error("الكلمة يجب أن تكون عربية فقط"); return; }
    if (!validLength) { toast.error("طول الكلمة يجب أن يكون بين ٣ و٧ حروف"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/letrly/teacher/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), hint: hint.trim(), category }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "تعذّر إنشاء التحدّي");
        return;
      }
      setCreatedPin(data.pin);
      toast.success("تم إنشاء التحدّي ✨");
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const shareLink = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "تحدي الكلمة", text: "حلّ كلمة التحدّي!", url: shareUrl });
      } catch {
        // cancelled
      }
    } else {
      copyLink();
    }
  };

  const inner = (
    <>
          {!embedded && (
            <button
              onClick={() => setLocation("/teacher")}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowRight className="w-4 h-4" />
              لوحة المعلم
            </button>
          )}

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[hsl(145,40%,28%)]/10 text-[hsl(145,40%,28%)] text-xs font-bold mb-3 border border-[hsl(145,40%,28%)]/15">
              <Sparkles className="w-3.5 h-3.5" />
              تحدي الكلمة للطلاب
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2">أنشئ كلمة لطلابك</h1>
            <p className="text-muted-foreground text-sm">
              اكتب الكلمة السرّية وتلميحاً، ثم شارك الرابط مع طلابك ليحاولوا حلّها.
            </p>
          </motion.div>

          {!createdPin ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-card-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">الكلمة السرّية</label>
                <input
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="مثال: مدرسة"
                  className="w-full text-2xl font-extrabold text-center bg-zinc-50 border-2 border-zinc-200 focus:border-[hsl(145,55%,32%)] rounded-xl px-4 py-4 outline-none transition-colors"
                  dir="rtl"
                  maxLength={20}
                />
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-muted-foreground">
                    {word ? `${length} حروف بعد التسوية` : "٣ إلى ٧ حروف"}
                  </span>
                  {word && !isArabicOnly && (
                    <span className="text-red-600 font-bold">يجب أن تكون عربية فقط</span>
                  )}
                  {word && isArabicOnly && !validLength && (
                    <span className="text-amber-600 font-bold">الطول خارج النطاق</span>
                  )}
                  {word && isArabicOnly && validLength && (
                    <span className="text-emerald-600 font-bold">✓ صالحة</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">تلميح (اختياري)</label>
                <input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="مثال: مكان نتعلّم فيه"
                  className="w-full bg-zinc-50 border-2 border-zinc-200 focus:border-[hsl(145,55%,32%)] rounded-xl px-4 py-3 outline-none transition-colors"
                  dir="rtl"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">التصنيف</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          active
                            ? "border-[hsl(145,55%,32%)] bg-[hsl(145,55%,32%)]/8"
                            : "border-zinc-200 bg-white hover:border-[hsl(145,55%,32%)]/40"
                        }`}
                      >
                        <div className="text-lg mb-0.5">{CATEGORY_EMOJI[cat]}</div>
                        <div className={`text-xs font-bold ${active ? "text-[hsl(145,55%,32%)]" : "text-foreground"}`}>
                          {CATEGORY_LABELS[cat]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={submit}
                disabled={submitting || !word.trim() || !validLength || !isArabicOnly}
                className="w-full bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-base py-3.5 rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? "...يتم الإنشاء" : "أنشئ التحدّي"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm space-y-5 text-center"
            >
              <div className="text-5xl">🎉</div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground mb-1">جاهز! شارك الرمز مع طلابك</h2>
                <p className="text-sm text-muted-foreground">يمكنهم فتح الرابط والمحاولة مباشرة</p>
              </div>

              <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">رمز التحدّي</div>
                <div className="text-4xl font-mono font-extrabold text-emerald-700 tracking-widest">{createdPin}</div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs font-mono text-zinc-700 break-all" dir="ltr">
                {shareUrl}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={shareLink}
                  className="inline-flex items-center gap-1.5 bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  شارك
                </button>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "تم النسخ" : "انسخ الرابط"}
                </button>
                <button
                  onClick={() => setLocation(`/game/letrly/play?pin=${createdPin}`)}
                  className="inline-flex items-center gap-1.5 bg-white border-2 border-[hsl(145,55%,32%)] text-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,32%)]/5 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  جرّبها بنفسك
                </button>
              </div>

              <button
                onClick={() => {
                  setCreatedPin(null);
                  setWord("");
                  setHint("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground font-medium"
              >
                إنشاء كلمة أخرى
              </button>
            </motion.div>
          )}
    </>
  );

  if (embedded) return <>{inner}</>;
  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] py-10" style={{ background: "#F5FAF7" }} dir="rtl">
        <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
          {inner}
        </div>
      </div>
    </Layout>
  );
}
