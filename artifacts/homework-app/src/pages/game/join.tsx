import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { StudentLoginLayout } from "@/components/layout";
import { motion } from "framer-motion";
import { Terminal, ShieldAlert, CheckCircle, Users, GraduationCap, Gamepad2, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { NORMAL_AVATARS, HACK_ICONS, DEFAULT_AVATAR } from "@/lib/avatars";
import { AvatarDisplay } from "@/components/avatar-display";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface StudentAccount {
  id: number;
  displayName: string;
  avatar: string | null;
}

export default function GameJoin() {
  const params = useParams<{ pin?: string }>();
  const [pin, setPin] = useState(params.pin || "");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();

  const [hackMode, setHackMode] = useState(false);
  const [gameStudents, setGameStudents] = useState<{ id: number; name: string; gradeLevel?: string }[]>([]);
  const [gameTargetClass, setGameTargetClass] = useState<string | null>(null);
  const [gameTargetClasses, setGameTargetClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [checkedPin, setCheckedPin] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(null);
  const [typedChars, setTypedChars] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setStudentAccount({ id: data.id, displayName: data.displayName, avatar: data.avatar });
          setName(data.displayName);
          if (data.avatar) setAvatar(data.avatar);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hackMode) return;
    const iv = setInterval(() => {
      setTypedChars(prev => {
        const next = [...prev, "01XH!#$@NTV394".charAt(Math.floor(Math.random() * 14))];
        return next.slice(-20);
      });
    }, 120);
    return () => clearInterval(iv);
  }, [hackMode]);

  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length < 6) {
      setHackMode(false);
      setCheckedPin("");
      return;
    }
    if (trimmed.length === 6 && trimmed !== checkedPin) {
      setCheckedPin(trimmed);
      fetch(`${API_BASE}/api/game-info/${trimmed}`)
        .then(r => r.json())
        .then(data => {
          const isHack = !!data.hackMode;
          setHackMode(isHack);
          if (isHack) {
            setAvatar("01");
          } else {
            setAvatar(DEFAULT_AVATAR);
          }
          const classes: string[] = Array.isArray(data.targetClasses) && data.targetClasses.length > 0
            ? data.targetClasses
            : (data.targetClass ? [data.targetClass] : []);
          if (data.exists && classes.length > 0 && data.students?.length > 0) {
            setGameTargetClass(data.targetClass || classes[0]);
            setGameTargetClasses(classes);
            setGameStudents(data.students);
            if (classes.length === 1) setSelectedClass(classes[0]);
            else setSelectedClass("");
          } else {
            setGameTargetClass(null);
            setGameTargetClasses([]);
            setGameStudents([]);
            setSelectedClass("");
          }
        })
        .catch(() => {
          setHackMode(false);
          setAvatar(DEFAULT_AVATAR);
          setGameTargetClass(null);
          setGameTargetClasses([]);
          setGameStudents([]);
          setSelectedClass("");
        });
    }
  }, [pin]);

  const handleJoin = () => {
    const trimmedPin = pin.trim();
    const trimmedName = name.trim();
    if (!trimmedPin || !trimmedName) return;
    const selectedAvatar = avatar || (hackMode ? ">>>" : DEFAULT_AVATAR);
    const sidParam = selectedStudentId ? `&studentId=${selectedStudentId}` : "";
    const accountParam = studentAccount ? `&studentAccountId=${studentAccount.id}` : "";
    setLocation(`/game/play/${trimmedPin}?name=${encodeURIComponent(trimmedName)}&avatar=${encodeURIComponent(selectedAvatar)}${sidParam}${accountParam}`);
  };

  if (hackMode) {
    return (
      <StudentLoginLayout>
        <div className="min-h-screen flex items-center justify-center py-10 px-4 bg-black">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-6">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-flex items-center gap-2 mb-3"
              >
                <Terminal className="w-8 h-8 text-green-400" />
                <span className="text-green-400 font-mono font-black text-2xl tracking-widest">[H4CK_Z0N3]</span>
              </motion.div>
              <p className="text-green-700 font-mono text-sm">
                {">"} {lang === "ar" ? "سجّل دخولك للنظام" : "AUTHENTICATE_TO_SYSTEM"}
              </p>
              <div className="font-mono text-green-900 text-xs mt-1 h-4 overflow-hidden">
                {typedChars.join("")}
              </div>
            </div>

            <div className="bg-black border border-green-800 rounded-xl p-5 space-y-4 font-mono shadow-xl shadow-green-900/20">
              {studentAccount && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green-950/50 border border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-400 font-bold">AGENT: {studentAccount.displayName}</p>
                    <p className="text-xs text-green-700">
                      {lang === "ar" ? "ستُسجَّل نتائجك تلقائياً" : "RESULTS_WILL_BE_LOGGED"}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-green-600 mb-1.5">
                  {">"} {lang === "ar" ? "رمز الدخول (6 أرقام)" : "ACCESS_CODE"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  dir="ltr"
                  className="w-full text-center text-4xl font-black tracking-[0.5em] py-4 px-4 rounded-lg bg-black border-2 border-green-800 focus:border-green-400 focus:ring-2 focus:ring-green-500/30 outline-none transition-all text-green-300 placeholder:text-green-900"
                />
              </div>

              {gameStudents.length > 0 ? (
                <div className="space-y-2">
                  {gameTargetClasses.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-green-600 flex items-center gap-2">
                        <GraduationCap className="w-3.5 h-3.5 text-green-500" />
                        {lang === "ar" ? "اختر صفك" : "SELECT_CLASS"}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {gameTargetClasses.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { setSelectedClass(c); setSelectedStudentId(null); setName(""); }}
                            className={`py-2 px-2 rounded-lg border-2 text-xs font-bold transition-all ${
                              selectedClass === c
                                ? "bg-green-500/20 border-green-400 text-green-200"
                                : "bg-black border-green-900 text-green-700 hover:border-green-600"
                            }`}
                          >{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedClass && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-green-600 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-green-500" />
                        {lang === "ar" ? "اختر هويتك" : "SELECT_IDENTITY"}
                      </label>
                      <select
                        value={selectedStudentId ?? ""}
                        onChange={e => {
                          const id = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedStudentId(id);
                          const found = gameStudents.find(s => s.id === id);
                          setName(found ? found.name : "");
                        }}
                        className="w-full rounded-lg border-2 border-green-900 bg-black px-3 py-2.5 text-sm font-bold focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all text-center text-green-300"
                      >
                        <option value="">{lang === "ar" ? "— اختر اسمك —" : "— SELECT_AGENT —"}</option>
                        {gameStudents.filter(s => !s.gradeLevel || s.gradeLevel === selectedClass).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <GraduationCap className="w-3 h-3" />
                        {selectedClass}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-green-600 mb-1.5">{">"} {lang === "ar" ? "اسمك / AGENT_ID" : "AGENT_ID"}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === "ar" ? "أدخل اسمك..." : "enter_name..."}
                    className="w-full text-base font-bold py-3 px-4 rounded-lg bg-black border-2 border-green-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all text-center text-green-200 placeholder:text-green-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-green-600 mb-2">{">"} {lang === "ar" ? "رمز الهوية (اختياري)" : "AVATAR_TOKEN (optional)"}</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {HACK_ICONS.map((a) => (
                    <motion.button
                      key={a}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setAvatar(a)}
                      className={`text-xs py-2 rounded-lg transition-all font-mono font-black ${
                        avatar === a
                          ? "bg-green-500/20 border-2 border-green-400 text-green-300 scale-110"
                          : "bg-green-950/20 border border-green-900 text-green-700 hover:border-green-700"
                      }`}
                    >
                      {a}
                    </motion.button>
                  ))}
                </div>
              </div>

              <motion.button
                onClick={handleJoin}
                disabled={!pin.trim() || !name.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 text-base font-black bg-green-900/60 hover:bg-green-800/80 border-2 border-green-500 text-green-200 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-5 h-5" />
                {lang === "ar" ? "دخول النظام" : "ENTER_SYSTEM"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </StudentLoginLayout>
    );
  }

  return (
    <StudentLoginLayout>
      <div
        className="min-h-screen flex items-center justify-center py-10 px-4"
        style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 60%, #0A2010 100%)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-5">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
              style={{
                background: "rgba(232,184,75,0.15)",
                border: "2px solid rgba(232,184,75,0.35)",
                boxShadow: "0 0 32px rgba(232,184,75,0.25)",
              }}
            >
              <Gamepad2 className="w-8 h-8" style={{ color: "#E8B84B" }} />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-1">
              {lang === "ar" ? "انضم للعبة" : "Join Game"}
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              {lang === "ar" ? "أدخل الرمز واللعب يبدأ!" : "Enter the code and play!"}
            </p>
          </div>

          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "white",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
          >
            {studentAccount && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: "#F0F4F1", border: "1px solid #E2E8E3" }}
              >
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#1A3A28" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "#1A3A28" }}>{studentAccount.displayName}</p>
                  <p className="text-xs" style={{ color: "#7A9A7C" }}>
                    {lang === "ar" ? "ستُسجَّل نتائجك تلقائياً" : "Results will be recorded"}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "#7A9A7C" }}>
                {lang === "ar" ? "رمز اللعبة (6 أرقام)" : "Game Code (6 digits)"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                dir="ltr"
                className="w-full text-center text-4xl font-black tracking-[0.5em] py-4 px-4 rounded-xl outline-none transition-all"
                style={{
                  background: "#F0F4F1",
                  border: "1.5px solid #E2E8E3",
                  color: "#1A3A28",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C9960C";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,150,12,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8E3";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {gameStudents.length > 0 ? (
              <div className="space-y-2">
                {gameTargetClasses.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold flex items-center gap-2" style={{ color: "#7A9A7C" }}>
                      <GraduationCap className="w-3.5 h-3.5" />
                      {lang === "ar" ? "اختر صفك" : "Select your class"}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {gameTargetClasses.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setSelectedClass(c); setSelectedStudentId(null); setName(""); }}
                          className="py-2 px-2 rounded-xl text-xs font-bold transition-all"
                          style={
                            selectedClass === c
                              ? { background: "#1A3A28", color: "white", border: "2px solid #1A3A28", boxShadow: "0 2px 8px rgba(26,58,40,0.3)" }
                              : { background: "#F0F4F1", color: "#1A3A28", border: "2px solid #E2E8E3" }
                          }
                        >{c}</button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedClass && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold flex items-center gap-2" style={{ color: "#7A9A7C" }}>
                      <Users className="w-3.5 h-3.5" />
                      {lang === "ar" ? "اختر اسمك" : "Select your name"}
                    </label>
                    <select
                      value={selectedStudentId ?? ""}
                      onChange={e => {
                        const id = e.target.value ? parseInt(e.target.value) : null;
                        setSelectedStudentId(id);
                        const found = gameStudents.find(s => s.id === id);
                        setName(found ? found.name : "");
                      }}
                      className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-all text-center"
                      style={{
                        background: "#F0F4F1",
                        border: "1.5px solid #E2E8E3",
                        color: "#1A3A28",
                      }}
                    >
                      <option value="">{lang === "ar" ? "— اختر اسمك —" : "— Select your name —"}</option>
                      {gameStudents.filter(s => !s.gradeLevel || s.gradeLevel === selectedClass).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#7A9A7C" }}>
                      <GraduationCap className="w-3 h-3" />
                      {selectedClass}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "#7A9A7C" }}>
                  {lang === "ar" ? "اسمك" : "Your name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === "ar" ? "أدخل اسمك هنا..." : "Enter your name here..."}
                  className="w-full text-base font-bold py-3 px-4 rounded-xl outline-none transition-all text-center"
                  style={{
                    background: "#F0F4F1",
                    border: "1.5px solid #E2E8E3",
                    color: "#1A3A28",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#C9960C";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,150,12,0.15)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#E2E8E3";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: "#7A9A7C" }}>
                {lang === "ar" ? "الرمز التعبيري (اختياري)" : "Avatar (optional)"}
              </label>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl transition-all"
                style={{ background: "#F0F4F1", border: "2px solid #E2E8E3", color: "#1A3A28" }}
              >
                <span className="flex items-center gap-2">
                  <AvatarDisplay avatar={avatar} size="2xl" />
                  <span className="text-xs font-bold">
                    {lang === "ar" ? (avatarPickerOpen ? "إخفاء القائمة" : "اختر صورة أخرى") : (avatarPickerOpen ? "Hide list" : "Choose another")}
                  </span>
                </span>
                <span className="text-xs font-bold" style={{ color: "#7A9A7C" }}>
                  {avatarPickerOpen ? "▲" : "▼"}
                </span>
              </button>
              {avatarPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-8 gap-1.5 mt-2 overflow-hidden"
                >
                  {NORMAL_AVATARS.map((a) => (
                    <motion.button
                      key={a}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => { setAvatar(a); setAvatarPickerOpen(false); }}
                      className="py-1.5 rounded-xl transition-all flex items-center justify-center"
                      style={
                        avatar === a
                          ? { background: "rgba(201,150,12,0.15)", border: "2px solid #C9960C", boxShadow: "0 0 0 3px rgba(201,150,12,0.2)", transform: "scale(1.1)" }
                          : { background: "#F0F4F1", border: "2px solid #E2E8E3" }
                      }
                    >
                      <AvatarDisplay avatar={a} size="2xl" />
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>

            <motion.button
              onClick={handleJoin}
              disabled={!pin.trim() || !name.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 text-base font-black text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #1A3A28, #2D6A44)",
                boxShadow: "0 4px 20px rgba(26,58,40,0.4)",
              }}
            >
              {lang === "ar" ? "انضم الآن" : "Join Now"}
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </StudentLoginLayout>
  );
}
