import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

export function FAQSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: isAr ? "هل حصاد مجاني بالكامل؟" : "Is Hasaad completely free?",
      a: isAr 
        ? "نعم، نقدم باقة مجانية متكاملة تلبي احتياجات المعلم اليومية. لدينا أيضاً باقات متقدمة بمميزات إضافية للمدارس والمؤسسات التعليمية."
        : "Yes, we offer a comprehensive free plan that meets a teacher's daily needs. We also have advanced plans with extra features for schools."
    },
    {
      q: isAr ? "هل يمكن للطلاب استخدام المنصة بدون تسجيل حساب؟" : "Can students use the platform without creating an account?",
      a: isAr
        ? "نعم! يمكن للطلاب الدخول إلى الألعاب والأنشطة التفاعلية مباشرة باستخدام (رمز الدخول) أو رابط المشاركة السريع، دون الحاجة لإنشاء حساب أو تذكر كلمات مرور."
        : "Yes! Students can join interactive games and activities instantly using a PIN or quick link, with no account required."
    },
    {
      q: isAr ? "كيف تعمل أدوات الذكاء الاصطناعي في حصاد؟" : "How do the AI tools work in Hasaad?",
      a: isAr
        ? "تستخدم أدواتنا نماذج لغوية متقدمة مخصصة للمحتوى التعليمي العربي. تقوم بتحليل موضوع الدرس وتوليد أسئلة دقيقة، خطط دروس، وأوراق عمل خلال ثوانٍ، مع إمكانية تعديلها يدوياً."
        : "Our tools use advanced language models optimized for Arabic educational content. They analyze your topic and generate accurate questions, lesson plans, and worksheets in seconds, all fully editable."
    },
    {
      q: isAr ? "هل يدعم حصاد العمل على الشاشات التفاعلية (السبورة الذكية)؟" : "Does Hasaad support smart boards?",
      a: isAr
        ? "بالتأكيد. واجهة العرض (Present Mode) مصممة خصيصاً لتناسب الشاشات الكبيرة والسبورات الذكية في الفصول، بأزرار واضحة وألوان متباينة."
        : "Absolutely. The Present Mode interface is specifically designed for large screens and smart boards, with clear buttons and high-contrast colors."
    }
  ];

  return (
    <section className="border-t border-border bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-black text-primary mb-2">
            {isAr ? "الأسئلة الشائعة" : "FAQ"}
          </p>
          <h2 className="text-3xl font-black text-foreground sm:text-4xl mb-4">
            {isAr ? "كل ما تود معرفته عن منصة حصاد" : "Everything you need to know about Hasaad"}
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div 
                key={i} 
                className={`border rounded-2xl overflow-hidden transition-colors ${isOpen ? 'bg-card border-primary/30 shadow-sm' : 'bg-background border-border hover:bg-card/50'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-start"
                >
                  <span className="font-bold text-foreground text-lg">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180 text-primary" : ""}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-muted-foreground font-medium leading-relaxed border-t border-border/50 pt-4 mt-2">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        
        <div className="text-center mt-10">
          <Link href="/faq" className="text-primary font-bold hover:underline">
            {isAr ? "عرض جميع الأسئلة الشائعة" : "View all frequently asked questions"}
          </Link>
        </div>
      </div>
    </section>
  );
}