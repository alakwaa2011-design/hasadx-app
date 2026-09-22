import { Link, useLocation } from "wouter";
import { Globe, Landmark, Sparkles, Brain, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

export function GamesSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();

  const games = [
    {
      href: "/game/secret",
      icon: Eye,
      title: isAr ? "اكتشف السر" : "Discover the Secret",
      desc: isAr
          ? "فريقان يمسحان باركوداً سرياً ويتبادلان أسئلة نعم/لا حتى يكتشفا سر الخصم"
          : "Two teams scan secret QR codes and ask yes/no questions to discover each other's secret",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      href: "/game/flags",
      icon: Globe,
      title: isAr ? "لعبة أعلام الدول" : "World Flags Game",
      desc: isAr
          ? "اختبر معلوماتك في أعلام دول العالم"
          : "Test your knowledge of world flags",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: isAr ? "لعبة عواصم العالم" : "World Capitals Game",
      desc: isAr
          ? "اختبر معلوماتك في عواصم دول العالم"
          : "Test your knowledge of world capitals",
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
    },
    {
      href: "/game/color",
      icon: Sparkles,
      title: isAr ? "لعبة الألوان" : "Color Game",
      desc: isAr
          ? "هل عينك حادة؟ ابحث عن المربع المختلف"
          : "Find the odd square in the grid",
      iconBg: "bg-secondary/15",
      iconColor: "text-secondary",
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: isAr ? "لعبة الذاكرة" : "Memory Match",
      desc: isAr
          ? "اقلب البطاقات وابحث عن الأزواج المتطابقة"
          : "Flip cards and find matching pairs",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    }
  ];

  return (
    <section id="games" className="border-t border-border bg-[#fbfcf8] dark:bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <p className="text-sm font-black text-primary">
              {isAr ? "ألعاب تعليمية" : "Learning games"}
            </p>
            <h2 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
              {isAr ? "العب وتعلّم — مجاناً للجميع" : "Play and learn — free for everyone"}
            </h2>
            <p className="mt-2 text-lg text-muted-foreground font-medium">
              {isAr ? "ألعاب جاهزة للاستخدام فورًا بدون تسجيل." : "Ready-to-play games with no sign-in required."}
            </p>
          </div>
          <Link
            href="/games"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-card px-5 py-3 font-black text-foreground hover:bg-muted transition sm:self-auto shadow-sm"
          >
            <Globe className="h-5 w-5 text-primary" />
            {isAr ? "كل الألعاب" : "All games"}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {games.map((game, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => setLocation(game.href)}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i }}
              className="group h-full w-full rounded-3xl border border-border bg-card p-6 text-start transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg flex flex-col"
            >
              <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${game.iconBg} ${game.iconColor} transition group-hover:scale-110`}>
                <game.icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{game.title}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed mt-auto">
                {game.desc}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}