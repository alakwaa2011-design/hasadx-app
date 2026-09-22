import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Languages, Gamepad2, ChevronLeft, ChevronRight, FileText, MonitorPlay, BrainCircuit, Library, CheckCircle } from "lucide-react";
import { InstallAppButton } from "@/components/install-app-button";

// Images from Figma Extraction
const FIGMA_ASSET_BASE = `${import.meta.env.BASE_URL}images/figma`;
const HERO_BG = `${FIGMA_ASSET_BASE}/hero-bg.png`;
const UI_SCREENSHOT = `${FIGMA_ASSET_BASE}/ui-screenshot.png`;
const PRESENTATION_SCREEN = `${FIGMA_ASSET_BASE}/presentation-screen.png`;
const STATISTICS_IMG = `${FIGMA_ASSET_BASE}/statistics.png`;
const MOTIVATION_IMG = `${FIGMA_ASSET_BASE}/motivation.png`;
const LOGO_HORIZONTAL = `${FIGMA_ASSET_BASE}/logo-horizontal.png`;
const LOGO_MARK = `${FIGMA_ASSET_BASE}/logo-mark.png`;

import tugOfWarImg from "@/assets/landing/tug-of-war.png";
import rocketRaceImg from "@/assets/landing/rocket-race.png";
import xoInteractiveImg from "@/assets/landing/xo-interactive.png";

const COLORS = {
  primary: "#257E4A",
  secondary: "#F2B522",
  background: "#FDFFFC",
};

export default function DesignPreviewHome() {
  const { lang, setLang, dir } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();

  useSeo({
    title: isAr
      ? "حصاد - منصة عربية متكاملة لتعليم تفاعلي مبدع"
      : "Hasaad - Integrated Arabic Platform for Interactive Education",
    description: isAr
      ? "خطط، أنشئ، اعرض وتفاعل من مكان واحد. أدوات ذكية تساعد المعلم على إعداد درسه وصناعة الألعاب والمحتوى والأنشطة التفاعلية."
      : "Plan, create, present and interact from one place. Smart tools to help teachers prepare lessons and create interactive games and activities.",
    noindex: true,
  });

  const toggleLang = () => setLang(isAr ? "en" : "ar");

  return (
    <div
      dir={dir}
      className="min-h-screen flex flex-col overflow-x-hidden selection:bg-[#257E4A]/20"
      style={{
        backgroundColor: COLORS.background,
        fontFamily: "'Tajawal', sans-serif",
        color: "#1A1A1A",
      }}
    >
      <style>{`
        .figma-container {
          max-width: 1240px;
          margin: 0 auto;
          padding-left: 1.5rem;
          padding-right: 1.5rem;
        }
        @media (min-width: 768px) {
          .figma-container {
            padding-left: 2rem;
            padding-right: 2rem;
          }
        }
      `}</style>

      {/* NAVIGATION */}
      <Header
        isAr={isAr}
        toggleLang={toggleLang}
      />

      <main className="flex-1 flex flex-col w-full relative">
        <HeroSection isAr={isAr} setLocation={setLocation} />
        <BenefitsSection isAr={isAr} />
        <PresentSection isAr={isAr} />
        <ToolsSection isAr={isAr} />
        <HowItWorksSection isAr={isAr} />
        <StatisticsSection isAr={isAr} />
        <GamesSection isAr={isAr} />
        <MotivationSection isAr={isAr} />
        <CTASection isAr={isAr} />
      </main>

      <Footer isAr={isAr} />

      <div className="fixed bottom-6 start-6 z-50">
        <InstallAppButton variant="hero" className="shadow-2xl" />
      </div>
    </div>
  );
}

function Header({ isAr, toggleLang }: { isAr: boolean; toggleLang: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV_LINKS = [
    { label: isAr ? "الرئيسية" : "Home", href: "/design-preview/home" },
    { label: isAr ? "الأدوات" : "Tools", href: "/design-preview/home#tools" },
    { label: isAr ? "الألعاب" : "Games", href: "/design-preview/home#games" },
    { label: isAr ? "المسابقات الثقافية" : "Cultural Quizzes", href: "/public/games" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#FDFFFC]/90 backdrop-blur-md border-b border-[#257E4A]/10 transition-all">
      <div className="figma-container h-20 flex items-center justify-between">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2" data-testid="link-home-logo">
          <img
            src={LOGO_HORIZONTAL}
            alt="Hasaad Logo"
            className="h-10 w-auto object-contain hidden md:block"
            loading="lazy"
          />
          <img
            src={LOGO_MARK}
            alt="Hasaad Logo Mark"
            className="h-10 w-auto object-contain md:hidden"
            loading="lazy"
          />
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-base font-bold text-[#1A1A1A]/80 hover:text-[#257E4A] transition-colors"
                data-testid={`link-nav-${link.href.replace(/[\\/\\#]/g, "")}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]/70 hover:text-[#257E4A] px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
              data-testid="button-toggle-lang"
            >
              <Languages className="w-4 h-4" />
              {isAr ? "English" : "العربية"}
            </button>
            <Link
              href="/login"
              className="text-sm font-bold text-[#257E4A] px-4 py-2 rounded-xl border-2 border-[#257E4A]/20 hover:border-[#257E4A] hover:bg-[#257E4A]/5 transition-all"
              data-testid="link-login"
            >
              {isAr ? "دخول" : "Login"}
            </Link>
            <Link
              href="/register?role=teacher"
              className="text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-md hover:shadow-lg"
              style={{ backgroundColor: COLORS.primary }}
              data-testid="link-register"
            >
              {isAr ? "ابدأ مجاناً" : "Start Free"}
            </Link>
          </div>
        </nav>

        {/* MOBILE MENU TOGGLE */}
        <button
          className="md:hidden p-2 text-[#1A1A1A] hover:bg-gray-100 rounded-lg"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
          aria-label={isAr ? "القائمة" : "Menu"}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE NAV */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-[#FDFFFC] border-b border-gray-100 overflow-hidden"
            data-testid="mobile-menu-container"
          >
            <div className="flex flex-col p-4 gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-bold text-[#1A1A1A] hover:text-[#257E4A] py-2"
                  data-testid={`link-mobile-nav-${link.href.replace(/[\\/\\#]/g, "")}`}
                >
                  {link.label}
                </a>
              ))}
              <div className="h-px bg-gray-100 my-2" />
              <button
                onClick={() => {
                  toggleLang();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-base font-bold text-[#1A1A1A] py-2"
                data-testid="button-mobile-toggle-lang"
              >
                <Languages className="w-5 h-5" />
                {isAr ? "Switch to English" : "التبديل للعربية"}
              </button>
              <div className="flex flex-col gap-3 mt-2">
                <Link
                  href="/login"
                  className="text-center font-bold text-[#257E4A] px-4 py-3 rounded-xl border-2 border-[#257E4A]/20"
                  data-testid="link-mobile-login"
                >
                  {isAr ? "دخول" : "Login"}
                </Link>
                <Link
                  href="/register?role=teacher"
                  className="text-center font-bold text-white px-4 py-3 rounded-xl shadow-md"
                  style={{ backgroundColor: COLORS.primary }}
                  data-testid="link-mobile-register"
                >
                  {isAr ? "ابدأ مجاناً" : "Start Free"}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection({ isAr, setLocation }: { isAr: boolean; setLocation: (path: string) => void }) {
  const [pin, setPin] = useState("");

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim().length >= 4) {
      setLocation(`/game/join/${pin.trim()}`);
    }
  };

  return (
    <section className="relative w-full pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <img
          src={HERO_BG}
          alt=""
          className="w-full h-full object-cover object-top"
          loading="eager"
        />
      </div>

      <div className="figma-container relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 w-full min-w-0 text-center lg:text-start max-w-2xl mx-auto lg:mx-0"
          >
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#1A1A1A] leading-[1.25] mb-6">
              {isAr ? (
                <>
                  منصة تعليمية <span style={{ color: COLORS.primary }}>تفاعلية</span><br />
                  بمحتوى <span style={{ color: COLORS.secondary }}>عربي</span> مبدع
                </>
              ) : (
                <>
                  An <span style={{ color: COLORS.primary }}>Interactive</span> Educational Platform<br />
                  with Creative <span style={{ color: COLORS.secondary }}>Arabic</span> Content
                </>
              )}
            </h1>
            
            <p className="text-lg sm:text-xl text-[#1A1A1A]/70 mb-10 leading-relaxed font-medium">
              {isAr
                ? "خطط، أنشئ، اعرض وتفاعل من مكان واحد. أدوات ذكية تساعد المعلم على إعداد درسه وصناعة الألعاب والأنشطة التفاعلية بسهولة."
                : "Plan, create, present and interact from one place. Smart tools to help teachers prepare lessons and create games easily."}
            </p>

            {/* PIN Entry for Students */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xl shadow-[#257E4A]/10 border border-gray-100 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mx-auto lg:mx-0">
              <form onSubmit={handleJoin} className="flex-1 w-full min-w-0 flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#F2B522]/20 flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-5 h-5 text-[#F2B522]" />
                </div>
                <input
                  type="text"
                  placeholder={isAr ? "أدخل رمز اللعبة..." : "Enter Game PIN..."}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="flex-1 min-w-0 h-12 bg-transparent outline-none text-base sm:text-lg font-bold text-center sm:text-start placeholder:text-gray-400"
                  dir="ltr"
                  data-testid="input-game-pin"
                />
                <button
                  type="submit"
                  disabled={pin.trim().length < 4}
                  className="h-12 shrink-0 px-4 sm:px-6 rounded-xl font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0"
                  style={{ backgroundColor: COLORS.secondary }}
                  data-testid="button-join-game"
                >
                  {isAr ? "انضمام" : "Join"}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <div className="flex-1 relative w-full max-w-[600px] lg:max-w-none">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <img
                src={UI_SCREENSHOT}
                alt="Dashboard Preview"
                className="w-full h-auto object-cover"
                loading="eager"
                data-testid="img-hero-dashboard"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/20 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ isAr }: { isAr: boolean }) {
  const benefits = [
    { title: isAr ? "توفير الوقت" : "Save Time", desc: isAr ? "أدوات ذكية تخفف عبء التحضير" : "Smart tools reduce prep time" },
    { title: isAr ? "تفاعل أكبر" : "Higher Engagement", desc: isAr ? "بيئة تعليمية جاذبة للطلاب" : "Attractive learning environment" },
    { title: isAr ? "تجربة منظّمة" : "Organized Experience", desc: isAr ? "أدوات واضحة وسهلة الاستخدام" : "Clear, easy-to-use teaching tools" }
  ];
  return (
    <section id="benefits" className="py-20 bg-white">
      <div className="figma-container">
        <div className="text-center mb-12">
           <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-4">
             {isAr ? "لماذا حصاد؟" : "Why Hasaad?"}
           </h2>
           <div className="w-24 h-1.5 rounded-full mx-auto" style={{ backgroundColor: COLORS.secondary }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {benefits.map((b, i) => (
             <div key={i} className="p-8 rounded-3xl bg-gray-50 border border-gray-100 text-center hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-[#257E4A] mb-3">{b.title}</h3>
                <p className="text-[#1A1A1A]/70 font-medium">{b.desc}</p>
             </div>
           ))}
        </div>
      </div>
    </section>
  );
}

function PresentSection({ isAr }: { isAr: boolean }) {
  return (
    <section id="present" className="py-20 bg-[#FDFFFC] border-y border-gray-100">
      <div className="figma-container">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-start">
            <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-6 leading-tight">
              {isAr ? "عروض تفاعلية نابضة بالحياة" : "Interactive, Vibrant Presentations"}
            </h2>
            <p className="text-lg text-[#1A1A1A]/70 font-medium mb-8 leading-relaxed">
              {isAr 
                ? "ارتق بدرسك من خلال عروض تقديمية تتضمن أسئلة، استطلاعات، وأنشطة يشارك فيها الطلاب مباشرة من أجهزتهم." 
                : "Elevate your lesson with presentations that include questions, polls, and activities students participate in directly from their devices."}
            </p>
            <Link 
              href="/teacher/presentations/new"
              className="inline-block px-8 py-4 rounded-xl font-bold text-white transition-transform hover:-translate-y-1 shadow-md"
              style={{ backgroundColor: COLORS.primary }}
              data-testid="link-create-presentation"
            >
               {isAr ? "صمم عرضك الأول" : "Design Your First Presentation"}
            </Link>
          </div>
          <div className="flex-1 w-full">
             <div className="aspect-video bg-gray-100 rounded-3xl border-4 border-white shadow-xl overflow-hidden">
                 <img
                   src={PRESENTATION_SCREEN}
                   alt={isAr ? "معاينة العرض التفاعلي" : "Interactive presentation preview"}
                   className="h-full w-full object-cover object-top"
                   loading="lazy"
                   data-testid="img-presentation-preview"
                 />
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolsSection({ isAr }: { isAr: boolean }) {
  const tools = [
    { title: isAr ? "أوراق العمل الذكية" : "Smart Worksheets", icon: FileText, href: "/teacher/worksheets/create" },
    { title: isAr ? "العروض التفاعلية" : "Interactive Presentations", icon: MonitorPlay, href: "/teacher/presentations/new" },
    { title: isAr ? "الفيديو التفاعلي" : "Interactive Video", icon: MonitorPlay, href: "/teacher/video-lesson/new" },
    { title: isAr ? "السبورة الذكية" : "Smart Whiteboard", icon: MonitorPlay, href: "/teacher/smart-board" },
    { title: isAr ? "توليد خطط الدروس" : "Lesson Plan AI", icon: BrainCircuit, href: "/teacher/lesson-plans/create" },
    { title: isAr ? "الخرائط الذهنية" : "Mind Maps", icon: BrainCircuit, href: "/teacher/mindmap/create" },
  ];
  return (
    <section id="tools" className="py-20 bg-gray-50/50">
      <div className="figma-container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-4">
             {isAr ? "أدوات المعلم" : "Teacher Tools"}
          </h2>
          <div className="w-24 h-1.5 rounded-full mx-auto mb-6" style={{ backgroundColor: COLORS.secondary }} />
          <p className="text-lg text-[#1A1A1A]/70 font-medium">
             {isAr ? "كل ما تحتاجه لإدارة حصتك بفعالية" : "Everything you need to manage your class effectively"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {tools.map((t, i) => (
              <Link
                key={i}
                href={t.href}
                className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#F2B522] transition-all group shadow-sm hover:shadow-md hover:-translate-y-1"
                data-testid={`link-tool-${i}`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#F2B522]/10 flex items-center justify-center text-[#F2B522] group-hover:scale-110 transition-transform shrink-0">
                   <t.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A]">{t.title}</h3>
             </Link>
           ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection({ isAr }: { isAr: boolean }) {
  const steps = [
    { title: isAr ? "سجل مجاناً" : "Sign Up Free", icon: CheckCircle },
    { title: isAr ? "أنشئ أو اختر نشاطاً" : "Create or Choose Activity", icon: Library },
    { title: isAr ? "شارك وتفاعل" : "Share and Interact", icon: MonitorPlay }
  ];
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="figma-container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-4">
             {isAr ? "كيف تعمل حصاد؟" : "How Hasaad Works?"}
          </h2>
          <div className="w-24 h-1.5 rounded-full mx-auto" style={{ backgroundColor: COLORS.secondary }} />
        </div>
        <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-8 md:gap-12 relative max-w-4xl mx-auto">
           <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-0.5 bg-gray-100 -z-10" />
           {steps.map((s, i) => (
             <div key={i} className="flex-1 flex flex-col items-center text-center w-full max-w-[250px]">
                <div className="w-16 h-16 rounded-2xl bg-[#257E4A] text-white flex items-center justify-center mb-6 shadow-lg shadow-[#257E4A]/20">
                   <s.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A]">{s.title}</h3>
             </div>
           ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ isAr }: { isAr: boolean }) {
  return (
    <section className="py-24 relative overflow-hidden" style={{ backgroundColor: COLORS.primary }}>
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
      <div className="figma-container relative z-10 text-center max-w-4xl mx-auto">
         <h2 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight">
            {isAr ? "جاهز لتحويل حصتك إلى تجربة لا تُنسى؟" : "Ready to turn your class into an unforgettable experience?"}
         </h2>
         <Link 
           href="/register?role=teacher" 
           className="inline-block px-10 py-4 rounded-xl font-black text-lg text-[#257E4A] transition-transform hover:-translate-y-1 shadow-xl"
           style={{ backgroundColor: COLORS.secondary }}
           data-testid="link-cta-register"
         >
            {isAr ? "انضم إلى حصاد الآن" : "Join Hasaad Now"}
         </Link>
      </div>
    </section>
  );
}

function StatisticsSection({ isAr }: { isAr: boolean }) {
  return (
    <section id="reports" className="w-full py-16 bg-white relative z-20">
      <div className="figma-container relative">
        <div className="flex flex-col items-center text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-4">
            {isAr ? "نموذج تقارير الأداء" : "Performance Reports Preview"}
          </h2>
          <div className="w-24 h-1.5 rounded-full" style={{ backgroundColor: COLORS.secondary }} />
        </div>
        
        <div className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          <div className="absolute top-4 start-4 bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-bold z-10 backdrop-blur-sm">
             {isAr ? "بيانات توضيحية للمعاينة فقط" : "Illustrative Preview Data Only"}
          </div>
          <img
            src={STATISTICS_IMG}
            alt={isAr ? "بيانات توضيحية لشكل تقارير حصاد" : "Illustrative preview of Hasaad reports"}
            className="w-full h-auto object-contain"
            loading="lazy"
            data-testid="img-statistics"
          />
        </div>
      </div>
    </section>
  );
}

function GamesSection({ isAr }: { isAr: boolean }) {
  const games = [
    {
      title: isAr ? "شد الحبل" : "Tug of War",
      desc: isAr ? "لعبة جماعية تنافسية لتعزيز المشاركة" : "Competitive team game to boost engagement",
      img: tugOfWarImg,
      color: "#FF6B6B"
    },
    {
      title: isAr ? "سباق الفضاء" : "Rocket Race",
      desc: isAr ? "تحدي السرعة والمعرفة بين الطلاب" : "Speed and knowledge challenge among students",
      img: rocketRaceImg,
      color: "#4D96FF"
    },
    {
      title: isAr ? "إكس أو التفاعلية" : "Interactive XO",
      desc: isAr ? "اللعبة الكلاسيكية بأسئلة المنهج" : "Classic game with curriculum questions",
      img: xoInteractiveImg,
      color: "#F2B522"
    }
  ];

  return (
    <section className="w-full py-20 bg-gray-50/50" id="games">
      <div className="figma-container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A] mb-4 leading-tight">
              {isAr ? "ألعاب تعليمية جاهزة تحول حصتك إلى متعة" : "Ready-made educational games turn your lesson into fun"}
            </h2>
            <p className="text-lg text-[#1A1A1A]/70 font-medium">
              {isAr
                ? "اختر من مكتبة الألعاب المتجددة وشاركها مع طلابك بنقرة واحدة."
                : "Choose from a growing library of games and share with your students in one click."}
            </p>
          </div>
          <Link
            href="/public/games"
            className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.primary }}
            data-testid="link-view-all-games"
          >
            {isAr ? "تصفح كل الألعاب" : "Browse All Games"}
            {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {games.map((game, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -8 }}
              className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col group cursor-pointer"
              data-testid={`card-game-${idx}`}
            >
              <div
                className="w-full aspect-[4/3] rounded-2xl mb-6 flex items-center justify-center overflow-hidden relative"
                style={{ backgroundColor: `${game.color}15` }}
              >
                <img
                  src={game.img}
                  alt={game.title}
                  className="w-3/4 h-auto object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <h3 className="text-2xl font-black text-[#1A1A1A] mb-2">{game.title}</h3>
              <p className="text-[#1A1A1A]/60 font-bold mb-4">{game.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MotivationSection({ isAr }: { isAr: boolean }) {
  return (
    <section id="motivation" className="w-full py-24 relative overflow-hidden bg-[#FDFFFC] border-y border-gray-100">
      <div className="figma-container relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-start text-[#1A1A1A] max-w-2xl mx-auto lg:mx-0">
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              {isAr ? "حفّز طلابك وتتبع تقدمهم بدقة" : "Motivate your students and track their progress accurately"}
            </h2>
            <p className="text-lg md:text-xl text-[#1A1A1A]/70 mb-10 font-medium">
              {isAr
                ? "لوحات شرف، أوسمة، وتقارير أداء شاملة تساعدك على بناء بيئة تنافسية إيجابية وتحقيق أهدافك التعليمية."
                : "Honor boards, badges, and comprehensive performance reports help you build a positive competitive environment."}
            </p>
            
            <Link
              href="/register?role=teacher"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xl transition-transform hover:-translate-y-1 shadow-md text-white"
              style={{ backgroundColor: COLORS.primary }}
              data-testid="link-motivation-register"
            >
              {isAr ? "ابدأ تجربتك الآن" : "Start Your Experience Now"}
            </Link>
          </div>
          
          <div className="flex-1 w-full max-w-[500px] lg:max-w-none">
            <motion.div
              initial={{ rotate: 5, scale: 0.9 }}
              whileInView={{ rotate: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
            >
              <img
                src={MOTIVATION_IMG}
                alt="Motivation Board Preview"
                className="w-full h-auto object-cover"
                loading="lazy"
                data-testid="img-motivation"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ isAr }: { isAr: boolean }) {
  return (
    <footer className="w-full bg-[#1A1A1A] pt-16 pb-8 border-t-4" style={{ borderColor: COLORS.secondary }}>
      <div className="figma-container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="inline-block mb-6 bg-white p-2 rounded-xl">
              <img
                src={LOGO_HORIZONTAL}
                alt="Hasaad Logo"
                className="h-10 w-auto"
                loading="lazy"
              />
            </Link>
            <p className="text-white/60 text-base max-w-sm font-medium leading-relaxed">
              {isAr
                ? "منصة عربية تجمع أدوات إعداد الدروس والمحتوى والألعاب والأنشطة التفاعلية للمعلم والطالب."
                : "An Arabic platform bringing lesson preparation, content, games, and interactive learning tools together."}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-black text-lg mb-6">{isAr ? "روابط هامة" : "Important Links"}</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-white/60 hover:text-white transition-colors font-bold" data-testid="link-footer-about">
                  {isAr ? "من نحن" : "About Us"}
                </Link>
              </li>
              <li>
                <Link href="/public/games" className="text-white/60 hover:text-white transition-colors font-bold" data-testid="link-footer-games">
                  {isAr ? "المسابقات" : "Quizzes"}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-white/60 hover:text-white transition-colors font-bold" data-testid="link-footer-faq">
                  {isAr ? "الأسئلة الشائعة" : "FAQ"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-black text-lg mb-6">{isAr ? "قانوني" : "Legal"}</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/terms" className="text-white/60 hover:text-white transition-colors font-bold" data-testid="link-footer-terms">
                  {isAr ? "شروط الاستخدام" : "Terms of Service"}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/60 hover:text-white transition-colors font-bold" data-testid="link-footer-privacy">
                  {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm font-bold">
            © {new Date().getFullYear()} {isAr ? "منصة حصاد. جميع الحقوق محفوظة." : "Hasaad Platform. All rights reserved."}
          </p>
          <div className="flex gap-4">
             <a href="https://twitter.com/hasaadx" target="_blank" rel="noreferrer" aria-label="X (Twitter)" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors" data-testid="link-social-x">
               <span className="text-white/60 font-bold">X</span>
             </a>
             <a href="mailto:support@hasaad.com" aria-label={isAr ? "التواصل مع الدعم" : "Contact support"} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors" data-testid="link-social-support">
               <span className="text-white/60 font-bold">@</span>
             </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
