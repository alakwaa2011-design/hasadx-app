import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Edit3, Share2, Users2 } from "lucide-react";

export function HowItWorksSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const steps = isAr ? [
    { title: "أنشئ نشاط", desc: "صمم العرض أو النشاط باستخدام الأدوات الذكية.", icon: Edit3 },
    { title: "شارك الرابط", desc: "شارك الرمز أو الرابط مع المتعلمين بسهولة.", icon: Share2 },
    { title: "ابدأ التفاعل", desc: "تابع مشاركة المتعلمين ونتائجهم فورياً.", icon: Users2 }
  ] : [
    { title: "Create Activity", desc: "Design the presentation or activity with smart tools.", icon: Edit3 },
    { title: "Share Link", desc: "Share the code or link with learners easily.", icon: Share2 },
    { title: "Start Interaction", desc: "Track learners' participation and results instantly.", icon: Users2 }
  ];

  return (
    <section className="py-20 lg:py-32 bg-[#225739] text-white relative overflow-hidden" dir={dir}>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-black text-emerald-200 mb-3 tracking-widest uppercase">
            {isAr ? "طريقة العمل" : "How it works"}
          </p>
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            {isAr ? "٣ خطوات بسيطة لحصة لا تُنسى" : "3 simple steps for an unforgettable class"}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-emerald-700/50" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="relative text-center"
            >
              <div className="w-24 h-24 mx-auto bg-emerald-800 border-4 border-[#225739] rounded-2xl flex items-center justify-center mb-6 relative z-10 shadow-xl">
                <step.icon className="w-10 h-10 text-secondary" />
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center border-2 border-[#225739]">
                  {idx + 1}
                </div>
              </div>
              <h3 className="text-2xl font-black mb-3">{step.title}</h3>
              <p className="text-emerald-100/80 font-medium leading-relaxed max-w-xs mx-auto text-lg">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
