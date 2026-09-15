/**
 * /play/:token  —  رابط لعب مباشر
 *
 * يفتح أي شخص هذا الرابط ويلعب النشاط فوراً بدون تسجيل دخول أو رمز أو معلم.
 * كل زائر يحصل على جلسة مستقلة لا تتداخل مع الآخرين.
 * يدعم نوعين من الألعاب: وميض (knowledge_race) وسباق الصواريخ (rocket_race).
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { storeIndependentControlToken } from "@/lib/independent-game-session";
import { Loader2, AlertCircle, Play, Target, User, Zap, Rocket } from "lucide-react";
import { XoName, XoTitle, normalizeXoTitle } from "@/components/game/xo-display";

const API = import.meta.env.VITE_API_URL || "";

interface PlayInfo {
  title: string;
  questionCount: number;
  gameType: "wameeth" | "wameeth_class" | "rocket_race" | "wheel" | "xo_class" | "xo_online";
}

const GAME_META = {
  wameeth: {
    icon: (
      <Zap className="w-7 h-7 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
    ),
    gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
    glow: "rgba(234,179,8,0.55)",
    borderColor: "rgba(250,204,21,0.35)",
  },
  rocket_race: {
    icon: (
      <Rocket className="w-7 h-7 text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.5)]" />
    ),
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    glow: "rgba(59,130,246,0.55)",
    borderColor: "rgba(96,165,250,0.35)",
  },
  xo: {
    icon: <Target className="w-7 h-7 text-violet-300" />,
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%)",
    glow: "rgba(139,92,246,0.55)",
    borderColor: "rgba(196,181,253,0.35)",
  },
} as const;

export default function DirectPlayPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { lang, t, dir } = useI18n();

  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [starting, setStarting] = useState(false);
  const autoStartedRef = useRef(false);

  // تحميل بيانات الرابط
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/play/${encodeURIComponent(token)}/info`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) setLoadError(data.message);
        else setInfo(data as PlayInfo);
      })
      .catch(() =>
        setLoadError(t.directPlay.loadActivityError),
      );
  }, [token]);

  // A Wheel of Challenge link is a teacher-controlled classroom display, not a
  // student activity. Hand it straight to the public wheel route: no name,
  // room, QR flow, or mobile participant controls are involved.
  useEffect(() => {
    if (token && info?.gameType === "wheel") {
      setLocation(`/play/wheel/${encodeURIComponent(token)}`, { replace: true });
    }
  }, [info?.gameType, setLocation, token]);

  useEffect(() => {
    if (token && info?.gameType === "xo_class") {
      setLocation(`/game/xo/class?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [info?.gameType, setLocation, token]);

  useEffect(() => {
    if (!token || info?.gameType !== "xo_online" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    setStarting(true);
    fetch(`${API}/api/play/${encodeURIComponent(token)}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.playRoute || !data.pin) {
          throw new Error(data.message || t.directPlay.genericError);
        }
        if (data.creatorToken) sessionStorage.setItem(`xo-creator-${data.pin}`, String(data.creatorToken));
        if (data.controlToken) sessionStorage.setItem(`xo-control-${data.pin}`, String(data.controlToken));
        setLocation(`${data.playRoute}?creator=1&token=${encodeURIComponent(token)}`, { replace: true });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : t.directPlay.startError);
        setStarting(false);
      });
  }, [info?.gameType, setLocation, t.directPlay.genericError, t.directPlay.startError, token]);

  const handleStart = async () => {
    const name = playerName.trim();
    if (!name) {
      setNameError(t.directPlay.nameRequired);
      return;
    }
    setNameError("");
    setStarting(true);
    try {
      const res = await fetch(`${API}/api/play/${encodeURIComponent(token!)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t.directPlay.genericError);

      const avatar = "🎯";
      setLocation(
        `${data.playRoute}?name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t.directPlay.startError;
      setNameError(message);
      setStarting(false);
    }
  };

  // Wameeth independent links skip the landing/name form entirely. Every
  // request to /start creates a fresh solo session, so visitors never share
  // game state even when they use the same stable token.
  useEffect(() => {
    if (!token || info?.gameType !== "wameeth" || autoStartedRef.current) return;
    autoStartedRef.current = true;
    setStarting(true);

    fetch(`${API}/api/play/${encodeURIComponent(token)}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || t.directPlay.genericError);
        if (!data.pin || !data.controlToken) throw new Error(t.directPlay.sessionError);
        storeIndependentControlToken(String(data.pin), String(data.controlToken));
        const playerName = t.directPlay.defaultPlayer;
        setLocation(
          `${data.playRoute}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent("🎯")}&independent=1&token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent("/")}`,
          { replace: true },
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error
          ? err.message
          : t.directPlay.startError;
        setLoadError(message);
        setStarting(false);
      });
  }, [info?.gameType, lang, setLocation, token]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (
    (!info && !loadError)
    || ((info?.gameType === "wameeth" || info?.gameType === "wheel" || info?.gameType === "xo_class" || info?.gameType === "xo_online") && !loadError)
  ) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}
      >
        <div className="flex flex-col items-center gap-4" dir={dir}>
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-white/70 font-bold" data-testid="status-independent-starting">
            {t.directPlay.starting}
          </p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}
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

  const meta = GAME_META[info!.gameType === "rocket_race" ? "rocket_race" : info!.gameType.startsWith("xo_") ? "xo" : "wameeth"];
  const isXoGame = info!.gameType.startsWith("xo_");
  const gameLabel = info!.gameType === "wameeth" ? t.directPlay.wameethName : info!.gameType === "rocket_race" ? t.directPlay.rocketRaceName : t.directPlay.xoName;
  const gameDesc = info!.gameType === "wameeth" ? t.directPlay.wameethDescription : info!.gameType === "rocket_race" ? t.directPlay.rocketRaceDescription : t.directPlay.xoDescription;
  const displayTitle = isXoGame
    ? normalizeXoTitle(info!.title, lang === "ar" ? "ar" : "en")
    : info!.title;
  const [xoDescriptionBefore, xoDescriptionAfter] = t.directPlay.xoDescription.split("X O");

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}
      dir={dir}
    >
      {/* جسيمات الخلفية */}
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
            transition={{ duration: 3 + (i % 3), delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* شارة نوع اللعبة */}
        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black tracking-wide"
            style={{
              background: `${meta.gradient.replace("linear-gradient(135deg, ", "").replace(" 0%, ", "").replace(" 100%)", "")}22`,
              border: `1px solid ${meta.borderColor}`,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {meta.icon}
            {gameLabel}
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
              background: "linear-gradient(180deg, rgba(74,222,128,0.10) 0%, transparent 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ repeat: Infinity, duration: 2.8 }}
              className="flex justify-center mb-3"
            >
              {meta.icon}
            </motion.div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">
            {isXoGame ? <XoTitle title={displayTitle} lang={lang === "ar" ? "ar" : "en"} /> : displayTitle}
            </h1>
            <p className="text-xs text-white/50 mt-1">
              {isXoGame ? <>{xoDescriptionBefore}<XoName />{xoDescriptionAfter}</> : gameDesc}
            </p>
            <div className="flex items-center justify-center gap-5 mt-3">
              <span
                className="flex items-center gap-1.5 text-sm font-bold"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <Target className="w-4 h-4 text-emerald-400" />
                {info!.questionCount} {t.directPlay.questions}
              </span>
              <span
                className="flex items-center gap-1.5 text-sm font-bold"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                <User className="w-4 h-4 text-emerald-400" />
                {t.directPlay.solo}
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
                {t.directPlay.enterName}
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setNameError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder={t.directPlay.namePlaceholder}
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
                onFocus={(e) => { if (!nameError) e.target.style.borderColor = "rgba(74,222,128,0.6)"; }}
                onBlur={(e) => { if (!nameError) e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
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
                background: starting ? "rgba(74,222,128,0.35)" : meta.gradient,
                boxShadow: starting ? "none" : `0 8px 32px -8px ${meta.glow}`,
              }}
            >
              {starting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.directPlay.gameStarting}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  {t.directPlay.startGame}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
