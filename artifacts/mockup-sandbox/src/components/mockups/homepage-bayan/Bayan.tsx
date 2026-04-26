import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, ArrowRight, Play, Sparkles, Zap, BrainCircuit,
  Trophy, Users, Target, Shield, CheckCircle2, ChevronDown,
  Globe, LayoutDashboard, Code, Gamepad2, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// --- Translations ---
const translations = {
  ar: {
    nav: {
      login: "تسجيل الدخول",
      signup: "ابدأ مجاناً",
      features: "المميزات",
      games: "الألعاب",
      pricing: "الأسعار",
      switchLang: "English"
    },
    hero: {
      badge: "المنصة التعليمية الأسرع نمواً",
      title1: "التعليم بصيغته",
      title2: "الأكثر تشويقاً",
      subtitle: "منصة عربية بالكامل مصممة للمعلمين لإنشاء دروس تفاعلية، ألعاب حية، وتقييمات ذكية بالذكاء الاصطناعي في ثوانٍ.",
      ctaStart: "ابدأ مجاناً",
      ctaPin: "انضم بـ PIN",
      pinPlaceholder: "أدخل كود الـ PIN",
      pinButton: "انضمام",
      trusted: "يثق بنا أكثر من ١٢,٠٠٠ معلم و٣٢٠,٠٠٠ طالب"
    },
    features: {
      label: "المميزات",
      title: "صُممت لتمكين المعلم العربي",
      subtitle: "وداعاً للأدوات المعقدة والترجمات الركيكة. حصاد توفر لك كل ما تحتاجه في مكان واحد، بتجربة مستخدم عالمية.",
      items: [
        {
          title: "ألعاب تفاعلية حية",
          desc: "شد الحبل، سباق المعرفة، وتحدي الهاكر. حوّل فصلك إلى خلية من الحماس والمنافسة.",
          icon: Gamepad2
        },
        {
          title: "مساعد ذكاء اصطناعي",
          desc: "قم بتوليد أسئلة، امتحانات، ودروس كاملة من مجرد ملف PDF أو فكرة بسيطة في ثوانٍ.",
          icon: BrainCircuit
        },
        {
          title: "تقييم ذكي فوري",
          desc: "لأول مرة، تقييم آلي للأسئلة المقالية باللغة العربية بدقة متناهية.",
          icon: Target
        },
        {
          title: "تقارير تحليلية شاملة",
          desc: "تتبع أداء طلابك، اكتشف نقاط الضعف، وحسّن نتائجهم بقرارات مبنية على البيانات.",
          icon: LayoutDashboard
        }
      ]
    },
    gameModes: {
      label: "أنماط اللعب",
      title: "ليس مجرد كاهوت آخر",
      subtitle: "أنماط لعب جماعية مبتكرة تجعل الطلاب يتنافسون بحماس حقيقي.",
      modes: [
        { name: "شد الحبل", desc: "منافسة بين فريقين تعتمد على السرعة والدقة." },
        { name: "وضع الهاكر", desc: "اخترق دروع الخصم وأجب لتفوز بالنقاط." },
        { name: "البطاقات التعليمية", desc: "طريقة سريعة وفعالة لمراجعة المصطلحات." }
      ]
    },
    stats: {
      schools: "مدرسة معتمدة",
      teachers: "معلم مبدع",
      students: "طالب نشط",
      questions: "سؤال مجاب"
    },
    pricing: {
      label: "الأسعار",
      title: "خطة بسيطة، قيمة عظيمة",
      free: {
        name: "الباقة الأساسية",
        price: "مجلناً",
        desc: "كل ما تحتاجه للبدء",
        features: ["مشاركون غير محدودين", "ألعاب تفاعلية أساسية", "مساعد الذكاء الاصطناعي (محدود)"],
        cta: "ابدأ مجاناً"
      },
      pro: {
        name: "باقة المعلم المحترف",
        price: "٤٩",
        period: "ريال / شهرياً",
        desc: "للمعلمين الباحثين عن التميز",
        features: ["كل ميزات الباقة الأساسية", "أنماط لعب حصرية", "تقييم مقالي غير محدود", "تقارير متقدمة", "أولوية الدعم الفني"],
        cta: "اشترك الآن"
      }
    },
    faq: {
      title: "الأسئلة الشائعة",
      q1: "هل أحتاج لتحميل تطبيق لاستخدام حصاد؟",
      a1: "لا، حصاد تعمل مباشرة من المتصفح على أي جهاز (هاتف، جهاز لوحي، أو حاسوب). الطلاب يحتاجون فقط لكود PIN للانضمام.",
      q2: "هل المنصة تدعم المناهج العربية؟",
      a2: "نعم! حصاد مصممة خصيصاً لتتوافق مع المناهج العربية، وواجهة المستخدم والذكاء الاصطناعي مبرمجان ليفهما اللغة العربية بطلاقة.",
      q3: "هل يمكنني استخدام المنصة مجاناً؟",
      a3: "بالتأكيد، الباقة الأساسية مجانية بالكامل وتسمح لك بإنشاء دروس وألعاب لعدد غير محدود من الطلاب."
    },
    footer: {
      brand: "حصاد",
      desc: "نحو تعليم عربي أفضل.",
      rights: "جميع الحقوق محفوظة © 2024 منصة حصاد"
    }
  },
  en: {
    nav: {
      login: "Login",
      signup: "Start Free",
      features: "Features",
      games: "Games",
      pricing: "Pricing",
      switchLang: "العربية"
    },
    hero: {
      badge: "Fastest Growing EdTech Platform",
      title1: "Education in its",
      title2: "Most Engaging Form",
      subtitle: "A fully Arabic platform designed for teachers to create interactive lessons, live games, and AI-graded assessments in seconds.",
      ctaStart: "Start Free",
      ctaPin: "Join with PIN",
      pinPlaceholder: "Enter PIN code",
      pinButton: "Join",
      trusted: "Trusted by 12,000+ teachers and 320,000+ students"
    },
    features: {
      label: "Features",
      title: "Built to empower Arabic teachers",
      subtitle: "Goodbye complex tools and clunky translations. Hasad gives you everything in one place with a world-class UX.",
      items: [
        {
          title: "Live Interactive Games",
          desc: "Tug-of-War, Knowledge Race, and Hacker Mode. Turn your classroom into a hub of excitement.",
          icon: Gamepad2
        },
        {
          title: "AI Assistant",
          desc: "Generate questions, exams, and full lessons from a PDF or simple idea in seconds.",
          icon: BrainCircuit
        },
        {
          title: "Instant Smart Grading",
          desc: "For the first time, automated highly-accurate grading for short-answer questions in Arabic.",
          icon: Target
        },
        {
          title: "Comprehensive Analytics",
          desc: "Track student performance, spot weaknesses, and improve outcomes with data-driven decisions.",
          icon: LayoutDashboard
        }
      ]
    },
    gameModes: {
      label: "Game Modes",
      title: "Not just another Kahoot",
      subtitle: "Innovative multiplayer modes that get students genuinely competing.",
      modes: [
        { name: "Tug of War", desc: "Team vs Team competition relying on speed and accuracy." },
        { name: "Hacker Mode", desc: "Breach opponent shields and answer to win points." },
        { name: "Flashcards", desc: "Fast and effective way to review terminology." }
      ]
    },
    stats: {
      schools: "Verified Schools",
      teachers: "Creative Teachers",
      students: "Active Students",
      questions: "Questions Answered"
    },
    pricing: {
      label: "Pricing",
      title: "Simple Plans, Great Value",
      free: {
        name: "Basic Plan",
        price: "Free",
        desc: "Everything to get started",
        features: ["Unlimited participants", "Basic interactive games", "AI Assistant (Limited)"],
        cta: "Start Free"
      },
      pro: {
        name: "Pro Teacher",
        price: "49",
        period: "SAR / month",
        desc: "For teachers seeking excellence",
        features: ["All Basic features", "Exclusive game modes", "Unlimited short-answer grading", "Advanced reports", "Priority support"],
        cta: "Subscribe Now"
      }
    },
    faq: {
      title: "Frequently Asked Questions",
      q1: "Do I need to download an app?",
      a1: "No, Hasad works directly in the browser on any device. Students just need a PIN to join.",
      q2: "Does it support Arabic curricula?",
      a2: "Yes! Hasad is built specifically for Arabic education, with UI and AI tuned for fluent Arabic.",
      q3: "Can I use it for free?",
      a3: "Absolutely. The basic plan is completely free and allows unlimited students."
    },
    footer: {
      brand: "Hasad",
      desc: "Towards better Arabic education.",
      rights: "All rights reserved © 2024 Hasad Platform"
    }
  }
};

// --- Animations ---
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export function Bayan() {
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const isRtl = lang === "ar";
  const t = translations[lang];

  // Add the custom dark theme to document root to ensure Vercel-like styling
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.style.setProperty('--background', '0 0% 3%');
    document.documentElement.style.setProperty('--foreground', '0 0% 98%');
    document.documentElement.style.setProperty('--primary', '152 76% 53%'); // Emerald/Neon Green
    document.documentElement.style.setProperty('--primary-foreground', '0 0% 0%');
    document.documentElement.style.setProperty('--border', '0 0% 15%');
    document.documentElement.style.setProperty('--card', '0 0% 6%');
    
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [isRtl]);

  const toggleLang = () => setLang(l => l === "ar" ? "en" : "ar");
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary overflow-hidden ${isRtl ? 'font-arabic' : ''}`}>
      {/* Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="sticky top-0 w-full backdrop-blur-xl bg-background/70 border-b border-border/50 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-black font-bold text-xl">ح</div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">{t.footer.brand}</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">{t.nav.features}</a>
              <a href="#games" className="hover:text-foreground transition-colors">{t.nav.games}</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</a>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={toggleLang} className="text-sm text-muted-foreground hover:text-foreground font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t.nav.switchLang}
              </button>
              <div className="hidden sm:block w-px h-4 bg-border" />
              <Button variant="ghost" className="hidden sm:inline-flex">{t.nav.login}</Button>
              <Button className="bg-primary text-black hover:bg-primary/90">{t.nav.signup}</Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-24 pb-32 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
            
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-3xl flex flex-col items-center">
              <motion.div variants={fadeUp}>
                <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/5 px-4 py-1.5 backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 mr-2 inline-block" style={{marginRight: isRtl ? 0 : '0.5rem', marginLeft: isRtl ? '0.5rem' : 0}} />
                  {t.hero.badge}
                </Badge>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                {t.hero.title1} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">{t.hero.title2}</span>
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                {t.hero.subtitle}
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-stretch gap-4 w-full sm:w-auto">
                <Button size="lg" className="bg-primary text-black hover:bg-primary/90 h-14 px-8 text-lg font-bold rounded-xl w-full sm:w-auto">
                  {t.hero.ctaStart}
                  <ArrowIcon className="ml-2 w-5 h-5" style={{marginRight: isRtl ? '0.5rem' : 0, marginLeft: isRtl ? 0 : '0.5rem'}} />
                </Button>
                
                <div className="flex relative items-center w-full sm:w-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-xl blur-md" />
                  <div className="relative flex items-center bg-card border border-border rounded-xl h-14 p-1 w-full">
                    <Input 
                      placeholder={t.hero.pinPlaceholder}
                      className="border-0 bg-transparent focus-visible:ring-0 text-lg h-full font-mono text-center tracking-widest w-40"
                      maxLength={6}
                    />
                    <Button variant="secondary" className="h-full rounded-lg font-bold bg-white text-black hover:bg-neutral-200">
                      {t.hero.pinButton}
                    </Button>
                  </div>
                </div>
              </motion.div>

              <motion.p variants={fadeUp} className="mt-8 text-sm text-muted-foreground font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t.hero.trusted}
              </motion.p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="mt-20 w-full relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-full" />
              <img 
                src="/__mockup/images/homepage-bayan-hero.png" 
                alt="HasadX UI Mockup" 
                className="w-full max-w-5xl mx-auto rounded-2xl border border-border/50 shadow-2xl shadow-primary/10 object-cover"
              />
            </motion.div>
          </div>
        </section>

        {/* Logos/Trust */}
        <section className="py-12 border-y border-border/30 bg-background/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/30" style={{direction: 'ltr'}}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">400+</span>
                <span className="text-sm text-muted-foreground">{t.stats.schools}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">12k+</span>
                <span className="text-sm text-muted-foreground">{t.stats.teachers}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">320k+</span>
                <span className="text-sm text-muted-foreground">{t.stats.students}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">5M+</span>
                <span className="text-sm text-muted-foreground">{t.stats.questions}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-primary font-bold tracking-wider uppercase text-sm mb-3">{t.features.label}</h2>
              <h3 className="text-3xl md:text-5xl font-bold mb-6 text-white">{t.features.title}</h3>
              <p className="text-lg text-muted-foreground">{t.features.subtitle}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {t.features.items.map((item, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className="bg-card border border-border/50 p-8 rounded-2xl hover:border-primary/50 transition-colors group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                  <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center mb-6 text-white group-hover:text-primary transition-colors">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-3 text-white">{item.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Alternating Mockups */}
        <section id="games" className="py-24 px-6 overflow-hidden bg-background">
          <div className="max-w-7xl mx-auto">
            {/* Block 1 */}
            <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                <img src="/__mockup/images/homepage-bayan-game-modes.png" alt="Game Modes" className="relative rounded-2xl border border-border shadow-2xl" />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-primary font-bold tracking-wider uppercase text-sm mb-3">{t.gameModes.label}</h2>
                <h3 className="text-3xl md:text-4xl font-bold mb-6 text-white">{t.gameModes.title}</h3>
                <p className="text-lg text-muted-foreground mb-8">{t.gameModes.subtitle}</p>
                <ul className="space-y-6">
                  {t.gameModes.modes.map((mode, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="mt-1 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">{mode.name}</h4>
                        <p className="text-sm text-muted-foreground">{mode.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Block 2 */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-blue-400 font-bold tracking-wider uppercase text-sm mb-3">AI Assistant</h2>
                <h3 className="text-3xl md:text-4xl font-bold mb-6 text-white">Your Copilot for Content</h3>
                <p className="text-lg text-muted-foreground mb-8">
                  {isRtl 
                    ? "قم بتحويل أي نص، مستند PDF، أو فكرة إلى اختبار كامل في ثوانٍ. المساعد الذكي يكتب الأسئلة، يحدد الإجابات، ويقيم إجابات الطلاب المقالية بدقة مذهلة."
                    : "Turn any text, PDF, or idea into a full quiz in seconds. The AI Assistant writes questions, sets answers, and grades student short-answers with stunning accuracy."}
                </p>
                <Button variant="outline" className="border-border hover:bg-card">
                  {isRtl ? "اكتشف الذكاء الاصطناعي" : "Explore AI Features"}
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full" />
                <img src="/__mockup/images/homepage-bayan-ai-tutor.png" alt="AI Tutor" className="relative rounded-2xl border border-border shadow-2xl" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-32 px-6 bg-card border-y border-border/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-primary font-bold tracking-wider uppercase text-sm mb-3">{t.pricing.label}</h2>
              <h3 className="text-3xl md:text-5xl font-bold mb-6 text-white">{t.pricing.title}</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free */}
              <div className="bg-background border border-border p-8 rounded-3xl flex flex-col">
                <h4 className="text-xl font-bold text-white mb-2">{t.pricing.free.name}</h4>
                <p className="text-muted-foreground mb-6">{t.pricing.free.desc}</p>
                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-white">{t.pricing.free.price}</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {t.pricing.free.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-5 h-5 text-primary/70 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline">{t.pricing.free.cta}</Button>
              </div>

              {/* Pro */}
              <div className="bg-background border-2 border-primary/50 relative p-8 rounded-3xl flex flex-col shadow-[0_0_40px_-10px_rgba(20,184,104,0.3)]">
                <div className="absolute top-0 right-8 -translate-y-1/2">
                  <span className="bg-primary text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Popular</span>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">{t.pricing.pro.name}</h4>
                <p className="text-muted-foreground mb-6">{t.pricing.pro.desc}</p>
                <div className="mb-8 flex items-baseline gap-2" style={{direction: isRtl ? 'rtl' : 'ltr'}}>
                  <span className="text-4xl font-extrabold text-white">{t.pricing.pro.price}</span>
                  <span className="text-muted-foreground">{t.pricing.pro.period}</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {t.pricing.pro.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-primary text-black hover:bg-primary/90">{t.pricing.pro.cta}</Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-32 px-6">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-3xl font-bold mb-10 text-center text-white">{t.faq.title}</h3>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-border">
                <AccordionTrigger className="text-lg font-bold text-white hover:text-primary">{t.faq.q1}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {t.faq.a1}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-border">
                <AccordionTrigger className="text-lg font-bold text-white hover:text-primary">{t.faq.q2}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {t.faq.a2}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border-border border-b-0">
                <AccordionTrigger className="text-lg font-bold text-white hover:text-primary">{t.faq.q3}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {t.faq.a3}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-24 px-6 border-t border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-8 text-white">
              {isRtl ? "مستعد لتحويل فصلك؟" : "Ready to transform your classroom?"}
            </h2>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" className="bg-primary text-black hover:bg-primary/90 h-14 px-8 text-lg font-bold rounded-xl w-full sm:w-auto">
                {t.hero.ctaStart}
                <ArrowIcon className="ml-2 w-5 h-5" style={{marginRight: isRtl ? '0.5rem' : 0, marginLeft: isRtl ? 0 : '0.5rem'}} />
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-background border-t border-border py-12 px-6 text-sm text-muted-foreground text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-black font-bold text-xs">ح</div>
            <span className="font-bold text-white">{t.footer.brand}</span>
          </div>
          <p className="mb-4">{t.footer.desc}</p>
          <p>{t.footer.rights}</p>
        </footer>

      </div>
    </div>
  );
}
