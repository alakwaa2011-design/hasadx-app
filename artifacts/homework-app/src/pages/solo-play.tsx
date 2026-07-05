/**
 * /solo/:slug  —  لعب فردي عام بدون حساب
 * Public solo Wameeth challenge page.
 * Anyone can open the link, enter their name, and play instantly.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import {
  Trophy, Users, Zap, Play, Loader2, AlertCircle, FileText, Lock, Clock,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface ChallengeInfo {
  slug: string;
  assignmentTitle: string;
  notes: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  playCount: number;
  questionCount: number;
  leaderboardDisplay?: string;
}

type LeaderboardEntry = { playerName: string; score: number; correctCount?: number };

const medals = ["🥇", "🥈", "🥉"];

export default function SoloPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [starting, setStarting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  // Load challenge metadata
  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) setLoadError(data.message);
        else setInfo(data);
      })
      .catch(() => setLoadError(lang === "ar" ? "تعذّر تحميل المسابقة" : "Failed to load challenge"));
  }, [slug]);

  // Replay on this device → reuse the name entered on the first attempt.
  // Key/shape mirror the "hasad_solo_first_<slug>" entry written in
  // solo-challenge-results.tsx (first-attempt-only scoring).
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`hasad_solo_first_${slug}`);
      if (raw) {
        const saved = JSON.parse(raw) as { name?: string };
        if (saved?.name) setPlayerName(saved.name);
      }
    } catch { /* ignore malformed/blocked storage */ }
  }, [slug]);

  // Load leaderboard (shown up-front too, before playing)
  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}/leaderboard`)
      .then(r => r.json())
      .then(data => {
        setLeaderboard(Array.isArray(data) ? data : []);
        setLeaderboardLoaded(true);
      })
      .catch(() => setLeaderboardLoaded(true));
  }, [slug]);

  const handleStart = async () => {
    const name = playerName.trim();
    if (!name) {
      setNameError(lang === "ar" ? "أدخل اسمك أولاً" : "Please enter your name");
      return;
    }
    setNameError("");
    setStarting(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug!)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ");

      // Store context for solo-only tweaks in play.tsx + score reporting
      sessionStorage.setItem("solo_challenge_slug", slug!);
      sessionStorage.setItem("solo_challenge_player", name);
      sessionStorage.setItem("solo_challenge_title", info?.assignmentTitle ?? "");
      sessionStorage.setItem("solo_challenge_start_time", String(Date.now()));
      if (data.shortSlug) sessionStorage.setItem("solo_challenge_short_slug", data.shortSlug);
      if (data.leaderboardDisplay) sessionStorage.setItem("solo_leaderboard_display", data.leaderboardDisplay);

      // Skip the old /game/join screen entirely — solo has its own entry.
      // Go straight to /game/play/:pin with name + avatar in the query string
      // (same shape GameJoin would have produced when forwarding).
      const avatar = "🎯";
      setLocation(
        `/game/play/${data.pin}?name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
      );
    } catch (err: any) {
      setNameError(err.message || (lang === "ar" ? "تعذّر بدء اللعبة" : "Failed to start"));
      setStarting(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────
  if (!info && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}>
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }} dir={dir}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm w-full rounded-3xl p-8"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">{loadError}</p>
        </motion.div>
      </div>
    );
  }

  // ── Expired ──────────────────────────────────────────────
  if (info?.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }} dir={dir}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm w-full rounded-3xl p-8"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,100,100,0.25)" }}>
          <Lock className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-black text-xl mb-2">{info.assignmentTitle}</h2>
          <p className="text-red-300 font-bold text-base mb-3">
            {lang === "ar" ? "انتهت مدة هذه المسابقة" : "This challenge has closed"}
          </p>
          {info.expiresAt && (
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Clock className="w-3.5 h-3.5" />
              {new Date(info.expiresAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Main Page ────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}
      dir={dir}
    >
      {/* Animated background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + (i % 4) * 3,
              height: 4 + (i % 4) * 3,
              background: ["#E8B84B", "#4ade80", "#ffffff", "#fbbf24"][i % 4],
              left: `${5 + (i * 4.7) % 90}%`,
              top: `${10 + (i * 5.3) % 80}%`,
              opacity: 0.15 + (i % 4) * 0.08,
            }}
            animate={{ y: [0, -20, 0], opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 3 + i % 3, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Solo badge */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
            style={{ background: "rgba(232,184,75,0.18)", border: "1px solid rgba(232,184,75,0.45)", color: "#E8B84B" }}>
            <Zap className="w-3.5 h-3.5" />
            {lang === "ar" ? "لعب فردي مفتوح" : "Open Solo Play"}
          </span>
        </div>

        {/* Main card */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>

          {/* Header */}
          <div className="p-6 pb-5 text-center"
            style={{ background: "linear-gradient(180deg, rgba(232,184,75,0.12) 0%, transparent 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <motion.div animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}>
              <Trophy className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 text-amber-400 drop-shadow-[0_0_20px_rgba(232,184,75,0.5)]" />
            </motion.div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">
              {info!.assignmentTitle}
            </h1>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="flex items-center gap-1 text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
                <Zap className="w-4 h-4 text-amber-400" />
                {info!.questionCount} {lang === "ar" ? "سؤال" : "questions"}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
                <Users className="w-4 h-4 text-green-400" />
                {info!.playCount} {lang === "ar" ? "لاعب" : "players"}
              </span>
            </div>
          </div>

          {/* Teacher notes */}
          {info!.notes && (
            <div className="mx-6 mt-5 rounded-xl px-4 py-3.5 flex items-start gap-3"
              style={{ background: "rgba(232,184,75,0.12)", border: "1px solid rgba(232,184,75,0.35)" }}>
              <FileText className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.85)" }} dir="rtl">
                {info!.notes}
              </p>
            </div>
          )}

          {/* Name input */}
          <div className="p-6">
            <label className="block text-sm font-bold mb-2" style={{ color: "rgba(255,255,255,0.75)" }}>
              {lang === "ar" ? "اكتب اسمك للبدء" : "Enter your name to start"}
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setNameError(""); }}
              onKeyDown={e => e.key === "Enter" && handleStart()}
              placeholder={lang === "ar" ? "اسمك هنا..." : "Your name..."}
              maxLength={40}
              autoFocus
              className="w-full rounded-2xl px-4 py-3.5 text-base font-bold outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: nameError ? "2px solid rgba(239,68,68,0.7)" : "2px solid rgba(255,255,255,0.15)",
                color: "white",
                direction: "auto",
              }}
              onFocus={e => { if (!nameError) e.target.style.borderColor = "rgba(232,184,75,0.7)"; }}
              onBlur={e => { if (!nameError) e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
            />
            <AnimatePresence>
              {nameError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-400 text-sm font-bold mt-2">
                  {nameError}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Start button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              disabled={starting}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-black transition-all disabled:opacity-60"
              style={{
                background: starting ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #C9930A 0%, #E8B84B 50%, #C9930A 100%)",
                color: starting ? "rgba(255,255,255,0.5)" : "#1A1200",
                boxShadow: starting ? "none" : "0 4px 24px rgba(232,184,75,0.35)",
              }}
            >
              {starting ? (
                <><Loader2 className="w-5 h-5 animate-spin" />{lang === "ar" ? "جاري التحضير..." : "Starting..."}</>
              ) : (
                <><Play className="w-5 h-5" fill="currentColor" />{lang === "ar" ? "ابدأ المسابقة" : "Start Challenge"}</>
              )}
            </motion.button>

            <p className="text-center text-xs mt-4 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
              {lang === "ar"
                ? "بدون تسجيل حساب • تُسجَّل درجتك تلقائياً"
                : "No account needed • Score saved automatically"}
            </p>

            {/* Leaderboard — shown below the name field and start button */}
            {(leaderboardLoaded ? leaderboard.length > 0 : true) && (
              <div className="mt-5 rounded-2xl overflow-hidden"
                style={{ background: "rgba(232,184,75,0.05)", border: "1px solid rgba(232,184,75,0.18)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: "1px solid rgba(232,184,75,0.12)" }}>
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="font-black text-white text-sm">
                    {lang === "ar"
                      ? info?.leaderboardDisplay === "top3"
                        ? "المتصدرون الثلاثة"
                        : info?.leaderboardDisplay === "all"
                          ? "جدول المتصدرين"
                          : "أفضل 20 لاعب"
                      : info?.leaderboardDisplay === "top3"
                        ? "Top 3 Players"
                        : info?.leaderboardDisplay === "all"
                          ? "Full Leaderboard"
                          : "Top 20 Players"}
                  </h3>
                  <div className="ms-auto flex items-center gap-3">
                    <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {lang === "ar" ? "صحيح" : "Correct"}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "rgba(232,184,75,0.6)" }}>
                      {lang === "ar" ? "النقاط" : "Points"}
                    </span>
                  </div>
                </div>
                <div className="px-2 py-1.5 space-y-0.5 max-h-44 overflow-y-auto">
                  {!leaderboardLoaded ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    </div>
                  ) : (
                    leaderboard.slice(0, 20).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg">
                        <span className="w-6 text-center text-xs font-black shrink-0"
                          style={{ color: i < 3 ? "#E8B84B" : "rgba(255,255,255,0.4)" }}>
                          {i < 3 ? medals[i] : i + 1}
                        </span>
                        <span className="flex-1 text-xs font-bold truncate text-white/75">
                          {entry.playerName}
                        </span>
                        <span className="text-[11px] font-bold w-7 text-center" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {entry.correctCount ?? "—"}
                        </span>
                        <span className="font-black text-xs w-16 text-end"
                          style={{ color: i === 0 ? "#E8B84B" : "rgba(255,255,255,0.8)" }}>
                          {entry.score > 0 ? entry.score.toLocaleString() : "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
