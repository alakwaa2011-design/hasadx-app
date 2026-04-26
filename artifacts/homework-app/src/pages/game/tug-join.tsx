import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Users } from "lucide-react";
import { NORMAL_AVATARS as AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";
import { AvatarDisplay } from "@/components/avatar-display";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface GameStudent {
  id: number;
  name: string;
}

export default function TugJoin() {
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

  const [gameTargetClass, setGameTargetClass] = useState<string | null>(null);
  const [gameStudents, setGameStudents] = useState<GameStudent[]>([]);
  const [checkedPin, setCheckedPin] = useState("");

  useEffect(() => {
    const trimmed = pin.trim();
    if (trimmed.length === 6 && trimmed !== checkedPin) {
      setCheckedPin(trimmed);
      fetch(`${API_BASE}/api/tug-game-info/${trimmed}`)
        .then(r => r.json())
        .then(data => {
          if (data.exists && data.targetClass) {
            setGameTargetClass(data.targetClass);
            setGameStudents(data.students || []);
            setName("");
          } else {
            setGameTargetClass(null);
            setGameStudents([]);
          }
        })
        .catch(() => {
          setGameTargetClass(null);
          setGameStudents([]);
        });
    }
    if (trimmed.length < 6) {
      setCheckedPin("");
      setGameTargetClass(null);
      setGameStudents([]);
    }
  }, [pin]);

  const handleJoin = () => {
    const trimPin = pin.trim();
    const trimName = name.trim();
    if (!trimPin || !trimName) return;
    setLocation(
      `/game/tug/play/${trimPin}?name=${encodeURIComponent(trimName)}&avatar=${encodeURIComponent(avatar)}`
    );
  };

  return (
    <Layout>
      <div
        className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20"
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/40 mb-4"
            >
              <span className="text-4xl">🪢</span>
            </motion.div>
            <h1 className="text-3xl font-black text-foreground mb-1">
              {lang === "ar" ? "انضم لشد الحبل!" : "Join Tug of War!"}
            </h1>
            <p className="text-muted-foreground">
              {lang === "ar" ? "أدخل رمز الغرفة واختر اسمك" : "Enter the room code and pick your name"}
            </p>
          </div>

          <Card className="p-6 space-y-5 border-2 border-indigo-200 dark:border-indigo-800/50 shadow-xl">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                {lang === "ar" ? "رمز الغرفة" : "Room Code"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                dir="ltr"
                className="w-full text-center text-4xl font-black tracking-[0.5em] py-4 px-4 rounded-xl bg-background border-2 border-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {gameTargetClass ? (
              <div>
                <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  {lang === "ar" ? "اختر اسمك من القائمة" : "Select your name"}
                  <span className="text-xs font-normal text-muted-foreground">({gameTargetClass})</span>
                </label>
                {gameStudents.length > 0 ? (
                  <select
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full text-lg font-bold py-3 px-4 rounded-xl bg-background border-2 border-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-center"
                  >
                    <option value="">{lang === "ar" ? "— اختر اسمك —" : "— Select your name —"}</option>
                    {gameStudents.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {lang === "ar" ? "لا توجد أسماء في هذا الصف بعد" : "No students in this class yet"}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  {lang === "ar" ? "اسمك" : "Your name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                  className="w-full text-lg font-bold py-3 px-4 rounded-xl bg-background border-2 border-border focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-center"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                {lang === "ar" ? "اختر أفاتار" : "Choose avatar"}
              </label>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-background border-2 border-border hover:border-indigo-400 transition-all"
              >
                <span className="flex items-center gap-2">
                  <AvatarDisplay avatar={avatar} size="2xl" />
                  <span className="text-xs font-bold text-foreground">
                    {lang === "ar" ? (avatarPickerOpen ? "إخفاء القائمة" : "اختر صورة أخرى") : (avatarPickerOpen ? "Hide list" : "Choose another")}
                  </span>
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {avatarPickerOpen ? "▲" : "▼"}
                </span>
              </button>
              {avatarPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-8 gap-1.5 mt-2 overflow-hidden"
                >
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => { setAvatar(a); setAvatarPickerOpen(false); }}
                      className={`p-1.5 rounded-lg transition-all hover:scale-110 flex items-center justify-center ${
                        avatar === a
                          ? "bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500 scale-110"
                          : "hover:bg-muted"
                      }`}
                    >
                      <AvatarDisplay avatar={a} size="2xl" />
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleJoin}
              disabled={!pin || !name}
              className="w-full py-3.5 rounded-xl font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lang === "ar" ? "انضم الآن! 🪢" : "Join Now! 🪢"}
            </motion.button>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
