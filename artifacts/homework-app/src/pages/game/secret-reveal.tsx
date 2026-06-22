import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface RevealData {
  team: "A" | "B";
  teamName: string;
  teamColor: string;
  secret: { id: number; name: string; image: string | null };
  categoryId: number;
  pin: string;
}

const PROPHETS_CATEGORY_ID = 2;
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
  // Start revealed=true so the image shows immediately on scan
  const [revealed, setRevealed] = useState(true);
  const [imgError, setImgError] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);
  const [autoHideSeconds, setAutoHideSeconds] = useState(AUTO_HIDE_SECONDS);

  useEffect(() => {
    if (!token) { setError("رمز غير صالح"); setLoading(false); return; }
    fetch(`/api/secret-game/reveal/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d as RevealData);
      })
      .catch(() => setError("تعذّر الاتصال"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!data) return;
    const setupSocket = async () => {
      try {
        const { io } = await import("socket.io-client");
        const socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
        socketRef.current = socket;
        socket.on("connect", () => {
          socket.emit("secret:scan_confirm", { pin: data.pin, team: data.team },
            (res: { ok?: boolean; hideDuration?: number }) => {
              if (res?.hideDuration && res.hideDuration > 0) setAutoHideSeconds(res.hideDuration);
            },
          );
        });
        socket.on("secret:hide_duration_changed", ({ duration }: { duration: number }) => {
          if (duration > 0) setAutoHideSeconds(duration);
        });
        socket.on("secret:force_hide", () => setRevealed(false));
      } catch {}
    };
    setupSocket();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [data]);

  // Auto-hide countdown (silent — no UI)
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!revealed) return;
    let remaining = autoHideSeconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setRevealed(false);
      }
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [revealed, autoHideSeconds]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d1a" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0d0d1a" }}>
        <p className="text-xl text-red-300 font-bold text-center dir-rtl">{error ?? "خطأ غير معروف"}</p>
      </div>
    );
  }

  const isProphet = data.categoryId === PROPHETS_CATEGORY_ID;
  const displayName = isProphet ? `${data.secret.name} عليه السلام` : data.secret.name;
  const bg = data.teamColor;
  const rawImage = data.secret.image;
  const proxiedImage = rawImage ? `/api/image-proxy?url=${encodeURIComponent(rawImage)}` : null;
  const hasImage = !!proxiedImage && !imgError;

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      dir="rtl"
      style={{ background: "#0d0d1a" }}
      onClick={() => revealed && setRevealed(false)}
    >
      <AnimatePresence mode="wait">
        {!revealed ? (
          /* ── Hidden state: tap to re-show ── */
          <motion.div
            key="pre"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
            onClick={(e) => { e.stopPropagation(); setRevealed(true); }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-4"
              style={{ background: `${bg}22`, borderColor: bg, color: bg }}
            >
              {data.team === "A" ? "أ" : "ب"}
            </div>
            <p className="text-white/60 text-lg font-bold">اضغط لإعادة العرض</p>
          </motion.div>
        ) : (
          /* ── Revealed: image + name only ── */
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {/* Image area — fills the screen */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: "65vh" }}>
              {hasImage ? (
                <img
                  src={proxiedImage!}
                  alt={displayName}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setImgError(true)}
                  draggable={false}
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `${bg}22` }}
                >
                  <span className="text-[90px]">🎯</span>
                </div>
              )}
              {/* Gradient overlay at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-28"
                style={{ background: "linear-gradient(to top, #0d0d1a, transparent)" }}
              />
            </div>

            {/* Name below */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="py-8 px-6 text-center"
              style={{ background: "#0d0d1a" }}
            >
              <h2
                className="text-5xl font-black leading-tight"
                style={{ color: bg }}
              >
                {displayName}
              </h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
