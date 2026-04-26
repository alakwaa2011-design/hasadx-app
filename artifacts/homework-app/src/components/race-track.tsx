import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import { AvatarDisplay } from "@/components/avatar-display";

interface RacePlayer {
  name: string;
  avatar?: string;
  score: number;
}

interface RaceTrackProps {
  players: RacePlayer[];
  maxScore?: number;
  myName?: string;
  hackMode?: boolean;
}

const TRACK_BAR_GRADIENTS = [
  "linear-gradient(90deg, #E8B84B, #C9960C)",
  "linear-gradient(90deg, #D9D9D9, #A3A3A3)",
  "linear-gradient(90deg, #C97A2D, #8A4A14)",
  "linear-gradient(90deg, #2D6A44, #1A3A28)",
  "linear-gradient(90deg, #1260A8, #08386E)",
  "linear-gradient(90deg, #B01414, #7A0A0A)",
  "linear-gradient(90deg, #8B35C8, #5A1A8A)",
  "linear-gradient(90deg, #0F8E8E, #054A4A)",
  "linear-gradient(90deg, #DAA520, #8B6914)",
  "linear-gradient(90deg, #4A7A5C, #1A3A28)",
];

const HACK_BAR_COLORS = [
  "from-green-400 to-emerald-500",
  "from-green-500 to-teal-400",
  "from-emerald-400 to-green-600",
  "from-teal-400 to-green-500",
  "from-cyan-400 to-teal-500",
  "from-green-300 to-emerald-400",
  "from-lime-400 to-green-500",
  "from-green-600 to-teal-600",
  "from-emerald-500 to-cyan-500",
  "from-teal-500 to-green-400",
];

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols = Math.floor(canvas.width / 16);
    const drops: number[] = Array(cols).fill(1);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ";
    let raf: number;
    function draw() {
      ctx!.fillStyle = "rgba(0,0,0,0.05)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = "#00ff41";
      ctx!.font = "13px monospace";
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx!.fillText(char, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas!.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" />;
}

function CircuitDecoration() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M10 10 h20 v20 h20 v-20 h10" stroke="#00ff41" strokeWidth="0.8" fill="none" />
          <path d="M10 50 h30 v10 h20" stroke="#00ff41" strokeWidth="0.8" fill="none" />
          <circle cx="10" cy="10" r="2" fill="#00ff41" />
          <circle cx="30" cy="30" r="2" fill="#00ff41" />
          <circle cx="60" cy="30" r="2" fill="#00ff41" />
          <circle cx="10" cy="50" r="2" fill="#00ff41" />
          <circle cx="40" cy="60" r="2" fill="#00ff41" />
          <path d="M70 10 v30 h-10" stroke="#00ff41" strokeWidth="0.8" fill="none" />
          <circle cx="70" cy="10" r="2" fill="#00ff41" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit)" />
    </svg>
  );
}

export default function RaceTrack({ players, maxScore, myName, hackMode }: RaceTrackProps) {
  const { t, lang } = useI18n();
  const effectiveMax = maxScore || Math.max(...players.map(p => p.score), 1);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topPlayers = sorted.slice(0, 10);

  if (hackMode) {
    return (
      <div
        className="w-full rounded-2xl overflow-hidden relative"
        style={{
          minHeight: 400,
          background: "linear-gradient(135deg, #000000 0%, #001a00 50%, #000d00 100%)",
          border: "1px solid #00ff4130",
          boxShadow: "0 0 40px #00ff4108, inset 0 0 60px #00ff4104",
        }}
      >
        <MatrixRain />
        <CircuitDecoration />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col gap-2 p-4 pt-3">
          <div className="text-center mb-2">
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="text-xs font-mono tracking-widest px-3 py-1 rounded-full border border-green-800 text-green-400"
              style={{ background: "rgba(0,255,65,0.05)" }}
            >
              ▶ SYSTEM::LEADERBOARD ▶ {players.length} AGENTS TRACKED
            </motion.span>
          </div>

          {topPlayers.map((player, i) => {
            const progress = effectiveMax > 0 ? Math.min((player.score / effectiveMax) * 100, 100) : 0;
            const isMe = player.name === myName;
            const barColor = HACK_BAR_COLORS[i % HACK_BAR_COLORS.length];
            const isTop = i === 0;

            return (
              <div key={player.name} className="flex items-center gap-2">
                <div className="w-7 text-center shrink-0">
                  <span className={`text-xs font-mono font-black ${isTop ? "text-green-300" : "text-green-700"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div
                  className="flex-1 relative h-10 rounded-lg overflow-hidden"
                  style={{
                    background: "rgba(0,255,65,0.04)",
                    border: `1px solid ${isTop ? "rgba(0,255,65,0.4)" : "rgba(0,255,65,0.1)"}`,
                    boxShadow: isTop ? "0 0 12px rgba(0,255,65,0.15)" : "none",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(progress, 5)}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15, delay: i * 0.08 }}
                    className={`absolute inset-y-0 ${lang === "ar" ? "right-0" : "left-0"} bg-gradient-to-r ${barColor}`}
                    style={{ opacity: isTop ? 0.35 : 0.2 }}
                  />
                  {isTop && (
                    <motion.div
                      className={`absolute inset-y-0 ${lang === "ar" ? "right-0" : "left-0"} w-1`}
                      style={{
                        left: lang === "ar" ? "auto" : `${Math.max(progress, 5)}%`,
                        right: lang === "ar" ? `${Math.max(progress, 5)}%` : "auto",
                        background: "rgba(0,255,65,0.8)",
                        boxShadow: "0 0 8px #00ff41",
                        transform: `translateX(${lang === "ar" ? "1px" : "-1px"})`,
                      }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                  )}

                  <div className="absolute inset-0 flex items-center px-2 z-10">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <motion.div
                        className="leading-none shrink-0"
                        animate={isTop ? { filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <AvatarDisplay avatar={player.avatar} size="sm" fallback="🤖" />
                      </motion.div>
                      <span
                        className={`text-xs font-mono font-bold truncate ${isMe ? "text-green-200" : isTop ? "text-green-400" : "text-green-700"}`}
                      >
                        {player.name}
                      </span>
                    </div>

                    <motion.span
                      key={player.score}
                      initial={{ scale: 1.4, color: "#00ff41" }}
                      animate={{ scale: 1, color: isTop ? "#4ade80" : "#166534" }}
                      className="text-xs font-mono font-black shrink-0 px-2 py-0.5 rounded"
                      style={{ background: "rgba(0,255,65,0.08)" }}
                    >
                      {player.score}
                    </motion.span>
                  </div>
                </div>
              </div>
            );
          })}

          {players.length > 10 && (
            <div className="text-center mt-1">
              <span className="text-xs text-green-900 font-mono">
                + {players.length - 10} MORE_AGENTS
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden p-4 relative"
      style={{
        minHeight: 400,
        background: "linear-gradient(160deg, #0F2A1C 0%, #1A3A28 50%, #0D2118 100%)",
        border: "1px solid rgba(232,184,75,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(232,184,75,0.08)",
      }}
    >
      <div className="relative z-10 flex flex-col gap-2 pt-2">
        <div className="text-center mb-3">
          <span
            className="text-xs font-black text-white px-3 py-1 rounded-full inline-flex items-center gap-1.5"
            style={{
              background: "rgba(232,184,75,0.15)",
              border: "1px solid rgba(232,184,75,0.35)",
              color: "#E8B84B",
            }}
          >
            🏆 {t.raceTrack.title}
          </span>
        </div>

        {topPlayers.map((player, i) => {
          const progress = effectiveMax > 0 ? Math.min((player.score / effectiveMax) * 100, 100) : 0;
          const isMe = player.name === myName;
          const barGradient = TRACK_BAR_GRADIENTS[i % TRACK_BAR_GRADIENTS.length];

          return (
            <div key={player.name} className="flex items-center gap-2">
              <div className="w-6 text-center shrink-0">
                <span className="text-xs font-black" style={{ color: i === 0 ? "#E8B84B" : "rgba(255,255,255,0.65)" }}>{i + 1}</span>
              </div>

              <div
                className="flex-1 relative h-10 rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: isMe ? "1.5px solid rgba(232,184,75,0.6)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isMe ? "0 0 12px rgba(232,184,75,0.25)" : "none",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progress, 8)}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 15, delay: i * 0.1 }}
                  className={`absolute inset-y-0 ${lang === "ar" ? "right-0" : "left-0"} rounded-full`}
                  style={{
                    background: barGradient,
                    boxShadow: i === 0 ? "0 0 12px rgba(232,184,75,0.4)" : "none",
                  }}
                />

                <div className="absolute inset-0 flex items-center px-2 z-10">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <motion.div
                      className="leading-none shrink-0"
                      animate={i === 0 ? { y: [0, -3, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                    >
                      <AvatarDisplay avatar={player.avatar} size="md" fallback="🦁" />
                    </motion.div>
                    <span className="text-xs font-black truncate text-white">
                      {player.name}
                    </span>
                  </div>

                  <motion.span
                    key={player.score}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-xs font-black text-white px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "rgba(0,0,0,0.35)" }}
                  >
                    {player.score}
                  </motion.span>
                </div>
              </div>
            </div>
          );
        })}

        {players.length > 10 && (
          <div className="text-center mt-1">
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>+{players.length - 10} {t.raceTrack.morePlayers}</span>
          </div>
        )}
      </div>
    </div>
  );
}
