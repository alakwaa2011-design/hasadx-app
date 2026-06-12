import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, RefreshCw, Play, Users, Lock, LogIn, Shuffle } from "lucide-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "@/components/ui/sonner";
import { io as socketIO } from "socket.io-client";

interface Category {
  id: number;
  nameAr: string;
  icon: string;
  sortOrder: number;
}

const TEAM_COLORS = [
  { hex: "#dc2626", name: "أحمر" },
  { hex: "#2563eb", name: "أزرق" },
  { hex: "#16a34a", name: "أخضر" },
  { hex: "#d97706", name: "ذهبي" },
  { hex: "#7c3aed", name: "بنفسجي" },
  { hex: "#0891b2", name: "تركواز" },
];

export default function SecretSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const { data: teacherData, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const isLoggedIn = authLoading ? null : !!teacherData;

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [teamAName, setTeamAName] = useState("الفريق الأحمر");
  const [teamBName, setTeamBName] = useState("الفريق الأزرق");
  const [teamAColor, setTeamAColor] = useState(TEAM_COLORS[0].hex);
  const [teamBColor, setTeamBColor] = useState(TEAM_COLORS[1].hex);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/secret-game/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCategories(d);
      })
      .catch(() => toast.error("تعذّر تحميل الفئات"))
      .finally(() => setCatLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!selectedCat) { toast.error("اختر فئة أولاً"); return; }
    if (!teamAName.trim() || !teamBName.trim()) { toast.error("اكتب اسم كلا الفريقين"); return; }
    setCreating(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = socketIO({ path: "/api/socket.io", transports: ["websocket", "polling"] });
        socket.on("connect", () => {
          socket.emit("secret:create", {
            categoryId: selectedCat,
            teamAName: teamAName.trim(),
            teamBName: teamBName.trim(),
            teamAColor,
            teamBColor,
            maxQuestions,
          }, (res: { pin?: string; tokenA?: string; tokenB?: string; error?: string }) => {
            if (res.error || !res.pin) {
              reject(new Error(res.error ?? "فشل الإنشاء"));
              socket.disconnect();
              return;
            }
            sessionStorage.setItem("secret_game_pin", res.pin);
            sessionStorage.setItem("secret_game_tokenA", res.tokenA ?? "");
            sessionStorage.setItem("secret_game_tokenB", res.tokenB ?? "");
            socket.disconnect();
            resolve();
          });
        });
        socket.on("connect_error", (err) => {
          reject(err);
          socket.disconnect();
        });
      });
      setLocation("/game/secret/play");
    } catch (err: any) {
      toast.error(err.message ?? "خطأ في الإنشاء");
    } finally {
      setCreating(false);
    }
  };

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div dir="rtl" className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6"
          style={{ background: "linear-gradient(180deg,#1E4D35 0%,#0F2A20 45%,#0A1F18 100%)" }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl p-8 border-4 text-center backdrop-blur-sm"
            style={{ background: "linear-gradient(160deg,rgba(6,78,59,.95),rgba(2,44,34,.95))", borderColor: "rgba(245,158,11,.55)" }}>
            <Lock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-amber-200 mb-3">تسجيل الدخول مطلوب</h1>
            <div className="flex gap-3 justify-center mt-6">
              <Link href="/login">
                <button className="px-6 py-3 rounded-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 inline-flex items-center gap-2">
                  <LogIn className="w-4 h-4" />تسجيل الدخول
                </button>
              </Link>
              <Link href="/games">
                <button className="px-5 py-3 rounded-xl font-bold bg-white/10 text-white border border-white/20">العودة</button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100vh-4rem)] p-4 sm:p-6"
        style={{ background: "linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/games">
              <button className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <Eye className="w-7 h-7 text-purple-400" />
                اكشف السر
              </h1>
              <p className="text-white/50 text-sm">لعبة التخمين بالأسئلة</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Team Names */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                أسماء الفريقين وألوانهما
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: teamAName, setName: setTeamAName, color: teamAColor, setColor: setTeamAColor, label: "الفريق أ" },
                  { name: teamBName, setName: setTeamBName, color: teamBColor, setColor: setTeamBColor, label: "الفريق ب" },
                ].map((team, idx) => (
                  <div key={idx}>
                    <label className="text-white/60 text-xs mb-1 block">{team.label}</label>
                    <input
                      value={team.name}
                      onChange={(e) => team.setName(e.target.value)}
                      maxLength={20}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 mb-2"
                      placeholder={`اسم ${team.label}`}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {TEAM_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => team.setColor(c.hex)}
                          className="w-7 h-7 rounded-full border-2 transition-all"
                          style={{ background: c.hex, borderColor: team.color === c.hex ? "white" : "transparent", transform: team.color === c.hex ? "scale(1.2)" : "scale(1)" }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Category Selection */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-white font-bold mb-4">اختر الفئة</h2>
              {catLoading ? (
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 w-24 bg-white/10 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCat(cat.id)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border text-right"
                      style={{
                        background: selectedCat === cat.id ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)",
                        borderColor: selectedCat === cat.id ? "#8b5cf6" : "rgba(255,255,255,0.1)",
                        color: selectedCat === cat.id ? "#c4b5fd" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span>{cat.nameAr}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Questions Limit */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-white font-bold mb-3">الحد الأقصى للأسئلة</h2>
              <div className="flex gap-2">
                {[6, 8, 10, 12, 15].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxQuestions(n)}
                    className="flex-1 py-2 rounded-xl text-sm font-black border transition-all"
                    style={{
                      background: maxQuestions === n ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.05)",
                      borderColor: maxQuestions === n ? "#8b5cf6" : "rgba(255,255,255,0.15)",
                      color: maxQuestions === n ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              disabled={creating || !selectedCat}
              className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" }}
            >
              {creating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {creating ? "جارٍ الإنشاء..." : "إنشاء اللعبة"}
            </motion.button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
