import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import reportsImg from "@/assets/landing/reports.png";

export function ReportsSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section className="py-20 lg:py-32 bg-background border-b border-border/50" dir={dir}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-black text-primary mb-3">
            {isAr ? "النتائج والتقارير" : "Results & Reports"}
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-6">
            {isAr ? "قِس الأداء بلمحة بصر" : "Measure performance at a glance"}
          </h2>
          <p className="text-lg text-muted-foreground font-medium">
            {isAr
              ? "تحليل ذكي ومباشر لنسبة النجاح، معدل الفصل، توزيع الدرجات، وتحليل الأسئلة لمساعدتك في اتخاذ قرارات تعليمية أفضل."
              : "Smart and direct analysis of success rates, class average, grade distribution, and question analysis to help you make better educational decisions."}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[2rem] overflow-hidden border border-border shadow-2xl bg-card max-w-5xl mx-auto"
        >
          <img
            src={reportsImg}
            alt={isAr ? "تقارير حصاد" : "Hasaad Reports"}
            className="w-full h-auto object-cover"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
      </div>
    </section>
  );
}