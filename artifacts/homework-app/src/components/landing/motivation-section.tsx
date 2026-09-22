import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import motivationBoardImg from "@/assets/landing/motivation-board.webp";

export function MotivationSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section
      id="motivation"
      className="scroll-mt-20 overflow-hidden border-b border-border/50 bg-[#fbfcf8] py-20 dark:bg-background lg:py-32"
      dir={dir}
    >
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center lg:mb-16">
          <p className="mb-3 text-sm font-black text-secondary">
            {isAr ? "لوحة التحفيز" : "Motivation Board"}
          </p>
          <h2 className="mb-6 text-3xl font-black text-foreground md:text-4xl">
            {isAr ? "حفّز المشاركة واحتفِ بالإنجاز" : "Encourage participation and celebrate achievement"}
          </h2>
          <p className="text-lg font-medium leading-relaxed text-muted-foreground">
            {isAr
              ? "تابع تقدّم المتعلمين، وقدّر جهودهم، واجعل كل إنجاز ظاهرًا في لوحة صفية واحدة."
              : "Track learners' progress, recognize their efforts, and make every achievement visible on one classroom board."}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:rounded-[2rem]"
        >
          <img
            src={motivationBoardImg}
            alt={isAr ? "لوحة التحفيز الأصلية في حصاد" : "Hasaad's original motivation board"}
            className="block h-auto w-full object-contain"
            loading="lazy"
            decoding="async"
            data-testid="img-motivation-board"
          />
        </motion.div>
      </div>
    </section>
  );
}