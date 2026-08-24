/* /about — رحلة + هوية المنصة بالعربية الفصحى الواضحة.
   هدف الصفحة: محتوى ثابت غني بالكلمات المفتاحية (حصاد، منصة حصاد،
   عروض تفاعلية، مسابقات تعليمية، واجبات وأنشطة، تعليم تفاعلي،
   إنشاء عروض بالذكاء الاصطناعي) قابل للفهرسة من Google بشكل مباشر،
   مع تجربة قراءة طبيعية للمعلم/الطالب. */

import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles,
  GraduationCap,
  Trophy,
  ClipboardList,
  Presentation,
  Bot,
  Users,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export default function AboutPage() {
  const { lang, dir } = useI18n();
  useSeo({
    title: lang === "ar" ? "عن منصة حصاد | حصاد X — التعليم التفاعلي والمسابقات والعروض بالذكاء الاصطناعي" : "About HasadX | Interactive teaching, quizzes, and AI presentations",
    description: lang === "ar"
      ? "تعرّف على منصة حصاد (HasadX): منصة تعليم تفاعلي عربية تتيح للمعلمين إنشاء عروض تفاعلية ومسابقات تعليمية وواجبات وأنشطة، وإنشاء عروض بالذكاء الاصطناعي بسهولة وسرعة."
      : "Learn about HasadX, an interactive learning platform for presentations, educational quizzes, assignments, activities, and AI-assisted lesson creation.",
    canonicalPath: "/about",
    ogImage: "/opengraph.jpg",
  });
  if (lang === "en") return <AboutEnglish dir={dir} />;

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              منصة حصاد · HasadX
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              منصة حصاد التعليمية — تعليم تفاعلي بطعم عربي حديث
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              منصة <strong>حصاد</strong> (HasadX) هي منصة عربية متكاملة للتعليم التفاعلي،
              تساعد المعلمين والمدارس على إنشاء <strong>عروض تفاعلية</strong> و
              <strong> مسابقات تعليمية</strong> و<strong>واجبات وأنشطة</strong> ذكية،
              ومتابعة الطلاب وتحفيزهم في تجربة واحدة سلسة.
            </p>
          </header>

          {/* الرؤية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              لماذا منصة حصاد؟
            </h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                وُلدت <strong>منصة حصاد</strong> من قناعة بأن الطالب العربي يستحق محتوى
                تعليميًا حديثًا، يجمع بين الجدية الأكاديمية ومتعة <strong>التعليم
                التفاعلي</strong>. نقدّم للمعلم أدوات احترافية تختصر ساعات التحضير في
                دقائق: من <strong>إنشاء عروض بالذكاء الاصطناعي</strong>، إلى توليد
                الأسئلة، وتصميم <strong>المسابقات التعليمية</strong> الحيّة بهوية
                عربية كاملة وبدعم RTL أصيل عبر لعبة <strong>وميض</strong>.
              </p>
              <p>
                تختصر منصة حصاد المسافة بين الفصل التقليدي والفصل الذكي: المعلم يُنشئ
                نشاطًا أو عرضًا أو واجبًا في دقائق، ويشاركه مع الطلاب عبر رابط أو رمز
                دخول، ويتابع الإجابات والنتائج لحظة بلحظة.
              </p>
            </div>
          </section>

          {/* الميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              ماذا تقدّم لك حصاد X؟
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              <FeatureItem
                icon={<Presentation className="w-5 h-5" />}
                title="عروض تفاعلية"
                body="عروض شرائح حية مع أسئلة، استطلاعات، ولوحات تفاعل مباشرة مع الطلاب عبر PIN، تصلح للحصة الصفية وللتعلم عن بُعد."
              />
              <FeatureItem
                icon={<Trophy className="w-5 h-5" />}
                title="مسابقات تعليمية"
                body="مسابقات حصاد ذات أسلوب لعبي محفّز، تشمل تحدي حصاد، عجلة التحدي، اختبارات تنافسية، وتحديات جماعية بثلاثية الأبعاد."
              />
              <FeatureItem
                icon={<ClipboardList className="w-5 h-5" />}
                title="واجبات وأنشطة"
                body="واجبات وأنشطة قابلة للتصحيح الآلي بالذكاء الاصطناعي، مع تقارير أداء فردية ومجموعية للمعلم."
              />
              <FeatureItem
                icon={<Bot className="w-5 h-5" />}
                title="إنشاء عروض بالذكاء الاصطناعي"
                body="أدخل عنوان الدرس، واترك الذكاء الاصطناعي يبني لك عرضًا تعليميًا متكاملًا — شرائح، أمثلة، أسئلة، ومصادر — في دقيقة واحدة."
              />
              <FeatureItem
                icon={<GraduationCap className="w-5 h-5" />}
                title="مساعد تعليمي ذكي"
                body="مساعد ذكاء اصطناعي مدمج يجيب على المعلم والطالب بلغة عربية واضحة، ويقترح أنشطة وأفكار تعليمية مخصصة."
              />
              <FeatureItem
                icon={<Users className="w-5 h-5" />}
                title="إدارة الفصول والطلاب"
                body="استيراد قوائم الطلاب، تنظيم الفصول والأقسام، ومتابعة تقدّم كل طالب على لوحة واحدة بسيطة."
              />
            </ul>
          </section>

          {/* لمن */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              لمن صُمِّمت منصة حصاد؟
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <AudienceCard
                title="المعلم"
                body="ينشئ ويصحح بسرعة، ويصل لكل طالب باهتمام شخصي حتى في الفصول الكبيرة."
              />
              <AudienceCard
                title="المدرسة والمنظمات"
                body="إدارة مركزية للأنشطة، مكتبة موارد مشتركة، وتقارير تعليمية للمشرفين."
              />
              <AudienceCard
                title="الطالب"
                body="تجربة لعبية محفّزة تجعل المراجعة والاختبار أمتع، مع تقدّم واضح ومكافآت."
              />
            </div>
          </section>

          {/* القيم */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              ما يميّز حصاد عن غيرها
            </h2>
            <ul className="space-y-3 text-slate-700 leading-loose">
              {[
                "هوية عربية أصيلة ودعم RTL كامل من الصفر — وليس ترجمة من منصات أجنبية.",
                "أدوات الذكاء الاصطناعي مُصمَّمة للمنهج العربي والمعلم العربي.",
                "تعمل على الحاسوب والجوّال بأداء ممتاز وبدون تحميل تطبيقات معقدة.",
                "خصوصية الطالب مصونة، وبيانات الفصل لا تُشارك خارج المنصة.",
                "تطوير مستمر بالشراكة مع المعلمين أنفسهم.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              جاهز لتجربة منصة حصاد؟
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              ابدأ مجانًا وأنشئ أول عرض تفاعلي أو مسابقة تعليمية للطلاب خلال دقائق.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition"
              >
                إنشاء حساب جديد
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition"
              >
                العودة للرئيسية
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}

function AboutEnglish({ dir }: { dir: "rtl" | "ltr" }) {
  const features = [
    [<Presentation className="w-5 h-5" />, "Interactive presentations", "Live slide presentations with questions, polls, and direct student participation through a PIN—ideal for classrooms and remote learning."],
    [<Trophy className="w-5 h-5" />, "Educational competitions", "Motivating game-style competitions, including live challenges, competitive quizzes, and group challenges."],
    [<ClipboardList className="w-5 h-5" />, "Assignments and activities", "Assignments and activities with AI-assisted grading and individual and group performance reports."],
    [<Bot className="w-5 h-5" />, "AI presentation creation", "Enter a lesson title and let AI build a complete educational presentation with slides, examples, questions, and sources."],
    [<GraduationCap className="w-5 h-5" />, "Smart learning assistant", "An integrated AI assistant that supports teachers and students with clear answers, activities, and teaching ideas."],
    [<Users className="w-5 h-5" />, "Class and student management", "Import student lists, organize classes and sections, and follow each student's progress in one simple dashboard."],
  ] as const;
  return <Layout><main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
      <header className="text-center mb-12"><div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4"><Sparkles className="w-4 h-4" />HasadX</div><h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">HasadX: modern interactive learning</h1><p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">HasadX is an integrated interactive learning platform that helps teachers and schools create <strong>interactive presentations</strong>, <strong>educational quizzes</strong>, smart <strong>assignments and activities</strong>, and motivate students in one seamless experience.</p></header>
      <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">Why HasadX?</h2><div className="prose prose-lg max-w-none text-slate-700 leading-loose"><p>We believe every learner deserves modern educational content that combines academic rigor with the enjoyment of interactive learning. Our professional tools reduce hours of preparation to minutes—from AI presentation creation and question generation to live educational competitions.</p><p>HasadX bridges the gap between the traditional and smart classroom: teachers can create an activity, presentation, or assignment in minutes, share it by link or access code, and follow answers and results in real time.</p></div></section>
      <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">What can HasadX do for you?</h2><ul className="grid md:grid-cols-2 gap-4">{features.map(([icon, title, body]) => <FeatureItem key={title} icon={icon} title={title} body={body} />)}</ul></section>
      <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">Who is HasadX for?</h2><div className="grid md:grid-cols-3 gap-4"><AudienceCard title="Teachers" body="Create and grade quickly, and give every student personal attention—even in large classes." /><AudienceCard title="Schools and organizations" body="Central activity management, a shared resource library, and educational reports for supervisors." /><AudienceCard title="Students" body="A motivating game-like experience that makes revision and assessment more enjoyable, with clear progress and rewards." /></div></section>
      <section className="mb-14"><h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">What makes HasadX different</h2><ul className="space-y-3 text-slate-700 leading-loose">{["Built for an Arabic-first learning experience with full RTL support.", "AI tools designed to support teachers and educational content.", "Excellent desktop and mobile performance without complicated app installation.", "Student privacy is protected and class data is not shared outside the platform.", "Continuously improved in partnership with teachers."].map(line => <li key={line} className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" /><span>{line}</span></li>)}</ul></section>
      <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12"><h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to try HasadX?</h2><p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">Start free and create your first interactive presentation or educational quiz in minutes.</p><div className="flex flex-wrap items-center justify-center gap-3"><Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">Create an account <ArrowLeft className="w-4 h-4 rotate-180" /></Link><Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">Back to home</Link></div></section>
    </div></main></Layout>;
}

function FeatureItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-emerald-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function AudienceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-5 bg-white border border-emerald-100 rounded-xl">
      <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}
