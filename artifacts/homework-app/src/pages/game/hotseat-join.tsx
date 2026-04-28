import { useState, useRef, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { NORMAL_AVATARS as AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";

const FIRE = "#FF6B2B";
const FIRE2 = "#FF9F43";
const DARK_BG = "linear-gradient(180deg, #050818 0%, #0d1230 50%, #1a0800 100%)";

const PIN_LENGTH = 6;

function PinInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(PIN_LENGTH, "").split("").slice(0, PIN_LENGTH);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newVal = value.slice(0, i > 0 ? i - 1 : 0) + value.slice(i);
      onChange(newVal.slice(0, PIN_LENGTH));
      if (i > 0) refs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, v: string) => {
    // Numbers only
    const ch = v.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const arr = chars.map((c, idx) => (idx === i ? ch : c === " " ? "" : c));
    const joined = arr.join("").slice(0, PIN_LENGTH);
    onChange(joined);
    if (i < PIN_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    onChange(text);
    const nextIdx = Math.min(text.length, PIN_LENGTH - 1);
    refs.current[nextIdx]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", direction: "ltr" }}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={chars[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          disabled={disabled}
          maxLength={1}
          style={{
            width: 44, height: 52, borderRadius: 12,
            background: chars[i] ? `${FIRE}25` : "rgba(255,255,255,0.08)",
            border: `2px solid ${chars[i] ? FIRE : "rgba(255,255,255,0.15)"}`,
            color: "#fff", fontWeight: 900, fontSize: 22,
            textAlign: "center", outline: "none", fontFamily: "monospace",
            transition: "all 0.15s",
            boxShadow: chars[i] ? `0 0 12px ${FIRE}50` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function HotSeatJoin() {
  const params = useParams<{ pin?: string }>();
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  const [pin, setPin] = useState(params.pin || sp.get("pin") || "");
  const [name, setName] = useState(sp.get("name") || "");
  const [avatar, setAvatar] = useState(sp.get("avatar") || DEFAULT_AVATAR);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const [pinValid, setPinValid] = useState<boolean | null>(null);
  const [checkedPin, setCheckedPin] = useState("");

  // Validate PIN via socket
  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length === PIN_LENGTH && trimmed !== checkedPin) {
      setCheckedPin(trimmed);
      const socket = getHotSeatSocket();
      socket.emit("hotseat:check", { pin: trimmed }, (res: { exists: boolean }) => {
        setPinValid(res.exists);
      });
    }
    if (trimmed.length < PIN_LENGTH) { setCheckedPin(""); setPinValid(null); }
  }, [pin, checkedPin]);

  const handleJoin = () => {
    const trimPin = pin.trim();
    const trimName = name.trim();
    if (!trimPin || trimPin.length !== PIN_LENGTH) { toast.error(ar ? "أدخل كود الغرفة" : "Enter room code"); return; }
    if (!trimName) { toast.error(ar ? "أدخل اسمك" : "Enter your name"); return; }
    setJoining(true);
    const socket = getHotSeatSocket();
    socket.emit("hotseat:join", { pin: trimPin, name: trimName, avatar }, (res: {
      success?: boolean; uid?: string; color?: string; error?: string; state?: object;
    }) => {
      setJoining(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.success && res.uid) {
        // Store info for rejoin
        sessionStorage.setItem(`hotseat-student-${trimPin}`, JSON.stringify({ uid: res.uid, name: trimName, avatar, color: res.color }));
        setLocation(`/game/hotseat/play/${trimPin}?name=${encodeURIComponent(trimName)}&avatar=${encodeURIComponent(avatar)}&uid=${res.uid}`);
      }
    });
  };

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
      {/* Background embers */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -80], opacity: [0.6, 0], x: [0, (Math.random() - 0.5) * 30] }}
            transition={{ repeat: Infinity, duration: 2 + Math.random() * 2, delay: Math.random() * 3 }}
            style={{
              position: "absolute", bottom: 0, left: `${5 + Math.random() * 90}%`,
              fontSize: 8 + Math.random() * 12,
            }}
          >
            🔥
          </motion.div>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 10, padding: "32px 20px", maxWidth: 400, marginInline: "auto" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 28 }}>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ fontSize: 60, display: "block", marginBottom: 8 }}
          >
            🔥
          </motion.div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 4px" }}>
            {ar ? "الكرسي الساخن" : "HotSeat"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
            {ar ? "انضم للجلسة الآن" : "Join the session"}
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,107,43,0.25)",
            borderRadius: 24,
            padding: 24,
            backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column", gap: 20,
          }}
        >
          {/* Name */}
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              {ar ? "👤 اسمك" : "👤 Your Name"}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={ar ? "أدخل اسمك..." : "Enter your name..."}
              maxLength={30}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1.5px solid rgba(255,255,255,0.15)",
                color: "#fff", fontSize: 15, fontWeight: 700, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Avatar */}
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              {ar ? "🎭 أفاتارك" : "🎭 Your Avatar"}
            </label>
            <button
              onClick={() => setAvatarOpen(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: `1.5px solid ${FIRE}50`,
                color: "#fff", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 28 }}>{avatar}</span>
              <span style={{ flex: 1, textAlign: "start", fontSize: 14, fontWeight: 700 }}>
                {ar ? "اختر أفاتار" : "Choose avatar"}
              </span>
              {avatarOpen ? <ChevronUp size={16} color="rgba(255,255,255,0.5)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.5)" />}
            </button>
            <AnimatePresence>
              {avatarOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 8,
                    padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 12,
                  }}>
                    {AVATARS.map(a => (
                      <button
                        key={a}
                        onClick={() => { setAvatar(a); setAvatarOpen(false); }}
                        style={{
                          fontSize: 26, padding: 6, borderRadius: 10, border: "none",
                          background: avatar === a ? `${FIRE}40` : "transparent",
                          cursor: "pointer",
                          boxShadow: avatar === a ? `0 0 8px ${FIRE}` : undefined,
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PIN */}
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
              {ar ? "🔑 كود الغرفة" : "🔑 Room Code"}
            </label>
            <PinInput value={pin} onChange={setPin} />
            <AnimatePresence>
              {pinValid === true && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 6 }}>
                  ✅ {ar ? "الغرفة موجودة!" : "Room found!"}
                </motion.p>
              )}
              {pinValid === false && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 6 }}>
                  ❌ {ar ? "الغرفة غير موجودة" : "Room not found"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              padding: "15px", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: "#fff", fontWeight: 900, fontSize: 16,
              cursor: joining ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: `0 10px 28px ${FIRE}60`,
              opacity: joining ? 0.75 : 1,
            }}
          >
            {joining
              ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>🔥</motion.span>
              : <><span style={{ fontSize: 20 }}>🚀</span> {ar ? "انضم الآن" : "Join Now"} <ChevronRight size={18} /></>}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
