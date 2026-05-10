import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListAssignments, useGetCurrentTeacher } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Terminal, ShieldAlert, Lock, ArrowLeft, ArrowRight, Search, Loader2, BookText, AlertTriangle, Database, FolderOpen, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import {
  ClassSelector,
  getRememberedTargetClass,
} from "@/components/teacher/class-selector";

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  targetClass?: string | null;
  subject?: string | null;
}

// Subject labels — sent verbatim as `bankSubject` to the server, which maps
// each label to a bank category enum value.
const BANK_SUBJECTS: { value: string; ar: string; en: string }[] = [
  { value: "all", ar: "كل المواد", en: "All subjects" },
  { value: "إسلاميات", ar: "ثقافة دينية", en: "Religion" },
  { value: "علوم", ar: "علوم", en: "Science" },
  { value: "رياضيات", ar: "رياضيات", en: "Math" },
  { value: "لغة عربية", ar: "لغة عربية", en: "Arabic" },
  { value: "أدب", ar: "أدب", en: "Literature" },
  { value: "جغرافيا", ar: "جغرافيا", en: "Geography" },
  { value: "تاريخ", ar: "تاريخ", en: "History" },
  { value: "ثقافة عامة", ar: "ثقافة عامة", en: "Culture" },
  { value: "تقنية", ar: "تقنية", en: "Technology" },
  { value: "رياضة", ar: "رياضة", en: "Sports" },
  { value: "فن", ar: "فن", en: "Art" },
  { value: "فضاء", ar: "فضاء", en: "Space" },
  { value: "حيوانات", ar: "حيوانات", en: "Animals" },
  { value: "طعام", ar: "طعام", en: "Food" },
  { value: "طب", ar: "طب", en: "Medicine" },
  { value: "اختراعات", ar: "اختراعات", en: "Inventions" },
  { value: "دول", ar: "دول", en: "Countries" },
];

const BANK_LEVELS: { value: string; ar: string; en: string }[] = [
  { value: "all", ar: "كل المستويات", en: "All levels" },
  { value: "easy", ar: "سهل", en: "Easy" },
  { value: "medium", ar: "متوسط", en: "Medium" },
  { value: "hard", ar: "صعب", en: "Hard" },
];

type Source = "assignments" | "bank";

export default function HackSetup() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const { data: user } = useGetCurrentTeacher();
  const { data: assignments, isLoading } = useListAssignments(
    user ? { teacherId: user.id } : undefined,
    { query: { enabled: !!user } as any }
  );

  const [source, setSource] = useState<Source>("assignments");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [bankSubject, setBankSubject] = useState<string>("إسلاميات");
  const [bankLevel, setBankLevel] = useState<string>("all");
  const [bankCount, setBankCount] = useState<number>(20);
  const [targetClass, setTargetClass] = useState<string>(() =>
    getRememberedTargetClass(),
  );

  const filtered = (assignments || []).filter((a: Assignment) => {
    if (!search) return true;
    return a.title.toLowerCase().includes(search.toLowerCase());
  });

  const startFromAssignment = (assignmentId: number) => {
    if (creating) return;
    setCreating(true);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId, hackMode: true, gameMode: "solo", targetClass: targetClass || undefined },
      (res: { pin?: string; error?: string }) => {
        setCreating(false);
        if (res.error) {
          toast.error(res.error);
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      }
    );
  };

  const startFromBank = () => {
    if (creating) return;
    setCreating(true);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      {
        assignmentId: 0,
        hackMode: true,
        gameMode: "solo",
        bankSubject,
        bankLevel,
        bankQuestionCount: bankCount,
        targetClass: targetClass || undefined,
      },
      (res: { pin?: string; error?: string }) => {
        setCreating(false);
        if (res.error) {
          toast.error(res.error);
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      }
    );
  };

  if (!user) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center bg-black" dir={dir}>
          <div className="text-center font-mono">
            <Lock className="w-12 h-12 mx-auto text-green-400 mb-3" />
            <p className="text-green-400 font-bold mb-2">
              {lang === "ar" ? "الدخول للنظام يتطلب تسجيل دخول" : "AUTHENTICATION_REQUIRED"}
            </p>
            <Link href="/login" className="text-green-300 underline text-sm">
              {lang === "ar" ? "سجّل الدخول" : "Login"}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-black text-green-200" dir={dir}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-6 sm:py-10">
          <div className="mb-6">
            <Link href="/games">
              <button className="inline-flex items-center gap-2 text-xs font-mono font-bold text-green-700 hover:text-green-400 transition-colors">
                <BackIcon className="w-4 h-4" />
                {lang === "ar" ? "كل الألعاب" : "ALL_GAMES"}
              </button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
            {/* Left: brand block */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              <div className="flex flex-col items-center lg:items-start text-center lg:text-start">
                <motion.div
                  animate={{ boxShadow: ["0 0 24px rgba(34,197,94,0.25)", "0 0 60px rgba(34,197,94,0.55)", "0 0 24px rgba(34,197,94,0.25)"] }}
                  transition={{ repeat: Infinity, duration: 2.6 }}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-black border-2 border-green-500 flex items-center justify-center overflow-hidden"
                >
                  <Terminal className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" strokeWidth={2.4} />
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-0.5 bg-green-400/80"
                    animate={{ y: [0, 96, 0] }}
                    transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
                  />
                </motion.div>

                <div className="mt-4 inline-flex items-center gap-2">
                  <span className="text-green-700 font-mono text-[10px]">[</span>
                  <span className="text-green-400 font-mono text-[10px] tracking-[0.4em] font-bold">SYSTEM_ONLINE</span>
                  <span className="text-green-700 font-mono text-[10px]">]</span>
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-green-400 font-mono text-[10px]"
                  >
                    ▮
                  </motion.span>
                </div>

                <h1 className="mt-3 text-4xl sm:text-5xl font-black text-green-300 font-mono tracking-wider">
                  {lang === "ar" ? "لعبة الاختراق" : "H4CK_GAME"}
                </h1>
                <p className="mt-2 text-green-700 font-mono text-sm">
                  {lang === "ar" ? "ماراثون أسئلة + كلمات سر + سحب نقاط" : "Question marathon · passwords · point heists"}
                </p>

                {/* Compact rules */}
                <div className="mt-6 w-full bg-green-950/20 border border-green-900 rounded-2xl p-4 font-mono text-start">
                  <p className="text-green-400 font-bold text-xs mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    {lang === "ar" ? "كيف تعمل" : "HOW_IT_WORKS"}
                  </p>
                  <ol className="text-green-700 text-[11px] space-y-1.5 leading-relaxed">
                    <li>{">"} {lang === "ar" ? "كل لاعب يختار كلمة سر فريدة" : "Each agent picks a unique password"}</li>
                    <li>{">"} {lang === "ar" ? "أسئلة فردية لجمع النقاط" : "Personal queue to gain points"}</li>
                    <li>{">"} {lang === "ar" ? "كل سؤالين: صندوق غامض (نقاط أو هجوم)" : "Every 2 questions: mystery box"}</li>
                    <li>{">"} {lang === "ar" ? "هجوم ناجح = سحب 15% من النقاط" : "Successful attack = steal 15%"}</li>
                  </ol>
                </div>
              </div>
            </motion.div>

            {/* Right: HACK_CONFIG panel */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="lg:col-span-7"
            >
              <div className="bg-gradient-to-b from-green-950/30 to-black border-2 border-green-900 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(34,197,94,0.08)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-green-300 font-mono font-black text-base flex items-center gap-2">
                    <span className="text-green-600">{">"}</span>
                    {lang === "ar" ? "إعدادات الاختراق" : "HACK_CONFIG"}
                  </h2>
                </div>

                {/* Class selector — also rendered for any future shareable game */}
                <div className="mb-4">
                  <ClassSelector
                    value={targetClass}
                    onChange={setTargetClass}
                    accent="#4ade80"
                    mono
                    label={lang === "ar" ? "الصف المستهدف" : "TARGET_CLASS"}
                  />
                </div>

                {/* Source segmented control */}
                <div className="bg-black border border-green-900 rounded-2xl p-1 grid grid-cols-2 gap-1 mb-5 font-mono">
                  <button
                    onClick={() => setSource("assignments")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${source === "assignments" ? "bg-green-500 text-black shadow-[0_0_18px_rgba(74,222,128,0.45)]" : "text-green-700 hover:text-green-300"}`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    {lang === "ar" ? "واجباتي" : "MY_ASSIGNMENTS"}
                  </button>
                  <button
                    onClick={() => setSource("bank")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${source === "bank" ? "bg-green-500 text-black shadow-[0_0_18px_rgba(74,222,128,0.45)]" : "text-green-700 hover:text-green-300"}`}
                  >
                    <Database className="w-4 h-4" />
                    {lang === "ar" ? "بنك الأسئلة" : "QUESTION_BANK"}
                  </button>
                </div>

                {source === "bank" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-mono font-bold text-green-500 mb-1.5 tracking-wider">
                        {lang === "ar" ? "المادة" : "SUBJECT"}
                      </label>
                      <select
                        value={bankSubject}
                        onChange={e => setBankSubject(e.target.value)}
                        className="w-full bg-black border-2 border-green-900 rounded-xl py-2.5 px-3 text-sm text-green-200 font-mono focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
                      >
                        {BANK_SUBJECTS.map(c => (
                          <option key={c.value} value={c.value} className="bg-black">
                            {lang === "ar" ? c.ar : c.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-mono font-bold text-green-500 mb-1.5 tracking-wider">
                          {lang === "ar" ? "المستوى" : "LEVEL"}
                        </label>
                        <select
                          value={bankLevel}
                          onChange={e => setBankLevel(e.target.value)}
                          className="w-full bg-black border-2 border-green-900 rounded-xl py-2.5 px-3 text-sm text-green-200 font-mono focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
                        >
                          {BANK_LEVELS.map(l => (
                            <option key={l.value} value={l.value} className="bg-black">
                              {lang === "ar" ? l.ar : l.en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono font-bold text-green-500 mb-1.5 tracking-wider">
                          {lang === "ar" ? "عدد الأسئلة" : "QUESTION_COUNT"}
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={60}
                          value={bankCount}
                          onChange={e => setBankCount(Math.max(5, Math.min(60, Number(e.target.value) || 20)))}
                          className="w-full bg-black border-2 border-green-900 rounded-xl py-2.5 px-3 text-sm text-green-200 font-mono focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={startFromBank}
                      disabled={creating}
                      className="w-full mt-2 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-mono font-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(74,222,128,0.3)]"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {lang === "ar" ? "جاري التهيئة..." : "BOOTING..."}
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-5 h-5" />
                          {lang === "ar" ? "ابدأ الاختراق" : "INITIATE_HACK"}
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative mb-4">
                      <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-green-700`} />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={lang === "ar" ? "ابحث في واجباتك..." : "search assignments..."}
                        className={`w-full bg-black border-2 border-green-900 rounded-xl py-2.5 text-sm text-green-200 font-mono placeholder:text-green-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none ${lang === "ar" ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                      />
                    </div>

                    {isLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-green-900 rounded-2xl">
                        <AlertTriangle className="w-10 h-10 mx-auto text-green-700 mb-3" />
                        <p className="text-green-400 font-mono font-bold mb-1 text-sm">
                          {assignments?.length === 0
                            ? (lang === "ar" ? "لا توجد واجبات" : "NO_ASSIGNMENTS")
                            : (lang === "ar" ? "لا نتائج" : "NO_RESULTS")}
                        </p>
                        <p className="text-green-700 font-mono text-[11px] mb-4">
                          {lang === "ar" ? "جرّب بنك الأسئلة بدلاً من ذلك" : "Try the question bank instead"}
                        </p>
                        {assignments?.length === 0 && (
                          <button
                            onClick={() => setSource("bank")}
                            className="px-5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black font-mono font-black text-xs"
                          >
                            <Database className="w-3.5 h-3.5 inline-block ms-1" />
                            {lang === "ar" ? "بنك الأسئلة" : "QUESTION_BANK"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1 custom-scroll">
                        {filtered.map((a: Assignment, i: number) => (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i * 0.03, 0.3) }}
                            className="bg-black border-2 border-green-900 hover:border-green-500 rounded-xl p-3.5 transition-all group"
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-9 h-9 rounded-lg bg-green-950/60 border border-green-800 flex items-center justify-center flex-shrink-0">
                                <BookText className="w-4 h-4 text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-green-200 font-mono text-sm leading-tight mb-1 truncate">{a.title}</h3>
                                <div className="flex flex-wrap gap-2 text-[10px] text-green-700 font-mono">
                                  {a.questionCount !== undefined && <span>Q:{a.questionCount}</span>}
                                  {a.targetClass && <span>CLS:{a.targetClass}</span>}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => startFromAssignment(a.id)}
                              disabled={creating}
                              className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-mono font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-[0_0_18px_rgba(74,222,128,0.5)]"
                            >
                              {creating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {lang === "ar" ? "تهيئة..." : "BOOTING..."}
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-4 h-4" />
                                  {lang === "ar" ? "ابدأ" : "INITIATE"}
                                </>
                              )}
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
