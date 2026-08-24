import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

export default function PrivacyPage() {
  const { lang, t } = useI18n();
  useSeo(
    lang === "ar"
      ? {
          title: "سياسة الخصوصية | منصة حصاد — HasadX",
          description: "سياسة الخصوصية في منصة حصاد التعليمية: كيفية جمع البيانات وحمايتها وحقوق المستخدم.",
          canonicalPath: "/privacy",
        }
      : {
          title: "Privacy Policy | HasadX",
          description: "How HasadX collects, protects, and uses your data — and your rights as a user.",
          canonicalPath: "/privacy",
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
              <Shield className="w-5 h-5" style={{ color: "#1a4731" }} />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
          </div>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-sm text-muted-foreground/60">{t.legal.lastUpdated}</p>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "مقدمة" : "Introduction"}</h2>
              <p>{lang === "ar" ? "تُعنى منصة حصاد بحماية خصوصية مستخدميها. توضح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها عند استخدامك لخدماتنا." : "HasadX is committed to protecting users' privacy. This policy explains how we collect, use, and protect your data when you use our services."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "البيانات التي نجمعها" : "Data we collect"}</h2>
              <ul className="list-disc list-inside space-y-1 ps-2">
                {(lang === "ar" ? ["الاسم والبريد الإلكتروني ورقم الهاتف عند التسجيل", "بيانات الاستخدام مثل الواجبات والنتائج والتفاعلات داخل المنصة", "معلومات الجهاز والمتصفح لأغراض الأمان وتحسين الخدمة"] : ["Name, email address, and phone number at registration.", "Usage data such as assignments, results, and interactions on the platform.", "Device and browser information for security and service improvement."]).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "كيف نستخدم بياناتك" : "How we use your data"}</h2>
              <ul className="list-disc list-inside space-y-1 ps-2">
                {(lang === "ar" ? ["تشغيل الخدمة وتقديم الميزات التعليمية", "إرسال إشعارات تتعلق بالواجبات والنتائج", "تحسين المنصة بناءً على أنماط الاستخدام", "ضمان أمان الحسابات وحماية المستخدمين"] : ["Operate the service and provide educational features.", "Send notifications about assignments and results.", "Improve the platform based on usage patterns.", "Keep accounts secure and protect users."]).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "حماية البيانات" : "Data protection"}</h2>
              <p>{lang === "ar" ? "تُشفَّر جميع البيانات أثناء النقل وعند التخزين. لا نبيع بياناتك الشخصية لأطراف ثالثة، ولا نشاركها إلا عند الضرورة القانونية أو بموافقتك الصريحة." : "All data is encrypted in transit and at rest. We do not sell personal data to third parties, and share it only when legally necessary or with your explicit consent."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "بيانات الأطفال" : "Children's data"}</h2>
              <p>{lang === "ar" ? "نولي اهتماماً خاصاً لخصوصية الطلاب القاصرين. لا يُجمع من الطلاب سوى المعلومات الضرورية لاستخدام المنصة، وتكون تحت إشراف المعلم المسؤول." : "We give special attention to the privacy of minor students. We collect only information necessary to use the platform, under the supervision of the responsible teacher."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "حقوقك" : "Your rights"}</h2>
              <p>{lang === "ar" ? "يحق لك في أي وقت طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. تواصل معنا عبر قسم التواصل داخل المنصة لتقديم طلبك." : "You may request access to, correction of, or deletion of your data at any time. Contact us through the platform to submit your request."}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-foreground">{lang === "ar" ? "التواصل معنا" : "Contact us"}</h2>
              <p>{lang === "ar" ? "لأي استفسارات تتعلق بالخصوصية، يمكنك التواصل معنا من خلال صفحة " : "For privacy questions, contact us through the platform's "}<Link href="/feedback" className="font-semibold hover:underline" style={{ color: "#1a4731" }}>{t.legal.contact}</Link>{lang === "ar" ? " في المنصة." : " page."}</p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
