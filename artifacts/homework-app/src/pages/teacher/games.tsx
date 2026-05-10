import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  Zap,
  Swords,
  Terminal,
  Trophy,
  Crown,
  Flame,
  Shuffle,
  Brain,
  Palette,
  X as XIcon,
  Star,
  User,
  ChevronRight,
} from "lucide-react";

interface GameItem {
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  to: string;
  iconBg: string;
  iconColor: string;
}

interface Section {
  key: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  accent: string;
  items: GameItem[];
}

export default function TeacherGamesPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const isAr = lang === "ar";

  const sections: Section[] = [
    {
      key: "competitive",
      titleAr: "ألعاب تنافسية",
      titleEn: "Competitive Games",
      descAr: "العب مع طلابك في منافسة مباشرة وتفاعلية",
      descEn: "Play with your students in live, interactive competition",
      accent: "from-fuchsia-500 to-purple-600",
      items: [
        {
          icon: <Zap />,
          titleAr: "وميض",
          titleEn: "Wameeth",
          to: "/teacher?tab=competitive&liveGame=1",
          iconBg: "bg-fuchsia-500/10",
          iconColor: "text-fuchsia-600",
        },
        {
          icon: <Swords />,
          titleAr: "شد الحبل",
          titleEn: "Tug of War",
          to: "/game/tug/create",
          iconBg: "bg-blue-500/10",
          iconColor: "text-blue-600",
        },
        {
          icon: <Terminal />,
          titleAr: "الاختراق",
          titleEn: "Hack",
          to: "/game/hack",
          iconBg: "bg-emerald-700/10",
          iconColor: "text-emerald-700",
        },
      ],
    },
    {
      key: "gathering",
      titleAr: "مسابقات التجمعات واللقاءات",
      titleEn: "Gatherings & Events",
      descAr: "مسابقات مميزة للتجمعات والفعاليات والحفلات المدرسية",
      descEn: "Special quizzes for gatherings, events, and school parties",
      accent: "from-amber-500 to-orange-600",
      items: [
        {
          icon: <Trophy />,
          titleAr: "تحدي حصاد",
          titleEn: "Hasad Arena",
          to: "/game/arena",
          iconBg: "bg-amber-500/10",
          iconColor: "text-amber-600",
        },
        {
          icon: <Crown />,
          titleAr: "من سيحصد المليون",
          titleEn: "Who Wants a Million",
          to: "/game/million",
          iconBg: "bg-yellow-500/10",
          iconColor: "text-yellow-600",
        },
        {
          icon: <Flame />,
          titleAr: "الكرسي الساخن",
          titleEn: "Hot Seat",
          to: "/game/hotseat/create",
          iconBg: "bg-orange-500/10",
          iconColor: "text-orange-600",
        },
      ],
    },
    {
      key: "brain",
      titleAr: "ألعاب العقل والذكاء",
      titleEn: "Brain & Logic Games",
      descAr: "تحدِّ عقلك وطوِّر مهاراتك الذهنية",
      descEn: "Challenge your mind and sharpen your skills",
      accent: "from-cyan-500 to-blue-600",
      items: [
        {
          icon: <Shuffle />,
          titleAr: "الكلمات المبعثرة",
          titleEn: "Scrambled Words",
          to: "/game/scramble",
          iconBg: "bg-cyan-500/10",
          iconColor: "text-cyan-600",
        },
        {
          icon: <Brain />,
          titleAr: "الذاكرة",
          titleEn: "Memory",
          to: "/game/memory",
          iconBg: "bg-indigo-500/10",
          iconColor: "text-indigo-600",
        },
        {
          icon: <Palette />,
          titleAr: "الألوان",
          titleEn: "Colors",
          to: "/game/color",
          iconBg: "bg-pink-500/10",
          iconColor: "text-pink-600",
        },
        {
          icon: <XIcon />,
          titleAr: "الضرب",
          titleEn: "Multiplication",
          to: "/game/multiply",
          iconBg: "bg-violet-500/10",
          iconColor: "text-violet-600",
        },
      ],
    },
    {
      key: "solo",
      titleAr: "ألعاب فردية",
      titleEn: "Solo Games",
      descAr: "العب بمفردك في وقتك الخاص وتتبع تقدمك",
      descEn: "Play alone at your own pace and track your progress",
      accent: "from-emerald-600 to-teal-600",
      items: [
        {
          icon: <Star />,
          titleAr: "المسابقات العامة",
          titleEn: "General Quizzes",
          to: "/islamic",
          iconBg: "bg-emerald-500/10",
          iconColor: "text-emerald-700",
        },
        {
          icon: <User />,
          titleAr: "الألعاب الفردية",
          titleEn: "Solo Games",
          to: "/public/games",
          iconBg: "bg-teal-500/10",
          iconColor: "text-teal-600",
        },
      ],
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-6xl">
        <button
          onClick={() => setLocation("/teacher")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronRight
            className={`w-4 h-4 ${isAr ? "" : "rotate-180"}`}
          />
          {isAr ? "العودة للرئيسية" : "Back to home"}
        </button>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            🎮 {isAr ? "الألعاب" : "Games"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {isAr
              ? "اختر القسم الذي يناسبك"
              : "Choose the section that fits you"}
          </p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {sections.map((section) => (
            <section
              key={section.key}
              className="rounded-2xl border border-border/60 bg-card overflow-hidden"
            >
              <div
                className={`h-1.5 bg-gradient-to-r ${section.accent}`}
              />
              <div className="p-4 sm:p-5 lg:p-6">
                <h2 className="text-lg sm:text-xl font-extrabold text-foreground">
                  {isAr ? section.titleAr : section.titleEn}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-4 sm:mb-5">
                  {isAr ? section.descAr : section.descEn}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {section.items.map((item) => (
                    <Link
                      key={item.titleEn}
                      href={item.to}
                      className="group flex flex-col items-center text-center gap-2 p-3 sm:p-4 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-muted/30 active:scale-[0.97] transition-all"
                    >
                      <div
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${item.iconBg} ${item.iconColor} flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6 sm:[&_svg]:w-7 sm:[&_svg]:h-7 group-hover:scale-110 transition-transform`}
                      >
                        {item.icon}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-foreground leading-tight">
                        {isAr ? item.titleAr : item.titleEn}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
}
