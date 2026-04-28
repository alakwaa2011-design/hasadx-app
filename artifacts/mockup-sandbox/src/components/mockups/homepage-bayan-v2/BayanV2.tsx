import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Gamepad2,
  BrainCircuit,
  Target,
  Trophy,
  Zap,
  CheckCircle2,
  Globe,
  Shield,
  BookOpen,
  ArrowLeft,
  Terminal,
  Instagram,
  Twitter,
  Linkedin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Reem+Kufi:wght@400..700&family=Tajawal:wght@300;400;500;700;800;900&display=swap');

  .bayan-v2 {
    --bg-dark: #0A0F0D;
    --bg-dark-surface: #111814;
    --bg-darker: #050806;
    --bg-light: #F8F6F1;
    --primary: #16A34A;
    --primary-hover: #15803d;
    --text-on-dark: #F8F6F1;
    --text-muted-on-dark: #9CA3AF;
    --text-on-light: #0A0F0D;
    --text-muted-on-light: #4B5563;
    --border-dark: rgba(255, 255, 255, 0.1);
    --border-light: rgba(10, 15, 13, 0.1);

    background-color: var(--bg-dark);
    color: var(--text-on-dark);
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    direction: rtl;
  }

  .bayan-v2 .font-display {
    font-family: 'Reem Kufi', sans-serif;
  }

  .bayan-v2 .font-body {
    font-family: 'Tajawal', sans-serif;
  }

  .bayan-v2 .section-light {
    background-color: var(--bg-light);
    color: var(--text-on-light);
  }
  
  .bayan-v2 .section-dark {
    background-color: var(--bg-dark);
    color: var(--text-on-dark);
  }

  .bayan-v2 .code-input {
    width: 3rem;
    height: 4rem;
    font-size: 1.5rem;
    text-align: center;
    border-radius: 0.5rem;
    border: 1px solid var(--border-dark);
    background: rgba(255,255,255,0.05);
    color: var(--text-on-dark);
    font-family: monospace;
    transition: all 0.2s ease;
  }
  
  .bayan-v2 .code-input:focus {
    border-color: var(--primary);
    outline: none;
    box-shadow: 0 0 0 1px var(--primary);
  }

  .bayan-v2 .glow-bg {
    position: absolute;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(22, 163, 74, 0.15) 0%, rgba(10, 15, 13, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
  
  .bayan-v2 .glow-bg-blue {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(10, 15, 13, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
`;

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

export function BayanV2() {
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = customStyles;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  return (
    <div className="bayan-v2 min-h-screen overflow-x-hidden selection:bg-[#16A34A] selection:text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0F0D]/80 border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold tracking-tight text-white flex items-center gap-1">
              حصاد <span className="w-2 h-2 rounded-full bg-[#16A34A] inline-block mt-2"></span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-body text-lg text-[#9CA3AF]">
            <a href="#product" className="hover:text-white transition-colors">المنتج</a>
            <a href="#activities" className="hover:text-white transition-colors">الأنشطة</a>
            <a href="#teachers" className="hover:text-white transition-colors">المعلمون</a>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-[#9CA3AF] hover:text-white font-body text-lg hidden sm:flex">
              تسجيل الدخول
            </Button>
            <Button className="bg-[#16A34A] hover:bg-[#15803d] text-white font-body text-lg px-6 h-11 rounded-full border-0">
              ابدأ مجاناً
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 px-6 section-dark overflow-hidden flex flex-col items-center">
        <div className="glow-bg top-0 left-1/2 -translate-x-1/2 opacity-80"></div>
        <div className="glow-bg-blue bottom-0 right-0 opacity-40"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col items-center">
            
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(22,163,74,0.3)] bg-[rgba(22,163,74,0.05)] mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-[#16A34A]" />
              <span className="font-body text-sm font-medium text-[#16A34A]">منصّة عربية للتعلّم التفاعلي</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="font-display text-5xl md:text-7xl lg:text-[5rem] font-bold leading-[1.2] mb-6 text-white max-w-4xl">
              أنشئ واجبات وأنشطة ومسابقات تفاعلية في <span className="text-[#16A34A]">دقائق</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="font-body text-xl md:text-2xl text-[#9CA3AF] max-w-2xl mb-12 leading-relaxed">
              صُممت لتلائم المعلم العربي. حوّل دروسك إلى تجارب تفاعلية، ألعاب حية، وتقييمات ذكية يطلبها طلابك بشغف.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-[#16A34A] hover:bg-[#15803d] text-white h-14 px-8 rounded-full font-body text-xl font-bold shadow-[0_0_40px_rgba(22,163,74,0.3)] border-0">
                أنشئ مسابقتك الآن
              </Button>
              <Button variant="outline" className="w-full sm:w-auto border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] text-white h-14 px-8 rounded-full font-body text-xl font-medium bg-transparent">
                استعرض المسابقات الجاهزة
              </Button>
            </motion.div>

          </motion.div>
        </div>

        {/* Hero Visual */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
          className="w-full max-w-6xl mx-auto mt-24 relative z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F0D] via-transparent to-transparent z-20 pointer-events-none rounded-2xl"></div>
          <img 
            src="/__mockup/images/homepage-bayan-v2-hero.png" 
            alt="منصة حصاد - المنتج" 
            className="w-full h-auto rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl relative z-10 object-cover aspect-[16/9]"
          />
        </motion.div>
      </section>

      {/* Join with Code Card */}
      <div className="relative z-30 -mt-24 mb-24 px-6 flex justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-[#111814] border border-[rgba(255,255,255,0.1)] p-8 md:p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center gap-8 w-full max-w-4xl backdrop-blur-xl"
        >
          <div className="flex-1 text-center md:text-right">
            <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">كود المسابقة</h3>
            <p className="font-body text-[#9CA3AF] text-lg">لا تحتاج حساب — فقط الكود</p>
          </div>
          
          <div className="flex items-center gap-2" dir="ltr">
            {[0,1,2,3,4,5].map((i) => (
              <input 
                key={i} 
                type="text" 
                maxLength={1} 
                className="code-input font-bold" 
                placeholder="-"
                readOnly
              />
            ))}
          </div>

          <Button className="w-full md:w-auto bg-white hover:bg-gray-200 text-[#0A0F0D] h-14 px-10 rounded-xl font-body text-xl font-bold shrink-0 transition-transform active:scale-95">
            انضم الآن
          </Button>
        </motion.div>
      </div>

      {/* Trust Strip */}
      <section className="py-16 border-y border-[rgba(255,255,255,0.05)] bg-[#050806]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-body text-[#16A34A] font-bold text-sm tracking-wide mb-10 uppercase">نمو حقيقي، أرقام حقيقية</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { num: "+61k", label: "نشاطًا تعليميًا" },
              { num: "+26k", label: "معلّمًا مسجلًا" },
              { num: "+67M", label: "تسليمًا مكتملًا" },
              { num: "+737k", label: "طالبًا مشاركًا" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="font-display text-4xl md:text-6xl font-bold text-white mb-3" dir="ltr">{stat.num}</span>
                <span className="font-body text-[#9CA3AF] text-lg">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you can build (Light Section) */}
      <section id="product" className="py-32 px-6 section-light relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">كل ما تحتاجه في مكان واحد</h2>
            <p className="font-body text-xl text-[#4B5563] max-w-2xl mx-auto">
              تخلّص من تشتت الأدوات المتعددة. حصاد تجمع لك كل احتياجاتك التعليمية بتجربة مستخدم لا مثيل لها.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "واجبات", desc: "أنشئ واجبات غنية بالوسائط، بأسئلة متنوعة وتقييم آلي يوفر وقتك وتعبك.", icon: BookOpen },
              { title: "أنشطة", desc: "دروس تفاعلية، بطاقات تعليمية، ومواد مراجعة تجعل المذاكرة ممتعة للطلاب.", icon: Target },
              { title: "مسابقات حية", desc: "النبض الحقيقي للفصل. ألعاب جماعية تشعل الحماس وتضاعف التركيز والمنافسة.", icon: Trophy },
            ].map((pillar, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -8 }}
                className="bg-[#0A0F0D] text-white p-10 rounded-3xl shadow-xl flex flex-col items-start border border-[rgba(255,255,255,0.05)] transition-all"
              >
                <div className="w-16 h-16 bg-[rgba(22,163,74,0.1)] rounded-2xl flex items-center justify-center mb-8">
                  <pillar.icon className="w-8 h-8 text-[#16A34A]" />
                </div>
                <h3 className="font-display text-3xl font-bold mb-4">{pillar.title}</h3>
                <p className="font-body text-[#9CA3AF] text-lg leading-relaxed mb-8 flex-1">{pillar.desc}</p>
                <a href="#" className="font-body text-[#16A34A] font-bold flex items-center gap-2 hover:text-[#15803d] text-lg transition-colors">
                  اعرف المزيد <ArrowLeft className="w-5 h-5" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live game modes showcase */}
      <section id="activities" className="py-32 px-6 section-dark relative overflow-hidden">
        <div className="glow-bg top-1/2 -right-64 opacity-30"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-24 md:flex md:items-end md:justify-between text-center md:text-right">
            <div className="max-w-2xl mx-auto md:mx-0">
              <span className="text-[#16A34A] font-body font-bold text-lg tracking-wider mb-4 block">الميزة التنافسية</span>
              <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">ألعاب حية يطلبها طلابك <span className="text-[#16A34A]">بأسمائها</span></h2>
              <p className="font-body text-xl md:text-2xl text-[#9CA3AF] leading-relaxed">
                ليس مجرد تصويت سريع. صممنا أنماط لعب غامرة تجعل الطلاب يتنافسون بحماس حقيقي.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tug of War (Large) */}
            <div className="lg:col-span-8 bg-[#111814] rounded-3xl border border-[rgba(255,255,255,0.05)] overflow-hidden group">
              <div className="h-[450px] relative overflow-hidden">
                <img src="/__mockup/images/homepage-bayan-v2-tug.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="شد الحبل" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111814] via-[#111814]/20 to-transparent"></div>
              </div>
              <div className="p-10 -mt-24 relative z-10">
                <div className="inline-block px-4 py-1.5 bg-[#16A34A] text-white font-body text-sm font-bold rounded-full mb-4">نمط حصري</div>
                <h3 className="font-display text-4xl font-bold mb-4">شدّ الحبل</h3>
                <p className="font-body text-[#9CA3AF] text-xl max-w-2xl">فريقان، حبل واحد. كل إجابة صحيحة تسحب الحبل لصالح فريقك. التعاون والسرعة هما مفتاح الفوز في هذه اللعبة الحماسية.</p>
              </div>
            </div>

            {/* Hack Mode */}
            <div className="lg:col-span-4 bg-[#111814] rounded-3xl border border-[rgba(255,255,255,0.05)] overflow-hidden group">
              <div className="h-[300px] relative overflow-hidden">
                <img src="/__mockup/images/homepage-bayan-v2-hack.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Hack Mode" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111814] to-transparent"></div>
              </div>
              <div className="p-8 -mt-16 relative z-10">
                <h3 className="font-display text-3xl font-bold mb-3 flex items-center gap-2">
                  <Terminal className="w-6 h-6 text-[#16A34A]" />
                  Hack-mode
                </h3>
                <p className="font-body text-[#9CA3AF] text-lg leading-relaxed">تجربة سيبرانية لاختراق أسئلة الخصوم وسرقة نقاطهم بذكاء وسرعة ومكر.</p>
              </div>
            </div>

            {/* Smaller Cards */}
            <div className="lg:col-span-4 bg-[#111814] rounded-3xl border border-[rgba(255,255,255,0.05)] p-8 hover:bg-[#161D19] transition-colors flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-yellow-500" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">سباق الأسئلة</h3>
                <p className="font-body text-[#9CA3AF] text-lg">السرعة والدقة. من يصل لخط النهاية أولاً بإجابات صحيحة متتالية؟</p>
              </div>
            </div>
            
            <div className="lg:col-span-4 bg-[#111814] rounded-3xl border border-[rgba(255,255,255,0.05)] p-8 hover:bg-[#161D19] transition-colors flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                  <Trophy className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">المليونير</h3>
                <p className="font-body text-[#9CA3AF] text-lg">تجربة تلفزيونية كلاسيكية بصيغة تفاعلية. هل أنت مستعد للسؤال الأخير؟</p>
              </div>
            </div>
            
            <div className="lg:col-span-4 bg-[#111814] rounded-3xl border border-[rgba(255,255,255,0.05)] p-8 hover:bg-[#161D19] transition-colors flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                  <BrainCircuit className="w-7 h-7 text-purple-500" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">بطاقات تعليمية</h3>
                <p className="font-body text-[#9CA3AF] text-lg">أسلوب دراسة ذاتي فعال لترسيخ المفاهيم والمصطلحات قبل الامتحانات.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant */}
      <section className="py-32 px-6 section-light border-y border-[rgba(10,15,13,0.05)] overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1 order-2 lg:order-1 relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-green-100 rounded-[2.5rem] transform -rotate-3 -z-10"></div>
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-[rgba(10,15,13,0.1)] bg-white">
              <img src="/__mockup/images/homepage-bayan-v2-ai.png" alt="مساعد الذكاء الاصطناعي" className="w-full h-auto object-cover aspect-[4/3]" />
            </div>
          </div>
          <div className="flex-1 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#16A34A]/10 text-[#16A34A] mb-6">
              <BrainCircuit className="w-5 h-5" />
              <span className="font-body text-base font-bold">ذكاء اصطناعي مدمج</span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-[#0A0F0D] leading-[1.1]">
              مساعدك الشخصي لبناء محتوى لا يُنسى
            </h2>
            <p className="font-body text-xl text-[#4B5563] leading-relaxed mb-10">
              مساعد ذكاء اصطناعي يساعدك تبني الأسئلة، تصحّح الإجابات المفتوحة بدقة متناهية، وتقترح أفكاراً جديدة لكل درس. وفر ساعات من وقتك في التحضير والتصحيح.
            </p>
            <ul className="space-y-6 font-body text-lg text-[#0A0F0D] font-medium">
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                </div>
                توليد أسئلة متنوعة من النصوص وملفات PDF بضغطة زر
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                </div>
                تصحيح آلي للإجابات المقالية الطويلة بناءً على المعنى
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                </div>
                بناء خطط دروس تفاعلية متكاملة تلائم منهجك
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6 section-dark relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">ثلاث خطوات فقط</h2>
            <p className="font-body text-xl text-[#9CA3AF]">لا تعقيد، لا إعدادات مطولة. ابدأ اللعب في ثوانٍ.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[rgba(22,163,74,0.3)] to-transparent -z-10"></div>
            
            {[
              { num: "1", title: "أنشئ النشاط أو المسابقة", desc: "استخدم الذكاء الاصطناعي أو ابدأ من الصفر لبناء محتوى جذاب." },
              { num: "2", title: "شارك الكود مع طلابك", desc: "يعرض النظام كوداً مكوناً من 6 أرقام. يدخله الطلاب من هواتفهم." },
              { num: "3", title: "تابع المشاركات والنتائج", desc: "شاهد التفاعل الحي، احصل على تقارير فورية، واحتفل بالفائزين." },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center relative bg-[#111814] p-10 rounded-3xl border border-[rgba(255,255,255,0.05)]">
                <div className="w-20 h-20 rounded-2xl bg-[#0A0F0D] border border-[#16A34A] flex items-center justify-center font-display text-3xl font-bold text-[#16A34A] mb-8 shadow-[0_0_30px_rgba(22,163,74,0.15)] -mt-20">
                  {step.num}
                </div>
                <h3 className="font-display text-2xl font-bold mb-4">{step.title}</h3>
                <p className="font-body text-[#9CA3AF] text-lg leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof & Cultural Note */}
      <section className="py-32 px-6 bg-[#050806] border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            
            {/* Testimonial */}
            <div className="bg-[#111814] p-10 md:p-14 rounded-3xl border border-[rgba(255,255,255,0.05)] relative shadow-2xl">
              <div className="absolute top-10 right-10 text-[rgba(22,163,74,0.2)]">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
              </div>
              <p className="font-body text-2xl md:text-3xl leading-[1.6] text-white mb-12 relative z-10 font-medium">
                "منصة حصاد غيّرت جو الفصل تماماً. الطلاب ينتظرون حصتي بشوق بسبب 'شد الحبل'. الأجمل هو أن الواجهة عربية بالكامل ومريحة للعين، ولا أضطر للتعامل مع ترجمات ركيكة."
              </p>
              <div className="flex items-center gap-5">
                <img src="/__mockup/images/homepage-bayan-v2-teacher.png" alt="أ. نورة الشمري" className="w-20 h-20 rounded-full object-cover border-2 border-[rgba(22,163,74,0.5)] shadow-lg" />
                <div>
                  <h4 className="font-bold text-white font-body text-xl">أ. نورة الشمري</h4>
                  <p className="text-[#16A34A] font-body text-base mt-1">مدرسة الفيصلية النموذجية، الرياض</p>
                </div>
              </div>
            </div>

            {/* Cultural Note */}
            <div>
              <div className="w-16 h-16 bg-[#16A34A]/10 rounded-2xl flex items-center justify-center mb-8 border border-[#16A34A]/20">
                <Globe className="w-8 h-8 text-[#16A34A]" />
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 text-white leading-tight">صُمّمت للعربية أولاً</h2>
              <p className="font-body text-xl text-[#9CA3AF] leading-relaxed mb-10">
                نؤمن بأن التعليم بلغتك الأم يجب أن يكون بتجربة عالمية. حصاد ليست أداة أجنبية تم تعريبها بشكل سيء، بل منتج صُنع من الصفر ليليق بالمعلم العربي.
              </p>
              <ul className="space-y-5">
                <li className="flex items-center gap-4 font-body text-lg text-white font-medium bg-[#111814] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                  </div>
                  دعم RTL أصلي في كل بكسل وزاوية
                </li>
                <li className="flex items-center gap-4 font-body text-lg text-white font-medium bg-[#111814] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                  </div>
                  خطوط عربية مختارة بعناية للقراءة المريحة الطويلة
                </li>
                <li className="flex items-center gap-4 font-body text-lg text-white font-medium bg-[#111814] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="w-8 h-8 rounded-full bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                  </div>
                  تجربة مستخدم راقية لا تشبه الأدوات المُترجمة آلياً
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 px-6 section-light">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 text-[#0A0F0D]">أسئلة شائعة</h2>
            <p className="font-body text-[#4B5563] text-xl">كل ما تحتاج معرفته عن حصاد قبل البدء.</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4 font-body" dir="rtl">
            {[
              { q: "هل المنصة مجانية؟", a: "نعم، مجانية للمعلمين، بدون بطاقة بنكية. يمكنك البدء وإنشاء أنشطتك فوراً بمجرد التسجيل." },
              { q: "هل يحتاج الطلاب حساب للمشاركة؟", a: "لا، الطلاب ينضمون مباشرة عبر إدخال كود المسابقة المكون من 6 أرقام في صفحة الدخول، دون الحاجة لأي تسجيل." },
              { q: "هل تعمل المنصة على الجوال؟", a: "نعم، المنصة مصممة لتعمل بسلاسة تامة على أي جهاز يمتلك متصفح إنترنت (جوال، آيباد، لابتوب)، سواء للمعلم أو للطالب." },
              { q: "كيف يعمل التصحيح بالذكاء الاصطناعي؟", a: "يقوم النظام بتحليل إجابات الطلاب النصية المفتوحة ويقارنها بنموذج الإجابة الذي حددته، ويمنح الدرجة بدقة عالية بناءً على فهم المعنى وليس المطابقة الحرفية." }
            ].map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="bg-white rounded-2xl border border-[rgba(10,15,13,0.05)] px-8 py-3 shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-xl md:text-2xl font-bold text-[#0A0F0D] hover:no-underline text-right">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-lg md:text-xl text-[#4B5563] leading-relaxed pt-2 pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-6 section-dark relative overflow-hidden flex flex-col items-center text-center border-y border-[rgba(255,255,255,0.05)]">
        <div className="glow-bg bottom-0 left-1/2 -translate-x-1/2 opacity-70 translate-y-1/2"></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="font-display text-5xl md:text-[5rem] leading-tight font-bold mb-10 text-white">ابدأ أول مسابقة لك <span className="text-[#16A34A]">اليوم</span></h2>
          <Button className="bg-[#16A34A] hover:bg-[#15803d] text-white h-16 md:h-20 px-12 md:px-16 rounded-full font-body text-2xl md:text-3xl font-bold shadow-[0_0_50px_rgba(22,163,74,0.4)] mb-8 border-0 transition-transform hover:scale-105 active:scale-95">
            أنشئ حسابك المجاني
          </Button>
          <div className="flex items-center justify-center gap-3 text-[#9CA3AF] font-body text-lg md:text-xl font-medium">
            <Shield className="w-6 h-6 text-[#16A34A]" /> مجاني للمعلمين، بدون بطاقة بنكية
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050806] pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-16 mb-20">
          <div className="max-w-sm">
            <span className="font-display text-4xl font-bold text-white flex items-center gap-1 mb-6">
              حصاد <span className="w-3 h-3 rounded-full bg-[#16A34A] inline-block mt-2"></span>
            </span>
            <p className="font-body text-[#9CA3AF] text-lg leading-relaxed">
              المنصة التعليمية التفاعلية الأولى في العالم العربي. نطور التعليم ليصبح أكثر متعة، تفاعلاً، وفعالية لكل من المعلم والطالب.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12 font-body">
            <div>
              <h4 className="text-white font-bold text-xl mb-6">المنتج</h4>
              <ul className="space-y-4 text-[#9CA3AF] text-lg">
                <li><a href="#" className="hover:text-white transition-colors">الأنشطة والألعاب</a></li>
                <li><a href="#" className="hover:text-white transition-colors">مساعد الذكاء الاصطناعي</a></li>
                <li><a href="#" className="hover:text-white transition-colors">التقارير والتحليلات</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-xl mb-6">الموارد</h4>
              <ul className="space-y-4 text-[#9CA3AF] text-lg">
                <li><a href="#" className="hover:text-white transition-colors">مركز المساعدة</a></li>
                <li><a href="#" className="hover:text-white transition-colors">المدونة التعليمية</a></li>
                <li><a href="#" className="hover:text-white transition-colors">دليل المعلم</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-xl mb-6">الشركة</h4>
              <ul className="space-y-4 text-[#9CA3AF] text-lg">
                <li><a href="#" className="hover:text-white transition-colors">من نحن</a></li>
                <li><a href="#" className="hover:text-white transition-colors">اتصل بنا</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الخصوصية والشروط</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-[rgba(255,255,255,0.05)] text-center md:text-right font-body text-[#4B5563] text-base flex flex-col md:flex-row justify-between items-center gap-6">
          <p>© 2024 منصة حصاد. جميع الحقوق محفوظة.</p>
          <div className="flex gap-6 text-[#4B5563]">
            <a href="#" className="hover:text-white transition-colors"><Twitter className="w-6 h-6" /></a>
            <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-6 h-6" /></a>
            <a href="#" className="hover:text-white transition-colors"><Instagram className="w-6 h-6" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
