import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Loader2, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface JoinResponse {
  token: string;
  teamName: string;
  teamColor: string;
  opponentName: string;
  phase: string;
}

export default function PlaySecret() {
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [team, setTeam] = useState<"A" | "B" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinInfo, setJoinInfo] = useState<JoinResponse | null>(null);

  const handleJoin = async () => {
    if (!pin.trim() || !team) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/secret-game/join?pin=${encodeURIComponent(pin.trim().toUpperCase())}&team=${team}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "خطأ غير معروف");
        return;
      }
      const data: JoinResponse = await res.json();
      setJoinInfo(data);
    } catch {
      setError("تعذّر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    if (!joinInfo) return;
    setLocation(`/game/secret/reveal?token=${encodeURIComponent(joinInfo.token)}`);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-4 text-white"
      style={{ background: "linear-gradient(160deg,#0d0d1a 0%,#120d1f 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 max-w-sm w-full"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(168,85,247,0.15)", border: "1.5px solid rgba(168,85,247,0.3)" }}
          >
            <Eye className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-black text-white">اكشف السر</h1>
          <p className="text-white/40 text-sm text-center">أدخل رمز الجلسة واختر فريقك</p>
        </div>

        {/* PIN + Team Form */}
        <AnimatePresence mode="wait">
          {!joinInfo ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col gap-4"
            >
              {/* PIN input */}
              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-xs font-bold">رمز الجلسة (PIN)</label>
                <input
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && team && handleJoin()}
                  placeholder="مثال: AB12CD"
                  maxLength={6}
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-xl font-mono tracking-widest placeholder-white/20 focus:outline-none focus:border-purple-500 focus:bg-white/15 transition-all"
                />
              </div>

              {/* Team selection */}
              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-xs font-bold">اختر فريقك</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["A", "B"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTeam(t)}
                      className="py-4 rounded-xl border-2 font-black text-base transition-all"
                      style={{
                        borderColor: team === t ? "#a855f7" : "rgba(255,255,255,0.1)",
                        background: team === t ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                        color: team === t ? "#e9d5ff" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      الفريق {t === "A" ? "الأول" : "الثاني"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Join button */}
              <button
                onClick={handleJoin}
                disabled={pin.length < 4 || !team || loading}
                className="w-full py-3.5 rounded-xl font-black text-base transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ الانضمام…
                  </>
                ) : (
                  "انضم للعبة"
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full flex flex-col items-center gap-5"
            >
              <div
                className="w-full p-5 rounded-2xl text-center border"
                style={{
                  background: `${joinInfo.teamColor}15`,
                  borderColor: `${joinInfo.teamColor}40`,
                }}
              >
                <p className="text-white/50 text-xs mb-1">أنت قائد</p>
                <p className="text-2xl font-black" style={{ color: joinInfo.teamColor }}>
                  {joinInfo.teamName}
                </p>
                <p className="text-white/30 text-xs mt-2">
                  منافسك: {joinInfo.opponentName}
                </p>
                {joinInfo.phase === "waiting_scan" && (
                  <p className="text-purple-400 text-xs mt-2 font-bold">
                    ✅ جاهز للكشف — اضغط الزر لرؤية سرّك
                  </p>
                )}
              </div>

              <button
                onClick={handleReveal}
                className="w-full py-4 rounded-xl font-black text-lg transition-all"
                style={{ background: `linear-gradient(135deg,${joinInfo.teamColor},${joinInfo.teamColor}cc)` }}
              >
                🔍 اكشف سرّك
              </button>

              <button
                onClick={() => { setJoinInfo(null); setError(null); }}
                className="text-white/30 text-sm hover:text-white/60 transition-colors"
              >
                العودة
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
