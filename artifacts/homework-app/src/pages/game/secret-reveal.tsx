import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Shield, Camera, Hash } from "lucide-react";

interface RevealData {
  team: "A" | "B";
  teamName: string;
  teamColor: string;
  secret: { id: number; name: string; image: string | null };
  pin: string;
}

const AUTO_HIDE_SECONDS = 30;

export default function SecretReveal() {
  const [location] = useLocation();
  const token =
    new URLSearchParams(window.location.search).get("token") ??
    location.split("?token=")[1] ??
    "";

  const [data, setData] = useState<RevealData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [imgError, setImgError] = useState(false);

  const [countdown, setCountdown] = useState(AUTO_HIDE_SECONDS);
  const [screenshotWarning, setScreenshotWarning] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) {
      setError("رمز غير صالح");
      setLoading(false);
      return;
    }
    fetch(`/api/secret-game/reveal/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setData(d as RevealData);
        fetch(`/api/socket.io?transport=polling`, { method: "GET" }).catch(
          () => {}
        );
      })
      .catch(() => setError("تعذّر الاتصال بالخادم"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!data || confirmed) return;
    const tryConfirm = async () => {
      try {
        const { io } = await import("socket.io-client");
        const socket = io({
          path: "/api/socket.io",
          transports: ["websocket", "polling"],
        });
        socket.emit("secret:scan_confirm", { pin: data.pin, team: data.team });
        setTimeout(() => socket.disconnect(), 3000);
        setConfirmed(true);
      } catch {}
    };
    tryConfirm();
  }, [data, confirmed]);

  useEffect(() => {
    if (!revealed) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(AUTO_HIDE_SECONDS);
      return;
    }

    setCountdown(AUTO_HIDE_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setRevealed(false);
          return AUTO_HIDE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [revealed]);

  const revealedRef = useRef(revealed);
  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  useEffect(() => {
    const triggerWarning = () => {
      if (!revealedRef.current) return;
      setScreenshotWarning(true);
      setTimeout(() => setScreenshotWarning(false), 3000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") triggerWarning();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "p")) {
        e.preventDefault();
        triggerWarning();
      }
      if (e.key === "PrintScreen") {
        triggerWarning();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a1f18" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "#0a1f18" }}
      >
        <div className="text-center" dir="rtl">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-xl text-red-300 font-bold">
            {error ?? "خطأ غير معروف"}
          </p>
          <p className="text-emerald-300/60 mt-2 text-sm">
            الرمز منتهي الصلاحية أو غير صالح
          </p>
        </div>
      </div>
    );
  }

  const teamLetter = data.team === "A" ? "أ" : "ب";
  const bg = data.teamColor;
  const countdownPct = (countdown / AUTO_HIDE_SECONDS) * 100;
  const countdownColor =
    countdown > 15 ? bg : countdown > 8 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      dir="rtl"
      style={{
        background: `radial-gradient(ellipse at center, ${bg}22 0%, #0a1f18 70%)`,
      }}
    >
      <AnimatePresence>
        {screenshotWarning && (
          <motion.div
            key="screenshot-warning"
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background: "#ef4444", color: "white" }}
          >
            <Camera className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-sm">
              ⚠️ لا يُسمح بالتقاط الشاشة — هذا سرّك!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border-4"
            style={{ background: `${bg}33`, borderColor: bg }}
          >
            <span className="text-5xl font-black" style={{ color: bg }}>
              {teamLetter}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">
            {data.teamName}
          </h1>
          <p className="text-emerald-200/70 mb-8 text-sm leading-relaxed">
            أنت قائد الفريق — اضغط لترى سرّك
          </p>
          <p className="text-yellow-300/80 text-xs mb-6">
            ⚠️ لا تُظهر الشاشة لأحد!
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setRevealed(true)}
            className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95"
            style={{ background: bg, color: "white" }}
          >
            <EyeOff className="w-6 h-6" />
            اكتشف سرّك
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm w-full"
        >
          <div
            className="text-xs font-bold px-3 py-1 rounded-full inline-block mb-4"
            style={{ background: `${bg}33`, color: bg }}
          >
            {data.teamName}
          </div>

          <div
            className="rounded-3xl overflow-hidden mb-5 shadow-2xl border-4 pointer-events-none"
            style={{ borderColor: bg }}
          >
            {data.secret.image && !imgError ? (
              <img
                src={data.secret.image}
                alt={data.secret.name}
                className="w-full h-56 object-cover"
                onError={() => setImgError(true)}
                draggable={false}
                style={{ WebkitUserDrag: "none" } as React.CSSProperties}
              />
            ) : (
              <div
                className="w-full h-56 flex flex-col items-center justify-center gap-3"
                style={{ background: `${bg}22` }}
              >
                <span className="text-7xl select-none">🎯</span>
                <span
                  className="text-2xl font-black"
                  style={{ color: bg }}
                >
                  {data.secret.name}
                </span>
              </div>
            )}
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <h2 className="text-5xl font-black text-white mb-2">
              {data.secret.name}
            </h2>
            <p className="text-emerald-200/60 text-sm">
              هذا هو سرّك — لا تخبر أحداً!
            </p>
          </motion.div>

          <div
            className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
            style={{ background: `${bg}20`, border: `1px solid ${bg}50` }}
          >
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" style={{ color: bg }} />
              <span className="text-white/60 text-xs">رمز الجلسة</span>
            </div>
            <span
              className="text-2xl font-black tracking-widest"
              style={{ color: bg }}
            >
              {data.pin}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs" style={{ color: countdownColor }}>
                سيُخفى السر تلقائياً بعد{" "}
                <span className="font-black">{countdown}</span>ث
              </span>
              <span className="text-white/30 text-xs">التعتيم التلقائي</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div
                className="h-full rounded-full transition-colors duration-1000"
                style={{
                  width: `${countdownPct}%`,
                  background: countdownColor,
                }}
              />
            </div>
          </div>

          <div
            className="rounded-2xl p-4 text-right text-sm leading-relaxed mb-4"
            style={{ background: `${bg}15`, border: `1px solid ${bg}40` }}
          >
            <p className="text-white/80 font-bold mb-1">📌 كيف تلعب:</p>
            <p className="text-white/60">
              الفريق الآخر سيسألك أسئلة نعم/لا عن سرّك. أجب بصدق!
            </p>
            <p className="text-white/60 mt-1">
              وأنت أيضاً اسألهم لتعرف سرّهم وتفوز!
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setRevealed(false)}
            className="mt-2 flex items-center gap-2 text-white/40 text-xs mx-auto hover:text-white/60 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            إخفاء السر الآن
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
