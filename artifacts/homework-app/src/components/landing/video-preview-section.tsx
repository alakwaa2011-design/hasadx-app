import { Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

export function VideoPreviewSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section id="present-section" className="border-t border-border bg-[#fbfcf8] dark:bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#e6c585] via-[#d4ad5f] to-[#c89a47] p-6 sm:p-8 shadow-2xl">
              {/* Video preview card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#c89a47] via-[#b8893a] to-[#a87a2e] border border-white/20">
                <div className="flex items-center justify-between px-6 pt-5 text-white/95">
                  <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                    00:42
                  </span>
                  <span className="text-xs font-bold opacity-90 tracking-wide">
                    {isAr ? "رحلة الماء في الطبيعة" : "The water journey"}
                  </span>
                </div>
                <div className="relative px-6 pb-16 pt-6 text-start text-white">
                  <p className="text-xs font-bold opacity-90 uppercase tracking-widest text-secondary">
                    {isAr ? "فيديو تفاعلي" : "Interactive video"}
                  </p>
                  <h3 className="mt-2 text-3xl font-black leading-tight drop-shadow-md">
                    {isAr ? "دورة الماء" : "The water cycle"}
                  </h3>
                  <p className="mt-3 text-sm font-medium opacity-90 leading-relaxed max-w-sm">
                    {isAr
                      ? "شاهد المقطع ثم أجب مباشرة كما يراه الطالب داخل حصاد."
                      : "Watch the clip, then answer right inside Hasad as your students do."}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={isAr ? "تشغيل" : "Play"}
                  className="group absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/30 backdrop-blur-md transition-all hover:scale-110 shadow-xl border border-white/40"
                >
                  <span
                    className="absolute inset-0 animate-ping rounded-full bg-white/30"
                    style={{ animationDuration: "2.5s" }}
                  />
                  <Play className="relative h-10 w-10 translate-x-[3px] fill-white text-white drop-shadow-lg" />
                </button>
              </div>
            </div>
            
            {/* Floating badges */}
            <div className="absolute -bottom-6 -right-6 md:right-8 bg-card rounded-2xl p-4 shadow-xl border border-border flex items-center gap-4 hidden sm:flex">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">{isAr ? "توقف ذكي" : "Smart Pause"}</p>
                <p className="text-xs font-medium text-muted-foreground">{isAr ? "يسأل الطالب أثناء العرض" : "Asks during playback"}</p>
              </div>
            </div>
          </motion.div>

          <div className="max-w-xl">
            <p className="text-sm font-black text-primary">
              {isAr ? "العرض والتفاعل" : "Present & Engage"}
            </p>
            <h2 className="mt-2 text-3xl font-black text-foreground sm:text-4xl leading-tight">
              {isAr
                ? "حوّل دروسك إلى تجربة تفاعلية تشد الانتباه"
                : "Turn your lessons into an engaging interactive experience"}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground font-medium">
              {isAr
                ? "لا مزيد من الدروس المملة. مع حصاد، يمكنك دمج الأسئلة والاختبارات داخل عروضك ومقاطع الفيديو، ليشارك الطلاب في نفس اللحظة من أجهزتهم."
                : "No more boring lessons. With Hasaad, integrate questions directly into your presentations and videos, letting students participate instantly from their devices."}
            </p>
            <ul className="mt-8 space-y-4">
              {[
                isAr ? "دعم الشاشات الذكية والهواتف" : "Smart boards and phones support",
                isAr ? "نتائج فورية تعرض أمام الجميع" : "Instant results displayed live",
                isAr ? "تحكم كامل بوقت وشكل التفاعل" : "Full control over timing and format"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-foreground font-bold">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs shrink-0">
                    ✓
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}