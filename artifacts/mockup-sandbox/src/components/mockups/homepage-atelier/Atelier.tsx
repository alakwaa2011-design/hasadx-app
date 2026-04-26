import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Globe,
  Gamepad2,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// --- Language Dictionary ---
const dict = {
  ar: {
    nav: {
      product: "المنتج",
      solutions: "الحلول",
      pricing: "الباقات",
      resources: "المصادر",
      login: "تسجيل الدخول",
      startFree: "ابدأ مجاناً",
    },
    hero: {
      badge: "الجيل الجديد من منصات التعليم",
      title: "تعليم عربي يواكب المستقبل",
      subtitle:
        "منصة متكاملة مصممة خصيصاً للمعلم العربي. أنشئ دروساً تفاعلية، أدر فصولك بذكاء، واجعل التعلم تجربة لا تُنسى لطلابك.",
      startFree: "ابدأ مجاناً",
      joinPin: "انضم بـ PIN",
      pinPlaceholder: "أدخل كود اللعبة (6 أرقام)",
      join: "انضم",
    },
    stats: {
      teachers: "أكثر من 12,000",
      teachersLabel: "معلم ومعلمة",
      students: "320,000+",
      studentsLabel: "طالب نشط",
      schools: "850+",
      schoolsLabel: "مدرسة معتمدة",
    },
    features: {
      title: "أدوات متطورة، واجهة بسيطة",
      subtitle: "كل ما تحتاجه لإدارة فصلك الدراسي في مكان واحد، بدون تعقيد.",
      items: [
        {
          title: "مساعد الذكاء الاصطناعي",
          desc: "أنشئ أسئلة، لخص دروساً، وقم بتقييم الإجابات القصيرة آلياً بدقة متناهية.",
        },
        {
          title: "ألعاب تعليمية تفاعلية",
          desc: "حول المراجعة إلى تحديات ممتعة مثل شد الحبل وسباق المعلومات.",
        },
        {
          title: "تقارير وتحليلات فورية",
          desc: "تابع أداء طلابك خطوة بخطوة مع لوحات معلومات ذكية ومفصلة.",
        },
      ],
    },
    ai: {
      badge: "الذكاء الاصطناعي",
      title: "مساعدك الشخصي في التحضير والتقييم",
      desc: "وفر ساعات من وقتك أسبوعياً. دع الذكاء الاصطناعي يساعدك في صياغة الأسئلة، تقييم الإجابات المقالية، وتحليل أداء الطلاب بضغطة زر.",
      cta: "استكشف الميزات الذكية",
    },
    games: {
      badge: "تفاعل لا محدود",
      title: "لأن التعلم يجب أن يكون ممتعاً",
      desc: "تجاوز الطرق التقليدية. قدم دروسك عبر مسابقات تفاعلية وبطاقات تعليمية ذكية تضمن اندماج جميع الطلاب في الفصل.",
      modes: ["شد الحبل", "وضع الاختراق", "سباق الأسئلة", "البطاقات الذكية"],
    },
    pricing: {
      title: "باقات تناسب الجميع",
      subtitle: "ابدأ مجاناً وقم بالترقية عندما تحتاج إلى المزيد من الميزات.",
      free: {
        title: "الأساسية",
        price: "مجاناً",
        desc: "مثالية للمعلمين في بداية رحلتهم.",
        cta: "ابدأ الآن",
        features: ["عدد غير محدود من الطلاب", "ألعاب تفاعلية أساسية", "تقارير مبسطة"],
      },
      pro: {
        title: "الاحترافية",
        price: "٤٩",
        period: "ريال / شهرياً",
        desc: "للمعلمين الذين يبحثون عن أدوات متقدمة.",
        cta: "جرب مجاناً لـ ١٤ يوماً",
        features: [
          "كل ميزات الباقة الأساسية",
          "مساعد الذكاء الاصطناعي (لامحدود)",
          "تحليلات متقدمة وتصدير الدرجات",
          "أولوية الدعم الفني",
        ],
      },
    },
    faq: {
      title: "أسئلة شائعة",
      q1: "هل يحتاج الطلاب لإنشاء حساب؟",
      a1: "لا، يمكن للطلاب الانضمام إلى الألعاب والدروس مباشرة عبر إدخال كود (PIN) مكون من 6 أرقام دون الحاجة لتسجيل الدخول.",
      q2: "هل تدعم المنصة اللغة العربية بشكل كامل؟",
      a2: "نعم، حصاد مبنية من الصفر لتكون منصة عربية أصيلة، تدعم الكتابة من اليمين لليسار بشكل مثالي وليست مجرد واجهة مترجمة.",
      q3: "كيف يعمل التقييم بالذكاء الاصطناعي؟",
      a3: "يقوم نظامنا المدرب على المناهج العربية بتحليل الإجابات النصية القصيرة للطلاب ومطابقتها مع الإجابة النموذجية التي يضعها المعلم، مع تقديم ملاحظات تصحيحية.",
    },
    cta: {
      title: "مستعد لتحويل فصلك الدراسي؟",
      desc: "انضم إلى آلاف المعلمين الذين يثقون في حصاد لتقديم تجربة تعليمية استثنائية.",
      button: "سجل حسابك مجاناً",
    },
    footer: {
      rights: "جميع الحقوق محفوظة منصة حصاد © 2024",
    },
  },
  en: {
    nav: {
      product: "Product",
      solutions: "Solutions",
      pricing: "Pricing",
      resources: "Resources",
      login: "Log in",
      startFree: "Start for free",
    },
    hero: {
      badge: "The Next Generation of Education",
      title: "Future-Ready Arabic Education",
      subtitle:
        "A comprehensive platform built specifically for the Arab teacher. Create interactive lessons, manage classes intelligently, and make learning unforgettable.",
      startFree: "Start for free",
      joinPin: "Join with PIN",
      pinPlaceholder: "Enter 6-digit game PIN",
      join: "Join",
    },
    stats: {
      teachers: "12,000+",
      teachersLabel: "Teachers",
      students: "320,000+",
      studentsLabel: "Active Students",
      schools: "850+",
      schoolsLabel: "Certified Schools",
    },
    features: {
      title: "Advanced Tools, Simple Interface",
      subtitle: "Everything you need to manage your classroom in one place, without the complexity.",
      items: [
        {
          title: "AI Assistant",
          desc: "Generate questions, summarize lessons, and automatically grade short answers with high precision.",
        },
        {
          title: "Interactive Games",
          desc: "Turn reviews into fun challenges like Tug-of-War and Quiz Races.",
        },
        {
          title: "Real-time Analytics",
          desc: "Track student performance step-by-step with smart, detailed dashboards.",
        },
      ],
    },
    ai: {
      badge: "Artificial Intelligence",
      title: "Your Personal Prep & Grading Assistant",
      desc: "Save hours every week. Let AI help you draft questions, grade essay answers, and analyze student performance with a single click.",
      cta: "Explore AI Features",
    },
    games: {
      badge: "Limitless Engagement",
      title: "Because Learning Should Be Fun",
      desc: "Go beyond traditional methods. Deliver your lessons through interactive competitions and smart flashcards that guarantee full classroom engagement.",
      modes: ["Tug of War", "Hack Mode", "Quiz Race", "Smart Flashcards"],
    },
    pricing: {
      title: "Plans for Everyone",
      subtitle: "Start for free and upgrade when you need more features.",
      free: {
        title: "Basic",
        price: "Free",
        desc: "Perfect for teachers just starting out.",
        cta: "Start Now",
        features: ["Unlimited Students", "Basic Interactive Games", "Simplified Reports"],
      },
      pro: {
        title: "Pro",
        price: "49",
        period: "SAR / month",
        desc: "For teachers looking for advanced tools.",
        cta: "Try 14 Days Free",
        features: [
          "All Basic features",
          "Unlimited AI Assistant",
          "Advanced Analytics & Export",
          "Priority Support",
        ],
      },
    },
    faq: {
      title: "Frequently Asked Questions",
      q1: "Do students need to create an account?",
      a1: "No, students can join games and lessons directly by entering a 6-digit PIN code without logging in.",
      q2: "Does the platform fully support Arabic?",
      a2: "Yes, HasadX is built from the ground up as a native Arabic platform, perfectly supporting RTL and not just a translated interface.",
      q3: "How does AI grading work?",
      a3: "Our system, trained on Arabic curricula, analyzes students' short text answers and matches them with the teacher's model answer, providing corrective feedback.",
    },
    cta: {
      title: "Ready to Transform Your Classroom?",
      desc: "Join thousands of teachers who trust HasadX to deliver an exceptional learning experience.",
      button: "Sign Up for Free",
    },
    footer: {
      rights: "All rights reserved HasadX Platform © 2024",
    },
  },
};

// --- Theme Config ---
// Using a Stripe/Vercel inspired minimalistic SaaS theme with a custom emerald brand color
const themeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');

  .atelier-theme {
    --brand-emerald: 165 75% 25%; /* Deep, slightly desaturated emerald */
    --brand-emerald-light: 165 75% 95%;
    --brand-emerald-dark: 165 80% 15%;
    --bg-main: 0 0% 100%;
    --bg-subtle: 210 20% 98%;
    --text-main: 220 30% 10%;
    --text-muted: 220 15% 45%;
    --border-subtle: 220 15% 90%;
    
    font-family: 'Tajawal', sans-serif;
    background-color: hsl(var(--bg-main));
    color: hsl(var(--text-main));
  }

  .atelier-theme .text-brand { color: hsl(var(--brand-emerald)); }
  .atelier-theme .bg-brand { background-color: hsl(var(--brand-emerald)); }
  .atelier-theme .bg-brand-light { background-color: hsl(var(--brand-emerald-light)); }
  .atelier-theme .border-brand { border-color: hsl(var(--brand-emerald)); }

  /* Premium subtle noise texture */
  .noise-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none;
    z-index: 50;
    opacity: 0.015;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  }
`;

export function Atelier() {
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const t = dict[lang];
  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");

  return (
    <div className="atelier-theme min-h-screen relative selection:bg-brand-light selection:text-brand" dir={dir}>
      <style>{themeStyles}</style>
      <div className="noise-overlay" />

      {/* --- Navigation --- */}
      <nav
        className={`fixed top-0 w-full z-40 transition-all duration-300 border-b ${
          isScrolled
            ? "bg-white/80 backdrop-blur-md border-border-subtle shadow-sm py-3"
            : "bg-transparent border-transparent py-5"
        }`}
      >
        <div className="container mx-auto px-6 max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
                <Sparkles className="text-white w-4 h-4" />
              </div>
              <span className="font-black text-2xl tracking-tight text-[hsl(var(--text-main))]">
                حصاد
              </span>
            </div>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-8">
              {["product", "solutions", "pricing", "resources"].map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  className="text-sm font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-main))] transition-colors"
                >
                  {t.nav[item as keyof typeof t.nav]}
                </a>
              ))}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleLang}
              className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-main))] transition-colors px-2 py-1 rounded-md hover:bg-[hsl(var(--bg-subtle))]"
            >
              <Globe className="w-4 h-4" />
              {lang === "ar" ? "English" : "العربية"}
            </button>
            <a
              href="/auth"
              className="text-sm font-medium text-[hsl(var(--text-main))] hover:text-[hsl(var(--text-muted))] transition-colors"
            >
              {t.nav.login}
            </a>
            <Button className="bg-brand hover:bg-[hsl(var(--brand-emerald-dark))] text-white rounded-full px-6 shadow-sm">
              {t.nav.startFree}
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-[hsl(var(--text-main))]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-30 bg-white pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6 text-lg font-medium">
              {["product", "solutions", "pricing", "resources"].map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[hsl(var(--text-main))]"
                >
                  {t.nav[item as keyof typeof t.nav]}
                </a>
              ))}
              <hr className="border-[hsl(var(--border-subtle))]" />
              <button onClick={toggleLang} className="flex items-center gap-2 text-left">
                <Globe className="w-5 h-5" />
                {lang === "ar" ? "Switch to English" : "تغيير إلى العربية"}
              </button>
              <a href="/auth" className="text-[hsl(var(--text-main))]">
                {t.nav.login}
              </a>
              <Button className="bg-brand text-white rounded-full w-full py-6 text-lg">
                {t.nav.startFree}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-32 pb-20 overflow-hidden">
        {/* --- Hero Section --- */}
        <section className="container mx-auto px-6 max-w-7xl relative">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[hsl(var(--brand-emerald-light))] rounded-full blur-[120px] opacity-50 -z-10" />

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--bg-subtle))] border border-[hsl(var(--border-subtle))] text-sm font-medium text-[hsl(var(--text-muted))] mb-6">
                <span className="w-2 h-2 rounded-full bg-brand" />
                {t.hero.badge}
              </div>
              <h1 className="text-5xl lg:text-[72px] leading-[1.1] font-black text-[hsl(var(--text-main))] mb-6 tracking-tight">
                {t.hero.title}
              </h1>
              <p className="text-lg lg:text-xl text-[hsl(var(--text-muted))] leading-relaxed mb-10 max-w-lg">
                {t.hero.subtitle}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Button className="bg-brand hover:bg-[hsl(var(--brand-emerald-dark))] text-white rounded-full px-8 py-6 text-base shadow-lg shadow-[hsl(var(--brand-emerald))]/20 transition-all hover:scale-[1.02]">
                  {t.hero.startFree}
                </Button>
                
                <div className="relative flex-1 max-w-[280px]">
                  <div className="absolute inset-y-0 flex items-center px-4 pointer-events-none text-[hsl(var(--text-muted))]">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <Input
                    type="text"
                    placeholder={t.hero.pinPlaceholder}
                    className={`pl-12 pr-4 py-6 rounded-full border-[hsl(var(--border-subtle))] bg-white shadow-sm focus-visible:ring-brand text-center tracking-[0.2em] font-mono text-lg h-auto ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                    maxLength={6}
                  />
                  <Button 
                    variant="ghost" 
                    className={`absolute inset-y-1 rounded-full text-brand hover:bg-brand-light font-bold ${isRtl ? 'left-1' : 'right-1'}`}
                  >
                    {t.hero.join}
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-[hsl(var(--border-subtle))] shadow-2xl shadow-black/5 bg-white/50 backdrop-blur-sm p-2">
                <img
                  src="/__mockup/images/homepage-atelier-hero.png"
                  alt="Dashboard Preview"
                  className="w-full h-auto rounded-xl border border-[hsl(var(--border-subtle))]"
                />
              </div>
              
              {/* Decorative floating elements */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute -top-6 ${isRtl ? '-right-6' : '-left-6'} bg-white p-4 rounded-xl shadow-xl border border-[hsl(var(--border-subtle))] flex items-center gap-3`}
              >
                <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">مدرسة الفيصلية</div>
                  <div className="text-xs text-[hsl(var(--text-muted))]">تم الانضمام للدرس</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* --- Social Proof / Stats --- */}
        <section className="container mx-auto px-6 max-w-7xl mt-32">
          <div className="border-y border-[hsl(var(--border-subtle))] py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[hsl(var(--border-subtle))]">
            <div className="px-4">
              <div className="text-4xl font-black text-brand mb-2">{t.stats.teachers}</div>
              <div className="text-[hsl(var(--text-muted))] font-medium">{t.stats.teachersLabel}</div>
            </div>
            <div className="px-4 pt-8 md:pt-0">
              <div className="text-4xl font-black text-brand mb-2">{t.stats.students}</div>
              <div className="text-[hsl(var(--text-muted))] font-medium">{t.stats.studentsLabel}</div>
            </div>
            <div className="px-4 pt-8 md:pt-0">
              <div className="text-4xl font-black text-brand mb-2">{t.stats.schools}</div>
              <div className="text-[hsl(var(--text-muted))] font-medium">{t.stats.schoolsLabel}</div>
            </div>
          </div>
        </section>

        {/* --- Core Value Props --- */}
        <section className="container mx-auto px-6 max-w-7xl mt-32">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-black mb-6 tracking-tight">{t.features.title}</h2>
            <p className="text-lg text-[hsl(var(--text-muted))]">{t.features.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.features.items.map((item, idx) => {
              const icons = [BrainCircuit, Gamepad2, LayoutDashboard];
              const Icon = icons[idx];
              return (
                <div key={idx} className="group p-8 rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-subtle))] hover:bg-white hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[hsl(var(--border-subtle))] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:text-brand transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-[hsl(var(--text-muted))] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* --- Feature Deep Dive: AI --- */}
        <section className="container mx-auto px-6 max-w-7xl mt-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className={`order-2 lg:order-${isRtl ? '2' : '1'}`}>
              <div className="rounded-2xl overflow-hidden border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-subtle))] p-8">
                <img 
                  src="/__mockup/images/homepage-atelier-ai.png" 
                  alt="AI Assistant UI" 
                  className="w-full h-auto rounded-lg shadow-sm border border-[hsl(var(--border-subtle))]"
                />
              </div>
            </div>
            <div className={`order-1 lg:order-${isRtl ? '1' : '2'}`}>
              <div className="text-sm font-bold text-brand mb-4">{t.ai.badge}</div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight leading-[1.2]">{t.ai.title}</h2>
              <p className="text-lg text-[hsl(var(--text-muted))] mb-8 leading-relaxed">
                {t.ai.desc}
              </p>
              <Button variant="outline" className="rounded-full px-6 font-semibold hover:text-brand hover:border-brand transition-colors">
                {t.ai.cta} {isRtl ? <ArrowLeft className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              </Button>
            </div>
          </div>
        </section>

        {/* --- Feature Deep Dive: Games --- */}
        <section className="container mx-auto px-6 max-w-7xl mt-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-sm font-bold text-brand mb-4">{t.games.badge}</div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight leading-[1.2]">{t.games.title}</h2>
              <p className="text-lg text-[hsl(var(--text-muted))] mb-8 leading-relaxed">
                {t.games.desc}
              </p>
              <ul className="space-y-4 mb-8">
                {t.games.modes.map((mode, idx) => (
                  <li key={idx} className="flex items-center gap-3 font-medium">
                    <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center text-brand">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    {mode}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="rounded-2xl overflow-hidden border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-subtle))] p-8">
                <img 
                  src="/__mockup/images/homepage-atelier-games.png" 
                  alt="Gamified Learning" 
                  className="w-full h-auto rounded-lg shadow-sm border border-[hsl(var(--border-subtle))]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* --- Pricing Teaser --- */}
        <section className="container mx-auto px-6 max-w-5xl mt-40">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">{t.pricing.title}</h2>
            <p className="text-lg text-[hsl(var(--text-muted))]">{t.pricing.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <div className="p-8 rounded-3xl border border-[hsl(var(--border-subtle))] bg-white flex flex-col">
              <h3 className="text-2xl font-bold mb-2">{t.pricing.free.title}</h3>
              <p className="text-[hsl(var(--text-muted))] mb-6">{t.pricing.free.desc}</p>
              <div className="text-5xl font-black mb-8">{t.pricing.free.price}</div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {t.pricing.free.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[hsl(var(--text-muted))]">
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--border-subtle))]" />
                    {feat}
                  </li>
                ))}
              </ul>
              
              <Button variant="outline" className="w-full rounded-full py-6 text-lg font-bold">
                {t.pricing.free.cta}
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 rounded-3xl border border-brand bg-brand-light relative flex flex-col">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand text-white px-4 py-1 rounded-full text-sm font-bold">
                الأكثر شيوعاً
              </div>
              <h3 className="text-2xl font-bold mb-2 text-brand">{t.pricing.pro.title}</h3>
              <p className="text-[hsl(var(--text-muted))] mb-6">{t.pricing.pro.desc}</p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl font-black text-brand">{t.pricing.pro.price}</span>
                <span className="text-[hsl(var(--text-muted))] font-medium">{t.pricing.pro.period}</span>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {t.pricing.pro.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-3 font-medium text-brand">
                    <CheckCircle2 className="w-5 h-5" />
                    {feat}
                  </li>
                ))}
              </ul>
              
              <Button className="w-full bg-brand hover:bg-[hsl(var(--brand-emerald-dark))] text-white rounded-full py-6 text-lg font-bold shadow-lg shadow-brand/20">
                {t.pricing.pro.cta}
              </Button>
            </div>
          </div>
        </section>

        {/* --- FAQ --- */}
        <section className="container mx-auto px-6 max-w-3xl mt-40">
          <h2 className="text-3xl font-black mb-10 text-center">{t.faq.title}</h2>
          <Accordion type="single" collapsible className="w-full text-[hsl(var(--text-main))]">
            <AccordionItem value="item-1" className="border-[hsl(var(--border-subtle))]">
              <AccordionTrigger className="text-lg font-bold hover:text-brand hover:no-underline text-right py-6">
                {t.faq.q1}
              </AccordionTrigger>
              <AccordionContent className="text-[hsl(var(--text-muted))] text-base leading-relaxed pb-6">
                {t.faq.a1}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-[hsl(var(--border-subtle))]">
              <AccordionTrigger className="text-lg font-bold hover:text-brand hover:no-underline text-right py-6">
                {t.faq.q2}
              </AccordionTrigger>
              <AccordionContent className="text-[hsl(var(--text-muted))] text-base leading-relaxed pb-6">
                {t.faq.a2}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-[hsl(var(--border-subtle))] border-b-0">
              <AccordionTrigger className="text-lg font-bold hover:text-brand hover:no-underline text-right py-6">
                {t.faq.q3}
              </AccordionTrigger>
              <AccordionContent className="text-[hsl(var(--text-muted))] text-base leading-relaxed pb-6">
                {t.faq.a3}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* --- Final CTA --- */}
        <section className="container mx-auto px-6 max-w-5xl mt-40">
          <div className="bg-[hsl(var(--text-main))] rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
            {/* Abstract bg shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand rounded-full blur-[100px] opacity-50" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20" />
            
            <div className="relative z-10 max-w-2xl mx-auto text-white">
              <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">{t.cta.title}</h2>
              <p className="text-lg text-[hsl(var(--text-muted))] mb-10">
                {t.cta.desc}
              </p>
              <Button className="bg-brand hover:bg-[hsl(var(--brand-emerald-light))] hover:text-brand text-white rounded-full px-10 py-7 text-lg font-bold transition-colors">
                {t.cta.button}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* --- Footer --- */}
      <footer className="border-t border-[hsl(var(--border-subtle))] py-12 mt-20">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[hsl(var(--border-subtle))] flex items-center justify-center">
              <Sparkles className="text-[hsl(var(--text-muted))] w-3 h-3" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[hsl(var(--text-main))]">
              حصاد
            </span>
          </div>
          <div className="text-sm text-[hsl(var(--text-muted))] font-medium">
            {t.footer.rights}
          </div>
          <div className="flex gap-4">
            {["Twitter", "LinkedIn", "YouTube"].map((social) => (
              <a key={social} href="#" className="w-10 h-10 rounded-full bg-[hsl(var(--bg-subtle))] flex items-center justify-center text-[hsl(var(--text-muted))] hover:text-brand hover:bg-brand-light transition-colors">
                <span className="sr-only">{social}</span>
                <div className="w-4 h-4 bg-current" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
