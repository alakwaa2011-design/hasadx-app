import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Play, Sparkles, Users, Clock, CheckCircle2, Circle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function HeroVisual({ isAr, dir }: { isAr: boolean; dir: string }) {
  return (
    <div className="relative w-full max-w-xl mx-auto mt-12 lg:mt-0 lg:max-w-none" dir={dir}>
      {/* Decorative backdrop */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 rounded-[2.5rem] blur-2xl transform -rotate-3 scale-105 pointer-events-none" />
      
      {/* Mockup Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
        className="relative bg-card rounded-3xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Mockup Toolbar */}
        <div className="bg-muted/40 px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> 24 {isAr ? "طالب" : "Students"}</span>
            <span className="flex items-center gap-1.5 text-primary"><Clock className="w-4 h-4" /> 00:45</span>
          </div>
        </div>

        {/* Mockup Content - Live Quiz View */}
        <div className="p-6 md:p-8 bg-gradient-to-b from-card to-emerald-50/30 dark:to-emerald-950/10">
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 rounded-full bg-secondary/15 text-secondary-foreground text-xs font-bold mb-3">
              {isAr ? "علوم - النظام الشمسي" : "Science - Solar System"}
            </div>
            <h3 className="text-xl md:text-2xl font-black text-foreground mb-2">
              {isAr ? "رحلة عبر النظام الشمسي" : "Journey through the Solar System"}
            </h3>
            <p className="text-lg md:text-xl font-bold text-muted-foreground">
              {isAr ? "ما أكبر كواكب المجموعة الشمسية؟" : "What is the largest planet in the solar system?"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {/* Option 1 - Correct */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
              className="flex items-center justify-between p-4 rounded-xl border-2 border-primary bg-primary/5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">أ</div>
                <span className="font-bold text-foreground">{isAr ? "المشتري" : "Jupiter"}</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </motion.div>

            {/* Option 2 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
              className="flex items-center p-4 rounded-xl border border-border bg-card shadow-sm opacity-70"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold">ب</div>
                <span className="font-bold text-foreground">{isAr ? "الأرض" : "Earth"}</span>
              </div>
              <Circle className="w-5 h-5 text-muted-foreground/30 ms-auto" />
            </motion.div>

            {/* Option 3 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex items-center p-4 rounded-xl border border-border bg-card shadow-sm opacity-70"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold">ج</div>
                <span className="font-bold text-foreground">{isAr ? "المريخ" : "Mars"}</span>
              </div>
              <Circle className="w-5 h-5 text-muted-foreground/30 ms-auto" />
            </motion.div>

            {/* Option 4 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7 }}
              className="flex items-center p-4 rounded-xl border border-border bg-card shadow-sm opacity-70"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold">د</div>
                <span className="font-bold text-foreground">{isAr ? "عطارد" : "Mercury"}</span>
              </div>
              <Circle className="w-5 h-5 text-muted-foreground/30 ms-auto" />
            </motion.div>
          </div>
        </div>
      </motion.div>
      
      {/* Floating element 1 */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, type: "spring" }}
        className="absolute -right-4 md:-right-8 top-12 bg-card border border-border shadow-xl rounded-2xl p-3 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-bold">{isAr ? "توليد بالذكاء الاصطناعي" : "AI Generation"}</p>
          <p className="text-sm font-black text-foreground">{isAr ? "نشاط جاهز" : "Activity Ready"}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function HeroSection({ onQuickStart }: { onQuickStart: () => void }) {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  
  return (
    <section className="relative pt-12 pb-16 lg:pt-24 lg:pb-24 overflow-hidden bg-background" dir={dir}>
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Text Content */}
          <div className="text-center lg:text-start flex flex-col items-center lg:items-start pt-8 lg:pt-0">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-primary border border-primary/10 mb-8 text-sm font-bold shadow-sm dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30"
            >
              <Sparkles className="w-4 h-4 text-secondary" />
              <span>{isAr ? "منصة عربية متكاملة للمعلم" : "Integrated Arabic platform for teachers"}</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.15] tracking-tight mb-6 text-foreground"
            >
              {isAr ? (
                <>من فكرة الدرس إلى <br/><span className="text-primary">تجربة تعليمية كاملة</span></>
              ) : (
                <>From lesson idea to a <br/><span className="text-primary">complete learning experience</span></>
              )}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed font-medium"
            >
              {isAr 
                ? "خطط، أنشئ، اعرض وتفاعل — من مكان واحد. أدوات ذكية تساعد المعلم على إعداد درسه وصناعة المحتوى والأنشطة والمسابقات التفاعلية."
                : "Plan, create, present, and interact — from one place. Smart tools helping teachers prepare lessons and create interactive content, activities, and quizzes."}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 w-full sm:w-auto"
            >
              <Link href="/register" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-black text-lg hover:bg-primary/90 transition-all hover:-translate-y-1 shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                {isAr ? "ابدأ مجاناً كمعلم" : "Start free as teacher"}
                {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </Link>
              <button onClick={onQuickStart} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-card text-foreground font-bold text-lg hover:bg-muted transition-colors border border-border shadow-sm flex items-center justify-center gap-2">
                <Play className="w-5 h-5 text-secondary" />
                {isAr ? "شاهد كيف تعمل الأدوات" : "Watch how tools work"}
              </button>
            </motion.div>
          </div>

          {/* Visual Preview */}
          <HeroVisual isAr={isAr} dir={dir} />
          
        </div>
      </div>
    </section>
  );
}