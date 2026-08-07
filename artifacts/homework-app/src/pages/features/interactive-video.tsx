/* /features/interactive-video — الفيديو التعليمي التفاعلي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Play, PauseCircle, MessageSquare, BarChart3,
  BookOpen, CheckCircle2, ArrowLeft, Eye, Clock,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureInteractiveVideo() {
  useSeo({
    title: "الفيديو التعليمي التفاعلي — أوقف الفيديو واجعل طلابك يجيبون | حصاد",
    description:
      "أضف أسئلة تفاعلية داخل أي فيديو تعليمي. يتوقف الفيديو تلقائياً عند كل سؤال وينتظر إجابة الطالب — تجربة تعلّم نشطة بدلاً من مشاهدة سلبية.",
    canonicalPath: "/features/interactive-video",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "الفيديو التعليمي التفاعلي — حصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "أداة لإضافة أسئلة تفاعلية داخل الفيديوهات التعليمية — يتوقف الفيديو عند كل سؤال وينتظر إجابة الطالب.",
      "url": "https://hasadx.com/features/interactive-video",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "interactive-video-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("interactive-video-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Play className="w-4 h-4" />
              فيديو تفاعلي · حصاد
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              الفيديو التعليمي التفاعلي — أوقف الفيديو واجعل طلابك يُجيبون
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              حوّل أي فيديو تعليمي إلى تجربة تعلّم نشطة. أضف أسئلة في نقاط محددة من الفيديو،
              ويتوقف تلقائياً عند كل سؤال حتى يُجيب الطالب — بدلاً من مشاهدة سلبية لا يتذكر منها شيئاً.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب الفيديو التفاعلي
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/presentations-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أيضاً: العروض التفاعلية
              </Link>
            </div>
          </header>

          {/* المشكلة والحل */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">المشكلة مع الفيديو التقليدي</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                الطالب الذي يُشاهد فيديو تعليمياً بدون تفاعل يُعالج المعلومات بشكل سلبي — ينسى معظمها
                بعد ساعات قليلة. الفيديو التفاعلي في حصاد يُحوّل المشاهدة السلبية إلى تعلّم نشط:
                يتوقف الفيديو عند نقاط محددة، يُجيب الطالب على سؤال، ثم يستمر من حيث توقف.
              </p>
              <p>
                المعلم يحصل على تقرير يُظهر أداء كل طالب في كل سؤال — ويعرف بالضبط أين أخطأ الفهم
                دون الحاجة لاختبار منفصل.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">مميزات الفيديو التفاعلي في حصاد</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <PauseCircle className="w-5 h-5" />, title: "توقف تلقائي عند كل سؤال", body: "يتوقف الفيديو في اللحظة التي تحددها ويعرض السؤال — ثم يستأنف بعد الإجابة." },
                { icon: <MessageSquare className="w-5 h-5" />, title: "أنواع أسئلة متعددة", body: "اختيار متعدد، صح وخطأ، إجابة نصية — أضف ما يناسب المحتوى." },
                { icon: <Eye className="w-5 h-5" />, title: "مشاهدة فردية أو جماعية", body: "الطالب يُشاهد وحده في وقته، أو تُشغّله في الفصل وتوقفه أنت وتناقش الإجابات." },
                { icon: <BarChart3 className="w-5 h-5" />, title: "تقرير أداء مفصّل", body: "اعرف من أجاب صح، من تخطّى السؤال، وما هو متوسط وقت الإجابة." },
                { icon: <BookOpen className="w-5 h-5" />, title: "ملاحظات المعلم", body: "أضف تعليقات نصية تظهر للطالب في نقاط معينة من الفيديو كتنبيهات أو توجيهات." },
                { icon: <Clock className="w-5 h-5" />, title: "يعمل مع روابط YouTube", body: "ألصق رابط أي فيديو YouTube وأضف عليه أسئلتك مباشرة." },
              ].map(({ icon, title, body }) => (
                <li key={title} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm list-none">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">{icon}</div>
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* حالات الاستخدام */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">أمثلة على الاستخدام</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: <Play className="w-5 h-5" />, title: "واجب منزلي بالفيديو", body: "أرسل للطالب رابط الفيديو التفاعلي كواجب يُنجزه في أي وقت ويُرسل إجاباته تلقائياً." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "شرح حصة معكوسة", body: "في نموذج الفصل المعكوس — يُشاهد الطالب الدرس في البيت ويُجيب على أسئلتك." },
                { icon: <Eye className="w-5 h-5" />, title: "عرض في الفصل مع نقاش", body: "أوقف الفيديو عند نقاط مهمة وناقش إجابات الطلاب قبل الاستمرار." },
              ].map(({ icon, title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">{icon}</div>
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">أدوات حصاد الأخرى</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/smart-whiteboard", label: "السبورة الذكية" },
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
                { href: "/features/lesson-plan-ai", label: "مولّد خطة الدرس" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">حوّل فيديوهاتك إلى دروس تفاعلية</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وأضف أسئلة على أول فيديو تعليمي خلال دقائق.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                ابدأ مجاناً <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                تعرّف على حصاد
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
