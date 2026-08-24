import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

export default function TermsPage() {
  const { lang, t } = useI18n();
  useSeo(
    lang === "ar"
      ? {
          title: "شروط الاستخدام | منصة حصاد — HasadX",
          description: "شروط استخدام منصة حصاد التعليمية للمعلمين والطلاب والمؤسسات التعليمية.",
          canonicalPath: "/terms",
        }
      : {
          title: "Terms of Service | HasadX",
          description: "HasadX terms of service for teachers, students, and educational institutions.",
          canonicalPath: "/terms",
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
              <BookOpen className="w-5 h-5" style={{ color: "#1a4731" }} />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{lang === "ar" ? "الشروط والأحكام" : "Terms of Service"}</h1>
          </div>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-sm text-muted-foreground/60">{t.legal.lastUpdated}</p>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "قبول الشروط" : "Acceptance of terms"}</h2>
              <p>{lang === "ar" ? "باستخدامك منصة حصاد فإنك توافق على الالتزام بهذه الشروط والأحكام. إن كنت لا توافق عليها، يُرجى عدم استخدام الخدمة." : "By using HasadX, you agree to comply with these Terms of Service. If you do not agree, please do not use the service."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "استخدام الخدمة" : "Using the service"}</h2>
              <ul className="list-disc list-inside space-y-1 ps-2">
                {(lang === "ar" ? ["تُستخدم المنصة لأغراض تعليمية بحتة", "يلتزم المعلم بدقة المعلومات المدخلة في المنصة", "يُحظر استخدام المنصة بأي طريقة تضر بالمستخدمين الآخرين", "يُحظر محاولة اختراق المنصة أو التلاعب بنتائجها"] : ["The platform must be used for educational purposes only.", "Teachers are responsible for the accuracy of information entered into the platform.", "Do not use the platform in a way that harms other users.", "Do not attempt to compromise the platform or manipulate its results."]).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "حسابات المعلمين" : "Teacher accounts"}</h2>
              <p>{lang === "ar" ? "يتحمل المعلم المسؤولية الكاملة عن بيانات تسجيل الدخول الخاصة به وعن أنشطة الطلاب داخل فصوله. يُرجى الإبلاغ الفوري عن أي استخدام غير مصرح به." : "Teachers are fully responsible for their sign-in credentials and for student activity in their classes. Please report unauthorized use immediately."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "المحتوى" : "Content"}</h2>
              <p>{lang === "ar" ? "يحتفظ المعلم بحقوق ملكية المحتوى الذي يُنشئه. بمشاركة المحتوى على المنصة، فإنه يمنح حصاد حق استخدامه لتقديم الخدمة دون التنازل عن الملكية." : "Teachers retain ownership of content they create. By sharing content on the platform, they grant HasadX permission to use it to provide the service without transferring ownership."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "إيقاف الخدمة" : "Suspension of service"}</h2>
              <p>{lang === "ar" ? "تحتفظ منصة حصاد بالحق في إيقاف أو تقييد الوصول لأي حساب يُخالف هذه الشروط أو يُسيء استخدام الخدمة، دون الحاجة إلى إشعار مسبق." : "HasadX may suspend or restrict access to any account that violates these terms or misuses the service, without prior notice."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "تعديل الشروط" : "Changes to these terms"}</h2>
              <p>{lang === "ar" ? "قد تُعدَّل هذه الشروط من وقت لآخر. سيُبلَّغ المستخدمون بأي تغييرات جوهرية، واستمرارك في استخدام الخدمة يُعدّ قبولاً للشروط المحدَّثة." : "These terms may change from time to time. Users will be informed of material changes, and continued use of the service means acceptance of the updated terms."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "التواصل معنا" : "Contact us"}</h2>
              <p>{lang === "ar" ? "لأي استفسارات تتعلق بهذه الشروط، يمكنك التواصل معنا عبر صفحة " : "For questions about these terms, please use the platform's "}<Link href="/feedback" className="font-semibold hover:underline" style={{ color: "#1a4731" }}>{t.legal.contact}</Link>{lang === "ar" ? " في المنصة." : " page."}</p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
