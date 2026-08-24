import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { Trophy, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function MillionJoin() {
  const { pin: pinParam } = useParams<{ pin?: string }>();
  const [, setLocation] = useLocation();
  const { lang, t, dir } = useI18n();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [pin, setPin] = useState(pinParam || "");
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("millionPlayerName") || ""; } catch { return ""; }
  });
  const [joining, setJoining] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<{
    questionSource: string;
    assignmentId?: number;
    bankLevel?: string;
    bankCategory?: string;
  } | null>(null);

  useEffect(() => {
    if (pinParam && /^\d{6}$/.test(pinParam)) {
      validatePin(pinParam);
    }
  }, [pinParam]);

  async function validatePin(p: string) {
    try {
      const res = await fetch(`${API_BASE}/api/million/class-session/${p}`, { credentials: "include" });
      if (!res.ok) {
        toast.error(t.million.roomNotFound);
        return;
      }
      const data = await res.json();
      setSessionConfig(data);
      setPin(p);
    } catch {
      toast.error(t.million.validateCodeFailed);
    }
  }

  async function handleJoin() {
    const trimmedPin = pin.trim();
    const trimmedName = name.trim();

    if (!/^\d{6}$/.test(trimmedPin)) {
      toast.error(t.million.invalidRoomCode);
      return;
    }
    if (!trimmedName) {
      toast.error(t.million.nameRequired);
      return;
    }

    setJoining(true);

    let config = sessionConfig;
    if (!config) {
      try {
        const res = await fetch(`${API_BASE}/api/million/class-session/${trimmedPin}`, { credentials: "include" });
        if (!res.ok) {
          toast.error(t.million.roomNotFound);
          setJoining(false);
          return;
        }
        config = await res.json();
        setSessionConfig(config);
      } catch {
        toast.error(t.million.validateCodeFailed);
        setJoining(false);
        return;
      }
    }

    const socket = getSocket();
    socket.emit("million-class:join", { pin: trimmedPin, name: trimmedName }, (res: { playerToken?: string; autoAdvance?: boolean; broadcastMode?: boolean; mode?: string; currentQuestionIdx?: number; error?: string }) => {
      if (res.error || !res.playerToken) {
        toast.error(res.error || t.million.failedToJoin);
        setJoining(false);
        return;
      }

      try { localStorage.setItem("millionPlayerName", trimmedName); } catch { /* ignore */ }

      // Team-control mode: students don't play interactively — they watch the host's screen.
      if (res.mode === "team-control") {
        toast.success(t.million.hostControlled);
        setLocation(`/game/million/team-watch/${trimmedPin}?name=${encodeURIComponent(trimmedName)}`);
        return;
      }

      const params = new URLSearchParams({
        name: trimmedName,
        classPin: trimmedPin,
        playerToken: res.playerToken,
      });
      if (res.broadcastMode) {
        params.set("broadcast", "1");
        // Late joiners must start on the host's current question, not Q1.
        if (typeof res.currentQuestionIdx === "number" && res.currentQuestionIdx > 0) {
          params.set("startIdx", String(res.currentQuestionIdx));
        }
      }
      // Broadcast mode: server controls advancement; ignore autoAdvance.
      if (!res.broadcastMode && res.autoAdvance !== false) params.set("autoAdvance", "1");

      setLocation(`/game/million/play?${params.toString()}`);
    });
  }

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-8 px-4 flex items-center justify-center"
        dir={dir}
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <button
              onClick={() => setLocation("/game/million")}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors mb-4"
            >
              <BackIcon className="w-4 h-4" />
              {t.million.games}
            </button>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Trophy className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-black text-white">
               {t.million.joinCompetition}
            </h1>
            <p className="text-blue-300 text-sm mt-1">
                 {t.million.title}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div>
              <label className="text-blue-300 text-sm font-medium block mb-1.5">
                 {t.million.roomCode}
              </label>
              <input
                type="text"
                value={pin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(val);
                  if (val.length === 6) validatePin(val);
                }}
                maxLength={6}
                placeholder="000000"
                disabled={!!pinParam}
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-500 font-black text-2xl tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              {sessionConfig && (
                <p className="text-green-400 text-xs mt-1 text-center">
                   ✓ {t.million.roomValid}
                </p>
              )}
            </div>

            <div>
              <label className="text-blue-300 text-sm font-medium block mb-1.5">
                 {t.million.yourName}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !joining && handleJoin()}
                maxLength={40}
                 placeholder={t.million.nameExample}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={joining || !pin || !name.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              {joining
                 ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.million.joining}</>
                 : <>{t.million.joinAndPlay}</>
              }
            </button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
