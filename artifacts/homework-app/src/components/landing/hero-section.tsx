import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import motivationBoardImg from "@/assets/landing/motivation-board.webp";
import tugOfWarImg from "@/assets/landing/tug-of-war.png";
import reportsImg from "@/assets/landing/reports.png";

export function HeroSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section className="relative pt-20 pb-16 lg:pt-32 lg:pb-24 overflow-hidden bg-background" dir={dir}>
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-8 text-sm font-bold shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-secondary" />
            <span>{isAr ? "منصة عربية متكاملة للمعلم" : "Integrated Arabic platform for teachers"}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.2] tracking-tight mb-6 text-foreground"
          >
            {isAr ? (
              <>حوّل خطة درسك إلى <br/><span className="text-primary">تجربة تعليمية متكاملة</span></>
            ) : (
              <>Turn your lesson plan into a <br/><span className="text-primary">complete learning experience</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed font-medium"
          >
            {isAr
              ? "أنشئ محتواك التفاعلي، اعرضه بأسلوب يجذب الانتباه، وتابع مشاركة المتعلمين لحظة بلحظة من منصة واحدة صُممت للمعلم."
              : "Create interactive content, present it engagingly, and track learners' participation instantly from one platform built for teachers."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            <Link href="/register" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-black text-lg hover:bg-primary/90 transition-all hover:-translate-y-1 shadow-xl shadow-primary/20 flex items-center justify-center gap-2">
              {isAr ? "ابدأ الآن مجانًا" : "Start now for free"}
              {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </Link>
            <a href="#tools" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-card text-foreground font-bold text-lg hover:bg-muted transition-colors border border-border shadow-sm flex items-center justify-center gap-2">
              {isAr ? "اكتشف أدوات حصاد" : "Discover Hasaad tools"}
            </a>
          </motion.div>
        </div>

        {/* Hero Visual Composition */}
        <div className="relative max-w-5xl mx-auto w-full h-[340px] sm:h-[400px] md:h-[500px] lg:h-[600px] mt-8">
          {/* Main Dominant Image (Motivation Board) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="absolute z-10 top-0 sm:top-8 md:top-12 left-4 right-4 sm:left-[10%] sm:right-[10%] md:left-[15%] md:right-[15%] bottom-[110px] sm:bottom-0 rounded-2xl sm:rounded-b-none sm:rounded-t-[2.5rem] overflow-hidden border border-border shadow-2xl bg-card"
          >
            <img
              src={motivationBoardImg}
              alt={isAr ? "لوحة التحفيز" : "Motivation Board"}
              className="w-full h-full object-cover object-top"
              fetchPriority="high"
            />
          </motion.div>

          {/* Floating Image 1 (Tug of War Game) */}
          <motion.div
            initial={{ opacity: 0, x: 20, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            className="absolute z-20 bottom-0 sm:bottom-8 md:bottom-16 left-4 sm:left-0 w-[44%] sm:w-[40%] md:w-[38%] h-[130px] sm:h-auto rounded-xl md:rounded-2xl overflow-hidden border-[3px] sm:border-[4px] md:border-[6px] border-background shadow-2xl bg-card sm:rotate-[-3deg] hover:rotate-0 transition-transform"
          >
            <img
              src={tugOfWarImg}
              alt={isAr ? "لعبة شد الحبل" : "Tug of War"}
              className="w-full h-full sm:h-auto object-cover object-center"
              loading="lazy"
              decoding="async"
            />
          </motion.div>

          {/* Floating Image 2 (Reports) */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
            className="absolute z-20 sm:z-0 bottom-0 sm:bottom-auto right-4 sm:right-0 sm:top-0 md:top-4 w-[44%] sm:w-[45%] md:w-[42%] h-[130px] sm:h-auto rounded-xl md:rounded-2xl overflow-hidden border-[3px] sm:border-[4px] md:border-[6px] border-background shadow-xl bg-card sm:rotate-[3deg] hover:rotate-0 transition-transform opacity-95 hover:opacity-100 hover:z-30"
          >
            <img
              src={reportsImg}
              alt={isAr ? "التقارير" : "Reports"}
              className="w-full h-full sm:h-auto object-cover object-center"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}