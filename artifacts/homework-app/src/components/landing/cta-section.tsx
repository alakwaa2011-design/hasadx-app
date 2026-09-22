import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

export function CTASection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <section className="border-t border-border bg-background" dir={dir}>
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] bg-[#173a28] p-10 sm:p-14 lg:p-20 text-white shadow-2xl text-center"
        >
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-[#225739] rounded-full blur-3xl opacity-80 pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-80 h-80 bg-secondary/30 rounded-full blur-3xl opacity-40 pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-[1.2]">
              {isAr ? "ابدأ تجربة تعليمية أكثر تفاعلًا" : "Start a more interactive learning experience"}
            </h2>
            <p className="text-emerald-100/90 text-lg md:text-xl font-medium mb-10 leading-relaxed max-w-2xl mx-auto">
              {isAr
                ? "أنشئ محتواك، شاركه بسهولة، واجعل المتعلمين يشاركون ويتفاعلون من مكان واحد."
                : "Create your content, share it easily, and get learners to participate and interact from one place."}
            </p>
            
            <div className="flex justify-center">
              <Link 
                href="/register" 
                className="w-full sm:w-auto px-10 py-5 bg-secondary text-secondary-foreground font-black rounded-xl hover:bg-secondary/90 transition-all hover:-translate-y-1 shadow-xl flex items-center justify-center gap-3 text-xl"
              >
                {isAr ? "ابدأ الآن مجانًا" : "Start now for free"}
                {isAr ? <ArrowLeft className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
