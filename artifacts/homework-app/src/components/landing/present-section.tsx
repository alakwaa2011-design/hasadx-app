import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import interactivePresentationImg from "@/assets/landing/interactive-presentation.png";
import { Users, BarChart3, CheckCircle2 } from "lucide-react";

export function PresentSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section className="py-20 lg:py-32 bg-[#fbfcf8] dark:bg-background overflow-hidden" dir={dir}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          <motion.div
            initial={{ opacity: 0, x: isAr ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1 relative"
          >
            <div className="rounded-[2rem] overflow-hidden border-2 border-primary/10 shadow-2xl bg-card relative z-10">
              <img
                src={interactivePresentationImg}
                alt={isAr ? "تفاعل المتعلمين" : "Learners Interaction"}
                className="w-full h-auto object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-secondary/20 to-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: isAr ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <p className="text-sm font-black text-secondary mb-3 tracking-wide">
              {isAr ? "اعرض وتفاعل" : "Present & Interact"}
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-6 leading-tight">
              {isAr ? "اجمع بين الشرح والتطبيق في نفس اللحظة" : "Combine explanation and practice seamlessly"}
            </h2>
            <p className="text-lg text-muted-foreground font-medium mb-8 leading-relaxed">
              {isAr
                ? "يستطيع المعلم إضافة أسئلة وأنشطة مدمجة داخل العرض، ومتابعة مشاركة المتعلمين وإجاباتهم مباشرة على الشاشة دون تشتت."
                : "Teachers can add questions and activities embedded within the presentation, and track learners' participation directly on screen."}
            </p>

            <div className="space-y-5">
              {[
                { icon: CheckCircle2, text: isAr ? "أسئلة وأنشطة داخل العرض" : "Embedded questions and activities" },
                { icon: Users, text: isAr ? "متابعة مشاركة المتعلمين مباشرة" : "Live tracking of learners' participation" },
                { icon: BarChart3, text: isAr ? "نتائج فورية لتقييم الفهم" : "Instant results to evaluate understanding" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-bold text-foreground text-lg">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}