import { Link } from "wouter";
import { Check, Star, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePublicPricing, SubscriptionPlan } from "@/lib/landing-api";
import { motion } from "framer-motion";

export function PricingSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const { data, loading } = usePublicPricing();

  if (loading) {
    return (
      <section className="py-24 bg-background" dir={dir}>
        <div className="container mx-auto px-4 max-w-5xl flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  // Only render if API explicitly enables the pricing page and there are plans
  if (!data?.pricingPageVisible || !data.plans || data.plans.length === 0) {
    return null;
  }

  const paidPlans = data.plans.filter((plan) => plan.code !== "free");

  const freePlanFeatures = isAr ? [
    "الوصول للألعاب التفاعلية مجاناً",
    "إنشاء دروس ومسابقات",
    "لوحة تحكم لإدارة الفصول",
    "مشاركة الأنشطة مع الطلاب"
  ] : [
    "Free access to interactive games",
    "Create lessons and quizzes",
    "Classroom management dashboard",
    "Share activities with students"
  ];

  return (
    <section id="pricing" className="border-t border-border bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-black text-primary mb-2">
            {isAr ? "الباقات والأسعار" : "Plans & Pricing"}
          </p>
          <h2 className="text-3xl font-black text-foreground sm:text-4xl mb-4">
            {isAr ? "باقات تناسب احتياجك" : "Plans that fit your needs"}
          </h2>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            {isAr 
              ? "اشترك في باقات حصاد للحصول على رصيد شهري إضافي وميزات متقدمة لمعلمي المستقبل."
              : "Subscribe to Hasaad plans to get monthly credits and advanced features for future teachers."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {/* Free Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-3xl p-8 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-black text-foreground mb-2">
              {isAr ? "الباقة الأساسية" : "Basic Plan"}
            </h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-foreground">
                {isAr ? "مجانًا" : "Free"}
              </span>
            </div>
            
            <Link 
              href="/register" 
              className="w-full py-3 px-4 rounded-xl border border-primary text-primary font-bold text-center hover:bg-primary/5 transition-colors mb-8"
            >
              {isAr ? "ابدأ مجانًا" : "Start Free"}
            </Link>
            
            <ul className="space-y-4 mt-auto">
              {freePlanFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm font-medium text-foreground">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Dynamic Paid Plans */}
          {paidPlans.map((plan, i) => {
            const price = (plan.priceMinor ?? 0) / 100;
            const currency = plan.currency === "SAR" ? (isAr ? "ر.س" : "SAR") : plan.currency;
            const period = plan.billingPeriodDays === 30 ? (isAr ? "/شهر" : "/mo") : plan.billingPeriodDays === 365 ? (isAr ? "/سنة" : "/yr") : "";
            const monthlyCredits = plan.monthlyCredits ?? 0;
            
            // Assume the first paid plan is standard, the second is featured (or based on index)
            const isFeatured = i === 0;

            return (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * (i + 1) }}
                className={`relative rounded-3xl p-8 flex flex-col h-full ${
                  isFeatured 
                    ? "bg-[#173a28] text-white shadow-xl shadow-primary/20 border-none transform md:-translate-y-4" 
                    : "bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
                }`}
              >
                {isFeatured && (
                  <div className="absolute top-0 inset-x-0 -translate-y-1/2 flex justify-center">
                    <span className="bg-secondary text-secondary-foreground text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3" />
                      {isAr ? "الأكثر طلبًا" : "Most Popular"}
                    </span>
                  </div>
                )}
                
                <h3 className={`text-xl font-black mb-2 ${isFeatured ? "text-white" : "text-foreground"}`}>
                  {isAr ? plan.nameAr : plan.nameEn}
                </h3>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className={`text-4xl font-black ${isFeatured ? "text-white" : "text-foreground"}`}>
                    {price.toLocaleString(isAr ? "ar-EG" : "en-US")}
                  </span>
                  <span className={`text-sm font-bold ${isFeatured ? "text-emerald-200" : "text-muted-foreground"}`}>
                    {currency} {period}
                  </span>
                </div>
                
                <Link 
                  href="/register" 
                  className={`w-full py-3 px-4 rounded-xl font-bold text-center transition-colors mb-8 ${
                    isFeatured 
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-md" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isAr ? "اشترك الآن" : "Subscribe Now"}
                </Link>
                
                <ul className="space-y-4 mt-auto">
                  {monthlyCredits > 0 && (
                    <li className="flex items-start gap-3 text-sm font-medium">
                      <Zap className={`w-5 h-5 shrink-0 ${isFeatured ? "text-secondary" : "text-primary"}`} />
                      <span className={isFeatured ? "text-emerald-50" : "text-foreground"}>
                        <strong className="mx-1">{monthlyCredits.toLocaleString(isAr ? "ar-EG" : "en-US")}</strong>
                        {isAr ? "رصيد ذكاء اصطناعي شهرياً" : "AI credits per month"}
                      </span>
                    </li>
                  )}
                  
                  {plan.rolloverCap !== null && plan.rolloverCap > 0 && (
                    <li className="flex items-start gap-3 text-sm font-medium">
                      <Check className={`w-5 h-5 shrink-0 ${isFeatured ? "text-emerald-400" : "text-primary"}`} />
                      <span className={isFeatured ? "text-emerald-50" : "text-foreground"}>
                        {isAr ? "ترحيل الرصيد المتبقي" : "Rollover unused credits"}
                        <span className="opacity-70 text-xs block mt-0.5">
                          {isAr ? `بحد أقصى ${plan.rolloverCap.toLocaleString("ar-EG")}` : `Up to ${plan.rolloverCap.toLocaleString("en-US")} limit`}
                        </span>
                      </span>
                    </li>
                  )}
                  
                  <li className="flex items-start gap-3 text-sm font-medium">
                    <Check className={`w-5 h-5 shrink-0 ${isFeatured ? "text-emerald-400" : "text-primary"}`} />
                    <span className={isFeatured ? "text-emerald-50" : "text-foreground"}>
                      {isAr ? "جميع مميزات الباقة الأساسية" : "All Basic Plan features"}
                    </span>
                  </li>
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}