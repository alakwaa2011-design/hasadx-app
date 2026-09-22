import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

export function CTASection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section className="border-t border-border bg-background" dir={dir}>
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] bg-[#1a4731] p-8 sm:p-12 lg:p-16 text-white shadow-2xl"
        >
          {/* Decorative background shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-[#2a684b] rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-80 h-80 bg-secondary/30 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              {isAr ? "جاهز لتحويل دروسك إلى تجربة لا تُنسى؟" : "Ready to turn your lessons into an unforgettable experience?"}
            </h2>
            <p className="text-emerald-100/90 text-lg md:text-xl font-medium mb-10 leading-relaxed max-w-2xl mx-auto">
              {isAr
                ? "انضم إلى آلاف المعلمين الذين يستخدمون حصاد يومياً لإنشاء محتوى تفاعلي يوفر وقتهم ويزيد من تفاعل طلابهم."
                : "Join thousands of teachers who use Hasaad daily to create interactive content that saves their time and increases student engagement."}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/register" 
                className="w-full sm:w-auto px-8 py-4 bg-secondary text-secondary-foreground font-black rounded-xl hover:bg-secondary/90 transition-all hover:-translate-y-1 shadow-xl flex items-center justify-center gap-2 text-lg"
              >
                {isAr ? "ابدأ تجربتك المجانية الآن" : "Start your free trial now"}
                {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </Link>
              <Link 
                href="/public/games" 
                className="w-full sm:w-auto px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-2 text-lg"
              >
                {isAr ? "استكشف الأنشطة" : "Explore Activities"}
              </Link>
            </div>
            
            <p className="mt-8 text-sm text-emerald-100/60 font-medium">
              {isAr ? "لا يتطلب بطاقة ائتمانية. وصول فوري للأدوات." : "No credit card required. Instant access to tools."}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}