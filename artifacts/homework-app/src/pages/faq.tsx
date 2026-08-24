import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, HelpCircle, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { motion, AnimatePresence } from "framer-motion";

const faqs = {
  ar: [
  {
    q: "كيف أنشئ واجباً جديداً؟",
    a: "بعد تسجيل الدخول، انتقل إلى لوحة التحكم واضغط على 'واجب جديد'. يمكنك إضافة أسئلة متنوعة وتحديد موعد التسليم ومشاركة رابط الواجب مع طلابك.",
  },
  {
    q: "كيف يصل الطالب إلى الواجب؟",
    a: "يكفي أن تشارك الطالب رابط الواجب المباشر. لا يحتاج الطالب إلى إنشاء حساب للحل؛ يُدخل اسمه ويبدأ الإجابة مباشرة.",
  },
  {
    q: "هل يمكنني متابعة نتائج الطلاب؟",
    a: "نعم، تجد في صفحة تفاصيل الواجب قسم 'النتائج' الذي يعرض جميع إجابات الطلاب، وعلاماتهم، وتاريخ التسليم.",
  },
  {
    q: "ما أنواع الأسئلة المتاحة؟",
    a: "تدعم المنصة أسئلة الاختيار من متعدد، والصواب والخطأ، وملء الفراغ، والكتابة الحرة، والمطابقة. يمكنك أيضاً إضافة صور وملفات صوتية.",
  },
  {
    q: "ما هو وضع المسابقة الحية؟",
    a: "يتيح لك وضع المسابقة الحية تحويل الواجب إلى لعبة تنافسية في الوقت الفعلي. يدخل الطلاب برمز الجلسة ويتنافسون على الإجابات السريعة والصحيحة مع ظهور لوحة المتصدرين.",
  },
  {
    q: "نسيت كلمة المرور، كيف أستعيدها؟",
    a: "اضغط على رابط 'نسيت كلمة المرور؟' في صفحة تسجيل الدخول، وأدخل بريدك الإلكتروني أو رقم هاتفك، وستصلك تعليمات إعادة التعيين.",
  },
  {
    q: "هل المنصة مجانية؟",
    a: "تقدم منصة حصاد إمكانية استخدام الميزات الأساسية مجاناً. للاستفسار عن الخطط المتقدمة، تواصل معنا عبر قسم التواصل.",
  },
  {
    q: "هل بيانات طلابي آمنة؟",
    a: "نعم. تُشفَّر جميع البيانات ولا تُشارك مع أطراف خارجية. راجع سياسة الخصوصية لمزيد من التفاصيل.",
  },
  ],
  en: [
    { q: "How do I create a new assignment?", a: "After signing in, go to the Dashboard and select “New Assignment.” Add different question types, set a due date, and share the assignment link with your students." },
    { q: "How does a student access an assignment?", a: "Share the direct assignment link with the student. Students can enter their name and start answering without creating an account." },
    { q: "Can I track student results?", a: "Yes. The assignment details page includes a Results section with student answers, scores, and submission dates." },
    { q: "What question types are available?", a: "The platform supports multiple choice, true/false, fill-in-the-blank, free writing, and matching questions. You can also add images and audio files." },
    { q: "What is live competition mode?", a: "Live competition mode turns an assignment into a real-time competitive game. Students join with a session code and compete for fast, correct answers on a live leaderboard." },
    { q: "I forgot my password. How do I reset it?", a: "Select “Forgot password?” on the sign-in page, enter your email address or phone number, and follow the reset instructions you receive." },
    { q: "Is the platform free?", a: "HasadX offers free access to core features. Contact us through the feedback page to ask about advanced plans." },
    { q: "Is my students’ data safe?", a: "Yes. Data is encrypted and is not shared with external parties. See the Privacy Policy for more details." },
  ],
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-semibold text-foreground text-sm">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FaqPage() {
  const { lang, t } = useI18n();
  const localizedFaqs = faqs[lang];

  // Inject FAQPage structured data for Google Rich Snippets
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": localizedFaqs.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "faq-schema";
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => { document.getElementById("faq-schema")?.remove(); };
  }, [localizedFaqs]);

  useSeo(
    lang === "ar"
      ? {
          title: "الأسئلة الشائعة | منصة حصاد — HasadX",
          description:
            "أجوبة سريعة عن أكثر الأسئلة شيوعًا حول منصة حصاد التعليمية: العروض التفاعلية، المسابقات التعليمية، الواجبات، وإنشاء العروض بالذكاء الاصطناعي.",
          canonicalPath: "/faq",
        }
      : {
          title: "FAQ | HasadX — Arabic interactive teaching platform",
          description:
            "Common questions about HasadX: interactive presentations, quizzes, assignments and AI-generated lessons.",
          canonicalPath: "/faq",
        },
  );
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <Layout>
      <div className="min-h-[calc(100vh-3.5rem)] py-12 px-5 sm:px-8 bg-background" dir={dir}>
        <div className="max-w-2xl mx-auto">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className={`w-4 h-4 ${lang === "ar" ? "rotate-180" : ""}`} />
            {t.legal.back}
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(26,71,49,0.1)" }}>
              <HelpCircle className="w-5 h-5" style={{ color: "#1a4731" }} />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{lang === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}</h1>
          </div>

          <div className="space-y-3">
            {localizedFaqs.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>

          <div className="mt-10 p-5 rounded-xl border border-border/50 bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground mb-3">{lang === "ar" ? "لم تجد إجابة لسؤالك؟" : "Didn't find an answer to your question?"}</p>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg transition-colors text-white"
              style={{ background: "#1a4731" }}
            >
              {lang === "ar" ? "تواصل معنا" : "Contact us"}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
