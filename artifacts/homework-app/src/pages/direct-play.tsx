/**
 * /play/:assignmentId  —  رابط لعب مباشر
 *
 * يفتح أي شخص هذا الرابط ويلعب الواجب فوراً بدون تسجيل دخول أو رمز أو معلم.
 * كل زائر يحصل على جلسة وميض منفصلة لا تتداخل مع الآخرين.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Gamepad2, Loader2, AlertCircle, Play, Target, User } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface PlayInfo {
  id: number;
  title: string;
  questionCount: number;
}

export default function DirectPlayPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [starting, setStarting] = useState(false);

  // تحميل بيانات النشاط
  useEffect(() => {
    if (!assignmentId) return;
    fetch(`${API}/api/assignments/${encodeURIComponent(assignmentId)}/play-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) setLoadError(data.message);
        else setInfo(data as PlayInfo);
      })
      .catch(() =>
        setLoadError(
          lang === "ar" ? "تعذّر تحميل النشاط" : "Failed to load activity",
        ),
      );
  }, [assignmentId]);

  const handleStart = async () => {
    const name = playerName.trim();
    if (!name) {
      setNameError(
        lang === "ar" ? "أدخل اسمك أولاً" : "Please enter your name",
      );
      return;
    }
    setNameError("");
    setStarting(true);
    try {
      const res = await fetch(
        `${API}/api/assignments/${encodeURIComponent(assignmentId!)}/direct-play`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ");

      // يذهب مباشرة إلى صفحة اللعب بنفس الطريقة التي تتبعها المسابقة الذاتية
      const avatar = "🎯";
      setLocation(
        `/game/play/${data.pin}?name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : lang === "ar" ? "تعذّر بدء اللعبة" : "Failed to start";
      setNameError(message);
      setStarting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!info && !loadError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)",
        }}
      >
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background:
            "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)",
        }}
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm w-full rounded-3xl p-8"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">{loadError}</p>
        </motion.div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)",
      }}
      dir={dir}
    >
      {/* جسيمات الخلفية المتحركة */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + (i % 4) * 3,
              height: 4 + (i % 4) * 3,
              background: ["#4ade80", "#E8B84B", "#ffffff", "#6ee7b7"][i % 4],
              left: `${5 + (i * 5.9) % 90}%`,
              top: `${10 + (i * 5.7) % 80}%`,
              opacity: 0.1 + (i % 4) * 0.06,
            }}
            animate={{ y: [0, -20, 0], opacity: [0.1, 0.28, 0.1] }}
            transition={{
              duration: 3 + (i % 3),
              delay: i * 0.25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* شارة */}
        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
            style={{
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.4)",
              color: "#6ee7b7",
            }}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            {lang === "ar" ? "لعب مباشر" : "Direct Play"}
          </span>
        </div>

        {/* البطاقة الرئيسية */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* الرأس */}
          <div
            className="p-6 pb-5 text-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(74,222,128,0.12) 0%, transparent 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ repeat: Infinity, duration: 2.8 }}
            >
              <Gamepad2 className="w-14 h-14 mx-auto mb-3 text-emerald-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.45)]" />
            </motion.div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">
              {info!.title}
            </h1>
            <div className="flex items-center justify-center gap-5 mt-3">
              <span
                className="flex items-center gap-1.5 text-sm font-bold"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <Target className="w-4 h-4 text-emerald-400" />
                {info!.questionCount}{" "}
                {lang === "ar" ? "أسئلة" : "questions"}
              </span>
              <span
                className="flex items-center gap-1.5 text-sm font-bold"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <User className="w-4 h-4 text-emerald-400" />
                {lang === "ar" ? "فردي" : "Solo"}
              </span>
            </div>
          </div>

          {/* حقل الاسم + زر البدء */}
          <div className="p-6 space-y-4">
            <div>
              <label
                className="block text-sm font-bold mb-2"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                {lang === "ar"
                  ? "اكتب اسمك للبدء"
                  : "Enter your name to start"}
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  setNameError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder={
                  lang === "ar" ? "اسمك هنا..." : "Your name..."
                }
                maxLength={40}
                autoFocus
                className="w-full rounded-2xl px-4 py-3.5 text-base font-bold outline-none transition-all"
                dir={lang === "ar" ? "rtl" : "ltr"}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: nameError
                    ? "2px solid rgba(239,68,68,0.7)"
                    : "2px solid rgba(255,255,255,0.15)",
                  color: "white",
                  textAlign: lang === "ar" ? "right" : "left",
                }}
                onFocus={(e) => {
                  if (!nameError)
                    e.target.style.borderColor = "rgba(74,222,128,0.6)";
                }}
                onBlur={(e) => {
                  if (!nameError)
                    e.target.style.borderColor = "rgba(255,255,255,0.15)";
                }}
              />
              <AnimatePresence>
                {nameError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm font-bold mt-2"
                  >
                    {nameError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              disabled={starting}
              className="w-full py-4 rounded-2xl text-base font-black text-white flex items-center justify-center gap-2.5 transition-all disabled:opacity-60"
              style={{
                background: starting
                  ? "rgba(74,222,128,0.35)"
                  : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow: starting
                  ? "none"
                  : "0 8px 32px -8px rgba(34,197,94,0.6)",
              }}
            >
              {starting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {lang === "ar" ? "جاري البدء..." : "Starting..."}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  {lang === "ar" ? "ابدأ اللعبة" : "Start Game"}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
