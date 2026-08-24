import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Globe, Brain, Shuffle, Landmark, Sparkles, Calculator, ArrowRight, ArrowLeft, Gamepad2, Trophy, Terminal, Type, Swords, Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

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
  const { lang, t, dir } = useI18n();
  useSeo({
    title: t.gamesPage.seoTitle,
    description: t.gamesPage.seoDescription,
    canonicalPath: "/games",
    ogImage: "/opengraph.jpg",
  });
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
      title: t.gamesPage.secretTitle, desc: t.gamesPage.secretDescription,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    }] : []),
    {
      href: "/game/hack",
      icon: Terminal,
      title: t.gamesPage.hackTitle, desc: t.gamesPage.hackDescription,
      iconBg: "bg-green-900/30",
      iconColor: "text-green-500",
    },
    {
      href: "/game/flags",
      icon: Globe,
      title: t.gamesPage.flagsTitle, desc: t.gamesPage.flagsDescription,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: t.gamesPage.capitalsTitle, desc: t.gamesPage.capitalsDescription,
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
    },
    {
      href: "/game/color",
      icon: Sparkles,
      title: t.gamesPage.colorTitle, desc: t.gamesPage.colorDescription,
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: t.gamesPage.memoryTitle, desc: t.gamesPage.memoryDescription,
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/multiply",
      icon: Calculator,
      title: t.gamesPage.multiplicationTitle, desc: t.gamesPage.multiplicationDescription,
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/letrly",
      icon: Type,
      title: t.gamesPage.wordTitle, desc: t.gamesPage.wordDescription,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      href: "/game/scramble",
      icon: Shuffle,
      title: t.gamesPage.scrambleTitle, desc: t.gamesPage.scrambleDescription,
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/stroop",
      icon: Brain,
      title: t.gamesPage.stroopTitle, desc: t.gamesPage.stroopDescription,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
    },
    ...(maraquiVisible ? [{
      href: "/game/maraqui",
      icon: Landmark,
      title: t.gamesPage.maraquiTitle, desc: t.gamesPage.maraquiDescription,
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
    }] : []),
    {
      href: "/game/million",
      icon: Trophy,
      title: t.gamesPage.millionTitle, desc: t.gamesPage.millionDescription,
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
                {t.gamesPage.home}
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
              {t.gamesPage.badge}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2">
              {t.gamesPage.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t.gamesPage.subtitle}
            </p>
          </motion.div>

          {/* Featured Hero Card — Hasaad Arena */}
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
                      {t.gamesPage.featuredBadge}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-extrabold mb-1 text-transparent bg-clip-text bg-gradient-to-l from-amber-200 via-yellow-300 to-amber-400">
                      {t.gamesPage.featuredTitle}
                    </h2>
                    <p className="text-emerald-100/80 text-sm sm:text-base mb-3">
                      {t.gamesPage.featuredDescription}
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-emerald-950 font-extrabold text-sm group-hover:gap-3 transition-all">
                      {t.gamesPage.featuredAction}
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
                       {t.gamesPage.playNow}
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
