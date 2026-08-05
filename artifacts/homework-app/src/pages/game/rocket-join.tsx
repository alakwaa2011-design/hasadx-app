import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX, ChevronDown, ChevronUp, Rocket, Users } from "lucide-react";
import { NORMAL_AVATARS as AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";

const API_BASE = import.meta.env.VITE_API_URL || "";

const GREEN = "#225739";
const GOLD = "#D9A521";
const CREAM = "#FCFAF8";

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

  const pinBorderColor = pinValid === true ? GREEN : pinValid === false ? "#dc2626" : "#d1d5db";
  const canJoin = pinValid && name.trim().length > 0;

  return (
    <div
      dir={dir}
      style={{ minHeight: "100dvh", background: CREAM, display: "flex", flexDirection: "column" }}
    >
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: GREEN, letterSpacing: "-0.3px" }}>
          حصاد
        </span>
        <button
          onClick={toggleMute}
          title={muted ? (ar ? "تشغيل الصوت" : "Unmute") : (ar ? "كتم الصوت" : "Mute")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1.5px solid ${muted ? "#d1d5db" : GREEN}`,
            background: muted ? "#f9fafb" : `${GREEN}12`,
            color: muted ? "#6b7280" : GREEN,
            fontWeight: 600, fontSize: 13,
            cursor: "pointer",
          }}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          {muted ? (ar ? "الصوت مكتوم" : "Muted") : (ar ? "الصوت يعمل" : "Sound On")}
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: "easeOut" }}
          style={{ width: "100%", maxWidth: 420 }}
        >
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <motion.div
              animate={{ y: [-3, 3, -3] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 80, height: 80, borderRadius: 24,
                background: `linear-gradient(135deg, ${GREEN}, #2d6a45)`,
                marginBottom: 14,
                boxShadow: `0 12px 32px -8px ${GREEN}66`,
              }}
            >
              <Rocket size={38} color="#fff" />
            </motion.div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: GREEN, lineHeight: 1.2 }}>
              {ar ? "انضم لسباق الصواريخ" : "Join the Rocket Race"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7280" }}>
              {ar ? "أدخل رمز الغرفة وانطلق نحو الفضاء!" : "Enter the room code and blast off!"}
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: "#fff",
            borderRadius: 20,
            border: "1.5px solid #e5e7eb",
            padding: "28px 24px",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {/* PIN */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
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
                    border: `2.5px solid ${pinBorderColor}`,
                    outline: "none",
                    background: "#fafafa",
                    color: "#111827",
                  }}
                />
                {pinValid !== null && (
                  <span style={{
                    position: "absolute", top: "50%",
                    [ar ? "left" : "right"]: 14, transform: "translateY(-50%)",
                    fontSize: 18, color: pinValid ? GREEN : "#dc2626",
                  }}>
                    {pinValid ? "✓" : "✗"}
                  </span>
                )}
              </div>
              {pinValid === false && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
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
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    <Users size={14} color={GREEN} />
                    {ar ? "اختر اسمك" : "Select your name"}
                    <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>({gameTargetClass})</span>
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
                        border: `2px solid ${name ? GREEN : "#d1d5db"}`,
                        outline: "none",
                        background: "#fafafa",
                        color: "#111827",
                        textAlign: "center",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">{ar ? "— اختر اسمك —" : "— Select your name —"}</option>
                      {gameStudents.map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ textAlign: "center", fontSize: 13, color: "#9ca3af", padding: "10px 0" }}>
                      {ar ? "لا توجد أسماء في هذا الصف بعد" : "No students in this class yet"}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div key="free-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
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
                      border: `2px solid ${name.trim() ? GREEN : "#d1d5db"}`,
                      outline: "none",
                      background: "#fafafa",
                      color: "#111827",
                      textAlign: "center",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
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
                  border: `2px solid ${avatarPickerOpen ? GREEN : "#d1d5db"}`,
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: "#374151" }}>
                  <span style={{ fontSize: 28 }}>{avatar}</span>
                  <span style={{ fontSize: 13 }}>{ar ? "اختر الأفاتار" : "Choose avatar"}</span>
                </span>
                {avatarPickerOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
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
                      background: "#f9fafb", borderRadius: 14, padding: 10,
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
                            border: avatar === a ? `2px solid ${GREEN}` : "2px solid transparent",
                            background: avatar === a ? `${GREEN}18` : "#fff",
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
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "none",
                background: canJoin
                  ? `linear-gradient(135deg, ${GOLD}, #c89212)`
                  : "#e5e7eb",
                color: canJoin ? "#fff" : "#9ca3af",
                fontSize: 17,
                fontWeight: 900,
                cursor: canJoin ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: canJoin ? `0 10px 24px -8px ${GOLD}80` : "none",
                transition: "all .2s",
              }}
            >
              <Rocket size={20} />
              {ar ? "انطلق!" : "Blast Off!"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
            {ar ? "لا تحتاج لحساب — فقط أدخل اسمك وانطلق" : "No account needed — just enter your name"}
          </p>
        </motion.div>
      </div>

      <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #e5e7eb", background: "#fff" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
          {ar ? "منصة حصاد التعليمية" : "Hasaad Educational Platform"}
        </p>
      </div>
    </div>
  );
}
