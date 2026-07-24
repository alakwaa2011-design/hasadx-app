import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Globe, Brain, Shuffle, Landmark, Sparkles, Calculator, ArrowRight, ArrowLeft, Gamepad2, Trophy, Terminal, Type, Swords, Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface GameCard {
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  iconBg: string;
  iconColor: string;
}

export default function GamesPage() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const ChevronIcon = lang === "ar" ? ArrowLeft : ArrowRight;

  const [maraquiVisible, setMaraquiVisible] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/me`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API_BASE}/api/public/settings`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([me, ps]) => {
      if (cancelled) return;
      const isAdmin = Boolean(me?.isAdmin) || me?.role === "admin";
      setMaraquiVisible(isAdmin || Boolean(ps?.showMaraqui));
      setSecretVisible(isAdmin || Boolean(ps?.showSecretGame));
    });
    return () => { cancelled = true; };
  }, []);

  const games: GameCard[] = [
    ...(secretVisible ? [{
      href: "/game/secret",
      icon: Eye,
      title: lang === "ar" ? "اكتشف السر" : "Discover the Secret",
      desc: lang === "ar"
        ? "فريقان يمسحان باركوداً سرياً ويتبادلان الأسئلة نعم/لا حتى يكتشفا سر الخصم"
        : "Two teams scan secret QR codes and ask yes/no questions to discover each other's secret",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    }] : []),
    {
      href: "/game/hack",
      icon: Terminal,
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc: lang === "ar"
        ? "ماراثون اختراق: كلمات سر، صناديق غامضة، وسحب نقاط الخصوم"
        : "Hack marathon: passwords, mystery boxes, and stealing opponents' points",
      iconBg: "bg-green-900/30",
      iconColor: "text-green-500",
    },
    {
      href: "/game/flags",
      icon: Globe,
      title: lang === "ar" ? "لعبة أعلام الدول" : "World Flags Game",
      desc: lang === "ar" ? "اختبر معلوماتك في أعلام دول العالم" : "Test your knowledge of world flags",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: lang === "ar" ? "لعبة عواصم العالم" : "World Capitals Game",
      desc: lang === "ar" ? "اختبر معلوماتك في عواصم دول العالم" : "Test your knowledge of world capitals",
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
    },
    {
      href: "/game/color",
      icon: Sparkles,
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc: lang === "ar" ? "هل عينك حادة؟ ابحث عن المربع المختلف" : "Find the odd square in the grid",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      desc: lang === "ar" ? "اقلب البطاقات وابحث عن الأزواج المتطابقة" : "Flip cards and find matching pairs",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/multiply",
      icon: Calculator,
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      desc: lang === "ar" ? "اختبر سرعتك في جدول الضرب مع مضاعفات السلسلة" : "Test your multiplication speed with streak bonuses",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/letrly",
      icon: Type,
      title: lang === "ar" ? "تحدي الكلمة" : "Word Challenge",
      desc: lang === "ar"
        ? "خمّن الكلمة العربية في ٦ محاولات — لعبة الكلمات الأشهر بنكهة عربية"
        : "Guess the Arabic word in 6 tries — the famous word game in Arabic",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      href: "/game/scramble",
      icon: Shuffle,
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      desc: lang === "ar" ? "رتّب الحروف المبعثرة لتكوّن الكلمة الصحيحة" : "Unscramble letters to form the correct word",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/stroop",
      icon: Brain,
      title: lang === "ar" ? "لعبة ارتباك" : "Stroop Game",
      desc: lang === "ar" ? "اضغط على لون الحبر وليس معنى الكلمة — تحدٍّ لعقلك!" : "Click the ink color, not the word — challenge your brain!",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
    },
    ...(maraquiVisible ? [{
      href: "/game/maraqui",
      icon: Landmark,
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc: lang === "ar"
        ? "المسابقة الأكثر حماسا وثقافة عبر مراحلها    —    "
        : "Progress through stages and master the content — graded MCQ questions",
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
    }] : []),
    {
      href: "/game/million",
      icon: Trophy,
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc: lang === "ar"
        ? "15 سؤالاً تتصاعد صعوبةً حتى المليون — وساعدك بثلاثة أطواق نجاة"
        : "15 escalating questions toward a million — with 3 lifelines to help you",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-10 sm:py-14"
        style={{ background: "#F5FAF7" }}
        dir={dir}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="mb-8">
            <Link href="/">
              <button className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <BackIcon className="w-4 h-4" />
                {lang === "ar" ? "الصفحة الرئيسية" : "Home"}
              </button>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[hsl(145,40%,28%)]/10 text-[hsl(145,40%,28%)] text-xs font-bold mb-3 border border-[hsl(145,40%,28%)]/15">
              <Gamepad2 className="w-3.5 h-3.5" />
              {lang === "ar" ? "ألعاب تعليمية" : "Educational Games"}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2">
              {lang === "ar" ? "كل الألعاب" : "All Games"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {lang === "ar"
                ? "ألعاب يمكنك الاستمتاع بها فوراً بدون تسجيل"
                : "Games you can enjoy instantly without registration"}
            </p>
          </motion.div>

          {/* Featured Hero Card — Hasad Arena */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Link href="/game/arena">
              <div
                className="group relative overflow-hidden rounded-3xl p-6 sm:p-8 cursor-pointer hover:-translate-y-1 transition-all duration-200 shadow-2xl hover:shadow-emerald-900/40"
                style={{
                  background: "linear-gradient(135deg, #064e3b 0%, #022c22 60%, #064e3b 100%)",
                  border: "2px solid rgba(245,158,11,0.4)",
                }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl"
                  style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }} />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 blur-3xl"
                  style={{ background: "radial-gradient(circle, #16a34a 0%, transparent 70%)" }} />
                <div className="relative flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center shadow-xl bg-gradient-to-br from-amber-300 to-yellow-500 text-emerald-950">
                    <Swords className="w-10 h-10 sm:w-12 sm:h-12" />
                  </div>
                  <div className="flex-1 text-center sm:text-right">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-300/20 text-amber-200 text-[10px] font-bold mb-2 border border-amber-300/30">
                      <Sparkles className="w-3 h-3" />
                      {lang === "ar" ? "جديد · لعبة الشاشة الكبيرة" : "New · Big Screen Game"}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-extrabold mb-1 text-transparent bg-clip-text bg-gradient-to-l from-amber-200 via-yellow-300 to-amber-400">
                      {lang === "ar" ? "تحدّي حصاد" : "Hasad Arena"}
                    </h2>
                    <p className="text-emerald-100/80 text-sm sm:text-base mb-3">
                      {lang === "ar"
                        ? "مسابقة معرفة بين فريقين على شاشة كبيرة — 6 فئات، أسئلة بقيم متصاعدة، ووسائل مساعدة استراتيجية"
                        : "Two-team knowledge battle on a big screen — 6 categories, escalating points, and strategic helpers"}
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-emerald-950 font-extrabold text-sm group-hover:gap-3 transition-all">
                      {lang === "ar" ? "ابدأ التحدي" : "Start Challenge"}
                      <ChevronIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {games.map((game, i) => (
              <motion.div
                key={game.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.05 }}
              >
                <Link href={game.href}>
                  <div className="group bg-card border border-card-border hover:border-primary/50 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
                    <div
                      className={`w-11 h-11 rounded-xl ${game.iconBg} ${game.iconColor} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}
                    >
                      <game.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-foreground text-sm mb-1">{game.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{game.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-[hsl(145,40%,35%)] font-bold text-xs group-hover:gap-2 transition-all">
                      {lang === "ar" ? "العب الآن" : "Play Now"}
                      <ChevronIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
