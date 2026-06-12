import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, Shield } from "lucide-react";

interface RevealData {
  team: "A" | "B";
  teamName: string;
  teamColor: string;
  secret: { id: number; name: string; image: string | null };
  pin: string;
}

export default function SecretReveal() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? location.split("?token=")[1] ?? "";

  const [data, setData] = useState<RevealData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!token) { setError("رمز غير صالح"); setLoading(false); return; }
    fetch(`/api/secret-game/reveal/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d as RevealData);
        fetch(`/api/socket.io?transport=polling`, { method: "GET" }).catch(() => {});
      })
      .catch(() => setError("تعذّر الاتصال بالخادم"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!data || confirmed) return;
    const tryConfirm = async () => {
      try {
        const { io } = await import("socket.io-client");
        const socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
        socket.emit("secret:scan_confirm", { pin: data.pin, team: data.team });
        setTimeout(() => socket.disconnect(), 3000);
        setConfirmed(true);
      } catch {}
    };
    tryConfirm();
  }, [data, confirmed]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1f18" }}>
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a1f18" }}>
        <div className="text-center" dir="rtl">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-xl text-red-300 font-bold">{error ?? "خطأ غير معروف"}</p>
          <p className="text-emerald-300/60 mt-2 text-sm">الرمز منتهي الصلاحية أو غير صالح</p>
        </div>
      </div>
    );
  }

  const teamLetter = data.team === "A" ? "أ" : "ب";
  const bg = data.teamColor;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 select-none"
      dir="rtl"
      style={{ background: `radial-gradient(ellipse at center, ${bg}22 0%, #0a1f18 70%)` }}
    >
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
            <span className="text-5xl font-black" style={{ color: bg }}>{teamLetter}</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">{data.teamName}</h1>
          <p className="text-emerald-200/70 mb-8 text-sm leading-relaxed">
            أنت قائد الفريق — اضغط لترى سرّك
          </p>
          <p className="text-yellow-300/80 text-xs mb-6">⚠️ لا تُظهر الشاشة لأحد!</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setRevealed(true)}
            className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95"
            style={{ background: bg, color: "white" }}
          >
            <EyeOff className="w-6 h-6" />
            اكشف سرّك
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
            className="rounded-3xl overflow-hidden mb-5 shadow-2xl border-4"
            style={{ borderColor: bg }}
          >
            {data.secret.image ? (
              <img
                src={data.secret.image}
                alt={data.secret.name}
                className="w-full h-56 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className="w-full h-56 flex items-center justify-center text-8xl"
                style={{ background: `${bg}22` }}
              >
                🎯
              </div>
            )}
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h2 className="text-5xl font-black text-white mb-2">{data.secret.name}</h2>
            <p className="text-emerald-200/60 text-sm">هذا هو سرّك — لا تخبر أحداً!</p>
          </motion.div>

          <div
            className="rounded-2xl p-4 text-right text-sm leading-relaxed"
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
            className="mt-4 flex items-center gap-2 text-white/40 text-xs mx-auto hover:text-white/60 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            إخفاء السر مؤقتاً
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
