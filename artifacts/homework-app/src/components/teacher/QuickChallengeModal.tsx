import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Play, Check, Copy, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function QuickChallengeModal({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  const [questionType, setQuestionType] = useState<
    "mcq" | "true_false" | "fill_blank" | "mixed"
  >("mcq");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    pin: string;
    title: string;
    questionCount: number;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();

  const types = [
    {
      key: "mcq" as const,
      label: lang === "ar" ? "اختيار متعدد" : "Multiple Choice",
      icon: "📝",
    },
    {
      key: "true_false" as const,
      label: lang === "ar" ? "صح أو خطأ" : "True / False",
      icon: "✅",
    },
    {
      key: "fill_blank" as const,
      label: lang === "ar" ? "أملأ الفراغ" : "Fill in Blank",
      icon: "✏️",
    },
    {
      key: "mixed" as const,
      label: lang === "ar" ? "متنوع" : "Mixed",
      icon: "🎲",
    },
  ];

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-challenge/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionType, topic }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || (lang === "ar" ? "خطأ" : "Error"));
      setResult(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : lang === "ar"
            ? "حدث خطأ. حاول مرة أخرى."
            : "An error occurred. Please try again.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!result) return;
    setStarting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/quick-challenge/start/${result.pin}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (res.ok) {
        setStarted(true);
      } else {
        const d = await res.json();
        alert(
          d.message ||
            (lang === "ar" ? "لا يمكن بدء اللعبة" : "Cannot start the game"),
        );
      }
    } finally {
      setStarting(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9 }}
        className="bg-gradient-to-br from-purple-950 to-indigo-950 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/10 relative"
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {result ? (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-6xl mb-3"
            >
              🎮
            </motion.div>
            <h3 className="text-2xl font-black text-white mb-1">
              {lang === "ar" ? "التحدي جاهز!" : "Challenge Ready!"}
            </h3>
            <p className="text-white/60 text-sm mb-4">
              {result.title} • {result.questionCount}{" "}
              {lang === "ar" ? "أسئلة" : "questions"}
            </p>

            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <p className="text-white/50 text-xs mb-1">
                {lang === "ar" ? "كود الانضمام (PIN)" : "Join Code (PIN)"}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span
                  className="text-5xl font-black text-yellow-400 tracking-widest"
                  dir="ltr"
                >
                  {result.pin}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {!started ? (
              <div className="space-y-3">
                <p className="text-white/50 text-xs">
                  {lang === "ar"
                    ? "شارك الكود مع الطلاب ثم ابدأ اللعبة"
                    : "Share the code with students then start the game"}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {starting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {starting
                    ? lang === "ar"
                      ? "جارٍ البدء..."
                      : "Starting..."
                    : lang === "ar"
                      ? "ابدأ اللعبة!"
                      : "Start Game!"}
                </motion.button>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-3"
              >
                <div className="bg-green-500/20 border border-green-500/40 rounded-2xl p-3">
                  <p className="text-green-400 font-black">
                    {lang === "ar"
                      ? "🎉 اللعبة بدأت! شارك الكود مع طلابك"
                      : "🎉 Game started! Share the code with your students"}
                  </p>
                </div>
                <button
                  onClick={() => setLocation(`/game/join/${result.pin}`)}
                  className="w-full py-3 rounded-2xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                >
                  {lang === "ar" ? "انضم كمراقب" : "Join as Observer"}
                </button>
              </motion.div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 text-center">
              <span className="text-3xl">⚡</span>
              <h3 className="text-xl font-black text-white mt-1">
                {lang === "ar" ? "تحدي وميض سريع" : "Quick Wameedh Challenge"}
              </h3>
              <p className="text-white/50 text-xs mt-1">
                {lang === "ar"
                  ? "الذكاء الاصطناعي يولّد الأسئلة فوراً"
                  : "AI generates questions instantly"}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-white/60 text-sm font-bold mb-2">
                {lang === "ar" ? "نوع الأسئلة" : "Question Type"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {types.map((t) => (
                  <motion.button
                    key={t.key}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setQuestionType(t.key)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border font-bold text-sm transition-all ${
                      questionType === t.key
                        ? "bg-white/15 border-white/40 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    <span>{t.icon}</span>
                    {t.label}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-white/60 text-sm font-bold mb-2">
                {lang === "ar" ? "الموضوع (اختياري)" : "Topic (optional)"}
              </p>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  lang === "ar"
                    ? "مثال: الضرب، التاريخ الإسلامي، العلوم..."
                    : "e.g. Multiplication, History, Science..."
                }
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 font-bold focus:outline-none focus:border-purple-400 text-sm"
                maxLength={100}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-black text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {lang === "ar" ? "جارٍ الإنشاء..." : "Creating..."}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  {lang === "ar" ? "أنشئ التحدي!" : "Create Challenge!"}
                </>
              )}
            </motion.button>
            {loading && (
              <p className="text-white/40 text-xs text-center mt-2">
                {lang === "ar"
                  ? "يستغرق هذا بضع ثوانٍ..."
                  : "This takes a few seconds..."}
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Floating trigger button — place near the bottom of the page */
export function QuickChallengeFAB({ onClick }: { onClick: () => void }) {
  const { lang } = useI18n();
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 end-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-white font-black text-sm"
      style={{
        background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
        boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
      }}
      aria-label={lang === "ar" ? "تحدي وميض سريع" : "Quick Wameedh Challenge"}
    >
      <span className="text-lg leading-none">⚡</span>
      <span>{lang === "ar" ? "تحدي سريع" : "Quick Challenge"}</span>
    </motion.button>
  );
}
