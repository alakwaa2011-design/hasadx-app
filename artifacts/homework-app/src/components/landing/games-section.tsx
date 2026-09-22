import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import tugOfWarImg from "@/assets/landing/tug-of-war.png";
import xoInteractiveImg from "@/assets/landing/xo-interactive.png";
import rocketRaceImg from "@/assets/landing/rocket-race.png";

export function GamesSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section id="games" className="py-20 lg:py-32 bg-[#fbfcf8] dark:bg-background border-t border-border/50" dir={dir}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-foreground">
            {isAr ? "اكتشف الألعاب الصفية والتحديات" : "Discover classroom games and challenges"}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 bg-card rounded-[2rem] border border-border overflow-hidden shadow-xl group hover:border-primary/30 transition-colors"
          >
            <div className="p-6 md:p-8 border-b border-border bg-gradient-to-b from-card to-muted/20">
              <h3 className="text-2xl font-black text-foreground">{isAr ? "لعبة شد الحبل" : "Tug of War Game"}</h3>
            </div>
            <div className="relative aspect-[16/7] bg-muted w-full overflow-hidden">
              <img
                src={tugOfWarImg}
                alt={isAr ? "لعبة شد الحبل" : "Tug of War"}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                loading="lazy"
                decoding="async"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-lg group hover:border-primary/30 transition-colors"
          >
            <div className="p-6 border-b border-border bg-gradient-to-b from-card to-muted/20">
              <h3 className="text-xl font-black text-foreground">{isAr ? "لعبة XO التفاعلية" : "Interactive XO Game"}</h3>
            </div>
            <div className="relative aspect-[4/3] bg-muted w-full overflow-hidden">
              <img
                src={xoInteractiveImg}
                alt={isAr ? "لعبة XO التفاعلية" : "Interactive XO"}
                className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                loading="lazy"
                decoding="async"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-lg group hover:border-primary/30 transition-colors"
          >
            <div className="p-6 border-b border-border bg-gradient-to-b from-card to-muted/20">
              <h3 className="text-xl font-black text-foreground">{isAr ? "سباق الصواريخ" : "Rocket Race"}</h3>
            </div>
            <div className="relative aspect-[4/3] bg-muted w-full overflow-hidden">
              <img
                src={rocketRaceImg}
                alt={isAr ? "سباق الصواريخ" : "Rocket Race"}
                className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                loading="lazy"
                decoding="async"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}