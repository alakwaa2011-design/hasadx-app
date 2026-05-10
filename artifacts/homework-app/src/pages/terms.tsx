import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

export default function TermsPage() {
  const { lang } = useI18n();
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
            العودة
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(26,71,49,0.1)" }}>
              <BookOpen className="w-5 h-5" style={{ color: "#1a4731" }} />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">الشروط والأحكام</h1>
          </div>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-sm text-muted-foreground/60">آخر تحديث: أبريل 2026</p>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">قبول الشروط</h2>
              <p>
                باستخدامك منصة حصاد فإنك توافق على الالتزام بهذه الشروط والأحكام. إن كنت لا
                توافق عليها، يُرجى عدم استخدام الخدمة.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">استخدام الخدمة</h2>
              <ul className="list-disc list-inside space-y-1 pr-2">
                <li>تُستخدم المنصة لأغراض تعليمية بحتة</li>
                <li>يلتزم المعلم بدقة المعلومات المدخلة في المنصة</li>
                <li>يُحظر استخدام المنصة بأي طريقة تضر بالمستخدمين الآخرين</li>
                <li>يُحظر محاولة اختراق المنصة أو التلاعب بنتائجها</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">حسابات المعلمين</h2>
              <p>
                يتحمل المعلم المسؤولية الكاملة عن بيانات تسجيل الدخول الخاصة به وعن
                أنشطة الطلاب داخل فصوله. يُرجى الإبلاغ الفوري عن أي استخدام غير مصرح به.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">المحتوى</h2>
              <p>
                يحتفظ المعلم بحقوق ملكية المحتوى الذي يُنشئه. بمشاركة المحتوى على المنصة،
                فإنه يمنح حصاد حق استخدامه لتقديم الخدمة دون التنازل عن الملكية.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">إيقاف الخدمة</h2>
              <p>
                تحتفظ منصة حصاد بالحق في إيقاف أو تقييد الوصول لأي حساب يُخالف هذه الشروط
                أو يُسيء استخدام الخدمة، دون الحاجة إلى إشعار مسبق.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">تعديل الشروط</h2>
              <p>
                قد تُعدَّل هذه الشروط من وقت لآخر. سيُبلَّغ المستخدمون بأي تغييرات جوهرية،
                واستمرارك في استخدام الخدمة يُعدّ قبولاً للشروط المحدَّثة.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">التواصل معنا</h2>
              <p>
                لأي استفسارات تتعلق بهذه الشروط، يمكنك التواصل معنا عبر صفحة
                {" "}<Link href="/feedback" className="font-semibold hover:underline" style={{ color: "#1a4731" }}>التواصل</Link>{" "}
                في المنصة.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
