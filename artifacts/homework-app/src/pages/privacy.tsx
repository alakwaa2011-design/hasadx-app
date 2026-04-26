import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { lang } = useI18n();
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
              <Shield className="w-5 h-5" style={{ color: "#1a4731" }} />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">سياسة الخصوصية</h1>
          </div>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-sm text-muted-foreground/60">آخر تحديث: أبريل 2026</p>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">مقدمة</h2>
              <p>
                تُعنى منصة حصاد بحماية خصوصية مستخدميها. توضح هذه السياسة كيفية جمع بياناتك
                واستخدامها وحمايتها عند استخدامك لخدماتنا.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">البيانات التي نجمعها</h2>
              <ul className="list-disc list-inside space-y-1 pr-2">
                <li>الاسم والبريد الإلكتروني ورقم الهاتف عند التسجيل</li>
                <li>بيانات الاستخدام مثل الواجبات والنتائج والتفاعلات داخل المنصة</li>
                <li>معلومات الجهاز والمتصفح لأغراض الأمان وتحسين الخدمة</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">كيف نستخدم بياناتك</h2>
              <ul className="list-disc list-inside space-y-1 pr-2">
                <li>تشغيل الخدمة وتقديم الميزات التعليمية</li>
                <li>إرسال إشعارات تتعلق بالواجبات والنتائج</li>
                <li>تحسين المنصة بناءً على أنماط الاستخدام</li>
                <li>ضمان أمان الحسابات وحماية المستخدمين</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">حماية البيانات</h2>
              <p>
                تُشفَّر جميع البيانات أثناء النقل وعند التخزين. لا نبيع بياناتك الشخصية لأطراف
                ثالثة، ولا نشاركها إلا عند الضرورة القانونية أو بموافقتك الصريحة.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">بيانات الأطفال</h2>
              <p>
                نولي اهتماماً خاصاً لخصوصية الطلاب القاصرين. لا يُجمع من الطلاب سوى المعلومات
                الضرورية لاستخدام المنصة، وتكون تحت إشراف المعلم المسؤول.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">حقوقك</h2>
              <p>
                يحق لك في أي وقت طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. تواصل معنا عبر
                قسم التواصل داخل المنصة لتقديم طلبك.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">التواصل معنا</h2>
              <p>
                لأي استفسارات تتعلق بالخصوصية، يمكنك التواصل معنا من خلال صفحة
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
