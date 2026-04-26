import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, Users, Trophy, ChevronLeft, ChevronRight, 
  Play, Globe, CheckCircle2, ArrowRight, ArrowLeft, Gamepad2, 
  BrainCircuit, LayoutDashboard, LogIn, Menu, X
} from 'lucide-react';
import './_group.css';

// Translations
const t = {
  ar: {
    nav: {
      features: "المميزات",
      howItWorks: "كيف يعمل",
      pricing: "الأسعار",
      login: "تسجيل الدخول",
      register: "ابدأ مجاناً",
      joinPin: "انضم بـ PIN",
    },
    hero: {
      badge: "تعليم عربي حقيقي 🌟",
      title: "منصة حصاد",
      subtitle: "حيث يزهر التعليم وتثمر المعرفة",
      description: "المنصة التعليمية الأولى المصممة خصيصاً للمعلم والطالب العربي. صمم دروساً تفاعلية، أدر ألعاباً تعليمية حماسية، واستعن بالذكاء الاصطناعي لتقييم الإجابات.",
      ctaPrimary: "ابدأ مجاناً كمعلم",
      ctaSecondary: "لديك رمز؟ انضم كطالب",
    },
    join: {
      title: "جاهز للتحدي؟",
      subtitle: "أدخل رمز الدخول المكون من 6 أرقام للإنضمام إلى الدرس أو اللعبة فوراً.",
      placeholder: "مثال: 123456",
      button: "انضم الآن",
    },
    features: {
      title: "أكثر من مجرد أسئلة",
      subtitle: "أدوات متكاملة تجعل من كل درس تجربة لا تُنسى",
      items: [
        {
          icon: <Gamepad2 className="w-6 h-6" />,
          title: "ألعاب تفاعلية حية",
          desc: "شد الحبل، وضع الاختراق، وسباق المعرفة. ألعاب تحول المراجعة إلى متعة حقيقية يتنافس فيها الطلاب بشغف."
        },
        {
          icon: <BrainCircuit className="w-6 h-6" />,
          title: "مساعد الذكاء الاصطناعي",
          desc: "وفر وقتك! يقوم المساعد ببناء الدروس وتوليد الأسئلة وتقييم الإجابات المقالية للطلاب بدقة فائقة."
        },
        {
          icon: <LayoutDashboard className="w-6 h-6" />,
          title: "تقارير شاملة ومباشرة",
          desc: "تابع أداء طلابك لحظة بلحظة. تقارير تفصيلية تساعدك على تحديد نقاط القوة والضعف لكل طالب."
        }
      ]
    },
    howItWorks: {
      title: "كيف يعمل حصاد؟",
      steps: [
        { title: "صمم درسك", desc: "استخدم الذكاء الاصطناعي أو قوالبنا الجاهزة لإنشاء محتوى تفاعلي في دقائق." },
        { title: "شارك الرمز", desc: "يحصل الطلاب على رمز PIN مكون من 6 أرقام للدخول بدون الحاجة لإنشاء حسابات." },
        { title: "ابدأ المتعة", desc: "شاهد تفاعل طلابك المباشر مع الأنشطة، وقيّم استيعابهم فوراً." }
      ]
    },
    stats: {
      title: "يثق بنا المعلمون في كل مكان",
      teachers: "أكثر من 12,000",
      teachersLabel: "معلم ومعلمة",
      students: "320,000+",
      studentsLabel: "طالب مستفيد",
      schools: "مدرسة الفيصلية النموذجية، أ. نورة الشمري، ومئات المدارس الأخرى."
    },
    pricing: {
      title: "باقات تناسب الجميع",
      free: {
        title: "الأساسية",
        price: "مجاناً",
        features: ["مشاركات غير محدودة للطلاب", "ألعاب تفاعلية أساسية", "تقارير مبسطة", "دعم فني عبر البريد"]
      },
      pro: {
        title: "الاحترافية",
        price: "٣٩ ريال / شهر",
        features: ["مساعد الذكاء الاصطناعي", "ألعاب متقدمة (وضع الاختراق)", "تقارير تحليلية شاملة", "دعم أولوية وتدريب"]
      }
    },
    faq: {
      title: "أسئلة شائعة",
      questions: [
        { q: "هل يحتاج الطلاب لإنشاء حساب؟", a: "لا، يمكن للطلاب الانضمام فوراً باستخدام رمز الدخول (PIN) الذي يشاركه المعلم." },
        { q: "هل يدعم حصاد المناهج العربية؟", a: "نعم، المنصة مصممة خصيصاً لتتوافق مع طبيعة المناهج واللغة العربية بشكل أصيل، مع دعم كامل للنصوص من اليمين لليسار." },
        { q: "كيف يعمل التصحيح بالذكاء الاصطناعي؟", a: "يقوم نظامنا بتحليل الإجابات النصية القصيرة للطلاب ومقارنتها بالإجابة النموذجية التي تحددها، مما يوفر لك ساعات من التصحيح اليدوي." }
      ]
    },
    footer: {
      desc: "صُنع بكل حب للتعليم العربي.",
      rights: "© 2024 منصة حصاد. جميع الحقوق محفوظة."
    }
  },
  en: {
    nav: {
      features: "Features",
      howItWorks: "How it Works",
      pricing: "Pricing",
      login: "Login",
      register: "Start Free",
      joinPin: "Join with PIN",
    },
    hero: {
      badge: "Authentic Arabic Education 🌟",
      title: "HasadX",
      subtitle: "Where education blooms and knowledge is harvested",
      description: "The premier educational platform built specifically for Arab teachers and students. Create interactive lessons, run engaging games, and let AI grade short answers.",
      ctaPrimary: "Start Free as a Teacher",
      ctaSecondary: "Have a PIN? Join as a Student",
    },
    join: {
      title: "Ready for the challenge?",
      subtitle: "Enter the 6-digit PIN to join the lesson or game instantly.",
      placeholder: "e.g., 123456",
      button: "Join Now",
    },
    features: {
      title: "More Than Just Questions",
      subtitle: "Integrated tools that make every lesson unforgettable",
      items: [
        {
          icon: <Gamepad2 className="w-6 h-6" />,
          title: "Live Interactive Games",
          desc: "Tug-of-War, Hack-mode, and Quiz Race. Turn review sessions into real fun where students compete passionately."
        },
        {
          icon: <BrainCircuit className="w-6 h-6" />,
          title: "AI Assistant",
          desc: "Save time! Our AI builds lessons, generates questions, and accurately grades students' short-answer responses."
        },
        {
          icon: <LayoutDashboard className="w-6 h-6" />,
          title: "Comprehensive Live Reports",
          desc: "Track student performance in real-time. Detailed reports help you identify strengths and weaknesses for each student."
        }
      ]
    },
    howItWorks: {
      title: "How does Hasad work?",
      steps: [
        { title: "Design your lesson", desc: "Use AI or our ready-made templates to create interactive content in minutes." },
        { title: "Share the PIN", desc: "Students get a 6-digit PIN to join instantly without needing accounts." },
        { title: "Start the fun", desc: "Watch live student engagement and assess their understanding immediately." }
      ]
    },
    stats: {
      title: "Trusted by teachers everywhere",
      teachers: "12,000+",
      teachersLabel: "Teachers",
      students: "320,000+",
      studentsLabel: "Students Benefiting",
      schools: "Al-Faisaliah Model School, Ms. Noura Al-Shammari, and hundreds more."
    },
    pricing: {
      title: "Plans for Everyone",
      free: {
        title: "Basic",
        price: "Free",
        features: ["Unlimited student joins", "Basic interactive games", "Simple reports", "Email support"]
      },
      pro: {
        title: "Pro",
        price: "39 SAR / mo",
        features: ["AI Assistant", "Advanced games (Hack mode)", "Comprehensive analytics", "Priority support & training"]
      }
    },
    faq: {
      title: "Frequently Asked Questions",
      questions: [
        { q: "Do students need to create an account?", a: "No, students can join instantly using the 6-digit PIN shared by the teacher." },
        { q: "Does Hasad support Arabic curricula?", a: "Yes, the platform is built specifically to handle Arabic language and curricula natively, with full RTL support." },
        { q: "How does AI grading work?", a: "Our system analyzes students' short text answers and compares them to your rubric, saving you hours of manual grading." }
      ]
    },
    footer: {
      desc: "Made with love for Arabic education.",
      rights: "© 2024 HasadX. All rights reserved."
    }
  }
};

export function Madrasa() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [pin, setPin] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const content = t[lang];
  const isRtl = lang === 'ar';

  const toggleLang = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className={`madrasa-theme min-h-screen font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-madrasa-bg/80 backdrop-blur-md border-b border-madrasa">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-madrasa-primary flex items-center justify-center text-madrasa-bg shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="font-display text-2xl font-bold text-madrasa-primary">حصاد</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 font-medium">
            <a href="#features" className="text-madrasa-fg/80 hover:text-madrasa-primary transition-colors">{content.nav.features}</a>
            <a href="#how-it-works" className="text-madrasa-fg/80 hover:text-madrasa-primary transition-colors">{content.nav.howItWorks}</a>
            <a href="#pricing" className="text-madrasa-fg/80 hover:text-madrasa-primary transition-colors">{content.nav.pricing}</a>
            
            <div className="flex items-center gap-4 border-s border-madrasa ps-4">
              <button onClick={toggleLang} className="flex items-center gap-1 text-sm text-madrasa-fg/60 hover:text-madrasa-primary transition-colors px-2 py-1 rounded-md hover:bg-madrasa-primary/5">
                <Globe className="w-4 h-4" />
                {lang === 'ar' ? 'EN' : 'عربي'}
              </button>
              <button className="text-madrasa-primary hover:text-madrasa-primary/80 transition-colors">
                {content.nav.login}
              </button>
              <button className="bg-madrasa-secondary text-white px-5 py-2 rounded-full font-bold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                {content.nav.register}
              </button>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-madrasa-fg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed top-16 left-0 w-full bg-madrasa-bg border-b border-madrasa p-4 z-40 shadow-lg"
          >
            <div className="flex flex-col gap-4 text-lg font-medium">
              <a href="#features" className="p-2 text-madrasa-fg/80" onClick={() => setMobileMenuOpen(false)}>{content.nav.features}</a>
              <a href="#how-it-works" className="p-2 text-madrasa-fg/80" onClick={() => setMobileMenuOpen(false)}>{content.nav.howItWorks}</a>
              <a href="#pricing" className="p-2 text-madrasa-fg/80" onClick={() => setMobileMenuOpen(false)}>{content.nav.pricing}</a>
              <hr className="border-madrasa" />
              <button onClick={toggleLang} className="flex items-center gap-2 p-2 text-madrasa-fg/80">
                <Globe className="w-5 h-5" />
                {lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
              </button>
              <div className="flex flex-col gap-3 mt-2">
                <button className="border border-madrasa-primary text-madrasa-primary px-4 py-3 rounded-xl font-bold">
                  {content.nav.login}
                </button>
                <button className="bg-madrasa-secondary text-white px-4 py-3 rounded-xl font-bold">
                  {content.nav.register}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* Hero Section */}
        <section className="pt-16 pb-24 overflow-hidden relative">
          {/* Decorative background elements */}
          <div className="absolute top-20 right-10 w-64 h-64 bg-madrasa-secondary/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-madrasa-primary/5 rounded-full blur-3xl -z-10" />
          
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex-1 text-center lg:text-start"
              >
                <div className="inline-flex items-center gap-2 bg-white/50 border border-madrasa px-4 py-1.5 rounded-full text-sm font-medium text-madrasa-primary mb-6 shadow-sm">
                  <Sparkles className="w-4 h-4 text-madrasa-secondary" />
                  {content.hero.badge}
                </div>
                <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-madrasa-fg leading-tight mb-4">
                  {content.hero.title}
                  <br />
                  <span className="text-madrasa-primary">{content.hero.subtitle}</span>
                </h1>
                <p className="text-lg md:text-xl text-madrasa-fg/70 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  {content.hero.description}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <button className="w-full sm:w-auto bg-madrasa-primary text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:bg-madrasa-primary/90 transition-all hover:-translate-y-1">
                    {content.hero.ctaPrimary}
                  </button>
                  <a href="#join" className="w-full sm:w-auto bg-white border border-madrasa text-madrasa-fg px-8 py-4 rounded-full font-bold text-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-1 text-center flex items-center justify-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-madrasa-secondary" />
                    {content.hero.ctaSecondary}
                  </a>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex-1 relative"
              >
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white bg-white rotate-2 hover:rotate-0 transition-transform duration-500">
                  <img 
                    src="/__mockup/images/homepage-madrasa-hero.png" 
                    alt="Teacher and students using Hasad" 
                    className="w-full object-cover"
                  />
                </div>
                {/* Floating elements */}
                <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-madrasa/50 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs text-madrasa-fg/60">تم التقييم</div>
                      <div className="font-bold">10/10 إجابة رائعة</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Join PIN Section */}
        <section id="join" className="py-12 bg-madrasa-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 border border-white/20 text-center shadow-2xl">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
                {content.join.title}
              </h2>
              <p className="text-white/80 mb-8 max-w-lg mx-auto">
                {content.join.subtitle}
              </p>
              <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
                <input 
                  type="text" 
                  placeholder={content.join.placeholder}
                  className="flex-1 text-center sm:text-start bg-white px-6 py-4 rounded-2xl text-2xl font-bold text-madrasa-primary placeholder:text-madrasa-primary/30 focus:outline-none focus:ring-4 focus:ring-madrasa-secondary/50 tracking-widest"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  dir="ltr"
                />
                <button className="bg-madrasa-secondary text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-madrasa-secondary/90 transition-colors shadow-lg whitespace-nowrap">
                  {content.join.button}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 border-b border-madrasa bg-white/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h3 className="font-display text-2xl font-bold text-madrasa-fg">{content.stats.title}</h3>
              <p className="text-madrasa-fg/60 mt-2">{content.stats.schools}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-12 md:gap-24">
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl font-bold text-madrasa-primary mb-2">{content.stats.teachers}</div>
                <div className="text-madrasa-fg/70 font-medium">{content.stats.teachersLabel}</div>
              </div>
              <div className="hidden md:block w-px bg-madrasa h-16 my-auto"></div>
              <div className="text-center">
                <div className="font-display text-4xl md:text-5xl font-bold text-madrasa-secondary mb-2">{content.stats.students}</div>
                <div className="text-madrasa-fg/70 font-medium">{content.stats.studentsLabel}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-madrasa-bg">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="font-display text-4xl font-bold text-madrasa-fg mb-4">{content.features.title}</h2>
              <p className="text-xl text-madrasa-fg/70">{content.features.subtitle}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {content.features.items.map((item, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -8 }}
                  className="bg-white p-8 rounded-3xl border border-madrasa shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-madrasa-primary/10 text-madrasa-primary flex items-center justify-center mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-madrasa-fg/70 leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Illustration break */}
            <div className="mt-20 flex justify-center">
               <div className="relative rounded-[2rem] overflow-hidden shadow-xl border-4 border-white max-w-4xl w-full">
                  <img 
                    src="/__mockup/images/homepage-madrasa-games.png" 
                    alt="Students playing digital game" 
                    className="w-full object-cover aspect-[21/9]"
                  />
               </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 order-2 lg:order-1">
                <div className="relative rounded-[2rem] overflow-hidden shadow-xl border-4 border-madrasa bg-madrasa-bg">
                  <img 
                    src="/__mockup/images/homepage-madrasa-ai-tutor.png" 
                    alt="AI Assistant helping teacher" 
                    className="w-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <h2 className="font-display text-4xl font-bold text-madrasa-fg mb-10">{content.howItWorks.title}</h2>
                <div className="flex flex-col gap-8">
                  {content.howItWorks.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-6">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-madrasa-secondary text-white font-bold text-xl flex items-center justify-center shadow-md">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                        <p className="text-madrasa-fg/70 text-lg leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cultural Identity Nod */}
        <section className="py-20 bg-madrasa-primary text-white overflow-hidden relative">
          <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay flex justify-center items-center">
             <img src="/__mockup/images/homepage-madrasa-cultural.png" alt="Arabesque pattern" className="w-full h-full object-cover" />
          </div>
          <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
            <Sparkles className="w-12 h-12 text-madrasa-secondary mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">
              صُنع ليفهمه الطالب، وليحبه المعلم.
              <br/> منصة عربية الهوية والجوهر.
            </h2>
            <p className="text-xl text-white/80">
              لا مزيد من الأدوات المعربة بشكل سيء أو الواجهات المقلوبة. حصاد بنيت من اليوم الأول لدعم اللغة العربية والمناهج بأسلوب يتوافق مع ثقافتنا.
            </p>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section id="pricing" className="py-24 bg-madrasa-bg">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-display text-4xl font-bold text-madrasa-fg mb-4">{content.pricing.title}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="bg-white rounded-3xl p-8 border-2 border-transparent hover:border-madrasa-secondary transition-colors shadow-lg flex flex-col">
                <h3 className="text-2xl font-bold mb-2">{content.pricing.free.title}</h3>
                <div className="text-4xl font-display font-bold text-madrasa-primary mb-8">{content.pricing.free.price}</div>
                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  {content.pricing.free.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-madrasa-secondary shrink-0" />
                      <span className="text-madrasa-fg/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl border-2 border-madrasa-primary text-madrasa-primary font-bold hover:bg-madrasa-primary hover:text-white transition-colors">
                  {content.hero.ctaPrimary}
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bg-madrasa-primary text-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 bg-madrasa-secondary text-white px-4 py-1 rounded-bl-xl font-bold text-sm">
                  الأكثر شهرة
                </div>
                <h3 className="text-2xl font-bold mb-2">{content.pricing.pro.title}</h3>
                <div className="text-4xl font-display font-bold mb-8">{content.pricing.pro.price}</div>
                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  {content.pricing.pro.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-madrasa-secondary shrink-0" />
                      <span className="text-white/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl bg-madrasa-secondary text-white font-bold hover:bg-madrasa-secondary/90 transition-colors shadow-md">
                  ابدأ التجربة المجانية
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-4xl font-bold text-center mb-12">{content.faq.title}</h2>
            <div className="flex flex-col gap-4">
              {content.faq.questions.map((faq, idx) => (
                <div key={idx} className="border border-madrasa rounded-2xl overflow-hidden bg-madrasa-bg/50">
                  <button 
                    className="w-full flex items-center justify-between p-6 text-start font-bold text-lg hover:bg-madrasa-primary/5 transition-colors"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    <motion.div
                      animate={{ rotate: openFaq === idx ? (isRtl ? -90 : 90) : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isRtl ? <ChevronLeft className="w-5 h-5 text-madrasa-primary" /> : <ChevronRight className="w-5 h-5 text-madrasa-primary" />}
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 pt-0 text-madrasa-fg/70 leading-relaxed border-t border-madrasa/50 mt-2">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-madrasa-fg text-white/60 py-12 border-t-8 border-madrasa-secondary">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-madrasa-primary flex items-center justify-center text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-display text-2xl font-bold text-white">حصاد</span>
          </div>
          <p className="mb-8">{content.footer.desc}</p>
          <div className="pt-8 border-t border-white/10 text-sm">
            {content.footer.rights}
          </div>
        </div>
      </footer>
    </div>
  );
}
