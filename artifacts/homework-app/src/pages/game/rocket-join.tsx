import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Rocket, Users } from "lucide-react";
import { NORMAL_AVATARS as AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";

const API_BASE = import.meta.env.VITE_API_URL || "";

const GOLD = "#D9A521";
const CYAN = "#54d8ff";
const SPACE_BG = "radial-gradient(140% 95% at 50% -10%, #1a2a7a 0%, #0d1445 38%, #060930 62%, #02040f 100%)";

const RRJ_KEYFRAMES = `
@keyframes rrjShine{0%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(240%) skewX(-18deg)}}
@keyframes rrjPulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes rrjGate{0%{background-position:0% 50%}100%{background-position:200% 50%}}
`;

// Module-level star data — stable across re-renders
const JOIN_STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: ((i * 73 + 17) % 100),
  y: ((i * 91 + 33) % 100),
  size: 0.6 + (i % 4) * 0.5,
  delay: (i % 6) * 0.5,
}));

function JoinStarField() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <motion.div
        animate={{ opacity: [0.5, 0.9, 0.5], x: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        style={{ position: "absolute", top: "6%", left: "2%", width: "46vmin", height: "32vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(110,20,200,0.20) 0%, transparent 70%)" }}
      />
      <motion.div
        animate={{ opacity: [0.4, 0.8, 0.4], x: [10, -10, 10] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 3 }}
        style={{ position: "absolute", bottom: "8%", right: "0%", width: "40vmin", height: "28vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(20,70,220,0.18) 0%, transparent 70%)" }}
      />
      {JOIN_STARS.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 + s.delay, delay: s.delay }}
          style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
            boxShadow: s.size > 1.4 ? `0 0 ${s.size * 3}px rgba(200,225,255,0.8)` : undefined,
          }}
        />
      ))}
    </div>
  );
}

interface GameStudent { id: number; name: string; }

function useMuteState() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("rocket-music-muted") === "1"; } catch { return false; }
  });
  const toggle = () => setMuted(prev => {
    const next = !prev;
    try { localStorage.setItem("rocket-music-muted", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  return { muted, toggle };
}

export default function RocketJoin() {
  const params = useParams<{ pin?: string }>();
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const queryPin = sp.get("pin") || "";
  const queryName = sp.get("name") || "";
  const queryAvatar = sp.get("avatar") || "";

  const [pin, setPin] = useState(params.pin || queryPin || "");
  const [name, setName] = useState(queryName);
  const [avatar, setAvatar] = useState(queryAvatar || DEFAULT_AVATAR);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";

  const [gameTargetClass, setGameTargetClass] = useState<string | null>(null);
  const [gameStudents, setGameStudents] = useState<GameStudent[]>([]);
  const [checkedPin, setCheckedPin] = useState("");
  const [pinValid, setPinValid] = useState<boolean | null>(null);

  const { muted, toggle: toggleMute } = useMuteState();

  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length === 6 && trimmed !== checkedPin) {
      setCheckedPin(trimmed);
      fetch(`${API_BASE}/api/rocket-game-info/${trimmed}`)
        .then(r => r.json())
        .then(data => {
          if (data.exists) {
            if (data.targetClass) {
              setGameTargetClass(data.targetClass);
              setGameStudents(data.students || []);
              // Reset name so the student picks from the roster, not a stale value.
              setName("");
            } else {
              setGameTargetClass(null);
              setGameStudents([]);
            }
            setPinValid(true);
          } else {
            setGameTargetClass(null);
            setGameStudents([]);
            setPinValid(false);
          }
        })
        .catch(() => {
          setPinValid(false);
          setGameTargetClass(null);
          setGameStudents([]);
        });
    }
    if (trimmed.length < 6) {
      setCheckedPin("");
      setGameTargetClass(null);
      setGameStudents([]);
      setPinValid(null);
    }
  }, [pin, checkedPin]);

  const handleJoin = () => {
    const trimPin = pin.trim();
    const trimName = name.trim();
    if (!trimPin || !trimName) return;
    setLocation(
      `/game/rocket/play/${trimPin}?name=${encodeURIComponent(trimName)}&avatar=${encodeURIComponent(avatar)}`
    );
  };

  const pinBorderColor = pinValid === true ? "#4ade80" : pinValid === false ? "#ef4444" : "rgba(84,216,255,0.35)";
  const canJoin = pinValid && name.trim().length > 0;

  return (
    <div
      dir={dir}
      style={{ minHeight: "100dvh", background: SPACE_BG, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
    >
      <style>{RRJ_KEYFRAMES}</style>
      <JoinStarField />
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(120,160,255,0.16)",
        background: "linear-gradient(180deg, rgba(8,12,32,0.7), rgba(8,12,32,0.42))",
        backdropFilter: "blur(12px)",
        position: "relative", zIndex: 5,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-0.3px", textShadow: `0 0 14px ${GOLD}60` }}>
          حصاد
        </span>
        <button
          onClick={toggleMute}
          title={muted ? (ar ? "تشغيل الصوت" : "Unmute") : (ar ? "كتم الصوت" : "Mute")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1.5px solid ${muted ? "rgba(255,255,255,0.2)" : `${CYAN}80`}`,
            background: muted ? "rgba(255,255,255,0.06)" : "rgba(84,216,255,0.12)",
            color: muted ? "rgba(255,255,255,0.55)" : CYAN,
            fontWeight: 600, fontSize: 13,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          {muted ? (ar ? "الصوت مكتوم" : "Muted") : (ar ? "الصوت يعمل" : "Sound On")}
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", zIndex: 5 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: "easeOut" }}
          style={{ width: "100%", maxWidth: 420 }}
        >
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
              <div style={{
                position: "absolute", left: "50%", top: "50%", width: 130, height: 130,
                transform: "translate(-50%,-50%)",
                background: `radial-gradient(circle, ${GOLD}35 0%, transparent 70%)`,
                borderRadius: "50%",
                animation: "rrjPulse 2.6s ease-in-out infinite",
              }} />
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                style={{
                  position: "relative",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 80, height: 80, borderRadius: 24,
                  background: `linear-gradient(135deg, #ffd76e, ${GOLD} 50%, #a87908)`,
                  boxShadow: `0 14px 36px -8px ${GOLD}90, inset 0 1px 0 rgba(255,255,255,0.5)`,
                }}
              >
                <Rocket size={38} color="#221a02" />
              </motion.div>
            </div>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 900, color: "#fff", lineHeight: 1.2, textShadow: `0 0 30px ${GOLD}50, 0 2px 4px rgba(0,0,0,0.6)` }}>
              {ar ? "انضم لسباق الصواريخ" : "Join the Rocket Race"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
              {ar ? "أدخل رمز الغرفة وانطلق نحو الفضاء!" : "Enter the room code and blast off!"}
            </p>
          </div>

          {/* Card */}
          <div style={{
            position: "relative",
            background: "linear-gradient(160deg, rgba(20,28,64,0.78), rgba(10,14,38,0.68))",
            borderRadius: 20,
            border: "1px solid rgba(120,160,255,0.22)",
            boxShadow: "0 16px 44px -16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.09)",
            backdropFilter: "blur(14px)",
            padding: "28px 24px",
            display: "flex", flexDirection: "column", gap: 20,
            overflow: "hidden",
          }}>
            <div aria-hidden style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
              background: `linear-gradient(90deg, transparent, ${GOLD}, ${CYAN}, transparent)`,
              backgroundSize: "200% 100%",
              animation: "rrjGate 3.5s linear infinite",
            }} />
            {/* PIN */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                {ar ? "رمز الغرفة" : "Room Code"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  dir="ltr"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    textAlign: "center", fontSize: 36, fontWeight: 900,
                    letterSpacing: "0.45em",
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `2px solid ${pinBorderColor}`,
                    outline: "none",
                    background: "rgba(4,8,24,0.55)",
                    color: "#fff",
                    boxShadow: pinValid === true
                      ? "0 0 18px rgba(74,222,128,0.35), inset 0 2px 8px rgba(0,0,0,0.4)"
                      : pinValid === false
                        ? "0 0 18px rgba(239,68,68,0.3), inset 0 2px 8px rgba(0,0,0,0.4)"
                        : "inset 0 2px 8px rgba(0,0,0,0.4)",
                    textShadow: `0 0 12px ${GOLD}70`,
                  }}
                />
                {pinValid !== null && (
                  <span style={{
                    position: "absolute", top: "50%",
                    [ar ? "left" : "right"]: 14, transform: "translateY(-50%)",
                    fontSize: 18, color: pinValid ? "#4ade80" : "#ef4444",
                    textShadow: pinValid ? "0 0 10px #4ade80" : "0 0 10px #ef4444",
                  }}>
                    {pinValid ? "✓" : "✗"}
                  </span>
                )}
              </div>
              {pinValid === false && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#f87171", fontWeight: 600 }}>
                  {ar ? "رمز غير صحيح أو السباق لم يبدأ بعد" : "Invalid code or race not started"}
                </p>
              )}
              {/* Target class label intentionally hidden when teacher restricts to a specific class —
                  the student only needs to enter their name; the server enforces the restriction. */}
            </div>

            {/* Name / Student picker */}
            <AnimatePresence mode="wait">
              {gameTargetClass ? (
                <motion.div
                  key="class-picker"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                    <Users size={14} color={CYAN} />
                    {ar ? "اختر اسمك" : "Select your name"}
                    <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)", fontSize: 12 }}>({gameTargetClass})</span>
                  </label>
                  {gameStudents.length > 0 ? (
                    <select
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        fontSize: 16, fontWeight: 700,
                        padding: "12px 16px",
                        borderRadius: 14,
                        border: `2px solid ${name ? "#4ade80" : "rgba(84,216,255,0.35)"}`,
                        outline: "none",
                        background: "rgba(4,8,24,0.55)",
                        color: "#fff",
                        textAlign: "center",
                        cursor: "pointer",
                        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
                      }}
                    >
                      <option value="" style={{ background: "#0d1445" }}>{ar ? "— اختر اسمك —" : "— Select your name —"}</option>
                      {gameStudents.map(s => (
                        <option key={s.name} value={s.name} style={{ background: "#0d1445" }}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.45)", padding: "10px 0" }}>
                      {ar ? "لا توجد أسماء في هذا الصف بعد" : "No students in this class yet"}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div key="free-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                    {ar ? "اسمك" : "Your Name"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canJoin && handleJoin()}
                    placeholder={ar ? "أدخل اسمك..." : "Enter your name..."}
                    maxLength={30}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      fontSize: 16, fontWeight: 700,
                      padding: "12px 16px",
                      borderRadius: 14,
                      border: `2px solid ${name.trim() ? "#4ade80" : "rgba(84,216,255,0.35)"}`,
                      outline: "none",
                      background: "rgba(4,8,24,0.55)",
                      color: "#fff",
                      textAlign: "center",
                      boxShadow: name.trim() ? "0 0 14px rgba(74,222,128,0.25), inset 0 2px 8px rgba(0,0,0,0.4)" : "inset 0 2px 8px rgba(0,0,0,0.4)",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                {ar ? "الأفاتار" : "Avatar"}
              </label>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(v => !v)}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: `2px solid ${avatarPickerOpen ? CYAN : "rgba(84,216,255,0.35)"}`,
                  background: "rgba(4,8,24,0.55)",
                  cursor: "pointer",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                  <span style={{ fontSize: 28 }}>{avatar}</span>
                  <span style={{ fontSize: 13 }}>{ar ? "اختر الأفاتار" : "Choose avatar"}</span>
                </span>
                {avatarPickerOpen ? <ChevronUp size={18} color="rgba(255,255,255,0.6)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.6)" />}
              </button>

              <AnimatePresence>
                {avatarPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginTop: 8 }}
                  >
                    <div style={{
                      background: "rgba(4,8,24,0.55)",
                      border: "1px solid rgba(84,216,255,0.2)",
                      borderRadius: 14, padding: 10,
                      display: "grid",
                      gridTemplateColumns: "repeat(8, 1fr)",
                      gap: 6,
                    }}>
                      {AVATARS.map(a => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => { setAvatar(a); setAvatarPickerOpen(false); }}
                          style={{
                            fontSize: 22,
                            padding: "8px 0",
                            borderRadius: 10,
                            border: avatar === a ? `2px solid ${GOLD}` : "2px solid transparent",
                            background: avatar === a ? `${GOLD}28` : "rgba(255,255,255,0.06)",
                            boxShadow: avatar === a ? `0 0 12px ${GOLD}40` : undefined,
                            cursor: "pointer",
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

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={!canJoin}
              style={{
                position: "relative",
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: canJoin ? "1px solid rgba(255,255,255,0.35)" : "none",
                background: canJoin
                  ? `linear-gradient(135deg, #ffd76e, ${GOLD} 45%, #a87908)`
                  : "rgba(255,255,255,0.10)",
                color: canJoin ? "#221a02" : "rgba(255,255,255,0.4)",
                fontSize: 17,
                fontWeight: 900,
                cursor: canJoin ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                overflow: "hidden",
                boxShadow: canJoin ? `0 12px 30px -8px ${GOLD}aa, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                transition: "all .2s",
              }}
            >
              {canJoin && (
                <span aria-hidden style={{
                  position: "absolute", top: 0, bottom: 0, width: "40%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                  animation: "rrjShine 2.6s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              <Rocket size={20} />
              {ar ? "انطلق!" : "Blast Off!"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            {ar ? "لا تحتاج لحساب — فقط أدخل اسمك وانطلق" : "No account needed — just enter your name"}
          </p>
        </motion.div>
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid rgba(120,160,255,0.14)", background: "rgba(8,12,32,0.5)", backdropFilter: "blur(8px)", position: "relative", zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          {ar ? "منصة حصاد التعليمية" : "Hasaad Educational Platform"}
        </p>
      </div>
    </div>
  );
}
