import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Users, Volume2, VolumeX, ChevronDown, ChevronUp } from "lucide-react";
import { NORMAL_AVATARS as AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";
import { AvatarDisplay } from "@/components/avatar-display";

const API_BASE = import.meta.env.VITE_API_URL || "";

const GREEN  = "#225739";
const GOLD   = "#D9A521";
const CREAM  = "#FCFAF8";

interface GameStudent { id: number; name: string; }

function useMuteState() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("tug-music-muted") === "1"; } catch (_) { return false; }
  });
  const toggle = () => setMuted(prev => {
    const next = !prev;
    try { localStorage.setItem("tug-music-muted", next ? "1" : "0"); } catch (_) {}
    return next;
  });
  return { muted, toggle };
}

export default function TugJoin() {
  const params   = useParams<{ pin?: string }>();
  const searchStr = useSearch();
  const sp       = new URLSearchParams(searchStr);
  const queryPin    = sp.get("pin")    || "";
  const queryName   = sp.get("name")   || "";
  const queryAvatar = sp.get("avatar") || "";

  const [pin, setPin]   = useState(params.pin || queryPin || "");
  const [name, setName] = useState(queryName);
  const [avatar, setAvatar]               = useState(queryAvatar || DEFAULT_AVATAR);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar  = lang === "ar";

  const [gameTargetClass, setGameTargetClass] = useState<string | null>(null);
  const [gameStudents, setGameStudents]       = useState<GameStudent[]>([]);
  const [checkedPin, setCheckedPin]           = useState("");
  const [pinValid, setPinValid]               = useState<boolean | null>(null);

  const { muted, toggle: toggleMute } = useMuteState();

  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length === 6 && trimmed !== checkedPin) {
      setCheckedPin(trimmed);
      fetch(`${API_BASE}/api/tug-game-info/${trimmed}`)
        .then(r => r.json())
        .then(data => {
          if (data.exists) {
            if (data.targetClass) {
              setGameTargetClass(data.targetClass);
              setGameStudents(data.students || []);
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
        .catch(() => { setGameTargetClass(null); setGameStudents([]); setPinValid(false); });
    }
    if (trimmed.length < 6) {
      setCheckedPin("");
      setGameTargetClass(null);
      setGameStudents([]);
      setPinValid(null);
    }
  }, [pin]);

  const handleJoin = () => {
    const trimPin  = pin.trim();
    const trimName = name.trim();
    if (!trimPin || !trimName) return;
    setLocation(
      `/game/tug/play/${trimPin}?name=${encodeURIComponent(trimName)}&avatar=${encodeURIComponent(avatar)}`
    );
  };

  const pinBorderColor = pinValid === true ? GREEN : pinValid === false ? "#dc2626" : "#d1d5db";

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
        {/* Platform name */}
        <span style={{ fontWeight: 700, fontSize: 15, color: GREEN, letterSpacing: "-0.3px" }}>
          حصاد
        </span>

        {/* Mute toggle */}
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
            transition: "all .18s",
          }}
        >
          {muted
            ? <VolumeX size={15} />
            : <Volume2 size={15} />}
          {muted ? (ar ? "الصوت مكتوم" : "Muted") : (ar ? "الصوت يعمل" : "Sound On")}
        </button>
      </div>

      {/* Main content */}
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
              animate={{ rotate: [-4, 4, -4] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 72, height: 72, borderRadius: 22,
                background: GREEN, marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 32 }}>🪢</span>
            </motion.div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: GREEN, lineHeight: 1.2 }}>
              {ar ? "انضم لشد الحبل" : "Join Tug of War"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7280" }}>
              {ar ? "أدخل رمز الغرفة واختر اسمك" : "Enter the room code and pick your name"}
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
                    transition: "border-color .2s",
                  }}
                />
                {pinValid !== null && (
                  <span style={{
                    position: "absolute",
                    top: "50%", [ar ? "left" : "right"]: 14,
                    transform: "translateY(-50%)",
                    fontSize: 18,
                  }}>
                    {pinValid ? "✓" : "✗"}
                  </span>
                )}
              </div>
              {pinValid === false && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                  {ar ? "لا توجد غرفة بهذا الرمز" : "No room found with this code"}
                </p>
              )}
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
                        transition: "border-color .2s",
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
                    {ar ? "اسمك" : "Your name"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    placeholder={ar ? "أدخل اسمك..." : "Enter your name..."}
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
                      transition: "border-color .2s",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar picker */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                {ar ? "الأفاتار" : "Avatar"}
              </label>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: `2px solid ${avatarPickerOpen ? GREEN : "#d1d5db"}`,
                  background: "#fafafa",
                  cursor: "pointer",
                  transition: "border-color .2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AvatarDisplay avatar={avatar} size="2xl" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {avatarPickerOpen
                      ? (ar ? "إخفاء" : "Hide")
                      : (ar ? "تغيير الصورة" : "Change avatar")}
                  </span>
                </div>
                {avatarPickerOpen ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
              </button>

              <AnimatePresence>
                {avatarPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(8, 1fr)",
                      gap: 6,
                      marginTop: 10,
                      overflow: "hidden",
                    }}
                  >
                    {AVATARS.map(a => (
                      <button
                        key={a}
                        onClick={() => { setAvatar(a); setAvatarPickerOpen(false); }}
                        style={{
                          padding: 6,
                          borderRadius: 10,
                          border: `2px solid ${a === avatar ? GREEN : "transparent"}`,
                          background: a === avatar ? `${GREEN}12` : "transparent",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transform: a === avatar ? "scale(1.1)" : "scale(1)",
                          transition: "all .15s",
                        }}
                      >
                        <AvatarDisplay avatar={a} size="2xl" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#f3f4f6", margin: "0 -4px" }} />

            {/* Join button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleJoin}
              disabled={!pin || !name}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 14,
                background: (!pin || !name) ? "#d1d5db" : GREEN,
                color: (!pin || !name) ? "#9ca3af" : "#fff",
                fontWeight: 900,
                fontSize: 17,
                border: "none",
                cursor: (!pin || !name) ? "not-allowed" : "pointer",
                transition: "background .2s",
                letterSpacing: "-0.2px",
              }}
            >
              {ar ? "انضم الآن 🪢" : "Join Now 🪢"}
            </motion.button>

            {/* Sound hint */}
            <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
              {ar
                ? (muted ? "الصوت مكتوم — يمكنك تشغيله من الأعلى" : "سيعمل الصوت بمجرد دخولك اللعبة")
                : (muted ? "Sound is muted — toggle above" : "Sound plays when you enter the game")}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
