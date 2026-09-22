import { motion } from "framer-motion";
import { Globe, LayoutGrid, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BenefitsSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const benefits = [
    {
      icon: Globe,
      title: isAr ? "واجهة عربية" : "Arabic Interface",
    },
    {
      icon: LayoutGrid,
      title: isAr ? "أدوات جاهزة للحصة" : "Ready-to-use Tools",
    },
    {
      icon: Zap,
      title: isAr ? "تفاعل ونتائج مباشرة" : "Live Interaction & Results",
    }
  ];

  return (
    <section className="py-12 bg-background border-b border-border/50" dir={dir}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {benefits.map((benefit, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center justify-center md:justify-start gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-black text-foreground">{benefit.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
