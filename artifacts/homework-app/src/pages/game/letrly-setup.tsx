import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Send } from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  type LetrlyCategory,
  type LetrlyLength,
} from "@/lib/letrly-engine";
import LetrlyCreate from "./letrly-create";

const ALL_CATEGORIES: LetrlyCategory[] = [
  "general",
  "animals",
  "fruits",
  "cities",
  "science",
  "islamic",
];

const ALL_LENGTHS: LetrlyLength[] = [4, 5, 6];

const LENGTH_LABEL: Record<LetrlyLength, string> = {
  4: "٤ حروف",
  5: "٥ حروف",
  6: "٦ حروف",
};

const LENGTH_HINT: Record<LetrlyLength, string> = {
  4: "سهل",
  5: "متوسط",
  6: "صعب",
};

type DemoState = "correct" | "present" | "absent";

function DemoRow({ letters, states }: { letters: string[]; states: DemoState[] }) {
  return (
    <div className="flex gap-1.5">
      {letters.map((l, i) => {
        const s = states[i];
        const cls =
          s === "correct"
            ? "bg-emerald-500 border-emerald-500 text-white"
            : s === "present"
            ? "bg-amber-400 border-amber-400 text-white"
            : "bg-zinc-400 border-zinc-400 text-white";
        return (
          <motion.div
            key={i}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md border-2 font-extrabold flex items-center justify-center text-base sm:text-lg ${cls}`}
          >
            {l}
          </motion.div>
        );
      })}
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL || "";

type LetrlyOptions = {
  categories: Record<string, boolean>;
  lengths: Record<string, boolean>;
};

function PlayPanel() {
  const [, setLocation] = useLocation();
  const [opts, setOpts] = useState<LetrlyOptions | null>(null);
  const [category, setCategory] = useState<LetrlyCategory>("general");
  const [length, setLength] = useState<LetrlyLength>(5);

  useEffect(() => {
    fetch(`${API_BASE}/api/letrly/options`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setOpts(data); })
      .catch(() => {});
  }, []);

  const enabledCategories = opts
    ? ALL_CATEGORIES.filter((c) => opts.categories[c] !== false)
    : ALL_CATEGORIES;
  const enabledLengths = opts
    ? ALL_LENGTHS.filter((l) => opts.lengths[String(l)] !== false)
    : ALL_LENGTHS;

  // If user's current selection got disabled, snap to first enabled.
  useEffect(() => {
    if (enabledCategories.length > 0 && !enabledCategories.includes(category)) {
      setCategory(enabledCategories[0]);
    }
    if (enabledLengths.length > 0 && !enabledLengths.includes(length)) {
      setLength(enabledLengths[0]);
    }
  }, [opts]);

  const startGame = () => {
    setLocation(`/game/letrly/play?category=${category}&length=${length}`);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[hsl(145,40%,28%)]/10 text-[hsl(145,40%,28%)] text-xs font-bold mb-3 border border-[hsl(145,40%,28%)]/15">
          <Sparkles className="w-3.5 h-3.5" />
          لعبة كلمات عربية
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-2">
          تحدي الكلمة
        </h1>
        <p className="text-muted-foreground text-base">
          خمّن الكلمة السرّية في ٦ محاولات. كل لون يخبرك بمدى قربك.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white border border-card-border rounded-2xl p-4 sm:p-5 mb-6 shadow-sm"
      >
        <div className="text-center mb-4">
          <h2 className="text-sm font-extrabold text-foreground mb-1">كيف ألعب؟</h2>
          <p className="text-xs text-muted-foreground">الألوان تخبرك بمدى قربك من الكلمة السرّية</p>
        </div>
        <div className="flex flex-col items-center gap-1.5 mb-4">
          <DemoRow letters={["ج", "م", "ل", "ي"]} states={["absent", "absent", "absent", "absent"]} />
          <DemoRow letters={["ح", "ر", "ف", "ي"]} states={["correct", "absent", "absent", "absent"]} />
          <DemoRow letters={["ح", "ص", "ا", "ن"]} states={["correct", "correct", "correct", "correct"]} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-md bg-emerald-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">ح</div>
            <div className="text-[11px] font-bold text-emerald-700">في مكانه ✓</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-md bg-amber-400 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">ص</div>
            <div className="text-[11px] font-bold text-amber-700">موجود لكن مكان آخر</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-md bg-zinc-400 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">ل</div>
            <div className="text-[11px] font-bold text-zinc-600">غير موجود</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-card-border rounded-2xl p-5 mb-5 shadow-sm"
      >
        <h2 className="text-sm font-bold text-foreground mb-3">اختر التصنيف</h2>
        {enabledCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد تصنيفات متاحة حالياً</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {enabledCategories.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    active
                      ? "border-[hsl(145,55%,32%)] bg-[hsl(145,55%,32%)]/8 shadow-sm"
                      : "border-card-border bg-card hover:border-[hsl(145,55%,32%)]/40"
                  }`}
                >
                  <div className="text-xl mb-0.5">{CATEGORY_EMOJI[cat]}</div>
                  <div className={`text-xs font-bold ${active ? "text-[hsl(145,55%,32%)]" : "text-foreground"}`}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white border border-card-border rounded-2xl p-5 mb-6 shadow-sm"
      >
        <h2 className="text-sm font-bold text-foreground mb-3">عدد حروف الكلمة</h2>
        {enabledLengths.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد أطوال متاحة حالياً</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {enabledLengths.map((len) => {
              const active = length === len;
              return (
                <button
                  key={len}
                  onClick={() => setLength(len)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    active
                      ? "border-[hsl(145,55%,32%)] bg-[hsl(145,55%,32%)]/8 shadow-sm"
                      : "border-card-border bg-card hover:border-[hsl(145,55%,32%)]/40"
                  }`}
                >
                  <div className={`text-base font-extrabold mb-0.5 ${active ? "text-[hsl(145,55%,32%)]" : "text-foreground"}`}>
                    {LENGTH_LABEL[len]}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">{LENGTH_HINT[len]}</div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={startGame}
        disabled={enabledCategories.length === 0 || enabledLengths.length === 0}
        className="w-full bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg shadow-[hsl(145,55%,32%)]/30 hover:shadow-xl transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-2"
      >
        <Play className="w-5 h-5" />
        ابدأ اللعب
      </motion.button>
    </>
  );
}

export default function LetrlySetup() {
  const [, setLocation] = useLocation();
  const { data: teacher } = useGetCurrentTeacher({ query: { retry: false } as any });
  const isTeacher = !!teacher?.id;
  const [tab, setTab] = useState<"play" | "create">("play");

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-10"
        style={{ background: "#F5FAF7" }}
        dir="rtl"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
          <button
            onClick={() => setLocation(isTeacher ? "/teacher" : "/games")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowRight className="w-4 h-4" />
            {isTeacher ? "لوحة المعلم" : "كل الألعاب"}
          </button>

          {isTeacher && (
            <div className="flex items-center gap-1.5 bg-white border border-card-border rounded-2xl p-1.5 mb-6 shadow-sm">
              <button
                onClick={() => setTab("play")}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tab === "play"
                    ? "bg-[hsl(145,55%,32%)] text-white shadow"
                    : "text-foreground hover:bg-zinc-50"
                }`}
              >
                <Play className="w-4 h-4" />
                العب الآن
              </button>
              <button
                onClick={() => setTab("create")}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tab === "create"
                    ? "bg-[hsl(145,55%,32%)] text-white shadow"
                    : "text-foreground hover:bg-zinc-50"
                }`}
              >
                <Send className="w-4 h-4" />
                أنشئ كلمة وشاركها
              </button>
            </div>
          )}

          {isTeacher && tab === "create" ? (
            <LetrlyCreate embedded />
          ) : (
            <PlayPanel />
          )}
        </div>
      </div>
    </Layout>
  );
}
