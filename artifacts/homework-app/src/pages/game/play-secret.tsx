import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, QrCode } from "lucide-react";

export default function PlaySecret() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setLocation(`/game/secret/reveal?token=${encodeURIComponent(token)}`);
    }
  }, [setLocation]);

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-4 text-white"
      style={{ background: "linear-gradient(160deg,#0d0d1a 0%,#120d1f 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 max-w-sm w-full text-center"
      >
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)", border: "1.5px solid rgba(168,85,247,0.3)" }}>
          <Eye className="w-10 h-10 text-purple-400" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white mb-2">اكشف السر</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            امسح الباركود الذي يعرضه معلمك على الشاشة لرؤية سرّك المخفي
          </p>
        </div>

        <div className="w-full p-6 rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center gap-4">
          <QrCode className="w-12 h-12 text-purple-400/60" />
          <p className="text-white/40 text-sm">
            وجّه الكاميرا نحو الباركود للانضمام
          </p>
        </div>

        <p className="text-white/20 text-xs">
          إذا أعطاك معلمك رابطاً مباشراً، افتحه وسيعيد توجيهك تلقائياً
        </p>
      </motion.div>
    </div>
  );
}
